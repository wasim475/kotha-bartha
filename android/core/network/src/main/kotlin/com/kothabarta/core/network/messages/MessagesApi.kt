package com.kothabarta.core.network.messages

import com.kothabarta.core.network.ApiEnvelope
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

/** 1:1-conversation endpoints under "api v1 conversations" — see docs/architecture/android-api-contract.md's Messages section. */
interface MessagesApi {

    @GET("conversations")
    suspend fun getConversations(): Response<ApiEnvelope<List<ConversationDto>>>

    @POST("conversations")
    suspend fun createOrOpenConversation(@Body body: CreateConversationRequest): Response<ApiEnvelope<ConversationDto>>

    @GET("conversations/{conversationId}/messages")
    suspend fun getMessages(@Path("conversationId") conversationId: String): Response<ApiEnvelope<List<MessageDto>>>

    @POST("conversations/{conversationId}/messages")
    suspend fun sendMessage(
        @Path("conversationId") conversationId: String,
        @Body body: SendMessageRequest,
    ): Response<ApiEnvelope<MessageDto>>

    @Multipart
    @POST("conversations/{conversationId}/attachments")
    suspend fun sendAttachment(
        @Path("conversationId") conversationId: String,
        @Part file: MultipartBody.Part,
    ): Response<ApiEnvelope<MessageDto>>

    @DELETE("conversations/{conversationId}/messages/{messageId}")
    suspend fun unsendMessage(
        @Path("conversationId") conversationId: String,
        @Path("messageId") messageId: String,
    ): Response<ApiEnvelope<DeletedResponse>>

    @POST("conversations/{conversationId}/messages/{messageId}/delete-for-me")
    suspend fun deleteForMe(
        @Path("conversationId") conversationId: String,
        @Path("messageId") messageId: String,
    ): Response<ApiEnvelope<DeletedResponse>>

    @PUT("conversations/{conversationId}/messages/{messageId}/reaction")
    suspend fun reactToMessage(
        @Path("conversationId") conversationId: String,
        @Path("messageId") messageId: String,
        @Body body: ReactionRequest,
    ): Response<ApiEnvelope<ReactionUpdateDto>>
}
