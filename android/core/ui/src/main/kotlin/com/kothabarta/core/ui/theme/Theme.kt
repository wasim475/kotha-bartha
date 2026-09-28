package com.kothabarta.core.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors = lightColorScheme(
    primary = KothaColors.Accent,
    onPrimary = KothaColors.OnAccent,
    primaryContainer = KothaColors.AccentDeep,
    onPrimaryContainer = KothaColors.OnAccent,
    background = KothaColors.LightPaper,
    onBackground = KothaColors.LightInk,
    surface = KothaColors.LightPaper,
    onSurface = KothaColors.LightInk,
    surfaceVariant = KothaColors.LightPaper,
    onSurfaceVariant = KothaColors.LightMuted,
    outline = KothaColors.LightMuted,
    error = KothaColors.LightDanger,
    onError = KothaColors.OnAccent,
    errorContainer = KothaColors.LightDangerSoft,
    onErrorContainer = KothaColors.LightDangerDeep,
)

private val DarkColors = darkColorScheme(
    primary = KothaColors.Accent,
    onPrimary = KothaColors.OnAccent,
    primaryContainer = KothaColors.AccentDeep,
    onPrimaryContainer = KothaColors.OnAccent,
    background = KothaColors.DarkPaper,
    onBackground = KothaColors.DarkInk,
    surface = KothaColors.DarkPaper,
    onSurface = KothaColors.DarkInk,
    surfaceVariant = KothaColors.DarkPaper,
    onSurfaceVariant = KothaColors.DarkMuted,
    outline = KothaColors.DarkMuted,
    error = KothaColors.DarkDanger,
    onError = KothaColors.DarkPaper,
    errorContainer = KothaColors.DarkDangerSoft,
    onErrorContainer = KothaColors.DarkDangerDeep,
)

@Composable
fun KothaBartaTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) DarkColors else LightColors
    MaterialTheme(
        colorScheme = colorScheme,
        typography = KothaTypography,
        content = content,
    )
}
