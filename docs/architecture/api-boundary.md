# API boundary — what Android consumes, unchanged

The backend (`server/`) is already platform-neutral at the HTTP layer: every route in `server/src/routes/*` returns JSON and is reachable identically from a browser or a native client. Android should call it exactly as the web client does, through the same `server/src/routes/index.js` surface — no new API is required to start (`auth`, `users`, `posts`, `comments`, `friends`, `chat`, `notifications`, `blocks`, `reports`, `stories`, `notes`, `quiz`, `englishQuestions`, `game`, `gameChallenge`, `ticTacToe`, `ludo`, `call`, `leaderboard`, `analytics`, `link-preview`, and `admin/*`).

## Auth: one real gap, already half-solved

`server/src/middleware/auth.js` accepts **either** an HttpOnly cookie (`kotha_token`) **or** an `Authorization: Bearer <token>` header — the header path already exists and needs no server change. Android should authenticate with the Bearer path from day one (store the JWT in `core/security`, e.g. Android Keystore-backed `EncryptedSharedPreferences`/DataStore, never in a cookie jar).

## Realtime: one real gap, needs a small server addition later (not done now)

Socket.IO auth in `server/src/server.js` currently reads the JWT **only** from `socket.handshake.headers.cookie` (parsing out `kotha_token=`). A native Socket.IO client has no browser cookie jar, so this path will not authenticate Android as-is. The fix is small and additive — accept a token from `socket.handshake.auth.token` as a fallback, alongside the existing cookie path — but it **is a backend code change**, so it is intentionally not made in this analysis-only pass. Flagged here as the one concrete Phase 2 backend task Android needs.

## Response shape

Routes consistently return `{ data: ... }` / `{ error: { code, message } }` shapes (seen throughout `chat.routes.js`, `call.routes.js`, etc.) — this is already client-agnostic and Android's Retrofit layer can model it directly with sealed result types, no server changes needed.
