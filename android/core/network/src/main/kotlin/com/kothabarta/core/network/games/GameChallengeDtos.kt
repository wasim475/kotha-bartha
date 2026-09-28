package com.kothabarta.core.network.games

import com.kothabarta.core.network.social.SafeUserDto

data class ChallengeInviteDto(
    val id: String,
    val kind: String = "invite",
    val status: String = "pending",
    val expiresAt: String? = null,
    val gameType: String? = null,
    val gameName: String? = null,
    val gameIcon: String? = null,
    val matchId: String? = null,
    val from: SafeUserDto? = null,
    val to: SafeUserDto? = null,
)

data class ChallengePendingInvitesDto(val incoming: List<ChallengeInviteDto> = emptyList(), val outgoing: List<ChallengeInviteDto> = emptyList())

data class ChallengeQuestionDto(
    val index: Int,
    val number: Int? = null,
    val prompt: String,
    /** Shuffled independently per player — never assume this matches the opponent's order. */
    val options: List<String> = emptyList(),
    val remainingMs: Long? = null,
    val answered: Boolean = false,
    val selectedPosition: Int? = null,
    val opponentAnswered: Boolean = false,
)

data class ChallengeSideTotalsDto(val score: Int = 0, val correct: Int = 0, val wrong: Int = 0, val timeout: Int = 0)
data class ChallengeTotalsDto(val you: ChallengeSideTotalsDto = ChallengeSideTotalsDto(), val opponent: ChallengeSideTotalsDto = ChallengeSideTotalsDto())

data class ChallengeSideResultDto(val selectedText: String? = null, val outcome: String? = null, val points: Int = 0)
data class ChallengeResultRowDto(
    val index: Int,
    val number: Int? = null,
    val prompt: String,
    val options: List<String> = emptyList(),
    val correctPosition: Int? = null,
    val correctText: String? = null,
    val you: ChallengeSideResultDto = ChallengeSideResultDto(),
    val opponent: ChallengeSideResultDto = ChallengeSideResultDto(),
)

data class ChallengeMatchDto(
    val id: String,
    val version: Int = 0,
    val gameType: String? = null,
    val gameName: String? = null,
    val gameIcon: String? = null,
    val status: String = "active",
    val phase: String = "question",
    val total: Int = 0,
    val timeLimitSec: Int? = null,
    val currentIndex: Int = 0,
    val resultHoldMs: Long = 2600,
    val you: SafeUserDto? = null,
    val opponent: SafeUserDto? = null,
    val totals: ChallengeTotalsDto = ChallengeTotalsDto(),
    val current: ChallengeQuestionDto? = null,
    val results: List<ChallengeResultRowDto> = emptyList(),
    val outcome: String? = null,
    val rewardPoints: Int = 0,
    val rewardWithheld: String? = null,
)

data class ChallengeMatchWrapperDto(val match: ChallengeMatchDto)
data class ChallengeInviteRequest(val userId: String, val gameType: String)
data class ChallengeAnswerRequest(val questionIndex: Int, val selectedPosition: Int)
