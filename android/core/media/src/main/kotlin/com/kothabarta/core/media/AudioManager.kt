package com.kothabarta.core.media

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Named to avoid colliding with `android.media.AudioManager`, which this wraps. */
enum class AudioRoute { EARPIECE, SPEAKER, BLUETOOTH, WIRED_HEADSET }

/**
 * Wraps `android.media.AudioManager` for in-call audio routing. No web
 * equivalent exists for this — the web client has no device-routing UI at
 * all — this is a purely Android-native addition on top of the ported call
 * flow.
 *
 * Deliberately kept pragmatic: this handles the core earpiece/speaker/
 * Bluetooth-SCO route switching a calling app needs (default route by call
 * type, manual toggle, reacting to devices being plugged/unplugged), but NOT
 * a full production-dialer Bluetooth UX — no device picker when multiple
 * Bluetooth audio devices are paired (the first one Android reports is used),
 * and no attempt to auto-promote a headset that connects mid-call beyond
 * updating [currentRoute] so the UI can react. See [availableRoutes] for the
 * API 26-30 fallback, which can't enumerate real `AudioDeviceInfo`s the way
 * API 31+'s `availableCommunicationDevices` can.
 */
class CallAudioManager(private val context: Context) {

    private val audioManager: AudioManager =
        context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    private var started = false
    private var priorMode = AudioManager.MODE_NORMAL
    private var priorSpeakerphoneOn = false
    private var focusRequest: AudioFocusRequest? = null
    private var deviceCallback: AudioDeviceCallback? = null

    private val _currentRoute = MutableStateFlow(AudioRoute.EARPIECE)
    val currentRoute: StateFlow<AudioRoute> = _currentRoute.asStateFlow()

    /**
     * Begins call audio routing. [speakerDefault] should be true for video
     * calls and false for audio-only calls, matching typical calling-app UX
     * (earpiece default for audio calls / speaker default for video calls) —
     * callers still get a manual [setSpeakerOn] toggle on top of this.
     */
    fun start(speakerDefault: Boolean) {
        if (started) return
        started = true
        priorMode = audioManager.mode
        @Suppress("DEPRECATION")
        priorSpeakerphoneOn = audioManager.isSpeakerphoneOn
        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
        requestAudioFocus()
        registerDeviceCallback()
        setSpeakerOn(speakerDefault)
    }

    private fun requestAudioFocus() {
        // minSdk 26 (>= O) — always the modern builder API, no legacy single-int fallback needed.
        val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()
        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setAudioAttributes(attributes)
            .setAcceptsDelayedFocusGain(true)
            .build()
        focusRequest = request
        audioManager.requestAudioFocus(request)
    }

    private fun registerDeviceCallback() {
        val callback = object : AudioDeviceCallback() {
            override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>) {
                _currentRoute.value = snapshotRoute()
            }

            override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>) {
                _currentRoute.value = snapshotRoute()
            }
        }
        deviceCallback = callback
        audioManager.registerAudioDeviceCallback(callback, null)
    }

    /** Routes this device can plausibly offer right now. Degrades to just EARPIECE/SPEAKER on API < 31. */
    fun availableRoutes(): List<AudioRoute> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val fromDevices = audioManager.availableCommunicationDevices.mapNotNull { it.toAudioRoute() }.distinct()
            fromDevices.ifEmpty { listOf(AudioRoute.EARPIECE, AudioRoute.SPEAKER) }
        } else {
            val routes = mutableListOf(AudioRoute.EARPIECE, AudioRoute.SPEAKER)
            if (audioManager.isBluetoothScoAvailableOffCall) routes.add(AudioRoute.BLUETOOTH)
            @Suppress("DEPRECATION")
            if (audioManager.isWiredHeadsetOn) routes.add(AudioRoute.WIRED_HEADSET)
            routes
        }
    }

    /** Manual speaker toggle. false routes back to the earpiece (not a "previous route" — matches typical dialer UX where the toggle is binary). */
    fun setSpeakerOn(enabled: Boolean) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val targetType = if (enabled) AudioDeviceInfo.TYPE_BUILTIN_SPEAKER else AudioDeviceInfo.TYPE_BUILTIN_EARPIECE
            val device = audioManager.availableCommunicationDevices.firstOrNull { it.type == targetType }
            if (device != null) {
                audioManager.setCommunicationDevice(device)
            } else if (!enabled) {
                audioManager.clearCommunicationDevice()
            }
        } else {
            @Suppress("DEPRECATION")
            audioManager.isSpeakerphoneOn = enabled
        }
        _currentRoute.value = if (enabled) AudioRoute.SPEAKER else AudioRoute.EARPIECE
    }

    /**
     * Starts/stops Bluetooth SCO audio. Guarded by the runtime `BLUETOOTH_CONNECT`
     * permission on API 31+ (the manifest declares it, but it must still be
     * checked at runtime); the permission doesn't exist below API 31.
     */
    fun setBluetoothScoOn(enabled: Boolean) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !MediaPermissions.hasBluetoothConnectPermission(context)) {
            return
        }
        @Suppress("DEPRECATION")
        if (enabled) {
            audioManager.startBluetoothSco()
            audioManager.isBluetoothScoOn = true
            _currentRoute.value = AudioRoute.BLUETOOTH
        } else {
            audioManager.stopBluetoothSco()
            audioManager.isBluetoothScoOn = false
            _currentRoute.value = snapshotRoute()
        }
    }

    /** Restores the prior audio mode/route, abandons focus, unregisters the device callback. */
    fun stop() {
        if (!started) return
        started = false
        deviceCallback?.let { audioManager.unregisterAudioDeviceCallback(it) }
        deviceCallback = null
        runCatching {
            @Suppress("DEPRECATION")
            audioManager.stopBluetoothSco()
            @Suppress("DEPRECATION")
            audioManager.isBluetoothScoOn = false
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            runCatching { audioManager.clearCommunicationDevice() }
        } else {
            @Suppress("DEPRECATION")
            audioManager.isSpeakerphoneOn = priorSpeakerphoneOn
        }
        focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
        focusRequest = null
        audioManager.mode = priorMode
    }

    private fun snapshotRoute(): AudioRoute {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            audioManager.communicationDevice?.toAudioRoute() ?: AudioRoute.EARPIECE
        } else {
            @Suppress("DEPRECATION")
            when {
                audioManager.isBluetoothScoOn -> AudioRoute.BLUETOOTH
                audioManager.isSpeakerphoneOn -> AudioRoute.SPEAKER
                audioManager.isWiredHeadsetOn -> AudioRoute.WIRED_HEADSET
                else -> AudioRoute.EARPIECE
            }
        }
    }

    private fun AudioDeviceInfo.toAudioRoute(): AudioRoute? = when (type) {
        AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> AudioRoute.EARPIECE
        AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> AudioRoute.SPEAKER
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> AudioRoute.BLUETOOTH
        AudioDeviceInfo.TYPE_WIRED_HEADSET, AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> AudioRoute.WIRED_HEADSET
        else -> null
    }
}
