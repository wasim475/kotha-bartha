package com.kothabarta.core.network.messages

import com.kothabarta.core.common.ApiResult

/**
 * Lets Profile/Friends open-or-create a conversation and navigate to it
 * without depending on `:feature:messages` directly — feature modules never
 * depend on each other, only on `core:*` (see `SessionManager` for the same
 * pattern). `:feature:messages`'s `MessagesRepository` implements this;
 * Koin binds the interface to that same singleton.
 */
interface ConversationLauncher {
    suspend fun openConversationWith(userId: String): ApiResult<ChatTarget>
}

data class ChatTarget(
    val conversationId: String,
    val peerId: String?,
    val peerName: String?,
    val peerAvatarUrl: String?,
)
