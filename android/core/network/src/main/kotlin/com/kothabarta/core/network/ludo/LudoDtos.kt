package com.kothabarta.core.network.ludo

import com.kothabarta.core.network.social.SafeUserDto

/**
 * Variant ids — exact values from `server/src/games/ludo/variants.js` (see
 * docs/architecture/android-implementation-plan.md's Study/Quiz/Games phase
 * notes): `QUICK_CAPTURE` (first capture wins), `CAPTURE_AND_HOME`
 * (capture + one token home), `CLASSIC_RANKED` (all 4 home, ranked),
 * `LOCAL_CLASSIC` (offline pass-and-play — not implemented on Android this
 * pass, see the phase's limitations).
 */
data class LudoVariantDto(
    val id: String,
    val title: String,
    val description: String? = null,
    val minPlayers: Int = 2,
    val maxPlayers: Int = 4,
    val tokenCount: Int = 4,
    val winningRule: String? = null,
    val rulesSummary: List<String> = emptyList(),
    val online: Boolean = true,
    val local: Boolean = false,
    val rankingEnabled: Boolean = false,
)

data class LudoCatalogResponse(val enabled: Boolean = true, val variants: List<LudoVariantDto> = emptyList())

data class LudoMemberDto(val user: SafeUserDto? = null, val ready: Boolean = false, val online: Boolean = false)

data class LudoTokenDto(val id: Int, val pos: Int)

data class LudoPlayerDto(
    val seat: Int,
    val userId: String? = null,
    val color: String? = null,
    val status: String = "ACTIVE",
    val rank: Int? = null,
    val connected: Boolean = true,
    val captures: Int = 0,
    val tokens: List<LudoTokenDto> = emptyList(),
    val user: SafeUserDto? = null,
)

data class LudoLegalMoveDto(val tokenId: Int, val from: Int = -1, val to: Int = -1, val kind: String? = null)

/**
 * The server already computes exactly which tokens can move — [legal] is
 * what Android highlights, never something it infers itself (see
 * docs/architecture/android-games.md's server-authority rule, extended here
 * to Ludo).
 */
data class LudoBoardStateDto(
    val version: Int = 0,
    val variantId: String? = null,
    val phase: String = "ROLL",
    val players: List<LudoPlayerDto> = emptyList(),
    val turnSeat: Int? = null,
    val turnNumber: Int = 0,
    val turnDeadline: Long? = null,
    val dice: Int? = null,
    val legal: List<LudoLegalMoveDto> = emptyList(),
    val winnerSeat: Int? = null,
    val finishReason: String? = null,
)

data class LudoResultDto(
    val user: SafeUserDto? = null,
    val seat: Int,
    val rank: Int? = null,
    val result: String? = null,
    val captures: Int = 0,
    val tokensHome: Int = 0,
    val rewardPoints: Int = 0,
    val rewardXp: Int = 0,
)

data class LudoSettingsDto(val minPlayers: Int = 2, val maxPlayers: Int = 4, val autoStart: Boolean = false)

data class LudoRematchInfoDto(val gameId: String? = null, val status: String? = null, val hostId: String? = null)

data class LudoGameDto(
    val id: String,
    val variantId: String,
    val status: String = "lobby",
    val hostId: String? = null,
    val settings: LudoSettingsDto? = null,
    val expectedPlayers: Int = 4,
    val members: List<LudoMemberDto> = emptyList(),
    val game: LudoBoardStateDto? = null,
    val results: List<LudoResultDto>? = null,
    val startedAt: String? = null,
    val finishedAt: String? = null,
    val mySeat: Int? = null,
    val rematch: LudoRematchInfoDto? = null,
)

data class LudoGameWrapperDto(val game: LudoGameDto)

data class LudoInviteDto(
    val id: String,
    val kind: String = "invite",
    val status: String = "pending",
    val expiresAt: String? = null,
    val gameId: String? = null,
    val from: SafeUserDto? = null,
    val to: SafeUserDto? = null,
)

data class LudoPendingInvitesDto(val incoming: List<LudoInviteDto> = emptyList(), val outgoing: List<LudoInviteDto> = emptyList())

data class LudoStatsDto(
    val played: Int = 0,
    val wins: Int = 0,
    val losses: Int = 0,
    val draws: Int = 0,
    val winRate: Double? = null,
    val points: Int = 0,
    val xp: Int = 0,
    val level: Int = 1,
)

data class CreateLudoLobbyRequest(val variantId: String, val maxPlayers: Int? = null, val autoStart: Boolean? = null)
data class LudoInviteRequest(val gameId: String, val userId: String)
data class LudoReadyRequest(val ready: Boolean)
