package com.kothabarta.core.network

import com.kothabarta.core.common.ApiError
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.network.auth.UserDto
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import java.io.IOException
import retrofit2.Response

/**
 * One shared Moshi instance for the whole app — also used outside this file
 * to decode Socket.IO event payloads (raw JSON strings) into the same DTOs
 * this module already defines, so a notification/friend-request/etc. arriving
 * over the socket parses identically to the same shape arriving over REST.
 */
object NetworkJson {
    val moshi: Moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
}

/**
 * Every repository's only way to call the network — wraps a Retrofit call
 * returning `Response<ApiEnvelope<T>>` and turns it into the app-wide
 * [ApiResult], so no feature module ever touches Retrofit's `Response`,
 * `HttpException`, or `IOException` directly.
 */
suspend fun <T> safeApiCall(block: suspend () -> Response<ApiEnvelope<T>>): ApiResult<T> =
    runCatchingApiCall(block) { envelope, code ->
        val data = envelope.data
        if (data != null) ApiResult.Success(data)
        else ApiResult.Failure(ApiError("EMPTY_RESPONSE", "The server returned no data.", code))
    }

/**
 * Like [safeApiCall], but for the handful of endpoints where the caller
 * genuinely needs `meta` too (e.g. `GET /users/:id/posts`'s `meta.restricted`
 * — see docs/architecture/android-api-contract.md). Most calls don't need
 * this; reach for [safeApiCall] first.
 */
suspend fun <T> safeApiCallWithMeta(block: suspend () -> Response<ApiEnvelope<T>>): ApiResult<DataWithMeta<T>> =
    runCatchingApiCall(block) { envelope, code ->
        val data = envelope.data
        if (data != null) ApiResult.Success(DataWithMeta(data, envelope.meta))
        else ApiResult.Failure(ApiError("EMPTY_RESPONSE", "The server returned no data.", code))
    }

data class DataWithMeta<T>(val data: T, val meta: ApiMeta?)

/**
 * Only `/auth/{register,login,google}` return both `data` (the user) and a
 * sibling `token` — see [ApiEnvelope] and
 * docs/architecture/android-implementation-plan.md section D. A response
 * missing either half is treated as a failure: a session Android can't
 * actually use is not a success.
 */
suspend fun safeAuthCall(block: suspend () -> Response<ApiEnvelope<UserDto>>): ApiResult<AuthSession> =
    runCatchingApiCall(block) { envelope, code ->
        val user = envelope.data
        val token = envelope.token
        if (user != null && token != null) ApiResult.Success(AuthSession(user, token))
        else ApiResult.Failure(ApiError("EMPTY_RESPONSE", "The server returned an incomplete session.", code))
    }

data class AuthSession(val user: UserDto, val token: String)

private suspend inline fun <T, R> runCatchingApiCall(
    block: suspend () -> Response<ApiEnvelope<T>>,
    onSuccess: (ApiEnvelope<T>, Int) -> ApiResult<R>,
): ApiResult<R> {
    return try {
        val response = block()
        if (response.isSuccessful) {
            val envelope = response.body()
            if (envelope != null) onSuccess(envelope, response.code())
            else ApiResult.Failure(ApiError("EMPTY_RESPONSE", "The server returned no data.", response.code()))
        } else {
            ApiResult.Failure(parseError(response))
        }
    } catch (error: IOException) {
        ApiResult.Failure(ApiError("NETWORK_ERROR", "Check your connection and try again."))
    } catch (error: Exception) {
        ApiResult.Failure(ApiError("UNKNOWN_ERROR", error.message ?: "Something went wrong."))
    }
}

private fun parseError(response: Response<*>): ApiError {
    val body = response.errorBody()?.string()
    val parsed = body?.let { runCatching { NetworkJson.moshi.adapter(ApiErrorEnvelope::class.java).fromJson(it) }.getOrNull() }?.error
    return if (parsed != null) {
        ApiError(parsed.code, parsed.message, response.code())
    } else {
        ApiError("HTTP_${response.code()}", "Something went wrong.", response.code())
    }
}
