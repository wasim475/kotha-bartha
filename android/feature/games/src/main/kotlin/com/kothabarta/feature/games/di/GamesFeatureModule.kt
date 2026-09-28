package com.kothabarta.feature.games.di

import com.kothabarta.feature.games.data.GameChallengeRepository
import com.kothabarta.feature.games.data.GamesRepository
import com.kothabarta.feature.games.ui.ChallengePlayViewModel
import com.kothabarta.feature.games.ui.ChallengeViewModel
import com.kothabarta.feature.games.ui.GamePlayViewModel
import com.kothabarta.feature.games.ui.GamesCatalogViewModel
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.dsl.module

val gamesFeatureModule = module {
    single { GamesRepository(api = get()) }
    single { GameChallengeRepository(api = get()) }
    viewModel { GamesCatalogViewModel(get()) }
    viewModel { (gameType: String) -> GamePlayViewModel(gameType, get()) }
    viewModel { ChallengeViewModel(get(), get(), get()) }
    viewModel { (matchId: String) -> ChallengePlayViewModel(matchId, get(), get()) }
}
