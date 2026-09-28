package com.kothabarta.feature.tictactoe.di

import com.kothabarta.feature.tictactoe.data.TicTacToeRepository
import com.kothabarta.feature.tictactoe.ui.TttGameViewModel
import com.kothabarta.feature.tictactoe.ui.TttLobbyViewModel
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.dsl.module

val tttFeatureModule = module {
    single { TicTacToeRepository(api = get()) }
    viewModel { TttLobbyViewModel(get(), get()) }
    viewModel { (gameId: String) -> TttGameViewModel(gameId, get(), get(), get()) }
}
