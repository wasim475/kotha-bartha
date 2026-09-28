package com.kothabarta.feature.calls.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.kothabarta.core.ui.theme.Spacing
import com.kothabarta.feature.calls.domain.CallSessionManager
import kotlinx.coroutines.delay
import org.koin.compose.koinInject

private val ACTIVE_CALL_STATUSES = setOf("accepted", "connecting", "connected", "reconnecting")
private const val ERROR_TOAST_AUTO_DISMISS_MS = 6000L

/**
 * The always-mounted overlay — mirrors the web client's
 * `CallProvider`/`CallGlobalHost` pairing mounted once at the router root, so
 * it survives navigation to any bottom-nav tab. Mount this once, as a sibling
 * to the app's `NavHost` (see `MainScreen.kt`), never per-screen.
 */
@Composable
fun CallGlobalHost(callSessionManager: CallSessionManager = koinInject()) {
    val state by callSessionManager.state.collectAsState()

    val showIncomingCard = state.status == "ringing" && state.role == "callee"
    val showActiveCallUi = (state.status == "ringing" && state.role == "caller") || state.status in ACTIVE_CALL_STATUSES

    Box(modifier = Modifier.fillMaxSize()) {
        if (showActiveCallUi) {
            if (state.minimized) {
                FloatingCallBar(state = state, callSessionManager = callSessionManager, modifier = Modifier.align(Alignment.TopStart))
            } else {
                ActiveCallScreen(state = state, callSessionManager = callSessionManager)
            }
        }

        if (showIncomingCard) {
            IncomingCallCard(
                state = state,
                callSessionManager = callSessionManager,
                modifier = Modifier.align(Alignment.TopCenter),
            )
        }

        state.participantInvite?.let { invite ->
            ParticipantInviteCard(
                event = invite,
                callSessionManager = callSessionManager,
                modifier = Modifier.align(Alignment.BottomCenter),
            )
        }

        state.error?.let { error ->
            LaunchedEffect(error) {
                delay(ERROR_TOAST_AUTO_DISMISS_MS)
                callSessionManager.dismissError()
            }
            Surface(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(Spacing.md),
                tonalElevation = 4.dp,
                color = MaterialTheme.colorScheme.errorContainer,
            ) {
                Text(
                    error,
                    modifier = Modifier.padding(horizontal = Spacing.md, vertical = Spacing.sm),
                    color = MaterialTheme.colorScheme.onErrorContainer,
                )
            }
        }
    }
}
