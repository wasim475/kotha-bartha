package com.kothabarta.feature.messages.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.network.messages.ConversationDto
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.ui.components.AppIcon
import com.kothabarta.core.ui.components.AppSymbol
import com.kothabarta.core.ui.components.AvatarImage
import com.kothabarta.core.ui.components.EmptyState
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.theme.Spacing
import com.kothabarta.core.websocket.SocketConnectionState
import com.kothabarta.core.websocket.SocketManager
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import org.koin.androidx.compose.koinViewModel
import org.koin.compose.koinInject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConversationsScreen(
    onNavigate: (NavigationEvent) -> Unit,
    viewModel: ConversationsViewModel = koinViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val socketManager = koinInject<SocketManager>()
    val connectionState by socketManager.connectionState.collectAsState()
    var searchOpen by rememberSaveable { mutableStateOf(false) }
    var searchQuery by rememberSaveable { mutableStateOf("") }
    var newConversationOpen by rememberSaveable { mutableStateOf(false) }
    var pendingAction by remember { mutableStateOf<Pair<ConversationDto, ConversationListAction>?>(null) }
    var reportTarget by remember { mutableStateOf<ConversationDto?>(null) }
    var reportReason by rememberSaveable { mutableStateOf("spam") }
    var reportDescription by rememberSaveable { mutableStateOf("") }
    val visibleConversations = filterConversations(state.conversations, searchQuery)

    LaunchedEffect(Unit) {
        viewModel.navigationEvents.collect { event ->
            if (event is NavigationEvent.NavigateTo && newConversationOpen) {
                newConversationOpen = false
                viewModel.searchUsers("")
            }
            onNavigate(event)
        }
    }

    when {
        state.isLoading -> FullScreenLoading()
        state.error != null && state.conversations.isEmpty() ->
            FullScreenError(state.error!!, onRetry = viewModel::retry)
        else -> PullToRefreshBox(
            isRefreshing = state.isRefreshing,
            onRefresh = viewModel::refresh,
            modifier = Modifier.fillMaxSize(),
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                ConversationsHeader(
                    searchOpen = searchOpen,
                    searchQuery = searchQuery,
                    onToggleSearch = {
                        searchOpen = !searchOpen
                        if (!searchOpen) searchQuery = ""
                    },
                    onSearchQueryChange = { searchQuery = it },
                    onClearSearch = { searchQuery = "" },
                    onNewConversation = { newConversationOpen = true },
                    showingArchived = state.showingArchived,
                    onArchiveFilterChange = viewModel::setShowingArchived,
                )
                if (connectionState == SocketConnectionState.DISCONNECTED) {
                    LiveUpdatesNotice()
                }

                when {
                    state.conversations.isEmpty() ->
                        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                            EmptyState("No conversations yet — message a friend to start one.")
                        }
                    visibleConversations.isEmpty() ->
                        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                            EmptyState("No conversations match that name.")
                        }
                    else -> LazyColumn(
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                        contentPadding = PaddingValues(vertical = Spacing.sm),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        items(visibleConversations, key = { it.id }) { conversation ->
                            ConversationRow(
                                conversation = conversation,
                                onClick = { viewModel.openConversation(conversation) },
                                showingArchived = state.showingArchived,
                                isBusy = state.busyActionIds.any { it.endsWith(":${conversation.id}") } ||
                                    conversation.id in state.openingConversationIds,
                                onAction = { action ->
                                    when (action) {
                                        ConversationListAction.ARCHIVE,
                                        ConversationListAction.UNARCHIVE,
                                        ConversationListAction.DELETE,
                                        ConversationListAction.BLOCK -> pendingAction = conversation to action
                                        ConversationListAction.REPORT -> {
                                            reportReason = "spam"
                                            reportDescription = ""
                                            reportTarget = conversation
                                        }
                                    }
                                },
                            )
                        }
                    }
                }
            }
        }
    }

    if (newConversationOpen) {
        NewConversationDialog(
            state = state,
            onDismiss = {
                newConversationOpen = false
                viewModel.searchUsers("")
            },
            onQueryChange = viewModel::searchUsers,
            onUserSelected = viewModel::openUserConversation,
            onRetryOpenUser = viewModel::openUserConversation,
        )
    }

    if (state.error != null && state.conversations.isNotEmpty()) {
        AlertDialog(
            onDismissRequest = viewModel::dismissListError,
            title = { Text("Couldn't refresh conversations") },
            text = { Text(state.error!!) },
            confirmButton = {
                TextButton(onClick = viewModel::retry) { Text("Retry") }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissListError) { Text("Dismiss") }
            },
        )
    }

    pendingAction?.let { (conversation, action) ->
        AlertDialog(
            onDismissRequest = { pendingAction = null },
            title = { Text(actionConfirmationTitle(action)) },
            text = { Text(actionConfirmationText(action, conversation.user?.fullName.orEmpty())) },
            confirmButton = {
                TextButton(
                    onClick = {
                        pendingAction = null
                        viewModel.performAction(conversation, action)
                    },
                ) { Text(actionConfirmationLabel(action)) }
            },
            dismissButton = {
                TextButton(onClick = { pendingAction = null }) { Text("Cancel") }
            },
        )
    }

    reportTarget?.let { conversation ->
        AlertDialog(
            onDismissRequest = { reportTarget = null },
            title = { Text("Report ${conversation.user?.fullName ?: "user"}") },
            text = {
                Column {
                    Text("Choose the reason that best describes your report.")
                    listOf("spam", "harassment", "inappropriate", "hate", "scam", "other").forEach { reason ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(selected = reportReason == reason, onClick = { reportReason = reason })
                            Text(reason.replaceFirstChar(Char::uppercase))
                        }
                    }
                    if (reportReason == "other") {
                        OutlinedTextField(
                            value = reportDescription,
                            onValueChange = { reportDescription = it.take(1000) },
                            modifier = Modifier.fillMaxWidth(),
                            placeholder = { Text("Tell us a little more") },
                            label = { Text("Description") },
                            minLines = 2,
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(
                    enabled = "REPORT:${conversation.id}" !in state.busyActionIds &&
                        (reportReason != "other" || reportDescription.trim().length >= 3),
                    onClick = {
                        viewModel.performAction(
                            conversation,
                            ConversationListAction.REPORT,
                            reportReason,
                            reportDescription.trim().takeIf { reportReason == "other" },
                        )
                        reportTarget = null
                    },
                ) { Text("Submit report") }
            },
            dismissButton = { TextButton(onClick = { reportTarget = null }) { Text("Cancel") } },
        )
    }

    val feedback = state.actionError ?: state.actionMessage
    if (feedback != null) {
        AlertDialog(
            onDismissRequest = viewModel::dismissActionMessage,
            title = { Text(if (state.actionError == null) "Done" else "Couldn't complete action") },
            text = { Text(feedback) },
            confirmButton = {
                TextButton(onClick = viewModel::dismissActionMessage) { Text("OK") }
            },
        )
    }
}

@Composable
private fun ConversationsHeader(
    searchOpen: Boolean,
    searchQuery: String,
    onToggleSearch: () -> Unit,
    onSearchQueryChange: (String) -> Unit,
    onClearSearch: () -> Unit,
    onNewConversation: () -> Unit,
    showingArchived: Boolean,
    onArchiveFilterChange: (Boolean) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
            .padding(start = Spacing.md, end = Spacing.sm, top = Spacing.md, bottom = Spacing.sm),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Messages",
                    style = MaterialTheme.typography.headlineMedium,
                    color = MaterialTheme.colorScheme.onBackground,
                )
                Text(
                    text = "Your conversations",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(
                onClick = onToggleSearch,
                modifier = Modifier
                    .size(48.dp)
                    .semantics { contentDescription = if (searchOpen) "Close conversation search" else "Search conversations" },
            ) {
                AppIcon(
                    symbol = if (searchOpen) AppSymbol.CLOSE else AppSymbol.SEARCH,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurface,
                )
            }
        }
        if (searchOpen) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = onSearchQueryChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = Spacing.sm),
                singleLine = true,
                shape = RoundedCornerShape(18.dp),
                placeholder = { Text("Search by name") },
                leadingIcon = {
                    AppIcon(
                        AppSymbol.SEARCH,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        TextButton(onClick = onClearSearch) { Text("Clear") }
                    }
                },
            )
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = Spacing.sm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            FilledTonalButton(
                onClick = onNewConversation,
                modifier = Modifier.heightIn(min = 48.dp),
            ) {
                AppIcon(AppSymbol.CHAT, contentDescription = null, modifier = Modifier.size(18.dp))
                Text("  New message")
            }
            Spacer(Modifier.weight(1f))
            TextButton(
                onClick = { onArchiveFilterChange(!showingArchived) },
                modifier = Modifier.heightIn(min = 48.dp),
            ) {
                Text(if (showingArchived) "Inbox" else "Archived")
            }
        }
    }
}

@Composable
private fun LiveUpdatesNotice() {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.md, vertical = Spacing.xs),
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(14.dp),
    ) {
        Text(
            text = "Live updates are disconnected",
            modifier = Modifier.padding(horizontal = Spacing.md, vertical = Spacing.sm),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun ConversationRow(
    conversation: ConversationDto,
    onClick: () -> Unit,
    showingArchived: Boolean,
    isBusy: Boolean,
    onAction: (ConversationListAction) -> Unit,
) {
    val peer = conversation.user
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.md, vertical = Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box {
            Box(
                modifier = Modifier
                    .size(58.dp)
                    .clickable(role = Role.Button, onClick = onClick),
            ) {
                AvatarImage(
                    avatarUrl = peer?.avatar?.secureUrl,
                    initials = peer?.initials ?: peer?.fullName ?: "?",
                    size = 58.dp,
                )
            }
            if (peer?.isOnline == true) {
                Box(
                    modifier = Modifier
                        .size(15.dp)
                        .align(Alignment.BottomEnd)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.background)
                        .padding(2.dp)
                        .clip(CircleShape)
                        .background(androidx.compose.ui.graphics.Color(0xFF25D366))
                        .semantics { contentDescription = "Online" },
                )
            }
        }
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(start = Spacing.md)
                .clickable(role = Role.Button, onClick = onClick),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = peer?.fullName ?: "Unknown",
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.width(Spacing.sm))
                Text(
                    text = conversationTimestamp(conversation.lastMessageAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = if (conversation.unreadCount > 0) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    maxLines = 1,
                )
            }
            Row(
                modifier = Modifier.padding(top = Spacing.xs),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = conversationPreview(conversation),
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (conversation.unreadCount > 0) {
                        MaterialTheme.colorScheme.onSurface
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    fontWeight = if (conversation.unreadCount > 0) FontWeight.Medium else FontWeight.Normal,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (conversation.unreadCount > 0) {
                    Surface(
                        modifier = Modifier
                            .padding(start = Spacing.sm)
                            .semantics {
                                contentDescription = "${conversation.unreadCount} unread messages"
                            },
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.primary,
                    ) {
                        Text(
                            text = if (conversation.unreadCount > 99) "99+" else conversation.unreadCount.toString(),
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }
        ConversationActionsMenu(
            showingArchived = showingArchived,
            isBusy = isBusy,
            hasUser = peer != null,
            onAction = onAction,
        )
    }
}

@Composable
private fun ConversationActionsMenu(
    showingArchived: Boolean,
    isBusy: Boolean,
    hasUser: Boolean,
    onAction: (ConversationListAction) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        IconButton(
            onClick = { expanded = true },
            enabled = !isBusy,
            modifier = Modifier
                .size(48.dp)
                .semantics { contentDescription = "Conversation actions" },
        ) {
            AppIcon(AppSymbol.MORE_VERT, contentDescription = null)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(
                text = { Text(if (showingArchived) "Restore to inbox" else "Archive") },
                onClick = {
                expanded = false
                onAction(if (showingArchived) ConversationListAction.UNARCHIVE else ConversationListAction.ARCHIVE)
                },
            )
            DropdownMenuItem(
                text = { Text("Remove from inbox") },
                onClick = {
                expanded = false
                onAction(ConversationListAction.DELETE)
                },
            )
            if (hasUser) {
                DropdownMenuItem(
                    text = { Text("Block user") },
                    onClick = {
                        expanded = false
                        onAction(ConversationListAction.BLOCK)
                    },
                )
                DropdownMenuItem(
                    text = { Text("Report user") },
                    onClick = {
                        expanded = false
                        onAction(ConversationListAction.REPORT)
                    },
                )
            }
        }
    }
}

    @Composable
    private fun NewConversationDialog(
        state: ConversationsUiState,
        onDismiss: () -> Unit,
        onQueryChange: (String) -> Unit,
        onUserSelected: (SafeUserDto) -> Unit,
        onRetryOpenUser: (SafeUserDto) -> Unit,
    ) {
        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text("New message") },
            text = {
                Column {
                    OutlinedTextField(
                        value = state.userSearchQuery,
                        onValueChange = onQueryChange,
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(18.dp),
                        placeholder = { Text("Search people") },
                        leadingIcon = { AppIcon(AppSymbol.SEARCH, contentDescription = null) },
                        trailingIcon = {
                            if (state.userSearchQuery.isNotEmpty()) {
                                TextButton(onClick = { onQueryChange("") }) { Text("Clear") }
                            }
                        },
                    )
                    when {
                        state.userSearchError != null -> Column {
                            Text(
                                state.userSearchError,
                                modifier = Modifier.padding(vertical = Spacing.sm),
                                color = MaterialTheme.colorScheme.error,
                            )
                            TextButton(
                                onClick = {
                                    state.failedOpeningUser?.let(onRetryOpenUser)
                                        ?: onQueryChange(state.userSearchQuery)
                                },
                            ) { Text("Try again") }
                        }
                        state.isSearchingUsers -> Text(
                            "Searching…",
                            modifier = Modifier.padding(vertical = Spacing.md),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        state.userSearchQuery.trim().length < 2 -> Text(
                            "Type at least two characters to search.",
                            modifier = Modifier.padding(vertical = Spacing.md),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        state.userSearchResults.isEmpty() -> Text(
                            "No people found.",
                            modifier = Modifier.padding(vertical = Spacing.md),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        else -> LazyColumn(modifier = Modifier.fillMaxWidth().heightIn(max = 320.dp)) {
                            items(state.userSearchResults, key = { it.id }) { user ->
                                UserSearchResult(
                                    user = user,
                                    isOpening = user.id in state.openingUserIds,
                                    onClick = { onUserSelected(user) },
                                )
                            }
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = onDismiss) { Text("Close") } },
        )
    }

    @Composable
    private fun UserSearchResult(user: SafeUserDto, isOpening: Boolean, onClick: () -> Unit) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(enabled = !isOpening, role = Role.Button, onClick = onClick)
                .padding(vertical = Spacing.sm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AvatarImage(
                avatarUrl = user.avatar?.secureUrl,
                initials = user.initials ?: user.fullName,
                size = 44.dp,
            )
            Column(modifier = Modifier.weight(1f).padding(start = Spacing.sm)) {
                Text(user.fullName, style = MaterialTheme.typography.titleSmall, maxLines = 1)
                val detail = listOfNotNull(user.currentCity, user.hometown, user.bio)
                    .firstOrNull { it.isNotBlank() }
                if (detail != null) {
                    Text(
                        detail,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            if (isOpening) {
                androidx.compose.material3.CircularProgressIndicator(modifier = Modifier.size(20.dp))
            }
        }
    }

    private fun actionConfirmationTitle(action: ConversationListAction): String = when (action) {
        ConversationListAction.ARCHIVE -> "Archive conversation?"
        ConversationListAction.UNARCHIVE -> "Restore conversation?"
        ConversationListAction.DELETE -> "Remove conversation?"
        ConversationListAction.BLOCK -> "Block this user?"
        ConversationListAction.REPORT -> "Report user?"
    }

    private fun actionConfirmationText(action: ConversationListAction, name: String): String = when (action) {
        ConversationListAction.ARCHIVE -> "Move this conversation to your archived list."
        ConversationListAction.UNARCHIVE -> "Move this conversation back to your inbox."
        ConversationListAction.DELETE -> "Remove this conversation from your inbox. New messages may make it appear again."
        ConversationListAction.BLOCK -> "Block $name? The server will prevent messaging and end any friendship or pending request."
        ConversationListAction.REPORT -> "Submit a report about $name for review."
    }

    private fun actionConfirmationLabel(action: ConversationListAction): String = when (action) {
        ConversationListAction.ARCHIVE -> "Archive"
        ConversationListAction.UNARCHIVE -> "Restore"
        ConversationListAction.DELETE -> "Remove"
        ConversationListAction.BLOCK -> "Block"
        ConversationListAction.REPORT -> "Report"
    }

internal fun conversationPreview(conversation: ConversationDto): String = when {
    conversation.encrypted -> "🔒 Encrypted message"
    !conversation.lastMessage.isNullOrBlank() -> conversation.lastMessage.orEmpty()
    else -> "Say hello"
}

internal fun filterConversations(
    conversations: List<ConversationDto>,
    query: String,
): List<ConversationDto> {
    val normalizedQuery = query.trim()
    return if (normalizedQuery.isEmpty()) conversations else conversations.filter { conversation ->
        conversation.user?.fullName?.contains(normalizedQuery, ignoreCase = true) == true
    }
}

internal fun conversationTimestamp(lastMessageAt: String?, now: Instant = Instant.now()): String {
    if (lastMessageAt.isNullOrBlank()) return ""
    val timestamp = runCatching { Instant.parse(lastMessageAt) }.getOrNull() ?: return ""
    val zone = ZoneId.systemDefault()
    val messageDate = timestamp.atZone(zone).toLocalDate()
    val today = now.atZone(zone).toLocalDate()
    return when {
        messageDate == today -> timestamp.atZone(zone).format(DateTimeFormatter.ofPattern("h:mm a", Locale.getDefault()))
        messageDate == today.minusDays(1) -> "Yesterday"
        messageDate.year == today.year -> timestamp.atZone(zone).format(DateTimeFormatter.ofPattern("MMM d", Locale.getDefault()))
        else -> timestamp.atZone(zone).format(DateTimeFormatter.ofPattern("MMM d, yy", Locale.getDefault()))
    }
}
