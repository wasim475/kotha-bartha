# Android FCM setup

FCM code is optional until the app and server are configured. No Firebase project file or service-account credential is committed.

1. Register Android package `com.kothabarta.app` in the Firebase project, enable Firebase Cloud Messaging, download `google-services.json`, and place it at `android/app/google-services.json`. The Gradle build applies the Google Services plugin only when this file exists.
2. On the backend, set `FCM_PROJECT_ID` to the Firebase project ID and set `GOOGLE_APPLICATION_CREDENTIALS` to a protected service-account JSON file path. The service account needs permission to send FCM messages. Do not place this file in the repository.
3. Build/install the Android app from a machine with Google services config. On Android 13+, accept the notification permission prompt. Sign in once to register the installation token; logout removes that installation from the account.
4. Push delivery uses generic message text and does not include plaintext, E2E ciphertext, attachment names, or message previews. Message pushes open the conversation; incoming-call pushes reopen the app so the existing active-call rehydration can show the call UI.

Without the app config and server credentials, token registration and delivery remain disabled. Delivery, force-stop behavior, notification taps, and locked-screen call UX must still be verified on a Google Play services emulator/device.
