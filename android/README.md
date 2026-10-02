# Android app

## Local API connection

The debug build defaults to `http://10.0.2.2:5000`, which reaches the host computer from the Android emulator. Start the backend from `server/` with `npm run dev`.

For a physical phone, use the computer's LAN IP address and keep the phone and computer on the same network. The backend must listen on that interface, and the computer firewall must allow port 5000. Override the debug URLs when building:

```powershell
cd android
.\gradlew.bat :app:assembleDebug `
	-PAPI_BASE_URL=http://192.168.1.50:5000/api/v1/ `
	-PSOCKET_URL=http://192.168.1.50:5000
```

Replace `192.168.1.50` with the computer's actual LAN IP. Debug builds allow cleartext HTTP for local development; release builds use the HTTPS production endpoint and disallow cleartext traffic.

## Google sign-in

The login screen uses Android Credential Manager and sends the resulting Google ID token to `POST /api/v1/auth/google`. The default web client ID matches the existing client and server configuration. Override it with `-PGOOGLE_WEB_CLIENT_ID=...` if using another Google Cloud project. Register the Android app package (`com.kothabarta.app`) and its signing certificate fingerprint in that project's OAuth configuration. The backend must have the matching `GOOGLE_CLIENT_ID` configured.
