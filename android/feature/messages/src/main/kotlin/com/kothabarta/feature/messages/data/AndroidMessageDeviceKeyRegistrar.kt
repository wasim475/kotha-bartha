package com.kothabarta.feature.messages.data

import com.kothabarta.core.network.social.DevicePublicKeyRegistrationRequest
import com.kothabarta.core.network.social.UsersApi
import com.kothabarta.core.security.AndroidE2eeKeyManager
import java.math.BigInteger
import java.security.interfaces.ECPublicKey
import java.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

fun interface MessageDeviceKeyRegistrar {
    suspend fun registerForAccount(accountId: String): Boolean
}

/** Publishes the existing Web-compatible P-256 key for this authenticated account. */
class AndroidMessageDeviceKeyRegistrar(
    private val keyManager: AndroidE2eeKeyManager,
    private val usersApi: UsersApi,
) : MessageDeviceKeyRegistrar {
    override suspend fun registerForAccount(accountId: String): Boolean = withContext(Dispatchers.IO) {
        val publicKey = when (val provision = keyManager.provisionForAccount(accountId)) {
            is AndroidE2eeKeyManager.KeyProvisionResult.Created -> provision.publicKey
            is AndroidE2eeKeyManager.KeyProvisionResult.Existing -> provision.key.public as? ECPublicKey
            else -> null
        } ?: return@withContext false

        try {
            val response = usersApi.registerDevicePublicKey(
                DevicePublicKeyRegistrationRequest(
                    deviceId = keyManager.deviceId(),
                    publicKey = publicKey.toWebCryptoJwk(),
                ),
            )
            response.isSuccessful
        } catch (_: Exception) {
            false
        }
    }
}

internal fun ECPublicKey.toWebCryptoJwk(): String {
    val x = Base64.getUrlEncoder().withoutPadding().encodeToString(unsignedCoordinate(w.affineX))
    val y = Base64.getUrlEncoder().withoutPadding().encodeToString(unsignedCoordinate(w.affineY))
    return "{\"kty\":\"EC\",\"crv\":\"P-256\",\"x\":\"$x\",\"y\":\"$y\",\"ext\":true,\"key_ops\":[]}"
}

private fun unsignedCoordinate(value: BigInteger): ByteArray {
    val encoded = value.toByteArray().let { bytes ->
        if (bytes.size > P256_COORDINATE_BYTES && bytes[0] == 0.toByte()) bytes.copyOfRange(1, bytes.size) else bytes
    }
    require(encoded.size <= P256_COORDINATE_BYTES) { "Invalid P-256 coordinate" }
    return ByteArray(P256_COORDINATE_BYTES - encoded.size) + encoded
}

private const val P256_COORDINATE_BYTES = 32
