# KothaX E2EE Phase 2: protocol and library selection

**Date:** 2026-10-24
**Status:** Protocol direction recommended; production library choice gated on a cross-platform prototype and security review.
**Scope:** Documentation and evidence review only. No application code, database schema, dependency, message payload, or existing cryptographic behavior was changed.

## Executive recommendation

Adopt **Messaging Layer Security (MLS), RFC 9420**, as the target protocol for new encrypted conversations, with one MLS group per conversation and each enrolled device represented as a distinct member. RFC 9750 explicitly allows groups of two clients and notes that MLS is an end-to-end security layer that must be integrated into an application. This gives KothaX a single protocol direction for 1:1, future groups, multi-device membership, offline additions, membership changes, forward secrecy (FS), and post-compromise security (PCS), without implementing a custom ratchet.

Keep **`mls-rs` as the lead implementation candidate**, not an approved production dependency. Its upstream project states RFC 9420 conformance, WASM build support, configurable storage, test vectors, and Apache-2.0/MIT licensing. However, its WebCrypto provider is marked experimental, the project says it has not received a full third-party security audit, and the public evidence reviewed here does not establish production support for the Android UniFFI wrapper or prove interoperable Android/Web persisted state in this app. Prototype that exact boundary before selecting a release. OpenMLS is a credible alternative but marks Android and WASM targets as built but unsupported/untested in CI. No library passes every KothaX requirement on documentation evidence alone.

Do not use Signal `libsignal` as the default dependency for this app. Its protocol design is a strong 1:1 reference, but its upstream says use outside Signal is unsupported, its language APIs and bridge layers may change, and it is AGPL-3.0. It also does not by itself settle KothaX's multi-device directory, approval, history sync, recovery, or group policy. This is a product/legal/maintenance fit decision, not a claim that Signal's protocol is cryptographically weaker.

This is a conditional direction, not a security certification. The current application must keep its existing behavior until a later implementation phase has an approved protocol, library/version, device lifecycle, recovery policy, and no-downgrade rollout.

## Method and evidence

Reviewed the Phase 1 audit at [`android-e2ee-implementation-plan.md`](android-e2ee-implementation-plan.md), repository Android/Web message and key paths referenced there, current upstream project documentation/repositories/releases, and the IETF RFC Editor and Signal specifications. Sources below were checked on 2026-10-24. Upstream README claims are treated as project claims, not independent audits. No cryptographic code was built, run, or independently reviewed for this document.

### Existing application state

- Web currently creates a non-extractable P-256 ECDH key per browser device, stores it in IndexedDB, publishes a public JWK, and derives a static AES-GCM key. The format has no application protocol version, explicit HKDF context, authenticated conversation/message identity, ratchet, or replay counter.
- Web's send/edit paths can fall back to plaintext when encryption or recipient keys are unavailable. Existing messages, attachments and some metadata do not share a consistent E2EE envelope.
- Android has no matching E2EE implementation or encrypted send format; it sends plaintext and cannot decrypt the current Web payloads.
- Public device keys are server-listed without signed enrollment, approval, verifiable key history, or a revocation protocol. New devices cannot decrypt old per-device ciphertext. Existing recovery audit also documents the lack of a safe implemented recovery path.

These findings are from Phase 1, not claims newly verified by an end-to-end runtime test. The current Web wire format is not a suitable protocol to port to Android.

## Protocol comparison

| Requirement | Signal family (X3DH/PQXDH + Double Ratchet; Sesame for multi-device) | MLS (RFC 9420) |
|---|---|---|
| 1:1 asynchronous messaging | Strong fit; pairwise session and prekeys | Supported as a two-client group by RFC 9750 |
| Future groups | Requires a separate group construction/strategy; Double Ratchet is pairwise | Native group protocol and membership epochs |
| Multi-device | Sesame describes asynchronous multi-device session management, but application server/device orchestration remains | Model each device as a distinct member; application still defines account/device identity and authorization |
| FS / PCS | Double Ratchet specifies per-message key evolution and recovery after fresh DH input | RFC 9420 provides evolving group epochs and FS/PCS properties subject to operation and membership policy |
| Async/offline | Prekey-based session establishment; application must provision and replenish bundles | KeyPackages permit asynchronous addition; the Delivery Service must store/route protocol messages |
| Ordering, replay, duplicates | Ratchet state and message counters help; storage, retry and duplicate policy remain application work | Epoch/commit ordering and delivery-service consistency are application concerns; MLS does not provide a complete chat transport |
| Cross-platform library evidence | libsignal has Java, Swift and TypeScript APIs, but third-party use unsupported and APIs can change | mls-rs advertises WASM and has UniFFI crates; WebCrypto provider experimental. OpenMLS has WASM bindings; Android/WASM CI targets are explicitly unsupported/untested |
| License / maintenance fit | AGPL-3.0; upstream release/API policy and third-party support require acceptance | mls-rs Apache-2.0 OR MIT; OpenMLS MIT. Both require ongoing dependency/security review |
| KothaX conclusion | Reference only; do not select libsignal without explicit license and support acceptance plus app-level design | Preferred protocol family; mls-rs lead candidate, gated on a real Android/Web interop and persistence spike |

The FS/PCS statements describe protocol capabilities, not a guarantee against compromised endpoints, malicious credential issuance, unsafe storage, unavailable ratchet input, or implementation defects. MLS also requires compatible choices for protocol version, cipher suite, credentials, extensions, delivery ordering, and application payload conventions before two clients interoperate.

## Library assessment

### `mls-rs` — lead candidate, not yet approved

- The upstream describes an RFC 9420 implementation, asynchronous KeyPackages, group membership evolution, FS/PCS, customizable credentials, test vectors, and storage-provider interfaces.
- It advertises WASM builds and includes WebCrypto, RustCrypto, OpenSSL/AWS-LC and CryptoKit provider crates. Its README labels WebCrypto as experimental; therefore the browser path is not accepted for production without benchmarking, browser support validation, persistence/reload testing, and review of crypto provider behavior.
- The repository includes `mls-rs-uniffi`, but repository existence alone does not establish a supported Android production package, stable Kotlin API, release cadence, Android Keystore integration, or persisted-state compatibility with the browser build. These need an upstream-supported answer or a maintained internal wrapper and explicit ownership decision.
- The upstream security notice says RFC conformance validation has occurred but a full third-party security audit has not. Require independent review before broad rollout.
- Apache-2.0 OR MIT is a more practical default for this project than AGPL-3.0, subject to normal license review.

### OpenMLS — credible alternative

- OpenMLS implements RFC 9420, is MIT-licensed, has an active release history and includes an `openmls-wasm` crate.
- Its README lists `aarch64-linux-android` and `wasm32-unknown-unknown` among targets built on CI but explicitly says these are unsupported and not tested. It is therefore not stronger evidence for this project's two-platform requirement than mls-rs.
- The implementation requires application-provided traits/providers and storage integration. Its own security policy excludes consumer application code and provider/storage backends from library vulnerability scope; those remain KothaX responsibilities.

### Signal `libsignal` — not selected

- Signal's Double Ratchet specification remains a useful reference for 1:1 ratchet behavior, and Sesame is a useful reference for multi-device session management.
- The official `libsignal` repository says it is used by Signal clients, that external use is unsupported, and that Java/Swift/TypeScript APIs and bridge layers may change without notice. Its LICENSE is AGPL-3.0.
- A Web TypeScript surface and Android Java surface do not, by themselves, demonstrate supported third-party release artifacts or compatible persisted session state across those platforms. KothaX would also need to build the surrounding device directory, account/device authorization, history, recovery, and group story.

## Required architecture decisions before implementation

### Identity, device trust, and enrollment

1. Treat every installation as a separate cryptographic client/device, with its own MLS credential and local group state. A user account is not itself a shared device secret.
2. Define a server-authenticated but client-verified credential binding from account identity to device identity. A server-supplied device list alone is insufficient against malicious key substitution.
3. New device enrollment must be explicit: approve it from an existing trusted device using a short-lived signed authorization/QR transfer, or use a separately specified recovery flow. Do not silently enroll a device solely because it logged into the account.
4. Show device additions, removals and identity changes to users; provide a stable safety-number/fingerprint or equivalent out-of-band verification flow. Preserve key history and record what the server attested. Key transparency is desirable but requires a separate design.
5. Revocation must create an MLS membership removal/epoch change for every affected conversation. Removed clients must not receive future epoch secrets. A malicious server can still withhold or equivocate about delivery; clients need consistency/fork handling and clear stalled-state UX.
6. A newly enrolled device receives history only when an already trusted device explicitly transfers or re-encrypts selected history under an authenticated protocol. Membership in the current epoch does not recreate old message keys. No server-side plaintext/history recovery.

### Messaging and product semantics

- Use one conversation group, including two-person conversations, with one leaf per enrolled device. Specify how a person's multiple devices are displayed and how concurrent commits are serialized.
- The server remains a blind delivery/storage service for ciphertext, KeyPackages and Welcome messages. It may retain routing IDs, timestamps, delivery/read status, group membership events, ciphertext sizes, push tokens and traffic patterns unless separately minimized. E2EE does not hide this metadata by default.
- Define envelope/version and authenticated application data conventions: conversation identifier, sender device/credential, message identifier, message kind, reply/edit relation, attachment manifest, and application-level ordering/idempotency. Never trust a message ID or timestamp supplied outside the authenticated ciphertext for security decisions.
- Treat edits, deletes/unsend, replies, reactions, attachments and history as explicit product protocol operations. Encrypt message bodies and attachment content/keys/client filenames; document which edit/delete/reaction/read markers remain server-visible. A server-side delete cannot erase plaintext already seen or cached by a recipient.
- Use authenticated encrypted attachment blobs with random content keys and per-recipient/group delivery of those keys. Existing Cloudinary upload behavior must not be described as E2EE.
- Push previews remain generic; never include message plaintext, reply text or sensitive attachment metadata.
- Limit skipped/out-of-order state and message size; define retry, duplicate suppression, offline queue and state backup behavior. MLS does not replace these application policies.

### Threat model and limits

Assume an attacker can read/modify the database, control or observe delivery, replay/reorder/drop messages, and attempt to substitute or suppress device credentials. Protect message and attachment contents from the server, database readers, push providers and network observers. Explicitly address:

- **Malicious server/key substitution:** signed device credentials, authenticated enrollment, visible key changes, verification, and eventually key transparency; TLS/account authentication alone are not end-to-end identity verification.
- **Unauthorized enrollment/account takeover:** step-up approval, device inventory, revocation, alerts, and rekey all conversations after removal. E2EE cannot protect a device after the attacker controls the authenticated endpoint.
- **Replay, duplicates, ordering and forks:** MLS epoch processing plus application-level unique IDs, idempotent delivery, bounded queues, consistent commit policy, and recovery from competing commits. Never silently drop a message that cannot be processed; surface a recoverable sync error.
- **Local compromise / backup:** hardware-backed key protection where available, app-private storage, OS backup exclusion or encrypted backup, lock-screen/app-auth policy, logging/crash-report redaction, and secure state deletion. Device compromise can expose plaintext and live group state.
- **Metadata:** explain server-visible participants/devices, membership changes, timing, size, delivery/read indicators and network data. MLS does not make these private automatically.
- **Recovery:** recovery credentials and any backup become part of the trust boundary. A PIN alone has low entropy and can be guessed offline if it protects a copied encrypted backup; a server rate limit cannot prevent offline guesses. Use a high-entropy recovery key or a carefully designed memory-hard derivation plus strong encrypted key backup, and make the residual risk clear.

The future KothaX recovery PIN requirement, if a PIN-based option is approved after protocol and infrastructure review, is exactly five ASCII numeric digits held as a string (leading zeroes are valid). Five digits are still only 100,000 possibilities (~16.61 bits if uniformly random), so the PIN must not be the sole security boundary or be described as offline-brute-force safe. See the recovery audit for the candidate trust-service constraints and future validation/test plan.

Do not preserve a silent plaintext fallback for conversations marked E2EE. Once a conversation has committed to an E2EE version, server APIs must reject plaintext send/edit payloads for that conversation. If keys or protocol state are unavailable, fail closed with a clear retry/recovery state. Legacy plaintext conversations must remain explicitly labeled as legacy until both participants and all participating devices have completed a deliberate transition.

## Recovery policy options (decision still required)

| Option | Benefit | Cost / security consequence |
|---|---|---|
| Trusted-device transfer | Strong approval path; no server plaintext | Requires an existing working trusted device and proximity/QR or authenticated channel; does not help if all devices are lost |
| High-entropy recovery key + encrypted state/history backup | Can restore after all devices are lost, if backup covers the required state | Recovery key loss means permanent loss; backup format, epoch history and key rotation become critical; stolen backup plus weak PIN is vulnerable to offline guessing |
| Account/password-only reset | Simple UX | Must not restore E2EE keys or imply old history is recoverable; account control alone is not cryptographic authorization |
| No history recovery | Smallest trust surface and simplest protocol | Users permanently lose old history when all authorized devices are lost |

**Recommendation:** make trusted-device transfer the default enrollment path; decide explicitly between opt-in high-entropy recovery and no history recovery before implementation. Do not derive E2EE keys directly from the account password or a short PIN. Clearly distinguish recovery of account access, enrollment of a new device, recovery of current conversation state, and restoration of historical plaintext. These are different capabilities.

## Migration, rollout, and rollback

1. **Prototype gate:** compare mls-rs Android/Kotlin and browser WASM using identical RFC 9420 configuration, credential scheme, cipher suite, extension policy and binary test vectors. Test device enrollment/removal, asynchronous delivery, offline catch-up, duplicate/reorder/competing commits, persistent state close/reopen, low-end Android performance, Web browser compatibility, and corrupted backup recovery. Record library versions and state format.
2. **Security gate:** complete independent review of the chosen library version, provider, wrapper, storage, credential/identity scheme, server relay, and application envelope. Resolve license policy, release/update ownership, vulnerability response, and supported toolchains.
3. **Server groundwork:** add versioned opaque MLS delivery/storage and explicit conversation mode/capability negotiation. Validate size/type bounds and authorized routing; never let server processing decrypt application content.
4. **Client rollout:** ship Android and Web support behind opt-in/test conversations. Existing encrypted static-ECDH and plaintext messages remain distinguishable and readable only by clients with the old required key. Do not reinterpret old payloads as MLS.
5. **Conversation upgrade:** require all intended devices to be enrolled and compatible; show a clear transition and establish the first MLS epoch. After commitment, reject plaintext fallback, including edits and replies. Legacy clients must not be silently admitted to an E2EE conversation.
6. **Rollback:** stop creating new MLS groups/epochs if a severe issue requires rollback, but preserve and relay stored MLS messages/state and any supported read-only display. Never downgrade an upgraded conversation to plaintext, delete old ciphertext/key state, or claim a removed device can read future messages. Rollback must be a forward repair or remain fail-closed until compatible clients return.

## Unresolved gates

- Does the maintained `mls-rs-uniffi` artifact explicitly support production Android use, and is its Kotlin API/versioning policy adequate? If not, who maintains a native wrapper and its security updates?
- Is the `mls-rs` WASM/WebCrypto provider ready for production browser use? Which browser versions and storage adapter are supported, and what is the validated cryptographic provider configuration?
- Can Android and browser builds create/serialize/restore compatible MLS state and pass upstream interop vectors under the exact selected ciphersuite/credentials/extensions? This is unproven.
- What independent audits exist for the exact library/provider versions, and what is the remediation/update cadence? Upstream mls-rs explicitly reports no full third-party audit.
- What is the account-to-device credential authority, key verification/key transparency plan, and recovery option? A malicious credential authority can authorize substituted identities.
- Which current Web/Android clients will be supported during rollout, and how long can legacy plaintext conversations exist before forced migration is safe?
- How will attachments, reactions, edits, deletes, history sync, and server-visible delivery/read metadata be specified and tested?
- What message retention, epoch-history and recovery constraints are acceptable for storage cost and low-end devices?

**Stop condition:** if the prototype cannot demonstrate supported Android and browser builds, matching MLS configuration, durable state handling, and cross-platform interoperability without handwritten protocol primitives, do not ship E2EE or fall back to plaintext. Reopen library selection or fund the required maintained wrapper and review.

## Proposed milestones

1. Record maintainers' answers and license approval for mls-rs, its WebCrypto provider, and its Android binding.
2. Build an isolated, non-production interop spike with no user data; test official vectors plus Android↔Web cases and state restoration.
3. Specify credential/enrollment, device revocation, recovery, message envelope, attachments and no-downgrade semantics.
4. Obtain independent cryptographic and application-architecture review; resolve all stop-condition items.
5. Only then prepare a separate implementation plan and threat-model signoff. No production code change is authorized by this Phase 2 document.

## Sources checked 2026-10-24

- [RFC 9420: The Messaging Layer Security (MLS) Protocol](https://www.rfc-editor.org/rfc/rfc9420.html) — protocol, services, messages, epochs and security model.
- [RFC 9750: The Messaging Layer Security (MLS) Architecture](https://www.rfc-editor.org/rfc/rfc9750.html) — explicitly covers two-client groups and application responsibilities beyond MLS.
- [Signal Double Ratchet specification](https://signal.org/docs/specifications/doubleratchet/) and [Sesame specification](https://signal.org/docs/specifications/sesame/) — protocol references for 1:1 ratcheting and asynchronous multi-device management.
- [Signal `libsignal` repository](https://github.com/signalapp/libsignal) and [license](https://github.com/signalapp/libsignal/blob/main/LICENSE) — platform APIs, unsupported third-party use, API stability statement, AGPL-3.0.
- [mls-rs repository and README](https://github.com/awslabs/mls-rs) and [releases](https://github.com/awslabs/mls-rs/releases) — claimed conformance, providers, WASM, storage, license, security notice and release evidence.
- [OpenMLS repository and README](https://github.com/openmls/openmls), [releases](https://github.com/openmls/openmls/releases), and [security policy](https://github.com/openmls/openmls/security) — implementation/license, release and target support statements, security-policy scope.
