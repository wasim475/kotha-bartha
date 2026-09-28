package com.kothabarta.feature.profile.di

import com.kothabarta.feature.profile.data.ProfileRepository
import com.kothabarta.feature.profile.ui.ProfileViewModel
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.dsl.module

val profileFeatureModule = module {
    single { ProfileRepository(authApi = get(), usersApi = get(), friendsApi = get()) }
    viewModel { (userId: String?) -> ProfileViewModel(userId, get(), get(), get()) }
}
