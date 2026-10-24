package com.kothabarta.core.network.social

/**
 * Mirrors `safeUser()` (server/src/utils/serializers.js) — the "public user"
 * shape embedded everywhere (post author, friend list entry, notification
 * actor, another person's profile). Distinct from `auth.UserDto`, which is
 * the smaller shape returned only by the auth endpoints.
 */
data class SafeUserDto(
    val id: String,
    val fullName: String,
    val bio: String? = null,
    val hometown: String? = null,
    val currentCity: String? = null,
    val avatar: MediaRefDto? = null,
    val cover: MediaRefDto? = null,
    val initials: String? = null,
    val lastSeenAt: String? = null,
    val createdAt: String? = null,
)

data class MediaRefDto(
    val publicId: String? = null,
    val secureUrl: String? = null,
)

/**
 * `GET /users/:userId`'s response — `SafeUserDto`'s fields plus the
 * server-computed friend-status flags. These are never recomputed client
 * side from a separately-fetched friends list — see
 * docs/architecture/android-api-contract.md's Friends section.
 */
data class ProfileUserDto(
    val id: String,
    val fullName: String,
    val bio: String? = null,
    val hometown: String? = null,
    val currentCity: String? = null,
    val avatar: MediaRefDto? = null,
    val cover: MediaRefDto? = null,
    val initials: String? = null,
    val lastSeenAt: String? = null,
    val createdAt: String? = null,
    val friendCount: Int = 0,
    val isFriend: Boolean = false,
    val friendRequestSent: Boolean = false,
    val friendRequestReceived: Boolean = false,
    val receivedFriendRequestId: String? = null,
    val isBlocked: Boolean = false,
    val hasBlockedMe: Boolean = false,
)

data class PostDto(
    val id: String,
    val body: String,
    val media: List<MediaRefDto> = emptyList(),
    val createdAt: String,
    val author: SafeUserDto,
    val editable: Boolean = false,
    val reaction: String? = null,
    val reactions: Map<String, Int> = emptyMap(),
    val likes: Int = 0,
    val liked: Boolean = false,
    val comments: Int = 0,
    val commentPreview: CommentDto? = null,
)

/** The 5 reaction types the server accepts — see server/src/utils/reactionTypes.js. */
object ReactionTypes {
    const val LIKE = "like"
    const val LOVE = "love"
    const val CARE = "care"
    const val HAHA = "haha"
    const val SAD = "sad"
    const val ANGRY = "angry"
    val ALL = listOf(LIKE, HAHA, CARE, ANGRY, SAD)
}

data class ReactionRequest(val type: String?)
data class EditPostBody(val body: String)

data class ReactionResponse(
    val reaction: String?,
    val reactions: Map<String, Int> = emptyMap(),
    val likes: Int = 0,
    val liked: Boolean = false,
)

data class FeedReadResponse(val read: Boolean, val feedSeenAt: String? = null)

data class PhotoDto(val postId: String, val url: String, val createdAt: String)

data class FriendEntryDto(
    val id: String? = null,
    val status: String? = null,
    val user: SafeUserDto? = null,
)

data class SendFriendRequestBody(val receiverId: String)

data class FriendRequestCreated(val id: String, val status: String)
data class CancelledResponse(val cancelled: Boolean)
data class AcceptedResponse(val accepted: Boolean)
data class UnfriendedResponse(val unfriended: Boolean)
data class BlockedResponse(val blocked: Boolean)

data class StoryDto(
    val id: String,
    val authorId: String,
    val type: String,
    val text: String = "",
    val textColor: String? = null,
    val backgroundColor: String? = null,
    val media: MediaRefDto? = null,
    val createdAt: String,
    val expiresAt: String,
)
data class StoryGroupDto(val author: SafeUserDto, val isMine: Boolean, val stories: List<StoryDto> = emptyList())
data class CreateStoryBody(
    val type: String = "text",
    val text: String,
    val textColor: String? = null,
    val backgroundColor: String? = null,
)
data class NoteDto(val id: String, val authorId: String, val text: String, val createdAt: String, val expiresAt: String)
data class NoteEntryDto(val author: SafeUserDto, val isMine: Boolean, val note: NoteDto)
data class CreateNoteBody(val text: String)
data class CommentDto(
    val id: String,
    val parentId: String? = null,
    val body: String,
    val createdAt: String,
    val author: SafeUserDto,
    val editable: Boolean = false,
    val reaction: String? = null,
    val reactions: Map<String, Int> = emptyMap(),
    val isFriend: Boolean = false,
    val repliesCount: Int = 0,
)
data class CreateCommentBody(val body: String, val parentId: String? = null)
data class CreateReportBody(val targetType: String = "post", val targetId: String, val reason: String, val description: String? = null)
data class ReportCreatedDto(val id: String?, val status: String, val duplicate: Boolean = false)

data class UnreadCountsDto(
    val feed: Int = 0,
    val friends: Int = 0,
    val messages: Int = 0,
    val notifications: Int = 0,
)

data class NotificationDto(
    val id: String,
    val type: String,
    val read: Boolean = false,
    val createdAt: String,
    val actor: SafeUserDto? = null,
    val payload: Map<String, Any?>? = null,
    val entityType: String? = null,
    val entityId: String? = null,
    val postId: String? = null,
    val commentId: String? = null,
    val replyId: String? = null,
) {
    /** The server authors this string (e.g. "Jane liked your post.") — never composed client-side. */
    val message: String?
        get() = payload?.get("message") as? String
}

data class MarkReadResponse(val id: String, val read: Boolean)
data class DeletedResponse(val id: String, val deleted: Boolean)
data class ReadAllResponse(val updated: Boolean)
