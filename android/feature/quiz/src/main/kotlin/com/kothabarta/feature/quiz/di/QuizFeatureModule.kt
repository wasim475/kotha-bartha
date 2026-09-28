package com.kothabarta.feature.quiz.di

import com.kothabarta.feature.quiz.data.QuizRepository
import com.kothabarta.feature.quiz.ui.QuizBrowseViewModel
import com.kothabarta.feature.quiz.ui.QuizPlayViewModel
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.dsl.module

val quizFeatureModule = module {
    single { QuizRepository(api = get()) }
    viewModel { QuizBrowseViewModel(get()) }
    viewModel { (chapterId: String, setNumber: Int) -> QuizPlayViewModel(chapterId, setNumber, get()) }
}
