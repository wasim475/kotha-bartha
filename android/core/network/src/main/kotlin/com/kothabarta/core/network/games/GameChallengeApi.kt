package com.kothabarta.core.network.games

import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.social.SafeUserDto
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface GameChallengeApi {
    @GET("games/challenges/friends/online")
    suspend fun getOnlineFriends(): Response<ApiEnvelope<List<SafeUserDto>>>

    @GET("games/challenges/invites/pending")
    suspend fun getPendingInvites(): Response<ApiEnvelope<ChallengePendingInvitesDto>>

    @POST("games/challenges/invites")
    suspend fun sendInvite(@Body body: ChallengeInviteRequest): Response<ApiEnvelope<ChallengeInviteDto>>

    @POST("games/challenges/invites/{inviteId}/accept")
    suspend fun acceptInvite(@Path("inviteId") inviteId: String): Response<ApiEnvelope<ChallengeMatchWrapperDto>>

    @POST("games/challenges/invites/{inviteId}/decline")
    suspend fun declineInvite(@Path("inviteId") inviteId: String): Response<ApiEnvelope<Map<String, Any?>>>

    @POST("games/challenges/invites/{inviteId}/cancel")
    suspend fun cancelInvite(@Path("inviteId") inviteId: String): Response<ApiEnvelope<Map<String, Any?>>>

    @GET("games/challenges/{matchId}")
    suspend fun getMatch(@Path("matchId") matchId: String): Response<ApiEnvelope<ChallengeMatchDto>>

    @POST("games/challenges/{matchId}/answer")
    suspend fun answer(@Path("matchId") matchId: String, @Body body: ChallengeAnswerRequest): Response<ApiEnvelope<ChallengeMatchDto>>

    @POST("games/challenges/{matchId}/leave")
    suspend fun leaveMatch(@Path("matchId") matchId: String): Response<ApiEnvelope<ChallengeMatchDto>>

    @POST("games/challenges/{matchId}/rematch")
    suspend fun requestRematch(@Path("matchId") matchId: String): Response<ApiEnvelope<ChallengeInviteDto>>
}
