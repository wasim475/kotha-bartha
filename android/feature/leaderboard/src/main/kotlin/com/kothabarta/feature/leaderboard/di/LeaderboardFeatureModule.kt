package com.kothabarta.feature.leaderboard.di

import com.kothabarta.feature.leaderboard.data.LeaderboardRepository
import com.kothabarta.feature.leaderboard.ui.LeaderboardViewModel
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.dsl.module

val leaderboardFeatureModule = module {
    single { LeaderboardRepository(api = get()) }
    viewModel { LeaderboardViewModel(get()) }
}
