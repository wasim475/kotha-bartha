# MLS prototype environment readiness

**Checked:** 2026-10-24
**Scope:** Read-only environment inspection and setup guidance. No software was installed, no system-wide settings were changed, and no application or prototype code was created.
**Purpose:** Prepare a reproducible Windows environment for the isolated MLS feasibility prototype described in [`mls-feasibility-report.md`](mls-feasibility-report.md).

## Readiness summary

### Phase 3B validation update (2026-10-24)

- **Verified:** a Gradle 8.12.1 launcher found in the user cache reports Gradle 8.12.1, Kotlin 2.0.21 embedded in Gradle, and launcher JDK 21.0.4. This direct local `--version` check did not run the Android project build.
- **Verified compatibility:** AGP 8.8 requires Gradle 8.10.2 or newer and supports API 35; Kotlin 2.0.21's Gradle minimum is 8.12; Gradle 8.12.1 can run on Java 21. Thus the configured Gradle/AGP/Kotlin/JDK combination is version-compatible.
- **Not required by the existing Android app:** no NDK, Rust or WebAssembly tools are configured by the production app. NDK need depends on whether the isolated prototype compiles Rust native code locally.
- **Unresolved:** no exact mls-rs commit, wrapper, provider or Android/browser binding is selected. Current upstream MSRV is only a lower bound, so Rust 1.99.1 is not yet compatibility-qualified. Rust target selection is conditional on the chosen integration and test ABIs.
- **Not verified:** Gradle archive checksum/signature, Android project build, SDK download access, Rust/Cargo installation, NDK, emulator launch, device availability, browser version and MLS interoperability.
- **Wrapper blocker:** `android\\gradlew.bat --version` tried `https://services.gradle.org/distributions/gradle-8.12.1-bin.zip` despite a separate cached Gradle 8.12.1 installation and failed with `java.net.SocketException: Permission denied: getsockopt`. No ZIP was downloaded. Why the wrapper did not use that cached installation is unresolved; a cache path/metadata mismatch is possible but not verified. No proxy environment-variable names were present; other proxy configuration was not examined.

| Item | State | Evidence / notes |
|---|---|---|
| OS / architecture | Available | Windows x64 / AMD64, build 26200 (25H2; registry product name reports Windows 10 Pro) |
| CPU | Available | Intel 64-bit processor |
| Disk | Available | C: has about 22.3 GiB free of 237.7 GiB; Windows storage query succeeded through .NET DriveInfo |
| Java | Available | OpenJDK 21.0.4, bundled Android Studio JBR |
| Android SDK | Partially available | `local.properties` points to the user's Android SDK; API 35 platform is present |
| Android Build Tools | Available | 34.0.0, 35.0.0, 35.0.1 present |
| Android NDK | Missing | SDK `ndk` directory has no installed NDK version |
| Android command-line tools | Available | `cmdline-tools/latest/bin/sdkmanager.bat` exists |
| Android emulator | Available | Emulator executable and API 35 Google Play Store x86_64 system image are present |
| `adb` | Available, not on PATH | SDK `platform-tools/adb.exe` reports 1.0.41 / 35.0.2-12147458; no connected or running devices were listed |
| Rust / Cargo / rustup | Missing | Commands not found |
| Android Rust targets | Missing | No Rust toolchain installed |
| WASM target/tooling | Missing | No Rust toolchain, `wasm-pack`, or `wasm-bindgen` command found |
| Node / npm | Available | Node v24.16.0; npm 11.13.0; client has `package-lock.json` |
| Browser runtime | Not verified | A Chrome executable was found at a standard path, but its version query could not start under current profile permissions. No browser test was run. |
| Gradle distribution | Partially available | A Gradle 8.12.1 installation in the user cache runs directly. The project wrapper did not use that cache entry and attempted a download; the attempt was blocked. |
| Network | Restricted | The wrapper connection to `services.gradle.org` failed with `java.net.SocketException: Permission denied: getsockopt`. No distribution was downloaded. SDK/Rust/Cargo downloads were not attempted; no proxy environment-variable names were present, and no proxy values or credentials were inspected. |

No environment secrets or credential values were read or recorded. The SDK path in `local.properties` was used only to inspect installed package directories.

## Repository and upstream compatibility findings

### Project versions

- Android uses AGP `8.8.0`, Kotlin `2.0.21`, compile/target SDK `35`, min SDK `26`, and Java bytecode target `17`.
- `android/gradle/wrapper/gradle-wrapper.properties` pins Gradle `8.12.1` and does not specify `distributionSha256Sum`. A Gradle 8.12.1 installation was found under the user cache and its direct launcher reports the pinned version, but the project wrapper attempted to fetch its own distribution and failed. The direct-install path is not a successful wrapper invocation. The archive checksum was not independently verified in this phase.
- The Android app has no Rust/UniFFI integration, external native build configuration, or NDK version pinned. Therefore the current Android app build does not require an NDK. A future Rust-to-Android source build will likely require one; consuming a prebuilt compatible `.so` could avoid the NDK on this machine, depending on how that artifact is produced and packaged.
- Web uses React `19.2.4` and Vite `8.0.1`; its package lock is present. No browser test runner is currently configured.
- `mls-rs` current upstream manifest reports engine version `0.56.0` and `rust-version = 1.82.0`. This is the engine's minimum Rust version, not proof that every wrapper/dependency combination works with it.
- Published `mls-rs-uniffi` is `0.1.0` and its published dependencies use an older `mls-rs ^0.39.0` range. Select and pin a matching engine/wrapper revision before creating a `rust-toolchain.toml`; do not combine the latest engine with the published wrapper by assumption.
- The `mls-rs` README advertises WASM builds, but marks its WebCrypto provider experimental and unsupported. A WASM target build alone does not supply a supported browser JavaScript API.

### Recommended compatibility baseline (not yet build-verified)

| Tool | Baseline | Why / qualification |
|---|---|---|
| Gradle | 8.12.1 (project wrapper) | Satisfies AGP 8.8's documented minimum 8.10.2 and Kotlin 2.0.21's listed Gradle minimum 8.12. |
| JDK | 21.0.4 present; keep for first attempt | AGP 8.8 documents JDK 17 as its minimum/default. Gradle supports running on JDK 21 from Gradle 8.5. The installed JDK 21 should therefore fit this wrapper, but the project build could not run to verify it. JDK 17 is also acceptable if the prototype host standardizes on it. |
| Android SDK Platform | 35 | Matches the repository's compile/target SDK and AGP 8.8 maximum supported API. Already installed. |
| Android Build Tools | 35.0.0 | AGP 8.8 default; already installed. |
| Android NDK | No current-app requirement; future native build unresolved | AGP 8.8.0 documents `27.0.12077973` as its default NDK, not as a required version for this app. The app has no NDK configuration. Do not install it until the source-build/binary-consumption approach is selected. If native compilation is selected, use the documented AGP default as a candidate and confirm it against the chosen MLS dependency and build recipe. |
| Rust | No install recommendation yet | Rust 1.99.1 is available from the official Rust release channel as of 2026-10-24. The inspected current `mls-rs` main manifest says engine 0.56.0 and MSRV 1.82.0; that minimum does not establish that 1.99.1, an exact commit, its provider, or a wrapper will build together. No `mls-rs` revision or Android/browser binding has been selected. Select and pin that set before choosing a compiler. |
| Rust Android targets | Conditional: `aarch64-linux-android` and `x86_64-linux-android` for arm64 device plus the available x86_64 emulator; 32-bit targets only if required | These correspond to arm64-v8a and x86_64 Android ABIs. The Rust targets are available for cross-compilation from Windows x64 when the appropriate NDK linker/toolchain is configured. Compilation from this host has not been tested. Whether both ABIs are needed depends on the prototype test matrix and selected Android integration. |
| Rust browser target | `wasm32-unknown-unknown` | Browser WebAssembly target; not WASI. Requires a JS binding/glue layer and browser test runner. The project's official browser binding choice is still unresolved. |
| Browser | Chromium-based current stable, with WebAssembly, WebCrypto and IndexedDB | MLS browser cryptography must run in the actual selected browser. WebCrypto is limited to secure contexts such as HTTPS and localhost. Record exact browser version in prototype results. No browser runtime was successfully verified here. |

Rust 1.99.1's official release is verified, but the project has not selected a revision and no compatibility build has been run. `rust-version` is a minimum. The prototype must lock one compatible Rust version, engine revision, wrapper, provider, and Cargo dependency graph together. The `mls-rs-uniffi` published version is substantially older than the inspected `mls-rs` main branch, so compatibility remains an explicit gate.

### Android NDK and native targets

The existing app does not need the NDK. If the prototype compiles Rust into Android native libraries, Rust cross-compilation requires both the Rust target standard library and an Android NDK linker/toolchain; `rustup target add` alone does not install or configure the NDK. Windows NDK clang/linker commands must be wired per target and API level (API 26 matches this app's minimum SDK unless the prototype requires otherwise). If a compatible prebuilt native library is selected, verify its ABI, API level, provenance, and packaging; do not install the NDK solely on the assumption that consuming it requires NDK tools.

The current `mls-rs-uniffi` wrapper constructs the OpenSSL crypto provider. Android cross-linking therefore needs a documented, reproducible OpenSSL/native dependency route for each ABI, or a future supported provider configuration. The ordinary NDK installation does not itself prove OpenSSL is available. Resolve this before trying a production-like Android binding build.

For device runtime checks, use one physical Android device with USB debugging enabled and an authorized ADB prompt, plus an x86_64 emulator. The emulator executable and image are installed here, but no AVD/device is currently online. Emulator use also requires working CPU virtualization support and adequate memory; neither was tested.

### Browser requirements

Use a current stable Chrome or Edge in a secure context. The actual harness must test the chosen WASM binding together with browser WebCrypto, IndexedDB persistence, reload, concurrent-tab serialization and account isolation. The supported browser matrix cannot be pinned until a binding/provider is chosen; do not infer it from WebAssembly target support alone.

## Windows setup plan

These are instructions only. No command that installs software or changes PATH was executed. Do not run installation commands until the owner approves the downloads and license prompts.

### 1. Restore a verified download path


For reproducibility, use official sources, verify published checksums, record source URLs and SHA-256 hashes, and keep an artifact manifest with the prototype. The wrapper has no `distributionSha256Sum`; adding the official Gradle 8.12.1 checksum would be a separate approved build-infrastructure change. Do not disable TLS or silently change the distribution URL. For an offline recovery, obtain the official ZIP and checksum through a trusted connected host, validate SHA-256 against Gradle's official checksum page, transfer through an approved channel, and have the wrapper cache provisioned using the documented Gradle wrapper mechanism. The local cache was not checksum-verified here. Do not treat an arbitrary copied `gradle-8.12.1` folder or an unverified mirror as trusted. A corporate artifact mirror is suitable only if it preserves provenance/checksum and any URL change is separately reviewed.

### 2. Android SDK / NDK

The SDK command-line manager already exists. After download access and explicit installation approval, inspect available packages and install only the pinned requirements:

```powershell
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
& "$sdk\cmdline-tools\latest\bin\sdkmanager.bat" --list
& "$sdk\cmdline-tools\latest\bin\sdkmanager.bat" --install `
  "platforms;android-35" `
  "build-tools;35.0.0" `
  "platform-tools" `
  "emulator" `
  "system-images;android-35;google_apis_playstore;x86_64"
```

The platform, build tools, emulator and image are already present according to directory inspection. No SDK package installation is currently justified: the app has no native build, and the future MLS integration path is undecided. If Rust source compilation into Android libraries is selected later, inspect the selected dependency's requirements first; `27.0.12077973` is AGP 8.8's documented default candidate, not a verified MLS requirement. `sdkmanager` package metadata/license resolution was not attempted. Review and accept licenses interactively rather than piping unconditional acceptance.

For the current PowerShell session only, expose tools without changing machine/user-wide PATH:

```powershell
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_HOME = $sdk
$env:Path = "$sdk\platform-tools;$sdk\cmdline-tools\latest\bin;$env:Path"
```

Create an API 35 x86_64 AVD through Android Studio Device Manager or `avdmanager` after confirming virtualization. Connect a physical device separately if available. Never put local SDK paths or personal device IDs in committed files.

### 3. Rust toolchain and targets

Once an exact `mls-rs` revision and matching wrapper/provider are selected, check their declared MSRV and CI/tested toolchains, then pin a compatible Rust version in the isolated prototype's `rust-toolchain.toml`. Rust 1.99.1 is an official current release but is not yet justified for this dependency set; do not run the following example until that compatibility gate is resolved:

```powershell
# Set this only after pinning a version supported by the chosen mls-rs revision/wrapper.
$rustVersion = 'REPLACE_WITH_VERIFIED_PIN'
rustup toolchain install $rustVersion --profile minimal --component rustfmt,clippy
rustup target add --toolchain $rustVersion `
  aarch64-linux-android `
  x86_64-linux-android `
  wasm32-unknown-unknown
# Add armv7-linux-androideabi and/or i686-linux-android only if 32-bit ABIs are in scope.
```

For the described arm64-device plus x86_64-emulator matrix, add the two Android targets only if the selected Android integration builds native Rust for both ABIs. Add 32-bit Android targets only if those ABIs remain in the supported app matrix. `wasm32-unknown-unknown` is required only if the selected browser prototype builds Rust to browser WebAssembly. A prebuilt Android library may remove the local NDK compile requirement, but does not remove ABI/runtime interoperability verification.

If Cargo resolution or the selected wrapper requires a different compiler, update the pin deliberately and record the compatibility evidence. Install `wasm-bindgen-cli` only at the version matched to the resolved crate in `Cargo.lock`; install `wasm-pack` only if the selected browser binding/test harness requires it. No versions are pinned for these tools because this repo has no binding, Cargo lockfile or test harness from which to establish a compatible version.

Do not use an unpinned `cargo install wasm-bindgen-cli` in a reproducible run. Capture `rustc -Vv`, `cargo -V`, `rustup show`, `rustup target list --installed`, and `cargo tree --locked` in the run record.

### 4. Gradle wrapper and JDK

Keep the existing wrapper at Gradle 8.12.1; it is newer than the AGP 8.8.0 minimum (8.10.2) and meets Kotlin 2.0.21's Gradle 8.12 minimum. JDK 21.0.4 is present, and cached Gradle 8.12.1 `--version` succeeded on that JDK. This verifies the Gradle distribution/JDK pairing, not the Android project build. The wrapper cache itself has not been checksum-verified; the wrapper properties contain no checksum pin.

After a verified wrapper distribution is cached:

```powershell
java -version
Set-Location android
.\gradlew.bat --version
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:testDebugUnitTest
```

Those are later Android-environment checks, not MLS interoperability tests. The prototype build must separately include the pinned Rust native artifact and its ABI packaging test.

### 5. Browser / Node dependencies

After choosing a versioned browser binding and configuring the supported browser, use the committed lockfile for existing Web dependencies (`npm ci`). The current web package has no MLS dependency or browser-test script. Add prototype-only dependencies and scripts inside the isolated prototype scope after selecting the actual binding; do not add them to production modules. Run the harness on an HTTPS origin or localhost for WebCrypto secure-context requirements.

## Verification commands for the next prototype attempt

Run from PowerShell after the approved setup:

```powershell
# Host and package manager
[System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
java -version
node --version
npm.cmd --version

# Android SDK, NDK, emulator and device (device serials should be redacted in shared logs)
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
& "$sdk\platform-tools\adb.exe" version
& "$sdk\platform-tools\adb.exe" devices
Get-ChildItem "$sdk\ndk" -Directory | Select-Object -ExpandProperty Name
& "$sdk\emulator\emulator.exe" -list-avds

# Rust host, compiler pin and targets
rustc -Vv
cargo -V
rustup show
rustup target list --installed

# The prototype's actual locked manifest (placeholder until that isolated project exists)
cargo test --locked --manifest-path <prototype-path>\Cargo.toml
cargo build --locked --manifest-path <prototype-path>\Cargo.toml --target aarch64-linux-android
cargo build --locked --manifest-path <prototype-path>\Cargo.toml --target x86_64-linux-android
cargo test --locked --manifest-path <prototype-path>\Cargo.toml --target wasm32-unknown-unknown
```

The last command is valid only if the prototype defines a WASM test target and runner; otherwise use its recorded `wasm-pack test --chrome --headless` or `wasm-bindgen-test-runner` command. No prototype manifest exists yet, so placeholder commands are not currently executable.

For the actual cross-platform test, also record AVD/device Android version and ABI, browser name/version, MLS version and cipher suite, credential configuration, serialized wire format, exact commit/Welcome/message bytes, storage backend, and restart/reload outcomes. Tool availability alone is not MLS functionality.

## Restricted-network and offline alternatives

- Use an approved internal mirror or a separately connected, trusted staging machine to fetch official Gradle, Rustup components, NDK/SDK packages and Cargo crates. Verify the upstream checksum/signature before transfer; retain hashes and a manifest.
- Prewarm the exact Gradle 8.12.1 wrapper distribution for the same OS/user Gradle cache using a verified official archive and matching wrapper cache identity, or configure an approved internal distribution mirror in a later separately reviewed change. A separate Gradle installation in this user's cache was not recognized by the project wrapper. The checked-in wrapper currently points at the public Gradle service.
- Install Rustup's exact host toolchain and Android/WASM target components from official component archives on the staging machine. Do not copy an arbitrary `rustc.exe` without its matching standard libraries, Cargo, linker setup and checksum record.
- On a connected machine, resolve dependencies with the prototype's committed `Cargo.lock`, create Cargo vendor sources, and transfer them with the lockfile and hashes. Then use `cargo build --locked --offline`; all target-specific crates and build dependencies must also be vendored.
- Preinstall the exact SDK Platform, Build Tools, NDK, emulator and system-image packages through official `sdkmanager` on the staging machine. Copying only SDK directories may omit package metadata and accepted license records; prefer a managed SDK mirror or verified complete package archive.
- If binaries cannot be staged or verified, stop at documentation/source review. Do not fabricate test outcomes or substitute a hand-written crypto shim.

## Troubleshooting

| Symptom | Likely cause / action |
|---|---|
| Gradle wrapper fails before configuration | In this environment the wrapper attempted to fetch Gradle 8.12.1 and the connection failed with `Permission denied: getsockopt`; the separate cached launcher did not satisfy the wrapper. Use an approved network or provision a matching verified wrapper cache from the official archive. |
| `adb` not found | Use `$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe` or add SDK paths only to the current shell session. |
| `adb devices` is empty | Start the API 35 x86_64 AVD or connect/authorize a USB-debugging device; no device was online during this inspection. |
| Rust target appears missing | Install the exact target with `rustup target add --toolchain <pinned-toolchain> <target>`; target installation downloads components. |
| Android linker errors | Confirm NDK `27.0.12077973`, Windows host clang path, target triple/API level, linker variables, and any OpenSSL or other native provider artifacts. |
| `mls-rs-uniffi` compile/API mismatch | Do not combine crate `0.1.0` with a different engine branch by guess. Pin the wrapper and all engine crates together or stop and resolve upstream support. |
| Browser compiles WASM but crypto provider fails | Check supported provider/cipher suite, secure context, JS imports and browser APIs. Upstream currently labels WebCrypto experimental/unsupported; a successful WASM compile is not production evidence. |
| State disappears after process restart | Confirm the prototype replaced default in-memory MLS storage with durable storage, committed each transition atomically and tested reopen; do not call in-memory persistence sufficient. |
| Disk pressure during setup | About 22.3 GiB was free at inspection; NDK, emulator images, Gradle/Cargo caches and AVD data consume additional space. Recheck before downloads and avoid duplicate SDK/toolchain installations. |

## Reproducibility requirements

Before prototype execution, commit or record in the isolated prototype scope:

1. Exact `mls-rs` commit/crate and matching wrapper release, with license notices.
2. Exact Rust toolchain (`rust-toolchain.toml`), `Cargo.lock`, target triples and Cargo configuration.
3. Android API 35 SDK/build tools; NDK version only if the selected native build requires it; native dependency versions and ABI list.
4. Exact wasm binding, `wasm-bindgen`/`wasm-pack` version if used, browser test runner and browser version.
5. Gradle 8.12.1 distribution checksum, AGP 8.8.0, Kotlin 2.0.21, and JDK vendor/version.
6. Separate storage roots for client A/B, deterministic test fixture generation, and no production credentials/data.
7. Commands and outputs for group creation, Welcome join, messages both directions, storage restore, Android↔Web interop, duplicate/reorder/crash cases.
8. An artifact manifest containing official source URLs and checksums. Do not commit private identities, generated MLS state, tokens, or test secrets.

## Remaining blockers

- Rust/Cargo and required target libraries are absent; installing them needs approved downloads.
- NDK is absent, but the existing app does not require it. A local MLS Rust-to-Android source build would require an NDK and a reproducible provider/native dependency route; whether the prototype needs local compilation is unresolved.
- The standalone Gradle 8.12.1 installation runs, but project `gradlew.bat` cannot access its distribution: it attempted a download and the connection was blocked. Its archive checksum was not verified and no checksum is pinned in the wrapper properties. Other setup downloads remain untested.
- No ADB device/emulator is connected; emulator binary and image exist but no AVD was confirmed running.
- Browser version/runtime is not verified, and no web test runner exists.
- Exact engine/wrapper release pairing is unresolved; Rust 1.99.1 is a candidate, not yet build-qualified.
- mls-rs WebCrypto is experimental/unsupported and the official JS integration path is unresolved. This cannot be fixed by installing browser tooling.
- No toolchain availability claim implies MLS works; the eventual Phase 3 prototype must still demonstrate actual Android↔Web interop and state restoration.

## Sources checked 2026-10-24

- [Android Gradle Plugin 8.8.0 release notes](https://developer.android.com/build/releases/agp-8-8-0-release-notes) — Gradle 8.10.2 minimum, Build Tools 35.0.0, NDK 27.0.12077973 default and JDK 17 minimum.
- [Android NDK setup](https://developer.android.com/studio/projects/install-ndk) and [SDK command-line tools](https://developer.android.com/tools) — SDK Manager, NDK and platform-tools setup.
- [Gradle compatibility matrix](https://docs.gradle.org/current/userguide/compatibility.html) and [Gradle 8.5 release notes](https://docs.gradle.org/8.5/release-notes.html) — Java 21 runtime support from Gradle 8.5, Kotlin/Gradle compatibility.
- [Rust release announcements](https://blog.rust-lang.org/releases/) — Rust 1.99.1 current stable release on the check date.
- [Rustup cross-compilation guide](https://rust-lang.github.io/rustup/cross-compilation.html) — Rust target installation and Android NDK linker requirement.
- [Rustup toolchain file documentation](https://rust-lang.github.io/rustup/overrides.html#the-toolchain-file) — pinning toolchain and targets in `rust-toolchain.toml`.
- [`mls-rs` current engine manifest](https://github.com/awslabs/mls-rs/blob/main/mls-rs/Cargo.toml) and [README](https://github.com/awslabs/mls-rs) — current engine version/MSRV, WASM and provider status.
- [`mls-rs-uniffi` published crate](https://docs.rs/mls-rs-uniffi/latest/mls_rs_uniffi/) and [configuration source](https://github.com/awslabs/mls-rs/blob/main/mls-rs-uniffi/src/config.rs) — wrapper version/dependency and default in-memory storage/provider configuration.
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — secure context requirement. Browser-specific version support still requires actual runtime testing.

## Phase 3B command status

| Command / check | Status | Result or next step |
|---|---|---|
| `[System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture` | Already verified | X64 / AMD64 host. |
| `java -version` | Already verified | OpenJDK 21.0.4. |
| `node --version`; `npm.cmd --version` | Already verified | Node 24.16.0; npm 11.13.0. |
| SDK directory / API 35 / Build Tools inspection | Already verified | API 35 and Build Tools 34.0.0, 35.0.0, 35.0.1 present. |
| `adb.exe version`; `adb.exe devices` | Already verified | adb 1.0.41 / platform-tools 35.0.2; no connected device. `adb` is not on PATH. |
| `emulator.exe -list-avds` | Needs execution | Emulator binary and x86_64 image exist; an AVD has not been confirmed. |
| NDK directory inspection | Already verified | No NDK installed; installation is conditional on native compilation choice. |
| `rustc -Vv`, `cargo -V`, `rustup show`, installed targets | Blocked | Rust, Cargo and rustup are absent; installation is not authorized. |
| `wasm-pack --version`, `wasm-bindgen --version` | Blocked | Tools are absent; install only after selecting a WASM binding and matching versions. |
| Cached `gradle.bat --version` | Already verified | Gradle 8.12.1 starts on JDK 21.0.4. Cache integrity/checksum not verified. |
| `android\\gradlew.bat --version` | Blocked | Executed once; wrapper tried downloading Gradle and failed with `Permission denied: getsockopt`. No download succeeded. Do not retry until an approved network or matching verified offline wrapper cache is available. |
| `android\\gradlew.bat :app:assembleDebug` / unit tests | Blocked pending approval/network | These may resolve/download Maven dependencies; no project build or tests were run in this phase. |
| `cargo build/test` for MLS prototype | Not applicable yet | No prototype manifest or selected MLS binding exists. |
| Browser runtime version and browser/WASM tests | Not verified / blocked | Browser version could not be queried; no harness exists. |

## Phase 3C diagnosis and binding decision (2026-10-24)

This section supersedes the Phase 3B uncertainty about why the wrapper did not find the cached Gradle distribution. It adds a conditional binding decision; it does not approve an MLS production dependency or implement a prototype.

### Gradle wrapper root cause

The wrapper script and URL are valid. `android/gradlew.bat` invokes the checked-in `gradle/wrapper/gradle-wrapper.jar`; the JAR manifest says `Implementation-Title: Gradle Wrapper`. The properties request `https://services.gradle.org/distributions/gradle-8.12.1-bin.zip`, with the standard `GRADLE_USER_HOME/wrapper/dists` cache paths and URL validation enabled. There is no `distributionSha256Sum`. The local wrapper JAR SHA-256 is `2DB75C40782F5E8BA1FC278A5574BAB070ADCCB2D21CA5A6E5ED840888448046`; it was not compared with Gradle's published wrapper-JAR checksum.

The cache layout **does** match the URL. Gradle 8.12.1's `PathAssembler` computes an MD5 of the safe distribution URL and converts it to base 36; for this URL the directory is `eumc4uhoysa37zql93vfjkxy0`. That directory under `C:\Users\wasim\.gradle\wrapper\dists\gradle-8.12.1-bin` contains `gradle-8.12.1`, its launcher JAR, and the wrapper `.ok` marker. Running its `bin/gradle.bat --version` directly succeeds and reports Gradle 8.12.1 / JDK 21.0.4. The ZIP itself is absent, so the distribution's authenticity/checksum cannot now be verified; the empty `.ok` marker is not a checksum.

The actual mismatch is the Gradle user home selected by Java:

| Value | Observed path |
|---|---|
| Java `user.home` (wrapper default when `GRADLE_USER_HOME` is unset) | `C:\Users\CodexSandboxOffline` |
| PowerShell `$env:USERPROFILE` and location of the existing cache | `C:\Users\wasim` |
| `GRADLE_USER_HOME` before testing | unset |

With no `GRADLE_USER_HOME`, the wrapper searched under `C:\Users\CodexSandboxOffline\.gradle`, did not find the expected distribution, and attempted to contact the configured HTTPS URL. The socket connection then failed with `java.net.SocketException: Permission denied: getsockopt`. This is a sandbox network restriction observed in this run; it does not establish that the user's normal Windows network is blocked.

Setting `GRADLE_USER_HOME` for the current process to `C:\Users\wasim\.gradle` directs the wrapper to the matching cache path, but the retry failed opening `gradle-8.12.1-bin.zip.lck` with `Access is denied`. The ACL on the external cache grants the sandbox identity read/execute only, not write. Thus there are two environment issues: default Java home differs from the cached user's Gradle home, and this sandbox cannot write the cache lock. No cache or project file was deleted or edited. The wrapper root cause is established; no wrapper change is needed to explain the download attempt.

**Safest next wrapper check in the user's own interactive PowerShell** (where the user's profile cache is writable) is to point this process at the existing user cache and run only the version check. First verify the cached distribution's provenance through an official source or use an official Gradle ZIP with its published checksum; do not treat the `.ok` marker as authenticity evidence. No persistent environment setting is required:

```powershell
$env:GRADLE_USER_HOME = Join-Path $env:USERPROFILE '.gradle'
Set-Location android
.\gradlew.bat --version
```

For future reproducibility, add the official Gradle 8.12.1 distribution SHA-256 in a separately reviewed wrapper update. This phase did not alter the wrapper or attempt another network download.

### Gradle execution results

| Command | Result |
|---|---|
| Cached `...\\gradle-8.12.1\\bin\\gradle.bat --version` | **Succeeded.** Gradle 8.12.1 starts on JDK 21.0.4. This is a version/runtime check only. |
| `android\\gradlew.bat --version` with `GRADLE_USER_HOME` unset | **Failed.** It tried the official URL and got `Permission denied: getsockopt`; no ZIP was downloaded. |
| `$env:GRADLE_USER_HOME = Join-Path $env:USERPROFILE '.gradle'; .\\gradlew.bat --version` | **Failed in the sandbox.** It found the intended cache path but could not open/create the wrapper lock file because the sandbox lacks write access there. |
| Cached `gradle.bat --offline --no-daemon help` from `android` | **Failed during project configuration.** Gradle raised `GeneratedClassCompilationException`; the nested cause was `AccessDeniedException` for `gradle-core-api-8.12.1.jar` while JDK ZipFS closed the archive. The external Gradle cache ACL is read/execute for the sandbox identity. No network was used. |
| Same `help` command with `--stacktrace` | **Failed with the same nested `AccessDeniedException`**, confirming the above cause. |
| `tasks`, `:app:assembleDebug`, unit tests | **Not run.** Configuration failed before tasks could be listed; no build claim is made. |

Direct invocation bypasses Wrapper distribution resolution, but it does not bypass Gradle's need to write locks/caches or compile version-catalog accessors. Under this sandbox's external-cache ACL, it is not a usable project-configuration workaround. A run in the user's normal writable account is required to verify `help`/`tasks`. Listing tasks, if later successful, still would not prove the app builds.

### Binding and SDK comparison

| Candidate | Maintenance, license, API and platform evidence | Provider, persistence and wire compatibility | Cost / decision |
|---|---|---|---|
| **`mls-rs` upstream UniFFI for Android** | Upstream is active and Apache-2.0 OR MIT. The current `main` source manifest says `mls-rs-uniffi 0.13.0`, `mls-rs 0.56.0`, and MSRV 1.82; the published docs.rs crate still shows `0.1.0` with an older engine dependency. No official Android AAR/release matrix or production support statement was found. Public open issues [#370](https://github.com/awslabs/mls-rs/issues/370) and [#376](https://github.com/awslabs/mls-rs/issues/376) ask maintainers to clarify mobile support, artifacts, persistence and audit status; they are questions, not upstream guarantees. UniFFI supports Kotlin bindings, but its public API remains pre-1.0. | Current wrapper source constructs OpenSSL and only exposes MLS suite 1. It defines a storage callback interface, but its default config uses in-memory storage. A host can implement durable storage; UniFFI does not supply encrypted storage or Android Keystore integration. OpenSSL is listed stable upstream, but Android packaging/build instructions and ABI artifacts are not supplied by the crate release. | **Do not consume the published crate as a drop-in.** For a prototype, a narrow project-owned UniFFI adapter is possible, but provider and suite selection must be resolved; otherwise maintain a fork. Medium/high ongoing FFI and release ownership. |
| **`mls-rs` with custom Android JNI** | Same engine, Rust MSRV and license. No upstream Android JNI API or binary was identified; `mls-rs-ffi` is a helper C-FFI crate, not a Kotlin SDK. | Provider and storage can be selected in project-owned Rust. JNI would require hand-maintained ownership, threading, cancellation, panic and error mapping. Durable state still needs an app storage adapter and transactional tests. | **Not preferred over UniFFI.** More handwritten unsafe boundary and maintenance without improving protocol interoperability. |
| **Shared `mls-rs` WebAssembly + custom JS binding** | Upstream says WASM builds are supported, but there is no supported official JavaScript/TypeScript API. A custom `wasm-bindgen` interface and generated JS glue are needed. Apache-2.0 OR MIT engine/provider. | `mls-rs-crypto-webcrypto` is explicitly experimental/unsupported and lists suites 2, 5 and 7, not suite 1. `mls-rs-crypto-rustcrypto` lists suites 1–3 and a browser `getrandom/js` feature, but upstream labels that provider experimental. A Web host must supply durable IndexedDB storage and a key-protection design; a WASM build does not provide this automatically. | **Feasible prototype route only.** Must pin the browser glue/provider and test in a real browser. No production readiness claim. |
| **Independent engine on each platform: `mls-rs` Android + `ts-mls` Web** | `ts-mls` is MIT, active, has browser support and npm releases (1.6.4 was published recently; current repository manifest is 2.0.0-rc.16). Its README says it has not had a formal security audit. Android still needs a separate Rust engine/binding. | `ts-mls` has a wide cipher-suite surface; the app must pin and explicitly align a standard suite, MLS version, credential model and extensions with Android. No app-level durable state integration or Android/Web persisted-state compatibility was verified. RFC conformance claims do not establish interoperability between these exact versions. | **Alternative for an independent Web peer test**, not the preferred product architecture. High two-engine qualification and long-term maintenance cost; independently test messages and lifecycle vectors. |
| **OpenMLS Rust and `openmls_dart` cross-platform SDK** | OpenMLS is MIT and has recent releases; its README says Android and WASM targets are built on CI but unsupported/untested. The `openmls` Dart package is MIT and had active 3.2.x releases in September 2026. | Package README reports Android and Web support, SQLCipher storage on native, encrypted IndexedDB on Web, and secure-storage key supplied by host. Its security policy puts core crypto outside wrapper scope; the package/core have not been independently audited here. The README says Flutter `--wasm`/dart2wasm is currently unsupported; standard Flutter Web uses dart2js. | **Credible comparison, poor fit for this repo.** It is based on OpenMLS, requires Flutter/Dart runtime instead of current Jetpack Compose + React, and changes the app architecture. Not selected unless a separate Flutter migration is approved. |
| **New Kotlin Multiplatform MLS AAR** | Maven Central lists `com.vitorpamplona.mls:mls-android` as MIT and targeting Android/iOS/macOS/Linux. The artifact appeared newly published in this review. | No Web/Browser target is listed, so it cannot serve the React web client with one implementation. No independent audit or interoperability evidence for Kotha-Barta was verified. | **Not a cross-platform Android/Web SDK candidate.** Too new and incomplete for this decision; do not add it. |

The `mls-rs` upstream README lists OpenSSL as stable for suites 1–7, AWS-LC as stable for 1, 2, 3, 5 and 7, RustCrypto as experimental for 1–3, and WebCrypto as experimental/unsupported for 2, 5 and 7. Therefore the current UniFFI wrapper (OpenSSL + suite 1) cannot be paired directly with the listed WebCrypto provider. Suite 2 is a common suite across several providers, but that does not make WebCrypto production-supported. The wrapper/provider/suite gap must be solved in the prototype rather than assumed away.

### Decision gate

**Preferred conditional feasibility architecture:** one pinned `mls-rs` Rust core with a very small project-owned UniFFI-facing Android adapter and a separate `wasm-bindgen` JavaScript-facing browser adapter. For the first spike, evaluate RustCrypto on both targets with a single RFC suite it supports (suite 1 or 2) so both platforms exercise the same engine/provider code. This is a prototype choice only: RustCrypto is labeled experimental upstream, and no full third-party audit is claimed. Do not ship it or enable E2EE production conversations on this evidence. The upstream UniFFI wrapper cannot simply be reused for this exact configuration because it hardcodes OpenSSL and only exposes suite 1.

This shared-core route minimizes two independent MLS state machines and offers a single implementation version for message parsing, credentials and protocol state. It does **not** mean Android and Web can share a mutable serialized group state file: each device owns independent state, and persistence/reopen must be tested with the exact locked engine version on that device. Android needs an API backed by app-private transactional storage and Android Keystore-managed at-rest key; Web needs IndexedDB transaction/locking semantics and a browser-protected key. Persist the engine's group/epoch records atomically, version the storage format, and test restart after commits and messages. Never copy state between devices as a substitute for MLS device enrollment.

**Alternative:** retain `mls-rs` on Android and use `ts-mls` as a separately implemented Web client. It gives an independent interop target and keeps the React app in TypeScript, but increases protocol/provider/API drift risk and requires full bidirectional wire, commit, Welcome, persistence and restart qualification. Use it only if the shared WASM adapter/provider gate fails and the project accepts two engine implementations.

**Rejected for the current architecture:** direct use of the published `mls-rs-uniffi 0.1.0` artifact (stale engine line and no verified production Android support); hand-written JNI as the first choice (more low-level FFI risk); `mls-rs` WebCrypto as a production assumption (upstream marks it unsupported); and `openmls_dart` without an app-wide Flutter migration. Separate OpenMLS Android + `ts-mls` Web is also not preferred: it adds a second engine while OpenMLS's Android/WASM target evidence is explicitly build-only/unsupported.

### Verified prerequisites and next execution plan

Before the first isolated prototype build:

1. Select and pin an exact `mls-rs` commit/tag where the engine, RustCrypto provider, UniFFI adapter and codec versions resolve together. Record `Cargo.lock`, license files, checksums and the exact MSRV/CI toolchain. Current upstream main's MSRV is 1.82; do not infer that Rust 1.99.1 is tested merely because it exceeds that minimum.
2. Confirm upstream RustCrypto provider and the same selected RFC suite compile and pass test vectors for `aarch64-linux-android`, `x86_64-linux-android`, and `wasm32-unknown-unknown`. The first two match an arm64 device plus the available x86_64 emulator; 32-bit Android targets are unnecessary unless that ABI matrix changes. Browser randomness must use the target's supported source. Stop if provider/test status or Windows cross-linking cannot be established; do not silently switch to experimental WebCrypto.
3. For Android native compilation, provision the Android NDK and configure target linkers. AGP 8.8's documented NDK default is 27.0.12077973, but this is a candidate baseline, not yet verified against the chosen Rust revision. A prebuilt, provenance-verified compatible `.so` could avoid local NDK compilation, but no official `mls-rs` AAR/artifact was identified.
4. Build an isolated minimal Android native library and WASM module, then test both bindings against upstream vectors and each other: key package, group creation, Welcome join, application messages both directions, proposal/commit ordering, duplicate/reordered delivery, restart/reload from durable stores, and transaction/crash boundaries. Keep each client store independent.
5. Record exact browser and Android API/ABI/runtime, provider/ciphersuite, wire bytes and storage format. Prototype success does not approve production; independent review of core/provider, bindings, identity/enrollment and storage is a separate gate.

No installations or downloads were done. No production code, dependency, wrapper, API, schema or crypto behavior changed. `gradlew` configuration and task listing remain blocked by this sandbox's home/cache ACLs; the user's writable PowerShell session is the next safe environment check.

Additional sources reviewed for Phase 3C:

- [Gradle 8.12.1 wrapper cache path algorithm](https://github.com/gradle/gradle/blob/v8.12.1/platforms/core-runtime/wrapper-shared/src/main/java/org/gradle/wrapper/PathAssembler.java), [wrapper install/cache-marker behavior](https://github.com/gradle/gradle/blob/v8.12.1/platforms/core-runtime/wrapper-shared/src/main/java/org/gradle/wrapper/Install.java), and [official Gradle release checksums](https://gradle.org/release-checksums/).
- [`mls-rs` upstream README and security/provider status](https://github.com/awslabs/mls-rs), [current UniFFI manifest](https://github.com/awslabs/mls-rs/blob/main/mls-rs-uniffi/Cargo.toml), [UniFFI config/default storage](https://github.com/awslabs/mls-rs/blob/main/mls-rs-uniffi/src/config.rs), [foreign storage trait](https://github.com/awslabs/mls-rs/blob/main/mls-rs-uniffi/src/config/group_state.rs), [published crate](https://docs.rs/crate/mls-rs-uniffi/latest), and upstream [mobile/persistence support questions #370](https://github.com/awslabs/mls-rs/issues/370) and [#376](https://github.com/awslabs/mls-rs/issues/376).
- [`mls-rs-crypto-rustcrypto` manifest](https://github.com/awslabs/mls-rs/blob/main/mls-rs-crypto-rustcrypto/Cargo.toml), [`mls-rs-crypto-webcrypto` manifest](https://github.com/awslabs/mls-rs/blob/main/mls-rs-crypto-webcrypto/Cargo.toml), and [`mls-rs-ffi` manifest](https://github.com/awslabs/mls-rs/blob/main/mls-rs-ffi/Cargo.toml).
- [OpenMLS target support and license](https://github.com/openmls/openmls), [OpenMLS releases](https://github.com/openmls/openmls/releases), and [`openmls` Dart package/version/security scope](https://pub.dev/packages/openmls/versions/3.2.1).
- [`ts-mls` README](https://github.com/LukaJCB/ts-mls) and [npm release metadata](https://www.npmjs.com/package/ts-mls); [Maven Central MLS KMP artifact](https://central.sonatype.com/artifact/com.vitorpamplona.mls/mls-android).
- [RFC 9420](https://www.rfc-editor.org/rfc/rfc9420) — MLS wire protocol and application-level transport assumptions.
