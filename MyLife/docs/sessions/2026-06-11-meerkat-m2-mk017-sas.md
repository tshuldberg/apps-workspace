# Meerkat M2 MK-017: Five-emoji SAS + sensitive-module gate

Date: 2026-06-11
Branch: `feature/meerkat-network`
Plan: `docs/plans/active/14-meerkat-network-v2-mission-control.md` (M2)

## Goal

MK-017: a Short Authentication String (five emoji) lets two people confirm out
of band that the key they pinned really belongs to each other, closing TOFU's
first-contact MITM gap. SAS verification is REQUIRED before a sensitive module
may replicate at shared_workspace scope. Acceptance: emoji mismatch blocks the
workspace grant; the gate is enforced in the engine, not just the UI; closes
audit C13 half 2.

## What was built

### 1. Pure SAS derivation (`protocol/sas.ts`)

- `SAS_EMOJI`: 64 visually distinct emoji (6 bits each; five emoji = 30 bits).
- `deriveSas(sharedKey)` -> `{ emoji[5], indices[5] }`, domain-separated
  SHA-512 over `"meerkat-sas-v1" || sharedKey`. Deterministic and symmetric:
  both endpoints that share the key get the same emoji; a MITM holding two
  different keys renders two different strings, so the mismatch is visible.
- `sasMatches` / `sasFingerprint` compare and serialize by indices (locale-
  independent), never by rendered glyphs.

### 2. Engine gate (closes audit C13 half 2)

- `inbound-policy.ts`: new reject reason `sas_unverified`; `InboundSessionAuth`
  gains `sasVerified`, `InboundChangeFacts` gains `moduleIsSensitive`. After the
  scope-cap check, a shared_workspace session carrying an `isSensitive` module
  from a peer with `sasVerified === false` is rejected. Personal own-device sync
  is exempt (it never crosses the shared boundary); a non-sensitive module is
  unaffected; an existing scope-cap violation still wins (reported first).
- `sync_sas_verifications` table (PK peer_device_id + workspace_id, sas_indices,
  verified_at) + queries `getSasVerification` / `isSasVerified` /
  `recordSasVerification` (upsert) / `clearSasVerification`.
- `sync-session.ts`: `resolveInboundAuth` computes `sasVerified` from the store
  for the session's workspace; the per-change facts builder sets
  `moduleIsSensitive` from the module policy.

### 3. App surface (`apps/meerkat`)

The SAS is derived from the PAIRING shared secret -- both devices computed the
same secret during pairing, so honest peers see the same emoji and a pairing-
time MITM (two different secrets) would not.

- SyncProvider: `getPeerSas(peerId)` (real derived data, null if no secret),
  `isPeerSasVerified(peerId)`, `confirmPeerSas(peerId)` (records the
  verification for the personal boundary).
- Sync screen: each paired device shows its five emoji, a "these 5 emoji match
  my friend's" confirm button, and a verified badge once confirmed. Honest copy
  states the demo pad is not sensitive, so no live gate fires in this app yet --
  the check is real (it confirms the pinned key), the gate is engine-enforced.

## Tests

- `sas.test.ts` (8): alphabet is 64 unique; determinism; five emoji from the
  alphabet with indices 0..63; symmetry (same key -> match); different key ->
  mismatch; fingerprint/`sasMatches` semantics.
- `inbound-policy.test.ts` (+5): sensitive module at shared_workspace rejected
  without SAS / allowed with SAS; non-sensitive exempt; personal scope exempt;
  scope-cap rejection still precedes the SAS gate.
- `inbound-policy-apply.test.ts` (+2, DB-backed): a sensitive (`hl_vitals`,
  isSensitive+shareable) workspace push from an un-verified member is rejected
  and audited `sas_unverified`; the same change applies after
  `recordSasVerification`.
- `schema.test.ts`: SYNC_TABLES 28 -> 29, ALL_P2P_TABLES 36 -> 37.

## Verification

- `@mylife/sync`: 899 tests (was 884; +15). typecheck clean.
- `@mylife/meerkat-app`: 31 tests, typecheck clean.
- `pnpm gate:function:changed`: EXIT 0. `check-meerkat-parity.mjs`: all passed.

## Remaining M2

MK-018 (introducer model: a workspace admin auto-introduces members pairwise
with signed introduction records), MK-019 (revocation v2 gossiped + checked in
handshake), MK-020 (recovery key). A natural follow-up to MK-017 is deriving the
SAS from the live session transcript (Noise key) in addition to the pairing
secret, and a workspace-scoped SAS confirm flow once a sensitive module is wired
into the Meerkat app.
