# MyNews Key Custody and Authorship Continuity

**Author:** Fable orchestrator, 2026-07-12 (plan 48 WP6, closes finding C09)
**Status:** Revision 2. Revision 1 received an opus adversarial review (APPROVE WITH CHANGES); every mandatory change is folded in below. Disposition table at the end.

## Problem

The P1 custody model stores one raw Ed25519 private key hex in expo-secure-store (`apps/mynews/app/(root)/providers/IdentityProvider.tsx`, key `mynews.identity.v1`). `nw_profiles.pubkey_ed25519` binds once via `mynews-register-key` and the store rejects rebinding (`already-set`). A lost or replaced device means the journalist can authenticate by email but can never publish a new revision of their own work. Email sign-in is presented as recovery; it is not.

## Goals

1. A journalist can recover signing capability after device loss using a recovery kit they hold.
2. Multiple devices, each with its own device key, without exporting the raw key over insecure channels.
3. Rotation and revocation; revisions signed by a revoked key stay verifiable as historical, but a revoked key cannot author new writes.
4. The server never holds usable key material: escrow is ciphertext-only, decryptable solely by the user-held recovery code.
5. Every custody transition is recorded in a server-ordered public chain, and readers can verify which key signed each revision (a reader-side verifier ships in this WP; the claim is only as strong as the verifier).
6. All paths fail closed: missing configuration (including the notification channel for no-kit recovery), missing kit, or a pending time lock disables the affected path with honest copy, never fabricated capability.

## Non-goals

Hardware-backed non-extractable key refs and cross-profile custody remain future work; this design keeps the raw-key-in-SecureStore boundary on device but makes loss recoverable and compromise survivable.

## Threat model

| Threat | Mitigation |
|---|---|
| Server compromise reads escrow | Escrow rows hold only secretbox ciphertext; the recovery code never leaves the client; 160-bit code makes offline brute force infeasible. |
| Stolen kit file without code / stolen code without kit | Each alone is useless; escrow reads additionally require an authenticated session, are rate limited, and emit owner-visible access events. |
| Stolen email/Supabase session attempts no-kit takeover | The no-kit path is HARD-DISABLED unless a verified notification channel is configured and confirmed for the profile. The notice carries a keyless high-entropy cancel token. Completion requires step-up re-authentication at completion time, not just at request time, so a captured idle session cannot ripen into a key. Lock duration scales with byline standing (72h baseline, 7 days for verified journalists). |
| Attacker repeatedly retries contested recovery | After 2 cancelled recovery attempts in 90 days the no-kit path freezes entirely; only the kit path can restore signing. No automated winner: contested custody resolves fail-closed toward existing key holders plus a manual operator identity-verification procedure (documented, founder-ops). |
| Hostile key holder cancel-wars the honest owner | Cancels are finite (see above) and every cancel/freeze emits public chain events, so a contested profile is visibly contested. Revocation precedence: primary revokes device keys; device keys cannot revoke primary; device-vs-device revocation is won by the older active key; all revokes require step-up re-auth. |
| Escrow as a silent side door around visible recovery | escrow-put requires step-up re-auth, is append-versioned (never blind overwrite), and notifies. escrow-get is rate limited (3/day) and emits an owner-visible access event; a key bind within 24h of an escrow-get emits a public "key restored from encrypted backup" chain event. |
| Replay of possession/rotation proofs | All proofs bind uid, profileId, old head pubkey, new pubkey, and a server-issued single-use nonce (5 min TTL, stored server-side, consumed inside the mutation transaction). |
| Concurrent rotations (TOCTOU) | The rotation RPC re-asserts the old key is the current chain head INSIDE the transaction (guarded update matching `pubkey_ed25519 = oldPubkey`, 0 rows means conflict), reusing the row-lock pattern proven in `nw_set_profile_pubkey`. |
| Backdated createdAt to forge under an old key | Signature validity NEVER depends on client wall-clock. Each accepted write records the server-resolved key chain row that verified it; historical verification is chain-membership plus that record, not time windows. |
| Malicious moderator | Moderators cannot rotate or bind keys; they only get visibility of custody events and run the manual contested-custody procedure, which itself binds nothing without the user completing a step-up-authenticated flow. |

## Recovery kit

- Content: an Ed25519 private key encrypted with `nacl.secretbox`.
- KDF: scrypt (`@noble/hashes/scrypt`, N=2^15, r=8, p=1) over the recovery code with a salt of `sha256(v || profileId || pubkey || salt16)` where `salt16` is 16 random bytes; folding the public metadata into the salt binds the envelope metadata to the ciphertext (secretbox has no AAD). A KDF-cost self-test in CI asserts derivation stays within a mobile-safe budget.
- Recovery code: 160 bits of raw entropy from the platform CSPRNG (`expo-crypto`/`crypto.getRandomValues`; never `Math.random`), base32, displayed as 8 groups of 4, shown once, confirmed by re-entry before the kit is considered created. Tests assert the entropy source and the 160-bit width before encoding.
- Envelope (JSON, versioned): `{ v: 1, profileId, pubkey, salt16, nonce, ciphertext, createdAt }`. After decrypt, the client MUST derive the public key from the plaintext and assert it equals `envelope.pubkey` before use.
- Export as file and QR; optional server escrow in `nw_key_escrow` (append-versioned rows, keep last 3; service-role writes via edge; owner-session reads only).
- Kit creation is prompted at first publish and available from the Me screen, with plain copy: without a kit, no-kit recovery is slower, visible, and unavailable unless notifications are configured.

## Schema (migration `20260712000006`)

`nw_profile_keys` (the chain; server-ordered by `seq bigserial`):

| column | notes |
|---|---|
| id uuid pk, seq bigserial unique | authoritative order; no wall-clock semantics |
| profile_id | fk nw_profiles |
| pubkey text | 64-hex; UNIQUE across ALL active rows globally (cross-profile squat prevention) |
| status | `active`, `revoked` |
| kind | `primary`, `device` |
| added_via | `initial`, `rotation`, `device_approval`, `recovery`, `backup_restore` |
| proof_json | canonical proof inputs + signatures |
| prev_key_id | chain link; null for initial |
| valid_from, revoked_at | server-stamped `now()` for DISPLAY ONLY; never used to gate signature validity |

Revisions and suggestions gain `verified_key_id uuid references nw_profile_keys` stamped by the server at accept/publish time: the authoritative record of which key verified the write. Backfill: existing rows point at the profile's `initial` chain row created by this migration from `nw_profiles.pubkey_ed25519`.

`nw_key_nonces`: single-use rotation/possession nonces bound to (uid, profile_id, old_pubkey), 5 min TTL, consumed (deleted) inside the mutation RPC transaction; issuance rate limited.

`nw_key_escrow`: append-versioned envelope rows; owner-session select; service-role insert.

`nw_key_recovery_requests`: profile_id, new_pubkey (pre-committed at request time), uid binding, nonce, requested_at, unlocks_at, status `pending | cancelled | completed | frozen`. Transitions: pending -> completed (step-up re-auth + possession proof for the SAME pre-committed pubkey), pending -> cancelled (keyless cancel token or active-key cancel), pending/cancelled -> frozen (2 cancels in 90 days).

`nw_key_events`: public custody event feed (rotation, device approval, revocation, recovery requested/cancelled/completed, backup restore). Rendered on the profile; only COMPLETED recoveries brand subsequent revisions.

Compatibility invariant: `nw_profiles.pubkey_ed25519` stays the denormalized PRIMARY head. `nw_set_profile_pubkey`, its `already-set` guard, and the client-write trigger from migration 20260705000003 are UNCHANGED and remain the only initial-bind path. Rotation, device approval, revocation, and recovery use NEW security-definer RPCs that update the head and the chain in one transaction.

## Verify-path change

New shared resolver: active-pubkey -> (profile, key row) over `nw_profile_keys` where status='active' (head primary plus co-active device keys). `mynews-publish`, `mynews-review`, `mynews-suggest`, `mynews-set-meta` route through it; a signature by a revoked key gets typed `key-revoked`. The verifying chain row id is stamped as `verified_key_id` on the stored write. Reader verification (module utility + article history UI badge, included in this WP): re-verify the revision signature against the recorded key row's pubkey and assert that row belongs to the byline profile's chain. `createdAt` remains bounded metadata only.

## Flows

- Normal rotation: fetch nonce; sign rotation bytes with OLD key + possession bytes with NEW key; RPC atomically consumes the nonce, asserts old key is head, revokes it, inserts the new active row, updates the head column, writes the chain event.
- Device approval: same shape; old key signs approval for a `kind='device'` co-active key. Per-device revoke (precedence rules above; step-up re-auth required).
- Recovery with kit: decrypt locally (post-decrypt pubkey assertion), then normal rotation, `added_via='recovery'` or `'backup_restore'` when it followed an escrow-get.
- Recovery without kit: available ONLY when the profile has a confirmed notification channel; request pre-commits new_pubkey and starts the standing-scaled lock; notification carries the keyless cancel token; completion after unlock requires step-up re-auth plus possession proof of the pre-committed key; RPC revokes all prior keys, binds the new key, and writes the PERMANENT public event; subsequent revisions render "signing key replaced via account recovery on DATE".
- Compromise: revoke-now from any session holding an active key (precedence rules), public event, escrow invalidation offer.

## App UI

Me tab: Keys and Recovery section (kit create/refresh with code confirmation, import, device list with revoke, rotation, recovery status banner, custody explanation in plain language). Composer surfaces `key-revoked` and `recovery-pending` honestly. `apps/mynews/CLAUDE.md` custody paragraph updated in the same commit.

## Test plan

- Kit vectors: roundtrip, wrong code, tampered ciphertext, tampered envelope metadata (salt binding), post-decrypt pubkey mismatch, CSPRNG source assertion, KDF cost budget.
- Chain RPCs: rotation atomicity + head re-assertion under concurrent rotation, nonce single-use/TTL/binding, revoked-key write rejection, device approval co-activity, global active-pubkey uniqueness, resolver correctness.
- Recovery: notification-channel hard gate (fail-closed when unconfigured), lock scaling by standing, keyless cancel token, step-up re-auth at completion, pre-committed pubkey enforcement, 2-cancel freeze, contested-custody fail-closed state.
- Escrow: append versioning, re-auth on put, get rate limit + access events, backup-restore transparency event on bind within 24h.
- Reader: historical verification across rotation and recovery boundaries via verified_key_id; backdated createdAt has no effect on validity.

## Review disposition (opus adversarial review, 2026-07-12)

| Finding | Disposition |
|---|---|
| C-1 no-kit takeover | Fixed: notification channel is a hard fail-closed dependency; keyless cancel token; step-up re-auth at completion; standing-scaled lock. |
| C-2 createdAt windows unsound | Fixed: verified_key_id server stamping + chain membership; wall-clock display only. |
| H-1 cancel-war lockout | Fixed: finite cancels (2 per 90 days) then frozen fail-closed contested state with manual operator identity procedure; revoke precedence defined. |
| H-2 nonce/TOCTOU | Fixed: nw_key_nonces single-use 5-min bound nonces consumed in-txn; head re-assertion in-txn. |
| H-3 escrow side door | Fixed: append-versioned put with re-auth + notify; rate-limited get with access events; backup-restore transparency event. |
| H-4 / L-1 entropy + envelope binding | Fixed: CSPRNG mandate, 160-bit assertion, KDF self-test; metadata folded into salt; post-decrypt pubkey assertion. |
| M-1 already-set conflict | Fixed: initial binder and trigger unchanged; new RPCs for everything else. |
| M-2 head-only resolver | Fixed: active-key-set resolver with global uniqueness; all edges route through it. |
| M-3 no reader verifier | Fixed: reader verifier + history badge included in WP6 scope. |
| M-4 pending_recovery lifecycle | Fixed: new_pubkey pre-committed; transitions specified. |
| L-2 branding scope | Fixed: only completed recoveries brand revisions. |
