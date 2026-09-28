package com.kothabarta.feature.profile.data

import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.common.map
import com.kothabarta.core.network.auth.AuthApi
import com.kothabarta.core.network.safeApiCall
import com.kothabarta.core.network.safeApiCallWithMeta
import com.kothabarta.core.network.social.AcceptedResponse
import com.kothabarta.core.network.social.CancelledResponse
import com.kothabarta.core.network.social.FriendsApi
import com.kothabarta.core.network.social.PhotoDto
import com.kothabarta.core.network.social.PostDto
import com.kothabarta.core.network.social.SendFriendRequestBody
import com.kothabarta.core.network.social.UnfriendedResponse
import com.kothabarta.core.network.social.UsersApi

class ProfileRepository(
    private val authApi: AuthApi,
    private val usersApi: UsersApi,
    private val friendsApi: FriendsApi,
) {
    suspend fun getOwnProfile(): ApiResult<ProfileUiModel> =
        safeApiCall { authApi.me() }.map { it.toProfileUiModel() }

    suspend fun getProfile(userId: String): ApiResult<ProfileUiModel> =
        safeApiCall { usersApi.getUser(userId) }.map { it.toProfileUiModel() }

    /** `restricted` (not-yet-a-friend) is server-decided — surfaced as-is, never re-derived here. */
    suspend fun getPosts(userId: String): ApiResult<Pair<List<PostDto>, Boolean>> =
        safeApiCallWithMeta { usersApi.getUserPosts(userId) }.map { it.data to (it.meta?.restricted ?: false) }

    suspend fun getPhotos(userId: String): ApiResult<Pair<List<PhotoDto>, Boolean>> =
        safeApiCallWithMeta { usersApi.getUserPhotos(userId) }.map { it.data to (it.meta?.restricted ?: false) }

    suspend fun sendFriendRequest(userId: String): ApiResult<Unit> =
        safeApiCall { friendsApi.sendFriendRequest(SendFriendRequestBody(userId)) }.map { }

    suspend fun cancelFriendRequest(userId: String): ApiResult<CancelledResponse> =
        safeApiCall { friendsApi.cancelFriendRequest(userId) }

    suspend fun acceptFriendRequest(requestId: String): ApiResult<AcceptedResponse> =
        safeApiCall { friendsApi.acceptFriendRequest(requestId) }

    suspend fun unfriend(userId: String): ApiResult<UnfriendedResponse> = safeApiCall { friendsApi.unfriend(userId) }
}
