package com.kothabarta.core.network.social

import com.kothabarta.core.network.ApiEnvelope
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

interface CommentsApi {
    @GET("posts/{postId}/comments")
    suspend fun getComments(@Path("postId") postId: String): Response<ApiEnvelope<List<CommentDto>>>

    @POST("posts/{postId}/comments")
    suspend fun createComment(@Path("postId") postId: String, @Body body: CreateCommentBody): Response<ApiEnvelope<CommentDto>>

    @PUT("comments/{commentId}/reaction")
    suspend fun reactToComment(@Path("commentId") commentId: String, @Body body: ReactionRequest): Response<ApiEnvelope<ReactionResponse>>
}
