package com.kothabarta.core.common

/**
 * Mirrors the server's own response envelope (`{ "data": ... }` /
 * `{ "error": { "code", "message" } }`, see
 * docs/architecture/android-api-contract.md) so every repository across every
 * feature module returns the same shape instead of each inventing its own.
 */
sealed interface ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>
    data class Failure(val error: ApiError) : ApiResult<Nothing>
}

/**
 * `code` is the stable identifier the server returns (e.g. "ACCOUNT_MUTED",
 * "UNAUTHENTICATED") — callers should switch on this, never parse `message`.
 */
data class ApiError(
    val code: String,
    val message: String,
    val httpStatus: Int? = null,
)

inline fun <T, R> ApiResult<T>.map(transform: (T) -> R): ApiResult<R> = when (this) {
    is ApiResult.Success -> ApiResult.Success(transform(data))
    is ApiResult.Failure -> this
}

inline fun <T> ApiResult<T>.onSuccess(action: (T) -> Unit): ApiResult<T> {
    if (this is ApiResult.Success) action(data)
    return this
}

inline fun <T> ApiResult<T>.onFailure(action: (ApiError) -> Unit): ApiResult<T> {
    if (this is ApiResult.Failure) action(error)
    return this
}
