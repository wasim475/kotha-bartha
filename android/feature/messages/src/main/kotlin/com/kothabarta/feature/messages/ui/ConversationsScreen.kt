package com.kothabarta.feature.messages.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.network.messages.ConversationDto
import com.kothabarta.core.ui.components.AvatarImage
import com.kothabarta.core.ui.components.EmptyState
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.theme.Spacing
import org.koin.androidx.compose.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConversationsScreen(
    onNavigate: (NavigationEvent) -> Unit,
    viewModel: ConversationsViewModel = koinViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.navigationEvents.collect(onNavigate)
    }

    when {
        state.isLoading -> FullScreenLoading()
        state.error != null && state.conversations.isEmpty() -> FullScreenError(state.error!!, onRetry = viewModel::retry)
        else -> PullToRefreshBox(
            isRefreshing = state.isRefreshing,
            onRefresh = viewModel::refresh,
            modifier = Modifier.fillMaxSize(),
        ) {
            if (state.conversations.isEmpty()) {
                EmptyState("No conversations yet — message a friend to start one.")
            } else {
                LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = Spacing.sm)) {
                    items(state.conversations, key = { it.id }) { conversation ->
                        ConversationRow(conversation, onClick = { viewModel.openConversation(conversation) })
                    }
                }
            }
        }
    }
}

@Composable
private fun ConversationRow(conversation: ConversationDto, onClick: () -> Unit) {
    val peer = conversation.user
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = Spacing.md, vertical = Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box {
            AvatarImage(avatarUrl = peer?.avatar?.secureUrl, initials = peer?.initials ?: peer?.fullName ?: "?", size = 52.dp)
            if (peer?.isOnline == true) {
                Box(
                    modifier = Modifier
                        .size(14.dp)
                        .align(Alignment.BottomEnd)
                        .clip(CircleShape)
                        .background(Color(0xFF4CAF50)),
                )
            }
        }
        Column(modifier = Modifier.padding(start = Spacing.sm).weight(1f)) {
            Text(peer?.fullName ?: "Unknown", style = MaterialTheme.typography.titleMedium)
            Text(
                text = conversation.lastMessage ?: "Say hello",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
            )
        }
        if (conversation.unreadCount > 0) {
            Box(
                modifier = Modifier
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary)
                    .padding(horizontal = 8.dp, vertical = 2.dp),
            ) {
                Text(
                    conversation.unreadCount.toString(),
                    color = MaterialTheme.colorScheme.onPrimary,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}
