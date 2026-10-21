package com.kothabarta.app

import android.app.ActivityManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.kothabarta.core.network.PushDeviceRegistrar
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject

class PushMessagingService : FirebaseMessagingService(), KoinComponent {
    private val pushDeviceRegistrar: PushDeviceRegistrar by inject()

    override fun onNewToken(token: String) {
        // AuthRepository also syncs the current token after sign-in/session restore,
        // covering refreshes that happened before authentication.
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch { runCatching { pushDeviceRegistrar.registerToken(token) } }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val type = data["type"]
        if (type !in setOf("message", "call") || isAppForeground()) return
        val conversationId = data["conversationId"]?.takeIf(String::isNotBlank)
        if (type == "message" && conversationId == null) return
        val channelId = if (type == "call") CALL_CHANNEL_ID else MESSAGE_CHANNEL_ID
        ensureChannel(channelId, if (type == "call") "Calls" else "Messages")
        val intent = Intent(this, MainActivity::class.java).apply {
            action = ACTION_OPEN_CONVERSATION
            conversationId?.let { putExtra(EXTRA_CONVERSATION_ID, it) }
            data["callId"]?.let { putExtra(EXTRA_CALL_ID, it) }
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            (conversationId ?: data["callId"] ?: type).hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.sym_action_chat)
            .setContentTitle(data["title"] ?: if (type == "call") "Incoming call" else "New message")
            .setContentText(data["body"] ?: if (type == "call") "Incoming call" else "You have a new message.")
            .setStyle(NotificationCompat.BigTextStyle().bigText(data["body"] ?: if (type == "call") "Incoming call" else "You have a new message."))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(if (type == "call") NotificationCompat.PRIORITY_MAX else NotificationCompat.PRIORITY_HIGH)
            .build()
        runCatching { NotificationManagerCompat.from(this).notify((conversationId ?: data["callId"] ?: type).hashCode(), notification) }
    }

    private fun isAppForeground(): Boolean {
        val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        return activityManager.runningAppProcesses.orEmpty().any {
            it.processName == packageName && it.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
        }
    }

    private fun ensureChannel(channelId: String, name: String) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(NotificationChannel(channelId, name, NotificationManager.IMPORTANCE_HIGH))
    }

    companion object {
        const val EXTRA_CONVERSATION_ID = "conversationId"
        const val EXTRA_CALL_ID = "callId"
        const val ACTION_OPEN_CONVERSATION = "com.kothabarta.app.OPEN_CONVERSATION"
        private const val MESSAGE_CHANNEL_ID = "messages"
        private const val CALL_CHANNEL_ID = "calls"
    }
}
