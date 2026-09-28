package com.kothabarta.feature.leaderboard.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.kothabarta.core.network.leaderboard.LeaderboardMeDto
import com.kothabarta.core.network.leaderboard.LeaderboardRowDto
import com.kothabarta.core.ui.components.AvatarImage
import com.kothabarta.core.ui.components.EmptyState
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.theme.Spacing
import org.koin.androidx.compose.koinViewModel

@Composable
fun LeaderboardScreen(viewModel: LeaderboardViewModel = koinViewModel()) {
    val state by viewModel.uiState.collectAsState()

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Spacing.sm),
            horizontalArrangement = Arrangement.spacedBy(Spacing.xs),
        ) {
            LEADERBOARD_CATEGORIES.forEach { category ->
                FilterChip(
                    selected = state.category == category,
                    onClick = { viewModel.selectCategory(category) },
                    label = { Text(category.replaceFirstChar { it.uppercase() }) },
                )
            }
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.sm),
            horizontalArrangement = Arrangement.spacedBy(Spacing.xs),
        ) {
            LEADERBOARD_PERIODS.forEach { period ->
                FilterChip(
                    selected = state.period == period,
                    onClick = { viewModel.selectPeriod(period) },
                    label = { Text(period.replaceFirstChar { it.uppercase() }) },
                )
            }
        }

        when {
            state.isLoading -> FullScreenLoading()
            state.error != null && state.data == null -> FullScreenError(state.error!!, onRetry = viewModel::retry)
            state.data == null || (state.data!!.top20.isEmpty() && state.data!!.me == null) -> EmptyState(
                state.data?.cycle?.let { if (it.status == "closed") "This leaderboard cycle is closed." else null }
                    ?: "No rankings yet.",
            )
            else -> {
                val data = state.data!!
                LazyColumn(modifier = Modifier.weight(1f, fill = true).fillMaxWidth(), contentPadding = PaddingValues(Spacing.md)) {
                    items(data.top20, key = { it.rank }) { row -> LeaderboardRow(row) }
                }
                data.me?.let { me ->
                    if (!me.inTop20) {
                        Surface(tonalElevation = 3.dp()) {
                            LeaderboardRow(
                                LeaderboardRowDto(
                                    rank = me.rank, id = me.id, fullName = "You", avatar = me.avatar,
                                    points = me.points, quizPoints = me.quizPoints, gamePoints = me.gamePoints,
                                ),
                                highlight = true,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LeaderboardRow(row: LeaderboardRowDto, highlight: Boolean = false) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = Spacing.xs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("#${row.rank}", modifier = Modifier.padding(end = Spacing.sm), style = MaterialTheme.typography.titleMedium)
        AvatarImage(avatarUrl = row.avatar?.secureUrl, initials = row.fullName.take(2))
        Text(
            row.fullName,
            modifier = Modifier.padding(start = Spacing.sm).weight(1f),
            style = if (highlight) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyLarge,
            color = if (highlight) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
        )
        Text("${row.points} pts", style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
private fun Dp() = MaterialTheme.colorScheme
private fun Int.dp() = androidx.compose.ui.unit.Dp(this.toFloat())
