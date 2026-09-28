package com.kothabarta.feature.tictactoe.ui

import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.auth.AuthApi
import com.kothabarta.core.network.auth.GoogleLoginRequest
import com.kothabarta.core.network.auth.LoginRequest
import com.kothabarta.core.network.auth.RegisterRequest
import com.kothabarta.core.network.auth.UserDto
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.network.tictactoe.TicTacToeApi
import com.kothabarta.core.network.tictactoe.TttGameDto
import com.kothabarta.core.network.tictactoe.TttGameWrapperDto
import com.kothabarta.core.network.tictactoe.TttInviteDto
import com.kothabarta.core.network.tictactoe.TttInviteRequest
import com.kothabarta.core.network.tictactoe.TttMoveRequest
import com.kothabarta.core.network.tictactoe.TttSettingsDto
import com.kothabarta.core.network.tictactoe.TttStatsDto
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.tictactoe.data.TicTacToeRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

/**
 * `SocketManager("http://localhost")` never actually connects in a JVM unit
 * test (see `ChatViewModelTest`/`ConversationsViewModelTest` for the same
 * idiom), so `on`/`off`/`emit`/`emitWithAck` are safe no-ops here — a real
 * ack callback never fires. Move submission is therefore verified through
 * the optimistic `isSubmittingMove` flag the guard clauses set before the
 * (no-op) emit, and event delivery is verified by calling the ViewModel's
 * own `internal fun applyGameEvent` directly, exactly like the listeners
 * themselves do — this is the "simplest approach" the phase notes call for
 * over faking Socket.IO's `Emitter.Listener`/`Ack` callback mechanics.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class TttGameViewModelTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun playerX() = SafeUserDto(id = "u1", fullName = "Alice")
    private fun playerO() = SafeUserDto(id = "u2", fullName = "Bob")

    private fun game(
        status: String = "active",
        board: List<String?> = List(9) { null },
        currentTurn: String = "X",
        winner: String? = null,
        winnerId: String? = null,
        winningLine: List<Int> = emptyList(),
        rewardPoints: Int = 0,
    ) = TttGameDto(
        id = "g1",
        status = status,
        board = board,
        currentTurn = currentTurn,
        winner = winner,
        winnerId = winnerId,
        winningLine = winningLine,
        rewardPoints = rewardPoints,
        playerX = playerX(),
        playerO = playerO(),
    )

    private fun newViewModel(api: FakeTicTacToeApi = FakeTicTacToeApi(), authApi: FakeAuthApi = FakeAuthApi()) =
        TttGameViewModel("g1", TicTacToeRepository(api), authApi, SocketManager("http://localhost"))

    @Test
    fun `resolves my symbol and renders the board once my user id and the game snapshot are both known`() = runTest {
        val viewModel = newViewModel(authApi = FakeAuthApi(myId = "u2"))
        runCurrent()

        viewModel.applyGameEvent(game(currentTurn = "O", board = listOf("X", null, null, null, null, null, null, null, null)))
        runCurrent()

        val state = viewModel.uiState.value
        assertEquals("O", state.mySymbol)
        assertEquals("X", state.game?.board?.get(0))
        assertEquals("O", state.game?.currentTurn)
    }

    @Test
    fun `a tap on my turn on an empty cell flips the optimistic submitting flag`() = runTest {
        val viewModel = newViewModel(authApi = FakeAuthApi(myId = "u1"))
        runCurrent()
        viewModel.applyGameEvent(game(currentTurn = "X"))
        runCurrent()

        viewModel.onCellClick(4)

        assertTrue(viewModel.uiState.value.isSubmittingMove)
    }

    @Test
    fun `tapping when it isn't my turn is a no-op`() = runTest {
        val viewModel = newViewModel(authApi = FakeAuthApi(myId = "u1"))
        runCurrent()
        viewModel.applyGameEvent(game(currentTurn = "O"))
        runCurrent()

        viewModel.onCellClick(4)

        assertFalse(viewModel.uiState.value.isSubmittingMove)
    }

    @Test
    fun `tapping an already-filled cell is a no-op`() = runTest {
        val viewModel = newViewModel(authApi = FakeAuthApi(myId = "u1"))
        runCurrent()
        val board = MutableList<String?>(9) { null }
        board[4] = "X"
        viewModel.applyGameEvent(game(currentTurn = "X", board = board))
        runCurrent()

        viewModel.onCellClick(4)

        assertFalse(viewModel.uiState.value.isSubmittingMove)
    }

    @Test
    fun `tapping a finished game is a no-op`() = runTest {
        val viewModel = newViewModel(authApi = FakeAuthApi(myId = "u1"))
        runCurrent()
        viewModel.applyGameEvent(game(status = "finished", currentTurn = "X", winner = "X", winnerId = "u1"))
        runCurrent()

        viewModel.onCellClick(0)

        assertFalse(viewModel.uiState.value.isSubmittingMove)
    }

    @Test
    fun `the same state event applied twice does not corrupt or duplicate state`() = runTest {
        val viewModel = newViewModel(authApi = FakeAuthApi(myId = "u1"))
        runCurrent()
        val snapshot = game(currentTurn = "O", board = listOf("X", null, null, null, null, null, null, null, null))

        viewModel.applyGameEvent(snapshot)
        viewModel.applyGameEvent(snapshot)

        val state = viewModel.uiState.value
        assertEquals(snapshot, state.game)
        assertEquals(1, state.game?.board?.count { it == "X" })
    }

    @Test
    fun `a finished game with me as the winner surfaces the winning line and reward`() = runTest {
        val viewModel = newViewModel(authApi = FakeAuthApi(myId = "u1"))
        runCurrent()

        viewModel.applyGameEvent(
            game(
                status = "finished",
                winner = "X",
                winnerId = "u1",
                winningLine = listOf(0, 1, 2),
                rewardPoints = 5,
                board = listOf("X", "X", "X", "O", "O", null, null, null, null),
            ),
        )

        val state = viewModel.uiState.value
        assertEquals("X", state.game?.winner)
        assertEquals(listOf(0, 1, 2), state.game?.winningLine)
        assertEquals(5, state.game?.rewardPoints)
        assertEquals("u1", state.myUserId)
    }

    @Test
    fun `a draw is surfaced as-is from the server`() = runTest {
        val viewModel = newViewModel(authApi = FakeAuthApi(myId = "u1"))
        runCurrent()

        viewModel.applyGameEvent(game(status = "finished", winner = "draw", rewardPoints = 0))

        assertEquals("draw", viewModel.uiState.value.game?.winner)
    }

    @Test
    fun `requesting a rematch calls the repository and marks the request as sent`() = runTest {
        val api = FakeTicTacToeApi()
        val viewModel = newViewModel(api, FakeAuthApi(myId = "u1"))
        runCurrent()

        viewModel.requestRematch()
        runCurrent()

        assertEquals("g1", api.lastRematchGameId)
        assertTrue(viewModel.uiState.value.rematchRequestSent)
    }

    @Test
    fun `a failed rematch request surfaces the server's error and never marks it sent`() = runTest {
        val api = FakeTicTacToeApi(rematchShouldFail = true)
        val viewModel = newViewModel(api, FakeAuthApi(myId = "u1"))
        runCurrent()

        viewModel.requestRematch()
        runCurrent()

        assertFalse(viewModel.uiState.value.rematchRequestSent)
        assertEquals("Rematch unavailable.", viewModel.uiState.value.error)
    }

    @Test
    fun `reconnecting re-issues the join call`() = runTest {
        val viewModel = newViewModel(authApi = FakeAuthApi(myId = "u1"))
        runCurrent()
        assertEquals(1, viewModel.joinCallCount)

        // The reconnect collector (connectionState -> CONNECTED) calls the same
        // internal join() a live reconnect would trigger; SocketManager never
        // actually flips to CONNECTED in a JVM test (see class doc comment).
        viewModel.join()

        assertEquals(2, viewModel.joinCallCount)
    }

    private class FakeAuthApi(private val myId: String = "u1") : AuthApi {
        override suspend fun register(body: RegisterRequest) = notUsed()
        override suspend fun login(body: LoginRequest) = notUsed()
        override suspend fun google(body: GoogleLoginRequest) = notUsed()
        override suspend fun me(): Response<ApiEnvelope<UserDto>> =
            Response.success(ApiEnvelope(data = UserDto(id = myId, fullName = "Me", email = "me@x.com", role = "user")))
        override suspend fun logout() = notUsed()
        private fun notUsed(): Nothing = error("not used by TttGameViewModelTest")
    }

    private class FakeTicTacToeApi(private val rematchShouldFail: Boolean = false) : TicTacToeApi {
        var lastRematchGameId: String? = null

        override suspend fun getSettings(): Response<ApiEnvelope<TttSettingsDto>> = notUsed()
        override suspend fun updateSettings(body: TttSettingsDto): Response<ApiEnvelope<TttSettingsDto>> = notUsed()
        override suspend fun getStats(): Response<ApiEnvelope<TttStatsDto>> = notUsed()
        override suspend fun getOnlineFriends() = notUsed()
        override suspend fun getActiveGames() = notUsed()
        override suspend fun getPendingInvites() = notUsed()
        override suspend fun sendInvite(body: TttInviteRequest): Response<ApiEnvelope<TttInviteDto>> = notUsed()
        override suspend fun acceptInvite(inviteId: String): Response<ApiEnvelope<TttGameWrapperDto>> = notUsed()
        override suspend fun declineInvite(inviteId: String) = notUsed()
        override suspend fun cancelInvite(inviteId: String) = notUsed()
        override suspend fun getGame(gameId: String): Response<ApiEnvelope<TttGameDto>> = notUsed()
        override suspend fun move(gameId: String, body: TttMoveRequest): Response<ApiEnvelope<TttGameWrapperDto>> = notUsed()

        override suspend fun requestRematch(gameId: String): Response<ApiEnvelope<TttInviteDto>> {
            lastRematchGameId = gameId
            return if (!rematchShouldFail) {
                Response.success(ApiEnvelope(data = TttInviteDto(id = "r1", kind = "rematch", gameId = gameId)))
            } else {
                val body = "{\"error\":{\"code\":\"SERVER_ERROR\",\"message\":\"Rematch unavailable.\"}}".toResponseBody("application/json".toMediaType())
                Response.error(500, body)
            }
        }

        override suspend fun leaveGame(gameId: String): Response<ApiEnvelope<TttGameWrapperDto>> = notUsed()
        override suspend fun acceptRematch(requestId: String): Response<ApiEnvelope<TttGameWrapperDto>> = notUsed()
        override suspend fun declineRematch(requestId: String) = notUsed()

        private fun notUsed(): Nothing = error("not used by TttGameViewModelTest")
    }
}
