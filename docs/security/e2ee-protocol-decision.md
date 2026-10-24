# Kotha-Barta E2EE Phase 0: Protocol and Security Decision

**Date:** 2026-10-24
**Status:** Decision proposal for review; no production protocol or implementation is approved by this document.
**Scope:** Documentation and read-only analysis. No source code, dependency, API, schema, application setting, or existing document was changed.

## Executive decision proposal

1. Treat the existing Web static-ECDH/AES-GCM format as a **legacy compatibility protocol**. Preserve its existing message records and permit compatible clients to read them only when they still have the exact required local private key. Do not describe it as the target security design, extend it to Android for new production conversations, or reinterpret it as MLS.
2. Retain **MLS (RFC 9420)** as the preferred future protocol candidate for new encrypted conversations, consistent with the Phase 2 protocol-selection report. RFC 9420 supports asynchronous group key establishment for groups of two to thousands and is designed for forward secrecy (FS) and post-compromise security (PCS). That does not make MLS a complete messaging application or approve a particular library, provider, identity service, storage design, or rollout.
3. Keep **`mls-rs` and its RustCrypto provider as candidates only**. No candidate is a verified production choice. The exact Android and browser builds, provider configuration, persisted-state compatibility, cross-platform interop, security review, and operational ownership remain unverified.
4. Do not change current production behavior in Phase 0. Production work requires a separately reviewed implementation plan and approval. This proposal authorizes no dependency, API, schema, or cryptographic change.

## Decision status

| Status | Decision |
|---|---|
| **Authorized for this phase** | Read and compare existing documentation and source; create this new decision document only. Do not change production behavior. |
| **Proposed** | Freeze the current custom Web format as legacy compatibility; evaluate MLS for new protocol generations; use one MLS group per conversation with each enrolled installation represented as a distinct client/member, if the later prototype validates that application model. |
| **Not approved** | Production MLS adoption, a specific MLS library/provider/cipher suite, credential format, identity-verification mechanism, recovery design, new server schema/API, enrollment or revocation flow, automatic migration, or plaintext policy change in the running app. |
| **Unknown / requires evidence** | Exact supported Android and browser bindings; shared persistent-state format; supported cipher-suite/provider intersection; test-vector and independent interop results; security audit coverage; device credential authority; key transparency/verification; recovery and history policy; release and vulnerability-response ownership. |

## Evidence from the existing system

The Android audit document records that Android has no E2EE key registration, ECDH/AES-GCM, encrypted DTO handling, decryption, or E2EE private-key storage; Android's message send path sends plaintext. The Web client has a static P-256 ECDH key per browser/account and derives AES-GCM-256 keys, with per-device ciphertext fan-out. The current Web format lacks an explicit protocol version, authenticated conversation/message context, ratchet, and replay counter. Web can fall back to plaintext when encryption or device keys are unavailable. See [Android E2EE implementation plan](android-e2ee-implementation-plan.md) and [E2EE recovery audit](e2ee-recovery-audit.md).

The existing Phase 2 document recommends MLS as the target protocol direction, names `mls-rs` as a lead candidate only, and requires a cross-platform prototype plus security review before production selection. This document preserves that conditional status; it does not supersede those gates. See [E2EE protocol selection](e2ee-protocol-selection.md) and [MLS feasibility report](mls-feasibility-report.md).

## Legacy compatibility boundary

### Legacy protocol classification

The present Web formats should be recognized as legacy by their existing fields and not treated as evidence that they are secure or version-negotiated:

- **Legacy single-payload form:** `encrypted: true` with top-level `ciphertext` and `iv`; stored/returned as `encryptedBody`.
- **Legacy multi-device form:** `encrypted: true`, `encryptedPayloads[{deviceId,ciphertext,iv}]`, and `senderPublicKey`.
- Neither shape has an explicit protocol version. The server currently distinguishes them by fields. This is legacy parsing behavior, not a safe discriminator for future protocol families.

Preserve existing ciphertext, message IDs, timestamps, delivery/read state, key records, and the server's opaque relay behavior. Do not bulk decrypt, re-encrypt, rewrite, or delete existing messages or keys. A new device without the matching historical private key cannot decrypt old ciphertext. Key registration, MLS enrollment, or account login does not restore that key or grant access to historical plaintext.

The long-term compatibility proposal is **read compatibility only** for old records on a client that already holds the required key. During a separately approved transition, currently deployed Web clients may need the existing behavior until all participating devices can upgrade. Do not silently change production clients or server policy in this Phase 0 document. A later migration plan must state when legacy writes stop and how unsupported clients are handled.

### Strict protocol/type separation

Future envelopes must have an explicit, immutable protocol identifier and message kind, parsed as a discriminated union. For example, the design may distinguish `legacy-web-e2ee` from a separately versioned MLS protocol and distinguish MLS application data from handshake/control messages. These names are illustrative only, not an API contract.

- Keep current legacy parsing behind the legacy discriminator/legacy field-shape adapter. Never feed an unknown or MLS payload to the legacy AES-GCM decryptor.
- A future MLS handler accepts only the exact approved protocol identifier, encoding, and message kind. Unknown versions fail closed and are shown as unsupported/unavailable; do not guess based on ciphertext bytes or attempt multiple decryptors.
- Do not add a version label to stored legacy messages by guessing their origin. Preserve their original classification and payload.
- The eventual server relay must validate type/size/routing metadata and preserve the opaque protocol bytes; it must not decrypt application messages.
- Exact envelope fields, database mapping, and API compatibility remain undecided until prototype and server contract review.

## Proposed target architecture

### Clients and conversation state

Treat every installation—Web browser profile or Android app installation—as a separate cryptographic client with its own device identity, credential, private state, and device lifecycle. An account is an authorization and identity namespace, not a shared device secret.

If MLS is validated, represent a 1:1 conversation as a two-or-more-member MLS group whose members are the participating devices. A user with multiple enrolled devices has multiple MLS members. Each device maintains independent local state; do not copy a mutable group-state database between devices. Adding/removing a device is an authenticated group membership change with the protocol's commit/epoch transition.

Web and Android must use compatible choices for the MLS protocol version, cipher suite, credentials, extensions, identity mapping, application content format, and message framing. The server acts as an untrusted Delivery Service for opaque MLS messages and related routing. A separately specified Authentication Service/device enrollment policy decides which credentials represent account devices. MLS does not define Kotha-Barta's account authorization, safety UX, message retention, push privacy, history sync, attachment handling, or full delivery service.

### Conversation security mode

Proposed explicit conversation states:

1. **Legacy/plaintext** — existing non-E2EE messages, clearly distinguished from E2EE.
2. **Legacy Web E2EE** — historical custom-format ciphertext only; no claim that every message is encrypted or that the conversation is downgrade-protected.
3. **MLS pending** — an explicit, authenticated upgrade/enrollment is incomplete; do not represent the conversation as securely upgraded.
4. **MLS active** — a specific MLS protocol/configuration is committed for the conversation. Only valid protocol messages for that configuration are accepted; plaintext and legacy-format sends/edits are rejected.

These names are a product/model proposal, not current server states. The server must enforce the active mode and capability transition; clients must not decide mode based only on a message's `encrypted` boolean. A mode change requires an explicit user-visible transition and a defined policy for every participant's devices. No production schema change is authorized here.

### Device identity, credentials, and key verification

- Bind account identity to a stable device record and cryptographic credential using a reviewed Authentication Service policy.
- Device enrollment must be explicit and authenticated; account login alone must not silently create an MLS member. Prefer approval from an existing trusted device; define a separately reviewed recovery alternative.
- Show device additions, removals, and identity/key changes. Define a user-verifiable fingerprint/safety number or a key-transparency mechanism. A server-returned key list alone is not end-to-end identity verification.
- Define signing/encryption key purpose, credential expiration, rotation, revocation, and compromised-device response. Preserve an auditable key/device history without exposing private keys.
- Do not reuse the current Web JWK as an MLS credential unless a reviewed mapping proves that is correct. MLS KeyPackages and credentials have their own protocol semantics.

### Device addition/removal and history

- A new device becomes a member only through an authorized MLS membership operation. Removing a device requires a committed membership update and fresh epoch so removed members cannot read future messages.
- A newly added device receives state/history only from the epoch and data explicitly authorized by the product policy. MLS membership does not itself retrieve old application messages or make old legacy ciphertext decryptable.
- Proposed default: new device receives future messages from its join epoch onward; historical access is a separate explicit design requiring trusted-device transfer or a reviewed recovery/history mechanism. Never promise old history merely because a device is registered.
- Define offline commit delivery, competing commits, stale epoch recovery, duplicate/reordered messages, and concurrent multi-device sends before production rollout.

### Recovery and account takeover

Account recovery and E2EE key recovery are different capabilities. A password reset or authenticated account takeover must not silently authorize a new device to impersonate existing MLS members or recover historical content.

Require step-up authorization, trusted-device approval or a reviewed recovery protocol, clear user alerts, device inventory/revocation, and rekeying after suspected compromise. Do not use the five-digit recovery PIN as the sole key protection; the existing recovery audit requires an independently reviewed service/trust boundary and explicitly does not claim offline brute-force resistance. Recovery must define whether it restores account access, enrolls a new device, restores current group state, or grants historical plaintext—these must not be conflated.

### Plaintext fallback prevention

Before a conversation enters MLS active mode, clients may continue existing behavior only as explicitly legacy/plaintext operation. After the server commits MLS active mode:

- Missing keys/state, unsupported clients, or crypto errors must fail closed with a clear retry/re-enrollment state.
- Send, edit, reply content, and any other encrypted-content operation must not silently submit plaintext.
- Server APIs must reject plaintext and legacy-protocol messages for that active conversation, including edits and retries.
- Push notifications, logs, search, analytics, and error reporting must not include plaintext or secret material.
- Define explicit downgrade/rollback behavior; rollback may stop creating new MLS groups only if it does not downgrade an already active conversation to plaintext.

## MLS candidate evaluation criteria

RFC 9420 specifies MLS protocol framing and group key establishment; RFC 9750 describes the broader architecture and identifies application/infrastructure responsibilities. MLS can supply cryptographic group state, but Kotha-Barta still needs an Authentication Service, Delivery Service behavior, credential validation, device policy, persistence, UI, and application-level message conventions. See [RFC 9420](https://www.rfc-editor.org/rfc/rfc9420.html) and [RFC 9750](https://www.rfc-editor.org/rfc/rfc9750.html).

Every library must be evaluated at an immutable version/commit and exact feature/provider configuration. A README conformance statement or compiling target is not sufficient. Required evidence:

1. **RFC 9420 compatibility:** supported protocol version, cipher suites, extensions, credentials, KeyPackage/Welcome/Proposal/Commit behavior; run applicable official vectors and negative cases.
2. **Android support:** supported ABI/toolchain, maintained Kotlin/Java binding, lifecycle and threading behavior, documented release artifacts/build route, and device tests. A Rust target or FFI crate alone is not evidence of supported Android integration.
3. **Browser/Web support:** exact browser/WASM runtime support, cryptographic provider maturity, randomness source, browser storage behavior, and reload/multi-tab tests.
4. **Interoperability evidence:** same immutable library/configuration where possible, otherwise independent implementations; bidirectional Android↔Web application messages and membership/control operations with recorded vectors and artifact hashes.
5. **Persistent state:** documented storage API, atomic transaction/commit semantics, encrypted-at-rest host adapter, crash/restart/corruption behavior, backup/restore, concurrency and schema-version policy.
6. **Multi-device:** multiple identities/groups, per-device credentials, add/remove/rekey, offline KeyPackages/Welcome delivery, stale/competing commit behavior, and no implicit historical access.
7. **License and supply chain:** exact dependency and generated-binding licenses, notices/SBOM, provenance/checksums, known vulnerabilities, and compatible distribution terms.
8. **Maintenance and security review:** release cadence, supported-version policy, security policy/advisories, response SLA/ownership, audit scope and date, unresolved findings, and who maintains any Kotha-Barta wrapper/provider/storage code.
9. **Operational fit:** pinned Rust/NDK/JDK/Gradle/WASM/browser toolchains, reproducible offline-capable build evidence, supported device/browser matrix, performance, state size, message ordering and relay requirements.

### Candidate decision matrix

| Candidate | RFC/protocol evidence | Android evidence | Browser evidence | Storage / multi-device evidence | License / review | Phase 0 disposition |
|---|---|---|---|---|---|---|
| **`mls-rs` + RustCrypto** | Upstream says RFC 9420 conformance and provides vectors; this is project evidence, not independent certification | UniFFI source exists, but production Android support, stable Kotlin surface, release path, and exact app integration remain unverified | WASM is advertised; exact browser/provider readiness and production status remain unverified | Storage traits and examples exist; durable Android/Web adapter parity and crash-safe interop are unverified. Multi-identity/group features need app-specific tests | Apache-2.0 OR MIT reported upstream; upstream states no full third-party security audit. RustCrypto is experimental per reviewed docs | **Lead prototype candidate only; not a verified or approved production choice** |
| **OpenMLS** | RFC 9420 implementation and vectors are documented upstream | CI target claims do not establish supported/production Android integration; existing report says Android target is unsupported/untested | WASM crate/target exists; supported browser API and app-level interop remain unverified | Application-provided storage/provider integration; exact durable cross-platform state not established | MIT; audit and application/provider scope require review | **Comparison candidate; no stronger verified Android/Web evidence yet** |
| **Other MLS library** | Must provide versioned RFC evidence and test vectors | Must prove maintained supported Android API/ABI | Must prove maintained browser API/runtime | Must pass persistent state and device membership cases | License, audit and update ownership must pass | **Open option; evaluate only against same criteria** |

`mls-rs` upstream says it has RFC 9420 conformance validation and WASM/storage capabilities, while also stating it has not had a full independent third-party audit; the RustCrypto provider has been identified as experimental in the reviewed project documentation. Therefore neither `mls-rs` nor RustCrypto is presented here as production verified. The prior Phase 3 environment report also records missing local Rust/NDK/WASM tools and no authenticated Gradle verification, so a local prototype build has not been demonstrated. See [MLS feasibility report](mls-feasibility-report.md) and [Phase 3E readiness report](mls-phase-3e-report.md).

## Prototype gates and phased acceptance criteria

All prototype work must use generated test identities and synthetic content in an isolated workspace. No real account, production message, credential, key, database, or production service is used. The prototype does not write to production modules or change the app's live protocol.

| Phase | Work boundary / likely artifact area | Acceptance criteria before proceeding |
|---|---|---|
| **0 — Decision and threat model (this document)** | New security decision document only; no source changes | Stakeholders review legacy boundary, MLS evaluation criteria, identity/device policy, history/recovery policy, no-downgrade rule, and open questions. Approval of this document does not approve implementation. |
| **1 — Reproducible isolated toolchain** | Sibling prototype workspace; pinned manifests/toolchain and evidence directory, not production Gradle/source files | Exact versions, provenance and checksums recorded; authenticated Gradle; compatible JDK/AGP/KGP behavior understood; Rust/NDK/WASM/browser setup reproducible; builds run from clean state. Reported Phase 3E blockers are resolved with actual evidence. |
| **2 — Library/configuration spike** | Isolated Rust core, Android binding harness, Web/WASM harness, synthetic relay, upstream vector corpus | Candidate pinned immutably; Android and browser builds work; chosen suite/credentials/extensions agree; applicable official vectors pass; RustCrypto/provider status explicitly accepted for prototype only. No production claim. |
| **3 — Interop and state durability** | Prototype adapters/storage tests only | Android↔Web bidirectional application messages; add/remove device via KeyPackage/Welcome/Commit; epoch ordering, offline delivery, duplicate/reordered/competing commits; atomic persistence, restart, corruption and backup tests pass. Independent state per device; no production data. |
| **4 — Identity, authorization, and abuse model** | Prototype Authentication/Delivery Service simulation, device enrollment and verification UX artifacts | Account-to-device credentials validated; unapproved enrollment and substituted keys detected; revocation blocks future epochs; takeover response, rate controls, privacy/log redaction and metadata documented; history policy tested. |
| **5 — Independent review and production proposal** | Separate review package and a new implementation plan; production server/client files only after separate authorization | Independent cryptographic, platform, storage, API and operational review completed; all findings dispositioned; library license/security/update ownership approved; explicit migration/rollback plan; security-mode/no-plaintext tests pass in staging. Only then consider a separately approved implementation phase. |

### Prototype test minimum

- Official/candidate library known-answer and negative vectors; malformed/truncated/unknown protocol envelope rejection.
- Android↔Web sends in both directions with matching protocol config; verify wire bytes and decoded plaintext only in synthetic local harness, never log them.
- Group initialization, KeyPackage publication, Welcome join, Proposal/Commit ordering, add/remove member, stale epoch, offline/reconnect, duplicate/reordered delivery and competing commits.
- State atomicity, process death between receive/commit/persist, close/reopen, corruption, rollback detection, backup/restore policy, multi-process/tab races.
- Device identity verification, unauthorized add, account takeover, key rotation/revocation, sender authentication, replay, downgrade/plaintext rejection.
- Legacy parsing isolation: fixtures for both existing Web formats route only to the legacy adapter; MLS fixtures route only to the MLS adapter; unknown version is rejected. No claim that a new test device can decrypt historical legacy ciphertext.
- Android ABI/device/browser compatibility, low-end performance, memory/storage bounds, library update and vulnerability-response process.

## Open security questions

1. Is trusted-device approval mandatory for all new devices, and what approved recovery alternative exists when no trusted device remains?
2. What user-verifiable key identity/key-transparency mechanism is feasible, and who operates the Authentication Service?
3. Which MLS protocol version, cipher suite, credential profile, extensions, identity mapping and application content encoding will be fixed for interoperability?
4. Does each conversation map to one MLS group, and how do account-level blocks, group membership, device enrollment and concurrent devices map to membership commits?
5. Do newly added devices receive only future messages, or is there an explicitly reviewed history transfer/recovery mechanism? What is the retention boundary?
6. Which exact Android and browser library releases/providers are supported, independently reviewed, and maintained? Who owns custom FFI/WASM/storage adapters and security updates?
7. How are MLS state and credentials protected at rest, backed up, restored, versioned, and recovered from corruption without enabling rollback or cloning state across devices?
8. What delivery guarantees, ordering, deduplication, replay policy, pending-commit queue, push routing and metadata minimization does the service provide?
9. Which clients can coexist during migration; when do legacy Web E2EE writes stop; how are unsupported clients blocked from MLS-active conversations without accidental plaintext downgrade?
10. Are attachments, edits, replies, reactions, search, notifications and message history in scope for the same security boundary, or separate protocol/application features?

## Verification still required

- No MLS implementation, dependency, build, official vector, Android↔Web interoperability, or persisted-state test was run for this decision.
- `mls-rs` and RustCrypto remain candidate-only; exact release/provider compatibility and production readiness are unverified.
- Local Phase 3E report lists missing Rust/Cargo, Android NDK, WASM tools, no Android device/AVD, and blocked Gradle wrapper verification in that inspection environment. This report does not claim those blockers were resolved.
- No independent cryptographic audit of an exact library/provider/wrapper/configuration or this application's identity, storage, delivery, and recovery architecture is established here.
- No production conversation mode, device lifecycle, key verification, recovery, history, or migration behavior is approved or implemented.

## Source references

- Local: [Android E2EE implementation plan](android-e2ee-implementation-plan.md); [E2EE protocol selection](e2ee-protocol-selection.md); [E2EE recovery audit](e2ee-recovery-audit.md); [MLS feasibility report](mls-feasibility-report.md); [Phase 3E environment readiness](mls-phase-3e-report.md).
- [RFC 9420 — The Messaging Layer Security (MLS) Protocol](https://www.rfc-editor.org/rfc/rfc9420.html) — protocol, group epochs, KeyPackages/Welcome/Commit, credentials, and security properties.
- [RFC 9750 — The Messaging Layer Security (MLS) Architecture](https://www.rfc-editor.org/rfc/rfc9750.html) — Authentication Service and Delivery Service architecture and application responsibilities.
- [`mls-rs` upstream repository and security/provider notes](https://github.com/awslabs/mls-rs) — implementation claims and candidate evidence only; not an independent audit or production support guarantee.
- [Phase 3E pinned `mls-rs` candidate manifests and evidence](mls-phase-3e-report.md#exact-mls-candidate-and-toolchain-evidence) — immutable candidate baseline considered previously; not selected by this decision.
