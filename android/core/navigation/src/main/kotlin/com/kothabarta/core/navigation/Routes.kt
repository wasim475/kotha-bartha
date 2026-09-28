package com.kothabarta.core.navigation

/**
 * Route names shared between `:app` (which owns the actual `NavHost`, since
 * it's the only module allowed to see every feature) and each feature's
 * ViewModels (which only need to name a destination, never hold a
 * `NavController`). Only the three screens this first milestone builds are
 * listed — see docs/architecture/android-implementation-plan.md section L
 * for when Home/Messages/etc. add their own routes here.
 */
object Routes {
    const val SPLASH = "splash"
    const val LOGIN = "login"
    const val SIGNUP = "signup"
    const val SIGNED_IN_PLACEHOLDER = "signed_in_placeholder"
}

/**
 * A ViewModel emits this instead of holding a `NavController` directly (which
 * would make it untestable and couple it to Compose). The Composable
 * collecting a screen's events is the only thing that ever touches real
 * navigation.
 */
sealed interface NavigationEvent {
    data class NavigateTo(val route: String, val popUpToInclusive: String? = null) : NavigationEvent
    data object PopBackStack : NavigationEvent
}
