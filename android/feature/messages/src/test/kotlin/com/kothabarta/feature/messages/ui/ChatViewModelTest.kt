package com.kothabarta.feature.messages.ui

import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.auth.AuthApi
import com.kothabarta.core.network.auth.GoogleLoginRequest
import com.kothabarta.core.network.auth.LoginRequest
import com.kothabarta.core.network.auth.RegisterRequest
import com.kothabarta.core.network.auth.UserDto
import com.kothabarta.core.network.messages.ConversationDto
import com.kothabarta.core.network.messages.CreateConversationRequest
import com.kothabarta.core.network.messages.MessageDto
import com.kothabarta.core.network.messages.MessagesApi
import com.kothabarta.core.network.messages.ReactionRequest
import com.kothabarta.core.network.messages.SendMessageRequest
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.messages.data.MessagesRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class ChatViewModelTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun newViewModel(api: FakeMessagesApi) = ChatViewModel(
        conversationId = "conv-1",
        peerId = "peer-1",
        peerName = "Peer",
        peerAvatarUrl = null,
        repository = MessagesRepository(api),
        authApi = FakeAuthApi(),
        socketManager = SocketManager("http://localhost"),
    )

    @Test
    fun `initial load populates history and resolves my own user id`() = runTest {
        val api = FakeMessagesApi(history = listOf(historyMessage("m1"), historyMessage("m2")))
        val viewModel = newViewModel(api)
        advanceUntilIdle()

        assertEquals(listOf("m1", "m2"), viewModel.uiState.value.messages.map { it.id })
        assertEquals("me", viewModel.uiState.value.myUserId)
    }

    @Test
    fun `sending appends an optimistic message immediately, then replaces it with the server's on success`() = runTest {
        val api = FakeMessagesApi(history = emptyList())
        val viewModel = newViewModel(api)
        advanceUntilIdle()

        viewModel.onComposerTextChange("hello")
        viewModel.sendText()

        // Before the network call resolves, the optimistic message is already visible and marked pending —
        // it is never assumed sent until the server confirms it.
        val optimisticState = viewModel.uiState.value
        assertEquals(1, optimisticState.messages.size)
        assertTrue(optimisticState.messages.first().id in optimisticState.pendingIds)
        assertTrue(optimisticState.composerText.isEmpty())

        advanceUntilIdle()

        val finalState = viewModel.uiState.value
        assertEquals(1, finalState.messages.size)
        assertEquals("server-id-1", finalState.messages.first().id)
        assertTrue(finalState.pendingIds.isEmpty())
        assertEquals("hello", api.lastSentBody)
    }

    @Test
    fun `a blank message is never sent`() = runTest {
        val api = FakeMessagesApi(history = emptyList())
        val viewModel = newViewModel(api)
        advanceUntilIdle()

        viewModel.onComposerTextChange("   ")
        viewModel.sendText()
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value.messages.isEmpty())
        assertEquals(null, api.lastSentBody)
    }

    @Test
    fun `a failed send moves the message from pending to failed and can be retried`() = runTest {
        val api = FakeMessagesApi(history = emptyList(), sendShouldFail = true)
        val viewModel = newViewModel(api)
        advanceUntilIdle()

        viewModel.onComposerTextChange("hello")
        viewModel.sendText()
        advanceUntilIdle()

        val failedState = viewModel.uiState.value
        val tempId = failedState.messages.first().id
        assertTrue(tempId in failedState.failedIds)
        assertFalse(tempId in failedState.pendingIds)

        api.sendShouldFail = false
        viewModel.retrySend(tempId)
        advanceUntilIdle()

        val retriedState = viewModel.uiState.value
        assertEquals("server-id-1", retriedState.messages.first().id)
        assertTrue(retriedState.failedIds.isEmpty())
    }

    @Test
    fun `discarding a failed message removes it from the thread`() = runTest {
        val api = FakeMessagesApi(history = emptyList(), sendShouldFail = true)
        val viewModel = newViewModel(api)
        advanceUntilIdle()
        viewModel.onComposerTextChange("hello")
        viewModel.sendText()
        advanceUntilIdle()

        val tempId = viewModel.uiState.value.messages.first().id
        viewModel.discardFailed(tempId)

        assertTrue(viewModel.uiState.value.messages.isEmpty())
    }

    @Test
    fun `an incoming message is never appended twice, even if the same event fires again`() = runTest {
        val api = FakeMessagesApi(history = emptyList())
        val viewModel = newViewModel(api)
        advanceUntilIdle()

        val incoming = MessageDto(id = "socket-1", conversationId = "conv-1", body = "hi", createdAt = "now", senderId = "peer-1")
        viewModel.appendIncoming(incoming)
        viewModel.appendIncoming(incoming)

        assertEquals(1, viewModel.uiState.value.messages.count { it.id == "socket-1" })
    }

    private fun historyMessage(id: String) = MessageDto(id = id, body = "hi", createdAt = "now", senderId = "peer-1")

    private class FakeAuthApi : AuthApi {
        override suspend fun register(body: RegisterRequest) = notUsed()
        override suspend fun login(body: LoginRequest) = notUsed()
        override suspend fun google(body: GoogleLoginRequest) = notUsed()
        override suspend fun me(): Response<ApiEnvelope<UserDto>> =
            Response.success(ApiEnvelope(data = UserDto(id = "me", fullName = "Me", email = "me@x.com", role = "user")))
        override suspend fun logout() = notUsed()
        private fun notUsed(): Nothing = error("not used by ChatViewModelTest")
    }

    private class FakeMessagesApi(
        private val history: List<MessageDto>,
        var sendShouldFail: Boolean = false,
    ) : MessagesApi {
        var lastSentBody: String? = null

        override suspend fun getConversations() = notUsed()
        override suspend fun createOrOpenConversation(body: CreateConversationRequest) = notUsed()

        override suspend fun getMessages(conversationId: String): Response<ApiEnvelope<List<MessageDto>>> =
            Response.success(ApiEnvelope(data = history))

        override suspend fun sendMessage(conversationId: String, body: SendMessageRequest): Response<ApiEnvelope<MessageDto>> {
            lastSentBody = body.body
            return if (!sendShouldFail) {
                Response.success(ApiEnvelope(data = MessageDto(id = "server-id-1", conversationId = conversationId, body = body.body, createdAt = "now", senderId = "me", status = "sent")))
            } else {
                val errorBody = "{\"error\":{\"code\":\"NETWORK\",\"message\":\"Could not send.\"}}".toResponseBody("application/json".toMediaType())
                Response.error(500, errorBody)
            }
        }

        override suspend fun sendAttachment(conversationId: String, file: MultipartBody.Part) = notUsed()
        override suspend fun unsendMessage(conversationId: String, messageId: String) = notUsed()
        override suspend fun deleteForMe(conversationId: String, messageId: String) = notUsed()
        override suspend fun reactToMessage(conversationId: String, messageId: String, body: ReactionRequest) = notUsed()
        private fun notUsed(): Nothing = error("not used by ChatViewModelTest")
    }
}
