package com.kothabarta.feature.notifications.data

import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.common.map
import com.kothabarta.core.network.safeApiCall
import com.kothabarta.core.network.social.DeletedResponse
import com.kothabarta.core.network.social.MarkReadResponse
import com.kothabarta.core.network.social.NotificationDto
import com.kothabarta.core.network.social.NotificationsApi
import com.kothabarta.core.network.social.UnreadCountsDto

class NotificationsRepository(private val notificationsApi: NotificationsApi) {

    suspend fun getNotifications(): ApiResult<List<NotificationDto>> = safeApiCall { notificationsApi.getNotifications() }

    suspend fun getUnreadCounts(): ApiResult<UnreadCountsDto> = safeApiCall { notificationsApi.getUnreadCounts() }

    suspend fun markRead(notificationId: String): ApiResult<MarkReadResponse> =
        safeApiCall { notificationsApi.markRead(notificationId) }

    suspend fun markAllRead(): ApiResult<Unit> = safeApiCall { notificationsApi.markAllRead() }.map { }

    suspend fun deleteNotification(notificationId: String): ApiResult<DeletedResponse> =
        safeApiCall { notificationsApi.deleteNotification(notificationId) }
}
