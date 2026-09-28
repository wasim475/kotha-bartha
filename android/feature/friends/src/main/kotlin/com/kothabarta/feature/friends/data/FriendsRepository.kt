package com.kothabarta.feature.friends.data

import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.common.map
import com.kothabarta.core.network.safeApiCall
import com.kothabarta.core.network.social.AcceptedResponse
import com.kothabarta.core.network.social.CancelledResponse
import com.kothabarta.core.network.social.FriendEntryDto
import com.kothabarta.core.network.social.FriendsApi
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.network.social.SendFriendRequestBody
import com.kothabarta.core.network.social.UnfriendedResponse

class FriendsRepository(private val friendsApi: FriendsApi) {

    suspend fun getFriends(): ApiResult<List<SafeUserDto>> = safeApiCall { friendsApi.getFriends("friends") }

    suspend fun getRequests(): ApiResult<List<FriendEntryDto>> = safeApiCall { friendsApi.getFriendEntries("requests") }

    suspend fun getSent(): ApiResult<List<FriendEntryDto>> = safeApiCall { friendsApi.getFriendEntries("sent") }

    suspend fun sendFriendRequest(userId: String): ApiResult<Unit> =
        safeApiCall { friendsApi.sendFriendRequest(SendFriendRequestBody(userId)) }.map { }

    /** `receiverId` here is the *other* person's id, matching the server's `:receiverId` param name. */
    suspend fun cancelFriendRequest(otherUserId: String): ApiResult<CancelledResponse> =
        safeApiCall { friendsApi.cancelFriendRequest(otherUserId) }

    suspend fun acceptFriendRequest(requestId: String): ApiResult<AcceptedResponse> =
        safeApiCall { friendsApi.acceptFriendRequest(requestId) }

    suspend fun unfriend(userId: String): ApiResult<UnfriendedResponse> = safeApiCall { friendsApi.unfriend(userId) }
}
