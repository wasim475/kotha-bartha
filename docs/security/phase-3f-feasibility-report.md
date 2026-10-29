# Phase 3F — Policy Decisions and MLS Interoperability Feasibility

**Checked:** 2026-10-29
**Status:** Policy analysis complete; isolated MLS prototype **BLOCKED** by missing toolchain and unapproved candidate integration.
**Scope:** Read-only source/document review plus this report. No production behavior, API, schema, security mode, or dependency was changed.

## 1. Executive Summary

**USER-STATED PRODUCT DIRECTION (NOT AN IMPLEMENTATION OR PROTOCOL APPROVAL):** New conversations should be E2EE by default; new devices require approval and verification; historical access requires an explicitly approved secure recovery mechanism; unsupported clients must not fall back to plaintext; and existing Legacy conversations should remain readable while message-content mutations are read-only. These are product constraints for evaluation, not proof that the current implementation meets them or authorization to change production behavior.

**RECOMMENDATION FOR THIS DECISION GATE:** Prefer a distinct Protected conversation/security context for an existing Legacy participant pair, surfaced through one familiar per-person Chat experience. Do not silently convert the Legacy conversation. This direction still requires explicit product/security approval and a reviewed protocol/API design before implementation.

**CONFIRMED:** Android’s current outgoing text and retry paths submit plaintext (`SendMessageRequest.body`). The server’s default and missing conversation mode is `legacy`. Current legacy mode accepts plaintext, while current `e2ee` mode is structurally enforced only on a subset of message write paths and supports text-only 1:1 envelopes. Web send, edit, and client-forward paths can fall back to plaintext; group messages are plaintext in current paths.

**CONFIRMED:** The current user-key registration endpoint upserts a public key by a caller-provided device ID. No approval, verification, key transparency, or revocation mechanism was found in the inspected Android/backend paths. That is not equivalent to a trusted device enrollment protocol.

**NEW FINDING — D1/D5 interaction:** Direct conversation creation upserts by participant `pairKey`. If that pair already has a legacy conversation, asking to start a conversation returns the existing record. D5 says that record must become read-only, while D1 disallows silently starting a new plaintext-capable conversation. The product/API must support an explicitly distinct protected conversation or an approved upgrade flow that preserves legacy message classification. The current source does neither.

**NEW FINDING — write coverage:** `chat.routes.js` is not the only source of `Message` records. Story/note context messages, admin messages, and call-history messages are created in service/helper code. Several use the current central message-policy helper, but future legacy read-only enforcement needs route-wide and service-wide coverage. Reactions, unsend/delete-for-me, pinning, membership, read receipts, and conversation metadata are separate mutations and need explicit D5 policy decisions.

The environment is **BLOCKED** for a safe Android↔Web MLS prototype: a cached Gradle 8.12.1 launcher runs, and Java 21/Node 24 are present, but Rust/Cargo, the Android NDK, and WASM tooling are absent. No exact production candidate API, source workspace, or pinned platform integration is available locally. No browser runtime version or Android device was tested. The project wrapper and app build were not run. No dependencies were installed and no network request was made.

## 2. Scope and Explicit Non-Goals

This phase is a planning and bounded-feasibility task, not a production implementation.

- No application source, API contract, database schema, migration, production setting, key record, or conversation was changed.
- No production account, data, socket, key directory, or notification service was accessed.
- No E2EE mode was enabled and no legacy conversation was made read-only.
- No dependencies or toolchains were installed.
- No MLS demo or mock protocol was created; missing prerequisites fail the feasibility gate.
- Attachment and voice sending remain blocked. HTTPS/storage-provider encryption is not E2EE.
- No security certification or cryptographic audit is claimed.

## 3. Initial Git State (Original Phase 3F Work)

**CONFIRMED:** At the beginning of this phase, `git status --short`, `git diff --stat`, `git diff --cached --stat`, and `git ls-files --others --exclude-standard` returned no entries. There were no staged changes, unstaged tracked changes, or untracked files to preserve at that time.

**CONFIRMED:** The report created by the original Phase 3F task was the only expected working-tree addition at that time. The separate finalization task's initial Git state is recorded in section 19.

## 4. Revalidated Android Findings

| Topic | Finding |
|---|---|
| Send/retry | **CONFIRMED:** [ChatViewModel.sendText](../../android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/ui/ChatViewModel.kt#L302) calls `performSend`; [retrySend](../../android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/ui/ChatViewModel.kt#L327) resubmits the failed body; [performSend](../../android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/ui/ChatViewModel.kt#L333) calls the repository. |
| Serialization | **CONFIRMED:** [MessagesRepository.sendMessage](../../android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/data/MessagesRepository.kt#L79) sends `SendMessageRequest(body, replyTo)`. [MessagesDtos.kt](../../android/core/network/src/main/kotlin/com/kothabarta/core/network/messages/MessagesDtos.kt#L120) defines no outgoing encrypted envelope. |
| Conversation state | **CONFIRMED:** [ConversationDto](../../android/core/network/src/main/kotlin/com/kothabarta/core/network/messages/MessagesDtos.kt#L10) has no server security-mode field. Its `encrypted` field is a last-message/content marker, not a conversation policy. |
| Incoming encrypted content | **CONFIRMED:** [AndroidMessageDecryptor](../../android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/data/MessageDecryption.kt#L30) chooses a payload addressed to the local device and attempts legacy decryption. This does not provide outgoing encryption or verify sender identity. |
| Device key lifecycle | **CONFIRMED:** [AndroidMessageDeviceKeyRegistrar](../../android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/data/AndroidMessageDeviceKeyRegistrar.kt#L21) provisions/registers a public key. It is not an approval flow. [AndroidE2eeKeyManager](../../android/core/security/src/main/kotlin/com/kothabarta/core/security/AndroidE2eeKeyManager.kt#L54) does not silently replace a previously provisioned missing key. |
| Replies | **CONFIRMED:** replies are `replyTo` references bundled with message send. The Android reply preview DTO does not include the full envelope for independently decrypting the quoted message. |
| Notifications | **CONFIRMED:** [MessageNotificationPreviewResolver](../../android/app/src/main/kotlin/com/kothabarta/app/MessageNotificationPreview.kt#L52) uses local decryption only when preview privacy allows it and returns generic content after decryption failure. |
| Reactions/deletion | **CONFIRMED:** Android exposes reaction, unsend, and delete-for-me methods in [ChatViewModel](../../android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/ui/ChatViewModel.kt#L360). These are not new message-body sends, but they mutate message/conversation state. |
| Media | **CONFIRMED:** the Android media send path remains blocked and its test asserts no upload occurs ([ChatViewModelTest](../../android/feature/messages/src/test/kotlin/com/kothabarta/feature/messages/ui/ChatViewModelTest.kt#L135)). |
| Platform compatibility | **CONFIRMED:** app `minSdk` is 26. The inspected Keystore ECDH provision path is API 31+; a production crypto design must explicitly address API 26–30 support or set a separately approved platform requirement. |

## 5. Revalidated Web Findings

- **CONFIRMED:** [useMessageActions](../../client/src/pages/message/hooks/useMessageActions.js#L150) attempts direct-message encryption for the known device targets, but uses `{ body: text }` if it cannot produce an encrypted payload.
- **CONFIRMED:** Client forwarding re-encrypts when available and otherwise posts plaintext ([forwardPlaintext](../../client/src/pages/message/hooks/useMessageActions.js#L386)). Forwarding an encrypted source through the server route is rejected; the client must decrypt and create a new message.
- **CONFIRMED:** [useEditMessage](../../client/src/pages/message/hooks/useEditMessage.jsx#L37) uses plaintext when encryption is unavailable.
- **CONFIRMED:** Current device key material is persisted in browser IndexedDB, with a device ID in local storage, as described in [crypto.js](../../client/src/utility/crypto.js#L1). The inspected format does not provide device approval or history recovery.
- **CONFIRMED:** The current Web send path selects no encryption targets for groups. Current group message content is plaintext.
- **CONFIRMED:** Web message actions include reaction, pin/unpin, edit, delete, archive, and forwarding operations ([useMessageActions.js](../../client/src/pages/message/hooks/useMessageActions.js#L300)).
- **UNKNOWN:** No complete offline durable outgoing message queue or universal retry contract was established from the inspected Web paths. Any background or persisted retry mechanism must be inventoried during implementation.
- **UNKNOWN:** No current client UI consistently represents a server-authoritative conversation-level security policy; Android does not model that state, and the legacy Web encryption is opportunistic.

## 6. Revalidated Backend Findings

- **CONFIRMED:** [Conversation.js](../../server/src/models/Conversation.js#L20) defaults `messageSecurityMode` to `legacy`. [messageSecurity.js](../../server/src/utils/messageSecurity.js#L41) treats missing mode as legacy.
- **CONFIRMED:** Clients cannot set the security mode directly ([assertClientCannotChangeMessageSecurityMode](../../server/src/utils/messageSecurity.js#L74)). No approved activation or transition route was identified in the inspected chat router.
- **CONFIRMED:** `assertMessageWriteAllowed` only applies special rules to conversations already marked `e2ee`. It rejects groups and non-text messages and expects a structurally valid multi-device envelope; its own comment states this does not prove cryptographic correctness ([messageSecurity.js](../../server/src/utils/messageSecurity.js#L57)).
- **CONFIRMED:** Direct creation uses a participant `pairKey` upsert ([chat.routes.js](../../server/src/routes/chat.routes.js#L190)); group creation writes participants directly ([chat.routes.js](../../server/src/routes/chat.routes.js#L256)).
- **CONFIRMED:** Current REST message routes and service-level `Message.create` paths are enumerated in section 8.
- **CONFIRMED:** Message history GET updates message statuses to `read`, emits `message:read`, and clears conversation unread state ([chat.routes.js](../../server/src/routes/chat.routes.js#L927)). This is a read-triggered receipt mutation, not a new message body.
- **CONFIRMED:** Search is server-side over plaintext bodies and excludes messages flagged encrypted ([chat.routes.js](../../server/src/routes/chat.routes.js#L1738)).
- **CONFIRMED:** Message push uses generic “New message” text and IDs ([push.service.js](../../server/src/services/push.service.js#L200)).
- **CONFIRMED:** Chat socket events found are server-to-client delivery/update events. No inbound chat socket handler that creates message content was found in the inspected server socket paths. REST and service write paths remain the enforcement boundary.
- **UNKNOWN:** No general idempotency key or atomicity guarantee for message submission was found in the inspected Android DTO/API or chat send route. Do not promise retry deduplication.

## 7. Policy Decision Register

The user explicitly stated D1–D5 as preferred product direction in prior requests; this does not approve any protocol, API, schema, rollout, or production implementation. Recommendations in the table are proposals and remain subject to the approvals listed.

| ID | Preference / decision | Recommendation | Benefit and cost | Dependencies / approval |
|---|---|---|---|---|
| D1 — New conversations | New direct and group conversations are E2EE by default; no plaintext fallback. | Create in a non-sendable setup state; permit send only after protocol and required device setup succeed. | Reduces accidental plaintext, but can block communication during setup, offline directory failure, or unsupported client. | Protocol, device directory completeness, server enforcement, and Android/Web support; product and security approval. |
| D2 — Device trust | New devices require approval and verification. Login alone is insufficient. | Keep authenticated, registered, approved, verified, active-member, and revoked states distinct. | Reduces silent insertion; adds verification friction and approver-compromise risk. | Approval authority, identity binding, key-change history, revocation, transparency decision; security review. |
| D3 — Historical access | New devices receive history only through an approved recovery mechanism. | Default to future-message access only; no automatic history, attachment, or group-history access. | Limits exposure after account takeover; device loss can make history unrecoverable. | Recovery mechanism, consent, audit, revocation, and recovery-abuse review. |
| D4 — Unsupported clients | Block or require upgrade; no plaintext downgrade or automatic legacy thread. | Reject all protected sends/mutations from unsupported versions at the server. | Prevents fallback bypass; can strand old clients and needs version support operations. | Version policy and complete route coverage; product approval. |
| D5 — Legacy read-only | Existing legacy conversations remain distinguishable; readable under authorized rules; future message writes blocked; no relabeling/migration by guessing. | Freeze content-creating operations, preserve historical classification, and keep read operations. Decide separately on other state mutations. | Reduces new plaintext exposure without rewriting old history; limits current UX and affects old clients. | Route inventory, direct-thread uniqueness resolution, action-by-action policy, atomic server enforcement; human approval. |
| D6 — Device selection | Not explicitly selected. | **Do not silently include or omit devices.** Show the verified eligible device set and require explicit policy/selection. Whether every approved device is mandatory is unresolved. | Avoids hidden omissions; increases setup complexity and creates support choices. | Complete directory and user-facing device management; product/security approval. |
| D7 — Legacy continuation for an existing pair | D1/D5 create a collision under current `pairKey` uniqueness. | Consider a new, distinct protected conversation while retaining the legacy thread read-only; do not copy/reclassify history. | Allows future secure messaging without rewriting legacy content; creates multiple threads and needs new server identity semantics. | Explicit product approval and API/data model proposal. No automatic separate legacy conversation is authorized. |
| D8 — Media/calls | Media and voice sending remain blocked until separately approved. | Keep attachment/voice sends disabled. Treat call signaling separately from call-history message records. | Avoids plaintext media; possible call summary records in read-only conversations require a policy. | Approved encrypted media protocol and separate call-record policy. |

### Decisions requiring explicit approval

1. Whether every approved active device must be included, or a user-selected subset is allowed.
2. How to handle offline but approved devices and stale/incomplete device directories.
3. Whether existing direct pairs get a distinct new protected conversation, an explicit setup/upgrade flow, or another approved model.
4. Whether D5 blocks reactions, pins, unsend, delete-for-me, group membership, and shared metadata changes.
5. Whether call-history entries, admin messages, story/note context messages, and report flows are allowed to create/update records in read-only legacy threads.
6. Whether a legacy conversation transition can ever be reversed. Proposed answer: never by automatic rollback to plaintext writes.
7. Recovery approach and whether any historical recovery is offered.

## 8. Legacy Read-Only Route Inventory and Migration Proposal

### 8.1 What “read-only” means

**PROPOSED:** Apply D5 at the server as an authoritative policy, not as a disabled composer. Do not create new message bodies or modify existing message content in a legacy conversation. Preserve authorized history reads and display the conversation as **Legacy — not end-to-end encrypted**. Do not use a “protected” badge for legacy content.

Some operations do not create message content but still mutate server state. D5 does not unambiguously decide all of them. The policy options and recommended treatment below must be approved before implementation.

### 8.2 Message and conversation routes

| Operation / current route or path | Current behavior confirmed in source | D5 proposal and bypass risk |
|---|---|---|
| Direct create `POST /conversations` | Pair-key upsert may return an existing record. | New pair: setup-required until E2EE succeeds. Existing legacy pair: do not silently create/use plaintext; resolve D7 collision explicitly. |
| Group create `POST /conversations/group` | Creates participants without protocol setup. | Create non-sendable setup state; do not fall back to legacy. |
| Text send `POST /conversations/:id/messages` | Creates a message and reply reference; legacy accepts plaintext. | Block on legacy. A reply is part of the new message and is blocked with it. Android retry and repeated HTTP requests hit the same route. |
| Web direct-send fallback | Sends `{body}` when encryption/key targeting fails. | Must be blocked at the same server policy boundary; preserve draft and show explicit failure. |
| Android retry `retrySend` | Resubmits failed plaintext body. | Must remain rejected for legacy; never convert retry failure into a plaintext fallback or replay it after policy changes. |
| Web forwarding via normal send | Client sends decrypted body to target thread. | Target legacy is read-only and must reject creation. Source history remains readable. A protected target requires an approved E2EE envelope. |
| Server forward `POST /conversations/:id/messages/:messageId/forward` | Reads source and creates target message(s); calls policy helper per target. | Block if target is legacy. Source may be read if authorized. Multi-target operations must fail/return per-target results without partial success ambiguity. |
| Edit `PATCH /conversations/:id/messages/:messageId` | Replaces body/envelope; helper currently enforces only E2EE mode. | Block edits in legacy. This is content mutation, not a harmless metadata action. |
| Attachment/voice `POST /conversations/:id/attachments` | Uploads to provider and creates a plaintext attachment message in legacy; helper rejects attachments only in current E2EE mode. | Block before upload and again before message creation. Android UI block is not sufficient. Prevent orphaned upload on a policy race. |
| Reaction `PUT /conversations/:id/messages/:messageId/reaction` | Adds, changes, or removes reaction metadata and broadcasts `message:reaction`; no E2EE/read-only helper call. | Not a message body, but mutates a message. Recommended block for strict immutable history; product owner may separately allow reactions as non-content metadata. |
| Unsend/delete-for-everyone `DELETE /conversations/:id/messages/:messageId` | Soft-deletes sender’s message within time window; deletes unattached provider asset when no longer referenced; emits delete event. | A privacy/retention mutation that removes history. Decide separately. Recommended retain the existing narrowly authorized deletion right if D5 only freezes new writes, but it must not be used to rewrite content or bypass audit/retention rules. |
| Delete-for-me `POST /conversations/:id/messages/:messageId/delete-for-me` | Adds caller to `deletedFor`; hides only for that participant. | Recommended to allow as personal visibility control; it does not change others’ message content. Confirm policy and retention semantics. |
| Pin/unpin `POST|DELETE /conversations/:id/messages/:messageId/pin` | Changes shared group `pinnedMessages`; broadcasts conversation update. | Not new message content, but a shared mutation of a legacy conversation. Recommended block unless product expressly defines pins as allowed metadata. |
| History `GET /conversations/:id/messages` | Returns authorized history and marks incoming messages read, updates unread counts, emits `message:read`. | Continue history reads. Preserve read receipts as transport/interaction metadata unless D5 is intended to prohibit every server write; that broader rule requires explicit decision. |
| Notification preview `GET .../notification-preview` | Returns participant-authorized message data for local preview. | Continue only under current authorization and notification privacy rules; keep push generic. |
| Message search `GET .../messages/search` | Searches plaintext legacy messages and excludes encrypted ones. | Continue for authorized legacy history; visibly scope results as legacy. No search endpoint may create/modify messages. |
| Group member add `POST /conversations/:id/members` | Adds participants to existing group; new participant can access group history returned by the history endpoint. | Block additions to legacy read-only groups absent explicit history policy. This is a historical confidentiality issue, not just a metadata change. |
| Group member remove `DELETE /conversations/:id/members/:userId` | Removes another member (admin) or self; affects future authorization. | Preserve authorized removal/self-leave as a revocation action, but it cannot erase history already received. Future E2EE membership removal must be protocol-synchronized. |
| Group name/avatar, theme, nickname, like-emoji | Updates shared or per-user conversation metadata; some uploads group avatar and emits metadata event. | Not message body writes. Decide whether user preferences remain available. Treat group avatar upload separately from E2EE message attachment restriction. |
| Archive/unarchive/hide conversation | Changes per-user list visibility; does not delete message history for other participant. | Recommended preserve as user-scoped actions. |
| Report | Current `/reports` route targets user/post/comment/reply, not messages (see [reports.routes.js](../../server/src/routes/reports.routes.js#L13)). | Do not suppress safety reporting because a thread is read-only. A message-report capability is not confirmed here and needs separate review. |
| Calls and call-history | Call signaling uses separate call routes. `recordCallMessage` creates a `type: call` Message and calls `assertMessageWriteAllowed`; current E2EE mode drops the call record. | Do not conflate call signaling with voice-note sending. Decide whether call summaries may be appended to legacy read-only history; no production call behavior change is authorized. |
| Story/note context messages | `sendContextMessage` creates a text `Message` and emits `message:new`; used by notes/stories routes. It calls the central helper. | Apply legacy read-only policy to this alternate create path too; it must not become a backdoor for new text in legacy threads. |
| Admin message service | Creates an admin-authored conversation `Message`, calls central helper, emits `message:new`, and sends generic push. | Define a support/escalation path that does not silently bypass D5; admin-originated messages are still message writes. |
| Socket events | `message:new`, `message:updated`, `message:deleted`, `message:reaction`, `conversation:updated`, and `message:read` are emitted by server paths. No inbound chat-content creation event handler was found. | Socket broadcast is not a write authorization mechanism. Authorize the underlying REST/service mutation before any event is emitted. |

**Additional write-like concern:** Existing admin and call service helpers catch or translate policy failures in their own way. Any future central policy change must verify these handlers return explicit outcomes rather than silently dropping a user-visible operation.

### 8.3 Pending requests, stale clients, and enforcement

- **PROPOSED:** Reject stale writes at the server with a stable conflict/policy error. Old Android/Web clients may still issue their current calls; disabling a composer is not enforcement.
- **PROPOSED:** Do not replay queued writes if a thread is now read-only. Android’s current retry is an in-memory failed-message retry. A complete persisted/background queue was not established; inventory it before rollout.
- **UNKNOWN:** Current message create does not expose a documented idempotency key in Android’s request DTO. Duplicate submission behavior is not established. Any future idempotency must be scoped to authenticated sender, conversation, operation, and request payload.
- **PROPOSED:** Make policy and membership checks atomic with message creation or use a policy version/CAS so a write cannot pass a stale `legacy` check while the conversation is transitioning.
- **PROPOSED:** Recheck policy after upload and before attachment message creation; otherwise a state change between preflight and commit can create an orphan or bypass.
- **PROPOSED:** REST response and socket payloads must agree on final authorization outcome. Never emit `message:new` before a durable, authorized creation succeeds.

### 8.4 Data, access, and migration

- Identify legacy conversations from authoritative server mode (`legacy`, including missing historical field under current helper behavior), not by guessing from message body or encrypted flags.
- Preserve each historical message’s stored `encrypted`/envelope classification and original content. Never relabel plaintext as encrypted or migrate by inferring protocol from shape.
- Continue authorized history, search, notification resolution, and account deletion/retention semantics unless separately changed by approved policy.
- Make the legacy label explicit on conversation header/list and message details: “Legacy messaging — not end-to-end encrypted.” Do not imply that individual encrypted-looking messages upgrade the whole conversation.
- Existing accounts may have plaintext legacy bodies and an opportunistic mixture of plaintext and legacy-encrypted messages. Keep per-message classification and conversation policy distinct.
- Any export must preserve truthful security labels and not claim encrypted history. Account deletion and retention policies are not changed in Phase 3F.
- Group member additions are a history-access grant under current history behavior; block or require an explicit reviewed history policy.
- Notification push content is generic today; preserve this. Search is server plaintext search for legacy records, so protected-content guarantees cannot be retroactively claimed for those records.

### 8.5 Rollout and rollback limits

1. **Preparation:** inventory every route/service write, clients, pending work, and user-facing action.
2. **Compatibility:** ship clients that understand `legacy_read_only` and protected setup states before server enforcement, if a safe phased strategy is possible. The server must still be authoritative.
3. **Server policy:** activate only through an audited, explicitly authorized migration; no writes to real conversation mode are authorized in this phase.
4. **Monitoring:** record non-content policy rejection categories and client versions only; do not log message bodies, keys, or envelopes.
5. **Communication:** warn users that old conversations become read-only and offer a deliberate protected continuation if approved.
6. **Rollback:** do not roll an active E2EE conversation back to plaintext. If a rollout fails, pause writes or disable new setup; never silently restore plaintext sends. A legacy read-only change should not be reversed without explicit product/security approval and user communication.

## 9. MLS Candidate Evidence and Feasibility Gate

### 9.1 Candidate evidence from repository documents

The repository’s [protocol decision](e2ee-protocol-decision.md) and [protocol selection](e2ee-protocol-selection.md) recommend evaluating MLS (RFC 9420) but do not approve production use. They require Android/Web interoperability, persistence/device lifecycle work, and security review.

| Candidate | Existing evidence | Limitations / status |
|---|---|---|
| `mls-rs` | Existing Phase 3E report records candidate baseline commit `8f1b43f447a792ff9307f1c2c7f54da63914870e`, `mls-rs` 0.56.0, RustCrypto 0.22.1, and UniFFI 0.13.0; engine license is documented as Apache-2.0 OR MIT. | Candidate baseline only, not selected. No local crate or prototype dependency. Android binding/provider/suite, durable state, Android/Web interop, and full third-party security audit remain unverified. |
| `mls-rs-uniffi` | Repository documents a Kotlin/UniFFI wrapper candidate. | Published crate version differs from the current source baseline; documented wrapper has OpenSSL/provider and in-memory default state limitations. Not a drop-in Android SDK. |
| `mls-rs` WASM/custom JS binding | WASM build direction appears in existing reports. | Requires custom JS adapter; WebCrypto provider marked experimental/unsupported in reviewed evidence. Buildability does not prove a supported browser API or interop. |
| OpenMLS | Existing protocol selection docs describe it as a credible RFC 9420 alternative. | Android/WASM support and exact bindings remain unverified for this product. |
| `ts-mls` | Prototype environment report records an active TypeScript alternative and its license. | Separate engine on Web requires exact suite/credential compatibility with Android; no Kotha-Barta integration or interop evidence. |

No candidate is approved. Library statements above are repository-document evidence, not fresh upstream verification or independent security review.

### 9.2 Gate 1 — Environment readiness

| Item | Current observation | Status |
|---|---|---|
| OS | Windows 11 x64, shown by cached Gradle version output. | Available |
| Java | OpenJDK 21.0.4; `java -version` returned version output. | Available |
| Gradle | `gradle` is not on PATH. Cached Gradle 8.12.1 `gradle.bat --version` succeeded. Project wrapper not run in this phase; wrapper properties have `distributionUrl` and validation enabled but no `distributionSha256Sum`. | Runtime available; project configuration/build unverified |
| Android SDK | `adb.exe` and emulator executable exist under the SDK path; `adb` is not on PATH. No AVD/device test performed. | Partially available |
| Android NDK | No SDK NDK directory found. | Missing |
| Rust/Cargo/rustup | Commands not found; known `%USERPROFILE%\.cargo\bin` executables absent. | Missing |
| WASM tooling | `wasm-pack` and `wasm-bindgen` commands and known Cargo-bin executables absent. | Missing |
| Node/npm | Node v24.16.0 and npm command available. | Available |
| Browser | Chrome and Edge executables exist at standard paths; versions and runtime behavior were not queried. | Present, unverified |
| Network/package availability | No network request or package fetch made. Earlier [MLS environment report](mls-prototype-environment.md) documented wrapper download restrictions. | Not tested this phase |
| Reproducibility without changes | Rust, NDK, WASM tooling, a pinned prototype workspace, and verified platform dependencies are absent. | Not ready |

**Gate result: BLOCKED.** The missing Rust/native/WASM toolchains and absent candidate binding make a reproducible cross-platform prototype impossible without installing tools and selecting an integration—both outside this authorization. Do not create a mock demonstration.

### 9.3 Gate 2 — Protocol/library evidence

**BLOCKED:** Local documentation identifies candidates but does not establish a production-ready Android/Web integration, exact supported versions for this app, persisted state compatibility, or reproducible test vectors for the selected versions. No package is available locally for isolated use. Do not fetch dependencies or assume a candidate’s API from package name or upstream claims.

### 9.4 Gate 3 — Prototype matrix

No prototype was created; all tests are **BLOCKED / NOT RUN**.

| Test ID | Goal | Preconditions | Actual result | Evidence / limitation |
|---|---|---|---|---|
| P1 | Android participant creates a group | Pinned MLS binding and Android runtime | BLOCKED | No Rust/NDK binding or Android test device/AVD execution. |
| P2 | Web participant joins supported welcome flow | Pinned browser binding and browser version | BLOCKED | No WASM toolchain or supported local API evidence. |
| P3 | Bidirectional synthetic encrypted message | P1/P2 | BLOCKED | No protocol client runtime. |
| P4 | Reject malformed/unsupported message | P1/P2 and approved envelope parser | BLOCKED | No parser/prototype; no synthetic malformed case executed. |
| P5 | Persist state, restart/reload, resume | Durable per-platform stores | BLOCKED | Persistence adapters do not exist. |
| P6 | Offline delivery/catch-up | Isolated relay and queued protocol events | BLOCKED | No relay/protocol runtime. |
| P7 | Device addition/removal | Approved device credentials and membership flow | BLOCKED | Device trust policy and implementation unselected. |
| P8 | Group membership changes | Shared compatible protocol state | BLOCKED | No protocol runtime. |
| P9 | Concurrent/conflicting updates | Multi-client test harness | BLOCKED | No test harness. |
| P10 | Unknown protocol version | Versioned envelope/parser | BLOCKED | No selected envelope or parser. |
| P11 | Replay handling | Protocol-defined replay rules | BLOCKED | No client protocol state. |
| P12 | Missing/corrupted state recovery | Recovery policy and persistence | BLOCKED | Recovery unselected; no storage harness. |

A future pass would prove only the tested interoperability and lifecycle behaviors; it would not certify protocol security.

## 10. Threat Model and Security Review Preparation

| Threat | Asset / attack path | Existing mitigation confirmed | Proposed mitigation | Residual risk / verification |
|---|---|---|---|---|
| Malicious server | Plaintext Android and Web fallback is available to backend; server can alter directory. | TLS/API authentication existence is outside cryptographic E2EE guarantee; generic message push is confirmed. | E2EE protocol with authenticated device credentials; opaque relay; client verification; independent review. | Metadata and availability remain exposed; test server/key-directory compromise model. |
| Account takeover | Attacker logs in and registers a public key under their device ID. | Account auth protects route, but no device approval was found. | Separate device approval from account login; notify/verify; rate-limit and audit. | Compromised existing trusted approver can still authorize attacker. |
| Compromised trusted device | Attacker approves another device or reads local plaintext/state. | No mitigation against endpoint compromise confirmed. | Device revocation, user alerts, least privilege, secure OS storage, incident flow. | Active endpoint can access decrypted content; red-team review needed. |
| Unauthorized device enrollment | Self-assigned device ID and public key registration. | Current endpoint is authenticated and upserts by deviceId. | Enrollment challenge, approval proof, identity binding, revocation and key history. | Service/account recovery weaknesses can subvert enrollment. |
| Public-key substitution / directory equivocation | Server serves different keys to different participants or replaces same device key. | No signed transparency mechanism found. | Auditable append-only directory/transparency with independent witnesses plus user verification. | Colluding witnesses or compromised clients; verify consistency proofs and alerts. |
| Replay / reorder | Reuse or reordering of valid envelope without message context. | Legacy AES-GCM integrity only; no application AAD/context or replay counter confirmed. | Use reviewed protocol state, message context, authenticated routing metadata; define transport idempotency. | Server can delay/drop/reorder; test stale epoch, duplicates, replay. |
| Device revocation race | Message accepted against stale device membership while removal happens. | No atomic protocol membership enforcement confirmed. | Serialize membership and message acceptance with versioned/transactional state. | Distributed DB races and offline clients; concurrency tests required. |
| Group membership race | Concurrent add/remove or message sends have inconsistent membership. | Existing server membership list updates; no MLS epoch logic. | Protocol commit ordering and server state version checks. | Offline members may remain stale; test concurrent transitions. |
| Lost protocol state | Device loses key/group state and silently reprovisions. | Android key manager refuses silent replacement after provisioned key loss. | Recovery-required state; no silent identity replacement; reviewed recovery. | History may be permanently unavailable; simulate backup/restore and corruption. |
| Malicious/outdated client | Client bypasses UI and submits plaintext to legacy/protected routes. | Current E2EE mode helper rejects some plaintext paths; legacy accepts. | Central server policy on every endpoint/service and supported-version gating. | Any unreviewed alternate route bypasses policy; route inventory and tests. |
| Notification/telemetry leakage | Plaintext in push, preview, logs, analytics. | Generic message push confirmed; Android local preview is privacy-gated. | Keep generic push, local-only decrypt, content-free telemetry/logs. | OS notification surface and app screenshots remain endpoint exposure. |
| Recovery abuse | Attacker uses reset or backup to gain past keys. | No recovery implementation confirmed. | No history by default; trusted-device transfer or reviewed encrypted backup only. | Backup secret loss, online guessing, compromised approver; abuse/security review. |
| Serialization mismatch | Android/Web parse different protocol envelope or state transitions. | Legacy DTO shapes differ; no selected MLS contract. | Version-pinned canonical encoding, cross-platform vectors and compatibility tests. | Runtime/provider bugs remain; fuzz parsers and test exact binaries. |
| Readiness denial of service | Strict policy blocks sends when devices are offline/stale/unsupported. | Current legacy fallback avoids this by sacrificing E2EE. | Explicit device set, clear retry/upgrade flows, bounded service health, never plaintext fallback. | Availability loss is intentional security cost; product approval required. |

## 11. Security Review Checklist

Before any production implementation:

- Confirm protocol/version, library, provider, cipher suite, credentials, encoding, and supported-platform matrix.
- Independently review device identity binding, approval, key change detection, directory trust, revocation, and account recovery.
- Prove message/context authentication, replay/reorder handling, and group membership transitions for the exact library builds.
- Review Android Keystore and API 26–30 behavior; review browser storage, XSS, multi-tab concurrency, and account-switch isolation.
- Review server policy enforcement across every REST route and service-level message creation path, including stale clients and races.
- Decide D5 sub-operations: reactions, deletes, pins, read receipts, membership, metadata, calls, context messages, and admin messages.
- Decide direct-pair coexistence after D5 and define user-visible transitions without reclassifying history.
- Approve historical recovery and its abuse/loss model before advertising history availability.
- Keep media disabled until encrypted binary protocol and upload/download design receive separate approval.
- Require reproducible CI interop/lifecycle tests and resolution or documented acceptance of independent review findings.

## 12. Unresolved Decisions

1. **Device set:** every approved device vs explicit subset; offline devices and directory completeness.
2. **Identity verification:** trusted-device approval, QR/safety number, out-of-band verification, transparency, or combined approach.
3. **All-trusted-device loss:** whether future messaging can resume under a new identity and whether any history recovery is allowed.
4. **Recovery scope:** text, attachments, group history, consent, revocation, and account-takeover treatment.
5. **D1/D5 pair conflict:** distinct protected continuation versus explicit upgrade of a legacy conversation without altering old messages.
6. **Legacy mutations:** reactions, pins, unsend, delete-for-me, read receipts, metadata, member removal, calls, context messages, and admin messages.
7. **Group policy:** invite acceptance, offline membership, concurrent commits, removal timing, and history access.
8. **Protocol candidate:** exact binding/provider/suite and durable Android/Web storage remain unverified.
9. **Compatibility:** supported client versions, upgrade blocking, user support, and safe rollback procedure.
10. **Operational evidence:** logs, proxy/APM, analytics, crash reports, retention, and audit controls were not comprehensively inspected.

## 13. Recommended Next Phase

**Recommended next step: Phase 3F follow-up — human policy resolution and authorized isolated toolchain preparation.** Do not begin production Phase 3G.

Prerequisites:

1. Product/security owners explicitly resolve D6–D8, especially legacy mutations and existing direct-pair behavior.
2. Authorize any required toolchain setup separately; do not reuse production modules or credentials.
3. Select an immutable candidate/library/provider/suite only after reviewing existing evidence and license/security status.
4. Establish a disposable, offline/loopback-only prototype workspace and test evidence format.
5. Demonstrate Android↔Web setup, bidirectional messaging, state persistence/restart, offline handling, device add/remove, group changes, malformed/unknown inputs, replay, and state loss with synthetic identities only.
6. Obtain independent protocol/application security review before a separate production implementation proposal.

## 14. Files and Documents Inspected

### Source inspected

- Android: `ChatViewModel.kt`, `MessagesRepository.kt`, `MessagesDtos.kt`, `MessagesApi.kt`, `MessageDecryption.kt`, `AndroidMessageDeviceKeyRegistrar.kt`, `AndroidE2eeKeyManager.kt`, `WebE2eeDecryptor.kt`, `MessageBubble.kt`, `MessageNotificationPreview.kt`, messaging unit tests, Gradle wrapper/version catalog/app configuration.
- Web: `useMessageActions.js`, `useEditMessage.jsx`, `crypto.js`, `useE2EDecryption.js`, message realtime/search hooks.
- Backend: `Conversation.js`, `User.js`, `messageSecurity.js`, `chat.routes.js`, `users.routes.js`, `push.service.js`, `reports.routes.js`, `contextMessages.js`, `adminMessages.service.js`, `call.service.js`, call routes, notes/story call sites.

### Security documents found

- [e2ee-protocol-decision.md](e2ee-protocol-decision.md)
- [e2ee-protocol-selection.md](e2ee-protocol-selection.md)
- [e2ee-recovery-audit.md](e2ee-recovery-audit.md)
- [android-e2ee-implementation-plan.md](android-e2ee-implementation-plan.md)
- [android-e2ee-attachment-protocol-proposal.md](android-e2ee-attachment-protocol-proposal.md)
- [mls-feasibility-report.md](mls-feasibility-report.md)
- [mls-phase-3d-report.md](mls-phase-3d-report.md)
- [mls-phase-3e-report.md](mls-phase-3e-report.md)
- [mls-prototype-environment.md](mls-prototype-environment.md)

**NOT FOUND:** A separately named Phase 3C security audit or Phase 3D remediation roadmap was not present in the inspected `docs/security` list. Earlier findings were rechecked against current source where possible; no missing report was invented.

## 15. Commands Executed and Results

| Command/check | Result |
|---|---|
| `git status --short`; `git diff --stat`; `git diff --cached --stat`; `git ls-files --others --exclude-standard` | **PASS, initial state clean.** |
| `Get-Command` checks for Java, Gradle, Cargo/Rust, WASM, Node/npm, adb/emulator | Java/Node/npm found; Gradle/Rust/Cargo/WASM/adb/emulator not on PATH. |
| `java -version`; `node --version` | Java 21.0.4 and Node v24.16.0 reported. |
| Cached Gradle 8.12.1 `gradle.bat --version` | **PASS, version/runtime only.** Gradle 8.12.1 started on JDK 21.0.4 / Windows 11 x64. No project configuration or build was run. |
| Read-only checks of `%USERPROFILE%\.cargo\bin`, SDK NDK, cached Gradle launcher, SDK `adb`/emulator, Chrome/Edge paths | Rust/WASM executables and NDK absent; cached Gradle launcher, Android SDK tools, Chrome and Edge executables present. Browser versions/device availability not tested. |
| Source/document searches and bounded file reads | Completed; no user/production data accessed. |
| MLS prototype, build, unit tests, lint, device/emulator tests | **Not run.** Prototype gate blocked; no application changes requiring these tests. |
| Network fetch/dependency installation | **Not run.** |
| `git diff --check` | **PASS** for tracked changes (none existed). Because Git does not include an untracked report in that check, `git diff --no-index --check -- NUL docs\security\phase-3f-feasibility-report.md` and a PowerShell trailing-whitespace scan were also run; neither reported whitespace errors. |

## 16. Tests, Build, and Limitations

- **Prototype:** not executed; no test passed, failed, or produced protocol evidence.
- **Android build/lint/unit tests:** not run. Gradle launcher version is verified only; app configuration, dependency resolution, compilation, lint, and tests are unverified.
- **Web/server tests:** not run; no source changes and no test needed for this report-only phase.
- **Device QA:** not performed. No AVD/device command was executed.
- **Network/package availability:** not tested by network request. No package was downloaded.
- **Security review:** no independent review or cryptographic certification completed.
- **Evidence:** this report records repository sources and tool presence only. No prototype logs or interoperability artifacts exist.

## 17. Final Git Status and Exact Modifications

- **Created:** `docs/security/phase-3f-feasibility-report.md`
- **Modified:** none.
- **Production source/API/schema/dependencies:** unchanged.
- **Final status expected:** one untracked report file; no staged or pre-existing changes were present at phase start.
- **Whitespace validation:** tracked `git diff --check` passed; the untracked report was separately checked with `git diff --no-index --check` against `NUL` and a trailing-whitespace scan. No errors reported.

## 18. Phase 3F Result

**PARTIALLY COMPLETE.** Policy analysis, source revalidation, route inventory, and threat-model preparation are documented. The MLS interoperability feasibility prototype is **BLOCKED**, not passed: required Rust/Cargo, NDK, and WASM tooling and a pinned candidate integration are absent. No evidence supports Android↔Web MLS compatibility at this time.

Highest-priority risks:

1. Android sends plaintext; Web also has plaintext fallback and plaintext group paths.
2. Existing public-key registration is not an approval/verification/revocation protocol.
3. Current legacy write routes and service-level message creation do not implement D5 read-only policy.
4. Direct-conversation pair-key upsert conflicts with keeping existing legacy history read-only while making new conversations E2EE by default.
5. Recovery, group membership epochs, platform persistence, and cross-platform interoperability remain unresolved.

**Stop here.** No Phase 3G, production implementation, legacy migration, protocol integration, or media work has started. Explicit authorization is required before any implementation phase.

## 19. Phase 3F Finalization — Security Architecture Decision Gate

### 19.1 Decision status and executive recommendation

This section finalizes a **recommended architecture direction for evaluation**, not an approved implementation contract.

| Category | Status |
|---|---|
| Existing user-stated product direction | Preserve Legacy history; keep Legacy readable but read-only for message-content mutations; do not silently convert Legacy to E2EE; prefer E2EE by default for new conversations; no plaintext fallback/downgrade; block unsupported clients from Protected messaging; require approval and verification for new devices; provide history to new devices only through explicitly approved secure recovery. |
| Recommended architecture awaiting approval | Architecture A: distinct Protected conversation/security context plus one familiar per-person Chat experience. Keep Legacy history separately labeled/read-only and navigate between Legacy history and Protected messages without falsely presenting them as one verified, ordered E2EE transcript. |
| Protocol and implementation questions | Protocol/library/suite, device credential and approval ceremony, key directory, recovery, authorization semantics, exact envelopes, group epochs, server enforcement, platform support, and interop remain unselected or unverified. |
| Verified current behavior | Direct conversations use a unique participant-pair `pairKey` find-or-create; new records default to `legacy`; current Android send DTO is plaintext; current server E2EE validation is structural and text-only 1:1, and does not prove cryptographic validity. |

**Recommendation:** Choose A over B for design work. It avoids relabeling historical messages, contains security policy per context, and permits Legacy read-only enforcement without treating a security-mode field flip as a cryptographic transition. Retain one familiar Chat entry point by grouping the person's Legacy and Protected contexts in the UI, with a clear context switch and labels. Do not interleave both message streams into a single apparently linear transcript unless a separately approved product design defines provenance, ordering, unread and receipt semantics.

This choice does not make implementation safe by itself. A distinct Protected context needs server-side identity/uniqueness support; the current unique `pairKey` permits only one direct conversation for a pair. A shared UI, pair identity, conversation ID, server status, or TLS connection is not E2EE proof.

### 19.2 Architecture comparison

| Concern | A. Distinct Protected context, unified Chat UI | B. In-place Legacy-to-E2EE transition |
|---|---|---|
| Conversation identity / pair uniqueness | Requires a Protected-context identity distinct from the existing direct `pairKey`; current `pairKey` unique index and `/conversations` upsert reuse the Legacy record. Add an explicit server identity/unique constraint for the protected context and idempotent create-or-get behavior; do not invent client-side duplicates. | Reuses the existing record and avoids a second thread, but current conversation-level `messageSecurityMode` changes the policy for the whole record; it does not represent a per-message transition boundary. |
| Duplicate prevention / concurrent setup | Unique server-side Protected identity plus an idempotent create operation must make concurrent requests converge to one Protected context. Client single-flight is only UX protection, not authority. | Requires an atomic, versioned transition state and idempotent acknowledgments; two participants/devices racing setup must not create incompatible epochs or expose a plaintext window. |
| Ordering / pagination | Keep per-context ordering and cursors authoritative. The UI can navigate between Legacy history and Protected messages; if the product later aggregates previews, sort by server activity and preserve the source context. Do not synthesize a total message order across records. | One existing sequence simplifies a single history endpoint, but needs a durable transition boundary, stable pagination across old/new formats, and handling of late legacy writes. |
| Unread counts / read receipts | Preserve server unread counts and read receipts per conversation/context. If a person-level aggregate is displayed, it must be derived from both contexts without marking the other context read or changing receipt semantics. Current fields are keyed per conversation. | Could retain current counters, but transition races and existing statuses need a defined cutover. History GET currently marks read and emits `message:read`; old clients could trigger misleading receipts unless all access paths become transition-aware. |
| Replies / forwarding | Reply references remain within their source context by default. Cross-context quoting/forwarding requires an explicit user action, provenance label and destination-context encryption; server forwarding must not copy plaintext into Protected. | Replies can cross the boundary in one record, but quoted Legacy content may be mistaken for protected content; envelope and preview behavior need per-message provenance. |
| Editing / deletion | Legacy content remains unchanged. Protected edits/deletes are protocol operations whose authorization and recipient synchronization require a selected protocol. | Legacy immutability and protected edits must coexist in one record; every route/service must enforce message-era policy, not only conversation mode. |
| Search / notification previews | Search is context-aware: Legacy server search may see plaintext; Protected search is client-local over decrypted content only. Keep push generic and preview decryption local and privacy-gated. | Existing server search could leak or omit different eras; query filters and notifications must classify each message and never fall back to plaintext previews on decrypt failure. |
| Device sync / recovery / revocation | Protected membership/device state is separate from Legacy history. New devices see future Protected messages only unless an approved recovery mechanism grants history; revocation blocks future access but cannot retract plaintext already seen. | The transition must define which devices acknowledge, receive keys, and gain access to old vs new history. Current device registration is not an approval/revocation protocol. |
| Groups | Distinct group Protected contexts need their own participant membership and cryptographic epoch state; existing Legacy membership must not automatically grant Protected access or history. Current E2EE helper rejects group messages. | Group membership changes need atomic cryptographic commits and an unambiguous point at which added/removed devices lose/gain access. Current group routes mutate participant lists without MLS epoch semantics. |
| REST / Socket.IO | REST creates and authorizes each context; socket events must carry the authoritative context ID and provenance. Reconnect/history fetch must use the same policy. The inspected socket paths distribute server-created events; no inbound chat socket message-writer was found. | REST, service, socket and reconnect paths must all observe the same transition version. An event emitted before durable authorized creation or a stale socket update could violate the boundary. |
| Legacy immutability | Strongest separation: Legacy context remains Legacy/read-only; Protected context contains only messages created under the approved protected protocol. | Possible only with explicit immutable per-message security-era classification and atomic policy enforcement; simply changing `messageSecurityMode` is insufficient and risks reclassification or mutation. |
| Overall assessment | **Recommended for evaluation.** Better separation of policy and provenance; requires a minimum backend identity/API change and UI grouping/navigation. | **Not recommended on current evidence.** Fewer visible threads, but substantially more migration, race, compatibility and provenance risk; no current transition protocol or enforcement exists. |

### 19.3 Conversation identity and security-state proposal

**Identity proposal (requires API/schema review):**

1. Keep the existing Legacy conversation ID, `pairKey`, message records, and historical classifications unchanged.
2. Introduce a server-owned Protected context identity distinct from Legacy. The uniqueness key should identify the canonical participant set **and security context**, not collide with the Legacy pair key. For direct conversations, create-or-get must be protected by a database uniqueness constraint and idempotent server semantics; repeated taps, retries, concurrent devices and duplicate requests must return the same context.
3. Do not let clients select or mutate security mode. Creation must start in a non-sendable setup state; the server activates Protected sending only after the approved protocol, eligible device set, and required acknowledgments are validated.
4. Group the two contexts in the person's Chat UI, but label Legacy and Protected distinctly. Prefer explicit context navigation over a merged message timeline. Keep message IDs, reply targets, pagination cursors, unread counts, receipts and socket events scoped to the actual context.
5. A Protected context must be bound to the exact authorized participant/device state. For group contexts, membership changes and cryptographic epochs require protocol-defined commit/acknowledgment behavior. No legacy participant list or server-maintained participant field alone proves key possession.

**Proposed state model (names illustrative, not API values):**

`legacy_read_only` (existing history only) → `protected_setup` (not sendable) → `protected_active` (sendable only with a valid protocol state) → `protected_suspended` (no sends while membership/device/policy state is unresolved) → `protected_closed` (no further writes; retained history remains distinctly labeled).

- Legacy remains a separate context and never transitions into `protected_active`.
- A failed, incomplete, stale or unsupported setup stays non-sendable; no plaintext fallback or automatic Legacy send.
- Device/member changes are protocol state transitions, not ordinary metadata edits. New additions must not gain prior history without approved recovery; removals must stop future access at a protocol-defined boundary.
- A server status is an authorization signal only. Clients must verify protocol messages/keys/state; server acceptance cannot certify encryption or sender identity.
- Existing `messageSecurityMode` is not this proposed lifecycle model: current E2EE helper does structural envelope checks only, and the current application has no verified activation flow.

### 19.4 Recommended Legacy operation policy matrix

The matrix is a proposal consistent with the user-stated requirement that Legacy remain readable and read-only for message-content mutations. It is not current enforced behavior. Any adoption requires route/service-wide implementation and explicit approval for operations marked unresolved.

| Operation | Recommended Legacy behavior | Classification / approval state |
|---|---|---|
| Sending and retrying text | Reject new writes. Disable the composer with a clear Legacy/read-only explanation. Never retry a queued or failed write into Legacy after a policy change; surface a conflict and require an explicit user choice to use Protected messaging. | Content creation; follows stated direction. Server enforcement and pending-work behavior need approval and rollout plan. |
| Replying | No new reply message in Legacy. A reply is new content even though it references an old message. Replying from Protected to Legacy content must be a deliberate cross-context action, encrypted as a new Protected message and visibly marked as a quote from Legacy; default to disallow until cross-context provenance policy is approved. | Content creation; cross-context quote policy unresolved. |
| Editing | Reject edits to Legacy message content from all clients and service paths; preserve original body and encryption classification. | Content mutation; follows stated direction. |
| Forwarding | Do not permit server-side Legacy-to-Protected copy of plaintext. Default to disallow cross-context forward; if later approved, require deliberate user action, Protected encryption before submission, and provenance labeling. | Creates new content and can expose plaintext; cross-context policy unresolved. |
| Attachments and voice | Keep sending blocked. Do not upload plaintext or treat storage encryption as E2EE. Existing attachment read/open behavior remains subject to current authorization and separate security review. | Content creation; blocked pending approved encrypted-media protocol. |
| Reactions | Recommend disable changes to Legacy message reactions to preserve immutable presentation; reactions are metadata rather than body edits, so a less restrictive policy requires explicit approval. | Non-body mutation; unresolved approval. |
| Message deletion / pinning | Reject unsend/delete-for-everyone and pin/unpin on Legacy messages. Delete-for-me may be offered only as a local/personal hide that cannot alter shared history, other users' views, or server-retained content; confirm its retention/privacy semantics before approval. | Shared content/state mutation vs local UI action; explicit approval required. |
| Read receipts | Preserve existing per-user unread/read semantics only if product approves; they are activity metadata, not content edits. Do not mark the other context read when a user opens the aggregate person-level Chat. | Non-content state; privacy/product approval required. |
| Conversation metadata | Permit clearly personal, non-shared UI preferences (e.g. local archive/hide) only if they do not alter security identity. Freeze shared security-relevant participant, mode, or history metadata; group name/avatar changes require a separate policy. | Mixed personal/shared metadata; approval required. |
| Calls and call-history records | Treat call signaling as separate from message E2EE; do not claim calls are protected by this message architecture. Do not insert call records into a read-only Legacy timeline without explicit policy; the current call service calls the write-policy helper with `type: "call"` and then silently returns if rejected. | Separate feature; product, privacy and call-security review required. |
| System-generated messages | Permit only narrowly defined, server-authorized, clearly labeled security/system events in a separate event type or explicitly controlled service path; never let a generic service insert arbitrary body text or bypass Legacy policy. | Non-user content but still timeline mutation; event taxonomy and authorization require approval. |

**Enforcement requirement:** This policy cannot be enforced by hiding a button. At minimum, the final design must inventory and cover message send/retry, edit, attachments, forward, reactions, unsend/delete-for-me, pins, read-triggered receipt writes, group membership/metadata, admin/context-generated messages, call-history writes, and future background jobs. Centralize policy checks but retain operation-specific authorization. Checks and durable writes must be atomic or guarded by a policy/version compare-and-set. Recheck after asynchronous upload before message creation. Socket.IO must only broadcast committed, authorized outcomes; clients must treat REST/history and socket events consistently. The current inspected chat socket behavior relays server-generated events; no inbound socket message creation path was found, but that is not a guarantee about future paths.

### 19.5 Outstanding approvals and protocol questions

**Product/security approvals required before implementation:**

1. Approve Architecture A and the UX choice between context navigation and any person-level preview aggregation; approve clear labels such as “Legacy — not end-to-end encrypted” and “Protected.”
2. Approve the Legacy matrix details: reactions, local hide/delete-for-me, receipts, archive, group metadata/membership, calls/call records, admin/context/system messages, and cross-context quotes/forwarding.
3. Approve whether an existing pair may create a separate Protected context, and whether both participants must acknowledge setup before it becomes sendable.
4. Define group setup, invite consent, concurrent member changes, and whether every approved active device must be ready or users can explicitly select a subset.
5. Define device approval/verification, identity change warnings, revocation timing, and behavior for unsupported/offline/stale clients.
6. Define history recovery scope and explicit consent; default proposal is future Protected messages only, with no automatic Legacy conversion or history transfer.
7. Approve rollout, user communication, old-client behavior, policy rejection UX, and rollback rules. Rollback must not re-enable plaintext or downgrade an active Protected context.

**Protocol/implementation questions (not answered by product approval):**

- Select and independently review a versioned protocol/library, cryptographic suite, credentials, device identity binding, authenticated context, replay handling, durable state, and Android API 26+ support.
- Define protected envelope versioning and server validation boundaries; server structural validation is not cryptographic verification.
- Design the device directory, transparency/key-change verification, authorization tokens, revocation and concurrent state commit rules.
- Define exact REST create-or-get, readiness/activation, send, membership, history and download contracts; idempotency scope and error behavior; database uniqueness and transaction model.
- Specify REST/socket ordering, event IDs, duplicate suppression, reconnect reconciliation, pagination and cross-context UI aggregation semantics.
- Provide Android/Web interop vectors, persistence/restart, offline, concurrency, corrupted-state and downgrade tests before any production proposal.

### 19.6 Threats, failure modes, and acceptance criteria

| Failure / threat | Required response |
|---|---|
| Old client or stale retry writes to Legacy | Server rejects content write; no plaintext fallback; client explains that the old context is read-only and does not silently redirect the payload. |
| Duplicate/concurrent Protected creation | Unique server constraint and idempotent create-or-get converge to one Protected context for the approved identity. |
| Partial or raced setup / offline participant | Keep state non-sendable or suspended; never mark ready based on UI state or partial acknowledgments. |
| Unapproved, revoked or newly added device | Reject/suspend Protected operations according to reviewed protocol state; no access to past content absent approved recovery; invalidate stale membership state. |
| Socket/REST disagreement or duplicate event | Emit only after durable authorized write; deduplicate by stable message/event identity; reconcile from authoritative history without fabricating receipts/order. |
| Pagination/unread aggregation across contexts | Maintain independent context cursors, counts and receipts; no cross-context marking-as-read or false total ordering. |
| Legacy content mislabeled or modified | Preserve immutable source records and per-message provenance; Legacy labels remain visible in list, header, quote/forward, notification and export surfaces. |
| Directory compromise, key loss, or compromised endpoint | State residual endpoint/server metadata risks; require reviewed identity/recovery procedures. E2EE cannot protect content already exposed on a compromised authorized device. |
| Alternate API/service path bypass | Maintain a writer inventory and policy tests for REST, service, admin, call, attachment completion, scheduled/background operations and socket handlers; reject unsupported or unclassified writes by default. |

**Acceptance criteria before a separate Phase 3G implementation proposal can be approved:**

1. Product and security owners record explicit approval of Architecture A, Legacy operation policy, device policy, recovery, groups and rollout.
2. Protocol/library and supported platforms are selected and independently reviewed; no security claim rests on a conversation ID, server flag, TLS, or envelope shape alone.
3. Data model and endpoints uniquely distinguish Legacy from Protected contexts; concurrent/repeated requests are idempotent and do not duplicate either context.
4. Every REST, socket, service and background write path has an explicit policy test. Stale clients, races, retries, permission errors, unknown versions and invalid states fail closed without plaintext fallback.
5. Legacy message bodies and classifications remain unchanged and verifiably read-only; Protected messages carry authenticated protocol provenance.
6. Ordering, pagination, unread counts, receipts, reply/forward behavior, search and notification previews pass cross-client regression tests without cross-context leakage.
7. Device approval, identity change, revocation, offline setup, recovery and group membership lifecycle pass multi-device/concurrency tests.
8. No media or voice activation occurs until encrypted binary protocol and upload/download design are separately approved.

### 19.7 Scoped Phase 3G proposal (not started or authorized)

If and only if all decision-gate approvals are recorded, propose a bounded Phase 3G design/implementation sequence:

1. **Contract and threat-model approval:** finalize the Protected context identity/state machine, endpoint contracts, Legacy matrix, device trust/recovery, group scope, and user-facing security copy.
2. **Server policy foundation:** add explicit context identity/uniqueness and idempotent setup; implement fail-closed authorization and atomic state/version checks across every writer. Keep existing Legacy records/history unchanged. No media.
3. **Client context UX:** add Legacy/Protected labeling and navigation inside the familiar per-person Chat entry point; represent setup, blocked, suspended, offline, and unsupported states accurately. No fallback.
4. **Protocol integration:** only for an approved and supported protocol/library; implement device state, protected send/receive, persistence, authenticated metadata and verified key changes. Keep send disabled until protocol readiness.
5. **Compatibility and reliability tests:** Android/Web vectors; REST/socket parity; retries, idempotency, multi-device, concurrency, pagination, unread, notifications, replies, search, revocation and recovery. No production rollout before independent review and acceptance evidence.

This is a proposal for a later phase, not authorization to start Phase 3G. Attachments, voice, calls-as-E2EE, historical conversion, and rollback-to-Legacy are explicitly out of scope.

### 19.8 Evidence inspected for this finalization

The following existing report evidence was retained and the key identity/write-policy points were rechecked against current source:

- Android send/retry and state: `android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/ui/ChatViewModel.kt`; `android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/data/MessagesRepository.kt`; `android/core/network/src/main/kotlin/com/kothabarta/core/network/messages/MessagesDtos.kt`; `android/core/network/src/main/kotlin/com/kothabarta/core/network/messages/MessagesApi.kt`; `android/core/network/src/main/kotlin/com/kothabarta/core/network/messages/MessageSocketEvents.kt`.
- Backend identity and mode: `server/src/models/Conversation.js`; `server/src/utils/messageSecurity.js`; `server/src/utils/ids.js`; `server/src/routes/chat.routes.js` (direct/group creation, message send/edit, attachment, read receipts, reactions, delete, forwarding, pins, group metadata/membership).
- Non-route message writers: `server/src/utils/contextMessages.js`; `server/src/services/adminMessages.service.js`; `server/src/services/call.service.js`.
- Existing encryption/notification and compatibility evidence: `android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/data/MessageDecryption.kt`; `android/app/src/main/kotlin/com/kothabarta/app/MessageNotificationPreview.kt`; `client/src/pages/message/hooks/useMessageActions.js`; `client/src/pages/message/hooks/useEditMessage.jsx`; `client/src/utility/crypto.js`.
- Existing protocol/security documentation listed in section 14, especially `e2ee-protocol-decision.md`, `e2ee-protocol-selection.md`, `e2ee-recovery-audit.md`, and the MLS feasibility reports.

These are source-inspection findings, not a complete cryptographic audit, independent security review, or evidence that the proposed behavior is implemented.

### 19.9 Finalization task scope and validation record

- **Initial Git status for this finalization:** one pre-existing untracked file, `docs/security/phase-3f-feasibility-report.md`; no tracked or staged changes were reported. The report was the requested existing Phase 3F deliverable and is directly in scope. No unrelated report edits were detected before editing.
- **Files modified in this finalization:** only this report.
- **Production source/API/schema/data/key/configuration/dependencies:** unchanged.
- **Builds, unit tests, lint, device tests, deployments, migrations, commits:** not run or performed; this is report-only planning and source inspection.
- **Validation:** the report was reviewed after editing; `git diff --no-index --check` against the null device and a targeted trailing-whitespace check were run because the file is untracked. Results and final Git status are summarized in the task response.
- **Decision gate:** stop here. Phase 3G has not started and is not authorized by this report.
