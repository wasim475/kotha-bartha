package com.kothabarta.core.network.social

import com.kothabarta.core.network.ApiEnvelope
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path

interface StoriesApi {
    @GET("stories")
    suspend fun getStories(): Response<ApiEnvelope<List<StoryGroupDto>>>

    @POST("stories")
    suspend fun createTextStory(@Body body: CreateStoryBody): Response<ApiEnvelope<StoryDto>>

    @Multipart
    @POST("stories")
    suspend fun createImageStory(
        @Part("type") type: RequestBody,
        @Part("text") text: RequestBody,
        @Part file: MultipartBody.Part,
    ): Response<ApiEnvelope<StoryDto>>

    @DELETE("stories/{storyId}")
    suspend fun deleteStory(@Path("storyId") storyId: String): Response<ApiEnvelope<DeletedResponse>>
}
