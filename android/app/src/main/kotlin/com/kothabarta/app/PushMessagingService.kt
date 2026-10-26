package com.kothabarta.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
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
        if (type !in setOf("message", "call", "post_like", "post_reaction", "post_comment", "comment_reaction", "friend_request", "friend_accepted", "missed_call")) return
        val conversationId = data["conversationId"]?.takeIf(String::isNotBlank)
        val isPostTarget = type in setOf("post_like", "post_reaction", "post_comment", "comment_reaction")
        if ((type == "message" || type == "call" || type == "missed_call") &&
            !isValidConversationNotificationId(conversationId)
        ) return
        if (type == "message" && !isValidConversationNotificationId(data["messageId"])) return
        if (isPostTarget && data["postId"].isNullOrBlank()) return
        if (type == "message" && PushNotificationState.shouldSuppressMessageNotification(this, conversationId!!)) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val channelId = if (type == "call") CALL_CHANNEL_ID else MESSAGE_CHANNEL_ID
        ensureChannel(channelId, if (type == "call") "Calls" else "Messages")
        val intent = Intent(this, MainActivity::class.java).apply {
            action = ACTION_OPEN_NOTIFICATION
            for (key in ROUTING_EXTRAS) data[key]?.let { putExtra(key, it) }
            data["callId"]?.let { putExtra(EXTRA_CALL_ID, it) }
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val destinationId = data["messageId"] ?: data["replyId"] ?: data["commentId"] ?: data["postId"] ?: conversationId ?: data["notificationId"] ?: type
        val pendingIntent = PendingIntent.getActivity(
            this,
            destinationId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notificationTitle = if (type == "message") "Kotha-Barta"
        else data["title"] ?: if (type == "call") "Incoming call" else "New message"
        val notificationBody = if (type == "message") "New message"
        else data["body"] ?: if (type == "call") "Incoming call" else "You have a new message."
        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.sym_action_chat)
            .setContentTitle(notificationTitle)
            .setContentText(notificationBody)
            .setStyle(NotificationCompat.BigTextStyle().bigText(notificationBody))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPriority(if (type == "call") NotificationCompat.PRIORITY_MAX else NotificationCompat.PRIORITY_HIGH)
            .build()
        NotificationManagerCompat.from(this).notify((data["notificationId"] ?: destinationId).hashCode(), notification)
    }

    private fun ensureChannel(channelId: String, name: String) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(NotificationChannel(channelId, name, NotificationManager.IMPORTANCE_HIGH))
    }

    companion object {
        const val EXTRA_CONVERSATION_ID = "conversationId"
        const val EXTRA_CALL_ID = "callId"
        const val ACTION_OPEN_NOTIFICATION = "com.kothabarta.app.OPEN_NOTIFICATION"
        val ROUTING_EXTRAS = listOf("notificationId", "type", "conversationId", "messageId", "postId", "commentId", "replyId")
        private const val MESSAGE_CHANNEL_ID = "messages"
        private const val CALL_CHANNEL_ID = "calls"
    }
}
