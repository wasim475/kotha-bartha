package com.kothabarta.feature.quiz.data

import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.network.quiz.ChapterDto
import com.kothabarta.core.network.quiz.QuizAnswerRequest
import com.kothabarta.core.network.quiz.QuizAnswerResponse
import com.kothabarta.core.network.quiz.QuizApi
import com.kothabarta.core.network.quiz.QuizAttemptDto
import com.kothabarta.core.network.quiz.QuizCategoryDto
import com.kothabarta.core.network.quiz.QuizSetDto
import com.kothabarta.core.network.quiz.SubjectDto
import com.kothabarta.core.network.safeApiCall

class QuizRepository(private val api: QuizApi) {
    suspend fun getCategories(): ApiResult<List<QuizCategoryDto>> = safeApiCall { api.getCategories() }
    suspend fun getClassLevels(): ApiResult<List<String>> = safeApiCall { api.getClassLevels() }
    suspend fun getSscDivisions(): ApiResult<List<String>> = safeApiCall { api.getSscDivisions() }

    suspend fun getSubjects(category: String, classLevel: String?, division: String?): ApiResult<List<SubjectDto>> =
        safeApiCall { api.getSubjects(category, classLevel, division) }

    suspend fun getChapters(subjectId: String): ApiResult<List<ChapterDto>> = safeApiCall { api.getChapters(subjectId) }
    suspend fun getSets(chapterId: String): ApiResult<List<QuizSetDto>> = safeApiCall { api.getSets(chapterId) }

    suspend fun startSet(chapterId: String, setNumber: Int): ApiResult<QuizAttemptDto> =
        safeApiCall { api.startSet(chapterId, setNumber) }

    suspend fun answer(attemptId: String, questionIndex: Int, selectedPosition: Int?, timedOut: Boolean?): ApiResult<QuizAnswerResponse> =
        safeApiCall { api.answer(attemptId, QuizAnswerRequest(questionIndex, selectedPosition, timedOut)) }
}
