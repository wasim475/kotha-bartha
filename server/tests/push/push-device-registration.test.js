const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isValidPushInstallationId,
  parsePushDeviceRegistration,
} = require("../../src/utils/pushDevices");
const { requireAuth } = require("../../src/middleware/auth");
const { createPushDeviceRegistrationHandler } = require("../../src/routes/users.routes");

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

test("authenticated registration, token refresh, duplicate submission, and ownership use req.user", async () => {
  const db = registrationDb({
    accountA: [{ installationId: "old-installation-0001", token: "t".repeat(40) }],
    accountB: [{ installationId: "another-installation-01", token: "u".repeat(40) }],
  });
  const handler = createPushDeviceRegistrationHandler(db.dependencies);
  const body = { installationId: "installation-0000001", token: "t".repeat(40), userId: "accountB" };
  const first = await invoke(handler, { body, user: { _id: "accountA" } });
  assert.equal(first.statusCode, 200);
  assert.equal(db.state.accountA.length, 1);
  assert.equal(db.state.accountA[0].installationId, body.installationId);
  assert.equal(db.state.accountB.some((entry) => entry.token === body.token), false);

  const refreshedToken = "v".repeat(40);
  await invoke(handler, { body: { installationId: body.installationId, token: refreshedToken }, user: { _id: "accountA" } });
  assert.equal(db.state.accountA.length, 1);
  assert.equal(db.state.accountA[0].token, refreshedToken);

  await invoke(handler, { body: { installationId: body.installationId, token: refreshedToken }, user: { _id: "accountA" } });
  assert.equal(db.state.accountA.length, 1);
  assert.equal(db.state.accountA[0].token, refreshedToken);
  assert.equal(db.queries.every(({ filter }) => filter._id === "accountA" || filter._id?.$ne === "accountA"), true);
});

test("registration caps devices at eight while retaining existing installations", async () => {
  const existing = Array.from({ length: 8 }, (_, index) => ({
    installationId: `installation-${String(index).padStart(8, "0")}`,
    token: String(index).repeat(40),
  }));
  const db = registrationDb({ accountA: existing });
  const handler = createPushDeviceRegistrationHandler(db.dependencies);
  await invoke(handler, { body: { installationId: "new-installation-0001", token: "z".repeat(40) }, user: { _id: "accountA" } });
  assert.equal(db.state.accountA.length, 8);
  assert.equal(db.state.accountA.at(-1).installationId, "new-installation-0001");
  assert.equal(db.state.accountA.some((entry) => entry.installationId === "installation-00000000"), false);
  assert.equal(db.txCount, 1);
});

test("malformed registration is rejected before opening a transaction", async () => {
  const db = registrationDb({});
  const handler = createPushDeviceRegistrationHandler(db.dependencies);
  const result = await invoke(handler, { body: { installationId: "bad", token: "secret" }, user: { _id: "accountA" } });
  assert.equal(result.statusCode, 400);
  assert.equal(db.txCount, 0);
});

test("a failed registration write rolls back token ownership and ends its session", async () => {
  const token = "x".repeat(40);
  const db = registrationDb({ accountB: [{ installationId: "old-installation-0001", token }] }, { failOwnWrite: true });
  const handler = createPushDeviceRegistrationHandler(db.dependencies);
  let forwarded;
  await handler({ body: { installationId: "new-installation-0001", token }, user: { _id: "accountA" } }, response(), (error) => { forwarded = error; });
  assert.equal(forwarded.message, "write failed");
  assert.equal(db.state.accountB[0].token, token);
  assert.equal(db.state.accountA, undefined);
  assert.equal(db.sessionEnded, true);
});

function registrationDb(initialState, { failOwnWrite = false } = {}) {
  const state = structuredClone(initialState);
  const queries = [];
  let txCount = 0;
  let sessionEnded = false;
  const session = {
    async withTransaction(work) {
      txCount += 1;
      const snapshot = structuredClone(state);
      try { await work(); } catch (error) {
        for (const key of Object.keys(state)) delete state[key];
        Object.assign(state, snapshot);
        throw error;
      }
    },
    async endSession() { sessionEnded = true; },
  };
  const dependencies = {
    mongoose: { startSession: async () => session },
    userModel: {
      async updateMany(filter, update) {
        queries.push({ filter, update });
        for (const [id, devices] of Object.entries(state)) {
          if (id !== filter._id.$ne) state[id] = devices.filter((device) => device.token !== update.$pull.pushDevices.token);
        }
      },
      async updateOne(filter, pipeline, options) {
        queries.push({ filter, pipeline, options });
        assert.equal(options.updatePipeline, true);
        if (failOwnWrite) throw new Error("write failed");
        const existing = state[filter._id] || [];
        const addition = pipeline[0].$set.pushDevices.$slice[0].$concatArrays[1][0];
        state[filter._id] = existing.filter((device) =>
          device.installationId !== addition.installationId && device.token !== addition.token,
        ).concat(addition).slice(-8);
      },
    },
  };
  return { state, queries, dependencies, get txCount() { return txCount; }, get sessionEnded() { return sessionEnded; } };
}

async function invoke(handler, req) {
  const res = response();
  let forwarded;
  await handler(req, res, (error) => { forwarded = error; });
  if (forwarded) throw forwarded;
  return res;
}

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}
