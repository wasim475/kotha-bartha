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
 * Not wired into any feature UI yet in this first milestone (there is no
 * messaging/presence feature to consume events from yet) — connect/disconnect
 * are called from the auth flow only, to prove the whole foundation
 * (token → handshake → live connection) genuinely works end to end.
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

    fun off(event: String) {
        socket?.off(event)
    }

    fun emit(event: String, vararg args: Any) {
        socket?.emit(event, *args)
    }
}
