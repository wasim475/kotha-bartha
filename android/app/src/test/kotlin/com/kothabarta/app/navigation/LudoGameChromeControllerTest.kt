package com.kothabarta.app.navigation

import com.kothabarta.core.navigation.Routes
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class LudoGameChromeControllerTest {
    @Test
    fun `first back reveals app chrome and it auto hides after three seconds`() = runTest {
        val controller = LudoGameChromeController(this)

        assertEquals(LudoBackAction.REVEALED_CHROME, controller.onBackPressed())
        assertTrue(controller.visible.value)
        advanceTimeBy(2_999)
        runCurrent()
        assertTrue(controller.visible.value)
        advanceTimeBy(1)
        runCurrent()
        assertFalse(controller.visible.value)
    }

    @Test
    fun `a repeated back resets the timeout and requests normal navigation`() = runTest {
        val controller = LudoGameChromeController(this)
        controller.onBackPressed()
        advanceTimeBy(2_000)

        assertEquals(LudoBackAction.NAVIGATE_BACK, controller.onBackPressed())
        advanceTimeBy(2_000)
        runCurrent()
        assertTrue(controller.visible.value)
        advanceTimeBy(999)
        runCurrent()
        assertTrue(controller.visible.value)
        advanceTimeBy(1)
        runCurrent()
        assertFalse(controller.visible.value)
    }

    @Test
    fun `leaving gameplay resets chrome and cancels its pending timeout`() = runTest {
        val controller = LudoGameChromeController(this)
        controller.onBackPressed()
        controller.reset()
        advanceTimeBy(3_000)
        runCurrent()

        assertFalse(controller.visible.value)
    }

    @Test
    fun `immersive app chrome is limited to Ludo game destinations`() {
        assertTrue(isLudoGameplayRoute(Routes.LUDO_GAME_PATTERN))
        assertTrue(isLudoGameplayRoute(Routes.LUDO_LOCAL_GAME_PATTERN))
        assertFalse(isLudoGameplayRoute(Routes.LUDO))
        assertFalse(isLudoGameplayRoute(Routes.HOME))
    }
}
