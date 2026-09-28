package com.kothabarta.feature.profile.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.common.map
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.SessionManager
import com.kothabarta.core.network.messages.ConversationLauncher
import com.kothabarta.core.network.social.PhotoDto
import com.kothabarta.core.network.social.PostDto
import com.kothabarta.feature.profile.data.ProfileRepository
import com.kothabarta.feature.profile.data.ProfileUiModel
import com.kothabarta.feature.profile.data.toProfileUiModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class ProfileTab { ABOUT, POSTS, PHOTOS }

data class ProfileUiState(
    val isLoading: Boolean = true,
    val profile: ProfileUiModel? = null,
    val error: String? = null,
    val tab: ProfileTab = ProfileTab.POSTS,
    val posts: List<PostDto> = emptyList(),
    val photos: List<PhotoDto> = emptyList(),
    val contentRestricted: Boolean = false,
    val friendActionInFlight: Boolean = false,
    val friendActionError: String? = null,
    val messageActionInFlight: Boolean = false,
)

/** `userId == null` means "my own profile" (see [ProfileRepository.getOwnProfile]). */
class ProfileViewModel(
    private val userId: String?,
    private val repository: ProfileRepository,
    private val sessionManager: SessionManager,
    private val conversationLauncher: ConversationLauncher,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    private val _navigationEvents = MutableSharedFlow<NavigationEvent>(extraBufferCapacity = 1)
    val navigationEvents: SharedFlow<NavigationEvent> = _navigationEvents.asSharedFlow()

    private val isOwn get() = userId == null

    init {
        load()
    }

    fun retry() = load()

    fun selectTab(tab: ProfileTab) {
        _uiState.update { it.copy(tab = tab) }
        if (tab == ProfileTab.POSTS && _uiState.value.posts.isEmpty()) loadPosts()
        if (tab == ProfileTab.PHOTOS && _uiState.value.photos.isEmpty()) loadPhotos()
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            val result = if (isOwn) repository.getOwnProfile() else repository.getProfile(userId!!)
            when (result) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(isLoading = false, profile = result.data) }
                    loadPosts()
                }
                is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }

    private fun loadPosts() {
        val id = profileId() ?: return
        viewModelScope.launch {
            when (val result = repository.getPosts(id)) {
                is ApiResult.Success -> _uiState.update {
                    it.copy(posts = result.data.first, contentRestricted = result.data.second)
                }
                is ApiResult.Failure -> _uiState.update { it.copy(error = result.error.message) }
            }
        }
    }

    private fun loadPhotos() {
        val id = profileId() ?: return
        viewModelScope.launch {
            when (val result = repository.getPhotos(id)) {
                is ApiResult.Success -> _uiState.update {
                    it.copy(photos = result.data.first, contentRestricted = result.data.second)
                }
                is ApiResult.Failure -> _uiState.update { it.copy(error = result.error.message) }
            }
        }
    }

    private fun profileId(): String? = userId ?: _uiState.value.profile?.id

    fun sendFriendRequest() = runFriendAction { repository.sendFriendRequest(profileId()!!) }
    fun cancelFriendRequest() = runFriendAction { repository.cancelFriendRequest(profileId()!!).map { } }
    fun acceptFriendRequest() {
        val requestId = _uiState.value.profile?.receivedFriendRequestId ?: return
        runFriendAction { repository.acceptFriendRequest(requestId).map { } }
    }
    fun unfriend() = runFriendAction { repository.unfriend(profileId()!!).map { } }

    private fun runFriendAction(action: suspend () -> ApiResult<Unit>) {
        viewModelScope.launch {
            _uiState.update { it.copy(friendActionInFlight = true, friendActionError = null) }
            when (val result = action()) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(friendActionInFlight = false) }
                    load()
                }
                is ApiResult.Failure -> _uiState.update {
                    it.copy(friendActionInFlight = false, friendActionError = result.error.message)
                }
            }
        }
    }

    fun openMessage() {
        val id = profileId() ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(messageActionInFlight = true) }
            when (val result = conversationLauncher.openConversationWith(id)) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(messageActionInFlight = false) }
                    val target = result.data
                    _navigationEvents.emit(
                        NavigationEvent.NavigateTo(Routes.chat(target.conversationId, target.peerId, target.peerName, target.peerAvatarUrl)),
                    )
                }
                is ApiResult.Failure -> _uiState.update {
                    it.copy(messageActionInFlight = false, friendActionError = result.error.message)
                }
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            sessionManager.logout()
            _navigationEvents.emit(NavigationEvent.NavigateTo(Routes.LOGIN, popUpToInclusive = Routes.MAIN))
        }
    }
}
