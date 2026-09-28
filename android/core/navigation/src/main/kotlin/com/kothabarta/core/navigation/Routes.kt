package com.kothabarta.core.navigation

import java.net.URLDecoder
import java.net.URLEncoder

/**
 * Route names shared between `:app` (which owns the actual `NavHost`, since
 * it's the only module allowed to see every feature) and each feature's
 * ViewModels (which only need to name a destination, never hold a
 * `NavController`). See docs/architecture/android-implementation-plan.md
 * section L for the phase each of these was added in.
 *
 * [MAIN] is the bottom-nav shell added in Phase 2 — it replaced the
 * foundation milestone's `SIGNED_IN_PLACEHOLDER`, which no longer exists.
 * [MESSAGES]/[CHAT_PATTERN] were declared-but-unwired in Phase 2 and are
 * activated in Phase 3.
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
    const val MESSAGES = "messages"

    // Pushed on top of MAIN, not part of the bottom nav
    const val PROFILE_ARG = "userId"
    const val PROFILE_PATTERN = "profile/{$PROFILE_ARG}"
    fun profile(userId: String) = "profile/$userId"

    const val POST_ARG = "postId"
    const val POST_PATTERN = "post/{$POST_ARG}"
    fun post(postId: String) = "post/$postId"

    // The chat screen needs the peer's display name/avatar to render its
    // header immediately (there is no "get one conversation by id" REST
    // endpoint — see android-implementation-plan.md's Phase 3 notes), so
    // whoever navigates here (conversation list row, a profile's "Message"
    // button, a notification) passes what it already has on hand as query
    // args rather than the chat screen re-deriving it from scratch.
    const val CHAT_CONVERSATION_ARG = "conversationId"
    const val CHAT_PEER_ID_ARG = "peerId"
    const val CHAT_PEER_NAME_ARG = "peerName"
    const val CHAT_PEER_AVATAR_ARG = "peerAvatarUrl"
    const val CHAT_PATTERN =
        "messages/{$CHAT_CONVERSATION_ARG}?$CHAT_PEER_ID_ARG={$CHAT_PEER_ID_ARG}&$CHAT_PEER_NAME_ARG={$CHAT_PEER_NAME_ARG}&$CHAT_PEER_AVATAR_ARG={$CHAT_PEER_AVATAR_ARG}"

    private fun encode(value: String) = URLEncoder.encode(value, "UTF-8")
    fun decode(value: String) = URLDecoder.decode(value, "UTF-8")

    fun chat(conversationId: String, peerId: String? = null, peerName: String? = null, peerAvatarUrl: String? = null): String {
        val id = peerId?.let { encode(it) }.orEmpty()
        val name = peerName?.let { encode(it) }.orEmpty()
        val avatar = peerAvatarUrl?.let { encode(it) }.orEmpty()
        return "messages/$conversationId?$CHAT_PEER_ID_ARG=$id&$CHAT_PEER_NAME_ARG=$name&$CHAT_PEER_AVATAR_ARG=$avatar"
    }
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
