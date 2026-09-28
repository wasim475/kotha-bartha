package com.kothabarta.feature.ludo.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.auth.AuthApi
import com.kothabarta.core.network.decodeSocketPayload
import com.kothabarta.core.network.encodeSocketPayload
import com.kothabarta.core.network.ludo.LudoBoardStateDto
import com.kothabarta.core.network.ludo.LudoChatEvent
import com.kothabarta.core.network.ludo.LudoGameDto
import com.kothabarta.core.network.ludo.LudoInviteLifecycleEvent
import com.kothabarta.core.network.ludo.LudoLobbyEvent
import com.kothabarta.core.network.ludo.LudoMemberDto
import com.kothabarta.core.network.ludo.LudoReactionEvent
import com.kothabarta.core.network.ludo.LudoResultDto
import com.kothabarta.core.network.ludo.LudoStateEvent
import com.kothabarta.core.network.ludo.LudoTakeoverEvent
import com.kothabarta.core.network.safeApiCall
import com.kothabarta.core.websocket.SocketConnectionState
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.ludo.data.LudoBoardAck
import com.kothabarta.feature.ludo.data.LudoChatRequest
import com.kothabarta.feature.ludo.data.LudoGameIdRequest
import com.kothabarta.feature.ludo.data.LudoLobbyAck
import com.kothabarta.feature.ludo.data.LudoMoveRequest
import com.kothabarta.feature.ludo.data.LudoReactionRequest
import com.kothabarta.feature.ludo.data.LudoReadySocketRequest
import com.kothabarta.feature.ludo.data.LudoRepository
import com.kothabarta.feature.ludo.data.LudoRollRequest
import io.socket.client.Ack
import io.socket.emitter.Emitter
import java.util.UUID
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

data class LudoGameUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val status: String = "lobby",
    val variantId: String? = null,
    val hostId: String? = null,
    val members: List<LudoMemberDto> = emptyList(),
    val mySeat: Int? = null,
    val myUserId: String? = null,
    val board: LudoBoardStateDto? = null,
    val results: List<LudoResultDto>? = null,
    val isControlledElsewhere: Boolean = false,
    val isTogglingReady: Boolean = false,
    val isStarting: Boolean = false,
    val isRolling: Boolean = false,
    val movingTokenId: Int? = null,
    val isRequestingRematch: Boolean = false,
    val rematchRequestSent: Boolean = false,
) {
    val isHost: Boolean get() = hostId != null && hostId == myUserId
}

/** A `turnDeadline` already in the past renders as `0`, never negative — the countdown just reads "expired". */
internal fun ludoRemainingMillis(turnDeadline: Long?, nowMillis: Long = System.currentTimeMillis()): Long {
    val deadline = turnDeadline ?: return 0L
    return (deadline - nowMillis).coerceAtLeast(0L)
}

private data class LudoJoinedEvent(val gameId: String, val userId: String? = null)
private data class LudoLobbyClosedEvent(val gameId: String, val reason: String? = null)

private val REMATCH_LIFECYCLE_EVENTS = listOf(
    "ludo:rematch",
    "ludo:rematch:accepted",
    "ludo:rematch:declined",
    "ludo:rematch:cancelled",
    "ludo:rematch:expired",
)

/**
 * One online Ludo lobby+game, combined into a single screen/ViewModel per
 * spec: pre-game ready/start plus the active simplified board plus the
 * finished/results view, all driven by the same `LudoGameDto`/board snapshot.
 * Every incoming socket event funnels into [applyLobbySnapshot] or
 * [applyStateEvent] — both idempotent wholesale replacements, never deltas —
 * so re-delivering the same event twice (the duplicate-event-prevention
 * requirement) is a no-op by construction rather than something tracked
 * separately.
 */
class LudoGameViewModel(
    private val gameId: String,
    private val repository: LudoRepository,
    private val authApi: AuthApi,
    private val socketManager: SocketManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LudoGameUiState())
    val uiState: StateFlow<LudoGameUiState> = _uiState.asStateFlow()

    private val _navigationEvents = MutableSharedFlow<NavigationEvent>(extraBufferCapacity = 1)
    val navigationEvents: SharedFlow<NavigationEvent> = _navigationEvents.asSharedFlow()

    private val _toastMessages = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val toastMessages: SharedFlow<String> = _toastMessages.asSharedFlow()

    /** `internal` purely so a unit test can verify the reconnect-triggers-rejoin rule without a live socket ever delivering a real ack. */
    internal var joinCallCount = 0
        private set

    private val stateListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<LudoStateEvent>()?.let(::applyStateEvent) }
    private val rollListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<LudoStateEvent>()?.let(::onRollEvent) }
    private val moveListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<LudoStateEvent>()?.let(::onMoveEvent) }
    private val captureListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<LudoStateEvent>()?.let(::onCaptureEvent) }
    private val turnListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<LudoStateEvent>()?.let(::applyTurnEvent) }
    private val timerListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<LudoStateEvent>()?.let(::onTimerEvent) }
    private val finishedListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<LudoStateEvent>()?.let(::onFinishedEvent) }
    private val takeoverListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<LudoTakeoverEvent>()?.let(::onTakeoverEvent) }
    private val joinedListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<LudoJoinedEvent>()?.let(::onJoinedEvent) }
    private val lobbyListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<LudoLobbyEvent>()?.let(::onLobbyEvent) }
    private val lobbyClosedListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<LudoLobbyClosedEvent>()?.let(::onLobbyClosedEvent) }
    private val startedListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<LudoLobbyEvent>()?.let(::onStartedEvent) }
    private val chatListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<LudoChatEvent>()?.let(::onChatEvent) }
    private val reactionListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<LudoReactionEvent>()?.let(::onReactionEvent) }
    private val rematchListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<LudoInviteLifecycleEvent>()?.let(::onRematchLifecycleEvent) }

    init {
        loadMyUserId()
        join()
        socketManager.on("ludo:state", stateListener)
        socketManager.on("ludo:roll", rollListener)
        socketManager.on("ludo:move", moveListener)
        socketManager.on("ludo:capture", captureListener)
        socketManager.on("ludo:turn", turnListener)
        socketManager.on("ludo:timer", timerListener)
        socketManager.on("ludo:finished", finishedListener)
        socketManager.on("ludo:takeover", takeoverListener)
        socketManager.on("ludo:joined", joinedListener)
        socketManager.on("ludo:lobby", lobbyListener)
        socketManager.on("ludo:lobby:closed", lobbyClosedListener)
        socketManager.on("ludo:started", startedListener)
        socketManager.on("ludo:chat", chatListener)
        socketManager.on("ludo:reaction", reactionListener)
        REMATCH_LIFECYCLE_EVENTS.forEach { socketManager.on(it, rematchListener) }
        viewModelScope.launch {
            socketManager.connectionState
                .drop(1)
                .filter { it == SocketConnectionState.CONNECTED }
                .collect { join() }
        }
    }

    override fun onCleared() {
        socketManager.emit("ludo:leave", LudoGameIdRequest(gameId).encodeSocketPayload())
        socketManager.off("ludo:state", stateListener)
        socketManager.off("ludo:roll", rollListener)
        socketManager.off("ludo:move", moveListener)
        socketManager.off("ludo:capture", captureListener)
        socketManager.off("ludo:turn", turnListener)
        socketManager.off("ludo:timer", timerListener)
        socketManager.off("ludo:finished", finishedListener)
        socketManager.off("ludo:takeover", takeoverListener)
        socketManager.off("ludo:joined", joinedListener)
        socketManager.off("ludo:lobby", lobbyListener)
        socketManager.off("ludo:lobby:closed", lobbyClosedListener)
        socketManager.off("ludo:started", startedListener)
        socketManager.off("ludo:chat", chatListener)
        socketManager.off("ludo:reaction", reactionListener)
        REMATCH_LIFECYCLE_EVENTS.forEach { socketManager.off(it, rematchListener) }
    }

    internal fun join() {
        joinCallCount++
        socketManager.emitWithAck(
            "ludo:join",
            LudoGameIdRequest(gameId).encodeSocketPayload(),
            Ack { args ->
                val ack = args.firstOrNull()?.decodeSocketPayload<LudoLobbyAck>()
                if (ack?.ok == true && ack.game != null) {
                    applyLobbySnapshot(ack.game)
                } else {
                    _uiState.update { it.copy(isLoading = false, error = "Unable to join the game.") }
                }
            },
        )
    }

    private fun loadMyUserId() {
        viewModelScope.launch {
            val result = safeApiCall { authApi.me() }
            if (result is ApiResult.Success) _uiState.update { it.copy(myUserId = result.data.id) }
        }
    }

    fun retry() = join()

    /** Every lobby-shaped broadcast/ack (join/ready/start/lobby/started) funnels through here — a wholesale, idempotent replacement. */
    internal fun applyLobbySnapshot(game: LudoGameDto) {
        if (game.id != gameId) return
        _uiState.update { state ->
            state.copy(
                isLoading = false,
                error = null,
                status = game.status,
                variantId = game.variantId,
                hostId = game.hostId,
                members = game.members,
                mySeat = game.mySeat ?: state.mySeat,
                board = game.game ?: state.board,
                results = game.results ?: state.results,
            )
        }
    }

    /**
     * Every board-shaped broadcast (`ludo:state`/`ludo:roll`/`ludo:move`/
     * `ludo:capture`/`ludo:timer`/`ludo:finished`) funnels through here — a
     * stale (older-version) snapshot is dropped, otherwise the board is
     * wholesale-replaced, which is what makes re-applying the identical event
     * a no-op.
     */
    internal fun applyStateEvent(event: LudoStateEvent) {
        if (event.gameId != gameId) return
        _uiState.update { state ->
            val incoming = event.game
            val currentVersion = state.board?.version
            if (incoming != null && currentVersion != null && incoming.version < currentVersion) return@update state
            state.copy(
                isLoading = false,
                board = incoming ?: state.board,
                results = event.results ?: state.results,
                status = event.status ?: state.status,
            )
        }
    }

    internal fun onRollEvent(event: LudoStateEvent) {
        applyStateEvent(event)
        if (event.gameId == gameId) _toastMessages.tryEmit(event.game?.dice?.let { "Rolled a $it" } ?: "Dice rolled")
    }

    internal fun onMoveEvent(event: LudoStateEvent) {
        applyStateEvent(event)
        if (event.gameId == gameId) _toastMessages.tryEmit("Token moved")
    }

    internal fun onCaptureEvent(event: LudoStateEvent) {
        applyStateEvent(event)
        if (event.gameId == gameId) _toastMessages.tryEmit("Captured!")
    }

    /** `ludo:turn` carries seat/turnNumber/turnDeadline/phase but not necessarily a full board — merged onto the existing board. */
    internal fun applyTurnEvent(event: LudoStateEvent) {
        if (event.gameId != gameId) return
        _uiState.update { state ->
            val board = state.board ?: return@update state
            state.copy(
                board = board.copy(
                    turnSeat = event.seat ?: board.turnSeat,
                    turnNumber = event.turnNumber ?: board.turnNumber,
                    turnDeadline = event.turnDeadline ?: board.turnDeadline,
                    phase = event.phase ?: board.phase,
                ),
            )
        }
    }

    internal fun onTimerEvent(event: LudoStateEvent) {
        applyStateEvent(event)
        if (event.gameId == gameId) _toastMessages.tryEmit("Time's up")
    }

    internal fun onFinishedEvent(event: LudoStateEvent) {
        applyStateEvent(event)
        if (event.gameId == gameId) _uiState.update { it.copy(status = "finished", results = event.results ?: it.results) }
    }

    internal fun onTakeoverEvent(event: LudoTakeoverEvent) {
        if (event.gameId != gameId) return
        _uiState.update { it.copy(isControlledElsewhere = true) }
    }

    private fun onJoinedEvent(event: LudoJoinedEvent) {
        // Informational only — membership/ready state is driven by ludo:lobby / ludo:state, not this event.
    }

    internal fun onLobbyEvent(event: LudoLobbyEvent) {
        if (event.gameId != gameId) return
        event.game?.let(::applyLobbySnapshot)
    }

    internal fun onStartedEvent(event: LudoLobbyEvent) {
        if (event.gameId != gameId) return
        event.game?.let(::applyLobbySnapshot)
    }

    private fun onLobbyClosedEvent(event: LudoLobbyClosedEvent) {
        if (event.gameId != gameId) return
        _uiState.update { it.copy(error = event.reason ?: "This lobby was closed.") }
        viewModelScope.launch { _navigationEvents.emit(NavigationEvent.PopBackStack) }
    }

    private fun onChatEvent(event: LudoChatEvent) {
        if (event.gameId != gameId) return
        val text = event.text
        if (!text.isNullOrBlank()) _toastMessages.tryEmit(text)
    }

    private fun onReactionEvent(event: LudoReactionEvent) {
        if (event.gameId != gameId) return
        event.type?.let { _toastMessages.tryEmit(it) }
    }

    /**
     * Reused for both invite-shaped rematch broadcasts: a non-null, different
     * `gameId` means a rematch game exists to join (the requester's own
     * request just succeeded, or the opponent accepted); declined/cancelled/
     * expired carry no `gameId`, so they just clear the pending flag.
     */
    internal fun onRematchLifecycleEvent(event: LudoInviteLifecycleEvent) {
        _uiState.update { it.copy(rematchRequestSent = false) }
        val newGameId = event.gameId
        if (newGameId != null && newGameId != gameId) {
            viewModelScope.launch { _navigationEvents.emit(NavigationEvent.NavigateTo(Routes.ludoGame(newGameId))) }
        }
    }

    fun toggleReady(ready: Boolean) {
        if (_uiState.value.isTogglingReady) return
        _uiState.update { it.copy(isTogglingReady = true) }
        socketManager.emitWithAck(
            "ludo:ready",
            LudoReadySocketRequest(gameId, ready).encodeSocketPayload(),
            Ack { args ->
                val ack = args.firstOrNull()?.decodeSocketPayload<LudoLobbyAck>()
                _uiState.update { it.copy(isTogglingReady = false) }
                if (ack?.ok == true && ack.game != null) applyLobbySnapshot(ack.game)
            },
        )
    }

    fun startGame() {
        if (!_uiState.value.isHost || _uiState.value.isStarting) return
        _uiState.update { it.copy(isStarting = true) }
        socketManager.emitWithAck(
            "ludo:start",
            LudoGameIdRequest(gameId).encodeSocketPayload(),
            Ack { args ->
                val ack = args.firstOrNull()?.decodeSocketPayload<LudoLobbyAck>()
                _uiState.update { it.copy(isStarting = false) }
                if (ack?.ok == true && ack.game != null) {
                    applyLobbySnapshot(ack.game)
                } else {
                    _uiState.update { it.copy(error = "Unable to start the game.") }
                }
            },
        )
    }

    fun rollDice() {
        val state = _uiState.value
        val board = state.board ?: return
        if (state.isControlledElsewhere || state.isRolling) return
        if (state.mySeat == null || board.turnSeat != state.mySeat || board.phase != "ROLL") return
        _uiState.update { it.copy(isRolling = true) }
        socketManager.emitWithAck(
            "ludo:roll",
            LudoRollRequest(gameId, board.version, UUID.randomUUID().toString()).encodeSocketPayload(),
            Ack { args ->
                val ack = args.firstOrNull()?.decodeSocketPayload<LudoBoardAck>()
                _uiState.update { it.copy(isRolling = false) }
                ack?.game?.let { applyStateEvent(LudoStateEvent(gameId = gameId, version = it.version, game = it)) }
            },
        )
    }

    /** [tokenId] must be present in the current board's `legal` list — a tap on anything else is silently ignored, never sent. */
    fun moveToken(tokenId: Int) {
        val state = _uiState.value
        val board = state.board ?: return
        if (state.isControlledElsewhere || state.movingTokenId != null) return
        if (state.mySeat == null || board.turnSeat != state.mySeat) return
        if (board.legal.none { it.tokenId == tokenId }) return
        _uiState.update { it.copy(movingTokenId = tokenId) }
        socketManager.emitWithAck(
            "ludo:move",
            LudoMoveRequest(gameId, tokenId, board.version, UUID.randomUUID().toString()).encodeSocketPayload(),
            Ack { args ->
                val ack = args.firstOrNull()?.decodeSocketPayload<LudoBoardAck>()
                _uiState.update { it.copy(movingTokenId = null) }
                ack?.game?.let { applyStateEvent(LudoStateEvent(gameId = gameId, version = it.version, game = it)) }
            },
        )
    }

    fun sendChat(text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        socketManager.emitWithAck(
            "ludo:chat",
            LudoChatRequest(gameId, trimmed).encodeSocketPayload(),
            Ack { /* best-effort — server rate-limits/rejects invalid text, ack failure just drops silently */ },
        )
    }

    fun sendReaction(type: String) {
        socketManager.emitWithAck(
            "ludo:reaction",
            LudoReactionRequest(gameId, type).encodeSocketPayload(),
            Ack { /* best-effort — an ok:false ack just means the tap silently does nothing */ },
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

    fun leaveGame() {
        viewModelScope.launch {
            repository.leaveGame(gameId)
            _navigationEvents.emit(NavigationEvent.PopBackStack)
        }
    }
}
