package com.kothabarta.feature.calls.ui

import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.kothabarta.core.ui.theme.Spacing
import com.kothabarta.feature.calls.domain.CallSessionManager
import com.kothabarta.feature.calls.domain.CallUiState
import org.webrtc.SurfaceViewRenderer
import kotlin.math.roundToInt

/**
 * The minimized/floating call bar — a small draggable card, position kept in
 * local (non-persisted) Compose state only, matching the web client's own
 * floating-position behavior (it doesn't survive a reload there either).
 */
@Composable
fun FloatingCallBar(state: CallUiState, callSessionManager: CallSessionManager, modifier: Modifier = Modifier) {
    var offset by remember { mutableStateOf(Offset(24f, 160f)) }

    Card(
        modifier = modifier
            .offset { IntOffset(offset.x.roundToInt(), offset.y.roundToInt()) }
            .width(240.dp)
            .pointerInput(Unit) {
                detectDragGestures { change, dragAmount ->
                    change.consume()
                    offset += dragAmount
                }
            },
    ) {
        Row(modifier = Modifier.padding(Spacing.sm), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(8.dp)),
            ) {
                AndroidView(
                    factory = { context -> SurfaceViewRenderer(context).apply { setEnableHardwareScaler(true) } },
                    modifier = Modifier.size(48.dp),
                    update = { renderer ->
                        callSessionManager.eglBaseContext() ?: return@AndroidView
                        if (state.layoutSwapped) callSessionManager.attachLocalRenderer(renderer) else callSessionManager.attachRemoteRenderer(renderer)
                    },
                )
            }
            Column(modifier = Modifier.weight(1f).padding(horizontal = Spacing.sm)) {
                Text(state.peer?.fullName ?: "", style = MaterialTheme.typography.labelLarge, maxLines = 1)
                Text(callStatusLabel(state), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            IconButton(onClick = callSessionManager::toggleMic) {
                Text(if (state.micOn) "🎤" else "🔇")
            }
            IconButton(onClick = { callSessionManager.setMinimized(false) }) {
                Text("⤢")
            }
            IconButton(onClick = callSessionManager::endCall) {
                Text("☎️")
            }
        }
    }
}
