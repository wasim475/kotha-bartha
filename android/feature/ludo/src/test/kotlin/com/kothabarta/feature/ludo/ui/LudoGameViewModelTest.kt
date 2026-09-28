package com.kothabarta.feature.ludo.ui

import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.auth.AuthApi
import com.kothabarta.core.network.auth.GoogleLoginRequest
import com.kothabarta.core.network.auth.LoginRequest
import com.kothabarta.core.network.auth.RegisterRequest
import com.kothabarta.core.network.auth.UserDto
import com.kothabarta.core.network.ludo.CreateLudoLobbyRequest
import com.kothabarta.core.network.ludo.LudoApi
import com.kothabarta.core.network.ludo.LudoBoardStateDto
import com.kothabarta.core.network.ludo.LudoCatalogResponse
import com.kothabarta.core.network.ludo.LudoGameDto
import com.kothabarta.core.network.ludo.LudoGameWrapperDto
import com.kothabarta.core.network.ludo.LudoInviteDto
import com.kothabarta.core.network.ludo.LudoInviteLifecycleEvent
import com.kothabarta.core.network.ludo.LudoInviteRequest
import com.kothabarta.core.network.ludo.LudoLegalMoveDto
import com.kothabarta.core.network.ludo.LudoPendingInvitesDto
import com.kothabarta.core.network.ludo.LudoPlayerDto
import com.kothabarta.core.network.ludo.LudoReadyRequest
import com.kothabarta.core.network.ludo.LudoResultDto
import com.kothabarta.core.network.ludo.LudoStateEvent
import com.kothabarta.core.network.ludo.LudoStatsDto
import com.kothabarta.core.network.ludo.LudoTakeoverEvent
import com.kothabarta.core.network.ludo.LudoTokenDto
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.ludo.data.LudoRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

/**
 * `SocketManager("http://localhost")` never actually connects in a JVM unit
 * test (see `ChatViewModelTest`/`TttGameViewModelTest` for the same idiom),
 * so `on`/`off`/`emit`/`emitWithAck` are safe no-ops here — a real ack
 * callback never fires. Optimistic flags (`isRolling`/`movingTokenId`) are
 * therefore verified the same way `TttGameViewModelTest` verifies
 * `isSubmittingMove`, and every incoming broadcast is verified by calling the
 * ViewModel's own `internal` handler functions directly, exactly like the
 * real `Emitter.Listener`s do.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class LudoGameViewModelTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun newViewModel(api: FakeLudoApi = FakeLudoApi(), authApi: FakeAuthApi = FakeAuthApi()) =
        LudoGameViewModel("g1", LudoRepository(api), authApi, SocketManager("http://localhost"))

    private fun playerSeat(
        seat: Int,
        connected: Boolean = true,
        captures: Int = 0,
        tokens: List<LudoTokenDto> = List(4) { LudoTokenDto(it, -1) },
    ) = LudoPlayerDto(seat = seat, connected = connected, captures = captures, tokens = tokens)

    private fun boardWith(
        version: Int = 1,
        turnSeat: Int? = 0,
        turnNumber: Int = 1,
        turnDeadline: Long? = null,
        phase: String = "ROLL",
        dice: Int? = null,
        legal: List<LudoLegalMoveDto> = emptyList(),
        players: List<LudoPlayerDto> = listOf(playerSeat(0)),
    ) = LudoBoardStateDto(
        version = version,
        variantId = "QUICK_CAPTURE",
        phase = phase,
        players = players,
        turnSeat = turnSeat,
        turnNumber = turnNumber,
        turnDeadline = turnDeadline,
        dice = dice,
        legal = legal,
    )

    private fun seedActive(viewModel: LudoGameViewModel, board: LudoBoardStateDto, mySeat: Int) {
        viewModel.applyLobbySnapshot(LudoGameDto(id = "g1", variantId = "QUICK_CAPTURE", status = "active", mySeat = mySeat, game = board))
    }

    @Test
    fun `creating the view model issues exactly one ludo colon join call`() = runTest {
        val viewModel = newViewModel()
        runCurrent()

        assertEquals(1, viewModel.joinCallCount)
    }

    @Test
    fun `reconnecting re-issues the join call`() = runTest {
        val viewModel = newViewModel()
        runCurrent()
        assertEquals(1, viewModel.joinCallCount)

        // The reconnect collector (connectionState -> CONNECTED) calls the same internal join() a
        // live reconnect would trigger; SocketManager never actually flips to CONNECTED in a JVM test.
        viewModel.join()

        assertEquals(2, viewModel.joinCallCount)
    }

    @Test
    fun `applying a state event updates the rendered board and token positions`() = runTest {
        val viewModel = newViewModel()
        runCurrent()

        val board = boardWith(version = 2, players = listOf(playerSeat(0, tokens = listOf(LudoTokenDto(0, -1), LudoTokenDto(1, 5)))))
        viewModel.applyStateEvent(LudoStateEvent(gameId = "g1", version = 2, game = board))

        val state = viewModel.uiState.value.board
        assertEquals(2, state?.version)
        assertEquals(5, state?.players?.first()?.tokens?.get(1)?.pos)
    }

    @Test
    fun `a stale, older-version state event is dropped in favor of what's already applied`() = runTest {
        val viewModel = newViewModel()
        runCurrent()

        viewModel.applyStateEvent(LudoStateEvent(gameId = "g1", version = 5, game = boardWith(version = 5, dice = 6)))
        viewModel.applyStateEvent(LudoStateEvent(gameId = "g1", version = 2, game = boardWith(version = 2, dice = 1)))

        assertEquals(6, viewModel.uiState.value.board?.dice)
    }

    @Test
    fun `applying the identical state event twice leaves the board unchanged`() = runTest {
        val viewModel = newViewModel()
        runCurrent()

        val snapshot = boardWith(version = 5, players = listOf(playerSeat(0, tokens = listOf(LudoTokenDto(0, 10)))))
        val event = LudoStateEvent(gameId = "g1", version = 5, game = snapshot)

        viewModel.applyStateEvent(event)
        val afterFirst = viewModel.uiState.value.board
        viewModel.applyStateEvent(event)
        val afterSecond = viewModel.uiState.value.board

        assertEquals(afterFirst, afterSecond)
        assertEquals(snapshot, afterSecond)
    }

    @Test
    fun `a roll event updates the dice value shown on the board`() = runTest {
        val viewModel = newViewModel()
        runCurrent()
        viewModel.applyStateEvent(LudoStateEvent(gameId = "g1", version = 1, game = boardWith()))

        viewModel.onRollEvent(LudoStateEvent(gameId = "g1", version = 2, game = boardWith(version = 2, dice = 4)))

        assertEquals(4, viewModel.uiState.value.board?.dice)
    }

    @Test
    fun `a turn event advances whose turn it is and the deadline without needing a full board`() = runTest {
        val viewModel = newViewModel()
        runCurrent()
        viewModel.applyStateEvent(LudoStateEvent(gameId = "g1", version = 1, game = boardWith(turnSeat = 0)))

        viewModel.applyTurnEvent(LudoStateEvent(gameId = "g1", seat = 1, turnNumber = 2, turnDeadline = 99_999L, phase = "MOVE"))

        val board = viewModel.uiState.value.board
        assertEquals(1, board?.turnSeat)
        assertEquals(2, board?.turnNumber)
        assertEquals("MOVE", board?.phase)
        assertEquals(99_999L, board?.turnDeadline)
    }

    @Test
    fun `rolling on my turn during the ROLL phase sets the optimistic rolling flag`() = runTest {
        val viewModel = newViewModel()
        runCurrent()
        seedActive(viewModel, boardWith(turnSeat = 1, phase = "ROLL"), mySeat = 1)

        viewModel.rollDice()

        assertTrue(viewModel.uiState.value.isRolling)
    }

    @Test
    fun `rolling when it isn't my turn is a no-op`() = runTest {
        val viewModel = newViewModel()
        runCurrent()
        seedActive(viewModel, boardWith(turnSeat = 0, phase = "ROLL"), mySeat = 1)

        viewModel.rollDice()

        assertFalse(viewModel.uiState.value.isRolling)
    }

    @Test
    fun `moving a token not present in legal is a no-op`() = runTest {
        val viewModel = newViewModel()
        runCurrent()
        seedActive(viewModel, boardWith(turnSeat = 1, legal = listOf(LudoLegalMoveDto(tokenId = 2))), mySeat = 1)

        viewModel.moveToken(9)

        assertNull(viewModel.uiState.value.movingTokenId)
    }

    @Test
    fun `moving a legal token on my turn sets the optimistic moving flag`() = runTest {
        val viewModel = newViewModel()
        runCurrent()
        seedActive(viewModel, boardWith(turnSeat = 1, legal = listOf(LudoLegalMoveDto(tokenId = 2))), mySeat = 1)

        viewModel.moveToken(2)

        assertEquals(2, viewModel.uiState.value.movingTokenId)
    }

    @Test
    fun `moving when it isn't my turn is a no-op even for an otherwise-legal token`() = runTest {
        val viewModel = newViewModel()
        runCurrent()
        seedActive(viewModel, boardWith(turnSeat = 0, legal = listOf(LudoLegalMoveDto(tokenId = 2))), mySeat = 1)

        viewModel.moveToken(2)

        assertNull(viewModel.uiState.value.movingTokenId)
    }

    @Test
    fun `a capture event applies the updated board without crashing or losing data`() = runTest {
        val viewModel = newViewModel()
        runCurrent()
        viewModel.applyStateEvent(LudoStateEvent(gameId = "g1", version = 1, game = boardWith()))

        viewModel.onCaptureEvent(LudoStateEvent(gameId = "g1", version = 2, game = boardWith(version = 2, players = listOf(playerSeat(0, captures = 1)))))

        assertEquals(1, viewModel.uiState.value.board?.players?.first()?.captures)
    }

    @Test
    fun `a turn deadline already in the past renders as zero, never negative`() {
        val remaining = ludoRemainingMillis(turnDeadline = 1_000L, nowMillis = 9_000L)
        assertEquals(0L, remaining)
    }

    @Test
    fun `a future turn deadline renders the exact remaining time`() {
        val remaining = ludoRemainingMillis(turnDeadline = 9_000L, nowMillis = 1_000L)
        assertEquals(8_000L, remaining)
    }

    @Test
    fun `a disconnected player is rendered distinctly via the connected flag`() = runTest {
        val viewModel = newViewModel()
        runCurrent()

        viewModel.applyStateEvent(LudoStateEvent(gameId = "g1", version = 1, game = boardWith(players = listOf(playerSeat(0, connected = false)))))

        assertFalse(viewModel.uiState.value.board?.players?.first()?.connected ?: true)
    }

    @Test
    fun `ludo colon finished renders the ranked results and marks the game finished`() = runTest {
        val viewModel = newViewModel()
        runCurrent()
        val results = listOf(LudoResultDto(seat = 0, rank = 1, rewardPoints = 50), LudoResultDto(seat = 1, rank = 2, rewardPoints = 10))

        viewModel.onFinishedEvent(LudoStateEvent(gameId = "g1", version = 3, results = results, status = "finished"))

        val state = viewModel.uiState.value
        assertEquals("finished", state.status)
        assertEquals(results, state.results)
    }

    @Test
    fun `a takeover event stops the game from being interactive without erroring out`() = runTest {
        val viewModel = newViewModel()
        runCurrent()

        viewModel.onTakeoverEvent(LudoTakeoverEvent(gameId = "g1"))

        assertTrue(viewModel.uiState.value.isControlledElsewhere)
        assertNull(viewModel.uiState.value.error)
    }

    @Test
    fun `starting the game is a no-op for a non-host`() = runTest {
        val viewModel = newViewModel(authApi = FakeAuthApi(myId = "u1"))
        runCurrent()
        viewModel.applyLobbySnapshot(LudoGameDto(id = "g1", variantId = "QUICK_CAPTURE", status = "lobby", hostId = "someone-else"))

        viewModel.startGame()

        assertFalse(viewModel.uiState.value.isStarting)
    }

    @Test
    fun `requesting a rematch calls the repository and marks the request as sent`() = runTest {
        val api = FakeLudoApi()
        val viewModel = newViewModel(api)
        runCurrent()

        viewModel.requestRematch()
        runCurrent()

        assertEquals("g1", api.lastRematchGameId)
        assertTrue(viewModel.uiState.value.rematchRequestSent)
    }

    @Test
    fun `a rematch lifecycle broadcast with a new game id navigates there and clears the pending flag`() = runTest {
        val viewModel = newViewModel()
        runCurrent()
        viewModel.requestRematch()
        runCurrent()

        var event: NavigationEvent? = null
        val job = launch { viewModel.navigationEvents.collect { event = it } }
        viewModel.onRematchLifecycleEvent(LudoInviteLifecycleEvent(gameId = "g2"))
        runCurrent()
        job.cancel()

        assertFalse(viewModel.uiState.value.rematchRequestSent)
        assertEquals(NavigationEvent.NavigateTo(Routes.ludoGame("g2")), event)
    }

    private class FakeAuthApi(private val myId: String = "u1") : AuthApi {
        override suspend fun register(body: RegisterRequest) = notUsed()
        override suspend fun login(body: LoginRequest) = notUsed()
        override suspend fun google(body: GoogleLoginRequest) = notUsed()
        override suspend fun me(): Response<ApiEnvelope<UserDto>> =
            Response.success(ApiEnvelope(data = UserDto(id = myId, fullName = "Me", email = "me@x.com", role = "user")))
        override suspend fun logout() = notUsed()
        private fun notUsed(): Nothing = error("not used by LudoGameViewModelTest")
    }

    private class FakeLudoApi(private val rematchShouldFail: Boolean = false) : LudoApi {
        var lastRematchGameId: String? = null

        override suspend fun getCatalog(): Response<ApiEnvelope<LudoCatalogResponse>> = notUsed()
        override suspend fun getActiveGames(): Response<ApiEnvelope<List<LudoGameDto>>> = notUsed()
        override suspend fun getOnlineFriends(): Response<ApiEnvelope<List<SafeUserDto>>> = notUsed()
        override suspend fun getStats(): Response<ApiEnvelope<LudoStatsDto>> = notUsed()
        override suspend fun createLobby(body: CreateLudoLobbyRequest): Response<ApiEnvelope<LudoGameWrapperDto>> = notUsed()
        override suspend fun getPendingInvites(): Response<ApiEnvelope<LudoPendingInvitesDto>> = notUsed()
        override suspend fun sendInvite(body: LudoInviteRequest): Response<ApiEnvelope<LudoInviteDto>> = notUsed()
        override suspend fun acceptInvite(inviteId: String): Response<ApiEnvelope<LudoGameWrapperDto>> = notUsed()
        override suspend fun declineInvite(inviteId: String): Response<ApiEnvelope<Map<String, Any?>>> = notUsed()
        override suspend fun cancelInvite(inviteId: String): Response<ApiEnvelope<Map<String, Any?>>> = notUsed()
        override suspend fun getGame(gameId: String): Response<ApiEnvelope<LudoGameDto>> = notUsed()
        override suspend fun setReady(gameId: String, body: LudoReadyRequest): Response<ApiEnvelope<LudoGameWrapperDto>> = notUsed()
        override suspend fun startGame(gameId: String): Response<ApiEnvelope<LudoGameWrapperDto>> = notUsed()
        override suspend fun leaveGame(gameId: String): Response<ApiEnvelope<LudoGameWrapperDto>> =
            Response.success(ApiEnvelope(data = LudoGameWrapperDto(LudoGameDto(id = gameId, variantId = "QUICK_CAPTURE"))))

        override suspend fun requestRematch(gameId: String): Response<ApiEnvelope<Map<String, Any?>>> {
            lastRematchGameId = gameId
            return if (!rematchShouldFail) {
                Response.success(ApiEnvelope(data = emptyMap()))
            } else {
                val body = "{\"error\":{\"code\":\"SERVER_ERROR\",\"message\":\"Rematch unavailable.\"}}".toResponseBody("application/json".toMediaType())
                Response.error(500, body)
            }
        }

        private fun notUsed(): Nothing = error("not used by LudoGameViewModelTest")
    }
}
