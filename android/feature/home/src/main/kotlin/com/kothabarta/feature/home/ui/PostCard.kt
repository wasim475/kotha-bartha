package com.kothabarta.feature.home.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.kothabarta.core.ui.components.AppIcon
import com.kothabarta.core.ui.components.AppSymbol
import com.kothabarta.core.network.social.PostDto
import com.kothabarta.core.network.social.ReactionTypes
import com.kothabarta.core.ui.components.AvatarImage
import com.kothabarta.core.ui.components.NetworkImage
import com.kothabarta.core.ui.theme.Spacing

private const val TRUNCATE_AT = 320

private val REACTION_EMOJI = mapOf(
    ReactionTypes.LIKE to "👍",
    ReactionTypes.LOVE to "❤️",
    ReactionTypes.HAHA to "😂",
    ReactionTypes.SAD to "😢",
    ReactionTypes.ANGRY to "😠",
)

@Composable
fun PostCard(
    post: PostDto,
    onOpenPost: (String) -> Unit,
    onOpenProfile: (String) -> Unit,
    onReact: (String) -> Unit,
    onEdit: ((String, String) -> Unit)? = null,
    onDelete: ((String) -> Unit)? = null,
    onReport: ((String, String, String) -> Unit)? = null,
    actionInFlight: Boolean = false,
    reactionEnabled: Boolean = true,
    reportInFlight: Boolean = false,
    modifier: Modifier = Modifier,
) {
    var imageViewer by remember(post.id) { mutableStateOf<String?>(null) }
    var menuExpanded by remember(post.id) { mutableStateOf(false) }
    var showEditDialog by remember(post.id) { mutableStateOf(false) }
    var showDeleteDialog by remember(post.id) { mutableStateOf(false) }
    var showReportDialog by remember(post.id) { mutableStateOf(false) }
    var reportReason by remember(post.id) { mutableStateOf("inappropriate") }
    var reportDescription by remember(post.id) { mutableStateOf("") }
    var editedBody by remember(post.id) { mutableStateOf(post.body) }
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
    ) {
        Column(modifier = Modifier.padding(Spacing.md)) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onOpenProfile(post.author.id) },
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
            ) {
                AvatarImage(avatarUrl = post.author.avatar?.secureUrl, initials = post.author.initials ?: post.author.fullName)
                Column(modifier = Modifier.padding(start = Spacing.sm)) {
                    Text(post.author.fullName, style = MaterialTheme.typography.titleMedium)
                    Text(relativePostTime(post.createdAt), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if ((post.editable && (onEdit != null || onDelete != null)) || (!post.editable && onReport != null)) {
                    Box {
                        IconButton(onClick = { menuExpanded = true }, enabled = !actionInFlight) {
                            AppIcon(AppSymbol.MORE_VERT, contentDescription = "Post options")
                        }
                        DropdownMenu(expanded = menuExpanded, onDismissRequest = { menuExpanded = false }) {
                            if (onEdit != null && post.body.isNotBlank()) DropdownMenuItem(text = { Text("Edit post") }, onClick = { menuExpanded = false; editedBody = post.body; showEditDialog = true })
                            if (onDelete != null) DropdownMenuItem(text = { Text("Delete post") }, onClick = { menuExpanded = false; showDeleteDialog = true })
                            if (!post.editable && onReport != null) DropdownMenuItem(text = { Text("Report post") }, onClick = { menuExpanded = false; showReportDialog = true })
                        }
                    }
                }
            }

            Spacer(Spacing.sm)

            var expanded by remember(post.id) { mutableStateOf(false) }
            val showTruncated = !expanded && post.body.length > TRUNCATE_AT
            Text(
                text = if (showTruncated) post.body.take(TRUNCATE_AT) + "…" else post.body,
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.clickable { onOpenPost(post.id) },
            )
            if (showTruncated) {
                Text(
                    "See more",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.clickable { expanded = true },
                )
            }

            if (post.media.isNotEmpty()) {
                Spacer(Spacing.sm)
                when (post.media.size) {
                    1 -> NetworkImage(
                        url = post.media[0].secureUrl,
                        contentDescription = "Post photo",
                        modifier = Modifier.fillMaxWidth().aspectRatio(1.25f).clip(RoundedCornerShape(16.dp)).clickable { post.media[0].secureUrl?.let { imageViewer = it } },
                    )
                    else -> Column(verticalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                        post.media.take(4).chunked(2).forEachIndexed { rowIndex, rowMedia ->
                            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                                rowMedia.forEachIndexed { columnIndex, media ->
                                    Box(Modifier.weight(1f)) {
                                        NetworkImage(
                                            url = media.secureUrl,
                                            contentDescription = "Post photo",
                                            modifier = Modifier.fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(14.dp)).clickable { media.secureUrl?.let { imageViewer = it } },
                                        )
                                        if (post.media.size > 4 && rowIndex == 1 && columnIndex == 1) {
                                            Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.48f)), contentAlignment = Alignment.Center) {
                                                Text("+${post.media.size - 4}", color = Color.White, style = MaterialTheme.typography.headlineMedium)
                                            }
                                        }
                                    }
                                }
                                if (rowMedia.size == 1) androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
                            }
                        }
                    }
                }
            }

            Spacer(Spacing.sm)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                    ReactionTypes.ALL.forEach { type ->
                        val active = post.reaction == type
                        Text(
                            text = REACTION_EMOJI.getValue(type),
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(50))
                                .clickable(enabled = reactionEnabled) { onReact(type) }
                                .padding(Spacing.xs)
                                .semantics { contentDescription = "React with $type" },
                            style = if (active) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyLarge,
                        )
                    }
                }
                Text(
                    "${post.likes} · ${post.comments} comments",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.clickable { onOpenPost(post.id) },
                )
            }
        }
    }
    imageViewer?.let { imageUrl ->
        Dialog(onDismissRequest = { imageViewer = null }, properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false)) {
            Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.96f)).clickable { imageViewer = null }, contentAlignment = Alignment.Center) {
                NetworkImage(imageUrl, "Full-screen post photo", Modifier.fillMaxSize(), contentScale = androidx.compose.ui.layout.ContentScale.Fit)
                Text("×", modifier = Modifier.align(Alignment.TopEnd).padding(24.dp).clickable { imageViewer = null }, color = Color.White, style = MaterialTheme.typography.headlineMedium)
            }
        }
    }
    if (showEditDialog && onEdit != null) {
        AlertDialog(
            onDismissRequest = { if (!actionInFlight) showEditDialog = false },
            title = { Text("Edit post") },
            text = { OutlinedTextField(value = editedBody, onValueChange = { editedBody = it }, modifier = Modifier.fillMaxWidth(), minLines = 3, maxLines = 8) },
            confirmButton = { TextButton(enabled = !actionInFlight && editedBody.isNotBlank(), onClick = { onEdit(post.id, editedBody); showEditDialog = false }) { Text("Save") } },
            dismissButton = { TextButton(enabled = !actionInFlight, onClick = { showEditDialog = false }) { Text("Cancel") } },
        )
    }
    if (showDeleteDialog && onDelete != null) {
        AlertDialog(
            onDismissRequest = { if (!actionInFlight) showDeleteDialog = false },
            title = { Text("Delete this post?") },
            text = { Text("This post will be removed from your feed and friends' feeds.") },
            confirmButton = { TextButton(enabled = !actionInFlight, onClick = { onDelete(post.id); showDeleteDialog = false }) { Text("Delete") } },
            dismissButton = { TextButton(enabled = !actionInFlight, onClick = { showDeleteDialog = false }) { Text("Cancel") } },
        )
    }
    if (showReportDialog && onReport != null) {
        val reasons = listOf(
            "spam" to "Spam",
            "harassment" to "Harassment",
            "inappropriate" to "Inappropriate content",
            "hate" to "Hate speech",
            "scam" to "Scam or fraud",
            "other" to "Other",
        )
        AlertDialog(
            onDismissRequest = { if (!reportInFlight) showReportDialog = false },
            title = { Text("Report post") },
            text = {
                Column {
                    reasons.forEach { (value, label) ->
                        Row(Modifier.fillMaxWidth().clickable { reportReason = value }, verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            RadioButton(selected = reportReason == value, onClick = { reportReason = value })
                            Text(label)
                        }
                    }
                    if (reportReason == "other") OutlinedTextField(value = reportDescription, onValueChange = { if (it.length <= 1000) reportDescription = it }, label = { Text("Tell us more") }, modifier = Modifier.fillMaxWidth(), minLines = 2)
                }
            },
            confirmButton = {
                TextButton(
                    enabled = !reportInFlight && (reportReason != "other" || reportDescription.trim().length >= 3),
                    onClick = { onReport(post.id, reportReason, reportDescription); showReportDialog = false },
                ) { Text("Send report") }
            },
            dismissButton = { TextButton(enabled = !reportInFlight, onClick = { showReportDialog = false }) { Text("Cancel") } },
        )
    }
}

private fun relativePostTime(createdAt: String): String = runCatching {
    val seconds = (java.time.Instant.now().epochSecond - java.time.Instant.parse(createdAt).epochSecond).coerceAtLeast(0)
    when {
        seconds < 60 -> "now"
        seconds < 3600 -> "${seconds / 60}m"
        seconds < 86400 -> "${seconds / 3600}h"
        seconds < 604800 -> "${seconds / 86400}d"
        else -> java.time.Instant.parse(createdAt).atZone(java.time.ZoneId.systemDefault()).format(java.time.format.DateTimeFormatter.ofPattern("MMM d"))
    }
}.getOrDefault(createdAt)

@Composable
private fun Spacer(size: androidx.compose.ui.unit.Dp) {
    androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(size))
}
