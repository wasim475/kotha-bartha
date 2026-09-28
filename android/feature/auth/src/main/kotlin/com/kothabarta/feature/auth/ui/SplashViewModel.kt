package com.kothabarta.feature.auth.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.feature.auth.data.AuthRepository
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch

/**
 * Decides where the app actually starts. A stored token isn't trusted on
 * sight — expired/revoked handling (see
 * docs/architecture/android-implementation-plan.md section D) means Splash
 * confirms it with a real `/auth/me` call before treating the user as
 * signed in, exactly the same authority check `requireAuth` already does on
 * every server-side request.
 */
class SplashViewModel(private val repository: AuthRepository) : ViewModel() {

    private val _navigationEvents = MutableSharedFlow<NavigationEvent>(extraBufferCapacity = 1)
    val navigationEvents: SharedFlow<NavigationEvent> = _navigationEvents.asSharedFlow()

    init {
        viewModelScope.launch {
            val destination = if (!repository.isSignedIn) {
                Routes.LOGIN
            } else {
                when (repository.currentUser()) {
                    is ApiResult.Success -> Routes.SIGNED_IN_PLACEHOLDER
                    is ApiResult.Failure -> {
                        repository.clearLocalSession()
                        Routes.LOGIN
                    }
                }
            }
            _navigationEvents.emit(NavigationEvent.NavigateTo(destination, popUpToInclusive = Routes.SPLASH))
        }
    }
}
