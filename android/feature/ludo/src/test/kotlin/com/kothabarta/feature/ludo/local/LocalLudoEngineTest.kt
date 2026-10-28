package com.kothabarta.feature.ludo.local

import org.junit.Assert.*
import org.junit.Test

class LocalLudoEngineTest {
    private class SequenceRoller(vararg values: Int) : DieRoller {
        private val rolls = ArrayDeque(values.toList())
        override fun roll() = rolls.removeFirst()
    }
    private fun engine(vararg dice: Int) = LocalLudoEngine(SequenceRoller(*dice))
    private fun setup(mode: LocalLudoMode, positions: List<Int>, seat: Int = 0) = LocalLudoEngine(DieRoller { 1 }).newGame(mode).let { s ->
        s.copy(turnSeat = seat, players = s.players.map { p -> if (p.seat == seat) p.copy(tokens = positions.mapIndexed { i, pos -> LocalToken(i, pos) }) else p })
    }

    @Test fun sixReleasesTokenAndExtraTurnIsRetained() {
        val e = engine(6, 1)
        val first = e.roll(e.newGame(LocalLudoMode.CLASSIC))
        val released = e.move(first, 0)
        assertEquals(0, released.players.first { it.seat == 0 }.tokens[0].position)
        val second = e.roll(released)
        assertEquals(1, second.players.first { it.seat == 0 }.tokens[0].position)
        assertEquals(1, second.turnSeat)
    }

    @Test fun invalidOrRepeatedActionsDoNotChangeState() {
        val e = engine(3)
        val moved = e.roll(setup(LocalLudoMode.CLASSIC, listOf(0, 10, -1, -1)))
        assertThrows(IllegalStateException::class.java) { e.roll(moved) }
        assertThrows(IllegalStateException::class.java) { e.move(moved, 2) }
    }

    @Test fun safeCellPreventsCaptureAndOrdinaryCellCaptures() {
        val e = engine(1, 1)
        val safe = setup(LocalLudoMode.CLASSIC, listOf(7, 0, -1, -1)).copy(players = setup(LocalLudoMode.CLASSIC, listOf(7, 0, -1, -1)).players.map { p -> if (p.seat == 2) p.copy(tokens = listOf(LocalToken(0, 34), LocalToken(1), LocalToken(2), LocalToken(3))) else p })
        assertTrue(e.roll(safe).legalMoves.first { it.tokenId == 0 }.captures.isEmpty())
        val unsafe = safe.copy(players = safe.players.map { p -> if (p.seat == 0) p.copy(tokens = listOf(LocalToken(0, 8), LocalToken(1, 0), LocalToken(2), LocalToken(3))) else if (p.seat == 2) p.copy(tokens = listOf(LocalToken(0, 35), LocalToken(1), LocalToken(2), LocalToken(3))) else p })
        val capture = e.roll(unsafe)
        val after = e.move(capture, 0)
        assertEquals(-1, after.players.first { it.seat == 2 }.tokens[0].position)
        assertEquals(1, after.players.first { it.seat == 0 }.captures)
        assertEquals(0, after.turnSeat) // capture grants its bonus turn
    }

    @Test fun quickCaptureWinsImmediatelyAndHomeIsForbidden() {
        val e = engine(6, 1)
        val blockedHome = setup(LocalLudoMode.QUICK, listOf(50, -1, -1, -1))
        val blocked = e.roll(blockedHome)
        assertEquals(50, blocked.players.first { it.seat == 0 }.tokens[0].position)
        assertEquals(6, blocked.dice)
        assertFalse(blocked.legalMoves.any { it.tokenId == 0 })
        val captureState = setup(LocalLudoMode.QUICK, listOf(22, 10, -1, -1)).copy(players = setup(LocalLudoMode.QUICK, listOf(22, 10, -1, -1)).players.map { p -> if (p.seat == 2) p.copy(tokens = listOf(LocalToken(0, 49), LocalToken(1), LocalToken(2), LocalToken(3))) else p })
        val rolled = e.roll(captureState); val won = e.move(rolled, 0)
        assertEquals(0, won.winnerSeat); assertEquals("FINISHED", won.phase)
    }

    @Test fun exactHomeEntryAndClassicCompletion() {
        val overshoot = engine(2).roll(setup(LocalLudoMode.CLASSIC, listOf(55, -1, -1, -1)))
        assertTrue(overshoot.legalMoves.isEmpty())
        val finish = engine(2).roll(setup(LocalLudoMode.CLASSIC, listOf(54, -1, -1, -1)))
        val after = finish
        assertEquals(56, after.players.first { it.seat == 0 }.tokens[0].position)
        assertEquals(0, after.turnSeat)
    }

    @Test fun classicEntersHomeLaneAfterLastSharedTrackCell() {
        val result = engine(1).roll(setup(LocalLudoMode.CLASSIC, listOf(50, -1, -1, -1)))
        assertEquals(51, result.players.first { it.seat == 0 }.tokens[0].position)
    }

    @Test fun finishingThreePlayersCompletesClassicGame() {
        val e = engine(1)
        var s = setup(LocalLudoMode.CLASSIC, listOf(55, 56, 56, 56))
        s = s.copy(finishOrder = listOf(1, 2, 3), players = s.players.map { p -> if (p.seat == 0) p else p.copy(status = "FINISHED") })
        val done = e.roll(s)
        assertEquals("FINISHED", done.phase); assertEquals(1, done.winnerSeat)
    }

    @Test fun thirdConsecutiveSixPassesTurn() {
        val e = engine(6, 6, 6)
        var s = setup(LocalLudoMode.CLASSIC, listOf(0, 10, -1, -1))
        s = e.roll(s); s = e.move(s, 0); s = e.roll(s); s = e.move(s, 0)
        val third = e.roll(s)
        assertEquals(1, third.turnSeat); assertEquals("ROLL", third.phase)
    }

    @Test fun localSetupCreatesTheSelectedPlayerCountAtNonOverlappingSupportedSeats() {
        val e = engine(1)

        assertEquals(listOf(0, 2), e.newGame(LocalLudoMode.CLASSIC, listOf("A", "B")).players.map { it.seat })
        assertEquals(listOf(0, 1, 2), e.newGame(LocalLudoMode.CLASSIC, listOf("A", "B", "C")).players.map { it.seat })
        assertEquals(listOf(0, 1, 2, 3), e.newGame(LocalLudoMode.CLASSIC).players.map { it.seat })
    }

    @Test fun exitingTheActivePlayerAdvancesToTheNextConfiguredSeatAndRemovesTheirTokens() {
        val e = engine(3)
        val threePlayers = e.newGame(LocalLudoMode.CLASSIC, listOf("A", "B", "C"))
        val afterExit = e.leave(threePlayers.copy(phase = "MOVE", dice = 3), seat = 0)

        assertEquals(listOf(1, 2), afterExit.players.map { it.seat })
        assertEquals(1, afterExit.turnSeat)
        assertEquals("ROLL", afterExit.phase)
        assertNull(afterExit.dice)
        assertTrue(afterExit.legalMoves.isEmpty())
    }

    @Test fun exitingTheOnlyRemainingParticipantFinishesWithoutInventingAWinner() {
        val e = engine(1)
        val onePlayerLeft = e.newGame(LocalLudoMode.CLASSIC, listOf("A", "B")).let { state ->
            e.leave(state, seat = 0)
        }
        val noPlayersLeft = e.leave(onePlayerLeft, seat = 2)

        assertEquals("FINISHED", noPlayersLeft.phase)
        assertNull(noPlayersLeft.winnerSeat)
        assertTrue(noPlayersLeft.players.isEmpty())
    }

    @Test fun leavingDuringMoveRecomputesCapturesAgainstRemainingParticipants() {
        val e = engine(2)
        val initial = setup(LocalLudoMode.QUICK, listOf(0, 10, -1, -1)).copy(
            players = setup(LocalLudoMode.QUICK, listOf(0, 10, -1, -1)).players.map { player ->
                if (player.seat == 2) player.copy(tokens = listOf(LocalToken(0, 28), LocalToken(1), LocalToken(2), LocalToken(3)))
                else player
            },
        )
        val moveState = e.roll(initial)
        assertTrue(moveState.legalMoves.first { it.tokenId == 0 }.captures.isNotEmpty())

        val afterExit = e.leave(moveState, seat = 2)
        assertTrue(afterExit.legalMoves.first { it.tokenId == 0 }.captures.isEmpty())
        val moved = e.move(afterExit, 0)

        assertNull(moved.winnerSeat)
        assertEquals("ROLL", moved.phase)
    }
}
