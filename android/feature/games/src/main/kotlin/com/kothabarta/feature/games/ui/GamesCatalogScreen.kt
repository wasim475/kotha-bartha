package com.kothabarta.feature.games.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.network.games.GameAttemptDto
import com.kothabarta.core.network.games.GameCatalogEntryDto
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.theme.Spacing
import org.koin.androidx.compose.koinViewModel

@Composable
fun GamesCatalogScreen(onNavigate: (NavigationEvent) -> Unit, viewModel: GamesCatalogViewModel = koinViewModel()) {
    val state by viewModel.uiState.collectAsState()
    var showChallenge by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.navigationEvents.collect(onNavigate)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        when {
            showChallenge -> ChallengeScreen(onNavigate = onNavigate, onBack = { showChallenge = false })
            state.isLoading -> FullScreenLoading()
            state.error != null && state.entries.isEmpty() -> FullScreenError(state.error!!, onRetry = viewModel::retry)
            else -> LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(Spacing.md)) {
                state.lastAttempt?.let { attempt ->
                    item { ContinueCard(attempt, onClick = viewModel::continueLastAttempt) }
                }
                item {
                    TextButton(onClick = { showChallenge = true }) { Text("Challenge a friend") }
                }
                items(state.entries, key = { it.type }) { entry ->
                    GameEntryCard(entry, onClick = { viewModel.selectEntry(entry) })
                }
            }
        }
    }
}

@Composable
private fun ContinueCard(attempt: GameAttemptDto, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = Spacing.md)
            .clickable(onClick = onClick),
    ) {
        Column(modifier = Modifier.padding(Spacing.md)) {
            Text("Continue: ${attempt.gameName ?: attempt.gameType}", style = MaterialTheme.typography.titleMedium)
            Text(
                "Question ${(attempt.currentIndex + 1).coerceAtMost(attempt.totalQuestions)} of ${attempt.totalQuestions}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun GameEntryCard(entry: GameCatalogEntryDto, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = Spacing.sm)
            .clickable(enabled = entry.available, onClick = onClick),
    ) {
        Column(modifier = Modifier.padding(Spacing.md)) {
            Text(entry.name, style = MaterialTheme.typography.titleMedium)
            entry.description?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (!entry.available) {
                Text("Coming soon", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.error)
            }
        }
    }
}
