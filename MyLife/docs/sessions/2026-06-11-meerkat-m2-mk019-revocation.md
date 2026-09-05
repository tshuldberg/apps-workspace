# Meerkat M2 MK-019: Revocation v2 (signed + gossipable)

Date: 2026-06-11
Branch: `feature/meerkat-network`
Plan: `docs/plans/active/14-meerkat-network-v2-mission-control.md` (M2)

## Goal

MK-019: make device revocation actually protect the group. Acceptance: a revoked
device cannot complete the handshake with any member within one gossip round, and
an audit/record is written.

## Starting point

v1 (`identity/revocation.ts`) created a plain `DeviceRevocation` row and the
handshake already rejected locally-revoked devices (`isDeviceRevoked`). But the
record was UNSIGNED and never left the device that made it -- the code comment
literally said "in a full implementation, this record would be signed with the
local device's Ed25519 key and gossiped to all peers." So revoking a lost phone
protected only the revoker. MK-019 is exactly that missing half.

## What was built

`protocol/revocation-record.ts` (pure sign/verify + a DB-touching apply):

- `SignedRevocation` = `{ revocation: DeviceRevocation, signature }`.
- `createSignedRevocation(revoker, targetDeviceId, reason?)` signs a canonical
  record with the revoker's Ed25519 key.
- `verifySignedRevocation(signed)` checks the signature against
  `revocation.revokedByDeviceId`. A forged revoker or a tampered target device id
  fails (the signature covers the whole record).
- `applySignedRevocation(db, signed, opts?)`:
  1. verify the signature;
  2. authorize the revoker -- by default a device the recipient has already
     paired with, OR the device revoking ITSELF (a compromised-device self-report);
     a caller can pass a stricter predicate (e.g. only the workspace admin);
  3. `insertRevocation` locally (idempotent).

Once applied, the EXISTING handshake `isDeviceRevoked` check rejects the device.
So gossiping the signed record (over a session or relay mailbox) and applying it
is enough for every member to lock the device out in one round -- no new
handshake code was needed, only an authenticated way to share the revocation.

## App: device-list revoke (MK-019 UI)

- SyncProvider: `revokePeer(peerId, reason?)` signs a revocation with this device
  and applies it locally (authorizing self as the revoker); `isPeerRevoked(peerId)`.
- Sync screen: each paired-device card gains a "Revoke this device" (danger)
  button and, once revoked, a "⛔ Revoked -- this device can no longer sync here"
  badge (and the SAS controls are hidden). This is real: a revoked device is
  rejected by the engine handshake from then on.

## Tests

`revocation-record.test.ts` (8):
- sign/verify round-trip; forged-revoker rejected; tampered-target rejected;
- **the acceptance**: a member (paired with the admin and with the lost device)
  applies the admin's gossiped revocation -- a record it did NOT issue -- and its
  `isDeviceRevoked` (the exact check the handshake uses) flips to true for the
  lost device;
- unauthorized-revoker (an un-paired stranger) refused; self-revocation always
  allowed; a forged record refused outright; idempotency.

## Verification

- `@mylife/sync`: 913 tests (was 905; +8). typecheck clean.
- `@mylife/meerkat-app`: 31 tests, typecheck clean.
- `pnpm gate:function:changed`: EXIT 0. `check-meerkat-parity.mjs`: all passed.

## Remaining seam

Forwarding the signed revocation over a live session or relay mailbox (the gossip
transport itself) belongs with the broader session-message work, alongside MK-018
introduction distribution. The authenticated record and the local apply + handshake
rejection are done and proven.

## Remaining M2

MK-020 (recovery v1: printable high-entropy recovery key that encrypts a master
keychain export; multi-device key replication on pairing).
