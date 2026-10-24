package com.kothabarta.feature.home.data

import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.common.map
import com.kothabarta.core.network.safeApiCall
import com.kothabarta.core.network.safeApiCallWithMeta
import com.kothabarta.core.network.social.PostDto
import com.kothabarta.core.network.social.PostsApi
import com.kothabarta.core.network.social.ReactionRequest
import com.kothabarta.core.network.social.ReactionResponse
import com.kothabarta.core.network.social.StoriesApi
import com.kothabarta.core.network.social.NotesApi
import com.kothabarta.core.network.social.StoryDto
import com.kothabarta.core.network.social.StoryGroupDto
import com.kothabarta.core.network.social.NoteDto
import com.kothabarta.core.network.social.NoteEntryDto
import com.kothabarta.core.network.social.CreateStoryBody
import com.kothabarta.core.network.social.CreateNoteBody
import com.kothabarta.core.network.social.EditPostBody
import com.kothabarta.core.network.social.DeletedResponse
import com.kothabarta.core.common.ApiError
import com.kothabarta.core.network.social.CommentsApi
import com.kothabarta.core.network.social.CommentDto
import com.kothabarta.core.network.social.CreateCommentBody
import com.kothabarta.core.network.social.ReportsApi
import com.kothabarta.core.network.social.CreateReportBody
import com.kothabarta.core.network.social.ReportCreatedDto
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody

data class FeedPage(val posts: List<PostDto>, val nextCursor: String?, val hasMore: Boolean)

class FeedRepository(
    private val postsApi: PostsApi,
    private val storiesApi: StoriesApi? = null,
    private val notesApi: NotesApi? = null,
    private val commentsApi: CommentsApi? = null,
    private val reportsApi: ReportsApi? = null,
) {

    suspend fun getFeed(before: String? = null): ApiResult<FeedPage> =
        safeApiCallWithMeta { postsApi.getFeed(before) }.map { result ->
            FeedPage(result.data, result.meta?.nextCursor, result.meta?.hasMore == true)
        }

    suspend fun getPost(postId: String): ApiResult<PostDto> = safeApiCall { postsApi.getPost(postId) }

    suspend fun markFeedRead() {
        runCatching { safeApiCall { postsApi.markFeedRead() } }
    }

    /** Passing `null` removes the viewer's current reaction — mirrors the web client's toggle-off behavior. */
    suspend fun react(postId: String, type: String?): ApiResult<ReactionResponse> =
        safeApiCall { postsApi.reactToPost(postId, ReactionRequest(type)) }

    suspend fun createPost(body: String, photos: List<Triple<ByteArray, String, String>>): ApiResult<PostDto> {
        val bodyPart = body.toRequestBody("text/plain".toMediaTypeOrNull())
        val fileParts = photos.map { (bytes, name, mimeType) ->
            MultipartBody.Part.createFormData("files", name, bytes.toRequestBody(mimeType.toMediaTypeOrNull()))
        }
        return safeApiCall { postsApi.createPost(bodyPart, fileParts) }
    }

    suspend fun editPost(postId: String, body: String): ApiResult<PostDto> = safeApiCall { postsApi.editPost(postId, EditPostBody(body)) }

    suspend fun deletePost(postId: String): ApiResult<DeletedResponse> = safeApiCall { postsApi.deletePost(postId) }

    suspend fun getComments(postId: String): ApiResult<List<CommentDto>> = commentsApi?.let { safeApiCall { it.getComments(postId) } } ?: missingApi()

    suspend fun createComment(postId: String, body: String): ApiResult<CommentDto> = commentsApi?.let {
        safeApiCall { it.createComment(postId, CreateCommentBody(body)) }
    } ?: missingApi()

    suspend fun createReply(postId: String, parentId: String, body: String): ApiResult<CommentDto> = commentsApi?.let {
        safeApiCall { it.createComment(postId, CreateCommentBody(body, parentId)) }
    } ?: missingApi()

    suspend fun reactToComment(commentId: String, type: String?): ApiResult<ReactionResponse> = commentsApi?.let {
        safeApiCall { it.reactToComment(commentId, ReactionRequest(type)) }
    } ?: missingApi()

    suspend fun reportPost(postId: String, reason: String, description: String): ApiResult<ReportCreatedDto> = reportsApi?.let {
        safeApiCall { it.createReport(CreateReportBody(targetId = postId, reason = reason, description = description)) }
    } ?: missingApi()

    suspend fun getStories(): ApiResult<List<StoryGroupDto>> = storiesApi?.let { safeApiCall { it.getStories() } } ?: missingApi()

    suspend fun createTextStory(text: String): ApiResult<StoryDto> = storiesApi?.let {
        safeApiCall { it.createTextStory(CreateStoryBody(text = text)) }
    } ?: missingApi()

    suspend fun createImageStory(text: String, photo: Triple<ByteArray, String, String>): ApiResult<StoryDto> {
        val (bytes, name, mime) = photo
        val part = MultipartBody.Part.createFormData("file", name, bytes.toRequestBody(mime.toMediaTypeOrNull()))
        val type = "image".toRequestBody("text/plain".toMediaTypeOrNull())
        val caption = text.toRequestBody("text/plain".toMediaTypeOrNull())
        return storiesApi?.let { safeApiCall { it.createImageStory(type, caption, part) } } ?: missingApi()
    }

    suspend fun deleteStory(storyId: String): ApiResult<DeletedResponse> = storiesApi?.let { safeApiCall { it.deleteStory(storyId) } } ?: missingApi()

    suspend fun getNotes(): ApiResult<List<NoteEntryDto>> = notesApi?.let { safeApiCall { it.getNotes() } } ?: missingApi()

    suspend fun createNote(text: String): ApiResult<NoteDto> = notesApi?.let { safeApiCall { it.createNote(CreateNoteBody(text)) } } ?: missingApi()

    suspend fun deleteNote(noteId: String): ApiResult<DeletedResponse> = notesApi?.let { safeApiCall { it.deleteNote(noteId) } } ?: missingApi()

    private fun <T> missingApi(): ApiResult<T> = ApiResult.Failure(ApiError("API_UNAVAILABLE", "This action isn't available right now."))
}
