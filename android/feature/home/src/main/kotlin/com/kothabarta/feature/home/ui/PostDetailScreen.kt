package com.kothabarta.feature.home.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.CircularProgressIndicator
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
import org.koin.androidx.compose.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun PostDetailScreen(
    postId: String,
    onNavigate: (NavigationEvent) -> Unit,
    viewModel: PostDetailViewModel = koinViewModel(parameters = { parametersOf(postId) }),
) {
    val state by viewModel.uiState.collectAsState()
    var commentText by remember { mutableStateOf("") }
    var commentCountBeforeSend by remember { mutableStateOf<Int?>(null) }

    LaunchedEffect(state.comments.size) {
        val countBeforeSend = commentCountBeforeSend
        if (countBeforeSend != null && state.comments.size > countBeforeSend) {
            commentText = ""
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
                    items(state.comments, key = { it.id }) { comment ->
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                            AvatarImage(comment.author.avatar?.secureUrl, comment.author.initials ?: comment.author.fullName, size = 38.dp)
                            Column(
                                Modifier.padding(start = Spacing.sm).weight(1f),
                                verticalArrangement = Arrangement.spacedBy(2.dp),
                            ) {
                                Text(comment.author.fullName, style = MaterialTheme.typography.labelLarge)
                                Text(comment.body, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
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
                    value = commentText,
                    onValueChange = { if (it.length <= 1000) commentText = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Write a comment…") },
                    maxLines = 4,
                )
                IconButton(
                    enabled = commentText.isNotBlank() && !state.isSendingComment,
                    onClick = { commentCountBeforeSend = state.comments.size; viewModel.createComment(commentText) },
                    modifier = Modifier.size(48.dp),
                ) {
                    if (state.isSendingComment) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                    else AppIcon(AppSymbol.CHAT, contentDescription = "Send comment")
                }
            }
        }
    }
}
