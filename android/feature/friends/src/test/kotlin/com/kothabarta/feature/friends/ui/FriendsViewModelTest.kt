package com.kothabarta.feature.friends.ui

import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.social.AcceptedResponse
import com.kothabarta.core.network.social.CancelledResponse
import com.kothabarta.core.network.social.FriendEntryDto
import com.kothabarta.core.network.social.FriendRequestCreated
import com.kothabarta.core.network.social.FriendsApi
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.network.social.SendFriendRequestBody
import com.kothabarta.core.network.social.UnfriendedResponse
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.friends.data.FriendsRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class FriendsViewModelTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    /** A real, unconnected [SocketManager] — `on`/`off` are safe no-ops with no live socket (see FeedViewModel-adjacent tests' precedent). */
    private fun offlineSocketManager() = SocketManager("http://localhost")

    @Test
    fun `friends tab loads bare users via GET friends tab=friends`() = runTest {
        val api = FakeFriendsApi(friends = listOf(SafeUserDto(id = "f1", fullName = "Alice")))
        val viewModel = FriendsViewModel(FriendsRepository(api), offlineSocketManager())
        advanceUntilIdle()
        assertEquals(listOf("f1"), viewModel.uiState.value.friends.map { it.id })
        assertEquals(FriendsTab.FRIENDS, viewModel.uiState.value.tab)
    }

    @Test
    fun `switching to Requests loads the requests tab, not friends or sent`() = runTest {
        val api = FakeFriendsApi(
            friends = listOf(SafeUserDto(id = "f1", fullName = "Alice")),
            requests = listOf(FriendEntryDto(id = "r1", status = "pending", user = SafeUserDto(id = "u9", fullName = "Bob"))),
        )
        val viewModel = FriendsViewModel(FriendsRepository(api), offlineSocketManager())
        advanceUntilIdle()

        viewModel.selectTab(FriendsTab.REQUESTS)
        advanceUntilIdle()

        assertEquals("requests", api.lastTabRequested)
        assertEquals(listOf("r1"), viewModel.uiState.value.requests.map { it.id })
    }

    @Test
    fun `accepting a request calls accept then reloads the current tab`() = runTest {
        val api = FakeFriendsApi(requests = listOf(FriendEntryDto(id = "r1", status = "pending", user = SafeUserDto(id = "u9", fullName = "Bob"))))
        val viewModel = FriendsViewModel(FriendsRepository(api), offlineSocketManager())
        advanceUntilIdle() // flush the constructor's own initial load (defaults to the Friends tab) before switching tabs
        viewModel.selectTab(FriendsTab.REQUESTS)
        advanceUntilIdle()

        viewModel.acceptRequest(viewModel.uiState.value.requests.first())
        advanceUntilIdle()

        assertEquals("r1", api.lastAcceptedRequestId)
        assertEquals(2, api.entriesCallCount) // once on tab-select, once after the successful accept
    }

    @Test
    fun `declining a received request cancels by the sender's user id, not the request id`() = runTest {
        val api = FakeFriendsApi(requests = listOf(FriendEntryDto(id = "r1", status = "pending", user = SafeUserDto(id = "sender9", fullName = "Bob"))))
        val viewModel = FriendsViewModel(FriendsRepository(api), offlineSocketManager())
        advanceUntilIdle()
        viewModel.selectTab(FriendsTab.REQUESTS)
        advanceUntilIdle()

        viewModel.declineOrCancel(viewModel.uiState.value.requests.first())
        advanceUntilIdle()

        assertEquals("sender9", api.lastCancelledUserId)
    }

    private class FakeFriendsApi(
        private val friends: List<SafeUserDto> = emptyList(),
        private val requests: List<FriendEntryDto> = emptyList(),
        private val sent: List<FriendEntryDto> = emptyList(),
    ) : FriendsApi {
        var lastTabRequested: String? = null
        var lastAcceptedRequestId: String? = null
        var lastCancelledUserId: String? = null
        var entriesCallCount = 0

        override suspend fun getFriends(tab: String): Response<ApiEnvelope<List<SafeUserDto>>> {
            lastTabRequested = tab
            return Response.success(ApiEnvelope(data = friends))
        }

        override suspend fun getFriendEntries(tab: String): Response<ApiEnvelope<List<FriendEntryDto>>> {
            lastTabRequested = tab
            entriesCallCount++
            return Response.success(ApiEnvelope(data = if (tab == "sent") sent else requests))
        }

        override suspend fun sendFriendRequest(body: SendFriendRequestBody): Response<ApiEnvelope<FriendRequestCreated>> =
            Response.success(ApiEnvelope(data = FriendRequestCreated(id = "new", status = "pending")))

        override suspend fun cancelFriendRequest(receiverId: String): Response<ApiEnvelope<CancelledResponse>> {
            lastCancelledUserId = receiverId
            return Response.success(ApiEnvelope(data = CancelledResponse(true)))
        }

        override suspend fun acceptFriendRequest(requestId: String): Response<ApiEnvelope<AcceptedResponse>> {
            lastAcceptedRequestId = requestId
            return Response.success(ApiEnvelope(data = AcceptedResponse(true)))
        }

        override suspend fun unfriend(userId: String): Response<ApiEnvelope<UnfriendedResponse>> =
            Response.success(ApiEnvelope(data = UnfriendedResponse(true)))
    }
}
