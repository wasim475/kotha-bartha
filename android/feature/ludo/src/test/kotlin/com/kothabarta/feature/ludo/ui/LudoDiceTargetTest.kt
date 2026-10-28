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
