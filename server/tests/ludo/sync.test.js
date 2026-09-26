const test = require("node:test");
const assert = require("node:assert/strict");

const { run } = require("../../scripts/sync-ludo-engine");

// The client's copy of the engine (used for Local Ludo and for animating the
// server's results) is generated from the server's files. If someone edits the
// server engine and forgets to regenerate, the two rule sets would diverge —
// this test fails instead.
test("the client's Ludo engine copy is identical to the server's (regenerate with `npm run sync:ludo`)", () => {
  assert.deepEqual(run(true), []);
});
