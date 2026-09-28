package com.kothabarta.core.network.call

import com.kothabarta.core.network.social.SafeUserDto

/** `signal.type` ∈ "offer" | "answer" | "ice". Exactly one of [sdp]/[candidate] is populated, matching which type this is. */
data class CallSignalDto(
    val type: String,
    val sdp: RtcSessionDescriptionDto? = null,
    val candidate: RtcIceCandidateDto? = null,
    val renegotiate: Boolean? = null,
)

// ---- Server -> client broadcasts (event name -> payload shape, see call.service.js) ----

data class CallInviteEvent(val call: CallDto)
data class CallRingingEvent(val callId: String)
data class CallAcceptedEvent(val call: CallDto)
data class CallDeclinedEvent(val callId: String)
data class CallCancelledEvent(val callId: String)
data class CallMissedEvent(val callId: String)
data class CallSignalEvent(val callId: String, val from: String, val signal: CallSignalDto)
data class CallStateEvent(val callId: String, val status: String, val by: String, val connectedAt: String? = null)
data class CallEndedEvent(val callId: String, val reason: String, val call: CallDto)
data class CallScreenShareEvent(val callId: String, val byUserId: String)
data class CallReactionEvent(val callId: String, val from: String, val type: String)
data class CallInviteParticipantEvent(val callId: String, val inviter: SafeUserDto, val video: Boolean = true, val call: CallDto)
data class CallParticipantRespondedEvent(val callId: String, val userId: String, val accepted: Boolean, val call: CallDto)

// ---- Client -> server emits (ack-based; see call.socket.js) ----

data class CallJoinRequest(val callId: String)
data class CallOfferRequest(val callId: String, val sdp: RtcSessionDescriptionDto, val renegotiate: Boolean? = null)
data class CallAnswerRequest(val callId: String, val sdp: RtcSessionDescriptionDto, val renegotiate: Boolean? = null)
data class CallIceCandidateRequest(val callId: String, val candidate: RtcIceCandidateDto)
data class CallStateRequest(val callId: String, val status: String)
data class CallScreenShareRequest(val callId: String)
data class CallReactionRequest(val callId: String, val type: String)

/** `{ ok, call? }` on success, `{ ok:false, error:{code,message,...extra} }` on failure — see `call.socket.js`'s `guarded()`/`toError()`. */
data class CallAckDto(val ok: Boolean = false, val call: CallDto? = null)

/** Exact allowed values from `call.service.js`'s `REACTIONS` set — anything else is rejected server-side (`INVALID_REACTION`). */
val CALL_REACTION_TYPES = listOf("heart", "thumbsup", "laugh", "wow", "sad", "fire")
