package com.kothabarta.feature.calls.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kothabarta.feature.calls.domain.FloatingReaction
import kotlinx.coroutines.launch
import kotlin.random.Random

/**
 * Purely cosmetic floating emoji particles — `CallSessionManager` already
 * caps concurrent reactions at 12 and auto-expires each one after ~2.3s, so
 * this only ever needs to render whatever's currently in [reactions], not
 * manage its own list/timers.
 */
@Composable
fun CallReactionsOverlay(reactions: List<FloatingReaction>, modifier: Modifier = Modifier) {
    Box(modifier = modifier.fillMaxSize()) {
        reactions.forEach { reaction ->
            key(reaction.id) {
                FloatingReactionParticle(reaction)
            }
        }
    }
}

@Composable
private fun BoxScope.FloatingReactionParticle(reaction: FloatingReaction) {
    val horizontalOffset = remember(reaction.id) { Random.nextInt(-72, 72).dp }
    val riseAnim = remember(reaction.id) { Animatable(0f) }
    val alphaAnim = remember(reaction.id) { Animatable(1f) }

    LaunchedEffect(reaction.id) {
        launch { riseAnim.animateTo(-260f, animationSpec = tween(2200)) }
        launch { alphaAnim.animateTo(0f, animationSpec = tween(900, delayMillis = 1300)) }
    }

    Text(
        text = reactionEmoji(reaction.type),
        fontSize = 30.sp,
        modifier = Modifier
            .align(if (reaction.mine) Alignment.BottomEnd else Alignment.BottomStart)
            .offset(x = horizontalOffset, y = riseAnim.value.dp)
            .alpha(alphaAnim.value),
    )
}
