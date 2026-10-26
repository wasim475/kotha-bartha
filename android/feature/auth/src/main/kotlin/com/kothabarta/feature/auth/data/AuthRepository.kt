package com.kothabarta.feature.auth.data

import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.common.map
import com.kothabarta.core.network.AuthSession
import com.kothabarta.core.network.NoOpPushDeviceRegistrar
import com.kothabarta.core.network.PushDeviceRegistrar
import com.kothabarta.core.network.SessionManager
import com.kothabarta.core.network.auth.AuthApi
import com.kothabarta.core.network.auth.GoogleLoginRequest
import com.kothabarta.core.network.auth.LoginRequest
import com.kothabarta.core.network.auth.RegisterRequest
import com.kothabarta.core.network.auth.UserDto
import com.kothabarta.core.network.safeApiCall
import com.kothabarta.core.network.safeAuthCall
import com.kothabarta.core.security.TokenStore
import com.kothabarta.core.websocket.SocketManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Owns the one thing every screen in this module ultimately needs: turning a
 * successful auth call into a stored token and a live socket connection
 * (see docs/architecture/android-implementation-plan.md section D — the
 * REST call, the Keystore write, and the socket handshake are one atomic
 * "you are now signed in" step, not three things each screen has to
 * remember to do itself).
 */
class AuthRepository(
    private val authApi: AuthApi,
    private val tokenStore: TokenStore,
    private val socketManager: SocketManager,
    private val connectSocket: (String) -> Unit = socketManager::connect,
    private val pushDeviceRegistrar: PushDeviceRegistrar = NoOpPushDeviceRegistrar,
    private val pushSyncScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO),
) : SessionManager {
    override val isSignedIn: Boolean
        get() = !tokenStore.getToken().isNullOrBlank()

    suspend fun login(email: String, password: String): ApiResult<UserDto> =
        completeSignIn(safeAuthCall { authApi.login(LoginRequest(email, password)) })

    suspend fun register(fullName: String, email: String, password: String, confirmPassword: String): ApiResult<UserDto> =
        completeSignIn(safeAuthCall { authApi.register(RegisterRequest(fullName, email, password, confirmPassword)) })

    suspend fun loginWithGoogle(credential: String): ApiResult<UserDto> =
        completeSignIn(safeAuthCall { authApi.google(GoogleLoginRequest(credential)) })

    /** Used by Splash to validate and restore a saved session, including its realtime socket. */
    suspend fun currentUser(): ApiResult<UserDto> {
        val result = safeApiCall { authApi.me() }
        if (result is ApiResult.Success) {
            tokenStore.getToken()?.takeIf(String::isNotBlank)?.let(connectSocket)
            syncPushTokenInBackground()
        }
        return result
    }

    /** A stored token that turned out to be dead (expired/revoked) — no server round trip needed. */
    fun clearLocalSession() {
        tokenStore.clearToken()
        socketManager.disconnect()
    }

    /** A user-initiated sign-out — also tells the server, best-effort. */
    override suspend fun logout() {
        runCatching { pushDeviceRegistrar.unregister() }
        runCatching { safeApiCall { authApi.logout() } }
        clearLocalSession()
    }

    private suspend fun completeSignIn(result: ApiResult<AuthSession>): ApiResult<UserDto> {
        val mapped = result.map { session ->
            tokenStore.saveToken(session.token)
            connectSocket(session.token)
            session.user
        }
        if (mapped is ApiResult.Success) syncPushTokenInBackground()
        return mapped
    }

    /** Push registration is best-effort and must never delay auth or splash navigation. */
    private fun syncPushTokenInBackground() {
        pushSyncScope.launch {
            withTimeoutOrNull(PUSH_SYNC_TIMEOUT_MILLIS) {
                runCatching { pushDeviceRegistrar.syncCurrentToken() }
            }
        }
    }

    private companion object {
        const val PUSH_SYNC_TIMEOUT_MILLIS = 15_000L
    }
}
