package com.kothabarta.app

import android.content.Context

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
        return appForeground &&
            prefs.getString(ACTIVE_CONVERSATION, null) == conversationId
    }

    private fun preferences(context: Context) =
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
}

internal fun isValidConversationNotificationId(value: String?): Boolean =
    value?.matches(Regex("^[a-fA-F0-9]{24}$")) == true
