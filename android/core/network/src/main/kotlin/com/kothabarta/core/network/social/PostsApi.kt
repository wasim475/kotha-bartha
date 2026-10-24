package com.kothabarta.core.network.social

import okhttp3.MultipartBody
import okhttp3.RequestBody
import com.kothabarta.core.network.ApiEnvelope
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.PATCH
import retrofit2.http.Part
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/** `/api/v1/posts` — see docs/architecture/android-api-contract.md's "Feed / Posts". */
interface PostsApi {

    @GET("posts/feed")
    suspend fun getFeed(@Query("before") before: String? = null): Response<ApiEnvelope<List<PostDto>>>

    @GET("posts/{postId}")
    suspend fun getPost(@Path("postId") postId: String): Response<ApiEnvelope<PostDto>>

    @POST("posts/feed/read")
    suspend fun markFeedRead(): Response<ApiEnvelope<FeedReadResponse>>

    @PUT("posts/{postId}/reaction")
    suspend fun reactToPost(
        @Path("postId") postId: String,
        @Body body: ReactionRequest,
    ): Response<ApiEnvelope<ReactionResponse>>

    @Multipart
    @POST("posts")
    suspend fun createPost(
        @Part("body") body: RequestBody,
        @Part files: List<MultipartBody.Part>,
    ): Response<ApiEnvelope<PostDto>>

    @PATCH("posts/{postId}")
    suspend fun editPost(@Path("postId") postId: String, @Body body: EditPostBody): Response<ApiEnvelope<PostDto>>

    @DELETE("posts/{postId}")
    suspend fun deletePost(@Path("postId") postId: String): Response<ApiEnvelope<DeletedResponse>>
}
