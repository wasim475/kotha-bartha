package com.kothabarta.app.navigation

import com.kothabarta.core.navigation.Routes
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

internal enum class LudoBackAction {
    REVEALED_CHROME,
    NAVIGATE_BACK,
}

internal fun isLudoGameplayRoute(route: String?): Boolean =
    route == Routes.LUDO_GAME_PATTERN || route == Routes.LUDO_LOCAL_GAME_PATTERN

internal class LudoGameChromeController(
    private val scope: CoroutineScope,
    private val autoHideDelayMillis: Long = 3_000L,
) {
    private val _visible = MutableStateFlow(false)
    val visible = _visible.asStateFlow()
    private var hideJob: Job? = null

    fun onBackPressed(): LudoBackAction {
        val action = if (_visible.value) LudoBackAction.NAVIGATE_BACK else LudoBackAction.REVEALED_CHROME
        _visible.value = true
        scheduleHide()
        return action
    }

    fun reset() {
        hideJob?.cancel()
        hideJob = null
        _visible.value = false
    }

    private fun scheduleHide() {
        hideJob?.cancel()
        hideJob = scope.launch {
            delay(autoHideDelayMillis)
            _visible.value = false
            hideJob = null
        }
    }
}
