package com.kothabarta.feature.ludo.di

import com.kothabarta.feature.ludo.data.LudoRepository
import com.kothabarta.feature.ludo.ui.LudoGameViewModel
import com.kothabarta.feature.ludo.ui.LudoLobbyViewModel
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.dsl.module

val ludoFeatureModule = module {
    single { LudoRepository(api = get()) }
    viewModel { LudoLobbyViewModel(get(), get()) }
    viewModel { (gameId: String) -> LudoGameViewModel(gameId, get(), get(), get()) }
}
