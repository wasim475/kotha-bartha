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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
    LazyColumn(contentPadding = PaddingValues(Spacing.md), verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
        item {
            Column(modifier = Modifier.padding(bottom = Spacing.sm)) {
                Text("Play Local", style = MaterialTheme.typography.headlineSmall)
                Text(
                    "Four players share this device. Local games work offline.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        items(3) { index ->
            val mode = when (index) { 0 -> LocalLudoMode.QUICK; 2 -> LocalLudoMode.CLASSIC; else -> null }
            val title = mode?.title ?: "One Kill"
            val description = when (mode) {
                LocalLudoMode.QUICK -> "First capture wins. Tokens stay on the shared track."
                LocalLudoMode.CLASSIC -> "Bring all four tokens Home; finishing order ranks players."
                null -> "No authoritative One Kill rules are defined yet."
            }
            Card(
                modifier = Modifier.fillMaxWidth().clickable(enabled = mode != null) { mode?.let { onNavigate(NavigationEvent.NavigateTo(Routes.ludoLocalGame(it.variantId))) } },
                colors = CardDefaults.cardColors(containerColor = if (mode != null) MaterialTheme.colorScheme.surfaceContainerHigh else MaterialTheme.colorScheme.surfaceVariant),
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(Spacing.md)) {
                    Text(title, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(if (mode != null) "Play offline" else "Unavailable · rules not documented", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = Spacing.xs))
                }
            }
        }
    }
}
