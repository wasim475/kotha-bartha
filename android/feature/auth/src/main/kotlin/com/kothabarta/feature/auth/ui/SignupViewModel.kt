package com.kothabarta.feature.auth.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.feature.auth.data.AuthRepository
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SignupUiState(
    val fullName: String = "",
    val email: String = "",
    val password: String = "",
    val confirmPassword: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
)

/**
 * Only the same client-side checks the form itself can't submit without
 * (blank fields, password length, passwords matching) — never a stand-in for
 * the server's own validation. `VALIDATION_ERROR`/`EMAIL_IN_USE` from the
 * real `POST /auth/register` response is what's actually authoritative;
 * this just avoids a wasted round trip for an empty field.
 */
class SignupViewModel(private val repository: AuthRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(SignupUiState())
    val uiState: StateFlow<SignupUiState> = _uiState.asStateFlow()

    private val _navigationEvents = MutableSharedFlow<NavigationEvent>(extraBufferCapacity = 1)
    val navigationEvents: SharedFlow<NavigationEvent> = _navigationEvents.asSharedFlow()

    fun onFullNameChange(value: String) = _uiState.update { it.copy(fullName = value, errorMessage = null) }
    fun onEmailChange(value: String) = _uiState.update { it.copy(email = value, errorMessage = null) }
    fun onPasswordChange(value: String) = _uiState.update { it.copy(password = value, errorMessage = null) }
    fun onConfirmPasswordChange(value: String) = _uiState.update { it.copy(confirmPassword = value, errorMessage = null) }

    fun submit() {
        val state = _uiState.value
        val validationError = when {
            state.fullName.isBlank() || state.email.isBlank() || state.password.isBlank() -> "Complete every field."
            state.password.length < 8 -> "Password must be at least 8 characters."
            state.password != state.confirmPassword -> "Passwords don't match."
            else -> null
        }
        if (validationError != null) {
            _uiState.update { it.copy(errorMessage = validationError) }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val result = repository.register(
                fullName = state.fullName.trim(),
                email = state.email.trim(),
                password = state.password,
                confirmPassword = state.confirmPassword,
            )
            when (result) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(isLoading = false) }
                    _navigationEvents.emit(NavigationEvent.NavigateTo(Routes.MAIN, popUpToInclusive = Routes.LOGIN))
                }
                is ApiResult.Failure -> {
                    _uiState.update { it.copy(isLoading = false, errorMessage = result.error.message) }
                }
            }
        }
    }

    fun goToLogin() {
        viewModelScope.launch { _navigationEvents.emit(NavigationEvent.PopBackStack) }
    }
}
