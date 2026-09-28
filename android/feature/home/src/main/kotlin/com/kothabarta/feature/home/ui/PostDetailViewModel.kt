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

data class PostDetailUiState(
    val isLoading: Boolean = true,
    val post: PostDto? = null,
    val error: String? = null,
)

class PostDetailViewModel(
    private val postId: String,
    private val repository: FeedRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(PostDetailUiState())
    val uiState: StateFlow<PostDetailUiState> = _uiState.asStateFlow()

    private val _navigationEvents = MutableSharedFlow<NavigationEvent>(extraBufferCapacity = 1)
    val navigationEvents: SharedFlow<NavigationEvent> = _navigationEvents.asSharedFlow()

    init {
        load()
    }

    fun retry() = load()

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            when (val result = repository.getPost(postId)) {
                is ApiResult.Success -> _uiState.update { it.copy(isLoading = false, post = result.data) }
                is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }

    fun toggleReaction(type: String) {
        val post = _uiState.value.post ?: return
        val nextType = if (post.reaction == type) null else type
        viewModelScope.launch {
            when (val result = repository.react(post.id, nextType)) {
                is ApiResult.Success -> _uiState.update { state ->
                    state.copy(post = state.post?.copy(
                        reaction = result.data.reaction,
                        reactions = result.data.reactions,
                        likes = result.data.likes,
                        liked = result.data.liked,
                    ))
                }
                is ApiResult.Failure -> _uiState.update { it.copy(error = result.error.message) }
            }
        }
    }

    fun openProfile(userId: String) {
        viewModelScope.launch { _navigationEvents.emit(NavigationEvent.NavigateTo(Routes.profile(userId))) }
    }
}
