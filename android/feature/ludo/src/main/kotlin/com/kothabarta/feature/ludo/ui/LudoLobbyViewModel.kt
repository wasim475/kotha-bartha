package com.kothabarta.feature.ludo.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.decodeSocketPayload
import com.kothabarta.core.network.ludo.CreateLudoLobbyRequest
import com.kothabarta.core.network.ludo.LudoGameDto
import com.kothabarta.core.network.ludo.LudoInviteDto
import com.kothabarta.core.network.ludo.LudoInviteLifecycleEvent
import com.kothabarta.core.network.ludo.LudoInviteRequest
import com.kothabarta.core.network.ludo.LudoVariantDto
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.websocket.SocketConnectionState
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.ludo.data.LudoRepository
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

data class LudoLobbyUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val variants: List<LudoVariantDto> = emptyList(),
    val selectedVariantId: String? = null,
    val isCreatingLobby: Boolean = false,
    val onlineFriends: List<SafeUserDto> = emptyList(),
    val activeGames: List<LudoGameDto> = emptyList(),
    val incomingInvites: List<LudoInviteDto> = emptyList(),
    val outgoingInvites: List<LudoInviteDto> = emptyList(),
    val sendingInviteToUserId: String? = null,
    /** The lobby-status game currently picked as the target for "invite a friend" — null hides that affordance. */
    val inviteTargetGameId: String? = null,
)

private val INVITE_LIFECYCLE_EVENTS = listOf(
    "ludo:invite",
    "ludo:invite:accepted",
    "ludo:invite:declined",
    "ludo:invite:cancelled",
    "ludo:invite:expired",
)

/**
 * Variant catalog (LOCAL_CLASSIC and any `online == false` variant filtered
 * out — Android isn't implementing offline pass-and-play this pass) + online
 * friends + pending invites + resumable active games, following the same
 * shape as `TttLobbyViewModel`. Unlike Tic-Tac-Toe, `LudoInviteRequest`
 * requires an existing lobby `gameId` (there's no "invite a friend and a
 * game gets created" shortcut server-side), so inviting here targets one of
 * [LudoLobbyUiState.activeGames] that's still in `"lobby"` status rather than
 * the just-created one (which the "create lobby" action navigates straight
 * into, per spec).
 */
class LudoLobbyViewModel(
    private val repository: LudoRepository,
    private val socketManager: SocketManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LudoLobbyUiState())
    val uiState: StateFlow<LudoLobbyUiState> = _uiState.asStateFlow()

    private val _navigationEvents = MutableSharedFlow<NavigationEvent>(extraBufferCapacity = 1)
    val navigationEvents: SharedFlow<NavigationEvent> = _navigationEvents.asSharedFlow()

    private val inviteLifecycleListener = Emitter.Listener { args ->
        args.firstOrNull()?.decodeSocketPayload<LudoInviteLifecycleEvent>()?.let { onInviteLifecycleEvent(it) }
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

    internal fun onInviteLifecycleEvent(event: LudoInviteLifecycleEvent) {
        loadPendingInvites()
        loadActiveGames()
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            when (val catalogResult = repository.getCatalog()) {
                is ApiResult.Success -> {
                    val variants = catalogResult.data.variants.filter { it.id != "LOCAL_CLASSIC" && it.online }
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            variants = variants,
                            selectedVariantId = it.selectedVariantId ?: variants.firstOrNull()?.id,
                        )
                    }
                }
                is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, error = catalogResult.error.message) }
            }
            loadOnlineFriends()
            loadActiveGames()
            loadPendingInvites()
        }
    }

    private fun loadOnlineFriends() {
        viewModelScope.launch {
            when (val result = repository.getOnlineFriends()) {
                is ApiResult.Success -> _uiState.update { it.copy(onlineFriends = result.data) }
                is ApiResult.Failure -> Unit
            }
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

    fun selectVariant(variantId: String) {
        _uiState.update { it.copy(selectedVariantId = variantId) }
    }

    fun createLobby() {
        val variantId = _uiState.value.selectedVariantId ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isCreatingLobby = true, error = null) }
            when (val result = repository.createLobby(CreateLudoLobbyRequest(variantId))) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(isCreatingLobby = false) }
                    _navigationEvents.emit(NavigationEvent.NavigateTo(Routes.ludoGame(result.data.game.id)))
                }
                is ApiResult.Failure -> _uiState.update { it.copy(isCreatingLobby = false, error = result.error.message) }
            }
        }
    }

    fun setInviteTarget(gameId: String?) {
        _uiState.update { it.copy(inviteTargetGameId = gameId) }
    }

    fun invite(user: SafeUserDto) {
        val gameId = _uiState.value.inviteTargetGameId ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(sendingInviteToUserId = user.id) }
            val result = repository.sendInvite(LudoInviteRequest(gameId, user.id))
            _uiState.update { it.copy(sendingInviteToUserId = null) }
            if (result is ApiResult.Success) {
                _uiState.update { it.copy(outgoingInvites = it.outgoingInvites + result.data) }
            } else if (result is ApiResult.Failure) {
                _uiState.update { it.copy(error = result.error.message) }
            }
        }
    }

    fun acceptInvite(invite: LudoInviteDto) {
        viewModelScope.launch {
            when (val result = repository.acceptInvite(invite.id)) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(incomingInvites = it.incomingInvites.filterNot { i -> i.id == invite.id }) }
                    _navigationEvents.emit(NavigationEvent.NavigateTo(Routes.ludoGame(result.data.game.id)))
                }
                is ApiResult.Failure -> _uiState.update { it.copy(error = result.error.message) }
            }
        }
    }

    fun declineInvite(invite: LudoInviteDto) {
        viewModelScope.launch {
            val result = repository.declineInvite(invite.id)
            if (result is ApiResult.Success) {
                _uiState.update { it.copy(incomingInvites = it.incomingInvites.filterNot { i -> i.id == invite.id }) }
            }
        }
    }

    fun cancelInvite(invite: LudoInviteDto) {
        viewModelScope.launch {
            val result = repository.cancelInvite(invite.id)
            if (result is ApiResult.Success) {
                _uiState.update { it.copy(outgoingInvites = it.outgoingInvites.filterNot { i -> i.id == invite.id }) }
            }
        }
    }

    fun openGame(gameId: String) {
        viewModelScope.launch {
            _navigationEvents.emit(NavigationEvent.NavigateTo(Routes.ludoGame(gameId)))
        }
    }
}
