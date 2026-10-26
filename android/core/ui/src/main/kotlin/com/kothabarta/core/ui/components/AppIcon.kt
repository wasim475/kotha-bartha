package com.kothabarta.core.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import com.kothabarta.core.ui.R

/** The app's small, shared set of Google Material Symbols Rounded. */
enum class AppSymbol {
    ACCOUNT, ATTACHMENT, AUDIO_CALL, CALCULATOR, CALL_END, CALL_INCOMING, CALL_MISSED, CALL_OUTGOING,
    CAMERA, CHAT, CLOSE, DARK_MODE, EXPAND, FEED, FLIP_CAMERA, FRIENDS, GAMES, LEADERBOARD, LIGHT_MODE,
    MIC, MIC_OFF, MINIMIZE, NOTIFICATIONS, QUIZ, REACTIONS, SCREEN_SHARE, SCREEN_SHARE_STOP, SEARCH, STUDY,
    BLOCK, LOGOUT, MORE_VERT, PERSON_REMOVE, SEND, SETTINGS, TIC_TAC_TOE, VIDEO_CALL, VIDEO_OFF, VOLUME,
}

@Composable
fun AppIcon(
    symbol: AppSymbol,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    tint: Color = LocalContentColor.current,
) {
    Icon(
        painter = painterResource(symbol.drawableRes()),
        contentDescription = contentDescription,
        modifier = modifier,
        tint = tint,
    )
}

@DrawableRes
private fun AppSymbol.drawableRes(): Int = when (this) {
    AppSymbol.ACCOUNT -> R.drawable.ic_account_circle
    AppSymbol.ATTACHMENT -> R.drawable.ic_attach_file
    AppSymbol.AUDIO_CALL -> R.drawable.ic_call
    AppSymbol.CALCULATOR -> R.drawable.ic_calculate
    AppSymbol.CALL_END -> R.drawable.ic_call_end
    AppSymbol.CALL_INCOMING -> R.drawable.ic_call_received
    AppSymbol.CALL_MISSED -> R.drawable.ic_call_missed
    AppSymbol.CALL_OUTGOING -> R.drawable.ic_call_made
    AppSymbol.CAMERA -> R.drawable.ic_camera_alt
    AppSymbol.BLOCK -> R.drawable.ic_block
    AppSymbol.CHAT -> R.drawable.ic_chat_bubble
    AppSymbol.CLOSE -> R.drawable.ic_close
    AppSymbol.DARK_MODE -> R.drawable.ic_dark_mode
    AppSymbol.EXPAND -> R.drawable.ic_fullscreen
    AppSymbol.FEED -> R.drawable.ic_home
    AppSymbol.FLIP_CAMERA -> R.drawable.ic_flip_camera_android
    AppSymbol.FRIENDS -> R.drawable.ic_groups
    AppSymbol.GAMES -> R.drawable.ic_sports_esports
    AppSymbol.LEADERBOARD -> R.drawable.ic_emoji_events
    AppSymbol.LIGHT_MODE -> R.drawable.ic_light_mode
    AppSymbol.LOGOUT -> R.drawable.ic_logout
    AppSymbol.MIC -> R.drawable.ic_mic
    AppSymbol.MIC_OFF -> R.drawable.ic_mic_off
    AppSymbol.MINIMIZE -> R.drawable.ic_keyboard_arrow_down
    AppSymbol.MORE_VERT -> R.drawable.ic_more_vert
    AppSymbol.NOTIFICATIONS -> R.drawable.ic_notifications
    AppSymbol.PERSON_REMOVE -> R.drawable.ic_person_remove
    AppSymbol.QUIZ -> R.drawable.ic_menu_book
    AppSymbol.REACTIONS -> R.drawable.ic_sentiment_satisfied
    AppSymbol.SCREEN_SHARE -> R.drawable.ic_screen_share
    AppSymbol.SCREEN_SHARE_STOP -> R.drawable.ic_stop_screen_share
    AppSymbol.SEARCH -> R.drawable.ic_search
    AppSymbol.SEND -> R.drawable.ic_send
    AppSymbol.SETTINGS -> R.drawable.ic_settings
    AppSymbol.STUDY -> R.drawable.ic_auto_stories
    AppSymbol.TIC_TAC_TOE -> R.drawable.ic_grid_3x3
    AppSymbol.VIDEO_CALL -> R.drawable.ic_videocam
    AppSymbol.VIDEO_OFF -> R.drawable.ic_videocam_off
    AppSymbol.VOLUME -> R.drawable.ic_volume_up
}
