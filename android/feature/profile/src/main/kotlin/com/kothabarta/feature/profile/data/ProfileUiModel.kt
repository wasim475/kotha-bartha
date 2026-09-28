package com.kothabarta.feature.profile.data

import com.kothabarta.core.network.auth.UserDto
import com.kothabarta.core.network.social.ProfileUserDto

/**
 * One display shape both "my own profile" (`GET /auth/me`, [UserDto]) and
 * "someone else's profile" (`GET /users/:id`, [ProfileUserDto]) map into —
 * the friend-status fields are simply absent/false for an own profile,
 * where they're meaningless (see docs/architecture/android-api-contract.md's
 * confirmation that friend status is always server-computed, never derived
 * client-side from a separate list).
 */
data class ProfileUiModel(
    val id: String,
    val fullName: String,
    val bio: String?,
    val hometown: String?,
    val currentCity: String?,
    val avatarUrl: String?,
    val initials: String,
    val isOwn: Boolean,
    val friendCount: Int? = null,
    val isFriend: Boolean = false,
    val friendRequestSent: Boolean = false,
    val friendRequestReceived: Boolean = false,
    val receivedFriendRequestId: String? = null,
    val isBlocked: Boolean = false,
    val hasBlockedMe: Boolean = false,
)

fun UserDto.toProfileUiModel(): ProfileUiModel = ProfileUiModel(
    id = id,
    fullName = fullName,
    bio = bio,
    hometown = hometown,
    currentCity = currentCity,
    avatarUrl = avatar?.secureUrl,
    initials = fullName.take(2),
    isOwn = true,
)

fun ProfileUserDto.toProfileUiModel(): ProfileUiModel = ProfileUiModel(
    id = id,
    fullName = fullName,
    bio = bio,
    hometown = hometown,
    currentCity = currentCity,
    avatarUrl = avatar?.secureUrl,
    initials = initials ?: fullName.take(2),
    isOwn = false,
    friendCount = friendCount,
    isFriend = isFriend,
    friendRequestSent = friendRequestSent,
    friendRequestReceived = friendRequestReceived,
    receivedFriendRequestId = receivedFriendRequestId,
    isBlocked = isBlocked,
    hasBlockedMe = hasBlockedMe,
)
