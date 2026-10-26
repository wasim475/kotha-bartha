const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isValidPushInstallationId,
  parsePushDeviceRegistration,
} = require("../../src/utils/pushDevices");
const { requireAuth } = require("../../src/middleware/auth");

test("push registration accepts bounded installation IDs and FCM tokens", () => {
  const registration = parsePushDeviceRegistration({
    installationId: "0123456789abcdef0123456789abcdef",
    token: "f".repeat(128),
  });
  assert.deepEqual(registration, {
    installationId: "0123456789abcdef0123456789abcdef",
    token: "f".repeat(128),
  });
});

test("push registration rejects malformed or oversized client values", () => {
  assert.equal(parsePushDeviceRegistration({ installationId: "../someone-else", token: "x".repeat(40) }), null);
  assert.equal(parsePushDeviceRegistration({ installationId: "a".repeat(16), token: "short" }), null);
  assert.equal(parsePushDeviceRegistration({ installationId: "a".repeat(129), token: "x".repeat(40) }), null);
  assert.equal(parsePushDeviceRegistration({ installationId: "a".repeat(16), token: "x".repeat(4097) }), null);
});

test("unregistration accepts only a bounded installation identifier", () => {
  assert.equal(isValidPushInstallationId("a".repeat(16)), true);
  assert.equal(isValidPushInstallationId("../other-account"), false);
});

test("unauthenticated push-device requests are rejected before route execution", async () => {
  let responseCode;
  let nextCalled = false;
  const response = {
    status(code) {
      responseCode = code;
      return this;
    },
    json() {
      return this;
    },
  };

  await requireAuth({ cookies: {}, headers: {} }, response, () => {
    nextCalled = true;
  });

  assert.equal(responseCode, 401);
  assert.equal(nextCalled, false);
});
