package com.kothabarta.feature.games.ui

import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.games.GameAnswerRequest
import com.kothabarta.core.network.games.GameAnswerResponse
import com.kothabarta.core.network.games.GameAttemptDto
import com.kothabarta.core.network.games.GameCatalogEntryDto
import com.kothabarta.core.network.games.GameMistakeDto
import com.kothabarta.core.network.games.GameQuestionDto
import com.kothabarta.core.network.games.GameReviewDto
import com.kothabarta.core.network.games.GamesApi
import com.kothabarta.feature.games.data.GamesRepository
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
 * Games' per-question clock is server-owned ([GameAttemptDto.remainingMs]),
 * not a fixed client constant, so [FakeGamesApi] hands back a 5s window and
 * every timer-sensitive assertion here uses [runCurrent]/bounded
 * [advanceTimeBy] rather than `advanceUntilIdle()` — draining virtual time
 * unboundedly would silently run the countdown to zero (and the chained
 * next-question fetch) on every assertion, exactly the mistake
 * `QuizPlayViewModelTest` already had to fix.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GamePlayViewModelTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `loading a game starts the first in-progress question seeded from the server's remainingMs`() = runTest {
        val api = FakeGamesApi()
        val viewModel = GamePlayViewModel("math_solve", GamesRepository(api))
        runCurrent()

        val state = viewModel.uiState.value
        assertEquals(false, state.isLoading)
        assertEquals("2 + 2 = ?", state.question?.prompt)
        assertEquals(0, state.currentIndex)
        assertEquals(2, state.totalQuestions)
        assertEquals(5_000L, state.remainingMs)
    }

    @Test
    fun `selecting an option submits the answer, reveals correctness, then advances after the activation delay`() = runTest {
        val api = FakeGamesApi()
        val viewModel = GamePlayViewModel("math_solve", GamesRepository(api))
        runCurrent()

        viewModel.selectOption(1)
        runCurrent()

        assertEquals(1, api.lastAnswerRequest?.selectedPosition)
        assertEquals(false, api.lastAnswerRequest?.timedOut)
        assertEquals(1, viewModel.uiState.value.revealCorrectPosition)
        assertEquals(10, viewModel.uiState.value.score)

        advanceTimeBy(1_300)
        runCurrent()

        assertEquals(1, viewModel.uiState.value.currentIndex)
        assertEquals("3 + 3 = ?", viewModel.uiState.value.question?.prompt)
        assertNull(viewModel.uiState.value.revealCorrectPosition)
    }

    @Test
    fun `the countdown timer submits a timed-out answer when it reaches zero`() = runTest {
        val api = FakeGamesApi()
        val viewModel = GamePlayViewModel("math_solve", GamesRepository(api))
        runCurrent()

        advanceTimeBy(5_100)
        runCurrent()

        assertTrue(api.lastAnswerRequest?.timedOut == true)
        assertNull(api.lastAnswerRequest?.selectedPosition)
    }

    @Test
    fun `the final answer surfaces the completed result with its mistakes`() = runTest {
        val api = FakeGamesApi()
        val viewModel = GamePlayViewModel("math_solve", GamesRepository(api))
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
        assertEquals(10, state.finalScore)
        assertEquals(1, state.finalCorrect)
        assertEquals(1, state.finalWrong)
        assertEquals(1, state.mistakes.size)
        assertEquals(1, state.mistakes.first().index)
    }

    @Test
    fun `a failed load surfaces the server's error`() = runTest {
        val api = FakeGamesApi(shouldFailStart = true)
        val viewModel = GamePlayViewModel("math_solve", GamesRepository(api))
        runCurrent()

        assertEquals("Game is unavailable.", viewModel.uiState.value.error)
    }

    @Test
    fun `retry re-issues the start call after a failure`() = runTest {
        val api = FakeGamesApi(shouldFailStart = true)
        val viewModel = GamePlayViewModel("math_solve", GamesRepository(api))
        runCurrent()
        assertEquals(1, api.startCallCount)

        api.shouldFailStart = false
        viewModel.retry()
        runCurrent()

        assertEquals(2, api.startCallCount)
        assertNull(viewModel.uiState.value.error)
        assertEquals("2 + 2 = ?", viewModel.uiState.value.question?.prompt)
    }

    private class FakeGamesApi(var shouldFailStart: Boolean = false) : GamesApi {
        var startCallCount = 0
        var lastAnswerRequest: GameAnswerRequest? = null
        private var currentIndex = 0
        private var score = 0
        private var correctCount = 0
        private var wrongCount = 0
        private var timeoutCount = 0

        private val questions = listOf(
            GameQuestionDto(index = 0, prompt = "2 + 2 = ?", options = listOf("3", "4", "5")),
            GameQuestionDto(index = 1, prompt = "3 + 3 = ?", options = listOf("5", "6", "7")),
        )
        private val mistakes = mutableListOf<GameMistakeDto>()

        override suspend fun getCatalog(): Response<ApiEnvelope<List<GameCatalogEntryDto>>> = error("not used by GamePlayViewModelTest")

        override suspend fun getLastAttempt(): Response<ApiEnvelope<GameAttemptDto?>> = error("not used by GamePlayViewModelTest")

        override suspend fun startGame(gameType: String): Response<ApiEnvelope<GameAttemptDto>> {
            startCallCount++
            if (shouldFailStart) {
                val body = "{\"error\":{\"code\":\"SERVER_ERROR\",\"message\":\"Game is unavailable.\"}}"
                    .toResponseBody("application/json".toMediaType())
                return Response.error(500, body)
            }
            return Response.success(ApiEnvelope(data = currentAttempt(gameType)))
        }

        override suspend fun getAttempt(attemptId: String): Response<ApiEnvelope<GameAttemptDto>> =
            Response.success(ApiEnvelope(data = currentAttempt("math_solve")))

        override suspend fun getReview(attemptId: String): Response<ApiEnvelope<GameReviewDto>> = Response.success(
            ApiEnvelope(
                data = GameReviewDto(
                    attemptId = attemptId,
                    score = score,
                    correctCount = correctCount,
                    wrongCount = wrongCount,
                    timeoutCount = timeoutCount,
                    totalQuestions = questions.size,
                    mistakes = mistakes,
                ),
            ),
        )

        override suspend fun answer(attemptId: String, body: GameAnswerRequest): Response<ApiEnvelope<GameAnswerResponse>> {
            lastAnswerRequest = body
            val correct = body.selectedPosition == 1
            if (body.timedOut == true) {
                timeoutCount++
                mistakes += GameMistakeDto(index = currentIndex, prompt = questions[currentIndex].prompt, status = "timeout")
            } else if (correct) {
                correctCount++
                score += 10
            } else {
                wrongCount++
                mistakes += GameMistakeDto(index = currentIndex, prompt = questions[currentIndex].prompt, status = "wrong")
            }
            currentIndex++
            val isComplete = currentIndex >= questions.size
            return Response.success(
                ApiEnvelope(
                    data = GameAnswerResponse(
                        correct = correct,
                        timedOut = body.timedOut == true,
                        correctPosition = 1,
                        score = score,
                        correctCount = correctCount,
                        wrongCount = wrongCount,
                        timeoutCount = timeoutCount,
                        currentIndex = currentIndex,
                        totalQuestions = questions.size,
                        isComplete = isComplete,
                    ),
                ),
            )
        }

        private fun currentAttempt(gameType: String): GameAttemptDto {
            val isComplete = currentIndex >= questions.size
            return GameAttemptDto(
                attemptId = "a1",
                gameType = gameType,
                status = if (isComplete) "completed" else "playing",
                totalQuestions = questions.size,
                score = score,
                correctCount = correctCount,
                wrongCount = wrongCount,
                timeoutCount = timeoutCount,
                currentIndex = currentIndex,
                timeLimitSec = 5,
                remainingMs = 5_000L,
                questions = questions,
            )
        }
    }
}
