package com.kothabarta.feature.calls.ui

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.foundation.clickable
import com.kothabarta.core.ui.components.AvatarImage
import com.kothabarta.core.ui.theme.Spacing
import com.kothabarta.feature.calls.domain.CallSessionManager
import com.kothabarta.feature.calls.domain.CallUiState
import org.webrtc.SurfaceViewRenderer
import kotlin.math.roundToInt

/**
 * The full-screen in-call UI — mirrors the web client's `ActiveCall.jsx`.
 * Rendering here only ever *reads* [CallUiState] and calls
 * [CallSessionManager]'s public actions; no call/WebRTC logic lives here.
 */
@Composable
fun ActiveCallScreen(state: CallUiState, callSessionManager: CallSessionManager, modifier: Modifier = Modifier) {
    val mainShowsLocal = state.layoutSwapped
    val mainVideoReady = state.video && if (mainShowsLocal) state.localVideoReady else state.remoteVideoReady

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black),
    ) {
        MainVideoSurface(callSessionManager = callSessionManager, showLocal = mainShowsLocal)

        if (!mainVideoReady) {
            PulsingAvatarPlaceholder(state = state, modifier = Modifier.fillMaxSize())
        }

        DraggableLocalPip(
            state = state,
            callSessionManager = callSessionManager,
            modifier = Modifier.align(Alignment.TopEnd),
        )

        CallReactionsOverlay(reactions = state.reactions, modifier = Modifier.fillMaxSize())

        Column(
            modifier = Modifier
                .align(Alignment.TopStart)
                .fillMaxWidth()
                .padding(Spacing.md),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    QualityDot(quality = state.quality)
                    Text(
                        text = callStatusLabel(state),
                        color = Color.White,
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.padding(start = Spacing.xs),
                    )
                }
                Row {
                    IconButton(onClick = { callSessionManager.setMinimized(true) }) {
                        Text("–", color = Color.White, style = MaterialTheme.typography.headlineSmall)
                    }
                    IconButton(onClick = callSessionManager::endCall) {
                        Text("☎️", color = Color.White)
                    }
                }
            }
            if (state.audioOnlyFallback) {
                AudioOnlyFallbackBanner(callSessionManager = callSessionManager)
            }
        }

        CallControls(
            state = state,
            callSessionManager = callSessionManager,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(Spacing.md),
        )

        if (state.chatOpen) {
            CallChatPanel(
                state = state,
                callSessionManager = callSessionManager,
                modifier = Modifier.align(Alignment.CenterEnd),
            )
        }
    }
}

@Composable
private fun MainVideoSurface(callSessionManager: CallSessionManager, showLocal: Boolean, modifier: Modifier = Modifier) {
    AndroidView(
        factory = { context -> SurfaceViewRenderer(context).apply { setEnableHardwareScaler(true) } },
        modifier = modifier.fillMaxSize(),
        update = { renderer ->
            callSessionManager.eglBaseContext() ?: return@AndroidView
            if (showLocal) callSessionManager.attachLocalRenderer(renderer) else callSessionManager.attachRemoteRenderer(renderer)
        },
    )
}

@Composable
private fun BoxScope.DraggableLocalPip(state: CallUiState, callSessionManager: CallSessionManager, modifier: Modifier = Modifier) {
    if (!state.video) return
    val density = LocalDensity.current
    var offset by remember { mutableStateOf(Offset(with(density) { 16.dp.toPx() }, with(density) { 96.dp.toPx() })) }

    Box(
        modifier = modifier
            .padding(Spacing.md)
            .offset { IntOffset(offset.x.roundToInt(), offset.y.roundToInt()) }
            .size(width = 100.dp, height = 140.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(Color.DarkGray)
            .pointerInput(Unit) {
                detectDragGestures { change, dragAmount ->
                    change.consume()
                    offset += dragAmount
                }
            }
            .clickable { callSessionManager.toggleLayout() },
    ) {
        // Shows whichever feed is currently the "small" one — the opposite of the main surface.
        AndroidView(
            factory = { context -> SurfaceViewRenderer(context).apply { setEnableHardwareScaler(true) } },
            modifier = Modifier.fillMaxSize(),
            update = { renderer ->
                callSessionManager.eglBaseContext() ?: return@AndroidView
                if (state.layoutSwapped) callSessionManager.attachRemoteRenderer(renderer) else callSessionManager.attachLocalRenderer(renderer)
            },
        )
    }
}

@Composable
private fun PulsingAvatarPlaceholder(state: CallUiState, modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "call-avatar-pulse")
    val scale by transition.animateFloat(
        initialValue = 1f,
        targetValue = 1.08f,
        animationSpec = infiniteRepeatable(animation = tween(1200, easing = FastOutSlowInEasing), repeatMode = RepeatMode.Reverse),
        label = "call-avatar-scale",
    )
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        AvatarImage(
            avatarUrl = state.peer?.avatar?.secureUrl,
            initials = state.peer?.initials ?: state.peer?.fullName ?: "?",
            size = 96.dp,
            modifier = Modifier.scale(scale),
        )
    }
}

@Composable
private fun QualityDot(quality: String?) {
    if (quality.isNullOrEmpty()) return
    val color = when (quality) {
        "good" -> Color(0xFF4CAF50)
        "unstable" -> Color(0xFFFFA726)
        "poor" -> Color(0xFFE53935)
        else -> Color.Gray
    }
    Box(
        modifier = Modifier
            .size(10.dp)
            .clip(CircleShape)
            .background(color)
            .semantics { contentDescription = qualityTooltip(quality) },
    )
}

@Composable
private fun AudioOnlyFallbackBanner(callSessionManager: CallSessionManager) {
    Surface(
        color = MaterialTheme.colorScheme.errorContainer,
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = Spacing.sm),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.sm, vertical = Spacing.xs),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Video paused to improve connection",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onErrorContainer,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = callSessionManager::toggleCamera) { Text("Turn video back on") }
        }
    }
}
