package com.kothabarta.feature.calls.ui

import android.Manifest

/** Runtime permissions needed before the app creates an outgoing call. */
internal object CallPermissionPolicy {
    fun requiredPermissions(video: Boolean): List<String> = buildList {
        add(Manifest.permission.RECORD_AUDIO)
        if (video) add(Manifest.permission.CAMERA)
    }
}
