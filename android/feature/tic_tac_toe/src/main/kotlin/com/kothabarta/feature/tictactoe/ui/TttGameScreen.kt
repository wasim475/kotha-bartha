package com.kothabarta.feature.tictactoe.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.theme.Spacing
import org.koin.androidx.compose.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun TttGameScreen(
    gameId: String,
    onNavigate: (NavigationEvent) -> Unit,
    viewModel: TttGameViewModel = koinViewModel(parameters = { parametersOf(gameId) }),
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.navigationEvents.collect(onNavigate)
    }

    when {
        state.isLoading -> FullScreenLoading()
        state.error != null && state.game == null -> FullScreenError(state.error!!, onRetry = viewModel::retry)
        state.game != null -> GameBoard(state, viewModel)
    }
}

@Composable
private fun GameBoard(state: TttGameUiState, viewModel: TttGameViewModel) {
    val game = state.game ?: return
    Column(modifier = Modifier.fillMaxSize().padding(Spacing.md)) {
        StatusHeader(state)

        if (state.incomingRematch != null) {
            RematchBanner(onAccept = viewModel::acceptIncomingRematch, onDecline = viewModel::declineIncomingRematch)
        }
        if (state.opponentLeft) {
            Text(
                "The other player left the game.",
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(vertical = Spacing.sm),
            )
        }
        state.moveError?.let {
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(vertical = Spacing.sm))
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = Spacing.lg),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            for (row in 0..2) {
                Row {
                    for (col in 0..2) {
                        val index = row * 3 + col
                        Cell(
                            value = game.board.getOrNull(index),
                            isWinning = index in game.winningLine,
                            enabled = game.status == "active" && game.board.getOrNull(index) == null &&
                                state.mySymbol != null && game.currentTurn == state.mySymbol && !state.isSubmittingMove,
                            onClick = { viewModel.onCellClick(index) },
                        )
                    }
                }
            }
        }

        if (game.status != "active") {
            ResultCard(state, onRematch = viewModel::requestRematch, rematchSent = state.rematchRequestSent)
        }

        ReactionRow(onReact = viewModel::sendReaction)

        Row(modifier = Modifier.fillMaxWidth().padding(top = Spacing.md), horizontalArrangement = Arrangement.End) {
            OutlinedButton(onClick = viewModel::leaveGame) { Text("Leave") }
        }
    }
}

@Composable
private fun StatusHeader(state: TttGameUiState) {
    val game = state.game ?: return
    val statusText = when {
        game.status == "active" && game.currentTurn == state.mySymbol -> "Your turn"
        game.status == "active" -> "Opponent's turn"
        game.winner == "draw" -> "It's a draw"
        game.winnerId != null && game.winnerId == state.myUserId -> "You won!"
        game.winner != null -> "You lost"
        else -> game.status
    }
    Text(statusText, style = MaterialTheme.typography.headlineSmall)
    Text("You are ${state.mySymbol ?: "?"}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
private fun Cell(value: String?, isWinning: Boolean, enabled: Boolean, onClick: () -> Unit) {
    val background = if (isWinning) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant
    Surface(
        modifier = Modifier
            .size(88.dp)
            .padding(4.dp)
            .clip(RoundedCornerShape(8.dp))
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(8.dp))
            .clickable(enabled = enabled, onClick = onClick),
        color = background,
    ) {
        Column(modifier = Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Text(value ?: "", style = MaterialTheme.typography.headlineLarge)
        }
    }
}

@Composable
private fun ResultCard(state: TttGameUiState, onRematch: () -> Unit, rematchSent: Boolean) {
    val game = state.game ?: return
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.md)) {
        Column(modifier = Modifier.padding(Spacing.md)) {
            val resultText = when {
                game.winner == "draw" -> "Draw — well played."
                game.winnerId == state.myUserId -> "You won this round!"
                else -> "Better luck next time."
            }
            Text(resultText, style = MaterialTheme.typography.titleMedium)
            if (game.winnerId == state.myUserId && game.rewardPoints > 0) {
                Text("+${game.rewardPoints} points", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodyLarge)
            }
            Button(onClick = onRematch, enabled = !rematchSent, modifier = Modifier.padding(top = Spacing.sm)) {
                Text(if (rematchSent) "Rematch requested" else "Request rematch")
            }
        }
    }
}

@Composable
private fun RematchBanner(onAccept: () -> Unit, onDecline: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.secondaryContainer, RoundedCornerShape(8.dp))
            .padding(Spacing.sm),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("Rematch requested", style = MaterialTheme.typography.bodyLarge)
        Row {
            TextButton(onClick = onDecline) { Text("Decline") }
            Button(onClick = onAccept, modifier = Modifier.padding(start = Spacing.sm)) { Text("Accept") }
        }
    }
}

private val REACTION_EMOJI = mapOf("poke" to "👉", "haha" to "😂", "sad" to "😢", "angry" to "😠")

@Composable
private fun ReactionRow(onReact: (String) -> Unit) {
    Row(modifier = Modifier.fillMaxWidth().padding(top = Spacing.sm), horizontalArrangement = Arrangement.SpaceEvenly) {
        TTT_REACTION_TYPES.forEach { type ->
            Text(
                REACTION_EMOJI[type] ?: type,
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .clickable { onReact(type) }
                    .padding(Spacing.sm),
            )
        }
    }
}
