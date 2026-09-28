package com.kothabarta.core.network.ludo

/**
 * `ludo:state`/`ludo:roll`/`ludo:move`/`ludo:capture`/`ludo:turn`/`ludo:timer`/
 * `ludo:finished` all share enough fields that one tolerant DTO (everything
 * optional/defaulted) decodes all of them — Moshi ignores whatever a given
 * event doesn't carry. See docs/architecture/android-realtime-contract.md.
 */
data class LudoStateEvent(
    val gameId: String,
    val version: Int = 0,
    /** The server sends the board-state view here (`view.game`, i.e. [LudoBoardStateDto]), not the lobby-wrapping [LudoGameDto]. */
    val game: LudoBoardStateDto? = null,
    val results: List<LudoResultDto>? = null,
    val status: String? = null,
    val seat: Int? = null,
    val turnNumber: Int? = null,
    val turnDeadline: Long? = null,
    val phase: String? = null,
)

data class LudoLobbyEvent(val gameId: String, val game: LudoGameDto? = null)
data class LudoTakeoverEvent(val gameId: String)
data class LudoChatEvent(val gameId: String, val from: String? = null, val text: String? = null, val at: String? = null)
data class LudoReactionEvent(val gameId: String, val from: String? = null, val type: String? = null, val at: String? = null)

/**
 * Shared decode shape for both the invite lifecycle
 * (`ludo:invite`/`:accepted`/`:declined`/`:cancelled`/`:expired`) and the
 * rematch lifecycle (`ludo:rematch`/`:accepted`/`:declined`/`:cancelled`/
 * `:expired`) broadcasts — mirrors `ChallengeInviteLifecycleEvent`
 * (`games/GameChallengeSocketEvents.kt`); rematch events simply leave
 * [invite] null and populate [gameId] with the resulting game.
 */
data class LudoInviteLifecycleEvent(
    val invite: LudoInviteDto? = null,
    val gameId: String? = null,
    val requestId: String? = null,
)
