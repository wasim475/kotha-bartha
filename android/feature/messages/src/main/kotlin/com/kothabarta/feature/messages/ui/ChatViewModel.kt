package com.kothabarta.feature.messages.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.network.auth.AuthApi
import com.kothabarta.core.network.decodeSocketPayload
import com.kothabarta.core.network.encodeSocketPayload
import com.kothabarta.core.network.messages.MessageDeletedEvent
import com.kothabarta.core.network.messages.MessageDto
import com.kothabarta.core.network.messages.MessageReadEvent
import com.kothabarta.core.network.messages.ReactionUpdateDto
import com.kothabarta.core.network.messages.ReplyPreviewDto
import com.kothabarta.core.network.messages.TypingEvent
import com.kothabarta.core.network.messages.TypingStartRequest
import com.kothabarta.core.network.safeApiCall
import com.kothabarta.core.websocket.SocketConnectionState
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.messages.data.MessagesRepository
import io.socket.emitter.Emitter
import java.time.Instant
import java.util.UUID
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ChatUiState(
    val isLoading: Boolean = true,
    val messages: List<MessageDto> = emptyList(),
    val error: String? = null,
    val composerText: String = "",
    val replyingTo: MessageDto? = null,
    val isPeerTyping: Boolean = false,
    /** Optimistic (not-yet-confirmed) local message ids — never treated as truly sent until the server responds. */
    val pendingIds: Set<String> = emptySet(),
    val failedIds: Set<String> = emptySet(),
    val myUserId: String? = null,
    val uploadingAttachment: Boolean = false,
)

private const val TYPING_STOP_DELAY_MS = 2_500L
private const val PEER_TYPING_SAFETY_CLEAR_MS = 4_000L

/**
 * One conversation's message thread. `peerId` (may be `null` if the caller
 * didn't have it on hand — see `core:navigation`'s `Routes.chat`) is only
 * used to target `typing:*` events; every other piece of "is this message
 * mine" logic compares against [myUserId], resolved once via `GET /auth/me`
 * (there is no lighter "who am I" call — see
 * docs/architecture/android-implementation-plan.md's Phase 3 notes).
 */
class ChatViewModel(
    private val conversationId: String,
    private val peerId: String?,
    val peerName: String?,
    val peerAvatarUrl: String?,
    private val repository: MessagesRepository,
    private val authApi: AuthApi,
    private val socketManager: SocketManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    private var isCurrentlyTyping = false
    private var typingStopJob: Job? = null
    private var peerTypingClearJob: Job? = null

    private val newMessageListener = Emitter.Listener { args ->
        args.firstOrNull()?.decodeSocketPayload<MessageDto>()?.let { message ->
            if (message.conversationId == conversationId) appendIncoming(message)
        }
    }
    private val updatedMessageListener = Emitter.Listener { args ->
        args.firstOrNull()?.decodeSocketPayload<MessageDto>()?.let { updated ->
            if (updated.conversationId == conversationId) {
                _uiState.update { state ->
                    state.copy(messages = state.messages.map { if (it.id == updated.id) updated else it })
                }
            }
        }
    }
    private val deletedMessageListener = Emitter.Listener { args ->
        args.firstOrNull()?.decodeSocketPayload<MessageDeletedEvent>()?.let { event ->
            if (event.conversationId == conversationId) {
                _uiState.update { it.copy(messages = it.messages.filterNot { m -> m.id == event.id }) }
            }
        }
    }
    private val reactionListener = Emitter.Listener { args ->
        args.firstOrNull()?.decodeSocketPayload<ReactionUpdateDto>()?.let { update ->
            if (update.conversationId == conversationId) {
                _uiState.update { state ->
                    state.copy(messages = state.messages.map { if (it.id == update.id) it.copy(reactions = update.reactions) else it })
                }
            }
        }
    }
    private val readListener = Emitter.Listener { args ->
        args.firstOrNull()?.decodeSocketPayload<MessageReadEvent>()?.let { event ->
            if (event.conversationId == conversationId) {
                _uiState.update { state ->
                    state.copy(messages = state.messages.map { if (it.id == event.id) it.copy(status = event.status) else it })
                }
            }
        }
    }
    private val typingStartListener = Emitter.Listener { args -> onTypingEvent(args, isStart = true) }
    private val typingStopListener = Emitter.Listener { args -> onTypingEvent(args, isStart = false) }

    private fun onTypingEvent(args: Array<out Any>, isStart: Boolean) {
        val event = args.firstOrNull()?.decodeSocketPayload<TypingEvent>() ?: return
        if (event.conversationId != conversationId) return
        if (peerId != null && event.senderId != peerId) return
        peerTypingClearJob?.cancel()
        _uiState.update { it.copy(isPeerTyping = isStart) }
        if (isStart) {
            peerTypingClearJob = viewModelScope.launch {
                delay(PEER_TYPING_SAFETY_CLEAR_MS)
                _uiState.update { it.copy(isPeerTyping = false) }
            }
        }
    }

    init {
        loadMyUserId()
        loadHistory()
        socketManager.on("message:new", newMessageListener)
        socketManager.on("message:updated", updatedMessageListener)
        socketManager.on("message:deleted", deletedMessageListener)
        socketManager.on("message:reaction", reactionListener)
        socketManager.on("message:read", readListener)
        socketManager.on("typing:start", typingStartListener)
        socketManager.on("typing:stop", typingStopListener)
        viewModelScope.launch {
            socketManager.connectionState
                .drop(1)
                .filter { it == SocketConnectionState.CONNECTED }
                .collect { loadHistory() }
        }
    }

    override fun onCleared() {
        if (isCurrentlyTyping) emitTyping(start = false)
        socketManager.off("message:new", newMessageListener)
        socketManager.off("message:updated", updatedMessageListener)
        socketManager.off("message:deleted", deletedMessageListener)
        socketManager.off("message:reaction", reactionListener)
        socketManager.off("message:read", readListener)
        socketManager.off("typing:start", typingStartListener)
        socketManager.off("typing:stop", typingStopListener)
    }

    private fun loadMyUserId() {
        viewModelScope.launch {
            val result = safeApiCall { authApi.me() }
            if (result is ApiResult.Success) _uiState.update { it.copy(myUserId = result.data.id) }
        }
    }

    /** Re-fetches full history — this endpoint has no cursor pagination, so a reload is always the whole thread. */
    private fun loadHistory() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = it.messages.isEmpty(), error = null) }
            when (val result = repository.getMessages(conversationId)) {
                is ApiResult.Success -> _uiState.update { it.copy(isLoading = false, messages = result.data) }
                is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }

    fun retry() = loadHistory()

    /**
     * Dedup on id — a message can arrive once via this listener and, in
     * principle, again after a reload. `internal` (not `private`) so
     * `ChatViewModelTest` can verify the dedup guarantee directly, without
     * needing a real Socket.IO connection to actually fire a second event.
     */
    internal fun appendIncoming(message: MessageDto) {
        _uiState.update { state ->
            if (state.messages.any { it.id == message.id }) state
            else state.copy(messages = state.messages + message)
        }
    }

    fun onComposerTextChange(text: String) {
        _uiState.update { it.copy(composerText = text) }
        handleTypingSignal(isTyping = text.isNotBlank())
    }

    /** Emits at most once per typing "burst", not on every keystroke, and always clears after a pause. */
    private fun handleTypingSignal(isTyping: Boolean) {
        if (isTyping) {
            if (!isCurrentlyTyping) {
                isCurrentlyTyping = true
                emitTyping(start = true)
            }
            typingStopJob?.cancel()
            typingStopJob = viewModelScope.launch {
                delay(TYPING_STOP_DELAY_MS)
                isCurrentlyTyping = false
                emitTyping(start = false)
            }
        } else {
            typingStopJob?.cancel()
            if (isCurrentlyTyping) {
                isCurrentlyTyping = false
                emitTyping(start = false)
            }
        }
    }

    private fun emitTyping(start: Boolean) {
        val to = peerId ?: return
        val payload = TypingStartRequest(to = to, conversationId = conversationId)
        socketManager.emit(if (start) "typing:start" else "typing:stop", payload.encodeSocketPayload())
    }

    fun setReplyTarget(message: MessageDto?) {
        _uiState.update { it.copy(replyingTo = message) }
    }

    fun sendText() {
        val text = _uiState.value.composerText.trim()
        if (text.isBlank()) return
        val replyingTo = _uiState.value.replyingTo
        val tempId = "pending-${UUID.randomUUID()}"
        val optimistic = MessageDto(
            id = tempId,
            conversationId = conversationId,
            body = text,
            createdAt = Instant.now().toString(),
            senderId = _uiState.value.myUserId ?: "me",
            replyTo = replyingTo?.let { ReplyPreviewDto(it.id, it.body, it.encrypted, it.senderId) },
        )
        _uiState.update {
            it.copy(
                messages = it.messages + optimistic,
                composerText = "",
                replyingTo = null,
                pendingIds = it.pendingIds + tempId,
            )
        }
        handleTypingSignal(isTyping = false)
        performSend(tempId, text, replyingTo?.id)
    }

    fun retrySend(tempId: String) {
        val failed = _uiState.value.messages.firstOrNull { it.id == tempId } ?: return
        _uiState.update { it.copy(failedIds = it.failedIds - tempId, pendingIds = it.pendingIds + tempId) }
        performSend(tempId, failed.body.orEmpty(), failed.replyTo?.id)
    }

    private fun performSend(tempId: String, text: String, replyToId: String?) {
        viewModelScope.launch {
            when (val result = repository.sendMessage(conversationId, text, replyToId)) {
                is ApiResult.Success -> _uiState.update { state ->
                    state.copy(
                        messages = state.messages.map { if (it.id == tempId) result.data else it },
                        pendingIds = state.pendingIds - tempId,
                    )
                }
                is ApiResult.Failure -> _uiState.update { state ->
                    state.copy(pendingIds = state.pendingIds - tempId, failedIds = state.failedIds + tempId, error = result.error.message)
                }
            }
        }
    }

    fun discardFailed(tempId: String) {
        _uiState.update { it.copy(messages = it.messages.filterNot { m -> m.id == tempId }, failedIds = it.failedIds - tempId) }
    }

    fun sendAttachment(bytes: ByteArray, fileName: String, mimeType: String) {
        _uiState.update { it.copy(uploadingAttachment = true, error = null) }
        viewModelScope.launch {
            when (val result = repository.sendAttachment(conversationId, bytes, fileName, mimeType)) {
                is ApiResult.Success -> _uiState.update { it.copy(uploadingAttachment = false, messages = it.messages + result.data) }
                is ApiResult.Failure -> _uiState.update { it.copy(uploadingAttachment = false, error = result.error.message) }
            }
        }
    }

    /** "Delete for everyone" — sender-only, time-limited server-side (`unsendExpiresAt`); Android never pre-checks the window itself. */
    fun unsend(messageId: String) {
        viewModelScope.launch {
            val result = repository.unsendMessage(conversationId, messageId)
            if (result is ApiResult.Success) {
                _uiState.update { it.copy(messages = it.messages.filterNot { m -> m.id == messageId }) }
            } else if (result is ApiResult.Failure) {
                _uiState.update { it.copy(error = result.error.message) }
            }
        }
    }

    fun deleteForMe(messageId: String) {
        viewModelScope.launch {
            val result = repository.deleteForMe(conversationId, messageId)
            if (result is ApiResult.Success) {
                _uiState.update { it.copy(messages = it.messages.filterNot { m -> m.id == messageId }) }
            }
        }
    }

    fun react(messageId: String, emoji: String) {
        viewModelScope.launch {
            val current = _uiState.value.messages.firstOrNull { it.id == messageId } ?: return@launch
            val myId = _uiState.value.myUserId
            val alreadyReacted = myId != null && current.reactions.any { it.userId == myId && it.emoji == emoji }
            val toSend = if (alreadyReacted) null else emoji
            val result = repository.react(conversationId, messageId, toSend)
            if (result is ApiResult.Success) {
                _uiState.update { state ->
                    state.copy(messages = state.messages.map { if (it.id == messageId) it.copy(reactions = result.data.reactions) else it })
                }
            }
        }
    }
}
