package com.kothabarta.feature.games.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.network.decodeSocketPayload
import com.kothabarta.core.network.encodeSocketPayload
import com.kothabarta.core.network.games.ChallengeAnswerNotice
import com.kothabarta.core.network.games.ChallengeMatchDto
import com.kothabarta.core.network.games.ChallengeMatchEvent
import com.kothabarta.core.websocket.SocketConnectionState
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.games.data.GameChallengeRepository
import io.socket.client.Ack
import io.socket.emitter.Emitter
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val EVENT_JOIN = "gameChallenge:join"
private const val EVENT_ROOM_LEAVE = "gameChallenge:room:leave"
private const val EVENT_ANSWER = "gameChallenge:answer"
private const val EVENT_LEAVE = "gameChallenge:leave"
private const val EVENT_QUESTION = "gameChallenge:question"
private const val EVENT_QUESTION_RESULT = "gameChallenge:questionResult"
private const val EVENT_FINISHED = "gameChallenge:finished"
private const val EVENT_PLAYER_LEFT = "gameChallenge:player:left"

private const val TICK_MS = 200L

private data class MatchIdRequest(val matchId: String)
private data class ChallengeAnswerSocketRequest(val matchId: String, val questionIndex: Int, val selectedPosition: Int)
private data class ChallengeJoinAck(val ok: Boolean = false, val match: ChallengeMatchDto? = null)
private data class ChallengeAnswerAck(val ok: Boolean = false, val match: ChallengeMatchDto? = null)

data class ChallengePlayUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val match: ChallengeMatchDto? = null,
    val selectedPosition: Int? = null,
    val isSubmitting: Boolean = false,
    val opponentAnswered: Boolean = false,
    val remainingMs: Long = 0L,
    val isTimeUp: Boolean = false,
    val isRequestingRematch: Boolean = false,
    val rematchRequested: Boolean = false,
)

/**
 * Timeout here is purely a client-side visual cue ([ChallengePlayUiState.isTimeUp]
 * disables option taps) — unlike solo Games, this never self-submits on
 * reaching zero; the match only ever advances from the server's own
 * `gameChallenge:questionResult`/`gameChallenge:finished` broadcasts, since
 * `settleMatch()` is the one thing allowed to record a timeout answer.
 */
class ChallengePlayViewModel(
    private val matchId: String,
    private val repository: GameChallengeRepository,
    private val socketManager: SocketManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChallengePlayUiState())
    val uiState: StateFlow<ChallengePlayUiState> = _uiState.asStateFlow()

    private var timerJob: Job? = null

    private fun onMatchEvent(args: Array<out Any>) {
        val event = args.firstOrNull()?.decodeSocketPayload<ChallengeMatchEvent>() ?: return
        if (event.matchId != matchId) return
        event.match?.let(::applyMatch)
    }

    private val questionListener = Emitter.Listener { args -> onMatchEvent(args) }
    private val questionResultListener = Emitter.Listener { args -> onMatchEvent(args) }
    private val finishedListener = Emitter.Listener { args -> onMatchEvent(args) }
    private val answerNoticeListener = Emitter.Listener { args ->
        args.firstOrNull()?.decodeSocketPayload<ChallengeAnswerNotice>()?.let { notice ->
            if (notice.matchId == matchId) _uiState.update { it.copy(opponentAnswered = true) }
        }
    }
    private val playerLeftListener = Emitter.Listener { args ->
        args.firstOrNull()?.decodeSocketPayload<ChallengeMatchEvent>()?.let { event ->
            if (event.matchId == matchId) _uiState.update { it.copy(error = "Your opponent left the match.") }
        }
    }

    init {
        loadInitialSnapshot()
        socketManager.on(EVENT_QUESTION, questionListener)
        socketManager.on(EVENT_QUESTION_RESULT, questionResultListener)
        socketManager.on(EVENT_FINISHED, finishedListener)
        socketManager.on(EVENT_ANSWER, answerNoticeListener)
        socketManager.on(EVENT_PLAYER_LEFT, playerLeftListener)
        viewModelScope.launch {
            socketManager.connectionState
                .drop(1)
                .filter { it == SocketConnectionState.CONNECTED }
                .collect { joinRoom() }
        }
    }

    override fun onCleared() {
        timerJob?.cancel()
        socketManager.emit(EVENT_ROOM_LEAVE, MatchIdRequest(matchId).encodeSocketPayload())
        socketManager.off(EVENT_QUESTION, questionListener)
        socketManager.off(EVENT_QUESTION_RESULT, questionResultListener)
        socketManager.off(EVENT_FINISHED, finishedListener)
        socketManager.off(EVENT_ANSWER, answerNoticeListener)
        socketManager.off(EVENT_PLAYER_LEFT, playerLeftListener)
    }

    fun retry() = loadInitialSnapshot()

    private fun loadInitialSnapshot() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            when (val result = repository.getMatch(matchId)) {
                is ApiResult.Success -> {
                    applyMatch(result.data)
                    joinRoom()
                }
                is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }

    private fun joinRoom() {
        socketManager.emitWithAck(
            EVENT_JOIN,
            MatchIdRequest(matchId).encodeSocketPayload(),
            Ack { args ->
                val ack = args.firstOrNull()?.decodeSocketPayload<ChallengeJoinAck>()
                if (ack?.ok == true && ack.match != null) applyMatch(ack.match)
            },
        )
    }

    /**
     * Single idempotent setter every listener/ack funnels through — local
     * `selectedPosition`/`opponentAnswered` are always re-derived from the
     * match's own `current` (never tracked independently), since each
     * player's option order/answer state genuinely differs and only the
     * server's view of `current` is authoritative.
     */
    private fun applyMatch(match: ChallengeMatchDto) {
        _uiState.update {
            it.copy(
                isLoading = false,
                error = null,
                match = match,
                selectedPosition = match.current?.selectedPosition,
                isSubmitting = false,
                opponentAnswered = match.current?.opponentAnswered ?: false,
            )
        }
        val current = match.current
        if (match.outcome == null && current != null && current.selectedPosition == null) {
            startTimer(current.remainingMs ?: 0L)
        } else {
            timerJob?.cancel()
        }
    }

    private fun startTimer(remainingMs: Long) {
        timerJob?.cancel()
        _uiState.update { it.copy(remainingMs = remainingMs, isTimeUp = remainingMs <= 0) }
        if (remainingMs <= 0) return
        timerJob = viewModelScope.launch {
            while (_uiState.value.remainingMs > 0) {
                delay(TICK_MS)
                _uiState.update { it.copy(remainingMs = (it.remainingMs - TICK_MS).coerceAtLeast(0)) }
            }
            _uiState.update { it.copy(isTimeUp = true) }
        }
    }

    fun selectOption(position: Int) {
        val state = _uiState.value
        val current = state.match?.current
        if (state.isSubmitting || state.selectedPosition != null || state.isTimeUp || current == null) return
        timerJob?.cancel()
        _uiState.update { it.copy(selectedPosition = position, isSubmitting = true) }
        socketManager.emitWithAck(
            EVENT_ANSWER,
            ChallengeAnswerSocketRequest(matchId, current.index, position).encodeSocketPayload(),
            Ack { args ->
                val ack = args.firstOrNull()?.decodeSocketPayload<ChallengeAnswerAck>()
                if (ack?.ok == true && ack.match != null) {
                    applyMatch(ack.match)
                } else {
                    _uiState.update { it.copy(isSubmitting = false, error = "Unable to submit your answer.") }
                }
            },
        )
    }

    fun requestRematch() {
        viewModelScope.launch {
            _uiState.update { it.copy(isRequestingRematch = true, error = null) }
            when (val result = repository.requestRematch(matchId)) {
                is ApiResult.Success -> _uiState.update { it.copy(isRequestingRematch = false, rematchRequested = true) }
                is ApiResult.Failure -> _uiState.update { it.copy(isRequestingRematch = false, error = result.error.message) }
            }
        }
    }

    /** Genuinely abandons the match — distinct from the room-leave emitted in [onCleared], which just stops room events. */
    fun leaveMatch() {
        socketManager.emitWithAck(EVENT_LEAVE, MatchIdRequest(matchId).encodeSocketPayload(), Ack { })
    }
}
