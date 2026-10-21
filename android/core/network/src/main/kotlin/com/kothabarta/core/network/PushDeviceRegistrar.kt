package com.kothabarta.core.network

/** App-specific FCM integration, kept behind a core contract for the auth feature. */
interface PushDeviceRegistrar {
    suspend fun syncCurrentToken()
    suspend fun registerToken(token: String)
    suspend fun unregister()
}

object NoOpPushDeviceRegistrar : PushDeviceRegistrar {
    override suspend fun syncCurrentToken() = Unit
    override suspend fun registerToken(token: String) = Unit
    override suspend fun unregister() = Unit
}
