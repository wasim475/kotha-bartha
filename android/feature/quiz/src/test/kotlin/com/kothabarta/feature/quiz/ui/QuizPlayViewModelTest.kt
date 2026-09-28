package com.kothabarta.feature.quiz.ui

import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.quiz.ChapterDto
import com.kothabarta.core.network.quiz.QuizAnswerRequest
import com.kothabarta.core.network.quiz.QuizAnswerResponse
import com.kothabarta.core.network.quiz.QuizApi
import com.kothabarta.core.network.quiz.QuizAttemptDto
import com.kothabarta.core.network.quiz.QuizCategoryDto
import com.kothabarta.core.network.quiz.QuizQuestionDto
import com.kothabarta.core.network.quiz.QuizSetDto
import com.kothabarta.core.network.quiz.SubjectDto
import com.kothabarta.feature.quiz.data.QuizRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

/**
 * Uses [runCurrent]/bounded [advanceTimeBy] rather than `advanceUntilIdle()` throughout:
 * the view model runs a real 20s per-question countdown, so draining virtual time
 * unboundedly would silently auto-submit a timeout and cascade into the next question
 * on every assertion.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class QuizPlayViewModelTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `loading a set starts the first in-progress question`() = runTest {
        val api = FakeQuizApi()
        val viewModel = QuizPlayViewModel("c1", 1, QuizRepository(api))
        runCurrent()

        val state = viewModel.uiState.value
        assertEquals(false, state.isLoading)
        assertEquals("2 + 2 = ?", state.question?.question)
        assertEquals(0, state.currentIndex)
        assertEquals(2, state.totalQuestions)
        assertEquals(20, state.remainingSeconds)
    }

    @Test
    fun `selecting an option submits the answer and reveals correctness`() = runTest {
        val api = FakeQuizApi()
        val viewModel = QuizPlayViewModel("c1", 1, QuizRepository(api))
        runCurrent()

        viewModel.selectOption(1)
        runCurrent()

        assertEquals(1, api.lastAnswerRequest?.selectedPosition)
        assertEquals(false, api.lastAnswerRequest?.timedOut)
        assertEquals(1, viewModel.uiState.value.revealCorrectPosition)
        assertEquals(10, viewModel.uiState.value.score)
    }

    @Test
    fun `after the reveal delay it advances to the next question`() = runTest {
        val api = FakeQuizApi()
        val viewModel = QuizPlayViewModel("c1", 1, QuizRepository(api))
        runCurrent()

        viewModel.selectOption(1)
        runCurrent()
        advanceTimeBy(1_300)
        runCurrent()

        assertEquals(1, viewModel.uiState.value.currentIndex)
        assertEquals("3 + 3 = ?", viewModel.uiState.value.question?.question)
        assertNull(viewModel.uiState.value.revealCorrectPosition)
    }

    @Test
    fun `the countdown timer submits a timed-out answer when it reaches zero`() = runTest {
        val api = FakeQuizApi()
        val viewModel = QuizPlayViewModel("c1", 1, QuizRepository(api))
        runCurrent()

        advanceTimeBy(20_100)
        runCurrent()

        assertTrue(api.lastAnswerRequest?.timedOut == true)
        assertNull(api.lastAnswerRequest?.selectedPosition)
    }

    @Test
    fun `the final answer surfaces the completed result`() = runTest {
        val api = FakeQuizApi()
        val viewModel = QuizPlayViewModel("c1", 1, QuizRepository(api))
        runCurrent()

        viewModel.selectOption(1)
        runCurrent()
        advanceTimeBy(1_300)
        runCurrent()

        viewModel.selectOption(0)
        runCurrent()
        advanceTimeBy(1_300)
        runCurrent()

        val state = viewModel.uiState.value
        assertTrue(state.isComplete)
        assertEquals(20, state.finalScore)
        assertEquals(2, state.finalCorrect)
    }

    @Test
    fun `a failed load surfaces the server's error`() = runTest {
        val api = FakeQuizApi(shouldFailStart = true)
        val viewModel = QuizPlayViewModel("c1", 1, QuizRepository(api))
        runCurrent()

        assertEquals("Quiz is unavailable.", viewModel.uiState.value.error)
    }

    @Test
    fun `retry re-issues the start call after a failure`() = runTest {
        val api = FakeQuizApi(shouldFailStart = true)
        val viewModel = QuizPlayViewModel("c1", 1, QuizRepository(api))
        runCurrent()
        assertEquals(1, api.startCallCount)

        api.shouldFailStart = false
        viewModel.retry()
        runCurrent()

        assertEquals(2, api.startCallCount)
        assertNull(viewModel.uiState.value.error)
        assertEquals("2 + 2 = ?", viewModel.uiState.value.question?.question)
    }

    private class FakeQuizApi(var shouldFailStart: Boolean = false) : QuizApi {
        var startCallCount = 0
        var lastAnswerRequest: QuizAnswerRequest? = null
        private var currentIndex = 0

        private val questions = listOf(
            QuizQuestionDto(index = 0, question = "2 + 2 = ?", options = listOf("3", "4", "5")),
            QuizQuestionDto(index = 1, question = "3 + 3 = ?", options = listOf("5", "6", "7")),
        )

        override suspend fun getCategories(): Response<ApiEnvelope<List<QuizCategoryDto>>> =
            error("not used by QuizPlayViewModelTest")

        override suspend fun getClassLevels(): Response<ApiEnvelope<List<String>>> =
            error("not used by QuizPlayViewModelTest")

        override suspend fun getSscDivisions(): Response<ApiEnvelope<List<String>>> =
            error("not used by QuizPlayViewModelTest")

        override suspend fun getSubjects(
            category: String,
            classLevel: String?,
            division: String?,
        ): Response<ApiEnvelope<List<SubjectDto>>> = error("not used by QuizPlayViewModelTest")

        override suspend fun getChapters(subjectId: String): Response<ApiEnvelope<List<ChapterDto>>> =
            error("not used by QuizPlayViewModelTest")

        override suspend fun getSets(chapterId: String): Response<ApiEnvelope<List<QuizSetDto>>> =
            error("not used by QuizPlayViewModelTest")

        override suspend fun startSet(chapterId: String, setNumber: Int): Response<ApiEnvelope<QuizAttemptDto>> {
            startCallCount++
            if (shouldFailStart) {
                val body = "{\"error\":{\"code\":\"SERVER_ERROR\",\"message\":\"Quiz is unavailable.\"}}"
                    .toResponseBody("application/json".toMediaType())
                return Response.error(500, body)
            }
            val isComplete = currentIndex >= questions.size
            return Response.success(
                ApiEnvelope(
                    data = QuizAttemptDto(
                        attemptId = "a1",
                        chapterId = chapterId,
                        setNumber = setNumber,
                        status = if (isComplete) "completed" else "in_progress",
                        currentIndex = currentIndex,
                        totalQuestions = questions.size,
                        correctCount = if (isComplete) 2 else 0,
                        wrongCount = 0,
                        score = if (isComplete) 20 else currentIndex * 10,
                        questions = questions,
                    ),
                ),
            )
        }

        override suspend fun answer(attemptId: String, body: QuizAnswerRequest): Response<ApiEnvelope<QuizAnswerResponse>> {
            lastAnswerRequest = body
            currentIndex++
            val isComplete = currentIndex >= questions.size
            return Response.success(
                ApiEnvelope(
                    data = QuizAnswerResponse(
                        correct = body.selectedPosition == 1,
                        correctPosition = 1,
                        score = currentIndex * 10,
                        correctCount = currentIndex,
                        wrongCount = 0,
                        currentIndex = currentIndex,
                        totalQuestions = questions.size,
                        isComplete = isComplete,
                    ),
                ),
            )
        }
    }
}
