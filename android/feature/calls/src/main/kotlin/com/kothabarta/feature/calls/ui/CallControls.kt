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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.core.content.ContextCompat
import com.kothabarta.core.network.call.CALL_REACTION_TYPES
import com.kothabarta.core.ui.theme.Spacing
import com.kothabarta.core.ui.components.AppIcon
import com.kothabarta.core.ui.components.AppSymbol
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
            ControlButton(symbol = if (state.micOn) AppSymbol.MIC else AppSymbol.MIC_OFF, description = if (state.micOn) "Mute microphone" else "Unmute microphone", onClick = callSessionManager::toggleMic)
            ControlButton(symbol = if (state.speakerOn) AppSymbol.VOLUME else AppSymbol.AUDIO_CALL, description = if (state.speakerOn) "Use speaker" else "Use earpiece", onClick = callSessionManager::toggleSpeaker)

            if (state.video) {
                ControlButton(symbol = if (state.cameraOn) AppSymbol.VIDEO_CALL else AppSymbol.VIDEO_OFF, description = if (state.cameraOn) "Turn camera off" else "Turn camera on", onClick = callSessionManager::toggleCamera)
            }

            if (cameraCount > 1) {
                ControlButton(symbol = AppSymbol.FLIP_CAMERA, description = "Switch camera", onClick = callSessionManager::switchCamera)
            }

            ControlButton(
                symbol = if (state.screenShareMine) AppSymbol.SCREEN_SHARE_STOP else AppSymbol.SCREEN_SHARE,
                description = if (state.screenShareMine) "Stop screen sharing" else "Share screen",
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

            BadgedControlButton(badge = state.chatUnread, onClick = callSessionManager::toggleChat)

            ControlButton(symbol = AppSymbol.REACTIONS, description = "Choose a reaction", onClick = { reactionPickerOpen = !reactionPickerOpen })

            val isCancelable = (state.status == "calling" || state.status == "ringing") && state.role == "caller"
            ControlButton(
                symbol = AppSymbol.CALL_END,
                description = if (isCancelable) "Cancel call" else "End call",
                onClick = { if (isCancelable) callSessionManager.cancelOutgoingCall() else callSessionManager.endCall() },
                destructive = true,
            )
        }
    }
}

@Composable
private fun ControlButton(
    symbol: AppSymbol,
    description: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    destructive: Boolean = false,
) {
    Surface(
        modifier = modifier.size(48.dp).semantics { contentDescription = description },
        shape = CircleShape,
        color = if (destructive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.surfaceVariant,
        contentColor = if (destructive) MaterialTheme.colorScheme.onError else MaterialTheme.colorScheme.onSurfaceVariant,
        tonalElevation = 2.dp,
        onClick = onClick,
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
            AppIcon(symbol, contentDescription = null)
        }
    }
}

@Composable
private fun BadgedControlButton(badge: Int, onClick: () -> Unit) {
    Box {
        ControlButton(symbol = AppSymbol.CHAT, description = "Open call chat", onClick = onClick)
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
