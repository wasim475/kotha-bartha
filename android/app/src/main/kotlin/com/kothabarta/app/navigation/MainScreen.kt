package com.kothabarta.app.navigation

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.RadioButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import com.google.firebase.FirebaseApp
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavController
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.NavType
import androidx.navigation.navArgument
import com.kothabarta.core.common.ApiResult
import com.kothabarta.app.BuildConfig
import com.kothabarta.app.NotificationTarget
import com.kothabarta.app.PushNotificationState
import com.kothabarta.core.datastore.AppPreferences
import com.kothabarta.core.datastore.MessageNotificationPrivacy
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.network.SessionManager
import com.kothabarta.core.media.IceServerConfig
import com.kothabarta.core.ui.components.AvatarImage
import com.kothabarta.core.ui.components.AppIcon
import com.kothabarta.core.ui.components.AppSymbol
import com.kothabarta.feature.calls.ui.CallGlobalHost
import com.kothabarta.feature.calls.ui.CallHistoryScreen
import com.kothabarta.feature.friends.ui.FriendsScreen
import com.kothabarta.feature.games.ui.ChallengePlayScreen
import com.kothabarta.feature.games.ui.GamePlayScreen
import com.kothabarta.feature.games.ui.GamesCatalogScreen
import com.kothabarta.feature.home.ui.FeedScreen
import com.kothabarta.feature.home.ui.FeedViewer
import com.kothabarta.feature.home.ui.PostDetailScreen
import com.kothabarta.feature.leaderboard.ui.LeaderboardScreen
import com.kothabarta.feature.ludo.ui.LudoGameScreen
import com.kothabarta.feature.ludo.ui.LudoHomeScreen
import com.kothabarta.feature.ludo.ui.LudoLocalModesScreen
import com.kothabarta.feature.ludo.ui.LudoLocalGameScreen
import com.kothabarta.feature.ludo.ui.LudoLobbyScreen
import com.kothabarta.feature.messages.ui.ChatScreen
import com.kothabarta.feature.messages.ui.ConversationsScreen
import com.kothabarta.feature.notifications.data.NotificationBadge
import com.kothabarta.feature.notifications.ui.NotificationsScreen
import com.kothabarta.feature.profile.data.ProfileRepository
import com.kothabarta.feature.profile.data.ProfileUiModel
import com.kothabarta.feature.profile.ui.ProfileScreen
import com.kothabarta.feature.quiz.ui.QuizBrowseScreen
import com.kothabarta.feature.quiz.ui.QuizPlayScreen
import com.kothabarta.feature.study.ui.StudyScreen
import com.kothabarta.feature.tictactoe.ui.TttGameScreen
import com.kothabarta.feature.tictactoe.ui.TttLobbyScreen
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import org.koin.compose.koinInject
import kotlinx.coroutines.launch

private data class BottomNavItem(val route: String, val label: String, val symbol: AppSymbol)

private val BOTTOM_NAV_ITEMS = listOf(
    BottomNavItem(Routes.HOME, "Feed", AppSymbol.FEED),
    BottomNavItem(Routes.FRIENDS, "Friends", AppSymbol.FRIENDS),
    BottomNavItem(Routes.MESSAGES, "Messages", AppSymbol.CHAT),
    BottomNavItem(Routes.NOTIFICATIONS, "Alerts", AppSymbol.NOTIFICATIONS),
)

/**
 * The post-login "app shell": its own `NavController`/`NavHost`, entirely
 * separate from the pre-login one in `KothaBartaNavHost` — a common,
 * intentional split between an "auth graph" and a "main graph" rather than
 * one flat graph mixing both.
 */
@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun MainScreen(
    onSignedOut: (NavigationEvent) -> Unit,
    isDarkTheme: Boolean,
    onToggleTheme: () -> Unit,
    notificationTarget: NotificationTarget? = null,
    onNotificationHandled: () -> Unit = {},
) {
    val navController = rememberNavController()
    val notificationBadge = koinInject<NotificationBadge>()
    val profileRepository = koinInject<ProfileRepository>()
    val sessionManager = koinInject<SessionManager>()
    val appPreferences = koinInject<AppPreferences>()
    val notificationPrivacy by appPreferences.messageNotificationPrivacy.collectAsState(initial = MessageNotificationPrivacy.SHOW_SENDER_ONLY)
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val ludoChromeController = remember(coroutineScope) { LudoGameChromeController(coroutineScope) }
    val unreadCount by notificationBadge.unreadCount.collectAsState()
    var ownProfile by remember { mutableStateOf<ProfileUiModel?>(null) }
    var showLogoutConfirmation by remember { mutableStateOf(false) }
    var isLoggingOut by remember { mutableStateOf(false) }
    var searchOpen by rememberSaveable { mutableStateOf(false) }
    var searchQuery by rememberSaveable { mutableStateOf("") }
    var searchResults by remember { mutableStateOf(emptyList<SafeUserDto>()) }
    var searchLoading by remember { mutableStateOf(false) }
    var searchError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(profileRepository) {
        val result = profileRepository.getOwnProfile()
        if (result is ApiResult.Success) ownProfile = result.data
    }

    val notificationPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && FirebaseApp.getApps(context).isNotEmpty() &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    LaunchedEffect(notificationTarget) {
        val target = notificationTarget ?: return@LaunchedEffect
        when {
            !target.conversationId.isNullOrBlank() -> {
                val current = navController.currentBackStackEntry
                val alreadyShowingTarget = current?.destination?.route == Routes.CHAT_PATTERN &&
                    current.arguments?.getString(Routes.CHAT_CONVERSATION_ARG) == target.conversationId &&
                    (target.messageId.isNullOrBlank() ||
                        current.arguments?.getString(Routes.CHAT_MESSAGE_ARG) == target.messageId)
                if (!alreadyShowingTarget) {
                    navController.navigate(Routes.chat(target.conversationId, messageId = target.messageId)) {
                        popUpTo(navController.graph.findStartDestination().id)
                    }
                }
            }
            !target.postId.isNullOrBlank() -> navController.navigate(Routes.post(target.postId)) {
                popUpTo(navController.graph.findStartDestination().id)
            }
        }
        onNotificationHandled()
    }

    LaunchedEffect(searchOpen, searchQuery) {
        searchResults = emptyList()
        searchError = null
        searchLoading = searchOpen && searchQuery.isNotBlank()
        if (!searchOpen || searchQuery.isBlank()) return@LaunchedEffect

        delay(300)
        val result = profileRepository.searchUsers(searchQuery.trim())
        currentCoroutineContext().ensureActive()
        when (result) {
            is ApiResult.Success -> searchResults = result.data
            is ApiResult.Failure -> searchError = result.error.message
        }
        searchLoading = false
    }

    val navigateToTopLevel: (String) -> Unit = { route ->
        if (navController.currentDestination?.route != route) {
            navController.navigate(route) {
                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                launchSingleTop = true
                restoreState = true
            }
        }
    }

    val onNavigate: (NavigationEvent) -> Unit = { event ->
        when (event) {
            is NavigationEvent.NavigateTo -> {
                if (event.route == Routes.LOGIN) {
                    onSignedOut(event)
                } else {
                    navController.navigate(event.route) {
                        event.popUpToInclusive?.let { popUpTo(it) { inclusive = true } }
                    }
                }
            }
            NavigationEvent.PopBackStack -> navController.popBackStack()
        }
    }

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val isLudoGameplay = isLudoGameplayRoute(currentRoute)
    val gameChromeVisible by ludoChromeController.visible.collectAsState()
    LaunchedEffect(ludoChromeController, backStackEntry?.id) { ludoChromeController.reset() }
    DisposableEffect(ludoChromeController) {
        onDispose { ludoChromeController.reset() }
    }
    val isConversationOpen = backStackEntry?.destination?.route == Routes.CHAT_PATTERN
    val isImeVisible = WindowInsets.ime.getBottom(LocalDensity.current) > 0
    val activeConversationId = if (isConversationOpen) {
        backStackEntry?.arguments?.getString(Routes.CHAT_CONVERSATION_ARG)
    } else {
        null
    }
    DisposableEffect(context, activeConversationId) {
        PushNotificationState.setActiveConversation(context, activeConversationId)
        if (activeConversationId != null) PushNotificationState.clearConversationNotification(context, activeConversationId)
        onDispose {
            if (activeConversationId != null) {
                PushNotificationState.clearActiveConversation(context, activeConversationId)
            }
        }
    }

    Scaffold(
        topBar = {
            if (!isLudoGameplay || gameChromeVisible) {
                MainTopBar(
                    searchOpen = searchOpen,
                    searchQuery = searchQuery,
                    searchResults = searchResults,
                    searchLoading = searchLoading,
                    searchError = searchError,
                    onSearchOpen = { searchOpen = true },
                    onSearchClose = {
                        searchOpen = false
                        searchQuery = ""
                    },
                    onSearchQueryChange = { searchQuery = it },
                    onOpenProfile = { userId ->
                        searchOpen = false
                        searchQuery = ""
                        navController.navigate(Routes.profile(userId))
                    },
                    onHome = { navigateToTopLevel(Routes.HOME) },
                    onStudy = { navigateToTopLevel(Routes.STUDY) },
                    onProfile = { navigateToTopLevel(Routes.MY_PROFILE) },
                    ownProfile = ownProfile,
                    onSettings = { navigateToTopLevel(Routes.SETTINGS) },
                    onRequestLogout = { showLogoutConfirmation = true },
                )
            }
        },
        bottomBar = {
            if ((!isConversationOpen || !isImeVisible) && (!isLudoGameplay || gameChromeVisible)) {
                val destination = backStackEntry?.destination
                NavigationBar {
                    BOTTOM_NAV_ITEMS.forEach { item ->
                        val selected = destination?.hierarchy?.any { it.route == item.route } == true ||
                            (item.route == Routes.MESSAGES && destination?.route == Routes.MESSAGES_CALLS) ||
                            (item.route == Routes.HOME && destination?.route?.startsWith("post/") == true)
                        NavigationBarItem(
                            selected = selected,
                            onClick = { navigateToTopLevel(item.route) },
                            icon = { AppIcon(item.symbol, contentDescription = null) },
                            label = {
                                Text(if (item.route == Routes.NOTIFICATIONS && unreadCount > 0) "${item.label} ($unreadCount)" else item.label)
                            },
                        )
                    }
                }
            }
        },
    ) { padding ->
        Box(modifier = Modifier.padding(padding).fillMaxSize()) {
            NavHost(
                navController = navController,
                startDestination = Routes.HOME,
                modifier = Modifier.fillMaxSize(),
            ) {
                composable(Routes.HOME) {
                    FeedScreen(
                        onNavigate = onNavigate,
                        viewer = FeedViewer(name = ownProfile?.fullName.orEmpty(), avatarUrl = ownProfile?.avatarUrl, initials = ownProfile?.initials ?: "Me"),
                    )
                }
                composable(Routes.FRIENDS) { FriendsScreen(onNavigate = onNavigate) }
                composable(Routes.MESSAGES) { MessagesHubScreen(showCalls = false, navController = navController, onNavigate = onNavigate) }
                composable(Routes.MESSAGES_CALLS) { MessagesHubScreen(showCalls = true, navController = navController, onNavigate = onNavigate) }
                composable(Routes.NOTIFICATIONS) { NotificationsScreen(onNavigate = onNavigate) }
                composable(Routes.MY_PROFILE) { ProfileScreen(userId = null, onNavigate = onNavigate) }
                composable(Routes.SETTINGS) {
                    SettingsScreen(
                        isDarkTheme = isDarkTheme,
                        onToggleTheme = onToggleTheme,
                        notificationPrivacy = notificationPrivacy,
                        onNotificationPrivacyChange = { value -> coroutineScope.launch { appPreferences.setMessageNotificationPrivacy(value) } },
                    )
                }
                composable(
                    Routes.PROFILE_PATTERN,
                    arguments = listOf(navArgument(Routes.PROFILE_ARG) {}),
                ) { backStackEntry ->
                    val userId = backStackEntry.arguments?.getString(Routes.PROFILE_ARG).orEmpty()
                    ProfileScreen(userId = userId, onNavigate = onNavigate)
                }
                composable(
                    Routes.POST_PATTERN,
                    arguments = listOf(navArgument(Routes.POST_ARG) {}),
                ) { backStackEntry ->
                    val postId = backStackEntry.arguments?.getString(Routes.POST_ARG).orEmpty()
                    PostDetailScreen(postId = postId, onNavigate = onNavigate)
                }
                composable(
                    Routes.CHAT_PATTERN,
                    arguments = listOf(
                        navArgument(Routes.CHAT_CONVERSATION_ARG) { type = NavType.StringType },
                        navArgument(Routes.CHAT_PEER_ID_ARG) { type = NavType.StringType; nullable = true; defaultValue = null },
                        navArgument(Routes.CHAT_PEER_NAME_ARG) { type = NavType.StringType; nullable = true; defaultValue = null },
                        navArgument(Routes.CHAT_PEER_AVATAR_ARG) { type = NavType.StringType; nullable = true; defaultValue = null },
                        navArgument(Routes.CHAT_PEER_LAST_SEEN_ARG) { type = NavType.StringType; nullable = true; defaultValue = null },
                        navArgument(Routes.CHAT_PEER_ONLINE_ARG) { type = NavType.BoolType; defaultValue = false },
                        navArgument(Routes.CHAT_MESSAGE_ARG) { type = NavType.StringType; nullable = true; defaultValue = null },
                    ),
                ) { backStackEntry ->
                    val args = backStackEntry.arguments
                    val conversationId = args?.getString(Routes.CHAT_CONVERSATION_ARG).orEmpty()
                    fun decoded(key: String) = args?.getString(key)?.takeIf { it.isNotBlank() }?.let { Routes.decode(it) }
                    ChatScreen(
                        conversationId = conversationId,
                        peerId = decoded(Routes.CHAT_PEER_ID_ARG),
                        peerName = decoded(Routes.CHAT_PEER_NAME_ARG),
                        peerAvatarUrl = decoded(Routes.CHAT_PEER_AVATAR_ARG),
                        peerLastSeenAt = decoded(Routes.CHAT_PEER_LAST_SEEN_ARG),
                        peerIsOnline = args?.getBoolean(Routes.CHAT_PEER_ONLINE_ARG) ?: false,
                        targetMessageId = decoded(Routes.CHAT_MESSAGE_ARG),
                        onNavigate = onNavigate,
                    )
                }
                composable(Routes.STUDY) { StudyScreen(onNavigate = onNavigate) }
                composable(Routes.QUIZ) { QuizBrowseScreen(onNavigate = onNavigate) }
                composable(
                    Routes.QUIZ_PLAY_PATTERN,
                    arguments = listOf(
                        navArgument(Routes.QUIZ_CHAPTER_ARG) { type = NavType.StringType },
                        navArgument(Routes.QUIZ_SET_ARG) { type = NavType.IntType },
                    ),
                ) { backStackEntry ->
                    val args = backStackEntry.arguments
                    QuizPlayScreen(
                        chapterId = args?.getString(Routes.QUIZ_CHAPTER_ARG).orEmpty(),
                        setNumber = args?.getInt(Routes.QUIZ_SET_ARG) ?: 1,
                    )
                }
                composable(Routes.LEADERBOARD) { LeaderboardScreen() }
                composable(Routes.TIC_TAC_TOE) { TttLobbyScreen(onNavigate = onNavigate) }
                composable(
                    Routes.TTT_GAME_PATTERN,
                    arguments = listOf(navArgument(Routes.TTT_GAME_ARG) { type = NavType.StringType }),
                ) { backStackEntry ->
                    val gameId = backStackEntry.arguments?.getString(Routes.TTT_GAME_ARG).orEmpty()
                    TttGameScreen(gameId = gameId, onNavigate = onNavigate)
                }
                composable(Routes.GAMES) { GamesCatalogScreen(onNavigate = onNavigate) }
                composable(
                    Routes.GAME_PLAY_PATTERN,
                    arguments = listOf(navArgument(Routes.GAME_TYPE_ARG) { type = NavType.StringType }),
                ) { backStackEntry ->
                    val gameType = backStackEntry.arguments?.getString(Routes.GAME_TYPE_ARG).orEmpty()
                    GamePlayScreen(gameType = gameType)
                }
                composable(
                    Routes.CHALLENGE_PLAY_PATTERN,
                    arguments = listOf(navArgument(Routes.CHALLENGE_MATCH_ARG) { type = NavType.StringType }),
                ) { backStackEntry ->
                    val matchId = backStackEntry.arguments?.getString(Routes.CHALLENGE_MATCH_ARG).orEmpty()
                    ChallengePlayScreen(matchId = matchId)
                }
                composable(Routes.LUDO) { LudoHomeScreen(onNavigate = onNavigate) }
                composable(Routes.LUDO_ONLINE) { LudoLobbyScreen(onNavigate = onNavigate) }
                composable(Routes.LUDO_LOCAL) { LudoLocalModesScreen(onNavigate = onNavigate) }
                composable(
                    Routes.LUDO_LOCAL_GAME_PATTERN,
                    arguments = listOf(
                        navArgument(Routes.LUDO_LOCAL_MODE_ARG) { type = NavType.StringType },
                        navArgument(Routes.LUDO_LOCAL_PLAYER_COUNT_ARG) { type = NavType.IntType; defaultValue = 4 },
                    ),
                ) { entry ->
                    LudoLocalGameScreen(
                        modeId = entry.arguments?.getString(Routes.LUDO_LOCAL_MODE_ARG).orEmpty(),
                        playerCount = entry.arguments?.getInt(Routes.LUDO_LOCAL_PLAYER_COUNT_ARG) ?: 4,
                        onNavigate = onNavigate,
                    )
                }
                composable(
                    Routes.LUDO_GAME_PATTERN,
                    arguments = listOf(navArgument(Routes.LUDO_GAME_ARG) { type = NavType.StringType }),
                ) { backStackEntry ->
                    val gameId = backStackEntry.arguments?.getString(Routes.LUDO_GAME_ARG).orEmpty()
                    LudoGameScreen(gameId = gameId, onNavigate = onNavigate)
                }
            }
            BackHandler(enabled = isLudoGameplay) {
                if (ludoChromeController.onBackPressed() == LudoBackAction.NAVIGATE_BACK) {
                    navController.popBackStack()
                }
            }
            CallGlobalHost(configuredCallIceServers())
        }
    }

    if (showLogoutConfirmation) {
        AlertDialog(
            onDismissRequest = { if (!isLoggingOut) showLogoutConfirmation = false },
            title = { Text("Log out?") },
            text = { Text("You will need to sign in again to use KothaX.") },
            confirmButton = {
                TextButton(
                    enabled = !isLoggingOut,
                    onClick = {
                        isLoggingOut = true
                        coroutineScope.launch {
                            sessionManager.logout()
                            isLoggingOut = false
                            showLogoutConfirmation = false
                            onSignedOut(NavigationEvent.NavigateTo(Routes.LOGIN, popUpToInclusive = Routes.MAIN))
                        }
                    },
                ) { Text(if (isLoggingOut) "Logging out…" else "Log out") }
            },
            dismissButton = {
                TextButton(enabled = !isLoggingOut, onClick = { showLogoutConfirmation = false }) { Text("Cancel") }
            },
        )
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun MessagesHubScreen(
    showCalls: Boolean,
    navController: NavController,
    onNavigate: (NavigationEvent) -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        TabRow(selectedTabIndex = if (showCalls) 1 else 0) {
            Tab(
                selected = !showCalls,
                onClick = { navController.navigate(Routes.MESSAGES) { popUpTo(Routes.MESSAGES); launchSingleTop = true } },
                text = { Text("Chats") },
            )
            Tab(
                selected = showCalls,
                onClick = { navController.navigate(Routes.MESSAGES_CALLS) { popUpTo(Routes.MESSAGES); launchSingleTop = true } },
                text = { Text("Calls") },
            )
        }
        if (showCalls) CallHistoryScreen() else ConversationsScreen(onNavigate = onNavigate)
    }
}

private fun configuredCallIceServers(): List<IceServerConfig> = buildList {
    val stunUrls = BuildConfig.CALL_STUN_URLS.split(',').map(String::trim).filter(String::isNotEmpty)
    if (stunUrls.isNotEmpty()) add(IceServerConfig(stunUrls))
    if (BuildConfig.CALL_TURN_URL.isNotBlank()) {
        add(
            IceServerConfig(
                urls = listOf(BuildConfig.CALL_TURN_URL),
                username = BuildConfig.CALL_TURN_USERNAME.takeIf(String::isNotBlank),
                credential = BuildConfig.CALL_TURN_CREDENTIAL.takeIf(String::isNotBlank),
            ),
        )
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun MainTopBar(
    searchOpen: Boolean,
    searchQuery: String,
    searchResults: List<SafeUserDto>,
    searchLoading: Boolean,
    searchError: String?,
    onSearchOpen: () -> Unit,
    onSearchClose: () -> Unit,
    onSearchQueryChange: (String) -> Unit,
    onOpenProfile: (String) -> Unit,
    onHome: () -> Unit,
    onStudy: () -> Unit,
    onProfile: () -> Unit,
    ownProfile: ProfileUiModel?,
    onSettings: () -> Unit,
    onRequestLogout: () -> Unit,
) {
    Column {
        TopAppBar(
            title = {
                if (searchOpen) {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = onSearchQueryChange,
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        placeholder = { Text("Search people") },
                        leadingIcon = { AppIcon(AppSymbol.SEARCH, contentDescription = null) },
                    )
                } else {
                    TextButton(onClick = onHome) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(32.dp)
                                    .clip(RoundedCornerShape(9.dp))
                                    .background(MaterialTheme.colorScheme.primary),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text("K", color = Color.White, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            },
            actions = {
                if (searchOpen) {
                    IconButton(onClick = onSearchClose) {
                        AppIcon(AppSymbol.CLOSE, contentDescription = "Close search")
                    }
                } else {
                    IconButton(onClick = onSearchOpen) {
                        AppIcon(AppSymbol.SEARCH, contentDescription = "Search people")
                    }
                    IconButton(onClick = onStudy) {
                        AppIcon(AppSymbol.STUDY, contentDescription = "Open Study")
                    }
                    var profileMenuExpanded by remember { mutableStateOf(false) }
                    Box {
                        IconButton(
                            onClick = { profileMenuExpanded = true },
                            modifier = Modifier.size(48.dp).semantics { contentDescription = "Open profile menu" },
                        ) {
                            if (ownProfile == null) {
                                AppIcon(AppSymbol.ACCOUNT, contentDescription = null, modifier = Modifier.size(36.dp))
                            } else {
                                AvatarImage(
                                    avatarUrl = ownProfile.avatarUrl,
                                    initials = ownProfile.initials,
                                    size = 36.dp,
                                )
                            }
                        }
                        DropdownMenu(
                            expanded = profileMenuExpanded,
                            onDismissRequest = { profileMenuExpanded = false },
                        ) {
                            DropdownMenuItem(
                                text = { Text("Profile") },
                                leadingIcon = { AppIcon(AppSymbol.ACCOUNT, contentDescription = null) },
                                onClick = { profileMenuExpanded = false; onProfile() },
                            )
                            DropdownMenuItem(
                                text = { Text("Kotha-Study") },
                                leadingIcon = { AppIcon(AppSymbol.STUDY, contentDescription = null) },
                                onClick = { profileMenuExpanded = false; onStudy() },
                            )
                            DropdownMenuItem(
                                text = { Text("Settings") },
                                leadingIcon = { AppIcon(AppSymbol.SETTINGS, contentDescription = null) },
                                onClick = { profileMenuExpanded = false; onSettings() },
                            )
                            DropdownMenuItem(
                                text = { Text("Logout") },
                                leadingIcon = { AppIcon(AppSymbol.LOGOUT, contentDescription = null) },
                                onClick = { profileMenuExpanded = false; onRequestLogout() },
                            )
                        }
                    }
                }
            },
        )

        if (searchOpen && searchQuery.isNotBlank()) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shadowElevation = 4.dp,
            ) {
                when {
                    searchLoading -> LinearProgressIndicator(Modifier.fillMaxWidth())
                    searchError != null -> Text(
                        text = searchError,
                        modifier = Modifier.padding(16.dp),
                        color = MaterialTheme.colorScheme.error,
                    )
                    searchResults.isEmpty() -> Text(
                        text = "No people found",
                        modifier = Modifier.padding(16.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    else -> LazyColumn(modifier = Modifier.heightIn(max = 320.dp)) {
                        items(searchResults, key = { it.id }) { person ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onOpenProfile(person.id) }
                                    .padding(horizontal = 16.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                AvatarImage(
                                    avatarUrl = person.avatar?.secureUrl,
                                    initials = person.initials ?: person.fullName,
                                )
                                Text(
                                    text = person.fullName,
                                    modifier = Modifier.padding(start = 12.dp),
                                    style = MaterialTheme.typography.bodyLarge,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingsScreen(
    isDarkTheme: Boolean,
    onToggleTheme: () -> Unit,
    notificationPrivacy: MessageNotificationPrivacy,
    onNotificationPrivacyChange: (MessageNotificationPrivacy) -> Unit,
) {
    Column(Modifier.fillMaxSize().padding(com.kothabarta.core.ui.theme.Spacing.lg)) {
        Text("Settings", style = MaterialTheme.typography.headlineSmall)
        Surface(
            modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surfaceVariant,
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().clickable(onClick = onToggleTheme).padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                AppIcon(AppSymbol.DARK_MODE, contentDescription = null)
                Text("Dark theme", modifier = Modifier.weight(1f).padding(start = 16.dp), style = MaterialTheme.typography.bodyLarge)
                Switch(checked = isDarkTheme, onCheckedChange = { onToggleTheme() })
            }
        }
        Text("Message notifications", modifier = Modifier.padding(top = 24.dp), style = MaterialTheme.typography.titleMedium)
        Text("Choose what appears in message alerts", style = MaterialTheme.typography.bodyMedium)
        listOf(
            MessageNotificationPrivacy.SHOW_SENDER_AND_PREVIEW to "Sender and message preview",
            MessageNotificationPrivacy.SHOW_SENDER_ONLY to "Sender only",
            MessageNotificationPrivacy.HIDE_NOTIFICATION_CONTENT to "Hide notification content",
        ).forEach { (value, label) ->
            Row(
                modifier = Modifier.fillMaxWidth().clickable { onNotificationPrivacyChange(value) }.padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                RadioButton(selected = notificationPrivacy == value, onClick = { onNotificationPrivacyChange(value) })
                Text(label, modifier = Modifier.padding(start = 8.dp))
            }
        }
    }
}
