// Client-side end-to-end encryption for 1-to-1 text messages.
//
// Each device generates its own ECDH (P-256) keypair the first time it's
// needed. The private key is created non-extractable — normal application
// code (and the server, which never receives it) can never read its raw
// bytes, only use it via the CryptoKey object to derive a shared secret.
// The public key is published to the server so the other participant's
// browser can derive the same shared AES-GCM key locally (ECDH) and
// encrypt/decrypt without the server ever seeing plaintext.
//
// Scope: 1-to-1 text message bodies only — see server/src/routes/chat.routes.js
// and the E2E section of the implementation plan for what's intentionally
// out of scope (attachments, groups, multi-device key sync).

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
const PUBLISHED_FLAG_PREFIX = "kotha-e2e-published-";

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

async function idbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
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

const bufToBase64 = (buffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)));
const base64ToBuf = (base64) =>
  Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer;

// userId -> Promise<CryptoKeyPair|null> — one cached promise per account,
// never a single shared one, so opening two accounts in two tabs (or
// switching accounts without a full page reload) can never hand one
// user's in-memory keypair to another.
const keyPairPromises = new Map();
// conversationId -> { peerPublicKeyJwkString, key } — keyed on the exact
// peer public key the shared secret was derived from, not just the
// conversation id, so a key rotation (peer re-generating a keypair on a
// new/cleared device) invalidates the cache instead of silently reusing a
// shared secret that no longer matches either side's current key.
const sharedKeyCache = new Map();

async function generateKeyPair() {
  return crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey", "deriveBits"],
  );
}

// Loads (or creates) this specific user's own keypair record. A pre-fix
// browser may still have one keypair stored under the old shared,
// un-namespaced record — the first account that finds it here adopts it
// (preserving that account's existing message history instead of orphaning
// it for no reason) and the record is removed so no other account can also
// claim it later.
async function loadOrCreateKeyPair(userId) {
  const recordId = keyRecordId(userId);
  const existing = await idbGet(recordId).catch(() => null);
  if (existing) return existing;

  const legacy = await idbGet(LEGACY_KEY_ID).catch(() => null);
  if (legacy) {
    await idbSet(recordId, legacy);
    await idbDelete(LEGACY_KEY_ID).catch(() => {});
    return legacy;
  }

  const keyPair = await generateKeyPair();
  await idbSet(recordId, keyPair);
  return keyPair;
}

// The "have we published this" flag stores the exact JWK we last published,
// not just a boolean — so if the local key ever ends up not matching what
// the server has on file for us (e.g. a browser affected by the old
// shared-keypair bug above, before this fix), this notices the mismatch and
// republishes automatically instead of silently staying wrong forever.
async function publishPublicKeyIfNeeded(publicKey, userId) {
  const flagKey = `${PUBLISHED_FLAG_PREFIX}${userId}`;

  try {
    const jwk = JSON.stringify(await crypto.subtle.exportKey("jwk", publicKey));
    if (localStorage.getItem(flagKey) === jwk) return;

    await api.patch("/users/me/public-key", { publicKey: jwk });
    localStorage.setItem(flagKey, jwk);
  } catch {
    // Non-fatal — retried next time getOrCreateKeyPair runs (e.g. next
    // app load), since the flag was never updated to match.
  }
}

// Resolves to { privateKey, publicKey } (CryptoKey objects), or null if the
// Web Crypto / IndexedDB APIs aren't available in this browser context.
export function getOrCreateKeyPair(userId) {
  if (!userId || !cryptoAvailable()) return Promise.resolve(null);
  if (keyPairPromises.has(userId)) return keyPairPromises.get(userId);

  const promise = (async () => {
    const keyPair = await loadOrCreateKeyPair(userId);
    publishPublicKeyIfNeeded(keyPair.publicKey, userId);
    return keyPair;
  })();

  keyPairPromises.set(userId, promise);
  return promise;
}

// Derives (and caches) the AES-GCM key shared with a specific conversation's
// peer, from our private key and their published public key (JWK JSON
// string, as stored on User.publicKey).
export async function deriveSharedKey(conversationId, peerPublicKeyJwkString, userId) {
  if (!peerPublicKeyJwkString) return null;

  const cached = sharedKeyCache.get(conversationId);
  if (cached && cached.peerPublicKeyJwkString === peerPublicKeyJwkString) {
    return cached.key;
  }

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
    sharedKeyCache.set(conversationId, { peerPublicKeyJwkString, key: sharedKey });
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
