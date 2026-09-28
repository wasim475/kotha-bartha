package com.kothabarta.core.network.social

import com.kothabarta.core.network.ApiEnvelope
import retrofit2.Response
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/** `/api/v1/notifications/*` — see docs/architecture/android-api-contract.md's "Notifications". */
interface NotificationsApi {

    @GET("notifications/unread-counts")
    suspend fun getUnreadCounts(): Response<ApiEnvelope<UnreadCountsDto>>

    @GET("notifications")
    suspend fun getNotifications(): Response<ApiEnvelope<List<NotificationDto>>>

    @POST("notifications/{notificationId}/read")
    suspend fun markRead(@Path("notificationId") notificationId: String): Response<ApiEnvelope<MarkReadResponse>>

    @DELETE("notifications/{notificationId}")
    suspend fun deleteNotification(@Path("notificationId") notificationId: String): Response<ApiEnvelope<DeletedResponse>>

    @POST("notifications/read-all")
    suspend fun markAllRead(): Response<ApiEnvelope<ReadAllResponse>>
}
