package com.kothabarta.core.network.social

import com.kothabarta.core.network.ApiEnvelope
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface NotesApi {
    @GET("notes")
    suspend fun getNotes(): Response<ApiEnvelope<List<NoteEntryDto>>>

    @POST("notes")
    suspend fun createNote(@Body body: CreateNoteBody): Response<ApiEnvelope<NoteDto>>

    @DELETE("notes/{noteId}")
    suspend fun deleteNote(@Path("noteId") noteId: String): Response<ApiEnvelope<DeletedResponse>>
}
