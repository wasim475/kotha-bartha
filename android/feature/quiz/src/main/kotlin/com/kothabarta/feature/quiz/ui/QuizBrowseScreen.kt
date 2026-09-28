package com.kothabarta.feature.quiz.ui

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
import androidx.compose.ui.Modifier
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.ui.components.EmptyState
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.theme.Spacing
import org.koin.androidx.compose.koinViewModel

@Composable
fun QuizBrowseScreen(onNavigate: (NavigationEvent) -> Unit, viewModel: QuizBrowseViewModel = koinViewModel()) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.navigationEvents.collect(onNavigate)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        if (state.step != QuizStep.CATEGORY) {
            TextButton(onClick = viewModel::back) { Text("← Back") }
        }
        when {
            state.isLoading -> FullScreenLoading()
            state.error != null -> FullScreenError(state.error!!, onRetry = { /* re-select not idempotent; user can go back */ })
            else -> when (state.step) {
                QuizStep.CATEGORY -> Options(state.categories.map { c -> c.label to { viewModel.selectCategory(c.key) } })
                QuizStep.CLASS_LEVEL -> Options(state.classLevels.map { it to { viewModel.selectClassLevel(it) } })
                QuizStep.DIVISION -> Options(state.divisions.map { it to { viewModel.selectDivision(it) } })
                QuizStep.SUBJECTS -> if (state.subjects.isEmpty()) EmptyState("No subjects yet.") else
                    Options(state.subjects.map { it.name to { viewModel.selectSubject(it) } })
                QuizStep.CHAPTERS -> if (state.chapters.isEmpty()) EmptyState("No chapters yet.") else
                    Options(state.chapters.map { it.name to { viewModel.selectChapter(it) } })
                QuizStep.SETS -> if (state.sets.isEmpty()) EmptyState("No question sets published yet.") else
                    LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(Spacing.md)) {
                        items(state.sets, key = { it.setNumber }) { set ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = Spacing.sm)
                                    .clickable { viewModel.selectSet(set) },
                            ) {
                                Column(modifier = Modifier.padding(Spacing.md)) {
                                    Text("Set ${set.setNumber}", style = MaterialTheme.typography.titleMedium)
                                    Text(
                                        "${set.totalQuestions} questions · ${set.status.replace('_', ' ')}" +
                                            (set.lastScore?.let { " · last score $it" } ?: ""),
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                    }
            }
        }
    }
}

@Composable
private fun Options(items: List<Pair<String, () -> Unit>>) {
    LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(Spacing.md)) {
        items(items) { (label, onClick) ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = Spacing.sm)
                    .clickable(onClick = onClick),
            ) {
                Text(label, modifier = Modifier.padding(Spacing.md), style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}
