package com.kothabarta.core.datastore

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "kotha_barta_prefs")

/**
 * Non-sensitive, ordinary settings only — the JWT never belongs here, it
 * lives exclusively in `core:security`'s Keystore-backed store. This is
 * deliberately the only thing this module holds for the first milestone
 * (just enough to make the Login screen remember the last email address
 * typed); it is not a place to "just cache" things without asking whether
 * they're sensitive first.
 */
class AppPreferences(context: Context) {

    private val dataStore = context.dataStore
    private val lastUsedEmailKey = stringPreferencesKey("last_used_email")

    val lastUsedEmail: Flow<String?> = dataStore.data.map { it[lastUsedEmailKey] }

    suspend fun setLastUsedEmail(email: String) {
        dataStore.edit { it[lastUsedEmailKey] = email }
    }
}
