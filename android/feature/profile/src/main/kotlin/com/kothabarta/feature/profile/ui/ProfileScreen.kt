package com.kothabarta.feature.profile.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.ui.components.AvatarImage
import com.kothabarta.core.ui.components.EmptyState
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.components.NetworkImage
import com.kothabarta.core.ui.theme.Spacing
import org.koin.androidx.compose.koinViewModel
import org.koin.core.parameter.parametersOf

/** [userId] `null` shows the signed-in user's own profile — see [ProfileViewModel]. */
@Composable
fun ProfileScreen(
    userId: String?,
    onNavigate: (NavigationEvent) -> Unit,
    viewModel: ProfileViewModel = koinViewModel(parameters = { parametersOf(userId) }),
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.navigationEvents.collect(onNavigate)
    }

    when {
        state.isLoading -> FullScreenLoading()
        state.profile == null -> FullScreenError(state.error ?: "This profile isn't available.", onRetry = viewModel::retry)
        else -> ProfileContent(state, viewModel)
    }
}

@Composable
private fun ProfileContent(state: ProfileUiState, viewModel: ProfileViewModel) {
    val profile = state.profile!!
    Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Spacing.md),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            AvatarImage(avatarUrl = profile.avatarUrl, initials = profile.initials, size = 88.dp)
            Spacer(Modifier.height(Spacing.sm))
            Text(profile.fullName, style = MaterialTheme.typography.titleLarge)
            profile.friendCount?.let {
                Text("$it friends", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.height(Spacing.sm))
            FriendActionRow(state, viewModel)
            state.friendActionError?.let {
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.labelMedium)
            }
        }

        TabRow(selectedTabIndex = state.tab.ordinal) {
            ProfileTab.entries.forEach { tab ->
                Tab(
                    selected = state.tab == tab,
                    onClick = { viewModel.selectTab(tab) },
                    text = { Text(tab.name.lowercase().replaceFirstChar { it.uppercase() }) },
                )
            }
        }

        when (state.tab) {
            ProfileTab.ABOUT -> AboutTab(profile.bio, profile.hometown, profile.currentCity)
            ProfileTab.POSTS -> if (state.contentRestricted) {
                EmptyState("Add them as a friend to see their posts.")
            } else if (state.posts.isEmpty()) {
                EmptyState("No posts yet.")
            } else {
                LazyColumn(contentPadding = androidx.compose.foundation.layout.PaddingValues(Spacing.md)) {
                    items(state.posts, key = { it.id }) { post ->
                        Text(post.body, modifier = Modifier.padding(bottom = Spacing.md))
                    }
                }
            }
            ProfileTab.PHOTOS -> if (state.contentRestricted) {
                EmptyState("Add them as a friend to see their photos.")
            } else if (state.photos.isEmpty()) {
                EmptyState("No photos yet.")
            } else {
                LazyVerticalGrid(columns = GridCells.Fixed(3), contentPadding = androidx.compose.foundation.layout.PaddingValues(2.dp)) {
                    items(state.photos, key = { it.postId + it.url }) { photo ->
                        NetworkImage(
                            url = photo.url,
                            contentDescription = null,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(120.dp)
                                .padding(2.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AboutTab(bio: String?, hometown: String?, currentCity: String?) {
    Column(modifier = Modifier.padding(Spacing.md)) {
        if (bio.isNullOrBlank() && hometown.isNullOrBlank() && currentCity.isNullOrBlank()) {
            Text("Nothing to show yet.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            bio?.takeIf { it.isNotBlank() }?.let { Text(it, modifier = Modifier.padding(bottom = Spacing.sm)) }
            hometown?.takeIf { it.isNotBlank() }?.let { Text("From $it", modifier = Modifier.padding(bottom = Spacing.xs)) }
            currentCity?.takeIf { it.isNotBlank() }?.let { Text("Lives in $it") }
        }
    }
}

@Composable
private fun FriendActionRow(state: ProfileUiState, viewModel: ProfileViewModel) {
    val profile = state.profile!!
    if (profile.isOwn) {
        TextButton(onClick = viewModel::logout) { Text("Log out") }
        return
    }
    if (profile.hasBlockedMe) {
        Text("You can't interact with this profile.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        return
    }
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
        when {
            profile.friendRequestReceived -> Button(onClick = viewModel::acceptFriendRequest, enabled = !state.friendActionInFlight) {
                Text("Accept request")
            }
            profile.isFriend -> OutlinedButton(onClick = viewModel::unfriend, enabled = !state.friendActionInFlight) {
                Text("Friends")
            }
            profile.friendRequestSent -> OutlinedButton(onClick = viewModel::cancelFriendRequest, enabled = !state.friendActionInFlight) {
                Text("Request sent")
            }
            else -> Button(onClick = viewModel::sendFriendRequest, enabled = !state.friendActionInFlight) {
                Text("Add friend")
            }
        }
        OutlinedButton(onClick = { /* Messages isn't built yet — see Routes.MESSAGES */ }) {
            Text("Message")
        }
    }
}
