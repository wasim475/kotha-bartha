package com.kothabarta.feature.auth.ui

import com.kothabarta.core.network.auth.AuthApi
import com.kothabarta.core.network.auth.GoogleLoginRequest
import com.kothabarta.core.network.auth.LoginRequest
import com.kothabarta.core.network.auth.LogoutResponse
import com.kothabarta.core.network.auth.RegisterRequest
import com.kothabarta.core.network.auth.UserDto
import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.security.TokenStore
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.auth.data.AuthRepository
import org.junit.Assert.assertEquals
import org.junit.Test
import retrofit2.Response

/**
 * Only the pure client-side validation branches — the same rules
 * `POST /auth/register` itself enforces (see server/src/routes/auth.js),
 * checked here purely to avoid a wasted round trip for an obviously
 * incomplete form. The server's response is still what's authoritative for
 * anything this can't catch (e.g. EMAIL_IN_USE), so the success path isn't
 * tested here — it needs no fake to prove.
 */
class SignupViewModelTest {

    private fun newViewModel() = SignupViewModel(
        AuthRepository(NeverCalledAuthApi(), NeverCalledTokenStore(), SocketManager("http://localhost")),
    )

    @Test
    fun `blank fields are rejected before any network call`() {
        val viewModel = newViewModel()
        viewModel.submit()
        assertEquals("Complete every field.", viewModel.uiState.value.errorMessage)
    }

    @Test
    fun `a short password is rejected`() {
        val viewModel = newViewModel()
        viewModel.onFullNameChange("Jane Doe")
        viewModel.onEmailChange("jane@example.com")
        viewModel.onPasswordChange("short")
        viewModel.onConfirmPasswordChange("short")
        viewModel.submit()
        assertEquals("Password must be at least 8 characters.", viewModel.uiState.value.errorMessage)
    }

    @Test
    fun `mismatched passwords are rejected`() {
        val viewModel = newViewModel()
        viewModel.onFullNameChange("Jane Doe")
        viewModel.onEmailChange("jane@example.com")
        viewModel.onPasswordChange("longenough1")
        viewModel.onConfirmPasswordChange("longenough2")
        viewModel.submit()
        assertEquals("Passwords don't match.", viewModel.uiState.value.errorMessage)
    }

    /** Deliberately throws if ever invoked — these tests must never reach the network. */
    private class NeverCalledAuthApi : AuthApi {
        override suspend fun register(body: RegisterRequest): Response<ApiEnvelope<UserDto>> = fail()
        override suspend fun login(body: LoginRequest): Response<ApiEnvelope<UserDto>> = fail()
        override suspend fun google(body: GoogleLoginRequest): Response<ApiEnvelope<UserDto>> = fail()
        override suspend fun me(): Response<ApiEnvelope<UserDto>> = fail()
        override suspend fun logout(): Response<ApiEnvelope<LogoutResponse>> = fail()
        private fun fail(): Nothing = error("should not be called for a client-side validation failure")
    }

    private class NeverCalledTokenStore : TokenStore {
        override fun saveToken(token: String) = error("should not be called")
        override fun getToken(): String? = error("should not be called")
        override fun clearToken() = error("should not be called")
    }
}
