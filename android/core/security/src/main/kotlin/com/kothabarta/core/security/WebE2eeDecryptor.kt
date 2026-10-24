package com.kothabarta.core.security

import java.math.BigInteger
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.security.KeyFactory
import java.security.PrivateKey
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECParameterSpec
import java.security.spec.ECPublicKeySpec
import java.util.Base64
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.KeyAgreement
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import org.json.JSONObject

/** Implements the current Web protocol: raw P-256 ECDH output is the AES-256-GCM key. */
class WebE2eeDecryptor {
    fun decrypt(privateKey: PrivateKey, senderPublicKeyJwk: String, ivBase64: String, ciphertextBase64: String): DecryptionResult {
        val senderKey = try {
            importP256PublicJwk(senderPublicKeyJwk, parametersFrom(privateKey))
        } catch (_: Exception) {
            return DecryptionResult.InvalidSenderKey
        }
        return decrypt(privateKey, senderKey, ivBase64, ciphertextBase64)
    }

    fun decrypt(privateKey: PrivateKey, senderPublicKey: ECPublicKey, ivBase64: String, ciphertextBase64: String): DecryptionResult {
        val iv = decodeBase64(ivBase64) ?: return DecryptionResult.InvalidPayload
        val ciphertext = decodeBase64(ciphertextBase64) ?: return DecryptionResult.InvalidPayload
        if (iv.size != GCM_IV_BYTES || ciphertext.size < GCM_TAG_BYTES) return DecryptionResult.InvalidPayload

        return try {
            val sharedSecret = KeyAgreement.getInstance("ECDH").run {
                init(privateKey)
                doPhase(senderPublicKey, true)
                generateSecret()
            }
            if (sharedSecret.size != AES_256_BYTES) return DecryptionResult.InvalidSenderKey
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(sharedSecret, "AES"), GCMParameterSpec(GCM_TAG_BITS, iv))
            val clear = cipher.doFinal(ciphertext)
            val text = Charsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(clear))
                .toString()
            DecryptionResult.Success(text)
        } catch (_: AEADBadTagException) {
            DecryptionResult.AuthenticationFailed
        } catch (_: Exception) {
            DecryptionResult.AuthenticationFailed
        }
    }

    fun importP256PublicJwk(jwkJson: String, parameters: ECParameterSpec): ECPublicKey {
        val jwk = JSONObject(jwkJson)
        require(jwk.optString("kty") == "EC" && jwk.optString("crv") == "P-256")
        val x = decodeBase64UrlCoordinate(jwk.getString("x"))
        val y = decodeBase64UrlCoordinate(jwk.getString("y"))
        require(x.size == P256_COORDINATE_BYTES && y.size == P256_COORDINATE_BYTES)
        val point = java.security.spec.ECPoint(BigInteger(1, x), BigInteger(1, y))
        return KeyFactory.getInstance("EC").generatePublic(ECPublicKeySpec(point, parameters)) as ECPublicKey
    }

    private fun parametersFrom(privateKey: PrivateKey): ECParameterSpec {
        val params = (privateKey as? java.security.interfaces.ECKey)?.params
        if (params != null) return params
        val algorithmParameters = java.security.AlgorithmParameters.getInstance("EC")
        algorithmParameters.init(ECGenParameterSpec("secp256r1"))
        return algorithmParameters.getParameterSpec(ECParameterSpec::class.java)
    }

    private fun decodeBase64(value: String): ByteArray? {
        if (value.isEmpty() || !BASE64_PATTERN.matches(value)) return null
        return try { Base64.getDecoder().decode(value) } catch (_: IllegalArgumentException) { null }
    }

    private fun decodeBase64UrlCoordinate(value: String): ByteArray {
        require(value.isNotEmpty() && BASE64_URL_PATTERN.matches(value))
        return Base64.getUrlDecoder().decode(value)
    }

    sealed interface DecryptionResult {
        data class Success(val plaintext: String) : DecryptionResult
        data object InvalidSenderKey : DecryptionResult
        data object InvalidPayload : DecryptionResult
        data object AuthenticationFailed : DecryptionResult
    }

    private companion object {
        const val GCM_IV_BYTES = 12
        const val GCM_TAG_BITS = 128
        const val GCM_TAG_BYTES = 16
        const val AES_256_BYTES = 32
        const val P256_COORDINATE_BYTES = 32
        val BASE64_PATTERN = Regex("(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?")
        val BASE64_URL_PATTERN = Regex("[A-Za-z0-9_-]+={0,2}")
    }
}
