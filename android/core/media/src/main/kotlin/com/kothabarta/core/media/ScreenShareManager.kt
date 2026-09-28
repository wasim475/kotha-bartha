package com.kothabarta.core.media

import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjection
import org.webrtc.EglBase
import org.webrtc.PeerConnectionFactory
import org.webrtc.ScreenCapturerAndroid
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoSource
import org.webrtc.VideoTrack

private const val SCREEN_TRACK_ID = "kb_screen0"
private const val SCREEN_CAPTURE_FPS = 30

/**
 * Reusable, service-agnostic screen-capture piece for the WebRTC screen-share
 * flow. Android's `getDisplayMedia`-equivalent is `MediaProjection`, and it
 * does NOT map directly onto the browser API: obtaining it is a one-shot,
 * OS-gated operation that (since Android 10, stricter on 14+) may only happen
 * from inside an already-`startForeground()`'d service declaring
 * `foregroundServiceType="mediaProjection"` — see
 * `com.kothabarta.feature.calls.service.ScreenShareForegroundService`, the
 * only caller this class is meant to have.
 *
 * **Verified against the real resolved `stream-webrtc-android:1.3.10`
 * artifact** (decompiled `org.webrtc.ScreenCapturerAndroid` via `javap` on the
 * AAR's `classes.jar` — not guessed): its ONLY constructor is
 * `ScreenCapturerAndroid(Intent, MediaProjection.Callback)`. It does **not**
 * accept an already-obtained `MediaProjection`. Instead, the `Intent` (the
 * activity-result `data` from `MediaProjectionManager.createScreenCaptureIntent()`)
 * is stored, and `startCapture(width, height, fps)` is what triggers the
 * capturer's own internal
 * `mediaProjectionManager.getMediaProjection(-1, thatIntent)` call — `-1` is
 * `Activity.RESULT_OK`, hardcoded by the library itself, so the caller's own
 * `resultCode` is never actually consulted by this class (the foreground
 * service still checks it before ever calling [buildScreenTrack], since
 * Android's own contract for the consent dialog result is
 * `resultCode == Activity.RESULT_OK`). This is exactly why [buildScreenTrack]
 * takes an `Intent`, not a `MediaProjection` — the constructor genuinely has
 * no overload for the latter.
 *
 * Bonus finding from the same decompile: `ScreenCapturerAndroid.stopCapture()`
 * already releases its `VirtualDisplay` AND unregisters/stops the
 * `MediaProjection` it created internally — so [stop] does not need to touch
 * a `MediaProjection` handle at all.
 */
class ScreenShareManager(private val context: Context) {

    private var capturer: ScreenCapturerAndroid? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null
    private var videoSource: VideoSource? = null
    private var screenTrack: VideoTrack? = null

    /**
     * Builds a [VideoTrack] backed by [ScreenCapturerAndroid]. [factory] and
     * [eglContext] MUST be the SAME ones the active call's `WebRtcManager` is
     * using (its `peerConnectionFactoryOrNull()`/`eglBaseContext()`) — WebRTC
     * requires every track passed to a given `RTCPeerConnection` to come from
     * the same `PeerConnectionFactory`/EGL context that connection uses.
     *
     * @param permissionResultData the `data: Intent` from
     *   `MediaProjectionManager.createScreenCaptureIntent()`'s activity
     *   result — NOT a pre-obtained `MediaProjection` (see class doc: the
     *   underlying library builds its own from this `Intent`).
     * @param mediaProjectionCallback fired when the projection stops,
     *   including when the user cancels sharing from Android's own
     *   system status-bar "you are sharing your screen" chip.
     * @param dpi accepted for API completeness but effectively unused: the
     *   decompiled `ScreenCapturerAndroid.createVirtualDisplay()` hardcodes
     *   `VIRTUAL_DISPLAY_DPI = 400` itself and never reads a caller-supplied
     *   DPI.
     */
    fun buildScreenTrack(
        permissionResultData: Intent,
        mediaProjectionCallback: MediaProjection.Callback,
        factory: PeerConnectionFactory,
        eglContext: EglBase.Context,
        width: Int,
        height: Int,
        dpi: Int,
    ): VideoTrack {
        val screenCapturer = ScreenCapturerAndroid(permissionResultData, mediaProjectionCallback)
        capturer = screenCapturer

        val helper = SurfaceTextureHelper.create("ScreenCaptureThread", eglContext)
        surfaceTextureHelper = helper

        val source = factory.createVideoSource(/* isScreencast = */ true)
        videoSource = source

        screenCapturer.initialize(helper, context, source.capturerObserver)
        screenCapturer.startCapture(width, height, SCREEN_CAPTURE_FPS)

        val track = factory.createVideoTrack(SCREEN_TRACK_ID, source)
        track.setEnabled(true)
        screenTrack = track
        return track
    }

    /**
     * The `MediaProjection` [ScreenCapturerAndroid] obtained internally once
     * capture started — null before [buildScreenTrack] runs. Exposed for
     * completeness; [stop] does not need it, since `stopCapture()` already
     * releases it (see class doc).
     */
    fun currentMediaProjection(): MediaProjection? = capturer?.mediaProjection

    /**
     * Stops capture and disposes everything this class created (capturer,
     * video source, surface texture helper, track). Ownership discipline
     * mirrors [WebRtcManager.release]: the CALLER decides when this runs —
     * for the screen-share track specifically, that must be AFTER the active
     * call's `RtpSender` has already been swapped back to the camera track
     * (`WebRtcManager.restoreCameraVideoTrack()`, via
     * `CallSessionManager.stopScreenShare()`), never before, or a disposed
     * track would be left attached to a live sender.
     */
    fun stop() {
        runCatching { capturer?.stopCapture() }
        capturer?.dispose()
        capturer = null
        screenTrack?.dispose()
        screenTrack = null
        videoSource?.dispose()
        videoSource = null
        surfaceTextureHelper?.dispose()
        surfaceTextureHelper = null
    }
}
