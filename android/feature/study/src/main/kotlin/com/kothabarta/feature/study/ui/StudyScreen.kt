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
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.ui.components.AppIcon
import com.kothabarta.core.ui.components.AppSymbol
import com.kothabarta.core.ui.theme.Spacing
import org.koin.androidx.compose.koinViewModel

private data class StudyEntry(val symbol: AppSymbol, val title: String, val subtitle: String, val onClick: (StudyViewModel) -> Unit)

private val ENTRIES = listOf(
    StudyEntry(AppSymbol.QUIZ, "Quiz", "Subject chapters, timed sets") { it.openQuiz() },
    StudyEntry(AppSymbol.CALCULATOR, "English & Math Games", "Quick single-player rounds") { it.openGames() },
    StudyEntry(AppSymbol.LEADERBOARD, "Leaderboard", "See where you rank") { it.openLeaderboard() },
    StudyEntry(AppSymbol.TIC_TAC_TOE, "Tic-Tac-Toe", "Challenge a friend") { it.openTicTacToe() },
    StudyEntry(AppSymbol.GAMES, "Ludo", "Play online with friends") { it.openLudo() },
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
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        AppIcon(entry.symbol, contentDescription = null, modifier = Modifier.size(24.dp))
                        Spacer(Modifier.size(Spacing.sm))
                        Text(entry.title, style = MaterialTheme.typography.titleMedium)
                    }
                    Text(entry.subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}
