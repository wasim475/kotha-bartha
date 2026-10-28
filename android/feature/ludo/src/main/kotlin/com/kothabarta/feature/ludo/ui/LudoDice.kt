package com.kothabarta.feature.ludo.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlin.random.Random

/** Visual dice only: [value] remains the engine/server result; random faces never leave this composable. */
@Composable
internal fun LudoAnimatedDiceFace(
    value: Int?,
    rolling: Boolean,
    animationId: Long,
    claimAnimation: (Long) -> Boolean,
    onAnimationFinished: (Long) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val latestValue by rememberUpdatedState(value)
    val latestRolling by rememberUpdatedState(rolling)
    var shownValue by remember(animationId) { mutableIntStateOf(value ?: 1) }
    var visualRolling by remember(animationId) { mutableStateOf(false) }
    val flip = remember { Animatable(0f) }
    LaunchedEffect(animationId) {
        if (animationId <= 0L || !claimAnimation(animationId)) {
            visualRolling = false
            shownValue = latestValue ?: 1
            if (animationId > 0L) onAnimationFinished(animationId)
            return@LaunchedEffect
        }
        visualRolling = true
        val start = System.nanoTime()
        try {
            while (latestRolling || (System.nanoTime() - start) / 1_000_000L < 820L) {
                shownValue = Random.nextInt(1, 7)
                delay(68)
            }
            shownValue = latestValue ?: shownValue
            flip.snapTo(0f)
            flip.animateTo(360f, tween(260, easing = FastOutSlowInEasing))
            flip.snapTo(0f)
        } finally {
            visualRolling = false
            onAnimationFinished(animationId)
        }
    }
    LaunchedEffect(value, animationId) {
        if (value != null && animationId <= 0L) shownValue = value
    }
    val transition = rememberInfiniteTransition(label = "ludo-dice-roll")
    val turn by transition.animateFloat(
        initialValue = 0f,
        targetValue = if (visualRolling) 360f else 0f,
        animationSpec = infiniteRepeatable(tween(125, easing = FastOutSlowInEasing), RepeatMode.Restart),
        label = "ludo-dice-turn",
    )
    val bounce by transition.animateFloat(
        initialValue = 1f,
        targetValue = if (visualRolling) 1.06f else 1f,
        animationSpec = infiniteRepeatable(tween(180, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "ludo-dice-bounce",
    )
    val pips = if (value == null && !visualRolling) emptyList() else when (shownValue) {
        1 -> listOf(4)
        2 -> listOf(0, 8)
        3 -> listOf(0, 4, 8)
        4 -> listOf(0, 2, 6, 8)
        5 -> listOf(0, 2, 4, 6, 8)
        else -> listOf(0, 2, 3, 5, 6, 8)
    }
    Canvas(
        Modifier.size(46.dp)
            .shadow(6.dp, RoundedCornerShape(10.dp))
            .graphicsLayer {
                rotationY = flip.value + if (visualRolling) turn else 0f
                rotationX = if (visualRolling) turn * .55f else 0f
                scaleX = if (visualRolling) bounce else 1f
                scaleY = if (visualRolling) bounce else 1f
            }
            .then(modifier),
    ) {
        drawRoundRect(
            Brush.linearGradient(listOf(Color.White, Color(0xFFF1F2F6), Color.White), end = Offset(size.width, size.height)),
            cornerRadius = CornerRadius(size.width * .2f),
        )
        drawRoundRect(Color(0xFF273044), cornerRadius = CornerRadius(size.width * .2f), style = Stroke(size.width * .045f))
        val step = size.width / 4f
        pips.forEach { index ->
            val x = (index % 3 + 1) * step
            val y = (index / 3 + 1) * step
            drawCircle(if (shownValue == 1) Color(0xFFD52C5A) else Color(0xFF263247), size.width * .082f, Offset(x, y))
        }
    }
}
