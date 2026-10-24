package com.kothabarta.app.security

import android.os.Build
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.math.BigInteger
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.util.Base64
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.KeyAgreement
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidKeystoreEcdhFeasibilityTest {

    @Test
    fun testP256EcdhSharedSecretAndAliasPersistence() {
        requireApi31()
        val aliases = listOf(testAlias("alice"), testAlias("bob"))
        try {
            val alice = createKeystoreKeyPair(aliases[0])
            val bob = createKeystoreKeyPair(aliases[1])

            val aliceSecret = deriveSharedSecret(alice, bob.public)
            val bobSecret = deriveSharedSecret(bob, alice.public)
            assertTrue("P-256 ECDH secrets should match", MessageDigest.isEqual(aliceSecret, bobSecret))

            val reloadedAlice = retrieveKeystoreKeyPair(aliases[0])
            val reloadedBob = retrieveKeystoreKeyPair(aliases[1])
            assertTrue("Alice public key should persist by alias", alice.public.encoded.contentEquals(reloadedAlice.public.encoded))
            assertTrue("Bob public key should persist by alias", bob.public.encoded.contentEquals(reloadedBob.public.encoded))
            assertTrue(
                "Reloaded aliases should derive the same ECDH secret",
                MessageDigest.isEqual(
                    deriveSharedSecret(reloadedAlice, reloadedBob.public),
                    deriveSharedSecret(reloadedBob, reloadedAlice.public),
                ),
            )
        } finally {
            deleteAliases(aliases)
        }
    }

    @Test
    fun testAndroidKeystoreEcdhDecryptsNodeWebCryptoCiphertext() {
        requireApi31()
        val recipientAlias = testAlias("webcrypto-recipient")
        val wrongAlias = testAlias("webcrypto-wrong-key")
        try {
            val recipient = createKeystoreKeyPair(recipientAlias)
            val wrongRecipient = createKeystoreKeyPair(wrongAlias)
            val vector = requestNodeWebCryptoVector(recipient.public as ECPublicKey)
            val senderPublicKey = importP256PublicJwk(
                JSONObject(vector.getString("senderPublicKey")),
                (recipient.public as ECPublicKey).params,
            )
            val androidSharedSecret = deriveSharedSecret(recipient, senderPublicKey)
            val webCryptoSharedSecret = Base64.getDecoder().decode(vector.getString("sharedSecret"))

            assertTrue(
                "Android Keystore ECDH secret should match Node Web Crypto deriveBits",
                MessageDigest.isEqual(androidSharedSecret, webCryptoSharedSecret),
            )
            val iv = Base64.getDecoder().decode(vector.getString("iv"))
            val ciphertext = Base64.getDecoder().decode(vector.getString("ciphertext"))
            assertEquals("Web Crypto message IV should be 12 bytes", 12, iv.size)
            assertEquals(
                "Web Crypto AES-GCM output should append a 128-bit tag",
                ECDH_VECTOR_PLAINTEXT.toByteArray(Charsets.UTF_8).size + 16,
                ciphertext.size,
            )
            assertEquals(
                ECDH_VECTOR_PLAINTEXT,
                decryptEcdhAesGcm(androidSharedSecret, iv, ciphertext),
            )

            val wrongSecret = deriveSharedSecret(wrongRecipient, senderPublicKey)
            assertAesGcmRejected(wrongSecret, iv, ciphertext)

            val tamperedCiphertext = ciphertext.copyOf().also {
                it[it.lastIndex] = (it.last().toInt() xor 1).toByte()
            }
            assertAesGcmRejected(androidSharedSecret, iv, tamperedCiphertext)
        } finally {
            deleteAliases(listOf(recipientAlias, wrongAlias))
        }
    }

    @Test
    fun testDecryptsSyntheticWebCryptoAesGcmVector() {
        requireApi31()
        val plaintext = decryptVector(VECTOR_CIPHERTEXT)
        assertEquals(VECTOR_PLAINTEXT, plaintext)
    }

    @Test
    fun testRejectsTamperedSyntheticWebCryptoAesGcmVector() {
        requireApi31()
        val tampered = VECTOR_CIPHERTEXT.copyOf().also { it[it.lastIndex] = (it.last().toInt() xor 1).toByte() }
        try {
            decryptVector(tampered)
            fail("Tampered AES-GCM ciphertext must be rejected")
        } catch (_: AEADBadTagException) {
            // Authentication failure is the expected outcome; do not expose vector data.
        }
    }

    private fun requireApi31() {
        assertTrue("This feasibility test requires API 31+", Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
    }

    private fun createKeystoreKeyPair(alias: String): KeyPair {
        val generator = KeyPairGenerator.getInstance("EC", ANDROID_KEYSTORE)
        generator.initialize(
            android.security.keystore.KeyGenParameterSpec.Builder(
                alias,
                android.security.keystore.KeyProperties.PURPOSE_AGREE_KEY,
            ).setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1")).build(),
        )
        return generator.generateKeyPair()
    }

    private fun retrieveKeystoreKeyPair(alias: String): KeyPair {
        val keyStore = loadKeyStore()
        val privateKey = keyStore.getKey(alias, null) as java.security.PrivateKey
        val publicKey = keyStore.getCertificate(alias).publicKey
        return KeyPair(publicKey, privateKey)
    }

    private fun deriveSharedSecret(localKeyPair: KeyPair, remotePublicKey: java.security.PublicKey): ByteArray {
        return KeyAgreement.getInstance("ECDH").run {
            init(localKeyPair.private)
            doPhase(remotePublicKey, true)
            generateSecret()
        }
    }

    private fun requestNodeWebCryptoVector(recipientPublicKey: ECPublicKey): JSONObject {
        val publicJwk = JSONObject()
            .put("key_ops", org.json.JSONArray())
            .put("ext", true)
            .put("kty", "EC")
            .put("x", Base64.getUrlEncoder().withoutPadding().encodeToString(fixedWidth(recipientPublicKey.w.affineX, 32)))
            .put("y", Base64.getUrlEncoder().withoutPadding().encodeToString(fixedWidth(recipientPublicKey.w.affineY, 32)))
            .put("crv", "P-256")
        val connection = URL(NODE_VECTOR_ENDPOINT).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 5_000
            connection.readTimeout = 10_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.outputStream.use { it.write(publicJwk.toString().toByteArray(Charsets.UTF_8)) }
            assertEquals("Node Web Crypto vector service should respond successfully", 200, connection.responseCode)
            return JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
        } finally {
            connection.disconnect()
        }
    }

    private fun importP256PublicJwk(jwk: JSONObject, params: java.security.spec.ECParameterSpec): java.security.PublicKey {
        assertEquals("EC", jwk.getString("kty"))
        assertEquals("P-256", jwk.getString("crv"))
        val point = java.security.spec.ECPoint(
            BigInteger(1, Base64.getUrlDecoder().decode(jwk.getString("x"))),
            BigInteger(1, Base64.getUrlDecoder().decode(jwk.getString("y"))),
        )
        return java.security.KeyFactory.getInstance("EC")
            .generatePublic(java.security.spec.ECPublicKeySpec(point, params))
    }

    private fun fixedWidth(value: BigInteger, width: Int): ByteArray {
        val encoded = value.toByteArray()
        val unsigned = if (encoded.size == width + 1 && encoded[0] == 0.toByte()) encoded.copyOfRange(1, encoded.size) else encoded
        require(unsigned.size <= width) { "P-256 coordinate exceeds expected width" }
        return ByteArray(width - unsigned.size) + unsigned
    }

    private fun decryptEcdhAesGcm(sharedSecret: ByteArray, iv: ByteArray, ciphertext: ByteArray): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(sharedSecret, "AES"), GCMParameterSpec(128, iv))
        return cipher.doFinal(ciphertext).toString(Charsets.UTF_8)
    }

    private fun assertAesGcmRejected(sharedSecret: ByteArray, iv: ByteArray, ciphertext: ByteArray) {
        try {
            decryptEcdhAesGcm(sharedSecret, iv, ciphertext)
            fail("Invalid AES-GCM input must be rejected")
        } catch (_: AEADBadTagException) {
            // Expected authentication failure; no cryptographic material is logged.
        }
    }

    private fun decryptVector(ciphertext: ByteArray): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.DECRYPT_MODE,
            SecretKeySpec(VECTOR_AES_KEY, "AES"),
            GCMParameterSpec(128, VECTOR_IV),
        )
        return cipher.doFinal(ciphertext).toString(Charsets.UTF_8)
    }

    private fun loadKeyStore(): KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }

    private fun deleteAliases(aliases: List<String>) {
        val keyStore = loadKeyStore()
        aliases.forEach { if (keyStore.containsAlias(it)) keyStore.deleteEntry(it) }
    }

    private fun testAlias(name: String) = "kb-keystore-feasibility-$name-${System.currentTimeMillis()}"

    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val VECTOR_PLAINTEXT = "Kotha-Barta WebCrypto AES-GCM test vector"
        private const val ECDH_VECTOR_PLAINTEXT = "Kotha-Barta WebCrypto ECDH interoperability vector"
        private const val NODE_VECTOR_ENDPOINT = "http://127.0.0.1:39771/vector"
        // AES-GCM-256, 12-byte IV, 128-bit tag; generated with Node Web Crypto.
        private val VECTOR_AES_KEY = decodeBase64("AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=")
        private val VECTOR_IV = decodeBase64("AAECAwQFBgcICQoL")
        private val VECTOR_CIPHERTEXT = decodeBase64(
            "DG2ic6TIgHr/Nfar5owaLvGv90CfWx45a0qixlBJdNdyZI6KyqJm9wYifSngkfL1w4EycoDd8JYI",
        )

        private fun decodeBase64(value: String): ByteArray =
            java.util.Base64.getDecoder().decode(value)
    }
}
