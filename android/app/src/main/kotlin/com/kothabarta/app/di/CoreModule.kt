package com.kothabarta.app.di

import com.kothabarta.app.BuildConfig
import com.kothabarta.core.datastore.AppPreferences
import com.kothabarta.core.network.ApiClientFactory
import com.kothabarta.core.network.UnauthorizedNotifier
import com.kothabarta.core.network.auth.AuthApi
import com.kothabarta.core.network.messages.MessagesApi
import com.kothabarta.core.network.social.FriendsApi
import com.kothabarta.core.network.social.NotificationsApi
import com.kothabarta.core.network.social.PostsApi
import com.kothabarta.core.network.social.UsersApi
import com.kothabarta.core.security.EncryptedTokenStore
import com.kothabarta.core.security.TokenStore
import com.kothabarta.core.websocket.SocketManager
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module
import retrofit2.Retrofit

/**
 * Everything below `:feature:*` — see
 * docs/architecture/android-implementation-plan.md section B for why each of
 * these belongs to the core module it's built in rather than here; this file
 * only wires them together with real values (the base URLs), which is an
 * `:app`-level decision every feature module should stay ignorant of.
 */
val coreModule = module {
    single<TokenStore> { EncryptedTokenStore(androidContext()) }
    single { UnauthorizedNotifier() }
    single { AppPreferences(androidContext()) }
    single { SocketManager(BuildConfig.SOCKET_URL) }
    single {
        ApiClientFactory.create(
            baseUrl = BuildConfig.API_BASE_URL,
            tokenStore = get(),
            unauthorizedNotifier = get(),
            debugLogging = BuildConfig.DEBUG,
        )
    }
    single { get<Retrofit>().create(AuthApi::class.java) }
    single { get<Retrofit>().create(PostsApi::class.java) }
    single { get<Retrofit>().create(UsersApi::class.java) }
    single { get<Retrofit>().create(FriendsApi::class.java) }
    single { get<Retrofit>().create(NotificationsApi::class.java) }
    single { get<Retrofit>().create(MessagesApi::class.java) }
}
