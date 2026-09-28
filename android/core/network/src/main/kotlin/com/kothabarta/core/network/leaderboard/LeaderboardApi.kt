package com.kothabarta.core.network.leaderboard

import com.kothabarta.core.network.ApiEnvelope
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface LeaderboardApi {
    @GET("leaderboard/top")
    suspend fun getTop(
        @Query("category") category: String = "overall",
        @Query("period") period: String = "month",
    ): Response<ApiEnvelope<LeaderboardTopResponse>>

    @GET("leaderboard/users/{userId}/stats")
    suspend fun getUserStats(
        @Path("userId") userId: String,
        @Query("period") period: String = "month",
    ): Response<ApiEnvelope<UserStatsDto>>
}
