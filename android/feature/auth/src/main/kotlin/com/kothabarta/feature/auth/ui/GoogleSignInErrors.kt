package com.kothabarta.feature.auth.ui

import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException

/** User cancellation is intentionally silent; returned strings are safe UI copy, never exception details. */
internal fun googleSignInErrorMessage(error: Exception): String? = when (error) {
    is GetCredentialCancellationException -> null
    is GetCredentialException -> "Google sign-in failed. Check Google Play services and try again."
    is GoogleIdTokenParsingException -> "Google sign-in returned an invalid credential. Please try again."
    else -> "Google sign-in failed. Please try again."
}
