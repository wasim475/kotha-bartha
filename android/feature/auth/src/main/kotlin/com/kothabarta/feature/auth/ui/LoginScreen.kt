package com.kothabarta.feature.auth.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.ui.components.AppPrimaryButton
import com.kothabarta.core.ui.components.AppTextField
import com.kothabarta.core.ui.theme.Spacing
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
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
    var isGooglePickerLoading by remember { mutableStateOf(false) }
    var isPasswordVisible by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.navigationEvents.collect(onNavigate)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
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
            isPasswordVisible = isPasswordVisible,
            onTogglePasswordVisibility = { isPasswordVisible = !isPasswordVisible },
        )
        state.errorMessage?.let { message ->
            Spacer(modifier = Modifier.height(Spacing.xs))
            Text(message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
        Spacer(modifier = Modifier.height(Spacing.lg))

        AppPrimaryButton(
            text = "Log in",
            onClick = viewModel::submit,
            loading = state.isLoading || isGooglePickerLoading,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(modifier = Modifier.height(Spacing.sm))

        OutlinedButton(
            onClick = {
                if (isGooglePickerLoading || state.isLoading) return@OutlinedButton
                if (googleWebClientId.isBlank()) {
                    viewModel.showGoogleSignInError("Google sign-in is not configured for this build.")
                    return@OutlinedButton
                }
                coroutineScope.launch {
                    isGooglePickerLoading = true
                    try {
                        val option = GetGoogleIdOption.Builder()
                            .setFilterByAuthorizedAccounts(false)
                            .setServerClientId(googleWebClientId)
                            .setAutoSelectEnabled(false)
                            .build()
                        val request = GetCredentialRequest.Builder()
                            .addCredentialOption(option)
                            .build()
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
                    } catch (error: CancellationException) {
                        throw error
                    } catch (error: Exception) {
                        googleSignInErrorMessage(error)?.let(viewModel::showGoogleSignInError)
                    } finally {
                        isGooglePickerLoading = false
                    }
                }
            },
            enabled = !state.isLoading && !isGooglePickerLoading,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                if (isGooglePickerLoading || state.isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.size(10.dp))
                } else {
                    Text("G", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.size(10.dp))
                }
                Text(if (isGooglePickerLoading || state.isLoading) "Connecting to Google…" else "Continue with Google")
            }
        }
        Spacer(modifier = Modifier.height(Spacing.sm))

        TextButton(onClick = viewModel::goToSignup) {
            Text("New here? Create an account")
        }
    }
}
