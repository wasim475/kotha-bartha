package com.kothabarta.feature.games.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.decodeSocketPayload
import com.kothabarta.core.network.games.ChallengeInviteDto
import com.kothabarta.core.network.games.ChallengeInviteLifecycleEvent
import com.kothabarta.core.network.games.GameCatalogEntryDto
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.websocket.SocketConnectionState
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.games.data.GameChallengeRepository
import com.kothabarta.feature.games.data.GamesRepository
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

private const val EVENT_INVITE = "gameChallenge:invite"
private const val EVENT_ACCEPTED = "gameChallenge:accepted"
private const val EVENT_DECLINED = "gameChallenge:declined"
private const val EVENT_CANCELLED = "gameChallenge:cancelled"
private const val EVENT_EXPIRED = "gameChallenge:expired"
private const val EVENT_REMATCH = "gameChallenge:rematch"
private const val EVENT_REMATCH_ACCEPTED = "gameChallenge:rematchAccepted"
private const val EVENT_REMATCH_DECLINED = "gameChallenge:rematchDeclined"
private const val EVENT_REMATCH_CANCELLED = "gameChallenge:rematchCancelled"
private const val EVENT_REMATCH_EXPIRED = "gameChallenge:rematchExpired"

data class ChallengeUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val onlineFriends: List<SafeUserDto> = emptyList(),
    val incomingInvites: List<ChallengeInviteDto> = emptyList(),
    val outgoingInvites: List<ChallengeInviteDto> = emptyList(),
    val challengeableGames: List<GameCatalogEntryDto> = emptyList(),
    val selectedGameType: String? = null,
    val sendingInviteToUserId: String? = null,
)

/**
 * "Play with Friend" lobby — online friends, pending invites (both
 * directions) and the invite-lifecycle broadcasts that keep them live. Not
 * parameterized: [selectedGameType] is chosen in-screen from [challengeableGames]
 * (the catalog entries with `supportsChallenge == true`) rather than passed in,
 * so this can be reached as a plain Koin `viewModel {}` from anywhere in
 * `:feature:games` (see `GamesCatalogScreen`'s in-screen "Challenge a friend"
 * section) without inventing a new nav route for the lobby itself.
 */
class ChallengeViewModel(
    private val challengeRepository: GameChallengeRepository,
    private val gamesRepository: GamesRepository,
    private val socketManager: SocketManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChallengeUiState())
    val uiState: StateFlow<ChallengeUiState> = _uiState.asStateFlow()

    private val _navigationEvents = MutableSharedFlow<NavigationEvent>(extraBufferCapacity = 1)
    val navigationEvents: SharedFlow<NavigationEvent> = _navigationEvents.asSharedFlow()

    /**
     * `internal` (not `private`) so `ChallengeViewModelTest` can drive the
     * dedup/lifecycle logic directly with plain DTOs, the same way
     * `ChatViewModelTest` exercises `appendIncoming` — `SocketManager` never
     * actually connects in a JVM unit test, so there's no way to fire a real
     * socket event through it.
     */
    internal fun applyIncomingInvite(invite: ChallengeInviteDto) {
        _uiState.update { state ->
            if (state.incomingInvites.any { it.id == invite.id }) state
            else state.copy(incomingInvites = state.incomingInvites + invite)
        }
    }

    internal fun applyResolvedInvite(inviteId: String?, matchId: String?, navigateIfMatch: Boolean) {
        _uiState.update { state ->
            state.copy(
                incomingInvites = state.incomingInvites.filterNot { it.id == inviteId },
                outgoingInvites = state.outgoingInvites.filterNot { it.id == inviteId },
            )
        }
        if (navigateIfMatch && matchId != null) {
            viewModelScope.launch { _navigationEvents.emit(NavigationEvent.NavigateTo(Routes.challengePlay(matchId))) }
        }
    }

    private fun onIncomingInvite(args: Array<out Any>) {
        val event = args.firstOrNull()?.decodeSocketPayload<ChallengeInviteLifecycleEvent>() ?: return
        val invite = event.invite ?: return
        applyIncomingInvite(invite)
    }

    private fun onResolved(args: Array<out Any>, navigateIfMatch: Boolean) {
        val event = args.firstOrNull()?.decodeSocketPayload<ChallengeInviteLifecycleEvent>() ?: return
        val id = event.invite?.id ?: event.requestId
        val matchId = event.matchId ?: event.invite?.matchId
        applyResolvedInvite(id, matchId, navigateIfMatch)
    }

    /**
     * One [Emitter.Listener] instance per event name, kept in a map so the
     * same instance registered via [SocketManager.on] in `init` is the exact
     * instance passed back to [SocketManager.off] in [onCleared] — a bare
     * event-name `off` would also drop any other screen's listener for the
     * same event.
     */
    private val listeners: Map<String, Emitter.Listener> = mapOf(
        EVENT_INVITE to Emitter.Listener { args -> onIncomingInvite(args) },
        EVENT_ACCEPTED to Emitter.Listener { args -> onResolved(args, navigateIfMatch = true) },
        EVENT_DECLINED to Emitter.Listener { args -> onResolved(args, navigateIfMatch = false) },
        EVENT_CANCELLED to Emitter.Listener { args -> onResolved(args, navigateIfMatch = false) },
        EVENT_EXPIRED to Emitter.Listener { args -> onResolved(args, navigateIfMatch = false) },
        EVENT_REMATCH to Emitter.Listener { args -> onIncomingInvite(args) },
        EVENT_REMATCH_ACCEPTED to Emitter.Listener { args -> onResolved(args, navigateIfMatch = true) },
        EVENT_REMATCH_DECLINED to Emitter.Listener { args -> onResolved(args, navigateIfMatch = false) },
        EVENT_REMATCH_CANCELLED to Emitter.Listener { args -> onResolved(args, navigateIfMatch = false) },
        EVENT_REMATCH_EXPIRED to Emitter.Listener { args -> onResolved(args, navigateIfMatch = false) },
    )

    init {
        load()
        listeners.forEach { (event, listener) -> socketManager.on(event, listener) }
        viewModelScope.launch {
            socketManager.connectionState
                .drop(1)
                .filter { it == SocketConnectionState.CONNECTED }
                .collect { load() }
        }
    }

    override fun onCleared() {
        listeners.forEach { (event, listener) -> socketManager.off(event, listener) }
    }

    fun retry() = load()

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            val friendsResult = challengeRepository.getOnlineFriends()
            if (friendsResult is ApiResult.Failure) {
                _uiState.update { it.copy(isLoading = false, error = friendsResult.error.message) }
                return@launch
            }
            val invitesResult = challengeRepository.getPendingInvites()
            if (invitesResult is ApiResult.Failure) {
                _uiState.update { it.copy(isLoading = false, error = invitesResult.error.message) }
                return@launch
            }
            val catalogResult = gamesRepository.getCatalog()
            val challengeable = (catalogResult as? ApiResult.Success)?.data?.filter { it.supportsChallenge } ?: emptyList()
            val friends = (friendsResult as ApiResult.Success).data
            val invites = (invitesResult as ApiResult.Success).data
            _uiState.update { state ->
                state.copy(
                    isLoading = false,
                    onlineFriends = friends,
                    incomingInvites = invites.incoming,
                    outgoingInvites = invites.outgoing,
                    challengeableGames = challengeable,
                    selectedGameType = state.selectedGameType ?: challengeable.firstOrNull()?.type,
                )
            }
        }
    }

    fun selectGameType(gameType: String) {
        _uiState.update { it.copy(selectedGameType = gameType) }
    }

    fun sendInvite(friend: SafeUserDto) {
        val gameType = _uiState.value.selectedGameType ?: return
        _uiState.update { it.copy(sendingInviteToUserId = friend.id, error = null) }
        viewModelScope.launch {
            when (val result = challengeRepository.sendInvite(friend.id, gameType)) {
                is ApiResult.Success -> _uiState.update { state ->
                    state.copy(sendingInviteToUserId = null, outgoingInvites = state.outgoingInvites + result.data)
                }
                is ApiResult.Failure -> _uiState.update { it.copy(sendingInviteToUserId = null, error = result.error.message) }
            }
        }
    }

    fun acceptInvite(invite: ChallengeInviteDto) {
        viewModelScope.launch {
            when (val result = challengeRepository.acceptInvite(invite.id)) {
                is ApiResult.Success -> {
                    _uiState.update { state -> state.copy(incomingInvites = state.incomingInvites.filterNot { it.id == invite.id }) }
                    _navigationEvents.emit(NavigationEvent.NavigateTo(Routes.challengePlay(result.data.match.id)))
                }
                is ApiResult.Failure -> _uiState.update { it.copy(error = result.error.message) }
            }
        }
    }

    fun declineInvite(invite: ChallengeInviteDto) {
        _uiState.update { state -> state.copy(incomingInvites = state.incomingInvites.filterNot { it.id == invite.id }) }
        viewModelScope.launch { challengeRepository.declineInvite(invite.id) }
    }

    fun cancelInvite(invite: ChallengeInviteDto) {
        _uiState.update { state -> state.copy(outgoingInvites = state.outgoingInvites.filterNot { it.id == invite.id }) }
        viewModelScope.launch { challengeRepository.cancelInvite(invite.id) }
    }
}
