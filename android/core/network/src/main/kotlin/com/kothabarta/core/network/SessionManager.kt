package com.kothabarta.core.network

/**
 * A small contract so features other than `:feature:auth` (e.g. Profile's
 * own-profile "Log out" action) can end the session without depending on
 * the `:feature:auth` module directly — feature modules never depend on
 * each other, only on `core:*`. `:feature:auth`'s `AuthRepository`
 * implements this; Koin binds the interface to that same singleton (see
 * `AuthFeatureModule`), so there is still only one implementation and one
 * source of truth for what "signed in" means.
 */
interface SessionManager {
    val isSignedIn: Boolean
    suspend fun logout()
}
