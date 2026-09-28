package com.kothabarta.feature.tictactoe.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.auth.AuthApi
import com.kothabarta.core.network.decodeSocketPayload
import com.kothabarta.core.network.encodeSocketPayload
import com.kothabarta.core.network.safeApiCall
import com.kothabarta.core.network.tictactoe.TttFinishedEvent
import com.kothabarta.core.network.tictactoe.TttGameDto
import com.kothabarta.core.network.tictactoe.TttInviteLifecycleEvent
import com.kothabarta.core.network.tictactoe.TttMoveEvent
import com.kothabarta.core.network.tictactoe.TttPlayerLeftEvent
import com.kothabarta.core.network.tictactoe.TttReactionEvent
import com.kothabarta.core.network.tictactoe.TttStateEvent
import com.kothabarta.core.websocket.SocketConnectionState
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.tictactoe.data.TicTacToeRepository
import io.socket.client.Ack
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

/** The exact `GAME_REACTIONS` set from `server/src/services/ticTacToe.service.js` — any other string is rejected by the server. */
val TTT_REACTION_TYPES = listOf("poke", "haha", "sad", "angry")

data class TttGameUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val game: TttGameDto? = null,
    val myUserId: String? = null,
    val mySymbol: String? = null,
    val isSubmittingMove: Boolean = false,
    val moveError: String? = null,
    val opponentLeft: Boolean = false,
    val incomingRematch: TttInviteLifecycleEvent? = null,
    val isRequestingRematch: Boolean = false,
    val rematchRequestSent: Boolean = false,
    val lastReaction: TttReactionEvent? = null,
)

private data class TttJoinRequest(val gameId: String)
private data class TttJoinAck(val ok: Boolean = false, val game: TttGameDto? = null, val error: String? = null)
private data class TttLeaveRequest(val gameId: String)
private data class TttMoveSocketRequest(val gameId: String, val cellIndex: Int)
private data class TttMoveAck(val ok: Boolean = false, val game: TttGameDto? = null, val error: String? = null)
private data class TttReactionRequest(val gameId: String, val type: String)
private data class TttJoinedEvent(val gameId: String, val userId: String? = null)

private enum class RematchLifecycle { REQUESTED, ACCEPTED, DECLINED, CANCELLED, EXPIRED }

/**
 * One online 1v1 game. The socket join (with its ack) is the authoritative
 * source of the first snapshot — no REST fallback fetch is used, matching
 * "thinner depth" (see `TicTacToeApi.getGame` doc: it exists for the offline
 * REST-move fallback, not for the initial join). [join] is also what the
 * reconnect collector below calls, and it's `internal` (with [joinCallCount])
 * purely so a unit test can verify the reconnect-triggers-rejoin rule without
 * a live socket ever delivering a real ack.
 */
class TttGameViewModel(
    private val gameId: String,
    private val repository: TicTacToeRepository,
    private val authApi: AuthApi,
    private val socketManager: SocketManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(TttGameUiState())
    val uiState: StateFlow<TttGameUiState> = _uiState.asStateFlow()

    private val _navigationEvents = MutableSharedFlow<NavigationEvent>(extraBufferCapacity = 1)
    val navigationEvents: SharedFlow<NavigationEvent> = _navigationEvents.asSharedFlow()

    internal var joinCallCount = 0
        private set

    private val stateListener = Emitter.Listener { args ->
        args.firstOrNull()?.decodeSocketPayload<TttStateEvent>()?.let { event ->
            if (event.gameId == gameId) event.game?.let(::applyGameEvent)
        }
    }
    private val moveListener = Emitter.Listener { args ->
        args.firstOrNull()?.decodeSocketPayload<TttMoveEvent>()?.let { event ->
            if (event.gameId == gameId) event.game?.let(::applyGameEvent)
        }
    }
    private val finishedListener = Emitter.Listener { args ->
        args.firstOrNull()?.decodeSocketPayload<TttFinishedEvent>()?.let { event ->
            if (event.gameId == gameId) event.game?.let(::applyGameEvent)
        }
    }
    private val playerLeftListener = Emitter.Listener { args ->
        args.firstOrNull()?.decodeSocketPayload<TttPlayerLeftEvent>()?.let { event ->
            if (event.gameId == gameId) {
                _uiState.update { it.copy(opponentLeft = true) }
                event.game?.let(::applyGameEvent)
            }
        }
    }
    private val joinedListener = Emitter.Listener { args ->
        args.firstOrNull()?.decodeSocketPayload<TttJoinedEvent>()?.let { event ->
            if (event.gameId == gameId) _uiState.update { it.copy(opponentLeft = false) }
        }
    }
    private val reactionListener = Emitter.Listener { args ->
        args.firstOrNull()?.decodeSocketPayload<TttReactionEvent>()?.let { event ->
            if (event.gameId == gameId) _uiState.update { it.copy(lastReaction = event) }
        }
    }
    private val rematchRequestedListener = Emitter.Listener { args -> handleRematchEvent(args, RematchLifecycle.REQUESTED) }
    private val rematchAcceptedListener = Emitter.Listener { args -> handleRematchEvent(args, RematchLifecycle.ACCEPTED) }
    private val rematchDeclinedListener = Emitter.Listener { args -> handleRematchEvent(args, RematchLifecycle.DECLINED) }
    private val rematchCancelledListener = Emitter.Listener { args -> handleRematchEvent(args, RematchLifecycle.CANCELLED) }
    private val rematchExpiredListener = Emitter.Listener { args -> handleRematchEvent(args, RematchLifecycle.EXPIRED) }

    init {
        loadMyUserId()
        join()
        socketManager.on("ticTacToe:state", stateListener)
        socketManager.on("ticTacToe:move", moveListener)
        socketManager.on("ticTacToe:finished", finishedListener)
        socketManager.on("ticTacToe:player:left", playerLeftListener)
        socketManager.on("ticTacToe:joined", joinedListener)
        socketManager.on("ticTacToe:reaction", reactionListener)
        socketManager.on("ticTacToe:rematch", rematchRequestedListener)
        socketManager.on("ticTacToe:rematch:accepted", rematchAcceptedListener)
        socketManager.on("ticTacToe:rematch:declined", rematchDeclinedListener)
        socketManager.on("ticTacToe:rematch:cancelled", rematchCancelledListener)
        socketManager.on("ticTacToe:rematch:expired", rematchExpiredListener)
        viewModelScope.launch {
            socketManager.connectionState
                .drop(1)
                .filter { it == SocketConnectionState.CONNECTED }
                .collect { join() }
        }
    }

    override fun onCleared() {
        socketManager.emit("ticTacToe:leave", TttLeaveRequest(gameId).encodeSocketPayload())
        socketManager.off("ticTacToe:state", stateListener)
        socketManager.off("ticTacToe:move", moveListener)
        socketManager.off("ticTacToe:finished", finishedListener)
        socketManager.off("ticTacToe:player:left", playerLeftListener)
        socketManager.off("ticTacToe:joined", joinedListener)
        socketManager.off("ticTacToe:reaction", reactionListener)
        socketManager.off("ticTacToe:rematch", rematchRequestedListener)
        socketManager.off("ticTacToe:rematch:accepted", rematchAcceptedListener)
        socketManager.off("ticTacToe:rematch:declined", rematchDeclinedListener)
        socketManager.off("ticTacToe:rematch:cancelled", rematchCancelledListener)
        socketManager.off("ticTacToe:rematch:expired", rematchExpiredListener)
    }

    internal fun join() {
        joinCallCount++
        socketManager.emitWithAck(
            "ticTacToe:join",
            TttJoinRequest(gameId).encodeSocketPayload(),
            Ack { args ->
                val ack = args.firstOrNull()?.decodeSocketPayload<TttJoinAck>()
                if (ack?.ok == true && ack.game != null) {
                    applyGameEvent(ack.game)
                } else if (ack != null) {
                    _uiState.update { it.copy(isLoading = false, error = ack.error ?: "Unable to join the game.") }
                }
            },
        )
    }

    /**
     * `internal` (not `private`) so tests can feed the same [TttGameDto] twice
     * through this exact function and assert it doesn't double-apply/corrupt
     * state — every listener above funnels into this one idempotent setter.
     */
    internal fun applyGameEvent(game: TttGameDto) {
        if (game.id != gameId) return
        _uiState.update { state ->
            state.copy(
                isLoading = false,
                error = null,
                game = game,
                mySymbol = resolveMySymbol(game, state.myUserId) ?: state.mySymbol,
            )
        }
    }

    private fun resolveMySymbol(game: TttGameDto, myUserId: String?): String? = when {
        myUserId == null -> null
        game.playerX?.id == myUserId -> "X"
        game.playerO?.id == myUserId -> "O"
        else -> null
    }

    private fun loadMyUserId() {
        viewModelScope.launch {
            val result = safeApiCall { authApi.me() }
            if (result is ApiResult.Success) {
                _uiState.update { state ->
                    val mySymbol = state.game?.let { resolveMySymbol(it, result.data.id) } ?: state.mySymbol
                    state.copy(myUserId = result.data.id, mySymbol = mySymbol)
                }
            }
        }
    }

    fun retry() = join()

    fun onCellClick(index: Int) {
        val state = _uiState.value
        val game = state.game ?: return
        if (game.status != "active") return
        if (index !in game.board.indices || game.board[index] != null) return
        if (state.mySymbol == null || game.currentTurn != state.mySymbol) return
        if (state.isSubmittingMove) return
        _uiState.update { it.copy(isSubmittingMove = true, moveError = null) }
        socketManager.emitWithAck(
            "ticTacToe:move",
            TttMoveSocketRequest(gameId, index).encodeSocketPayload(),
            Ack { args ->
                val ack = args.firstOrNull()?.decodeSocketPayload<TttMoveAck>()
                _uiState.update { it.copy(isSubmittingMove = false) }
                if (ack?.ok == true && ack.game != null) {
                    applyGameEvent(ack.game)
                } else {
                    _uiState.update { it.copy(moveError = ack?.error ?: "Move failed.") }
                }
            },
        )
    }

    fun sendReaction(type: String) {
        if (type !in TTT_REACTION_TYPES) return
        socketManager.emitWithAck(
            "ticTacToe:reaction",
            TttReactionRequest(gameId, type).encodeSocketPayload(),
            Ack { /* best-effort — an `ok:false` ack just means the tap silently does nothing */ },
        )
    }

    fun requestRematch() {
        viewModelScope.launch {
            _uiState.update { it.copy(isRequestingRematch = true, error = null) }
            when (val result = repository.requestRematch(gameId)) {
                is ApiResult.Success -> _uiState.update { it.copy(isRequestingRematch = false, rematchRequestSent = true) }
                is ApiResult.Failure -> _uiState.update { it.copy(isRequestingRematch = false, error = result.error.message) }
            }
        }
    }

    fun acceptIncomingRematch() {
        val requestId = _uiState.value.incomingRematch?.requestId ?: return
        viewModelScope.launch {
            when (val result = repository.acceptRematch(requestId)) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(incomingRematch = null) }
                    _navigationEvents.emit(
                        NavigationEvent.NavigateTo(Routes.tttGame(result.data.game.id), popUpToInclusive = Routes.TTT_GAME_PATTERN),
                    )
                }
                is ApiResult.Failure -> _uiState.update { it.copy(error = result.error.message) }
            }
        }
    }

    fun declineIncomingRematch() {
        val requestId = _uiState.value.incomingRematch?.requestId ?: return
        viewModelScope.launch {
            val result = repository.declineRematch(requestId)
            if (result is ApiResult.Success) _uiState.update { it.copy(incomingRematch = null) }
        }
    }

    fun leaveGame() {
        viewModelScope.launch {
            repository.leaveGame(gameId)
            _navigationEvents.emit(NavigationEvent.PopBackStack)
        }
    }

    private fun handleRematchEvent(args: Array<out Any>, lifecycle: RematchLifecycle) {
        val event = args.firstOrNull()?.decodeSocketPayload<TttInviteLifecycleEvent>() ?: return
        when (lifecycle) {
            RematchLifecycle.REQUESTED -> _uiState.update { it.copy(incomingRematch = event) }
            RematchLifecycle.ACCEPTED -> {
                _uiState.update { it.copy(incomingRematch = null, rematchRequestSent = false) }
                val newGameId = event.gameId
                if (newGameId != null && newGameId != gameId) {
                    viewModelScope.launch {
                        _navigationEvents.emit(
                            NavigationEvent.NavigateTo(Routes.tttGame(newGameId), popUpToInclusive = Routes.TTT_GAME_PATTERN),
                        )
                    }
                }
            }
            RematchLifecycle.DECLINED, RematchLifecycle.CANCELLED, RematchLifecycle.EXPIRED ->
                _uiState.update { it.copy(incomingRematch = null, rematchRequestSent = false) }
        }
    }
}
