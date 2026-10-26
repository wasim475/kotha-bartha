package com.kothabarta.feature.messages.ui

import android.Manifest
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.network.call.CallLauncher
import com.kothabarta.core.network.messages.MessageDto
import com.kothabarta.core.ui.components.AvatarImage
import com.kothabarta.core.ui.components.AppIcon
import com.kothabarta.core.ui.components.AppSymbol
import com.kothabarta.core.ui.components.EmptyState
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.theme.Spacing
import kotlinx.coroutines.launch
import java.io.File
import java.io.IOException
import java.time.Instant
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import org.koin.androidx.compose.koinViewModel
import org.koin.compose.koinInject
import org.koin.core.parameter.parametersOf

@Composable
fun ChatScreen(
    conversationId: String,
    peerId: String?,
    peerName: String?,
    peerAvatarUrl: String?,
    peerLastSeenAt: String? = null,
    peerIsOnline: Boolean = false,
    targetMessageId: String? = null,
    onNavigate: (NavigationEvent) -> Unit,
    viewModel: ChatViewModel = koinViewModel(
        parameters = { parametersOf(conversationId, peerId, peerName, peerAvatarUrl, peerLastSeenAt, peerIsOnline) },
    ),
) {
    val state by viewModel.uiState.collectAsState()
    val callLauncher = koinInject<CallLauncher>()
    val context = LocalContext.current
    val listState = rememberLazyListState()
    val coroutineScope = rememberCoroutineScope()
    var showEmojiPicker by remember { mutableStateOf(false) }
    var voiceRecorder by remember { mutableStateOf<MediaRecorder?>(null) }
    var voiceRecordingFile by remember { mutableStateOf<File?>(null) }
    var voiceRecordingError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(state.isLoading, targetMessageId, state.messages) {
        if (state.isLoading || targetMessageId.isNullOrBlank()) return@LaunchedEffect
        val targetIndex = state.messages.asReversed().indexOfFirst { it.id == targetMessageId }
        if (targetIndex >= 0) listState.animateScrollToItem(targetIndex)
    }

    val isNearBottom by remember { derivedStateOf { listState.firstVisibleItemIndex <= 1 } }
    val targetMessageMissing = !state.isLoading && !targetMessageId.isNullOrBlank() && state.messages.none { it.id == targetMessageId }
    var newMessageBannerVisible by remember { mutableStateOf(false) }
    LaunchedEffect(state.messages.size) {
        if (state.messages.isEmpty()) return@LaunchedEffect
        if (!targetMessageId.isNullOrBlank()) return@LaunchedEffect
        if (isNearBottom) {
            listState.animateScrollToItem(0)
        } else {
            newMessageBannerVisible = true
        }
    }
    LaunchedEffect(isNearBottom) {
        if (isNearBottom) newMessageBannerVisible = false
    }

    val attachmentPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        coroutineScope.launch {
            val resolver = context.contentResolver
            val mimeType = resolver.getType(uri) ?: "application/octet-stream"
            val fileName = resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                ?.use { cursor ->
                    if (cursor.moveToFirst()) cursor.getString(0) else null
                }
                ?: uri.lastPathSegment?.substringAfterLast('/')?.takeIf(String::isNotBlank)
                ?: "attachment"
            val bytes = resolver.openInputStream(uri)?.use { it.readBytes() } ?: return@launch
            viewModel.sendAttachment(bytes, fileName, mimeType)
        }
    }

    fun startVoiceRecording() {
        val file = try {
            File.createTempFile("voice-note-", ".m4a", context.cacheDir)
        } catch (error: IOException) {
            voiceRecordingError = "Couldn't prepare voice recording."
            return
        }
        @Suppress("DEPRECATION")
        val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(context)
        } else {
            MediaRecorder()
        }
        try {
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC)
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            recorder.setOutputFile(file.absolutePath)
            recorder.prepare()
            recorder.start()
            voiceRecordingFile = file
            voiceRecorder = recorder
            voiceRecordingError = null
        } catch (error: IOException) {
            recorder.release()
            file.delete()
            voiceRecordingError = "Couldn't start voice recording."
        } catch (error: IllegalStateException) {
            recorder.release()
            file.delete()
            voiceRecordingError = "Couldn't start voice recording."
        } catch (error: SecurityException) {
            recorder.release()
            file.delete()
            voiceRecordingError = "Microphone permission is required to record a voice message."
        }
    }

    fun stopAndSendVoice() {
        val recorder = voiceRecorder ?: return
        val file = voiceRecordingFile
        try {
            recorder.stop()
            recorder.release()
            voiceRecorder = null
            voiceRecordingFile = null
            if (file != null && file.exists() && file.length() > 0) {
                viewModel.sendAttachment(file.readBytes(), "voice-note.m4a", "audio/mp4")
            }
            file?.delete()
            voiceRecordingError = null
        } catch (error: IllegalStateException) {
            recorder.release()
            voiceRecorder = null
            voiceRecordingFile = null
            file?.delete()
            voiceRecordingError = "Voice recording was too short. Please try again."
        } catch (error: IOException) {
            recorder.release()
            voiceRecorder = null
            voiceRecordingFile = null
            file?.delete()
            voiceRecordingError = "Couldn't read the recorded voice message."
        }
    }

    val microphonePermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) startVoiceRecording()
        else voiceRecordingError = "Microphone permission is required to record a voice message."
    }

    DisposableEffect(Unit) {
        onDispose {
            voiceRecorder?.release()
            voiceRecordingFile?.delete()
        }
    }

    MaterialTheme(colorScheme = ChatColorScheme) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .imePadding()
                .background(ChatColors.background),
        ) {
            ChatHeader(
                peerName = viewModel.peerName,
                peerAvatarUrl = peerAvatarUrl,
                isPeerTyping = state.isPeerTyping,
                peerIsOnline = state.peerIsOnline,
                peerLastSeenAt = state.peerLastSeenAt,
                canCall = !peerId.isNullOrBlank(),
                onBack = { onNavigate(NavigationEvent.PopBackStack) },
                onAudioCall = { peerId?.let { callLauncher.startCall(it, peerName.orEmpty(), peerAvatarUrl, false) } },
                onVideoCall = { peerId?.let { callLauncher.startCall(it, peerName.orEmpty(), peerAvatarUrl, true) } },
            )

            if (targetMessageMissing) {
                Text(
                    "That message is no longer available. Showing the conversation instead.",
                    modifier = Modifier.padding(horizontal = Spacing.md, vertical = Spacing.sm),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Box(
                modifier = Modifier
                    .weight(1f, fill = true)
                    .fillMaxWidth(),
            ) {
                when {
                    state.isLoading -> FullScreenLoading()
                    state.error != null && state.messages.isEmpty() ->
                        FullScreenError(state.error!!, onRetry = viewModel::retry)
                    state.messages.isEmpty() ->
                        EmptyState("No messages yet. Send a message to start the conversation.")
                    else -> LazyColumn(
                        state = listState,
                        reverseLayout = true,
                        modifier = Modifier
                            .fillMaxSize()
                            .background(ChatColors.background),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(Spacing.md),
                        verticalArrangement = Arrangement.spacedBy(4.dp, alignment = Alignment.Bottom),
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
                                decryptionState = state.decryptionStates[message.id],
                            )
                        }
                    }
                }
            }

            if (newMessageBannerVisible && state.messages.isNotEmpty()) {
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

            voiceRecordingError?.let { error ->
                Text(
                    text = error,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.padding(horizontal = Spacing.md, vertical = Spacing.xs),
                )
            }

            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.sm, vertical = Spacing.xs),
                shape = RoundedCornerShape(28.dp),
                color = ChatColors.header,
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 2.dp, vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clickable(
                                role = Role.Button,
                                onClick = { attachmentPicker.launch("*/*") },
                            )
                            .semantics { contentDescription = "Attach a file" },
                        contentAlignment = Alignment.Center,
                    ) {
                        AppIcon(
                            AppSymbol.ATTACHMENT,
                            contentDescription = null,
                            modifier = Modifier.size(24.dp),
                            tint = ChatColors.primaryText,
                        )
                    }

                    Box {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .clickable(
                                    role = Role.Button,
                                    onClick = { showEmojiPicker = true },
                                )
                                .semantics { contentDescription = "Choose an emoji" },
                            contentAlignment = Alignment.Center,
                        ) {
                            AppIcon(
                                AppSymbol.REACTIONS,
                                contentDescription = null,
                                modifier = Modifier.size(24.dp),
                                tint = ChatColors.primaryText,
                            )
                        }
                        DropdownMenu(
                            expanded = showEmojiPicker,
                            onDismissRequest = { showEmojiPicker = false },
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = Spacing.xs),
                                horizontalArrangement = Arrangement.spacedBy(Spacing.xs),
                            ) {
                                listOf("😀", "😂", "🥰", "👍", "❤️", "🙏").forEach { emoji ->
                                    TextButton(
                                        onClick = {
                                            viewModel.onComposerTextChange(state.composerText + emoji)
                                            showEmojiPicker = false
                                        },
                                    ) {
                                        Text(emoji, fontSize = 22.sp)
                                    }
                                }
                            }
                        }
                    }

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .padding(horizontal = 6.dp),
                        contentAlignment = Alignment.CenterStart,
                    ) {
                        if (state.composerText.isEmpty()) {
                            Text(
                                text = "Type a message",
                                color = ChatColors.secondaryText,
                                style = MaterialTheme.typography.bodyLarge,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        BasicTextField(
                            value = state.composerText,
                            onValueChange = viewModel::onComposerTextChange,
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            enabled = voiceRecorder == null,
                            textStyle = TextStyle(
                                color = ChatColors.primaryText,
                                fontSize = 16.sp,
                            ),
                            cursorBrush = SolidColor(ChatColors.online),
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                            keyboardActions = KeyboardActions(onSend = { viewModel.sendText() }),
                        )
                    }

                    val hasMessage = state.composerText.isNotBlank()
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .then(
                                if (hasMessage) Modifier
                                    .background(ChatColors.online, CircleShape)
                                    .clickable(onClick = viewModel::sendText)
                                else if (voiceRecorder != null) Modifier
                                    .background(MaterialTheme.colorScheme.error, CircleShape)
                                    .clickable(onClick = ::stopAndSendVoice)
                                else Modifier.clickable {
                                    if (
                                        context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) ==
                                        android.content.pm.PackageManager.PERMISSION_GRANTED
                                    ) {
                                        startVoiceRecording()
                                    } else {
                                        microphonePermission.launch(Manifest.permission.RECORD_AUDIO)
                                    }
                                },
                            )
                            .semantics {
                                contentDescription = when {
                                    hasMessage -> "Send message"
                                    voiceRecorder != null -> "Send voice message"
                                    else -> "Record a voice message"
                                }
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        AppIcon(
                            symbol = when {
                                hasMessage -> AppSymbol.SEND
                                voiceRecorder != null -> AppSymbol.MIC_OFF
                                else -> AppSymbol.MIC
                            },
                            contentDescription = null,
                            modifier = Modifier.size(24.dp),
                            tint = if (hasMessage || voiceRecorder != null) Color.White else ChatColors.primaryText,
                        )
                    }
                }
            }
            }
    }
}

internal object ChatColors {
    val background = Color(0xFF0B141A)
    val header = Color(0xFF202C33)
    val incomingBubble = Color(0xFF202C33)
    val outgoingBubble = Color(0xFF005C4B)
    val primaryText = Color(0xFFE9EDEF)
    val secondaryText = Color(0xFF8696A0)
    val online = Color(0xFF25D366)
}

private val ChatColorScheme = darkColorScheme(
    primary = ChatColors.online,
    onPrimary = ChatColors.primaryText,
    background = ChatColors.background,
    onBackground = ChatColors.primaryText,
    surface = ChatColors.header,
    onSurface = ChatColors.primaryText,
    surfaceVariant = ChatColors.incomingBubble,
    onSurfaceVariant = ChatColors.secondaryText,
    outline = ChatColors.secondaryText,
)

@Composable
private fun ChatHeader(
    peerName: String?,
    peerAvatarUrl: String?,
    isPeerTyping: Boolean,
    peerIsOnline: Boolean,
    peerLastSeenAt: String?,
    canCall: Boolean,
    onBack: () -> Unit,
    onAudioCall: () -> Unit,
    onVideoCall: () -> Unit,
) {
    Surface(color = ChatColors.header) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Text("←", color = ChatColors.primaryText, fontSize = 28.sp, lineHeight = 28.sp)
            }
            Box(modifier = Modifier.padding(end = Spacing.sm)) {
                AvatarImage(
                    avatarUrl = peerAvatarUrl,
                    initials = peerName ?: "Chat",
                    size = 42.dp,
                )
                if (peerIsOnline) {
                    Box(
                        modifier = Modifier
                            .size(12.dp)
                            .align(Alignment.BottomEnd)
                            .background(ChatColors.online, androidx.compose.foundation.shape.CircleShape)
                            .semantics { contentDescription = "Online" },
                    )
                }
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    peerName ?: "Chat",
                    style = MaterialTheme.typography.titleMedium,
                    color = ChatColors.primaryText,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                )
                val subtitle = when {
                    isPeerTyping -> "typing…"
                    peerIsOnline -> "online"
                    else -> formatLastSeenForChat(peerLastSeenAt)
                }
                if (!subtitle.isNullOrBlank()) {
                    Text(
                        subtitle,
                        style = MaterialTheme.typography.labelMedium,
                        color = if (isPeerTyping || peerIsOnline) ChatColors.online else ChatColors.secondaryText,
                        maxLines = 1,
                    )
                }
            }
            if (canCall) {
                IconButton(onClick = onVideoCall) {
                    AppIcon(AppSymbol.VIDEO_CALL, contentDescription = "Start video call", tint = ChatColors.primaryText)
                }
                IconButton(onClick = onAudioCall) {
                    AppIcon(AppSymbol.AUDIO_CALL, contentDescription = "Start audio call", tint = ChatColors.primaryText)
                }
            }
        }
    }
}

internal fun formatLastSeenForChat(lastSeenAt: String?, now: ZonedDateTime = ZonedDateTime.now()): String? {
    if (lastSeenAt.isNullOrBlank()) return null
    val seen = runCatching { Instant.parse(lastSeenAt).atZone(now.zone) }.getOrNull() ?: return null
    val time = seen.format(DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH)).lowercase(Locale.ENGLISH)
    return if (seen.toLocalDate() == now.withZoneSameInstant(seen.zone).toLocalDate()) {
        "last seen at $time"
    } else {
        val dateTime = seen.format(DateTimeFormatter.ofPattern("MMM d 'at' h:mm a", Locale.ENGLISH))
            .replace("AM", "am")
            .replace("PM", "pm")
        "last seen at $dateTime"
    }
}
