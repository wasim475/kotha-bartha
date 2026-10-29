package com.kothabarta.feature.messages.data

import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.common.ApiError
import com.kothabarta.core.common.map
import com.kothabarta.core.network.safeApiCall
import com.kothabarta.core.network.messages.ChatTarget
import com.kothabarta.core.network.messages.ConversationActionResponse
import com.kothabarta.core.network.messages.ConversationDto
import com.kothabarta.core.network.messages.ConversationLauncher
import com.kothabarta.core.network.messages.CreateConversationRequest
import com.kothabarta.core.network.messages.DeletedResponse
import com.kothabarta.core.network.messages.MessageDto
import com.kothabarta.core.network.messages.MessagesApi
import com.kothabarta.core.network.messages.ReactionRequest
import com.kothabarta.core.network.messages.ReactionUpdateDto
import com.kothabarta.core.network.messages.SendMessageRequest
import com.kothabarta.core.network.social.BlockedResponse
import com.kothabarta.core.network.social.CreateReportBody
import com.kothabarta.core.network.social.FriendsApi
import com.kothabarta.core.network.social.ReportCreatedDto
import com.kothabarta.core.network.social.ReportsApi
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.network.social.UsersApi
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody

class MessagesRepository(
    private val messagesApi: MessagesApi,
    private val usersApi: UsersApi? = null,
    private val friendsApi: FriendsApi? = null,
    private val reportsApi: ReportsApi? = null,
) : ConversationLauncher {

    suspend fun getConversations(archived: Boolean = false): ApiResult<List<ConversationDto>> =
        safeApiCall { messagesApi.getConversations(archived) }

    suspend fun searchUsers(query: String): ApiResult<List<SafeUserDto>> =
        usersApi?.let { safeApiCall { it.searchUsers(query) } } ?: missingApi()

    suspend fun archiveConversation(conversationId: String): ApiResult<ConversationActionResponse> =
        safeApiCall { messagesApi.archiveConversation(conversationId) }

    suspend fun unarchiveConversation(conversationId: String): ApiResult<ConversationActionResponse> =
        safeApiCall { messagesApi.unarchiveConversation(conversationId) }

    suspend fun deleteConversation(conversationId: String): ApiResult<ConversationActionResponse> =
        safeApiCall { messagesApi.deleteConversation(conversationId) }

    suspend fun blockUser(userId: String): ApiResult<BlockedResponse> =
        friendsApi?.let { safeApiCall { it.block(userId) } } ?: missingApi()

    suspend fun reportUser(userId: String, reason: String, description: String?): ApiResult<ReportCreatedDto> =
        reportsApi?.let {
            safeApiCall {
                it.createReport(
                    CreateReportBody(targetType = "user", targetId = userId, reason = reason, description = description),
                )
            }
        } ?: missingApi()

    override suspend fun openConversationWith(userId: String): ApiResult<ChatTarget> =
        safeApiCall { messagesApi.createOrOpenConversation(CreateConversationRequest(userId)) }.map { conversation ->
            ChatTarget(
                conversationId = conversation.id,
                peerId = conversation.user?.id,
                peerName = conversation.user?.fullName,
                peerAvatarUrl = conversation.user?.avatar?.secureUrl,
                peerLastSeenAt = conversation.user?.lastSeenAt,
                peerIsOnline = conversation.user?.isOnline == true,
            )
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

    private fun <T> missingApi(): ApiResult<T> =
        ApiResult.Failure(ApiError("FEATURE_UNAVAILABLE", "This messaging action is unavailable."))
}
