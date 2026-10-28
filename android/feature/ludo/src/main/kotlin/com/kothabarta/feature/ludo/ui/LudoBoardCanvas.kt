package com.kothabarta.feature.ludo.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import com.kothabarta.core.network.ludo.LudoBoardStateDto
import com.kothabarta.core.network.ludo.LudoPlayerDto
import kotlin.math.hypot
import kotlinx.coroutines.delay

private val seats = listOf(Color(0xFFED1C24), Color(0xFF00A651), Color(0xFFFFD814), Color(0xFF168DD0))
private val trackCells = buildList {
    (1..5).forEach { add(6 to it) }
    listOf(5, 4, 3, 2, 1, 0).forEach { add(it to 6) }
    add(0 to 7); add(0 to 8)
    (1..5).forEach { add(it to 8) }
    (9..14).forEach { add(6 to it) }
    add(7 to 14); add(8 to 14)
    (13 downTo 9).forEach { add(8 to it) }
    (9..14).forEach { add(it to 8) }
    add(14 to 7); add(14 to 6)
    (13 downTo 9).forEach { add(it to 6) }
    (5 downTo 0).forEach { add(8 to it) }
    add(7 to 0); add(6 to 0)
}
private val starts = listOf(0, 13, 26, 39)

@Composable
internal fun LudoBoardCanvas(
    board: LudoBoardStateDto,
    mySeat: Int?,
    allowMoves: Boolean,
    onMove: (Int) -> Unit,
    modifier: Modifier = Modifier,
    selectedTokenId: Int? = null,
    selectedSeat: Int? = board.turnSeat,
    holdMoveAnimations: Boolean = false,
    onMoveAnimationStateChanged: (Boolean) -> Unit = {},
) {
    val barrierVisibility by animateFloatAsState(
        targetValue = if (quickBarrierIsVisible(board)) 1f else 0f,
        animationSpec = tween(420),
        label = "quick-home-entrance-barrier",
    )
    val visualPositions = remember(board.variantId) {
        mutableStateMapOf<TokenKey, Pair<Float, Float>>().apply {
            board.players.forEach { player -> player.tokens.forEach { token -> put(TokenKey(player.seat, token.id), ludoPosition(player.seat, token.pos, token.id)) } }
        }
    }
    var previousPlayers by remember(board.variantId) { mutableStateOf(board.players) }
    var moveAnimating by remember(board.variantId) { mutableStateOf(false) }
    val latestPlayers by rememberUpdatedState(board.players)
    val latestAnimationCallback by rememberUpdatedState(onMoveAnimationStateChanged)
    val minimumTouchRadius = with(LocalDensity.current) { 22.dp.toPx() }
    LaunchedEffect(board.players, holdMoveAnimations) {
        if (holdMoveAnimations) return@LaunchedEffect
        val prior = previousPlayers
        previousPlayers = board.players
        val changes = board.players.flatMap { player ->
            val before = prior.firstOrNull { it.seat == player.seat }
            player.tokens.mapNotNull { token ->
                val from = before?.tokens?.firstOrNull { it.id == token.id }?.pos ?: token.pos
                if (from == token.pos) null else TokenPositionChange(TokenKey(player.seat, token.id), from, token.pos)
            }
        }
        if (changes.isEmpty()) {
            board.players.forEach { player -> player.tokens.forEach { token -> visualPositions.putIfAbsent(TokenKey(player.seat, token.id), ludoPosition(player.seat, token.pos, token.id)) } }
            moveAnimating = false
            latestAnimationCallback(false)
            return@LaunchedEffect
        }
        moveAnimating = true
        latestAnimationCallback(true)
        try {
            // Move the active token first; captured tokens return to their bases after it lands.
            changes.sortedBy { if (it.to == -1) 1 else 0 }.forEach { change ->
                val start = visualPositions[change.key] ?: ludoPosition(change.key.seat, change.from, change.key.tokenId)
                if (change.to == -1) {
                    animateBetween(change.key, start, ludoPosition(change.key.seat, -1, change.key.tokenId), visualPositions, 260)
                } else {
                    tokenAnimationPositions(change.key.seat, change.from, change.to, change.key.tokenId).forEach { target ->
                        val fromPosition = visualPositions[change.key] ?: start
                        animateBetween(change.key, fromPosition, target, visualPositions, 95)
                        delay(18)
                    }
                }
            }
        } finally {
            // The latest server/local snapshot remains authoritative if an animation is interrupted.
            visualPositions.clear()
            latestPlayers.forEach { player -> player.tokens.forEach { token -> visualPositions[TokenKey(player.seat, token.id)] = ludoPosition(player.seat, token.pos, token.id) } }
            moveAnimating = false
            latestAnimationCallback(false)
        }
    }
    val highlightTransition = rememberInfiniteTransition(label = "ludo-active-highlight")
    val pulse by highlightTransition.animateFloat(
        initialValue = .94f, targetValue = 1.06f,
        animationSpec = infiniteRepeatable(tween(650, easing = LinearEasing), RepeatMode.Reverse),
        label = "ludo-token-pulse-scale",
    )
    val highlightPhase by highlightTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1900), RepeatMode.Restart),
        label = "ludo-home-highlight-phase",
    )
    val movable = highlightedLegalTokenIds(board, mySeat, allowMoves && !moveAnimating)
    Canvas(
        modifier = modifier.fillMaxWidth().aspectRatio(1f)
            .semantics { contentDescription = "Ludo board. Tap a highlighted token to move."; role = Role.Image }
            .pointerInput(board.players, board.legal, board.turnSeat, mySeat, allowMoves, moveAnimating) {
                detectTapGestures { tap ->
                    if (moveAnimating) return@detectTapGestures
                    val cell = size.width / 15f
                    val candidates = board.players.filter { it.seat == mySeat && it.seat == board.turnSeat }
                        .flatMap { player -> player.tokens.filter { it.id in movable }.map { token ->
                            val center = tokenVisualCenter(board, player.seat, token.id, visualPositions)
                            Triple(token.id, (center.second * cell), (center.first * cell))
                        } }
                    val nearest = candidates.minByOrNull { (_, x, y) -> hypot((tap.x - x).toDouble(), (tap.y - y).toDouble()) }
                    if (nearest != null && hypot((tap.x - nearest.second).toDouble(), (tap.y - nearest.third).toDouble()) < maxOf(cell * .78f, minimumTouchRadius)) onMove(nearest.first)
                }
            },
    ) {
        val unit = size.width / 15f
        drawRect(Color(0xFFF6F2EA), size = size)
        drawLudoBoard(unit, board, visualPositions, movable, board.turnSeat, selectedTokenId, selectedSeat, pulse, highlightPhase, barrierVisibility)
    }
}

private fun DrawScope.drawLudoBoard(
    unit: Float,
    board: LudoBoardStateDto,
    visualPositions: Map<TokenKey, Pair<Float, Float>>,
    movableTokens: Set<Int>,
    activeSeat: Int?,
    selectedTokenId: Int?,
    selectedSeat: Int?,
    pulse: Float,
    highlightPhase: Float,
    barrierVisibility: Float,
) {
    val line = Color(0x663B3630)
    fun cell(row: Int, col: Int, color: Color) = drawRect(color, Offset(col * unit, row * unit), Size(unit, unit), style = androidx.compose.ui.graphics.drawscope.Fill)
    val homes = listOf(0 to 0, 0 to 9, 9 to 9, 9 to 0)
    homes.forEachIndexed { seat, (row, col) ->
        drawRect(seats[seat], Offset(col * unit, row * unit), Size(6 * unit, 6 * unit))
        drawRect(Color.White, Offset((col + .8f) * unit, (row + .8f) * unit), Size(4.4f * unit, 4.4f * unit))
        if (seat == activeSeat) {
            val topLeft = Offset((col + .12f) * unit, (row + .12f) * unit)
            val homeSize = Size(5.76f * unit, 5.76f * unit)
            val gradientStart = Offset(topLeft.x + (highlightPhase - 1f) * homeSize.width, topLeft.y)
            val gradient = Brush.linearGradient(
                colors = listOf(Color(0xFFE34263), Color(0xFF7653E8), Color(0xFFE34263)),
                start = gradientStart,
                end = Offset(gradientStart.x + homeSize.width, topLeft.y + homeSize.height),
            )
            drawRoundRect(
                color = Color(0xFFE34263).copy(alpha = .14f * pulse),
                topLeft = topLeft,
                size = homeSize,
                cornerRadius = CornerRadius(.42f * unit),
                style = Stroke(width = .42f * unit),
            )
            drawRoundRect(
                brush = gradient,
                topLeft = topLeft,
                size = homeSize,
                cornerRadius = CornerRadius(.42f * unit),
                style = Stroke(width = .16f * unit),
            )
        }
        val centers = listOf(1.5f to 1.5f, 1.5f to 3.5f, 3.5f to 1.5f, 3.5f to 3.5f)
        centers.forEach { (dy, dx) ->
            drawCircle(Color(0xFFE8E5DF), .62f * unit, Offset((col + dx) * unit, (row + dy) * unit))
            drawCircle(seats[seat], .49f * unit, Offset((col + dx) * unit, (row + dy) * unit), style = Stroke(.08f * unit))
        }
    }
    trackCells.forEachIndexed { index, (row, col) ->
        val owner = starts.indexOf(index)
        val fill = if (owner >= 0) seats[owner] else Color.White
        cell(row, col, fill)
        drawRect(line, Offset(col * unit, row * unit), Size(unit, unit), style = Stroke(.04f * unit))
        if (owner >= 0) drawStar(Offset((col + .5f) * unit, (row + .5f) * unit), .42f * unit, Color.White)
        else if (board.rules.safeCellsProtect && index in board.rules.safeCells) drawStar(Offset((col + .5f) * unit, (row + .5f) * unit), .34f * unit, line)
    }
    val lanes = listOf(
        (1..5).map { 7 to it }, (1..5).map { it to 7 }, (13 downTo 9).map { 7 to it }, (13 downTo 9).map { it to 7 },
    )
    lanes.forEachIndexed { seat, lane -> lane.forEachIndexed { i, (row, col) ->
        val alpha = if (!board.rules.allowHomeEntry) .16f else .55f + i * .08f
        cell(row, col, seats[seat].copy(alpha = alpha))
        drawRect(line, Offset(col * unit, row * unit), Size(unit, unit), style = Stroke(.04f * unit))
        if (!board.rules.allowHomeEntry) {
            if (board.variantId == "QUICK_CAPTURE") {
                if (i == 0) drawQuickBlockSign(row, col, unit, barrierVisibility)
            } else {
                drawLine(Color(0xFFD1352B), Offset((col + .3f) * unit, (row + .3f) * unit), Offset((col + .7f) * unit, (row + .7f) * unit), .1f * unit)
                drawLine(Color(0xFFD1352B), Offset((col + .7f) * unit, (row + .3f) * unit), Offset((col + .3f) * unit, (row + .7f) * unit), .1f * unit)
            }
        }
    } }
    val triangles: List<Pair<Int, List<Offset>>> = listOf(
        0 to listOf(Offset(6f, 6f), Offset(6f, 9f), Offset(7.5f, 7.5f)),
        1 to listOf(Offset(6f, 6f), Offset(9f, 6f), Offset(7.5f, 7.5f)),
        2 to listOf(Offset(9f, 6f), Offset(9f, 9f), Offset(7.5f, 7.5f)),
        3 to listOf(Offset(6f, 9f), Offset(9f, 9f), Offset(7.5f, 7.5f)),
    )
    triangles.forEach { (seat, points) ->
        val path = Path().apply { moveTo(points[0].x * unit, points[0].y * unit); lineTo(points[1].x * unit, points[1].y * unit); lineTo(points[2].x * unit, points[2].y * unit); close() }
        drawPath(path, seats[seat])
    }
    drawRect(line, Offset(6 * unit, 6 * unit), Size(3 * unit, 3 * unit), style = Stroke(.05f * unit))
    board.players.forEach { player -> player.tokens.forEach { token ->
        val (row, col) = tokenVisualCenter(board, player.seat, token.id, visualPositions)
        val movable = player.seat == activeSeat && token.id in movableTokens
        val selected = player.seat == selectedSeat && token.id == selectedTokenId
        drawToken(Offset(col * unit, row * unit), unit, seats.getOrElse(player.seat) { Color.Gray }, movable, selected, pulse)
    } }
}

internal fun quickBarrierIsVisible(board: LudoBoardStateDto): Boolean =
    board.variantId == "QUICK_CAPTURE" &&
        !board.rules.allowHomeEntry &&
        board.phase != "FINISHED" &&
        board.winnerSeat == null

private fun DrawScope.drawQuickBlockSign(row: Int, col: Int, unit: Float, visibility: Float) {
    if (visibility <= 0f) return
    val center = Offset(
        (col + .5f) * unit,
        (row + .48f + (1f - visibility) * .32f) * unit,
    )
    val signWidth = .72f * unit * visibility
    val signHeight = .58f * unit * visibility
    val signTopLeft = Offset(center.x - signWidth / 2f, center.y - signHeight / 2f)
    drawRoundRect(
        color = Color(0xFF842B35).copy(alpha = visibility),
        topLeft = signTopLeft + Offset(0f, .06f * unit),
        size = Size(signWidth, signHeight),
        cornerRadius = androidx.compose.ui.geometry.CornerRadius(.1f * unit),
    )
    drawRoundRect(
        color = Color(0xFFE44852).copy(alpha = visibility),
        topLeft = signTopLeft,
        size = Size(signWidth, signHeight),
        cornerRadius = androidx.compose.ui.geometry.CornerRadius(.1f * unit),
    )
    val insetX = signWidth * .28f
    val insetY = signHeight * .24f
    val crossColor = Color.White.copy(alpha = visibility)
    drawLine(crossColor, Offset(center.x - insetX, center.y - insetY), Offset(center.x + insetX, center.y + insetY), .075f * unit * visibility)
    drawLine(crossColor, Offset(center.x + insetX, center.y - insetY), Offset(center.x - insetX, center.y + insetY), .075f * unit * visibility)
}

// Relative positions are the same 52-cell clockwise route and five-cell home lanes used by the shared engine.
private fun ludoPosition(seat: Int, pos: Int, tokenId: Int): Pair<Float, Float> {
    if (pos == -1) {
        val spots = listOf(1.5f to 1.5f, 1.5f to 3.5f, 3.5f to 1.5f, 3.5f to 3.5f)
        val (r, c) = spots[tokenId.coerceIn(0, 3)]
        val origin = listOf(0 to 0, 0 to 9, 9 to 9, 9 to 0)[seat.coerceIn(0, 3)]
        return origin.first + r to origin.second + c
    }
    if (pos == 56) return listOf(7f to 6.35f, 6.35f to 7f, 7f to 7.65f, 7.65f to 7f)[seat.coerceIn(0, 3)]
    if (pos in 51..55) {
        val k = pos - 50
        return when (seat) { 0 -> 7.5f to (k + .5f); 1 -> (k + .5f) to 7.5f; 2 -> 7.5f to (14 - k + .5f); else -> (14 - k + .5f) to 7.5f }
    }
    val track = trackCells[(starts[seat.coerceIn(0, 3)] + pos.coerceIn(0, 50)) % 52]
    return track.first + .5f to track.second + .5f
}

private fun DrawScope.drawToken(center: Offset, unit: Float, color: Color, movable: Boolean, selected: Boolean, pulse: Float) {
    val scale = when { selected -> 1.16f; movable -> pulse; else -> 1f }
    val visualUnit = unit * scale
    val radius = .32f * visualUnit
    if (movable || selected) drawCircle(
        if (selected) Color(0xFFE34AE6).copy(alpha = .22f + (pulse - .94f) * .45f) else Color.White.copy(alpha = .18f),
        radius = .69f * unit * pulse,
        center = center,
    )
    drawCircle(Color(0x55000000), radius, center + Offset(0f, .12f * visualUnit))
    val pin = Path().apply {
        moveTo(center.x, center.y + .57f * visualUnit)
        cubicTo(center.x - .1f * visualUnit, center.y + .24f * visualUnit, center.x - radius, center.y + .08f * visualUnit, center.x - radius, center.y - .08f * visualUnit)
        cubicTo(center.x - radius, center.y - .48f * visualUnit, center.x + radius, center.y - .48f * visualUnit, center.x + radius, center.y - .08f * visualUnit)
        cubicTo(center.x + radius, center.y + .08f * visualUnit, center.x + .1f * visualUnit, center.y + .24f * visualUnit, center.x, center.y + .57f * visualUnit)
        close()
    }
    drawPath(pin, Color(0xFF777777))
    drawPath(pin, color, style = Stroke(.07f * visualUnit))
    drawCircle(color, radius * .78f, center - Offset(0f, .1f * unit))
    drawCircle(Color.White.copy(alpha = .9f), radius * .78f, center - Offset(0f, .1f * unit), style = Stroke(.07f * unit))
    drawCircle(Color.White.copy(alpha = .5f), radius * .2f, center - Offset(.12f * unit, .23f * unit))
    if (selected) drawCircle(Color(0xFFE34AE6), .55f * unit, center, style = Stroke(.11f * unit))
    else if (movable) drawCircle(Color.White, .48f * unit * pulse, center, style = Stroke(.08f * unit))
}

private data class TokenKey(val seat: Int, val tokenId: Int)
private data class TokenPositionChange(val key: TokenKey, val from: Int, val to: Int)

internal fun tokenStackOffset(index: Int, count: Int): Pair<Float, Float> {
    if (count < 2) return 0f to 0f
    val grid = index.coerceIn(0, 15)
    val row = grid / 4
    val col = grid % 4
    return (row - 1.5f) * .15f to (col - 1.5f) * .15f
}

internal fun highlightedLegalTokenIds(board: LudoBoardStateDto, seat: Int?, enabled: Boolean): Set<Int> =
    if (!enabled || seat == null || board.turnSeat != seat) emptySet()
    else board.legal.map { it.tokenId }.toSet()

private fun tokenVisualCenter(
    board: LudoBoardStateDto,
    seat: Int,
    tokenId: Int,
    visualPositions: Map<TokenKey, Pair<Float, Float>>,
): Pair<Float, Float> {
    val key = TokenKey(seat, tokenId)
    val position = visualPositions[key]
        ?: ludoPosition(seat, board.players.firstOrNull { it.seat == seat }?.tokens?.firstOrNull { it.id == tokenId }?.pos ?: -1, tokenId)
    val stacked = board.players.flatMap { player -> player.tokens.map { token ->
        val tokenKey = TokenKey(player.seat, token.id)
        tokenKey to (visualPositions[tokenKey] ?: ludoPosition(player.seat, token.pos, token.id))
    } }.filter { it.second == position }.map { it.first }
    if (stacked.size < 2) return position
    val (rowOffset, colOffset) = tokenStackOffset(stacked.indexOf(key), stacked.size)
    return position.first + rowOffset to position.second + colOffset
}

internal fun tokenAnimationPositions(seat: Int, from: Int, to: Int, tokenId: Int = 0): List<Pair<Float, Float>> =
    if (from == -1) listOf(ludoPosition(seat, 0, tokenId))
    else if (to > from) (from + 1..to).map { ludoPosition(seat, it, tokenId) }
    else emptyList()

private suspend fun animateBetween(
    key: TokenKey,
    from: Pair<Float, Float>,
    to: Pair<Float, Float>,
    positions: MutableMap<TokenKey, Pair<Float, Float>>,
    durationMs: Int,
) {
    val progress = Animatable(0f)
    progress.animateTo(1f, tween(durationMs, easing = LinearEasing)) {
        positions[key] = from.first + (to.first - from.first) * value to from.second + (to.second - from.second) * value
    }
}

private fun DrawScope.drawStar(center: Offset, radius: Float, color: Color) {
    val path = Path()
    repeat(10) { index ->
        val angle = Math.PI * index / 5.0 - Math.PI / 2
        val r = if (index % 2 == 0) radius else radius * .48f
        val x = center.x + kotlin.math.cos(angle).toFloat() * r
        val y = center.y + kotlin.math.sin(angle).toFloat() * r
        if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
    }
    path.close()
    drawPath(path, color)
}
