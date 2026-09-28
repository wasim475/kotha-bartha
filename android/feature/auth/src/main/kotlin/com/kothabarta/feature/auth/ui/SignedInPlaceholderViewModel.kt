package com.kothabarta.feature.auth.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.feature.auth.data.AuthRepository
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch

/**
 * Deliberately not a Home feature — this milestone is auth/networking/nav
 * foundation only (see docs/architecture/android-implementation-plan.md
 * section N). It exists solely to prove the whole loop actually works: a
 * real login/register call stored a real token, and logging out here clears
 * it and the socket connection and returns to Login.
 */
class SignedInPlaceholderViewModel(private val repository: AuthRepository) : ViewModel() {

    private val _navigationEvents = MutableSharedFlow<NavigationEvent>(extraBufferCapacity = 1)
    val navigationEvents: SharedFlow<NavigationEvent> = _navigationEvents.asSharedFlow()

    fun logout() {
        viewModelScope.launch {
            repository.logout()
            _navigationEvents.emit(NavigationEvent.NavigateTo(Routes.LOGIN, popUpToInclusive = Routes.SIGNED_IN_PLACEHOLDER))
        }
    }
}
