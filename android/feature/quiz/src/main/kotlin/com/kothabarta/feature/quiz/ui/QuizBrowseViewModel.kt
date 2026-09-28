package com.kothabarta.feature.quiz.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kothabarta.core.common.ApiResult
import com.kothabarta.core.navigation.NavigationEvent
import com.kothabarta.core.navigation.Routes
import com.kothabarta.core.network.quiz.ChapterDto
import com.kothabarta.core.network.quiz.QuizCategoryDto
import com.kothabarta.core.network.quiz.QuizSetDto
import com.kothabarta.core.network.quiz.SubjectDto
import com.kothabarta.feature.quiz.data.QuizRepository
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class QuizStep { CATEGORY, CLASS_LEVEL, DIVISION, SUBJECTS, CHAPTERS, SETS }

data class QuizBrowseUiState(
    val step: QuizStep = QuizStep.CATEGORY,
    val isLoading: Boolean = true,
    val error: String? = null,
    val categories: List<QuizCategoryDto> = emptyList(),
    val classLevels: List<String> = emptyList(),
    val divisions: List<String> = emptyList(),
    val subjects: List<SubjectDto> = emptyList(),
    val chapters: List<ChapterDto> = emptyList(),
    val sets: List<QuizSetDto> = emptyList(),
    val selectedCategory: String? = null,
    val selectedClassLevel: String? = null,
    val selectedSubject: SubjectDto? = null,
    val selectedChapter: ChapterDto? = null,
)

/** A pure browse/drill-down flow — no scoring here, this only ever navigates into [QuizPlayViewModel] once a set is picked. */
class QuizBrowseViewModel(private val repository: QuizRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(QuizBrowseUiState())
    val uiState: StateFlow<QuizBrowseUiState> = _uiState.asStateFlow()

    private val _navigationEvents = MutableSharedFlow<NavigationEvent>(extraBufferCapacity = 1)
    val navigationEvents: SharedFlow<NavigationEvent> = _navigationEvents.asSharedFlow()

    init {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            when (val result = repository.getCategories()) {
                is ApiResult.Success -> _uiState.update { it.copy(isLoading = false, categories = result.data) }
                is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }

    fun back() {
        _uiState.update { state ->
            when (state.step) {
                QuizStep.CLASS_LEVEL -> state.copy(step = QuizStep.CATEGORY)
                QuizStep.DIVISION -> state.copy(step = QuizStep.CLASS_LEVEL)
                QuizStep.SUBJECTS -> state.copy(step = if (state.selectedCategory == "class") QuizStep.CLASS_LEVEL else QuizStep.CATEGORY)
                QuizStep.CHAPTERS -> state.copy(step = QuizStep.SUBJECTS)
                QuizStep.SETS -> state.copy(step = QuizStep.CHAPTERS)
                else -> state
            }
        }
    }

    fun selectCategory(key: String) {
        _uiState.update { it.copy(selectedCategory = key) }
        if (key == "class") {
            loadClassLevels()
        } else {
            loadSubjects(key, null, null)
        }
    }

    fun selectClassLevel(level: String) {
        _uiState.update { it.copy(selectedClassLevel = level) }
        if (level == "SSC") {
            loadDivisions()
        } else {
            loadSubjects("class", level, null)
        }
    }

    fun selectDivision(division: String) {
        loadSubjects("class", _uiState.value.selectedClassLevel, division)
    }

    fun selectSubject(subject: SubjectDto) {
        _uiState.update { it.copy(selectedSubject = subject, step = QuizStep.CHAPTERS, isLoading = true, error = null) }
        viewModelScope.launch {
            when (val result = repository.getChapters(subject.id)) {
                is ApiResult.Success -> _uiState.update { it.copy(isLoading = false, chapters = result.data) }
                is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }

    fun selectChapter(chapter: ChapterDto) {
        _uiState.update { it.copy(selectedChapter = chapter, step = QuizStep.SETS, isLoading = true, error = null) }
        viewModelScope.launch {
            when (val result = repository.getSets(chapter.id)) {
                is ApiResult.Success -> _uiState.update { it.copy(isLoading = false, sets = result.data) }
                is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }

    fun selectSet(set: QuizSetDto) {
        val chapterId = _uiState.value.selectedChapter?.id ?: return
        viewModelScope.launch { _navigationEvents.emit(NavigationEvent.NavigateTo(Routes.quizPlay(chapterId, set.setNumber))) }
    }

    private fun loadClassLevels() {
        _uiState.update { it.copy(step = QuizStep.CLASS_LEVEL, isLoading = true, error = null) }
        viewModelScope.launch {
            when (val result = repository.getClassLevels()) {
                is ApiResult.Success -> _uiState.update { it.copy(isLoading = false, classLevels = result.data) }
                is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }

    private fun loadDivisions() {
        _uiState.update { it.copy(step = QuizStep.DIVISION, isLoading = true, error = null) }
        viewModelScope.launch {
            when (val result = repository.getSscDivisions()) {
                is ApiResult.Success -> _uiState.update { it.copy(isLoading = false, divisions = result.data) }
                is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }

    private fun loadSubjects(category: String, classLevel: String?, division: String?) {
        _uiState.update { it.copy(step = QuizStep.SUBJECTS, isLoading = true, error = null) }
        viewModelScope.launch {
            when (val result = repository.getSubjects(category, classLevel, division)) {
                is ApiResult.Success -> _uiState.update { it.copy(isLoading = false, subjects = result.data) }
                is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }
}
