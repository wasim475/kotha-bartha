package com.kothabarta.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.kothabarta.app.navigation.KothaBartaNavHost
import com.kothabarta.core.ui.theme.KothaBartaTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        setContent {
            KothaBartaTheme {
                KothaBartaNavHost()
            }
        }
    }
}
