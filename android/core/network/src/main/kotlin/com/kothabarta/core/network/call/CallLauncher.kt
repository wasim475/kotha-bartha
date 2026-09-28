package com.kothabarta.core.network.call

/**
 * Lets other feature modules (e.g. `:feature:messages`'s `ChatScreen`) start a
 * call without depending on `:feature:calls` directly — feature modules never
 * depend on each other, only on `core:*`, same pattern as
 * `com.kothabarta.core.network.messages.ConversationLauncher`. `:feature:calls`
 * binds this to an adapter wrapping its `CallSessionManager` singleton.
 */
interface CallLauncher {
    fun startCall(peerId: String, peerName: String, peerAvatarUrl: String?, video: Boolean)
}
