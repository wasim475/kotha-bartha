package com.kothabarta.feature.home.ui

import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.ApiMeta
import com.kothabarta.core.network.social.FeedReadResponse
import com.kothabarta.core.network.social.DeletedResponse
import com.kothabarta.core.network.social.EditPostBody
import com.kothabarta.core.network.social.PostDto
import com.kothabarta.core.network.social.PostsApi
import com.kothabarta.core.network.social.ReactionRequest
import com.kothabarta.core.network.social.ReactionResponse
import com.kothabarta.core.network.social.ReactionTypes
import com.kothabarta.core.network.social.SafeUserDto
import okhttp3.MultipartBody
import okhttp3.RequestBody
import com.kothabarta.feature.home.data.FeedRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class FeedViewModelTest {

    private val author = SafeUserDto(id = "u1", fullName = "Jane Doe")
    private fun post(id: String, reaction: String? = null) =
        PostDto(id = id, body = "hello", createdAt = "now", author = author, reaction = reaction)

    @Before
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial load populates posts from the feed`() = runTest {
        val viewModel = FeedViewModel(FeedRepository(FakePostsApi(feed = listOf(post("p1"), post("p2")))))
        advanceUntilIdle()
        assertEquals(listOf("p1", "p2"), viewModel.uiState.value.posts.map { it.id })
        assertEquals(false, viewModel.uiState.value.isLoading)
    }

    @Test
    fun `reacting patches only the tapped post, leaving others untouched`() = runTest {
        val api = FakePostsApi(feed = listOf(post("p1"), post("p2")))
        val viewModel = FeedViewModel(FeedRepository(api))
        advanceUntilIdle()

        viewModel.toggleReaction(viewModel.uiState.value.posts.first { it.id == "p1" }, ReactionTypes.LOVE)
        advanceUntilIdle()

        val posts = viewModel.uiState.value.posts
        assertEquals(ReactionTypes.LOVE, posts.first { it.id == "p1" }.reaction)
        assertNull(posts.first { it.id == "p2" }.reaction)
        assertEquals("p1", api.lastReactedPostId)
        assertEquals(ReactionTypes.LOVE, api.lastReactionType)
    }

    @Test
    fun `tapping the already-active reaction again removes it`() = runTest {
        val api = FakePostsApi(feed = listOf(post("p1", reaction = ReactionTypes.LIKE)))
        val viewModel = FeedViewModel(FeedRepository(api))
        advanceUntilIdle()

        viewModel.toggleReaction(viewModel.uiState.value.posts.first(), ReactionTypes.LIKE)
        advanceUntilIdle()

        assertNull(api.lastReactionType)
    }

    @Test
    fun `a failed load surfaces the server's own error message, not a generic fallback`() = runTest {
        val viewModel = FeedViewModel(FeedRepository(FakePostsApi(feed = null)))
        advanceUntilIdle()
        assertEquals("The feed server is on fire.", viewModel.uiState.value.error)
    }

    @Test
    fun `successful post creation prepends the server response to the feed`() = runTest {
        val api = FakePostsApi(feed = emptyList())
        val viewModel = FeedViewModel(FeedRepository(api))
        advanceUntilIdle()
        viewModel.createPost("new post", emptyList())
        advanceUntilIdle()
        assertEquals(listOf("created"), viewModel.uiState.value.posts.map { it.id })
        assertEquals(false, viewModel.uiState.value.isCreatingPost)
    }

    @Test
    fun `loading the next page appends posts and drops duplicate ids`() = runTest {
        val api = FakePostsApi(feed = listOf(post("p1")), nextPage = listOf(post("p1"), post("p2")), hasMore = true, cursor = "older")
        val viewModel = FeedViewModel(FeedRepository(api))
        advanceUntilIdle()
        viewModel.loadMore()
        advanceUntilIdle()
        assertEquals(listOf("p1", "p2"), viewModel.uiState.value.posts.map { it.id })
        assertEquals(false, viewModel.uiState.value.hasMore)
    }

    private class FakePostsApi(
        private val feed: List<PostDto>?,
        private val nextPage: List<PostDto> = emptyList(),
        private val hasMore: Boolean = false,
        private val cursor: String? = null,
    ) : PostsApi {
        var lastReactedPostId: String? = null
        var lastReactionType: String? = null

        override suspend fun getFeed(before: String?): Response<ApiEnvelope<List<PostDto>>> =
            if (feed != null) {
                if (before == null) Response.success(ApiEnvelope(data = feed, meta = ApiMeta(hasMore = hasMore, nextCursor = cursor)))
                else Response.success(ApiEnvelope(data = nextPage, meta = ApiMeta(hasMore = false)))
            } else {
                val body = "{\"error\":{\"code\":\"SERVER_ERROR\",\"message\":\"The feed server is on fire.\"}}"
                    .toResponseBody("application/json".toMediaType())
                Response.error(500, body)
            }

        override suspend fun getPost(postId: String): Response<ApiEnvelope<PostDto>> =
            Response.success(ApiEnvelope(data = feed?.first { it.id == postId }))

        override suspend fun markFeedRead(): Response<ApiEnvelope<FeedReadResponse>> =
            Response.success(ApiEnvelope(data = FeedReadResponse(read = true)))

        override suspend fun reactToPost(postId: String, body: ReactionRequest): Response<ApiEnvelope<ReactionResponse>> {
            val type = body.type
            lastReactedPostId = postId
            lastReactionType = type
            return Response.success(
                ApiEnvelope(
                    data = ReactionResponse(
                        reaction = type,
                        reactions = if (type != null) mapOf(type to 1) else emptyMap(),
                        likes = if (type != null) 1 else 0,
                        liked = type != null,
                    ),
                ),
            )
        }

        override suspend fun createPost(body: RequestBody, files: List<MultipartBody.Part>): Response<ApiEnvelope<PostDto>> =
            Response.success(ApiEnvelope(data = PostDto(id = "created", body = "hello", createdAt = "now", author = SafeUserDto(id = "u1", fullName = "Jane Doe"))))

        override suspend fun editPost(postId: String, body: EditPostBody): Response<ApiEnvelope<PostDto>> =
            Response.success(ApiEnvelope(data = PostDto(id = postId, body = body.body, createdAt = "now", author = SafeUserDto(id = "u1", fullName = "Jane Doe"))))

        override suspend fun deletePost(postId: String): Response<ApiEnvelope<DeletedResponse>> =
            Response.success(ApiEnvelope(data = DeletedResponse(id = postId, deleted = true)))
    }
}
