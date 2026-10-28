package com.kothabarta.feature.ludo.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/** Returns the animation event only to the stable seat that rolled. */
internal fun diceAnimationIdForSeat(animationId: Long, rollerSeat: Int?, seat: Int): Long =
    if (animationId > 0L && rollerSeat == seat) animationId else 0L

internal fun isActiveLudoPlayer(turnSeat: Int?, seat: Int): Boolean = turnSeat == seat

internal fun dicePresentationSeat(
    turnSeat: Int?,
    rollerSeat: Int?,
    isRolling: Boolean,
    isRevealing: Boolean,
    isMoving: Boolean,
): Int? = when {
    isRolling -> turnSeat
    isRevealing || isMoving -> rollerSeat ?: turnSeat
    else -> turnSeat
}

internal fun dicePresentationFace(
    seat: Int,
    turnSeat: Int?,
    phase: String,
    lastRollSeat: Int?,
    lastConfirmedValue: Int?,
    currentDiceValue: Int?,
): Int = when {
    phase == "MOVE" && seat == turnSeat -> currentDiceValue ?: lastConfirmedValue ?: 6
    phase == "ROLL" && seat == turnSeat -> lastConfirmedValue ?: 6
    seat == lastRollSeat -> lastConfirmedValue ?: 6
    else -> 6
}

@Composable
internal fun LudoAnimatedDiceFace(
    value: Int?,
    animationId: Long,
    rollerSeat: Int?,
    seat: Int,
    claimAnimation: (Long) -> Boolean,
    onAnimationFinished: (Long) -> Unit = {},
    tint: Color,
    visible: Boolean = true,
    onPositioned: ((Offset) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val lift = remember { Animatable(0f) }
    val rotationX = remember { Animatable(0f) }
    val rotationY = remember { Animatable(0f) }
    val rotationZ = remember { Animatable(0f) }
    var animating by remember { mutableStateOf(false) }
    val latestOnFinished by rememberUpdatedState(onAnimationFinished)
    val targetedAnimationId = diceAnimationIdForSeat(animationId, rollerSeat, seat)
    LaunchedEffect(targetedAnimationId) {
        if (targetedAnimationId <= 0L) return@LaunchedEffect
        if (!claimAnimation(targetedAnimationId)) {
            latestOnFinished(targetedAnimationId)
            return@LaunchedEffect
        }
        animating = true
        try {
            coroutineScope {
                launch {
                    lift.animateTo(
                        targetValue = 22f,
                        animationSpec = tween(230, easing = FastOutSlowInEasing),
                    )
                    lift.animateTo(
                        targetValue = 0f,
                        animationSpec = keyframes {
                            durationMillis = 590
                            3f at 190 using FastOutSlowInEasing
                            1f at 285 using FastOutSlowInEasing
                            0f at 360 using FastOutSlowInEasing
                        },
                    )
                }
                launch { rotationX.animateTo(360f, tween(820, easing = FastOutSlowInEasing)) }
                launch { rotationY.animateTo(360f, tween(820, easing = FastOutSlowInEasing)) }
                launch {
                    rotationZ.animateTo(
                        targetValue = 0f,
                        animationSpec = keyframes {
                            durationMillis = 820
                            8f at 260 using FastOutSlowInEasing
                            (-3f) at 560 using FastOutSlowInEasing
                        },
                    )
                }
            }
        } finally {
            withContext(NonCancellable) {
                lift.snapTo(0f)
                rotationX.snapTo(0f)
                rotationY.snapTo(0f)
                rotationZ.snapTo(0f)
                animating = false
                latestOnFinished(targetedAnimationId)
            }
        }
    }

    Canvas(
        Modifier.size(50.dp).then(
            if (onPositioned != null) {
                Modifier.onGloballyPositioned { coordinates ->
                    onPositioned(coordinates.positionInRoot() + Offset(coordinates.size.width / 2f, coordinates.size.height / 2f))
                }
            } else Modifier,
        ).then(modifier),
    ) {
        if (!visible) return@Canvas
        val maxDimension = size.minDimension
        val liftPx = lift.value * density
        val shadowScale = 1f - (lift.value / 22f) * .42f
        drawOval(
            color = Color(0x330D1A2B).copy(alpha = .2f + .2f * shadowScale),
            topLeft = Offset(
                (size.width - maxDimension * .34f * shadowScale) / 2f,
                size.height * .76f,
            ),
            size = Size(maxDimension * .34f * shadowScale, maxDimension * .12f * shadowScale),
        )
        val center = Offset(size.width / 2f, size.height / 2f - liftPx)
        if (animating) {
            drawDiceCube(
                value = value,
                tint = tint,
                center = center,
                unit = maxDimension * .4f,
                rotationX = rotationX.value,
                rotationY = rotationY.value,
                rotationZ = rotationZ.value,
            )
        } else {
            drawStableDice(value, tint, center, maxDimension * .78f)
        }
    }
}

internal class LudoDiceTransferState(initialOwner: Int?) {
    var settledOwner by mutableStateOf(initialOwner)
        private set
    var start by mutableStateOf<Offset?>(null)
        private set
    var end by mutableStateOf<Offset?>(null)
        private set
    var transferFace by mutableStateOf(6)
        private set
    val progress = Animatable(1f)
    val isTransferring: Boolean get() = start != null && end != null

    suspend fun transfer(owner: Int, face: Int, from: Offset, to: Offset) {
        start = from
        end = to
        transferFace = face
        progress.snapTo(0f)
        try {
            progress.animateTo(1f, tween(420, easing = FastOutSlowInEasing))
        } finally {
            withContext(NonCancellable) {
                settledOwner = owner
                progress.snapTo(1f)
                start = null
                end = null
            }
        }
    }

    fun settle(owner: Int) {
        settledOwner = owner
        start = null
        end = null
    }
}

@Composable
internal fun rememberLudoDiceTransferState(
    ownerSeat: Int?,
    face: Int,
    isBusy: Boolean,
    anchors: Map<Int, Offset>,
): LudoDiceTransferState {
    val state = remember { LudoDiceTransferState(ownerSeat) }
    val anchorSnapshot = anchors.toMap()
    LaunchedEffect(ownerSeat, isBusy, anchorSnapshot) {
        val target = ownerSeat ?: return@LaunchedEffect
        if (target == state.settledOwner || isBusy) return@LaunchedEffect
        val source = state.settledOwner
        val from = source?.let(anchorSnapshot::get)
        val to = anchorSnapshot[target]
        if (from != null && to != null) state.transfer(target, face.coerceIn(1, 6), from, to)
        else state.settle(target)
    }
    return state
}

@Composable
internal fun LudoDiceTransferOverlay(
    transfer: LudoDiceTransferState,
    tintBySeat: Map<Int, Color>,
    modifier: Modifier = Modifier,
) {
    val start = transfer.start
    val end = transfer.end
    val progress = transfer.progress.value
    if (start == null || end == null || progress >= 1f) return
    Canvas(modifier.fillMaxSize()) {
        val lift = sin(progress * PI.toFloat()) * size.minDimension * .055f
        val point = quadraticPoint(start, Offset((start.x + end.x) / 2f, minOf(start.y, end.y) - size.minDimension * .16f), end, progress)
        drawDiceCube(
            value = transfer.transferFace,
            tint = tintBySeat[transfer.settledOwner] ?: Color(0xFFE34263),
            center = point.copy(y = point.y - lift),
            unit = 20.dp.toPx(),
            rotationX = progress * 300f,
            rotationY = progress * 360f,
            rotationZ = sin(progress * PI.toFloat()) * 5f,
        )
    }
}

private fun quadraticPoint(start: Offset, control: Offset, end: Offset, fraction: Float): Offset {
    val inverse = 1f - fraction
    return Offset(
        inverse * inverse * start.x + 2f * inverse * fraction * control.x + fraction * fraction * end.x,
        inverse * inverse * start.y + 2f * inverse * fraction * control.y + fraction * fraction * end.y,
    )
}

private fun DrawScope.drawStableDice(value: Int?, tint: Color, center: Offset, faceSize: Float) {
    val topLeft = Offset(center.x - faceSize / 2f, center.y - faceSize / 2f)
    val corner = faceSize * .2f
    drawRoundRect(
        brush = Brush.linearGradient(
            listOf(Color.White, Color(0xFFF3F4F7), Color(0xFFE6E9F0)),
            start = topLeft,
            end = Offset(topLeft.x + faceSize, topLeft.y + faceSize),
        ),
        topLeft = topLeft,
        size = Size(faceSize, faceSize),
        cornerRadius = CornerRadius(corner),
    )
    drawRoundRect(
        color = Color(0xFF293446),
        topLeft = topLeft,
        size = Size(faceSize, faceSize),
        cornerRadius = CornerRadius(corner),
        style = Stroke(width = faceSize * .045f),
    )
    if (value != null) {
        pipPositions(value.coerceIn(1, 6)).forEach { (horizontal, vertical) ->
            drawCircle(
                color = if (value == 1) tint else Color(0xFF293446),
                radius = faceSize * .072f,
                center = Offset(center.x + horizontal * faceSize, center.y + vertical * faceSize),
            )
        }
    }
}

@Composable
internal fun Modifier.ludoActivePlayerHighlight(
    active: Boolean,
    cornerRadius: Dp = 12.dp,
): Modifier {
    if (!active) return this
    val transition = rememberInfiniteTransition(label = "ludo-active-player-border")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1900), RepeatMode.Restart),
        label = "ludo-active-border-phase",
    )
    val pulse by transition.animateFloat(
        initialValue = .45f,
        targetValue = .9f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "ludo-active-border-glow",
    )
    return graphicsLayer {
        shadowElevation = (3f + pulse * 3f).dp.toPx()
        clip = false
    }.drawWithContent {
        drawContent()
        val radius = cornerRadius.toPx()
        val borderWidth = 2.dp.toPx()
        val travel = size.width * phase
        val gradient = Brush.linearGradient(
            colors = listOf(Color(0xFFE34263), Color(0xFF7653E8), Color(0xFFE34263)),
            start = Offset(travel - size.width * .5f, 0f),
            end = Offset(travel + size.width * .5f, size.height),
        )
        drawRoundRect(
            color = Color(0xFFE34263).copy(alpha = pulse * .16f),
            topLeft = Offset(borderWidth / 2f, borderWidth / 2f),
            size = Size(size.width - borderWidth, size.height - borderWidth),
            cornerRadius = CornerRadius(radius),
            style = Stroke(width = 5.dp.toPx()),
        )
        drawRoundRect(
            brush = gradient,
            topLeft = Offset(borderWidth / 2f, borderWidth / 2f),
            size = Size(size.width - borderWidth, size.height - borderWidth),
            cornerRadius = CornerRadius(radius),
            style = Stroke(width = borderWidth),
        )
    }
}

private data class Vector3(val x: Float, val y: Float, val z: Float) {
    operator fun plus(other: Vector3) = Vector3(x + other.x, y + other.y, z + other.z)
    operator fun times(scale: Float) = Vector3(x * scale, y * scale, z * scale)
}

private data class DiceFace(
    val normal: Vector3,
    val horizontal: Vector3,
    val vertical: Vector3,
    val value: Int,
    val shade: Float,
)

private fun diceFaces(value: Int): List<DiceFace> = listOf(
    DiceFace(Vector3(0f, 0f, 1f), Vector3(1f, 0f, 0f), Vector3(0f, -1f, 0f), value, 1f),
    DiceFace(Vector3(0f, 0f, -1f), Vector3(-1f, 0f, 0f), Vector3(0f, -1f, 0f), 7 - value, .66f),
    DiceFace(Vector3(1f, 0f, 0f), Vector3(0f, 0f, -1f), Vector3(0f, -1f, 0f), 2, .82f),
    DiceFace(Vector3(-1f, 0f, 0f), Vector3(0f, 0f, 1f), Vector3(0f, -1f, 0f), 5, .76f),
    DiceFace(Vector3(0f, -1f, 0f), Vector3(1f, 0f, 0f), Vector3(0f, 0f, 1f), 3, .92f),
    DiceFace(Vector3(0f, 1f, 0f), Vector3(1f, 0f, 0f), Vector3(0f, 0f, -1f), 4, .58f),
)

private fun pipPositions(value: Int): List<Pair<Float, Float>> {
    val left = -.39f
    val right = .39f
    val top = -.39f
    val bottom = .39f
    return when (value) {
        1 -> listOf(0f to 0f)
        2 -> listOf(left to top, right to bottom)
        3 -> listOf(left to top, 0f to 0f, right to bottom)
        4 -> listOf(left to top, right to top, left to bottom, right to bottom)
        5 -> listOf(left to top, right to top, 0f to 0f, left to bottom, right to bottom)
        else -> listOf(left to top, right to top, left to 0f, right to 0f, left to bottom, right to bottom)
    }
}

private fun rotate(point: Vector3, rotationX: Float, rotationY: Float, rotationZ: Float): Vector3 {
    val xAngle = rotationX * PI.toFloat() / 180f
    val yAngle = rotationY * PI.toFloat() / 180f
    val zAngle = rotationZ * PI.toFloat() / 180f
    val afterX = Vector3(
        point.x,
        point.y * cos(xAngle) - point.z * sin(xAngle),
        point.y * sin(xAngle) + point.z * cos(xAngle),
    )
    val afterY = Vector3(
        afterX.x * cos(yAngle) + afterX.z * sin(yAngle),
        afterX.y,
        -afterX.x * sin(yAngle) + afterX.z * cos(yAngle),
    )
    return Vector3(
        afterY.x * cos(zAngle) - afterY.y * sin(zAngle),
        afterY.x * sin(zAngle) + afterY.y * cos(zAngle),
        afterY.z,
    )
}

private fun DrawScope.drawDiceCube(
    value: Int?,
    tint: Color,
    center: Offset,
    unit: Float,
    rotationX: Float,
    rotationY: Float,
    rotationZ: Float,
) {
    val faces = diceFaces((value ?: 1).coerceIn(1, 6)).sortedBy { rotate(it.normal, rotationX, rotationY, rotationZ).z }
    val half = .72f
    val camera = 3.4f
    fun project(point: Vector3): Offset {
        val rotated = rotate(point, rotationX, rotationY, rotationZ)
        val perspective = camera / (camera - rotated.z)
        return Offset(center.x + rotated.x * unit * perspective, center.y + rotated.y * unit * perspective)
    }
    faces.forEach { face ->
        val localCorners = listOf(
            face.normal + face.horizontal * -half + face.vertical * -half,
            face.normal + face.horizontal * half + face.vertical * -half,
            face.normal + face.horizontal * half + face.vertical * half,
            face.normal + face.horizontal * -half + face.vertical * half,
        )
        val corners = localCorners.map(::project)
        val path = roundedPolygon(corners, .12f)
        val brightness = face.shade
        val faceColor = Color(
            red = .985f * brightness,
            green = .99f * brightness,
            blue = 1f * brightness,
            alpha = 1f,
        )
        drawPath(path, faceColor)
        drawPath(path, Color(0xFF202A3A).copy(alpha = .78f), style = Stroke(width = size.minDimension * .018f))
        if (value != null) {
            pipPositions(face.value).forEach { (horizontal, vertical) ->
                val pipPosition = face.normal +
                    face.horizontal * horizontal +
                    face.vertical * vertical +
                    face.normal * .025f
                val projected = project(pipPosition)
                val depthScale = camera / (camera - rotate(pipPosition, rotationX, rotationY, rotationZ).z)
                drawCircle(
                    color = if (face.value == 1 || face.value == 6) tint else Color(0xFF293446),
                    radius = size.minDimension * .052f * depthScale,
                    center = projected,
                )
            }
        }
    }
}

private fun roundedPolygon(points: List<Offset>, cornerFraction: Float): Path {
    fun between(from: Offset, to: Offset) =
        Offset(from.x + (to.x - from.x) * cornerFraction, from.y + (to.y - from.y) * cornerFraction)

    return Path().apply {
        val incoming = points.indices.map { index -> between(points[index], points[(index + points.size - 1) % points.size]) }
        val outgoing = points.indices.map { index -> between(points[index], points[(index + 1) % points.size]) }
        moveTo(incoming[0].x, incoming[0].y)
        points.indices.forEach { index ->
            quadraticTo(points[index].x, points[index].y, outgoing[index].x, outgoing[index].y)
            val next = incoming[(index + 1) % points.size]
            lineTo(next.x, next.y)
        }
        close()
    }
}
