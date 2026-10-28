package com.kothabarta.feature.ludo.local

import java.security.SecureRandom

/** Offline port of server/src/games/ludo/engine.js for Quick and Classic. */
enum class LocalLudoMode(val variantId: String, val title: String, val allowHome: Boolean, val quickWin: Boolean) {
    QUICK("QUICK_CAPTURE", "Quick", false, true),
    CLASSIC("CLASSIC_RANKED", "Classic", true, false),
}

fun interface DieRoller { fun roll(): Int }
class SecureDieRoller(private val random: SecureRandom = SecureRandom()) : DieRoller {
    override fun roll(): Int = random.nextInt(6) + 1
}

data class LocalToken(val id: Int, val position: Int = LocalLudoEngine.IN_BASE)
data class LocalPlayer(
    val seat: Int, val name: String, val tokens: List<LocalToken> = (0..3).map { LocalToken(it) },
    val status: String = "ACTIVE", val captures: Int = 0,
)
data class LocalMove(val tokenId: Int, val from: Int, val to: Int, val captures: List<Pair<Int, Int>>)
data class LocalLudoState(
    val mode: LocalLudoMode, val players: List<LocalPlayer>, val turnSeat: Int = 0,
    val turnNumber: Int = 1, val phase: String = "ROLL", val dice: Int? = null,
    val legalMoves: List<LocalMove> = emptyList(), val consecutiveSixes: Int = 0,
    val winnerSeat: Int? = null, val finishOrder: List<Int> = emptyList(), val version: Long = 0,
    val lastRollValue: Int? = null, val lastRollHadNoMoves: Boolean = false,
    val lastRollSeat: Int? = null,
)

/** Pure transition engine; every accepted action returns one new version. */
class LocalLudoEngine(private val roller: DieRoller) {
    fun newGame(mode: LocalLudoMode, playerNames: List<String> = listOf("Player 1", "Player 2", "Player 3", "Player 4")): LocalLudoState {
        require(playerNames.size in 2..4)
        val seats = when (playerNames.size) { 2 -> listOf(0, 2); 3 -> listOf(0, 1, 2); else -> listOf(0, 1, 2, 3) }
        return LocalLudoState(mode, playerNames.mapIndexed { i, n -> LocalPlayer(seats[i], n.ifBlank { "Player ${i + 1}" }.take(24)) }, turnSeat = seats.first())
    }

    fun leave(state: LocalLudoState, seat: Int): LocalLudoState {
        require(state.players.any { it.seat == seat }) { "Player is not part of this game" }
        val remaining = state.players.filterNot { it.seat == seat }
        if (remaining.size <= 1) {
            return state.copy(
                players = remaining,
                turnSeat = remaining.singleOrNull()?.seat ?: -1,
                phase = "FINISHED",
                dice = null,
                legalMoves = emptyList(),
                winnerSeat = remaining.singleOrNull()?.seat,
                version = state.version + 1,
            )
        }
        if (state.turnSeat != seat) {
            val updated = state.copy(players = remaining, version = state.version + 1)
            return if (updated.phase == "MOVE" && updated.dice != null) {
                updated.copy(legalMoves = legalMoves(updated, updated.dice))
            } else updated
        }
        val nextSeat = nextActiveSeat(remaining, seat)
        return state.copy(
            players = remaining,
            turnSeat = nextSeat ?: -1,
            turnNumber = state.turnNumber + 1,
            phase = if (nextSeat == null) "FINISHED" else "ROLL",
            dice = null,
            legalMoves = emptyList(),
            consecutiveSixes = 0,
            winnerSeat = null,
            version = state.version + 1,
        )
    }

    fun rename(state: LocalLudoState, seat: Int, name: String): LocalLudoState {
        val normalizedName = name.trim()
        require(normalizedName.isNotEmpty()) { "Player name cannot be blank" }
        require(normalizedName.length <= MAX_PLAYER_NAME_LENGTH) {
            "Player name must be $MAX_PLAYER_NAME_LENGTH characters or fewer"
        }
        require(state.players.any { it.seat == seat }) { "Player is not part of this game" }
        return state.copy(
            players = state.players.map { player ->
                if (player.seat == seat) player.copy(name = normalizedName) else player
            },
            version = state.version + 1,
        )
    }

    fun roll(state: LocalLudoState): LocalLudoState {
        check(state.phase == "ROLL") { "A roll is not expected now" }
        if (state.winnerSeat != null) return state
        val value = roller.roll()
        require(value in 1..6) { "Die roller must return 1..6" }
        val sixes = if (value == 6) state.consecutiveSixes + 1 else 0
        if (value == 6 && sixes >= 3) return pass(state.copy(dice = value, consecutiveSixes = 0, lastRollValue = value, lastRollHadNoMoves = true, lastRollSeat = state.turnSeat))
        val moves = legalMoves(state, value)
        if (moves.isEmpty()) return if (value == 6) state.copy(phase = "ROLL", dice = null, legalMoves = emptyList(), consecutiveSixes = sixes, version = state.version + 1, lastRollValue = value, lastRollHadNoMoves = true, lastRollSeat = state.turnSeat)
            else pass(state.copy(dice = value, consecutiveSixes = 0, lastRollValue = value, lastRollHadNoMoves = true, lastRollSeat = state.turnSeat))
        val rolled = state.copy(phase = "MOVE", dice = value, legalMoves = moves, consecutiveSixes = sixes, version = state.version + 1, lastRollValue = value, lastRollHadNoMoves = false, lastRollSeat = state.turnSeat)
        return if (moves.size == 1) move(rolled, moves.single().tokenId) else rolled
    }

    fun move(state: LocalLudoState, tokenId: Int): LocalLudoState {
        check(state.phase == "MOVE" && state.winnerSeat == null) { "A token move is not expected now" }
        val move = state.legalMoves.singleOrNull { it.tokenId == tokenId } ?: error("Token is not a legal move")
        val players = state.players.map { player ->
            when {
                player.seat == state.turnSeat -> player.copy(
                    tokens = player.tokens.map { if (it.id == tokenId) it.copy(position = move.to) else it },
                    captures = player.captures + move.captures.size,
                )
                move.captures.any { it.first == player.seat } -> player.copy(tokens = player.tokens.map { token ->
                    if (move.captures.any { it.first == player.seat && it.second == token.id }) token.copy(position = IN_BASE) else token
                })
                else -> player
            }
        }
        val mover = players.first { it.seat == state.turnSeat }
        if (state.mode.quickWin && move.captures.isNotEmpty()) return state.copy(players = players, winnerSeat = state.turnSeat, phase = "FINISHED", dice = null, legalMoves = emptyList(), version = state.version + 1)
        val finishedNow = mover.tokens.all { it.position == FINISH }
        val marked = if (finishedNow) players.map { if (it.seat == state.turnSeat) it.copy(status = "FINISHED") else it } else players
        val order = if (finishedNow) state.finishOrder + state.turnSeat else state.finishOrder
        val active = marked.filter { it.status == "ACTIVE" }
        if (!state.mode.quickWin && active.size <= 1) return state.copy(players = marked, finishOrder = order, winnerSeat = order.firstOrNull() ?: active.singleOrNull()?.seat, phase = "FINISHED", dice = null, legalMoves = emptyList(), version = state.version + 1)
        val bonus = !finishedNow && (state.dice == 6 || move.captures.isNotEmpty() || move.to == FINISH)
        return if (bonus) state.copy(players = marked, finishOrder = order, phase = "ROLL", dice = null, legalMoves = emptyList(), version = state.version + 1)
        else advance(state.copy(players = marked, finishOrder = order, consecutiveSixes = 0))
    }

    private fun legalMoves(state: LocalLudoState, dice: Int): List<LocalMove> {
        val mover = state.players.first { it.seat == state.turnSeat }
        return mover.tokens.mapNotNull { token ->
            if (token.position == FINISH) return@mapNotNull null
            val to = if (token.position == IN_BASE) { if (dice != 6) return@mapNotNull null else 0 }
                else token.position + dice
            if (to > FINISH || (!state.mode.allowHome && to > LAST_TRACK_REL)) return@mapNotNull null
            val captures = if (to !in 0..LAST_TRACK_REL) emptyList() else {
                val abs = (STARTS[mover.seat] + to) % 52
                if (abs in SAFE_CELLS) emptyList() else state.players.filter { it.seat != mover.seat && it.status == "ACTIVE" }
                    .flatMap { p -> p.tokens.filter { it.position in 0..LAST_TRACK_REL && (STARTS[p.seat] + it.position) % 52 == abs }.map { p.seat to it.id } }
            }
            LocalMove(token.id, token.position, to, captures)
        }
    }

    private fun pass(s: LocalLudoState): LocalLudoState = advance(s.copy(dice = null, legalMoves = emptyList(), consecutiveSixes = 0))
    private fun advance(s: LocalLudoState): LocalLudoState {
        val next = nextActiveSeat(s.players, s.turnSeat)
        return if (next == null) s.copy(phase = "FINISHED", dice = null, legalMoves = emptyList(), version = s.version + 1)
        else s.copy(turnSeat = next, turnNumber = s.turnNumber + 1, phase = "ROLL", dice = null, legalMoves = emptyList(), version = s.version + 1)
    }

    private fun nextActiveSeat(players: List<LocalPlayer>, currentSeat: Int): Int? {
        if (players.none { it.status == "ACTIVE" }) return null
        return (1..4).asSequence()
            .map { (currentSeat + it) % 4 }
            .firstOrNull { seat -> players.any { it.seat == seat && it.status == "ACTIVE" } }
    }

    companion object {
        const val MAX_PLAYER_NAME_LENGTH = 24
        const val IN_BASE = -1; const val FINISH = 56; const val LAST_TRACK_REL = 50
        val STARTS = listOf(0, 13, 26, 39)
        val SAFE_CELLS = setOf(0, 8, 13, 21, 26, 34, 39, 47)
    }
}
