package com.kothabarta.feature.friends.di

import com.kothabarta.feature.friends.data.FriendsRepository
import com.kothabarta.feature.friends.ui.FriendsViewModel
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.dsl.module

val friendsFeatureModule = module {
    single { FriendsRepository(friendsApi = get()) }
    viewModel { FriendsViewModel(get(), get()) }
}
