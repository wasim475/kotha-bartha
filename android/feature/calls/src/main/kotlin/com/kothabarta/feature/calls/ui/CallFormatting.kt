package com.kothabarta.feature.calls.ui

import com.kothabarta.feature.calls.domain.CallUiState

/**
 * Status-label wording mirrored point-for-point from the web client's
 * `ActiveCall.jsx`/`FloatingCall.jsx` — never invented, see the call-phase
 * research notes this whole port is driven by.
 */
internal fun callStatusLabel(state: CallUiState): String {
    val trackReady = if (state.video) state.remoteVideoReady else state.remoteAudioReady
    return when {
        state.status == "ringing" && state.role == "caller" -> if (state.ringingLive) "Ringing…" else "Calling…"
        state.status == "reconnecting" -> "Reconnecting…"
        state.status == "connected" && !trackReady -> if (state.video) "Video connecting…" else "Audio connecting…"
        state.status == "connected" -> formatCallDuration(state.durationSeconds)
        state.status == "connecting" || state.status == "accepted" -> "Connecting…"
        else -> ""
    }
}

internal fun formatCallDuration(totalSeconds: Int): String {
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "%02d:%02d".format(minutes, seconds)
}

internal fun qualityTooltip(quality: String?): String = when (quality) {
    "good" -> "Good connection"
    "unstable" -> "Unstable connection"
    "poor" -> "Poor connection"
    else -> ""
}

/** The exact emoji the web client uses per reaction type — see `CALL_REACTION_TYPES`. */
internal fun reactionEmoji(type: String): String = when (type) {
    "heart" -> "❤️"
    "thumbsup" -> "👍"
    "laugh" -> "😂"
    "wow" -> "😮"
    "sad" -> "😢"
    "fire" -> "🔥"
    else -> "❓"
}

internal fun callHistoryStatusLabel(status: String, direction: String, durationSec: Int): String = when (status) {
    "completed" -> if (durationSec > 0) formatCallDuration(durationSec) else "Connected"
    "missed" -> "Missed"
    "declined" -> if (direction == "outgoing") "Declined by you" else "Declined"
    "cancelled" -> "Missed"
    "failed" -> "Call failed"
    "ended" -> if (durationSec > 0) formatCallDuration(durationSec) else "Ended"
    else -> status.replaceFirstChar { it.uppercase() }
}

internal fun isCallHistoryMissedStyle(status: String, direction: String): Boolean =
    status == "missed" || status == "cancelled" || (status == "declined" && direction == "outgoing")
