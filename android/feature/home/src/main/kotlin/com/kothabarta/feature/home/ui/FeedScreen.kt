package com.kothabarta.feature.home.ui

import android.net.Uri
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.ui.components.AvatarImage
import com.kothabarta.core.ui.components.EmptyState
import com.kothabarta.core.ui.components.FullScreenError
import com.kothabarta.core.ui.components.FullScreenLoading
import com.kothabarta.core.ui.components.NetworkImage
import com.kothabarta.core.ui.theme.Spacing
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.map
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.graphics.Color
import org.koin.androidx.compose.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedScreen(
    onNavigate: (NavigationEvent) -> Unit,
    viewer: FeedViewer = FeedViewer(),
    viewModel: FeedViewModel = koinViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val listState = rememberLazyListState()

    LaunchedEffect(Unit) {
        viewModel.navigationEvents.collect(onNavigate)
    }

    when {
        state.isLoading -> FullScreenLoading()
        state.error != null && state.posts.isEmpty() -> FullScreenError(state.error!!, onRetry = viewModel::retry)
        else -> PullToRefreshBox(
            isRefreshing = state.isRefreshing,
            onRefresh = viewModel::refresh,
            modifier = Modifier.fillMaxSize(),
        ) {
            LaunchedEffect(listState, state.hasMore, state.isLoadingMore, state.posts.size) {
                snapshotFlow {
                    val layout = listState.layoutInfo
                    layout.visibleItemsInfo.lastOrNull()?.index?.let { it >= layout.totalItemsCount - 4 } == true
                }.distinctUntilChanged().filter { it }.collect { viewModel.loadMore() }
            }
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = Spacing.sm),
                verticalArrangement = Arrangement.spacedBy(Spacing.md),
            ) {
                item(key = "create-post") { FeedComposer(viewer, state.isCreatingPost, state.createPostError, state.posts.firstOrNull()?.id) { body, photos -> viewModel.createPost(body, photos) } }
                item(key = "social-updates") {
                    SocialUpdates(
                        viewer = viewer,
                        stories = state.stories,
                        notes = state.notes,
                        isSubmitting = state.isCreatingSocialUpdate,
                        socialUpdateVersion = state.socialUpdateVersion,
                        socialUpdateError = state.socialUpdateError,
                        onCreateNote = viewModel::createNote,
                        onCreateTextStory = viewModel::createTextStory,
                        onCreateImageStory = viewModel::createImageStory,
                    )
                }
                if (state.posts.isEmpty()) {
                    item(key = "empty-feed") { EmptyState("Your feed is quiet for now — add friends to see their posts here.") }
                } else {
                    items(state.posts, key = { it.id }) { post ->
                        PostCard(
                            post = post,
                            onOpenPost = viewModel::openPost,
                            onOpenProfile = viewModel::openProfile,
                            onReact = { type -> viewModel.toggleReaction(post, type) },
                            onEdit = viewModel::editPost,
                            onDelete = viewModel::deletePost,
                            onReport = { id, reason, description -> viewModel.reportPost(id, reason, description) },
                            actionInFlight = state.postActionInFlightId == post.id,
                            reportInFlight = state.reportInFlightId == post.id,
                            reactionEnabled = post.id !in state.reactionInFlightPostIds,
                        )
                    }
                }
                if (state.isLoadingMore) {
                    item(key = "loading-more") {
                        Box(Modifier.fillMaxWidth().padding(Spacing.md), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.dp)
                        }
                    }
                }
                state.loadMoreError?.let { message ->
                    item(key = "load-more-error") {
                        TextButton(onClick = viewModel::loadMore, modifier = Modifier.fillMaxWidth()) { Text("$message · Retry") }
                    }
                }
            }
        }
    }

    state.createPostError?.let { message ->
        AlertDialog(
            onDismissRequest = viewModel::dismissCreatePostError,
            title = { Text("Couldn't create post") },
            text = { Text(message) },
            confirmButton = { TextButton(onClick = viewModel::dismissCreatePostError) { Text("OK") } },
        )
    }
    state.socialUpdateError?.let { message ->
        AlertDialog(
            onDismissRequest = viewModel::dismissSocialUpdateError,
            title = { Text("Couldn't share update") },
            text = { Text(message) },
            confirmButton = { TextButton(onClick = viewModel::dismissSocialUpdateError) { Text("OK") } },
        )
    }
    if (state.error != null && state.posts.isNotEmpty()) {
        AlertDialog(
            onDismissRequest = viewModel::dismissError,
            title = { Text("Feed update failed") },
            text = { Text(state.error!!) },
            confirmButton = { TextButton(onClick = viewModel::retry) { Text("Retry") } },
            dismissButton = { TextButton(onClick = { viewModel.dismissError() }) { Text("Dismiss") } },
        )
    }
    state.postActionError?.let { message ->
        AlertDialog(
            onDismissRequest = viewModel::dismissPostActionError,
            title = { Text("Couldn't update post") },
            text = { Text(message) },
            confirmButton = { TextButton(onClick = viewModel::dismissPostActionError) { Text("OK") } },
        )
    }
    state.reportConfirmation?.let { message ->
        AlertDialog(
            onDismissRequest = viewModel::dismissReportConfirmation,
            title = { Text("Report sent") },
            text = { Text(message) },
            confirmButton = { TextButton(onClick = viewModel::dismissReportConfirmation) { Text("OK") } },
        )
    }
}

data class FeedViewer(val name: String = "", val avatarUrl: String? = null, val initials: String = "Me")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FeedComposer(
    viewer: FeedViewer,
    isSubmitting: Boolean,
    submitError: String?,
    latestPostId: String?,
    onSubmit: (String, List<Triple<ByteArray, String, String>>) -> Unit,
) {
    val context = LocalContext.current
    var open by remember { mutableStateOf(false) }
    var body by remember { mutableStateOf("") }
    var photoPreparationError by remember { mutableStateOf<String?>(null) }
    val selected = remember { mutableStateListOf<Uri>() }
    val scope = rememberCoroutineScope()
    var submitRequested by remember { mutableStateOf(false) }
    var postIdBeforeSubmit by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(latestPostId, submitError) {
        if (submitRequested && latestPostId != null && latestPostId != postIdBeforeSubmit) {
            submitRequested = false
            body = ""
            selected.clear()
            open = false
        } else if (submitRequested && submitError != null) {
            submitRequested = false
        }
    }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(6)) { uris ->
        if (uris.isNotEmpty()) {
            photoPreparationError = null
            selected.addAll((selected.toList() + uris).distinct().take(6))
        }
    }

    Surface(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.md),
        shape = RoundedCornerShape(22.dp),
        color = MaterialTheme.colorScheme.surfaceContainerLow,
    ) {
        Column(Modifier.padding(Spacing.md), verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                AvatarImage(viewer.avatarUrl, viewer.initials, size = 44.dp)
                Surface(
                    modifier = Modifier.weight(1f).clickable { open = true },
                    shape = RoundedCornerShape(24.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                ) {
                    Text("What's on your mind?", modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.45f))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                TextButton(onClick = { open = true; picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }) { Text("▧  Photo") }
                TextButton(onClick = { open = true }) { Text("＋  Post") }
            }
        }
    }

    if (open) {
        ModalBottomSheet(onDismissRequest = { if (!isSubmitting) open = false }) {
            Column(Modifier.fillMaxWidth().padding(horizontal = Spacing.lg).padding(bottom = Spacing.lg), verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
                Text("Create post", style = MaterialTheme.typography.titleLarge)
                OutlinedTextField(
                    value = body,
                    onValueChange = { body = it },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    maxLines = 8,
                    placeholder = { Text("What's on your mind, ${viewer.name.ifBlank { "friend" }}?") },
                )
                if (selected.isNotEmpty()) {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                        items(selected, key = { it.toString() }) { uri ->
                            Box {
                                NetworkImage(uri.toString(), "Selected post photo", Modifier.size(100.dp).clip(RoundedCornerShape(14.dp)))
                                Text("×", modifier = Modifier.align(Alignment.TopEnd).clickable { selected.remove(uri) }.background(MaterialTheme.colorScheme.surface, RoundedCornerShape(50)).padding(horizontal = 7.dp))
                            }
                        }
                    }
                }
                photoPreparationError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    TextButton(enabled = !isSubmitting && selected.size < 6, onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }) { Text("Add photos (${selected.size}/6)") }
                    Button(
                        enabled = !isSubmitting && !submitRequested && (body.isNotBlank() || selected.isNotEmpty()),
                        onClick = {
                            scope.launch {
                                val photos = selected.mapNotNull { uri ->
                                    readUploadPhoto(context, uri, "photo")
                                }
                                if (photos.size == selected.size) {
                                    photoPreparationError = null
                                    postIdBeforeSubmit = latestPostId
                                    submitRequested = true
                                    onSubmit(body, photos)
                                } else photoPreparationError = "Couldn't prepare one or more photos. Remove them and try again."
                            }
                        },
                    ) {
                        if (isSubmitting) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text("Post")
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SocialUpdates(
    viewer: FeedViewer,
    stories: List<com.kothabarta.core.network.social.StoryGroupDto>,
    notes: List<com.kothabarta.core.network.social.NoteEntryDto>,
    isSubmitting: Boolean,
    socialUpdateVersion: Long,
    socialUpdateError: String?,
    onCreateNote: (String) -> Unit,
    onCreateTextStory: (String) -> Unit,
    onCreateImageStory: (String, Triple<ByteArray, String, String>) -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var showStoryComposer by remember { mutableStateOf(false) }
    var showNoteComposer by remember { mutableStateOf(false) }
    var selectedStoryGroup by remember { mutableStateOf<com.kothabarta.core.network.social.StoryGroupDto?>(null) }
    var storyText by remember { mutableStateOf("") }
    var noteText by remember { mutableStateOf("") }
    var storyPhoto by remember { mutableStateOf<Uri?>(null) }
    var storyPhotoError by remember { mutableStateOf<String?>(null) }
    var isPreparingStoryPhoto by remember { mutableStateOf(false) }
    var submittedVersion by remember { mutableStateOf<Long?>(null) }
    val storyPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> if (uri != null) { storyPhoto = uri; storyPhotoError = null } }
    LaunchedEffect(socialUpdateVersion, socialUpdateError, submittedVersion) {
        if (submittedVersion != null && socialUpdateVersion > submittedVersion!!) {
            submittedVersion = null
            showStoryComposer = false
            showNoteComposer = false
            storyPhoto = null
            storyText = ""
            noteText = ""
        } else if (socialUpdateError != null) {
            submittedVersion = null
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
        if (isSubmitting) LinearProgressIndicator(Modifier.fillMaxWidth().padding(horizontal = Spacing.md))
        Text("Stories", modifier = Modifier.padding(horizontal = Spacing.md), style = MaterialTheme.typography.titleMedium)
        LazyRow(contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = Spacing.md), horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            item(key = "add-story") {
                Column(Modifier.clickable { showStoryComposer = true }.padding(4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.size(64.dp).clip(RoundedCornerShape(22.dp)).background(MaterialTheme.colorScheme.secondaryContainer), contentAlignment = Alignment.Center) {
                        if (viewer.avatarUrl != null) NetworkImage(viewer.avatarUrl, null, Modifier.fillMaxSize().clip(RoundedCornerShape(22.dp)))
                        Text("+", color = MaterialTheme.colorScheme.onSecondaryContainer, style = MaterialTheme.typography.headlineMedium)
                    }
                    Text("Your story", style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(top = 4.dp))
                }
            }
            items(stories, key = { it.author.id }) { group ->
                Column(Modifier.clickable { selectedStoryGroup = group }.padding(4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.size(64.dp).clip(RoundedCornerShape(22.dp)).background(MaterialTheme.colorScheme.primaryContainer).padding(3.dp)) {
                        AvatarImage(group.author.avatar?.secureUrl, group.author.initials ?: group.author.fullName, modifier = Modifier.fillMaxSize(), size = 58.dp)
                    }
                    Text(if (group.isMine) "Your story" else group.author.fullName.substringBefore(' '), style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(top = 4.dp))
                }
            }
        }
        if (notes.isNotEmpty()) {
            Text("Notes", modifier = Modifier.padding(horizontal = Spacing.md), style = MaterialTheme.typography.titleMedium)
            LazyRow(contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = Spacing.md), horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                items(notes, key = { it.note.id }) { entry ->
                    Surface(shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.tertiaryContainer, modifier = Modifier.size(width = 180.dp, height = 82.dp)) {
                        Column(Modifier.padding(Spacing.sm), verticalArrangement = Arrangement.SpaceBetween) {
                            Text(entry.note.text, maxLines = 2, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onTertiaryContainer)
                            Text(if (entry.isMine) "You" else entry.author.fullName, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onTertiaryContainer)
                        }
                    }
                }
                item(key = "add-note") {
                    Surface(shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surfaceVariant, modifier = Modifier.size(width = 110.dp, height = 82.dp).clickable { showNoteComposer = true }) {
                        Box(contentAlignment = Alignment.Center) { Text("＋ Note", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    }
                }
            }
        } else {
            TextButton(onClick = { showNoteComposer = true }, modifier = Modifier.padding(start = Spacing.md)) { Text("＋ Add a note") }
        }
    }

    if (showStoryComposer) {
        AlertDialog(
            onDismissRequest = { if (!isSubmitting) { showStoryComposer = false; storyPhoto = null; storyText = "" } },
            title = { Text("Create a story") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                    OutlinedTextField(value = storyText, onValueChange = { if (it.length <= 500) storyText = it }, label = { Text(if (storyPhoto == null) "Your story" else "Caption (optional)") }, modifier = Modifier.fillMaxWidth())
                    storyPhoto?.let { NetworkImage(it.toString(), "Story preview", Modifier.fillMaxWidth().height(150.dp).clip(RoundedCornerShape(14.dp))) }
                    if (isPreparingStoryPhoto) LinearProgressIndicator(Modifier.fillMaxWidth())
                    storyPhotoError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                    TextButton(onClick = { storyPicker.launch("image/*") }) { Text(if (storyPhoto == null) "Add photo" else "Change photo") }
                }
            },
            confirmButton = {
                TextButton(enabled = !isSubmitting && !isPreparingStoryPhoto && submittedVersion == null && (storyText.isNotBlank() || storyPhoto != null), onClick = {
                    val photo = storyPhoto
                    submittedVersion = socialUpdateVersion
                    if (photo == null) onCreateTextStory(storyText) else scope.launch {
                        isPreparingStoryPhoto = true
                        val selectedFile = readUploadPhoto(context, photo, "story")
                        isPreparingStoryPhoto = false
                        if (selectedFile != null) onCreateImageStory(storyText, selectedFile) else {
                            submittedVersion = null
                            storyPhotoError = "Couldn't prepare this photo. Choose another image and try again."
                        }
                    }
                }) { Text("Share") }
            },
            dismissButton = { TextButton(onClick = { showStoryComposer = false }) { Text("Cancel") } },
        )
    }

    if (showNoteComposer) {
        AlertDialog(
            onDismissRequest = { if (!isSubmitting) showNoteComposer = false },
            title = { Text("Share a note") },
            text = { OutlinedTextField(value = noteText, onValueChange = { if (it.length <= 150) noteText = it }, label = { Text("Short note (24 hours)") }, modifier = Modifier.fillMaxWidth(), minLines = 2) },
            confirmButton = {
                TextButton(enabled = !isSubmitting && submittedVersion == null && noteText.isNotBlank(), onClick = { submittedVersion = socialUpdateVersion; onCreateNote(noteText) }) { Text("Share") }
            },
            dismissButton = { TextButton(onClick = { showNoteComposer = false }) { Text("Cancel") } },
        )
    }

    selectedStoryGroup?.let { group ->
        var index by remember(group.author.id) { mutableStateOf(0) }
        val story = group.stories.getOrNull(index)
        if (story != null) {
            androidx.compose.ui.window.Dialog(onDismissRequest = { selectedStoryGroup = null }, properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false)) {
                Surface(Modifier.fillMaxWidth().height(520.dp).padding(16.dp), shape = RoundedCornerShape(28.dp), color = MaterialTheme.colorScheme.surface) {
                    Box(Modifier.fillMaxSize().clickable { if (index < group.stories.lastIndex) index++ else selectedStoryGroup = null }, contentAlignment = Alignment.Center) {
                        if (story.type == "image") NetworkImage(story.media?.secureUrl, "Story image", Modifier.fillMaxSize().clip(RoundedCornerShape(28.dp)))
                        else Box(Modifier.fillMaxSize().background(runCatching { Color(android.graphics.Color.parseColor(story.backgroundColor ?: "#e96449")) }.getOrDefault(MaterialTheme.colorScheme.primaryContainer)), contentAlignment = Alignment.Center) {
                            Text(story.text, modifier = Modifier.padding(32.dp), style = MaterialTheme.typography.headlineMedium, color = runCatching { Color(android.graphics.Color.parseColor(story.textColor ?: "#ffffff")) }.getOrDefault(Color.White))
                        }
                        Text("${group.author.fullName} · ${index + 1}/${group.stories.size}", modifier = Modifier.align(Alignment.TopStart).padding(20.dp), color = Color.White, style = MaterialTheme.typography.titleMedium)
                    }
                }
            }
        }
    }
}

/** Down-sample photo-picker images before retaining multipart bytes in memory. */
private suspend fun readUploadPhoto(context: android.content.Context, uri: Uri, name: String): Triple<ByteArray, String, String>? =
    withContext(Dispatchers.IO) {
        runCatching {
            val resolver = context.contentResolver
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return@runCatching null

            var sample = 1
            while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 2048) sample *= 2
            val bitmap = resolver.openInputStream(uri)?.use { input ->
                BitmapFactory.decodeStream(input, null, BitmapFactory.Options().apply { inSampleSize = sample })
            } ?: return@runCatching null
            val orientation = resolver.openInputStream(uri)?.use { ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) }
                ?: ExifInterface.ORIENTATION_NORMAL
            val matrix = Matrix().apply {
                when (orientation) {
                    ExifInterface.ORIENTATION_ROTATE_90 -> postRotate(90f)
                    ExifInterface.ORIENTATION_ROTATE_180 -> postRotate(180f)
                    ExifInterface.ORIENTATION_ROTATE_270 -> postRotate(270f)
                    ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> postScale(-1f, 1f)
                    ExifInterface.ORIENTATION_FLIP_VERTICAL -> postScale(1f, -1f)
                }
            }
            val oriented = if (!matrix.isIdentity) Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true) else bitmap
            val bytes = java.io.ByteArrayOutputStream().use { output ->
                oriented.compress(Bitmap.CompressFormat.JPEG, 86, output)
                output.toByteArray()
            }
            if (oriented !== bitmap) bitmap.recycle()
            oriented.recycle()
            Triple(bytes, "$name.jpg", "image/jpeg")
        }.getOrNull()
    }
