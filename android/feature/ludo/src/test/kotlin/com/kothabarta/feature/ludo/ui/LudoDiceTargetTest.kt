package com.kothabarta.feature.ludo.ui

import com.kothabarta.core.network.ludo.LudoBoardStateDto
import com.kothabarta.core.network.ludo.LudoRulesDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LudoDiceTargetTest {
    @Test
    fun `only the rolling seat receives an animation event`() {
        val displayedSeats = listOf(3, 0, 2, 1)

        val targetIds = displayedSeats.map { seat -> diceAnimationIdForSeat(12L, rollerSeat = 2, seat = seat) }

        assertEquals(listOf(0L, 0L, 12L, 0L), targetIds)
    }

    @Test
    fun `no seat animates without a confirmed event owner`() {
        assertEquals(0L, diceAnimationIdForSeat(0L, rollerSeat = 2, seat = 2))
        assertEquals(0L, diceAnimationIdForSeat(12L, rollerSeat = null, seat = 2))
        assertEquals(0L, diceAnimationIdForSeat(12L, rollerSeat = 1, seat = 2))
    }

    @Test
    fun `active player highlight follows seat identity instead of displayed position`() {
        val displayedSeats = listOf(3, 0, 2, 1)

        assertEquals(listOf(false, false, true, false), displayedSeats.map { isActiveLudoPlayer(2, it) })
        assertFalse(isActiveLudoPlayer(null, 2))
    }

    @Test
    fun `dice owner follows roller through reveal and movement before settling on new turn`() {
        assertEquals(2, dicePresentationSeat(1, 2, false, true, false))
        assertEquals(2, dicePresentationSeat(1, 2, false, false, true))
        assertEquals(1, dicePresentationSeat(1, 2, false, false, false))
        assertEquals(1, dicePresentationSeat(1, 2, true, false, false))
    }

    @Test
    fun `bonus turn keeps the same dice owner`() {
        assertEquals(2, dicePresentationSeat(2, 2, false, false, false))
    }

    @Test
    fun `all participating dice show six initially without implying a confirmed roll`() {
        assertEquals(
            listOf(6, 6, 6, 6),
            (0..3).map { seat ->
                dicePresentationFace(seat, 0, "ROLL", null, null, null)
            },
        )
    }

    @Test
    fun `last confirmed result is displayed for the next turn without changing roller identity`() {
        val displayedSeats = listOf(3, 0, 2, 1)

        assertEquals(
            listOf(6, 4, 6, 4),
            displayedSeats.map { seat -> dicePresentationFace(seat, 1, "ROLL", 0, 4, null) },
        )
        assertEquals(2, dicePresentationFace(2, 2, "ROLL", 2, 2, null))
    }

    @Test
    fun `current legal-move phase uses the confirmed current die`() {
        assertEquals(3, dicePresentationFace(1, 1, "MOVE", 1, 3, 3))
    }

    @Test
    fun `quick home entrance barrier follows the authoritative rule and finished phase`() {
        val activeQuick = LudoBoardStateDto(
            variantId = "QUICK_CAPTURE",
            phase = "ROLL",
            rules = LudoRulesDto(allowHomeEntry = false),
        )
        val completedQuick = activeQuick.copy(phase = "FINISHED", winnerSeat = 0)
        val classic = activeQuick.copy(variantId = "CLASSIC_RANKED")
        val homeAllowedQuick = activeQuick.copy(rules = LudoRulesDto(allowHomeEntry = true))

        assertTrue(quickBarrierIsVisible(activeQuick))
        assertFalse(quickBarrierIsVisible(completedQuick))
        assertFalse(quickBarrierIsVisible(classic))
        assertFalse(quickBarrierIsVisible(homeAllowedQuick))
    }
}
