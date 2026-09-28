# Android architecture (design only — nothing implemented)

Foundation directories exist under `android/` at the repo root (sibling to `client/` and `server/`, not moved into an `apps/` layout yet — see `project-structure.md`). No Gradle files, no Kotlin source, no dependencies: intentionally, per the discovery-only scope of this pass.

```
android/
├── app/                      # future application module (nav host, DI graph wiring)
├── core/
│   ├── common/                # shared utils, Result/error types, formatters (mirrors client/src/utility/helpers.jsx's non-UI half)
│   ├── network/                # Retrofit/OkHttp client, the { data } / { error } response contract from api-boundary.md
│   ├── database/               # Room, for whatever benefits from local cache/offline (messages, feed)
│   ├── datastore/               # Jetpack DataStore for prefs/settings (mirrors theme.js, conversationPreferences.js)
│   ├── websocket/               # Socket.IO client wrapper — one shared connection, see realtime-architecture.md
│   ├── security/                 # token storage (Bearer JWT, Android Keystore-backed), mirrors utility/crypto.js's scope
│   ├── ui/                        # design tokens/theme (mirrors the CSS-variable theme system), Compose building blocks
│   ├── navigation/                 # nav graph / deep link routing (mirrors client/src/Router)
│   └── media/                       # camera/WebRTC/screen-capture plumbing, see webrtc-architecture.md
└── feature/
    ├── auth/           friends/        messages/        notifications/
    ├── home/           profile/        posts/           study/
    ├── quiz/           games/          tic_tac_toe/      ludo/
    ├── calls/          leaderboard/    settings/
```

No `feature/admin` — see the root report's Admin section: not scaffolded now by design, Step 8 of the request explicitly defers it.

Each `feature/*` module is expected to eventually hold its own Compose screens, ViewModels (MVVM, `StateFlow`-driven), and a repository that talks to `core/network` + `core/websocket` + `core/database` — the same repository-pattern split the request asked for, just not built yet.
