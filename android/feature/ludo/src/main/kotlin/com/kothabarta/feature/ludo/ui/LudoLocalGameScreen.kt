package com.kothabarta.feature.ludo.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.border
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.runtime.mutableStateMapOf
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
fun LudoLocalGameScreen(
    modeId: String,
    playerCount: Int = 4,
    onNavigate: (NavigationEvent) -> Unit,
    viewModel: LocalLudoViewModel = koinViewModel(parameters = { parametersOf(modeId, playerCount) }),
) {
    val state by viewModel.state.collectAsState()
    val isRolling by viewModel.isRolling.collectAsState()
    val isDiceRevealAnimating by viewModel.isDiceRevealAnimating.collectAsState()
    val diceAnimationId by viewModel.diceAnimationId.collectAsState()
    val isAnimatingMove by viewModel.isAnimatingMove.collectAsState()
    val selectedTokenId by viewModel.selectedTokenId.collectAsState()
    val selectedTokenSeat by viewModel.selectedTokenSeat.collectAsState()
    var exitDialogSeat by remember { mutableStateOf<Int?>(null) }
    var renameDialogSeat by remember { mutableStateOf<Int?>(null) }
    var selectedManagementSeat by remember { mutableIntStateOf(state.turnSeat) }
    var nameDraft by remember { mutableStateOf("") }
    var nameError by remember { mutableStateOf(false) }
    var rootOrigin by remember { mutableStateOf(Offset.Zero) }
    val diceAnchors = remember { mutableStateMapOf<Int, Offset>() }
    val board = state.toBoardDto()
    val players = board.players.associateBy { it.seat }
    LaunchedEffect(state.players, state.turnSeat) {
        if (state.players.any { it.seat == selectedManagementSeat }) return@LaunchedEffect
        selectedManagementSeat = state.turnSeat.takeIf { seat -> state.players.any { it.seat == seat } }
            ?: state.players.firstOrNull()?.seat
            ?: -1
    }
    val selectedParticipant = state.players.firstOrNull { it.seat == selectedManagementSeat }
    val presentationSeat = dicePresentationSeat(
        state.turnSeat.takeIf { it >= 0 },
        state.lastRollSeat,
        isRolling,
        isDiceRevealAnimating,
        isAnimatingMove,
    )
    val transfer = rememberLudoDiceTransferState(
        ownerSeat = presentationSeat,
        face = state.lastRollValue ?: 6,
        isBusy = isRolling || isDiceRevealAnimating || isAnimatingMove,
        anchors = diceAnchors,
    )
    Box(
        Modifier.fillMaxSize().onGloballyPositioned { rootOrigin = it.positionInRoot() },
    ) {
      Column(Modifier.fillMaxSize().background(Color(0xFF07529A)).padding(horizontal = 8.dp, vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            LocalSeatPanel(players[0], transfer.isTransferring, rootOrigin, diceAnchors, state, isRolling, isDiceRevealAnimating, diceAnimationId, viewModel::roll, viewModel::claimDiceAnimation, viewModel::onRollAnimationFinished, Modifier.weight(1f))
            LocalSeatPanel(players[1], transfer.isTransferring, rootOrigin, diceAnchors, state, isRolling, isDiceRevealAnimating, diceAnimationId, viewModel::roll, viewModel::claimDiceAnimation, viewModel::onRollAnimationFinished, Modifier.weight(1f))
        }
        Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
            LudoBoardCanvas(
                board = board,
                mySeat = state.turnSeat,
                allowMoves = !isRolling && !isDiceRevealAnimating && !isAnimatingMove,
                onMove = viewModel::move,
                modifier = Modifier.widthIn(max = 720.dp),
                selectedTokenId = selectedTokenId,
                selectedSeat = selectedTokenSeat,
                holdMoveAnimations = isDiceRevealAnimating,
                onMoveAnimationStateChanged = viewModel::onMoveAnimationStateChanged,
            )
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            LocalSeatPanel(players[3], transfer.isTransferring, rootOrigin, diceAnchors, state, isRolling, isDiceRevealAnimating, diceAnimationId, viewModel::roll, viewModel::claimDiceAnimation, viewModel::onRollAnimationFinished, Modifier.weight(1f))
            LocalSeatPanel(players[2], transfer.isTransferring, rootOrigin, diceAnchors, state, isRolling, isDiceRevealAnimating, diceAnimationId, viewModel::roll, viewModel::claimDiceAnimation, viewModel::onRollAnimationFinished, Modifier.weight(1f))
        }
        Surface(Modifier.fillMaxWidth(), color = Color(0xFF123D68), shape = RoundedCornerShape(14.dp)) {
            Column(Modifier.padding(horizontal = 10.dp, vertical = 5.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            when {
                                board.phase == "FINISHED" && state.winnerSeat != null -> "${players[state.winnerSeat]?.color ?: "Player ${state.winnerSeat?.plus(1)}"} wins"
                                board.phase == "FINISHED" -> "Game ended · no players remain"
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
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    Row(
                        Modifier.weight(1f).horizontalScroll(rememberScrollState()),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        state.players.forEach { participant ->
                            TextButton(
                                onClick = { selectedManagementSeat = participant.seat },
                                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 0.dp),
                                colors = ButtonDefaults.textButtonColors(
                                    contentColor = if (participant.seat == selectedManagementSeat) Color.White else Color(0xFFCFDFF0),
                                ),
                            ) {
                                Text(
                                    participant.name,
                                    maxLines = 1,
                                    style = MaterialTheme.typography.labelSmall,
                                )
                            }
                        }
                    }
                    TextButton(
                        onClick = {
                            selectedParticipant?.let {
                                nameDraft = it.name
                                nameError = false
                                renameDialogSeat = it.seat
                            }
                        },
                        enabled = selectedParticipant != null,
                        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 0.dp),
                    ) { Text("Edit name") }
                    TextButton(
                        onClick = { selectedParticipant?.let { exitDialogSeat = it.seat } },
                        enabled = selectedParticipant != null && board.phase != "FINISHED",
                        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 0.dp),
                    ) { Text("Exit") }
                }
            }
        }
        if (board.phase == "FINISHED") Button(onClick = { onNavigate(NavigationEvent.PopBackStack) }, modifier = Modifier.fillMaxWidth()) { Text("Back to modes") }
    }
    LudoDiceTransferOverlay(
        transfer,
        tintBySeat = mapOf(0 to Color(0xFFED1C24), 1 to Color(0xFF00A651), 2 to Color(0xFFFFD814), 3 to Color(0xFF168DD0)),
    )
    }
    val leavingPlayer = state.players.firstOrNull { it.seat == exitDialogSeat }
    if (leavingPlayer != null) {
        AlertDialog(
            onDismissRequest = { exitDialogSeat = null },
            title = { Text("Exit game?") },
            text = { Text("${leavingPlayer.name} will leave this local game. Their tokens will be removed, and this action cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.leavePlayer(leavingPlayer.seat)
                    exitDialogSeat = null
                }) { Text("Exit player") }
            },
            dismissButton = { TextButton(onClick = { exitDialogSeat = null }) { Text("Cancel") } },
        )
    }
    val renamingPlayer = state.players.firstOrNull { it.seat == renameDialogSeat }
    if (renamingPlayer != null) {
        AlertDialog(
            onDismissRequest = { renameDialogSeat = null },
            title = { Text("Edit player name") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                    OutlinedTextField(
                        value = nameDraft,
                        onValueChange = {
                            nameDraft = it
                            nameError = false
                        },
                        singleLine = true,
                        label = { Text("Player name") },
                        supportingText = {
                            Text(if (nameError) "Enter 1–${LocalLudoEngine.MAX_PLAYER_NAME_LENGTH} characters." else "${nameDraft.trim().length}/${LocalLudoEngine.MAX_PLAYER_NAME_LENGTH}")
                        },
                        isError = nameError,
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    if (viewModel.renamePlayer(renamingPlayer.seat, nameDraft)) {
                        renameDialogSeat = null
                    } else {
                        nameError = true
                    }
                }) { Text("Save") }
            },
            dismissButton = { TextButton(onClick = { renameDialogSeat = null }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun LocalSeatPanel(
    player: LudoPlayerDto?,
    transferIsAnimating: Boolean,
    rootOrigin: Offset,
    anchors: MutableMap<Int, Offset>,
    state: LocalLudoState,
    isRolling: Boolean,
    isDiceRevealAnimating: Boolean,
    diceAnimationId: Long,
    onRoll: () -> Unit,
    claimAnimation: (Long) -> Boolean,
    onAnimationFinished: (Long) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (player == null) {
        Box(modifier.heightIn(min = 68.dp))
        return
    }
    LocalPlayerPanel(
        player,
        transferIsAnimating,
        rootOrigin,
        anchors,
        state,
        isRolling,
        isDiceRevealAnimating,
        diceAnimationId,
        onRoll,
        claimAnimation,
        onAnimationFinished,
        modifier,
    )
}

@Composable
private fun LocalPlayerPanel(
    player: LudoPlayerDto,
    transferIsAnimating: Boolean,
    rootOrigin: Offset,
    anchors: MutableMap<Int, Offset>,
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
            if (player.seat == 0 || player.seat == 3) {
                LocalDiceButton(player, state, diceAnimationId, claimAnimation, onAnimationFinished, isRolling, isDiceRevealAnimating, transferIsAnimating, true, rootOrigin, anchors, onRoll)
            }
            Column(Modifier.weight(1f)) {
                Text(player.color.orEmpty(), maxLines = 1, style = MaterialTheme.typography.labelMedium, color = Color(0xFF20252B))
                Text(
                    when {
                        active && isRolling -> "ROLLING…"
                        player?.seat == state.lastRollSeat && isDiceRevealAnimating -> "REVEALING RESULT"
                        state.lastRollSeat != null && player.seat == state.lastRollSeat && !active -> "TURN COMPLETED"
                        active && isDiceRevealAnimating -> "WAITING TO ROLL"
                        active && board.phase == "MOVE" -> "CHOOSE TOKEN"
                        active -> "YOUR TURN · ROLL"
                        else -> "WAITING"
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = if (active) Color(0xFF9B285D) else Color(0xFF66717C),
                )
            }
            if (player.seat == 1 || player.seat == 2) {
                LocalDiceButton(player, state, diceAnimationId, claimAnimation, onAnimationFinished, isRolling, isDiceRevealAnimating, transferIsAnimating, true, rootOrigin, anchors, onRoll)
            }
        }
    }
}

@Composable
private fun LocalDiceButton(
    player: LudoPlayerDto,
    state: LocalLudoState,
    diceAnimationId: Long,
    claimAnimation: (Long) -> Boolean,
    onAnimationFinished: (Long) -> Unit,
    isRolling: Boolean,
    isDiceRevealAnimating: Boolean,
    transferIsAnimating: Boolean,
    visible: Boolean,
    rootOrigin: Offset,
    anchors: MutableMap<Int, Offset>,
    onRoll: () -> Unit,
) {
    val board = state.toBoardDto()
    val color = when (player.seat) { 0 -> Color(0xFFED1C24); 1 -> Color(0xFF00A651); 2 -> Color(0xFFFFD814); else -> Color(0xFF168DD0) }
    val active = isActiveLudoPlayer(board.turnSeat, player.seat)
    val diceValue = dicePresentationFace(
        seat = player.seat,
        turnSeat = board.turnSeat,
        phase = board.phase,
        lastRollSeat = state.lastRollSeat,
        lastConfirmedValue = state.lastRollValue,
        currentDiceValue = board.dice,
    )
    FilledTonalButton(
        onClick = onRoll,
        enabled = active && board.phase == "ROLL" && !isRolling && !isDiceRevealAnimating && !transferIsAnimating,
        modifier = Modifier.size(68.dp),
        contentPadding = PaddingValues(0.dp),
        colors = ButtonDefaults.filledTonalButtonColors(containerColor = color.copy(alpha = .22f), contentColor = color),
        shape = RoundedCornerShape(12.dp),
    ) {
        LudoAnimatedDiceFace(
            value = diceValue,
            animationId = diceAnimationId,
            rollerSeat = state.lastRollSeat,
            seat = player.seat,
            claimAnimation = claimAnimation,
            onAnimationFinished = onAnimationFinished,
            tint = color,
            visible = visible,
            onPositioned = { anchors[player.seat] = it - rootOrigin },
        )
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
