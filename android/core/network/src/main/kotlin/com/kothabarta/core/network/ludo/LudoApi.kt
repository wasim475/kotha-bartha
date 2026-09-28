package com.kothabarta.core.network.ludo

import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.social.SafeUserDto
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface LudoApi {
    @GET("games/ludo/variants")
    suspend fun getCatalog(): Response<ApiEnvelope<LudoCatalogResponse>>

    @GET("games/ludo/active")
    suspend fun getActiveGames(): Response<ApiEnvelope<List<LudoGameDto>>>

    @GET("games/ludo/friends/online")
    suspend fun getOnlineFriends(): Response<ApiEnvelope<List<SafeUserDto>>>

    @GET("games/ludo/stats")
    suspend fun getStats(): Response<ApiEnvelope<LudoStatsDto>>

    @POST("games/ludo/lobbies")
    suspend fun createLobby(@Body body: CreateLudoLobbyRequest): Response<ApiEnvelope<LudoGameWrapperDto>>

    @GET("games/ludo/invites/pending")
    suspend fun getPendingInvites(): Response<ApiEnvelope<LudoPendingInvitesDto>>

    @POST("games/ludo/invites")
    suspend fun sendInvite(@Body body: LudoInviteRequest): Response<ApiEnvelope<LudoInviteDto>>

    @POST("games/ludo/invites/{inviteId}/accept")
    suspend fun acceptInvite(@Path("inviteId") inviteId: String): Response<ApiEnvelope<LudoGameWrapperDto>>

    @POST("games/ludo/invites/{inviteId}/decline")
    suspend fun declineInvite(@Path("inviteId") inviteId: String): Response<ApiEnvelope<Map<String, Any?>>>

    @POST("games/ludo/invites/{inviteId}/cancel")
    suspend fun cancelInvite(@Path("inviteId") inviteId: String): Response<ApiEnvelope<Map<String, Any?>>>

    @GET("games/ludo/{gameId}")
    suspend fun getGame(@Path("gameId") gameId: String): Response<ApiEnvelope<LudoGameDto>>

    @POST("games/ludo/{gameId}/ready")
    suspend fun setReady(@Path("gameId") gameId: String, @Body body: LudoReadyRequest): Response<ApiEnvelope<LudoGameWrapperDto>>

    @POST("games/ludo/{gameId}/start")
    suspend fun startGame(@Path("gameId") gameId: String): Response<ApiEnvelope<LudoGameWrapperDto>>

    @POST("games/ludo/{gameId}/leave")
    suspend fun leaveGame(@Path("gameId") gameId: String): Response<ApiEnvelope<LudoGameWrapperDto>>

    @POST("games/ludo/{gameId}/rematch")
    suspend fun requestRematch(@Path("gameId") gameId: String): Response<ApiEnvelope<Map<String, Any?>>>
}
