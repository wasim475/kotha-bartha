const test = require("node:test");
const assert = require("node:assert/strict");
const {
  EXPECTED_PROJECT_ID,
  inspectCredentialFile,
  initializeMessaging,
  authenticateApplicationDefaultCredentials,
  sendTestNotification,
} = require("../../scripts/fcm-ops");

test("FCM runtime initialization uses the modern Firebase Admin app API and reuses one app", () => {
  const apps = [];
  const admin = {
    getApps: () => apps,
    initializeApp(options, name) {
      const app = { options, name };
      apps.push(app);
      return app;
    },
  };
  const factory = (instance, projectId) => {
    const app = instance.getApps().find((candidate) => candidate.options.projectId === projectId)
      || instance.initializeApp({ projectId }, `kotha-barta-${projectId}`);
    return { app };
  };

  const messaging = initializeMessaging(admin, EXPECTED_PROJECT_ID, factory);
  assert.equal(messaging.app.options.projectId, EXPECTED_PROJECT_ID);
  assert.equal(apps.length, 1);
});

test("FCM diagnostics validate ADC file metadata without exposing credential contents", () => {
  const result = inspectCredentialFile({
    FCM_PROJECT_ID: EXPECTED_PROJECT_ID,
    GOOGLE_APPLICATION_CREDENTIALS: "/private/firebase-service-account.json",
  }, (path, encoding) => {
    assert.equal(path, "/private/firebase-service-account.json");
    assert.equal(encoding, "utf8");
    return JSON.stringify({
      type: "service_account",
      project_id: EXPECTED_PROJECT_ID,
      private_key: "test-only-private-key",
    });
  });

  assert.deepEqual(result, { projectId: EXPECTED_PROJECT_ID });
  assert.equal(JSON.stringify(result).includes("private_key"), false);
});

test("FCM diagnostics reject absent, invalid, or mismatched credential configuration", () => {
  assert.throws(() => inspectCredentialFile({}), /FCM_PROJECT_ID/);
  assert.throws(() => inspectCredentialFile({
    FCM_PROJECT_ID: EXPECTED_PROJECT_ID,
  }), /GOOGLE_APPLICATION_CREDENTIALS/);
  assert.throws(() => inspectCredentialFile({
    FCM_PROJECT_ID: EXPECTED_PROJECT_ID,
    GOOGLE_APPLICATION_CREDENTIALS: "/private/credentials.json",
  }, () => "not json"), /not valid JSON/);
  assert.throws(() => inspectCredentialFile({
    FCM_PROJECT_ID: EXPECTED_PROJECT_ID,
    GOOGLE_APPLICATION_CREDENTIALS: "/private/credentials.json",
  }, () => JSON.stringify({ type: "service_account", project_id: "other-project" })), /does not match/);
});

test("FCM one-device send uses a single supplied token and generic notification copy", async () => {
  const requests = [];
  const messaging = { send: async (request) => { requests.push(request); return "message-id"; } };
  const result = await sendTestNotification(messaging, "test-device-token");

  assert.equal(result, "message-id");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].token, "test-device-token");
  assert.deepEqual(requests[0].notification, {
    title: "KothaX test notification",
    body: "FCM test message.",
  });
  assert.equal("topic" in requests[0], false);
});

test("FCM runtime verification obtains an ADC access token without returning it", async () => {
  class FakeGoogleAuth {
    constructor(options) { assert.deepEqual(options.scopes, ["https://www.googleapis.com/auth/firebase.messaging"]); }
    async getClient() { return { getAccessToken: async () => ({ token: "test-only-access-token" }) }; }
  }

  assert.deepEqual(
    await authenticateApplicationDefaultCredentials(EXPECTED_PROJECT_ID, FakeGoogleAuth),
    { authenticated: true, projectId: EXPECTED_PROJECT_ID },
  );
});

test("FCM runtime verification fails when ADC cannot obtain an access token", async () => {
  class FakeGoogleAuth {
    async getClient() { return { getAccessToken: async () => ({ token: null }) }; }
  }

  await assert.rejects(
    authenticateApplicationDefaultCredentials(EXPECTED_PROJECT_ID, FakeGoogleAuth),
    /Could not authenticate Application Default Credentials/,
  );
});

test("FCM one-device send refuses an absent token without calling Firebase", async () => {
  let called = false;
  await assert.rejects(
    sendTestNotification({ send: async () => { called = true; } }, ""),
    /FCM_TEST_TOKEN/,
  );
  assert.equal(called, false);
});

test("FCM send failures do not expose the token or raw provider error", async () => {
  const token = "sensitive-test-device-token";
  await assert.rejects(
    sendTestNotification({
      send: async () => { throw Object.assign(new Error(`provider rejected ${token}`), { code: "messaging/invalid-argument" }); },
    }, token),
    (error) => {
      assert.equal(error.message, "FCM test notification failed.");
      assert.equal(error.code, "messaging/invalid-argument");
      assert.equal(error.message.includes(token), false);
      return true;
    },
  );
});
