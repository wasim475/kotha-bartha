package com.kothabarta.core.media

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.webrtc.SdpObserver

class LocalDescriptionOrderingTest {

    @Test
    fun signalingContinuesOnlyAfterLocalDescriptionIsApplied() {
        var callback: SdpObserver? = null
        var signalSent = false

        applyLocalDescription(
            apply = { callback = it },
            onSuccess = { signalSent = true },
            onFailure = { error -> throw AssertionError("Unexpected local description failure: $error") },
        )

        assertFalse("offer/answer must not be signaled while setLocalDescription is pending", signalSent)
        callback!!.onSetSuccess()
        assertTrue("offer/answer is signaled after setLocalDescription succeeds", signalSent)
    }

    @Test
    fun localDescriptionFailureDoesNotSignalAnOfferOrAnswer() {
        var callback: SdpObserver? = null
        var signalSent = false
        var failure: String? = null

        applyLocalDescription(
            apply = { callback = it },
            onSuccess = { signalSent = true },
            onFailure = { failure = it },
        )

        callback!!.onSetFailure("invalid signaling state")

        assertFalse(signalSent)
        assertEquals("invalid signaling state", failure)
    }
}
