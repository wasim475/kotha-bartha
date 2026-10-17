import test from "node:test";
import assert from "node:assert/strict";
import { rateLimitDelayMs } from "../../src/utility/pageEngagementPolicy.js";

test("analytics rate-limit cooldown follows Retry-After seconds and dates", () => {
  const now = Date.parse("2026-01-01T00:00:00Z");
  assert.equal(rateLimitDelayMs("30", now), 30000);
  assert.equal(rateLimitDelayMs("Thu, 01 Jan 2026 00:00:45 GMT", now), 45000);
});

test("analytics rate-limit cooldown uses safe defaults and bounded delays", () => {
  const now = Date.now();
  assert.equal(rateLimitDelayMs(undefined, now), 60000);
  assert.equal(rateLimitDelayMs("0", now), 1000);
  assert.equal(rateLimitDelayMs("3600", now), 5 * 60 * 1000);
  assert.equal(rateLimitDelayMs("invalid", now), 60000);
});
