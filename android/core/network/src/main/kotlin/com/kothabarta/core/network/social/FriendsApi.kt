package com.kothabarta.core.network.social

import com.kothabarta.core.network.ApiEnvelope
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * `/api/v1/friends/*` — see docs/architecture/android-api-contract.md's
 * "Friends". Two read methods hit the same `GET /friends` endpoint with
 * different `tab` values because the response shape genuinely differs:
 * `tab=friends` returns bare users, `tab=requests`/`tab=sent` return
 * `{id, status, user}` envelopes — never call the wrong one for a given tab.
 */
interface FriendsApi {

    @GET("friends")
    suspend fun getFriends(@Query("tab") tab: String = "friends"): Response<ApiEnvelope<List<SafeUserDto>>>

    @GET("friends")
    suspend fun getFriendEntries(@Query("tab") tab: String): Response<ApiEnvelope<List<FriendEntryDto>>>

    @POST("friends/requests")
    suspend fun sendFriendRequest(@Body body: SendFriendRequestBody): Response<ApiEnvelope<FriendRequestCreated>>

    @DELETE("friends/requests/{receiverId}")
    suspend fun cancelFriendRequest(@Path("receiverId") receiverId: String): Response<ApiEnvelope<CancelledResponse>>

    @POST("friends/requests/{requestId}/accept")
    suspend fun acceptFriendRequest(@Path("requestId") requestId: String): Response<ApiEnvelope<AcceptedResponse>>

    @DELETE("friends/{userId}")
    suspend fun unfriend(@Path("userId") userId: String): Response<ApiEnvelope<UnfriendedResponse>>
}
