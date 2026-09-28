package com.kothabarta.core.network.call

import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.social.SafeUserDto
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.POST
import retrofit2.http.Query

interface CallApi {
    @GET("calls/active")
    suspend fun getActiveCall(): Response<ApiEnvelope<CallDto?>>

    @GET("calls/history")
    suspend fun getHistory(@Query("page") page: Int): Response<ApiEnvelope<CallHistoryResponse>>

    @GET("calls/friends/online")
    suspend fun getOnlineFriends(): Response<ApiEnvelope<List<SafeUserDto>>>

    @GET("calls/{callId}")
    suspend fun getCall(@Path("callId") callId: String): Response<ApiEnvelope<CallDto>>

    @POST("calls")
    suspend fun startCall(@Body body: StartCallRequest): Response<ApiEnvelope<CallDto>>

    @POST("calls/{callId}/accept")
    suspend fun acceptCall(@Path("callId") callId: String): Response<ApiEnvelope<CallDto>>

    @POST("calls/{callId}/decline")
    suspend fun declineCall(@Path("callId") callId: String): Response<ApiEnvelope<CallDto>>

    @POST("calls/{callId}/cancel")
    suspend fun cancelCall(@Path("callId") callId: String): Response<ApiEnvelope<CallDto>>

    @POST("calls/{callId}/end")
    suspend fun endCall(@Path("callId") callId: String): Response<ApiEnvelope<CallDto>>

    @POST("calls/{callId}/invite")
    suspend fun inviteParticipant(@Path("callId") callId: String, @Body body: CallInviteParticipantRequest): Response<ApiEnvelope<CallDto>>

    @POST("calls/{callId}/invite/accept")
    suspend fun acceptParticipantInvite(@Path("callId") callId: String): Response<ApiEnvelope<CallDto>>

    @POST("calls/{callId}/invite/decline")
    suspend fun declineParticipantInvite(@Path("callId") callId: String): Response<ApiEnvelope<CallDto>>
}
