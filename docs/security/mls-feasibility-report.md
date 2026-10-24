# Kotha-Barta Phase 3: MLS feasibility report

**Date:** 2026-10-24
**Decision:** **CONDITIONAL** — the protocol/library direction is plausible, but this run could not build an isolated prototype or demonstrate Android↔Web interoperability. This is not a pass and does not approve production use.
**Scope:** Repository and upstream review plus execution-environment checks. Production code, dependencies, APIs, schemas, message formats, and cryptographic behavior were not changed.

## 1. Executive summary

RFC 9420 MLS remains a plausible target for Kotha-Barta. The current `mls-rs` source advertises WASM builds, configurable storage, and an Android-facing UniFFI wrapper. Those are useful building blocks, but they do not demonstrate that a production Android build and browser build can exchange interoperable MLS messages and safely persist/restore their own state.

The decisive test was **not run**. This workspace has no Rust compiler or Cargo; `wasm-pack`, `wasm-bindgen`, and `adb` are also unavailable. The Gradle wrapper could not download its configured Gradle distribution because outbound network access failed. No Rust/WASM project or Android native library was created, so claiming group creation, Welcome, message exchange, restart restoration, or cross-platform interoperability would be false.

Upstream evidence adds concrete qualification concerns:

- `mls-rs` calls its WebCrypto provider experimental and unsupported, despite advertising WASM build support.
- The published `mls-rs-uniffi` crate is `0.1.0` (7 June 2026), defaults to in-memory group storage, uses the OpenSSL provider and Basic Identity Provider, and exposes only the `Curve25519Aes128` suite in its public wrapper. A custom storage interface exists in the wrapper source, but no Android Keystore integration is provided by that fact alone.
- The current repository's `mls-rs-uniffi` design question about Android support, persistent state, releases and cross-platform interop remains open on the reviewed upstream issue. The repository reports no full third-party security audit.

Accordingly, this report records **feasibility signals and blockers**, not prototype test results. Continue only in a Rust-enabled environment with an isolated client pair and the real platform outputs. Do not modify production flows until that test and the separate security gates pass.

## 2. Exact versions and environment

### Repository versions

| Component | Observed version/configuration |
|---|---|
| `mls-rs` protocol target | RFC 9420 / MLS 1.0 target from Phase 2 decision |
| `mls-rs` engine | No crate version selected or built in this run |
| Published `mls-rs-uniffi` | `0.1.0`, docs.rs publication dated 2026-06-07; dependencies include `mls-rs ^0.39.0`, OpenSSL provider and UniFFI `^0.26.0` |
| Android Gradle Plugin | `8.8.0` |
| Kotlin | `2.0.21` |
| Android SDK | compile/target SDK `35`; min SDK `26`; Java bytecode target `17` |
| Java runtime present | OpenJDK `21.0.4` |
| Node.js present | `v24.16.0` |
| Web app | React `19.2.4`, Vite `8.0.1`; no existing test script in `client/package.json` |
| Backend | Express `5.2.1`, Socket.IO `4.8.3`; current message API transports existing plaintext/static-ECDH shapes only |

### Execution environment checks

- Windows PowerShell workspace.
- `rustc --version` and `cargo --version`: unavailable (`CommandNotFoundException`).
- `rustup`, `wasm-pack`, `wasm-bindgen`, and `adb`: not found on PATH.
- `android/gradlew.bat --version`: attempted; failed while downloading the configured Gradle `8.12.1` distribution because the network connection could not be established. No Gradle build or Android device test ran.
- A browser automation runtime was not available in this execution environment.

These are environment blockers, not protocol test failures.

## 3. Prototype architecture and files

The requested prototype architecture is two independent MLS clients, A and B, with isolated identity and storage, and a message relay that transfers only MLS protocol messages:

1. A creates an MLS group and publishes/exports a valid KeyPackage flow for B.
2. A adds B, processes its own commit, and delivers the Welcome plus required public group information to B.
3. B joins from Welcome; A and B exchange MLS application messages in both directions.
4. Each client writes current MLS state to its own durable local store, exits, restores from that store, processes any queued messages, and continues exchanging messages.
5. The same message bytes and compatible MLS configuration must cross actual Android and Web runtimes for the decisive interoperability test.

**No prototype source or fixture was created.** Without Rust/Cargo and the native/WASM toolchains, creating an uncompiled API scaffold would not validate feasibility and risks baking in stale or invented `mls-rs` APIs. The only file created for this phase is this report.

## 4. Android integration findings

- The app uses Kotlin `2.0.21`, AGP `8.8.0`, Java 17 bytecode and min SDK 26. There is no Rust/UniFFI module, native Rust build, generated binding, or MLS dependency in the app.
- UniFFI is a technically plausible JNI boundary for a Rust engine, but it requires building and packaging matching `.so` libraries for the app's supported Android ABIs, generating bindings from a pinned wrapper, and maintaining version compatibility. None of these steps was validated here.
- The published wrapper source maps only `Curve25519Aes128` to MLS cipher suite 1 and constructs `OpensslCryptoProvider` plus `BasicIdentityProvider`. That is a wrapper-specific configuration, not evidence that it matches a browser's provider or Kotha-Barta's future identity/credential design.
- The wrapper's default `ClientConfig` creates `InMemoryGroupStateStorage`. The source exposes a `GroupStateStorage` interface and adapts stored state through byte arrays, so persistence may be implementable, but default configuration loses state on process death. Durable storage and transaction semantics need an actual binding test.
- Android Keystore does not automatically protect arbitrary MLS state. A feasible app design would encrypt the database/state blob with a random local key protected by a Keystore key, subject to backup/device-transfer policy. This protects at-rest data under defined device conditions; it does not make MLS state portable, prevent a running compromised app from using it, or create group history on a new device.
- Atomic state transitions need a single-writer transaction. Persisting an old snapshot after a newer epoch commit could roll state back; a process crash between accepting a commit and persisting the resulting state can desynchronize the client. No current Android behavior was tested.
- No Android emulator/device (`adb`) was available. Low-end device performance, ABI packaging, process death, concurrency, and restore are untested.

## 5. Web integration findings

- The current client is React/Vite and has no MLS/WASM dependency or browser MLS test harness.
- Upstream `mls-rs` says it supports WASM builds, but its README labels the WebCrypto provider experimental and unsupported. “Compiles to WASM” is not the same as a supported browser integration or an interoperable JS API.
- No official, version-pinned browser binding or supported storage adapter was identified for this repository in the reviewed upstream interface. A custom `wasm-bindgen` wrapper may be technically possible but would be Kotha-Barta-owned FFI surface requiring its own review.
- Browser state persistence would need atomic IndexedDB writes tied to every state-changing operation. IndexedDB can store structured data and CryptoKeys, but ordinary MLS serialized state is not automatically a non-extractable key or protected from same-origin script execution. XSS can act through a live client even when storage bytes are encrypted.
- Multi-tab state mutation must be serialized (for example, one elected writer or transactional version checks). Otherwise two tabs can apply operations from the same epoch and persist conflicting state. Account ID, group ID and device ID must be independently namespaced; logout and browser data eviction behavior need explicit UX.
- No browser/runtime build or reload/crash recovery test ran.

## 6. Interoperability test results

| Test | Result |
|---|---|
| A creates group | Not run |
| B joins from valid Welcome | Not run |
| A→B application message | Not run |
| B→A reply | Not run |
| Persist, restart and restore both clients | Not run |
| Continue exchange after restore | Not run |
| Android creates, Web joins | Not run |
| Web creates, Android joins | Not run |
| Shared official vectors on Android and Web | Not run |

**Interoperability evidence: none.** No plaintext relay simulation, manually copied key, custom wrapper, or same-runtime test is represented as cross-platform evidence.

## 7. State persistence results

No persistence behavior was executed. Upstream source inspection found:

- `mls-rs` engine supports storage-provider interfaces; its README describes in-memory and SQLite storage implementations.
- Published `mls-rs-uniffi` default storage is in-memory. Its current source allows a caller-supplied group storage trait, but suitability of generated Kotlin callback bindings, atomicity, data format stability, secret zeroization, and Android Keystore wrapping has not been demonstrated.
- Browser storage would require a separately implemented and tested durable provider or wrapper. WASM compilation does not answer persistence, transaction or account-isolation requirements.
- Persistence must be treated as sensitive mutable protocol state. Do not upload it as a recovery backup or copy it to another device without a separate approved protocol.

## 8. Failure scenarios and required handling

These are test cases for the next prototype run; their behavior is **unknown until run**:

- Welcome or commit lost, duplicated, reordered, or replayed.
- Two clients commit simultaneously from the same epoch; relay presents conflicting forks.
- Client receives an application message from an unknown/stale epoch.
- Crash after MLS accepts a state change but before durable commit, and crash during the storage transaction.
- Storage corruption, rollback to an older snapshot, or group state missing after reinstall/browser eviction.
- Duplicate delivery after restart and out-of-order application messages.
- KeyPackage expiry/reuse and Welcome delivery delay.
- Device removal while the removed device is offline; attempted re-add with stale state.
- Concurrent Android coroutines or Web tabs mutating one group.
- User switch/logout while an operation is pending.

MLS provides cryptographic group state transitions and authenticated message processing under its protocol rules. The application still needs reliable delivery, commit sequencing, duplicate handling, fork policy, storage transactions, KeyPackage inventory/expiry, device authorization, recovery, UI for stale state, and server-side size/routing controls. A library choice alone does not solve these application behaviors.

## 9. Known limitations and security gaps

- Current Web uses static ECDH P-256/AES-GCM, permits plaintext fallback and is incompatible with MLS. Android is plaintext-only. Existing messages were not migrated.
- No credential issuance, account-to-device binding, trusted-device approval, key transparency, device revocation flow, group bootstrap policy, or metadata policy was prototyped.
- `mls-rs` upstream reports no full independent third-party audit; its WebCrypto provider is experimental/unsupported.
- Public `mls-rs-uniffi` is `0.1.0` and source API may differ from current engine `main`. Its default state store is in-memory. Current source exposes a restricted suite/provider configuration.
- Upstream issue [#370](https://github.com/awslabs/mls-rs/issues/370) asking for supported mobile, persistence, release and interoperability details remains open/unanswered in the reviewed page. This is evidence of an unresolved support question, not evidence of a vulnerability.
- RFC 9420's forward secrecy, post-compromise security, and membership properties are conditional on correct epoch operation, credential validation, implementation, secure state management, and application policy. No such guarantee was tested here.
- Metadata (membership, message sizes, timestamps, delivery/read state, push routing) remains visible unless separately redesigned.
- Android Keystore protects local key use/storage within its platform limits; it does not give Web a shared trust boundary or safely migrate a live MLS group to a second device.

## 10. Build and test commands

No prototype build command exists because no prototype workspace or Cargo manifest was created. The attempted environment checks were:

```text
rustc --version          -> command not found
cargo --version          -> command not found
wasm-pack --version      -> command not found
wasm-bindgen --version   -> command not found
adb devices              -> adb unavailable
android/gradlew.bat --version -> Gradle 8.12.1 download failed (network unavailable)
```

Do not run `cargo test` against an unpinned upstream `main` and call it a prototype test. The next run should first pin an exact `mls-rs` commit/crate release and build two genuine clients with locked dependencies. Then record reproducible platform-specific commands from that prototype's actual manifests, including the WASM browser test runner and Android ABI build/install commands.

## 11. Reproducibility instructions

To resume the feasibility prototype in a toolchain-enabled environment:

1. Provide a Rust stable toolchain and Cargo, the pinned Android NDK/SDK, Gradle 8.12.1, a browser with WebAssembly + WebCrypto, `wasm-pack`/`wasm-bindgen` as required by the selected binding, and an Android emulator/device with `adb`.
2. Pin a released `mls-rs` engine and wrapper together. Do not mix the published `mls-rs-uniffi 0.1.0` dependency set with unpinned current `main`.
3. Implement a temporary relay that stores and forwards only actual MLS wire messages. Use two separate local storage roots and generated synthetic identities.
4. First validate native A↔B Welcome, application send/reply, persistence/restart. Then validate actual Android↔Web messages in both directions, using identical protocol version, cipher suite, credential rules, extensions and serialization.
5. Persist after each state transition with atomic single-writer semantics. Add crash/rollback/replay/duplicate/commit-race tests before reporting the test as passed.
6. Record test output, exact versions, hashes, ABI/browser versions and known limitations. Remove all test identities and state from the environment.

This list is a setup checklist, not a claim that the above tests have been run.

## 12. Remaining production decision gates

1. Demonstrate genuine Android↔Web interop using actual supported platform bindings and an exact locked release.
2. Resolve upstream or internal ownership for Android wrapper support, release cadence, ABI/toolchain matrix, and urgent security fixes.
3. Select and review stable crypto providers. Do not ship the experimental WebCrypto provider without explicit qualification and independent review.
4. Implement and test durable atomic state providers; decide encryption-at-rest, backup exclusion, state migration, concurrent tab/device writer and crash recovery semantics.
5. Review `mls-rs` and the complete FFI/provider/storage integration independently; upstream states no full third-party audit has been completed.
6. Specify account/device credentials, enrollment authorization, key change verification, KeyPackage publication/expiry, revocation, multi-device group topology and fork/commit ordering.
7. Specify history/recovery separately; adding a member to the current epoch does not restore past message history.
8. Define versioned server relay/API payloads, no plaintext fallback after E2EE opt-in, legacy migration/rollback, attachments, edits/replies/deletes, and metadata exposure.

## 13. Decision

**CONDITIONAL.** Documentation suggests the engine has useful protocol functionality and storage extension points, but Kotha-Barta's required Android/Web build, durable storage, and interoperability are unproven. The prototype was not executable in this environment, and the public Android wrapper evidence is not yet sufficient for a production support decision. No production changes are authorized by this report.

Do not claim MLS feasibility has passed and do not connect MLS to production messaging until the genuine cross-platform test and all separate security gates above are complete.

## Sources checked 2026-10-24

- [RFC 9420: MLS Protocol](https://www.rfc-editor.org/rfc/rfc9420.html)
- [RFC 9750: MLS Architecture](https://www.rfc-editor.org/rfc/rfc9750.html)
- [`mls-rs` repository and README](https://github.com/awslabs/mls-rs) — WASM claim, providers, storage and upstream audit statement.
- [`mls-rs-uniffi` published crate documentation](https://docs.rs/mls-rs-uniffi/latest/mls_rs_uniffi/) — published version, dependencies and wrapper description.
- [`mls-rs-uniffi` configuration source](https://github.com/awslabs/mls-rs/blob/main/mls-rs-uniffi/src/config.rs) — provider, identity provider, default in-memory storage and storage trait.
- [`mls-rs-uniffi` wrapper source](https://github.com/awslabs/mls-rs/blob/main/mls-rs-uniffi/src/lib.rs) — currently exposed cipher suite and wrapper methods.
- [Upstream issue #370](https://github.com/awslabs/mls-rs/issues/370) — open questions on production mobile support, persistence, releases and interop.
- [Upstream issue #376](https://github.com/awslabs/mls-rs/issues/376) — mobile production support and audit roadmap questions.
