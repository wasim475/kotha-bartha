package com.kothabarta.feature.study.di

import com.kothabarta.feature.study.ui.StudyViewModel
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.dsl.module

val studyFeatureModule = module {
    viewModel { StudyViewModel() }
}
