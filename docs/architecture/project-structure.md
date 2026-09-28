# Project structure — current vs. proposed

## Current (as inspected, unchanged by this pass)

```
kotha-bartha/
├── client/     # React 19 + Vite 8 + Tailwind v4, npm project, own package.json
├── server/     # Express 5 + Socket.IO 4 + Mongoose 9, npm project, own package.json
├── android/    # NEW — empty foundation only, added by this pass
├── docs/
├── LUDO.md, PHASE-1-ARCHITECTURE.md, README.md
```

There is no root `package.json` / npm workspaces — `client` and `server` are two independent projects that happen to live in one git repo. Nothing here assumes a monorepo tool (no Turborepo/Nx/Lerna config found).

## Proposed target (Phase 2, not done in this pass)

```
kotha-bartha/
├── apps/
│   ├── web/       ← today's client/, moved as-is
│   └── android/   ← today's android/, filled in
├── server/        ← unchanged, stays where it is
├── docs/
└── README.md
```

Moving `client/` → `apps/web/` is a real migration (Vite root, Render/deploy build command, any relative `../server` references, CI paths, git history) and is **deliberately not done now** — see `docs/architecture/...` risk notes below and the root report. `server/` does not need to move at all in either layout; it is already a sibling, already framework-agnostic about who calls it, and Android will simply become a second caller of the same REST/Socket.IO surface.
