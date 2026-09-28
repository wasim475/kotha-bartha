package com.kothabarta.feature.calls.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.kothabarta.core.ui.components.AvatarImage
import com.kothabarta.core.ui.theme.Spacing
import com.kothabarta.feature.calls.domain.CallSessionManager
import com.kothabarta.feature.calls.domain.CallUiState

/**
 * A small "somebody is calling" card, not a full-screen takeover — mirrors
 * the web client's `IncomingCallPopup.jsx`. Runtime CAMERA/RECORD_AUDIO
 * permission is requested (mic always, camera only for a video call) before
 * `acceptIncomingCall()` is ever called, since `CallSessionManager` assumes
 * capture can start immediately once accepted.
 */
@Composable
fun IncomingCallCard(state: CallUiState, callSessionManager: CallSessionManager, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    var permissionDenied by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { results ->
        val micGranted = results[Manifest.permission.RECORD_AUDIO] == true
        val cameraGranted = !state.video || results[Manifest.permission.CAMERA] == true
        if (micGranted && cameraGranted) {
            permissionDenied = false
            callSessionManager.acceptIncomingCall()
        } else {
            permissionDenied = true
        }
    }

    fun hasPermission(permission: String) =
        androidx.core.content.ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

    fun onAcceptClick() {
        val needed = mutableListOf(Manifest.permission.RECORD_AUDIO)
        if (state.video) needed += Manifest.permission.CAMERA
        val allGranted = needed.all(::hasPermission)
        if (allGranted) {
            permissionDenied = false
            callSessionManager.acceptIncomingCall()
        } else {
            permissionLauncher.launch(needed.toTypedArray())
        }
    }

    val peer = state.peer
    Card(modifier = modifier.padding(Spacing.md)) {
        Column(modifier = Modifier.padding(Spacing.md)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                AvatarImage(avatarUrl = peer?.avatar?.secureUrl, initials = peer?.initials ?: peer?.fullName ?: "?", size = 48.dp)
                Column(modifier = Modifier.padding(start = Spacing.sm)) {
                    Text(peer?.fullName ?: "Unknown", style = MaterialTheme.typography.titleMedium)
                    Text(
                        if (state.video) "Incoming video call" else "Incoming audio call",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (permissionDenied) {
                Text(
                    "Camera/microphone permission is required to answer this call.",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(top = Spacing.xs),
                )
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = Spacing.sm),
                horizontalArrangement = Arrangement.End,
            ) {
                TextButton(onClick = callSessionManager::declineIncomingCall) { Text("Decline") }
                TextButton(onClick = ::onAcceptClick) { Text("Accept") }
            }
        }
    }
}
