package com.kothabarta.app

import com.kothabarta.core.datastore.MessageNotificationPrivacy
import com.kothabarta.core.network.auth.AuthApi
import com.kothabarta.core.network.messages.ConversationHeaderDto
import com.kothabarta.core.network.messages.MessageDto
import com.kothabarta.core.network.messages.MessagesApi
import com.kothabarta.core.security.TokenStore
import com.kothabarta.feature.messages.data.MessageDecrypting
import com.kothabarta.feature.messages.data.MessageDecryptionState
import com.kothabarta.feature.messages.data.isEncryptedForDisplay

data class MessageNotificationContent(
    val title: String,
    val body: String,
    val publicTitle: String = "KothaX",
    val publicBody: String = "New message",
    val avatarUrl: String? = null,
    val isGroup: Boolean = false,
)

data class PushMessageContext(
    val accountId: String,
    val message: MessageDto,
    val conversation: ConversationHeaderDto,
)

fun interface PushMessageDataSource {
    suspend fun load(conversationId: String, messageId: String): PushMessageContext?
}

class AuthenticatedPushMessageDataSource(
    private val tokenStore: TokenStore,
    private val authApi: AuthApi,
    private val messagesApi: MessagesApi,
) : PushMessageDataSource {
    override suspend fun load(conversationId: String, messageId: String): PushMessageContext? {
        if (tokenStore.getToken().isNullOrBlank()) return null
        val account = authApi.me().takeIf { it.isSuccessful }?.body()?.data ?: return null
        val message = messagesApi.getNotificationPreviewMessage(conversationId, messageId)
            .takeIf { it.isSuccessful }
            ?.body()?.data
            ?: return null
        val conversation = messagesApi.getConversation(conversationId)
            .takeIf { it.isSuccessful }
            ?.body()?.data
            ?: return null
        return PushMessageContext(account.id, message, conversation)
    }
}

class MessageNotificationPreviewResolver(
    private val source: PushMessageDataSource,
    private val decryptor: MessageDecrypting,
) {
    suspend fun resolve(
        conversationId: String,
        messageId: String,
        privacy: MessageNotificationPrivacy,
    ): MessageNotificationContent {
        if (privacy == MessageNotificationPrivacy.HIDE_NOTIFICATION_CONTENT) return hiddenContent()

        val context = runCatching { source.load(conversationId, messageId) }.getOrNull()
            ?: return genericContent()
        val message = context.message
        val senderName = message.sender?.fullName?.trim()?.takeIf(String::isNotEmpty)
        val isGroup = context.conversation.isGroup
        val groupName = context.conversation.group?.name?.trim()?.takeIf(String::isNotEmpty)
        val title = if (isGroup) groupName ?: "Group conversation" else senderName ?: "KothaX"
        val avatar = if (isGroup) context.conversation.group?.avatar?.secureUrl else message.sender?.avatar?.secureUrl

        if (privacy == MessageNotificationPrivacy.SHOW_SENDER_ONLY) {
            val body = if (isGroup && senderName != null) "$senderName sent a message" else "New message"
            return MessageNotificationContent(title, body, avatarUrl = avatar, isGroup = isGroup)
        }

        val preview = messagePreview(context, message) ?: return MessageNotificationContent(
            title = title,
            body = if (isGroup && senderName != null) "$senderName sent a message" else "New message",
            avatarUrl = avatar,
            isGroup = isGroup,
        )
        val boundedPreview = preview.replace('\n', ' ').take(MAX_PREVIEW_LENGTH)
        val body = if (isGroup && senderName != null) "$senderName: $boundedPreview" else boundedPreview
        return MessageNotificationContent(title, body, avatarUrl = avatar, isGroup = isGroup)
    }

    private suspend fun messagePreview(context: PushMessageContext, message: MessageDto): String? {
        if (message.type == "attachment") {
            return when (message.attachment?.kind) {
                "image" -> "Photo"
                "voice" -> "Voice message"
                else -> "File"
            }
        }
        if (message.type != "text") return "New message"
        if (!message.isEncryptedForDisplay()) return message.body?.takeIf(String::isNotBlank)
        return when (val result = runCatching { decryptor.decrypt(message, context.accountId) }.getOrNull()) {
            is MessageDecryptionState.Decrypted -> result.plaintext.takeIf(String::isNotBlank)
            else -> null
        }
    }

    private fun genericContent() = MessageNotificationContent("KothaX", "New message")

    private fun hiddenContent() = MessageNotificationContent(
        title = "KothaX",
        body = "New message",
        publicTitle = "KothaX",
        publicBody = "New message",
    )

    private companion object {
        const val MAX_PREVIEW_LENGTH = 160
    }
}
