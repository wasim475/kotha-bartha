package com.kothabarta.core.media

import android.content.Context
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.Camera2Enumerator
import org.webrtc.CameraVideoCapturer
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.MediaStreamTrack
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.RtpSender
import org.webrtc.RtpTransceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceTextureHelper
import org.webrtc.SurfaceViewRenderer
import org.webrtc.VideoCapturer
import org.webrtc.VideoSource
import org.webrtc.VideoTrack
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

data class IceServerConfig(val urls: List<String>, val username: String? = null, val credential: String? = null)

enum class RtcPeerConnectionState { NEW, CONNECTING, CONNECTED, DISCONNECTED, FAILED, CLOSED }

/** The web client's own `RTCSessionDescriptionInit`/`RTCIceCandidateInit` shapes, forwarded wholesale over the socket — see `core:network`'s `RtcSessionDescriptionDto`/`RtcIceCandidateDto`. This is the same shape, kept independent of `core:network` so `core:media` has no network dependency. */
data class SdpDescription(val type: String, val sdp: String)
data class IceCandidateData(val sdpMid: String?, val sdpMLineIndex: Int, val candidate: String)

private const val VIDEO_TRACK_ID = "kb_video0"
private const val AUDIO_TRACK_ID = "kb_audio0"
private const val LOCAL_STREAM_ID = "kb_local_stream"

/**
 * One `RTCPeerConnection` for one active call — a fresh instance per call,
 * released and recreated rather than reused, mirroring the web client's own
 * `ensurePeerConnection`/`rehydrate` behavior (see
 * `docs/architecture/android-webrtc.md` and the call-phase research: a
 * dropped/rebuilt connection always renegotiates from scratch, it never
 * resumes old SDP state).
 *
 * This class owns ONLY the native WebRTC plumbing — no socket, no call
 * state machine, no UI. [com.kothabarta.feature.calls] domain's
 * `CallSessionManager` drives it: wires [onLocalIceCandidate], calls
 * [createOffer]/[createAnswer]/[setRemoteDescription]/[addRemoteIceCandidate]
 * in response to `call:signal` events, and decides *when* to call
 * [createOffer] with `iceRestart = true` (only the caller side ever does,
 * per the confirmed web behavior) — this class has no opinion on call roles.
 *
 * Implements [WebRtcConnection] so `CallSessionManager` can depend on the
 * interface instead — see that file's KDoc for why.
 */
class WebRtcManager(private val appContext: Context) : WebRtcConnection {

    val eglBase: EglBase = EglBase.create()

    private var factory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null

    private var videoCapturer: VideoCapturer? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null
    private var videoSource: VideoSource? = null
    private var audioSource: AudioSource? = null
    private var localVideoTrack: VideoTrack? = null
    private var localAudioTrack: AudioTrack? = null
    private var cameraVideoSender: RtpSender? = null

    private var screenCaptureVideoTrack: VideoTrack? = null

    /** ICE candidates routinely arrive before the remote SDP does — matches the web client's own `pendingCandidatesRef` queue. */
    private var remoteDescriptionSet = false
    private val pendingRemoteCandidates = mutableListOf<IceCandidate>()

    private val mainHandler = Handler(Looper.getMainLooper())

    override var onLocalIceCandidate: ((IceCandidateData) -> Unit)? = null

    private val _connectionState = MutableStateFlow(RtcPeerConnectionState.NEW)
    override val connectionState: StateFlow<RtcPeerConnectionState> = _connectionState.asStateFlow()

    private val _localVideoTrackAvailable = MutableStateFlow(false)
    override val localVideoTrackAvailable: StateFlow<Boolean> = _localVideoTrackAvailable.asStateFlow()

    private val _remoteVideoTrackAvailable = MutableStateFlow(false)
    override val remoteVideoTrackAvailable: StateFlow<Boolean> = _remoteVideoTrackAvailable.asStateFlow()

    private val _remoteAudioActive = MutableStateFlow(false)
    override val remoteAudioActive: StateFlow<Boolean> = _remoteAudioActive.asStateFlow()

    private var remoteVideoTrack: VideoTrack? = null
    private var remoteAudioTrack: AudioTrack? = null
    private val attachedRenderers = mutableSetOf<SurfaceViewRenderer>()
    private var localRenderer: SurfaceViewRenderer? = null
    private var remoteRenderer: SurfaceViewRenderer? = null

    private fun ensureFactory(): PeerConnectionFactory {
        factory?.let { return it }
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(appContext)
                .setEnableInternalTracer(false)
                .createInitializationOptions(),
        )
        val encoderFactory = DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true)
        val decoderFactory = DefaultVideoDecoderFactory(eglBase.eglBaseContext)
        val created = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .createPeerConnectionFactory()
        factory = created
        return created
    }

    /** Creates the peer connection and starts local capture (camera+mic for a video call, mic only otherwise). */
    override fun start(iceServers: List<IceServerConfig>, videoEnabled: Boolean) {
        val pcFactory = ensureFactory()
        val rtcConfig = PeerConnection.RTCConfiguration(
            iceServers.map { server ->
                val builder = PeerConnection.IceServer.builder(server.urls)
                if (server.username != null) builder.setUsername(server.username)
                if (server.credential != null) builder.setPassword(server.credential)
                builder.createIceServer()
            },
        ).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
        }

        peerConnection = pcFactory.createPeerConnection(rtcConfig, observer)

        localAudioTrack = createLocalAudioTrack(pcFactory)
        peerConnection?.addTrack(localAudioTrack, listOf(LOCAL_STREAM_ID))

        if (videoEnabled) {
            startCameraCapture(pcFactory)
        }
    }

    private fun createLocalAudioTrack(pcFactory: PeerConnectionFactory): AudioTrack {
        val source = pcFactory.createAudioSource(MediaConstraints())
        audioSource = source
        return pcFactory.createAudioTrack(AUDIO_TRACK_ID, source)
    }

    private fun startCameraCapture(pcFactory: PeerConnectionFactory) {
        val capturer = createCameraCapturer() ?: return
        videoCapturer = capturer

        val helper = SurfaceTextureHelper.create("CaptureThread", eglBase.eglBaseContext)
        surfaceTextureHelper = helper
        val source = pcFactory.createVideoSource(capturer.isScreencast)
        videoSource = source
        capturer.initialize(helper, appContext, source.capturerObserver)
        capturer.startCapture(1280, 720, 30)

        val track = pcFactory.createVideoTrack(VIDEO_TRACK_ID, source)
        localVideoTrack = track
        track.setEnabled(true)
        localRenderer?.let { track.addSink(it) }

        val sender = peerConnection?.addTrack(track, listOf(LOCAL_STREAM_ID))
        cameraVideoSender = sender
        _localVideoTrackAvailable.value = true
    }

    private fun createCameraCapturer(): CameraVideoCapturer? {
        val enumerator = Camera2Enumerator(appContext)
        val names = enumerator.deviceNames
        val front = names.firstOrNull { enumerator.isFrontFacing(it) }
        val back = names.firstOrNull { enumerator.isBackFacing(it) }
        val preferred = front ?: back ?: names.firstOrNull() ?: return null
        return enumerator.createCapturer(preferred, null)
    }

    override fun cameraCount(): Int = Camera2Enumerator(appContext).deviceNames.size

    /** For [com.kothabarta.core.media.ScreenShareManager] — it must build its screen-capture `VideoTrack` from the SAME factory/EGL context this connection uses, then hand the resulting track to [replaceVideoTrackWithScreenShare]. Not part of [WebRtcConnection] — only the real manager exposes it. */
    fun peerConnectionFactoryOrNull(): PeerConnectionFactory? = factory
    override fun eglBaseContext(): EglBase.Context = eglBase.eglBaseContext

    override fun switchCamera() {
        (videoCapturer as? CameraVideoCapturer)?.switchCamera(null)
    }

    override fun setMicEnabled(enabled: Boolean) {
        localAudioTrack?.setEnabled(enabled)
    }

    override fun setCameraEnabled(enabled: Boolean) {
        localVideoTrack?.setEnabled(enabled)
        if (enabled) videoCapturer?.let { runCatching { it.startCapture(1280, 720, 30) } }
        else runCatching { videoCapturer?.stopCapture() }
    }

    /** No renegotiation — a pure track swap on the already-negotiated m-line, matching the web client's `RTCRtpSender.replaceTrack` exactly. */
    override fun replaceVideoTrackWithScreenShare(screenTrack: VideoTrack) {
        screenCaptureVideoTrack = screenTrack
        cameraVideoSender?.setTrack(screenTrack, false)
    }

    /** Swaps the sender back to the camera track (or disables the m-line if this was never a video call). */
    override fun restoreCameraVideoTrack() {
        screenCaptureVideoTrack = null
        cameraVideoSender?.setTrack(localVideoTrack, false)
    }

    override suspend fun createOffer(iceRestart: Boolean): SdpDescription = suspendCoroutine { continuation ->
        val constraints = MediaConstraints().apply {
            if (iceRestart) mandatory.add(MediaConstraints.KeyValuePair("IceRestart", "true"))
        }
        peerConnection?.createOffer(
            object : SdpObserverAdapter() {
                override fun onCreateSuccess(description: SessionDescription?) {
                    if (description == null) {
                        continuation.resumeWithException(IllegalStateException("createOffer returned no description"))
                        return
                    }
                    peerConnection?.setLocalDescription(SdpObserverAdapter(), description)
                    continuation.resume(SdpDescription(description.type.canonicalForm(), description.description))
                }
                override fun onCreateFailure(error: String?) {
                    continuation.resumeWithException(IllegalStateException("createOffer failed: $error"))
                }
            },
            constraints,
        ) ?: continuation.resumeWithException(IllegalStateException("No peer connection"))
    }

    override suspend fun createAnswer(): SdpDescription = suspendCoroutine { continuation ->
        peerConnection?.createAnswer(
            object : SdpObserverAdapter() {
                override fun onCreateSuccess(description: SessionDescription?) {
                    if (description == null) {
                        continuation.resumeWithException(IllegalStateException("createAnswer returned no description"))
                        return
                    }
                    peerConnection?.setLocalDescription(SdpObserverAdapter(), description)
                    continuation.resume(SdpDescription(description.type.canonicalForm(), description.description))
                }
                override fun onCreateFailure(error: String?) {
                    continuation.resumeWithException(IllegalStateException("createAnswer failed: $error"))
                }
            },
            MediaConstraints(),
        ) ?: continuation.resumeWithException(IllegalStateException("No peer connection"))
    }

    /** For a fresh offer/answer round created elsewhere (e.g. after [createOffer]) callers don't need this — it's for setting a REMOTE description delivered via `call:signal`. Local descriptions are set inline by [createOffer]/[createAnswer] above, matching how `setLocalDescription` is always paired with the SDP that was just created. */
    override suspend fun setRemoteDescription(description: SdpDescription): Unit = suspendCoroutine { continuation ->
        val sdp = SessionDescription(SessionDescription.Type.fromCanonicalForm(description.type), description.sdp)
        peerConnection?.setRemoteDescription(
            object : SdpObserverAdapter() {
                override fun onSetSuccess() {
                    remoteDescriptionSet = true
                    val queued = pendingRemoteCandidates.toList()
                    pendingRemoteCandidates.clear()
                    queued.forEach { peerConnection?.addIceCandidate(it) }
                    continuation.resume(Unit)
                }
                override fun onSetFailure(error: String?) = continuation.resumeWithException(IllegalStateException("setRemoteDescription failed: $error"))
            },
            sdp,
        ) ?: continuation.resumeWithException(IllegalStateException("No peer connection"))
    }

    override fun addRemoteIceCandidate(candidate: IceCandidateData) {
        val iceCandidate = IceCandidate(candidate.sdpMid, candidate.sdpMLineIndex, candidate.candidate)
        if (remoteDescriptionSet) peerConnection?.addIceCandidate(iceCandidate) else pendingRemoteCandidates.add(iceCandidate)
    }

    override fun attachLocalRenderer(renderer: SurfaceViewRenderer) {
        initRenderer(renderer)
        localRenderer?.let { localVideoTrack?.removeSink(it) }
        localRenderer = renderer
        localVideoTrack?.addSink(renderer)
    }

    override fun attachRemoteRenderer(renderer: SurfaceViewRenderer) {
        initRenderer(renderer)
        remoteRenderer?.let { remoteVideoTrack?.removeSink(it) }
        remoteRenderer = renderer
        remoteVideoTrack?.addSink(renderer)
    }

    private fun initRenderer(renderer: SurfaceViewRenderer) {
        if (attachedRenderers.add(renderer)) {
            renderer.init(eglBase.eglBaseContext, null)
        }
    }

    override fun release() {
        runCatching { videoCapturer?.stopCapture() }
        videoCapturer?.dispose()
        videoCapturer = null
        surfaceTextureHelper?.dispose()
        surfaceTextureHelper = null
        localVideoTrack?.let { track -> localRenderer?.let(track::removeSink) }
        remoteVideoTrack?.let { track -> remoteRenderer?.let(track::removeSink) }
        attachedRenderers.forEach { runCatching { it.release() } }
        attachedRenderers.clear()
        localRenderer = null
        remoteRenderer = null
        localVideoTrack?.dispose()
        localVideoTrack = null
        localAudioTrack?.dispose()
        localAudioTrack = null
        videoSource?.dispose()
        videoSource = null
        audioSource?.dispose()
        audioSource = null
        screenCaptureVideoTrack = null
        remoteVideoTrack = null
        remoteAudioTrack = null
        remoteDescriptionSet = false
        pendingRemoteCandidates.clear()
        peerConnection?.close()
        peerConnection?.dispose()
        peerConnection = null
        _localVideoTrackAvailable.value = false
        _remoteVideoTrackAvailable.value = false
        _remoteAudioActive.value = false
        _connectionState.value = RtcPeerConnectionState.CLOSED
    }

    /** Fully releases the factory too — call once the app no longer needs WebRTC at all (not between calls). */
    fun releaseFactory() {
        release()
        factory?.dispose()
        factory = null
        eglBase.release()
    }

    private val observer = object : PeerConnection.Observer {
        override fun onSignalingChange(newState: PeerConnection.SignalingState?) {}

        override fun onIceConnectionChange(newState: PeerConnection.IceConnectionState?) {}

        override fun onIceConnectionReceivingChange(receiving: Boolean) {}

        override fun onIceGatheringChange(newState: PeerConnection.IceGatheringState?) {}

        override fun onIceCandidate(candidate: IceCandidate) {
            onLocalIceCandidate?.invoke(IceCandidateData(candidate.sdpMid, candidate.sdpMLineIndex, candidate.sdp))
        }

        override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}

        override fun onAddStream(stream: MediaStream?) {}

        override fun onRemoveStream(stream: MediaStream?) {}

        override fun onDataChannel(channel: org.webrtc.DataChannel?) {}

        override fun onRenegotiationNeeded() {}

        override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) {
            mainHandler.post {
                when (val track = receiver?.track()) {
                    is VideoTrack -> {
                        remoteVideoTrack = track
                        remoteRenderer?.let(track::addSink)
                        track.setEnabled(true)
                        _remoteVideoTrackAvailable.value = true
                    }
                    is AudioTrack -> {
                        remoteAudioTrack = track
                        track.setEnabled(true)
                        _remoteAudioActive.value = true
                    }
                    else -> Unit
                }
            }
        }

        override fun onTrack(transceiver: RtpTransceiver?) {
            onAddTrack(transceiver?.receiver, null)
        }

        override fun onConnectionChange(newState: PeerConnection.PeerConnectionState?) {
            mainHandler.post {
                _connectionState.value = when (newState) {
                    PeerConnection.PeerConnectionState.NEW -> RtcPeerConnectionState.NEW
                    PeerConnection.PeerConnectionState.CONNECTING -> RtcPeerConnectionState.CONNECTING
                    PeerConnection.PeerConnectionState.CONNECTED -> RtcPeerConnectionState.CONNECTED
                    PeerConnection.PeerConnectionState.DISCONNECTED -> RtcPeerConnectionState.DISCONNECTED
                    PeerConnection.PeerConnectionState.FAILED -> RtcPeerConnectionState.FAILED
                    PeerConnection.PeerConnectionState.CLOSED -> RtcPeerConnectionState.CLOSED
                    null -> RtcPeerConnectionState.NEW
                }
            }
        }
    }
}

private open class SdpObserverAdapter : SdpObserver {
    override fun onCreateSuccess(description: SessionDescription?) {}
    override fun onSetSuccess() {}
    override fun onCreateFailure(error: String?) {}
    override fun onSetFailure(error: String?) {}
}
