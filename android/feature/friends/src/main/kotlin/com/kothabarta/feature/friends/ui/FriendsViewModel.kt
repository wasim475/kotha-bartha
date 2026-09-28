package com.kothabarta.feature.friends.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.decodeSocketPayload
import com.kothabarta.core.network.messages.ConversationLauncher
import com.kothabarta.core.network.social.FriendAcceptedEvent
import com.kothabarta.core.network.social.FriendEntryDto
import com.kothabarta.core.network.social.FriendNewEvent
import com.kothabarta.core.network.social.PresenceUpdate
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.friends.data.FriendsRepository
import io.socket.emitter.Emitter
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class FriendsTab { FRIENDS, REQUESTS, SENT }

data class FriendsUiState(
    val tab: FriendsTab = FriendsTab.FRIENDS,
    val isLoading: Boolean = true,
    val friends: List<SafeUserDto> = emptyList(),
    val requests: List<FriendEntryDto> = emptyList(),
    val sent: List<FriendEntryDto> = emptyList(),
    /** Only ever populated for conversation partners — see [PresenceUpdate]'s doc. */
    val onlineUserIds: Set<String> = emptySet(),
    val error: String? = null,
    val actionInFlightId: String? = null,
)

class FriendsViewModel(
    private val repository: FriendsRepository,
    private val socketManager: SocketManager,
    private val conversationLauncher: ConversationLauncher,
) : ViewModel() {

    private val _uiState = MutableStateFlow(FriendsUiState())
    val uiState: StateFlow<FriendsUiState> = _uiState.asStateFlow()

    private val _navigationEvents = MutableSharedFlow<NavigationEvent>(extraBufferCapacity = 1)
    val navigationEvents: SharedFlow<NavigationEvent> = _navigationEvents.asSharedFlow()

    private val presenceListener = Emitter.Listener { args ->
        args.firstOrNull()?.decodeSocketPayload<PresenceUpdate>()?.let { update ->
            _uiState.update { state ->
                val next = state.onlineUserIds.toMutableSet()
                if (update.isOnline) next.add(update.userId) else next.remove(update.userId)
                state.copy(onlineUserIds = next)
            }
        }
    }
    private val friendNewListener = Emitter.Listener { args ->
        args.firstOrNull()?.decodeSocketPayload<FriendNewEvent>()?.let {
            if (_uiState.value.tab == FriendsTab.REQUESTS) loadCurrentTab()
        }
    }
    private val friendAcceptedListener = Emitter.Listener { args ->
        args.firstOrNull()?.decodeSocketPayload<FriendAcceptedEvent>()?.let {
            if (_uiState.value.tab != FriendsTab.REQUESTS) loadCurrentTab()
        }
    }

    init {
        loadCurrentTab()
        socketManager.on("presence:update", presenceListener)
        socketManager.on("friend:new", friendNewListener)
        socketManager.on("friend:accepted", friendAcceptedListener)
    }

    override fun onCleared() {
        socketManager.off("presence:update", presenceListener)
        socketManager.off("friend:new", friendNewListener)
        socketManager.off("friend:accepted", friendAcceptedListener)
    }

    fun selectTab(tab: FriendsTab) {
        _uiState.update { it.copy(tab = tab) }
        loadCurrentTab()
    }

    private fun loadCurrentTab() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            when (_uiState.value.tab) {
                FriendsTab.FRIENDS -> when (val result = repository.getFriends()) {
                    is ApiResult.Success -> _uiState.update { it.copy(isLoading = false, friends = result.data) }
                    is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, error = result.error.message) }
                }
                FriendsTab.REQUESTS -> when (val result = repository.getRequests()) {
                    is ApiResult.Success -> _uiState.update { it.copy(isLoading = false, requests = result.data) }
                    is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, error = result.error.message) }
                }
                FriendsTab.SENT -> when (val result = repository.getSent()) {
                    is ApiResult.Success -> _uiState.update { it.copy(isLoading = false, sent = result.data) }
                    is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, error = result.error.message) }
                }
            }
        }
    }

    fun acceptRequest(entry: FriendEntryDto) {
        val requestId = entry.id ?: return
        runAction(requestId) { repository.acceptFriendRequest(requestId) }
    }

    fun declineOrCancel(entry: FriendEntryDto) {
        val otherUserId = entry.user?.id ?: return
        runAction(entry.id ?: otherUserId) { repository.cancelFriendRequest(otherUserId) }
    }

    fun unfriend(user: SafeUserDto) {
        runAction(user.id) { repository.unfriend(user.id) }
    }

    private fun runAction(id: String, action: suspend () -> ApiResult<*>) {
        viewModelScope.launch {
            _uiState.update { it.copy(actionInFlightId = id) }
            when (action()) {
                is ApiResult.Success -> { _uiState.update { it.copy(actionInFlightId = null) }; loadCurrentTab() }
                is ApiResult.Failure -> _uiState.update { it.copy(actionInFlightId = null) }
            }
        }
    }

    fun openProfile(userId: String) {
        viewModelScope.launch { _navigationEvents.emit(NavigationEvent.NavigateTo(Routes.profile(userId))) }
    }

    fun openMessage(userId: String) {
        viewModelScope.launch {
            when (val result = conversationLauncher.openConversationWith(userId)) {
                is ApiResult.Success -> {
                    val target = result.data
                    _navigationEvents.emit(
                        NavigationEvent.NavigateTo(Routes.chat(target.conversationId, target.peerId, target.peerName, target.peerAvatarUrl)),
                    )
                }
                is ApiResult.Failure -> _uiState.update { it.copy(error = result.error.message) }
            }
        }
    }
}
