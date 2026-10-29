package com.kothabarta.feature.messages.di

import com.kothabarta.core.network.messages.ConversationLauncher
import com.kothabarta.feature.messages.data.MessageDecrypting
import com.kothabarta.feature.messages.data.AndroidMessageDeviceKeyRegistrar
import com.kothabarta.feature.messages.data.MessageDeviceKeyRegistrar
import com.kothabarta.feature.messages.data.MessagesRepository
import com.kothabarta.feature.messages.data.AndroidMessageDecryptor
import com.kothabarta.feature.messages.ui.ChatViewModel
import com.kothabarta.feature.messages.ui.ConversationsViewModel
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.dsl.module

val messagesFeatureModule = module {
    single { MessagesRepository(messagesApi = get(), usersApi = get(), friendsApi = get(), reportsApi = get()) }
    single<MessageDecrypting> { AndroidMessageDecryptor(get()) }
    single<MessageDeviceKeyRegistrar> { AndroidMessageDeviceKeyRegistrar(get(), get()) }
    single<ConversationLauncher> { get<MessagesRepository>() }
    viewModel { ConversationsViewModel(get(), get()) }
    viewModel { parameters ->
        val conversationId = parameters.get<String>(0)
        val peerId = parameters.get<String?>(1)
        val peerName = parameters.get<String?>(2)
        val peerAvatarUrl = parameters.get<String?>(3)
        val peerLastSeenAt = parameters.get<String?>(4)
        val peerIsOnline = parameters.get<Boolean>(5)
        ChatViewModel(conversationId, peerId, peerName, peerAvatarUrl, peerLastSeenAt, peerIsOnline, get(), get(), get(), get(), get())
    }
}
