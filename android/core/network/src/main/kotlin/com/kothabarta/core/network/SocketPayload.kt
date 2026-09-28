package com.kothabarta.core.network

import org.json.JSONObject

/**
 * `io.socket.client.Socket`'s `Emitter.Listener` callbacks hand back raw
 * `org.json.JSONObject`/`JSONArray` args (see `core:websocket`'s
 * `SocketManager`, which stays payload-format-agnostic on purpose). This is
 * the one bridge point: `.toString()` the raw arg back into JSON text and
 * decode it with the same [NetworkJson] Moshi instance used for REST, so a
 * payload arriving over the socket parses into the exact same DTOs as the
 * one arriving over REST.
 */
inline fun <reified T> Any?.decodeSocketPayload(): T? {
    val json = this?.toString() ?: return null
    return runCatching { NetworkJson.moshi.adapter(T::class.java).fromJson(json) }.getOrNull()
}

/** The reverse direction: `SocketManager.emit` needs an `org.json.JSONObject`, not an arbitrary Kotlin object. */
inline fun <reified T> T.encodeSocketPayload(): JSONObject =
    JSONObject(NetworkJson.moshi.adapter(T::class.java).toJson(this))
