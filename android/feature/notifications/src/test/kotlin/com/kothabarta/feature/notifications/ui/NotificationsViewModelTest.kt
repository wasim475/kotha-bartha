package com.kothabarta.feature.notifications.ui

import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.social.DeletedResponse
import com.kothabarta.core.network.social.MarkReadResponse
import com.kothabarta.core.network.social.NotificationDto
import com.kothabarta.core.network.social.NotificationsApi
import com.kothabarta.core.network.social.ReadAllResponse
import com.kothabarta.core.network.social.UnreadCountsDto
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.notifications.data.NotificationBadge
import com.kothabarta.feature.notifications.data.NotificationsRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class NotificationsViewModelTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun n(id: String, read: Boolean = false, postId: String? = null, type: String = "post_like") =
        NotificationDto(id = id, type = type, read = read, createdAt = "now", postId = postId)

    @Test
    fun `repeated loads never duplicate rows — the list is always a full replacement`() = runTest {
        val api = FakeNotificationsApi(mutableListOf(n("a"), n("b")))
        val viewModel = NotificationsViewModel(NotificationsRepository(api), NotificationBadge(), SocketManager("http://localhost"))
        advanceUntilIdle()
        viewModel.retry()
        advanceUntilIdle()
        viewModel.retry()
        advanceUntilIdle()

        val ids = viewModel.uiState.value.notifications.map { it.id }
        assertEquals(listOf("a", "b"), ids)
        assertEquals(ids.size, ids.toSet().size)
    }

    @Test
    fun `the unread badge reflects only the server's own read flag`() = runTest {
        val api = FakeNotificationsApi(mutableListOf(n("a", read = false), n("b", read = true), n("c", read = false)))
        val badge = NotificationBadge()
        NotificationsViewModel(NotificationsRepository(api), badge, SocketManager("http://localhost"))
        advanceUntilIdle()

        assertEquals(2, badge.unreadCount.value)
    }

    @Test
    fun `opening an unread notification marks it read locally and on the server, and the badge drops`() = runTest {
        val api = FakeNotificationsApi(mutableListOf(n("a", read = false, postId = "p1")))
        val badge = NotificationBadge()
        val viewModel = NotificationsViewModel(NotificationsRepository(api), badge, SocketManager("http://localhost"))
        advanceUntilIdle()

        viewModel.open(viewModel.uiState.value.notifications.first())
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value.notifications.first().read)
        assertEquals("a", api.lastMarkedReadId)
        assertEquals(0, badge.unreadCount.value)
    }

    @Test
    fun `opening a post notification navigates to that post`() = runTest {
        val api = FakeNotificationsApi(mutableListOf(n("a", postId = "p42")))
        val viewModel = NotificationsViewModel(NotificationsRepository(api), NotificationBadge(), SocketManager("http://localhost"))
        advanceUntilIdle()

        var event: NavigationEvent? = null
        val job = launch { viewModel.navigationEvents.collect { event = it } }
        viewModel.open(viewModel.uiState.value.notifications.first())
        advanceUntilIdle()
        job.cancel()

        assertEquals(NavigationEvent.NavigateTo(Routes.post("p42")), event)
    }

    @Test
    fun `opening a friend-request notification navigates to Friends, using the type fallback not postId`() = runTest {
        val api = FakeNotificationsApi(mutableListOf(n("a", type = "friend_request")))
        val viewModel = NotificationsViewModel(NotificationsRepository(api), NotificationBadge(), SocketManager("http://localhost"))
        advanceUntilIdle()

        var event: NavigationEvent? = null
        val job = launch { viewModel.navigationEvents.collect { event = it } }
        viewModel.open(viewModel.uiState.value.notifications.first())
        advanceUntilIdle()
        job.cancel()

        assertEquals(NavigationEvent.NavigateTo(Routes.FRIENDS), event)
    }

    @Test
    fun `a notification type Android doesn't recognize yet navigates nowhere rather than crashing`() = runTest {
        val api = FakeNotificationsApi(mutableListOf(n("a", type = "ludo_invite")))
        val viewModel = NotificationsViewModel(NotificationsRepository(api), NotificationBadge(), SocketManager("http://localhost"))
        advanceUntilIdle()

        var event: NavigationEvent? = null
        val job = launch { viewModel.navigationEvents.collect { event = it } }
        viewModel.open(viewModel.uiState.value.notifications.first())
        advanceUntilIdle()
        job.cancel()

        assertNull(event)
    }

    private class FakeNotificationsApi(private val notifications: MutableList<NotificationDto>) : NotificationsApi {
        var lastMarkedReadId: String? = null

        override suspend fun getUnreadCounts(): Response<ApiEnvelope<UnreadCountsDto>> =
            Response.success(ApiEnvelope(data = UnreadCountsDto(notifications = notifications.count { !it.read })))

        override suspend fun getNotifications(): Response<ApiEnvelope<List<NotificationDto>>> =
            Response.success(ApiEnvelope(data = notifications.toList()))

        override suspend fun markRead(notificationId: String): Response<ApiEnvelope<MarkReadResponse>> {
            lastMarkedReadId = notificationId
            val index = notifications.indexOfFirst { it.id == notificationId }
            if (index >= 0) notifications[index] = notifications[index].copy(read = true)
            return Response.success(ApiEnvelope(data = MarkReadResponse(notificationId, true)))
        }

        override suspend fun deleteNotification(notificationId: String): Response<ApiEnvelope<DeletedResponse>> =
            Response.success(ApiEnvelope(data = DeletedResponse(notificationId, true)))

        override suspend fun markAllRead(): Response<ApiEnvelope<ReadAllResponse>> {
            for (i in notifications.indices) notifications[i] = notifications[i].copy(read = true)
            return Response.success(ApiEnvelope(data = ReadAllResponse(true)))
        }
    }
}
