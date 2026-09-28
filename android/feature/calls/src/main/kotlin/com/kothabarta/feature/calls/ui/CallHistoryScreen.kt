package com.kothabarta.feature.calls.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.kothabarta.core.network.call.CallHistoryRowDto
import com.kothabarta.core.ui.components.AvatarImage
import com.kothabarta.core.ui.components.EmptyState
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.theme.Spacing
import com.kothabarta.feature.calls.domain.CallSessionManager
import org.koin.androidx.compose.koinViewModel
import org.koin.compose.koinInject
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val HISTORY_DATE_FORMATTER = DateTimeFormatter.ofPattern("MMM d, h:mm a")

@Composable
fun CallHistoryScreen(
    callSessionManager: CallSessionManager = koinInject(),
    viewModel: CallHistoryViewModel = koinViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    when {
        state.isLoading -> FullScreenLoading()
        state.error != null && state.rows.isEmpty() -> FullScreenError(state.error!!, onRetry = viewModel::retry)
        state.rows.isEmpty() -> EmptyState("No call history yet.")
        else -> LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = Spacing.sm)) {
            items(state.rows, key = { it.id }) { row ->
                CallHistoryRow(
                    row = row,
                    onCallBack = { row.with?.let { peer -> callSessionManager.startCall(peer, row.video) } },
                )
            }
            item {
                if (state.canLoadMore) {
                    Box(modifier = Modifier.fillMaxWidth().padding(Spacing.md), contentAlignment = Alignment.Center) {
                        if (state.isLoadingMore) {
                            CircularProgressIndicator(modifier = Modifier.padding(Spacing.sm))
                        } else {
                            TextButton(onClick = viewModel::loadMore) { Text("Load more") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CallHistoryRow(row: CallHistoryRowDto, onCallBack: () -> Unit) {
    val missedStyle = isCallHistoryMissedStyle(row.status, row.direction)
    val directionIcon = when {
        missedStyle -> "✖️"
        row.direction == "outgoing" -> "↗️"
        else -> "↙️"
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.md, vertical = Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AvatarImage(avatarUrl = row.with?.avatar?.secureUrl, initials = row.with?.initials ?: row.with?.fullName ?: "?", size = 48.dp)
        Column(modifier = Modifier.padding(start = Spacing.sm).weight(1f)) {
            Text(row.with?.fullName ?: "Unknown", style = MaterialTheme.typography.titleMedium)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(directionIcon, modifier = Modifier.padding(end = Spacing.xs))
                Text(if (row.video) "📹" else "📞", modifier = Modifier.padding(end = Spacing.xs))
                Text(
                    callHistoryStatusLabel(row.status, row.direction, row.durationSec),
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (missedStyle) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            row.createdAt?.let { createdAt ->
                val formatted = runCatching {
                    Instant.parse(createdAt).atZone(ZoneId.systemDefault()).format(HISTORY_DATE_FORMATTER)
                }.getOrDefault("")
                if (formatted.isNotEmpty()) {
                    Text(formatted, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        if (row.with != null) {
            TextButton(onClick = onCallBack) { Text("Call") }
        }
    }
}
