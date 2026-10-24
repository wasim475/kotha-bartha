package com.kothabarta.feature.home.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.social.PostDto
import com.kothabarta.core.network.social.StoryGroupDto
import com.kothabarta.core.network.social.NoteEntryDto
import com.kothabarta.feature.home.data.FeedRepository
import com.kothabarta.feature.home.data.FeedPage
import java.util.concurrent.atomic.AtomicBoolean
import java.util.Collections
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
    val isCreatingPost: Boolean = false,
    val createPostError: String? = null,
    val nextCursor: String? = null,
    val hasMore: Boolean = false,
    val isLoadingMore: Boolean = false,
    val loadMoreError: String? = null,
    val stories: List<StoryGroupDto> = emptyList(),
    val notes: List<NoteEntryDto> = emptyList(),
    val isCreatingSocialUpdate: Boolean = false,
    val socialUpdateError: String? = null,
    val socialUpdateVersion: Long = 0,
    val postActionInFlightId: String? = null,
    val postActionError: String? = null,
    val reactionInFlightPostIds: Set<String> = emptySet(),
    val reportInFlightId: String? = null,
    val reportConfirmation: String? = null,
)

class FeedViewModel(private val repository: FeedRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(FeedUiState())
    val uiState: StateFlow<FeedUiState> = _uiState.asStateFlow()

    private val _navigationEvents = MutableSharedFlow<NavigationEvent>(extraBufferCapacity = 1)
    val navigationEvents: SharedFlow<NavigationEvent> = _navigationEvents.asSharedFlow()
    private val postActionInFlight = AtomicBoolean(false)
    private val socialActionInFlight = AtomicBoolean(false)
    private val postMutationInFlight = AtomicBoolean(false)
    private val reactionRequests = Collections.synchronizedSet(mutableSetOf<String>())
    private val reportInFlight = AtomicBoolean(false)

    init {
        load(showFullScreenLoading = true)
        viewModelScope.launch { repository.markFeedRead() }
        refreshSocialUpdates()
    }

    fun refresh() {
        load(showFullScreenLoading = false, isPullToRefresh = true)
        refreshSocialUpdates()
    }

    fun loadMore() {
        val current = _uiState.value
        if (!current.hasMore || current.isLoadingMore || current.isLoading || current.isRefreshing) return
        val cursor = current.nextCursor ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingMore = true) }
            when (val result = repository.getFeed(cursor)) {
                is ApiResult.Success -> _uiState.update { state ->
                    state.copy(
                        posts = (state.posts + result.data.posts).distinctBy { it.id },
                        nextCursor = result.data.nextCursor,
                        hasMore = result.data.hasMore,
                        isLoadingMore = false,
                        loadMoreError = null,
                    )
                }
                is ApiResult.Failure -> _uiState.update { it.copy(isLoadingMore = false, loadMoreError = result.error.message) }
            }
        }
    }

    fun retry() = load(showFullScreenLoading = true)

    fun dismissError() = _uiState.update { it.copy(error = null) }

    fun createPost(body: String, photos: List<Triple<ByteArray, String, String>>) {
        if ((body.isBlank() && photos.isEmpty()) || !postActionInFlight.compareAndSet(false, true)) return
        viewModelScope.launch {
            _uiState.update { it.copy(isCreatingPost = true, createPostError = null) }
            when (val result = repository.createPost(body, photos)) {
                is ApiResult.Success -> _uiState.update {
                    it.copy(isCreatingPost = false, posts = listOf(result.data) + it.posts, createPostError = null)
                }
                is ApiResult.Failure -> _uiState.update {
                    it.copy(isCreatingPost = false, createPostError = result.error.message)
                }
            }
            postActionInFlight.set(false)
        }
    }

    fun dismissCreatePostError() = _uiState.update { it.copy(createPostError = null) }

    fun editPost(postId: String, body: String) {
        if (body.isBlank() || !postMutationInFlight.compareAndSet(false, true)) return
        viewModelScope.launch {
            _uiState.update { it.copy(postActionInFlightId = postId, postActionError = null) }
            when (val result = repository.editPost(postId, body)) {
                is ApiResult.Success -> _uiState.update { state -> state.copy(postActionInFlightId = null, posts = state.posts.map { if (it.id == postId) result.data else it }) }
                is ApiResult.Failure -> _uiState.update { it.copy(postActionInFlightId = null, postActionError = result.error.message) }
            }
            postMutationInFlight.set(false)
        }
    }

    fun deletePost(postId: String) {
        if (!postMutationInFlight.compareAndSet(false, true)) return
        viewModelScope.launch {
            _uiState.update { it.copy(postActionInFlightId = postId, postActionError = null) }
            when (val result = repository.deletePost(postId)) {
                is ApiResult.Success -> _uiState.update { state -> state.copy(postActionInFlightId = null, posts = state.posts.filterNot { it.id == postId }) }
                is ApiResult.Failure -> _uiState.update { it.copy(postActionInFlightId = null, postActionError = result.error.message) }
            }
            postMutationInFlight.set(false)
        }
    }

    fun dismissPostActionError() = _uiState.update { it.copy(postActionError = null) }

    fun reportPost(postId: String, reason: String, description: String) {
        if (!reportInFlight.compareAndSet(false, true)) return
        viewModelScope.launch {
            _uiState.update { it.copy(reportInFlightId = postId, postActionError = null, reportConfirmation = null) }
            when (val result = repository.reportPost(postId, reason, description)) {
                is ApiResult.Success -> _uiState.update {
                    it.copy(
                        reportInFlightId = null,
                        reportConfirmation = if (result.data.duplicate) "You've already reported this post. Our team will review it." else "Thanks. Your report has been sent for review.",
                    )
                }
                is ApiResult.Failure -> _uiState.update { it.copy(reportInFlightId = null, postActionError = result.error.message) }
            }
            reportInFlight.set(false)
        }
    }

    fun dismissReportConfirmation() = _uiState.update { it.copy(reportConfirmation = null) }

    fun refreshSocialUpdates() {
        viewModelScope.launch {
            val stories = repository.getStories()
            val notes = repository.getNotes()
            _uiState.update { state ->
                state.copy(
                    stories = (stories as? ApiResult.Success)?.data ?: state.stories,
                    notes = (notes as? ApiResult.Success)?.data ?: state.notes,
                )
            }
        }
    }

    fun createNote(text: String) = runSocialAction { repository.createNote(text) }
    fun createTextStory(text: String) = runSocialAction { repository.createTextStory(text) }
    fun createImageStory(text: String, photo: Triple<ByteArray, String, String>) = runSocialAction { repository.createImageStory(text, photo) }
    fun dismissSocialUpdateError() = _uiState.update { it.copy(socialUpdateError = null) }

    private fun runSocialAction(action: suspend () -> ApiResult<*>) {
        if (!socialActionInFlight.compareAndSet(false, true)) return
        viewModelScope.launch {
            _uiState.update { it.copy(isCreatingSocialUpdate = true, socialUpdateError = null) }
            when (val result = action()) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(isCreatingSocialUpdate = false, socialUpdateVersion = it.socialUpdateVersion + 1) }
                    refreshSocialUpdates()
                }
                is ApiResult.Failure -> _uiState.update { it.copy(isCreatingSocialUpdate = false, socialUpdateError = result.error.message) }
            }
            socialActionInFlight.set(false)
        }
    }

    private fun load(showFullScreenLoading: Boolean, isPullToRefresh: Boolean = false) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = showFullScreenLoading, isRefreshing = isPullToRefresh, error = null) }
            when (val result = repository.getFeed()) {
                is ApiResult.Success -> _uiState.update {
                    val posts = if (isPullToRefresh || showFullScreenLoading) result.data.posts else (it.posts + result.data.posts).distinctBy { post -> post.id }
                    it.copy(
                        isLoading = false,
                        isRefreshing = false,
                        posts = posts,
                        nextCursor = result.data.nextCursor,
                        hasMore = result.data.hasMore,
                        isLoadingMore = false,
                        error = null,
                    )
                }
                is ApiResult.Failure -> _uiState.update {
                    it.copy(isLoading = false, isRefreshing = false, error = result.error.message)
                }
            }
        }
    }

    /** Tapping the currently-active reaction again removes it — same toggle rule as the web client. */
    fun toggleReaction(post: PostDto, type: String) {
        if (!reactionRequests.add(post.id)) return
        _uiState.update { it.copy(reactionInFlightPostIds = it.reactionInFlightPostIds + post.id) }
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
            reactionRequests.remove(post.id)
            _uiState.update { it.copy(reactionInFlightPostIds = it.reactionInFlightPostIds - post.id) }
        }
    }

    fun openPost(postId: String) {
        viewModelScope.launch { _navigationEvents.emit(NavigationEvent.NavigateTo(Routes.post(postId))) }
    }

    fun openProfile(userId: String) {
        viewModelScope.launch { _navigationEvents.emit(NavigationEvent.NavigateTo(Routes.profile(userId))) }
    }
}
