package com.kothabarta.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import com.kothabarta.core.navigation.Routes

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

    @Test
    fun `message notifications use the existing chat destination and message argument`() {
        val conversationId = "0123456789abcdef01234567"
        val messageId = "1123456789abcdef01234567"
        val route = Routes.chat(conversationId, messageId = messageId)
        assertTrue(route.startsWith("messages/$conversationId?"))
        assertTrue(route.endsWith("messageId=$messageId"))
    }
}
