package com.kothabarta.feature.messages.data

import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.common.map
import com.kothabarta.core.network.safeApiCall
import com.kothabarta.core.network.messages.ChatTarget
import com.kothabarta.core.network.messages.ConversationDto
import com.kothabarta.core.network.messages.ConversationLauncher
import com.kothabarta.core.network.messages.CreateConversationRequest
import com.kothabarta.core.network.messages.DeletedResponse
import com.kothabarta.core.network.messages.MessageDto
import com.kothabarta.core.network.messages.MessagesApi
import com.kothabarta.core.network.messages.ReactionRequest
import com.kothabarta.core.network.messages.ReactionUpdateDto
import com.kothabarta.core.network.messages.SendMessageRequest
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody

class MessagesRepository(private val messagesApi: MessagesApi) : ConversationLauncher {

    suspend fun getConversations(): ApiResult<List<ConversationDto>> = safeApiCall { messagesApi.getConversations() }

    override suspend fun openConversationWith(userId: String): ApiResult<ChatTarget> =
        safeApiCall { messagesApi.createOrOpenConversation(CreateConversationRequest(userId)) }.map { conversation ->
            ChatTarget(conversation.id, conversation.user?.id, conversation.user?.fullName, conversation.user?.avatar?.secureUrl)
        }

    /** Full history every time — the server has no cursor pagination for this endpoint (see android-api-contract.md). */
    suspend fun getMessages(conversationId: String): ApiResult<List<MessageDto>> =
        safeApiCall { messagesApi.getMessages(conversationId) }

    suspend fun sendMessage(conversationId: String, body: String, replyTo: String?): ApiResult<MessageDto> =
        safeApiCall { messagesApi.sendMessage(conversationId, SendMessageRequest(body, replyTo)) }

    suspend fun sendAttachment(
        conversationId: String,
        bytes: ByteArray,
        fileName: String,
        mimeType: String,
    ): ApiResult<MessageDto> {
        val requestBody = bytes.toRequestBody(mimeType.toMediaTypeOrNull())
        val part = MultipartBody.Part.createFormData("file", fileName, requestBody)
        return safeApiCall { messagesApi.sendAttachment(conversationId, part) }
    }

    suspend fun unsendMessage(conversationId: String, messageId: String): ApiResult<DeletedResponse> =
        safeApiCall { messagesApi.unsendMessage(conversationId, messageId) }

    suspend fun deleteForMe(conversationId: String, messageId: String): ApiResult<DeletedResponse> =
        safeApiCall { messagesApi.deleteForMe(conversationId, messageId) }

    /** `null`/repeating the same emoji removes the viewer's reaction — same toggle rule as posts/comments. */
    suspend fun react(conversationId: String, messageId: String, emoji: String?): ApiResult<ReactionUpdateDto> =
        safeApiCall { messagesApi.reactToMessage(conversationId, messageId, ReactionRequest(emoji)) }
}
