package com.kothabarta.feature.tictactoe.ui

import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.network.tictactoe.TicTacToeApi
import com.kothabarta.core.network.tictactoe.TttGameDto
import com.kothabarta.core.network.tictactoe.TttGameWrapperDto
import com.kothabarta.core.network.tictactoe.TttInviteDto
import com.kothabarta.core.network.tictactoe.TttInviteLifecycleEvent
import com.kothabarta.core.network.tictactoe.TttInviteRequest
import com.kothabarta.core.network.tictactoe.TttMoveRequest
import com.kothabarta.core.network.tictactoe.TttPendingInvitesDto
import com.kothabarta.core.network.tictactoe.TttSettingsDto
import com.kothabarta.core.network.tictactoe.TttStatsDto
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.tictactoe.data.TicTacToeRepository
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
class TttLobbyViewModelTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun friend(id: String) = SafeUserDto(id = id, fullName = "Friend $id")
    private fun activeGame(id: String) = TttGameDto(id = id, status = "active")
    private fun invite(id: String, from: SafeUserDto? = null, to: SafeUserDto? = null) =
        TttInviteDto(id = id, from = from, to = to)

    private fun newViewModel(api: FakeTicTacToeApi) =
        TttLobbyViewModel(TicTacToeRepository(api), SocketManager("http://localhost"))

    @Test
    fun `initial load populates friends, active games and both invite lists`() = runTest {
        val api = FakeTicTacToeApi(
            friends = listOf(friend("f1"), friend("f2")),
            games = listOf(activeGame("g1")),
            incoming = listOf(invite("in1", from = friend("f3"))),
            outgoing = listOf(invite("out1", to = friend("f4"))),
        )
        val viewModel = newViewModel(api)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(listOf("f1", "f2"), state.onlineFriends.map { it.id })
        assertEquals(listOf("g1"), state.activeGames.map { it.id })
        assertEquals(listOf("in1"), state.incomingInvites.map { it.id })
        assertEquals(listOf("out1"), state.outgoingInvites.map { it.id })
    }

    @Test
    fun `inviting an online friend sends the invite and appends it to outgoing`() = runTest {
        val api = FakeTicTacToeApi(friends = listOf(friend("f1")))
        val viewModel = newViewModel(api)
        advanceUntilIdle()

        viewModel.invite(friend("f1"))
        advanceUntilIdle()

        assertEquals("f1", api.lastInvitedUserId)
        assertEquals(listOf("invite-f1"), viewModel.uiState.value.outgoingInvites.map { it.id })
    }

    @Test
    fun `accepting an incoming invite removes it and navigates to the resulting game`() = runTest {
        val api = FakeTicTacToeApi(incoming = listOf(invite("in1", from = friend("f3"))))
        val viewModel = newViewModel(api)
        advanceUntilIdle()

        var event: NavigationEvent? = null
        val job = launch { viewModel.navigationEvents.collect { event = it } }
        viewModel.acceptInvite(viewModel.uiState.value.incomingInvites.first())
        advanceUntilIdle()
        job.cancel()

        assertTrue(viewModel.uiState.value.incomingInvites.isEmpty())
        assertEquals(NavigationEvent.NavigateTo("tic_tac_toe/game/game-from-in1"), event)
    }

    @Test
    fun `declining an incoming invite removes it from the list`() = runTest {
        val api = FakeTicTacToeApi(incoming = listOf(invite("in1")))
        val viewModel = newViewModel(api)
        advanceUntilIdle()

        viewModel.declineInvite(viewModel.uiState.value.incomingInvites.first())
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value.incomingInvites.isEmpty())
    }

    @Test
    fun `cancelling an outgoing invite removes it from the list`() = runTest {
        val api = FakeTicTacToeApi(outgoing = listOf(invite("out1")))
        val viewModel = newViewModel(api)
        advanceUntilIdle()

        viewModel.cancelInvite(viewModel.uiState.value.outgoingInvites.first())
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value.outgoingInvites.isEmpty())
    }

    @Test
    fun `an invite-lifecycle broadcast refreshes the pending invites and active games`() = runTest {
        val api = FakeTicTacToeApi()
        val viewModel = newViewModel(api)
        advanceUntilIdle()
        assertTrue(viewModel.uiState.value.incomingInvites.isEmpty())

        api.incoming = listOf(invite("in-live"))
        api.games = listOf(activeGame("g-live"))
        viewModel.onInviteLifecycleEvent(TttInviteLifecycleEvent(kind = "invite"))
        advanceUntilIdle()

        assertEquals(listOf("in-live"), viewModel.uiState.value.incomingInvites.map { it.id })
        assertEquals(listOf("g-live"), viewModel.uiState.value.activeGames.map { it.id })
    }

    private class FakeTicTacToeApi(
        private val friends: List<SafeUserDto> = emptyList(),
        var games: List<TttGameDto> = emptyList(),
        var incoming: List<TttInviteDto> = emptyList(),
        var outgoing: List<TttInviteDto> = emptyList(),
    ) : TicTacToeApi {
        var lastInvitedUserId: String? = null

        override suspend fun getSettings(): Response<ApiEnvelope<TttSettingsDto>> = notUsed()
        override suspend fun updateSettings(body: TttSettingsDto): Response<ApiEnvelope<TttSettingsDto>> = notUsed()
        override suspend fun getStats(): Response<ApiEnvelope<TttStatsDto>> = notUsed()

        override suspend fun getOnlineFriends(): Response<ApiEnvelope<List<SafeUserDto>>> =
            Response.success(ApiEnvelope(data = friends))

        override suspend fun getActiveGames(): Response<ApiEnvelope<List<TttGameDto>>> =
            Response.success(ApiEnvelope(data = games))

        override suspend fun getPendingInvites(): Response<ApiEnvelope<TttPendingInvitesDto>> =
            Response.success(ApiEnvelope(data = TttPendingInvitesDto(incoming = incoming, outgoing = outgoing)))

        override suspend fun sendInvite(body: TttInviteRequest): Response<ApiEnvelope<TttInviteDto>> {
            lastInvitedUserId = body.userId
            return Response.success(ApiEnvelope(data = TttInviteDto(id = "invite-${body.userId}")))
        }

        override suspend fun acceptInvite(inviteId: String): Response<ApiEnvelope<TttGameWrapperDto>> =
            Response.success(ApiEnvelope(data = TttGameWrapperDto(game = TttGameDto(id = "game-from-$inviteId"))))

        override suspend fun declineInvite(inviteId: String): Response<ApiEnvelope<Map<String, Any?>>> =
            Response.success(ApiEnvelope(data = mapOf("declined" to true)))

        override suspend fun cancelInvite(inviteId: String): Response<ApiEnvelope<Map<String, Any?>>> =
            Response.success(ApiEnvelope(data = mapOf("cancelled" to true)))

        override suspend fun getGame(gameId: String): Response<ApiEnvelope<TttGameDto>> = notUsed()
        override suspend fun move(gameId: String, body: TttMoveRequest): Response<ApiEnvelope<TttGameWrapperDto>> = notUsed()
        override suspend fun requestRematch(gameId: String) = notUsed()
        override suspend fun leaveGame(gameId: String): Response<ApiEnvelope<TttGameWrapperDto>> = notUsed()
        override suspend fun acceptRematch(requestId: String): Response<ApiEnvelope<TttGameWrapperDto>> = notUsed()
        override suspend fun declineRematch(requestId: String) = notUsed()

        private fun notUsed(): Nothing = error("not used by TttLobbyViewModelTest")
    }
}
