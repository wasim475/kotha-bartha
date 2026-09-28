package com.kothabarta.core.network

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import okhttp3.Interceptor
import okhttp3.Response

/**
 * A `401` means the server no longer honours this token — expired, revoked,
 * or the account was deleted (see `requireAuth`'s deleted-account check).
 * The app-level navigation observes [events] to clear the stored token and
 * drop back to Login, exactly once, from a single place, instead of every
 * repository having to special-case a 401 itself.
 */
class UnauthorizedNotifier {
    private val _events = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val events: SharedFlow<Unit> = _events.asSharedFlow()

    internal fun notify() {
        _events.tryEmit(Unit)
    }
}

class UnauthorizedInterceptor(private val notifier: UnauthorizedNotifier) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val response = chain.proceed(chain.request())
        if (response.code == 401) notifier.notify()
        return response
    }
}
