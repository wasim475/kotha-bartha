package com.kothabarta.core.navigation

/**
 * Route names shared between `:app` (which owns the actual `NavHost`, since
 * it's the only module allowed to see every feature) and each feature's
 * ViewModels (which only need to name a destination, never hold a
 * `NavController`). See docs/architecture/android-implementation-plan.md
 * section L for the phase each of these was added in.
 *
 * [MAIN] is the bottom-nav shell added in Phase 2 (Home/Friends/
 * Notifications/Profile) — it replaced the foundation milestone's
 * `SIGNED_IN_PLACEHOLDER`, which no longer exists. [MESSAGES] is
 * deliberately declared but never wired into the bottom nav or the
 * `NavHost` yet — see `KothaBartaNavHost`'s comment — so the next milestone
 * only has to add one screen and one nav-bar item, not restructure anything.
 */
object Routes {
    const val SPLASH = "splash"
    const val LOGIN = "login"
    const val SIGNUP = "signup"
    const val MAIN = "main"

    // Bottom-nav tabs (children of MAIN)
    const val HOME = "home"
    const val FRIENDS = "friends"
    const val NOTIFICATIONS = "notifications"
    const val MY_PROFILE = "profile/me"

    // Pushed on top of MAIN, not part of the bottom nav
    const val PROFILE_ARG = "userId"
    const val PROFILE_PATTERN = "profile/{$PROFILE_ARG}"
    fun profile(userId: String) = "profile/$userId"

    const val POST_ARG = "postId"
    const val POST_PATTERN = "post/{$POST_ARG}"
    fun post(postId: String) = "post/$postId"

    /** Not implemented yet — see the class doc above. */
    const val MESSAGES = "messages"
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
