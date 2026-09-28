package com.kothabarta.core.network.social

import com.kothabarta.core.network.ApiEnvelope
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

/** `/api/v1/posts/*` — see docs/architecture/android-api-contract.md's "Feed / Posts". */
interface PostsApi {

    @GET("posts/feed")
    suspend fun getFeed(): Response<ApiEnvelope<List<PostDto>>>

    @GET("posts/{postId}")
    suspend fun getPost(@Path("postId") postId: String): Response<ApiEnvelope<PostDto>>

    @POST("posts/feed/read")
    suspend fun markFeedRead(): Response<ApiEnvelope<FeedReadResponse>>

    @PUT("posts/{postId}/reaction")
    suspend fun reactToPost(
        @Path("postId") postId: String,
        @Body body: ReactionRequest,
    ): Response<ApiEnvelope<ReactionResponse>>
}
