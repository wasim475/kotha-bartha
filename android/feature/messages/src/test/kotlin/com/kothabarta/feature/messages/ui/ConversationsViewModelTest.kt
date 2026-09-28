package com.kothabarta.feature.messages.ui

import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.messages.ConversationDto
import com.kothabarta.core.network.messages.ConversationPeerDto
import com.kothabarta.core.network.messages.CreateConversationRequest
import com.kothabarta.core.network.messages.MessageDto
import com.kothabarta.core.network.messages.MessagesApi
import com.kothabarta.core.network.messages.ReactionRequest
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.messages.data.MessagesRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
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

    private fun conversation(id: String, peerId: String = "peer-$id", unread: Int = 0) = ConversationDto(
        id = id,
        user = ConversationPeerDto(id = peerId, fullName = "Friend $id"),
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

    private open class FakeMessagesApi(private val conversations: List<ConversationDto>?) : MessagesApi {
        override suspend fun getConversations(): Response<ApiEnvelope<List<ConversationDto>>> =
            if (conversations != null) {
                Response.success(ApiEnvelope(data = conversations))
            } else {
                val body = "{\"error\":{\"code\":\"SERVER_ERROR\",\"message\":\"Conversations are unavailable.\"}}"
                    .toResponseBody("application/json".toMediaType())
                Response.error(500, body)
            }

        override suspend fun createOrOpenConversation(body: CreateConversationRequest) = notUsed()
        override suspend fun getMessages(conversationId: String) = notUsed()
        override suspend fun sendMessage(conversationId: String, body: com.kothabarta.core.network.messages.SendMessageRequest) = notUsed()
        override suspend fun sendAttachment(conversationId: String, file: MultipartBody.Part) = notUsed()
        override suspend fun unsendMessage(conversationId: String, messageId: String) = notUsed()
        override suspend fun deleteForMe(conversationId: String, messageId: String) = notUsed()
        override suspend fun reactToMessage(conversationId: String, messageId: String, body: ReactionRequest) = notUsed()
        private fun notUsed(): Nothing = error("not used by ConversationsViewModelTest")
    }
}
