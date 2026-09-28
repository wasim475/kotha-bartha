package com.kothabarta.feature.notifications.di

import com.kothabarta.feature.notifications.data.NotificationBadge
import com.kothabarta.feature.notifications.data.NotificationsRepository
import com.kothabarta.feature.notifications.ui.NotificationsViewModel
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.dsl.module

val notificationsFeatureModule = module {
    single { NotificationsRepository(notificationsApi = get()) }
    single { NotificationBadge() }
    viewModel { NotificationsViewModel(get(), get(), get()) }
}
