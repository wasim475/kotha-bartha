package com.kothabarta.feature.ludo.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.border
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.kothabarta.core.network.ludo.*
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.ui.theme.Spacing
import com.kothabarta.feature.ludo.local.LocalLudoMode
import com.kothabarta.feature.ludo.local.LocalLudoEngine
import com.kothabarta.feature.ludo.local.LocalLudoState
import com.kothabarta.feature.ludo.local.LocalLudoViewModel
import org.koin.androidx.compose.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun LudoLocalGameScreen(modeId: String, onNavigate: (NavigationEvent) -> Unit, viewModel: LocalLudoViewModel = koinViewModel(parameters = { parametersOf(modeId) })) {
    val state by viewModel.state.collectAsState()
    val isRolling by viewModel.isRolling.collectAsState()
    val isDiceRevealAnimating by viewModel.isDiceRevealAnimating.collectAsState()
    val diceAnimationId by viewModel.diceAnimationId.collectAsState()
    val isAnimatingMove by viewModel.isAnimatingMove.collectAsState()
    val selectedTokenId by viewModel.selectedTokenId.collectAsState()
    val selectedTokenSeat by viewModel.selectedTokenSeat.collectAsState()
    val board = state.toBoardDto()
    val players = board.players.associateBy { it.seat }
    Column(Modifier.fillMaxSize().background(Color(0xFF07529A)).padding(horizontal = 8.dp, vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            LocalPlayerPanel(players[0], state, isRolling, isDiceRevealAnimating, diceAnimationId, viewModel::roll, viewModel::claimDiceAnimation, viewModel::onRollAnimationFinished, Modifier.weight(1f))
            LocalPlayerPanel(players[1], state, isRolling, isDiceRevealAnimating, diceAnimationId, viewModel::roll, viewModel::claimDiceAnimation, viewModel::onRollAnimationFinished, Modifier.weight(1f))
        }
        Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
            LudoBoardCanvas(
                board = board,
                mySeat = state.turnSeat,
                allowMoves = !isRolling && !isDiceRevealAnimating && !isAnimatingMove,
                onMove = viewModel::move,
                modifier = Modifier.widthIn(max = 680.dp),
                selectedTokenId = selectedTokenId,
                selectedSeat = selectedTokenSeat,
                holdMoveAnimations = isDiceRevealAnimating,
                onMoveAnimationStateChanged = viewModel::onMoveAnimationStateChanged,
            )
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            LocalPlayerPanel(players[3], state, isRolling, isDiceRevealAnimating, diceAnimationId, viewModel::roll, viewModel::claimDiceAnimation, viewModel::onRollAnimationFinished, Modifier.weight(1f))
            LocalPlayerPanel(players[2], state, isRolling, isDiceRevealAnimating, diceAnimationId, viewModel::roll, viewModel::claimDiceAnimation, viewModel::onRollAnimationFinished, Modifier.weight(1f))
        }
        Surface(Modifier.fillMaxWidth(), color = Color(0xFF123D68), shape = RoundedCornerShape(14.dp)) {
            Column(Modifier.padding(horizontal = 12.dp, vertical = 7.dp)) {
                Text(
                    when {
                        board.phase == "FINISHED" -> "${players[state.winnerSeat]?.color ?: "Player ${state.winnerSeat?.plus(1)}"} wins"
                        isRolling -> "ROLLING DICE"
                        isDiceRevealAnimating -> "REVEALING DICE RESULT"
                        isAnimatingMove -> "MOVING TOKEN"
                        state.lastRollHadNoMoves -> "No moves available · turn passed"
                        board.phase == "MOVE" -> "CHOOSE A HIGHLIGHTED TOKEN"
                        else -> "${players[state.turnSeat]?.color} · ROLL DICE"
                    },
                    color = Color.White,
                    style = MaterialTheme.typography.titleSmall,
                )
                Text("${state.mode.title} · Turn ${state.turnNumber}", color = Color(0xFFCFDFF0), style = MaterialTheme.typography.labelSmall)
            }
        }
        if (board.phase == "FINISHED") Button(onClick = { onNavigate(NavigationEvent.PopBackStack) }, modifier = Modifier.fillMaxWidth()) { Text("Back to modes") }
    }
}

@Composable
private fun LocalPlayerPanel(
    player: LudoPlayerDto?,
    state: LocalLudoState,
    isRolling: Boolean,
    isDiceRevealAnimating: Boolean,
    diceAnimationId: Long,
    onRoll: () -> Unit,
    claimAnimation: (Long) -> Boolean,
    onAnimationFinished: (Long) -> Unit,
    modifier: Modifier = Modifier,
) {
    val board = state.toBoardDto()
    val color = when (player?.seat) { 0 -> Color(0xFFED1C24); 1 -> Color(0xFF00A651); 2 -> Color(0xFFFFD814); else -> Color(0xFF168DD0) }
    val active = player?.seat?.let { isActiveLudoPlayer(board.turnSeat, it) } == true
    val shape = RoundedCornerShape(12.dp)
    Card(
        modifier.heightIn(min = 68.dp)
            .then(if (active) Modifier.ludoActivePlayerHighlight(active, 12.dp) else Modifier.border(androidx.compose.foundation.BorderStroke(1.dp, color.copy(alpha = .5f)), shape)),
        colors = CardDefaults.cardColors(containerColor = if (active) Color(0xFFFFF9FB) else Color(0xFFF0EEE9)), shape = shape,
    ) {
        Row(Modifier.fillMaxWidth().padding(5.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            Column(Modifier.weight(1f)) {
                Text(player?.color ?: "No player", maxLines = 1, style = MaterialTheme.typography.labelMedium, color = Color(0xFF20252B))
                Text(
                    when {
                        active && isRolling -> "ROLLING…"
                        player?.seat == state.lastRollSeat && isDiceRevealAnimating -> "REVEALING RESULT"
                        state.lastRollSeat != null && player?.seat == state.lastRollSeat && !active -> "TURN COMPLETED"
                        active && isDiceRevealAnimating -> "WAITING TO ROLL"
                        active && board.phase == "MOVE" -> "CHOOSE TOKEN"
                        active -> "YOUR TURN · ROLL"
                        else -> "WAITING"
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = if (active) Color(0xFF9B285D) else Color(0xFF66717C),
                )
            }
            val playerSeat = player?.seat
            val diceValue = if (playerSeat == state.lastRollSeat) state.lastRollValue
            else if (active && board.phase == "MOVE") board.dice else null
            FilledTonalButton(
                onClick = onRoll,
                enabled = active && board.phase == "ROLL" && !isRolling && !isDiceRevealAnimating,
                modifier = Modifier.size(58.dp),
                contentPadding = PaddingValues(0.dp),
                colors = ButtonDefaults.filledTonalButtonColors(containerColor = color.copy(alpha = .22f), contentColor = color),
                shape = RoundedCornerShape(12.dp),
            ) {
                LudoAnimatedDiceFace(
                    value = diceValue,
                    animationId = diceAnimationId,
                    rollerSeat = state.lastRollSeat,
                    seat = playerSeat ?: -1,
                    claimAnimation = claimAnimation,
                    onAnimationFinished = onAnimationFinished,
                    tint = color,
                )
            }
        }
    }
}

private fun LocalLudoState.toBoardDto() = LudoBoardStateDto(
    variantId = mode.variantId, phase = phase, turnSeat = turnSeat, turnNumber = turnNumber, dice = dice,
    legal = legalMoves.map { LudoLegalMoveDto(it.tokenId, it.from, it.to) },
    rules = LudoRulesDto(safeCells = LocalLudoEngine.SAFE_CELLS.toList(), safeCellsProtect = true, allowHomeEntry = mode.allowHome),
    winnerSeat = winnerSeat,
    players = players.map { p -> LudoPlayerDto(seat = p.seat, color = p.name, status = p.status, captures = p.captures,
        tokens = p.tokens.map { LudoTokenDto(it.id, it.position) }) },
)
