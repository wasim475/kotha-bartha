# Realtime / Socket.IO integration boundary

One Socket.IO server (`server/src/server.js`), one `io` instance, room-based isolation already in place (`user:{id}` rooms, `call:{callId}` rooms, conversation rooms) — this is exactly the shape a second client type should plug into. **No second Socket.IO server for Android; no duplicate event system.**

## What Android subscribes to (same events the web client already listens for)

- `message:new`, typing events, reactions — `chat.routes.js` + the message socket handlers.
- `call:*` (`call:ringing`, `call:invite-participant`, `call:participant-responded`, offer/answer/ICE signal relay) — `server/src/sockets/call.socket.js`.
- `ludo:*`, `ticTacToe:*`, `gameChallenge:*` — the three game socket modules under `server/src/sockets/`.
- Notification push-over-socket for in-app delivery.

## The one blocker (see `api-boundary.md`)

Socket auth is cookie-only today. Until the small `socket.handshake.auth.token` fallback is added server-side (Phase 2, not this pass), Android cannot open an authenticated socket connection at all. Everything else about the realtime layer — room design, event names, payload shapes — is already reusable without change.

## Android-side shape (design only, not built)

`core/websocket` should wrap `socket.io-client` (Java/Kotlin port) the same way `client/src/utility/helpers.jsx`'s `useRealtime`/`activeSocket` wraps it on web: one shared connection, feature modules subscribe/unsubscribe to their own event names, nobody opens a second connection.
