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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.IconButton
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.kothabarta.core.ui.components.AppIcon
import com.kothabarta.core.ui.components.AppSymbol
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
    var pendingAction by remember { mutableStateOf<Pair<SafeUserDto, FriendAction>?>(null) }

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
                FriendsTab.FRIENDS -> FriendsList(state.friends, state.onlineUserIds, state.actionInFlightId, viewModel) { friend, action -> pendingAction = friend to action }
                FriendsTab.REQUESTS -> RequestsList(state.requests, isSent = false, viewModel)
                FriendsTab.SENT -> RequestsList(state.sent, isSent = true, viewModel)
            }
        }
    }

    pendingAction?.let { (friend, action) ->
        val isBlock = action == FriendAction.BLOCK
        AlertDialog(
            onDismissRequest = { if (state.actionInFlightId == null) pendingAction = null },
            title = { Text(if (isBlock) "Block this person?" else "Unfriend this person?") },
            text = {
                Text(if (isBlock) "Are you sure you want to block ${friend.fullName}? Blocking may restrict messaging and other interactions according to your app's block rules."
                else "Are you sure you want to unfriend ${friend.fullName}? You may need to send a new friend request to connect again.")
            },
            confirmButton = {
                TextButton(
                    enabled = state.actionInFlightId == null,
                    onClick = { if (isBlock) viewModel.block(friend) else viewModel.unfriend(friend); pendingAction = null },
                ) { Text(if (isBlock) "Block" else "Unfriend") }
            },
            dismissButton = { TextButton(enabled = state.actionInFlightId == null, onClick = { pendingAction = null }) { Text("Cancel") } },
        )
    }
    state.actionError?.let { message ->
        AlertDialog(
            onDismissRequest = viewModel::dismissActionError,
            title = { Text("Action failed") },
            text = { Text(message) },
            confirmButton = { TextButton(onClick = viewModel::dismissActionError) { Text("OK") } },
        )
    }
}

@Composable
private fun FriendsList(friends: List<SafeUserDto>, onlineUserIds: Set<String>, actionInFlightId: String?, viewModel: FriendsViewModel, onAction: (SafeUserDto, FriendAction) -> Unit) {
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
                TextButton(onClick = { viewModel.openMessage(friend.id) }, enabled = actionInFlightId == null) { Text("Message") }
                FriendActionsMenu(
                    enabled = actionInFlightId == null,
                    loading = actionInFlightId == friend.id,
                    onBlock = { onAction(friend, FriendAction.BLOCK) },
                    onUnfriend = { onAction(friend, FriendAction.UNFRIEND) },
                )
            }
        }
    }
}

private enum class FriendAction { BLOCK, UNFRIEND }

@Composable
private fun FriendActionsMenu(enabled: Boolean, loading: Boolean, onBlock: () -> Unit, onUnfriend: () -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { expanded = true }, enabled = enabled, modifier = Modifier.size(48.dp)) {
            if (loading) CircularProgressIndicator(modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
            else AppIcon(AppSymbol.MORE_VERT, contentDescription = "Friend actions")
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(text = { Text("Block") }, leadingIcon = { AppIcon(AppSymbol.BLOCK, contentDescription = null) }, onClick = { expanded = false; onBlock() })
            DropdownMenuItem(text = { Text("Unfriend") }, leadingIcon = { AppIcon(AppSymbol.PERSON_REMOVE, contentDescription = null) }, onClick = { expanded = false; onUnfriend() })
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
