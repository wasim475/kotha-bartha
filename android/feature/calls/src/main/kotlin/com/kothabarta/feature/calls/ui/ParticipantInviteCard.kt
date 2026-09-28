package com.kothabarta.feature.calls.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import com.kothabarta.core.network.call.CallInviteParticipantEvent
import com.kothabarta.core.ui.theme.Spacing
import com.kothabarta.feature.calls.data.CallRepository
import com.kothabarta.feature.calls.domain.CallSessionManager
import kotlinx.coroutines.launch
import org.koin.compose.koinInject

/**
 * A someone-else-on-the-call invited a third participant — shown to this
 * device as a small accept/decline card, cleared locally via
 * `dismissParticipantInvite()` either way once the REST call resolves
 * (`CallSessionManager` only tracks/clears this event locally; the actual
 * accept/decline REST calls already exist on `CallRepository`).
 */
@Composable
fun ParticipantInviteCard(
    event: CallInviteParticipantEvent,
    callSessionManager: CallSessionManager,
    modifier: Modifier = Modifier,
    callRepository: CallRepository = koinInject(),
) {
    val scope = rememberCoroutineScope()

    Card(modifier = modifier.padding(Spacing.md)) {
        Column(modifier = Modifier.padding(Spacing.md)) {
            Text("${event.inviter.fullName} wants to add you to the call", style = MaterialTheme.typography.titleSmall)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = Spacing.sm),
                horizontalArrangement = Arrangement.End,
            ) {
                TextButton(onClick = {
                    scope.launch { callRepository.declineParticipantInvite(event.callId) }
                    callSessionManager.dismissParticipantInvite()
                }) { Text("Decline") }
                TextButton(onClick = {
                    scope.launch { callRepository.acceptParticipantInvite(event.callId) }
                    callSessionManager.dismissParticipantInvite()
                }) { Text("Accept") }
            }
        }
    }
}
