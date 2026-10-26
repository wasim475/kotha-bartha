package com.kothabarta.app

import com.kothabarta.core.datastore.MessageNotificationPrivacy
import com.kothabarta.core.network.messages.ConversationHeaderDto
import com.kothabarta.core.network.messages.MessageDto
import com.kothabarta.core.network.messages.MessageSenderDto
import com.kothabarta.feature.messages.data.MessageDecrypting
import com.kothabarta.feature.messages.data.MessageDecryptionState
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GroupedMessageNotificationsTest {
    private val conversationId = "0123456789abcdef01234567"

    @Test
    fun `three message pushes update one conversation count and duplicate is ignored`() {
        var state = MessageNotificationCounterState()
        state = recordNotificationMessage(state, "one")
        state = recordNotificationMessage(state, "two")
        state = recordNotificationMessage(state, "three")
        assertEquals(3, state.count)
        assertEquals(state, recordNotificationMessage(state, "three"))
    }

    @Test
    fun `conversation ids produce stable distinct notification ids and group keys`() {
        val other = "1123456789abcdef01234567"
        assertEquals(PushNotificationState.conversationNotificationId(conversationId), PushNotificationState.conversationNotificationId(conversationId))
        assertTrue(PushNotificationState.conversationNotificationId(conversationId) != PushNotificationState.conversationNotificationId(other))
        assertTrue(PushNotificationState.conversationGroupKey(conversationId) != PushNotificationState.conversationGroupKey(other))
    }

    @Test
    fun `active foreground conversation suppresses its push only`() {
        assertTrue(shouldSuppressMessageNotification(true, conversationId, conversationId))
        assertFalse(shouldSuppressMessageNotification(true, conversationId, "1123456789abcdef01234567"))
        assertFalse(shouldSuppressMessageNotification(false, conversationId, conversationId))
    }

    @Test
    fun `preview privacy controls source and local decryption`() = runBlocking {
        var sourceCalls = 0
        var decryptCalls = 0
        val encryptedMessage = MessageDto(
            id = "2123456789abcdef01234567",
            encrypted = true,
            body = "ciphertext-must-not-appear",
            createdAt = "2026-01-01T00:00:00Z",
            senderId = "sender",
            sender = MessageSenderDto("sender", "Alice"),
        )
        val source = PushMessageDataSource { _, _ ->
            sourceCalls++
            PushMessageContext("account", encryptedMessage, ConversationHeaderDto(conversationId))
        }
        val decryptor = MessageDecrypting { _, _ ->
            decryptCalls++
            MessageDecryptionState.Unavailable(MessageDecryptionState.Reason.NO_DEVICE_ENVELOPE)
        }
        val resolver = MessageNotificationPreviewResolver(source, decryptor)

        val hidden = resolver.resolve(conversationId, encryptedMessage.id, MessageNotificationPrivacy.HIDE_NOTIFICATION_CONTENT)
        assertEquals("New message", hidden.body)
        assertEquals(0, sourceCalls)

        val senderOnly = resolver.resolve(conversationId, encryptedMessage.id, MessageNotificationPrivacy.SHOW_SENDER_ONLY)
        assertEquals("Alice", senderOnly.title)
        assertEquals("New message", senderOnly.body)
        assertEquals(0, decryptCalls)

        val preview = resolver.resolve(conversationId, encryptedMessage.id, MessageNotificationPrivacy.SHOW_SENDER_AND_PREVIEW)
        assertFalse(preview.body.contains("ciphertext"))
        assertEquals("New message", preview.body)
        assertEquals(1, decryptCalls)
    }

    @Test
    fun `group preview includes trusted group and sender metadata`() = runBlocking {
        val message = MessageDto(
            id = "2123456789abcdef01234567",
            body = "hello group",
            createdAt = "2026-01-01T00:00:00Z",
            senderId = "sender",
            sender = MessageSenderDto("sender", "Alice"),
        )
        val source = PushMessageDataSource { _, _ ->
            PushMessageContext("account", message, ConversationHeaderDto(conversationId, isGroup = true, group = com.kothabarta.core.network.messages.GroupHeaderDto(conversationId, "Friends")))
        }
        val resolver = MessageNotificationPreviewResolver(source, MessageDecrypting { _, _ -> MessageDecryptionState.Pending })
        val content = resolver.resolve(conversationId, message.id, MessageNotificationPrivacy.SHOW_SENDER_AND_PREVIEW)
        assertEquals("Friends", content.title)
        assertEquals("Alice: hello group", content.body)
    }

    @Test
    fun `encrypted message preview uses only locally decrypted plaintext`() = runBlocking {
        val message = MessageDto(
            id = "2123456789abcdef01234567",
            encrypted = true,
            body = "server ciphertext placeholder",
            createdAt = "2026-01-01T00:00:00Z",
            senderId = "sender",
            sender = MessageSenderDto("sender", "Alice"),
        )
        val source = PushMessageDataSource { _, _ ->
            PushMessageContext("account", message, ConversationHeaderDto(conversationId))
        }
        val resolver = MessageNotificationPreviewResolver(
            source,
            MessageDecrypting { _, accountId ->
                assertEquals("account", accountId)
                MessageDecryptionState.Decrypted("locally decrypted text")
            },
        )
        val content = resolver.resolve(conversationId, message.id, MessageNotificationPrivacy.SHOW_SENDER_AND_PREVIEW)
        assertEquals("locally decrypted text", content.body)
        assertFalse(content.body.contains("ciphertext"))
    }
}
