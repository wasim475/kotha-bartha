package com.kothabarta.core.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Pulled directly from the web app's own CSS variables
 * (`client/src/App.css`'s `--paper`/`--ink`/`--muted`/`--accent`/`--danger`
 * tokens) so the Android app reads as the same product, not a reskin —
 * see docs/architecture/android-implementation-plan.md section K.
 */
object KothaColors {
    // Light theme
    val LightPaper = Color(0xFFF6F4EF)
    val LightInk = Color(0xFF262421)
    val LightMuted = Color(0xFF8B8880)
    val Accent = Color(0xFFE96449)
    val AccentDeep = Color(0xFFC84E3C)
    val LightDanger = Color(0xFFC0392B)
    val LightDangerDeep = Color(0xFFA5311F)
    val LightDangerSoft = Color(0xFFFBE6E1)

    // Dark theme
    val DarkPaper = Color(0xFF171716)
    val DarkInk = Color(0xFFF4F0E8)
    val DarkMuted = Color(0xFFAAA49A)
    val DarkDanger = Color(0xFFE0665A)
    val DarkDangerDeep = Color(0xFFEC7D72)
    val DarkDangerSoft = Color(0x29E0665A)

    val OnAccent = Color(0xFFFFFFFF)
}
