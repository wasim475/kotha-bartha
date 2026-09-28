package com.kothabarta.core.network.quiz

import com.kothabarta.core.network.ApiEnvelope
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface QuizApi {
    @GET("quiz/categories")
    suspend fun getCategories(): Response<ApiEnvelope<List<QuizCategoryDto>>>

    @GET("quiz/class-levels")
    suspend fun getClassLevels(): Response<ApiEnvelope<List<String>>>

    @GET("quiz/ssc-divisions")
    suspend fun getSscDivisions(): Response<ApiEnvelope<List<String>>>

    @GET("quiz/subjects")
    suspend fun getSubjects(
        @Query("category") category: String,
        @Query("classLevel") classLevel: String? = null,
        @Query("division") division: String? = null,
    ): Response<ApiEnvelope<List<SubjectDto>>>

    @GET("quiz/chapters")
    suspend fun getChapters(@Query("subjectId") subjectId: String): Response<ApiEnvelope<List<ChapterDto>>>

    @GET("quiz/chapters/{chapterId}/sets")
    suspend fun getSets(@Path("chapterId") chapterId: String): Response<ApiEnvelope<List<QuizSetDto>>>

    @POST("quiz/chapters/{chapterId}/sets/{setNumber}/start")
    suspend fun startSet(
        @Path("chapterId") chapterId: String,
        @Path("setNumber") setNumber: Int,
    ): Response<ApiEnvelope<QuizAttemptDto>>

    @POST("quiz/attempts/{attemptId}/answer")
    suspend fun answer(
        @Path("attemptId") attemptId: String,
        @Body body: QuizAnswerRequest,
    ): Response<ApiEnvelope<QuizAnswerResponse>>
}
