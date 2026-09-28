package com.kothabarta.feature.ludo.data

import com.kothabarta.core.network.ludo.LudoBoardStateDto
import com.kothabarta.core.network.ludo.LudoGameDto

/**
 * Request/ack payload shapes for the `ludo:*` socket actions — kept local to
 * this feature module (not `core:network`) since they only bridge
 * `emitWithAck`/`Ack` args, mirroring how `decodeSocketPayload` is used
 * elsewhere rather than being REST contract DTOs.
 */
data class LudoGameIdRequest(val gameId: String)
data class LudoReadySocketRequest(val gameId: String, val ready: Boolean)
data class LudoRollRequest(val gameId: String, val expectedVersion: Int, val actionId: String)
data class LudoMoveRequest(val gameId: String, val tokenId: Int, val expectedVersion: Int, val actionId: String)
data class LudoChatRequest(val gameId: String, val text: String)
data class LudoReactionRequest(val gameId: String, val type: String)

/** `ludo:join`/`ludo:ready`/`ludo:start` acks — `game` is the lobby-wrapping view, same shape REST returns. */
data class LudoLobbyAck(val ok: Boolean = false, val game: LudoGameDto? = null)

/** `ludo:roll`/`ludo:move` acks — `game` here is the board-state view, matching `LudoStateEvent.game`; `events` is ignored. */
data class LudoBoardAck(val ok: Boolean = false, val game: LudoBoardStateDto? = null)

data class LudoSimpleAck(val ok: Boolean = false)
