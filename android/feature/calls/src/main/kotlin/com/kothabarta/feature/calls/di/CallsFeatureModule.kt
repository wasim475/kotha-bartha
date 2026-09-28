package com.kothabarta.feature.calls.di

import com.kothabarta.core.network.call.CallLauncher
import com.kothabarta.feature.calls.data.CallRepository
import com.kothabarta.feature.calls.domain.CallLauncherAdapter
import com.kothabarta.feature.calls.domain.CallSessionManager
import com.kothabarta.feature.calls.ui.CallHistoryViewModel
import org.koin.android.ext.koin.androidContext
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.dsl.module

val callsFeatureModule = module {
    single { CallRepository(api = get()) }
    single { CallSessionManager(androidContext(), get(), get(), get(), get()) }
    single<CallLauncher> { CallLauncherAdapter(get()) }
    viewModel { CallHistoryViewModel(get()) }
}
