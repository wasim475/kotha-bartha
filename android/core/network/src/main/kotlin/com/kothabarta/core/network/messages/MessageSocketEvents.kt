package com.kothabarta.core.network.messages

/**
 * Payload shapes for the `message:*`/`typing:*` socket events documented in
 * docs/architecture/android-realtime-contract.md. `message:new` and
 * `message:updated` are both decoded as plain [MessageDto] — Moshi ignores
 * fields it isn't asked for (`editedAt` on an update) and defaults ones
 * that are absent, so one shape covers both without a second near-identical
 * class.
 */
data class MessageDeletedEvent(val id: String, val conversationId: String, val senderId: String)

data class MessageReadEvent(val id: String, val conversationId: String, val status: String)

/** Client sends `{to, conversationId}`; the server relays `{conversationId, senderId}` to the recipient. */
data class TypingStartRequest(val to: String, val conversationId: String)
data class TypingEvent(val conversationId: String, val senderId: String)
