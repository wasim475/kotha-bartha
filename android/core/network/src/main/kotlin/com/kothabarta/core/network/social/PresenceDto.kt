package com.kothabarta.core.network.social

/**
 * `presence:update` socket payload (see
 * docs/architecture/android-realtime-contract.md) — delivered only for
 * *conversation partners*, not a user's whole friend list (that's a real,
 * documented scope limit of the existing server behavior, not something
 * Android invents or should try to widen).
 */
data class PresenceUpdate(
    val userId: String,
    val isOnline: Boolean,
    val lastSeenAt: String? = null,
)

/** `friend:new` — a lightweight badge-bump event, not a full request payload. */
data class FriendNewEvent(val requestId: String, val senderId: String)

/** `friend:accepted` — `userId` is the accepter's id. */
data class FriendAcceptedEvent(val userId: String)
