package com.kothabarta.core.websocket

import io.socket.client.IO
import io.socket.client.Socket
import io.socket.emitter.Emitter
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class SocketConnectionState { DISCONNECTED, CONNECTING, CONNECTED }

/**
 * The one Socket.IO connection for the whole app (see
 * docs/architecture/android-realtime-contract.md — one server, one
 * connection, feature modules subscribe to their own event names on it,
 * nobody opens a second connection). Authenticates via
 * `socket.handshake.auth.token`, the fallback added to
 * `server/src/server.js` alongside the existing cookie path the web client
 * uses — this is purely additive on the server side and changes no event
 * name or payload.
 *
 * Connect/disconnect are called from the auth flow (sign-in/sign-out); each
 * feature's own ViewModel calls [on]/[off] for the events it cares about,
 * always passing back the same [Emitter.Listener] instance to [off] so it
 * only removes its own subscription — a bare event-name `off` would also
 * silently drop any other feature's listener for that same event.
 */
class SocketManager(private val serverUrl: String) {

    private var socket: Socket? = null

    private val _connectionState = MutableStateFlow(SocketConnectionState.DISCONNECTED)
    val connectionState: StateFlow<SocketConnectionState> = _connectionState.asStateFlow()

    fun connect(token: String) {
        disconnect()

        val options = IO.Options().apply {
            auth = mapOf("token" to token)
            reconnection = true
        }
        val newSocket = IO.socket(serverUrl, options)

        newSocket.on(Socket.EVENT_CONNECT) { _connectionState.value = SocketConnectionState.CONNECTED }
        newSocket.on(Socket.EVENT_DISCONNECT) { _connectionState.value = SocketConnectionState.DISCONNECTED }
        newSocket.on(Socket.EVENT_CONNECT_ERROR) { _connectionState.value = SocketConnectionState.DISCONNECTED }

        _connectionState.value = SocketConnectionState.CONNECTING
        socket = newSocket
        newSocket.connect()
    }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
        _connectionState.value = SocketConnectionState.DISCONNECTED
    }

    fun on(event: String, listener: Emitter.Listener) {
        socket?.on(event, listener)
    }

    /** Omitting [listener] removes every listener for [event] — prefer passing the same instance given to [on]. */
    fun off(event: String, listener: Emitter.Listener? = null) {
        if (listener != null) socket?.off(event, listener) else socket?.off(event)
    }

    fun emit(event: String, vararg args: Any) {
        socket?.emit(event, *args)
    }
}
