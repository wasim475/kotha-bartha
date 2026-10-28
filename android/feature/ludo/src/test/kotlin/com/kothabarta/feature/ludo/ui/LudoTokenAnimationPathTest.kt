package com.kothabarta.feature.ludo.ui

import com.kothabarta.core.network.ludo.LudoBoardStateDto
import com.kothabarta.core.network.ludo.LudoLegalMoveDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class LudoTokenAnimationPathTest {
    @Test fun `track move visits every intermediate cell`() {
        val path = tokenAnimationPositions(seat = 0, from = 4, to = 9)
        assertEquals(5, path.size)
        assertEquals(5, path.distinct().size)
    }

    @Test fun `base exit and home lane use the same board geometry`() {
        val exit = tokenAnimationPositions(seat = 0, from = -1, to = 0)
        assertEquals(1, exit.size)
        val home = tokenAnimationPositions(seat = 0, from = 49, to = 53)
        assertEquals(4, home.size)
        assertNotEquals(home[0], home[1])
        assertNotEquals(home[2], home[3])
    }

    @Test fun `final home step is animated to the finish marker`() {
        val path = tokenAnimationPositions(seat = 2, from = 55, to = 56)
        assertEquals(1, path.size)
        assertEquals(7f to 7.65f, path.single())
    }

    @Test fun `tokens sharing a cell receive separate visual and hit centers`() {
        val first = tokenStackOffset(index = 0, count = 2)
        val second = tokenStackOffset(index = 1, count = 2)
        assertNotEquals(first, second)
    }

    @Test fun `only authoritative legal tokens for the active seat are highlighted`() {
        val board = LudoBoardStateDto(turnSeat = 1, legal = listOf(LudoLegalMoveDto(2), LudoLegalMoveDto(3)))
        assertEquals(setOf(2, 3), highlightedLegalTokenIds(board, seat = 1, enabled = true))
        assertEquals(emptySet<Int>(), highlightedLegalTokenIds(board, seat = 0, enabled = true))
        assertEquals(emptySet<Int>(), highlightedLegalTokenIds(board, seat = 1, enabled = false))
    }
}
