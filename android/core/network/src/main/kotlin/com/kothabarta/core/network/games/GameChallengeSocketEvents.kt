package com.kothabarta.core.network.games

/** Event NAMES do not follow a single consistent colon-suffix convention here — see the exact strings each ViewModel subscribes to. */
data class ChallengeInviteLifecycleEvent(
    val invite: ChallengeInviteDto? = null,
    val requestId: String? = null,
    val matchId: String? = null,
)
data class ChallengeMatchEvent(val matchId: String, val match: ChallengeMatchDto? = null)
data class ChallengeAnswerNotice(val matchId: String, val questionIndex: Int = -1, val userId: String? = null)
