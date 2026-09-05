# Meerkat M2 MK-015: SignedIdentityBundle + TOFU pinning

Date: 2026-06-11
Branch: `feature/meerkat-network`
Plan: `docs/plans/active/14-meerkat-network-v2-mission-control.md` (M2: Friend Codes + Trust)

## Goal

MK-015: authenticate pairing payloads and pin device keys on first use, so a
man-in-the-middle cannot hand a victim its own DH key under a friend's name (the
Yearn F1 / key-directory-MITM precedent). Acceptance: pairing payloads
authenticated; a bundle swap mid-flow is detected in a test; closes audit C13
half 1.

## What was built

### 1. Pure module: `packages/sync/src/protocol/identity-bundle.ts`

- `IdentityBundle` = `{ version, deviceId, dhPublicKey, displayName, relayHints[], issuedAt }`.
  `deviceId` IS the Ed25519 public key.
- `createSignedIdentityBundle(identity, relayHints?, issuedAt?)` signs a canonical
  array (`["meerkat-identity-bundle", version, deviceId, dhPublicKey, displayName,
  relayHints, issuedAt]`) with the device's Ed25519 key.
- `verifySignedIdentityBundle(signed)` validates structure + verifies the
  self-signature against `bundle.deviceId`. A swapped DH key (or any field) breaks
  the signature, because the signature binds every field.
- `evaluateBundleTrust(signed, pinned)` -> `invalid_signature | first_seen |
  matches | key_changed`. Invalid signatures are rejected outright; a never-seen
  device is first-seen (pin it); a known device with the same DH key matches; a
  known device with a different DH key is a key change (warn, never auto-trust).

Trust model clarified during testing: `deviceId` (Ed25519) is the stable identity;
the X25519 `dhPublicKey` can be legitimately rotated and re-signed by that same
Ed25519 key. So a re-keyed bundle is self-valid AND reads as `key_changed` against
the old pin. An unsigned wire-swap of the DH key fails verification entirely.

### 2. TOFU pin store

- `packages/sync/src/db/schema.ts`: `CREATE_SYNC_PINNED_IDENTITIES`
  (`device_id` PK, `dh_public_key`, `display_name`, `bundle_json`,
  `bundle_signature`, `first_seen_at`, `last_seen_at`, `key_change_count`).
  Added to `SYNC_TABLES` (27 -> 28).
- `packages/sync/src/types.ts`: `SyncPinnedIdentity`.
- `packages/sync/src/db/queries.ts`: `getPinnedIdentity`, `pinIdentity`
  (`INSERT OR IGNORE` so an attacker can't overwrite an existing pin),
  `touchPinnedIdentity`, `acceptKeyChange` (explicit user approval: overwrites the
  DH key + bumps `key_change_count`), `mapPinnedIdentity`.
- Barrel exports (`index.ts` + `index.native.ts`).

### 3. App wiring: authenticated pairing in Meerkat

- `apps/meerkat/app/(root)/data/sync-core.ts`:
  - `SignedPairingPayload` v2 envelope = `{ v: 2, bundle: SignedIdentityBundle,
    pairingNonce }`.
  - `buildSignedPairingPayload(identity, relayHints?)`.
  - `parseSignedPairingPayload(json)` parses AND verifies the signature (null if
    unsigned/tampered).
  - `pairingDataFromSignedPayload(payload)` derives the `PairingData`
    `completePairing` needs from the verified bundle.
- `apps/meerkat/app/(root)/providers/SyncProvider.tsx`:
  - `myPairingJson` now emits the signed v2 envelope.
  - `pairWithJson` verifies the payload, runs `evaluateBundleTrust` against
    `getPinnedIdentity`, then:
    - `invalid_signature` -> refuse (possible MITM).
    - `key_changed` -> refuse with a key-change warning naming the device.
    - `first_seen` -> `pinIdentity`, then pair.
    - `matches` -> `touchPinnedIdentity`, then pair.

The legacy plain `parsePairingPayloadJson` is retained (its old test still passes)
but the provider no longer uses it; an unsigned payload is now rejected at pairing.

## Tests

- `packages/sync/src/__tests__/identity-bundle.test.ts` (NEW, 10): round-trip;
  tampered-DH rejection; forged-signature rejection; structural rejection; the TOFU
  matrix (first_seen / matches / key_changed / invalid_signature); pin-store
  idempotency + touch; `acceptKeyChange` overwrite + counter bump.
- `apps/meerkat/app/__tests__/sync-core.test.ts` (+3): signed round-trip ->
  PairingData; wire DH-swap rejected at parse; legacy unsigned payload rejected.
- `packages/sync/src/__tests__/schema.test.ts`: table counts bumped (SYNC_TABLES
  27->28, ALL_P2P_TABLES 35->36).

## Verification

- `@mylife/sync`: full suite 884 passed (was 874; +10).
- `@mylife/meerkat-app`: 30 passed (was 27; +3).
- `pnpm --filter @mylife/meerkat-app typecheck` + `@mylife/sync typecheck`: clean.
- `pnpm gate:function:changed`: EXIT 0 (incl. consumer mobile/web typechecks).
- `node scripts/check-meerkat-parity.mjs`: all checks passed.

## A test-logic fix worth recording

The first `key_changed` test asserted a re-keyed bundle should read as
`invalid_signature`. That was wrong: re-signing a new DH key with the real Ed25519
key produces a self-valid bundle, so the correct verdict against an old pin is
`key_changed` (verify true). The unsigned MITM swap is the `invalid_signature`
case, already covered separately. Corrected the test to match the real model.

## Remaining M2

MK-016 (MEER friend-code rendezvous on the relay + QR + mutual approval + rebuilt
pair screens), MK-017 (5-emoji SAS, required before `shared_workspace` on
`isSensitive` modules; closes C13 half 2), MK-018 (introducer model), MK-019
(revocation v2 gossiped + checked in handshake), MK-020 (recovery key).
