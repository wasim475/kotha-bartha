# Android REST API contract

Every endpoint below already exists and is unchanged by this pass — this is a map of what Android consumes, not a new API. Source files are the field-level ground truth; this document records the conventions and groups the surface so Android's `core/network` layer can be modeled once and reused everywhere, rather than transcribing every field of ~120 routes (that would drift from the code the moment either changes — read the linked route file for exact body/response fields when implementing a given feature).

## Global conventions

- **Base URL**: `/api/v1` (health check at `/api/v1/health`, unauthenticated).
- **Auth**: every route except `/api/v1/auth/*` requires `requireAuth` (`server/src/middleware/auth.js`) — send `Authorization: Bearer <jwt>`. The JWT comes from `/api/v1/auth/{register,login,google}`; it is *also* set as an HttpOnly cookie for the web client, but Android should ignore that and only use the header.
- **Success envelope**: `{ "data": ... }`, sometimes with a sibling `"meta"` (pagination, `hasMore`, etc.).
- **Error envelope**: `{ "error": { "code": "SOME_CODE", "message": "Human-readable." } }`, HTTP status matches the error (`400`/`401`/`403`/`404`/`409`, `500` for the generic unhandled-error fallback in `app.js`). Codes are stable identifiers (`ACCOUNT_MUTED`, `ACCOUNT_RESTRICTED`, `BLOCKED`, `NOT_FOUND`, `UNAUTHENTICATED`, `FORBIDDEN`, game-specific codes like `ALREADY_PENDING`/`CALL_NOT_ACTIVE`, etc.) — Android should switch on `code`, not parse `message`.
- **Pagination**: two patterns coexist. Most lists (call/ludo history, admin lists) use `?page=N` with a response `meta: { page, totalPages }` (30-per-page is the common default, see e.g. `call.service.js#getHistory`). The main feed (`GET /posts/feed`) currently returns a flat `limit(30)` with `meta: { hasMore: false }` hardcoded — **it is not yet real cursor pagination**; Android should treat the feed as a single page for now rather than building infinite-scroll logic against a flag that never flips true.
- **Authorization pattern**: route-level moderation gating via `requireAction(ACTIONS.X)` (`server/src/utils/moderation.js`) for anything that changes state or reaches other people (posting, commenting, friending, messaging, calling, playing) — a muted or banned account gets a `403 ACCOUNT_MUTED`/`ACCOUNT_RESTRICTED` before the route body even runs. Ownership/participant checks (can this user see/edit *this* conversation/post/call) are done inside each service, re-validated server-side every request — never trust a client-supplied ID alone.
- **File uploads**: `multipart/form-data` via `multer` memory storage straight to Cloudinary (`server/src/middleware/upload.js`), 15MB limit, an explicit MIME allow-list (images, common audio formats for voice notes, PDFs/Office docs/zip/text/json). Android's OkHttp multipart body works against this unchanged.

## Auth

`POST /auth/register`, `POST /auth/login`, `POST /auth/google` (unauthenticated), `POST /auth/logout`, `GET /auth/me` (authenticated) — `server/src/routes/auth.js`.

## Users / Profile

`GET /users`, `GET /users/search`, `GET /users/:userId`, `GET /users/:userId/posts`, `GET /users/:userId/photos`, `PATCH /users/me` (gated by `EDIT_PROFILE`), `PATCH /users/me/public-key` (E2E messaging key publish), two more `PATCH /users/me/...` routes — `server/src/routes/users.routes.js`.

## Friends

`GET /friends`, `POST /friends/requests` (gated by `FRIEND_REQUEST`), `DELETE /friends/requests/:receiverId`, `POST /friends/requests/:requestId/accept`, `DELETE /friends/:userId` — `server/src/routes/friends.routes.js`.

## Feed / Posts

`GET /posts/feed`, `GET /posts/:postId`, `POST /posts/feed/read`, `POST /posts` (create, gated by `CREATE_POST`, multipart), `PUT /posts/:postId/like`, `PUT /posts/:postId/reaction` (gated by `REACT`), `PATCH /posts/:postId` (gated by `EDIT_POST`), `DELETE /posts/:postId` — `server/src/routes/posts.routes.js`. All list/detail reads apply `VISIBLE_CONTENT` (excludes moderated/deleted content) automatically.

## Comments

`GET /posts/:postId/comments`, `POST .../comments` (gated by `COMMENT`/`REPLY` depending on body), `PATCH /comments/:commentId` (gated by `EDIT_POST`), `DELETE /comments/:commentId`, `PUT /comments/:commentId/reaction` (gated by `REACT`) — `server/src/routes/comments.routes.js`.

## Messages

The largest single group — `server/src/routes/chat.routes.js` (conversations, group conversations, membership, archive/unarchive, nickname/theme/like-emoji customization, message send/edit/delete/forward/pin, reactions, search). Every conversation-scoped route re-validates the caller is a participant before touching it. Group-only actions (add/remove member, pin) 400 outright on a 1:1 conversation. Encrypted 1:1 messages are opaque `ciphertext`/`iv` fields the server never reads as plaintext (see `PATCH /users/me/public-key` above) — Android's message list rendering must decrypt client-side exactly like the web client does, not expect the server to do it.

## Notifications

`GET /notifications/unread-counts`, `GET /notifications`, `POST /notifications/:notificationId/read`, `DELETE /notifications/:notificationId`, `POST /notifications/read-all` — `server/src/routes/notifications.routes.js`. In-app only today (see `android-readiness.md`'s push-notification section) — this is the REST read/mark-read surface, not a push-delivery mechanism.

## Quiz

`server/src/routes/quiz.routes.js`: category/class-level/SSC-division static lookups, subject/chapter CRUD (author routes gated `requireRole("admin","moderator")`), chapter question-set listing, `POST .../sets/:setNumber/start` and `POST /quiz/attempts/:attemptId/answer` (both gated by `QUIZ_PLAY`) drive an attempt state machine — correctness/scoring is computed server-side inside the attempt-answer handler, never client-side.

## Games (registry + Math/English)

`server/src/routes/game.routes.js` (catalog/session endpoints, gated where they mutate) and `server/src/routes/englishQuestions.routes.js` (question bank, author-only writes). Generation logic (`server/src/services/games/{mathGenerator,englishBanks,questionBuilder}.js`) runs server-side; Android receives already-generated questions and submits answers for server-side scoring only.

## Leaderboard

`GET /leaderboard/top`, `GET /leaderboard/users/:userId/stats`, `GET /leaderboard/archive/months`, `GET /leaderboard/archive/:year/:month` — `server/src/routes/leaderboard.routes.js`, all read-only from Android's perspective; ranking/point calculation happens in `leaderboardRanking.service.js`/`leaderboardCycle.service.js`, never client-side.

## Tic-Tac-Toe

`server/src/routes/ticTacToe.routes.js`: settings, stats, online-friends list, active games, pending invites, invite create/accept/decline/cancel, game fetch, and in-game move/action routes. Move legality is validated server-side (`services/ticTacToe/logic.js`) — REST here mostly bootstraps state; live play happens over the matching socket events (see `android-realtime-contract.md`).

## Ludo

`server/src/routes/ludo.routes.js`: catalog/variants, history, stats, online friends, active games, lobby create, invite create/accept/decline/cancel, per-game settings/ready/start/leave/rematch. Dice rolls and token-movement legality are enforced in `server/src/games/ludo/engine.js` server-side; Android never computes a roll or validates a move itself.

## Game Challenges

`server/src/routes/gameChallenge.routes.js`: friend-vs-friend Math/English head-to-head — online-friends list, active/pending listings, challenge create/respond/leave, in-match answer submission. Same rule as Quiz/Ludo/Tic-Tac-Toe: scoring/winner determination is server-side.

## Calls

`server/src/routes/call.routes.js`: `GET /calls/active`, `GET /calls/history` (paginated), `GET /calls/friends/online`, `GET /calls/:callId`, `POST /calls` (create, gated by `CALL`), `POST /calls/:callId/{accept,decline,cancel,end}`, `POST /calls/:callId/invite` (+`/accept`, `/decline`) for the "Add People" foundation. This is the REST half of calling; the actual WebRTC signalling is socket-only — see `android-webrtc.md`.

## Reports / Support

`POST /reports`, `POST /support/messages` — `server/src/routes/reports.routes.js`.

## Blocks

`GET /blocks`, `POST /blocks/:userId`, `DELETE /blocks/:userId` — `server/src/routes/blocks.routes.js`. Blocking is enforced everywhere else too (messaging, calling, friend requests all re-check `isBlockedEitherWay` server-side), not just at this endpoint.

## Analytics

`server/src/routes/analytics.routes.js` — page-view tracking, mounted with its own rate limiter *before* the global one in `app.js`. Write-only from a client's perspective (fire-and-forget page-view pings); Android should call this the same way if screen-view analytics are wanted, no new endpoint needed.

## Admin

Everything under `/admin/*` (`server/src/routes/admin/*`) requires staff role (`requireStaff`) plus a per-section check (`requireAdminSection`, `middleware/adminAuth.js`) — `admin`/`users`/`posts`/`reports`/`messages`/`quiz`/`games`/`analytics`/`logs`/`settings`. Per Step 8 of the prior architecture pass, no Android admin UI is planned; these are documented here only for completeness in case that changes later — nothing here should be built into `feature/*` today.

## Notes / Stories

`server/src/routes/{notes,stories}.routes.js` — CRUD + react/reply, gated the same way as posts/comments (`CREATE_POST`/`REACT`/`SEND_MESSAGE`). Same shape conventions as everything else above; not spelled out endpoint-by-endpoint here since they follow the Feed/Posts pattern exactly.

## Link preview

`GET /link-preview?url=...` — `server/src/routes/link-preview.routes.js`, used for message/post link unfurling; straightforward passthrough, no auth nuance beyond the standard `requireAuth`.
