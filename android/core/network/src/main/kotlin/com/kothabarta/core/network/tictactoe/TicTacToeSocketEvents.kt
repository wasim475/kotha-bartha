package com.kothabarta.core.network.tictactoe

import com.kothabarta.core.network.social.SafeUserDto

data class TttStateEvent(val gameId: String, val game: TttGameDto? = null)
data class TttMoveEvent(val gameId: String, val cellIndex: Int = -1, val symbol: String? = null, val game: TttGameDto? = null)
data class TttFinishedEvent(val gameId: String, val game: TttGameDto? = null)
data class TttPlayerLeftEvent(val gameId: String, val userId: String? = null, val game: TttGameDto? = null)
data class TttInviteLifecycleEvent(
    val invite: TttInviteDto? = null,
    val inviteId: String? = null,
    val requestId: String? = null,
    val kind: String? = null,
    val gameId: String? = null,
)
data class TttPresenceEvent(val userId: String, val isOnline: Boolean, val user: SafeUserDto? = null)
data class TttReactionEvent(val gameId: String, val from: String? = null, val type: String? = null, val at: String? = null)
