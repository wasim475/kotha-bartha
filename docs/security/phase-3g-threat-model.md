# Phase 3G — E2EE Threat Model

**Checked:** 2026-10-29
**Status:** Design-phase threat model for Architecture A. No implementation or production policy change is approved.

## 1. System boundary and assets

### In scope

- Android and Web account/device identity, protocol credentials and local protocol state.
- Protected-context setup, direct and group membership, message encryption/decryption, REST submission/history, Socket.IO events and offline delivery.
- Server authorization, device directory, ciphertext database/storage, notification service, search, logs, analytics and operational telemetry.
- Legacy/Protected separation, message provenance, replies, receipts, edits, forwarding, deletion and recovery.
- Platform caches, backups, app-switcher previews, clipboard and notification previews after decryption.

### Assets

1. Confidential message content, attachment content (attachments remain disabled), reply quotes and local search results.
2. Private identity keys, protocol epoch/session state, device credentials and recovery material.
3. Integrity/authenticity of sender, context, message kind, membership epoch, reply/edit/delete relation and device status.
4. Correct security labels and immutable Legacy provenance.
5. Account authorization, device approval/revocation state, conversation membership and recovery authority.
6. Delivery metadata: sender/recipient/device/context identifiers, timestamps, size, connectivity, message and receipt timing.
7. Availability and consistency of conversation state, ordering, pagination, unread counts, retries and socket events.

## 2. Trust boundaries

| Boundary | Trust assumption / required control |
|---|---|
| User ↔ account authentication | Login proves account access, not device key ownership, approval or identity continuity. Require a separate device enrollment and approval ceremony. |
| Device ↔ OS secure storage | Assume a supported OS can protect key material at rest within limits. Rooted/jailbroken devices, malware, backups, memory inspection and unlocked-device access can expose plaintext/keys. |
| Android ↔ Web | No shared trust by default. Require identical protocol version/suite/credential/application semantics and test vectors; each installation has separate state. |
| Client ↔ server/API | Server is an untrusted relay for Protected content. TLS protects transport, not against a malicious service endpoint or backend access to submitted plaintext. |
| Backend ↔ database/cache/backup | Storage operators can observe stored data and metadata. Protected message content must be ciphertext; plaintext Legacy records remain server-readable. |
| REST ↔ Socket.IO | Events are untrusted until matched to authorized committed context/message state. Socket delivery is not proof of durable creation or cryptographic validity. |
| Backend ↔ push/analytics/APM | Third-party systems must receive no Protected plaintext, keys, protocol secrets, signed private URLs or content-derived metadata beyond approved generic notification data. |
| Device ↔ other participant devices | Devices authenticate credentials and protocol state, not merely account display names or server routing IDs. |
| Legacy ↔ Protected context | Separate IDs, labels, parsing and authorization. No automatic migration, mixed transcript or fallback across the boundary. |

## 3. Adversaries and assumptions

### Adversaries considered

- Malicious, compromised or legally compelled server/storage/push provider.
- Network attacker capable of delay, drop, reorder, duplicate, replay or substitution.
- Account attacker who has password/session access but no approved device key.
- Attacker enrolling a forged device, exploiting key directory equivocation or abusing recovery.
- Malicious authorized participant, compromised client, rooted device or hostile browser extension.
- Revoked/stale device, old client, concurrent device session or unauthorized group member.
- Malformed-message sender seeking parser, media, memory, CPU or storage exhaustion.
- Insider or service job that writes messages through an alternate route or logs content.

### Assumptions requiring validation

- Cryptographic primitives and selected library are correctly implemented and maintained.
- OS/browser random generation and secure storage behave as required on supported versions.
- Enrollment, credential issuance, verification, key-change alerts and revocation are correctly authorized.
- Protected content is encrypted before network transmission and remains ciphertext through server storage, logs, push and backups.
- The server can enforce authorization and routing but cannot verify that ciphertext is valid or decrypt it.
- Recipients validate protocol context, device credential, sender, epoch and message type before rendering.
- Product policy accepts loss of availability when credentials, protocol state or approved devices are unavailable; no plaintext fallback is allowed.

No assumption is established merely by a conversation security flag, HTTPS, a valid-looking envelope, API authentication or an upstream protocol claim.

## 4. Attack scenarios and mitigations

| Threat / abuse case | Impact | Required mitigation and evidence |
|---|---|---|
| Malicious or compromised server reads/changes messages | Plaintext exposure or message injection if any client submits plaintext or trusts server metadata | Client encrypts before sending; backend stores/relays opaque protocol objects only; client authenticates protocol context/sender; test with malicious relay that alters, swaps, delays, duplicates and drops traffic. Availability and metadata remain exposed. |
| Forged/substituted device keys or directory equivocation | Sender encrypts to attacker key; impersonation or silent MITM | Authenticated account/device credential binding, approved enrollment, key change history, verification UI and preferably auditable transparency/consistency evidence; test directory substitution and inconsistent views. Current public-key upsert is insufficient. |
| Unauthorized device registration | Account session attacker gains future decrypt access | Separate authentication from device approval; require proof of private-key possession and approval by a trusted device/recovery authority; notify existing devices; test stolen-session enrollment and races. |
| Compromised user device | Attacker reads plaintext, keys, screenshots or local search; impersonates user | Platform hardening, app lock, revocation and incident flow, minimal plaintext retention; test device revocation. E2EE cannot protect content already available on a compromised authorized endpoint. |
| Replay or message substitution | Repeated actions, incorrect message, altered reply, stale state | Use protocol sequence/epoch and authenticated context rules; transactionally dedupe exact transport retries; reject stale/invalid state; test duplicate/replay and cross-version corpus. |
| Cross-conversation injection | Valid ciphertext appears in wrong chat or reply/history | Bind authenticated protocol context to Protected context and validate it against REST path/event; keep message IDs and reply refs context-scoped; test swapping messages and sockets between contexts. |
| Downgrade / plaintext fallback | Protected intent is sent/stored as plaintext or redirected to Legacy | Server-controlled non-sendable setup, explicit allow-list, fail-closed client and backend checks on every write path; never try Legacy after error; test missing keys, old clients, malformed version and service outage. |
| Concurrent device sessions / state rollback | Forked state, duplicate creation, key reuse or accepted stale messages | Per-device state, atomic state persistence, versioned transitions, idempotent create/send operations and protocol-specific fork handling; test concurrent setup, multi-tab, process crash and backup rollback. |
| Revoked device receives later content | Formerly authorized endpoint continues reading messages | Authenticated membership removal/key rotation and server delivery authorization; prevent stale credentials; test online/offline revocation races. Previously received plaintext/keys cannot be recalled. |
| Group membership change race | Added member gains old history or removed member gets new keys | Protocol-defined commits/epochs, authorization transaction ordering, explicit history grant policy and membership acknowledgment; concurrency tests for simultaneous joins/removals/sends. |
| Backup/recovery compromise | Attacker restores identity/history or guesses low-entropy recovery secret | No default history recovery; separate high-entropy or independently reviewed trusted-device/recovery design, rate limits and audit; test snapshot theft, guessing and compromised recovery authority. Recovery may broaden access and requires explicit consent. |
| Plaintext leakage in logs, notifications, analytics, search, crash reports or caches | Server/third party/OS sees content despite E2EE claim | Generic push; local-only previews; no server indexing; content-free telemetry; bounded local caches and platform backup policy; sentinel tests across network, logs, crash/analytics hooks and notification stores. |
| Metadata leakage | Reveals social graph, frequency, device count, timing, group size, message size and read activity | Minimize and retain metadata only by policy; use generic push; document that current server routing and receipts reveal metadata; evaluate traffic analysis mitigation only if product requires it. |
| Legacy/Protected context confusion | User believes plaintext Legacy history is E2EE, or plaintext is quoted/sent into Protected | Separate context identity, explicit persistent labels, strict parser, no stream interleaving by default, provenance on cross-context quotes and exports; test mixed-context navigation/search/notifications. |
| Malformed message/resource exhaustion | Parser crash, memory/CPU exhaustion, corrupt state | Library's safe parser, strict maximum sizes/depths/timeouts, bounded queues, fuzzing and circuit breakers; no plaintext logging on failure. |
| Alternate API/socket/service writer | Legacy or Protected policy bypassed by admin, call, context or background path | Enumerate all writers and mutation routes; central fail-closed policy service; tests per writer and routes/services; socket events only after durable authorized creation. |

## 5. Explicit E2EE limits

E2EE can protect message content in transit and at the server from parties who lack an authorized endpoint key, if correctly implemented and if no plaintext is sent through alternate channels. It does **not** by itself:

- hide account identifiers, participant/device relationships, timing, delivery/read events, message sizes or network metadata;
- prevent a recipient from copying, exporting, photographing, forwarding or disclosing plaintext after decryption;
- protect an unlocked, compromised, rooted, malware-infected or hostile-extension endpoint;
- prevent denial of service, message deletion, delay, reordering or withholding by the server;
- make identity claims true if credential enrollment/verification is compromised;
- recover lost keys or safely grant history to new devices;
- erase copies, backups, screenshots, ciphertext or keys already received;
- encrypt Legacy plaintext already stored on the server or prove historical content was encrypted;
- secure voice/video calls, attachments, filenames, thumbnails or server search unless those are separately designed and tested.

## 6. Current-code exposure and enforcement gaps

Rechecked source establishes the following current boundaries:

- Android's outbound text path constructs plaintext optimistic UI and calls repository send with `SendMessageRequest(body, replyTo)`.
- Android can decrypt an addressed legacy multi-device payload but does not authenticate a stable sender identity or bind conversation/message context as AAD in the current decryptor.
- Web can fall back to plaintext in send/edit flows; current group sends are not protected by the legacy direct-message encryption path.
- Server's E2EE envelope validator is structural only; current message policy applies to conversations already flagged E2EE, rejects groups/non-text, and does not prove cryptographic integrity.
- Current mode defaults to Legacy; direct pair creation reuses `pairKey`; device public keys are self-registered/upserted.
- Server search scans plaintext Legacy bodies and excludes messages flagged encrypted. Push content is generic today; Android local preview can decrypt locally but falls back to generic text on decrypt failure.
- REST routes and service-level writers listed in [the implementation contract](phase-3g-implementation-contract.md#51-alternate-paths-requiring-enforcement-inventory) must be covered before policy activation.

The `Message` schema, API DTOs, serializers, notification resolver, logs/APM integrations, OS backups and all third-party telemetry were not comprehensively security-tested. Treat their leakage behavior as unresolved until the acceptance tests enumerate sinks.

## 7. Review status and required reviewers

- This threat model is a design artifact, not an independent security review or cryptographic certification.
- Require protocol specialist review of exact library/version/provider, wire format, state persistence and group lifecycle.
- Require application security review of enrollment, key directory, REST/socket/service authorization, logging/telemetry, recovery and downgrade behavior.
- Require Android and Web reviewers for platform key storage, API/browser support, offline/multi-tab state, notifications and cache handling.
- Require legal/license and maintenance review for the chosen exact dependencies.
- Re-run the source inventory immediately before implementation; this report is a snapshot as of 2026-10-29.

## 8. References

- [RFC 9420 — MLS](https://datatracker.ietf.org/doc/html/rfc9420) and [RFC 9750 — MLS Architecture](https://datatracker.ietf.org/doc/html/rfc9750).
- Signal protocol references: [X3DH](https://signal.org/docs/specifications/x3dh/), [Double Ratchet](https://signal.org/docs/specifications/doubleratchet/), and [Sesame](https://signal.org/docs/specifications/sesame/).
- [Phase 3F feasibility report](phase-3f-feasibility-report.md) and [Phase 3G implementation contract](phase-3g-implementation-contract.md).
