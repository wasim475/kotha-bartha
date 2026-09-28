# Android realtime (Socket.IO) contract

One Socket.IO server, one `io` instance (`server/src/server.js`). Every event name, payload shape, and room below is unchanged by this pass — the only change made anywhere in the realtime layer is the handshake authentication fallback described immediately below.

## Authentication (the one change made in this pass)

**Before**: `io.use(...)` read the JWT only from `socket.handshake.headers.cookie` (`kotha_token=...`). A native Socket.IO client has no cookie jar, so this path could never authenticate Android.

**After** (`server/src/server.js`, additive): if no cookie token is present, the middleware falls back to `socket.handshake.auth.token`. The web client is unaffected — it never sets `auth.token`, so it keeps authenticating via the cookie exactly as before. No event name, payload, or room changed; nothing else in `io.use` changed (the deleted-account check still runs the same way afterward).

**Android connects like this**:
```
io(SERVER_URL, { auth: { token: "<the Bearer JWT>" } })
```
On connect, the server does `socket.join('user:' + socket.userId)` (unchanged) — this is the room presence, notifications, invites, and call ringing are all delivered through.

## Presence

- Server → client: `presence:update` to a user's friends/conversation partners, `{ userId, isOnline, lastSeenAt? }`, fired on connect (first tab/device) and disconnect (last tab/device) — see `addConnection`/`removeConnection` in `utils/presence.js`, which counts connections per user so a second device doesn't flicker presence off.
- Reconnect behavior: purely connection-count based, no special client action needed — reconnecting just re-joins `user:{id}` and re-triggers the same connect logic.

## Messaging

- Server → client: `message:new`, `message:updated`, `message:deleted`, `message:reaction`, `message:read`, `conversation:updated`, `conversation:theme`, `conversation:likeEmoji` — delivered to `user:{recipientId}` rooms (see `chat.routes.js`'s use of the `emitToUser`/`broadcastToOthers` helpers in `utils/realtime.js`).
- Client → server: `typing:start`, `typing:stop` — `{ to, conversationId }`, relayed by `server.js`'s `forwardTyping`, which drops the event silently (no error emitted back) if the two users are blocked either way.
- Room: no dedicated per-conversation room — delivery is per-recipient via their `user:{id}` room, so a participant sees updates regardless of which conversation screen (if any) they currently have open.
- Reconnect: no special handling needed — REST (`GET /conversations/:id/messages`) is the source of truth for anything missed while disconnected; sockets are a live-update convenience layer, not the only path to a message.

## Notifications / Friend requests

- Server → client: `notification:new`, generic across notification types (friend request received/accepted, etc. — see `Notification` model for the type enum); the REST `GET /notifications`/`unread-counts` endpoints are the durable record, the socket event is a live nudge to refetch/update a badge.
- No dedicated friend-request-specific socket event beyond this — friend-request state changes surface as a `notification:new` plus the normal REST responses from `friends.routes.js`.

## Tic-Tac-Toe

- Client → server: `ticTacToe:join`, `ticTacToe:leave`, `ticTacToe:move`, `ticTacToe:reaction` — payloads carry `{ gameId, ... }`, acknowledged via the socket.io ack callback (`(payload, ack) =>`) rather than a separate response event, so Android should use the same request/ack pattern, not a fire-and-forget send.
- Server → client: `ticTacToe:joined`, `ticTacToe:state` (full authoritative board state after every move — Android renders this, never predicts a move outcome locally), `ticTacToe:finished`, `ticTacToe:player:left`, `ticTacToe:presence` (friends' online status for the invite list), plus the `ticTacToe:invite*` and `ticTacToe:rematch*` families (`:accepted`/`:declined`/`:cancelled`/`:expired`).
- Room: `ticTacToe:{gameId}`, joined on `ticTacToe:join`.
- Reconnect: rejoining the game room via `ticTacToe:join` after a drop re-syncs via a fresh `ticTacToe:state` push — no separate resume handshake.

## Ludo

- Client → server: `ludo:join`, `ludo:leave`, `ludo:ready`, `ludo:start`, `ludo:roll`, `ludo:move`, `ludo:chat`, `ludo:reaction`, `ludo:rematch` — same ack-callback pattern as Tic-Tac-Toe for anything that mutates state.
- Server → client: `ludo:joined`, `ludo:lobby`/`ludo:lobby:closed` (pre-game lobby state), `ludo:started`, `ludo:state` (authoritative board — dice/turn/token-position legality is decided in `server/src/games/ludo/engine.js`, never trust a client-echoed roll), `ludo:turn`, `ludo:timer` (per-turn countdown), `ludo:capture`, `ludo:finished`, `ludo:takeover` (an older/other tab reclaiming an active seat after a reconnect), plus `ludo:invite*`/`ludo:rematch*` families.
- Room: `ludo:{gameId}`, participants only.
- Reconnect behavior (documented in `LUDO.md`): a disconnected player has a grace window before forfeiture; reconnecting rejoins the room and the client that reconnects gets a fresh `ludo:state`, while any other tab that was standing in gets a `ludo:takeover` so exactly one client is ever in control per seat. Android must implement this same "always trust the latest `ludo:state`, never assume local state survives a reconnect" discipline.

## Game Challenges (friend Math/English head-to-head)

- Client → server: `gameChallenge:join`, `gameChallenge:leave`/`gameChallenge:room:leave`, `gameChallenge:send` (submitting an answer), `gameChallenge:accept`/`gameChallenge:decline`, `gameChallenge:rematch`.
- Server → client: `gameChallenge:joined`, `gameChallenge:started`, `gameChallenge:question` (server-generated, server-authoritative — see `services/games/mathGenerator.js`/`englishBanks.js`), `gameChallenge:answer`/`gameChallenge:questionResult` (correctness is decided server-side), `gameChallenge:finished`, `gameChallenge:player:left`, plus `:accepted`/`:declined`/`:cancelled`/`:expired` for both the invite and rematch flows.
- Room: per-match room, joined via `gameChallenge:join`.

## Video/audio calls

- Client → server: `call:join` (enter the call's signalling room, ack `{ ok, call }`), `call:offer`/`call:answer` (`{ callId, sdp, renegotiate? }`), `call:ice-candidate` (`{ callId, candidate }`), `call:reaction` (`{ callId, type }`), `call:state` (`{ callId, status }` — the client reporting its own connection/media-readiness transitions, e.g. reaching `connected`), `call:screen-share:start`/`call:screen-share:stop` (`{ callId }`). Every one of these is ack'd via the socket.io callback, not a separate reply event — see `android-webrtc.md` for the exact SDP/ICE payload shapes.
- Server → client: the three offer/answer/ICE events above are **not echoed back under their own names** — the server relays whichever one arrived to the *other* participant as a single unified `call:signal` event: `{ callId, from, signal: { type: "offer"|"answer"|"ice", sdp?, candidate?, renegotiate? } }` (`call.service.js#relaySignal`). Separately: `call:invite` (a fresh incoming call — drives the incoming-call UI/ringtone), `call:ringing` (delivered to the *caller* the instant the callee's client actually joins the room — the real "Calling…" → "Ringing…" signal, not a client-side guess), `call:accepted`, `call:declined`, `call:cancelled`, `call:ended`, `call:missed`, `call:invite-participant`/`call:participant-responded` (the "Add People" foundation — still strictly 1:1 media underneath).
- Room: `call:{callId}`, joined via `call:join`; delivery of the invite/state-change events themselves goes to each participant's `user:{id}` room so it reaches them regardless of what screen they're on (mirroring how `call:ringing` was added in a prior pass specifically so a caller sees delivery status even if the callee is elsewhere in the app).
- Reconnect behavior: server-side timers, not purely a client concern — `call.service.js` schedules a reconnect timeout if a previously-`connected` call's signalling drops, and a connect timeout if a call is accepted but never reaches `connected` even once; either firing transitions the call to `failed` and emits `call:ended`. Android's own `RTCPeerConnection` reconnection (ICE restart) is a separate, native concern layered underneath this server-side safety net — see `android-webrtc.md`.

## Reactions (cross-cutting)

Reactions are feature-scoped, not a single global event: `ludo:reaction` and `ticTacToe:reaction` (in-game floating reactions), `call:reaction` (in-call floating reactions), and `message:reaction`/`PUT /comments/:id/reaction`/`PUT /posts/:id/reaction` (persisted content reactions, REST not socket). Android should treat "reaction" as belonging to whichever feature module owns the room it fires in, not build one shared reaction pipe.
