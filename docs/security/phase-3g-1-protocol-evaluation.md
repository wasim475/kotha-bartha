# Phase 3G-1 — Isolated E2EE Protocol & Library Evaluation

**Checked:** 2026-10-29
**Status:** Documentation-only feasibility evaluation. No production protocol or library selected. No candidate code was built or run.
**Scope:** Read-only inspection of approved design documents, repository source/manifests, and publicly available protocol/library documentation. No production behavior, source, API, schema, data, key, configuration, or dependency was changed.

## 1. Executive outcome

**The protocol/library decision remains open.** Evidence supports prioritizing the **MLS protocol family** for a future isolated evaluation because the product direction includes 1:1, groups, device membership, and Architecture A's distinct Protected contexts. RFC 9420 is an IETF Standards Track group key agreement protocol, and RFC 9750 describes the surrounding architecture. Neither RFC selects an application library or supplies Kotha-Barta's identity, device enrollment, directory, relay, storage, recovery, notification, or UX system.

**No implementation candidate is currently evidenced as production-ready for Kotha-Barta Android + Web interoperability.** Do not select or integrate `mls-rs`, OpenMLS, `libsignal`, or any other library based on platform compilation or a protocol claim alone. Historical repository reports identify MLS candidates, but no candidate has passed an exact pinned Android/Web interoperability, persistence, lifecycle, licensing, or independent review gate.

The Signal family (PQXDH/X3DH, Double Ratchet, Sesame) is a credible design comparator for asynchronous pairwise sessions and multi-device session management. It does not by itself establish the required Kotha-Barta group protocol and complete app architecture. The official `signalapp/libsignal` README says use outside Signal is unsupported and its APIs/bridge layers may change; its current repository LICENSE is AGPL-3.0. These are substantial support and legal gates, not a judgment that the Signal protocols are cryptographically weak.

**Isolated runtime evaluation is not feasible in this environment under current constraints.** On 2026-10-29, `rustc`, `cargo`, `wasm-pack`, `wasm-bindgen`, and `adb` were not on PATH, and no Android SDK environment variable was set. The repository's earlier MLS feasibility report records the NDK as absent and the required Rust/WASM toolchains as unavailable. Installing tools or running candidate build scripts is prohibited without separate authorization. Therefore this task stops at documentary feasibility; no interop, compilation, cryptographic or device result is claimed.

## 2. Scope and decision labels

- **Verified:** directly observed in repository source/manifests or fetched official specification/project documentation, as cited.
- **Historical repo evidence:** a prior security report's documented observation, not revalidated against current upstream state in this evaluation.
- **Assessment:** engineering conclusion based on available evidence; not proof of cryptographic security.
- **Open:** requires owner decision or evidence not available here.

This report follows Architecture A as the preferred design direction for evaluation: preserve Legacy context/history, establish a distinct Protected context, use one familiar per-person Chat entry point without silently merging transcripts, and retain explicit provenance. Architecture A and all protocol/library choices remain unapproved for implementation.

## 3. Comparison matrix

| Evaluation area | MLS — RFC 9420 | Signal-family alternatives — PQXDH/X3DH + Double Ratchet + Sesame | Kotha-Barta finding |
|---|---|---|---|
| Android Kotlin compatibility | The RFC is language-neutral. Existing repo evidence identifies Rust implementations and a historical `mls-rs-uniffi` candidate, but not a validated, supported Kotlin/Android integration for this app. Current OpenMLS upstream README lists Android targets among those built but explicitly marks them unsupported/not tested. | Current official `libsignal` README lists Java APIs and Android build instructions, but also says use outside Signal is unsupported and APIs/bridge layers may change. The Kotha-Barta Android dependency catalog has no Signal-family dependency. | **Unproven for either family.** Kotlin API presence or Android target compilation alone is insufficient; API 26+ support, native packaging, secure storage and state durability need a synthetic harness. |
| Web browser compatibility | MLS is not a browser API. OpenMLS says `wasm32-unknown-unknown` is built but unsupported/not tested. Historical `mls-rs` evidence identifies WASM/WebCrypto work, with limitations; current exact versions/provider support were not revalidated. | `libsignal` README lists TypeScript APIs, but third-party use is unsupported and the build/runtime contract for this app's browsers is unverified. Signal protocol specifications do not guarantee a Web implementation. | **Unproven.** No MLS or Signal-family dependency is present in `client/package.json`; browser API, WebCrypto/provider, browser storage and multi-tab behavior need explicit support evidence. |
| Android ↔ Web interoperability | Standardized MLS protocol provides a potential common wire protocol, but interoperability requires identical protocol version, ciphersuite, credentials, extensions, encoding, application framing, provider behavior and state transitions. No app interop vectors or run exist. | Specifications define algorithms/flows, not a promise that independent clients interoperate. `libsignal` Java/TypeScript APIs do not themselves prove supported cross-language state/wire compatibility for Kotha-Barta. | **Not demonstrated.** Do not infer interop from Rust/WASM/JVM target support or shared protocol naming. |
| 1:1 messaging | RFC 9750 describes MLS as an architecture for group secure messaging; RFC 9420's group size covers two or more members. | PQXDH/X3DH establish asynchronous initial pairwise secrets; Double Ratchet evolves pairwise message keys. | Both families can inform 1:1 design. No app implementation chosen. |
| Group messaging | Core strength: group key establishment and membership changes are part of MLS. | The cited pairwise specifications plus Sesame do not alone define a unified Kotha-Barta group protocol. A specific group protocol/implementation would need separate selection and evidence. | **MLS aligns better at the protocol-family level** with intended group support, but no group implementation or membership policy is ready. |
| Multi-device identity and verification | Each device can be represented as a protocol member, but MLS does not define Kotha-Barta account identity, device approval, verification UI, complete directory or recovery policy. | Sesame addresses asynchronous multi-device session management, but account/device registration, trust, key-change verification and server orchestration remain application work. | **Unresolved system work for either.** Current self-registered device public keys are not approved or verified identities. |
| Forward secrecy / post-compromise security | RFC 9420 states FS and PCS properties for its protocol under applicable operation and state assumptions. | Double Ratchet specifies forward security and recovery after fresh DH ratchet input; PQXDH specifies post-quantum forward secrecy for initial key agreement under its assumptions. | These are protocol properties, not app guarantees. Endpoint compromise, missing state updates, unsafe backups, unverified credentials and implementation flaws remain risks. |
| Key lifecycle / revocation | MLS has epoch and membership update mechanisms. Application must authorize/serialize membership changes, deal with delivery/fork/state recovery and define who can add/remove devices. Revocation does not erase prior plaintext/keys. | Ratchet/session management requires prekey lifecycle, session creation, device add/remove and stale-session handling; Sesame discusses these system concerns. | No chosen enrollment, device quorum, revocation boundary or recovery mechanism. Current registration upserts a JWK by caller-supplied device ID. |
| Recovery and backup | MLS does not define account-level history recovery; restoring stale group state or transferring state needs careful protocol-specific design. | Session protocols do not automatically recover device keys/history; Sesame explicitly treats state loss/rollback as an application concern. | Default proposal remains future Protected messages only; recovery mechanism and access consent are open. |
| Backend opaque relay | RFC 9750 describes an MLS architecture with delivery/authentication services and discusses compromise of those services. The application must build these services; a relay cannot establish that the client used encryption correctly. | Signal-style servers may publish prekeys and queue/route opaque messages; server-side identity/device directory remains important to trust. | Backend would need authenticated context/member authorization, bounded opaque storage, ordering/deduplication, offline delivery and generic notifications. Current APIs store plaintext and current envelope validation is structural only. |
| Maintenance and support | Historical repo evidence documents candidate versions/licenses but is not current support evidence. Current OpenMLS README identifies maintainers and says Android/WASM targets are unsupported/untested. Current `mls-rs` project status, exact release support and security response could not be independently retrieved in this pass. | Current `libsignal` README states external use is unsupported and APIs may change. Official specs exist, but that is distinct from third-party implementation support. | **No maintained, supportable Kotha-Barta implementation path verified.** Assign protocol/library upgrade and vulnerability-response owners before selection. |
| Licensing | Historical repo evidence records `mls-rs` as Apache-2.0 OR MIT and OpenMLS as MIT; exact candidate release and transitive dependencies require current legal audit. | Current official `libsignal` LICENSE is AGPL-3.0. Legal must evaluate product distribution/network-use obligations and dependencies; do not assume the license is acceptable. | **Legal review required.** No dependencies may be added in this phase. |
| Auditing and test evidence | RFC status and conformance vectors are useful, not an independent implementation audit. No app-specific build, interop, storage, concurrency or review evidence exists. | Specification review and Signal's own use do not audit an app integration; third-party `libsignal` support is explicitly limited. | **No candidate passes.** Independent protocol and integration review is a prerequisite. |
| Migration / Legacy | MLS does not retroactively convert old records to authenticated MLS messages. | Pairwise protocols likewise cannot turn legacy plaintext or old ciphertext into protected history. | Architecture A preserves separate Legacy and Protected contexts; no in-place conversion or silent fallback. |
| Overall | **Lead protocol family for isolated feasibility evaluation; not selected.** | **Comparator; no production selection.** `libsignal` has material support/license barriers. | Proceed only with a separately authorized, non-production evaluation; make no implementation decision from this report. |

### 3.1 MLS profile and related specifications

RFC 9420 defines the MLS protocol; RFC 9750 is an Informational architecture document covering the surrounding secure messaging infrastructure and application responsibilities. Before any MLS implementation choice, the evaluation must define a versioned profile: protocol version, ciphersuite, credential type and validation, extensions/capabilities, application message framing, Delivery Service behavior and state persistence. Relevant RFC 9420 extension mechanisms (including RequiredCapabilities and ExternalSenders) must be assessed against Kotha-Barta's membership and service model; their availability is not a recommendation to enable them. No profile, extension set or credential scheme is selected here.

For Signal-family comparison, PQXDH is the current post-quantum asynchronous initial key agreement specification; X3DH is included as predecessor/context. Double Ratchet handles ongoing pairwise message-key evolution, and Sesame describes asynchronous multi-device session management. These specifications do not collectively define Kotha-Barta's group implementation or its account/device trust and relay architecture. No Signal protocol profile is selected.

## 4. Repository evidence revalidated

### 4.1 Android

- `android/gradle/libs.versions.toml` contains Compose, networking, datastore/security-crypto, Koin and other app dependencies; no MLS, `libsignal` or Signal-family protocol library was found.
- `android/app/build.gradle.kts` sets `minSdk = 26`, `compileSdk = 35`, and `targetSdk = 35`.
- `ChatViewModel.sendText` / `performSend` pass message text to `MessagesRepository.sendMessage`; repository serializes `SendMessageRequest(body, replyTo)`. This is current plaintext outgoing behavior.
- `AndroidMessageDecryptor` handles an addressed legacy multi-device payload and invokes `WebE2eeDecryptor`, which uses P-256 ECDH output directly as an AES-256-GCM key. The current decryptor does not supply application AAD/context binding and does not provide a complete new protocol implementation.
- `AndroidMessageDeviceKeyRegistrar` provisions/registers a public key. `AndroidE2eeKeyManager` uses Android Keystore ECDH only on API 31+ and does not silently regenerate a previously provisioned lost key. That is not a device approval/revocation system.

### 4.2 Web

- `client/package.json` has no MLS, Signal or protocol dependency.
- `client/src/utility/crypto.js` and message action hooks implement legacy static P-256 ECDH/AES-GCM device encryption; current web send/edit paths may submit plaintext when encryption/keys are unavailable. This legacy format is not a candidate protocol to extend or port.

### 4.3 Backend

- `server/src/models/Conversation.js` has a unique direct `pairKey` and defaults `messageSecurityMode` to `legacy`.
- `server/src/utils/messageSecurity.js` treats missing mode as Legacy. In E2EE mode it checks group/type and envelope shape; its own comment says structural validation does not prove that a sender performed encryption or that a payload decrypts.
- `server/src/routes/chat.routes.js` direct create-or-open upserts by participant pair, so it reuses the existing conversation instead of creating a distinct Protected context. Current send, history, notifications and socket broadcasts are not an opaque-protocol delivery service.
- `server/src/routes/users.routes.js` upserts device public keys by the submitted `deviceId` under the authenticated account; no approval ceremony is implemented there.
- Chat message creation is REST/service-side; inspected Socket.IO listeners include typing relays and separate call/game events. The inspected chat message events are server-emitted. Re-inventory all writers before any future implementation.

### 4.4 Approved design evidence

Read the approved Phase 3G contract, threat model, open-decisions register, Phase 3F report, and existing protocol selection/decision, MLS Phase 3E feasibility and recovery reports. These consistently leave protocol and library choice open, require Architecture A review, forbid plaintext fallback, keep media blocked, and require independent security review. Historical candidate/version/license statements are labeled historical below; they are not refreshed upstream findings unless expressly stated.

## 5. Candidate and runtime feasibility

### 5.1 Candidates

**MLS family**

- **OpenMLS:** official current README identifies an RFC 9420 implementation, lists Android and `wasm32-unknown-unknown` among CI-built targets, and explicitly classifies those targets as unsupported/not tested. Its stated supported/tested target list does not include Android or WASM. This is insufficient to claim Kotha-Barta Android/Web support or interop.
- **`mls-rs`:** Phase 3E repository report records an immutable baseline `8f1b43f447a792ff9307f1c2c7f54da63914870e`, `mls-rs` 0.56.0, RustCrypto provider 0.22.1 and UniFFI 0.13.0; it documents an experimental RustCrypto/WebCrypto/provider integration concern and no independent full third-party audit. These are historical facts from that report. Current upstream README/license/release support could not be independently fetched during this task, so they must be revalidated before candidate selection.

**Signal family**

- **Specifications:** official PQXDH, X3DH, Double Ratchet and Sesame documents describe useful asynchronous, pairwise and session/device lifecycle properties. A complete Signal-family product stack still requires application policy, identity binding, device directory, group strategy, delivery, storage and recovery design.
- **`libsignal`:** the current official GitHub README was retrieved. It says libraries exist for Java, Swift and TypeScript, states use outside Signal is unsupported, and warns APIs/implementations/bridge layers may change. The current official `LICENSE` file identifies AGPL-3.0. This rules it out as an automatic default, but does not judge protocol cryptographic strength. Kotha-Barta needs explicit legal/support approval before even an isolated dependency prototype.

**Other candidates:** no additional candidate is justified by current repo evidence. Adding another protocol/library would widen the review without verified Android/Web support or a product need not addressed by the two families above. Do not select a custom protocol or combine algorithms ad hoc.

### 5.2 Safe isolated runtime evaluation

Documentary evaluation was safe and was performed. **Running an isolated cross-platform candidate build/interoperability evaluation was not feasible or authorized:**

- Current command checks found `rustc`, `cargo`, `wasm-pack`, `wasm-bindgen` and `adb` absent from PATH; `ANDROID_SDK_ROOT`/`ANDROID_HOME` was not set.
- The Phase 3F/3E feasibility reports record no Android NDK and missing Rust/WASM tools; no project-specific candidate workspace or pinned cross-platform binding exists.
- No dependencies or toolchains may be installed under the present authorization, and candidate libraries' build scripts must not be run as part of this phase.
- No isolated synthetic relay, harness, test identities or package lockfiles exist.
- GitHub MCP reads for some current candidate files failed due to transport errors. The accessible official docs are sufficient to identify the gate, not to make claims about every library release.

Therefore no build, test vector, benchmark, Android execution, browser execution, storage test or Android↔Web message was run. Platform target claims and protocol-level properties are not presented as application interoperability evidence.

## 6. Licensing, maintenance and security history

| Candidate | Verified evidence | Concerns / required review |
|---|---|---|
| RFC 9420 / RFC 9750 | RFC 9420 is Internet Standards Track. RFC 9750 is an IETF informational architecture document and explicitly leaves application infrastructure decisions to the application. | Standards publication is not an implementation audit, security certification or license clearance for a library. |
| OpenMLS | Current upstream README says it implements RFC 9420, lists maintained project attribution, and marks Android/WASM targets as built but unsupported/not tested. Historical repo docs record MIT license. | Verify exact release license and transitive dependencies, maintenance/security response, supported Kotlin/WASM bindings, provider, Android storage and browser support; get independent review. |
| `mls-rs` | Existing Phase 3E report records candidate baseline and historical Apache-2.0 OR MIT licensing, along with limitations. | Current upstream support, license, release cadence, advisories and feature status were not refreshed due to fetch/MCP limitations. Historical report is not enough for approval. Validate exact commit, provider, WASM/Kotlin bridge, state persistence and ownership. |
| `signalapp/libsignal` | Current official README lists Java/TypeScript surfaces and explicitly says third-party use is unsupported/API layers may change. Current LICENSE says AGPL-3.0. | Legal analysis and written support/maintenance risk acceptance required. Verify exact releases, transitive licenses, security disclosure/response path and Android/Web behavior. No candidate build run. |

No candidate has been independently audited for Kotha-Barta's exact integration. Record library version/commit, compiler/toolchain, crypto provider, suites, transitive dependency inventory/SBOM, advisories, patch ownership and upgrade policy before any later evaluation.

## 7. Key open questions

1. Is Architecture A and its explicit context navigation approved by Product/Security? Are any preview aggregations allowed?
2. Are groups in first Protected release required, or may a narrower direct-only launch be considered? If groups are required, MLS-family fit increases but does not prove library feasibility.
3. What is the device readiness quorum: all approved active devices or a user-selected set? How are offline or stale directory entries handled?
4. What enrollment/verification authority, identity-change warning and transparency/equivocation response are required?
5. What is the revocation boundary, offline behavior and concurrent membership commit policy?
6. Is Protected history recovery allowed at all? Which recovery method, history scope, consent and abuse model are acceptable?
7. Which exact Android API levels and browser versions must be supported? Can the app's API 26 floor be retained by the candidate binding?
8. What legal constraints apply to AGPL-3.0 and each candidate's transitive dependencies?
9. Who owns protocol integration maintenance, dependency updates, vulnerability response, state migration and rollback?
10. Which independent reviewer(s) will assess protocol, implementation, application/backend contract, mobile/Web storage and licensing?

## 8. Required independent review

Before any production selection, commission an independent review covering:

- exact protocol/version/ciphersuite/extensions/credential model and selected library release;
- authenticated device identity, directory consistency, enrollment, verification, key change and revocation;
- Android/Web provider and wire interoperability, serialization, replay/fork handling and unknown-version behavior;
- durable local state, atomic writes, process death, backup/restore rollback, browser multi-tab and corrupted state;
- backend Delivery/Auth service contracts, authorization, opaque storage, REST/socket consistency, offline delivery, retry/idempotency and denial-of-service;
- group membership races and device addition/removal; history recovery and account recovery;
- plaintext/log/push/search/analytics/cache/crash-report leakage;
- license and transitive dependency inventory, build reproducibility and vulnerability-response ownership.

The reviewer must receive exact source revisions and test artifacts. Upstream conformance claims or successful compilation are not a substitute. This report is not that review.

## 9. Narrowly scoped next-step proposal

**Requires separate explicit authorization. Do not start automatically.**

Authorize a disposable, offline/loopback-only **MLS feasibility harness** with synthetic identities, no production dependencies or credentials, and no changes to application source. First revalidate exact candidate sources, licenses and toolchain versions; then select one candidate to test only if its license and maintenance risks are accepted. Pin the source commit, compiler, provider, suite and web/Android bridges before build.

Bound the evaluation to:

1. Prove a minimal Android Kotlin peer and supported browser peer can create compatible state and exchange synthetic 1:1 MLS messages through an opaque local relay.
2. Verify welcome/add, application message, commit/remove, offline delivery, duplicate/reorder handling, unknown version, restart/reload, atomic state persistence and corrupted-state failure behavior.
3. Record exact target/browser/API versions, build/test commands, lockfiles, hashes, license inventory, results and failures.
4. Do not test real accounts, production backend, real conversations, attachments, voice, recovery or production rollout.
5. Submit the results for independent protocol/application review. Only after that, request a separate product/security decision on protocol/library selection.

If MLS candidate licensing/support fails review, return to the decision gate and compare a specific Signal-family application stack or other standards-based candidate with the same evidence bar. Do not modify production or silently substitute another protocol.

## 10. Sources and limitations

### Repository documents and source inspected

- `docs/security/phase-3g-implementation-contract.md`
- `docs/security/phase-3g-threat-model.md`
- `docs/security/phase-3g-open-decisions.md`
- `docs/security/phase-3f-feasibility-report.md`
- `docs/security/e2ee-protocol-selection.md`
- `docs/security/e2ee-protocol-decision.md`
- `docs/security/mls-phase-3e-report.md`
- `docs/security/e2ee-recovery-audit.md`
- `android/gradle/libs.versions.toml`; `android/app/build.gradle.kts`
- `android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/ui/ChatViewModel.kt`
- `android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/data/MessagesRepository.kt`
- `android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/data/MessageDecryption.kt`
- `android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/data/AndroidMessageDeviceKeyRegistrar.kt`
- `android/core/security/src/main/kotlin/com/kothabarta/core/security/AndroidE2eeKeyManager.kt`
- `android/core/security/src/main/kotlin/com/kothabarta/core/security/WebE2eeDecryptor.kt`
- `android/core/network/src/main/kotlin/com/kothabarta/core/network/messages/MessagesDtos.kt`
- `client/package.json`; `client/src/utility/crypto.js`; `client/src/pages/message/hooks/useMessageActions.js`; `useEditMessage.jsx`
- `server/src/models/Conversation.js`; `server/src/models/User.js`; `server/src/utils/messageSecurity.js`; `server/src/routes/chat.routes.js`; `server/src/routes/users.routes.js`; `server/src/server.js`

### Authoritative external references

Checked 2026-10-29:

- [RFC 9420 — The Messaging Layer Security (MLS) Protocol](https://www.rfc-editor.org/rfc/rfc9420) (Standards Track).
- [RFC 9750 — The Messaging Layer Security Architecture](https://www.rfc-editor.org/rfc/rfc9750) (Informational).
- Signal specifications: [PQXDH](https://signal.org/docs/specifications/pqxdh/), [X3DH](https://signal.org/docs/specifications/x3dh/), [Double Ratchet](https://signal.org/docs/specifications/doubleratchet/), and [Sesame](https://signal.org/docs/specifications/sesame/).
- Official project docs: [OpenMLS README](https://github.com/openmls/openmls/blob/main/README.md), [`signalapp/libsignal` README](https://github.com/signalapp/libsignal/blob/main/README.md), and [`signalapp/libsignal` LICENSE](https://github.com/signalapp/libsignal/blob/main/LICENSE).

### Limitations

- No candidate source was checked out, installed, compiled or executed.
- GitHub MCP repository-file retrieval failed for some candidate files. mls-rs current upstream state, current release/version/license and maintenance status remain open; historical repository evidence is not substituted for current verification.
- No device/emulator, browser interoperability, benchmark, fuzzing, cryptographic review, legal review or independent audit occurred.
- This is a feasibility decision gate, not a security certification or production protocol selection.

## 11. Validation and stop condition

- Initial Git status was inspected before reading or editing. It contained only four pre-existing untracked Phase 3F/3G design documents; no staged or tracked changes were present.
- The intended report did not exist before this task. Only `docs/security/phase-3g-1-protocol-evaluation.md` was created.
- Markdown content was checked for relative-link resolution, trailing whitespace and conflict markers after creation.
- No application tests, builds, lint, dependency installation, candidate code execution, device tests, deployment, migration or commit were run/performed.
- Production source/API/schema/data/key/configuration/dependencies remain untouched.

**Stop at this evaluation gate.** Protocol and library remain unselected. The next step is explicit authorization for the bounded synthetic MLS harness proposal in section 9, after license/maintenance preconditions are accepted. No implementation is authorized by this report.
