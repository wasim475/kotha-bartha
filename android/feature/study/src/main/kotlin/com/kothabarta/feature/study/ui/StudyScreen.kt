package com.kothabarta.feature.study.ui

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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.ui.theme.Spacing
import org.koin.androidx.compose.koinViewModel

private data class StudyEntry(val emoji: String, val title: String, val subtitle: String, val onClick: (StudyViewModel) -> Unit)

private val ENTRIES = listOf(
    StudyEntry("📚", "Quiz", "Subject chapters, timed sets") { it.openQuiz() },
    StudyEntry("🧮", "English & Math Games", "Quick single-player rounds") { it.openGames() },
    StudyEntry("🏆", "Leaderboard", "See where you rank") { it.openLeaderboard() },
    StudyEntry("⭕", "Tic-Tac-Toe", "Challenge a friend") { it.openTicTacToe() },
    StudyEntry("🎲", "Ludo", "Play online with friends") { it.openLudo() },
)

@Composable
fun StudyScreen(onNavigate: (NavigationEvent) -> Unit, viewModel: StudyViewModel = koinViewModel()) {
    LaunchedEffect(Unit) {
        viewModel.navigationEvents.collect(onNavigate)
    }

    LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(Spacing.md)) {
        items(ENTRIES) { entry ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = Spacing.sm)
                    .clickable { entry.onClick(viewModel) },
            ) {
                Column(modifier = Modifier.padding(Spacing.md)) {
                    Text("${entry.emoji}  ${entry.title}", style = MaterialTheme.typography.titleMedium)
                    Text(entry.subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}
