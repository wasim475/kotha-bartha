# Project structure

## Confirmed final architecture

```
kotha-bartha/
├── client/     # existing React web application — stays exactly where it is
├── android/    # future Kotlin Android application — scaffold only, see android/README.md
├── server/     # shared Express + Socket.IO backend — stays exactly where it is
├── docs/
│   └── architecture/
└── README.md
```

This supersedes the earlier `apps/web` + `apps/android` proposal from the prior architecture pass: the confirmed direction is a **flat, non-nested layout** with `client/`, `android/`, and `server/` as siblings at the repo root. No monorepo tool (Turborepo, Nx, Lerna, npm workspaces) is introduced — there is still no root `package.json`; `client`, `server`, and eventually `android` (via Gradle) remain three independently-built projects that share nothing but the HTTP/Socket.IO contract documented in the other files in this folder.

## Why this is safe as a pure addition

`server/` was never moved and needs no path changes to serve a second client — it has no knowledge of where `client/` or `android/` live on disk; it only knows the origins it CORS-allows (`CLIENT_ORIGIN` env var) and the JWT it verifies. `client/`'s Vite config, build command, and Render deployment are untouched. `android/` is new and currently empty of any buildable content (see `android/README.md`), so its addition changes nothing for the existing two projects.
