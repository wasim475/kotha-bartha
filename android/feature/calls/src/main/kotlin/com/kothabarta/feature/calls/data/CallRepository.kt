package com.kothabarta.feature.calls.data

import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.network.call.CallApi
import com.kothabarta.core.network.call.CallDto
import com.kothabarta.core.network.call.CallHistoryResponse
import com.kothabarta.core.network.call.CallInviteParticipantRequest
import com.kothabarta.core.network.call.StartCallRequest
import com.kothabarta.core.network.safeApiCall
import com.kothabarta.core.network.social.SafeUserDto

class CallRepository(private val api: CallApi) {

    /** `GET /calls/active` legitimately returns `{data:null}` when there is none — `safeApiCall` would otherwise treat that as EMPTY_RESPONSE, so it's translated back to `Success(null)`. */
    suspend fun getActiveCall(): ApiResult<CallDto?> =
        when (val result = safeApiCall { api.getActiveCall() }) {
            is ApiResult.Success -> result
            is ApiResult.Failure -> if (result.error.code == "EMPTY_RESPONSE") ApiResult.Success(null) else result
        }

    suspend fun getHistory(page: Int): ApiResult<CallHistoryResponse> = safeApiCall { api.getHistory(page) }
    suspend fun getOnlineFriends(): ApiResult<List<SafeUserDto>> = safeApiCall { api.getOnlineFriends() }
    suspend fun getCall(callId: String): ApiResult<CallDto> = safeApiCall { api.getCall(callId) }
    suspend fun startCall(userId: String, video: Boolean): ApiResult<CallDto> = safeApiCall { api.startCall(StartCallRequest(userId, video)) }
    suspend fun acceptCall(callId: String): ApiResult<CallDto> = safeApiCall { api.acceptCall(callId) }
    suspend fun declineCall(callId: String): ApiResult<CallDto> = safeApiCall { api.declineCall(callId) }
    suspend fun cancelCall(callId: String): ApiResult<CallDto> = safeApiCall { api.cancelCall(callId) }
    suspend fun endCall(callId: String): ApiResult<CallDto> = safeApiCall { api.endCall(callId) }

    suspend fun inviteParticipant(callId: String, userId: String): ApiResult<CallDto> =
        safeApiCall { api.inviteParticipant(callId, CallInviteParticipantRequest(userId)) }

    suspend fun acceptParticipantInvite(callId: String): ApiResult<CallDto> = safeApiCall { api.acceptParticipantInvite(callId) }
    suspend fun declineParticipantInvite(callId: String): ApiResult<CallDto> = safeApiCall { api.declineParticipantInvite(callId) }
}
