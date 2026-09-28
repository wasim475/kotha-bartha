package com.kothabarta.feature.quiz.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.theme.Spacing
import org.koin.androidx.compose.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun QuizPlayScreen(
    chapterId: String,
    setNumber: Int,
    viewModel: QuizPlayViewModel = koinViewModel(parameters = { parametersOf(chapterId, setNumber) }),
) {
    val state by viewModel.uiState.collectAsState()

    when {
        state.isLoading -> FullScreenLoading()
        state.error != null && state.question == null && !state.isComplete -> FullScreenError(state.error!!, onRetry = viewModel::retry)
        state.isComplete -> QuizResult(state)
        state.question != null -> QuizQuestion(state, onSelect = viewModel::selectOption)
    }
}

@Composable
private fun QuizQuestion(state: QuizPlayUiState, onSelect: (Int) -> Unit) {
    val question = state.question ?: return
    Column(modifier = Modifier.fillMaxSize().padding(Spacing.md)) {
        LinearProgressIndicator(
            progress = { (state.currentIndex + 1).toFloat() / state.totalQuestions.coerceAtLeast(1) },
            modifier = Modifier.fillMaxWidth(),
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = Spacing.sm),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("Question ${state.currentIndex + 1} / ${state.totalQuestions}", style = MaterialTheme.typography.labelLarge)
            Text("Score: ${state.score}", style = MaterialTheme.typography.labelLarge)
        }

        val timerFraction by animateFloatAsState(targetValue = state.remainingSeconds / 20f, label = "timer")
        LinearProgressIndicator(
            progress = { timerFraction },
            modifier = Modifier.fillMaxWidth(),
            color = if (state.remainingSeconds <= 5) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
        )

        Text(question.question, style = MaterialTheme.typography.headlineMedium, modifier = Modifier.padding(vertical = Spacing.lg))

        question.options.forEachIndexed { index, option ->
            val isSelected = state.selectedPosition == index
            val isRevealCorrect = state.revealCorrectPosition == index
            val backgroundColor = when {
                isRevealCorrect -> Color(0xFF4CAF50)
                isSelected && state.revealCorrectPosition != null -> MaterialTheme.colorScheme.error
                isSelected -> MaterialTheme.colorScheme.primaryContainer
                else -> MaterialTheme.colorScheme.surfaceVariant
            }
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = Spacing.sm)
                    .clip(RoundedCornerShape(12.dp))
                    .clickable(enabled = state.selectedPosition == null) { onSelect(index) },
                color = backgroundColor,
            ) {
                Text(option, modifier = Modifier.padding(Spacing.md), style = MaterialTheme.typography.bodyLarge)
            }
        }
    }
}

@Composable
private fun QuizResult(state: QuizPlayUiState) {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.lg),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("🎉 Quiz complete!", style = MaterialTheme.typography.headlineMedium)
        Text("Score: ${state.finalScore}", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = Spacing.md))
        Text("${state.finalCorrect} correct · ${state.finalWrong} wrong", style = MaterialTheme.typography.bodyLarge)
    }
}
