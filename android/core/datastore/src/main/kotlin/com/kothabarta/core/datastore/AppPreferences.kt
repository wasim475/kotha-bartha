package com.kothabarta.core.datastore

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

enum class MessageNotificationPrivacy {
    SHOW_SENDER_AND_PREVIEW,
    SHOW_SENDER_ONLY,
    HIDE_NOTIFICATION_CONTENT
    ;

    companion object {
        fun fromStored(value: String?): MessageNotificationPrivacy =
            entries.firstOrNull { it.name == value } ?: SHOW_SENDER_ONLY
    }
}

private val Context.dataStore by preferencesDataStore(name = "kotha_barta_prefs")

/**
 * Non-sensitive, ordinary settings only — the JWT never belongs here, it
 * lives exclusively in `core:security`'s Keystore-backed store. This is
 * module holds non-sensitive interface preferences only. Authentication and
 * E2EE keys stay in their dedicated security stores.
 */
class AppPreferences(context: Context) {

    private val dataStore = context.dataStore
    private val lastUsedEmailKey = stringPreferencesKey("last_used_email")
    private val darkThemeKey = booleanPreferencesKey("dark_theme")
    private val messageNotificationPrivacyKey = stringPreferencesKey("message_notification_privacy")

    val lastUsedEmail: Flow<String?> = dataStore.data.map { it[lastUsedEmailKey] }
    val darkTheme: Flow<Boolean?> = dataStore.data.map { it[darkThemeKey] }
    val messageNotificationPrivacy: Flow<MessageNotificationPrivacy> = dataStore.data.map {
        MessageNotificationPrivacy.fromStored(it[messageNotificationPrivacyKey])
    }

    suspend fun setLastUsedEmail(email: String) {
        dataStore.edit { it[lastUsedEmailKey] = email }
    }

    suspend fun setDarkTheme(enabled: Boolean) {
        dataStore.edit { it[darkThemeKey] = enabled }
    }

    suspend fun setMessageNotificationPrivacy(value: MessageNotificationPrivacy) {
        dataStore.edit { it[messageNotificationPrivacyKey] = value.name }
    }
}
