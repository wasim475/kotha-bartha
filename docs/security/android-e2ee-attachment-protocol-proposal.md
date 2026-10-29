# Kotha-Barta Android E2EE Attachment Protocol Proposal

**Date:** 2026-10-29  
**Status:** Design proposal only; not approved for implementation or production use.  
**Scope:** Read-only audit of current Android, API, and storage behavior plus a proposed versioned protocol. No runtime, backend, web, cryptographic, or dependency changes are authorized by this document.

> **Safety gate:** Android attachment and voice-note sending must remain blocked. The current attachment endpoint uploads content that is not protected by the message encryption path. Do not enable a picker, recorder, upload, download, preview, or playback flow for E2EE conversations until the protocol, library choices, cross-platform behavior, and server contract below have been reviewed and approved.

This document is design preparation, not a cryptographic security review, implementation plan approval, or external audit.

## 1. Executive proposal

For new encrypted conversations, continue evaluating the repository's existing conditional direction: **MLS (RFC 9420) for conversation messages and device membership**, with every authorized installation represented as a separate group member. MLS adoption and the candidate implementation library remain unapproved; the existing feasibility work did not demonstrate Android/Web interoperability.

For attachment bytes, use a **vetted streaming AEAD implementation**, not a hand-built chunk-encryption scheme. A candidate to evaluate is Tink Streaming AEAD's `AES256_GCM_HKDF_1MB` key template. Pin and test an exact implementation and serialized container version on Android and Web before selection. This is a candidate, not an asserted cross-platform capability or final algorithm choice. If an approved implementation cannot produce and consume an interoperable format on both platforms, stop and evaluate another established format rather than composing primitives in application code.

Generate a fresh random attachment keyset per attachment. Include the keyset, encrypted user metadata, and attachment manifest only inside an authenticated MLS application message. Upload only the streaming-AEAD ciphertext to private storage. The server stores and serves opaque ciphertext and never receives plaintext media, file keys, or the decrypted manifest.

## 2. Current protocol audit

Evidence was checked against the Android message feature and security module, Android message DTOs/API, server message-security and upload paths, and the repository's E2EE protocol decision/feasibility documents.

| Question | Confirmed current behavior |
|---|---|
| Text encryption/decryption | Android has a receive-side `AndroidMessageDecryptor`. It selects the `encryptedPayloads` entry matching its installation `deviceId`, loads an account-specific P-256 private key, performs ECDH with the message's `senderPublicKey`, and uses the raw 32-byte ECDH output directly as an AES-256-GCM key. It expects a 12-byte IV and an authentication tag, then decodes authenticated output as UTF-8. There is no application AAD or KDF in this Android decryptor. The format is the existing legacy Web format, not a proposed attachment protocol. |
| Android sending | `ChatViewModel.sendText()` sends a `SendMessageRequest(body, replyTo)` through `MessagesRepository`; Android does not create an encrypted text envelope in this path. Its device registrar publishes a public key, but registration is not message encryption. This proposal does not change text behavior. |
| Sender/device identity | Android has a persistent installation `deviceId` and an account-specific Android Keystore P-256 key alias. The private key is not exported. The registrar publishes a public JWK through `PATCH /users/me/public-key`. The current message payload carries `senderPublicKey` and recipient-device entries (`deviceId`, `ciphertext`, `iv`). |
| Recipient/device key distribution | The server stores public keys per account/device and returns registered public keys in conversation participant data. The legacy Web format fans ciphertext out per known device. Android decrypts only an envelope addressed to its local installation ID. These public keys do not constitute an MLS credential or a reviewed device-authentication system. |
| Rotation/revocation | Android provisioning keeps an existing key and does not rotate it automatically. Registration upserts a key by device ID. No signed key history, trusted key-change verification, device approval protocol, or complete revocation/history policy was confirmed in the inspected Android/API paths. Replacing a server key does not restore ciphertext encrypted for the former key. |
| Account changes/key loss | Private-key aliases are scoped by account ID while the device ID is installation-scoped. The code does not silently regenerate a previously provisioned missing key. Key provisioning/decryption is unsupported below Android 12 (API 31), although the app minimum SDK is 26. No implemented recovery or cross-device private-key transfer was found. |
| Authenticated metadata | AES-GCM authenticates ciphertext and tag, but the current Android decryptor supplies no AAD. The server's legacy envelope validation checks structural constraints only; its own code states this does not prove that the payload was encrypted or that it decrypts. Message IDs, sender/conversation identifiers, timestamps, delivery state, and attachment metadata remain server-visible. |
| Attachment representation | `MessageDto` has `AttachmentDto(url, publicId, fileName, mimeType, size, kind, durationSec)`. This is ordinary metadata, not an encrypted attachment manifest. The existing multipart endpoint uploads to Cloudinary and returns a `secure_url`. `secure_url` is HTTPS; HTTPS does not make the stored object E2EE. |
| Attachment authorization/storage | The current upload route authenticates a participant, applies a 15 MiB limit and MIME allow-list, and stores the uploaded bytes through Cloudinary. A private, participant-authorized ciphertext download endpoint was not identified in the inspected Android contract. Whether existing provider URLs can be accessed without the authenticated API is **unknown** from this audit. |
| Security-mode enforcement | The current server security helper rejects non-text messages for E2EE-mode conversations. The existing attachment route calls this check. Legacy-mode behavior remains separate and must not be relabeled as E2EE. |
| Offline/new devices | An offline device can only decrypt a legacy message if an envelope for its device ID was included at send time and it still has the matching private key. A newly registered device is not retroactively included in old fan-out, and no history/key-recovery flow was confirmed. MLS offline delivery, Welcome processing, group-state persistence, and history policy are future requirements, not current support. |

### Confirmed source references

- [Android message decryption](../../android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/data/MessageDecryption.kt)
- [Android message crypto primitive](../../android/core/security/src/main/kotlin/com/kothabarta/core/security/WebE2eeDecryptor.kt)
- [Android device key manager](../../android/core/security/src/main/kotlin/com/kothabarta/core/security/AndroidE2eeKeyManager.kt)
- [Android device-key registrar](../../android/feature/messages/src/main/kotlin/com/kothabarta/feature/messages/data/AndroidMessageDeviceKeyRegistrar.kt)
- [Android message DTOs](../../android/core/network/src/main/kotlin/com/kothabarta/core/network/messages/MessagesDtos.kt)
- [Android message API](../../android/core/network/src/main/kotlin/com/kothabarta/core/network/messages/MessagesApi.kt)
- [Server message-security policy](../../server/src/utils/messageSecurity.js)
- [Server attachment route](../../server/src/routes/chat.routes.js)
- [Server upload constraints](../../server/src/middleware/upload.js)
- [Cloudinary integration](../../server/src/utils/cloudinary.js)
- [Prior protocol decision](./e2ee-protocol-decision.md)
- [MLS feasibility report](./mls-feasibility-report.md)

## 3. Architecture and data flow proposal

1. **Enroll devices first.** A server-authorized device enrollment flow binds an authenticated account to a cryptographic credential. Each installation has independent protocol state. The server must not silently replace a credential or treat a supplied device ID as proof of device identity.
2. **Establish the conversation protocol.** All active devices in a conversation use one explicitly negotiated MLS protocol/cipher-suite/application profile. The server-controlled mode is versioned and cannot be changed by a client message. A conversation must not enter the new mode until its participants' supported devices can use it.
3. **Prepare on-device.** The client reads a bounded content URI as a stream, checks a configured plaintext limit before encryption, and does not copy an unbounded file into memory. It creates a random attachment ID and a fresh random Streaming AEAD keyset for each file.
4. **Encrypt before any network upload.** The selected vetted streaming-AEAD implementation encrypts the file into authenticated records. The client calculates ciphertext size and a ciphertext digest. No plaintext, plaintext filename, plaintext MIME type, thumbnail, or decryption key is sent to the server.
5. **Create authenticated manifest.** The client builds the versioned manifest described below, including the attachment keyset. It embeds the manifest in an MLS application message. MLS authenticates the sending member and encrypts the key and metadata for the active group members.
6. **Upload ciphertext.** The client initializes an upload for a conversation/message/attachment identifier and sends ciphertext records only. Initialization, chunk upload, finalization, and cancellation are idempotent or scoped to a single authenticated upload.
7. **Send the MLS message.** After successful ciphertext finalization, the client sends the opaque MLS application message and opaque attachment object references. Message creation uses an idempotency key so repeated taps/retries do not create duplicate messages.
8. **Receive and decrypt.** A recipient fetches the MLS message and ciphertext through authenticated endpoints, processes the MLS message using its own current group state, verifies all manifest and attachment bindings, then decrypts the stream locally. A tag, digest, manifest, or protocol-version failure displays an unavailable/error state and never falls back to plaintext or a provider preview.
9. **Cleanup.** The server expires abandoned initialized uploads, removes objects after authorized message deletion/retention expiry, and supports cancellation. Cleanup policy must not delete an object while a valid message still references it.

### Trust boundaries

- **Client devices:** Hold MLS state and attachment keys; decrypt and render content. Compromise of an authorized device exposes content available to that device.
- **Backend:** Authenticates accounts, checks conversation membership/device enrollment, enforces quotas, stores opaque MLS messages and ciphertext objects, and controls object references. It must not know attachment keys or parse decrypted manifests.
- **Object storage/CDN:** Receives opaque ciphertext only. Public, durable, reusable object URLs are not an acceptable replacement for authenticated downloads.
- **Notifications, logs, analytics:** Receive neither content, keys, filenames, MIME types, thumbnails, signed URLs, nor secret upload tokens.

## 4. Versioned encrypted blob and metadata

### Proposed version identifiers

Use explicit, immutable identifiers in the MLS-protected manifest and the server-side ciphertext object record:

- Message profile: `kb-mls-app/1` (illustrative; requires final profile/version approval).
- Attachment envelope: `kb-attachment/1`.
- Candidate blob container: Tink Streaming AEAD `AES256_GCM_HKDF_1MB`, pinned to a reviewed implementation/version only after Android/Web interoperability and security testing.

Unknown versions, algorithms, container parameters, or content kinds must fail closed as unsupported. Clients must never guess an algorithm from file bytes or try legacy decryption as a fallback.

### Blob cryptography

- Generate a cryptographically random fresh keyset for every attachment. Never reuse a keyset across files, conversations, retries that re-encrypt different content, or thumbnails.
- Use only the selected vetted Streaming AEAD implementation's key derivation, record framing, nonce construction, authentication tags, and final-record handling. The implementation must guarantee nonce uniqueness for its documented key/stream lifetime.
- Do not write a custom AES-GCM chunker or manually invent nonce/key derivation. If Tink is selected, use its defined streaming format as-is, with the exact key template and AAD behavior pinned in the protocol profile.
- Bind canonical associated data to at least the protocol version, conversation ID, client-generated idempotency/message ID, sender device credential ID, attachment ID, attachment order, and container profile. Canonical encoding must be unambiguous (for example, a specified binary encoding or canonical CBOR profile); do not concatenate variable strings without length framing.
- Treat record authentication as mandatory. A missing, reordered, truncated, duplicated, or modified record must fail decryption. A ciphertext digest is a transport/completeness check, not a substitute for AEAD authentication.
- A re-encryption/restart that changes plaintext must use a fresh attachment ID and fresh keyset. Resumption may reuse already encrypted, integrity-checked records only if the selected Streaming AEAD format explicitly supports safe resumable output; otherwise restart encryption with new identifiers and key material.
- The target upload cap is **15 MiB of ciphertext per attachment**, matching the current server's maximum request size as a conservative starting point. The usable plaintext limit is lower by the container overhead and must be measured and specified before rollout. The limit, aggregate per-message limit, number of attachments, and supported media duration require product/operations approval.
- Stream records at the selected format's specified segment size; the Tink `1MB` candidate means its fixed format-defined segmenting, not a client-invented chunk boundary. The upload API can transport bounded records/chunks without changing the cryptographic record framing.

### MLS-authenticated manifest

The manifest is serialized inside the MLS-protected application plaintext. The entire manifest is authenticated by MLS; selected fields are also bound into Streaming AEAD AAD. A proposal shape (placeholder values only):

```json
{
  "profile": "kb-mls-app/1",
  "kind": "attachment",
  "conversationId": "CONVERSATION_ID",
  "clientMessageId": "RANDOM_IDEMPOTENCY_ID",
  "senderDeviceId": "SENDER_DEVICE_ID",
  "attachments": [
    {
      "protocol": "kb-attachment/1",
      "attachmentId": "RANDOM_ATTACHMENT_ID",
      "order": 0,
      "objectRef": "OPAQUE_SERVER_OBJECT_ID",
      "container": "tink-streaming-aead-aes256-gcm-hkdf-1mb",
      "keyset": "BASE64_ENCODED_RANDOM_KEYSET",
      "ciphertextSize": 123456,
      "ciphertextSha256": "PLACEHOLDER_DIGEST",
      "plaintextSize": 120000,
      "contentType": "image/jpeg",
      "fileName": "example.jpg",
      "thumbnail": null
    }
  ]
}
```

This is a design example, not a wire contract. The `keyset`, filename, media type, and plaintext size are only inside the MLS ciphertext. The server-visible object reference, message routing fields, and ciphertext length remain metadata and may reveal relationships/timing/approximate file size. The server should store files as opaque `application/octet-stream`; client-provided MIME/file name is not a security boundary.

The recipient must validate that the MLS-authenticated conversation ID, client message ID, sender device, attachment IDs, order, object references, and associated data agree with the outer server record before decryption. The ciphertext digest is covered by the MLS message; AEAD independently authenticates the stream records. Unknown or duplicate attachment IDs and invalid size/count values are rejected.

### Thumbnail and previews

Default to **no thumbnail** until a safe design is reviewed. If thumbnails are later required, treat each thumbnail as a separate attachment with its own fresh keyset and full encryption/authentication. Do not use provider-generated thumbnails or image transformation URLs. Do not show image previews, voice waveforms, filenames, MIME types, or plaintext media before successful decryption. The server may show a generic encrypted-attachment placeholder only.

## 5. Key delivery and device lifecycle

- A fresh attachment keyset is delivered only as part of the MLS-encrypted application message. It is not stored in ordinary DTO metadata, upload initialization, object storage, URLs, logs, push payloads, or server-readable message columns.
- MLS group membership represents individual enrolled devices. MLS credentials must be authenticated as belonging to a server-authorized account/device under a separately reviewed enrollment and identity-verification design. A server-provided public key list alone is not sufficient identity proof.
- The server authorizes upload/download using the authenticated account, conversation participant membership, registered device status, upload/message ownership, and current conversation mode. MLS authentication protects the manifest and sender identity from the server; server authorization does not prove that ciphertext is valid or safe.
- New device addition requires a reviewed authenticated MLS membership transition and a defined Welcome/state delivery flow. A device added later does **not** automatically receive historical attachment keys or plaintext. Default proposal: no historical access for a new device; any explicit history transfer must be separately authorized by an already trusted device and reviewed for privacy/consent.
- Device removal is a membership change that prevents access to future MLS messages. It cannot revoke plaintext, ciphertext, or attachment keys already obtained by that device.
- Key rotation follows the selected MLS implementation's membership/epoch rules. Do not emulate rotation by overwriting the existing legacy `publicKeys` entry.
- Key loss means loss of access unless a separately reviewed recovery/backup protocol exists. Do not upload escrowed attachment keys or weaken device isolation for convenience.
- Groups require no separate attachment-key algorithm if they use the approved MLS conversation group: each active group member is an intended recipient. Group membership race/ordering behavior and concurrent commits must be tested. No group attachment support is authorized merely by this proposal.

## 6. Minimum server upload/download contract

All paths below are illustrative and require API design, implementation, and review. Prefer authenticated application endpoints that stream to private storage. If direct-to-object-storage uploads are necessary, use short-lived, single-object, single-operation scoped credentials, redact them from logs, and do not persist them in messages or analytics.

| Proposed operation | Required server behavior |
|---|---|
| `POST /conversations/{id}/attachments/init` | Authenticate and authorize the participant/device; require the approved server-controlled E2EE protocol mode; validate request shape, ciphertext size/count limits, idempotency key, and rate limits; allocate an opaque object/upload ID. Accept no keyset, filename, plaintext MIME, plaintext bytes, or thumbnail. |
| `PUT /attachment-uploads/{uploadId}/records/{index}` | Accept bounded ciphertext only over authenticated transport; enforce upload ownership, index/count/order and aggregate byte limits; reject duplicate conflicting records. Never decrypt or transform content. |
| `POST /attachment-uploads/{uploadId}/finalize` | Verify upload ownership, expected records/lengths and server-computed ciphertext digest; atomically mark a complete opaque object. This proves storage completeness only, not client encryption or plaintext validity. Repeated finalization is idempotent. |
| `POST /attachment-uploads/{uploadId}/cancel` | Idempotently cancel only an upload owned by the caller and delete its unreferenced partial objects. |
| `POST /conversations/{id}/messages` | Accept the opaque MLS message and finalized object references with an idempotency key. Verify each object belongs to the same conversation and uploader, is finalized, and is not already inconsistently referenced. Preserve the MLS bytes opaquely; do not accept a plaintext fallback in an E2EE mode. |
| `GET /conversations/{id}/attachments/{objectId}/records/{index}` | Authenticate each request; re-check current conversation membership and that the object is referenced by a message visible to the caller; stream ciphertext only. Avoid reusable public URLs. Revoke future access when membership/authorization is removed, subject to explicit retention policy. |
| Expiration/deletion worker | Expire incomplete uploads after a bounded, documented TTL; delete orphaned objects after failed message creation/cancellation; apply message deletion and retention rules; make cleanup idempotent and auditable without logging URLs or contents. |

The current 15 MiB cap, MIME allow-list, Cloudinary upload path, and returned `secure_url` do not satisfy this contract. Backend changes will be required: private ciphertext storage or an authenticated proxy, initialization/finalization/cancel/download endpoints, object ownership/reference tracking, limits/rate limiting, and abandoned-object cleanup. The server cannot validate the decrypted filename, content type, media safety, or actual encryption without violating the E2EE boundary. Client MIME/type claims must never replace server request-size limits or safe client-side handling.

## 7. Message compatibility and rollout

- Keep current text message formats as explicitly classified legacy formats. Do not reinterpret `encrypted`, `encryptedBody`, `encryptedPayloads`, or `senderPublicKey` as the new MLS version.
- The new application payload has an explicit profile/version and a discriminated message kind. Unknown versions are unavailable/unsupported; never pass them to the static-ECDH decryptor.
- New attachment references must point only to finalized ciphertext objects and must be accompanied by a valid, supported MLS attachment manifest. Upload success alone is not a sent/delivered/read message.
- Existing Cloudinary attachments remain **legacy, not E2EE**. Do not silently re-encrypt, relabel, or show them as secure. Existing clients may retain their historical behavior only under an explicitly legacy UI/policy; the Android send restriction stays in place until an approved rollout.
- No mixed plaintext/E2EE fallback is allowed inside an E2EE conversation. Do not activate MLS for a conversation while a participating device can send only legacy/plaintext messages.
- Rollout requires server-controlled version negotiation, compatibility telemetry that does not contain content/identifiers/secrets, a no-downgrade policy, staged device coverage, rollback behavior, and user communication. Rollback may disable new MLS sends but must not relabel or decrypt stored MLS content.
- Preserve existing message ordering and socket delivery as transport behavior only. Socket/REST events must carry opaque MLS bytes and attachment references consistently; duplicate delivery is handled with stable message/object IDs and idempotency.

## 8. Threat model

| Threat | Mitigation / residual limit |
|---|---|
| Malicious sender | Only authorized MLS members can create authenticated group messages; recipients enforce strict manifest, count, size, digest, and format bounds before parsing/decryption. E2EE does not make malicious media safe. Decode/play only with platform-safe libraries, isolate parsers, and never auto-execute files. A valid group member can still send harmful content. |
| Malicious storage provider | Provider receives ciphertext only. Streaming AEAD tags and authenticated manifest detect modified, substituted, truncated, or reordered content. Storage can still withhold, corrupt, delay, or delete data. |
| URL/object-reference leakage | Do not put durable public URLs in messages. Use opaque IDs and participant-authorized downloads, short-lived one-use upload grants if needed, referrer-free handling, and URL/token redaction. Anyone who obtains a currently valid bearer URL may still use it until expiry; proxying is preferred. |
| Ciphertext substitution/replay | Bind conversation, sender device, client message ID, attachment ID, order, profile, and record context through MLS-authenticated manifest and Streaming AEAD AAD. Use server idempotency and MLS replay/epoch handling. Test cross-conversation and old-message substitutions. A ciphertext hash alone does not prevent replay. |
| Metadata tampering | Sensitive metadata is inside MLS ciphertext; the manifest is MLS-authenticated and AEAD AAD binds routing context. Server-visible routing/size values are checked for consistency, not trusted as proof of plaintext properties. |
| Unauthorized download | Authenticate every download and check current conversation participation, message visibility, object reference, device state, and rate limits. Private storage prevents bypassing API authorization. |
| Device compromise | Keystore-protected local keys and MLS membership reduce key extraction risk but do not protect plaintext from a compromised/running authorized endpoint, screen capture, malware with accessibility access, or a recipient copying content. Revoke compromised devices for future messages; prior exposure cannot be undone. |
| Key loss | No implicit recovery. Explicitly show unavailable state. Any backup/recovery scheme requires separate protocol and threat-model review; server escrow is not assumed. |
| Malformed media / malicious file type | Treat decrypted bytes as untrusted. Validate size and format locally after decryption; use platform decoders with resource limits; no MIME-based trust, implicit execution, or public preview services. |
| Resource exhaustion | Enforce ciphertext and manifest limits, record/chunk count limits, decompression limits, download timeouts, memory/CPU budgets, per-user/conversation quotas, and rate limits. Stream rather than buffering whole files. |
| Thumbnail leakage | No thumbnail by default. If added, encrypt it as an independent object with its own key and include its manifest/key only in MLS content. |
| Logs/analytics/push leakage | Redact signed/scoped URLs, auth tokens, object IDs where linkable, keysets, hashes if they become tracking identifiers, filenames, MIME, message plaintext, and media-derived metadata. Push payloads contain generic encrypted-message text only. |
| Server compromise/metadata exposure | E2EE protects content/key material from the server but not participant identities, timing, message sizes, conversation membership, traffic patterns, or retention metadata. The server can deny service and may correlate metadata. |

E2EE cannot protect plaintext after a recipient device decrypts it, prevent screenshots/recording, guarantee availability/deletion from backups, verify user intent, or establish that a media file is benign.

## 9. Test and review plan before implementation

1. **Protocol/library gate:** Pin candidate MLS and Streaming AEAD library versions and security configuration; review maintenance, supported platforms, formats, and known issues. Complete Android↔Web vectors for group creation/join, restart persistence, commit ordering, application messages, and attachment stream encryption/decryption. The existing MLS feasibility report records this as unproven.
2. **Cryptographic vectors:** Verify known-answer vectors for the selected Streaming AEAD format; mutate header, AAD, every record/tag, final record, digest, and manifest; assert deterministic failure and no plaintext output.
3. **Context binding:** Attempt wrong conversation, message ID, sender device, attachment ID/order, keyset, profile, and cross-object substitutions; all must fail.
4. **Replay/idempotency:** Duplicate MLS messages, upload-init, record PUTs, finalize, cancel, message send, and socket events; verify no duplicate user-visible message/object or nonce/key reuse.
5. **Multi-device/offline:** Deliver while devices are offline; add/remove devices; reorder/duplicate commits; verify only approved members receive future keys and new devices do not get historical content unless a separately approved transfer occurs.
6. **Storage/API authorization:** Test nonparticipant access, removed-device access, guessed object IDs, expired/cancelled uploads, cross-conversation references, stale scoped tokens, and direct object-store access.
7. **Resource limits:** Test exact and over-limit ciphertext/plaintext sizes, record counts, concurrent uploads, slow networks, cancellation, process death, low storage, corrupt/partial records, and cleanup races.
8. **Privacy/compatibility:** Confirm no filename/MIME/key/thumbnail/URL enters ordinary message DTOs, logs, analytics, push, or crash reports. Verify legacy messages and attachments remain visibly legacy and unknown versions fail closed.
9. **Client safety:** Test malicious/malformed media, decompression bombs, decoder crashes, MIME spoofing, unsafe share/open behavior, cache cleanup, and lifecycle/resource release.
10. **Independent review:** Obtain protocol-specific cryptographic and backend authorization review before rollout. Unit tests and interoperability tests are necessary but are not an external audit.

## 10. Open decisions requiring human review

1. Approve MLS as the target protocol and select a production-supported library/provider only after the actual Android/Web prototype passes; existing documents recommend MLS conditionally but do not approve it.
2. Choose device credential issuance, user verification/key transparency, approval, revocation, and server authorization policy. Decide how credential changes are surfaced and protected against server key substitution.
3. Choose and pin an interoperable Streaming AEAD implementation/container and define its exact canonical AAD, header handling, keyset encoding, and error behavior. Confirm whether Tink's candidate is viable for both platforms.
4. Define group/device membership semantics, concurrent commits, offline queueing, MLS-state backup/persistence, new-device history policy, recovery, and account deletion.
5. Approve maximum plaintext/ciphertext sizes, attachment count/aggregate message size, media duration, record concurrency, per-user quotas, retention, object TTL, and orphan cleanup SLA.
6. Decide whether encrypted thumbnails are required. Default is none.
7. Decide whether downloads are proxied or use scoped private-storage grants and define expiry, revocation limits, caching, CDN behavior, and token-redaction requirements.
8. Define legacy attachment UX and policy. Legacy Cloudinary objects cannot be represented as E2EE; existing Android sending remains disabled during this review.
9. Define server-controlled conversation-mode migration and no-downgrade behavior for mixed-version clients, along with release/rollback and user disclosures.
10. Assign owners for library upgrades, vulnerability response, protocol test vectors, and independent cryptographic review.

## 11. Change and approval status

- **Current task changes:** documentation only.
- **Runtime behavior:** unchanged; Android attachment and voice sending remain blocked.
- **Web/backend/API/schema/dependency changes:** none made or authorized here.
- **Breaking changes now:** none.
- **Future contract changes:** expected and potentially breaking; require a separately versioned API/schema and coordinated client rollout.
- **Security review status:** no cryptographic review or external audit has been completed by this proposal.

## Recommended next step

Commission a bounded Android/Web prototype and independent design review for the conditional MLS + vetted streaming-AEAD candidates. Keep the current send restriction in place until that prototype, device lifecycle policy, authenticated private-storage contract, and rollout/no-downgrade decisions are approved. Only then prepare a separate implementation phase with API/backend owners.
