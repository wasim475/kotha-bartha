package com.kothabarta.core.network.quiz

/** `/api/v1/quiz` — see docs/architecture/android-api-contract.md's Quiz section. */

data class QuizCategoryDto(val key: String, val label: String)

data class SubjectDto(
    val id: String,
    val name: String,
    val category: String,
    val classLevel: String? = null,
    val division: String? = null,
)

data class ChapterDto(val id: String, val name: String, val subjectId: String)

data class QuizSetDto(
    val setNumber: Int,
    val totalQuestions: Int = 30,
    val status: String = "not_started",
    val currentIndex: Int = 0,
    val firstAttemptScore: Int? = null,
    val lastScore: Int? = null,
    val completedAttempts: Int = 0,
)

data class QuizQuestionDto(
    val index: Int,
    val questionId: String? = null,
    val question: String,
    val options: List<String> = emptyList(),
    val answered: Boolean = false,
    val selectedPosition: Int? = null,
    val correct: Boolean? = null,
    val correctPosition: Int? = null,
)

data class QuizAttemptDto(
    val attemptId: String,
    val chapterId: String? = null,
    val setNumber: Int = 0,
    val status: String = "in_progress",
    val isFirstAttempt: Boolean = false,
    val currentIndex: Int = 0,
    val totalQuestions: Int = 0,
    val correctCount: Int = 0,
    val wrongCount: Int = 0,
    val score: Int = 0,
    val questions: List<QuizQuestionDto> = emptyList(),
)

/**
 * No server-side per-question timer exists for Quiz (unlike Games — see
 * docs/architecture/android-implementation-plan.md's Study/Quiz/Games phase
 * notes) — `timedOut` here is purely the Android client's own countdown
 * ending, taken at face value by the server.
 */
data class QuizAnswerRequest(
    val questionIndex: Int,
    val selectedPosition: Int? = null,
    val timedOut: Boolean? = null,
)

data class QuizAnswerResponse(
    val correct: Boolean = false,
    val correctPosition: Int? = null,
    val scoreDelta: Int = 0,
    val score: Int = 0,
    val correctCount: Int = 0,
    val wrongCount: Int = 0,
    val currentIndex: Int = 0,
    val totalQuestions: Int = 0,
    val isComplete: Boolean = false,
    val isFirstAttempt: Boolean = false,
)
