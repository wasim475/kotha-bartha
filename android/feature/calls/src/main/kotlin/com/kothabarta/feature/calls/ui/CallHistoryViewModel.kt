package com.kothabarta.feature.calls.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.network.call.CallHistoryRowDto
import com.kothabarta.feature.calls.data.CallRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class CallHistoryUiState(
    val isLoading: Boolean = true,
    val isLoadingMore: Boolean = false,
    val rows: List<CallHistoryRowDto> = emptyList(),
    val page: Int = 1,
    val totalPages: Int = 1,
    val error: String? = null,
) {
    val canLoadMore: Boolean get() = page < totalPages
}

/** A plain, pushed screen (not part of the global call overlay) — `GET /calls/history`, paginated by `page`/`totalPages`. */
class CallHistoryViewModel(private val repository: CallRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(CallHistoryUiState())
    val uiState: StateFlow<CallHistoryUiState> = _uiState.asStateFlow()

    init {
        load(page = 1, append = false)
    }

    fun retry() = load(page = 1, append = false)

    fun loadMore() {
        val current = _uiState.value
        if (current.isLoadingMore || !current.canLoadMore) return
        load(page = current.page + 1, append = true)
    }

    private fun load(page: Int, append: Boolean) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = !append && it.rows.isEmpty(), isLoadingMore = append, error = null) }
            when (val result = repository.getHistory(page)) {
                is ApiResult.Success -> _uiState.update {
                    it.copy(
                        isLoading = false,
                        isLoadingMore = false,
                        rows = if (append) it.rows + result.data.calls else result.data.calls,
                        page = result.data.page,
                        totalPages = result.data.totalPages,
                    )
                }
                is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, isLoadingMore = false, error = result.error.message) }
            }
        }
    }
}
