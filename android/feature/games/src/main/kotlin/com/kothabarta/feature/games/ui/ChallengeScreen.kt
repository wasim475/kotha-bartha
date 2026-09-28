package com.kothabarta.feature.games.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.network.games.ChallengeInviteDto
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.ui.components.AvatarImage
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.theme.Spacing
import org.koin.androidx.compose.koinViewModel

@Composable
fun ChallengeScreen(
    onNavigate: (NavigationEvent) -> Unit,
    onBack: (() -> Unit)? = null,
    viewModel: ChallengeViewModel = koinViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.navigationEvents.collect(onNavigate)
    }

    when {
        state.isLoading -> FullScreenLoading()
        state.error != null && state.onlineFriends.isEmpty() -> FullScreenError(state.error!!, onRetry = viewModel::retry)
        else -> LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(Spacing.md)) {
            onBack?.let { back ->
                item { TextButton(onClick = back) { Text("← Back to games") } }
            }
            if (state.challengeableGames.isNotEmpty()) {
                item {
                    Text("Challenge on", style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(bottom = Spacing.xs))
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.xs), modifier = Modifier.padding(bottom = Spacing.md)) {
                        state.challengeableGames.forEach { game ->
                            FilterChip(
                                selected = state.selectedGameType == game.type,
                                onClick = { viewModel.selectGameType(game.type) },
                                label = { Text(game.name) },
                            )
                        }
                    }
                }
            }
            if (state.incomingInvites.isNotEmpty()) {
                item { Text("Invites for you", style = MaterialTheme.typography.labelLarge) }
                items(state.incomingInvites, key = { "in-${it.id}" }) { invite ->
                    IncomingInviteRow(invite, onAccept = { viewModel.acceptInvite(invite) }, onDecline = { viewModel.declineInvite(invite) })
                }
            }
            if (state.outgoingInvites.isNotEmpty()) {
                item { Text("Sent invites", style = MaterialTheme.typography.labelLarge) }
                items(state.outgoingInvites, key = { "out-${it.id}" }) { invite ->
                    OutgoingInviteRow(invite, onCancel = { viewModel.cancelInvite(invite) })
                }
            }
            item { Text("Online friends", style = MaterialTheme.typography.labelLarge) }
            if (state.onlineFriends.isEmpty()) {
                item {
                    Text(
                        "No friends online right now.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(vertical = Spacing.sm),
                    )
                }
            } else {
                items(state.onlineFriends, key = { it.id }) { friend ->
                    FriendRow(
                        friend,
                        isSending = state.sendingInviteToUserId == friend.id,
                        canInvite = state.selectedGameType != null,
                        onInvite = { viewModel.sendInvite(friend) },
                    )
                }
            }
        }
    }
}

@Composable
private fun IncomingInviteRow(invite: ChallengeInviteDto, onAccept: () -> Unit, onDecline: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = Spacing.xs),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(invite.from?.fullName ?: "Someone", style = MaterialTheme.typography.bodyLarge)
        Row {
            TextButton(onClick = onAccept) { Text("Accept") }
            TextButton(onClick = onDecline) { Text("Decline") }
        }
    }
}

@Composable
private fun OutgoingInviteRow(invite: ChallengeInviteDto, onCancel: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = Spacing.xs),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(invite.to?.fullName ?: "Someone", style = MaterialTheme.typography.bodyLarge)
        TextButton(onClick = onCancel) { Text("Cancel") }
    }
}

@Composable
private fun FriendRow(friend: SafeUserDto, isSending: Boolean, canInvite: Boolean, onInvite: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = Spacing.xs),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            AvatarImage(avatarUrl = friend.avatar?.secureUrl, initials = friend.fullName.take(2))
            Text(friend.fullName, modifier = Modifier.padding(start = Spacing.sm), style = MaterialTheme.typography.bodyLarge)
        }
        TextButton(onClick = onInvite, enabled = canInvite && !isSending) {
            Text(if (isSending) "Sending…" else "Challenge")
        }
    }
}
