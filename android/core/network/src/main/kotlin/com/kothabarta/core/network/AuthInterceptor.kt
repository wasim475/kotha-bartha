package com.kothabarta.core.network

import com.kothabarta.core.security.TokenStore
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Attaches `Authorization: Bearer <token>` to every request, mirroring the
 * header path `server/src/middleware/auth.js` already accepts alongside the
 * web client's cookie (see docs/architecture/android-api-contract.md). Never
 * touches the cookie the web client uses — Android has no cookie jar here at
 * all.
 */
class AuthInterceptor(private val tokenStore: TokenStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokenStore.getToken()
        val request = chain.request().let { original ->
            if (token.isNullOrBlank()) original
            else original.newBuilder().addHeader("Authorization", "Bearer $token").build()
        }
        return chain.proceed(request)
    }
}
