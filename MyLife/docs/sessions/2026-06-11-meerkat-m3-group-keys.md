# Meerkat M3: Group keys (MK-021..024)

Date: 2026-06-11
Branch: `feature/meerkat-network`
Plan: `docs/plans/active/14-meerkat-network-v2-mission-control.md` (M3 — all four tickets)

## Goal

M3 exit: a multi-member workspace encrypts under one group key; removing a
member rotates keys for real. v1's "rotation" (`rotateWorkspaceKey`) bumped an
integer and invalidated wrap rows -- no secret was ever generated, wrapped,
unwrapped, or used.

## MK-021: OpenMLS spike → defer the library, ship the shape

No Rust toolchain exists in this environment, and binding OpenMLS into
Expo/Node means uniffi + native modules + a storage provider -- the same class
of work as the planned M4 iroh core. Verdict: adopt OpenMLS WITH the M4 Rust
integration (one binding pipeline), and build the MLS protocol shape now on
audited tweetnacl primitives. Full gap analysis (O(n) fan-out vs TreeKEM,
per-epoch vs per-message FS, group-scale limits) and adopt notes:
`docs/reports/REPORT-meerkat-mls-spike-2026-06-11.md`.

`protocol/group-keys.ts` (the spike harness, now load-bearing):
- `createGroupCommit` mints a fresh 32-byte epoch secret, advances the epoch
  (`current_key_version`), and wraps the secret once per member: ephemeral
  X25519 against the member's static DH key -> HKDF -> authenticated secretbox,
  into the existing `sync_workspace_keys` table (blob = ephPub||nonce||box).
- `unwrapEpochSecret` / `getCurrentEpochKey` (join), `storeReceivedKeyWrap`
  (distribution intake), `deriveEpochContentKey` (key-schedule export).

AC: `group-keys.test.ts` proves a 3-device group unwraps the SAME epoch secret
from one commit; tampered wraps fail closed; non-members get nothing.

## MK-022: workspace traffic keys under the group epoch

- SYNC_OFFER/ACCEPT now carry `groupEpoch`. When BOTH sides advertise the same
  epoch, the data channel keys under `deriveEpochContentKey(secret, ws, epoch)`
  -- superseding the static pairwise key AND the Noise per-pair switch (group
  access control wins; rotation-on-commit is the group's forward secrecy).
- A workspace holding an epoch key ALWAYS negotiates (the negotiation phase
  previously only ran when transport prefs or a security preference existed --
  found via a live-session diagnostic when `negotiation` came back undefined).
- Epoch mismatch (mid-distribution laggard, pre-group-key workspace) falls
  back to the pairwise path: the migration window the plan calls for.
- 5-member AC at the crypto layer: all five members derive one content key and
  decrypt the same traffic (`group-keys.test.ts`).

## MK-023: membership ops as commits (replacing the integer bump)

- `commitMemberAdd`: membership row + new epoch wrapped for old members plus
  the newcomer -- who can never unwrap earlier epochs (no retroactive access).
- `commitMemberRemoval`: membership row closed + new epoch wrapped for everyone
  EXCEPT the removed device. `rotateWorkspaceKey` marked `@deprecated`.
- **Captured-frames acceptance** (`group-keys-session.test.ts`): a real session
  between two surviving members runs post-removal with `negotiation.groupEpoch
  = 2`; a wire tap captures every frame; the removed device's epoch-1 secret
  (under either epoch label) opens ZERO captured SYNC_DATA frames, while a
  current member's epoch-2 key opens them -- proving the traffic is genuinely
  group-keyed and the removal genuinely rotated.

## MK-024: per-entity content keys + crypto-shredding (D10.5)

- `protocol/entity-keys.ts` + `sync_entity_keys` table (SYNC_TABLES 29 -> 30):
  `entityRequiresContentKey` (isSensitive modules + disappearing-message
  tables), `getOrCreateEntityKey` (random 256-bit per row),
  `sealEntityPayload`/`openEntityPayload`, `destroyEntityKey`
  (overwrite-then-delete).
- AC: `entity-keys.test.ts` -- destroying the key renders REPLICATED ciphertext
  (bytes we can no longer touch) unreadable; a re-created row gets a fresh key
  that cannot open old ciphertext.
- Erasure runbook with honest boundaries (key-holding peers converge on next
  sync; SQLite page remnants -> secure_delete/SQLCipher/OS encryption; pre-shred
  backups; past plaintext readers): `docs/designs/meerkat-erasure-runbook.md`.

## Verification

- `@mylife/sync`: 934 tests (was 921; +13: 6 group-keys, 1 live session, 6
  entity-keys). typecheck clean.
- `@mylife/meerkat-app`: 31; meerkat parity green; `gate:function:changed` EXIT 0.

## Deferred seams (consistent with M2's)

Wrap/commit DISTRIBUTION over live sessions and relay mailboxes (the gossip
transport shared with MK-018/019), engine payload-path wiring for per-entity
keys, and the workspace/admin UI. OpenMLS adoption rides M4 per the spike
report.

## Next

M4: Rust Core + Blobs (the strategic bet) per plan 14.
