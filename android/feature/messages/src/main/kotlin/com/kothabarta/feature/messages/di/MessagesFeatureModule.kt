package com.kothabarta.feature.messages.di

import com.kothabarta.core.network.messages.ConversationLauncher
import com.kothabarta.feature.messages.data.MessagesRepository
import com.kothabarta.feature.messages.ui.ChatViewModel
import com.kothabarta.feature.messages.ui.ConversationsViewModel
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.dsl.module

val messagesFeatureModule = module {
    single { MessagesRepository(messagesApi = get()) }
    single<ConversationLauncher> { get<MessagesRepository>() }
    viewModel { ConversationsViewModel(get(), get()) }
    viewModel { (conversationId: String, peerId: String?, peerName: String?, peerAvatarUrl: String?) ->
        ChatViewModel(conversationId, peerId, peerName, peerAvatarUrl, get(), get(), get())
    }
}
