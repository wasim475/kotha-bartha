package com.kothabarta.core.network.social

import com.kothabarta.core.network.ApiEnvelope
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.PUT
import retrofit2.http.Path

data class PushDeviceRequest(val installationId: String, val token: String)
data class PushDeviceResponse(val registered: Boolean = false, val removed: Boolean = false)

interface PushDevicesApi {
    @PUT("users/me/push-device")
    suspend fun register(@Body body: PushDeviceRequest): Response<ApiEnvelope<PushDeviceResponse>>

    @DELETE("users/me/push-device/{installationId}")
    suspend fun unregister(@Path("installationId") installationId: String): Response<ApiEnvelope<PushDeviceResponse>>
}
