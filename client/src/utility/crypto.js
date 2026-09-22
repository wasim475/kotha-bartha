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
const KEY_ID = "device-keypair";
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

const bufToBase64 = (buffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)));
const base64ToBuf = (base64) =>
  Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer;

let keyPairPromise = null;
// conversationId -> { peerPublicKeyJwkString, key } — keyed on the exact
// peer public key the shared secret was derived from, not just the
// conversation id, so a key rotation (peer re-generating a keypair on a
// new/cleared device) invalidates the cache instead of silently reusing a
// shared secret that no longer matches either side's current key.
const sharedKeyCache = new Map();

async function generateAndStoreKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey", "deriveBits"],
  );
  await idbSet(KEY_ID, keyPair);
  return keyPair;
}

async function publishPublicKeyIfNeeded(publicKey, userId) {
  const flag = `${PUBLISHED_FLAG_PREFIX}${userId}`;
  if (localStorage.getItem(flag)) return;

  try {
    const jwk = await crypto.subtle.exportKey("jwk", publicKey);
    await api.patch("/users/me/public-key", { publicKey: JSON.stringify(jwk) });
    localStorage.setItem(flag, "1");
  } catch {
    // Non-fatal — sends fall back to plaintext until this succeeds on a
    // later call (e.g. next app load).
  }
}

// Resolves to { privateKey, publicKey } (CryptoKey objects), or null if the
// Web Crypto / IndexedDB APIs aren't available in this browser context.
export function getOrCreateKeyPair(userId) {
  if (!cryptoAvailable()) return Promise.resolve(null);
  if (keyPairPromise) return keyPairPromise;

  keyPairPromise = (async () => {
    let keyPair = await idbGet(KEY_ID).catch(() => null);
    if (!keyPair) keyPair = await generateAndStoreKeyPair();
    publishPublicKeyIfNeeded(keyPair.publicKey, userId);
    return keyPair;
  })();

  return keyPairPromise;
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
