# WebRTC integration boundary

Signalling is transport-agnostic already: `server/src/services/call.service.js` + `server/src/sockets/call.socket.js` only relay offer/answer/ICE payloads and manage call state (`Call` model: ringing → accepted → connecting → connected → …) over the existing Socket.IO rooms. The server never touches media — it will not need to change for Android to place/receive calls, **once** the Socket.IO auth gap above is closed.

## What's client-local today (`client/src/provider/CallProvider.jsx`) and what Android needs its own version of

- `getUserMedia`/`addTrack`/`RTCPeerConnection`/`ontrack` — Android needs its own native WebRTC stack (`org.webrtc:google-webrtc` or the newer WebRTC AAR), driven by the same signalling messages, independently implemented (not shared code — WebRTC is inherently per-platform).
- ICE servers: `client/src/utility/call.js`'s `iceServers()` reads `VITE_STUN_URLS`/`VITE_TURN_*` from Vite env vars at build time — that mechanism is web-only by construction. Android will need its own config source (build config field or a small server-provided config endpoint); **no TURN server is currently configured at all** (only public Google STUN) — calls on both platforms today can fail across strict/symmetric NATs. Not an Android-specific gap, but worth fixing for both before Android calling ships.
- Per-media-kind readiness (`remoteVideoReady`/`remoteAudioReady`), camera-switch via `facingMode`, screen share via `getDisplayMedia`/`replaceTrack` — all web-specific implementation details; Android's equivalents (`CameraX`, foreground-service screen capture) are separate native concerns with no shared code, only a shared *protocol* (the signalling message shapes already defined in `call.socket.js`).

## What's genuinely shared

The state machine, the REST endpoints (`call.routes.js`: create/accept/decline/cancel/report-state/invite/history), and the signalling event contract. Document these message shapes as the actual Android WebRTC contract when that work starts — don't reverse-engineer them from the web client at that time.
