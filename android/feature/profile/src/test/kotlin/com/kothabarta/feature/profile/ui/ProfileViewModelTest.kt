package com.kothabarta.feature.profile.ui

import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.SessionManager
import com.kothabarta.core.network.auth.AuthApi
import com.kothabarta.core.network.auth.GoogleLoginRequest
import com.kothabarta.core.network.auth.LoginRequest
import com.kothabarta.core.network.auth.LogoutResponse
import com.kothabarta.core.network.auth.RegisterRequest
import com.kothabarta.core.network.auth.UserDto
import com.kothabarta.core.network.social.AcceptedResponse
import com.kothabarta.core.network.social.CancelledResponse
import com.kothabarta.core.network.social.FriendEntryDto
import com.kothabarta.core.network.social.FriendRequestCreated
import com.kothabarta.core.network.social.FriendsApi
import com.kothabarta.core.network.social.PhotoDto
import com.kothabarta.core.network.social.PostDto
import com.kothabarta.core.network.social.ProfileUserDto
import com.kothabarta.core.network.social.SafeUserDto
import com.kothabarta.core.network.social.SendFriendRequestBody
import com.kothabarta.core.network.social.UnfriendedResponse
import com.kothabarta.core.network.social.UsersApi
import com.kothabarta.feature.profile.data.ProfileRepository
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class ProfileViewModelTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun otherProfile(
        friendRequestReceived: Boolean = false,
        receivedFriendRequestId: String? = null,
    ) = ProfileUserDto(
        id = "u2",
        fullName = "Other Person",
        friendRequestReceived = friendRequestReceived,
        receivedFriendRequestId = receivedFriendRequestId,
    )

    @Test
    fun `own profile loads via auth me, not GET users id`() = runTest {
        val users = FakeUsersApi()
        val me = UserDto(id = "me", fullName = "Me", email = "me@x.com", role = "user")
        val viewModel = ProfileViewModel(
            userId = null,
            repository = ProfileRepository(FakeAuthApi(me), users, FakeFriendsApi()),
            sessionManager = NeverLoggedOutSession(),
        )
        advanceUntilIdle()
        assertEquals("me", viewModel.uiState.value.profile?.id)
        assertTrue(viewModel.uiState.value.profile?.isOwn == true)
        assertFalse(users.wasCalled)
    }

    @Test
    fun `accepting a received request calls accept with the right request id`() = runTest {
        val users = object : FakeUsersApi() {
            override suspend fun getUser(userId: String) =
                Response.success(ApiEnvelope(data = otherProfile(friendRequestReceived = true, receivedFriendRequestId = "req1")))
        }
        val friends = FakeFriendsApi()
        val viewModel = ProfileViewModel(userId = "u2", repository = ProfileRepository(FakeAuthApi(null), users, friends), sessionManager = NeverLoggedOutSession())
        advanceUntilIdle()
        assertTrue(viewModel.uiState.value.profile?.friendRequestReceived == true)

        viewModel.acceptFriendRequest()
        advanceUntilIdle()

        assertEquals("req1", friends.lastAcceptedRequestId)
        assertFalse(viewModel.uiState.value.friendActionInFlight)
    }

    @Test
    fun `a failed friend action surfaces the server's error without crashing`() = runTest {
        val users = FakeUsersApi()
        val friends = object : FakeFriendsApi() {
            override suspend fun sendFriendRequest(body: SendFriendRequestBody) =
                Response.error<ApiEnvelope<FriendRequestCreated>>(
                    403,
                    "{\"error\":{\"code\":\"BLOCKED\",\"message\":\"You can't add this person.\"}}".toResponseBody("application/json".toMediaType()),
                )
        }
        val viewModel = ProfileViewModel(userId = "u2", repository = ProfileRepository(FakeAuthApi(null), users, friends), sessionManager = NeverLoggedOutSession())
        advanceUntilIdle()

        viewModel.sendFriendRequest()
        advanceUntilIdle()

        assertEquals("You can't add this person.", viewModel.uiState.value.friendActionError)
        assertFalse(viewModel.uiState.value.friendActionInFlight)
    }

    private open class FakeUsersApi : UsersApi {
        var wasCalled = false
        override suspend fun getUser(userId: String): Response<ApiEnvelope<ProfileUserDto>> {
            wasCalled = true
            return Response.success(ApiEnvelope(data = ProfileUserDto(id = "u2", fullName = "Other Person")))
        }
        override suspend fun getUserPosts(userId: String): Response<ApiEnvelope<List<PostDto>>> =
            Response.success(ApiEnvelope(data = emptyList()))
        override suspend fun getUserPhotos(userId: String): Response<ApiEnvelope<List<PhotoDto>>> =
            Response.success(ApiEnvelope(data = emptyList()))
    }

    private open class FakeFriendsApi : FriendsApi {
        var lastAcceptedRequestId: String? = null
        override suspend fun getFriends(tab: String) = Response.success(ApiEnvelope(data = emptyList<SafeUserDto>()))
        override suspend fun getFriendEntries(tab: String) = Response.success(ApiEnvelope(data = emptyList<FriendEntryDto>()))
        override suspend fun sendFriendRequest(body: SendFriendRequestBody) =
            Response.success(ApiEnvelope(data = FriendRequestCreated(id = "req1", status = "pending")))
        override suspend fun cancelFriendRequest(receiverId: String) = Response.success(ApiEnvelope(data = CancelledResponse(true)))
        override suspend fun acceptFriendRequest(requestId: String): Response<ApiEnvelope<AcceptedResponse>> {
            lastAcceptedRequestId = requestId
            return Response.success(ApiEnvelope(data = AcceptedResponse(true)))
        }
        override suspend fun unfriend(userId: String) = Response.success(ApiEnvelope(data = UnfriendedResponse(true)))
    }

    private class FakeAuthApi(private val me: UserDto?) : AuthApi {
        override suspend fun register(body: RegisterRequest) = notUsed()
        override suspend fun login(body: LoginRequest) = notUsed()
        override suspend fun google(body: GoogleLoginRequest) = notUsed()
        override suspend fun me(): Response<ApiEnvelope<UserDto>> = Response.success(ApiEnvelope(data = me))
        override suspend fun logout() = Response.success(ApiEnvelope(data = LogoutResponse(true)))
        private fun notUsed(): Nothing = error("not used by ProfileViewModelTest")
    }

    private class NeverLoggedOutSession : SessionManager {
        override val isSignedIn = true
        override suspend fun logout() = error("not exercised by these tests")
    }
}
