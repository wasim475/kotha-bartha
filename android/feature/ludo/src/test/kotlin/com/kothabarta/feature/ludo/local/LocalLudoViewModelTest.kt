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
}
