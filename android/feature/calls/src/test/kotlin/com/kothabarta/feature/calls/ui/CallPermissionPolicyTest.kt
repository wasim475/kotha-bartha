package com.kothabarta.feature.calls.ui

import android.Manifest
import org.junit.Assert.assertEquals
import org.junit.Test

class CallPermissionPolicyTest {
    @Test
    fun `audio call requests microphone only`() {
        assertEquals(listOf(Manifest.permission.RECORD_AUDIO), CallPermissionPolicy.requiredPermissions(video = false))
    }

    @Test
    fun `video call requests microphone and camera`() {
        assertEquals(
            listOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA),
            CallPermissionPolicy.requiredPermissions(video = true),
        )
    }
}
