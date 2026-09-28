package com.kothabarta.feature.leaderboard.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.network.leaderboard.LeaderboardTopResponse
import com.kothabarta.feature.leaderboard.data.LeaderboardRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

val LEADERBOARD_CATEGORIES = listOf("overall", "quiz", "games")
val LEADERBOARD_PERIODS = listOf("today", "week", "month")

data class LeaderboardUiState(
    val isLoading: Boolean = true,
    val category: String = "overall",
    val period: String = "month",
    val data: LeaderboardTopResponse? = null,
    val error: String? = null,
)

/** Read-only — ranking/points are entirely server-computed; this only ever renders `GET /leaderboard/top`'s response. */
class LeaderboardViewModel(private val repository: LeaderboardRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(LeaderboardUiState())
    val uiState: StateFlow<LeaderboardUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun retry() = load()

    fun selectCategory(category: String) {
        _uiState.update { it.copy(category = category) }
        load()
    }

    fun selectPeriod(period: String) {
        _uiState.update { it.copy(period = period) }
        load()
    }

    private fun load() {
        val state = _uiState.value
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            when (val result = repository.getTop(state.category, state.period)) {
                is ApiResult.Success -> _uiState.update { it.copy(isLoading = false, data = result.data) }
                is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }
}
