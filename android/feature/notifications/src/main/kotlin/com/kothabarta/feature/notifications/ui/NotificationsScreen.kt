package com.kothabarta.feature.notifications.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.network.social.NotificationDto
import com.kothabarta.core.ui.components.AvatarImage
import com.kothabarta.core.ui.components.EmptyState
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.theme.Spacing
import org.koin.androidx.compose.koinViewModel

@Composable
fun NotificationsScreen(
    onNavigate: (NavigationEvent) -> Unit,
    viewModel: NotificationsViewModel = koinViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.navigationEvents.collect(onNavigate)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.md, vertical = Spacing.sm),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Notifications", style = MaterialTheme.typography.titleLarge)
            TextButton(onClick = viewModel::markAllRead) { Text("Mark all read") }
        }

        when {
            state.isLoading -> FullScreenLoading()
            state.error != null && state.notifications.isEmpty() -> FullScreenError(state.error!!, onRetry = viewModel::retry)
            state.notifications.isEmpty() -> EmptyState("You're all caught up.")
            else -> LazyColumn(contentPadding = PaddingValues(bottom = Spacing.md)) {
                items(state.notifications, key = { it.id }) { notification ->
                    NotificationRow(notification, onClick = { viewModel.open(notification) })
                }
            }
        }
    }
}

@Composable
private fun NotificationRow(notification: NotificationDto, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .background(if (notification.read) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.15f))
            .padding(Spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AvatarImage(
            avatarUrl = notification.actor?.avatar?.secureUrl,
            initials = notification.actor?.initials ?: notification.actor?.fullName ?: "?",
        )
        Text(
            text = notification.message ?: notification.type,
            modifier = Modifier.padding(start = Spacing.sm).weight(1f),
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}
