package com.kothabarta.core.network.games

data class GameCategoryDto(val key: String, val label: String, val icon: String? = null)

data class GameCatalogEntryDto(
    val type: String,
    val category: String? = null,
    val name: String,
    val description: String? = null,
    val icon: String? = null,
    val questionCount: Int = 10,
    val timeLimitSec: Int? = null,
    val supportsChallenge: Boolean = false,
    val available: Boolean = true,
    /** Only present on the two appended external-game catalog entries (tic-tac-toe, ludo). */
    val route: String? = null,
)

data class GameQuestionDto(
    val index: Int,
    val prompt: String,
    val options: List<String> = emptyList(),
    val answered: Boolean = false,
    val selectedPosition: Int? = null,
    val correct: Boolean? = null,
    val timedOut: Boolean? = null,
    val correctPosition: Int? = null,
)

data class GameAttemptDto(
    val attemptId: String,
    val gameType: String,
    val category: String? = null,
    val status: String = "playing",
    val totalQuestions: Int = 0,
    val score: Int = 0,
    val correctCount: Int = 0,
    val wrongCount: Int = 0,
    val timeoutCount: Int = 0,
    val accuracy: Double? = null,
    val completedAt: String? = null,
    val gameName: String? = null,
    val icon: String? = null,
    val currentIndex: Int = 0,
    val startedAt: String? = null,
    val timeLimitSec: Int? = null,
    /** A server-clock snapshot at response time — Android counts down locally from this, not from scratch. */
    val remainingMs: Long? = null,
    val questions: List<GameQuestionDto> = emptyList(),
)

data class GameAnswerRequest(
    val questionIndex: Int,
    val selectedPosition: Int? = null,
    val timedOut: Boolean? = null,
)

/**
 * `...summaryFields` from the server spreads the same fields [GameAttemptDto]
 * has — modeled as its own class (not reusing GameAttemptDto) since this
 * response never includes `questions`.
 */
data class GameAnswerResponse(
    val correct: Boolean = false,
    val timedOut: Boolean = false,
    val correctPosition: Int? = null,
    val scoreDelta: Int = 0,
    val score: Int = 0,
    val correctCount: Int = 0,
    val wrongCount: Int = 0,
    val timeoutCount: Int = 0,
    val accuracy: Double? = null,
    val currentIndex: Int = 0,
    val totalQuestions: Int = 0,
    val isComplete: Boolean = false,
)

data class GameMistakeDto(
    val index: Int,
    val number: Int? = null,
    val prompt: String,
    val status: String,
    val selectedText: String? = null,
    val correctText: String? = null,
)

data class GameReviewDto(
    val attemptId: String,
    val gameType: String? = null,
    val score: Int = 0,
    val correctCount: Int = 0,
    val wrongCount: Int = 0,
    val timeoutCount: Int = 0,
    val totalQuestions: Int = 0,
    val gameName: String? = null,
    val icon: String? = null,
    val mistakes: List<GameMistakeDto> = emptyList(),
)
