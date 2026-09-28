package com.kothabarta.core.network.auth

// Request bodies — field names match server/src/routes/auth.js exactly.
// No serialization annotation needed, see ApiEnvelope.kt's note on Moshi.

data class RegisterRequest(
    val fullName: String,
    val email: String,
    val password: String,
    val confirmPassword: String,
)

data class LoginRequest(
    val email: String,
    val password: String,
)

data class GoogleLoginRequest(
    val credential: String,
)

// Response shape — a subset of `User.toSafeJSON()` (server/src/models/User.js);
// fields no screen renders yet (settings, publicKey(s), etc.) are simply left
// out of the model and ignored on decode, not fetched separately. Extended in
// Phase 2 to cover what the own-profile screen needs (bio/hometown/currentCity)
// since `GET /auth/me` and this shape are one and the same on the server.

data class UserDto(
    val id: String,
    val fullName: String,
    val email: String,
    val role: String,
    val bio: String? = null,
    val hometown: String? = null,
    val currentCity: String? = null,
    val avatar: AvatarDto? = null,
    val accountStatus: String = "active",
    val isMuted: Boolean = false,
)

data class AvatarDto(
    val secureUrl: String? = null,
)

data class LogoutResponse(
    val loggedOut: Boolean = true,
)
