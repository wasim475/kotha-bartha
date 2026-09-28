package com.kothabarta.feature.calls.ui

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.kothabarta.core.network.call.CALL_REACTION_TYPES
import com.kothabarta.core.ui.theme.Spacing
import com.kothabarta.feature.calls.domain.CallSessionManager
import com.kothabarta.feature.calls.domain.CallUiState

/** Package/class of the screen-share foreground service — see `feature/calls/src/main/AndroidManifest.xml`'s `<service>` entry. Referenced by name (not by class literal) since it's owned/implemented by a parallel `:core:media` work item and may not exist at compile time yet. */
private const val SCREEN_SHARE_SERVICE_CLASS = "com.kothabarta.feature.calls.service.ScreenShareForegroundService"
private const val EXTRA_RESULT_CODE = "resultCode"
private const val EXTRA_RESULT_DATA = "data"

/**
 * The bottom control row for [ActiveCallScreen] — mirrors the web client's
 * `ActiveCall.jsx` control bar one action at a time. Screen-share here only
 * ever launches the system capture-permission intent and starts/stops the
 * foreground service that owns the actual capture — it never builds a
 * `VideoTrack` itself (that's `:core:media`'s `ScreenShareForegroundService`,
 * which is expected to call `CallSessionManager.applyScreenShareTrack` once
 * it has one).
 */
@Composable
fun CallControls(state: CallUiState, callSessionManager: CallSessionManager, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    var reactionPickerOpen by remember { mutableStateOf(false) }
    val cameraCount = remember(state.status) { callSessionManager.cameraCount() }

    val screenCaptureLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val data = result.data
        if (result.resultCode == Activity.RESULT_OK && data != null) {
            val serviceIntent = Intent().apply {
                setClassName(context.packageName, SCREEN_SHARE_SERVICE_CLASS)
                putExtra(EXTRA_RESULT_CODE, result.resultCode)
                putExtra(EXTRA_RESULT_DATA, data)
            }
            runCatching { ContextCompat.startForegroundService(context, serviceIntent) }
        }
    }

    Column(modifier = modifier.fillMaxWidth()) {
        if (reactionPickerOpen) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = Spacing.sm),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                CALL_REACTION_TYPES.forEach { type ->
                    TextButton(onClick = {
                        callSessionManager.sendReaction(type)
                        reactionPickerOpen = false
                    }) {
                        Text(reactionEmoji(type), style = MaterialTheme.typography.headlineSmall)
                    }
                }
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ControlButton(label = if (state.micOn) "🎤" else "🔇", onClick = callSessionManager::toggleMic)

            if (state.video) {
                ControlButton(label = if (state.cameraOn) "📹" else "🚫", onClick = callSessionManager::toggleCamera)
            }

            if (cameraCount > 1) {
                ControlButton(label = "🔄", onClick = callSessionManager::switchCamera)
            }

            ControlButton(
                label = if (state.screenShareMine) "🖥️✖️" else "🖥️",
                onClick = {
                    if (state.screenShareMine) {
                        callSessionManager.stopScreenShare()
                        runCatching {
                            context.stopService(Intent().apply { setClassName(context.packageName, SCREEN_SHARE_SERVICE_CLASS) })
                        }
                    } else {
                        val projectionManager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as? MediaProjectionManager
                        projectionManager?.let { screenCaptureLauncher.launch(it.createScreenCaptureIntent()) }
                    }
                },
            )

            BadgedControlButton(label = "💬", badge = state.chatUnread, onClick = callSessionManager::toggleChat)

            ControlButton(label = "😀", onClick = { reactionPickerOpen = !reactionPickerOpen })

            val isCancelable = (state.status == "calling" || state.status == "ringing") && state.role == "caller"
            TextButton(onClick = { if (isCancelable) callSessionManager.cancelOutgoingCall() else callSessionManager.endCall() }) {
                Text(
                    if (isCancelable) "Cancel call" else "End call",
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}

@Composable
private fun ControlButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier
            .size(48.dp),
        shape = CircleShape,
        tonalElevation = 2.dp,
        onClick = onClick,
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
            Text(label, style = MaterialTheme.typography.titleLarge)
        }
    }
}

@Composable
private fun BadgedControlButton(label: String, badge: Int, onClick: () -> Unit) {
    Box {
        ControlButton(label = label, onClick = onClick)
        if (badge > 0) {
            Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .size(18.dp),
            ) {
                Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                    Text(badge.toString(), color = MaterialTheme.colorScheme.onError, style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}
