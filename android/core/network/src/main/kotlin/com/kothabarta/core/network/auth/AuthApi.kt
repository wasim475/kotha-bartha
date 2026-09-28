package com.kothabarta.core.network.auth

import com.kothabarta.core.network.ApiEnvelope
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

/**
 * `/api/v1/auth` — see docs/architecture/android-api-contract.md's "Auth"
 * section. `register`/`login`/`google` return `token` as a sibling of `data`
 * (docs/architecture/android-implementation-plan.md, section D); `me` and
 * `logout` don't need it.
 */
interface AuthApi {

    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): Response<ApiEnvelope<UserDto>>

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): Response<ApiEnvelope<UserDto>>

    @POST("auth/google")
    suspend fun google(@Body body: GoogleLoginRequest): Response<ApiEnvelope<UserDto>>

    @GET("auth/me")
    suspend fun me(): Response<ApiEnvelope<UserDto>>

    @POST("auth/logout")
    suspend fun logout(): Response<ApiEnvelope<LogoutResponse>>
}
