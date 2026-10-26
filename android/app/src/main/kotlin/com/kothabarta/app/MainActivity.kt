package com.kothabarta.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.kothabarta.app.navigation.KothaBartaNavHost
import com.kothabarta.core.datastore.AppPreferences
import com.kothabarta.core.ui.theme.KothaBartaTheme
import kotlinx.coroutines.launch
import org.koin.compose.koinInject

data class NotificationTarget(
    val type: String? = null,
    val conversationId: String? = null,
    val messageId: String? = null,
    val postId: String? = null,
    val commentId: String? = null,
    val replyId: String? = null,
)

class MainActivity : ComponentActivity() {
    private var pendingNotification by mutableStateOf<NotificationTarget?>(null)
    private var notificationHandled = false

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        notificationHandled = savedInstanceState?.getBoolean(STATE_NOTIFICATION_HANDLED) ?: false
        pendingNotification = if (notificationHandled) null else intent.toNotificationTarget()
        setContent {
            val preferences = koinInject<AppPreferences>()
            val savedDarkTheme by preferences.darkTheme.collectAsState(initial = null)
            val darkTheme = savedDarkTheme ?: isSystemInDarkTheme()
            val coroutineScope = rememberCoroutineScope()

            KothaBartaTheme(darkTheme = darkTheme) {
                KothaBartaNavHost(
                    isDarkTheme = darkTheme,
                    notificationTarget = pendingNotification,
                    onNotificationHandled = {
                        pendingNotification = null
                        notificationHandled = true
                    },
                    onToggleTheme = {
                        coroutineScope.launch { preferences.setDarkTheme(!darkTheme) }
                    },
                )
            }
        }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        notificationHandled = false
        pendingNotification = intent.toNotificationTarget()
    }

    override fun onStart() {
        super.onStart()
        PushNotificationState.setAppForeground(true)
    }

    override fun onStop() {
        PushNotificationState.setAppForeground(false)
        super.onStop()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putBoolean(STATE_NOTIFICATION_HANDLED, notificationHandled)
        super.onSaveInstanceState(outState)
    }

    private companion object {
        const val STATE_NOTIFICATION_HANDLED = "notification_handled"
    }
}

private fun android.content.Intent.toNotificationTarget() = NotificationTarget(
    type = getStringExtra("type"),
    conversationId = getStringExtra("conversationId"),
    messageId = getStringExtra("messageId"),
    postId = getStringExtra("postId"),
    commentId = getStringExtra("commentId"),
    replyId = getStringExtra("replyId"),
).takeIf {
    isValidConversationNotificationId(it.conversationId) ||
        isValidConversationNotificationId(it.postId)
}
