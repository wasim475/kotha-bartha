package com.kothabarta.app.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.NavType
import androidx.navigation.navArgument
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.feature.calls.ui.CallGlobalHost
import com.kothabarta.feature.calls.ui.CallHistoryScreen
import com.kothabarta.feature.friends.ui.FriendsScreen
import com.kothabarta.feature.games.ui.ChallengePlayScreen
import com.kothabarta.feature.games.ui.GamePlayScreen
import com.kothabarta.feature.games.ui.GamesCatalogScreen
import com.kothabarta.feature.home.ui.FeedScreen
import com.kothabarta.feature.home.ui.PostDetailScreen
import com.kothabarta.feature.leaderboard.ui.LeaderboardScreen
import com.kothabarta.feature.ludo.ui.LudoGameScreen
import com.kothabarta.feature.ludo.ui.LudoLobbyScreen
import com.kothabarta.feature.messages.ui.ChatScreen
import com.kothabarta.feature.messages.ui.ConversationsScreen
import com.kothabarta.feature.notifications.data.NotificationBadge
import com.kothabarta.feature.notifications.ui.NotificationsScreen
import com.kothabarta.feature.profile.ui.ProfileScreen
import com.kothabarta.feature.quiz.ui.QuizBrowseScreen
import com.kothabarta.feature.quiz.ui.QuizPlayScreen
import com.kothabarta.feature.study.ui.StudyScreen
import com.kothabarta.feature.tictactoe.ui.TttGameScreen
import com.kothabarta.feature.tictactoe.ui.TttLobbyScreen
import org.koin.compose.koinInject

private data class BottomNavItem(val route: String, val label: String, val emoji: String)

private val BOTTOM_NAV_ITEMS = listOf(
    BottomNavItem(Routes.HOME, "Home", "🏠"),
    BottomNavItem(Routes.FRIENDS, "Friends", "👥"),
    BottomNavItem(Routes.MESSAGES, "Messages", "💬"),
    BottomNavItem(Routes.STUDY, "Study", "📚"),
    BottomNavItem(Routes.NOTIFICATIONS, "Alerts", "🔔"),
    BottomNavItem(Routes.MY_PROFILE, "Profile", "👤"),
)

/**
 * The post-login "app shell": its own `NavController`/`NavHost`, entirely
 * separate from the pre-login one in `KothaBartaNavHost` — a common,
 * intentional split between an "auth graph" and a "main graph" rather than
 * one flat graph mixing both.
 */
@Composable
fun MainScreen(onSignedOut: (NavigationEvent) -> Unit) {
    val navController = rememberNavController()
    val notificationBadge = koinInject<NotificationBadge>()
    val unreadCount by notificationBadge.unreadCount.collectAsState()

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

    Scaffold(
        bottomBar = {
            val backStackEntry by navController.currentBackStackEntryAsState()
            val currentRoute = backStackEntry?.destination
            NavigationBar {
                BOTTOM_NAV_ITEMS.forEach { item ->
                    val selected = currentRoute?.hierarchy?.any { it.route == item.route } == true
                    NavigationBarItem(
                        selected = selected,
                        onClick = {
                            navController.navigate(item.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Text(item.emoji) },
                        label = {
                            Text(if (item.route == Routes.NOTIFICATIONS && unreadCount > 0) "${item.label} ($unreadCount)" else item.label)
                        },
                    )
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
                composable(Routes.HOME) { FeedScreen(onNavigate = onNavigate) }
                composable(Routes.FRIENDS) { FriendsScreen(onNavigate = onNavigate) }
                composable(Routes.MESSAGES) { ConversationsScreen(onNavigate = onNavigate) }
                composable(Routes.NOTIFICATIONS) { NotificationsScreen(onNavigate = onNavigate) }
                composable(Routes.MY_PROFILE) { ProfileScreen(userId = null, onNavigate = onNavigate) }
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
                composable(Routes.LUDO) { LudoLobbyScreen(onNavigate = onNavigate) }
                composable(
                    Routes.LUDO_GAME_PATTERN,
                    arguments = listOf(navArgument(Routes.LUDO_GAME_ARG) { type = NavType.StringType }),
                ) { backStackEntry ->
                    val gameId = backStackEntry.arguments?.getString(Routes.LUDO_GAME_ARG).orEmpty()
                    LudoGameScreen(gameId = gameId, onNavigate = onNavigate)
                }
            }
            CallGlobalHost()
        }
    }
}
