package com.kothabarta.feature.ludo.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
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
import com.kothabarta.core.network.ludo.LudoGameDto
import com.kothabarta.core.network.ludo.LudoInviteDto
import com.kothabarta.core.network.ludo.LudoVariantDto
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.ui.components.AvatarImage
import com.kothabarta.core.ui.components.EmptyState
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.theme.Spacing
import org.koin.androidx.compose.koinViewModel

@Composable
fun LudoLobbyScreen(
    onNavigate: (NavigationEvent) -> Unit,
    viewModel: LudoLobbyViewModel = koinViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.navigationEvents.collect(onNavigate)
    }

    when {
        state.isLoading -> FullScreenLoading()
        state.error != null && state.variants.isEmpty() -> FullScreenError(state.error!!, onRetry = viewModel::retry)
        else -> LazyColumn(contentPadding = PaddingValues(Spacing.md)) {
            item { VariantPicker(state.variants, state.selectedVariantId, state.isCreatingLobby, viewModel) }

            if (state.incomingInvites.isNotEmpty()) {
                item { SectionTitle("Invites") }
                items(state.incomingInvites, key = { it.id }) { invite ->
                    IncomingInviteRow(invite, onAccept = { viewModel.acceptInvite(invite) }, onDecline = { viewModel.declineInvite(invite) })
                }
            }

            if (state.outgoingInvites.isNotEmpty()) {
                item { SectionTitle("Sent invites") }
                items(state.outgoingInvites, key = { it.id }) { invite ->
                    OutgoingInviteRow(invite, onCancel = { viewModel.cancelInvite(invite) })
                }
            }

            item { SectionTitle("Your games") }
            if (state.activeGames.isEmpty()) {
                item { EmptyState("No active Ludo games — create a lobby to start one.") }
            } else {
                items(state.activeGames, key = { it.id }) { game ->
                    ActiveGameRow(
                        game = game,
                        isInviteTarget = state.inviteTargetGameId == game.id,
                        onlineFriends = state.onlineFriends,
                        sendingInviteToUserId = state.sendingInviteToUserId,
                        onOpen = { viewModel.openGame(game.id) },
                        onToggleInvite = { viewModel.setInviteTarget(if (state.inviteTargetGameId == game.id) null else game.id) },
                        onInvite = { viewModel.invite(it) },
                    )
                }
            }
        }
    }
}

@Composable
private fun VariantPicker(
    variants: List<LudoVariantDto>,
    selectedVariantId: String?,
    isCreating: Boolean,
    viewModel: LudoLobbyViewModel,
) {
    Column(modifier = Modifier.padding(bottom = Spacing.lg)) {
        Text("Play Ludo", style = MaterialTheme.typography.headlineSmall)
        if (variants.isEmpty()) {
            EmptyState("No online Ludo variants available right now.")
            return
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = Spacing.sm),
            horizontalArrangement = Arrangement.spacedBy(Spacing.xs),
        ) {
            variants.forEach { variant ->
                FilterChip(
                    selected = selectedVariantId == variant.id,
                    onClick = { viewModel.selectVariant(variant.id) },
                    label = { Text(variant.title) },
                )
            }
        }
        val selected = variants.firstOrNull { it.id == selectedVariantId }
        selected?.description?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
        Button(
            onClick = viewModel::createLobby,
            enabled = !isCreating && selectedVariantId != null,
            modifier = Modifier.padding(top = Spacing.sm),
        ) {
            Text(if (isCreating) "Creating..." else "Create Lobby")
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(text, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = Spacing.md, bottom = Spacing.sm))
}

@Composable
private fun IncomingInviteRow(invite: LudoInviteDto, onAccept: () -> Unit, onDecline: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AvatarImage(avatarUrl = invite.from?.avatar?.secureUrl, initials = invite.from?.initials ?: invite.from?.fullName.orEmpty())
        Text(
            invite.from?.fullName ?: "Someone",
            modifier = Modifier
                .padding(start = Spacing.sm)
                .weight(1f),
            style = MaterialTheme.typography.titleMedium,
        )
        Button(onClick = onAccept) { Text("Accept") }
        OutlinedButton(onClick = onDecline) { Text("Decline") }
    }
}

@Composable
private fun OutgoingInviteRow(invite: LudoInviteDto, onCancel: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AvatarImage(avatarUrl = invite.to?.avatar?.secureUrl, initials = invite.to?.initials ?: invite.to?.fullName.orEmpty())
        Text(
            invite.to?.fullName ?: "Someone",
            modifier = Modifier
                .padding(start = Spacing.sm)
                .weight(1f),
            style = MaterialTheme.typography.titleMedium,
        )
        OutlinedButton(onClick = onCancel) { Text("Cancel") }
    }
}

@Composable
private fun ActiveGameRow(
    game: LudoGameDto,
    isInviteTarget: Boolean,
    onlineFriends: List<SafeUserDto>,
    sendingInviteToUserId: String?,
    onOpen: () -> Unit,
    onToggleInvite: () -> Unit,
    onInvite: (SafeUserDto) -> Unit,
) {
    Card(modifier = Modifier.padding(bottom = Spacing.sm)) {
        Column(modifier = Modifier.padding(Spacing.md)) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(game.variantId, style = MaterialTheme.typography.titleMedium)
                    Text("${game.status} · ${game.members.size}/${game.expectedPlayers} players", style = MaterialTheme.typography.bodySmall)
                }
                TextButton(onClick = onOpen) { Text("Open") }
                if (game.status == "lobby") {
                    TextButton(onClick = onToggleInvite) { Text(if (isInviteTarget) "Close" else "Invite") }
                }
            }
            if (isInviteTarget) {
                if (onlineFriends.isEmpty()) {
                    Text("No friends online right now.", style = MaterialTheme.typography.bodySmall)
                } else {
                    onlineFriends.forEach { friend ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = Spacing.xs),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            AvatarImage(avatarUrl = friend.avatar?.secureUrl, initials = friend.initials ?: friend.fullName, size = 28.dp)
                            Text(friend.fullName, modifier = Modifier.padding(start = Spacing.sm).weight(1f), style = MaterialTheme.typography.bodyMedium)
                            TextButton(onClick = { onInvite(friend) }, enabled = sendingInviteToUserId != friend.id) {
                                Text(if (sendingInviteToUserId == friend.id) "Sending..." else "Invite")
                            }
                        }
                    }
                }
            }
        }
    }
}
