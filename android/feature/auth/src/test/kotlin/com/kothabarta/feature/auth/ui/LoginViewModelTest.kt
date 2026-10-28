package com.kothabarta.feature.auth.ui

import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.auth.AuthApi
import com.kothabarta.core.network.auth.GoogleLoginRequest
import com.kothabarta.core.network.auth.LoginRequest
import com.kothabarta.core.network.auth.LogoutResponse
import com.kothabarta.core.network.auth.RegisterRequest
import com.kothabarta.core.network.auth.UserDto
import com.kothabarta.core.security.TokenStore
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.auth.data.AuthRepository
import androidx.credentials.exceptions.GetCredentialCancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class LoginViewModelTest {
    @Test
    fun `credential manager cancellation is silent`() {
        assertNull(googleSignInErrorMessage(GetCredentialCancellationException("user cancelled")))
    }

    @Test
    fun `Google ID token authenticates through backend then persists session and navigates`() = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        try {
            val tokenStore = FakeTokenStore()
            val connectedTokens = mutableListOf<String>()
            val api = FakeAuthApi()
            val viewModel = LoginViewModel(repository(api, tokenStore, connectedTokens::add))
            val navigation = async { viewModel.navigationEvents.first() }

            viewModel.loginWithGoogle("google-id-token")
            assertTrue(viewModel.uiState.value.isLoading)
            runCurrent()

            assertEquals("google-id-token", api.googleCredential)
            assertEquals("session-token", tokenStore.savedToken)
            assertEquals(listOf("session-token"), connectedTokens)
            assertFalse(viewModel.uiState.value.isLoading)
            assertEquals(NavigationEvent.NavigateTo(Routes.MAIN, popUpToInclusive = Routes.LOGIN), navigation.await())
        } finally {
            Dispatchers.resetMain()
        }
    }

    @Test
    fun `missing Google ID token fails locally`() = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        try {
            val api = FakeAuthApi()
            val viewModel = LoginViewModel(repository(api, FakeTokenStore(), {}))
            viewModel.loginWithGoogle("  ")
            runCurrent()

            assertEquals("Google sign-in did not return a credential.", viewModel.uiState.value.errorMessage)
            assertEquals(0, api.googleCalls)
        } finally {
            Dispatchers.resetMain()
        }
    }

    @Test
    fun `backend authentication error is shown and no session is persisted`() = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        try {
            val tokenStore = FakeTokenStore()
            val api = FakeAuthApi().apply { respondWithError = true }
            val connectedTokens = mutableListOf<String>()
            val viewModel = LoginViewModel(repository(api, tokenStore, connectedTokens::add))
            viewModel.loginWithGoogle("google-id-token")
            runCurrent()

            assertEquals("Google authentication failed.", viewModel.uiState.value.errorMessage)
            assertFalse(viewModel.uiState.value.isLoading)
            assertNull(tokenStore.savedToken)
            assertTrue(connectedTokens.isEmpty())
        } finally {
            Dispatchers.resetMain()
        }
    }

    @Test
    fun `duplicate Google submissions while request is active make one backend call`() = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        try {
            val api = FakeAuthApi()
            api.responseGate = CompletableDeferred()
            val viewModel = LoginViewModel(repository(api, FakeTokenStore(), {}))

            viewModel.loginWithGoogle("google-id-token")
            viewModel.loginWithGoogle("google-id-token")
            assertTrue(viewModel.uiState.value.isLoading)
            runCurrent()
            assertEquals(1, api.googleCalls)

            api.responseGate?.complete(Unit)
            runCurrent()
            assertFalse(viewModel.uiState.value.isLoading)
        } finally {
            Dispatchers.resetMain()
        }
    }

    private fun repository(api: FakeAuthApi, tokenStore: FakeTokenStore, connect: (String) -> Unit) =
        AuthRepository(
            authApi = api,
            tokenStore = tokenStore,
            socketManager = SocketManager("http://localhost"),
            connectSocket = connect,
        )

    private class FakeTokenStore : TokenStore {
        var savedToken: String? = null
        override fun saveToken(token: String) { savedToken = token }
        override fun getToken(): String? = savedToken
        override fun clearToken() { savedToken = null }
    }

    private class FakeAuthApi : AuthApi {
        var googleCredential: String? = null
        var googleCalls = 0
        var respondWithError = false
        var responseGate: CompletableDeferred<Unit>? = null

        override suspend fun google(body: GoogleLoginRequest): Response<ApiEnvelope<UserDto>> {
            googleCalls++
            googleCredential = body.credential
            responseGate?.await()
            if (respondWithError) {
                val bodyJson = """{"error":{"code":"GOOGLE_AUTH_FAILED","message":"Google authentication failed."}}"""
                return Response.error(401, bodyJson.toResponseBody("application/json".toMediaType()))
            }
            return Response.success(
                ApiEnvelope(
                    data = UserDto(id = "user-id", fullName = "Test User", email = "user@example.test", role = "user"),
                    token = "session-token",
                ),
            )
        }

        override suspend fun register(body: RegisterRequest): Response<ApiEnvelope<UserDto>> = error("not used")
        override suspend fun login(body: LoginRequest): Response<ApiEnvelope<UserDto>> = error("not used")
        override suspend fun me(): Response<ApiEnvelope<UserDto>> = error("not used")
        override suspend fun logout(): Response<ApiEnvelope<LogoutResponse>> = error("not used")
    }
}
