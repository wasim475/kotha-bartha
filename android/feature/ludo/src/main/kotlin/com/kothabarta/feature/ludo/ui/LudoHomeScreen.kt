package com.kothabarta.feature.ludo.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.ui.components.AppIcon
import com.kothabarta.core.ui.components.AppSymbol
import com.kothabarta.core.ui.theme.Spacing
import com.kothabarta.feature.ludo.local.LocalLudoMode

@Composable
fun LudoHomeScreen(onNavigate: (NavigationEvent) -> Unit) {
    LazyColumn(contentPadding = PaddingValues(Spacing.md), verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
        item {
            Column(modifier = Modifier.padding(bottom = Spacing.sm)) {
                Text("Play Ludo", style = MaterialTheme.typography.headlineSmall)
                Text("Choose how you want to play.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        item {
            LudoModeEntryCard(
                title = "Play With Friend",
                subtitle = "Play online, create a lobby, and invite a friend.",
                symbol = AppSymbol.FRIENDS,
                onClick = { onNavigate(NavigationEvent.NavigateTo(Routes.LUDO_ONLINE)) },
            )
        }
        item {
            LudoModeEntryCard(
                title = "Play Local",
                subtitle = "Choose a local mode for one-device play.",
                symbol = AppSymbol.GAMES,
                onClick = { onNavigate(NavigationEvent.NavigateTo(Routes.LUDO_LOCAL)) },
            )
        }
    }
}

@Composable
private fun LudoModeEntryCard(title: String, subtitle: String, symbol: AppSymbol, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().semantics {
            role = Role.Button
            contentDescription = "$title. $subtitle"
        }.clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(Spacing.md),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AppIcon(symbol, contentDescription = null, modifier = Modifier.size(32.dp), tint = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.size(Spacing.md))
            Column {
                Text(title, style = MaterialTheme.typography.titleMedium)
                Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
fun LudoLocalModesScreen(onNavigate: (NavigationEvent) -> Unit) {
    var step by rememberSaveable { mutableIntStateOf(0) }
    var playerCount by rememberSaveable { mutableIntStateOf(4) }
    var mode by rememberSaveable { mutableStateOf(LocalLudoMode.CLASSIC.variantId) }
    val selectedMode = remember(mode) { LocalLudoMode.entries.first { it.variantId == mode } }
    LazyColumn(contentPadding = PaddingValues(Spacing.md), verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
        item {
            Column(modifier = Modifier.padding(bottom = Spacing.sm)) {
                Text("Local game setup", style = MaterialTheme.typography.headlineSmall)
                Text("Step ${step + 1} of 3", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        when (step) {
            0 -> {
                item { Text("Choose game mode", style = MaterialTheme.typography.titleMedium) }
                items(LocalLudoMode.entries.toList(), key = { it.variantId }) { gameMode ->
                    Card(
                        modifier = Modifier.fillMaxWidth().clickable { mode = gameMode.variantId },
                        colors = CardDefaults.cardColors(
                            containerColor = if (mode == gameMode.variantId) MaterialTheme.colorScheme.primaryContainer
                            else MaterialTheme.colorScheme.surfaceContainerHigh,
                        ),
                    ) {
                        Column(modifier = Modifier.fillMaxWidth().padding(Spacing.md)) {
                            Text(gameMode.title, style = MaterialTheme.typography.titleMedium)
                            Text(
                                if (gameMode == LocalLudoMode.QUICK) "First capture wins. Tokens stay on the shared track."
                                else "Bring all four tokens Home. Each player competes individually.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
                item {
                    Button(onClick = { step = 1 }, modifier = Modifier.fillMaxWidth()) { Text("Continue") }
                }
            }
            1 -> {
                item {
                    Text("Choose game type", style = MaterialTheme.typography.titleMedium)
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm), modifier = Modifier.padding(top = Spacing.xs)) {
                        SetupChoiceCard("Single Game", "Players compete individually", true, Modifier.weight(1f))
                        SetupChoiceCard("Team Game", "Coming Soon", false, Modifier.weight(1f), enabled = false)
                    }
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm), modifier = Modifier.fillMaxWidth()) {
                        OutlinedButton(onClick = { step = 0 }, modifier = Modifier.weight(1f)) { Text("Back") }
                        Button(onClick = { step = 2 }, modifier = Modifier.weight(1f)) { Text("Continue") }
                    }
                }
            }
            else -> {
                item {
                    Text("Choose player count", style = MaterialTheme.typography.titleMedium)
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm), modifier = Modifier.padding(top = Spacing.xs)) {
                        (2..4).forEach { count ->
                            SetupChoiceCard(
                                "$count Players",
                                if (count == playerCount) "Selected" else "Select",
                                count == playerCount,
                                Modifier.weight(1f),
                                onClick = { playerCount = count },
                            )
                        }
                    }
                }
                item {
                    Text("${selectedMode.title} · Single Game · $playerCount players", style = MaterialTheme.typography.bodyMedium)
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm), modifier = Modifier.fillMaxWidth()) {
                        OutlinedButton(onClick = { step = 1 }, modifier = Modifier.weight(1f)) { Text("Back") }
                        Button(
                            onClick = { onNavigate(NavigationEvent.NavigateTo(Routes.ludoLocalGame(selectedMode.variantId, playerCount))) },
                            modifier = Modifier.weight(1f),
                        ) {
                            Text("Start Game")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SetupChoiceCard(
    title: String,
    subtitle: String,
    selected: Boolean,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onClick: () -> Unit = {},
) {
    Card(
        modifier = modifier.clickable(enabled = enabled, onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer
            else MaterialTheme.colorScheme.surfaceVariant,
        ),
    ) {
        Column(Modifier.fillMaxWidth().padding(Spacing.sm)) {
            Text(title, style = MaterialTheme.typography.labelLarge)
            Text(subtitle, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
