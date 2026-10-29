package com.kothabarta.feature.messages.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
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
import com.kothabarta.core.websocket.SocketConnectionState
import com.kothabarta.core.websocket.SocketManager
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
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
    val chatPalette = chatPalette()
    val callLauncher = koinInject<CallLauncher>()
    val socketManager = koinInject<SocketManager>()
    val connectionState by socketManager.connectionState.collectAsState()
    val listState = rememberLazyListState()
    val displayMessages = remember(state.messages) { state.messages.asReversed() }
    val coroutineScope = rememberCoroutineScope()
    var showEmojiPicker by remember { mutableStateOf(false) }
    var mediaSharingMessage by remember { mutableStateOf<String?>(null) }

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

    Column(
        modifier = Modifier
            .fillMaxSize()
            .imePadding()
            .background(chatPalette.background),
    ) {
            ChatHeader(
                palette = chatPalette,
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

            if (connectionState == SocketConnectionState.DISCONNECTED) {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.md, vertical = Spacing.xs),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Text(
                        text = "Live updates are disconnected",
                        modifier = Modifier.padding(horizontal = Spacing.md, vertical = Spacing.sm),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

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
                            .background(chatPalette.background),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(Spacing.md),
                        verticalArrangement = Arrangement.spacedBy(4.dp, alignment = Alignment.Bottom),
                    ) {
                        itemsIndexed(displayMessages, key = { _, message -> message.id }) { index, message ->
                            val newerMessage = displayMessages.getOrNull(index - 1)
                            val olderMessage = displayMessages.getOrNull(index + 1)
                            val groupedWithNewer = newerMessage?.let { messagesBelongToSameGroup(message, it) } == true
                            val groupedWithOlder = olderMessage?.let { messagesBelongToSameGroup(message, it) } == true
                            Column {
                                val messageDate = messageLocalDate(message.createdAt)
                                val olderDate = olderMessage?.let { messageLocalDate(it.createdAt) }
                                if (messageDate != null && (olderMessage == null || messageDate != olderDate)) {
                                    DateSeparator(messageDate)
                                }
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
                                    modifier = Modifier.padding(
                                        vertical = if (groupedWithNewer || groupedWithOlder) 0.dp else 2.dp,
                                    ),
                                    decryptionState = state.decryptionStates[message.id],
                                    palette = chatPalette,
                                    groupedWithNewer = groupedWithNewer,
                                    groupedWithOlder = groupedWithOlder,
                                )
                            }
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
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.md, vertical = Spacing.xs),
                    color = chatPalette.header,
                    shape = RoundedCornerShape(16.dp),
                ) {
                    Row(
                        modifier = Modifier.padding(start = Spacing.md, end = Spacing.xs),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f).padding(vertical = Spacing.sm)) {
                            Text(
                                "Replying to message",
                                style = MaterialTheme.typography.labelMedium,
                                color = chatPalette.primaryText,
                            )
                            Text(
                                if (reply.encrypted) "🔒 Encrypted message" else reply.body.orEmpty(),
                                style = MaterialTheme.typography.bodySmall,
                                color = chatPalette.secondaryText,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        TextButton(onClick = { viewModel.setReplyTarget(null) }) { Text("Cancel") }
                    }
                }
            }

            mediaSharingMessage?.let { message ->
                Text(
                    text = message,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.padding(horizontal = Spacing.md, vertical = Spacing.xs),
                )
            }

            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.sm, vertical = Spacing.xs),
                shape = RoundedCornerShape(24.dp),
                color = chatPalette.header,
                tonalElevation = 2.dp,
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 4.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clickable(
                                role = Role.Button,
                                onClick = { mediaSharingMessage = MEDIA_SHARING_UNAVAILABLE_MESSAGE },
                            )
                            .semantics { contentDescription = "Attachments unavailable until secure media sharing is supported" },
                        contentAlignment = Alignment.Center,
                    ) {
                        AppIcon(
                            AppSymbol.ATTACHMENT,
                            contentDescription = null,
                            modifier = Modifier.size(24.dp),
                            tint = chatPalette.primaryText,
                        )
                    }

                    Box {
                        Box(
                            modifier = Modifier
                                .size(48.dp)
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
                                tint = chatPalette.primaryText,
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
                                color = chatPalette.secondaryText,
                                style = MaterialTheme.typography.bodyLarge,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        BasicTextField(
                            value = state.composerText,
                            onValueChange = viewModel::onComposerTextChange,
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 24.dp, max = 120.dp),
                                    maxLines = 5,
                                textStyle = TextStyle(
                                color = chatPalette.primaryText,
                                fontSize = 16.sp,
                                    lineHeight = 22.sp,
                                ),
                                cursorBrush = SolidColor(chatPalette.online),
                                keyboardOptions = KeyboardOptions.Default,
                        )
                    }

                    val hasMessage = state.composerText.isNotBlank()
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .then(
                                if (hasMessage) Modifier
                                    .background(chatPalette.outgoingBubble, CircleShape)
                                    .clickable(onClick = viewModel::sendText)
                                else Modifier.clickable {
                                    mediaSharingMessage = MEDIA_SHARING_UNAVAILABLE_MESSAGE
                                },
                            )
                            .semantics {
                                role = Role.Button
                                contentDescription = when {
                                    hasMessage -> "Send message"
                                    else -> "Voice messages unavailable until secure media sharing is supported"
                                }
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        AppIcon(
                            symbol = when {
                                hasMessage -> AppSymbol.SEND
                                else -> AppSymbol.MIC
                            },
                            contentDescription = null,
                            modifier = Modifier.size(24.dp),
                            tint = if (hasMessage) Color.White else chatPalette.primaryText,
                        )
                    }
                }
            }
    }
}

data class ChatPalette(
    val background: Color,
    val header: Color,
    val incomingBubble: Color,
    val outgoingBubble: Color,
    val primaryText: Color,
    val outgoingText: Color,
    val secondaryText: Color,
    val online: Color,
)

@Composable
internal fun chatPalette(): ChatPalette {
    val scheme = MaterialTheme.colorScheme
    val isDark = scheme.background.luminance() < 0.5f
    return ChatPalette(
        background = scheme.background,
        header = scheme.surface,
        incomingBubble = if (isDark) Color(0xFF292825) else Color.White,
        outgoingBubble = scheme.primaryContainer,
        primaryText = scheme.onSurface,
        outgoingText = scheme.onPrimaryContainer,
        secondaryText = scheme.onSurfaceVariant,
        online = Color(0xFF25D366),
    )
}

internal fun messagesBelongToSameGroup(first: MessageDto, second: MessageDto): Boolean {
    if (first.senderId != second.senderId) return false
    val firstTime = runCatching { Instant.parse(first.createdAt) }.getOrNull() ?: return false
    val secondTime = runCatching { Instant.parse(second.createdAt) }.getOrNull() ?: return false
    return kotlin.math.abs(Duration.between(firstTime, secondTime).toMillis()) <= 5 * 60 * 1000
}

@Composable
private fun ChatHeader(
    palette: ChatPalette,
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
    Surface(color = palette.header) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Text("←", color = palette.primaryText, fontSize = 28.sp, lineHeight = 28.sp)
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
                            .background(palette.online, androidx.compose.foundation.shape.CircleShape)
                            .semantics { contentDescription = "Online" },
                    )
                }
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    peerName ?: "Chat",
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.primaryText,
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
                        color = if (isPeerTyping || peerIsOnline) palette.online else palette.secondaryText,
                        maxLines = 1,
                    )
                }
            }
            if (canCall) {
                IconButton(onClick = onVideoCall) {
                    AppIcon(AppSymbol.VIDEO_CALL, contentDescription = "Start video call", tint = palette.primaryText)
                }
                IconButton(onClick = onAudioCall) {
                    AppIcon(AppSymbol.AUDIO_CALL, contentDescription = "Start audio call", tint = palette.primaryText)
                }
            }
        }
    }
}

private fun messageLocalDate(createdAt: String): LocalDate? = runCatching {
    Instant.parse(createdAt).atZone(ZoneId.systemDefault()).toLocalDate()
}.getOrNull()

@Composable
private fun DateSeparator(date: LocalDate) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = Spacing.sm),
        contentAlignment = Alignment.Center,
    ) {
        Surface(
            color = MaterialTheme.colorScheme.surfaceVariant,
            shape = CircleShape,
        ) {
            Text(
                text = formatMessageDate(date),
                modifier = Modifier.padding(horizontal = Spacing.md, vertical = Spacing.xs),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

internal fun formatMessageDate(date: LocalDate, today: LocalDate = LocalDate.now()): String = when (date) {
    today -> "Today"
    today.minusDays(1) -> "Yesterday"
    else -> date.format(DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.getDefault()))
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
