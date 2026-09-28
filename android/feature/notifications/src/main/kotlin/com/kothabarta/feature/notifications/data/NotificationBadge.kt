package com.kothabarta.feature.notifications.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * A single shared unread-count so `:app`'s bottom-nav badge can show it
 * without depending on `NotificationsViewModel` directly (a Composable that
 * never opens the Notifications screen still needs to render the number).
 */
class NotificationBadge {
    private val _unreadCount = MutableStateFlow(0)
    val unreadCount: StateFlow<Int> = _unreadCount.asStateFlow()

    fun update(count: Int) {
        _unreadCount.value = count
    }
}
