package com.kothabarta.feature.messages.data

import com.kothabarta.core.network.messages.MessageDto
import com.kothabarta.core.security.E2eeKeyProvider
import com.kothabarta.core.security.WebE2eeDecryptor
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

sealed interface MessageDecryptionState {
    data object Pending : MessageDecryptionState
    data class Decrypted(val plaintext: String) : MessageDecryptionState
    data class Unavailable(val reason: Reason) : MessageDecryptionState

    enum class Reason {
        ACCOUNT_UNAVAILABLE,
        DEVICE_KEY_UNAVAILABLE,
        PLATFORM_UNSUPPORTED,
        NO_DEVICE_ENVELOPE,
        LEGACY_FORMAT_UNSUPPORTED,
        INVALID_SENDER_KEY,
        INVALID_ENVELOPE,
        AUTHENTICATION_FAILED,
    }
}

fun interface MessageDecrypting {
    suspend fun decrypt(message: MessageDto, accountId: String): MessageDecryptionState
}

class AndroidMessageDecryptor(
    private val keyManager: E2eeKeyProvider,
    private val crypto: WebE2eeDecryptor = WebE2eeDecryptor(),
) : MessageDecrypting {
    override suspend fun decrypt(message: MessageDto, accountId: String): MessageDecryptionState = withContext(Dispatchers.IO) {
        val deviceId = try {
            keyManager.deviceId()
        } catch (_: Exception) {
            return@withContext unavailable(MessageDecryptionState.Reason.DEVICE_KEY_UNAVAILABLE)
        }
        val payloads = message.encryptedPayloads.orEmpty()
        val addressed = payloads.filter { it.deviceId == deviceId }
        if (addressed.size > 1) return@withContext unavailable(MessageDecryptionState.Reason.INVALID_ENVELOPE)
        val payload = addressed.singleOrNull()
        if (payload == null) {
            val reason = if (payloads.isEmpty() && message.encryptedBody != null) {
                MessageDecryptionState.Reason.LEGACY_FORMAT_UNSUPPORTED
            } else {
                MessageDecryptionState.Reason.NO_DEVICE_ENVELOPE
            }
            return@withContext unavailable(reason)
        }
        val senderJwk = message.senderPublicKey
            ?: return@withContext unavailable(MessageDecryptionState.Reason.INVALID_SENDER_KEY)
        val privateKey = when (val key = keyManager.existingPrivateKey(accountId)) {
            is com.kothabarta.core.security.AndroidE2eeKeyManager.KeyLookup.Available -> key.key.private
            com.kothabarta.core.security.AndroidE2eeKeyManager.KeyLookup.UnsupportedPlatform ->
                return@withContext unavailable(MessageDecryptionState.Reason.PLATFORM_UNSUPPORTED)
            else -> return@withContext unavailable(MessageDecryptionState.Reason.DEVICE_KEY_UNAVAILABLE)
        }
        when (val result = crypto.decrypt(privateKey, senderJwk, payload.iv, payload.ciphertext)) {
            is WebE2eeDecryptor.DecryptionResult.Success -> MessageDecryptionState.Decrypted(result.plaintext)
            WebE2eeDecryptor.DecryptionResult.InvalidSenderKey -> unavailable(MessageDecryptionState.Reason.INVALID_SENDER_KEY)
            WebE2eeDecryptor.DecryptionResult.InvalidPayload -> unavailable(MessageDecryptionState.Reason.INVALID_ENVELOPE)
            WebE2eeDecryptor.DecryptionResult.AuthenticationFailed -> unavailable(MessageDecryptionState.Reason.AUTHENTICATION_FAILED)
        }
    }

    private fun unavailable(reason: MessageDecryptionState.Reason) = MessageDecryptionState.Unavailable(reason)
}

fun MessageDto.isEncryptedForDisplay(): Boolean =
    encrypted || encryptedPayloads?.isNotEmpty() == true || encryptedBody != null || senderPublicKey != null
