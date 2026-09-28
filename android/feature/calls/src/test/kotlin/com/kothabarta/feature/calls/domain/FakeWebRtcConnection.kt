package com.kothabarta.feature.calls.domain

import com.kothabarta.core.media.IceCandidateData
import com.kothabarta.core.media.IceServerConfig
import com.kothabarta.core.media.RtcPeerConnectionState
import com.kothabarta.core.media.SdpDescription
import com.kothabarta.core.media.WebRtcConnection
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.webrtc.EglBase
import org.webrtc.SurfaceViewRenderer
import org.webrtc.VideoTrack

/** A pure-Kotlin test double for [WebRtcConnection] — see that interface's KDoc for why a real [com.kothabarta.core.media.WebRtcManager] can't be used in a JVM unit test. */
class FakeWebRtcConnection : WebRtcConnection {
    private val _connectionState = MutableStateFlow(RtcPeerConnectionState.NEW)
    override val connectionState: StateFlow<RtcPeerConnectionState> = _connectionState.asStateFlow()

    private val _localVideoTrackAvailable = MutableStateFlow(false)
    override val localVideoTrackAvailable: StateFlow<Boolean> = _localVideoTrackAvailable.asStateFlow()

    private val _remoteVideoTrackAvailable = MutableStateFlow(false)
    override val remoteVideoTrackAvailable: StateFlow<Boolean> = _remoteVideoTrackAvailable.asStateFlow()

    private val _remoteAudioActive = MutableStateFlow(false)
    override val remoteAudioActive: StateFlow<Boolean> = _remoteAudioActive.asStateFlow()

    override var onLocalIceCandidate: ((IceCandidateData) -> Unit)? = null

    var startCallCount = 0
        private set
    var lastStartVideoEnabled: Boolean? = null
        private set
    var offerCount = 0
        private set
    var answerCount = 0
        private set
    var lastIceRestart: Boolean? = null
        private set
    var lastRemoteDescription: SdpDescription? = null
        private set
    var micEnabled = true
        private set
    var cameraEnabled = true
        private set
    var released = false
        private set
    var offerToReturn = SdpDescription("offer", "fake-offer-sdp")
    var answerToReturn = SdpDescription("answer", "fake-answer-sdp")

    override fun start(iceServers: List<IceServerConfig>, videoEnabled: Boolean) {
        startCallCount++
        lastStartVideoEnabled = videoEnabled
    }

    override suspend fun createOffer(iceRestart: Boolean): SdpDescription {
        offerCount++
        lastIceRestart = iceRestart
        return offerToReturn
    }

    override suspend fun createAnswer(): SdpDescription {
        answerCount++
        return answerToReturn
    }

    override suspend fun setRemoteDescription(description: SdpDescription) {
        lastRemoteDescription = description
    }

    override fun addRemoteIceCandidate(candidate: IceCandidateData) = Unit
    override fun setMicEnabled(enabled: Boolean) { micEnabled = enabled }
    override fun setCameraEnabled(enabled: Boolean) { cameraEnabled = enabled }
    override fun switchCamera() = Unit
    override fun cameraCount(): Int = 2
    override fun replaceVideoTrackWithScreenShare(screenTrack: VideoTrack) = Unit
    override fun restoreCameraVideoTrack() = Unit
    override fun attachLocalRenderer(renderer: SurfaceViewRenderer) = Unit
    override fun attachRemoteRenderer(renderer: SurfaceViewRenderer) = Unit
    override fun eglBaseContext(): EglBase.Context = error("not exercised by CallSessionManagerTest")
    override fun release() { released = true }

    fun emitConnectionState(newState: RtcPeerConnectionState) {
        _connectionState.value = newState
    }
}
