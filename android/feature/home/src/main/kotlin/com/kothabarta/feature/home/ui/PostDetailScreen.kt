package com.kothabarta.feature.home.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Surface
import androidx.compose.ui.Alignment
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.components.AvatarImage
import com.kothabarta.core.ui.components.AppIcon
import com.kothabarta.core.ui.components.AppSymbol
import com.kothabarta.core.ui.theme.Spacing
import com.kothabarta.core.network.social.CommentDto
import com.kothabarta.core.network.social.ReactionTypes
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import org.koin.androidx.compose.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun PostDetailScreen(
    postId: String,
    onNavigate: (NavigationEvent) -> Unit,
    viewModel: PostDetailViewModel = koinViewModel(parameters = { parametersOf(postId) }),
) {
    val state by viewModel.uiState.collectAsState()
    var commentCountBeforeSend by remember { mutableStateOf<Int?>(null) }
    var draft by remember { mutableStateOf("") }

    LaunchedEffect(state.comments.size, state.isSendingComment) {
        val countBeforeSend = commentCountBeforeSend
        if (countBeforeSend != null && !state.isSendingComment && state.comments.size > countBeforeSend) {
            draft = ""
            commentCountBeforeSend = null
        }
    }

    LaunchedEffect(Unit) {
        viewModel.navigationEvents.collect(onNavigate)
    }

    when {
        state.isLoading -> FullScreenLoading()
        state.post == null -> FullScreenError(state.error ?: "This post is no longer available.", onRetry = viewModel::retry)
        else -> Column(Modifier.fillMaxSize()) {
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(Spacing.md),
                verticalArrangement = Arrangement.spacedBy(Spacing.md),
            ) {
                item(key = "post") {
                    PostCard(
                        post = state.post!!,
                        onOpenPost = {},
                        onOpenProfile = viewModel::openProfile,
                        onReact = viewModel::toggleReaction,
                    )
                }
                item(key = "comments-header") { Text("Comments · ${state.post!!.comments}", style = MaterialTheme.typography.titleMedium) }
                if (state.isLoadingComments) {
                    item(key = "comments-loading") { CircularProgressIndicator(Modifier.size(24.dp)) }
                } else if (state.comments.isEmpty()) {
                    item(key = "comments-empty") { Text("No comments yet. Start the conversation.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                } else {
                    val topLevelComments = state.comments.filter { it.parentId == null }
                    items(topLevelComments, key = { it.id }) { comment ->
                        val replies = state.comments.filter { it.parentId == comment.id }
                        val previewReply = replies.firstOrNull { it.isFriend } ?: replies.firstOrNull()
                        CommentThread(
                            comment = comment,
                            replies = replies,
                            previewReply = previewReply,
                            expanded = comment.id in state.expandedReplyIds,
                            reactingIds = state.reactingCommentIds,
                            onReact = viewModel::toggleCommentReaction,
                            onReply = { selected -> viewModel.setReplyTarget(if (selected.parentId == null) selected else comment) },
                            onToggleReplies = { viewModel.toggleReplies(comment.id) },
                        )
                    }
                }
            }
            if (state.error != null && state.post != null) {
                Text(state.error!!, modifier = Modifier.padding(horizontal = Spacing.md), color = MaterialTheme.colorScheme.error)
                TextButton(onClick = viewModel::retryComments) { Text("Retry comments") }
            }
            Row(
                Modifier.fillMaxWidth().padding(horizontal = Spacing.md, vertical = Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    value = draft,
                    onValueChange = { if (it.length <= 1000) draft = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text(state.replyTarget?.let { "Reply to ${it.author.fullName}…" } ?: "Write a comment…") },
                    maxLines = 4,
                )
                if (state.replyTarget != null) TextButton(onClick = { viewModel.setReplyTarget(null) }) { Text("Cancel") }
                IconButton(
                    enabled = draft.isNotBlank() && !state.isSendingComment,
                    onClick = { commentCountBeforeSend = state.comments.size; viewModel.createComment(draft) },
                    modifier = Modifier.size(48.dp),
                ) {
                    if (state.isSendingComment) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                    else AppIcon(AppSymbol.CHAT, contentDescription = "Send comment")
                }
            }
        }
    }
}

@Composable
private fun CommentThread(
    comment: CommentDto,
    replies: List<CommentDto>,
    previewReply: CommentDto?,
    expanded: Boolean,
    reactingIds: Set<String>,
    onReact: (CommentDto, String) -> Unit,
    onReply: (CommentDto) -> Unit,
    onToggleReplies: () -> Unit,
) {
    Column(Modifier.fillMaxWidth()) {
        CommentRow(comment, reactingIds, onReact) { onReply(comment) }
        if (replies.isNotEmpty()) {
            val shown = if (expanded) replies else listOfNotNull(previewReply)
            Column(Modifier.padding(start = 28.dp, top = 8.dp)) {
                shown.forEach { reply -> CommentRow(reply, reactingIds, onReact) { onReply(reply) } }
                if (replies.size > 1 || !expanded) {
                    TextButton(onClick = onToggleReplies) {
                        Text(if (expanded) "Hide replies" else "View ${replies.size} repl${if (replies.size == 1) "y" else "ies"}")
                    }
                }
            }
        }
    }
}

@Composable
@OptIn(ExperimentalFoundationApi::class)
private fun CommentRow(
    comment: CommentDto,
    reactingIds: Set<String>,
    onReact: (CommentDto, String) -> Unit,
    onReply: () -> Unit,
) {
    val emojis = mapOf(ReactionTypes.LIKE to "👍", ReactionTypes.HAHA to "😂", ReactionTypes.CARE to "🤗", ReactionTypes.ANGRY to "😠", ReactionTypes.SAD to "😢", ReactionTypes.LOVE to "❤️")
    var picker by remember(comment.id) { mutableStateOf(false) }
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        AvatarImage(comment.author.avatar?.secureUrl, comment.author.initials ?: comment.author.fullName, size = 34.dp)
        Column(Modifier.padding(start = 8.dp).weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Surface(color = MaterialTheme.colorScheme.surfaceContainerHigh, shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                    Text(comment.author.fullName, style = MaterialTheme.typography.labelLarge)
                    Text(comment.body, style = MaterialTheme.typography.bodyMedium)
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        val selected = comment.reaction ?: ReactionTypes.LIKE
                        Text(
                            text = comment.reaction?.let { "${emojis[it] ?: "👍"} ${it.replaceFirstChar(Char::uppercase)}" } ?: "Like",
                            modifier = Modifier.combinedClickable(
                                enabled = comment.id !in reactingIds,
                                onClick = { onReact(comment, selected) },
                                onLongClick = { picker = true },
                            ).semantics { contentDescription = "${selected.replaceFirstChar(Char::uppercase)} reaction. Tap to toggle or long press to choose" }.padding(horizontal = 6.dp, vertical = 4.dp),
                            color = if (comment.reaction != null) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.labelSmall,
                        )
                        Text("⌄", modifier = Modifier.clickable { picker = true }.semantics { contentDescription = "Choose reaction" }.padding(horizontal = 3.dp, vertical = 4.dp))
                    }
                    DropdownMenu(expanded = picker, onDismissRequest = { picker = false }) {
                        listOf(ReactionTypes.LIKE, ReactionTypes.HAHA, ReactionTypes.CARE, ReactionTypes.ANGRY, ReactionTypes.SAD).forEach { type ->
                            DropdownMenuItem(text = { Text("${emojis.getValue(type)}  ${type.replaceFirstChar(Char::uppercase)}") }, onClick = { picker = false; onReact(comment, type) })
                        }
                    }
                }
                TextButton(onClick = onReply) { Text("Reply") }
                val count = comment.reactions.values.sum()
                if (count > 0) Text("${comment.reaction?.let { emojis[it] } ?: "👍"} $count", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
