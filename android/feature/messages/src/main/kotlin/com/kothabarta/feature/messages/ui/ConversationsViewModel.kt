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
import com.kothabarta.core.websocket.SocketConnectionState
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.messages.data.MessagesRepository
import io.socket.emitter.Emitter
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
)

class ConversationsViewModel(
    private val repository: MessagesRepository,
    private val socketManager: SocketManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ConversationsUiState())
    val uiState: StateFlow<ConversationsUiState> = _uiState.asStateFlow()

    private val _navigationEvents = MutableSharedFlow<NavigationEvent>(extraBufferCapacity = 1)
    val navigationEvents: SharedFlow<NavigationEvent> = _navigationEvents.asSharedFlow()

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

    /** A new message anywhere reorders/refreshes the list — simplest correct way to keep preview + unread count authoritative. */
    private val newMessageListener = Emitter.Listener { args ->
        args.firstOrNull()?.decodeSocketPayload<MessageDto>()?.let { load() }
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
    }

    fun refresh() = load(isPullToRefresh = true)
    fun retry() = load()

    private fun load(isPullToRefresh: Boolean = false) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = !isPullToRefresh && it.conversations.isEmpty(), isRefreshing = isPullToRefresh, error = null) }
            when (val result = repository.getConversations()) {
                is ApiResult.Success -> _uiState.update { it.copy(isLoading = false, isRefreshing = false, conversations = result.data) }
                is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, isRefreshing = false, error = result.error.message) }
            }
        }
    }

    fun openConversation(conversation: ConversationDto) {
        viewModelScope.launch {
            _navigationEvents.emit(
                NavigationEvent.NavigateTo(
                    Routes.chat(conversation.id, conversation.user?.id, conversation.user?.fullName, conversation.user?.avatar?.secureUrl),
                ),
            )
        }
    }
}
