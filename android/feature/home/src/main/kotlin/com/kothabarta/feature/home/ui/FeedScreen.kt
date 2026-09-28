package com.kothabarta.feature.home.ui

import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.ui.components.EmptyState
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.theme.Spacing
import org.koin.androidx.compose.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedScreen(
    onNavigate: (NavigationEvent) -> Unit,
    viewModel: FeedViewModel = koinViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.navigationEvents.collect(onNavigate)
    }

    when {
        state.isLoading -> FullScreenLoading()
        state.error != null && state.posts.isEmpty() -> FullScreenError(state.error!!, onRetry = viewModel::retry)
        else -> PullToRefreshBox(
            isRefreshing = state.isRefreshing,
            onRefresh = viewModel::refresh,
            modifier = Modifier.fillMaxSize(),
        ) {
            if (state.posts.isEmpty()) {
                EmptyState("Your feed is quiet for now — add friends to see their posts here.")
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(Spacing.md),
                    verticalArrangement = Arrangement.spacedBy(Spacing.md),
                ) {
                    items(state.posts, key = { it.id }) { post ->
                        PostCard(
                            post = post,
                            onOpenPost = viewModel::openPost,
                            onOpenProfile = viewModel::openProfile,
                            onReact = { type -> viewModel.toggleReaction(post, type) },
                        )
                    }
                }
            }
        }
    }
}
