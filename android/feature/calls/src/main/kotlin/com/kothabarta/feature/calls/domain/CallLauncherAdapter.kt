package com.kothabarta.feature.calls.domain

import com.kothabarta.core.network.call.CallLauncher
import com.kothabarta.core.network.social.MediaRefDto
import com.kothabarta.core.network.social.SafeUserDto

/**
 * Adapts [CallSessionManager.startCall] (which takes a full [SafeUserDto]) to
 * the smaller [CallLauncher] contract other feature modules see (just
 * id/name/avatar-url, the same trio `ConversationLauncher`'s `ChatTarget`
 * already hands around). Kept as a separate adapter rather than having
 * `CallSessionManager` implement [CallLauncher] itself, since
 * `CallSessionManager.kt` is owned by the call-state-machine work and must
 * not be edited here.
 */
class CallLauncherAdapter(private val callSessionManager: CallSessionManager) : CallLauncher {
    override fun startCall(peerId: String, peerName: String, peerAvatarUrl: String?, video: Boolean) {
        val peer = SafeUserDto(
            id = peerId,
            fullName = peerName,
            avatar = peerAvatarUrl?.let { MediaRefDto(secureUrl = it) },
        )
        callSessionManager.startCall(peer, video)
    }
}
