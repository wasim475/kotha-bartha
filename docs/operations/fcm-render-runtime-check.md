# FCM runtime verification on Render

The backend provides two local operational commands. Neither exposes an HTTP endpoint:

- `npm run fcm:verify` checks the configured credential file, validates its JSON and project ID, obtains an ADC access token for Firebase Messaging, and initializes/reuses the Firebase Admin app. It does not send a notification.
- `npm run fcm:test-send` performs the same checks, then sends one generic notification to the single token supplied in `FCM_TEST_TOKEN`.

The diagnostics print only the project ID, pass/fail summaries, a Firebase message ID after an accepted test send, and sanitized Firebase error codes. They never print credential contents, access tokens, device tokens, or raw provider errors. An accepted message ID confirms FCM accepted the request; it does not prove delivery to the device.

## One-off verification job

Set these on the Render backend service before running the job:

- `FCM_PROJECT_ID=kothax-14bd0`
- `GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/firebase-service-account.json`
- The matching Firebase service-account secret file mounted at that path.

Deploy the code containing `scripts/fcm-ops.js`, then create a one-off job against the backend service. With the Render CLI logged in and the correct workspace selected:

```sh
render jobs create <BACKEND_SERVICE_ID> --start-command "npm run fcm:verify"
```

The command assumes the backend service's configured root directory is `server`. If the service root is the repository root, use `cd server && npm run fcm:verify` instead. Review the job status and its output in Render. A successful run confirms the secret file was readable and valid, its project matched, ADC obtained a Firebase Messaging access token, and Firebase Admin initialization reused or created exactly one app for the project. It does not send a message or verify that Firebase would authorize a real send.

Render one-off jobs use the base service's latest successful build artifact and configured environment variables. Render's one-off-job documentation does not explicitly state that secret files are mounted into the job. If the verification reports the credential file missing/unreadable, use a Render ephemeral SSH shell for the backend service (supported for compatible paid services with a successful deploy), then run `npm run fcm:verify` from the backend service root. The ephemeral shell does not receive production traffic or start the web process, and is deleted when the session ends.

## Separate one-device send

Only run after verification succeeds and you have one test device's current FCM token. Do not add the token to Render service settings, a job command, source control, or logs. Open an ephemeral Render shell for the backend service, then enter the token at the hidden prompt:

```sh
IFS= read -r -s -p "Test device FCM token: " FCM_TEST_TOKEN
printf '\n'
export FCM_TEST_TOKEN
npm run fcm:test-send
unset FCM_TEST_TOKEN
```

This calls Firebase Admin once with that token and a generic notification. It does not look up registered users, query the database, or broadcast. The output distinguishes an FCM-accepted message from a failed request; check the test device to confirm actual delivery.

For a Render service root directory other than `server`, change to that configured root before running either npm command. No production runtime is inspected from the development workspace; the Render job or ephemeral shell must be run manually by an authorized operator.

Render references: [One-off jobs](https://render.com/docs/one-off-jobs), [SSH and ephemeral shell access](https://render.com/docs/ssh), and [Secret files](https://render.com/docs/configure-environment-variables#secret-files).
