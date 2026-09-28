package com.kothabarta.feature.games.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.games.GameAttemptDto
import com.kothabarta.core.network.games.GameCatalogEntryDto
import com.kothabarta.feature.games.data.GamesRepository
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class GamesCatalogUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val entries: List<GameCatalogEntryDto> = emptyList(),
    val lastAttempt: GameAttemptDto? = null,
)

class GamesCatalogViewModel(private val repository: GamesRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(GamesCatalogUiState())
    val uiState: StateFlow<GamesCatalogUiState> = _uiState.asStateFlow()

    private val _navigationEvents = MutableSharedFlow<NavigationEvent>(extraBufferCapacity = 1)
    val navigationEvents: SharedFlow<NavigationEvent> = _navigationEvents.asSharedFlow()

    init {
        load()
    }

    fun retry() = load()

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            when (val result = repository.getCatalog()) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(isLoading = false, entries = result.data) }
                    loadLastAttempt()
                }
                is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }

    private fun loadLastAttempt() {
        viewModelScope.launch {
            val result = repository.getLastAttempt()
            if (result is ApiResult.Success) {
                _uiState.update { it.copy(lastAttempt = result.data) }
            }
        }
    }

    /**
     * `entry.route` is only ever set on the two external-game catalog entries
     * (tic-tac-toe, ludo) — matched against [entry]'s own `type` rather than
     * trusted verbatim, so an unrecognized `type` safely falls back to the
     * normal solo-game destination instead of navigating to a server-supplied
     * string Android's nav graph doesn't actually have a route for.
     */
    fun selectEntry(entry: GameCatalogEntryDto) {
        if (!entry.available) return
        val destination = if (entry.route != null) {
            when (entry.type) {
                Routes.TIC_TAC_TOE -> Routes.TIC_TAC_TOE
                Routes.LUDO -> Routes.LUDO
                else -> Routes.gamePlay(entry.type)
            }
        } else {
            Routes.gamePlay(entry.type)
        }
        viewModelScope.launch { _navigationEvents.emit(NavigationEvent.NavigateTo(destination)) }
    }

    fun continueLastAttempt() {
        val attempt = _uiState.value.lastAttempt ?: return
        viewModelScope.launch { _navigationEvents.emit(NavigationEvent.NavigateTo(Routes.gamePlay(attempt.gameType))) }
    }
}
