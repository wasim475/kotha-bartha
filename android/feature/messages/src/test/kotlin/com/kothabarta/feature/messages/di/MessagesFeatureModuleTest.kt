package com.kothabarta.feature.messages.di

import com.kothabarta.core.security.AndroidE2eeKeyManager
import com.kothabarta.core.security.E2eeKeyProvider
import com.kothabarta.feature.messages.data.AndroidMessageDecryptor
import com.kothabarta.feature.messages.data.MessageDecrypting
import org.junit.Assert.assertTrue
import org.junit.Test
import org.koin.dsl.koinApplication
import org.koin.dsl.module

class MessagesFeatureModuleTest {
    @Test
    fun `registers message decryptor under the interface requested by ChatViewModel`() {
        val app = koinApplication {
            modules(
                module { single<E2eeKeyProvider> { TestKeyProvider } },
                messagesFeatureModule,
            )
        }

        try {
            assertTrue(app.koin.get<MessageDecrypting>() is AndroidMessageDecryptor)
        } finally {
            app.close()
        }
    }

    private object TestKeyProvider : E2eeKeyProvider {
        override fun deviceId(): String = "test-device"

        override fun existingPrivateKey(accountId: String): AndroidE2eeKeyManager.KeyLookup =
            AndroidE2eeKeyManager.KeyLookup.Missing
    }
}
