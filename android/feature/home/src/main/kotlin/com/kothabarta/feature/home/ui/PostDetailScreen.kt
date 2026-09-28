package com.kothabarta.feature.home.ui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.theme.Spacing
import org.koin.androidx.compose.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun PostDetailScreen(
    postId: String,
    onNavigate: (NavigationEvent) -> Unit,
    viewModel: PostDetailViewModel = koinViewModel(parameters = { parametersOf(postId) }),
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.navigationEvents.collect(onNavigate)
    }

    when {
        state.isLoading -> FullScreenLoading()
        state.post == null -> FullScreenError(state.error ?: "This post is no longer available.", onRetry = viewModel::retry)
        else -> PostCard(
            post = state.post!!,
            onOpenPost = {},
            onOpenProfile = viewModel::openProfile,
            onReact = viewModel::toggleReaction,
            modifier = Modifier
                .fillMaxSize()
                .padding(Spacing.md),
        )
    }
}
