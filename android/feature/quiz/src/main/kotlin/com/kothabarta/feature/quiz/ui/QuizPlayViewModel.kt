package com.kothabarta.feature.quiz.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.network.quiz.QuizAttemptDto
import com.kothabarta.core.network.quiz.QuizQuestionDto
import com.kothabarta.feature.quiz.data.QuizRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val QUESTION_SECONDS = 20
private const val REVEAL_DELAY_MS = 1200L

data class QuizPlayUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val question: QuizQuestionDto? = null,
    val currentIndex: Int = 0,
    val totalQuestions: Int = 0,
    val score: Int = 0,
    val selectedPosition: Int? = null,
    val revealCorrectPosition: Int? = null,
    val isSubmitting: Boolean = false,
    val remainingSeconds: Int = QUESTION_SECONDS,
    val isComplete: Boolean = false,
    val finalScore: Int = 0,
    val finalCorrect: Int = 0,
    val finalWrong: Int = 0,
)

/**
 * No server-side per-question timer exists for Quiz (unlike Games — see
 * docs/architecture/android-implementation-plan.md's Study/Quiz/Games phase
 * notes), so [QUESTION_SECONDS] is purely an Android-side UX pacing choice;
 * correctness/score are never computed here, only rendered from the
 * server's own `answer` response.
 */
class QuizPlayViewModel(
    private val chapterId: String,
    private val setNumber: Int,
    private val repository: QuizRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(QuizPlayUiState())
    val uiState: StateFlow<QuizPlayUiState> = _uiState.asStateFlow()

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
            when (val result = repository.startSet(chapterId, setNumber)) {
                is ApiResult.Success -> applyAttempt(result.data)
                is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }

    private fun applyAttempt(attempt: QuizAttemptDto) {
        attemptId = attempt.attemptId
        if (attempt.status == "completed" || attempt.currentIndex >= attempt.totalQuestions) {
            _uiState.update {
                it.copy(
                    isLoading = false,
                    isComplete = true,
                    finalScore = attempt.score,
                    finalCorrect = attempt.correctCount,
                    finalWrong = attempt.wrongCount,
                    totalQuestions = attempt.totalQuestions,
                )
            }
            return
        }
        val question = attempt.questions.getOrNull(attempt.currentIndex)
        _uiState.update {
            it.copy(
                isLoading = false,
                question = question,
                currentIndex = attempt.currentIndex,
                totalQuestions = attempt.totalQuestions,
                score = attempt.score,
                selectedPosition = null,
                revealCorrectPosition = null,
                remainingSeconds = QUESTION_SECONDS,
            )
        }
        startTimer()
    }

    private fun startTimer() {
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            while (_uiState.value.remainingSeconds > 0) {
                delay(1000)
                _uiState.update { it.copy(remainingSeconds = it.remainingSeconds - 1) }
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
                    delay(REVEAL_DELAY_MS)
                    if (response.isComplete) {
                        _uiState.update {
                            it.copy(
                                isComplete = true,
                                finalScore = response.score,
                                finalCorrect = response.correctCount,
                                finalWrong = response.wrongCount,
                            )
                        }
                    } else {
                        start()
                    }
                }
                is ApiResult.Failure -> _uiState.update { it.copy(isSubmitting = false, error = result.error.message) }
            }
        }
    }
}
