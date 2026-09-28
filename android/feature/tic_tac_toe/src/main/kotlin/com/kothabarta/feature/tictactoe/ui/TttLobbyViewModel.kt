package com.kothabarta.feature.tictactoe.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.decodeSocketPayload
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.network.tictactoe.TttGameDto
import com.kothabarta.core.network.tictactoe.TttInviteDto
import com.kothabarta.core.network.tictactoe.TttInviteLifecycleEvent
import com.kothabarta.core.websocket.SocketConnectionState
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.tictactoe.data.TicTacToeRepository
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

data class TttLobbyUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val onlineFriends: List<SafeUserDto> = emptyList(),
    val activeGames: List<TttGameDto> = emptyList(),
    val incomingInvites: List<TttInviteDto> = emptyList(),
    val outgoingInvites: List<TttInviteDto> = emptyList(),
    val sendingInviteToUserId: String? = null,
)

private val INVITE_LIFECYCLE_EVENTS = listOf(
    "ticTacToe:invite",
    "ticTacToe:invite:accepted",
    "ticTacToe:invite:declined",
    "ticTacToe:invite:cancelled",
    "ticTacToe:invite:expired",
)

/**
 * Online friends + pending invites (incoming/outgoing) + active games, all
 * loaded via REST on init. Invite-lifecycle broadcasts only trigger a
 * refetch of the pending-invite/active-game lists — there is no local
 * event-shape merging here, matching "thinner depth" for this screen.
 */
class TttLobbyViewModel(
    private val repository: TicTacToeRepository,
    private val socketManager: SocketManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(TttLobbyUiState())
    val uiState: StateFlow<TttLobbyUiState> = _uiState.asStateFlow()

    private val _navigationEvents = MutableSharedFlow<NavigationEvent>(extraBufferCapacity = 1)
    val navigationEvents: SharedFlow<NavigationEvent> = _navigationEvents.asSharedFlow()

    private val inviteLifecycleListener = Emitter.Listener { args ->
        args.firstOrNull()?.decodeSocketPayload<TttInviteLifecycleEvent>()?.let { onInviteLifecycleEvent(it) }
    }

    init {
        load()
        INVITE_LIFECYCLE_EVENTS.forEach { socketManager.on(it, inviteLifecycleListener) }
        viewModelScope.launch {
            socketManager.connectionState
                .drop(1)
                .filter { it == SocketConnectionState.CONNECTED }
                .collect { load() }
        }
    }

    override fun onCleared() {
        INVITE_LIFECYCLE_EVENTS.forEach { socketManager.off(it, inviteLifecycleListener) }
    }

    fun retry() = load()

    internal fun onInviteLifecycleEvent(event: TttInviteLifecycleEvent) {
        loadPendingInvites()
        loadActiveGames()
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            when (val friendsResult = repository.getOnlineFriends()) {
                is ApiResult.Success -> _uiState.update { it.copy(isLoading = false, onlineFriends = friendsResult.data) }
                is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, error = friendsResult.error.message) }
            }
            loadActiveGames()
            loadPendingInvites()
        }
    }

    private fun loadActiveGames() {
        viewModelScope.launch {
            when (val result = repository.getActiveGames()) {
                is ApiResult.Success -> _uiState.update { it.copy(activeGames = result.data) }
                is ApiResult.Failure -> Unit
            }
        }
    }

    private fun loadPendingInvites() {
        viewModelScope.launch {
            when (val result = repository.getPendingInvites()) {
                is ApiResult.Success -> _uiState.update {
                    it.copy(incomingInvites = result.data.incoming, outgoingInvites = result.data.outgoing)
                }
                is ApiResult.Failure -> Unit
            }
        }
    }

    fun invite(user: SafeUserDto) {
        viewModelScope.launch {
            _uiState.update { it.copy(sendingInviteToUserId = user.id) }
            val result = repository.sendInvite(user.id)
            _uiState.update { it.copy(sendingInviteToUserId = null) }
            if (result is ApiResult.Success) {
                _uiState.update { it.copy(outgoingInvites = it.outgoingInvites + result.data) }
            } else if (result is ApiResult.Failure) {
                _uiState.update { it.copy(error = result.error.message) }
            }
        }
    }

    fun acceptInvite(invite: TttInviteDto) {
        viewModelScope.launch {
            when (val result = repository.acceptInvite(invite.id)) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(incomingInvites = it.incomingInvites.filterNot { i -> i.id == invite.id }) }
                    _navigationEvents.emit(NavigationEvent.NavigateTo(Routes.tttGame(result.data.game.id)))
                }
                is ApiResult.Failure -> _uiState.update { it.copy(error = result.error.message) }
            }
        }
    }

    fun declineInvite(invite: TttInviteDto) {
        viewModelScope.launch {
            val result = repository.declineInvite(invite.id)
            if (result is ApiResult.Success) {
                _uiState.update { it.copy(incomingInvites = it.incomingInvites.filterNot { i -> i.id == invite.id }) }
            }
        }
    }

    fun cancelInvite(invite: TttInviteDto) {
        viewModelScope.launch {
            val result = repository.cancelInvite(invite.id)
            if (result is ApiResult.Success) {
                _uiState.update { it.copy(outgoingInvites = it.outgoingInvites.filterNot { i -> i.id == invite.id }) }
            }
        }
    }

    fun openGame(gameId: String) {
        viewModelScope.launch {
            _navigationEvents.emit(NavigationEvent.NavigateTo(Routes.tttGame(gameId)))
        }
    }
}
