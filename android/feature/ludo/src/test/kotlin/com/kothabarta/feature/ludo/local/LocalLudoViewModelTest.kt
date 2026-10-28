package com.kothabarta.feature.ludo.local

import com.kothabarta.feature.ludo.ui.diceAnimationIdForSeat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class LocalLudoViewModelTest {
    @Before
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `accepted local roll emits one animation for its seat regardless of display order`() = runTest {
        val viewModel = LocalLudoViewModel("QUICK_CAPTURE", DieRoller { 6 })

        viewModel.roll()
        assertEquals(0L, viewModel.diceAnimationId.value)
        advanceTimeBy(850)
        runCurrent()

        val animationId = viewModel.diceAnimationId.value
        assertEquals(1L, animationId)
        assertEquals(0, viewModel.state.value.lastRollSeat)
        assertEquals(listOf(0L, 0L, animationId, 0L), listOf(3, 2, 0, 1).map { seat ->
            diceAnimationIdForSeat(animationId, viewModel.state.value.lastRollSeat, seat)
        })
        assertTrue(viewModel.claimDiceAnimation(animationId))
        assertFalse(viewModel.claimDiceAnimation(animationId))
        assertTrue(viewModel.isDiceRevealAnimating.value)
        viewModel.onRollAnimationFinished(animationId)
        assertFalse(viewModel.isDiceRevealAnimating.value)
    }

    @Test
    fun `leaving during the roll delay cancels the accepted request without a late result`() = runTest {
        val viewModel = LocalLudoViewModel("CLASSIC_RANKED", DieRoller { 6 })

        viewModel.roll()
        advanceTimeBy(300)
        viewModel.leavePlayer(0)
        advanceTimeBy(1_000)
        runCurrent()

        assertEquals(1, viewModel.state.value.turnSeat)
        assertEquals(0L, viewModel.diceAnimationId.value)
        assertFalse(viewModel.isRolling.value)
        assertFalse(viewModel.isDiceRevealAnimating.value)
    }

    @Test
    fun `leaving during dice reveal clears the event and keeps later event ids unique`() = runTest {
        val rolls = ArrayDeque(listOf(6, 6))
        val viewModel = LocalLudoViewModel("CLASSIC_RANKED", DieRoller { rolls.removeFirst() })

        viewModel.roll()
        advanceTimeBy(850)
        runCurrent()
        assertEquals(1L, viewModel.diceAnimationId.value)
        assertTrue(viewModel.isDiceRevealAnimating.value)

        viewModel.leavePlayer(0)
        assertEquals(0L, viewModel.diceAnimationId.value)
        assertFalse(viewModel.isDiceRevealAnimating.value)
        assertEquals("ROLL", viewModel.state.value.phase)

        viewModel.roll()
        advanceTimeBy(850)
        runCurrent()

        assertEquals(2L, viewModel.diceAnimationId.value)
        assertEquals(1, viewModel.state.value.lastRollSeat)
    }

    @Test
    fun `renaming a local participant preserves their seat and rejects invalid names`() = runTest {
        val viewModel = LocalLudoViewModel("CLASSIC_RANKED", playerCount = 3)

        assertTrue(viewModel.renamePlayer(1, "  Green Player  "))
        assertEquals("Green Player", viewModel.state.value.players.first { it.seat == 1 }.name)
        assertEquals(listOf(0, 1, 2), viewModel.state.value.players.map { it.seat })
        assertFalse(viewModel.renamePlayer(1, " "))
        assertFalse(viewModel.renamePlayer(1, "x".repeat(25)))
        assertEquals("Green Player", viewModel.state.value.players.first { it.seat == 1 }.name)
    }
}
