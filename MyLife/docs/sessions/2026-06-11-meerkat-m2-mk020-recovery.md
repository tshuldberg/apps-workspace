# Meerkat M2 MK-020: Recovery key + encrypted identity export

Date: 2026-06-11
Branch: `feature/meerkat-network`
Plan: `docs/plans/active/14-meerkat-network-v2-mission-control.md` (M2 — final ticket)

## Goal

MK-020: give the user a way to survive a wiped device. Acceptance: wipe the
phone, restore the identity from a recovery key + a relay mailbox, with the
data-loss boundaries documented honestly.

## What was built

`node/recovery-key.ts` (pure crypto):

- `generateRecoveryKey()` -> 256 random bits + a printable `MKR1-XXXXX-...`
  string (Crockford base32 of the 32 bytes plus a 2-byte SHA-512 checksum,
  grouped). `parseRecoveryKey` is typo-tolerant (case, spaces, dashes) and
  rejects a bad checksum.
- `exportRecoverableIdentity(identity)` -> `RecoverableIdentity` carrying the
  public keys, display name, and the extracted signing + DH PRIVATE key hexes
  (the keychain export).
- `sealRecovery(recoverable, recoveryBytes)` encrypts the export with
  authenticated secretbox under `HKDF(recoveryBytes, "meerkat-recovery-v1")`;
  `openRecovery(sealed, recoveryBytes)` decrypts and validates, returning null on
  a wrong key or any tamper (secretbox fails closed).

The recovery key is the only secret: the sealed blob is opaque to any host (a
relay mailbox, a file). Knowing where it is stored reveals nothing.

## End-to-end proof (over the live relay)

`recovery-e2e.test.ts` (in @mylife/meerkat-relay, 2):

1. Alice seals her identity export under a fresh recovery key and publishes the
   ciphertext to a relay mailbox keyed by `sha512(recoveryKey)` (a one-way id;
   not the encryption key).
2. The phone is wiped; all that survives is the printed key.
3. A fresh client recomputes the mailbox id from the parsed key, fetches the
   opaque blob, and `openRecovery` decrypts it -> the SAME `deviceId` and signing
   private key are restored.
4. A wrong recovery key cannot open the blob even when it successfully fetches it
   (encryption, not obscurity, is the protection).

Honesty note in the test + module: this reuses the MK-016 rendezvous store, which
is one-time + short-TTL, so it proves the crypto + transport round-trip; a
durable, re-resolvable recovery mailbox is a follow-up. The recovery key and
encrypted export are storage-agnostic.

## App surface

Settings gains a "Recovery key" section: "Generate recovery key" produces and
displays the printable key AND the encrypted identity backup, each with a copy
button. Honest copy: treat the key like a seed phrase (anyone with it can
impersonate you), keep the key and the backup apart, the backup is useless
without the key, and in-app restore on a fresh install is still pending (the
material to recover the same deviceId is real and proven).

## Data-loss boundaries (documented in the module header)

- No server escrow: lose both the printed key and every device and there is no
  recovery, by design.
- Restores the IDENTITY (keys), not module data; synced data re-flows from peers
  after re-pairing, device-local-only data is gone.
- A leaked recovery key is a full account compromise; rotation after a suspected
  leak is future work.

## Tests / verification

- `recovery-key.test.ts` (8): key round-trip + checksum + tolerance; seal/open
  recovers the exact keys; wrong key -> null; tampered ciphertext -> null;
  ciphertext does not contain the private key in the clear.
- `@mylife/sync`: 921 tests (was 913; +8). `@mylife/meerkat-relay`: 33 (+2).
  `@mylife/meerkat-app`: 31. typecheck clean; gate EXIT 0; parity green.

## M2 status

This was the last M2 ticket. **M2 (MK-015–020) is code-complete**: signed identity
bundles + TOFU, friend-code rendezvous, five-emoji SAS + the sensitive-module
engine gate, the introducer model, signed gossipable revocation, and recovery.
Deferred seams across the milestone: distributing introduction/revocation records
over a live session or relay mailbox (the gossip transport), the workspace/admin
UI, and in-app recovery re-install into the platform secure store. These belong
with the not-yet-built workspace surface and broader session-message work.

## Next

M3 per plan 14 (`docs/plans/active/14-meerkat-network-v2-mission-control.md`).
