package com.kothabarta.feature.messages.ui

import android.net.Uri
import android.webkit.MimeTypeMap
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.network.messages.MessageDto
import com.kothabarta.core.ui.components.AppTextField
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.theme.Spacing
import kotlinx.coroutines.launch
import org.koin.androidx.compose.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun ChatScreen(
    conversationId: String,
    peerId: String?,
    peerName: String?,
    peerAvatarUrl: String?,
    onNavigate: (NavigationEvent) -> Unit,
    viewModel: ChatViewModel = koinViewModel(parameters = { parametersOf(conversationId, peerId, peerName, peerAvatarUrl) }),
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val listState = rememberLazyListState()
    val coroutineScope = rememberCoroutineScope()

    val isNearBottom by remember { derivedStateOf { listState.firstVisibleItemIndex <= 1 } }
    var newMessageBannerVisible by remember { mutableStateOf(false) }
    LaunchedEffect(state.messages.size) {
        if (state.messages.isEmpty()) return@LaunchedEffect
        if (isNearBottom) {
            listState.animateScrollToItem(0)
        } else {
            newMessageBannerVisible = true
        }
    }
    LaunchedEffect(isNearBottom) {
        if (isNearBottom) newMessageBannerVisible = false
    }

    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        coroutineScope.launch {
            val resolver = context.contentResolver
            val mimeType = resolver.getType(uri) ?: "image/jpeg"
            val bytes = resolver.openInputStream(uri)?.use { it.readBytes() } ?: return@launch
            val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType) ?: "jpg"
            viewModel.sendAttachment(bytes, "photo.$extension", mimeType)
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        ChatHeader(peerName = viewModel.peerName, isPeerTyping = state.isPeerTyping)

        Column(modifier = Modifier.weight(1f)) {
            when {
                state.isLoading -> FullScreenLoading()
                state.error != null && state.messages.isEmpty() -> FullScreenError(state.error!!, onRetry = viewModel::retry)
                else -> LazyColumn(
                    state = listState,
                    reverseLayout = true,
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(Spacing.md),
                    verticalArrangement = Arrangement.spacedBy(Spacing.sm, alignment = Alignment.Bottom),
                ) {
                    items(state.messages.asReversed(), key = { it.id }) { message ->
                        MessageBubble(
                            message = message,
                            isOwn = message.senderId == state.myUserId,
                            isPending = message.id in state.pendingIds,
                            isFailed = message.id in state.failedIds,
                            onReply = { viewModel.setReplyTarget(message) },
                            onReact = { emoji -> viewModel.react(message.id, emoji) },
                            onUnsend = { viewModel.unsend(message.id) },
                            onDeleteForMe = { viewModel.deleteForMe(message.id) },
                            onRetry = { viewModel.retrySend(message.id) },
                            onDiscard = { viewModel.discardFailed(message.id) },
                        )
                    }
                }
            }
        }

        if (newMessageBannerVisible) {
            TextButton(onClick = {
                newMessageBannerVisible = false
                coroutineScope.launch { listState.animateScrollToItem(0) }
            }) {
                Text("New message ↓")
            }
        }

        if (state.uploadingAttachment) {
            Row(modifier = Modifier.padding(Spacing.sm), verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp))
                Text(" Uploading…", style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(start = Spacing.xs))
            }
        }

        state.replyingTo?.let { reply ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.md),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    "Replying to: ${if (reply.encrypted) "Encrypted message" else reply.body.orEmpty()}",
                    style = MaterialTheme.typography.labelMedium,
                    maxLines = 1,
                )
                TextButton(onClick = { viewModel.setReplyTarget(null) }) { Text("Cancel") }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Spacing.sm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = { imagePicker.launch("image/*") }) {
                Text("📷")
            }
            AppTextField(
                value = state.composerText,
                onValueChange = viewModel::onComposerTextChange,
                label = "Message",
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = viewModel::sendText, enabled = state.composerText.isNotBlank()) {
                Text("Send")
            }
        }
    }
}

@Composable
private fun ChatHeader(peerName: String?, isPeerTyping: Boolean) {
    Surface(tonalElevation = 2.dp) {
        Column(modifier = Modifier.padding(Spacing.md)) {
            Text(peerName ?: "Chat", style = MaterialTheme.typography.titleMedium)
            if (isPeerTyping) {
                Text("typing…", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            }
        }
    }
}
