package com.kothabarta.feature.tictactoe.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.network.tictactoe.TttGameDto
import com.kothabarta.core.network.tictactoe.TttInviteDto
import com.kothabarta.core.ui.components.AvatarImage
import com.kothabarta.core.ui.components.EmptyState
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.theme.Spacing
import org.koin.androidx.compose.koinViewModel

@Composable
fun TttLobbyScreen(
    onNavigate: (NavigationEvent) -> Unit,
    viewModel: TttLobbyViewModel = koinViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.navigationEvents.collect(onNavigate)
    }

    when {
        state.isLoading -> FullScreenLoading()
        state.error != null && state.onlineFriends.isEmpty() && state.activeGames.isEmpty() ->
            FullScreenError(state.error!!, onRetry = viewModel::retry)
        else -> LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(Spacing.md)) {
            if (state.activeGames.isNotEmpty()) {
                item { SectionHeader("Active games") }
                items(state.activeGames, key = { "game-${it.id}" }) { game ->
                    ActiveGameRow(game, onClick = { viewModel.openGame(game.id) })
                }
            }
            if (state.incomingInvites.isNotEmpty()) {
                item { SectionHeader("Invites for you") }
                items(state.incomingInvites, key = { "in-${it.id}" }) { invite ->
                    IncomingInviteRow(
                        invite,
                        onAccept = { viewModel.acceptInvite(invite) },
                        onDecline = { viewModel.declineInvite(invite) },
                    )
                }
            }
            if (state.outgoingInvites.isNotEmpty()) {
                item { SectionHeader("Sent invites") }
                items(state.outgoingInvites, key = { "out-${it.id}" }) { invite ->
                    OutgoingInviteRow(invite, onCancel = { viewModel.cancelInvite(invite) })
                }
            }
            item { SectionHeader("Friends online") }
            if (state.onlineFriends.isEmpty()) {
                item { EmptyState("No friends online right now.") }
            } else {
                items(state.onlineFriends, key = { "friend-${it.id}" }) { friend ->
                    OnlineFriendRow(
                        friend,
                        isSending = state.sendingInviteToUserId == friend.id,
                        onInvite = { viewModel.invite(friend) },
                    )
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        title,
        style = MaterialTheme.typography.titleMedium,
        modifier = Modifier.padding(top = Spacing.md, bottom = Spacing.sm),
    )
}

@Composable
private fun ActiveGameRow(game: TttGameDto, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = Spacing.sm),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("vs ${game.playerO?.fullName ?: game.playerX?.fullName ?: "Opponent"}", style = MaterialTheme.typography.bodyLarge)
        Text(game.status, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun OnlineFriendRow(friend: SafeUserDto, isSending: Boolean, onInvite: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            AvatarImage(avatarUrl = friend.avatar?.secureUrl, initials = friend.initials ?: friend.fullName, size = 40.dp)
            Text(friend.fullName, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(start = Spacing.sm))
        }
        Button(onClick = onInvite, enabled = !isSending) {
            Text(if (isSending) "Inviting…" else "Invite")
        }
    }
}

@Composable
private fun IncomingInviteRow(invite: TttInviteDto, onAccept: () -> Unit, onDecline: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(invite.from?.fullName ?: "Someone", style = MaterialTheme.typography.bodyLarge)
        Row {
            TextButton(onClick = onDecline) { Text("Decline") }
            Button(onClick = onAccept, modifier = Modifier.padding(start = Spacing.sm)) { Text("Accept") }
        }
    }
}

@Composable
private fun OutgoingInviteRow(invite: TttInviteDto, onCancel: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text("Waiting for ${invite.to?.fullName ?: "friend"}…", style = MaterialTheme.typography.bodyLarge)
        OutlinedButton(onClick = onCancel) { Text("Cancel") }
    }
}
