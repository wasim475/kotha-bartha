package com.kothabarta.app

import android.content.Context
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import com.kothabarta.core.common.ApiResult
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
        if (tokenStore.getToken().isNullOrBlank()) {
            Log.i(TAG, "FCM token sync skipped (no authenticated session)")
            return
        }
        if (FirebaseApp.getApps(context).isEmpty()) {
            Log.w(TAG, "FCM token sync skipped (Firebase is not initialized)")
            return
        }
        val token = try {
            currentToken()
        } catch (error: Exception) {
            Log.w(TAG, "Unable to retrieve the FCM registration token (${error.javaClass.simpleName})")
            return
        }
        registerToken(token)
    }

    override suspend fun registerToken(token: String) {
        if (tokenStore.getToken().isNullOrBlank()) {
            Log.i(TAG, "FCM token registration skipped (no authenticated session)")
            return
        }
        if (FirebaseApp.getApps(context).isEmpty()) {
            Log.w(TAG, "FCM token registration skipped (Firebase is not initialized)")
            return
        }
        if (token.isBlank()) {
            Log.w(TAG, "FCM token registration skipped (empty token)")
            return
        }

        val response = try {
            api.register(PushDeviceRequest(installationId(), token))
        } catch (error: Exception) {
            Log.w(TAG, "FCM token registration request failed (${error.javaClass.simpleName})")
            return
        }
        if (!response.isSuccessful) {
            Log.w(TAG, "FCM token registration failed (HTTP ${response.code()})")
            return
        }
        if (response.body()?.data?.registered == true) {
            Log.i(TAG, "FCM token registration succeeded (HTTP ${response.code()})")
        } else {
            Log.w(TAG, "FCM token registration returned no confirmation (HTTP ${response.code()})")
        }
    }

    override suspend fun unregister() {
        val installationId = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString(INSTALLATION_ID, null) ?: return
        if (tokenStore.getToken().isNullOrBlank()) return
        when (val result = safeApiCall { api.unregister(installationId) }) {
            is ApiResult.Success -> Unit
            is ApiResult.Failure -> Log.w(TAG, "FCM unregistration failed (${result.error.code})")
        }
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
        const val TAG = "PushDeviceRegistrar"
        const val PREFERENCES = "push_device"
        const val INSTALLATION_ID = "installation_id"
    }
}
