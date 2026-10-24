package com.kothabarta.core.network.social

import com.kothabarta.core.network.ApiEnvelope
import retrofit2.http.Body
import retrofit2.http.PATCH
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

/** `/api/v1/users` — see docs/architecture/android-api-contract.md's "Users / Profile". */
interface UsersApi {

    @PATCH("users/me/public-key")
    suspend fun registerDevicePublicKey(
        @Body request: DevicePublicKeyRegistrationRequest,
    ): Response<ApiEnvelope<DevicePublicKeyRegistrationResponse>>

    @GET("users/search")
    suspend fun searchUsers(@Query("q") query: String): Response<ApiEnvelope<List<SafeUserDto>>>

    @GET("users/{userId}")
    suspend fun getUser(@Path("userId") userId: String): Response<ApiEnvelope<ProfileUserDto>>

    @GET("users/{userId}/posts")
    suspend fun getUserPosts(@Path("userId") userId: String): Response<ApiEnvelope<List<PostDto>>>

    @GET("users/{userId}/photos")
    suspend fun getUserPhotos(@Path("userId") userId: String): Response<ApiEnvelope<List<PhotoDto>>>
}

data class DevicePublicKeyRegistrationRequest(
    val deviceId: String,
    val publicKey: String,
)

data class DevicePublicKeyRegistrationResponse(
    val deviceId: String,
    val publicKeys: List<DevicePublicKeyDto> = emptyList(),
)

data class DevicePublicKeyDto(
    val deviceId: String,
    val jwk: String,
)
