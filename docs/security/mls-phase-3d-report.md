# Phase 3D — Gradle Environment Verification & MLS Binding Feasibility

**Date:** 2026-10-24
**Decision:** **CONDITIONAL — isolated feasibility prototype only, after the listed environment and version gates.**
**Scope:** Read-only inspection plus this report. No source, dependency, wrapper, API, schema, message, recovery PIN, or production crypto behavior was changed.

## Executive summary

The current sandbox cannot verify the Android project with Gradle. The wrapper requests Gradle 8.12.1, but the effective wrapper cache contains only an incomplete `.part`/lock entry. A different Windows profile has an extracted Gradle directory and `.ok` marker, but no distribution ZIP was present for independent checksum verification; `.ok` is not authenticity evidence, and the sandbox identity has read-only access to that profile's cache. The wrapper and Android build were therefore not run.

The installed JDK and Android SDK are suitable starting points: JDK 21.0.4, API 35, and Android build tools are present. `adb` runs when invoked by its SDK path, but no device is attached. The Android NDK, Rust/Cargo, WASM binding tools, and an identified browser executable are unavailable in this environment.

Static version review found a Kotlin Gradle Plugin compatibility caveat: AGP 8.8 requires Gradle 8.10.2 or newer, which Gradle 8.12.1 satisfies. However, Kotlin Gradle Plugin 2.0.21 is fully supported only through Gradle 8.8 and AGP 8.5; Gradle 8.7–8.10 have a documented caveat. This project's Gradle 8.12.1 + AGP 8.8.0 + Kotlin 2.0.21 combination is outside that documented fully supported range. It may work, but needs a real project configuration/build in the developer's writable environment before being called verified.

For the prototype, the best fit remains one shared `mls-rs` Rust core with small project-owned Android UniFFI and WebAssembly/JavaScript adapters. The upstream UniFFI wrapper is not a drop-in: it uses OpenSSL and exposes suite 1, while the browser provider is experimental and has a different suite set. The upstream repo advertises RFC 9420 conformance, WASM builds, test vectors, and storage traits/providers, but also says it has not received a full third-party security audit. Android/Web interoperability, platform builds, and durable transactional storage remain unverified.

## Environment findings

| Check | Current result | Status |
|---|---|---|
| OS / architecture | Windows 11, `amd64` | **Verified** |
| Java | OpenJDK 21.0.4 (Android Studio JBR at `JAVA_HOME`) | **Verified** |
| Java `user.home` | `C:\Users\CodexSandboxOffline` | **Verified**; differs from the developer profile |
| `GRADLE_USER_HOME` | Not set; effective default is `C:\Users\CodexSandboxOffline\.gradle` | **Verified** |
| System `gradle` command | Not found on PATH | **Verified missing** |
| Wrapper cache in effective home | `gradle-8.12.1-bin.zip.part` (0 bytes) and lock file; no installed distribution | **Verified incomplete** |
| Other profile's Gradle cache | Extracted Gradle 8.12.1 directory and `.ok` marker; distribution ZIP absent. The current identity has read-only access through `HP\CodexSandboxUsers` | **Observed; not authenticated or writable here** |
| Wrapper distribution URL | `https://services.gradle.org/distributions/gradle-8.12.1-bin.zip`; URL validation enabled; no `distributionSha256Sum` configured | **Verified from project config** |
| Android SDK | `C:\Users\wasim\AppData\Local\Android\Sdk`; platform `android-35`; build-tools `34.0.0`, `35.0.0`, `35.0.1` | **Verified present** |
| Android NDK | No `Sdk\ndk` directory | **Verified missing** |
| `adb` | SDK `platform-tools\adb.exe`, version 35.0.2; `adb devices -l` returned an empty device list | **Verified; no connected device** |
| Emulator | Emulator executable is present; one x86_64 Android 35 Play Store system image is present; `-list-avds` returned none | **No configured AVD** |
| Rust / Cargo / rustup | Commands not found | **Verified missing** |
| WASM tools | `wasm-pack`, `wasm-bindgen` not found | **Verified missing** |
| Node / npm | Node v24.16.0; npm 11.13.0 (`npm.cmd` works). `npm.ps1` is blocked by PowerShell execution policy | **Verified** |
| Browser runtime | `msedge`, `chrome`, and `firefox` were not found on PATH | **Not verified absent from all install locations** |
| Free disk | WMI disk query returned Access denied | **Not verified**; the 3C figure of ~22.3 GiB is historical only |

The SDK's Android 35 x86_64 system image is a useful emulator candidate, but there is no AVD or online physical device to install or exercise an application. Android's documented default NDK for AGP 8.8.0 is 27.0.12077973; the Android app itself has no NDK pin because it currently has no native Rust integration. A Rust Android `.so` build would require a compatible NDK/linker setup, or a separately provenance-verified prebuilt library.

## Gradle verification evidence

The wrapper files are under `android/gradle/wrapper/`. `gradle-wrapper.properties` pins Gradle 8.12.1 and has no checksum pin. The `.ok` marker in the other profile is not evidence of archive integrity. No distribution ZIP was available to hash against Gradle's official checksum, so no cached distribution was executed. No network request or download was attempted.

| Command / inspection | Outcome |
|---|---|
| `java -version` | **Succeeded**; OpenJDK 21.0.4 |
| `java -XshowSettings:properties -version` (filtered to version, OS, architecture, `user.home`) | **Succeeded**; Windows 11 / amd64 / `C:\Users\CodexSandboxOffline` |
| `gradle --version` | **Not run successfully**; system Gradle command is not on PATH |
| Read `android/gradle/wrapper/gradle-wrapper.properties` | **Succeeded**; Gradle 8.12.1 official distribution URL, no SHA-256 setting |
| Read wrapper cache folders and ACLs | **Succeeded**; effective sandbox cache incomplete; other profile's cache read-only to current identity and has no source ZIP |
| Wrapper `--version`, Gradle `help` / `tasks` | **Not run**; wrapper could download, write an external cache, or use an unauthenticated extraction. Do not retry in this sandbox |
| `:app:assembleDebug`, unit tests, instrumentation tests | **Not run**; Gradle project configuration has not been verified |

### Static version compatibility

- Gradle 8.12.1 can run on Java 21; Gradle supports running on Java 21 starting at Gradle 8.5.
- AGP 8.8.0 has a documented minimum/default Gradle version of 8.10.2 and supports compile SDK/API 35. The wrapper's Gradle 8.12.1 satisfies that AGP minimum.
- Kotlin Gradle Plugin 2.0.21's official compatibility table lists fully supported Gradle versions through 8.8 and AGP through 8.5. Gradle 8.7–8.10 are documented with a caveat. The project pins Gradle 8.12.1 and AGP 8.8.0, beyond those listed ranges.
- App module config sets `compileSdk = 35`, `minSdk = 26`, `targetSdk = 35`, Java source/target 17, and Kotlin JVM target 17. It declares `debug` and `release` build types and no product flavors. These are source/config observations, not build results.
- `settings.gradle.kts` includes the app, core modules, and feature modules referenced by the app; a simple missing-project-path issue was not found statically.

**Conclusion:** The wrapper version meets AGP 8.8's Gradle minimum, and JDK 21 is compatible with Gradle 8.12.1. The Kotlin plugin combination is outside Kotlin's fully supported matrix. Compatibility is not a substitute for configuration or compilation evidence; do not change versions by guess in this phase.

## Android build readiness

The existing SDK is sufficient for a non-native Android build attempt once Gradle distribution authenticity/access and Maven dependency availability are resolved. The app's current config does not specify `ndkVersion` or native build tasks; NDK is needed only if the prototype compiles Rust for Android. The app's configured minimum Android API is 26, so prototype runtime tests must include API 26 compatibility or document a narrower prototype-only requirement.

No Gradle tasks were discovered because Gradle could not safely be launched. No Android compile, unit test, or instrumentation test ran. No project configuration success is claimed. `adb` confirms no device is connected; an emulator AVD must be configured by the developer before install/instrumentation checks.

## MLS core and binding feasibility

### Exact candidate baseline for isolated evaluation

Use the immutable upstream `awslabs/mls-rs` commit `8f1b43f447a792ff9307f1c2c7f54da63914870e` as the **source baseline to evaluate next**, not as a production dependency selection. GitHub's commit page identifies it as an August 19, 2026 main-branch commit and shows it bumping the workspace engine to 0.56.0. GitHub's release page currently lists no formal releases, so an exact commit is preferable to an unpinned branch or a floating crate version. Before a prototype depends on it, confirm that this commit is still the intended baseline, inventory every workspace crate version/license, resolve and commit `Cargo.lock`, and verify the exact CI Rust matrix at that commit.

The engine manifest declares Rust MSRV 1.82.0. That is a minimum, not a tested recommendation for the whole Android/WASM dependency graph. No exact Rust compiler can be recommended as proven-compatible until the pinned workspace, provider, bindings, and target builds are checked against the commit's CI. The next prototype must select and pin one CI-tested Rust toolchain; do not assume a guessed future version or Rust 1.82 alone is sufficient.

Evaluate the workspace-pinned `mls-rs-crypto-rustcrypto 0.22.1` first with one cipher suite supported by both Android and WASM (suite 1 or 2 is the candidate intersection documented in the prior feasibility report). The upstream labels RustCrypto experimental. Suite/provider availability does not establish implementation correctness or app interoperability. Do not silently substitute the WebCrypto provider, which upstream labels experimental/unsupported and lists a different suite set. Stop if the exact pinned commit does not compile the same provider and suite for both targets.

### Architecture decision matrix

| Option | Cross-platform consistency / interop | Storage correctness | Complexity / maintenance | Decision |
|---|---|---|---|---|
| **1. `mls-rs` + upstream UniFFI Android wrapper + custom WASM/Web adapter** | One engine is attractive, but the published UniFFI crate is on an older engine line; observed current source constructs OpenSSL and exposes suite 1. No official Android AAR/ABI matrix was identified. Web still needs a custom binding and matching provider/suite; therefore wire interop is unproven. | UniFFI's default is in-memory. A caller storage interface exists, but app-level transactional persistence/Android Keystore behavior is not supplied. WASM needs its own durable browser storage adapter. | Moderate if supported artifact existed; high because version drift, custom Web glue and native packaging remain. | **Do not use upstream wrapper as a drop-in.** Could be reconsidered if versions/provider/storage converge and are built/tested. |
| **2. Shared exact `mls-rs` Rust core + project-owned Android UniFFI and Web `wasm-bindgen` adapters** | Best chance of same MLS parser/state engine and provider on both clients. Must prove identical suite/credential/extension settings and actual Android↔browser messages. | Requires Android app-private transactional storage with Keystore-protected at-rest key, and Web IndexedDB transactions/locking. Engine storage traits exist, but atomic crash-safe adapters are Kotha-Barta responsibilities and remain untested. Never copy mutable group state between devices. | High upfront FFI, cross-compilation, browser glue and storage work; one core reduces dual-engine drift. FFI lifecycle/panic/error/secret handling needs review. | **Preferred conditional prototype route.** Use the exact commit above as an evaluation baseline only; experimental provider and unsupported platform claims keep it non-production. |
| **3. Separate Android `mls-rs` and Web `ts-mls` implementations** | Fits React/TypeScript naturally and allows an independent engine interop peer, but two engines/providers must match RFC version, cipher suite, credentials, extensions and state transitions exactly. No Kotha-Barta interoperability evidence is available. | Each engine needs independent durable state and restart/crash testing. | Avoids WebAssembly adapter but increases long-term dual implementation and qualification burden. | **Fallback investigation only** if shared WASM cannot be made viable. Not the first prototype. |

An OpenMLS/Dart wrapper is a poor fit: the repository is Kotlin/Compose + React/Vite, and switching app runtimes would be a separate architecture decision. It is not selected here. Upstream advertises RFC 9420 conformance, WASM builds, configurable storage, and interop-focused vectors; these are upstream claims, not evidence that Kotha-Barta's target artifacts build or interoperate. Upstream also states it has not received a full third-party security audit. Open upstream questions ask for clarity on mobile support, persistence, releases, and platform artifacts; treat those as unresolved support questions, not proof of a defect.

### Durable storage and realistic interop

A realistic Android + Web prototype is technically plausible but **not verified or currently buildable in this environment**. Each client must own an independent MLS state store. Android needs atomic persistence of group/epoch state and private material protection under Android Keystore; Web needs IndexedDB persistence with single-writer/transaction rules. Do not assume a successful `write_to_storage` call proves that the host adapter makes the whole state transition atomic across a process crash. No supported upstream browser IndexedDB storage provider or Kotha-Barta storage adapter was verified. Restart/reload, interrupted commit, duplicate delivery, rollback, storage corruption, and concurrent-tab behavior are all open tests.

For native Android Rust compilation, test at least `aarch64-linux-android` (arm64 device) and `x86_64-linux-android` (available emulator image); any additional ABI must follow the app's actual support matrix. Browser WASM requires `wasm32-unknown-unknown`, browser-compatible randomness, generated JS glue, and real WebAssembly/WebCrypto runtime tests. Windows x64 can host Rust/Cargo but Android cross-linking requires the Android NDK toolchain. The NDK default documented for AGP 8.8 is 27.0.12077973, but compatibility with the selected Rust crate graph still needs build evidence.

## Risks and unknowns

- Gradle distribution archive authenticity and writable normal-user cache have not been verified. A `.ok` marker is not a checksum or signature.
- Kotlin plugin/AGP/Gradle versions are outside the KGP fully supported matrix; no project configuration/build was run.
- No exact CI-tested Rust toolchain was verified against the chosen immutable commit, RustCrypto provider, UniFFI, wasm-bindgen and Windows host.
- Android NDK is missing; no Rust target was installed or built.
- There is no official tested Android AAR/ABI release route identified for this engine/wrapper. NDK versus prebuilt artifact supply remains unresolved.
- Browser binary/runtime was not found on PATH. Node exists, but node tests alone do not prove browser WebAssembly, WebCrypto, IndexedDB, or reload behavior.
- Android/Web bidirectional MLS wire interop has not been run. RFC conformance claims and an upstream vector suite do not establish this integration.
- No crash-safe durable Android or Web storage implementation is present in a prototype; transaction boundaries, recovery after restart and corrupted-store behavior are unknown.
- No independent third-party audit was identified for the complete engine/provider/binding/storage configuration. No production approval follows from this report.
- Free disk was not re-measured because the Windows disk query was denied; prior ~22.3 GiB is historical. Native toolchains, Gradle and emulator images may require significant space.

## Prototype acceptance criteria (not implemented or run)

1. Android and Web clients use the same clearly identified MLS implementation and RFC 9420 version.
2. Exact source commit, crate versions, provider, cipher suite, Rust toolchain, Cargo lockfile, Android ABI, browser/runtime and artifact hashes are recorded.
3. Two clients establish a group through a reproducible test flow.
4. Android sends an MLS-protected application message and Web decrypts it; Web-to-Android also succeeds.
5. An unauthorized third client cannot decrypt application messages and cannot join absent an authorized Add/Welcome flow.
6. Each client's state survives process/browser restart and resumes the correct group epoch.
7. Corrupt storage and interrupted persistence fail safely without silently using stale or plaintext state.
8. Duplicate/replayed and reordered delivery has explicit, tested application-layer handling.
9. Epoch changes, member add/remove, Welcome processing, stale state and competing commits are tested.
10. Available upstream known-answer/conformance/interoperability vectors pass for the exact pinned provider/suite.
11. Android native artifacts load on every declared ABI/API target; browser WASM runs in the actual supported browser(s).
12. No plaintext fallback bypasses MLS after a conversation is designated MLS-protected.
13. Logs and crash reports expose no plaintext, private keys, epoch secrets, or sensitive state.
14. Results, command output, limitations, test environment, and failures are retained as reproducible evidence.

## Recommended next action

1. In the developer's normal writable PowerShell session, first verify whether a trusted Gradle 8.12.1 distribution ZIP exists. Compare its SHA-256 against the official Gradle checksum page before allowing the wrapper to use it. Do not rely on `.ok`; if the ZIP is absent, stop and request approval before any network download.
2. Once wrapper execution is safe, run `--version`, then offline `help`/`tasks`, and record the first configuration error. Resolve the Kotlin/AGP compatibility caveat only through a separate reviewed version decision; do not alter versions in this phase.
3. After an approved toolchain setup and a locked, exact MLS source baseline, build only an isolated native/WASM spike. First validate upstream vectors, then Android↔Web application messages and durable restart/crash behavior. Do not connect it to production messaging.

### PowerShell commands for the developer to run manually

Run only in the normal writable developer account. The first command is read-only. Do not invoke the wrapper unless a distribution ZIP is present and independently verified; the current sandbox has no verified ZIP.

```powershell
$env:GRADLE_USER_HOME = Join-Path $env:USERPROFILE '.gradle'
Set-Location 'C:\My Programming World\My Projects\Current Projects\kotha-bartha\android'
$zip = Join-Path $env:GRADLE_USER_HOME 'wrapper\dists\gradle-8.12.1-bin\eumc4uhoysa37zql93vfjkxy0\gradle-8.12.1-bin.zip'
Test-Path $zip
if (Test-Path $zip) { Get-FileHash -Algorithm SHA256 $zip }
```

Compare the hash manually with Gradle's official release checksum page. If absent, stop; do not use an `.ok` marker as a substitute. Only after the distribution has been obtained through an approved trusted route and verified:

```powershell
.\gradlew.bat --version
.\gradlew.bat --offline help
.\gradlew.bat --offline tasks
.\gradlew.bat --offline :app:assembleDebug
.\gradlew.bat --offline :app:testDebugUnitTest
```

Expected progression: `--version` reports 8.12.1; `help` and `tasks` complete project configuration; assemble/test succeed only if all Android plugins and dependencies are already cached. An offline dependency-cache miss means the result is blocked, not that the build failed due to source errors. Report the full first error and exit code. After a developer configures an AVD (or attaches a device), `adb devices -l` and `:app:connectedDebugAndroidTest` can be run; no such device was available during this investigation.

## Commands run and commands not run

| Command / check | Status |
|---|---|
| `git status --short`, relevant `git diff` inspection | **Completed** before report creation. Existing changes in `android-api-contract.md`, `e2ee-protocol-selection.md`, `e2ee-recovery-audit.md`, and `mls-prototype-environment.md` were preserved. |
| Read six requested docs, Android wrapper/settings/version catalog/app module config, and SDK/local tool metadata | **Completed**; no application files were edited. |
| `java -version`; Java properties query | **Completed**; version/home/OS/architecture recorded above. |
| `gradle --version` | **Not available**; `gradle` not found on PATH. |
| `adb.exe version`; `adb.exe devices -l` | **Completed**; adb version 35.0.2; no attached devices. |
| `node --version`; `npm.cmd --version` | **Completed**; Node 24.16.0, npm 11.13.0. `npm.ps1 --version` was blocked by PowerShell execution policy; no policy change made. |
| `rustc`, `cargo`, `rustup`, `wasm-pack`, `wasm-bindgen` version commands | **Not available**; binaries not found. |
| Emulator `-list-avds` | **Completed**; no AVD configured. |
| Wrapper `--version`, Gradle `help`/`tasks`, Android assemble/unit/instrumentation build | **Not run**; no verified wrapper ZIP in the effective home, cache writes are outside the sandbox's writable paths, and no download was authorized. |
| Rust target builds, WASM/browser tests, Android↔Web MLS interoperability or persistence tests | **Not run**; required toolchain/prototype artifacts do not exist in this environment. |
| Disk free-space query | **Blocked**; Windows WMI query returned Access denied. |

## Evidence references

- [Gradle 8.12.1 release notes](https://docs.gradle.org/8.12.1/release-notes.html), [Gradle Java compatibility](https://docs.gradle.org/current/userguide/compatibility.html), and [official Gradle release checksums](https://gradle.org/release-checksums/).
- [Android Gradle Plugin 8.8.0 release notes](https://developer.android.com/build/releases/agp-8-8-0-release-notes), [Kotlin Gradle Plugin compatibility table](https://kotlinlang.org/docs/gradle-configure-project.html#kotlin-gradle-plugin-and-gradle-compatibility), and [Android NDK setup](https://developer.android.com/studio/projects/install-ndk).
- [`mls-rs` exact upstream evaluation commit](https://github.com/awslabs/mls-rs/commit/8f1b43f447a792ff9307f1c2c7f54da63914870e), [upstream README](https://github.com/awslabs/mls-rs), [release page](https://github.com/awslabs/mls-rs/releases), and [mobile/persistence support questions #370](https://github.com/awslabs/mls-rs/issues/370).
- [RFC 9420: MLS Protocol](https://www.rfc-editor.org/rfc/rfc9420.html).
- Local project evidence: `android/gradle/wrapper/gradle-wrapper.properties`, `android/settings.gradle.kts`, `android/gradle/libs.versions.toml`, `android/app/build.gradle.kts`, `android/local.properties`, and the six Phase 3D input documents.

## Scope and verification note

Only `docs/security/mls-phase-3d-report.md` was created for this phase. No software was installed, no network download was initiated, no project configuration or source was changed, no build or test was claimed successful, and no MLS/recovery implementation was started. The pre-existing modified documents listed above remain untouched by this phase.
