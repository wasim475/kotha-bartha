package com.kothabarta.feature.leaderboard.ui

import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.leaderboard.LeaderboardApi
import com.kothabarta.core.network.leaderboard.LeaderboardMeDto
import com.kothabarta.core.network.leaderboard.LeaderboardRowDto
import com.kothabarta.core.network.leaderboard.LeaderboardTopResponse
import com.kothabarta.core.network.leaderboard.UserStatsDto
import com.kothabarta.feature.leaderboard.data.LeaderboardRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class LeaderboardViewModelTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial load uses the default overall-month category and period`() = runTest {
        val api = FakeLeaderboardApi()
        val viewModel = LeaderboardViewModel(LeaderboardRepository(api))
        advanceUntilIdle()

        assertEquals("overall", api.lastCategory)
        assertEquals("month", api.lastPeriod)
        assertEquals(2, viewModel.uiState.value.data?.top20?.size)
    }

    @Test
    fun `selecting a category reloads with that category`() = runTest {
        val api = FakeLeaderboardApi()
        val viewModel = LeaderboardViewModel(LeaderboardRepository(api))
        advanceUntilIdle()

        viewModel.selectCategory("quiz")
        advanceUntilIdle()

        assertEquals("quiz", api.lastCategory)
        assertEquals("quiz", viewModel.uiState.value.category)
    }

    @Test
    fun `the viewer's own rank is exposed via me even when not in the visible top20`() = runTest {
        val api = FakeLeaderboardApi(meInTop20 = false)
        val viewModel = LeaderboardViewModel(LeaderboardRepository(api))
        advanceUntilIdle()

        val me = viewModel.uiState.value.data?.me
        assertTrue(me != null && !me.inTop20)
        assertEquals(42, me?.rank)
    }

    @Test
    fun `a failed load surfaces the server's error`() = runTest {
        val api = FakeLeaderboardApi(shouldFail = true)
        val viewModel = LeaderboardViewModel(LeaderboardRepository(api))
        advanceUntilIdle()

        assertEquals("Leaderboard is unavailable.", viewModel.uiState.value.error)
    }

    private class FakeLeaderboardApi(
        private val meInTop20: Boolean = true,
        private val shouldFail: Boolean = false,
    ) : LeaderboardApi {
        var lastCategory: String? = null
        var lastPeriod: String? = null

        override suspend fun getTop(category: String, period: String): Response<ApiEnvelope<LeaderboardTopResponse>> {
            lastCategory = category
            lastPeriod = period
            if (shouldFail) {
                val body = "{\"error\":{\"code\":\"SERVER_ERROR\",\"message\":\"Leaderboard is unavailable.\"}}"
                    .toResponseBody("application/json".toMediaType())
                return Response.error(500, body)
            }
            return Response.success(
                ApiEnvelope(
                    data = LeaderboardTopResponse(
                        category = category,
                        period = period,
                        top20 = listOf(
                            LeaderboardRowDto(rank = 1, id = "u1", fullName = "Alice", points = 100),
                            LeaderboardRowDto(rank = 2, id = "u2", fullName = "Bob", points = 90),
                        ),
                        me = LeaderboardMeDto(rank = 42, id = "me", fullName = "Me", points = 5, inTop20 = meInTop20),
                    ),
                ),
            )
        }

        override suspend fun getUserStats(userId: String, period: String): Response<ApiEnvelope<UserStatsDto>> =
            error("not used by LeaderboardViewModelTest")
    }
}
