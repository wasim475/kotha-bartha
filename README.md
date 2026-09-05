# KOTHA-BARTA

Mobile-first social networking and messaging platform built with React, Express, MongoDB, Mongoose, JWT, Socket.io, MUI, and Tailwind-ready client tooling.

## Run locally

Prerequisites: Node.js 20+, MongoDB running locally, and npm.

```powershell
Copy-Item server/.env.example server/.env
npm --prefix server install
npm --prefix client install
npm --prefix server run dev
npm --prefix client run dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:5000`.

The first working slice includes:

- Real MongoDB-backed register, login, logout, and session restoration.
- bcrypt password hashing, HttpOnly cookie sessions, validation, CORS, Helmet, and rate limiting.
- Responsive mobile-first app shell with desktop navigation.
- Feed, friends, messages, notifications, profile, theme persistence, and interactive post likes.

Architecture and the full implementation roadmap are documented in [PHASE-1-ARCHITECTURE.md](PHASE-1-ARCHITECTURE.md). Feature work continues phase by phase; demo-looking cards in the initial shell are intentionally not presented as persisted server data yet.
