// Deterministic pseudo-random numbers for the Ludo engine.
//
// The generator state is one 32-bit integer stored INSIDE the game state, so the
// engine stays a pure function: the same state + action always gives the same
// dice. (mulberry32 — small, fast, well distributed for a game like this.)
//
// Online, the server seeds each game from crypto.randomBytes and never sends the
// seed to clients (see publicState), so dice cannot be predicted. Local games
// seed from the browser's crypto.getRandomValues.

const toUint32 = (value) => value >>> 0;

// Returns { value: float in [0, 1), state: next generator state }.
function nextFloat(state) {
  let t = toUint32(state) + 0x6d2b79f5;
  const next = toUint32(t);
  t = Math.imul(next ^ (next >>> 15), next | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = toUint32(t ^ (t >>> 14)) / 4294967296;
  return { value, state: next };
}

// A fair die roll, 1..6 (or 1..sides).
function rollDie(state, sides = 6) {
  const { value, state: next } = nextFloat(state);
  return { value: 1 + Math.floor(value * sides), state: next };
}

module.exports = { toUint32, nextFloat, rollDie };
