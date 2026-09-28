package com.kothabarta.feature.calls.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.kothabarta.core.network.messages.MessageDto
import com.kothabarta.core.ui.components.AppTextField
import com.kothabarta.core.ui.theme.Spacing
import com.kothabarta.feature.calls.domain.CallSessionManager
import com.kothabarta.feature.calls.domain.CallUiState

/**
 * In-call chat — the same 1:1 conversation `CallSessionManager` already reuses
 * (see its own comment on `sendChatMessage`). Only ever rendered while
 * `chatOpen`, so [CallGlobalHost]/[ActiveCallScreen] own that visibility gate.
 */
@Composable
fun CallChatPanel(state: CallUiState, callSessionManager: CallSessionManager, modifier: Modifier = Modifier) {
    var draft by remember { mutableStateOf("") }

    Surface(
        modifier = modifier
            .fillMaxHeight()
            .width(300.dp),
        tonalElevation = 6.dp,
    ) {
        Column(modifier = Modifier.fillMaxHeight()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(Spacing.sm),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("In-call chat", style = MaterialTheme.typography.titleMedium)
                IconButton(onClick = callSessionManager::toggleChat) { Text("✕") }
            }

            LazyColumn(
                modifier = Modifier.weight(1f),
                reverseLayout = true,
                contentPadding = PaddingValues(Spacing.sm),
                verticalArrangement = Arrangement.spacedBy(Spacing.xs, alignment = Alignment.Bottom),
            ) {
                items(state.chatMessages.asReversed(), key = { it.id }) { message ->
                    CallChatBubble(message = message, isMine = message.senderId != state.peer?.id)
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                AppTextField(
                    value = draft,
                    onValueChange = { draft = it },
                    label = "Message",
                    modifier = Modifier.weight(1f),
                )
                TextButton(
                    onClick = {
                        val text = draft
                        draft = ""
                        callSessionManager.sendChatMessage(text)
                    },
                    enabled = draft.isNotBlank(),
                ) { Text("Send") }
            }
        }
    }
}

@Composable
private fun CallChatBubble(message: MessageDto, isMine: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isMine) Arrangement.End else Arrangement.Start,
    ) {
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = if (isMine) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
        ) {
            Text(
                text = message.body ?: (if (message.encrypted) "Encrypted message" else ""),
                modifier = Modifier.padding(horizontal = Spacing.sm, vertical = Spacing.xs),
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}
