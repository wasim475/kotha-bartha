package com.kothabarta.feature.home.data

import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.network.safeApiCall
import com.kothabarta.core.network.social.PostDto
import com.kothabarta.core.network.social.PostsApi
import com.kothabarta.core.network.social.ReactionRequest
import com.kothabarta.core.network.social.ReactionResponse

/**
 * `GET /posts/feed` has no cursor pagination — `meta.hasMore` is permanently
 * `false` server-side today (see docs/architecture/android-api-contract.md).
 * This repository deliberately does not pretend otherwise: one fetch, one
 * list, no page/cursor parameter to invent.
 */
class FeedRepository(private val postsApi: PostsApi) {

    suspend fun getFeed(): ApiResult<List<PostDto>> = safeApiCall { postsApi.getFeed() }

    suspend fun getPost(postId: String): ApiResult<PostDto> = safeApiCall { postsApi.getPost(postId) }

    suspend fun markFeedRead() {
        runCatching { safeApiCall { postsApi.markFeedRead() } }
    }

    /** Passing `null` removes the viewer's current reaction — mirrors the web client's toggle-off behavior. */
    suspend fun react(postId: String, type: String?): ApiResult<ReactionResponse> =
        safeApiCall { postsApi.reactToPost(postId, ReactionRequest(type)) }
}
