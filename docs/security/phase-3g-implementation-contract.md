# Phase 3G — E2EE Implementation Contract (Design Proposal)

**Checked:** 2026-10-29
**Status:** Design proposal; Architecture A is preferred for evaluation. Protocol, library, API, policy details, and implementation are **not approved**.
**Scope:** Read-only source/document inspection and design documentation. No production behavior was changed.

## 1. Decision summary

### User-selected product direction

The user has stated the following product direction:

- Preserve existing Legacy conversations and their history.
- Keep Legacy history readable and immutable under an approved policy; do not silently convert Legacy to E2EE.
- Use a distinct Protected security context where safe in-place transition cannot be proven.
- Present a familiar Chat experience per person while preserving context identity, message provenance and explicit security labels.
- Make new conversations E2EE by default; never fall back to plaintext or silently downgrade.
- Block unsupported clients from Protected sends.
- Require approval and verification for new devices.
- Grant historical messages to new devices only through an explicitly approved secure recovery mechanism.

This direction is not an approval to change production behavior, APIs, schemas, keys, dependencies, rollout or protocol.

### Recommendation for evaluation

Continue with **Architecture A: distinct Legacy and Protected contexts, grouped under one familiar per-person Chat entry point**. Prefer explicit context navigation over interleaving both message streams. Do not treat a shared UI, conversation ID, server mode field, TLS, or pair identity as evidence of E2EE.

The protocol decision is **open**. MLS (RFC 9420) is the preferred protocol family to evaluate because the product direction includes group messaging and device membership; it is not selected for implementation. Signal-family specifications are a viable comparison for asynchronous 1:1 sessions, but the inspected specifications and library evidence do not establish this app's complete direct/group, device, Web/Android, recovery and operational contract. No custom cryptographic protocol is proposed.

### Current implementation reality

Rechecked source confirms:

- Android has a legacy receive/decrypt path for addressed multi-device P-256 ECDH/AES-GCM text payloads, and provisions/registers a public key. **Android outgoing text still sends plaintext** in `SendMessageRequest.body`; the receiver support does not secure outgoing sends.
- The Android legacy decryptor derives the AES key directly from P-256 ECDH output and decrypts AES-GCM without application AAD. It cannot decrypt the legacy single-payload form through its current addressed-device path.
- The device public-key registration route upserts a caller-provided device ID and JWK. It does not establish approval, identity verification, revocation or key transparency.
- The server defaults missing conversation security mode to `legacy`. Current E2EE mode validation checks the multi-device envelope shape, rejects groups and non-text messages, and explicitly does not prove that the payload was actually encrypted or authentic.
- Direct conversation creation reuses a unique participant-pair `pairKey`. Current create-or-open cannot create a distinct Protected direct context for the same pair.
- Web's current send/edit paths can fall back to plaintext. Existing client behavior is not a fail-closed Protected implementation.
- No MLS or Signal-family protocol implementation appears in the Android version catalog or Web `package.json`.

These are source-confirmed observations, not a cryptographic audit. Older repository documents contain historical findings that are no longer exact for Android reception/key registration; this contract uses the rechecked behavior above.

## 2. Scope and terminology

- **Account identity:** authenticated product account and authorization namespace.
- **Device/client:** one Android installation or browser profile with its own cryptographic identity and local protocol state. An account is not a shared private key.
- **Legacy context:** existing conversation and message history using legacy/plaintext or opportunistic legacy encrypted formats. Preserve original record classification.
- **Protected context:** distinct conversation security context, created under a reviewed protocol generation and authorized device set. It contains only messages accepted under that protocol state.
- **Protocol state:** local, versioned cryptographic state held by each device, including membership/epoch/session state as defined by the selected library.
- **Server relay:** account authorization, routing, ciphertext storage and delivery metadata only. It must not be trusted to assert that a body is encrypted or valid.

Architecture A is not an approved database or API schema. Any semantic names below describe required concepts only; they are not finalized fields or routes.

## 3. Protocol comparison and selection gate

### 3.1 Protocol-family comparison

| Requirement | MLS (RFC 9420) | Signal-family specifications (X3DH, Double Ratchet, Sesame) |
|---|---|---|
| 1:1 asynchronous chat | RFC 9750 describes MLS as applicable to two-client groups; protocol still needs application, delivery and credential services. | X3DH supports asynchronous initial key agreement; Double Ratchet provides evolving pairwise message keys; Sesame describes asynchronous multi-device session management. |
| Group messaging | Native group key establishment and membership epochs are the protocol's core model. | The cited X3DH/Double Ratchet/Sesame specifications do not alone define Kotha-Barta's unified group protocol. A specific group construction and compatible implementation would need separate evidence and approval. |
| Forward secrecy / post-compromise security | RFC 9420 states FS and PCS properties, dependent on protocol operations, membership transitions, valid implementations and state handling. | Double Ratchet describes forward security and recovery after fresh DH ratchet input. This is not a system-level guarantee when devices, session state or identity services are compromised. |
| Device model | A device can be represented as a separate group member, but account-to-device credential issuance and approval remain application policy. | Sesame addresses multiple devices and session lifecycle, but account/device directory, session fan-out, enrollment and revocation remain system work. |
| Membership changes / revocation | Membership changes update group state/epoch; the application must authenticate the change, serialize it and handle delivery/fork behavior. Revocation does not erase content already read or key material copied. | Device removal requires managing affected device sessions and fresh key state. Exact revocation and group semantics require a selected, reviewed design. |
| Backend role | RFC 9750 distinguishes the MLS protocol from the surrounding delivery/authentication architecture. The service must relay opaque protocol messages and provide reliable enough ordering/state handling; it does not gain plaintext verification. | Servers may distribute prekeys and queue opaque ciphertext, but correctness/trust in device directory and delivery remain application-specific. |
| Interoperability | Standard protocol wire format is a useful basis, but exact version, cipher suite, credentials, extensions, encoding, application framing, provider and persistent-state behavior must match. | Specifications are published, but using the Signal name or library does not itself establish wire compatibility with Signal clients or another implementation. |
| Legacy migration | MLS does not convert plaintext or legacy ciphertext into authenticated MLS history. Treat all historic records as Legacy and start Protected state separately. | Ratchet/session protocols likewise do not make historic plaintext or old-format ciphertext retroactively protected. Preserve Legacy classification. |
| Audit / implementation maturity | RFC standardization is not an audit of a selected implementation. No current candidate/library has been independently reviewed for this app's exact Android/Web integration, provider and state model. | Published specifications and Signal's internal use are not an audit or support guarantee for this third-party app; the current `libsignal` README explicitly says external use is unsupported. |
| Android / Web implementation evidence | The repository's Phase 3E report records an `mls-rs` baseline and OpenMLS candidate; neither has demonstrated this app's Android/Web bindings, persistent state or cross-platform interop. Current OpenMLS upstream README marks Android and WASM targets as built but unsupported/untested. | Current `signalapp/libsignal` README lists Java, Swift and TypeScript libraries, but explicitly says use outside Signal is unsupported and APIs/bridge layers may change. The repository license is AGPL-3.0; legal review is required. This is not evidence that the Kotha-Barta product protocol or full Web/Android contract works. |
| Maintenance / licensing | Existing repo reports contain historical `mls-rs` Apache-2.0 OR MIT and OpenMLS MIT evidence, but exact current versions, transitive licenses, support commitments and security advisories must be revalidated at candidate selection. | Current `libsignal` license evidence is AGPL-3.0 and upstream disclaims support outside Signal. No production dependency is present locally. |
| Recovery / backups | Protocols do not define account recovery policy or make lost local state recoverable automatically. | Likewise, session/identity recovery and history sharing require separate product and security decisions. |

### 3.2 Gate outcome

**No protocol or library is selected for production.** An evaluation-stage preference for MLS is justified by RFC 9420's group-oriented scope and Architecture A's future group/device-membership requirements. The choice cannot advance beyond evaluation until a pinned implementation demonstrates supported Android and browser targets, compatible wire behavior, provider suitability, robust state persistence, test vectors, licensing and maintenance ownership, and independent security review.

Signal-family work remains a comparator, not a rejected cryptographic design. Its official specifications cover useful pairwise/session-management properties. The current official `libsignal` README's support warning and AGPL-3.0 license create concrete product/legal/maintenance gates; do not work around them by copying or reimplementing its protocol.

### 3.3 Evidence needed to close the protocol gate

For each exact candidate release/commit:

1. Pin source revision, language bindings, provider, cipher suite, feature flags, compiler/SDK/browser matrix and every lockfile.
2. Verify license and transitive dependency notices with legal approval; assign upgrade, vulnerability response and long-term maintenance owners.
3. Demonstrate bidirectional Android/Web test vectors and state compatibility for setup, application messages, membership changes and unknown versions.
4. Demonstrate Android API 26+ compatibility or obtain explicit product approval to change the platform support floor. Current app `minSdk` is 26; Keystore ECDH is not available on all supported versions as currently implemented.
5. Test atomic persistence, crash/interruption, restore/rollback detection, browser multi-tab coordination, Android process death, offline delivery, duplicates, out-of-order delivery, revocation and group races.
6. Conduct an independent protocol/library integration security review. Upstream conformance, project claims or a successful interoperability test are not a security certification.

## 4. Proposed implementation contracts

### 4.1 Account identity and device identity

- Keep account authentication and device cryptographic identity separate.
- Give each installation a distinct device identity and private state. Bind the public credential to an authenticated account using a reviewed enrollment protocol; never treat an arbitrary device ID/key upsert as approval.
- Store private protocol state only in platform-protected local storage through a reviewed adapter. Do not log, analytics-export or synchronize private keys or mutable session/group state.
- Define server-visible states conceptually as pending enrollment, approved, verified, active, suspended and revoked. Product/security owners must decide which transitions require a trusted existing device, QR/safety-number verification, recovery authority or out-of-band approval.
- Device key changes must be visible and authenticated. A silent replacement under the same device identity is a security incident requiring explicit resolution.
- The account directory must define completeness, consistency, history of key changes, revocation propagation, rate limits and recovery from compromised account credentials. A server key listing alone cannot prevent equivocation.

### 4.2 Protected conversation identity, creation and readiness

- Preserve existing Legacy IDs and records. Create a separate server-authorized Protected identity for a participant set and approved security context.
- For direct Protected contexts, uniqueness must include context/security identity rather than collide with the current unique participant-pair key. Create-or-get must be idempotent and database-enforced so retries, simultaneous taps and concurrent devices converge to one context.
- For groups, identity includes an explicitly authorized participant/device set and protocol group state. Existing Legacy membership must not automatically create a Protected membership or grant history.
- Creation begins non-sendable. Setup completes only after authenticated credentials and required protocol state are accepted and all required participant/device acknowledgments are recorded. The server must not infer readiness from login, a public-key record, a client flag or UI state.
- The exact readiness quorum is unresolved: all approved active devices vs an explicitly selected subset; offline devices and directory completeness must have a product decision.
- Incomplete setup remains non-sendable. No route may silently send the same plaintext message to Legacy as a fallback.

### 4.3 Protocol version negotiation and compatibility

- Negotiate from a server-controlled, explicit allow-list of protocol generations and platform capabilities. The client must authenticate the selected generation as part of the protocol context.
- No opportunistic "try new protocol, then Legacy" fallback. Unknown, unsupported, unverified or malformed versions fail closed with a user-visible error and safe retry path.
- Do not infer protocol version from ciphertext shape, `encrypted` booleans, conversation ID, client version or content type.
- Maintain a strict parser per version. Historical Legacy messages remain immutable and clearly labeled; a Protected client never passes unknown data to the Legacy decryptor.
- Rollout must be monotonic: never transition an active Protected context back to plaintext. Failure response is pause/suspend new writes, not downgrade.

### 4.4 Message envelope and authenticated context

The exact wire encoding is a protocol-selection deliverable, not specified here. The selected protocol must provide authenticated sender credentials and protect application messages with the protocol's vetted authenticated-encryption and key-evolution mechanisms. Do not wrap a custom message protocol around MLS or Double Ratchet without expert review.

The application binding must ensure, using the selected protocol's supported authenticated context/associated-data mechanism and state checks, that the receiver can reject:

- messages addressed to the wrong Protected context or group;
- message kind or version substitution;
- sender/device identity mismatch or unauthorized credentials;
- stale/invalid group state or epoch;
- malformed or unsupported message types.

At minimum, the protocol/application binding must authenticate the immutable Protected context identity, protocol generation, message/control kind, sender device credential, and any security-relevant reply/edit/tombstone reference. Exact placement and encoding require protocol-specific review. Server routing fields must match the verified client protocol context; server-controlled IDs do not themselves become cryptographic proof.

Only opaque ciphertext and necessary bounded routing data may be persisted or relayed for Protected content. Plaintext body, plaintext reply preview, file name, content type, thumbnail or decryption key must not be sent to ordinary message storage, relay, push, logs or analytics. This contract does not define the encrypted-media envelope; media remains blocked.

### 4.5 Replay, substitution and idempotency

- Use protocol state/epoch/sequence mechanisms exactly as the selected implementation requires; reject duplicate or stale protocol objects where the protocol says they are invalid.
- Separate transport retry from a new logical message. An idempotency token may deduplicate a submission but must not be treated as cryptographic replay protection or sender authentication.
- A retry must reuse only the exact authorized ciphertext and must not re-encrypt or advance ratchet/group state inconsistently. Protocol state and durable outgoing ciphertext need an atomic persistence strategy.
- Validate the authenticated context against the REST conversation path and socket event context before rendering/decrypting.
- Persist/broadcast only after authorization and durable message creation; duplicate REST responses and Socket.IO events must converge on one message identity.
- Define duplicate retention and conflict behavior without exposing plaintext. Do not log envelope contents, keys, or signed tokens.

### 4.6 Group membership and key lifecycle

- Each approved device, not merely each account, has a protocol credential and membership state.
- Membership add/remove, device revocation, key rotation and group rekey must be authenticated protocol operations. Serialize concurrent commits and detect/resolve forks or stale epochs using the selected protocol library's supported mechanisms.
- Added devices receive no old history by default. A history grant requires a separately approved recovery/transfer mechanism and explicit consent.
- Removed/revoked devices must not decrypt future messages after the protocol-defined transition; they may retain content/keys already received. Do not promise retroactive erasure.
- Group creation, member additions/removals, invitation/acceptance, offline members, admin changes and history visibility require one product policy and protocol mapping before implementation.
- The current server's participant list and group membership endpoints are authorization metadata only; they do not establish cryptographic membership or key rotation.

### 4.7 REST, Socket.IO, storage and offline delivery

- REST is the authoritative authenticated boundary for context creation, message submission, history fetch and mutations. No message-content write may be accepted over an unreviewed alternate channel.
- Socket.IO events are notifications/relay of already-authorized durable outcomes, not an independent authorization path. Events must carry the correct context identity and opaque content, and match the REST/history representation.
- Current inspected server Socket.IO handles typing and call signaling; chat message creation currently occurs through REST/services and server-originated `message:*` events. Re-scan before implementation; future handlers must be included in the policy inventory.
- Server storage, push and relay must receive only ciphertext for Protected message content. Route logs, error serializers, APM, database audit, backups and analytics must not capture bodies or decryption material.
- Offline queues store encrypted payloads only after protocol encryption. Queueing plaintext for later encryption is prohibited for Protected sends.
- Acknowledgment means server accepted/stored an authorized opaque object, not that recipients received, decrypted, read or saw it. Preserve distinct statuses; do not infer delivery or read from upload, REST success or socket emission.
- Set bounded payload sizes, queue retention, retry schedules, dedupe windows and backpressure only after implementation constraints are tested. Do not define unmeasured numeric limits here.

### 4.8 Receipts, replies, edits, forwarding and deletion

- **Read receipts:** May be plaintext metadata only if product approves; they reveal activity and message association. Keep them per context, disclose their behavior, and never let opening a grouped Chat mark a different context read.
- **Replies:** Reply references may be routing metadata; Protected plaintext previews remain local. If protocol payload includes quoted content, encrypt it as part of the Protected application message. Cross-context Legacy quoting requires explicit user action/provenance and separate approval; default deny.
- **Edits:** Protected edit content must be an authenticated protocol operation referencing the original message and authorized editor. The server may store opaque updates, not plaintext. Define ordering/version conflict semantics.
- **Forwarding:** Never copy a Protected ciphertext across contexts as though it decrypts there. A client may only forward after authorized local decryption and a deliberate new send under the destination context; source provenance and privacy rules require approval. No server plaintext-forward route.
- **Deletion/unsend:** Distinguish remove-for-me, request-to-delete and shared tombstone. Authenticate the action under the selected protocol and preserve reliable event ordering. Deletion cannot erase content already copied, screenshotted, backed up or read.
- **Reactions/pins:** These expose message association and activity. Decide whether encrypted application events or server-visible metadata are acceptable. Legacy policy is defined separately below.

### 4.9 Notifications, search, logs and caches

- Push payloads for Protected messages contain generic content and opaque identifiers only. No plaintext title/body preview, quote, file name, image thumbnail or decryption key.
- Local notification previews are opt-in privacy behavior and must decrypt only on the authorized device; on key mismatch, unsupported version, unavailable protocol state or authentication failure, show generic content. Never fall back to server plaintext.
- Protected search is client-local over content already decrypted and authorized on that device. Never index Protected plaintext on the backend, shared cloud search, analytics, crash reports, debug logs or unencrypted caches.
- Clear or protect clipboard, previews, local notification stores, OS backups, screenshots and app-switcher snapshots under platform/product policy. E2EE does not protect plaintext after authorized decryption on an endpoint.
- Legacy server search/preview remains a Legacy exposure and must be explicitly labeled, not confused with Protected guarantees.

### 4.10 Recovery, transfer and loss

- Default new-device behavior: future Protected messages only after approved enrollment; no automatic recovery of Legacy or Protected history.
- Account password reset/login is not proof of device identity or authorization to unwrap old keys.
- Evaluate separately: trusted-device transfer; high-entropy user-held recovery secret; or a reviewed hardware-backed recovery service. A low-entropy PIN-only backup is not safe against offline guessing unless the exact protocol and online secret boundary are independently reviewed.
- Recovery must be authenticated, rate-limited, auditable without secret material, revocable where possible, and explicit about which contexts/history are granted.
- Lost/corrupted protocol state must fail closed into a recovery-required state. Never regenerate identity keys silently and claim continuity.

### 4.11 Error handling and fail-closed requirements

The UI must distinguish unsupported version, unapproved/revoked device, incomplete setup, stale membership, malformed envelope, authentication failure, protocol-state loss, offline service and policy rejection. Errors should be actionable but must not reveal secrets or turn a failure into success.

No client, API route, service, worker, retry or socket path may transform a Protected failure into plaintext send, Legacy send, false delivery/read status or plaintext preview. Unknown protocol versions and unclassified writes are rejected, not guessed.

## 5. Legacy policy matrix (proposal; approvals remain open)

Policy describes intended future behavior; it is **not currently enforced**.

| Operation | Proposed Legacy behavior | Category / approval |
|---|---|---|
| Sending and retrying | No new message content after read-only policy activation. Cancel stale queued retries; show a conflict, do not redirect payload automatically. | Content creation; direction follows prior user request, rollout details open. |
| Replies | No new reply in Legacy. Cross-context quote into Protected defaults to deny; if approved later, require explicit action and Legacy provenance. | Content creation; cross-context behavior open. |
| Editing | Reject content edits; preserve stored body, security classification, and timestamp/provenance. | Content mutation; expected by user direction. |
| Forwarding | No server-side plaintext copy from Legacy into Protected. Cross-context forward defaults to deny pending approval; if enabled, decrypt locally, require deliberate send and provenance. | Content creation/data disclosure; open. |
| Attachments and voice | Sending stays blocked until the encrypted binary protocol is separately approved. Existing legacy attachment access is not thereby E2EE. | Content creation; blocked. |
| Reactions | Recommend read-only on Legacy because reactions mutate shared history; product may explicitly approve them as metadata-only. | Shared state mutation; open. |
| Deletion and pinning | Reject shared unsend/delete-for-everyone and pin changes. A local-only hide may remain only if it cannot affect shared state/retention and policy approves semantics. | Shared mutation vs local UI; open. |
| Read receipts | Preserve only if explicitly approved; keep scoped per context and do not infer from viewing aggregate UI. | Sensitive metadata; open. |
| Metadata | Personal local labels/archive may be allowed if they do not change shared security identity. Freeze shared security mode/participants/history; group name/avatar/theme/nickname need separate classification and policy. | Mixed local/shared metadata; open. |
| Calls and call history | Calls are not covered by message E2EE. Keep signaling separate; do not write call-history items into Legacy read-only history unless explicitly approved. | Separate security context; open. |
| System-generated messages | Do not permit generic services to append arbitrary content. Only explicitly typed, authorized system/security events with defined Legacy display policy may be considered. | Timeline mutation; event taxonomy open. |

### 5.1 Alternate paths requiring enforcement inventory

The rechecked repository contains message writes and/or relevant mutations outside a single send route:

- `server/src/routes/chat.routes.js`: direct/group creation; text send; attachment upload/message creation; edit; reaction; unsend/delete; delete-for-me; forward; pin; archive/unarchive; group metadata and membership; history-triggered read receipts; search.
- `server/src/utils/contextMessages.js`, called by story/note flows: creates message records and emits `message:new`.
- `server/src/services/adminMessages.service.js` and admin message routes: create a user-visible `Message` in a conversation and emit `message:new`.
- `server/src/services/call.service.js` and call routes: create call-history `Message` records and emit events; current policy helper may reject the record while call signaling continues.
- `server/src/routes/users.routes.js`: current self public-key registration upsert; it is not a Protected device enrollment protocol.
- `server/src/server.js`: inspected Socket.IO chat listeners include typing relays; call signaling lives in `server/src/sockets/call.socket.js`. Chat `message:*` events found are emitted by REST/service paths. No inbound chat socket message writer was found in the inspected source; verify again at implementation time.
- Android `ChatViewModel.retrySend` retries an in-memory failed plaintext body; no durable/background messaging queue was established in the inspected Android messaging paths. Inventory any later worker/outbox before rollout.
- Web send/edit/forward hooks and any persisted browser retry/outbox behavior must be re-inspected; a complete durable queue was not established.
- Audit scheduled jobs, future workers, admin/moderation tools, export/import, notification workers, data repair scripts and every `Message.create`/update call before activation. Current `rg` inventory is not proof of absence of dynamically generated or external writers.

All writers must call one server-authoritative, operation-specific policy boundary and commit under an atomic/version check. UI hiding is not enforcement. Socket broadcasts only follow committed authorized writes.

## 6. Cross-platform acceptance criteria

No criterion below is met by current code. Each must produce retained test evidence before launch.

| ID | Testable criterion | Android evidence/test | Web evidence/test | Backend evidence/test |
|---|---|---|---|---|
| P1 | Protected plaintext never reaches server message storage, relay, push or ordinary logs. | Instrumented fake transport captures requests; assert only ciphertext/protocol objects; inspect crash/log test sinks. | Browser network/mock-server assertion and log/analytics sink scan. | Integration test inspects database, emitted events, push payload and captured logs for sentinel plaintext. |
| P2 | Crypto/key verification failure never downgrades to plaintext or Legacy send. | Unit/UI tests for missing, changed, revoked and invalid keys; assert no repository plaintext request. | Hook/unit tests for unavailable crypto/keys and stale identity; assert no `{body: plaintext}` fallback. | Negative endpoint tests reject plaintext and unauthorized protocol/version on Protected contexts. |
| P3 | Invalid, forged, replayed, duplicated, stale-epoch and cross-context objects are rejected or safely deduplicated per protocol rules. | Protocol-vector/fuzz tests against real pinned library and state store. | Same vectors in supported browser builds, including reload and multi-tab. | Contract/integration tests bind authenticated context to route; replay/idempotency and event-dedup tests. |
| P4 | Unapproved, unsupported and revoked devices cannot create or receive Protected messages. | Device lifecycle tests for pending/approved/verified/revoked state and outdated client. | Browser enrollment, key-change warning and revoked-device tests. | Authz tests across every REST, socket, service and history path, including stale tokens and race conditions. |
| P5 | Device addition/removal and group membership follow one approved cryptographic state transition; no added device receives history by default. | Multi-device state/commit tests, offline device and crash/restart tests. | Same cross-platform commit vectors and browser recovery/reload tests. | Concurrent membership CAS/transaction tests and history authorization tests. |
| P6 | Protected notifications contain no content; decryption failure yields generic preview. | Notification resolver tests for every privacy level, tamper, unsupported version and unavailable key. | Push/browser notification payload tests with content sentinel. | Push contract tests assert generic content and no body, quote, filename, thumbnail or key. |
| P7 | Legacy messages/history are never labeled or parsed as Protected and remain unchanged. | Mixed Legacy/Protected UI, DTO and migration regression tests. | Browser list/history/export tests preserve Legacy provenance. | Database migration/route tests prove no historical relabeling and Legacy writes follow approved policy. |
| P8 | Concurrent create/setup yields one context and a consistent readiness state; no early send. | Tap/retry/device-race UI tests. | Concurrent tabs and retry tests. | Unique-constraint and transaction/concurrency tests with simultaneous creation/acks. |
| P9 | Pagination, unread counts, receipts and REST/socket reconciliation stay scoped to each context. | Repository/VM tests across reconnect, duplicate event and context switch. | Socket/history reconciliation and context-switch tests. | Integration tests for context-local cursors, counters, read events and idempotent outcomes. |
| P10 | Key loss, corrupt state, rollback/restore and recovery failure do not silently recreate identity or expose history. | Keystore/state corruption and API-level matrix tests; recovery-required UI. | IndexedDB loss/restore/multi-tab tests. | Recovery authorization/rate-limit tests; no key/plaintext/secret in data or logs. |
| P11 | Replies, edits, forwarding, deletion, reactions and pinning preserve provenance and authorization. | Cross-context action tests ensure no plaintext fallback or false shared-state result. | Same path tests for web controls and stale clients. | Route/service policy tests for each mutation and alternative writer. |
| P12 | Unsupported version/unknown message kind fails closed and remains safely renderable. | Parser fuzz tests and generic unavailable UI. | Parser fuzz and no legacy decrypt fallback. | Bounded schema validation, no dynamic interpretation, consistent REST/socket rejection. |

Each test must pin protocol/library/build versions and synthetic identities. Passing tests establish the tested behavior only, not cryptographic security certification.

## 7. Rollout, rollback and security-review gates

Before any implementation proposal:

1. Approve Architecture A and the Legacy policy matrix, including unresolved metadata/call/reaction/delete/receipt cases.
2. Select protocol and exact library/provider only after the protocol gate evidence in section 3.3; legal review must clear all licenses.
3. Complete an independent protocol and application integration review covering credential binding, directory compromise, enrollment, recovery, group state, parser, platform storage, rollback, logs and abuse.
4. Implement server policy/readiness before client claims; preserve legacy history and classify it truthfully. Client UI alone cannot enforce.
5. Stage clients and server compatibility; old clients must receive explicit rejection before Protected send is enabled. No server mode flip may make existing direct pair reuse appear secure.
6. Define monitoring that records policy error categories and versions only, never message plaintext, ciphertext envelopes, keys or tokens.
7. Rollback may pause Protected writes or setup. Never downgrade an active Protected context to Legacy/plaintext; no security labels may be changed to claim success.

No rollout or rollback operation is authorized by this document.

## 8. Source and authoritative references

### Current repository evidence inspected

- `android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/ui/ChatViewModel.kt` (`sendText`, `retrySend`, `performSend`).
- `android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/data/MessagesRepository.kt` (`sendMessage`, `sendAttachment`).
- `android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/data/MessageDecryption.kt` (`AndroidMessageDecryptor`).
- `android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/data/AndroidMessageDeviceKeyRegistrar.kt`.
- `android/core/security/src/main/kotlin/com/kothabarta/core/security/WebE2eeDecryptor.kt`; `AndroidE2eeKeyManager.kt`.
- `android/core/network/src/main/kotlin/com/kothabarta/core/network/messages/MessagesDtos.kt`; `MessagesApi.kt`.
- `android/app/src/main/kotlin/com/kothabarta/app/MessageNotificationPreview.kt`.
- `android/gradle/libs.versions.toml`; `client/package.json`.
- `client/src/utility/crypto.js`; `client/src/pages/message/hooks/useMessageActions.js`; `useEditMessage.jsx`.
- `server/src/models/Conversation.js`; `Message.js`; `User.js`; `server/src/utils/messageSecurity.js`; `utils/ids.js`.
- `server/src/routes/chat.routes.js`; `routes/users.routes.js`; `server.js`; `sockets/call.socket.js`.
- `server/src/utils/contextMessages.js`; `services/adminMessages.service.js`; `services/call.service.js`; story/admin/call routes; `services/push.service.js`.
- Existing source of truth: [Phase 3F feasibility report](phase-3f-feasibility-report.md), [E2EE protocol selection](e2ee-protocol-selection.md), [E2EE protocol decision](e2ee-protocol-decision.md), [MLS Phase 3E report](mls-phase-3e-report.md), [E2EE recovery audit](e2ee-recovery-audit.md).

### Authoritative protocol/library references

- [RFC 9420 — The Messaging Layer Security (MLS) Protocol](https://datatracker.ietf.org/doc/html/rfc9420).
- [RFC 9750 — The Messaging Layer Security Architecture](https://datatracker.ietf.org/doc/html/rfc9750).
- Signal specifications: [X3DH](https://signal.org/docs/specifications/x3dh/), [Double Ratchet](https://signal.org/docs/specifications/doubleratchet/), [Sesame](https://signal.org/docs/specifications/sesame/).
- Official project evidence checked: [OpenMLS README](https://github.com/openmls/openmls/blob/main/README.md), [`signalapp/libsignal` README](https://github.com/signalapp/libsignal/blob/main/README.md), [`signalapp/libsignal` LICENSE](https://github.com/signalapp/libsignal/blob/main/LICENSE).
- The current `libsignal` README/license and OpenMLS README were retrievable during this task. GitHub MCP transport failed for repository file reads; mls-rs current README/license and some upstream details therefore remain unverified. Historical repository reports are labeled as historical, not treated as fresh confirmation.

This document is a design contract proposal, not a cryptographic audit, independent security review, implementation authorization, or certification.
