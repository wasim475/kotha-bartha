package com.kothabarta.feature.auth.data

import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.auth.AuthApi
import com.kothabarta.core.network.auth.GoogleLoginRequest
import com.kothabarta.core.network.auth.LoginRequest
import com.kothabarta.core.network.auth.LogoutResponse
import com.kothabarta.core.network.auth.RegisterRequest
import com.kothabarta.core.network.auth.UserDto
import com.kothabarta.core.security.TokenStore
import com.kothabarta.core.websocket.SocketManager
import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response

class AuthRepositoryTest {

    @Test
    fun `valid saved session reconnects the authenticated socket during splash validation`() = runTest {
        val connectedTokens = mutableListOf<String>()
        val repository = AuthRepository(
            authApi = FakeAuthApi(validSession = true),
            tokenStore = FakeTokenStore("saved-token"),
            socketManager = SocketManager("http://localhost"),
            connectSocket = connectedTokens::add,
        )

        val result = repository.currentUser()

        assertTrue(result is ApiResult.Success)
        assertEquals(listOf("saved-token"), connectedTokens)
    }

    @Test
    fun `invalid saved session does not reconnect its socket`() = runTest {
        val connectedTokens = mutableListOf<String>()
        val repository = AuthRepository(
            authApi = FakeAuthApi(validSession = false),
            tokenStore = FakeTokenStore("expired-token"),
            socketManager = SocketManager("http://localhost"),
            connectSocket = connectedTokens::add,
        )

        val result = repository.currentUser()

        assertTrue(result is ApiResult.Failure)
        assertTrue(connectedTokens.isEmpty())
    }

    private class FakeTokenStore(private val token: String?) : TokenStore {
        override fun saveToken(token: String) = Unit
        override fun getToken(): String? = token
        override fun clearToken() = Unit
    }

    private class FakeAuthApi(private val validSession: Boolean) : AuthApi {
        override suspend fun me(): Response<ApiEnvelope<UserDto>> = if (validSession) {
            Response.success(ApiEnvelope(data = UserDto(id = "u1", fullName = "User", email = "u@example.com", role = "user")))
        } else {
            val body = """{"error":{"code":"UNAUTHENTICATED","message":"Sign in again."}}"""
                .toResponseBody("application/json".toMediaType())
            Response.error(401, body)
        }

        override suspend fun register(body: RegisterRequest): Response<ApiEnvelope<UserDto>> = error("not used")
        override suspend fun login(body: LoginRequest): Response<ApiEnvelope<UserDto>> = error("not used")
        override suspend fun google(body: GoogleLoginRequest): Response<ApiEnvelope<UserDto>> = error("not used")
        override suspend fun logout(): Response<ApiEnvelope<LogoutResponse>> = error("not used")
    }
}
