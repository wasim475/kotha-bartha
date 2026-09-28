package com.kothabarta.core.network.call

import com.kothabarta.core.network.social.SafeUserDto

data class CallScreenShareDto(val active: Boolean = false, val byUserId: String? = null)

data class CallParticipantInviteDto(
    val userId: String,
    val invitedBy: String,
    val status: String = "pending",
    val user: SafeUserDto? = null,
)

/**
 * Matches `call.service.js#summarize` exactly. `role`/`peer` are added only by the REST
 * layer's `withRole` wrapper (`forUser`) — absent on the raw socket-broadcast `call` summaries.
 */
data class CallDto(
    val id: String,
    val conversationId: String,
    val video: Boolean = true,
    val status: String = "ringing",
    val caller: SafeUserDto? = null,
    val callee: SafeUserDto? = null,
    val screenShare: CallScreenShareDto = CallScreenShareDto(),
    val participantInvites: List<CallParticipantInviteDto> = emptyList(),
    val createdAt: String? = null,
    val acceptedAt: String? = null,
    val connectedAt: String? = null,
    val endedAt: String? = null,
    val durationSec: Int = 0,
    val role: String? = null,
    val peer: SafeUserDto? = null,
)

data class CallHistoryRowDto(
    val id: String,
    val direction: String,
    val video: Boolean = true,
    val status: String,
    val with: SafeUserDto? = null,
    val durationSec: Int = 0,
    val createdAt: String? = null,
    val acceptedAt: String? = null,
    val endedAt: String? = null,
)

data class CallHistoryResponse(val page: Int = 1, val totalPages: Int = 1, val calls: List<CallHistoryRowDto> = emptyList())

data class StartCallRequest(val userId: String, val video: Boolean = true)
data class CallInviteParticipantRequest(val userId: String)

/** Forwarded wholesale, opaque to the server — matches the browser's `RTCSessionDescriptionInit` shape exactly. */
data class RtcSessionDescriptionDto(val type: String, val sdp: String)

/** Matches the browser's `RTCIceCandidateInit` shape — note the candidate STRING lives in the `candidate` field, distinct from the outer signal's own `type` discriminator. */
data class RtcIceCandidateDto(
    val candidate: String? = null,
    val sdpMid: String? = null,
    val sdpMLineIndex: Int? = null,
    val usernameFragment: String? = null,
)
