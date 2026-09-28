package com.kothabarta.feature.home.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.social.PostDto
import com.kothabarta.feature.home.data.FeedRepository
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class FeedUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val posts: List<PostDto> = emptyList(),
    val error: String? = null,
)

class FeedViewModel(private val repository: FeedRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(FeedUiState())
    val uiState: StateFlow<FeedUiState> = _uiState.asStateFlow()

    private val _navigationEvents = MutableSharedFlow<NavigationEvent>(extraBufferCapacity = 1)
    val navigationEvents: SharedFlow<NavigationEvent> = _navigationEvents.asSharedFlow()

    init {
        load(showFullScreenLoading = true)
        viewModelScope.launch { repository.markFeedRead() }
    }

    fun refresh() = load(showFullScreenLoading = false, isPullToRefresh = true)

    fun retry() = load(showFullScreenLoading = true)

    private fun load(showFullScreenLoading: Boolean, isPullToRefresh: Boolean = false) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = showFullScreenLoading, isRefreshing = isPullToRefresh, error = null) }
            when (val result = repository.getFeed()) {
                is ApiResult.Success -> _uiState.update {
                    it.copy(isLoading = false, isRefreshing = false, posts = result.data, error = null)
                }
                is ApiResult.Failure -> _uiState.update {
                    it.copy(isLoading = false, isRefreshing = false, error = result.error.message)
                }
            }
        }
    }

    /** Tapping the currently-active reaction again removes it — same toggle rule as the web client. */
    fun toggleReaction(post: PostDto, type: String) {
        val nextType = if (post.reaction == type) null else type
        viewModelScope.launch {
            when (val result = repository.react(post.id, nextType)) {
                is ApiResult.Success -> _uiState.update { state ->
                    state.copy(posts = state.posts.map { existing ->
                        if (existing.id == post.id) {
                            existing.copy(
                                reaction = result.data.reaction,
                                reactions = result.data.reactions,
                                likes = result.data.likes,
                                liked = result.data.liked,
                            )
                        } else existing
                    })
                }
                is ApiResult.Failure -> _uiState.update { it.copy(error = result.error.message) }
            }
        }
    }

    fun openPost(postId: String) {
        viewModelScope.launch { _navigationEvents.emit(NavigationEvent.NavigateTo(Routes.post(postId))) }
    }

    fun openProfile(userId: String) {
        viewModelScope.launch { _navigationEvents.emit(NavigationEvent.NavigateTo(Routes.profile(userId))) }
    }
}
