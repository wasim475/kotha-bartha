package com.kothabarta.feature.ludo.data

import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.network.ludo.CreateLudoLobbyRequest
import com.kothabarta.core.network.ludo.LudoApi
import com.kothabarta.core.network.ludo.LudoCatalogResponse
import com.kothabarta.core.network.ludo.LudoGameDto
import com.kothabarta.core.network.ludo.LudoGameWrapperDto
import com.kothabarta.core.network.ludo.LudoInviteDto
import com.kothabarta.core.network.ludo.LudoInviteRequest
import com.kothabarta.core.network.ludo.LudoPendingInvitesDto
import com.kothabarta.core.network.ludo.LudoReadyRequest
import com.kothabarta.core.network.ludo.LudoStatsDto
import com.kothabarta.core.network.safeApiCall
import com.kothabarta.core.network.social.SafeUserDto

class LudoRepository(private val api: LudoApi) {
    suspend fun getCatalog(): ApiResult<LudoCatalogResponse> = safeApiCall { api.getCatalog() }
    suspend fun getActiveGames(): ApiResult<List<LudoGameDto>> = safeApiCall { api.getActiveGames() }
    suspend fun getOnlineFriends(): ApiResult<List<SafeUserDto>> = safeApiCall { api.getOnlineFriends() }
    suspend fun getStats(): ApiResult<LudoStatsDto> = safeApiCall { api.getStats() }
    suspend fun createLobby(body: CreateLudoLobbyRequest): ApiResult<LudoGameWrapperDto> = safeApiCall { api.createLobby(body) }
    suspend fun getPendingInvites(): ApiResult<LudoPendingInvitesDto> = safeApiCall { api.getPendingInvites() }
    suspend fun sendInvite(body: LudoInviteRequest): ApiResult<LudoInviteDto> = safeApiCall { api.sendInvite(body) }
    suspend fun acceptInvite(inviteId: String): ApiResult<LudoGameWrapperDto> = safeApiCall { api.acceptInvite(inviteId) }
    suspend fun declineInvite(inviteId: String): ApiResult<Map<String, Any?>> = safeApiCall { api.declineInvite(inviteId) }
    suspend fun cancelInvite(inviteId: String): ApiResult<Map<String, Any?>> = safeApiCall { api.cancelInvite(inviteId) }
    suspend fun getGame(gameId: String): ApiResult<LudoGameDto> = safeApiCall { api.getGame(gameId) }
    suspend fun setReady(gameId: String, ready: Boolean): ApiResult<LudoGameWrapperDto> = safeApiCall { api.setReady(gameId, LudoReadyRequest(ready)) }
    suspend fun startGame(gameId: String): ApiResult<LudoGameWrapperDto> = safeApiCall { api.startGame(gameId) }
    suspend fun leaveGame(gameId: String): ApiResult<LudoGameWrapperDto> = safeApiCall { api.leaveGame(gameId) }
    suspend fun requestRematch(gameId: String): ApiResult<Map<String, Any?>> = safeApiCall { api.requestRematch(gameId) }
}
