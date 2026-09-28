package com.kothabarta.core.network.tictactoe

import com.kothabarta.core.network.social.SafeUserDto

data class TttSettingsDto(val gameRequests: String = "friends")

data class TttStatsDto(val played: Int = 0, val wins: Int = 0, val losses: Int = 0, val draws: Int = 0, val winPoints: Int = 0)

data class TttRematchInfoDto(
    val requestId: String? = null,
    val direction: String? = null,
    val status: String? = null,
    val expiresAt: String? = null,
    val gameId: String? = null,
)

data class TttInviteDto(
    val id: String,
    val kind: String = "invite",
    val status: String = "pending",
    val expiresAt: String? = null,
    val createdAt: String? = null,
    val gameId: String? = null,
    val previousGameId: String? = null,
    val from: SafeUserDto? = null,
    val to: SafeUserDto? = null,
)

data class TttPendingInvitesDto(
    val incoming: List<TttInviteDto> = emptyList(),
    val outgoing: List<TttInviteDto> = emptyList(),
)

data class TttGameDto(
    val id: String,
    val gameType: String = "tic-tac-toe",
    val status: String = "waiting",
    /** 9 cells, row-major, each `null`, `"X"` or `"O"`. */
    val board: List<String?> = emptyList(),
    val currentTurn: String = "X",
    val winner: String? = null,
    val winnerId: String? = null,
    val winningLine: List<Int> = emptyList(),
    val moveCount: Int = 0,
    /** 5 on a won game, otherwise 0 — this field IS the "+5" reward, not a separate value. */
    val rewardPoints: Int = 0,
    val abandonedBy: String? = null,
    val rematchOf: String? = null,
    val playerX: SafeUserDto? = null,
    val playerO: SafeUserDto? = null,
    val startedAt: String? = null,
    val finishedAt: String? = null,
    val rematch: TttRematchInfoDto? = null,
)

data class TttGameWrapperDto(val game: TttGameDto)

data class TttMoveRequest(val cellIndex: Int)
data class TttInviteRequest(val userId: String)
