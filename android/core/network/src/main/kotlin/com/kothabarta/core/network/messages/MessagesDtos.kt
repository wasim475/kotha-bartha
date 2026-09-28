package com.kothabarta.core.network.messages

/**
 * 1:1-conversation shape from `GET /conversations` (see
 * docs/architecture/android-implementation-plan.md's Phase 3 research —
 * `chat.routes.js`'s `otherParticipantView()`/list handler). `hasMore` is
 * always `false` here too — this endpoint is a capped 50, not real
 * pagination, same as Feed/Notifications.
 */
data class ConversationDto(
    val id: String,
    val isGroup: Boolean = false,
    val theme: String? = null,
    val likeEmoji: String? = null,
    val user: ConversationPeerDto? = null,
    val encrypted: Boolean = false,
    val body: String? = null,
    val lastMessageSenderId: String? = null,
    val lastMessageStatus: String? = null,
    val lastMessage: String? = null,
    val lastMessageAt: String? = null,
    val unreadCount: Int = 0,
)

data class ConversationPeerDto(
    val id: String,
    val fullName: String,
    val avatar: MediaRefDto? = null,
    val initials: String? = null,
    val lastSeenAt: String? = null,
    val isOnline: Boolean = false,
    val nickname: String? = null,
    val isBlocked: Boolean = false,
    val hasBlockedMe: Boolean = false,
)

data class MediaRefDto(val publicId: String? = null, val secureUrl: String? = null)

data class CreateConversationRequest(val userId: String)

/**
 * A message as returned by `GET /conversations/:id/messages` (full history,
 * no pagination) and by every send/edit/attachment-send response. `status`
 * is server-authoritative — Android never infers/computes "delivered"/"read"
 * itself, it only ever displays this field or reacts to `message:read`.
 * `encryptedBody`/`encryptedPayloads`/`senderPublicKey` are intentionally
 * not modeled — Android is plaintext-only this milestone (see the
 * implementation plan's E2E section) and only ever needs `encrypted` to know
 * whether to trust `body` as real text or as the server's own
 * "🔒 Encrypted message" placeholder, which is already exactly what `body`
 * contains in that case — nothing else to decrypt or degrade.
 */
data class MessageDto(
    val id: String,
    /** Present on send responses and every `message:*` socket event; absent (implied by the URL) on `GET .../messages` list items. */
    val conversationId: String? = null,
    val encrypted: Boolean = false,
    val body: String? = null,
    val adminMessage: Boolean = false,
    val type: String = "text",
    val attachment: AttachmentDto? = null,
    val createdAt: String,
    val senderId: String,
    val sender: MessageSenderDto? = null,
    val status: String = "sent",
    val unsendExpiresAt: String? = null,
    val replyTo: ReplyPreviewDto? = null,
    val reactions: List<ReactionEntryDto> = emptyList(),
)

data class MessageSenderDto(val id: String, val fullName: String, val avatar: MediaRefDto? = null)

data class ReplyPreviewDto(
    val id: String,
    val body: String? = null,
    val encrypted: Boolean = false,
    val senderId: String? = null,
)

data class AttachmentDto(
    val url: String,
    val publicId: String? = null,
    val fileName: String? = null,
    val mimeType: String? = null,
    val size: Long? = null,
    val kind: String = "file",
    val durationSec: Int? = null,
)

data class ReactionEntryDto(val userId: String, val emoji: String)

data class SendMessageRequest(val body: String, val replyTo: String? = null)

data class ReactionRequest(val emoji: String?)

data class DeletedResponse(val id: String, val deleted: Boolean = true)

/** Mirrors the `message:reaction` socket payload shape — a compact update, not the full message. */
data class ReactionUpdateDto(
    val id: String,
    val conversationId: String? = null,
    val reactions: List<ReactionEntryDto> = emptyList(),
)
