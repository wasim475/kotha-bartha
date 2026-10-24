# Android E2EE Phase 1 audit and protocol design gate

**Status: audit complete; protocol implementation is intentionally gated.** No Android crypto, key API, migration, or message-wire changes are part of this phase. The current Web protocol can be read for compatibility, but it is not a sufficient security design to reproduce on Android without a versioned protocol decision and independent review.

## Audit findings

### Web identity keys and local storage

- `client/src/utility/crypto.js` creates one P-256 ECDH pair per browser device and account. Web Crypto generates it with `extractable: false` and usages `deriveKey`/`deriveBits`.
- The `CryptoKeyPair` is stored as a structured-cloned key object in IndexedDB `kotha-e2e`, object store `keys`, key `device-keypair:<userId>`. The old shared `device-keypair` record is adopted by the first account that finds it, then deleted. Current records are account-namespaced.
- `kotha-e2e-device-id` is stored in `localStorage`, shared by accounts on the same browser origin; it is a lookup ID, not key material. If local storage is unavailable, an in-memory device ID is created and changes on reload.
- A page-local key-pair promise is cached per account. A generated/persisted public JWK is asynchronously published through authenticated `PATCH /users/me/public-key`.
- Logout calls the auth endpoint and clears React auth state; it deliberately does not remove IndexedDB keypairs or the stable browser device ID. Account namespacing prevents the app's normal lookup from using another account's pair, but local keys survive logout.

### Confirmed Web wire protocol

1. The sender imports a target public JWK as ECDH P-256 and calls Web Crypto `deriveKey` using the sender's local private key to derive an AES-GCM-256 key. The conversation ID only namespaces the in-memory cache; it is not an input to ECDH/key derivation.
2. The shared AES key is cached for each `(conversationId, peer JWK string)`. It is not persisted as a raw key.
3. Each text encryption uses a fresh random 12-byte IV and AES-GCM with Web Crypto's default 128-bit tag. Plaintext is UTF-8. Ciphertext and IV are Base64 encoded. The code supplies no explicit application AAD, HKDF salt/info, protocol version, message ID, sender ID, or conversation ID to the encryption operation.
4. Current device fan-out produces `encryptedPayloads[{deviceId,ciphertext,iv}]` for the peer's published device keys and the sender's own other published device keys. The sending device is represented by the per-message `senderPublicKey`; each receiving device finds its own `deviceId` entry and derives ECDH with that sender key.
5. Legacy messages use one `encryptedBody {ciphertext,iv}`. Legacy decryption uses the synthetic peer device ID `legacy` and the original local private pair. Current multi-device readers also retain this legacy path.

The current protocol does not explicitly use HKDF, versioned authenticated metadata, a ratchet, cryptographic sender signatures, or an anti-replay counter. The AES-GCM tag detects ciphertext/IV tampering, but a valid whole encrypted payload is not bound to a conversation/message identity and can be replayed as another stored message. Reusing the same ECDH-derived AES key with random IVs makes nonce uniqueness probabilistic, not enforced. No claim of forward secrecy or post-compromise security is supported by this static ECDH design.

### Public keys, device lifecycle, and trust

- `User.publicKeys` stores `{deviceId,jwk,updatedAt}` entries; old `User.publicKey` is exposed as a synthetic `legacy` entry.
- Authenticated `PATCH /users/me/public-key` upserts by caller-supplied device ID. It allows a same-ID key replacement and has no signed device certificate, key transparency, revocation state, or user-visible key verification. It bounds string lengths but does not cryptographically validate/bind the JWK to a previously trusted device.
- Existing device IDs are never removed by ordinary key registration. The list can grow, while a message permits at most 20 encrypted targets. No policy handles overflow/revocation.
- The public-key list is returned to a 1:1 conversation peer. The sender trusts this server-provided list. HTTPS and authenticated account ownership protect transport/account access, but do not provide end-to-end identity verification against a malicious or compromised server/account.
- There is no formal key-rotation protocol. Replacing the key at the same `deviceId` can strand ciphertext addressed to that ID if the matching private key is gone. Different device IDs preserve old public entries but do not create historical ciphertext for the new device.

### Server, REST, Socket.IO, and message metadata

- `server/src/routes/chat.routes.js` accepts either legacy top-level `ciphertext`/`iv` or current `encryptedPayloads` plus `senderPublicKey`; it stores ciphertext opaquely in `Message.encryptedBody` or `Message.encryptedPayloads`. It does not decrypt.
- The server checks conversation participation, validates the encrypted payload shape, bounds ciphertext length, and caps fan-out at 20. It does not validate decoded IV size, parse/validate the sender JWK, confirm each target device belongs to a conversation participant, or enforce protocol versions/anti-replay identifiers.
- REST responses and `message:new`/`message:updated` Socket.IO events relay encrypted fields. Push notifications use a generic “New encrypted message” preview. Delivery/read status, timestamps, message IDs, sender/recipient/conversation IDs, reactions, and attachment metadata remain server-visible.
- Message edits accept the same encrypted/plain formats. Web re-encrypts an edit only when the original is encrypted and target keys are present; otherwise it sends `{body: text}`. The normal send path also falls back to plaintext if encryption is unavailable or no device target can be encrypted. Thus Web E2EE is opportunistic, not enforced for every direct message.
- Attachments are separately uploaded through the server/Cloudinary and are not encrypted by this E2EE utility. Group messages are not encrypted by it. Reply content can be encrypted only as the quoted message's existing message content; metadata remains server-visible.
- Reactions, read/delivery state, delete/unsend, forwarding, and notifications are server-side metadata/actions. They do not add encryption or replay protection.

### Android state

- `android/core/network/src/main/kotlin/com/kothabarta/core/network/messages/MessagesDtos.kt` intentionally does not model encrypted payloads, sender public JWK, or encrypted-body legacy data.
- `ChatViewModel.sendText()` calls `MessagesRepository.sendMessage(conversationId, text, replyTo)`, whose `SendMessageRequest` contains plaintext `body` and `replyTo` only. Android has no device key registration, ECDH, AES-GCM, decryption, or secure E2EE key storage module.
- `MessageBubble` renders `encrypted == true` as `🔒 Encrypted message`; it cannot decrypt or distinguish missing key, unsupported format, bad tag, or revoked key.
- Android attachment, edit, reply, socket, and message DTO paths have no E2EE envelope handling. Android therefore cannot interoperate with Web E2EE in either direction today.

## Root cause of device-change failure

The original device owns the only private ECDH key for its device ID. That private key is marked non-extractable and never leaves that browser's IndexedDB. A new device creates a different key and ID. Old message fan-out contains only device IDs known when each message was sent, so the new device has no matching payload; even if it downloads all ciphertext, its new private key cannot derive the old shared AES key. A new public-key registration affects later sends only. If the original storage is lost, historical messages encrypted for that key are unrecoverable under the current design.

## Protocol design gate

### Threat model to preserve

Protect message content from the application server, database readers, push providers, and network observers. Treat a compromised endpoint, compromised account/device, malicious client release, recipient export, and unverified server key substitution as distinct risks. Keep server-visible metadata explicit. The design must define what adding/revoking a device means for future and historical messages.

### Decision: do not port the current static ECDH format as Phase 1 Android E2EE

The current Web format is interoperable at the primitive level, but lacks a versioned authenticated protocol, sender/device identity authentication, forward secrecy, post-compromise recovery, and replay binding. Copying it into Android would create a second implementation of a weak ad-hoc protocol and still not solve device lifecycle. The server's opportunistic plaintext fallback also conflicts with the Phase 1 requirement that Android never send plaintext in an E2EE conversation.

### Redesign proposal for review

- Evaluate a maintained, audited implementation of an established asynchronous messaging protocol with device/session management (candidate: Signal's Sesame session-management model with X3DH/PQXDH establishment and Double Ratchet message keys for 1:1). The Double Ratchet derives new message keys and updates DH state over time; Sesame addresses asynchronous sessions across multiple devices. These are protocol specifications, not a recommendation to hand-implement the algorithms ([Double Ratchet](https://signal.org/docs/specifications/doubleratchet/), [Sesame](https://signal.org/docs/specifications/sesame/)).
- If encrypted groups become in scope, separately evaluate MLS (RFC 9420), a standardized asynchronous group key establishment protocol with forward secrecy and post-compromise security; it is not automatically wire-compatible with the 1:1 protocol ([RFC 9420](https://www.rfc-editor.org/rfc/rfc9420.html)).
- Before choosing a library, verify maintained production-ready implementations for both Android/Kotlin and browser JavaScript, identical supported protocol versions, persistence formats, licensing, security audit history, key transparency/verification support, and test vectors. No compatible library choice has been verified in this phase. Do not implement primitives or a custom double ratchet in app code.
- Define a signed/versioned device record, explicit device enrollment approval, append-only key history, revocation semantics, authenticated message headers (conversation, sender device, recipient device, protocol/session/message counters), replay handling, and capability negotiation. The server must reject plaintext on conversations after both sides opt into an encrypted protocol version; legacy plaintext must remain visibly classified until a safe versioned rollout is possible.
- Keep current legacy ciphertext readable only by devices that already hold the required old key. New protocol sessions do not magically migrate old non-exportable WebCrypto keys or create historical per-device payloads. No server-side decryption or bulk plaintext migration is allowed.

## Migration and rollback requirements

1. Add a versioned protocol alongside existing formats; do not reinterpret current `encryptedBody` or `encryptedPayloads` as the new protocol.
2. Preserve current public keys, local IndexedDB keys, ciphertext, message IDs, timestamps, read state, and reactions. Do not overwrite a device key as part of migration.
3. Roll out server storage/relay and authorization capabilities first, then clients that can establish and persist the chosen protocol state, then explicit per-conversation opt-in. Do not globally force encryption while old Web clients still rely on plaintext fallback.
4. Rollback disables creating the new version but continues relaying stored versions and never deletes old key records or ciphertext.
5. A device without a matching historical key must display “not available on this device”; only an existing trusted device with the original key may access those old messages.

## Tests and work intentionally not performed in this phase

- Repository audit found no E2EE-specific unit tests or cross-platform test vectors.
- No crypto code, API, schema, Android UI, or migration was changed because the protocol/library and device trust design are unresolved by the current implementation.
- Before implementation, required tests include vetted-library known-answer vectors, Android↔Web vectors, tampering/invalid-tag, wrong session/device, replay, out-of-order delivery, device add/revoke, account switch/logout isolation, plaintext downgrade prevention, legacy payload handling, and end-to-end REST/Socket relay authorization.
- A cryptographic design and implementation review is required before production. The library selection and trust/key-verification UX are explicit decisions required to pass this gate.
