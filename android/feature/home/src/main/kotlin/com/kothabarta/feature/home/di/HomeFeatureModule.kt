package com.kothabarta.feature.home.di

import com.kothabarta.feature.home.data.FeedRepository
import com.kothabarta.feature.home.ui.FeedViewModel
import com.kothabarta.feature.home.ui.PostDetailViewModel
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.dsl.module

val homeFeatureModule = module {
    single { FeedRepository(postsApi = get()) }
    viewModel { FeedViewModel(get()) }
    viewModel { (postId: String) -> PostDetailViewModel(postId, get()) }
}
