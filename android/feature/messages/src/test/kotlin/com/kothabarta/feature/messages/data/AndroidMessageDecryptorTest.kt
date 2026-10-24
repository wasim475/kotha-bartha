package com.kothabarta.feature.messages.data

import com.kothabarta.core.network.messages.EncryptedBodyDto
import com.kothabarta.core.network.messages.EncryptedPayloadDto
import com.kothabarta.core.network.messages.MessageDto
import com.kothabarta.core.security.AndroidE2eeKeyManager
import com.kothabarta.core.security.E2eeKeyProvider
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AndroidMessageDecryptorTest {
    @Test fun `does not select another device envelope or look up a key`() = runBlocking {
        val keys = FakeKeyProvider("android-this-device")
        val result = AndroidMessageDecryptor(keys).decrypt(encryptedMessage(), "account-a")
        assertEquals(MessageDecryptionState.Unavailable(MessageDecryptionState.Reason.NO_DEVICE_ENVELOPE), result)
        assertNull(keys.requestedAccount)
    }

    @Test fun `legacy body is reported unavailable without trying a different protocol`() = runBlocking {
        val result = AndroidMessageDecryptor(FakeKeyProvider("android-this-device"))
            .decrypt(encryptedMessage().copy(encryptedPayloads = null, encryptedBody = EncryptedBodyDto("cipher", "iv")), "account-a")
        assertEquals(MessageDecryptionState.Unavailable(MessageDecryptionState.Reason.LEGACY_FORMAT_UNSUPPORTED), result)
    }

    @Test fun `duplicate payloads for this device fail closed`() = runBlocking {
        val keys = FakeKeyProvider("android-this-device")
        val duplicate = EncryptedPayloadDto("android-this-device", "cipher-a", "iv-a")
        val result = AndroidMessageDecryptor(keys).decrypt(
            encryptedMessage().copy(encryptedPayloads = listOf(duplicate, duplicate)),
            "account-a",
        )
        assertEquals(MessageDecryptionState.Unavailable(MessageDecryptionState.Reason.INVALID_ENVELOPE), result)
        assertNull(keys.requestedAccount)
    }

    @Test fun `matching device uses only the authenticated account key namespace`() = runBlocking {
        val keys = FakeKeyProvider("android-this-device")
        val result = AndroidMessageDecryptor(keys).decrypt(
            encryptedMessage().copy(encryptedPayloads = listOf(EncryptedPayloadDto("android-this-device", "bad", "bad"))),
            "account-a",
        )
        assertEquals("account-a", keys.requestedAccount)
        assertEquals(MessageDecryptionState.Unavailable(MessageDecryptionState.Reason.DEVICE_KEY_UNAVAILABLE), result)
    }

    private fun encryptedMessage() = MessageDto(
        id = "synthetic", encrypted = true, body = "must-not-be-used", createdAt = "now", senderId = "sender",
        senderPublicKey = "{}", encryptedPayloads = listOf(EncryptedPayloadDto("other-device", "cipher", "iv")),
    )

    private class FakeKeyProvider(private val id: String) : E2eeKeyProvider {
        var requestedAccount: String? = null
        override fun deviceId() = id
        override fun existingPrivateKey(accountId: String): AndroidE2eeKeyManager.KeyLookup {
            requestedAccount = accountId
            return AndroidE2eeKeyManager.KeyLookup.Missing
        }
    }
}
