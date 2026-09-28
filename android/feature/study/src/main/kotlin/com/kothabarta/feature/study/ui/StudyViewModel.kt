package com.kothabarta.feature.study.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch

class StudyViewModel : ViewModel() {
    private val _navigationEvents = MutableSharedFlow<NavigationEvent>(extraBufferCapacity = 1)
    val navigationEvents: SharedFlow<NavigationEvent> = _navigationEvents.asSharedFlow()

    private fun go(route: String) {
        viewModelScope.launch { _navigationEvents.emit(NavigationEvent.NavigateTo(route)) }
    }

    fun openQuiz() = go(Routes.QUIZ)
    fun openGames() = go(Routes.GAMES)
    fun openLeaderboard() = go(Routes.LEADERBOARD)
    fun openTicTacToe() = go(Routes.TIC_TAC_TOE)
    fun openLudo() = go(Routes.LUDO)
}
