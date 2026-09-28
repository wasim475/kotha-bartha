package com.kothabarta.core.network.games

import com.kothabarta.core.network.ApiEnvelope
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface GamesApi {
    @GET("games")
    suspend fun getCatalog(): Response<ApiEnvelope<List<GameCatalogEntryDto>>>

    @GET("games/last")
    suspend fun getLastAttempt(): Response<ApiEnvelope<GameAttemptDto?>>

    @POST("games/{gameType}/start")
    suspend fun startGame(@Path("gameType") gameType: String): Response<ApiEnvelope<GameAttemptDto>>

    @GET("games/attempts/{attemptId}")
    suspend fun getAttempt(@Path("attemptId") attemptId: String): Response<ApiEnvelope<GameAttemptDto>>

    @GET("games/attempts/{attemptId}/review")
    suspend fun getReview(@Path("attemptId") attemptId: String): Response<ApiEnvelope<GameReviewDto>>

    @POST("games/attempts/{attemptId}/answer")
    suspend fun answer(
        @Path("attemptId") attemptId: String,
        @Body body: GameAnswerRequest,
    ): Response<ApiEnvelope<GameAnswerResponse>>
}
