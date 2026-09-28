package com.kothabarta.core.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * The one place the app keeps the JWT issued by `POST /auth/{login,register,google}`
 * (see docs/architecture/android-readiness.md's "Authentication flow"). Android
 * never uses the cookie the web client relies on — this is the Keystore-backed
 * replacement for it, and everything else (network auth header, socket
 * handshake) reads the token from here, never from anywhere else.
 */
interface TokenStore {
    fun saveToken(token: String)
    fun getToken(): String?
    fun clearToken()
}

class EncryptedTokenStore(context: Context) : TokenStore {

    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            PREFS_FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    override fun saveToken(token: String) {
        prefs.edit().putString(KEY_TOKEN, token).apply()
    }

    override fun getToken(): String? = prefs.getString(KEY_TOKEN, null)

    override fun clearToken() {
        prefs.edit().remove(KEY_TOKEN).apply()
    }

    private companion object {
        const val PREFS_FILE_NAME = "kotha_barta_secure_prefs"
        const val KEY_TOKEN = "jwt_token"
    }
}
