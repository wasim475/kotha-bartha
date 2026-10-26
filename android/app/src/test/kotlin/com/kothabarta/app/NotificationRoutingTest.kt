package com.kothabarta.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationRoutingTest {
    @Test
    fun `only Mongo conversation identifiers are accepted for notification routing`() {
        assertTrue(isValidConversationNotificationId("0123456789abcdef01234567"))
        assertTrue(isValidConversationNotificationId("ABCDEF0123456789ABCDEF01"))
        assertFalse(isValidConversationNotificationId(null))
        assertFalse(isValidConversationNotificationId(""))
        assertFalse(isValidConversationNotificationId("../messages/another-user"))
        assertFalse(isValidConversationNotificationId("conversation-id"))
    }
}
