package com.kothabarta.feature.ludo.ui

import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.ludo.CreateLudoLobbyRequest
import com.kothabarta.core.network.ludo.LudoApi
import com.kothabarta.core.network.ludo.LudoCatalogResponse
import com.kothabarta.core.network.ludo.LudoGameDto
import com.kothabarta.core.network.ludo.LudoGameWrapperDto
import com.kothabarta.core.network.ludo.LudoInviteDto
import com.kothabarta.core.network.ludo.LudoInviteLifecycleEvent
import com.kothabarta.core.network.ludo.LudoInviteRequest
import com.kothabarta.core.network.ludo.LudoPendingInvitesDto
import com.kothabarta.core.network.ludo.LudoReadyRequest
import com.kothabarta.core.network.ludo.LudoStatsDto
import com.kothabarta.core.network.ludo.LudoVariantDto
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.ludo.data.LudoRepository
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class LudoLobbyViewModelTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun variant(id: String, online: Boolean = true) = LudoVariantDto(id = id, title = id, online = online)

    private fun game(id: String, status: String = "lobby") = LudoGameDto(id = id, variantId = "QUICK_CAPTURE", status = status)

    @Test
    fun `catalog loads and LOCAL_CLASSIC and offline-only variants are filtered out of the online lobby`() = runTest {
        val api = FakeLudoApi(
            variants = listOf(variant("QUICK_CAPTURE"), variant("CLASSIC_RANKED"), variant("LOCAL_CLASSIC"), variant("OFFLINE_ONLY", online = false)),
        )
        val viewModel = LudoLobbyViewModel(LudoRepository(api), SocketManager("http://localhost"))
        advanceUntilIdle()

        val ids = viewModel.uiState.value.variants.map { it.id }
        assertEquals(listOf("QUICK_CAPTURE", "CLASSIC_RANKED"), ids)
    }

    @Test
    fun `creating a lobby navigates straight to that game's route`() = runTest {
        val api = FakeLudoApi(variants = listOf(variant("QUICK_CAPTURE")), createdGameId = "game-1")
        val viewModel = LudoLobbyViewModel(LudoRepository(api), SocketManager("http://localhost"))
        advanceUntilIdle()

        viewModel.selectVariant("QUICK_CAPTURE")
        var event: NavigationEvent? = null
        val job = launch { viewModel.navigationEvents.collect { event = it } }
        viewModel.createLobby()
        advanceUntilIdle()
        job.cancel()

        assertEquals(NavigationEvent.NavigateTo(Routes.ludoGame("game-1")), event)
        assertEquals(CreateLudoLobbyRequest("QUICK_CAPTURE"), api.lastCreateRequest)
    }

    @Test
    fun `accepting an invite removes it from incoming and navigates to the game`() = runTest {
        val invite = LudoInviteDto(id = "inv-1", gameId = "game-9")
        val api = FakeLudoApi(variants = emptyList(), pending = LudoPendingInvitesDto(incoming = listOf(invite)), acceptGameId = "game-9")
        val viewModel = LudoLobbyViewModel(LudoRepository(api), SocketManager("http://localhost"))
        advanceUntilIdle()

        assertEquals(1, viewModel.uiState.value.incomingInvites.size)

        var event: NavigationEvent? = null
        val job = launch { viewModel.navigationEvents.collect { event = it } }
        viewModel.acceptInvite(invite)
        advanceUntilIdle()
        job.cancel()

        assertTrue(viewModel.uiState.value.incomingInvites.isEmpty())
        assertEquals(NavigationEvent.NavigateTo(Routes.ludoGame("game-9")), event)
    }

    @Test
    fun `an invite lifecycle broadcast refetches pending invites and active games`() = runTest {
        val api = FakeLudoApi(variants = emptyList())
        val viewModel = LudoLobbyViewModel(LudoRepository(api), SocketManager("http://localhost"))
        advanceUntilIdle()

        api.pendingInvitesResult = LudoPendingInvitesDto(incoming = listOf(LudoInviteDto(id = "inv-2", gameId = "game-2")))
        viewModel.onInviteLifecycleEvent(LudoInviteLifecycleEvent(gameId = "game-2"))
        advanceUntilIdle()

        assertEquals(listOf("inv-2"), viewModel.uiState.value.incomingInvites.map { it.id })
    }

    @Test
    fun `inviting a friend targets the selected lobby game, not a fresh one`() = runTest {
        val friend = SafeUserDto(id = "friend-1", fullName = "Friend")
        val api = FakeLudoApi(variants = emptyList())
        val viewModel = LudoLobbyViewModel(LudoRepository(api), SocketManager("http://localhost"))
        advanceUntilIdle()

        viewModel.invite(friend)
        advanceUntilIdle()
        assertFalse(api.sendInviteCalled)

        viewModel.setInviteTarget("game-3")
        viewModel.invite(friend)
        advanceUntilIdle()

        assertTrue(api.sendInviteCalled)
        assertEquals(LudoInviteRequest("game-3", "friend-1"), api.lastInviteRequest)
    }

    private class FakeLudoApi(
        private val variants: List<LudoVariantDto>,
        private val activeGames: List<LudoGameDto> = emptyList(),
        private val pending: LudoPendingInvitesDto = LudoPendingInvitesDto(),
        private val createdGameId: String = "created-game",
        private val acceptGameId: String = "accepted-game",
    ) : LudoApi {
        var pendingInvitesResult: LudoPendingInvitesDto = pending
        var lastCreateRequest: CreateLudoLobbyRequest? = null
        var lastInviteRequest: LudoInviteRequest? = null
        var sendInviteCalled = false

        override suspend fun getCatalog(): Response<ApiEnvelope<LudoCatalogResponse>> =
            Response.success(ApiEnvelope(data = LudoCatalogResponse(variants = variants)))

        override suspend fun getActiveGames(): Response<ApiEnvelope<List<LudoGameDto>>> = Response.success(ApiEnvelope(data = activeGames))

        override suspend fun getOnlineFriends(): Response<ApiEnvelope<List<SafeUserDto>>> = Response.success(ApiEnvelope(data = emptyList()))

        override suspend fun getStats(): Response<ApiEnvelope<LudoStatsDto>> = Response.success(ApiEnvelope(data = LudoStatsDto()))

        override suspend fun createLobby(body: CreateLudoLobbyRequest): Response<ApiEnvelope<LudoGameWrapperDto>> {
            lastCreateRequest = body
            return Response.success(ApiEnvelope(data = LudoGameWrapperDto(LudoGameDto(id = createdGameId, variantId = body.variantId))))
        }

        override suspend fun getPendingInvites(): Response<ApiEnvelope<LudoPendingInvitesDto>> = Response.success(ApiEnvelope(data = pendingInvitesResult))

        override suspend fun sendInvite(body: LudoInviteRequest): Response<ApiEnvelope<LudoInviteDto>> {
            sendInviteCalled = true
            lastInviteRequest = body
            return Response.success(ApiEnvelope(data = LudoInviteDto(id = "new-invite", gameId = body.gameId)))
        }

        override suspend fun acceptInvite(inviteId: String): Response<ApiEnvelope<LudoGameWrapperDto>> =
            Response.success(ApiEnvelope(data = LudoGameWrapperDto(LudoGameDto(id = acceptGameId, variantId = "QUICK_CAPTURE"))))

        override suspend fun declineInvite(inviteId: String): Response<ApiEnvelope<Map<String, Any?>>> = Response.success(ApiEnvelope(data = emptyMap()))
        override suspend fun cancelInvite(inviteId: String): Response<ApiEnvelope<Map<String, Any?>>> = Response.success(ApiEnvelope(data = emptyMap()))
        override suspend fun getGame(gameId: String): Response<ApiEnvelope<LudoGameDto>> = Response.success(ApiEnvelope(data = LudoGameDto(id = gameId, variantId = "QUICK_CAPTURE")))
        override suspend fun setReady(gameId: String, body: LudoReadyRequest): Response<ApiEnvelope<LudoGameWrapperDto>> = notUsed()
        override suspend fun startGame(gameId: String): Response<ApiEnvelope<LudoGameWrapperDto>> = notUsed()
        override suspend fun leaveGame(gameId: String): Response<ApiEnvelope<LudoGameWrapperDto>> = notUsed()
        override suspend fun requestRematch(gameId: String): Response<ApiEnvelope<Map<String, Any?>>> = notUsed()

        private fun notUsed(): Nothing = error("not used by LudoLobbyViewModelTest")
    }
}
