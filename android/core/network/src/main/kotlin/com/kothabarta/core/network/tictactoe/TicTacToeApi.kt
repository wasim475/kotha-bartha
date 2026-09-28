package com.kothabarta.core.network.tictactoe

import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.social.SafeUserDto
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

interface TicTacToeApi {
    @GET("games/tic-tac-toe/settings")
    suspend fun getSettings(): Response<ApiEnvelope<TttSettingsDto>>

    @PATCH("games/tic-tac-toe/settings")
    suspend fun updateSettings(@Body body: TttSettingsDto): Response<ApiEnvelope<TttSettingsDto>>

    @GET("games/tic-tac-toe/stats")
    suspend fun getStats(): Response<ApiEnvelope<TttStatsDto>>

    @GET("games/tic-tac-toe/friends/online")
    suspend fun getOnlineFriends(): Response<ApiEnvelope<List<SafeUserDto>>>

    @GET("games/tic-tac-toe/active")
    suspend fun getActiveGames(): Response<ApiEnvelope<List<TttGameDto>>>

    @GET("games/tic-tac-toe/invites/pending")
    suspend fun getPendingInvites(): Response<ApiEnvelope<TttPendingInvitesDto>>

    @POST("games/tic-tac-toe/invites")
    suspend fun sendInvite(@Body body: TttInviteRequest): Response<ApiEnvelope<TttInviteDto>>

    @POST("games/tic-tac-toe/invites/{inviteId}/accept")
    suspend fun acceptInvite(@Path("inviteId") inviteId: String): Response<ApiEnvelope<TttGameWrapperDto>>

    @POST("games/tic-tac-toe/invites/{inviteId}/decline")
    suspend fun declineInvite(@Path("inviteId") inviteId: String): Response<ApiEnvelope<Map<String, Any?>>>

    @POST("games/tic-tac-toe/invites/{inviteId}/cancel")
    suspend fun cancelInvite(@Path("inviteId") inviteId: String): Response<ApiEnvelope<Map<String, Any?>>>

    @GET("games/tic-tac-toe/{gameId}")
    suspend fun getGame(@Path("gameId") gameId: String): Response<ApiEnvelope<TttGameDto>>

    @POST("games/tic-tac-toe/{gameId}/move")
    suspend fun move(@Path("gameId") gameId: String, @Body body: TttMoveRequest): Response<ApiEnvelope<TttGameWrapperDto>>

    @POST("games/tic-tac-toe/{gameId}/rematch")
    suspend fun requestRematch(@Path("gameId") gameId: String): Response<ApiEnvelope<TttInviteDto>>

    @POST("games/tic-tac-toe/{gameId}/leave")
    suspend fun leaveGame(@Path("gameId") gameId: String): Response<ApiEnvelope<TttGameWrapperDto>>

    @POST("games/tic-tac-toe/rematch/{requestId}/accept")
    suspend fun acceptRematch(@Path("requestId") requestId: String): Response<ApiEnvelope<TttGameWrapperDto>>

    @POST("games/tic-tac-toe/rematch/{requestId}/decline")
    suspend fun declineRematch(@Path("requestId") requestId: String): Response<ApiEnvelope<Map<String, Any?>>>
}
