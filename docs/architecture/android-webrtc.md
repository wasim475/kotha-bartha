# Android WebRTC integration boundary

Not implemented here — Step 7's instruction is documentation only. This records exactly what already exists so Android's future native WebRTC work is built against the real contract, not a guess.

## Shared (server-side, reusable as-is, unaffected by this pass except the one socket-auth fix)

- **Signalling relay**: `server/src/sockets/call.socket.js` + `call.service.js#relaySignal`. Client sends `call:offer`/`call:answer` (`{ callId, sdp, renegotiate? }`) or `call:ice-candidate` (`{ callId, candidate }`); the server validates the sender is a participant in an already-answered call (`ANSWERED_STATUSES`, `assertParticipant`) and forwards it to the other participant as one unified `call:signal` event: `{ callId, from, signal: { type, sdp?, candidate?, renegotiate? } }`. The server never parses or interprets SDP/ICE content — it is a pure authenticated relay. This is 100% reusable by Android with no change.
- **Call state machine**: `Call` model + `call.service.js`. States: `ringing → accepted → connecting/connected → {ended, declined, missed, cancelled, failed}`, plus `reconnecting` as a transient sub-state of an already-connected call. Every transition is a conditional `findOneAndUpdate` keyed on the current status (no client can force an illegal transition). Two server-side safety timers exist and apply identically regardless of which platform is on either end of the call: a reconnect timeout (an already-`connected` call that stops reporting state) and a connect timeout (an `accepted` call that never reaches `connected` even once) — both eventually transition the call to `failed` and emit `call:ended`.
- **Backend authorization**: `assertCanCall` (friendship + block checks), `assertParticipant`, `assertNotBusy`, and the `CALL` moderation action gate (muted/banned accounts can't start or accept calls) all run before any signalling is allowed — identical enforcement for every client type.
- **Call database**: the `Call` document (caller/callee, status, timestamps, `participantInvites` for the "Add People" foundation) is the single shared record both platforms read via `GET /calls/:callId`/`GET /calls/history`/`GET /calls/active`.
- **Socket.IO events**: the full `call:*` event set documented in `android-realtime-contract.md` — unchanged, reusable.

## Android-specific (native, no shared code — only the shared protocol above)

- **Native WebRTC stack**: `RTCPeerConnection`, `MediaStream`, SDP offer/answer creation, ICE candidate gathering — a genuinely separate implementation using an Android WebRTC library (e.g. the `org.webrtc` AAR), driven by sending/receiving exactly the `call:offer`/`call:answer`/`call:ice-candidate`/`call:signal` messages above. Nothing from `client/src/provider/CallProvider.jsx` is portable code — only its *behavior* (what it does with each signalling message, in what order) is worth mirroring.
- **Camera/microphone capture**: `CameraX` (or `Camera2`) + Android's audio APIs, entirely native; the web client's `getUserMedia`/`facingMode`-ref-based camera-switch approach is a browser-API detail with no Android equivalent to reuse, only the *lesson* (track `facingMode`/lens-facing in app state rather than trusting the platform to report it back reliably, since the web side found the browser's own settings readback unreliable on mobile browsers).
- **Screen sharing**: Android requires a foreground `MediaProjection` service with its own runtime-permission flow and persistent notification — structurally different from the web's `getDisplayMedia()` call, though the *signalling* (`call:screen-share:start`/`:stop`) is identical.
- **Audio routing**: earpiece/speaker/Bluetooth routing during a call is an Android `AudioManager`/`AudioDeviceCallback` concern with no web equivalent at all (the web client has no device-routing UI, just system-default output).
- **Permissions**: Android's runtime permission model (`RECORD_AUDIO`, `CAMERA`, `POST_NOTIFICATIONS`, screen-capture consent) needs its own explicit request/rationale flow; the web client's simpler one-shot browser permission prompt is not analogous.
- **Background/lifecycle behavior**: an incoming call must be able to wake the app from a killed/backgrounded state (see `android-readiness.md`'s push-notification gap — an incoming `call:invite` reaching a backgrounded socket connection is not the same as reaching a backgrounded *app*), needs a foreground service to keep the call alive while backgrounded, and must survive Activity/Compose lifecycle transitions (rotation, split-screen) without dropping the `RTCPeerConnection`. None of this has a web analogue.

## ICE server configuration — a real gap Android inherits, not one it causes

`client/src/utility/call.js#iceServers()` reads `VITE_STUN_URLS`/`VITE_TURN_URL`/`VITE_TURN_USERNAME`/`VITE_TURN_CREDENTIAL` from Vite build-time env vars. Inspecting `client/.env`, only the default public STUN (`stun:stun.l.google.com:19302`) is active — **no TURN server is configured at all today**, for either platform. Two consequences for Android specifically:
1. The Vite-env-var mechanism itself is web-only by construction and cannot be reused verbatim — Android will need its own config source (a `BuildConfig` field, or better, a small server-provided config endpoint so both platforms share one source of truth instead of duplicating STUN/TURN URLs in two build systems).
2. Production call reliability on cellular networks (which are far more likely to sit behind symmetric NAT/CGNAT than home broadband) will be worse without a TURN relay — this should be budgeted for before Android calling ships, independent of any Android-specific code, since it would also measurably improve the existing web experience.

## What was intentionally NOT done in this pass

No Android WebRTC code, no native peer-connection wrapper, no TURN provisioning — per explicit instruction, this document is the boundary specification only.
