package com.kothabarta.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.kothabarta.app.navigation.KothaBartaNavHost
import com.kothabarta.core.datastore.AppPreferences
import com.kothabarta.core.ui.theme.KothaBartaTheme
import kotlinx.coroutines.launch
import org.koin.compose.koinInject

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        setContent {
            val preferences = koinInject<AppPreferences>()
            val savedDarkTheme by preferences.darkTheme.collectAsState(initial = null)
            val darkTheme = savedDarkTheme ?: isSystemInDarkTheme()
            val coroutineScope = rememberCoroutineScope()

            KothaBartaTheme(darkTheme = darkTheme) {
                KothaBartaNavHost(
                    isDarkTheme = darkTheme,
                    onToggleTheme = {
                        coroutineScope.launch { preferences.setDarkTheme(!darkTheme) }
                    },
                )
            }
        }
    }
}
