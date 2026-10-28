package com.kothabarta.feature.ludo.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
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
import com.kothabarta.core.network.ludo.LudoMemberDto
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

    val playerBySeat = board.players.associateBy { it.seat }
    Column(
        modifier = Modifier.fillMaxSize().background(Color(0xFF07529A)).padding(horizontal = 8.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            LudoPlayerPanel(playerBySeat[0], board, state, viewModel, Modifier.weight(1f))
            LudoPlayerPanel(playerBySeat[1], board, state, viewModel, Modifier.weight(1f))
        }

        Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
            LudoBoardCanvas(
                board,
                state.mySeat,
                allowMoves = !state.isControlledElsewhere && state.movingTokenId == null && !state.isAnimatingMove && !state.isDiceRevealAnimating,
                onMove = viewModel::moveToken,
                modifier = Modifier.widthIn(max = 680.dp),
                selectedTokenId = state.movingTokenId,
                selectedSeat = state.mySeat,
                holdMoveAnimations = state.isDiceRevealAnimating,
                onMoveAnimationStateChanged = viewModel::onMoveAnimationStateChanged,
            )
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            LudoPlayerPanel(playerBySeat[3], board, state, viewModel, Modifier.weight(1f))
            LudoPlayerPanel(playerBySeat[2], board, state, viewModel, Modifier.weight(1f))
        }

        Row(
            Modifier.fillMaxWidth().heightIn(min = 46.dp).clip(RoundedCornerShape(14.dp)).background(Color(0xFF123D68)).padding(horizontal = 12.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    when {
                        state.isRolling -> "ROLLING DICE"
                        state.isDiceRevealAnimating -> "REVEALING DICE RESULT"
                        state.isAnimatingMove -> "MOVING TOKEN"
                        isMyTurn && board.phase == "MOVE" -> "CHOOSE A HIGHLIGHTED TOKEN"
                        isMyTurn -> "YOUR TURN · ROLL DICE"
                        else -> "SEAT ${(board.turnSeat ?: -1) + 1} · WAITING"
                    },
                    color = Color.White,
                    style = MaterialTheme.typography.titleSmall,
                )
                Text("Turn ${board.turnNumber} · ${board.phase}", color = Color(0xFFCFDFF0), style = MaterialTheme.typography.labelSmall)
                state.rollNotice?.let { Text(it, color = Color(0xFFFFE5A8), style = MaterialTheme.typography.labelSmall) }
            }
            TurnCountdown(board.turnDeadline)
        }
    }
}

@Composable
private fun LudoPlayerPanel(
    player: com.kothabarta.core.network.ludo.LudoPlayerDto?,
    board: com.kothabarta.core.network.ludo.LudoBoardStateDto,
    state: LudoGameUiState,
    viewModel: LudoGameViewModel,
    modifier: Modifier = Modifier,
) {
    if (player == null) {
        Box(modifier.heightIn(min = 58.dp))
        return
    }
    val color = when (player.seat) { 0 -> Color(0xFFED1C24); 1 -> Color(0xFF00A651); 2 -> Color(0xFFFFD814); else -> Color(0xFF168DD0) }
    val active = isActiveLudoPlayer(board.turnSeat, player.seat)
    val canRoll = active && player.seat == state.mySeat && board.phase == "ROLL" && !state.isRolling && !state.isDiceRevealAnimating && !state.isAnimatingMove && state.movingTokenId == null && !state.isControlledElsewhere
    val diceAnimationId = diceAnimationIdForSeat(state.diceAnimationId, state.diceRollSeat, player.seat)
    val shownDiceValue = if (active && board.phase == "MOVE") board.dice
    else if (diceAnimationId > 0L) state.confirmedDiceValue else null
    val shape = RoundedCornerShape(12.dp)
    Card(
        modifier = modifier.heightIn(min = 68.dp)
            .then(if (active) Modifier.ludoActivePlayerHighlight(active, 12.dp) else Modifier.border(androidx.compose.foundation.BorderStroke(1.dp, color.copy(alpha = .5f)), shape)),
        colors = androidx.compose.material3.CardDefaults.cardColors(containerColor = Color(0xFFF9F6EF)),
        shape = shape,
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 5.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            AvatarImage(avatarUrl = player.user?.avatar?.secureUrl, initials = player.user?.initials ?: player.color.orEmpty().take(2))
            Column(Modifier.weight(1f)) {
                Text(player.user?.fullName ?: player.color ?: "Player ${player.seat + 1}", maxLines = 1, style = MaterialTheme.typography.labelMedium, color = Color(0xFF20252B))
                Text(
                    when {
                        !player.connected -> "OFFLINE"
                        active && state.isRolling -> "ROLLING…"
                        player.seat == state.diceRollSeat && state.isDiceRevealAnimating -> "REVEALING RESULT"
                        player.seat == state.diceRollSeat && !active -> "TURN COMPLETED"
                        active && state.isDiceRevealAnimating -> "WAITING TO ROLL"
                        active && state.isAnimatingMove -> "MOVING TOKEN"
                        active && board.phase == "MOVE" -> "CHOOSE TOKEN"
                        active && canRoll -> "YOUR TURN · ROLL"
                        active -> "YOUR TURN"
                        else -> "WAITING"
                    },
                    maxLines = 1,
                    style = MaterialTheme.typography.labelSmall,
                    color = if (active) Color(0xFF9B285D) else Color(0xFF66717C),
                )
            }
            androidx.compose.material3.FilledTonalButton(
                onClick = viewModel::rollDice,
                enabled = canRoll,
                modifier = Modifier.size(60.dp),
                contentPadding = PaddingValues(0.dp),
                colors = ButtonDefaults.filledTonalButtonColors(containerColor = color.copy(alpha = .22f), contentColor = color),
                shape = RoundedCornerShape(10.dp),
            ) {
                LudoAnimatedDiceFace(
                    value = shownDiceValue,
                    animationId = state.diceAnimationId,
                    rollerSeat = state.diceRollSeat,
                    seat = player.seat,
                    claimAnimation = viewModel::claimDiceAnimation,
                    onAnimationFinished = viewModel::onRollAnimationFinished,
                    tint = color,
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
