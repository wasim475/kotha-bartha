# Phase 3G-2 — Authorized Isolated Synthetic MLS Harness

**Checked:** 2026-10-29
**Outcome:** **STOPPED AT PREFLIGHT.** No MLS harness was created or run.
**Candidate considered:** `awslabs/mls-rs` at the historical pinned source baseline recorded by Phase 3E; not selected for production.

## 1. Executive result

The authorized synthetic runtime evaluation could not safely proceed with the tooling and source available in this environment.

- `rustc`, `cargo`, `rustup`, `wasm-pack`, and `wasm-bindgen` were not on PATH. The known per-user Cargo installation/cache location (`%USERPROFILE%\.cargo`) was absent.
- Android SDK files exist at `%LOCALAPPDATA%\Android\Sdk`, including `platform-tools\adb.exe`, `emulator\emulator.exe`, and Android platform 35; no `ndk` directory was present. `ANDROID_SDK_ROOT` and `ANDROID_HOME` were unset. The executable tools were not run.
- No local `mls-rs` checkout, Cargo manifest, synthetic harness, or candidate package was found in the checked paths; `client\node_modules` contains no matching MLS/Signal/crypto package.
- The candidate source and Cargo dependency graph are not available locally. Retrieving the pinned source and crates would require external network access and dependency downloads. Installing Rust/Cargo, WASM tooling, and Android NDK would also be required for the proposed Android/Web evaluation.
- The user explicitly instructed that if toolchain setup, dependency installation, or external network access is required, stop and report that requirement. No such setup, fetch, installation, or candidate build was attempted.

Consequently, no protocol behavior was tested. There are no synthetic setup, encryption/decryption, authentication, integrity, context-binding, replay, tampering, membership, key evolution, recovery, reproducibility, or cross-platform results to report. **Android-Web interoperability remains untested and unestablished.**

## 2. Initial Git status and scope

Initial `git status --short` showed the following **pre-existing untracked user documents**:

- `docs/security/phase-3f-feasibility-report.md`
- `docs/security/phase-3g-1-protocol-evaluation.md`
- `docs/security/phase-3g-implementation-contract.md`
- `docs/security/phase-3g-open-decisions.md`
- `docs/security/phase-3g-threat-model.md`

There were no staged or tracked changes. These files were preserved and not modified.

The planned and only report addition for this task is `docs/security/phase-3g-2-mls-harness-report.md`. No isolated workspace was created because the preflight stop condition was met. No production source, API, schema, database, key, configuration, dependency, deployment or migration was touched.

## 3. Candidate and evidence

### 3.1 Candidate considered

The Phase 3E report records this immutable historical `awslabs/mls-rs` candidate baseline:

- Source commit: `8f1b43f447a792ff9307f1c2c7f54da63914870e`
- `mls-rs`: 0.56.0
- RustCrypto provider: 0.22.1
- `mls-rs-uniffi`: 0.13.0
- UniFFI dependency line: 0.31
- Historically reported license: Apache-2.0 OR MIT

These are **historical repository-document claims**, not freshly verified current upstream state or legal approval. The pinned candidate source and license files were not present locally and were not retrieved. Exact current support, advisories, maintenance status, license, dependency graph and build scripts remain unverified.

The Phase 3E report also notes that the upstream UniFFI wrapper hardcodes OpenSSL/OpenSSL provider; a RustCrypto integration would require a project-owned adapter, and that provider path was described as experimental. This was not checked against the pinned source in this task.

### 3.2 Source and build execution risks

No candidate source or build script was executed. Without a local checkout, it was not possible to inspect the exact `build.rs` scripts, dependency build scripts, native link steps, or network behavior for the pinned revision.

Before any later run, inspect the exact pinned source and every selected transitive dependency for:

- Cargo build scripts and proc macros that execute during compilation;
- native C/C++/OpenSSL or other provider compilation and linker behavior;
- build-time downloads, code generation, environment-variable reads, filesystem writes, or subprocess invocation;
- test harness network access and any examples that connect outside loopback;
- the exact license and notices for all direct/transitive crates.

Cargo compilation can execute dependency build scripts and may download crates unless configured offline. Neither behavior was exercised. A future evaluation must use a disposable workspace and clean, allow-listed environment; it must not inherit production credentials or connect to production services.

## 4. Environment preflight

### Commands/checks actually run

| Check | Result |
|---|---|
| `git --no-pager status --short`; staged and tracked diff summaries | Completed first; five pre-existing untracked Phase 3F/3G documents, no staged/tracked changes. |
| `Get-Command` and `--version` probes for Rust/Cargo/rustup, WASM tools, adb, Java, Gradle, Node/npm, Git | Rust, Cargo, rustup, wasm-pack, wasm-bindgen, adb, Gradle absent from PATH; Java 21.0.4, Node 24.16.0, npm 11.13.0 and Git available. |
| Inspect `ANDROID_SDK_ROOT`, `ANDROID_HOME`, `CARGO_HOME` | All unset. |
| Inspect known local tool locations | `%USERPROFILE%\.cargo\bin` and `%USERPROFILE%\.cargo` absent. Android SDK present under `%LOCALAPPDATA%\Android\Sdk`; cached Gradle 8.12.1 directory exists but is unrelated to MLS evaluation. |
| Inspect SDK `platform-tools\adb.exe`, `emulator\emulator.exe`, `ndk`, and `platforms` | adb and emulator binaries present; NDK absent; Android platform 35 present. Binaries were not executed. |
| Inspect client `node_modules` for MLS/Signal/crypto candidate packages | No matching candidate package found. |
| Search likely local `mls-rs` source locations | No candidate checkout found in the checked locations. |
| Read approved documents and Phase 3E feasibility evidence | Completed read-only; exact candidate and historical toolchain requirements recorded below. |
| First PowerShell tool probe | Did not execute because of a PowerShell string-interpolation parse error; corrected read-only probe completed successfully. No repository action resulted from the failed probe. |

### Required for a future runtime harness

At minimum, a separately authorized and reproducible setup would require:

1. A verified checkout of the exact candidate commit and license files, plus dependency sources/lock state. This requires external network access unless the owner supplies a verified local mirror/cache.
2. A pinned Rust toolchain compatible with the exact source; Rust/Cargo are currently absent. The historical report only establishes a declared MSRV, not a fully tested compiler version.
3. Android NDK/toolchain and Rust Android targets for native Android bindings; the local SDK has no NDK.
4. A supported WebAssembly toolchain (`wasm32-unknown-unknown` and version-matched wasm-bindgen, or another verified route); these are absent.
5. Any required UniFFI generator and a reviewed provider/configuration. The documented Android wrapper/provider mismatch must be resolved from the exact source before building.
6. Written permission for dependency/source downloads and toolchain installation, with a clean environment and no production credentials.

The SDK has `adb` and emulator executables, but no attached device/AVD status was checked in this task. Those binaries alone do not enable candidate execution without the missing NDK, Rust targets, built artifacts and harness.

## 5. Evaluation result

All requested runtime test cases are **NOT RUN — PREFLIGHT BLOCKED**:

| Test | Result | Reason |
|---|---|---|
| Synthetic participant setup | Not run | Candidate source, Cargo and runnable harness absent. |
| Encryption/decryption | Not run | No candidate library or harness built. |
| Sender authentication/message integrity | Not run | No protocol execution or synthetic credentials. |
| Wrong-context rejection | Not run | No configured protocol application context or peers. |
| Replay handling | Not run | No candidate state or transport harness. |
| Tampered-message rejection | Not run | No candidate execution. |
| Group membership changes | Not run | No candidate runtime, group state or synthetic relay. |
| Key evolution/recovery limitations | Not run | No protocol state or recovery harness. |
| Reproducibility/failure behavior | Not run | No lockfile/build/test execution. |
| Android-Web interoperability | Not run | No Android or Web candidate artifacts; no peer exchange. |

No result here should be interpreted as a pass or failure of MLS itself. No cryptographic security conclusion is drawn.

## 6. Limitations and unresolved security decisions

- The application has no MLS implementation in its Android or Web dependencies.
- Current Android outbound messaging sends plaintext; current server envelope checks are structural and are not a cryptographic verification mechanism. This harness would not change or remediate those production facts.
- Account/device enrollment, verification, key directory consistency, revocation, device quorum, history recovery, group authorization, relay ordering, replay/idempotency and offline retry policy remain unresolved in the approved design documents.
- Backend opaque-relay behavior, REST/Socket.IO parity, notification privacy, logging, search, backup and storage controls were not runtime-tested.
- Historical Legacy messages cannot be converted into authenticated MLS history by a protocol harness.
- No independent protocol, library, integration, mobile, Web, backend, legal or license review was performed.
- A future successful synthetic test would establish only the tested candidate/build/configuration behavior, not full protocol security or production suitability.

## 7. Recommendation

**STOP pending additional authorization and prerequisites.** Do not proceed to a production protocol/library selection or implementation.

If the owner wants the isolated evaluation resumed, explicitly authorize:

1. External network access to retrieve the pinned source and dependency crates (or provide verified local mirrors).
2. Installation of pinned Rust/Cargo, WASM tooling, Android NDK and any required binding generator.
3. A disposable workspace outside production source, a clean credential-free environment, and build-script/dependency review before execution.
4. A bounded command plan and any expected disk/system changes before setup begins.

After authorization, first inspect the exact source/build scripts and license/maintenance evidence. Only if safe isolation is established should a minimal loopback-only harness be created with synthetic identities, followed by version-pinned tests. Report any need for broader permissions before proceeding. No Android-Web interoperability should be claimed without a real peer-to-peer test using documented compatible configurations.

## 8. References inspected

### In-repository documents

- `docs/security/phase-3g-1-protocol-evaluation.md`
- `docs/security/phase-3g-implementation-contract.md`
- `docs/security/phase-3g-threat-model.md`
- `docs/security/phase-3g-open-decisions.md`
- `docs/security/phase-3f-feasibility-report.md`
- `docs/security/mls-phase-3e-report.md`
- `docs/security/mls-prototype-environment.md`
- `docs/security/e2ee-protocol-selection.md`

### Repository source/manifests rechecked

- `android/gradle/libs.versions.toml`
- `android/app/build.gradle.kts`
- `client/package.json`
- `android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/ui/ChatViewModel.kt`
- `android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/data/MessagesRepository.kt`
- `server/src/models/Conversation.js`
- `server/src/utils/messageSecurity.js`
- `server/src/routes/chat.routes.js`

No external candidate source was fetched or executed. The exact candidate details above derive from the historical Phase 3E report and remain subject to fresh source, license and maintenance verification.

## 9. Final verification and stop

- Only this requested report was added by this task.
- The five pre-existing untracked Phase 3F/3G documents remain preserved.
- No isolated workspace or candidate artifact was created.
- No toolchain or dependency was installed; no external source or dependency was fetched.
- No candidate code/build script was executed.
- No tests, builds, device tests, deployment, migration or commit were performed.
- Production source, APIs, schemas, databases, keys, configuration and dependencies remain untouched.
- Report consistency, whitespace, internal relative links and final Git status were checked after creation; results are summarized in the task response.

**Stop here.** No production protocol is selected, and no implementation has begun.
