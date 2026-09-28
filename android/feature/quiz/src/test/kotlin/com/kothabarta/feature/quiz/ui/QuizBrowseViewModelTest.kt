package com.kothabarta.feature.quiz.ui

import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.ApiEnvelope
import com.kothabarta.core.network.quiz.ChapterDto
import com.kothabarta.core.network.quiz.QuizAnswerRequest
import com.kothabarta.core.network.quiz.QuizAnswerResponse
import com.kothabarta.core.network.quiz.QuizApi
import com.kothabarta.core.network.quiz.QuizAttemptDto
import com.kothabarta.core.network.quiz.QuizCategoryDto
import com.kothabarta.core.network.quiz.QuizSetDto
import com.kothabarta.core.network.quiz.SubjectDto
import com.kothabarta.feature.quiz.data.QuizRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class QuizBrowseViewModelTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `loads categories on init`() = runTest {
        val api = FakeQuizApi()
        val viewModel = QuizBrowseViewModel(QuizRepository(api))
        advanceUntilIdle()

        assertEquals(QuizStep.CATEGORY, viewModel.uiState.value.step)
        assertEquals(2, viewModel.uiState.value.categories.size)
    }

    @Test
    fun `selecting a non-class category loads subjects directly`() = runTest {
        val api = FakeQuizApi()
        val viewModel = QuizBrowseViewModel(QuizRepository(api))
        advanceUntilIdle()

        viewModel.selectCategory("general")
        advanceUntilIdle()

        assertEquals(QuizStep.SUBJECTS, viewModel.uiState.value.step)
        assertEquals(1, viewModel.uiState.value.subjects.size)
    }

    @Test
    fun `selecting a set emits navigation to quiz play`() = runTest {
        val api = FakeQuizApi()
        val viewModel = QuizBrowseViewModel(QuizRepository(api))
        advanceUntilIdle()

        viewModel.selectCategory("general")
        advanceUntilIdle()
        viewModel.selectSubject(api.subject)
        advanceUntilIdle()
        viewModel.selectChapter(api.chapter)
        advanceUntilIdle()

        var event: NavigationEvent? = null
        val job = launch { viewModel.navigationEvents.collect { event = it } }
        viewModel.selectSet(api.set)
        advanceUntilIdle()
        job.cancel()

        assertEquals(NavigationEvent.NavigateTo(Routes.quizPlay(api.chapter.id, api.set.setNumber)), event)
    }

    @Test
    fun `a failed load surfaces the server's error`() = runTest {
        val api = FakeQuizApi(shouldFailCategories = true)
        val viewModel = QuizBrowseViewModel(QuizRepository(api))
        advanceUntilIdle()

        assertEquals("Quiz is unavailable.", viewModel.uiState.value.error)
    }

    private class FakeQuizApi(private val shouldFailCategories: Boolean = false) : QuizApi {
        val subject = SubjectDto(id = "s1", name = "Math", category = "general")
        val chapter = ChapterDto(id = "c1", name = "Algebra", subjectId = "s1")
        val set = QuizSetDto(setNumber = 1, totalQuestions = 10)

        override suspend fun getCategories(): Response<ApiEnvelope<List<QuizCategoryDto>>> {
            if (shouldFailCategories) {
                val body = "{\"error\":{\"code\":\"SERVER_ERROR\",\"message\":\"Quiz is unavailable.\"}}"
                    .toResponseBody("application/json".toMediaType())
                return Response.error(500, body)
            }
            return Response.success(
                ApiEnvelope(data = listOf(QuizCategoryDto("class", "By Class"), QuizCategoryDto("general", "General"))),
            )
        }

        override suspend fun getClassLevels(): Response<ApiEnvelope<List<String>>> =
            Response.success(ApiEnvelope(data = listOf("Class 6", "SSC")))

        override suspend fun getSscDivisions(): Response<ApiEnvelope<List<String>>> =
            Response.success(ApiEnvelope(data = listOf("Science", "Arts")))

        override suspend fun getSubjects(
            category: String,
            classLevel: String?,
            division: String?,
        ): Response<ApiEnvelope<List<SubjectDto>>> = Response.success(ApiEnvelope(data = listOf(subject)))

        override suspend fun getChapters(subjectId: String): Response<ApiEnvelope<List<ChapterDto>>> =
            Response.success(ApiEnvelope(data = listOf(chapter)))

        override suspend fun getSets(chapterId: String): Response<ApiEnvelope<List<QuizSetDto>>> =
            Response.success(ApiEnvelope(data = listOf(set)))

        override suspend fun startSet(chapterId: String, setNumber: Int): Response<ApiEnvelope<QuizAttemptDto>> =
            error("not used by QuizBrowseViewModelTest")

        override suspend fun answer(attemptId: String, body: QuizAnswerRequest): Response<ApiEnvelope<QuizAnswerResponse>> =
            error("not used by QuizBrowseViewModelTest")
    }
}
