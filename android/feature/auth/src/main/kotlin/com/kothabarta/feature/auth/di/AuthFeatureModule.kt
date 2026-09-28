package com.kothabarta.feature.auth.di

import com.kothabarta.core.network.SessionManager
import com.kothabarta.feature.auth.data.AuthRepository
import com.kothabarta.feature.auth.ui.LoginViewModel
import com.kothabarta.feature.auth.ui.SignupViewModel
import com.kothabarta.feature.auth.ui.SplashViewModel
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.dsl.module

/**
 * `:app` includes this alongside its own core module — a feature module
 * owns its own DI wiring so `:app` never has to know `AuthRepository`'s
 * constructor, only that `:feature:auth` needs the core singletons that are
 * already registered (see docs/architecture/android-implementation-plan.md
 * section B).
 */
val authFeatureModule = module {
    single { AuthRepository(authApi = get(), tokenStore = get(), socketManager = get()) }
    single<SessionManager> { get<AuthRepository>() }
    viewModel { SplashViewModel(get()) }
    viewModel { LoginViewModel(get(), get()) }
    viewModel { SignupViewModel(get()) }
}
