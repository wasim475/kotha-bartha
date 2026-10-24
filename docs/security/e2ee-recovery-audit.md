# E2EE message recovery: current state and safe implementation boundary

## Audit result

The device-change failure is caused by where the ECDH private key lives. The web client creates a P-256 ECDH key pair with Web Crypto `extractable: false`, then stores the `CryptoKeyPair` in IndexedDB database `kotha-e2e`, store `keys`, under `device-keypair:<userId>`. A new browser/device creates a different key pair. The old private key is not uploaded, exportable, or derivable from the account password, so account login cannot restore it.

This is compounded by per-device message encryption. Current messages contain one AES-GCM payload per known target `deviceId`; each payload is addressed to a recipient device or the sender's own other device. The server retains public JWKs in `User.publicKeys`, and the message stores `encryptedPayloads` plus the sender public JWK. A device registered later has no payload in already-sent messages. Registering its public key only makes it a target for later messages; it does not grant access to historical ciphertext.

Android currently has no E2EE implementation. `ChatViewModel` sends message text in `SendMessageRequest.body`, the repository has no key registration or crypto dependency, and `MessageBubble` renders encrypted messages as a locked placeholder. A web recovery flow alone would therefore not provide Web↔Android recovery or encrypted Android messaging.

## Existing wire format and compatibility

- Identity agreement: ECDH on NIST P-256.
- Shared key: Web Crypto `deriveKey(ECDH, AES-GCM-256)` directly from the ECDH result. No explicit salt, HKDF info, protocol version, or application AAD is supplied.
- Message encryption: UTF-8 plaintext, AES-GCM, fresh 12-byte random IV, Web Crypto's default 128-bit authentication tag; ciphertext and IV are Base64 strings.
- Legacy record: one `encryptedBody { ciphertext, iv }` and a sender public key. It is only decryptable with the exact historical local key pair and matching peer key.
- Current record: `encryptedPayloads[{ deviceId, ciphertext, iv }]` plus `senderPublicKey`. Readers select the payload matching their own stable browser `deviceId` and derive with that message's sender public key.
- Legacy single-account public keys are surfaced as a synthetic `legacy` device. New public keys are upserted per caller-supplied device ID; updating the same ID replaces that public key, while other IDs remain.
- Encryption is opportunistic: the web send path falls back to a plaintext `body` if it has no usable device targets or crypto is unavailable. Group messages and attachments are outside this E2EE path.
- There are no E2EE crypto test vectors or cross-platform tests in the repository.

## Recovery feasibility for existing accounts

Web Crypto cannot export a key whose `extractable` flag is false. Since the existing private ECDH key is non-extractable, adding a PIN screen, wrapping API, or KDF cannot recover/export that key after the original browser storage is gone. Replacing it would not decrypt historical messages. Existing messages must remain unchanged; they can only be recovered if an existing trusted device still has the required key. This is an existing-key limitation, not a wrong-PIN or backend-fetch issue.

The future recovery PIN requirement is exactly five numeric digits, represented as a string. Leading zeroes are valid (for example, `00427`) and must be preserved; never parse, normalize, or store the PIN as an integer. A uniformly random five-digit PIN has 100,000 possibilities, or about 16.61 bits of entropy; a user-chosen PIN can have less. This remains low entropy and is not safe against offline brute force. If a stored backup can be checked offline, a salt and even an expensive Argon2id KDF only raise the cost per guess; they do not make the PIN high entropy. Argon2id is a reviewed memory-hard KDF, but it is not a substitute for entropy or an online-only secret boundary ([RFC 9106](https://www.rfc-editor.org/rfc/rfc9106.html)).

The recovery UI proposal accepts exactly five ASCII numeric digits (`^[0-9]{5}$`) in both PIN and confirmation fields, including leading zeroes. Client validation must reject any other length or character before beginning recovery; confirmation must match the original string exactly. The server must independently enforce the request contract and length/encoding constraints wherever it can observe the PIN. A privacy-preserving blinded VOPRF request does not reveal the semantic PIN to the service: in that design the client validates before blinding, while the service validates the protocol request shape and input encoding, and must not claim it validated the hidden PIN itself.

## Security boundary required before implementation

A PIN-only backup is acceptable only if a database snapshot is insufficient to verify PIN guesses offline. One candidate architecture for independent review is:

1. A reviewed, standards-conformant VOPRF implementation (RFC 9497) runs with its secret key isolated in a managed HSM or equivalent service, not in the application database or ordinary app process.
2. The client blinds a domain-separated input containing the exact five-digit PIN string (including any leading zero), account ID, recovery version, and envelope ID. The VOPRF service returns an evaluation without learning the PIN. The evaluated output is combined with the envelope's random salt and validated Argon2id parameters to derive a 256-bit wrapping key.
3. The client uses AES-256-GCM to wrap the supported key bundle. AAD binds account ID, envelope ID, protocol version, key IDs, and algorithm/parameter identifiers. The server stores only the opaque envelope and public metadata; it never receives the PIN, derived wrapping key, private key, or plaintext message.
4. VOPRF evaluation is authenticated, short-lived, device-bound, replay-resistant, and strictly rate-limited by account and risk dimensions. Failed attempts are audited without storing PINs, blind inputs, derived secrets, or key material. HSM policy must also impose an evaluation quota; application-level rate limits alone are not enough if an attacker can call the primitive directly.

RFC 9497 defines OPRF/VOPRF protocols and discusses limiting evaluations, but choosing a library, key lifecycle, HSM boundary, abuse policy, and recovery authorization still needs security review ([RFC 9497](https://www.rfc-editor.org/rfc/rfc9497.html)). This repository has no VOPRF/HSM integration or reviewed cross-platform implementation, so the candidate design is not an implemented or verified guarantee. If this trust service is unavailable, the safe product choices are a high-entropy recovery secret, trusted-device transfer, or no PIN-only recovery.

### Proposed recovery API contract and trust assumptions (not implemented)

No recovery route is specified or added here. Any future API proposal must use a reviewed protocol's request shape. For the VOPRF candidate above, the client sends a versioned, fixed-shape blinded input plus the required public recovery/envelope identifiers; it must never send the plaintext PIN. The server validates authentication/authorization, version, encoding, and bounded request size, then applies online rate limits and HSM evaluation quotas. It cannot validate the hidden PIN's five-digit semantics from a correctly blinded input. If a future protocol sends a PIN in an observable form, both the client and server must validate it as a string of exactly five ASCII digits and preserve leading zeroes; that would require a separate privacy/security review.

Online guessing resistance depends on authenticated recovery authorization, strict per-account and risk-based throttling, replay resistance, abuse monitoring, and independent HSM/service quotas. These controls limit access to the online service; they do not make a copied backup safe from offline guessing. The recovery service and its operators/key administrators are trust assumptions: compromise or misuse of its VOPRF key/evaluation capability may weaken the intended boundary. A security review must analyze key isolation, quotas, compromise response, availability, privacy/logging, and denial-of-service behavior. A five-digit PIN is never the sole security boundary and must never be described as offline-brute-force safe.

### Future recovery test plan (not run)

- Verify PIN and confirmation accept exactly five digits, preserve leading zeroes (including `00000` if product policy allows it), and reject four/six digits, non-ASCII digits, letters, spaces, and malformed paste input. Confirm mismatches cannot proceed.
- Verify the PIN remains a string across UI state, serialization, and the local blinding input; no integer conversion, trimming, PIN logging, or plaintext PIN in network payloads.
- Verify client-side validation occurs before blinding. For a blinded protocol, verify server-side validation covers request version, encoding, length bounds, authentication and authorization, while not falsely claiming semantic validation of the concealed PIN. If any future API can observe a plaintext PIN, test independent server rejection of invalid length/characters.
- Exercise online throttling, per-account/risk controls, replay handling, HSM quotas, audit-log redaction, service outages, and recovery authorization. Confirm online limits do not get represented as offline-guess protection.
- Review a stolen-backup/offline-guess scenario and document that the five-digit search space is enumerable; verify the design does not rely on PIN entropy or a database-stored verifier as its only protection.
- Run cross-platform protocol vectors for leading-zero and ordinary PIN strings only after a reviewed protocol and implementation are approved. These are future tests; no recovery feature or test result is claimed in this phase.

## Key and migration implications

- The current non-extractable private keys cannot be silently migrated into a backup. Keep them and all legacy message formats intact.
- New recoverable keys would require an explicit versioned key lifecycle and an export/wrap-capable design. Any extractable key material increases exposure to same-origin script compromise and needs a separate risk decision.
- A new key must be registered as a new device key; never overwrite another device's public key. Historical messages still need the old key. Key revocation and new-message fan-out need an explicit device registry state and policy.
- Android first needs an interoperable implementation of the existing or a versioned replacement E2EE protocol: identity keys, secure local persistence, per-device payload encryption/decryption, legacy handling, message send/edit/reply, and public-key registration. Current Android sends plaintext and cannot participate in the present web protocol.
- Do not re-encrypt existing server ciphertext or claim historical restoration when the required private key is missing. Do not overwrite/delete old key records during enrollment, PIN change, disable, or failed recovery.

## Implementation gate / rollback plan

No recovery endpoint, PIN UI, encrypted-key backup, migration, or fake decrypt path is added until all are available:

1. A reviewed VOPRF/HSM service or approved stronger-factor design and account/device authorization policy.
2. A versioned interoperable key-bundle schema and Android/Web implementations with common deterministic test vectors.
3. A trusted-device migration path that explicitly reports which existing key IDs are recoverable. Existing non-extractable keys absent from trusted devices remain unrecoverable.
4. Rate-limit, replay, overwrite-race, isolation, and lifecycle tests, plus an independent cryptographic review before production rollout.

Rollback must stop creating new envelopes while preserving old public keys, local key records, encrypted messages, and envelope versions needed by existing clients. Recovery disable/revocation must not delete a trusted device's only usable historical key.
