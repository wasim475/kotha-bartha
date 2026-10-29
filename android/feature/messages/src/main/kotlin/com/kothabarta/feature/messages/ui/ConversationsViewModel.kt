package com.kothabarta.feature.messages.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.decodeSocketPayload
import com.kothabarta.core.network.messages.ConversationDto
import com.kothabarta.core.network.messages.MessageDto
import com.kothabarta.core.network.social.PresenceUpdate
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.websocket.SocketConnectionState
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.messages.data.MessagesRepository
import io.socket.emitter.Emitter
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ConversationsUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val conversations: List<ConversationDto> = emptyList(),
    val error: String? = null,
    val showingArchived: Boolean = false,
    val userSearchQuery: String = "",
    val userSearchResults: List<SafeUserDto> = emptyList(),
    val isSearchingUsers: Boolean = false,
    val userSearchError: String? = null,
    val failedOpeningUser: SafeUserDto? = null,
    val openingUserIds: Set<String> = emptySet(),
    val openingConversationIds: Set<String> = emptySet(),
    val busyActionIds: Set<String> = emptySet(),
    val actionMessage: String? = null,
    val actionError: String? = null,
)

enum class ConversationListAction { ARCHIVE, UNARCHIVE, DELETE, BLOCK, REPORT }

private const val USER_SEARCH_DEBOUNCE_MS = 300L

class ConversationsViewModel(
    private val repository: MessagesRepository,
    private val socketManager: SocketManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ConversationsUiState())
    val uiState: StateFlow<ConversationsUiState> = _uiState.asStateFlow()

    private val _navigationEvents = MutableSharedFlow<NavigationEvent>(extraBufferCapacity = 1)
    val navigationEvents: SharedFlow<NavigationEvent> = _navigationEvents.asSharedFlow()

    private var loadJob: Job? = null
    private var searchJob: Job? = null
    private var loadGeneration = 0
    private var searchGeneration = 0

    private val presenceListener = Emitter.Listener { args ->
        args.firstOrNull()?.decodeSocketPayload<PresenceUpdate>()?.let { update ->
            _uiState.update { state ->
                state.copy(conversations = state.conversations.map { conversation ->
                    val peer = conversation.user
                    if (peer != null && peer.id == update.userId) {
                        conversation.copy(user = peer.copy(isOnline = update.isOnline, lastSeenAt = update.lastSeenAt ?: peer.lastSeenAt))
                    } else conversation
                })
            }
        }
    }

    private val newMessageListener = Emitter.Listener { args ->
        args.firstOrNull()?.decodeSocketPayload<MessageDto>()?.let(::handleNewMessage)
    }

    init {
        load()
        socketManager.on("presence:update", presenceListener)
        socketManager.on("message:new", newMessageListener)
        viewModelScope.launch {
            socketManager.connectionState
                .drop(1)
                .filter { it == SocketConnectionState.CONNECTED }
                .collect { load() }
        }
    }

    override fun onCleared() {
        socketManager.off("presence:update", presenceListener)
        socketManager.off("message:new", newMessageListener)
        searchJob?.cancel()
        loadJob?.cancel()
    }

    fun refresh() = load(isPullToRefresh = true)
    fun retry() = load()

    fun dismissListError() {
        _uiState.update { it.copy(error = null) }
    }

    fun setShowingArchived(showArchived: Boolean) {
        if (_uiState.value.showingArchived == showArchived) return
        _uiState.update {
            it.copy(showingArchived = showArchived, conversations = emptyList(), isLoading = true, error = null)
        }
        load()
    }

    fun searchUsers(query: String) {
        val generation = ++searchGeneration
        searchJob?.cancel()
        _uiState.update {
            it.copy(
                userSearchQuery = query,
                userSearchResults = emptyList(),
                isSearchingUsers = query.trim().length >= 2,
                userSearchError = null,
                failedOpeningUser = null,
            )
        }
        if (query.trim().length < 2) {
            _uiState.update { it.copy(isSearchingUsers = false) }
            return
        }

        searchJob = viewModelScope.launch {
            delay(USER_SEARCH_DEBOUNCE_MS)
            when (val result = repository.searchUsers(query.trim())) {
                is ApiResult.Success -> {
                    if (generation == searchGeneration) {
                        _uiState.update {
                            it.copy(isSearchingUsers = false, userSearchResults = result.data, userSearchError = null)
                        }
                    }
                }
                is ApiResult.Failure -> {
                    if (generation == searchGeneration) {
                        _uiState.update {
                            it.copy(isSearchingUsers = false, userSearchError = result.error.message)
                        }
                    }
                }
            }
        }
    }

    fun openUserConversation(user: SafeUserDto) {
        if (user.id in _uiState.value.openingUserIds) return
        _uiState.update { it.copy(userSearchError = null, failedOpeningUser = null) }
        val existing = _uiState.value.conversations.firstOrNull { it.user?.id == user.id }
        if (existing != null) {
            openConversation(existing)
            return
        }

        _uiState.update {
            it.copy(
                openingUserIds = it.openingUserIds + user.id,
                userSearchError = null,
                failedOpeningUser = null,
            )
        }
        viewModelScope.launch {
            try {
                when (val result = repository.openConversationWith(user.id)) {
                    is ApiResult.Success -> {
                        val target = result.data
                        _navigationEvents.emit(
                            NavigationEvent.NavigateTo(
                                Routes.chat(
                                    conversationId = target.conversationId,
                                    peerId = user.id,
                                    peerName = user.fullName,
                                    peerAvatarUrl = user.avatar?.secureUrl,
                                    peerLastSeenAt = user.lastSeenAt,
                                ),
                            ),
                        )
                    }
                    is ApiResult.Failure -> _uiState.update {
                        it.copy(userSearchError = result.error.message, failedOpeningUser = user)
                    }
                }
            } finally {
                _uiState.update { it.copy(openingUserIds = it.openingUserIds - user.id) }
            }
        }
    }

    fun openConversation(conversation: ConversationDto) {
        if (conversation.id in _uiState.value.openingConversationIds) return
        _uiState.update { it.copy(openingConversationIds = it.openingConversationIds + conversation.id) }
        viewModelScope.launch {
            try {
                navigateToConversation(conversation)
            } finally {
                _uiState.update { it.copy(openingConversationIds = it.openingConversationIds - conversation.id) }
            }
        }
    }

    fun performAction(
        conversation: ConversationDto,
        action: ConversationListAction,
        reason: String? = null,
        description: String? = null,
    ) {
        val actionKey = "${action.name}:${conversation.id}"
        if (actionKey in _uiState.value.busyActionIds) return
        _uiState.update {
            it.copy(
                busyActionIds = it.busyActionIds + actionKey,
                actionError = null,
                actionMessage = null,
            )
        }
        viewModelScope.launch {
            val result = when (action) {
                ConversationListAction.ARCHIVE -> repository.archiveConversation(conversation.id)
                ConversationListAction.UNARCHIVE -> repository.unarchiveConversation(conversation.id)
                ConversationListAction.DELETE -> repository.deleteConversation(conversation.id)
                ConversationListAction.BLOCK -> conversation.user?.let { repository.blockUser(it.id) }
                    ?: missingUserResult()
                ConversationListAction.REPORT -> conversation.user?.let {
                    repository.reportUser(it.id, reason ?: "spam", description)
                } ?: missingUserResult()
            }
            when (result) {
                is ApiResult.Success -> {
                    if (action == ConversationListAction.ARCHIVE ||
                        action == ConversationListAction.UNARCHIVE ||
                        action == ConversationListAction.DELETE
                    ) {
                        _uiState.update { state ->
                            state.copy(conversations = state.conversations.filterNot { it.id == conversation.id })
                        }
                    }
                    _uiState.update { it.copy(actionMessage = actionSuccessMessage(action)) }
                }
                is ApiResult.Failure -> _uiState.update { it.copy(actionError = result.error.message) }
            }
            _uiState.update { it.copy(busyActionIds = it.busyActionIds - actionKey) }
        }
    }

    fun dismissActionMessage() {
        _uiState.update { it.copy(actionMessage = null, actionError = null) }
    }

    internal fun handleNewMessage(message: MessageDto) {
        if (message.conversationId != null) load()
    }

    private fun load(isPullToRefresh: Boolean = false) {
        val generation = ++loadGeneration
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            val archived = _uiState.value.showingArchived
            _uiState.update {
                it.copy(
                    isLoading = !isPullToRefresh && it.conversations.isEmpty(),
                    isRefreshing = isPullToRefresh,
                    error = null,
                )
            }
            when (val result = repository.getConversations(archived)) {
                is ApiResult.Success -> if (generation == loadGeneration) {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isRefreshing = false,
                            conversations = deduplicateConversations(result.data),
                        )
                    }
                }
                is ApiResult.Failure -> if (generation == loadGeneration) {
                    _uiState.update { it.copy(isLoading = false, isRefreshing = false, error = result.error.message) }
                }
            }
        }
    }

    private suspend fun navigateToConversation(conversation: ConversationDto) {
        _navigationEvents.emit(
            NavigationEvent.NavigateTo(
                Routes.chat(
                    conversationId = conversation.id,
                    peerId = conversation.user?.id,
                    peerName = conversation.user?.fullName,
                    peerAvatarUrl = conversation.user?.avatar?.secureUrl,
                    peerLastSeenAt = conversation.user?.lastSeenAt,
                    peerIsOnline = conversation.user?.isOnline == true,
                ),
            ),
        )
    }

    private fun actionSuccessMessage(action: ConversationListAction): String = when (action) {
        ConversationListAction.ARCHIVE -> "Conversation archived."
        ConversationListAction.UNARCHIVE -> "Conversation restored."
        ConversationListAction.DELETE -> "Conversation removed from your inbox."
        ConversationListAction.BLOCK -> "User blocked."
        ConversationListAction.REPORT -> "Report submitted."
    }

    private fun missingUserResult(): ApiResult<Nothing> =
        ApiResult.Failure(com.kothabarta.core.common.ApiError("INVALID_CONVERSATION", "This conversation has no user to act on."))
}

internal fun deduplicateConversations(conversations: List<ConversationDto>): List<ConversationDto> =
    conversations.distinctBy { it.id }
