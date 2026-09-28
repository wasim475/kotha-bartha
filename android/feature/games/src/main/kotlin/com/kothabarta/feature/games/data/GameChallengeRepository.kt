package com.kothabarta.feature.games.data

import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.network.games.ChallengeInviteDto
import com.kothabarta.core.network.games.ChallengeInviteRequest
import com.kothabarta.core.network.games.ChallengeMatchDto
import com.kothabarta.core.network.games.ChallengeMatchWrapperDto
import com.kothabarta.core.network.games.ChallengePendingInvitesDto
import com.kothabarta.core.network.games.GameChallengeApi
import com.kothabarta.core.network.safeApiCall
import com.kothabarta.core.network.social.SafeUserDto

class GameChallengeRepository(private val api: GameChallengeApi) {
    suspend fun getOnlineFriends(): ApiResult<List<SafeUserDto>> = safeApiCall { api.getOnlineFriends() }
    suspend fun getPendingInvites(): ApiResult<ChallengePendingInvitesDto> = safeApiCall { api.getPendingInvites() }

    suspend fun sendInvite(userId: String, gameType: String): ApiResult<ChallengeInviteDto> =
        safeApiCall { api.sendInvite(ChallengeInviteRequest(userId, gameType)) }

    suspend fun acceptInvite(inviteId: String): ApiResult<ChallengeMatchWrapperDto> = safeApiCall { api.acceptInvite(inviteId) }
    suspend fun declineInvite(inviteId: String): ApiResult<Map<String, Any?>> = safeApiCall { api.declineInvite(inviteId) }
    suspend fun cancelInvite(inviteId: String): ApiResult<Map<String, Any?>> = safeApiCall { api.cancelInvite(inviteId) }
    suspend fun getMatch(matchId: String): ApiResult<ChallengeMatchDto> = safeApiCall { api.getMatch(matchId) }
    suspend fun leaveMatch(matchId: String): ApiResult<ChallengeMatchDto> = safeApiCall { api.leaveMatch(matchId) }
    suspend fun requestRematch(matchId: String): ApiResult<ChallengeInviteDto> = safeApiCall { api.requestRematch(matchId) }
}
