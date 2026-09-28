package com.kothabarta.feature.leaderboard.data

import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.network.leaderboard.LeaderboardApi
import com.kothabarta.core.network.leaderboard.LeaderboardTopResponse
import com.kothabarta.core.network.safeApiCall

class LeaderboardRepository(private val api: LeaderboardApi) {
    suspend fun getTop(category: String, period: String): ApiResult<LeaderboardTopResponse> =
        safeApiCall { api.getTop(category, period) }
}
