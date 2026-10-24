package com.kothabarta.feature.home.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.social.PostDto
import com.kothabarta.core.network.social.CommentDto
import java.util.concurrent.atomic.AtomicBoolean
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
    val comments: List<CommentDto> = emptyList(),
    val isLoadingComments: Boolean = true,
    val isSendingComment: Boolean = false,
    val replyTarget: CommentDto? = null,
    val expandedReplyIds: Set<String> = emptySet(),
    val reactingCommentIds: Set<String> = emptySet(),
)

class PostDetailViewModel(
    private val postId: String,
    private val repository: FeedRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(PostDetailUiState())
    val uiState: StateFlow<PostDetailUiState> = _uiState.asStateFlow()

    private val _navigationEvents = MutableSharedFlow<NavigationEvent>(extraBufferCapacity = 1)
    val navigationEvents: SharedFlow<NavigationEvent> = _navigationEvents.asSharedFlow()
    private val commentActionInFlight = AtomicBoolean(false)
    private val reactionRequests = java.util.Collections.synchronizedSet(mutableSetOf<String>())

    init {
        load()
        loadComments()
    }

    fun retry() = load()

    fun retryComments() = loadComments()

    fun createComment(body: String) = createComment(body, _uiState.value.replyTarget?.id)

    fun createComment(body: String, parentId: String?) {
        if (body.isBlank() || !commentActionInFlight.compareAndSet(false, true)) return
        viewModelScope.launch {
            _uiState.update { it.copy(isSendingComment = true, error = null) }
            when (val result = if (parentId == null) repository.createComment(postId, body.trim()) else repository.createReply(postId, parentId, body.trim())) {
                is ApiResult.Success -> _uiState.update { state ->
                    state.copy(isSendingComment = false, comments = state.comments + result.data, replyTarget = null, post = state.post?.let { it.copy(comments = if (parentId == null) it.comments + 1 else it.comments) })
                }
                is ApiResult.Failure -> _uiState.update { it.copy(isSendingComment = false, error = result.error.message) }
            }
            commentActionInFlight.set(false)
        }
    }

    fun setReplyTarget(comment: CommentDto?) = _uiState.update { it.copy(replyTarget = comment) }

    fun toggleReplies(commentId: String) = _uiState.update {
        it.copy(expandedReplyIds = if (commentId in it.expandedReplyIds) it.expandedReplyIds - commentId else it.expandedReplyIds + commentId)
    }

    fun toggleCommentReaction(comment: CommentDto, type: String) {
        if (!reactionRequests.add(comment.id)) return
        _uiState.update { it.copy(reactingCommentIds = it.reactingCommentIds + comment.id) }
        val nextType = if (comment.reaction == type) null else type
        viewModelScope.launch {
            when (val result = repository.reactToComment(comment.id, nextType)) {
                is ApiResult.Success -> _uiState.update { state -> state.copy(comments = state.comments.map { current ->
                    if (current.id == comment.id) current.copy(reaction = result.data.reaction, reactions = result.data.reactions) else current
                }) }
                is ApiResult.Failure -> _uiState.update { it.copy(error = result.error.message) }
            }
            reactionRequests.remove(comment.id)
            _uiState.update { it.copy(reactingCommentIds = it.reactingCommentIds - comment.id) }
        }
    }

    private fun loadComments() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingComments = true) }
            when (val result = repository.getComments(postId)) {
                is ApiResult.Success -> _uiState.update { it.copy(isLoadingComments = false, comments = result.data) }
                is ApiResult.Failure -> _uiState.update { it.copy(isLoadingComments = false, error = result.error.message) }
            }
        }
    }

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
