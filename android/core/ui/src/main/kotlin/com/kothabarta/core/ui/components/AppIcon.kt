package com.kothabarta.core.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AccountCircle
import androidx.compose.material.icons.rounded.Attachment
import androidx.compose.material.icons.rounded.AutoStories
import androidx.compose.material.icons.rounded.Calculate
import androidx.compose.material.icons.rounded.Call
import androidx.compose.material.icons.rounded.CallEnd
import androidx.compose.material.icons.rounded.CameraAlt
import androidx.compose.material.icons.rounded.ChatBubble
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DarkMode
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.EmojiEvents
import androidx.compose.material.icons.rounded.FlipCameraAndroid
import androidx.compose.material.icons.rounded.Fullscreen
import androidx.compose.material.icons.rounded.Grid3x3
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.LightMode
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.MicOff
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.SentimentSatisfied
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.SportsEsports
import androidx.compose.material.icons.rounded.Videocam
import androidx.compose.material.icons.rounded.VideocamOff
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.CallMade
import androidx.compose.material.icons.automirrored.rounded.CallMissed
import androidx.compose.material.icons.automirrored.rounded.CallReceived
import androidx.compose.material.icons.automirrored.rounded.MenuBook
import androidx.compose.material.icons.automirrored.rounded.ScreenShare
import androidx.compose.material.icons.automirrored.rounded.StopScreenShare
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector

/** Shared Rounded Material icon vocabulary for Android UI surfaces. */
enum class AppSymbol {
    ACCOUNT, ATTACHMENT, AUDIO_CALL, BACK, CALCULATOR, CALL_END, CALL_INCOMING, CALL_MISSED, CALL_OUTGOING,
    CAMERA, CHAT, CLOSE, DARK_MODE, DELETE, EXPAND, FEED, FLIP_CAMERA, FRIENDS, GAMES, LEADERBOARD, LIGHT_MODE,
    MIC, MIC_OFF, MINIMIZE, NOTIFICATIONS, QUIZ, REACTIONS, SCREEN_SHARE, SCREEN_SHARE_STOP, SEARCH, STUDY, TIC_TAC_TOE,
    VIDEO_CALL, VIDEO_OFF, VOLUME,
}

@Composable
fun AppIcon(
    symbol: AppSymbol,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    tint: Color = LocalContentColor.current,
) {
    Icon(
        imageVector = symbol.imageVector(),
        contentDescription = contentDescription,
        modifier = modifier,
        tint = tint,
    )
}

private fun AppSymbol.imageVector(): ImageVector = when (this) {
    AppSymbol.ACCOUNT -> Icons.Rounded.AccountCircle
    AppSymbol.ATTACHMENT -> Icons.Rounded.Attachment
    AppSymbol.AUDIO_CALL -> Icons.Rounded.Call
    AppSymbol.BACK -> Icons.Rounded.ArrowBack
    AppSymbol.CALCULATOR -> Icons.Rounded.Calculate
    AppSymbol.CALL_END -> Icons.Rounded.CallEnd
    AppSymbol.CALL_INCOMING -> Icons.Rounded.CallReceived
    AppSymbol.CALL_MISSED -> Icons.Rounded.CallMissed
    AppSymbol.CALL_OUTGOING -> Icons.Rounded.CallMade
    AppSymbol.CAMERA -> Icons.Rounded.CameraAlt
    AppSymbol.CHAT -> Icons.Rounded.ChatBubble
    AppSymbol.CLOSE -> Icons.Rounded.Close
    AppSymbol.DARK_MODE -> Icons.Rounded.DarkMode
    AppSymbol.DELETE -> Icons.Rounded.Delete
    AppSymbol.EXPAND -> Icons.Rounded.Fullscreen
    AppSymbol.FEED -> Icons.Rounded.Home
    AppSymbol.FLIP_CAMERA -> Icons.Rounded.FlipCameraAndroid
    AppSymbol.FRIENDS -> Icons.Rounded.Groups
    AppSymbol.GAMES -> Icons.Rounded.SportsEsports
    AppSymbol.LEADERBOARD -> Icons.Rounded.EmojiEvents
    AppSymbol.LIGHT_MODE -> Icons.Rounded.LightMode
    AppSymbol.MIC -> Icons.Rounded.Mic
    AppSymbol.MIC_OFF -> Icons.Rounded.MicOff
    AppSymbol.MINIMIZE -> Icons.Rounded.KeyboardArrowDown
    AppSymbol.NOTIFICATIONS -> Icons.Rounded.Notifications
    AppSymbol.QUIZ -> Icons.Rounded.MenuBook
    AppSymbol.REACTIONS -> Icons.Rounded.SentimentSatisfied
    AppSymbol.SCREEN_SHARE -> Icons.Rounded.ScreenShare
    AppSymbol.SCREEN_SHARE_STOP -> Icons.Rounded.StopScreenShare
    AppSymbol.SEARCH -> Icons.Rounded.Search
    AppSymbol.STUDY -> Icons.Rounded.AutoStories
    AppSymbol.TIC_TAC_TOE -> Icons.Rounded.Grid3x3
    AppSymbol.VIDEO_CALL -> Icons.Rounded.Videocam
    AppSymbol.VIDEO_OFF -> Icons.Rounded.VideocamOff
    AppSymbol.VOLUME -> Icons.Rounded.VolumeUp
}
