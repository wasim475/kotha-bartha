package com.kothabarta.feature.messages.data

import java.security.KeyPairGenerator
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.util.Base64
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AndroidMessageDeviceKeyRegistrarTest {
    @Test
    fun `exports P-256 public coordinates in Web Crypto JWK format`() {
        val publicKey = KeyPairGenerator.getInstance("EC").run {
            initialize(ECGenParameterSpec("secp256r1"))
            generateKeyPair().public as ECPublicKey
        }

        val jwk = publicKey.toWebCryptoJwk()
        val match = JWK_PATTERN.matchEntire(jwk)

        assertNotNull(match)
        assertTrue(jwk.contains("\"kty\":\"EC\""))
        assertTrue(jwk.contains("\"crv\":\"P-256\""))
        assertTrue(jwk.contains("\"ext\":true"))
        assertTrue(jwk.contains("\"key_ops\":[]"))
        assertArrayEquals(unsigned32(publicKey.w.affineX.toByteArray()), Base64.getUrlDecoder().decode(match!!.groupValues[1]))
        assertArrayEquals(unsigned32(publicKey.w.affineY.toByteArray()), Base64.getUrlDecoder().decode(match.groupValues[2]))
    }

    private fun unsigned32(value: ByteArray): ByteArray {
        val bytes = if (value.size == 33 && value[0] == 0.toByte()) value.copyOfRange(1, value.size) else value
        return ByteArray(32 - bytes.size) + bytes
    }

    private companion object {
        val JWK_PATTERN = Regex("""\{"kty":"EC","crv":"P-256","x":"([A-Za-z0-9_-]{43})","y":"([A-Za-z0-9_-]{43})","ext":true,"key_ops":\[\]\}""")
    }
}
