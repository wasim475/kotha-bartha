package com.kothabarta.core.security

import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyAgreement
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import org.junit.Assert.assertEquals
import org.junit.Test

class WebE2eeDecryptorTest {
    private val decryptor = WebE2eeDecryptor()

    @Test fun `decrypts Web-compatible AES-GCM payload including empty plaintext`() {
        val (recipient, sender, iv, cipherText) = vector("")
        assertEquals(WebE2eeDecryptor.DecryptionResult.Success(""), decryptor.decrypt(recipient.private, sender.public as ECPublicKey, b64(iv), b64(cipherText)))
    }

    @Test fun `rejects a wrong private key`() {
        val (recipient, sender, iv, cipherText) = vector("synthetic message")
        val wrong = keyPair()
        assertEquals(WebE2eeDecryptor.DecryptionResult.AuthenticationFailed, decryptor.decrypt(wrong.private, sender.public as ECPublicKey, b64(iv), b64(cipherText)))
    }

    @Test fun `rejects modified ciphertext and IV`() {
        val (recipient, sender, iv, cipherText) = vector("synthetic message")
        val damagedCipherText = cipherText.copyOf().also { it[it.lastIndex] = (it.last().toInt() xor 1).toByte() }
        val damagedIv = iv.copyOf().also { it[0] = (it[0].toInt() xor 1).toByte() }
        assertEquals(WebE2eeDecryptor.DecryptionResult.AuthenticationFailed, decryptor.decrypt(recipient.private, sender.public as ECPublicKey, b64(iv), b64(damagedCipherText)))
        assertEquals(WebE2eeDecryptor.DecryptionResult.AuthenticationFailed, decryptor.decrypt(recipient.private, sender.public as ECPublicKey, b64(damagedIv), b64(cipherText)))
    }

    @Test fun `rejects malformed Base64 and invalid IV length`() {
        val (recipient, sender, iv, cipherText) = vector("synthetic")
        assertEquals(WebE2eeDecryptor.DecryptionResult.InvalidPayload, decryptor.decrypt(recipient.private, sender.public as ECPublicKey, "%%%", b64(cipherText)))
        assertEquals(WebE2eeDecryptor.DecryptionResult.InvalidPayload, decryptor.decrypt(recipient.private, sender.public as ECPublicKey, b64(iv.copyOf(11)), b64(cipherText)))
    }

    private data class TestVector(val recipient: KeyPair, val sender: KeyPair, val iv: ByteArray, val ciphertext: ByteArray)

    private fun vector(plaintext: String): TestVector {
        val recipient = keyPair()
        val sender = keyPair()
        val shared = KeyAgreement.getInstance("ECDH").run { init(sender.private); doPhase(recipient.public, true); generateSecret() }
        val iv = ByteArray(12) { it.toByte() }
        val ciphertext = Cipher.getInstance("AES/GCM/NoPadding").run {
            init(Cipher.ENCRYPT_MODE, SecretKeySpec(shared, "AES"), GCMParameterSpec(128, iv))
            doFinal(plaintext.toByteArray(Charsets.UTF_8))
        }
        return TestVector(recipient, sender, iv, ciphertext)
    }

    private fun keyPair(): KeyPair = KeyPairGenerator.getInstance("EC").run {
        initialize(ECGenParameterSpec("secp256r1"))
        generateKeyPair()
    }

    private fun b64(bytes: ByteArray) = Base64.getEncoder().encodeToString(bytes)
}
