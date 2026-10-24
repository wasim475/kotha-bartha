package com.kothabarta.core.network.messages

import com.kothabarta.core.network.NetworkJson
import com.kothabarta.core.network.decodeSocketPayload
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class MessageEncryptedPayloadDtoTest {

    @Test
    fun restShapePreservesCurrentPerDeviceEncryptedFields() {
        val adapter = NetworkJson.moshi.adapter(MessageDto::class.java)
        val message = adapter.fromJson(MULTI_DEVICE_MESSAGE)

        assertNotNull(message)
        assertEquals(true, message?.encrypted)
        assertEquals(PLACEHOLDER, message?.body)
        assertEquals("{\"kty\":\"EC\",\"crv\":\"P-256\"}", message?.senderPublicKey)
        assertNull(message?.encryptedBody)
        assertEquals(
            listOf(EncryptedPayloadDto(deviceId = "test-device", ciphertext = "synthetic-ciphertext", iv = "synthetic-iv")),
            message?.encryptedPayloads,
        )
        assertEquals(message, message?.let { adapter.fromJson(adapter.toJson(it)) })
    }

    @Test
    fun socketShapeDecodesIdenticallyToRestShape() {
        val rest = NetworkJson.moshi.adapter(MessageDto::class.java).fromJson(MULTI_DEVICE_MESSAGE)
        val socket = MULTI_DEVICE_MESSAGE.decodeSocketPayload<MessageDto>()

        assertEquals(rest, socket)
    }

    @Test
    fun legacyEncryptedBodyRemainsDistinctFromPerDevicePayloads() {
        val legacy = NetworkJson.moshi.adapter(MessageDto::class.java).fromJson(LEGACY_MESSAGE)

        assertEquals(true, legacy?.encrypted)
        assertEquals(EncryptedBodyDto(ciphertext = "legacy-ciphertext", iv = "legacy-iv"), legacy?.encryptedBody)
        assertNull(legacy?.encryptedPayloads)
        assertNull(legacy?.senderPublicKey)
    }

    @Test
    fun plaintextMessagesKeepOptionalEncryptedFieldsAbsent() {
        val plaintext = NetworkJson.moshi.adapter(MessageDto::class.java).fromJson(PLAINTEXT_MESSAGE)

        assertEquals(false, plaintext?.encrypted)
        assertEquals("plain synthetic text", plaintext?.body)
        assertNull(plaintext?.encryptedBody)
        assertNull(plaintext?.encryptedPayloads)
        assertNull(plaintext?.senderPublicKey)
    }

    private companion object {
        const val PLACEHOLDER = "🔒 Encrypted message"
        const val MULTI_DEVICE_MESSAGE = """
            {"id":"message-1","conversationId":"conversation-1","encrypted":true,
             "body":"🔒 Encrypted message","encryptedBody":null,
             "encryptedPayloads":[{"deviceId":"test-device","ciphertext":"synthetic-ciphertext","iv":"synthetic-iv"}],
             "senderPublicKey":"{\"kty\":\"EC\",\"crv\":\"P-256\"}",
             "createdAt":"2026-10-24T00:00:00.000Z","senderId":"sender-1"}
        """
        const val LEGACY_MESSAGE = """
            {"id":"message-legacy","encrypted":true,"body":"🔒 Encrypted message",
             "encryptedBody":{"ciphertext":"legacy-ciphertext","iv":"legacy-iv"},
             "createdAt":"2026-10-24T00:00:00.000Z","senderId":"sender-1"}
        """
        const val PLAINTEXT_MESSAGE = """
            {"id":"message-plain","encrypted":false,"body":"plain synthetic text",
             "createdAt":"2026-10-24T00:00:00.000Z","senderId":"sender-1"}
        """
    }
}
