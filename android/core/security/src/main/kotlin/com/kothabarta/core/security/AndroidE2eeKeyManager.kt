package com.kothabarta.core.security

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.AlgorithmParameters
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.util.UUID

/** Account-isolated Android Keystore ECDH keys. Keys are never exported. */
interface E2eeKeyProvider {
    fun deviceId(): String
    fun existingPrivateKey(accountId: String): AndroidE2eeKeyManager.KeyLookup
}

class AndroidE2eeKeyManager(context: Context) : E2eeKeyProvider {
    private val appContext = context.applicationContext

    override fun deviceId(): String = synchronized(lock) {
        val prefs = securePreferences()
        prefs.getString(DEVICE_ID_KEY, null) ?: UUID.randomUUID().toString().also {
            check(prefs.edit().putString(DEVICE_ID_KEY, it).commit()) { "Could not persist device identity" }
        }
    }

    /** Read-only lookup: a missing key is never silently regenerated during decryption. */
    override fun existingPrivateKey(accountId: String): KeyLookup {
        if (accountId.isBlank()) return KeyLookup.InvalidAccount
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return KeyLookup.UnsupportedPlatform
        return synchronized(lock) {
            try {
                val keyStore = androidKeyStore()
                val alias = aliasFor(accountId)
                if (!keyStore.containsAlias(alias)) return@synchronized KeyLookup.Missing
                val privateKey = keyStore.getKey(alias, null) as? PrivateKey ?: return@synchronized KeyLookup.Invalid
                val publicKey = keyStore.getCertificate(alias)?.publicKey as? ECPublicKey ?: return@synchronized KeyLookup.Invalid
                if (!isP256(publicKey)) return@synchronized KeyLookup.Invalid
                KeyLookup.Available(KeyPair(publicKey, privateKey))
            } catch (_: Exception) {
                KeyLookup.Invalid
            }
        }
    }

    /** Explicit first-time provisioning. Existing or lost aliases are never replaced. */
    fun provisionForAccount(accountId: String): KeyProvisionResult {
        if (accountId.isBlank()) return KeyProvisionResult.InvalidAccount
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return KeyProvisionResult.UnsupportedPlatform
        return synchronized(lock) {
            try {
                val prefs = securePreferences()
                val alias = aliasFor(accountId)
                val keyStore = androidKeyStore()
                if (keyStore.containsAlias(alias)) {
                    val found = existingPrivateKey(accountId)
                    return@synchronized if (found is KeyLookup.Available) KeyProvisionResult.Existing(found.key) else KeyProvisionResult.Invalid
                }
                if (prefs.getBoolean(provisionedKey(accountId), false)) return@synchronized KeyProvisionResult.MissingPreviouslyProvisionedKey

                val generator = KeyPairGenerator.getInstance("EC", ANDROID_KEYSTORE)
                generator.initialize(
                    KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_AGREE_KEY)
                        .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                        .build(),
                )
                val keyPair = generator.generateKeyPair()
                check(prefs.edit().putBoolean(provisionedKey(accountId), true).commit()) {
                    "Could not persist E2EE key metadata"
                }
                KeyProvisionResult.Created(keyPair.public as ECPublicKey)
            } catch (_: Exception) {
                KeyProvisionResult.Failed
            }
        }
    }

    private fun securePreferences() = EncryptedSharedPreferences.create(
        appContext,
        PREFS_NAME,
        MasterKey.Builder(appContext).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    private fun androidKeyStore() = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }

    private fun isP256(publicKey: ECPublicKey): Boolean {
        val expectedParams = AlgorithmParameters.getInstance("EC").run {
            init(ECGenParameterSpec("secp256r1"))
            getParameterSpec(java.security.spec.ECParameterSpec::class.java)
        }
        val actual = publicKey.params
        return actual.curve.field.fieldSize == 256 && actual.order == expectedParams.order && actual.generator == expectedParams.generator
    }

    private fun aliasFor(accountId: String) = "kb-e2ee-p256-${accountId.sha256()}"
    private fun provisionedKey(accountId: String) = "e2ee-provisioned-${accountId.sha256()}"

    private fun String.sha256(): String = MessageDigest.getInstance("SHA-256")
        .digest(toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it.toInt() and 0xff) }

    sealed interface KeyLookup {
        data class Available(val key: KeyPair) : KeyLookup
        data object Missing : KeyLookup
        data object Invalid : KeyLookup
        data object UnsupportedPlatform : KeyLookup
        data object InvalidAccount : KeyLookup
    }

    sealed interface KeyProvisionResult {
        data class Created(val publicKey: ECPublicKey) : KeyProvisionResult
        data class Existing(val key: KeyPair) : KeyProvisionResult
        data object MissingPreviouslyProvisionedKey : KeyProvisionResult
        data object Invalid : KeyProvisionResult
        data object UnsupportedPlatform : KeyProvisionResult
        data object InvalidAccount : KeyProvisionResult
        data object Failed : KeyProvisionResult
    }

    private companion object {
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val PREFS_NAME = "kotha_barta_secure_prefs"
        const val DEVICE_ID_KEY = "e2ee_device_id"
        val lock = Any()
    }
}
