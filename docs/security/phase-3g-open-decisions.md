# Phase 3G — Open Decisions and Approval Register

**Checked:** 2026-10-29
**Purpose:** Track decisions needed before any Phase 3G implementation proposal. Status is not implementation authorization.

## 1. Status categories

- **User-stated direction:** Explicit product direction, not proof of implementation and not blanket approval of protocol/schema/API changes.
- **Recommended, awaiting approval:** Preferred design direction documented for review; owners must approve.
- **Protocol gate:** Requires exact technical evidence and specialist review.
- **Verified current behavior:** Source-confirmed snapshot; may change and must be rechecked before implementation.

## 2. Decision register

| ID | Topic | User-stated direction / verified fact | Recommendation | Approval/evidence required | Status |
|---|---|---|---|---|---|
| D1 | Legacy preservation | Preserve Legacy conversations and history; readable and immutable under approved policy; no silent conversion. | Separate Legacy context; preserve original content/classification and label it as not E2EE. | Product approval of exact read-only operations and retention semantics. | Direction stated; detailed policy open. |
| D2 | Context architecture | Prefer one familiar Chat UI per person; do not misleadingly merge Legacy/Protected transcript. | Architecture A: distinct Protected context with explicit context navigation and provenance. | Product/security approval of UX, list aggregation and direct-pair coexistence. | Recommended, awaiting approval. |
| D3 | New conversation defaults | New conversations are E2EE by default; no plaintext fallback or silent downgrade. | Protected setup starts non-sendable; activate only after protocol/device readiness. | Server policy, onboarding, failure and unsupported-client behavior. | Direction stated; implementation is absent. |
| D4 | Protocol family | No final protocol named by user; existing repo reports MLS as candidate. | Evaluate MLS first for group/device model; compare Signal-family stack. Do not select production protocol yet. | Candidate-specific Android/Web evidence, protocol review, license/maintenance review, interoperability tests. | Protocol gate open. |
| D5 | Protocol library | No dependency selected. Current Android/Web manifests contain no MLS or Signal-family library. | Assess exact pinned library/provider only after feasibility; do not create custom protocol. | Exact release/commit, API support, security history, transitive licenses, vulnerability response and support owner. | Open. |
| D6 | Direct Protected uniqueness | Current direct conversation uses unique participant-pair `pairKey`; create-or-open returns same record. | Distinct server identity/unique constraint for Protected context; idempotent server create-or-get. | Data/API review; race semantics, legacy pair migration and duplicate cleanup policy. | Recommended; requires backend design approval. |
| D7 | Group Protected identity | Current groups are ordinary participant records; current E2EE helper rejects group sends. | Separate Protected group state from Legacy participant list; protocol-committed membership. | Membership, invite, admin, offline member and history policy; exact group protocol evidence. | Open. |
| D8 | Device identity | Current public-key endpoint upserts a public key by caller-provided device ID; no approved enrollment mechanism was found. | Separate account login from device credentials; require proof of possession, approval, verification and key change history. | Approval authority, QR/safety-number/out-of-band method, directory transparency/equivocation response. | Direction stated; mechanism open. |
| D9 | Device readiness | User requires unsupported clients blocked; all active-device quorum detail unresolved. | Explicit verified eligible set. Decide whether all approved devices are mandatory or a user-selected subset is allowed. No silent omissions. | Offline devices, stale device directories, new device flow, minimum client versions. | Open. |
| D10 | Revocation | New devices require approval/verification; revocation model not selected. | Revoke credentials and rotate protocol membership; stop future access at defined commit boundary. Do not promise erasure of prior content. | Timing, offline recipients, stale sockets/tokens, account-compromise and re-enrollment procedure. | Open. |
| D11 | History recovery | Historical messages only by explicitly approved secure recovery mechanism. | Future Protected messages only by default; no automatic Legacy or Protected history sync. | Explicit recovery consent, secret model, device transfer, recovery authority, abuse, loss and backup policies. | Direction stated; mechanism open. |
| D12 | Receipts/metadata | No product decision on whether status metadata may be plaintext. | Per-context receipts only if approved; disclose metadata exposure and do not mark another context read. | Privacy/product approval for read/delivery receipts, typing, presence, pins, themes, archives and group metadata. | Open. |
| D13 | Replies/forwarding | Legacy history must remain immutable; cross-context behavior not selected. | Default cross-context quotes/forwards to deny. If enabled later, explicit action, provenance and destination-context encryption. | Product review and anti-leak tests; no server plaintext copying. | Recommended, awaiting approval. |
| D14 | Edits/deletes/reactions | Legacy message-content mutations read-only; reaction/delete-for-me semantics remain unresolved. | Deny Legacy edits, shared delete/unsend and pins; decide reactions and personal local hide separately. Protected changes must be authenticated protocol events. | Operation-level matrix approval; semantics for retention and already-read content. | Partial direction stated; details open. |
| D15 | Attachments/voice | Prior user requests explicitly keep media blocked until encrypted binary protocol approval. | Keep media and voice disabled for Protected sends; separate media protocol review. | Encrypted media protocol, storage contract, upload lifecycle, metadata and orphan cleanup. | Blocked. |
| D16 | Calls/call history | Call security is not established by message E2EE. Existing service can create call-history messages. | Treat signaling and message history separately; do not claim calls are E2EE; define whether call records may enter read-only Legacy context. | Calls product/security review; explicit record policy and endpoint inventory. | Open. |
| D17 | Error/rollback behavior | No plaintext fallback/downgrade. | On failure, block or suspend writes; retry same authorized ciphertext only under correct protocol state; rollback pauses service, never restores plaintext. | Approve user-facing errors, support playbook, outage behavior and staged rollout. | Direction stated; operational plan open. |
| D18 | Security review | No security certification has been requested/claimed. | Independent protocol, application integration, platform and license review before rollout. | Named reviewers, scope, findings closure/acceptance, version-pinned evidence. | Required; not completed. |

## 3. Protocol decision gate

### Candidate comparison status

- **MLS:** RFC 9420 is an IETF Standards Track group key agreement protocol. RFC 9750 describes the surrounding architecture. It is the leading family to evaluate because groups of two or more and device membership are in scope. This does not select a library or prove Android/Web support.
- **Signal family:** Official X3DH, Double Ratchet and Sesame specifications support asynchronous pairwise/session and multi-device analysis. They do not, without a specific implementation design, establish Kotha-Barta group interoperability. The current official `libsignal` README says use outside Signal is unsupported and its API/bridge may change; its current LICENSE is AGPL-3.0. These are material support/legal gates.
- **Libraries:** No candidate appears in current app manifests. Existing repository reports provide historical `mls-rs`/OpenMLS evidence, but do not establish current release maturity, all-platform support, production state persistence or Kotha-Barta interop. OpenMLS's current README marks Android/WASM targets as built but unsupported/untested. Current GitHub MCP reads for some project files failed; those details remain unverified.

### Required closure evidence

1. Select exact version/commit and ensure upstream support/maintenance is acceptable.
2. Verify license for the exact library and all transitive dependencies; obtain legal approval.
3. Pin supported Android SDK/minSdk, browser matrix, cryptographic provider, suite, credential format, wire encoding and storage adapter.
4. Produce cross-platform vectors and real Android/Web bidirectional setup, message, membership, persistence and recovery results.
5. Verify parser, replay/fork handling, rollback detection, transactionality, concurrent device sessions and group changes.
6. Obtain independent cryptographic and application-integration review.

Until then, protocol/library choice remains **not selected**. The design recommendation is only a gated preference to evaluate MLS first, not authorization to integrate it.

## 4. Implementation prerequisites

- Product/security approval of Architecture A and every unresolved Legacy operation.
- Approved account/device identity and enrollment/verification/revocation policy.
- Approved device-set completeness rule and unsupported-client behavior.
- Approved history recovery model and explicit consent.
- Server/API/data identity design for distinct Protected contexts, uniqueness, idempotency, state readiness, fail-closed writes and socket consistency.
- Writer inventory covering REST routes, services, admin/context/call message creation, attachment finalization, socket handlers, background workers, retries, notifications and operational scripts.
- Exact protocol/library/provider selection and full platform/interoperability evidence.
- Content-free logging and generic push/search/privacy design.
- Test strategy with version-pinned fixtures, Android/Web/backend integrations, concurrency and failure evidence.
- Independent security and legal review; owners for upgrades, incident response, and rollback.

## 5. Rollout and rollback approval prerequisites

1. Define old-client rejection behavior and a supported-client minimum; never send Protected plaintext to maintain compatibility.
2. Decide whether to grandfather existing Legacy history as read-only and how users are notified.
3. Ship and validate context/security labels before any enforcement that could make threads read-only.
4. Stage server and client readiness without enabling sends until the protocol transition is valid.
5. Define outage behavior: pause setup/writes, preserve ciphertext/state; no Legacy fallback.
6. Define observability that captures policy error category/client version only, not content, keys, tokens or ciphertext payloads.
7. Rollback can suspend or close setup; it cannot downgrade an active Protected context or relabel historical Legacy records.
8. No real data migration, security mode activation or production rollout occurs without a separate explicit authorization.

## 6. Approval record

| Decision | Approver | Date | Evidence/reference | Status |
|---|---|---|---|---|
| Architecture A / context UX | Product + Security | — | — | Pending |
| Legacy policy matrix | Product + Security + Privacy | — | — | Pending |
| Device trust, verification and revocation | Security + Product | — | — | Pending |
| Recovery/history access | Security + Product + Privacy | — | — | Pending |
| Protocol and exact library/provider | Security + Engineering + Legal | — | — | Pending |
| API/data model and server enforcement | Engineering + Security | — | — | Pending |
| Rollout/rollback and support readiness | Product + SRE + Security | — | — | Pending |
| Independent security review complete | Independent reviewer | — | — | Pending |

This register is a planning aid. No entry should be changed to approved without explicit human approval and recorded evidence.
