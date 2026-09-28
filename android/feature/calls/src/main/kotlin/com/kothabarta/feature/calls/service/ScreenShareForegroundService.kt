package com.kothabarta.feature.calls.service

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.projection.MediaProjection
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.kothabarta.core.media.ScreenShareManager
import com.kothabarta.feature.calls.domain.CallSessionManager
import kotlinx.coroutines.flow.MutableSharedFlow
import org.koin.android.ext.android.inject

/**
 * Foreground service that owns the OS-level `MediaProjection` lifecycle for
 * screen sharing. Android requires `MediaProjectionManager.getMediaProjection`
 * (here, triggered internally by `ScreenCapturerAndroid.startCapture` — see
 * [ScreenShareManager]'s class doc for how that was verified against the real
 * library) to only ever happen from inside an already-`startForeground()`'d
 * service declaring `foregroundServiceType="mediaProjection"` — enforced
 * since Android 10, stricter still on Android 14+. A plain ViewModel/Activity
 * cannot do this, hence this service.
 *
 * Wiring decision (the task explicitly leaves this to judgment): this
 * service injects the app-wide [CallSessionManager] Koin single directly
 * (via `koin-android`'s `by inject()` extension, available on any
 * `ComponentCallbacks` including `Service` — no explicit `KoinComponent`
 * mixin needed) and does the full
 * `ScreenShareManager.buildScreenTrack` -> `CallSessionManager.applyScreenShareTrack`
 * / `CallSessionManager.stopScreenShare` -> `ScreenShareManager.stop` wiring
 * itself, end to end, rather than exposing the raw `MediaProjection`/track for
 * some other component to finish wiring up. Reasoning: the `MediaProjection`
 * is a resource only this foreground service is allowed to obtain in the
 * first place, so keeping its full lifecycle (including the swap back to the
 * camera track) inside the one component that owns it avoids a second place
 * racing to dispose the same WebRTC track. The starting UI (built by another
 * agent) only needs to launch this service via [createIntent] with the
 * `MediaProjectionManager.createScreenCaptureIntent()` activity result —
 * everything downstream of that is this service's job. [ScreenShareEvents]
 * is a secondary, best-effort notification channel for anything that wants a
 * heads-up distinct from observing `CallSessionManager.state.screenShareActive`
 * (e.g. a toast when the system, not the user, ended the share); it is not
 * required for correctness since this service already drives
 * [CallSessionManager] itself.
 *
 * Stop ordering matters: both stop paths below (the notification's own Stop
 * action, and [MediaProjection.Callback.onStop] firing when the user cancels
 * from Android's system status-bar "sharing" chip) call
 * [CallSessionManager.stopScreenShare] BEFORE [ScreenShareManager.stop] —
 * `stopScreenShare()` swaps the peer connection's `RtpSender` back to the
 * camera track first; disposing the screen-share `VideoTrack`
 * ([ScreenShareManager.stop]) while it is still attached to a live sender
 * would leave that sender holding a disposed track.
 */
class ScreenShareForegroundService : Service() {

    private val callSessionManager: CallSessionManager by inject()
    private val screenShareManager: ScreenShareManager by lazy { ScreenShareManager(applicationContext) }

    private var isSharingActive = false

    private val mediaProjectionCallback = object : MediaProjection.Callback() {
        override fun onStop() {
            // Fired by the OS when the user cancels sharing from the system status-bar chip.
            stopSharing()
            stopSelf()
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSharing()
            stopSelf()
            return START_NOT_STICKY
        }
        startSharing(intent)
        return START_NOT_STICKY
    }

    private fun startSharing(intent: Intent?) {
        // Must be called within moments of the service starting, before any other
        // work — Android tears down the service if startForeground() is late.
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED) ?: Activity.RESULT_CANCELED
        val data = intent?.parcelableDataExtra(EXTRA_DATA)
        if (resultCode != Activity.RESULT_OK || data == null) {
            stopSelf()
            return
        }

        val webRtcManager = callSessionManager.currentWebRtcManager()
        val factory = webRtcManager?.peerConnectionFactoryOrNull()
        if (webRtcManager == null || factory == null) {
            // No active call / peer connection to attach the screen track to.
            stopSelf()
            return
        }

        val metrics = resources.displayMetrics
        val width = intent.getIntExtra(EXTRA_WIDTH, metrics.widthPixels)
        val height = intent.getIntExtra(EXTRA_HEIGHT, metrics.heightPixels)
        val dpi = intent.getIntExtra(EXTRA_DPI, metrics.densityDpi)

        val track = screenShareManager.buildScreenTrack(
            permissionResultData = data,
            mediaProjectionCallback = mediaProjectionCallback,
            factory = factory,
            eglContext = webRtcManager.eglBaseContext(),
            width = width,
            height = height,
            dpi = dpi,
        )
        isSharingActive = true
        callSessionManager.applyScreenShareTrack(track)
    }

    private fun stopSharing() {
        if (!isSharingActive) return
        isSharingActive = false
        callSessionManager.stopScreenShare() // swap RtpSender back to camera first (see class doc)
        screenShareManager.stop()
        ScreenShareEvents.stopped.tryEmit(Unit)
    }

    override fun onDestroy() {
        stopSharing() // safety net if the service is torn down without going through ACTION_STOP/onStop first
        stopForegroundCompat()
        super.onDestroy()
    }

    private fun stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Screen sharing", NotificationManager.IMPORTANCE_LOW)
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            0,
            stopIntent(this),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Sharing your screen")
            .setSmallIcon(android.R.drawable.ic_menu_share)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(0, "Stop", stopPendingIntent)
            .build()
    }

    @Suppress("DEPRECATION")
    private fun Intent.parcelableDataExtra(key: String): Intent? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getParcelableExtra(key, Intent::class.java)
        } else {
            getParcelableExtra(key)
        }

    companion object {
        private const val CHANNEL_ID = "screen_share"
        private const val NOTIFICATION_ID = 8420
        private const val ACTION_STOP = "com.kothabarta.feature.calls.action.STOP_SCREEN_SHARE"

        // NOTE: these two exact string values are a cross-file contract with
        // `ui/CallControls.kt` (built in parallel, already merged when this file was
        // written) — it starts this service with its own raw `Intent`, keyed
        // "resultCode"/"data", rather than via `createIntent` below. Keep these in
        // sync with that file's `EXTRA_RESULT_CODE`/`EXTRA_RESULT_DATA` constants if
        // either changes.
        private const val EXTRA_RESULT_CODE = "resultCode"
        private const val EXTRA_DATA = "data"
        private const val EXTRA_WIDTH = "extra_width"
        private const val EXTRA_HEIGHT = "extra_height"
        private const val EXTRA_DPI = "extra_dpi"

        /**
         * Builds this service's start [Intent] from the activity-result
         * `resultCode`/`data` of `MediaProjectionManager.createScreenCaptureIntent()`.
         * [width]/[height]/[dpi] default to this device's real display metrics
         * when omitted (note: [ScreenShareManager.buildScreenTrack]'s `dpi` is
         * effectively unused by the underlying library — see its doc).
         */
        fun createIntent(
            context: Context,
            resultCode: Int,
            data: Intent,
            width: Int? = null,
            height: Int? = null,
            dpi: Int? = null,
        ): Intent = Intent(context, ScreenShareForegroundService::class.java)
            .putExtra(EXTRA_RESULT_CODE, resultCode)
            .putExtra(EXTRA_DATA, data)
            .apply {
                if (width != null) putExtra(EXTRA_WIDTH, width)
                if (height != null) putExtra(EXTRA_HEIGHT, height)
                if (dpi != null) putExtra(EXTRA_DPI, dpi)
            }

        /** Stops sharing and tears down the service — equivalent to tapping the notification's own Stop action. */
        fun stopIntent(context: Context): Intent =
            Intent(context, ScreenShareForegroundService::class.java).setAction(ACTION_STOP)
    }
}

/**
 * Best-effort notification channel for screen-share stops this service
 * initiates on its own (system cancellation, notification Stop action) — see
 * [ScreenShareForegroundService]'s class doc for why this is a bonus signal,
 * not the primary correctness mechanism (this service already drives
 * [CallSessionManager] directly).
 */
object ScreenShareEvents {
    val stopped = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
}
