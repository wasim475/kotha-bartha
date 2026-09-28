# Android readiness — full architecture audit

Audit-only pass. One backend change was made as part of this document (see "Required backend changes" — the Socket.IO handshake fallback), everything else here is analysis of the codebase as it already stood.

## Current architecture

Two independently-built projects, no monorepo tooling, no root `package.json`:
- `client/`: React 19, Vite 8, Tailwind v4, MUI, Framer Motion, `socket.io-client`, `axios`.
- `server/`: Express 5, Mongoose 9 against a single shared MongoDB Atlas cluster, `socket.io` 4, Cloudinary for all file storage, JWT auth, no separate microservices — one Node process serves REST and Socket.IO from the same `httpServer`.

## Web architecture

`client/src/pages/*` (route-level screens: feed, friends, message, notifications, profile, Study/quiz/games/leaderboard, Admin) + `client/src/components/*` (call, ticTacToe, ludo, gameChallenge, admin, ui) + `client/src/provider/*` (`AuthProvider`, `CallProvider`, `NotesProvider`, `StoriesProvider`, `UtilityProvider` — React Context, not Redux) + `client/src/utility/*` (thin `axios` wrapper `api.js`, socket helpers, formatters). No SSR, no server components — a pure SPA behind React Router (`client/src/Router/Main.jsx`).

## Backend architecture

`server/src/app.js` wires Helmet, CORS (origin allow-list from `CLIENT_ORIGIN`, **plus an explicit allowance for requests with no `Origin` header at all** — this is what already makes native HTTP clients like Android's OkHttp/Retrofit work without any CORS change, since they don't send `Origin`), a global 300-req/15-min rate limit on non-GET requests, then mounts `/api/v1/auth` (unauthenticated) and `/api/v1/*` (behind `requireAuth`, `server/src/routes/index.js`). Routes are grouped by domain (`users`, `posts`, `comments`, `friends`, `chat`, `notifications`, `blocks`, `stories`, `notes`, `quiz`, `leaderboard`, `englishQuestions`, `ticTacToe`, `gameChallenge`, `ludo`, `call`, `reports`, `admin/*`), each backed by a `services/*.service.js` module that owns the actual authorization/business logic — routes themselves stay thin. `server/src/models/*` (29 Mongoose models) is the single source of truth; no ORM abstraction layer sits between routes and Mongoose.

## Realtime architecture

One `Server` instance from `socket.io` (`server/src/server.js`), one shared `io`. Room convention: `user:{id}` (per-user delivery, e.g. presence/notifications/invites), `call:{callId}` (call participants), plus conversation/game-specific rooms managed inside each `sockets/*.socket.js` module (`call.socket.js`, `ludo.socket.js`, `ticTacToe.socket.js`, `gameChallenge.socket.js`). Presence (`utils/presence.js`) is an in-memory connection-count map, broadcast on connect/disconnect to friends and conversation partners.

## Authentication flow

Register/login/Google OAuth (`routes/auth.js`) issue a JWT (`JWT_SECRET`, `JWT_EXPIRES_IN=7d`), currently set as an HttpOnly cookie (`kotha_token`). `middleware/auth.js`'s `requireAuth` already accepts **either** that cookie **or** an `Authorization: Bearer <token>` header, reloading the user fresh from the DB every request (so `accountStatus`/`role`/`isMuted` are always current, never trusted from the token itself). This means REST auth for Android needs **zero backend change** — store the JWT (Keystore-backed) and send it as a Bearer header.

Socket.IO auth, before this pass, read the JWT **only** from the raw cookie header. That's now fixed additively — see "Required backend changes."

## REST API boundary

Fully documented endpoint-by-endpoint in `android-api-contract.md`. Headline finding: every route already returns a platform-neutral `{ data }` / `{ error: { code, message } }` shape (seen consistently across `chat.routes.js`, `call.routes.js`, `ludo.routes.js`, etc.) — there is nothing web-specific in any response body (no HTML fragments, no cookie-dependent redirects in the data routes). Android consumes the exact same endpoints the web client does; no Android-specific API surface is needed for anything audited.

## Socket.IO boundary

Fully documented event-by-event in `android-realtime-contract.md`. All event names, payload shapes, and room semantics are unchanged and reusable as-is; only the handshake authentication needed the additive fix.

## WebRTC boundary

Fully documented in `android-webrtc.md`. Signalling (offer/answer/ICE relay) and call state (`Call` model, `call.service.js`'s state machine) are transport-agnostic and reusable. The actual `RTCPeerConnection` work is inherently platform-specific and will need an independent native implementation on Android, driven by the same signalling contract.

## Game architecture

Fully documented in `android-games.md`. Every game (Ludo, Tic-Tac-Toe, Quiz, English/Math challenges) is server-authoritative today — `server/src/games/ludo/engine.js`, `server/src/services/{ludo,ticTacToe,game,gameChallenge}.service.js`, `server/src/services/games/*` own all rules, scoring, turn/move validation, and reward calculation. Clients (web today, Android tomorrow) only render server state and submit user actions/moves; this property must not change.

## Database responsibility

MongoDB Atlas is the single shared source of truth for both clients — Android does not get, and does not need, its own database. Any local Android storage (Room, in the proposed `core/database`) should be a **cache/offline-read layer only** (e.g. last-seen message list for instant paint), never an alternate source of truth, exactly mirroring how the web client never persists authoritative state client-side either (it always re-derives from `GET` responses and socket events).

## Features Android can reuse without any backend change

Auth (Bearer path), Users/Profile, Friends, Feed/Posts/Comments, Messages (REST + realtime, once the socket fix lands), Notifications, Quiz, English/Math games, Leaderboard, Tic-Tac-Toe, Ludo, Game Challenges, Reports/Support, Blocks — all of it, via the same REST endpoints and socket events the web client already uses.

## Features that must be implemented natively on Android (no shared code, only a shared protocol)

- WebRTC media (`RTCPeerConnection`, camera/mic capture, screen capture) — see `android-webrtc.md`.
- Push notification delivery (FCM) — the transport is Android-only; the *events that should trigger a push* are already defined server-side as socket/notification events (see "Push notifications" below).
- Secure on-device token storage (Android Keystore / `EncryptedSharedPreferences`), navigation, and all UI.

## Security audit findings

- **Server-authoritative moderation is already client-agnostic and strong.** `utils/moderation.js`'s `requireAction`/`assertUserCan` and `middleware/adminAuth.js`'s `requireStaff`/`requireAdminSection` always re-check `req.user` freshly loaded from the database on every request/socket action — nothing here trusts client-supplied state, so Android inherits identical ban/mute/role enforcement automatically, no server change needed and none made.
- **IDOR protection**: spot-checked `call.service.js` (`assertParticipant`), `chat.routes.js` (participant checks before every conversation mutation), `ludo.service.js`/`ticTacToe.service.js` (ownership/turn checks) — all validated server-side against the authenticated user, not client-supplied IDs alone. No weakening found or introduced.
- **WebRTC authorization**: call creation/accept/invite all run through `assertCanCall`/`assertParticipant`/block checks in `call.service.js` before any signalling is relayed — unaffected by, and unrelated to, the socket-auth fallback added in this pass.
- **Game authorization**: turn/move validation lives entirely in `server/src/games/ludo/engine.js` and the `*.service.js` files; sockets only relay, they don't trust client claims about game state.
- **One real, pre-existing gap, unrelated to Android**: `server/.env` is tracked in git with real secrets. See "Environment/secret findings" — flagged, not fixed automatically per instruction.

## Environment/secret findings

- `server/.env` **is tracked in git** (confirmed via `git log -- server/.env`: committed at the initial commit and updated multiple times since). `server/.gitignore` only excludes `.vercel` and `node_modules/` — it never listed `.env`, unlike `client/.gitignore` which correctly does.
- Categories of secrets exposed in that tracked file: a MongoDB Atlas connection string with embedded database credentials, the JWT signing secret, and a Cloudinary API key/secret pair. (A Google OAuth client ID is also present but that value is not sensitive by design — client IDs are meant to be public.)
- What must be rotated: the MongoDB Atlas credentials, `JWT_SECRET` (rotating this invalidates all existing sessions — plan for it), and the Cloudinary API key/secret.
- What should be added to `.gitignore`: `.env` (and ideally `.env.*` except `.env.example`) in `server/.gitignore`, matching the pattern `client/.gitignore` already uses correctly.
- Git history cleanup: yes, in principle — the secrets are in multiple past commits, not just the current tree, so removing the file going forward does not remove it from history. Actual history rewriting (`git filter-repo`/BFG) is a destructive, disruptive operation for a shared repo with other collaborators and was **not performed and should be a deliberate, separately-scheduled decision**, made together with secret rotation (rotate first, then history cleanup is about hygiene, not urgency, once the exposed values are dead).
- No secret values are reproduced anywhere in this document or in chat, per instruction.

## TURN status

`client/src/utility/call.js`'s `iceServers()` returns `stun:stun.l.google.com:19302` by default and only adds a TURN entry if `VITE_TURN_URL`/`VITE_TURN_USERNAME`/`VITE_TURN_CREDENTIAL` are set in the client env — inspecting `client/.env`, none of these are set. **No TURN server is configured today, for the web client or in any way Android could inherit.** STUN-only means calls between peers behind symmetric/strict NATs can fail on both platforms already; this is a pre-existing limitation, not something Android introduces. See `android-webrtc.md` for what production readiness requires.

## Push notification status

No push infrastructure exists server-side today — no `web-push`, no FCM/APNs SDK, no service worker push subscription anywhere in `server/` or `client/`. All "notifications" today are in-app only: written to the `Notification` model and delivered live over the existing Socket.IO connection while the app is open (`notifications.routes.js` + the socket layer), which is exactly why they're invisible the moment a tab/app isn't foregrounded. Android will need this closed for a genuinely mobile-native experience — see `android-readiness.md`'s "Required backend changes" is empty for this (nothing was implemented here, by instruction), but the events that should eventually trigger a push are already well-defined: friend requests, new messages, Ludo/Tic-Tac-Toe/quiz-challenge invitations, incoming calls, and admin messages all already exist as concrete server-side events/model writes today — adding FCM is additive (send a push in parallel with the existing socket emit), not a redesign.

## Risks

1. Rotating `JWT_SECRET` (required for the leaked-secret remediation) invalidates every current session across both web and, eventually, Android — needs a coordinated, communicated rollout, not a silent env change.
2. No TURN server means WebRTC call reliability is already imperfect for both platforms; Android will inherit, not cause, this.
3. `server/.env` history exposure is a live risk right now, independent of anything to do with Android — flagged with urgency in this document even though it's outside this task's original scope, because inspecting env vars was explicitly requested.

## Blockers before Android implementation begins

None of the following block *documentation and scaffolding* (this pass is complete), but they should be resolved or consciously accepted before writing Android networking/realtime code:
1. Decide on and execute secret rotation for `server/.env` (independent of Android, but should not be deferred indefinitely).
2. Add FCM server-side before shipping any Android build that needs background notifications/incoming-call alerts (calls ringing while the app is backgrounded is a core mobile expectation).
3. Add or budget for a TURN provider before relying on WebRTC call reliability in production on cellular networks.

## Required backend changes (made in this pass)

Exactly one, additive and backward-compatible: Socket.IO's handshake middleware in `server/src/server.js` now accepts a token from `socket.handshake.auth.token` as a fallback when no `kotha_token` cookie is present. The cookie path is completely unchanged for the web client; no event name, payload, or room changed. See `android-realtime-contract.md`'s "Authentication" section for the exact diff and the Android-side connection shape it enables.

## Recommended implementation order (for when Phase 3/Android coding actually starts — not started here)

1. `core/network` (Retrofit + the `{data}`/`{error}` contract) + `feature/auth` (Bearer token flow, `core/security` storage) — proves the REST boundary end-to-end with the lowest-risk feature.
2. `core/websocket` (wraps `socket.io-client` for Android, connects with `auth.token`) + `feature/notifications` or `feature/friends` presence — proves the realtime boundary.
3. `feature/messages` — the richest REST+realtime feature, good stress test of both layers together.
4. `feature/tic_tac_toe` / `feature/ludo` / `feature/games` — proves "render server state, submit actions" discipline holds for realtime multiplayer.
5. `feature/calls` + `core/media` — WebRTC, the most platform-specific and highest-effort feature; done last once everything else has validated the shared contracts.
6. FCM integration, once the server-side push-sending addition (see "Blockers") exists.
