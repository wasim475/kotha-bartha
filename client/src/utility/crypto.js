// Client-side end-to-end encryption for 1-to-1 text messages — multi-device.
//
// Every browser/origin ("device") gets its own stable random deviceId
// (localStorage) and its own ECDH (P-256) keypair, generated the first time
// it's needed. The private key is created non-extractable — normal
// application code (and the server, which never receives it) can never
// read its raw bytes, only use it via the CryptoKey object to derive a
// shared secret. The public key is published to the server, namespaced by
// deviceId, alongside every other device this account (or the person
// they're talking to) has ever registered — see User.publicKeys on the
// server. A message is encrypted once per known device on both sides (the
// recipient's devices, so any of their open browsers can read it, and the
// sender's own other devices, so a refresh or a second browser for the
// *same* account can too), so any one of them can independently derive the
// same per-device shared secret and decrypt without the server ever seeing
// plaintext.
//
// Scope: 1-to-1 text message bodies only — see server/src/routes/chat.routes.js
// and the E2E section of the implementation plan for what's intentionally
// out of scope (attachments, groups, real-time key propagation faster than
// the normal conversation-list refresh cadence).

import { api } from "./api";

const DB_NAME = "kotha-e2e";
const STORE = "keys";
// Pre-fix, this was a single fixed string ("device-keypair") shared by
// every account that ever used this browser/origin — logging in as two
// different users in two tabs (the natural way to manually test a chat
// feature) meant whichever account's tab read IndexedDB first "won" that
// keypair for both, and a later reload could silently pick up a *different*
// user's key, permanently desyncing a device's local private key from the
// public key it had already published to the server (see getOrCreateKeyPair
// below for the full fix, including how existing single-user browsers keep
// their current key rather than losing history unnecessarily).
const keyRecordId = (userId) => `device-keypair:${userId}`;
const LEGACY_KEY_ID = "device-keypair";

// Identifies the pre-multi-device key entry the server preserves under
// User.publicKeys when it migrates an account's old single `publicKey`
// field (see server/src/models/User.js — this exact string must match its
// LEGACY_DEVICE_ID). A device only has a usable private key for this entry
// if it's the same browser/origin that generated the account's original,
// pre-migration keypair (still stored under the un-namespaced
// device-keypair record this module adopts below) — every other device
// simply can't decrypt old-format messages, which is expected.
export const LEGACY_DEVICE_ID = "legacy";

const DEVICE_ID_STORAGE_KEY = "kotha-e2e-device-id";

const cryptoAvailable = () =>
  typeof window !== "undefined" && window.crypto?.subtle && window.indexedDB;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Atomically "get if present, else insert `candidate`" — a single
// readwrite transaction, not a separate get() followed by a separate set()
// (which would leave a window between them for another tab's transaction to
// land in). IndexedDB serializes readwrite transactions against the same
// object store, so whichever tab's transaction commits first really does
// win, and every later tab's transaction is guaranteed to see that already-
// committed value in its own get() — the two-tab race this exists to close.
async function idbGetOrInsert(key, candidate) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(key);
    getReq.onsuccess = () => {
      if (getReq.result !== undefined) {
        resolve(getReq.result);
        return;
      }
      const putReq = store.put(candidate, key);
      putReq.onsuccess = () => resolve(candidate);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

const bufToBase64 = (buffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)));
const base64ToBuf = (base64) =>
  Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer;

// userId -> Promise<CryptoKeyPair|null> — one cached promise per account,
// never a single shared one, so opening two accounts in two tabs (or
// switching accounts without a full page reload) can never hand one
// user's in-memory keypair to another.
const keyPairPromises = new Map();
// `${conversationId}:${peerPublicKeyJwkString}` -> Promise<CryptoKey> — a
// conversation can now involve several target keys at once (one per device
// on each side), so this is no longer a single cached entry per
// conversation; it's keyed on the exact peer key a secret was derived from,
// so a key rotation (or simply a different target device) never reuses a
// shared secret that doesn't match.
const sharedKeyCache = new Map();

// Not persisted — reset on every fresh page load/tab, so a device always
// reconciles with the server at least once per session instead of trusting
// a potentially-stale local flag left over from a previous one (see
// publishPublicKeyIfNeeded below for why that used to be unsafe).
const publishedThisSession = new Set();

async function generateKeyPair() {
  return crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey", "deriveBits"],
  );
}

// A stable, random identifier for *this browser/origin*, independent of
// which account is logged into it — deliberately not derived from the key
// material itself (a device's identity and its key are separate concerns;
// the id is just a lookup handle for "which of my devices published this
// key"). Falls back to an in-memory-only id for the rare case localStorage
// itself is unavailable (e.g. a fully locked-down private-browsing mode) —
// that device simply won't have a stable identity across reloads, which is
// no worse than today's behavior for such a browser.
function getOrCreateDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!id) {
      id =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export function getDeviceId() {
  return getOrCreateDeviceId();
}

// Loads (or creates) this specific user's own keypair record on this
// device. A pre-fix browser may still have one keypair stored under the
// old shared, un-namespaced record — the first account that finds it here
// adopts it (preserving that account's existing message history instead of
// orphaning it for no reason, and becoming this device's "legacy" identity
// for decrypting old-format messages) and the record is removed so no
// other account can also claim it later.
async function loadOrCreateKeyPair(userId) {
  const recordId = keyRecordId(userId);
  const existing = await idbGet(recordId).catch(() => null);
  if (existing) return existing;

  const legacy = await idbGet(LEGACY_KEY_ID).catch(() => null);
  if (legacy) {
    // Race-safe even if two tabs both find the legacy record at once: only
    // whichever tab's atomic insert actually wins gets to delete it, so the
    // loser never deletes a legacy record a third context might still be
    // migrating from, and both tabs still converge on the same adopted key.
    const adopted = await idbGetOrInsert(recordId, legacy);
    if (adopted === legacy) await idbDelete(LEGACY_KEY_ID).catch(() => {});
    return adopted;
  }

  // Two-tab safety: another tab may be generating its own keypair for this
  // exact user at the same time (both saw "nothing stored yet"). Key
  // generation itself can't happen inside an IndexedDB transaction (it's
  // not an IDB operation, and awaiting it would leave the transaction
  // inactive), so it happens here, first — but the actual "claim this
  // record" step is a single atomic get-or-insert transaction, so whichever
  // tab's generated keypair gets there first really does win, and the
  // other tab is guaranteed to see and adopt it instead of silently
  // installing a second, different keypair under the same record.
  const keyPair = await generateKeyPair();
  return idbGetOrInsert(recordId, keyPair);
}

// Publishes this device's public key under its own deviceId (upsert — see
// PATCH /users/me/public-key), never touching any other device's entry.
// Runs at most once per tab session per user: unlike the old
// localStorage-flag check this replaces (which only ever compared against
// what *this device* last thought it told the server, and could never
// notice the server had since been overwritten by a different device),
// this always checks in with the server once per fresh load — cheap, since
// it's an idempotent upsert — so a device can never end up silently stale.
async function publishPublicKeyIfNeeded(publicKey, userId, deviceId) {
  const sessionKey = `${userId}:${deviceId}`;
  if (publishedThisSession.has(sessionKey)) return;

  try {
    const jwk = JSON.stringify(await crypto.subtle.exportKey("jwk", publicKey));
    await api.patch("/users/me/public-key", { deviceId, publicKey: jwk });
    publishedThisSession.add(sessionKey);
  } catch {
    // Non-fatal — retried next time getOrCreateKeyPair runs in this tab
    // (sessionKey was never added), or on the next full page load.
  }
}

// Resolves to { privateKey, publicKey } (CryptoKey objects) for this
// device's keypair, or null if the Web Crypto / IndexedDB APIs aren't
// available in this browser context.
export function getOrCreateKeyPair(userId) {
  if (!userId || !cryptoAvailable()) return Promise.resolve(null);
  if (keyPairPromises.has(userId)) return keyPairPromises.get(userId);

  const promise = (async () => {
    const keyPair = await loadOrCreateKeyPair(userId);
    publishPublicKeyIfNeeded(keyPair.publicKey, userId, getOrCreateDeviceId());
    return keyPair;
  })();

  keyPairPromises.set(userId, promise);
  return promise;
}

// Derives (and caches) the AES-GCM key shared with one specific target
// device's public key (JWK JSON string, as stored in User.publicKeys),
// from this device's own private key.
export async function deriveSharedKey(conversationId, peerPublicKeyJwkString, userId) {
  if (!peerPublicKeyJwkString) return null;

  const cacheKey = `${conversationId}:${peerPublicKeyJwkString}`;
  if (sharedKeyCache.has(cacheKey)) return sharedKeyCache.get(cacheKey);

  const keyPair = await getOrCreateKeyPair(userId);
  if (!keyPair) return null;

  try {
    const peerJwk = JSON.parse(peerPublicKeyJwkString);
    const peerKey = await crypto.subtle.importKey(
      "jwk",
      peerJwk,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    );
    const sharedKey = await crypto.subtle.deriveKey(
      { name: "ECDH", public: peerKey },
      keyPair.privateKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    sharedKeyCache.set(cacheKey, sharedKey);
    return sharedKey;
  } catch {
    return null;
  }
}

export async function encryptMessage(sharedKey, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    new TextEncoder().encode(plaintext),
  );
  return { ciphertext: bufToBase64(ciphertextBuffer), iv: bufToBase64(iv) };
}

export async function decryptMessage(sharedKey, { ciphertext, iv }) {
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBuf(iv) },
    sharedKey,
    base64ToBuf(ciphertext),
  );
  return new TextDecoder().decode(plaintextBuffer);
}

// Encrypts `plaintext` once per target device (deduped by deviceId — the
// caller typically passes the peer's devices concatenated with this
// account's own other devices, so any of them can read it later), all
// under this device's own current keypair. Returns null if there's nothing
// to encrypt for (no known target devices, or Web Crypto unavailable) so
// callers can cleanly fall back to a plaintext send exactly as before.
export async function encryptForDevices(conversationId, targets, plaintext, userId) {
  const keyPair = await getOrCreateKeyPair(userId);
  if (!keyPair) return null;

  const dedupedTargets = new Map();
  for (const target of targets || []) {
    if (target?.deviceId && target?.jwk && !dedupedTargets.has(target.deviceId)) {
      dedupedTargets.set(target.deviceId, target.jwk);
    }
  }
  if (!dedupedTargets.size) return null;

  const payloads = [];
  for (const [deviceId, jwk] of dedupedTargets) {
    const sharedKey = await deriveSharedKey(conversationId, jwk, userId);
    if (!sharedKey) continue;
    const { ciphertext, iv } = await encryptMessage(sharedKey, plaintext);
    payloads.push({ deviceId, ciphertext, iv });
  }
  if (!payloads.length) return null;

  const senderPublicKey = JSON.stringify(await crypto.subtle.exportKey("jwk", keyPair.publicKey));
  return { senderPublicKey, payloads };
}
