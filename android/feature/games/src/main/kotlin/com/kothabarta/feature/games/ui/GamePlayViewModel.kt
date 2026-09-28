package com.kothabarta.feature.games.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.network.games.GameAnswerResponse
import com.kothabarta.core.network.games.GameAttemptDto
import com.kothabarta.core.network.games.GameMistakeDto
import com.kothabarta.core.network.games.GameQuestionDto
import com.kothabarta.feature.games.data.GamesRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TICK_MS = 200L

/** Server-side pacing before the next question opens — see `GamesApi`/`GameAttemptDto`'s KDoc for `ACTIVATION_DELAY_MS`. */
private const val ACTIVATION_DELAY_MS = 1200L

data class GamePlayUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val gameName: String? = null,
    val question: GameQuestionDto? = null,
    val currentIndex: Int = 0,
    val totalQuestions: Int = 0,
    val score: Int = 0,
    val selectedPosition: Int? = null,
    val revealCorrectPosition: Int? = null,
    val isSubmitting: Boolean = false,
    val remainingMs: Long = 0L,
    val timeLimitMs: Long = 0L,
    val isComplete: Boolean = false,
    val finalScore: Int = 0,
    val finalCorrect: Int = 0,
    val finalWrong: Int = 0,
    val finalTimeout: Int = 0,
    val mistakes: List<GameMistakeDto> = emptyList(),
)

/**
 * Unlike Quiz, Games' per-question clock is fully server-owned
 * ([GameAttemptDto.remainingMs]) — the local countdown here only ever seeds
 * from that server snapshot and re-seeds on every reload, it never invents
 * its own fixed duration.
 */
class GamePlayViewModel(
    private val gameType: String,
    private val repository: GamesRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(GamePlayUiState())
    val uiState: StateFlow<GamePlayUiState> = _uiState.asStateFlow()

    private var attemptId: String? = null
    private var timerJob: Job? = null

    init {
        start()
    }

    override fun onCleared() {
        timerJob?.cancel()
    }

    fun retry() = start()

    private fun start() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            when (val result = repository.startGame(gameType)) {
                is ApiResult.Success -> applyAttempt(result.data)
                is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }

    private suspend fun reload() {
        val id = attemptId ?: return
        when (val result = repository.getAttempt(id)) {
            is ApiResult.Success -> applyAttempt(result.data)
            is ApiResult.Failure -> _uiState.update { it.copy(isSubmitting = false, error = result.error.message) }
        }
    }

    private suspend fun applyAttempt(attempt: GameAttemptDto) {
        attemptId = attempt.attemptId
        if (attempt.status == "completed" || attempt.currentIndex >= attempt.totalQuestions) {
            timerJob?.cancel()
            finishWithReview(
                attempt.attemptId,
                GameAnswerResponse(
                    score = attempt.score,
                    correctCount = attempt.correctCount,
                    wrongCount = attempt.wrongCount,
                    timeoutCount = attempt.timeoutCount,
                    totalQuestions = attempt.totalQuestions,
                    isComplete = true,
                ),
            )
            return
        }
        val question = attempt.questions.getOrNull(attempt.currentIndex)
        val limitMs = (attempt.timeLimitSec?.toLong() ?: 0L) * 1000L
        val remaining = attempt.remainingMs ?: limitMs
        _uiState.update {
            it.copy(
                isLoading = false,
                error = null,
                question = question,
                currentIndex = attempt.currentIndex,
                totalQuestions = attempt.totalQuestions,
                score = attempt.score,
                gameName = attempt.gameName,
                selectedPosition = null,
                revealCorrectPosition = null,
                remainingMs = remaining,
                timeLimitMs = if (limitMs > 0) limitMs else remaining,
            )
        }
        startTimer()
    }

    private suspend fun finishWithReview(attemptId: String, fallback: GameAnswerResponse) {
        when (val result = repository.getReview(attemptId)) {
            is ApiResult.Success -> {
                val review = result.data
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isSubmitting = false,
                        isComplete = true,
                        finalScore = review.score,
                        finalCorrect = review.correctCount,
                        finalWrong = review.wrongCount,
                        finalTimeout = review.timeoutCount,
                        totalQuestions = review.totalQuestions,
                        gameName = review.gameName ?: it.gameName,
                        mistakes = review.mistakes,
                    )
                }
            }
            is ApiResult.Failure -> _uiState.update {
                it.copy(
                    isLoading = false,
                    isSubmitting = false,
                    isComplete = true,
                    finalScore = fallback.score,
                    finalCorrect = fallback.correctCount,
                    finalWrong = fallback.wrongCount,
                    finalTimeout = fallback.timeoutCount,
                    totalQuestions = fallback.totalQuestions,
                )
            }
        }
    }

    private fun startTimer() {
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            while (_uiState.value.remainingMs > 0) {
                delay(TICK_MS)
                _uiState.update { it.copy(remainingMs = (it.remainingMs - TICK_MS).coerceAtLeast(0)) }
            }
            if (_uiState.value.selectedPosition == null && !_uiState.value.isSubmitting) {
                submit(position = null, timedOut = true)
            }
        }
    }

    fun selectOption(position: Int) {
        if (_uiState.value.isSubmitting || _uiState.value.selectedPosition != null) return
        submit(position = position, timedOut = false)
    }

    private fun submit(position: Int?, timedOut: Boolean) {
        val id = attemptId ?: return
        timerJob?.cancel()
        val index = _uiState.value.currentIndex
        _uiState.update { it.copy(selectedPosition = position, isSubmitting = true) }
        viewModelScope.launch {
            when (val result = repository.answer(id, index, position, timedOut)) {
                is ApiResult.Success -> {
                    val response = result.data
                    _uiState.update {
                        it.copy(isSubmitting = false, revealCorrectPosition = response.correctPosition, score = response.score)
                    }
                    delay(ACTIVATION_DELAY_MS)
                    if (response.isComplete) {
                        finishWithReview(id, response)
                    } else {
                        reload()
                    }
                }
                is ApiResult.Failure -> _uiState.update { it.copy(isSubmitting = false, error = result.error.message) }
            }
        }
    }
}
