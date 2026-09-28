# android/ — architecture scaffold only

This directory is a **planning scaffold**, not a buildable Android project. Nothing here has been initialized yet:

- No Gradle files (`build.gradle.kts`, `settings.gradle.kts`, wrapper) exist.
- No `AndroidManifest.xml` exists.
- No Kotlin source files exist.
- No dependencies have been installed.

The folders (`app/`, `core/*`, `feature/*`) exist only to reserve the intended module boundaries, derived from the actual Kotha-Barta web/backend feature set. See `../docs/architecture/android-readiness.md` and `../docs/architecture/android-architecture.md` for what each folder is for and why, and `../docs/architecture/android-api-contract.md` / `android-realtime-contract.md` / `android-webrtc.md` / `android-games.md` for the contracts this future app will consume from `server/`.

Implementation (Gradle init, Kotlin, Compose, ViewModels, repositories) has **not started**. Do not add code here without first confirming the plan in those docs is still current.
