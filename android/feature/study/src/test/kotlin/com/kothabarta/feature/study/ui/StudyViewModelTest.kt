package com.kothabarta.feature.study.ui

import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class StudyViewModelTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `each entry navigates to its own route`() = runTest {
        val viewModel = StudyViewModel()
        val events = mutableListOf<NavigationEvent>()
        val job = launch { viewModel.navigationEvents.collect { events.add(it) } }

        viewModel.openQuiz()
        viewModel.openGames()
        viewModel.openLeaderboard()
        viewModel.openTicTacToe()
        viewModel.openLudo()
        advanceUntilIdle()
        job.cancel()

        val routes = events.filterIsInstance<NavigationEvent.NavigateTo>().map { it.route }
        assertEquals(listOf(Routes.QUIZ, Routes.GAMES, Routes.LEADERBOARD, Routes.TIC_TAC_TOE, Routes.LUDO), routes)
    }
}
