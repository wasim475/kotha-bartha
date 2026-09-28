package com.kothabarta.feature.notifications.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.social.NotificationDto
import com.kothabarta.core.websocket.SocketConnectionState
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.notifications.data.NotificationBadge
import com.kothabarta.feature.notifications.data.NotificationsRepository
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

data class NotificationsUiState(
    val isLoading: Boolean = true,
    val notifications: List<NotificationDto> = emptyList(),
    val error: String? = null,
)

/**
 * Realtime strategy matches the web client exactly (see
 * docs/architecture/android-implementation-plan.md's Phase 2 research): on
 * `notification:new` this does a full authoritative re-fetch rather than
 * appending the pushed payload, which is what actually makes duplicates
 * structurally impossible — a replaced list can't contain the same row
 * twice, whereas a hand-rolled id-dedup on an appended list is one more
 * place to get wrong. The same reload also runs once after a reconnect
 * (skipping the very first connection, already covered by [init]'s own
 * load), so anything missed while offline is caught up.
 */
class NotificationsViewModel(
    private val repository: NotificationsRepository,
    private val badge: NotificationBadge,
    private val socketManager: SocketManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(NotificationsUiState())
    val uiState: StateFlow<NotificationsUiState> = _uiState.asStateFlow()

    private val _navigationEvents = MutableSharedFlow<NavigationEvent>(extraBufferCapacity = 1)
    val navigationEvents: SharedFlow<NavigationEvent> = _navigationEvents.asSharedFlow()

    private val newNotificationListener = Emitter.Listener { load() }

    init {
        load()
        socketManager.on("notification:new", newNotificationListener)
        viewModelScope.launch {
            socketManager.connectionState
                .drop(1)
                .filter { it == SocketConnectionState.CONNECTED }
                .collect { load() }
        }
    }

    override fun onCleared() {
        socketManager.off("notification:new", newNotificationListener)
    }

    fun retry() = load()

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = it.notifications.isEmpty(), error = null) }
            when (val result = repository.getNotifications()) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(isLoading = false, notifications = result.data) }
                    badge.update(result.data.count { !it.read })
                }
                is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }

    fun markAllRead() {
        viewModelScope.launch {
            repository.markAllRead()
            load()
        }
    }

    /** Marks read, then navigates using the same `postId`-present fallback the web client uses. */
    fun open(notification: NotificationDto) {
        viewModelScope.launch {
            if (!notification.read) {
                repository.markRead(notification.id)
                _uiState.update { state ->
                    state.copy(notifications = state.notifications.map {
                        if (it.id == notification.id) it.copy(read = true) else it
                    })
                }
                badge.update(_uiState.value.notifications.count { !it.read })
            }
            val postId = notification.postId
            val conversationId = notification.payload?.get("conversationId") as? String
            val route = when {
                postId != null -> Routes.post(postId)
                notification.type == "friend_request" || notification.type == "friend_accepted" -> Routes.FRIENDS
                notification.type == "missed_call" && conversationId != null -> Routes.chat(conversationId)
                else -> null
            }
            if (route != null) _navigationEvents.emit(NavigationEvent.NavigateTo(route))
        }
    }
}
