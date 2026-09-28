package com.kothabarta.feature.games.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.kothabarta.core.network.games.ChallengeMatchDto
import com.kothabarta.core.ui.components.AvatarImage
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.theme.Spacing
import org.koin.androidx.compose.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun ChallengePlayScreen(
    matchId: String,
    viewModel: ChallengePlayViewModel = koinViewModel(parameters = { parametersOf(matchId) }),
) {
    val state by viewModel.uiState.collectAsState()
    val match = state.match

    when {
        state.isLoading -> FullScreenLoading()
        state.error != null && match == null -> FullScreenError(state.error!!, onRetry = viewModel::retry)
        match == null -> FullScreenLoading()
        match.outcome != null -> ChallengeFinished(
            match,
            isRequestingRematch = state.isRequestingRematch,
            rematchRequested = state.rematchRequested,
            onRematch = viewModel::requestRematch,
        )
        else -> ChallengeQuestion(state, onSelect = viewModel::selectOption)
    }
}

@Composable
private fun MatchHeader(match: ChallengeMatchDto) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = Spacing.sm),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PlayerBadge(name = match.you?.fullName ?: "You", avatarUrl = match.you?.avatar?.secureUrl, score = match.totals.you.score)
        Text("vs", style = MaterialTheme.typography.labelLarge)
        PlayerBadge(
            name = match.opponent?.fullName ?: "Opponent",
            avatarUrl = match.opponent?.avatar?.secureUrl,
            score = match.totals.opponent.score,
        )
    }
}

@Composable
private fun PlayerBadge(name: String, avatarUrl: String?, score: Int) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        AvatarImage(avatarUrl = avatarUrl, initials = name.take(2))
        Text(name, style = MaterialTheme.typography.bodyMedium)
        Text("$score pts", style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
private fun ChallengeQuestion(state: ChallengePlayUiState, onSelect: (Int) -> Unit) {
    val match = state.match ?: return
    val current = match.current
    Column(modifier = Modifier.fillMaxSize().padding(Spacing.md)) {
        MatchHeader(match)
        LinearProgressIndicator(
            progress = { (match.currentIndex + 1).toFloat() / match.total.coerceAtLeast(1) },
            modifier = Modifier.fillMaxWidth(),
        )

        if (current == null) {
            Text(
                "Waiting for the next question…",
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.padding(top = Spacing.lg),
            )
            return
        }

        val maxMs = (current.remainingMs ?: state.remainingMs).coerceAtLeast(1L)
        val timerFraction by animateFloatAsState(targetValue = state.remainingMs.toFloat() / maxMs, label = "timer")
        LinearProgressIndicator(
            progress = { timerFraction },
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = Spacing.sm),
            color = if (state.isTimeUp) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
        )

        Text(current.prompt, style = MaterialTheme.typography.headlineMedium, modifier = Modifier.padding(vertical = Spacing.lg))

        val optionsDisabled = state.selectedPosition != null || state.isTimeUp
        current.options.forEachIndexed { index, option ->
            val isSelected = state.selectedPosition == index
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = Spacing.sm)
                    .clip(RoundedCornerShape(12.dp))
                    .clickable(enabled = !optionsDisabled) { onSelect(index) },
                color = if (isSelected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
            ) {
                Text(option, modifier = Modifier.padding(Spacing.md), style = MaterialTheme.typography.bodyLarge)
            }
        }

        if (state.selectedPosition != null) {
            Text(
                if (state.opponentAnswered) "Waiting for the result…" else "Waiting for your opponent…",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = Spacing.sm),
            )
        }
    }
}

@Composable
private fun ChallengeFinished(
    match: ChallengeMatchDto,
    isRequestingRematch: Boolean,
    rematchRequested: Boolean,
    onRematch: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(Spacing.lg),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            when (match.outcome) {
                "win" -> "You won!"
                "loss", "lose" -> "You lost"
                "draw" -> "It's a draw"
                else -> "Match finished"
            },
            style = MaterialTheme.typography.headlineMedium,
        )
        Text(
            "${match.totals.you.score} – ${match.totals.opponent.score}",
            style = MaterialTheme.typography.titleLarge,
            modifier = Modifier.padding(top = Spacing.md),
        )
        if (match.rewardPoints > 0) {
            Text("+${match.rewardPoints} pts", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
        }
        match.rewardWithheld?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Button(onClick = onRematch, enabled = !isRequestingRematch && !rematchRequested, modifier = Modifier.padding(top = Spacing.lg)) {
            Text(if (rematchRequested) "Rematch requested" else "Request rematch")
        }
    }
}
