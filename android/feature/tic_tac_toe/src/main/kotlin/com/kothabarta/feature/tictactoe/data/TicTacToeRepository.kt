package com.kothabarta.feature.tictactoe.data

import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.network.safeApiCall
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.network.tictactoe.TicTacToeApi
import com.kothabarta.core.network.tictactoe.TttGameDto
import com.kothabarta.core.network.tictactoe.TttGameWrapperDto
import com.kothabarta.core.network.tictactoe.TttInviteDto
import com.kothabarta.core.network.tictactoe.TttInviteRequest
import com.kothabarta.core.network.tictactoe.TttMoveRequest
import com.kothabarta.core.network.tictactoe.TttPendingInvitesDto
import com.kothabarta.core.network.tictactoe.TttSettingsDto
import com.kothabarta.core.network.tictactoe.TttStatsDto

class TicTacToeRepository(private val api: TicTacToeApi) {
    suspend fun getSettings(): ApiResult<TttSettingsDto> = safeApiCall { api.getSettings() }
    suspend fun updateSettings(settings: TttSettingsDto): ApiResult<TttSettingsDto> = safeApiCall { api.updateSettings(settings) }
    suspend fun getStats(): ApiResult<TttStatsDto> = safeApiCall { api.getStats() }
    suspend fun getOnlineFriends(): ApiResult<List<SafeUserDto>> = safeApiCall { api.getOnlineFriends() }
    suspend fun getActiveGames(): ApiResult<List<TttGameDto>> = safeApiCall { api.getActiveGames() }
    suspend fun getPendingInvites(): ApiResult<TttPendingInvitesDto> = safeApiCall { api.getPendingInvites() }
    suspend fun sendInvite(userId: String): ApiResult<TttInviteDto> = safeApiCall { api.sendInvite(TttInviteRequest(userId)) }
    suspend fun acceptInvite(inviteId: String): ApiResult<TttGameWrapperDto> = safeApiCall { api.acceptInvite(inviteId) }
    suspend fun declineInvite(inviteId: String): ApiResult<Map<String, Any?>> = safeApiCall { api.declineInvite(inviteId) }
    suspend fun cancelInvite(inviteId: String): ApiResult<Map<String, Any?>> = safeApiCall { api.cancelInvite(inviteId) }
    suspend fun getGame(gameId: String): ApiResult<TttGameDto> = safeApiCall { api.getGame(gameId) }
    suspend fun move(gameId: String, cellIndex: Int): ApiResult<TttGameWrapperDto> = safeApiCall { api.move(gameId, TttMoveRequest(cellIndex)) }
    suspend fun requestRematch(gameId: String): ApiResult<TttInviteDto> = safeApiCall { api.requestRematch(gameId) }
    suspend fun leaveGame(gameId: String): ApiResult<TttGameWrapperDto> = safeApiCall { api.leaveGame(gameId) }
    suspend fun acceptRematch(requestId: String): ApiResult<TttGameWrapperDto> = safeApiCall { api.acceptRematch(requestId) }
    suspend fun declineRematch(requestId: String): ApiResult<Map<String, Any?>> = safeApiCall { api.declineRematch(requestId) }
}
