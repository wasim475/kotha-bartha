package com.kothabarta.core.network.social

import com.kothabarta.core.network.ApiEnvelope
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface ReportsApi {
    @POST("reports")
    suspend fun createReport(@Body body: CreateReportBody): Response<ApiEnvelope<ReportCreatedDto>>
}
