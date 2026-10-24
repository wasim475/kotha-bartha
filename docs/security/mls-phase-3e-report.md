# Phase 3E — Reproducible MLS Development Environment Readiness

**Date:** 2026-10-24
**Readiness:** **CONDITIONAL** — environment inventory is complete; verified Gradle execution and all MLS builds remain blocked.
**Scope:** Read-only inspection and this report only. No project source, application architecture, dependency versions, Gradle files, recovery policy, system settings, PATH, or caches were changed.

## Summary

The project Gradle Wrapper JAR is authentic against Gradle's published SHA-256, but the required Gradle 8.12.1 distribution ZIP is not available in a form that can be independently authenticated. The current sandbox's effective cache has an empty partial ZIP; the developer profile has an extracted distribution and `.ok` marker but no ZIP, and the sandbox identity has read/execute-only ACL there. The wrapper was not executed and no build was attempted.

The installed Android SDK is useful for an isolated prototype: API 35, build tools 34.0.0/35.0.0/35.0.1, an x86_64 API 35 system image, and `adb` 35.0.2 are present. No emulator AVD or attached device is available. JDK 21.0.4, Node 24.16.0, and npm 11.13.0 are available. Rust/Cargo, NDK, and WASM command-line tools were not found in PATH or checked known install locations. Chrome and Edge executables were detected outside PATH, but browser versions and WebAssembly/WebCrypto behavior were not tested.

The compatibility issue in Phase 3D needs correction in a later authorized documentation update: Kotlin's official table says KGP 2.0.20–2.0.21 is fully supported through Gradle 8.8 and AGP 8.5, with a limited caveat for Gradle 8.7–8.10. This project pins Gradle 8.12.1 and AGP 8.8.0, outside that published fully supported range. AGP 8.8 itself requires Gradle 8.10.2+, so the wrapper satisfies the AGP minimum; this does not establish that the KGP/AGP/Gradle combination configures or builds. The earlier Phase 3D/environment reports' statement that Kotlin 2.0.21 has a Gradle 8.12 minimum is inconsistent with the authoritative Kotlin table. Those files were not edited in this phase.

For MLS investigation, retain the immutable candidate baseline `8f1b43f447a792ff9307f1c2c7f54da63914870e`, with `mls-rs` 0.56.0, `mls-rs-crypto-rustcrypto` 0.22.1, `mls-rs-uniffi` 0.13.0, and UniFFI 0.31 from that source tree. The engine and wrapper declare Rust MSRV 1.82.0, but the upstream source has no pinned `rust-toolchain.toml`; this MSRV is not proof that all locked dependencies or Android/WASM targets build with Rust 1.82. No exact Rust release should be pinned until the complete dependency lock and upstream CI evidence for those targets are checked. The proposed route remains a shared Rust engine with a small Android UniFFI adapter and a project-owned `wasm-bindgen` Web adapter; this is a prototype direction only.

## Environment inventory

| Area | Installed / detected | PATH / usability | Result |
|---|---|---|---|
| OS / architecture | Windows 11, build 26200; `amd64` | Verified by Java properties | **Available** |
| Java | OpenJDK 21.0.4; `JAVA_HOME=C:\Program Files\Android\Android Studio\jbr` | `java -version` ran | **Verified usable for Java checks** |
| Java home / Gradle home | `user.home=C:\Users\CodexSandboxOffline`; `GRADLE_USER_HOME` unset; effective Gradle home defaults to `<user.home>\\.gradle` | Verified | **Different from developer profile** |
| Gradle command | No `gradle` command on PATH | An extracted `gradle.bat` exists under `C:\Users\wasim\.gradle\\wrapper\\dists\\...` | **Detected outside PATH; version not run because the extracted distribution is unauthenticated** |
| Wrapper distribution | Configured 8.12.1 `-bin` ZIP; current effective home has a 0-byte `.part` and lock file. Developer profile has extracted files and `.ok`, but no ZIP | Current identity has read/execute only on developer profile cache | **Not authenticated; not usable by this sandbox** |
| Wrapper JAR | `android/gradle/wrapper/gradle-wrapper.jar` SHA-256 matched official published checksum `2db75c40782f5e8ba1fc278a5574bab070adccb2d21ca5a6e5ed840888448046` | Read-only hash check succeeded | **Verified authentic against official checksum** |
| Android SDK | `C:\Users\wasim\AppData\Local\Android\Sdk`; platform `android-35`; build tools `34.0.0`, `35.0.0`, `35.0.1` | Local SDK directories detected | **Available; project build not verified** |
| Android NDK | No `Sdk\\ndk` directory | No NDK found at configured SDK location | **Not found** |
| `adb` | SDK `platform-tools\\adb.exe`, version 35.0.2 | Not on PATH; direct invocation works | **Verified usable; no connected devices** |
| Emulator | Emulator executable and API 35 `google_apis_playstore/x86_64` system image detected | `emulator -list-avds` returned no AVDs | **Installed; no configured emulator** |
| Rust / Cargo / rustup | `rustc`, `cargo`, and `rustup` not on PATH; known `.cargo`/`.rustup` locations checked and not found | No compiler to query installed targets | **Not found; targets unavailable/unverified** |
| Node / npm | Node v24.16.0, npm 11.13.0 | Node and `npm.cmd` work; `npm.ps1` is blocked by PowerShell execution policy | **Verified usable via `npm.cmd`** |
| WASM tools | `wasm-pack`, `wasm-bindgen` not on PATH or checked Cargo bin locations | No Rust installation found | **Not found** |
| Browser | Chrome at `C:\Program Files\Google\Chrome\Application\\chrome.exe`; Edge at `C:\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe` | Not on PATH; version/runtime not invoked | **Detected outside PATH; WebAssembly/WebCrypto unverified** |
| Disk | .NET `DriveInfo` reports C: 21.96 GiB free of 237.68 GiB | Read-only query succeeded | **Verified at inspection time** |
| Filesystem ACL | Workspace allows Modify for sandbox group. Developer Gradle cache grants `HP\\CodexSandboxUsers` ReadAndExecute; current identity is `HP\\CodexSandboxOffline` | No write probe performed | **Workspace writable by policy; external Gradle cache not writable by current identity** |

No broad environment dump was performed. No credential values were read. The only system environment values inspected were Java/Gradle/Android tool paths and relevant tool commands.

## Gradle Wrapper verification

- Project wrapper: `android/gradle/wrapper/gradle-wrapper.properties` specifies `https://services.gradle.org/distributions/gradle-8.12.1-bin.zip`, `networkTimeout=10000`, and `validateDistributionUrl=true`. It does not specify `distributionSha256Sum`.
- Official expected SHA-256 for `gradle-8.12.1-bin.zip`: `8d97a97984f6cbd2b85fe4c60a743440a347544bf18818048e611f5288d46c94`.
- Official expected SHA-256 for the 8.12.1 wrapper JAR: `2db75c40782f5e8ba1fc278a5574bab070adccb2d21ca5a6e5ed840888448046`; the local wrapper JAR matched exactly.
- No distribution ZIP is present in either inspected cache. An extracted distribution plus `.ok` file does not authenticate its origin or contents. The direct Gradle executable was not run.
- No network request, download, cache edit, wrapper invocation, or project build was performed.

### Developer-run verification procedure

Run this only in the developer's normal writable PowerShell session and only after explicitly approving the official Gradle download. It uses a unique session-only `GRADLE_USER_HOME`; a temporary copy of the project's wrapper properties adds the published checksum so the first wrapper run verifies the archive. The repository's wrapper files remain unchanged. The original project wrapper then uses the distribution installed in that same isolated home.

```powershell
$approved = Read-Host 'Have you approved downloading the official Gradle 8.12.1 distribution? Type YES'
if ($approved -cne 'YES') { throw 'Stopped: no download approval.' }

$repo = 'C:\My Programming World\My Projects\Current Projects\kotha-bartha'
$sessionRoot = Join-Path $env:TEMP ('kotha-bartha-gradle-3e-' + [guid]::NewGuid().ToString('N'))
$bootstrap = Join-Path $sessionRoot 'wrapper-bootstrap'
$env:GRADLE_USER_HOME = Join-Path $sessionRoot 'gradle-home'
$wrapperDir = Join-Path $bootstrap 'gradle\wrapper'
New-Item -ItemType Directory -Path $wrapperDir -Force | Out-Null
Copy-Item (Join-Path $repo 'android\gradlew.bat') (Join-Path $bootstrap 'gradlew.bat')
Copy-Item (Join-Path $repo 'android\gradle\wrapper\gradle-wrapper.jar') $wrapperDir
Copy-Item (Join-Path $repo 'android\gradle\wrapper\gradle-wrapper.properties') $wrapperDir
Add-Content -LiteralPath (Join-Path $wrapperDir 'gradle-wrapper.properties') `
  -Value "`r`ndistributionSha256Sum=8d97a97984f6cbd2b85fe4c60a743440a347544bf18818048e611f5288d46c94"

Push-Location $bootstrap
try {
  .\gradlew.bat --version
  if ($LASTEXITCODE -ne 0) { throw "Checksum-verified wrapper bootstrap failed: exit $LASTEXITCODE" }
} finally { Pop-Location }

Set-Location (Join-Path $repo 'android')
.\gradlew.bat --version
if ($LASTEXITCODE -ne 0) { throw "Project wrapper version check failed: exit $LASTEXITCODE" }
```

The first command downloads only after the explicit `YES` response and uses HTTPS/TLS defaults. Stop if the checksum check or either wrapper command fails. Preserve the console output and exit code; do not paste secrets. After `--version` succeeds, test configuration separately and offline:

```powershell
.\gradlew.bat --offline help
.\gradlew.bat --offline tasks
```

Only after configuration succeeds should cached offline compilation/tests be attempted, for example `:app:assembleDebug` and `:app:testDebugUnitTest`. An offline dependency miss means the check is blocked by missing cache; it is not evidence of source compilation failure. Do not switch to online dependency resolution without separate approval.

## Compatibility review

| Component | Project pin | Authoritative compatibility evidence | Finding |
|---|---|---|---|
| Gradle | 8.12.1 | Gradle supports running on Java 21 from Gradle 8.5 | **JDK 21 is suitable for Gradle 8.12.1** |
| AGP | 8.8.0 | AGP 8.8 requires Gradle 8.10.2 minimum, JDK 17 minimum, supports API 35, defaults NDK 27.0.12077973 | **Wrapper meets AGP Gradle minimum; JDK/SDK meet AGP minimums** |
| Kotlin Gradle Plugin | 2.0.21 | Kotlin's table lists Gradle 6.8.3–8.8 and AGP 7.1.3–8.5 as fully supported. Footnote says Gradle 8.7–8.10 are supported with a KMP-specific caveat | **Current Gradle 8.12.1 + AGP 8.8 are outside documented KGP range; capable of running is not proven compatibility** |

This corrects a claim in the Phase 3D and environment reports, but those files are explicitly out of scope here and were not modified. The recommended next verification is to bootstrap the exact configured Wrapper with checksum verification, then run the existing project configuration offline in the developer's writable environment. Do not change versions in Phase 3E. If configuration fails, capture the first error and have a separate compatibility/version review before any edits.

## Rust, Android and WASM readiness

### Exact MLS candidate and toolchain evidence

- Immutable source baseline: `awslabs/mls-rs` commit `8f1b43f447a792ff9307f1c2c7f54da63914870e`.
- Source tree manifests at that commit identify `mls-rs` 0.56.0, RustCrypto provider 0.22.1, `mls-rs-uniffi` 0.13.0, and UniFFI 0.31. Engine/wrapper declare `rust-version = 1.82.0` and the repository license is `Apache-2.0 OR MIT`.
- There is no `rust-toolchain.toml` at that commit; CI uses a moving stable toolchain rather than a reproducible exact compiler version. Therefore 1.82.0 is only the declared MSRV, not the recommended/passing prototype compiler. The isolated prototype must check all workspace crates, selected features and lockfile against the chosen release and targets before pinning a toolchain.
- The upstream UniFFI wrapper hardcodes OpenSSL and the OpenSSL provider. The proposed RustCrypto path therefore needs a small project-owned adapter; provider support and API compatibility must be built at the exact commit. UniFFI generator tooling must match the Rust UniFFI dependency line (0.31 here), with the exact patch resolved and locked in the isolated workspace.
- Upstream advertises RFC 9420 conformance, WASM builds, storage traits, and conformance/interoperability vectors. Those are upstream claims, not evidence of this app's build or Android/Web interop. The upstream README labels RustCrypto experimental and states there has not been a full independent third-party audit.

### Minimum toolchain by verification stage

| Stage | Minimum components | What it can establish |
|---|---|---|
| **A. Core Rust-only checks** | Pinned Rust stable/MSVC host toolchain, Cargo, VS C++ Build Tools if native dependency build scripts require them, locked crates and Cargo cache | Host `cargo check/test` and upstream vectors only; does not establish Android or WASM builds |
| **B. Android binding check** | Stage A; Rust targets `aarch64-linux-android` and `x86_64-linux-android` for arm64 device + current x86_64 emulator image; Android NDK/LLVM Clang/linker (AGP 8.8 default is NDK 27.0.12077973); Android SDK/build tools; UniFFI 0.31-matched generator; packaging/build harness | Native `.so` build/load per chosen ABI, Kotlin binding calls, Android storage adapter tests. Rust target installation alone is insufficient: NDK linker setup is required. |
| **C. Web WASM check** | Stage A; Rust target `wasm32-unknown-unknown`; `wasm-bindgen` CLI matching the locked crate version; Node/npm for glue/build tooling; Chrome or Edge browser for real browser tests; WebCrypto and IndexedDB | WASM module generation and browser runtime tests. `wasm-pack` is optional if the chosen workflow uses Cargo + wasm-bindgen directly; no version should be pinned until that workflow is selected. |
| **D. Full interop prototype** | A+B+C; exact Rust/Cargo/UniFFI/wasm-bindgen versions and lockfiles; local test relay; emulator or physical Android device; supported browser; independent state stores; recorded test vectors and artifacts | Real bidirectional Android↔Web MLS messages, membership flows, restart/reload, transaction/crash, replay/duplicate and storage-corruption tests. No current result establishes this stage. |

Rust's official target catalog lists `aarch64-linux-android`, `x86_64-linux-android`, and `wasm32-unknown-unknown`. These targets are possible Rust targets, not proof that the selected `mls-rs` feature/provider graph works on them. Use no 32-bit Android target unless the product ABI scope requires it. At-rest encryption, atomic commit behavior, browser locking, OS/browser security and storage lifecycle belong to host adapters and require separate tests.

All third-party crate and JavaScript dependency licenses must be inventoried from the exact lockfiles. Preserve upstream license files/notices and produce a dependency inventory/SBOM for prototype artifacts. The engine/provider's dual license does not establish the license of transitive dependencies or generated bindings.

## Isolated prototype workspace proposal (not created)

Keep this as a sibling repository or worktree, outside production source, for example `..\\kotha-bartha-mls-prototype\\`:

```text
kotha-bartha-mls-prototype/
  README.md                         # exact setup, commands, no production claims
  rust-toolchain.toml               # only after CI/target evidence chooses a version
  Cargo.toml
  Cargo.lock
  rust/
    mls-core/                       # pinned upstream core/provider integration
    android-uniffi-adapter/         # narrow project-owned Kotlin FFI surface
    web-wasm-adapter/               # wasm-bindgen exports and browser randomness
  android-harness/                  # standalone test app; no production modules
  web-harness/                      # minimal browser peer; no real Kotha-Barta account
  relay/                            # local synthetic MLS opaque-message relay
  vectors/                          # upstream vectors + recorded expected results
  storage-tests/
    android/                        # atomic writes, restart, corruption/interruption
    web/                            # IndexedDB transaction, reload, multi-tab policy
  interop-tests/                    # Welcome, application, commit/member lifecycle
  evidence/
    versions.txt
    checksums.txt
    licenses/
    test-results/
    limitations.md
```

Use generated test identities and synthetic messages only. Never import production credentials, user data, real conversations, private keys, or production message formats. The relay stores only opaque MLS protocol messages and should be disposable; each peer uses a separate local state root. Store commit hash, Cargo/npm lockfiles, tool versions, ABI/browser details, artifact hashes, commands and actual output in `evidence/`.

## Risks and blockers

- No authenticated Gradle 8.12.1 distribution ZIP; Wrapper and project configuration were not run.
- KGP/AGP/Gradle pins fall outside Kotlin's documented fully supported matrix. No upgrade or downgrade is recommended in this report.
- Rust MSRV is known, but no exact compiler release is fixed upstream and Rust/Cargo are absent locally.
- No NDK; Android Rust native compilation cannot be attempted here.
- No AVD or online device, so Android install/instrumentation tests cannot be run.
- No wasm-pack/wasm-bindgen tools. Browser executables exist outside PATH, but version and WebAssembly/WebCrypto/IndexedDB support have not been verified.
- UniFFI upstream wrapper selects OpenSSL; the shared RustCrypto adapter path is custom and unbuilt. RustCrypto is marked experimental upstream.
- Durable Android/Web storage, concurrency, atomicity, crash recovery and cross-platform interoperability have not been demonstrated.
- Free disk is about 21.96 GiB; space for Gradle, Rust, NDK and emulator/tool caches should be monitored. No package was installed.
- Phase 3E is documentation/setup planning only; it does not approve production MLS, recovery, API, schema or message changes.

## Commands run and actual results

| Command/check | Result |
|---|---|
| `git status --short`, `git diff --stat`, inspect relevant existing diffs | **Completed first.** Existing E2EE and MLS documentation edits were identified and preserved. The Phase 3E report did not exist. |
| Read all five requested project documents | **Completed.** Existing reports' claims were compared with current environment and official compatibility references. |
| `java -version`; Java `-XshowSettings:properties` filtered to version, OS, architecture, `user.home` | **Completed**; OpenJDK 21.0.4, Windows 11, amd64, `C:\Users\CodexSandboxOffline`. |
| `Get-Command` for Gradle/adb/Rust/Cargo/WASM tools and Node/npm | **Completed**; Gradle/adb/Rust/Cargo/rustup/WASM tools not on PATH; Node/npm found. |
| Check known Gradle/Rust/browser/SDK locations | **Completed**; extracted Gradle and Chrome/Edge detected outside PATH; no Rust/Rustup install directories; SDK packages as listed above. |
| `Get-FileHash android/gradle/wrapper/gradle-wrapper.jar -Algorithm SHA256` and compare with official published checksum | **Completed; PASS.** Actual and expected hash both `2db75c40782f5e8ba1fc278a5574bab070adccb2d21ca5a6e5ed840888448046`. |
| Inspect Gradle cache contents and ACLs | **Completed**; no distribution ZIP; `.ok` ignored as authenticity evidence; current identity read/execute-only in developer Gradle cache. |
| SDK adb `version`, `devices -l`; emulator `-list-avds` | **Completed**; adb 35.0.2; no attached devices; no AVD. |
| `node --version`; `npm.cmd --version` | **Completed**; Node 24.16.0; npm 11.13.0. `npm.ps1` script execution was blocked by policy; no policy change made. |
| .NET `DriveInfo` query for C: | **Completed**; 21.96 GiB free of 237.68 GiB. |
| `gradle --version`, wrapper `--version`, Gradle tasks/configuration, Android builds/tests | **Not run**; system Gradle is absent, the installed distribution could not be authenticated, and the wrapper would attempt download or external cache writes. |
| Rust versions/targets, Cargo checks, Android native build, WASM build/browser tests, MLS vectors/interoperability | **Not run**; required tools/prototype workspace are absent. |
| Any installation, network download, PATH/system setting change, cache mutation | **Not run**. |

## Evidence sources

- [Kotlin Gradle Plugin compatibility table](https://kotlinlang.org/docs/gradle-configure-project.html#kotlin-gradle-plugin-and-gradle-compatibility), [AGP 8.8.0 release notes](https://developer.android.com/build/releases/agp-8-8-0-release-notes), and [Gradle Java compatibility](https://docs.gradle.org/current/userguide/compatibility.html).
- [Official Gradle distribution and wrapper JAR checksums](https://gradle.org/release-checksums/) and [Gradle Wrapper checksum verification](https://docs.gradle.org/current/userguide/gradle_wrapper.html#sec:verification).
- [Android NDK setup and side-by-side configuration](https://developer.android.com/studio/projects/install-ndk), [Rust platform support](https://doc.rust-lang.org/rustc/platform-support.html), and [rustup cross-compilation](https://rust-lang.github.io/rustup/cross-compilation.html).
- [`mls-rs` immutable candidate engine manifest](https://github.com/awslabs/mls-rs/blob/8f1b43f447a792ff9307f1c2c7f54da63914870e/mls-rs/Cargo.toml), [RustCrypto manifest](https://github.com/awslabs/mls-rs/blob/8f1b43f447a792ff9307f1c2c7f54da63914870e/mls-rs-crypto-rustcrypto/Cargo.toml), [UniFFI wrapper manifest](https://github.com/awslabs/mls-rs/blob/8f1b43f447a792ff9307f1c2c7f54da63914870e/mls-rs-uniffi/Cargo.toml), [upstream README/security note](https://github.com/awslabs/mls-rs), and [mobile/persistence support questions #370](https://github.com/awslabs/mls-rs/issues/370).
- [UniFFI user guide](https://mozilla.github.io/uniffi-rs/latest/) and [`wasm-bindgen` guide](https://rustwasm.github.io/docs/wasm-bindgen/).
- Local evidence: Phase 3D report, prototype environment report, MLS feasibility report, E2EE protocol-selection and Android implementation-plan documents, plus Android Gradle/SDK configuration and current Windows tool paths.

## Next action

The developer can run the checksum-gated PowerShell procedure above only after approving the official Gradle distribution download in their writable Windows session. Record wrapper version output first, then run only offline Gradle configuration checks. Separately, before installing Rust/NDK/WASM tools, resolve the Kotlin/AGP/Gradle compatibility finding and agree on a CI-supported Rust toolchain for the pinned MLS workspace. No MLS implementation or Phase 3F work is started here.
