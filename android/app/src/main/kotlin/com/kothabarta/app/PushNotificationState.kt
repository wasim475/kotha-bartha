package com.kothabarta.app

import android.content.Context
import androidx.core.app.NotificationManagerCompat
import java.nio.ByteBuffer
import java.security.MessageDigest

internal object PushNotificationState {
    private const val PREFERENCES = "push_notification_state"
    private const val ACTIVE_CONVERSATION = "active_conversation"
    @Volatile private var appForeground = false

    fun setAppForeground(foreground: Boolean) {
        appForeground = foreground
    }

    fun setActiveConversation(context: Context, conversationId: String?) {
        preferences(context).edit().putString(ACTIVE_CONVERSATION, conversationId).apply()
    }

    fun clearActiveConversation(context: Context, conversationId: String?) {
        val prefs = preferences(context)
        if (prefs.getString(ACTIVE_CONVERSATION, null) == conversationId) {
            prefs.edit().remove(ACTIVE_CONVERSATION).apply()
        }
    }

    fun shouldSuppressMessageNotification(context: Context, conversationId: String): Boolean {
        val prefs = preferences(context)
        return shouldSuppressMessageNotification(
            appForeground,
            prefs.getString(ACTIVE_CONVERSATION, null),
            conversationId,
        )
    }

    @Synchronized
    fun recordMessage(context: Context, conversationId: String, messageId: String): MessageNotificationCount {
        val prefs = preferences(context)
        val conversationKey = stableHash(conversationId)
        val seenKey = "seen_$conversationKey"
        val countKey = "count_$conversationKey"
        val messageKey = stableHash(messageId)
        val current = MessageNotificationCounterState(
            count = prefs.getInt(countKey, 0),
            recentMessageIds = prefs.getStringSet(seenKey, emptySet()).orEmpty().toList(),
        )
        val updated = recordNotificationMessage(current, messageKey)
        if (updated == current) return MessageNotificationCount(current.count, duplicate = true)
        prefs.edit().putStringSet(seenKey, updated.recentMessageIds.toSet()).putInt(countKey, updated.count).commit()
        return MessageNotificationCount(updated.count, duplicate = false)
    }

    fun clearConversationNotification(context: Context, conversationId: String) {
        val prefs = preferences(context)
        val conversationKey = stableHash(conversationId)
        prefs.edit().remove("seen_$conversationKey").remove("count_$conversationKey").apply()
        NotificationManagerCompat.from(context).cancel(conversationNotificationId(conversationId))
    }

    fun conversationNotificationId(conversationId: String): Int =
        ByteBuffer.wrap(sha256(conversationId).copyOfRange(0, Int.SIZE_BYTES)).int.and(Int.MAX_VALUE).coerceAtLeast(1)

    fun conversationGroupKey(conversationId: String): String =
        "com.kothabarta.app.messages.${stableHash(conversationId)}"

    private fun stableHash(value: String): String = sha256(value).joinToString("") { "%02x".format(it) }

    private fun sha256(value: String): ByteArray =
        MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))

    private fun preferences(context: Context) =
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

}

internal data class MessageNotificationCount(val count: Int, val duplicate: Boolean)

internal data class MessageNotificationCounterState(val count: Int = 0, val recentMessageIds: List<String> = emptyList())

internal fun recordNotificationMessage(state: MessageNotificationCounterState, messageId: String): MessageNotificationCounterState {
    if (messageId in state.recentMessageIds) return state
    return state.copy(
        count = (state.count + 1).coerceAtMost(Int.MAX_VALUE),
        recentMessageIds = (state.recentMessageIds + messageId).takeLast(128),
    )
}

internal fun shouldSuppressMessageNotification(
    appForeground: Boolean,
    activeConversationId: String?,
    incomingConversationId: String,
): Boolean = appForeground && activeConversationId == incomingConversationId

internal fun isValidConversationNotificationId(value: String?): Boolean =
    value?.matches(Regex("^[a-fA-F0-9]{24}$")) == true
