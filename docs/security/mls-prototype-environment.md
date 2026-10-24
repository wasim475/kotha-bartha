# MLS prototype environment readiness

**Checked:** 2026-10-24
**Scope:** Read-only environment inspection and setup guidance. No software was installed, no system-wide settings were changed, and no application or prototype code was created.
**Purpose:** Prepare a reproducible Windows environment for the isolated MLS feasibility prototype described in [`mls-feasibility-report.md`](mls-feasibility-report.md).

## Readiness summary

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
| Gradle wrapper distribution | Available, verified locally | Wrapper cache contains Gradle 8.12.1; its `gradle.bat --version` reports 8.12.1 on JDK 21.0.4. The earlier download failure is no longer a blocker for the distribution itself. |
| Network | Restricted / not verified for current requests | A previous wrapper download attempt failed at the network connection. A complete Gradle 8.12.1 distribution is now present in the user wrapper cache. SDK/Rust/Cargo downloads were not attempted; no proxy environment-variable names were present, and no proxy values or credentials were inspected. |

No environment secrets or credential values were read or recorded. The SDK path in `local.properties` was used only to inspect installed package directories.

## Repository and upstream compatibility findings

### Project versions

- Android uses AGP `8.8.0`, Kotlin `2.0.21`, compile/target SDK `35`, min SDK `26`, and Java bytecode target `17`.
- `android/gradle/wrapper/gradle-wrapper.properties` pins Gradle `8.12.1` and does not specify `distributionSha256Sum`. The wrapper cache contains a complete `gradle-8.12.1` distribution, and the cached launcher reports the pinned version. Its official archive checksum was not independently verified in this phase.
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

The earlier wrapper attempt to fetch `https://services.gradle.org/distributions/gradle-8.12.1-bin.zip` failed while connecting. The wrapper properties still point to the official HTTPS endpoint and TLS verification remains enabled. Current inspection finds a complete Gradle 8.12.1 wrapper-cache directory and its direct launcher reports Gradle 8.12.1, so Gradle distribution availability is now verified locally without triggering a download. The exact cause of the earlier network failure (firewall, transient outage, proxy, DNS, or other policy) was not established. No proxy environment-variable names were present; this does not rule out proxy settings elsewhere. Rust/NDK/SDK downloads may still be blocked and were not attempted.

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
rustup toolchain install <verified-version> --profile minimal --component rustfmt,clippy
rustup target add --toolchain <verified-version> `
  aarch64-linux-android `
  armv7-linux-androideabi `
  x86_64-linux-android `
  i686-linux-android `
  wasm32-unknown-unknown
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
- Prewarm the exact Gradle 8.12.1 wrapper distribution for the same OS/user Gradle cache, or configure an approved internal distribution mirror in a later separately reviewed change. The checked-in wrapper currently points at the public Gradle service.
- Install Rustup's exact host toolchain and Android/WASM target components from official component archives on the staging machine. Do not copy an arbitrary `rustc.exe` without its matching standard libraries, Cargo, linker setup and checksum record.
- On a connected machine, resolve dependencies with the prototype's committed `Cargo.lock`, create Cargo vendor sources, and transfer them with the lockfile and hashes. Then use `cargo build --locked --offline`; all target-specific crates and build dependencies must also be vendored.
- Preinstall the exact SDK Platform, Build Tools, NDK, emulator and system-image packages through official `sdkmanager` on the staging machine. Copying only SDK directories may omit package metadata and accepted license records; prefer a managed SDK mirror or verified complete package archive.
- If binaries cannot be staged or verified, stop at documentation/source review. Do not fabricate test outcomes or substitute a hand-written crypto shim.

## Troubleshooting

| Symptom | Likely cause / action |
|---|---|
| Gradle wrapper fails before configuration | Gradle 8.12.1 distribution is not cached and network access is unavailable; use the approved mirror/offline cache and verify checksum. |
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
3. NDK `27.0.12077973`, Android API 35 SDK/build tools, native dependency versions and ABI list.
4. Exact wasm binding, `wasm-bindgen`/`wasm-pack` version if used, browser test runner and browser version.
5. Gradle 8.12.1 distribution checksum, AGP 8.8.0, Kotlin 2.0.21, and JDK vendor/version.
6. Separate storage roots for client A/B, deterministic test fixture generation, and no production credentials/data.
7. Commands and outputs for group creation, Welcome join, messages both directions, storage restore, Android↔Web interop, duplicate/reorder/crash cases.
8. An artifact manifest containing official source URLs and checksums. Do not commit private identities, generated MLS state, tokens, or test secrets.

## Remaining blockers

- Rust/Cargo and required target libraries are absent; installing them needs approved downloads.
- NDK `27.0.12077973` is absent. Android native builds need NDK and a reproducible OpenSSL/provider route for the current wrapper.
- Gradle 8.12.1 cannot be fetched in the current network environment. Wrapper distribution checksum is not pinned in the repo.
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
