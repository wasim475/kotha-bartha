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
    val game: LudoGameDto? = null,
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
