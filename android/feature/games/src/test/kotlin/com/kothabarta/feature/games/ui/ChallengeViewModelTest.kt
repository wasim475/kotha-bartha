package com.kothabarta.feature.games.ui

import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.games.ChallengeAnswerRequest
import com.kothabarta.core.network.games.ChallengeInviteDto
import com.kothabarta.core.network.games.ChallengeInviteRequest
import com.kothabarta.core.network.games.ChallengeMatchDto
import com.kothabarta.core.network.games.ChallengeMatchWrapperDto
import com.kothabarta.core.network.games.ChallengePendingInvitesDto
import com.kothabarta.core.network.games.GameAnswerRequest
import com.kothabarta.core.network.games.GameAnswerResponse
import com.kothabarta.core.network.games.GameAttemptDto
import com.kothabarta.core.network.games.GameCatalogEntryDto
import com.kothabarta.core.network.games.GameChallengeApi
import com.kothabarta.core.network.games.GameReviewDto
import com.kothabarta.core.network.games.GamesApi
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.games.data.GameChallengeRepository
import com.kothabarta.feature.games.data.GamesRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class ChallengeViewModelTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun friend(id: String) = SafeUserDto(id = id, fullName = "Friend $id")
    private fun invite(id: String, from: SafeUserDto? = null) = ChallengeInviteDto(id = id, gameType = "math_solve", from = from)

    private fun newViewModel(challengeApi: FakeGameChallengeApi, gamesApi: FakeGamesApi = FakeGamesApi()) =
        ChallengeViewModel(GameChallengeRepository(challengeApi), GamesRepository(gamesApi), SocketManager("http://localhost"))

    @Test
    fun `an incoming invite is added to the state`() = runTest {
        val viewModel = newViewModel(FakeGameChallengeApi())
        advanceUntilIdle()

        viewModel.applyIncomingInvite(invite("inv-1", from = friend("u1")))

        assertEquals(listOf("inv-1"), viewModel.uiState.value.incomingInvites.map { it.id })
    }

    @Test
    fun `the same invite event arriving twice is never added twice`() = runTest {
        val viewModel = newViewModel(FakeGameChallengeApi())
        advanceUntilIdle()

        val inv = invite("inv-1", from = friend("u1"))
        viewModel.applyIncomingInvite(inv)
        viewModel.applyIncomingInvite(inv)

        assertEquals(1, viewModel.uiState.value.incomingInvites.count { it.id == "inv-1" })
    }

    @Test
    fun `accepting an invite removes it and navigates to the new match`() = runTest {
        val api = FakeGameChallengeApi(incoming = listOf(invite("inv-1", from = friend("u1"))))
        api.acceptMatchId = "match-9"
        val viewModel = newViewModel(api)
        advanceUntilIdle()

        var event: NavigationEvent? = null
        val job = launch { viewModel.navigationEvents.collect { event = it } }
        viewModel.acceptInvite(viewModel.uiState.value.incomingInvites.first())
        advanceUntilIdle()
        job.cancel()

        assertEquals("inv-1", api.lastAcceptedInviteId)
        assertTrue(viewModel.uiState.value.incomingInvites.isEmpty())
        assertEquals(NavigationEvent.NavigateTo(Routes.challengePlay("match-9")), event)
    }

    @Test
    fun `declining an invite removes it from the incoming list`() = runTest {
        val api = FakeGameChallengeApi(incoming = listOf(invite("inv-1", from = friend("u1"))))
        val viewModel = newViewModel(api)
        advanceUntilIdle()

        viewModel.declineInvite(viewModel.uiState.value.incomingInvites.first())
        advanceUntilIdle()

        assertEquals("inv-1", api.lastDeclinedInviteId)
        assertTrue(viewModel.uiState.value.incomingInvites.isEmpty())
    }

    @Test
    fun `reconnecting re-issues the initial load`() = runTest {
        val api = FakeGameChallengeApi()
        val viewModel = newViewModel(api)
        advanceUntilIdle()
        assertEquals(1, api.getOnlineFriendsCallCount)

        // The reconnect collector (connectionState -> CONNECTED) calls the same
        // internal load() a live reconnect would trigger; SocketManager never
        // actually flips to CONNECTED in a JVM unit test (it wraps a real,
        // never-connected Socket.IO client — see SocketManager's own KDoc).
        viewModel.retry()
        advanceUntilIdle()

        assertEquals(2, api.getOnlineFriendsCallCount)
    }

    private class FakeGameChallengeApi(
        private val friends: List<SafeUserDto> = emptyList(),
        private val incoming: List<ChallengeInviteDto> = emptyList(),
        private val outgoing: List<ChallengeInviteDto> = emptyList(),
    ) : GameChallengeApi {
        var getOnlineFriendsCallCount = 0
        var lastAcceptedInviteId: String? = null
        var lastDeclinedInviteId: String? = null
        var lastCancelledInviteId: String? = null
        var acceptMatchId: String = "match-1"

        override suspend fun getOnlineFriends(): Response<ApiEnvelope<List<SafeUserDto>>> {
            getOnlineFriendsCallCount++
            return Response.success(ApiEnvelope(data = friends))
        }

        override suspend fun getPendingInvites(): Response<ApiEnvelope<ChallengePendingInvitesDto>> =
            Response.success(ApiEnvelope(data = ChallengePendingInvitesDto(incoming = incoming, outgoing = outgoing)))

        override suspend fun sendInvite(body: ChallengeInviteRequest): Response<ApiEnvelope<ChallengeInviteDto>> =
            error("not used by ChallengeViewModelTest")

        override suspend fun acceptInvite(inviteId: String): Response<ApiEnvelope<ChallengeMatchWrapperDto>> {
            lastAcceptedInviteId = inviteId
            return Response.success(ApiEnvelope(data = ChallengeMatchWrapperDto(match = ChallengeMatchDto(id = acceptMatchId))))
        }

        override suspend fun declineInvite(inviteId: String): Response<ApiEnvelope<Map<String, Any?>>> {
            lastDeclinedInviteId = inviteId
            return Response.success(ApiEnvelope(data = emptyMap()))
        }

        override suspend fun cancelInvite(inviteId: String): Response<ApiEnvelope<Map<String, Any?>>> {
            lastCancelledInviteId = inviteId
            return Response.success(ApiEnvelope(data = emptyMap()))
        }

        override suspend fun getMatch(matchId: String): Response<ApiEnvelope<ChallengeMatchDto>> = error("not used by ChallengeViewModelTest")

        override suspend fun answer(matchId: String, body: ChallengeAnswerRequest): Response<ApiEnvelope<ChallengeMatchDto>> =
            error("not used by ChallengeViewModelTest")

        override suspend fun leaveMatch(matchId: String): Response<ApiEnvelope<ChallengeMatchDto>> = error("not used by ChallengeViewModelTest")

        override suspend fun requestRematch(matchId: String): Response<ApiEnvelope<ChallengeInviteDto>> =
            error("not used by ChallengeViewModelTest")
    }

    private class FakeGamesApi : GamesApi {
        override suspend fun getCatalog(): Response<ApiEnvelope<List<GameCatalogEntryDto>>> = Response.success(ApiEnvelope(data = emptyList()))
        override suspend fun getLastAttempt(): Response<ApiEnvelope<GameAttemptDto?>> = error("not used by ChallengeViewModelTest")
        override suspend fun startGame(gameType: String): Response<ApiEnvelope<GameAttemptDto>> = error("not used by ChallengeViewModelTest")
        override suspend fun getAttempt(attemptId: String): Response<ApiEnvelope<GameAttemptDto>> = error("not used by ChallengeViewModelTest")
        override suspend fun getReview(attemptId: String): Response<ApiEnvelope<GameReviewDto>> = error("not used by ChallengeViewModelTest")
        override suspend fun answer(attemptId: String, body: GameAnswerRequest): Response<ApiEnvelope<GameAnswerResponse>> =
            error("not used by ChallengeViewModelTest")
    }
}
