package com.kothabarta.core.media

import kotlinx.coroutines.flow.StateFlow
import org.webrtc.EglBase
import org.webrtc.SurfaceViewRenderer
import org.webrtc.VideoTrack

/**
 * Everything [com.kothabarta.feature.calls.domain.CallSessionManager] needs from one
 * `RTCPeerConnection`, extracted purely so a JVM unit test can inject a pure-Kotlin fake
 * instead of the real [WebRtcManager] — merely constructing a real `WebRtcManager` (its
 * `EglBase.create()`/`PeerConnectionFactory.initialize()` calls) requires a real Android/JNI
 * runtime and would crash a plain `testDebugUnitTest` run, unlike every other class in this
 * codebase so far. Production code always uses [WebRtcManager]; only tests substitute this.
 */
interface WebRtcConnection {
    val connectionState: StateFlow<RtcPeerConnectionState>
    val localVideoTrackAvailable: StateFlow<Boolean>
    val remoteVideoTrackAvailable: StateFlow<Boolean>
    val remoteAudioActive: StateFlow<Boolean>
    var onLocalIceCandidate: ((IceCandidateData) -> Unit)?

    fun start(iceServers: List<IceServerConfig>, videoEnabled: Boolean)
    suspend fun createOffer(iceRestart: Boolean = false): SdpDescription
    suspend fun createAnswer(): SdpDescription
    suspend fun setRemoteDescription(description: SdpDescription)
    fun addRemoteIceCandidate(candidate: IceCandidateData)
    fun setMicEnabled(enabled: Boolean)
    fun setCameraEnabled(enabled: Boolean)
    fun switchCamera()
    fun cameraCount(): Int
    fun replaceVideoTrackWithScreenShare(screenTrack: VideoTrack)
    fun restoreCameraVideoTrack()
    fun attachLocalRenderer(renderer: SurfaceViewRenderer)
    fun attachRemoteRenderer(renderer: SurfaceViewRenderer)
    fun eglBaseContext(): EglBase.Context
    fun release()
}
