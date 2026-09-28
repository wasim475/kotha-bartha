package com.kothabarta.feature.ludo.ui

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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.network.ludo.LudoLegalMoveDto
import com.kothabarta.core.network.ludo.LudoMemberDto
import com.kothabarta.core.network.ludo.LudoPlayerDto
import com.kothabarta.core.network.ludo.LudoResultDto
import com.kothabarta.core.ui.components.AvatarImage
import com.kothabarta.core.ui.components.EmptyState
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.theme.Spacing
import kotlinx.coroutines.delay
import org.koin.androidx.compose.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun LudoGameScreen(
    gameId: String,
    onNavigate: (NavigationEvent) -> Unit,
    viewModel: LudoGameViewModel = koinViewModel(parameters = { parametersOf(gameId) }),
) {
    val state by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) { viewModel.navigationEvents.collect(onNavigate) }
    LaunchedEffect(Unit) { viewModel.toastMessages.collect { snackbarHostState.showSnackbar(it) } }

    Scaffold(snackbarHost = { SnackbarHost(snackbarHostState) }) { padding ->
        Box(modifier = Modifier.padding(padding).fillMaxSize()) {
            when {
                state.isLoading -> FullScreenLoading()
                state.error != null && state.members.isEmpty() && state.board == null ->
                    FullScreenError(state.error!!, onRetry = viewModel::retry)
                state.status == "finished" -> LudoResultsView(state, viewModel)
                state.status == "active" -> LudoActiveBoard(state, viewModel)
                else -> LudoLobbyView(state, viewModel)
            }
            if (state.isControlledElsewhere) {
                ControlledElsewhereBanner(modifier = Modifier.align(Alignment.TopCenter))
            }
        }
    }
}

@Composable
private fun ControlledElsewhereBanner(modifier: Modifier = Modifier) {
    Surface(modifier = modifier.fillMaxWidth(), color = MaterialTheme.colorScheme.errorContainer) {
        Text(
            "This game is being controlled from another device.",
            modifier = Modifier.padding(Spacing.sm),
            color = MaterialTheme.colorScheme.onErrorContainer,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
private fun LudoLobbyView(state: LudoGameUiState, viewModel: LudoGameViewModel) {
    val myMember = state.members.firstOrNull { it.user?.id == state.myUserId }
    Column(modifier = Modifier.fillMaxSize().padding(Spacing.md)) {
        Text(state.variantId ?: "Ludo lobby", style = MaterialTheme.typography.headlineSmall)
        Text("${state.members.size} joined", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(bottom = Spacing.md))

        LazyColumn(modifier = Modifier.weight(1f, fill = true)) {
            items(state.members, key = { it.user?.id ?: it.hashCode().toString() }) { member -> MemberRow(member) }
        }

        Row(modifier = Modifier.fillMaxWidth().padding(top = Spacing.md), horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            Button(
                onClick = { viewModel.toggleReady(myMember?.ready != true) },
                enabled = !state.isTogglingReady && !state.isControlledElsewhere,
                modifier = Modifier.weight(1f),
            ) {
                Text(if (myMember?.ready == true) "Not ready" else "Ready")
            }
            if (state.isHost) {
                Button(
                    onClick = viewModel::startGame,
                    enabled = !state.isStarting && !state.isControlledElsewhere,
                    modifier = Modifier.weight(1f),
                ) {
                    Text(if (state.isStarting) "Starting..." else "Start game")
                }
            }
        }
        OutlinedButton(onClick = viewModel::leaveGame, modifier = Modifier.fillMaxWidth().padding(top = Spacing.sm)) {
            Text("Leave")
        }
    }
}

@Composable
private fun MemberRow(member: LudoMemberDto) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.xs), verticalAlignment = Alignment.CenterVertically) {
        AvatarImage(avatarUrl = member.user?.avatar?.secureUrl, initials = member.user?.initials ?: member.user?.fullName.orEmpty())
        Text(
            member.user?.fullName ?: "Player",
            modifier = Modifier.padding(start = Spacing.sm).weight(1f),
            style = MaterialTheme.typography.bodyLarge,
        )
        if (!member.online) Text("offline", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
        Text(if (member.ready) "Ready" else "Not ready", style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
private fun LudoActiveBoard(state: LudoGameUiState, viewModel: LudoGameViewModel) {
    val board = state.board
    if (board == null) {
        EmptyState("Waiting for the board...")
        return
    }
    val isMyTurn = state.mySeat != null && state.mySeat == board.turnSeat

    Column(modifier = Modifier.fillMaxSize().padding(Spacing.md)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text(if (isMyTurn) "Your turn" else "Seat ${board.turnSeat ?: "-"}'s turn", style = MaterialTheme.typography.titleMedium)
                Text("Turn ${board.turnNumber} · ${board.phase}", style = MaterialTheme.typography.bodySmall)
            }
            TurnCountdown(board.turnDeadline)
        }

        board.dice?.let { Text("Dice: $it", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.padding(vertical = Spacing.sm)) }

        Button(
            onClick = viewModel::rollDice,
            enabled = isMyTurn && board.phase == "ROLL" && !state.isRolling && !state.isControlledElsewhere,
            modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.md),
        ) {
            Text(if (state.isRolling) "Rolling..." else "Roll dice")
        }

        LazyColumn(modifier = Modifier.weight(1f, fill = true)) {
            items(board.players, key = { it.seat }) { player ->
                PlayerTokensRow(
                    player = player,
                    legal = board.legal,
                    isMyRow = player.seat == state.mySeat,
                    isMovingTokenId = state.movingTokenId,
                    enabled = isMyTurn && !state.isControlledElsewhere,
                    onTokenClick = viewModel::moveToken,
                )
            }
        }
    }
}

@Composable
private fun TurnCountdown(turnDeadline: Long?) {
    var remainingMs by remember(turnDeadline) { mutableStateOf(ludoRemainingMillis(turnDeadline)) }
    LaunchedEffect(turnDeadline) {
        while (true) {
            remainingMs = ludoRemainingMillis(turnDeadline)
            if (remainingMs <= 0L) break
            delay(500)
        }
    }
    Text("${remainingMs / 1000}s", style = MaterialTheme.typography.titleLarge)
}

@Composable
private fun PlayerTokensRow(
    player: LudoPlayerDto,
    legal: List<LudoLegalMoveDto>,
    isMyRow: Boolean,
    isMovingTokenId: Int?,
    enabled: Boolean,
    onTokenClick: (Int) -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.xs)) {
        Column(modifier = Modifier.padding(Spacing.sm)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                AvatarImage(avatarUrl = player.user?.avatar?.secureUrl, initials = player.user?.initials ?: player.color.orEmpty().take(2))
                Text(
                    "${player.user?.fullName ?: player.color ?: "Seat ${player.seat}"}${if (isMyRow) " (you)" else ""}",
                    modifier = Modifier.padding(start = Spacing.sm).weight(1f),
                    style = MaterialTheme.typography.bodyLarge,
                )
                if (!player.connected) Text("disconnected", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
                Text("captures: ${player.captures}", style = MaterialTheme.typography.labelSmall)
            }
            Row(modifier = Modifier.fillMaxWidth().padding(top = Spacing.xs), horizontalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                player.tokens.forEach { token ->
                    val isLegal = isMyRow && legal.any { it.tokenId == token.id }
                    Button(
                        onClick = { onTokenClick(token.id) },
                        enabled = isLegal && enabled && isMovingTokenId != token.id,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isLegal) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                            contentColor = if (isLegal) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                        ),
                        contentPadding = PaddingValues(horizontal = Spacing.sm, vertical = Spacing.xs),
                    ) {
                        Text(tokenLabel(token.pos), style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
    }
}

private fun tokenLabel(pos: Int): String = when {
    pos == -1 -> "Base"
    pos in 0..50 -> "T$pos"
    pos in 51..55 -> "H${pos - 50}"
    pos == 56 -> "Home"
    else -> "?"
}

@Composable
private fun LudoResultsView(state: LudoGameUiState, viewModel: LudoGameViewModel) {
    val results = state.results
    Column(modifier = Modifier.fillMaxSize().padding(Spacing.md)) {
        Text("Game finished", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.padding(bottom = Spacing.md))
        if (results.isNullOrEmpty()) {
            EmptyState("No results available.")
        } else {
            LazyColumn(modifier = Modifier.weight(1f, fill = true), contentPadding = PaddingValues(vertical = Spacing.sm)) {
                items(results.sortedBy { it.rank ?: Int.MAX_VALUE }, key = { it.seat }) { result -> ResultRow(result) }
            }
        }
        Row(modifier = Modifier.fillMaxWidth().padding(top = Spacing.md), horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            Button(
                onClick = viewModel::requestRematch,
                enabled = !state.isRequestingRematch && !state.rematchRequestSent,
                modifier = Modifier.weight(1f),
            ) {
                Text(if (state.rematchRequestSent) "Rematch requested" else if (state.isRequestingRematch) "Requesting..." else "Rematch")
            }
            OutlinedButton(onClick = viewModel::leaveGame, modifier = Modifier.weight(1f)) { Text("Leave") }
        }
    }
}

@Composable
private fun ResultRow(result: LudoResultDto) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.xs), verticalAlignment = Alignment.CenterVertically) {
        Text("#${result.rank ?: "-"}", modifier = Modifier.padding(end = Spacing.sm), style = MaterialTheme.typography.titleMedium)
        AvatarImage(avatarUrl = result.user?.avatar?.secureUrl, initials = result.user?.initials ?: result.user?.fullName.orEmpty())
        Text(
            result.user?.fullName ?: "Seat ${result.seat}",
            modifier = Modifier.padding(start = Spacing.sm).weight(1f),
            style = MaterialTheme.typography.bodyLarge,
        )
        Text("${result.rewardPoints} pts", style = MaterialTheme.typography.labelLarge)
    }
}
