package com.kothabarta.core.network

/**
 * The success-path shape of every response documented in
 * docs/architecture/android-api-contract.md: `{ "data": ... }`, with `token`
 * only ever present on the three auth endpoints that issue a session
 * (see docs/architecture/android-implementation-plan.md, section D — the
 * token is a sibling of `data`, added additively, never nested inside it).
 * No serialization annotation needed — Moshi's reflection-based Kotlin
 * adapter (`core:network`'s `ApiClientFactory`) reads plain data classes
 * directly, defaults included.
 */
data class ApiEnvelope<T>(
    val data: T? = null,
    val token: String? = null,
    val meta: ApiMeta? = null,
)

/**
 * The handful of `meta` fields actually used across the endpoints in
 * docs/architecture/android-api-contract.md — one shared shape with every
 * field optional, rather than a bespoke meta class per endpoint. Notably
 * `hasMore` is permanently `false` on both `/posts/feed` and `/notifications`
 * today (no cursor pagination exists yet) — do not build infinite-scroll
 * logic against it actually flipping true.
 */
data class ApiMeta(
    val hasMore: Boolean? = null,
    val restricted: Boolean? = null,
    val count: Int? = null,
    /** Only present on `GET /games` — the games catalog's category list. */
    val categories: List<com.kothabarta.core.network.games.GameCategoryDto>? = null,
    /** Only present on `GET /leaderboard/archive/:year/:month` when no archive exists yet. */
    val label: String? = null,
)

/**
 * The error-path shape (`{ "error": { "code", "message" } }`). Kept separate
 * from [ApiEnvelope] because a generic type can't be deserialized from an
 * error body without knowing `T` — this is only ever parsed when the HTTP
 * status itself already says the call failed.
 */
data class ApiErrorEnvelope(
    val error: ApiErrorDto? = null,
)

data class ApiErrorDto(
    val code: String,
    val message: String,
)
