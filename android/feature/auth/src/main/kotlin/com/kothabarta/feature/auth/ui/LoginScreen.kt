package com.kothabarta.feature.auth.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.ui.components.AppPrimaryButton
import com.kothabarta.core.ui.components.AppTextField
import com.kothabarta.core.ui.theme.Spacing
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import kotlinx.coroutines.launch
import org.koin.androidx.compose.koinViewModel

@Composable
fun LoginScreen(
    onNavigate: (NavigationEvent) -> Unit,
    googleWebClientId: String,
    viewModel: LoginViewModel = koinViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val credentialManager = remember(context) { CredentialManager.create(context) }
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        viewModel.navigationEvents.collect(onNavigate)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(Spacing.lg),
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Welcome back", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(Spacing.xl))

        AppTextField(
            value = state.email,
            onValueChange = viewModel::onEmailChange,
            label = "Email",
            keyboardType = KeyboardType.Email,
        )
        Spacer(modifier = Modifier.height(Spacing.md))
        AppTextField(
            value = state.password,
            onValueChange = viewModel::onPasswordChange,
            label = "Password",
            isPassword = true,
        )
        state.errorMessage?.let { message ->
            Spacer(modifier = Modifier.height(Spacing.xs))
            Text(message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
        Spacer(modifier = Modifier.height(Spacing.lg))

        AppPrimaryButton(
            text = "Log in",
            onClick = viewModel::submit,
            loading = state.isLoading,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(modifier = Modifier.height(Spacing.sm))

        OutlinedButton(
            onClick = {
                if (googleWebClientId.isBlank()) {
                    viewModel.showGoogleSignInError("Google sign-in is not configured for this build.")
                    return@OutlinedButton
                }
                coroutineScope.launch {
                    val option = GetGoogleIdOption.Builder()
                        .setFilterByAuthorizedAccounts(false)
                        .setServerClientId(googleWebClientId)
                        .setAutoSelectEnabled(false)
                        .build()
                    val request = GetCredentialRequest.Builder()
                        .addCredentialOption(option)
                        .build()
                    try {
                        val result = credentialManager.getCredential(context, request)
                        val credential = result.credential
                        if (credential is CustomCredential &&
                            credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
                        ) {
                            val token = GoogleIdTokenCredential.createFrom(credential.data).idToken
                            viewModel.loginWithGoogle(token)
                        } else {
                            viewModel.showGoogleSignInError("Choose a Google account to continue.")
                        }
                    } catch (error: GetCredentialCancellationException) {
                        // Closing the account picker is not an authentication error.
                    } catch (error: GetCredentialException) {
                        viewModel.showGoogleSignInError("Google sign-in failed. Check Google Play services and try again.")
                    } catch (error: GoogleIdTokenParsingException) {
                        viewModel.showGoogleSignInError("Google sign-in returned an invalid credential. Please try again.")
                    }
                }
            },
            enabled = !state.isLoading,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Continue with Google")
        }
        Spacer(modifier = Modifier.height(Spacing.sm))

        TextButton(onClick = viewModel::goToSignup) {
            Text("New here? Create an account")
        }
    }
}
