package com.kothabarta.feature.calls.domain

import android.content.Context
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.media.IceCandidateData
import com.kothabarta.core.media.IceServerConfig
import com.kothabarta.core.media.RtcPeerConnectionState
import com.kothabarta.core.media.SdpDescription
import com.kothabarta.core.media.WebRtcConnection
import com.kothabarta.core.media.WebRtcManager
import com.kothabarta.core.network.auth.AuthApi
import com.kothabarta.core.network.call.CallAcceptedEvent
import com.kothabarta.core.network.call.CallAnswerRequest
import com.kothabarta.core.network.call.CallCancelledEvent
import com.kothabarta.core.network.call.CallDeclinedEvent
import com.kothabarta.core.network.call.CallDto
import com.kothabarta.core.network.call.CallEndedEvent
import com.kothabarta.core.network.call.CallIceCandidateRequest
import com.kothabarta.core.network.call.CallInviteEvent
import com.kothabarta.core.network.call.CallInviteParticipantEvent
import com.kothabarta.core.network.call.CallJoinRequest
import com.kothabarta.core.network.call.CallMissedEvent
import com.kothabarta.core.network.call.CallOfferRequest
import com.kothabarta.core.network.call.CallReactionEvent
import com.kothabarta.core.network.call.CallReactionRequest
import com.kothabarta.core.network.call.CallRingingEvent
import com.kothabarta.core.network.call.CallScreenShareEvent
import com.kothabarta.core.network.call.CallScreenShareRequest
import com.kothabarta.core.network.call.CallSignalEvent
import com.kothabarta.core.network.call.CallStateEvent
import com.kothabarta.core.network.call.CallStateRequest
import com.kothabarta.core.network.call.RtcIceCandidateDto
import com.kothabarta.core.network.call.RtcSessionDescriptionDto
import com.kothabarta.core.network.decodeSocketPayload
import com.kothabarta.core.network.encodeSocketPayload
import com.kothabarta.core.network.messages.MessageDto
import com.kothabarta.core.network.messages.MessagesApi
import com.kothabarta.core.network.messages.SendMessageRequest
import com.kothabarta.core.network.safeApiCall
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.websocket.SocketConnectionState
import com.kothabarta.core.websocket.SocketManager
import com.kothabarta.feature.calls.data.CallRepository
import io.socket.emitter.Emitter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import kotlinx.coroutines.Dispatchers

data class FloatingReaction(val id: Long, val type: String, val mine: Boolean)

data class CallUiState(
    val status: String = "idle", // idle | calling | ringing | accepted | connecting | connected | reconnecting
    val callId: String? = null,
    val role: String? = null, // "caller" | "callee"
    val peer: SafeUserDto? = null,
    val video: Boolean = true,
    val conversationId: String? = null,
    val ringingLive: Boolean = false,
    val cameraOn: Boolean = true,
    val micOn: Boolean = true,
    val minimized: Boolean = false,
    val layoutSwapped: Boolean = false,
    val screenShareActive: Boolean = false,
    val screenShareMine: Boolean = false,
    val quality: String? = null, // "good" | "unstable" | "poor"
    val durationSeconds: Int = 0,
    val error: String? = null,
    val audioOnlyFallback: Boolean = false,
    val remoteVideoReady: Boolean = false,
    val remoteAudioReady: Boolean = false,
    val localVideoReady: Boolean = false,
    val chatMessages: List<MessageDto> = emptyList(),
    val chatOpen: Boolean = false,
    val chatUnread: Int = 0,
    val reactions: List<FloatingReaction> = emptyList(),
    val participantInvite: CallInviteParticipantEvent? = null,
    val isBusy: Boolean = false,
) {
    val isIdle: Boolean get() = status == "idle"
}

private const val RECONNECT_GRACE_MS = 2000L

/**
 * The single app-wide call session — a Koin `single`, not a per-screen
 * ViewModel, so it (and the live [WebRtcManager]) survive navigation to any
 * tab, mirroring the web client's `CallProvider`/`CallGlobalHost` mounted
 * once at the router root rather than per-route. A thin per-screen
 * `CallViewModel`/Compose overlay only ever *observes* [state] and forwards
 * user actions here — it never owns any call state itself.
 *
 * Every behavioral decision below (who creates the offer, when ICE restart
 * fires and for which role only, how screen share swaps tracks without
 * renegotiating, how chat/reactions are wired) is copied point-for-point
 * from `client/src/provider/CallProvider.jsx`, confirmed by direct reading,
 * not inferred — see the call-phase research notes.
 */
class CallSessionManager(
    /** Nullable/defaulted purely so a JVM unit test can omit it entirely (it's only ever read inside [webRtcFactory]'s default value below) — Koin always supplies a real one in production. */
    private val appContext: Context? = null,
    private val repository: CallRepository,
    private val messagesApi: MessagesApi,
    private val authApi: AuthApi,
    private val socketManager: SocketManager,
    /** Overridable purely for JVM unit tests — constructing a real [WebRtcManager] touches native WebRTC/EGL code that requires a real Android runtime and would crash `testDebugUnitTest`. Production always uses the default. */
    private val webRtcFactory: () -> WebRtcConnection = { WebRtcManager(appContext!!) },
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    private var webRtc: WebRtcConnection? = null
    private var connectionObserverJob: Job? = null
    private var durationJob: Job? = null
    private var myUserId: String? = null
    private var reactionSeq = 0L
    private var iceServers: List<IceServerConfig> = listOf(IceServerConfig(listOf("stun:stun.l.google.com:19302")))

    /** Mirrors `pendingSignalsRef` — an offer can plausibly arrive before this device's own `WebRtcManager` exists yet (accept()'s REST round trip). */
    private val pendingSignals = mutableListOf<CallSignalEvent>()

    private val _state = MutableStateFlow(CallUiState())
    val state: StateFlow<CallUiState> = _state.asStateFlow()

    private val _toastMessages = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val toastMessages: SharedFlow<String> = _toastMessages.asSharedFlow()

    fun configureIceServers(servers: List<IceServerConfig>) {
        if (servers.isNotEmpty()) iceServers = servers
    }

    // ---- Socket listeners — registered every time the connection (re)establishes, since
    // SocketManager.connect() tears down and replaces the underlying Socket.IO `Socket`
    // instance on every call, silently dropping anything attached to the old one. ----

    private val inviteListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<CallInviteEvent>()?.let(::onInvite) }
    private val ringingListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<CallRingingEvent>()?.let(::onRinging) }
    private val acceptedListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<CallAcceptedEvent>()?.let(::onAccepted) }
    private val declinedListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<CallDeclinedEvent>()?.let(::onDeclined) }
    private val cancelledListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<CallCancelledEvent>()?.let(::onCancelled) }
    private val missedListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<CallMissedEvent>()?.let(::onMissed) }
    private val signalListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<CallSignalEvent>()?.let(::onSignal) }
    private val stateListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<CallStateEvent>()?.let(::onRemoteState) }
    private val endedListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<CallEndedEvent>()?.let(::onEnded) }
    private val screenShareStartListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<CallScreenShareEvent>()?.let { onScreenShareChanged(it, true) } }
    private val screenShareStopListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<CallScreenShareEvent>()?.let { onScreenShareChanged(it, false) } }
    private val reactionListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<CallReactionEvent>()?.let(::onReaction) }
    private val inviteParticipantListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<CallInviteParticipantEvent>()?.let(::onParticipantInvite) }
    private val messageNewListener = Emitter.Listener { args -> args.firstOrNull()?.decodeSocketPayload<MessageDto>()?.let(::onChatMessage) }

    init {
        scope.launch {
            socketManager.connectionState.collect { connState ->
                if (connState == SocketConnectionState.CONNECTED) onSocketConnected()
            }
        }
    }

    /** `internal` so a test can simulate a (re)connect without a live `Socket.IO` connection ever emitting `CONNECTED`. */
    internal suspend fun onSocketConnected() {
        registerListeners()
        ensureMyUserId() // must complete before rehydrate() derives caller-vs-callee role from it
        rehydrate()
    }

    private fun registerListeners() {
        socketManager.on("call:invite", inviteListener)
        socketManager.on("call:ringing", ringingListener)
        socketManager.on("call:accepted", acceptedListener)
        socketManager.on("call:declined", declinedListener)
        socketManager.on("call:cancelled", cancelledListener)
        socketManager.on("call:missed", missedListener)
        socketManager.on("call:signal", signalListener)
        socketManager.on("call:state", stateListener)
        socketManager.on("call:ended", endedListener)
        socketManager.on("call:screen-share:start", screenShareStartListener)
        socketManager.on("call:screen-share:stop", screenShareStopListener)
        socketManager.on("call:reaction", reactionListener)
        socketManager.on("call:invite-participant", inviteParticipantListener)
        socketManager.on("message:new", messageNewListener)
    }

    private suspend fun ensureMyUserId() {
        if (myUserId != null) return
        val result = safeApiCall { authApi.me() }
        if (result is ApiResult.Success) myUserId = result.data.id
    }

    /** Mirrors `rehydrate()` — runs on the first connect AND every reconnect (see [init]'s `collect`, not `.drop(1)`). A page-refresh/process-restart equivalent always rebuilds `RTCPeerConnection` from scratch rather than resuming old SDP state. */
    private fun rehydrate() {
        scope.launch {
            val result = repository.getActiveCall()
            val active = (result as? ApiResult.Success)?.data ?: return@launch
            val myId = myUserId
            val role = if (myId != null && active.caller?.id == myId) "caller" else "callee"
            val peer = if (role == "caller") active.callee else active.caller
            applyCallSummary(active, role, peer)
            when (active.status) {
                "ringing" -> Unit // just resume showing the popup; ring/cancel timers are entirely server-side
                "accepted", "connecting", "connected", "reconnecting" -> {
                    ensureWebRtc()
                    if (role == "caller") startAsCaller() else startAsCallee()
                }
            }
        }
    }

    // ---- Outgoing actions ----

    fun startCall(peer: SafeUserDto, video: Boolean) {
        if (!_state.value.isIdle) return
        _state.value = CallUiState(status = "calling", role = "caller", peer = peer, video = video, isBusy = true)
        scope.launch {
            when (val result = repository.startCall(peer.id, video)) {
                is ApiResult.Success -> {
                    val call = result.data
                    _state.update { it.copy(status = "ringing", callId = call.id, conversationId = call.conversationId, isBusy = false) }
                    socketManager.emit("call:join", CallJoinRequest(call.id).encodeSocketPayload())
                }
                is ApiResult.Failure -> {
                    resetToIdle()
                    _state.update { it.copy(error = result.error.message) }
                }
            }
        }
    }

    fun acceptIncomingCall() {
        val callId = _state.value.callId ?: return
        scope.launch {
            when (val result = repository.acceptCall(callId)) {
                is ApiResult.Success -> {
                    _state.update { it.copy(status = "accepted") }
                    socketManager.emit("call:join", CallJoinRequest(callId).encodeSocketPayload())
                    startAsCallee()
                    reportState(callId, "connecting")
                }
                is ApiResult.Failure -> {
                    _state.update { it.copy(error = result.error.message) }
                    resetToIdle()
                }
            }
        }
    }

    fun declineIncomingCall() {
        val callId = _state.value.callId
        scope.launch {
            if (callId != null) repository.declineCall(callId)
            resetToIdle()
        }
    }

    fun cancelOutgoingCall() {
        val callId = _state.value.callId
        scope.launch {
            if (callId != null) repository.cancelCall(callId)
            resetToIdle()
        }
    }

    fun endCall() {
        val callId = _state.value.callId
        val status = _state.value.status
        scope.launch {
            if (callId != null && status != "idle") repository.endCall(callId)
            resetToIdle()
        }
    }

    private fun onInvite(event: CallInviteEvent) {
        val call = event.call
        if (!_state.value.isIdle) {
            scope.launch { repository.declineCall(call.id) } // already on a call — decline cleanly instead of stacking popups
            return
        }
        // The server only ever emits `call:invite` to the callee's own `user:{id}` room — this
        // device is always the callee here, so the peer is always the caller, unconditionally
        // (unlike `rehydrate()`, which must derive role/peer since it doesn't know in advance).
        _state.value = CallUiState(status = "ringing", callId = call.id, role = "callee", peer = call.caller, video = call.video, conversationId = call.conversationId)
        socketManager.emit("call:join", CallJoinRequest(call.id).encodeSocketPayload())
    }

    private fun onRinging(event: CallRingingEvent) {
        if (event.callId != _state.value.callId || _state.value.role != "caller") return
        _state.update { it.copy(ringingLive = true) }
    }

    private fun onAccepted(event: CallAcceptedEvent) {
        val summary = event.call
        if (summary.id != _state.value.callId) return
        if (_state.value.role != "caller") return // my own other device already answered it — nothing to do here
        _state.update { it.copy(status = "accepted", conversationId = summary.conversationId) }
        ensureWebRtc()
        startAsCaller()
    }

    private fun onDeclined(event: CallDeclinedEvent) {
        if (event.callId != _state.value.callId) return
        if (_state.value.role == "caller") _state.update { it.copy(error = "${_state.value.peer?.fullName ?: "They"} declined the call.") }
        resetToIdle()
    }

    private fun onCancelled(event: CallCancelledEvent) {
        if (event.callId != _state.value.callId) return
        resetToIdle()
    }

    private fun onMissed(event: CallMissedEvent) {
        if (event.callId != _state.value.callId) return
        resetToIdle()
    }

    private fun onEnded(event: CallEndedEvent) {
        if (event.callId != _state.value.callId) return
        val message = if (event.reason == "failed") "Couldn't connect the call." else null
        resetToIdle(error = message)
    }

    // ---- WebRTC orchestration ----

    private fun ensureWebRtc(): WebRtcConnection {
        webRtc?.let { return it }
        val manager = webRtcFactory()
        manager.onLocalIceCandidate = { candidate -> onLocalIceCandidate(candidate) }
        webRtc = manager
        return manager
    }

    private fun startAsCaller() {
        val manager = ensureWebRtc()
        scope.launch {
            runCatching {
                manager.start(iceServers, _state.value.video)
                observeConnection(manager)
                val offer = manager.createOffer()
                sendOffer(offer, renegotiate = false)
                reportState(requireCallId(), "connecting")
            }.onFailure { failure -> _state.update { it.copy(error = failure.message ?: "Couldn't access camera/microphone.") } }
        }
    }

    private fun startAsCallee() {
        val manager = ensureWebRtc()
        scope.launch {
            runCatching {
                manager.start(iceServers, _state.value.video)
                observeConnection(manager)
                val queued = pendingSignals.toList()
                pendingSignals.clear()
                queued.forEach { onSignal(it) }
            }.onFailure { failure -> _state.update { it.copy(error = failure.message ?: "Couldn't access camera/microphone.") } }
        }
    }

    private fun onSignal(event: CallSignalEvent) {
        if (event.callId != _state.value.callId) return
        val manager = webRtc
        if (manager == null) {
            pendingSignals.add(event)
            return
        }
        val signal = event.signal
        scope.launch {
            when (signal.type) {
                "offer" -> {
                    val sdp = signal.sdp ?: return@launch
                    manager.setRemoteDescription(SdpDescription(sdp.type, sdp.sdp))
                    val answer = manager.createAnswer()
                    sendAnswer(answer)
                }
                "answer" -> {
                    val sdp = signal.sdp ?: return@launch
                    manager.setRemoteDescription(SdpDescription(sdp.type, sdp.sdp))
                }
                "ice" -> {
                    val candidate = signal.candidate ?: return@launch
                    manager.addRemoteIceCandidate(
                        IceCandidateData(candidate.sdpMid, candidate.sdpMLineIndex ?: 0, candidate.candidate.orEmpty()),
                    )
                }
            }
        }
    }

    private fun onLocalIceCandidate(candidate: IceCandidateData) {
        val callId = _state.value.callId ?: return
        socketManager.emit(
            "call:ice-candidate",
            CallIceCandidateRequest(callId, RtcIceCandidateDto(candidate.candidate, candidate.sdpMid, candidate.sdpMLineIndex)).encodeSocketPayload(),
        )
    }

    private fun sendOffer(offer: SdpDescription, renegotiate: Boolean) {
        val callId = requireCallId()
        socketManager.emit("call:offer", CallOfferRequest(callId, RtcSessionDescriptionDto(offer.type, offer.sdp), renegotiate).encodeSocketPayload())
    }

    private fun sendAnswer(answer: SdpDescription) {
        val callId = requireCallId()
        socketManager.emit("call:answer", CallAnswerRequest(callId, RtcSessionDescriptionDto(answer.type, answer.sdp)).encodeSocketPayload())
    }

    private fun reportState(callId: String, status: String) {
        socketManager.emit("call:state", CallStateRequest(callId, status).encodeSocketPayload())
    }

    private fun onRemoteState(event: CallStateEvent) {
        if (event.callId != _state.value.callId) return
        _state.update { it.copy(status = event.status) }
        if (event.status == "connected" && durationJob == null) startDurationTicker()
    }

    private fun startDurationTicker() {
        durationJob = scope.launch {
            var seconds = 0
            while (true) {
                _state.update { it.copy(durationSeconds = seconds) }
                delay(1000)
                seconds++
            }
        }
    }

    /** Only the caller side ever initiates an ICE restart — the callee only ever reports `reconnecting` and waits, matching `CallProvider.onconnectionstatechange` exactly (an asymmetry the server's own signalling relies on; a callee-side restart would conflict with the caller's). */
    private fun observeConnection(manager: WebRtcConnection) {
        connectionObserverJob?.cancel()
        var reconnectSince = 0L
        connectionObserverJob = scope.launch {
            manager.connectionState.collect { rtcState ->
                val callId = _state.value.callId ?: return@collect
                when (rtcState) {
                    RtcPeerConnectionState.CONNECTED -> {
                        reconnectSince = 0L
                        reportState(callId, "connected")
                        _state.update { it.copy(quality = "good", remoteVideoReady = manager.remoteVideoTrackAvailable.value, remoteAudioReady = manager.remoteAudioActive.value) }
                    }
                    RtcPeerConnectionState.DISCONNECTED -> {
                        val since = System.currentTimeMillis()
                        reconnectSince = since
                        delay(RECONNECT_GRACE_MS)
                        if (reconnectSince == since && manager.connectionState.value == RtcPeerConnectionState.DISCONNECTED) {
                            reportState(callId, "reconnecting")
                            _state.update { it.copy(quality = "unstable") }
                            if (_state.value.role == "caller") attemptIceRestart(manager)
                        }
                    }
                    RtcPeerConnectionState.FAILED -> {
                        _state.update { it.copy(quality = "poor") }
                        if (_state.value.role == "caller") attemptIceRestart(manager) else reportState(callId, "reconnecting")
                    }
                    else -> Unit
                }
            }
        }
        scope.launch {
            manager.remoteVideoTrackAvailable.collect { ready -> _state.update { it.copy(remoteVideoReady = ready) } }
        }
        scope.launch {
            manager.remoteAudioActive.collect { ready -> _state.update { it.copy(remoteAudioReady = ready) } }
        }
        scope.launch {
            manager.localVideoTrackAvailable.collect { ready -> _state.update { it.copy(localVideoReady = ready) } }
        }
    }

    private fun attemptIceRestart(manager: WebRtcConnection) {
        scope.launch {
            runCatching {
                val offer = manager.createOffer(iceRestart = true)
                sendOffer(offer, renegotiate = false)
            }
            // A restart that never recovers is caught by the server's own reconnect timeout, which ends the call — nothing else to do locally.
        }
    }

    // ---- Controls ----

    fun toggleMic() {
        val enabled = !_state.value.micOn
        webRtc?.setMicEnabled(enabled)
        _state.update { it.copy(micOn = enabled) }
    }

    fun toggleCamera() {
        val enabled = !_state.value.cameraOn
        webRtc?.setCameraEnabled(enabled)
        _state.update { it.copy(cameraOn = enabled, audioOnlyFallback = if (enabled) false else it.audioOnlyFallback) }
    }

    fun switchCamera() {
        webRtc?.switchCamera()
    }

    fun cameraCount(): Int = webRtc?.cameraCount() ?: 0

    fun applyScreenShareTrack(track: org.webrtc.VideoTrack) {
        webRtc?.replaceVideoTrackWithScreenShare(track)
        val callId = _state.value.callId ?: return
        socketManager.emit("call:screen-share:start", CallScreenShareRequest(callId).encodeSocketPayload())
        _state.update { it.copy(screenShareActive = true, screenShareMine = true) }
    }

    fun stopScreenShare() {
        webRtc?.restoreCameraVideoTrack()
        val callId = _state.value.callId
        if (callId != null) socketManager.emit("call:screen-share:stop", CallScreenShareRequest(callId).encodeSocketPayload())
        _state.update { it.copy(screenShareActive = false, screenShareMine = false) }
    }

    private fun onScreenShareChanged(event: CallScreenShareEvent, active: Boolean) {
        if (event.callId != _state.value.callId) return
        _state.update { it.copy(screenShareActive = active, screenShareMine = active && event.byUserId == myUserId) }
    }

    fun sendReaction(type: String) {
        val callId = _state.value.callId ?: return
        socketManager.emit("call:reaction", CallReactionRequest(callId, type).encodeSocketPayload())
        pushFloatingReaction(type, mine = true)
    }

    private fun onReaction(event: CallReactionEvent) {
        if (event.callId != _state.value.callId || event.from == myUserId) return
        pushFloatingReaction(event.type, mine = false)
    }

    private fun pushFloatingReaction(type: String, mine: Boolean) {
        val id = ++reactionSeq
        _state.update { it.copy(reactions = (it.reactions + FloatingReaction(id, type, mine)).takeLast(12)) }
        scope.launch {
            delay(2300)
            _state.update { it.copy(reactions = it.reactions.filterNot { reaction -> reaction.id == id }) }
        }
    }

    private fun onParticipantInvite(event: CallInviteParticipantEvent) {
        _state.update { it.copy(participantInvite = event) }
    }

    fun dismissParticipantInvite() {
        _state.update { it.copy(participantInvite = null) }
    }

    // ---- In-call chat — the SAME 1:1 conversation/REST endpoint/`message:new` event as
    // the Messages feature; no call-specific chat transport exists server-side. ----

    fun sendChatMessage(text: String) {
        val body = text.trim()
        val conversationId = _state.value.conversationId
        if (body.isEmpty() || conversationId == null) return
        scope.launch {
            when (val result = safeApiCall { messagesApi.sendMessage(conversationId, SendMessageRequest(body)) }) {
                is ApiResult.Success -> _state.update { it.copy(chatMessages = it.chatMessages + result.data) }
                is ApiResult.Failure -> Unit
            }
        }
    }

    private fun onChatMessage(message: MessageDto) {
        if (message.conversationId != _state.value.conversationId || message.type == "call") return
        if (message.senderId == myUserId) return // our own send is already applied above
        _state.update {
            val unread = if (it.chatOpen) it.chatUnread else it.chatUnread + 1
            it.copy(chatMessages = it.chatMessages + message, chatUnread = unread)
        }
    }

    fun toggleChat() {
        _state.update {
            val opening = !it.chatOpen
            it.copy(chatOpen = opening, chatUnread = if (opening) 0 else it.chatUnread)
        }
    }

    // ---- Misc UI actions ----

    fun setMinimized(minimized: Boolean) = _state.update { it.copy(minimized = minimized) }
    fun toggleLayout() = _state.update { it.copy(layoutSwapped = !it.layoutSwapped) }
    fun dismissError() = _state.update { it.copy(error = null) }

    fun attachLocalRenderer(renderer: org.webrtc.SurfaceViewRenderer) = webRtc?.attachLocalRenderer(renderer)
    fun attachRemoteRenderer(renderer: org.webrtc.SurfaceViewRenderer) = webRtc?.attachRemoteRenderer(renderer)
    fun eglBaseContext(): org.webrtc.EglBase.Context? = webRtc?.eglBaseContext()
    /** The concrete manager — null both when no call is active AND (harmlessly) under test, where [webRtcFactory] returns a fake [WebRtcConnection] that isn't a real [WebRtcManager]. Only real callers (e.g. screen-share) ever need this. */
    fun currentWebRtcManager(): WebRtcManager? = webRtc as? WebRtcManager

    private fun applyCallSummary(call: CallDto, role: String, peer: SafeUserDto?) {
        _state.value = CallUiState(
            status = call.status,
            callId = call.id,
            role = role,
            peer = peer,
            video = call.video,
            conversationId = call.conversationId,
            durationSeconds = call.durationSec,
            screenShareActive = call.screenShare.active,
            screenShareMine = call.screenShare.active && call.screenShare.byUserId == myUserId,
        )
    }

    private fun resetToIdle(error: String? = null) {
        connectionObserverJob?.cancel()
        connectionObserverJob = null
        durationJob?.cancel()
        durationJob = null
        pendingSignals.clear()
        webRtc?.release()
        webRtc = null
        _state.value = CallUiState(error = error)
    }

    private fun requireCallId(): String = _state.value.callId ?: error("No active call")
}
