package com.kothabarta.app.navigation

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.UnauthorizedNotifier
import com.kothabarta.feature.auth.data.AuthRepository
import com.kothabarta.feature.auth.ui.LoginScreen
import com.kothabarta.feature.auth.ui.SignedInPlaceholderScreen
import com.kothabarta.feature.auth.ui.SignupScreen
import com.kothabarta.feature.auth.ui.SplashScreen
import org.koin.compose.koinInject

/**
 * The only place a real `NavController` exists — every screen's ViewModel
 * only ever emits a [NavigationEvent] (see :core:navigation's Routes.kt),
 * this is what turns those into an actual navigation call.
 */
@Composable
fun KothaBartaNavHost() {
    val navController = rememberNavController()
    val unauthorizedNotifier = koinInject<UnauthorizedNotifier>()
    val authRepository = koinInject<AuthRepository>()

    val handleEvent: (NavigationEvent) -> Unit = { event ->
        when (event) {
            is NavigationEvent.NavigateTo -> navController.navigate(event.route) {
                event.popUpToInclusive?.let { popUpTo(it) { inclusive = true } }
            }
            NavigationEvent.PopBackStack -> navController.popBackStack()
        }
    }

    // A 401 anywhere (see docs/architecture/android-implementation-plan.md
    // section D) drops straight back to Login from a single place, instead
    // of every screen having to notice its own failed call was actually an
    // expired session.
    LaunchedEffect(Unit) {
        unauthorizedNotifier.events.collect {
            authRepository.clearLocalSession()
            navController.navigate(Routes.LOGIN) {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    Surface(modifier = Modifier.fillMaxSize()) {
        NavHost(navController = navController, startDestination = Routes.SPLASH) {
            composable(Routes.SPLASH) { SplashScreen(onNavigate = handleEvent) }
            composable(Routes.LOGIN) { LoginScreen(onNavigate = handleEvent) }
            composable(Routes.SIGNUP) { SignupScreen(onNavigate = handleEvent) }
            composable(Routes.SIGNED_IN_PLACEHOLDER) { SignedInPlaceholderScreen(onNavigate = handleEvent) }
        }
    }
}
