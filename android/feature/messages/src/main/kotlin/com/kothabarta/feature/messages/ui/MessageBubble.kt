package com.kothabarta.feature.messages.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.unit.dp
import com.kothabarta.core.network.messages.MessageDto
import com.kothabarta.feature.messages.data.MessageDecryptionState
import com.kothabarta.core.ui.components.NetworkImage
import com.kothabarta.core.ui.components.AppIcon
import com.kothabarta.core.ui.components.AppSymbol
import com.kothabarta.core.ui.theme.Spacing
import java.time.Instant

@Composable
fun MessageBubble(
    message: MessageDto,
    isOwn: Boolean,
    isPending: Boolean,
    isFailed: Boolean,
    onReply: () -> Unit,
    onReact: (String) -> Unit,
    onUnsend: () -> Unit,
    onDeleteForMe: () -> Unit,
    onRetry: () -> Unit,
    onDiscard: () -> Unit,
    modifier: Modifier = Modifier,
    decryptionState: MessageDecryptionState? = null,
) {
    var actionsOpen by remember(message.id) { mutableStateOf(false) }
    val canUnsend = isOwn && !isPending && message.unsendExpiresAt?.let { runCatching { Instant.parse(it).isAfter(Instant.now()) }.getOrDefault(false) } == true

    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = if (isOwn) Alignment.End else Alignment.Start,
    ) {
        Surface(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(RoundedCornerShape(16.dp))
                .clickable { actionsOpen = !actionsOpen },
            color = if (isOwn) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
        ) {
            Column(modifier = Modifier.padding(Spacing.sm)) {
                message.replyTo?.let { reply ->
                    Surface(
                        color = MaterialTheme.colorScheme.background.copy(alpha = 0.3f),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = Spacing.xs),
                    ) {
                        Text(
                            text = if (reply.encrypted) "🔒 Encrypted message" else (reply.body ?: ""),
                            modifier = Modifier.padding(Spacing.xs),
                            style = MaterialTheme.typography.labelMedium,
                            maxLines = 2,
                        )
                    }
                }
                message.attachment?.let { attachment ->
                    if (attachment.kind == "image") {
                        NetworkImage(
                            url = attachment.url,
                            contentDescription = "Attachment",
                            modifier = Modifier
                                .fillMaxWidth()
                                .aspectRatio(4f / 3f)
                                .clip(RoundedCornerShape(12.dp)),
                        )
                    } else {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            AppIcon(AppSymbol.ATTACHMENT, contentDescription = null, modifier = Modifier.padding(end = Spacing.xs))
                            Text(attachment.fileName ?: "File", style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
                val bodyText = messageBodyText(message, decryptionState)
                if (bodyText.isNotBlank()) {
                    Text(
                        text = bodyText,
                        color = if (isOwn) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyLarge,
                    )
                }
                if (message.reactions.isNotEmpty()) {
                    Text(
                        message.reactions.joinToString(" ") { it.emoji },
                        style = MaterialTheme.typography.labelMedium,
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.xs), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = metaLabel(isOwn, isPending, isFailed, message.status, message.createdAt),
                        style = MaterialTheme.typography.labelMedium,
                        color = statusColor(isOwn, message.status, isFailed),
                    )
                }
            }
        }

        if (isFailed) {
            Row {
                TextButton(onClick = onRetry) { Text("Retry") }
                TextButton(onClick = onDiscard) { Text("Discard") }
            }
        }

        if (actionsOpen && !isPending) {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                TextButton(onClick = { onReply(); actionsOpen = false }) { Text("Reply") }
                TextButton(onClick = { onReact("👍"); actionsOpen = false }) { Text("👍") }
                if (isOwn) {
                    TextButton(onClick = { onDeleteForMe(); actionsOpen = false }) { Text("Delete for me") }
                    if (canUnsend) {
                        TextButton(onClick = { onUnsend(); actionsOpen = false }) { Text("Unsend") }
                    }
                } else {
                    TextButton(onClick = { onDeleteForMe(); actionsOpen = false }) { Text("Delete for me") }
                }
            }
        }
    }
}

internal fun messageBodyText(message: MessageDto, state: MessageDecryptionState?): String {
    val isEncrypted = message.encrypted || message.encryptedPayloads?.isNotEmpty() == true || message.encryptedBody != null || message.senderPublicKey != null
    return if (isEncrypted) encryptedDisplayText(state) else message.body.orEmpty()
}

private fun encryptedDisplayText(state: MessageDecryptionState?): String = when (state) {
    is MessageDecryptionState.Decrypted -> state.plaintext
    MessageDecryptionState.Pending -> "🔒 Decrypting…"
    is MessageDecryptionState.Unavailable -> when (state.reason) {
        MessageDecryptionState.Reason.DEVICE_KEY_UNAVAILABLE -> "🔒 Device key unavailable"
        MessageDecryptionState.Reason.PLATFORM_UNSUPPORTED -> "🔒 Secure decryption unavailable on this Android version"
        MessageDecryptionState.Reason.NO_DEVICE_ENVELOPE -> "🔒 Message not addressed to this device"
        MessageDecryptionState.Reason.LEGACY_FORMAT_UNSUPPORTED -> "🔒 Legacy encrypted message unavailable"
        MessageDecryptionState.Reason.INVALID_SENDER_KEY,
        MessageDecryptionState.Reason.INVALID_ENVELOPE,
        MessageDecryptionState.Reason.AUTHENTICATION_FAILED -> "🔒 Unable to decrypt"
    }
    null -> "🔒 Decryption unavailable"
}

private fun metaLabel(isOwn: Boolean, isPending: Boolean, isFailed: Boolean, status: String, createdAt: String): String {
    val time = runCatching {
        Instant.parse(createdAt).atZone(java.time.ZoneId.systemDefault()).format(java.time.format.DateTimeFormatter.ofPattern("h:mm a"))
    }.getOrDefault("")
    val tick = when {
        isFailed -> "Failed to send"
        isPending -> "Sending…"
        !isOwn -> time
        status == "read" || status == "delivered" -> "$time ✓✓"
        else -> "$time ✓"
    }
    return tick
}

@Composable
private fun statusColor(isOwn: Boolean, status: String, isFailed: Boolean) = when {
    isFailed -> MaterialTheme.colorScheme.error
    !isOwn -> MaterialTheme.colorScheme.onSurfaceVariant
    status == "read" -> MaterialTheme.colorScheme.primary
    else -> MaterialTheme.colorScheme.onSurfaceVariant
}
