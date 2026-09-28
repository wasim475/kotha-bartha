package com.kothabarta.core.network

import com.kothabarta.core.security.TokenStore
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

/**
 * One Retrofit instance per app process, shared by every feature's API
 * interface — there is exactly one backend (see
 * docs/architecture/android-readiness.md), so there is exactly one client.
 */
object ApiClientFactory {

    fun create(
        baseUrl: String,
        tokenStore: TokenStore,
        unauthorizedNotifier: UnauthorizedNotifier,
        debugLogging: Boolean,
    ): Retrofit {
        val logging = HttpLoggingInterceptor().apply {
            level = if (debugLogging) HttpLoggingInterceptor.Level.BASIC else HttpLoggingInterceptor.Level.NONE
        }
        val okHttpClient = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(AuthInterceptor(tokenStore))
            .addInterceptor(UnauthorizedInterceptor(unauthorizedNotifier))
            .addInterceptor(logging)
            .build()

        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(NetworkJson.moshi))
            .build()
    }
}
