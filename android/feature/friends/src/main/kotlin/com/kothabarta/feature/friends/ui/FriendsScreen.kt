package com.kothabarta.feature.friends.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.network.social.FriendEntryDto
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.ui.components.AvatarImage
import com.kothabarta.core.ui.components.EmptyState
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.theme.Spacing
import org.koin.androidx.compose.koinViewModel

@Composable
fun FriendsScreen(
    onNavigate: (NavigationEvent) -> Unit,
    viewModel: FriendsViewModel = koinViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.navigationEvents.collect(onNavigate)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TabRow(selectedTabIndex = state.tab.ordinal) {
            FriendsTab.entries.forEach { tab ->
                Tab(
                    selected = state.tab == tab,
                    onClick = { viewModel.selectTab(tab) },
                    text = { Text(tab.name.lowercase().replaceFirstChar { it.uppercase() }) },
                )
            }
        }

        when {
            state.isLoading -> FullScreenLoading()
            state.error != null -> FullScreenError(state.error!!, onRetry = { viewModel.selectTab(state.tab) })
            else -> when (state.tab) {
                FriendsTab.FRIENDS -> FriendsList(state.friends, state.onlineUserIds, viewModel)
                FriendsTab.REQUESTS -> RequestsList(state.requests, isSent = false, viewModel)
                FriendsTab.SENT -> RequestsList(state.sent, isSent = true, viewModel)
            }
        }
    }
}

@Composable
private fun FriendsList(friends: List<SafeUserDto>, onlineUserIds: Set<String>, viewModel: FriendsViewModel) {
    if (friends.isEmpty()) {
        EmptyState("No friends yet.")
        return
    }
    LazyColumn(contentPadding = androidx.compose.foundation.layout.PaddingValues(Spacing.md)) {
        items(friends, key = { it.id }) { friend ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = Spacing.md)
                    .clickable { viewModel.openProfile(friend.id) },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box {
                    AvatarImage(avatarUrl = friend.avatar?.secureUrl, initials = friend.initials ?: friend.fullName)
                    if (friend.id in onlineUserIds) {
                        Box(
                            modifier = Modifier
                                .size(12.dp)
                                .align(Alignment.BottomEnd)
                                .clip(CircleShape)
                                .background(Color(0xFF4CAF50)),
                        )
                    }
                }
                Text(friend.fullName, modifier = Modifier.padding(start = Spacing.sm).weight(1f), style = MaterialTheme.typography.titleMedium)
                TextButton(onClick = { viewModel.openMessage(friend.id) }) { Text("Message") }
                OutlinedButton(onClick = { viewModel.unfriend(friend) }) { Text("Unfriend") }
            }
        }
    }
}

@Composable
private fun RequestsList(entries: List<FriendEntryDto>, isSent: Boolean, viewModel: FriendsViewModel) {
    if (entries.isEmpty()) {
        EmptyState(if (isSent) "No pending sent requests." else "No pending requests.")
        return
    }
    LazyColumn(contentPadding = androidx.compose.foundation.layout.PaddingValues(Spacing.md)) {
        items(entries, key = { it.id ?: it.user?.id.orEmpty() }) { entry ->
            val user = entry.user ?: return@items
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = Spacing.md)
                    .clickable { viewModel.openProfile(user.id) },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                AvatarImage(avatarUrl = user.avatar?.secureUrl, initials = user.initials ?: user.fullName)
                Text(user.fullName, modifier = Modifier.padding(start = Spacing.sm).weight(1f), style = MaterialTheme.typography.titleMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                    if (!isSent) {
                        Button(onClick = { viewModel.acceptRequest(entry) }) { Text("Accept") }
                    }
                    OutlinedButton(onClick = { viewModel.declineOrCancel(entry) }) { Text(if (isSent) "Cancel" else "Decline") }
                }
            }
        }
    }
}
