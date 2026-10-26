const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const User = require("../../src/models/User");
const { createPushDeviceRegistrationHandler } = require("../../src/routes/users.routes");

// This opt-in suite deliberately reads only its dedicated URI. It never loads
// dotenv or falls back to MONGODB_URI or application configuration.
const testUri = process.env.PUSH_DEVICE_TEST_MONGODB_URI;
if (!testUri) {
  throw new Error(
    "PUSH_DEVICE_TEST_MONGODB_URI is required. Set it to a disposable nonproduction MongoDB test database; this suite never uses MONGODB_URI or server/.env.",
  );
}

const target = validateTestTarget(testUri);

test("push-device registration uses real MongoDB transactions and disposable accounts", async (t) => {
  const ownedUserIds = [];
  let connected = false;
  try {
    try {
      await mongoose.connect(testUri, { dbName: target.databaseName });
    } catch (error) {
      throw new Error(`Dedicated push test MongoDB connection failed (${safeErrorName(error)}).`);
    }
    connected = true;

    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    const transactionCapableTopology = Boolean(hello.setName) || hello.msg === "isdbgrid";
    assert.equal(transactionCapableTopology, true, "MongoDB must be a replica set or sharded cluster for transactions");

    await verifyTransactionSupport();

    const accountA = await createDisposableUser(ownedUserIds);
    const accountB = await createDisposableUser(ownedUserIds);
    const handler = createPushDeviceRegistrationHandler();

    await t.test("moves a token atomically and binds it to req.user", async () => {
      const movingToken = freshSecret();
      await User.updateOne({ _id: accountB._id }, { $push: { pushDevices: device("prior-installation-00001", movingToken) } });
      const body = { installationId: "current-installation-00001", token: movingToken, userId: String(accountB._id) };
      const result = await invoke(handler, { body, user: { _id: accountA._id } });
      assert.equal(result.statusCode, 200);
      const [a, b] = await Promise.all([readDevices(accountA._id), readDevices(accountB._id)]);
      assert.equal(a.some((entry) => entry.installationId === body.installationId), true);
      assert.equal(a.some((entry) => entry.token === movingToken), true);
      assert.equal(b.some((entry) => entry.token === movingToken), false);
    });

    await t.test("rolls token movement back when the authenticated-account write fails", async () => {
      const rollbackToken = freshSecret();
      await User.updateOne({ _id: accountB._id }, { $push: { pushDevices: device("rollback-installation-01", rollbackToken) } });
      const failingModel = {
        updateMany: (...args) => User.updateMany(...args),
        updateOne: async () => { throw new Error("injected test write failure"); },
      };
      const failingHandler = createPushDeviceRegistrationHandler({ userModel: failingModel });
      const result = await invoke(failingHandler, {
        body: { installationId: "rollback-target-000001", token: rollbackToken },
        user: { _id: accountA._id },
      });
      assert.equal(result.forwardedError?.message, "injected test write failure");
      const [a, b] = await Promise.all([readDevices(accountA._id), readDevices(accountB._id)]);
      assert.equal(a.some((entry) => entry.token === rollbackToken), false);
      assert.equal(b.some((entry) => entry.token === rollbackToken), true);
    });

    await t.test("refreshes an installation and makes duplicate registration idempotent", async () => {
      const installationId = "refresh-installation-0001";
      const firstToken = freshSecret();
      const refreshedToken = freshSecret();
      const body = { installationId, token: firstToken };
      assert.equal((await invoke(handler, { body, user: { _id: accountA._id } })).statusCode, 200);
      assert.equal((await invoke(handler, { body: { installationId, token: refreshedToken }, user: { _id: accountA._id } })).statusCode, 200);
      assert.equal((await invoke(handler, { body: { installationId, token: refreshedToken }, user: { _id: accountA._id } })).statusCode, 200);
      const devices = await readDevices(accountA._id);
      assert.equal(devices.filter((entry) => entry.installationId === installationId).length, 1);
      assert.equal(devices.some((entry) => entry.token === firstToken), false);
      assert.equal(devices.some((entry) => entry.token === refreshedToken), true);
    });

    await t.test("retains at most eight devices after registration", async () => {
      const devices = Array.from({ length: 8 }, (_, index) => device(`cap-installation-${String(index).padStart(2, "0")}`, freshSecret()));
      await User.updateOne({ _id: accountA._id }, { $set: { pushDevices: devices } });
      const result = await invoke(handler, {
        body: { installationId: "cap-new-installation-0001", token: freshSecret() },
        user: { _id: accountA._id },
      });
      assert.equal(result.statusCode, 200);
      const after = await readDevices(accountA._id);
      assert.equal(after.length, 8);
      assert.equal(after.some((entry) => entry.installationId === "cap-new-installation-0001"), true);
      assert.equal(after.some((entry) => entry.installationId === "cap-installation-00"), false);
    });
  } finally {
    if (connected) {
      if (ownedUserIds.length) await User.deleteMany({ _id: { $in: ownedUserIds } });
      await mongoose.disconnect();
    }
  }
});

function validateTestTarget(uri) {
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error("PUSH_DEVICE_TEST_MONGODB_URI must be a valid MongoDB URI for a dedicated test database.");
  }
  if (!["mongodb:", "mongodb+srv:"].includes(parsed.protocol)) {
    throw new Error("PUSH_DEVICE_TEST_MONGODB_URI must use mongodb:// or mongodb+srv://.");
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!/^kothax_push_test_[a-z0-9_-]+$/i.test(databaseName)) {
    throw new Error("PUSH_DEVICE_TEST_MONGODB_URI database name must be kothax_push_test_<suffix>.");
  }
  return { databaseName };
}

async function verifyTransactionSupport() {
  const session = await mongoose.startSession();
  const probeId = `probe-${crypto.randomUUID()}`;
  const collection = mongoose.connection.db.collection("push_device_transaction_probe");
  try {
    session.startTransaction();
    await collection.insertOne({ _id: probeId }, { session });
    await session.abortTransaction();
    const remaining = await collection.countDocuments({ _id: probeId });
    assert.equal(remaining, 0, "transaction abort must roll back the probe write");
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    throw new Error(`MongoDB transaction support check failed (${safeErrorName(error)}).`);
  } finally {
    await session.endSession();
  }
}

function safeErrorName(error) {
  return /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(error?.name || "") ? error.name : "Error";
}

async function createDisposableUser(ownedUserIds) {
  const suffix = crypto.randomUUID();
  const user = await User.create({
    fullName: "Push Integration Test",
    email: `push-test-${suffix}@invalid.example`,
    passwordHash: `non-authenticatable-test-${suffix}`,
  });
  ownedUserIds.push(user._id);
  return user;
}

function device(installationId, token) {
  return { installationId, token, updatedAt: new Date() };
}

function freshSecret() {
  return crypto.randomBytes(48).toString("base64url");
}

async function readDevices(userId) {
  const user = await User.findById(userId).select("+pushDevices").lean();
  return user?.pushDevices || [];
}

async function invoke(handler, req) {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let forwardedError;
  await handler(req, res, (error) => { forwardedError = error; });
  return { ...res, forwardedError };
}
