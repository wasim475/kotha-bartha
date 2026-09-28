package com.kothabarta.feature.games.data

import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.network.games.GameAnswerRequest
import com.kothabarta.core.network.games.GameAnswerResponse
import com.kothabarta.core.network.games.GameAttemptDto
import com.kothabarta.core.network.games.GameCatalogEntryDto
import com.kothabarta.core.network.games.GameReviewDto
import com.kothabarta.core.network.games.GamesApi
import com.kothabarta.core.network.safeApiCall

class GamesRepository(private val api: GamesApi) {
    suspend fun getCatalog(): ApiResult<List<GameCatalogEntryDto>> = safeApiCall { api.getCatalog() }

    /**
     * `GET /games/last` legitimately returns `{ "data": null }` when the
     * player has no attempt yet — [safeApiCall]'s generic null-data check
     * would otherwise surface that as an `EMPTY_RESPONSE` failure, so it's
     * translated back into a successful "no attempt" result here.
     */
    suspend fun getLastAttempt(): ApiResult<GameAttemptDto?> =
        when (val result = safeApiCall<GameAttemptDto?> { api.getLastAttempt() }) {
            is ApiResult.Success -> result
            is ApiResult.Failure -> if (result.error.code == "EMPTY_RESPONSE") ApiResult.Success(null) else result
        }

    suspend fun startGame(gameType: String): ApiResult<GameAttemptDto> = safeApiCall { api.startGame(gameType) }
    suspend fun getAttempt(attemptId: String): ApiResult<GameAttemptDto> = safeApiCall { api.getAttempt(attemptId) }
    suspend fun getReview(attemptId: String): ApiResult<GameReviewDto> = safeApiCall { api.getReview(attemptId) }

    suspend fun answer(attemptId: String, questionIndex: Int, selectedPosition: Int?, timedOut: Boolean?): ApiResult<GameAnswerResponse> =
        safeApiCall { api.answer(attemptId, GameAnswerRequest(questionIndex, selectedPosition, timedOut)) }
}
