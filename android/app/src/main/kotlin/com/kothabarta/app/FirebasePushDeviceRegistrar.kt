package com.kothabarta.app

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import com.kothabarta.core.network.PushDeviceRegistrar
import com.kothabarta.core.network.safeApiCall
import com.kothabarta.core.network.social.PushDeviceRequest
import com.kothabarta.core.network.social.PushDevicesApi
import com.kothabarta.core.security.TokenStore
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

class FirebasePushDeviceRegistrar(
    private val context: Context,
    private val api: PushDevicesApi,
    private val tokenStore: TokenStore,
) : PushDeviceRegistrar {
    override suspend fun syncCurrentToken() {
        if (tokenStore.getToken().isNullOrBlank() || FirebaseApp.getApps(context).isEmpty()) return
        val token = runCatching { currentToken() }.getOrNull() ?: return
        registerToken(token)
    }

    override suspend fun registerToken(token: String) {
        if (tokenStore.getToken().isNullOrBlank() || FirebaseApp.getApps(context).isEmpty() || token.isBlank()) return
        safeApiCall { api.register(PushDeviceRequest(installationId(), token)) }
    }

    override suspend fun unregister() {
        val installationId = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString(INSTALLATION_ID, null) ?: return
        if (tokenStore.getToken().isNullOrBlank()) return
        safeApiCall { api.unregister(installationId) }
    }

    private suspend fun currentToken(): String = suspendCancellableCoroutine { continuation ->
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { if (continuation.isActive) continuation.resume(it) }
            .addOnFailureListener { if (continuation.isActive) continuation.resumeWithException(it) }
    }

    private fun installationId(): String {
        val prefs = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
        return prefs.getString(INSTALLATION_ID, null) ?: UUID.randomUUID().toString().replace("-", "").also {
            prefs.edit().putString(INSTALLATION_ID, it).apply()
        }
    }

    private companion object {
        const val PREFERENCES = "push_device"
        const val INSTALLATION_ID = "installation_id"
    }
}
