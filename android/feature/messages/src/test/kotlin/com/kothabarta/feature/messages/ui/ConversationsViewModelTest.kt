package com.kothabarta.feature.messages.ui

import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.messages.ConversationDto
import com.kothabarta.core.network.messages.ConversationPeerDto
import com.kothabarta.core.network.messages.ConversationActionResponse
import com.kothabarta.core.network.messages.CreateConversationRequest
import com.kothabarta.core.network.messages.MessageDto
import com.kothabarta.core.network.messages.MessagesApi
import com.kothabarta.core.network.messages.ReactionRequest
import com.kothabarta.core.network.social.BlockedResponse
import com.kothabarta.core.network.social.CreateReportBody
import com.kothabarta.core.network.social.FriendEntryDto
import com.kothabarta.core.network.social.FriendRequestCreated
import com.kothabarta.core.network.social.FriendsApi
import com.kothabarta.core.network.social.ProfileUserDto
import com.kothabarta.core.network.social.PostDto
import com.kothabarta.core.network.social.ReportCreatedDto
import com.kothabarta.core.network.social.ReportsApi
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.network.social.UsersApi
import com.kothabarta.core.network.social.DevicePublicKeyRegistrationRequest
import com.kothabarta.core.network.social.DevicePublicKeyRegistrationResponse
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.messages.data.MessagesRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.withContext
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response
import java.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class ConversationsViewModelTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun conversation(id: String, peerId: String = "peer-$id", unread: Int = 0, name: String = "Friend $id") = ConversationDto(
        id = id,
        user = ConversationPeerDto(id = peerId, fullName = name),
        lastMessage = "hi",
        unreadCount = unread,
    )

    @Test
    fun `initial load populates conversations`() = runTest {
        val api = FakeMessagesApi(conversations = listOf(conversation("c1"), conversation("c2", unread = 3)))
        val viewModel = ConversationsViewModel(MessagesRepository(api), SocketManager("http://localhost"))
        advanceUntilIdle()

        assertEquals(listOf("c1", "c2"), viewModel.uiState.value.conversations.map { it.id })
        assertEquals(3, viewModel.uiState.value.conversations.first { it.id == "c2" }.unreadCount)
    }

    @Test
    fun `opening a conversation navigates with the peer's id, name and avatar carried along`() = runTest {
        val api = FakeMessagesApi(conversations = listOf(conversation("c1", peerId = "u9")))
        val viewModel = ConversationsViewModel(MessagesRepository(api), SocketManager("http://localhost"))
        advanceUntilIdle()

        var event: NavigationEvent? = null
        val job = launch { viewModel.navigationEvents.collect { event = it } }
        viewModel.openConversation(viewModel.uiState.value.conversations.first())
        advanceUntilIdle()
        job.cancel()

        val navigateTo = event as? NavigationEvent.NavigateTo
        assertTrue(navigateTo != null)
        assertTrue(navigateTo!!.route.startsWith("messages/c1?"))
        assertTrue(navigateTo.route.contains("peerId=u9"))
    }

    @Test
    fun `a failed load surfaces the server's error`() = runTest {
        val api = FakeMessagesApi(conversations = null)
        val viewModel = ConversationsViewModel(MessagesRepository(api), SocketManager("http://localhost"))
        advanceUntilIdle()

        assertEquals("Conversations are unavailable.", viewModel.uiState.value.error)
    }

    @Test
    fun `encrypted conversation preview never renders a plaintext body`() {
        val encryptedConversation = ConversationDto(
            id = "encrypted",
            encrypted = true,
            body = "plaintext must stay hidden",
            lastMessage = "🔒 Encrypted message",
        )

        assertEquals("🔒 Encrypted message", conversationPreview(encryptedConversation))
    }

    @Test
    fun `conversation timestamp is omitted when the server timestamp is invalid`() {
        assertEquals("", conversationTimestamp("not-a-timestamp", Instant.parse("2026-10-29T00:00:00Z")))
    }

    @Test
    fun `new conversation search is debounced and opens a conversation`() = runTest {
        val api = FakeMessagesApi(listOf(conversation("c1")))
        val usersApi = FakeUsersApi()
        val viewModel = newViewModel(api, usersApi)
        advanceUntilIdle()

        viewModel.searchUsers("Al")
        advanceTimeBy(299)
        assertEquals(0, usersApi.searchCount)
        advanceTimeBy(1)
        advanceUntilIdle()
        assertEquals(1, usersApi.searchCount)
        assertEquals("Alice", viewModel.uiState.value.userSearchResults.single().fullName)

        val events = mutableListOf<NavigationEvent>()
        val job = launch { viewModel.navigationEvents.collect { events += it } }
        viewModel.openUserConversation(usersApi.results.single())
        advanceUntilIdle()
        job.cancel()

        assertEquals(1, api.createConversationCount)
        assertTrue((events.single() as NavigationEvent.NavigateTo).route.contains("peerId=alice-id"))
    }

    @Test
    fun `existing conversation opens without creating another`() = runTest {
        val api = FakeMessagesApi(listOf(conversation("existing", peerId = "alice-id", name = "Alice")))
        val viewModel = newViewModel(api, FakeUsersApi())
        advanceUntilIdle()

        val events = mutableListOf<NavigationEvent>()
        val job = launch { viewModel.navigationEvents.collect { events += it } }
        viewModel.openUserConversation(SafeUserDto(id = "alice-id", fullName = "Alice"))
        advanceUntilIdle()
        job.cancel()

        assertEquals(0, api.createConversationCount)
        assertTrue((events.single() as NavigationEvent.NavigateTo).route.startsWith("messages/existing?"))
    }

    @Test
    fun `repeated start taps create only one conversation request`() = runTest {
        val api = FakeMessagesApi(emptyList())
        val viewModel = newViewModel(api, FakeUsersApi())
        advanceUntilIdle()
        val user = SafeUserDto(id = "alice-id", fullName = "Alice")

        viewModel.openUserConversation(user)
        viewModel.openUserConversation(user)
        advanceUntilIdle()

        assertEquals(1, api.createConversationCount)
    }

    @Test
    fun `stale user search response is ignored`() = runTest {
        val api = FakeMessagesApi(emptyList())
        val oldResponse = CompletableDeferred<Response<ApiEnvelope<List<SafeUserDto>>>>()
        val usersApi = FakeUsersApi { query ->
            if (query == "Al") withContext(NonCancellable) { oldResponse.await() }
            else Response.success(ApiEnvelope(data = listOf(SafeUserDto(id = "new", fullName = "Alice New"))))
        }
        val viewModel = newViewModel(api, usersApi)
        advanceUntilIdle()

        viewModel.searchUsers("Al")
        advanceTimeBy(300)
        viewModel.searchUsers("Alice")
        advanceTimeBy(300)
        advanceUntilIdle()
        oldResponse.complete(Response.success(ApiEnvelope(data = listOf(SafeUserDto(id = "old", fullName = "Old result")))))
        advanceUntilIdle()

        assertEquals("Alice New", viewModel.uiState.value.userSearchResults.single().fullName)
    }

    @Test
    fun `conversation lists deduplicate repeated server rows without changing server order`() {
        val items = listOf(conversation("recent"), conversation("other"), conversation("recent", name = "duplicate"))

        assertEquals(listOf("recent", "other"), deduplicateConversations(items).map { it.id })
        assertEquals("Friend recent", deduplicateConversations(items).first().user?.fullName)
    }

    @Test
    fun `local conversation search matches names only`() {
        val items = listOf(
            conversation("c1", peerId = "a", name = "Alice"),
            conversation("c2", peerId = "b", name = "Bob").copy(lastMessage = "Alice's private message"),
        )

        assertEquals(listOf("c1"), filterConversations(items, "  alICe ").map { it.id })
        assertEquals(emptyList<ConversationDto>(), filterConversations(items, "private message"))
        assertEquals(items, filterConversations(items, " "))
    }

    @Test
    fun `socket message refreshes authoritative list without duplicate rows`() = runTest {
        val api = FakeMessagesApi(listOf(conversation("c1"), conversation("c1", name = "duplicate"), conversation("c2")))
        val viewModel = newViewModel(api, FakeUsersApi())
        advanceUntilIdle()

        viewModel.handleNewMessage(MessageDto(id = "m1", conversationId = "c1", createdAt = "now", senderId = "peer"))
        advanceUntilIdle()

        assertEquals(2, api.conversationLoadCount)
        assertEquals(listOf("c1", "c2"), viewModel.uiState.value.conversations.map { it.id })
    }

    @Test
    fun `conversation load failure can be retried`() = runTest {
        val api = FakeMessagesApi(null)
        val viewModel = newViewModel(api, FakeUsersApi())
        advanceUntilIdle()
        assertEquals("Conversations are unavailable.", viewModel.uiState.value.error)

        api.conversations = listOf(conversation("recovered"))
        viewModel.retry()
        advanceUntilIdle()

        assertEquals(null, viewModel.uiState.value.error)
        assertEquals("recovered", viewModel.uiState.value.conversations.single().id)
    }

    @Test
    fun `archive and report actions call server and remove rows only after archive succeeds`() = runTest {
        val api = FakeMessagesApi(listOf(conversation("c1")))
        val viewModel = newViewModel(api, FakeUsersApi())
        advanceUntilIdle()

        viewModel.performAction(viewModel.uiState.value.conversations.single(), ConversationListAction.ARCHIVE)
        viewModel.performAction(viewModel.uiState.value.conversations.single(), ConversationListAction.ARCHIVE)
        advanceUntilIdle()
        assertEquals(1, api.archiveCount)
        assertTrue(viewModel.uiState.value.conversations.isEmpty())

        val reportList = listOf(conversation("c2"))
        api.conversations = reportList
        viewModel.retry()
        advanceUntilIdle()
        viewModel.performAction(viewModel.uiState.value.conversations.single(), ConversationListAction.REPORT, "spam")
        viewModel.performAction(viewModel.uiState.value.conversations.single(), ConversationListAction.REPORT, "spam")
        advanceUntilIdle()

        assertEquals(1, api.reportApi.createCount)
    }

    @Test
    fun `new conversation API failure can be retried without leaving a stuck opening state`() = runTest {
        val api = FakeMessagesApi(emptyList()).apply { createShouldFail = true }
        val viewModel = newViewModel(api, FakeUsersApi())
        advanceUntilIdle()
        val user = SafeUserDto(id = "alice-id", fullName = "Alice")

        viewModel.openUserConversation(user)
        advanceUntilIdle()
        assertEquals(emptySet<String>(), viewModel.uiState.value.openingUserIds)
        assertEquals("Could not open conversation.", viewModel.uiState.value.userSearchError)

        api.createShouldFail = false
        viewModel.openUserConversation(user)
        advanceUntilIdle()
        assertEquals(2, api.createConversationCount)
        assertEquals(null, viewModel.uiState.value.userSearchError)
    }

    @Test
    fun `archive failure leaves conversation visible and reports the server error`() = runTest {
        val api = FakeMessagesApi(listOf(conversation("c1"))).apply { archiveShouldFail = true }
        val viewModel = newViewModel(api, FakeUsersApi())
        advanceUntilIdle()

        viewModel.performAction(viewModel.uiState.value.conversations.single(), ConversationListAction.ARCHIVE)
        advanceUntilIdle()

        assertEquals("c1", viewModel.uiState.value.conversations.single().id)
        assertEquals("Action failed.", viewModel.uiState.value.actionError)

        api.archiveShouldFail = false
        viewModel.performAction(viewModel.uiState.value.conversations.single(), ConversationListAction.ARCHIVE)
        advanceUntilIdle()
        assertTrue(viewModel.uiState.value.conversations.isEmpty())
    }

    @Test
    fun `archive filter uses server archived query`() = runTest {
        val api = FakeMessagesApi(listOf(conversation("c1")))
        val viewModel = newViewModel(api, FakeUsersApi())
        advanceUntilIdle()

        viewModel.setShowingArchived(true)
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value.showingArchived)
        assertTrue(api.lastArchiveFilter)
    }

    @Test
    fun `block action is guarded against repeated taps and does not fake removal`() = runTest {
        val api = FakeMessagesApi(listOf(conversation("c1")))
        val viewModel = newViewModel(api, FakeUsersApi())
        advanceUntilIdle()
        val target = viewModel.uiState.value.conversations.single()

        viewModel.performAction(target, ConversationListAction.BLOCK)
        viewModel.performAction(target, ConversationListAction.BLOCK)
        advanceUntilIdle()

        assertEquals(1, api.friendsApi.blockCount)
        assertEquals("c1", viewModel.uiState.value.conversations.single().id)
    }

    private fun newViewModel(api: FakeMessagesApi, usersApi: UsersApi) = ConversationsViewModel(
        MessagesRepository(api, usersApi, api.friendsApi, api.reportsApi),
        SocketManager("http://localhost"),
    )

    private open class FakeMessagesApi(var conversations: List<ConversationDto>?) : MessagesApi {
        val friendsApi = FakeFriendsApi()
        val reportsApi = FakeReportsApi()
        val reportApi get() = reportsApi
        var createConversationCount = 0
        var conversationLoadCount = 0
        var archiveCount = 0
        var lastArchiveFilter = false
        var archiveShouldFail = false
        var createShouldFail = false

        override suspend fun getConversations(archived: Boolean): Response<ApiEnvelope<List<ConversationDto>>> {
            lastArchiveFilter = archived
            conversationLoadCount += 1
            return if (conversations != null) {
                Response.success(ApiEnvelope(data = conversations))
            } else {
                val body = "{\"error\":{\"code\":\"SERVER_ERROR\",\"message\":\"Conversations are unavailable.\"}}"
                    .toResponseBody("application/json".toMediaType())
                Response.error(500, body)
            }
        }

        override suspend fun getConversation(conversationId: String) = notUsed()
        override suspend fun createOrOpenConversation(body: CreateConversationRequest): Response<ApiEnvelope<ConversationDto>> {
            createConversationCount += 1
            return if (createShouldFail) {
                Response.error(
                    500,
                    "{\"error\":{\"code\":\"SERVER_ERROR\",\"message\":\"Could not open conversation.\"}}"
                        .toResponseBody("application/json".toMediaType()),
                )
            } else {
                Response.success(ApiEnvelope(data = ConversationDto(id = "created-id")))
            }
        }
        override suspend fun deleteConversation(conversationId: String) = Response.success(ApiEnvelope(data = ConversationActionResponse(conversationId)))
        override suspend fun archiveConversation(conversationId: String): Response<ApiEnvelope<ConversationActionResponse>> {
            archiveCount += 1
            return if (archiveShouldFail) {
                Response.error(
                    500,
                    "{\"error\":{\"code\":\"SERVER_ERROR\",\"message\":\"Action failed.\"}}"
                        .toResponseBody("application/json".toMediaType()),
                )
            } else {
                Response.success(ApiEnvelope(data = ConversationActionResponse(conversationId, true)))
            }
        }
        override suspend fun unarchiveConversation(conversationId: String) = Response.success(ApiEnvelope(data = ConversationActionResponse(conversationId, false)))
        override suspend fun getNotificationPreviewMessage(conversationId: String, messageId: String) = notUsed()
        override suspend fun getMessages(conversationId: String) = notUsed()
        override suspend fun sendMessage(conversationId: String, body: com.kothabarta.core.network.messages.SendMessageRequest) = notUsed()
        override suspend fun sendAttachment(conversationId: String, file: MultipartBody.Part) = notUsed()
        override suspend fun unsendMessage(conversationId: String, messageId: String) = notUsed()
        override suspend fun deleteForMe(conversationId: String, messageId: String) = notUsed()
        override suspend fun reactToMessage(conversationId: String, messageId: String, body: ReactionRequest) = notUsed()
        private fun notUsed(): Nothing = error("not used by ConversationsViewModelTest")
    }

    private class FakeUsersApi(
        private val search: suspend (String) -> Response<ApiEnvelope<List<SafeUserDto>>> = {
            Response.success(ApiEnvelope(data = listOf(SafeUserDto(id = "alice-id", fullName = "Alice"))))
        },
    ) : UsersApi {
        var searchCount = 0
        val results = listOf(SafeUserDto(id = "alice-id", fullName = "Alice"))

        override suspend fun registerDevicePublicKey(request: DevicePublicKeyRegistrationRequest): Response<ApiEnvelope<DevicePublicKeyRegistrationResponse>> = notUsed()
        override suspend fun searchUsers(query: String): Response<ApiEnvelope<List<SafeUserDto>>> {
            searchCount += 1
            return search(query)
        }
        override suspend fun getUser(userId: String): Response<ApiEnvelope<ProfileUserDto>> = notUsed()
        override suspend fun getUserPosts(userId: String): Response<ApiEnvelope<List<PostDto>>> = notUsed()
        override suspend fun getUserPhotos(userId: String): Response<ApiEnvelope<List<com.kothabarta.core.network.social.PhotoDto>>> = notUsed()
        private fun notUsed(): Nothing = error("not used by FakeUsersApi")
    }

    private class FakeFriendsApi : FriendsApi {
        var blockCount = 0
        override suspend fun getFriends(tab: String): Response<ApiEnvelope<List<SafeUserDto>>> = notUsed()
        override suspend fun getFriendEntries(tab: String): Response<ApiEnvelope<List<FriendEntryDto>>> = notUsed()
        override suspend fun sendFriendRequest(body: com.kothabarta.core.network.social.SendFriendRequestBody): Response<ApiEnvelope<FriendRequestCreated>> = notUsed()
        override suspend fun cancelFriendRequest(receiverId: String): Response<ApiEnvelope<com.kothabarta.core.network.social.CancelledResponse>> = notUsed()
        override suspend fun acceptFriendRequest(requestId: String): Response<ApiEnvelope<com.kothabarta.core.network.social.AcceptedResponse>> = notUsed()
        override suspend fun unfriend(userId: String): Response<ApiEnvelope<com.kothabarta.core.network.social.UnfriendedResponse>> = notUsed()
        override suspend fun block(userId: String): Response<ApiEnvelope<BlockedResponse>> {
            blockCount += 1
            return Response.success(ApiEnvelope(data = BlockedResponse(true)))
        }
        private fun notUsed(): Nothing = error("not used by FakeFriendsApi")
    }

    private class FakeReportsApi : ReportsApi {
        var createCount = 0
        override suspend fun createReport(body: CreateReportBody): Response<ApiEnvelope<ReportCreatedDto>> {
            createCount += 1
            assertEquals("user", body.targetType)
            return Response.success(ApiEnvelope(data = ReportCreatedDto("report-id", "pending")))
        }
    }
}
