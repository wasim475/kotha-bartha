package com.kothabarta.feature.ludo.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
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
internal fun LudoBoardCanvas(board: LudoBoardStateDto, mySeat: Int?, allowMoves: Boolean, onMove: (Int) -> Unit, modifier: Modifier = Modifier) {
    val movable = board.legal.filter { allowMoves && board.turnSeat == mySeat }.map { it.tokenId }.toSet()
    Canvas(
        modifier = modifier.fillMaxWidth().aspectRatio(1f)
            .semantics { contentDescription = "Ludo board. Tap a highlighted token to move."; role = Role.Image }
            .pointerInput(board.players, board.legal, board.turnSeat, mySeat, allowMoves) {
                detectTapGestures { tap ->
                    val cell = size.width / 15f
                    val candidates = board.players.filter { it.seat == mySeat && it.seat == board.turnSeat }
                        .flatMap { player -> player.tokens.filter { it.id in movable }.map { token ->
                            val center = ludoPosition(player.seat, token.pos, token.id)
                            Triple(token.id, (center.second * cell), (center.first * cell))
                        } }
                    val nearest = candidates.minByOrNull { (_, x, y) -> hypot((tap.x - x).toDouble(), (tap.y - y).toDouble()) }
                    if (nearest != null && hypot((tap.x - nearest.second).toDouble(), (tap.y - nearest.third).toDouble()) < cell * 1.3) onMove(nearest.first)
                }
            },
    ) {
        val unit = size.width / 15f
        drawRect(Color(0xFFF6F2EA), size = size)
        drawLudoBoard(unit, board)
    }
}

private fun DrawScope.drawLudoBoard(unit: Float, board: LudoBoardStateDto) {
    val line = Color(0x663B3630)
    fun cell(row: Int, col: Int, color: Color) = drawRect(color, Offset(col * unit, row * unit), Size(unit, unit), style = androidx.compose.ui.graphics.drawscope.Fill)
    val homes = listOf(0 to 0, 0 to 9, 9 to 9, 9 to 0)
    homes.forEachIndexed { seat, (row, col) ->
        drawRect(seats[seat], Offset(col * unit, row * unit), Size(6 * unit, 6 * unit))
        drawRect(Color.White, Offset((col + .8f) * unit, (row + .8f) * unit), Size(4.4f * unit, 4.4f * unit))
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
            drawLine(Color(0xFFD1352B), Offset((col + .3f) * unit, (row + .3f) * unit), Offset((col + .7f) * unit, (row + .7f) * unit), .1f * unit)
            drawLine(Color(0xFFD1352B), Offset((col + .7f) * unit, (row + .3f) * unit), Offset((col + .3f) * unit, (row + .7f) * unit), .1f * unit)
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
        val (row, col) = ludoPosition(player.seat, token.pos, token.id)
        val movable = player.seat == board.turnSeat && board.legal.any { it.tokenId == token.id }
        drawToken(Offset(col * unit, row * unit), unit, seats.getOrElse(player.seat) { Color.Gray }, movable)
    } }
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

private fun DrawScope.drawToken(center: Offset, unit: Float, color: Color, movable: Boolean) {
    val radius = .32f * unit
    drawCircle(Color(0x55000000), radius, center + Offset(0f, .12f * unit))
    val pin = Path().apply {
        moveTo(center.x, center.y + .47f * unit)
        cubicTo(center.x - .1f * unit, center.y + .19f * unit, center.x - radius, center.y + .05f * unit, center.x - radius, center.y - .08f * unit)
        cubicTo(center.x - radius, center.y - .48f * unit, center.x + radius, center.y - .48f * unit, center.x + radius, center.y - .08f * unit)
        cubicTo(center.x + radius, center.y + .05f * unit, center.x + .1f * unit, center.y + .19f * unit, center.x, center.y + .47f * unit)
        close()
    }
    drawPath(pin, Color(0xFF777777))
    drawPath(pin, color, style = Stroke(.07f * unit))
    drawCircle(color, radius * .78f, center - Offset(0f, .1f * unit))
    drawCircle(Color.White.copy(alpha = .9f), radius * .78f, center - Offset(0f, .1f * unit), style = Stroke(.07f * unit))
    drawCircle(Color.White.copy(alpha = .5f), radius * .2f, center - Offset(.12f * unit, .23f * unit))
    if (movable) drawCircle(Color.White, .48f * unit, center, style = Stroke(.07f * unit))
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
