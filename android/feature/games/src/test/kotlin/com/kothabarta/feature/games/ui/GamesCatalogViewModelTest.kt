package com.kothabarta.feature.games.ui

import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.games.GameAnswerRequest
import com.kothabarta.core.network.games.GameAnswerResponse
import com.kothabarta.core.network.games.GameAttemptDto
import com.kothabarta.core.network.games.GameCatalogEntryDto
import com.kothabarta.core.network.games.GameReviewDto
import com.kothabarta.core.network.games.GamesApi
import com.kothabarta.feature.games.data.GamesRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.test.StandardTestDispatcher
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class GamesCatalogViewModelTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun entry(type: String, available: Boolean = true, route: String? = null) =
        GameCatalogEntryDto(type = type, name = type, available = available, route = route)

    @Test
    fun `initial load populates the catalog and last attempt`() = runTest {
        val api = FakeGamesApi(
            catalog = listOf(entry("math_solve")),
            lastAttempt = GameAttemptDto(attemptId = "a1", gameType = "math_solve", currentIndex = 1, totalQuestions = 5),
        )
        val viewModel = GamesCatalogViewModel(GamesRepository(api))
        advanceUntilIdle()

        assertEquals(listOf("math_solve"), viewModel.uiState.value.entries.map { it.type })
        assertEquals("a1", viewModel.uiState.value.lastAttempt?.attemptId)
    }

    @Test
    fun `a game with no last attempt is not treated as an error`() = runTest {
        val api = FakeGamesApi(catalog = listOf(entry("math_solve")), lastAttempt = null)
        val viewModel = GamesCatalogViewModel(GamesRepository(api))
        advanceUntilIdle()

        assertEquals(null, viewModel.uiState.value.error)
        assertEquals(null, viewModel.uiState.value.lastAttempt)
    }

    @Test
    fun `selecting a plain entry navigates to the solo play route`() = runTest {
        val api = FakeGamesApi(catalog = listOf(entry("math_solve")))
        val viewModel = GamesCatalogViewModel(GamesRepository(api))
        advanceUntilIdle()

        var event: NavigationEvent? = null
        val job = launch { viewModel.navigationEvents.collect { event = it } }
        viewModel.selectEntry(viewModel.uiState.value.entries.first())
        advanceUntilIdle()
        job.cancel()

        assertEquals(NavigationEvent.NavigateTo(Routes.gamePlay("math_solve")), event)
    }

    @Test
    fun `selecting a routed entry navigates via the matched Routes constant, not gamePlay`() = runTest {
        val api = FakeGamesApi(catalog = listOf(entry(Routes.TIC_TAC_TOE, route = "tic_tac_toe")))
        val viewModel = GamesCatalogViewModel(GamesRepository(api))
        advanceUntilIdle()

        var event: NavigationEvent? = null
        val job = launch { viewModel.navigationEvents.collect { event = it } }
        viewModel.selectEntry(viewModel.uiState.value.entries.first())
        advanceUntilIdle()
        job.cancel()

        assertEquals(NavigationEvent.NavigateTo(Routes.TIC_TAC_TOE), event)
    }

    @Test
    fun `continuing the last attempt navigates to that attempt's game type`() = runTest {
        val api = FakeGamesApi(
            catalog = listOf(entry("english_grammar")),
            lastAttempt = GameAttemptDto(attemptId = "a1", gameType = "english_grammar", currentIndex = 2, totalQuestions = 5),
        )
        val viewModel = GamesCatalogViewModel(GamesRepository(api))
        advanceUntilIdle()

        var event: NavigationEvent? = null
        val job = launch { viewModel.navigationEvents.collect { event = it } }
        viewModel.continueLastAttempt()
        advanceUntilIdle()
        job.cancel()

        assertEquals(NavigationEvent.NavigateTo(Routes.gamePlay("english_grammar")), event)
    }

    @Test
    fun `a failed catalog load surfaces the server's error`() = runTest {
        val api = FakeGamesApi(catalog = null)
        val viewModel = GamesCatalogViewModel(GamesRepository(api))
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value.error != null)
    }

    private class FakeGamesApi(
        private val catalog: List<GameCatalogEntryDto>?,
        private val lastAttempt: GameAttemptDto? = null,
    ) : GamesApi {
        override suspend fun getCatalog(): Response<ApiEnvelope<List<GameCatalogEntryDto>>> =
            if (catalog != null) {
                Response.success(ApiEnvelope(data = catalog))
            } else {
                val body = "{\"error\":{\"code\":\"SERVER_ERROR\",\"message\":\"Games are unavailable.\"}}"
                    .toResponseBody("application/json".toMediaType())
                Response.error(500, body)
            }

        override suspend fun getLastAttempt(): Response<ApiEnvelope<GameAttemptDto?>> = Response.success(ApiEnvelope(data = lastAttempt))

        override suspend fun startGame(gameType: String): Response<ApiEnvelope<GameAttemptDto>> = error("not used by GamesCatalogViewModelTest")
        override suspend fun getAttempt(attemptId: String): Response<ApiEnvelope<GameAttemptDto>> = error("not used by GamesCatalogViewModelTest")
        override suspend fun getReview(attemptId: String): Response<ApiEnvelope<GameReviewDto>> = error("not used by GamesCatalogViewModelTest")
        override suspend fun answer(attemptId: String, body: GameAnswerRequest): Response<ApiEnvelope<GameAnswerResponse>> =
            error("not used by GamesCatalogViewModelTest")
    }
}
