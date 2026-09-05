# Meerkat M2 MK-016: Friend-code rendezvous

Date: 2026-06-11
Branch: `feature/meerkat-network`
Plan: `docs/plans/active/14-meerkat-network-v2-mission-control.md` (M2)

## Goal

MK-016: turn the existing MEER friend codes into a working pairing channel. A
device publishes its signed identity bundle (MK-015) to a relay under a friend
code's rendezvous id; a peer who only has the code resolves the bundle, verifies
it, and pairs. Acceptance: a code typed on a stranger's phone resolves and both
pair; QR works offline on LAN; expired/used codes are rejected.

## What was built

### 1. Relay rendezvous v0 (`@mylife/meerkat-relay`)

- `protocol.ts`: new `pub` / `res` client frames and `pubok` / `rec` server
  frames; limits for record size (8 KB), TTL (10 min), store cap (10k records),
  and a per-connection pub/res rate (30/window). `rid` is validated as 16-64 hex
  chars. New error codes `not_found` / `store_full`.
- `hub.ts`: `publish(connId, rid, rec, send, ttlMs?)` stores the record verbatim
  (opaque, never parsed -- the same privacy guarantee as `env`), clamps TTL to
  the max, caps the store, and rate-limits per connection; `resolve(connId, rid,
  send)` returns and CONSUMES the record (one-time) or `not_found` for unknown /
  expired / already-used ids. `sweep()` and `stats()` extended; `leave()` cleans
  the rendezvous rate entry.
- `server.ts`: routes `pub` / `res` (no token-join required -- rendezvous is
  independent of pairing sessions).
- 7 new hub tests: publish+resolve verbatim, one-time, unknown id, TTL expiry,
  sweep purge, republish refresh, oversize reject, rate-limit flood.

### 2. Sync-side client (`@mylife/sync`)

- `transport/rendezvous-client.ts`: `publishRendezvous` / `resolveRendezvous` --
  one WebSocket round-trip each (open, one frame, one reply, bye), on the
  platform global WebSocket (RN/browser/Node 22+). Resolve returns the opaque
  record string, or null on `not_found`.
- `node/friend-rendezvous.ts`: the identity layer.
  - `publishIdentityToRendezvous({ url, identity, rendezvousId, relayHints? })`
    builds the MK-015 signed bundle, base64s it, publishes under
    `hex(rendezvousId)`, and returns the formatted friend code to share.
  - `resolveIdentityFromRendezvous({ url, code })` parses+checksums the code,
    resolves the record, base64-decodes + JSON-parses, and verifies the
    self-signature. Returns a typed result: `ok` with the bundle, or
    `bad_code` / `not_found` / `invalid_bundle` -- never a bare throw.

### 3. e2e over the live relay (`@mylife/meerkat-relay` tests)

`friend-rendezvous-e2e.test.ts` (4): Alice publishes under a fresh code; Bob,
who has never seen Alice, types the code cold and resolves + verifies her bundle
(deviceId, dhPublicKey, displayName, relayHints all match). One-time consumption
(second resolve = not_found), malformed-code rejection (before any network),
and never-published = not_found.

### 4. App wiring (`apps/meerkat`)

- `data/sync-core.ts`: `pairingDataFromBundle(signed)` derives PairingData from a
  bare bundle with a deterministic nonce; `pairingDataFromSignedPayload` now
  builds on it (keeping the envelope nonce).
- `providers/SyncProvider.tsx`: extracted the MK-015 TOFU+pair logic into a
  shared `applyTrustedBundle(signed)`. `pairWithJson` (paste) and the new
  `publishFriendCode(relayUrl)` / `pairWithFriendCode(relayUrl, code)` all funnel
  through it, so friend-code pairing pins keys and blocks key-changes exactly
  like pasted pairing.
- `sync.tsx`: a "Pair by friend code" panel -- publish my code (shows the MEER
  code + copy), or type a friend's code and resolve+pair. Honest copy: a code
  works once, expires in 10 minutes, and publishes only the signed public
  identity, never a private key.

QR offline path: the existing signed v2 pairing payload string (`myPairingJson`)
is already QR-ready and `parseSignedPairingPayload` verifies it; rendering an
actual QR widget is a UI follow-up, not a protocol gap.

## v0 honesty boundary

The published rendezvous record is `base64(JSON(signed bundle))`. The relay
stores it opaquely and never parses it, but a relay operator who deliberately
base64-decodes a record would see the bundle's public keys and display name.
That is acceptable for v0 friend discovery; an encrypted rendezvous record
(keyed by a secret half of an extended friend code) is the hardening follow-up
and needs no relay change because `rec` is already opaque to the relay.

## Verification

- `@mylife/meerkat-relay`: 31 tests (was 20; +7 hub, +4 e2e). typecheck clean.
- `@mylife/sync`: 884 tests, typecheck clean (new client/helper exercised by the
  relay e2e).
- `@mylife/meerkat-app`: 31 tests (+1 pairingDataFromBundle). typecheck clean.
- `pnpm gate:function:changed`: EXIT 0. `check-meerkat-parity.mjs`: all passed.

## Remaining M2

MK-017 (5-emoji SAS from the session transcript hash, required before
`shared_workspace` on `isSensitive` modules; closes C13 half 2), MK-018
(introducer model), MK-019 (revocation v2 gossiped + checked in handshake),
MK-020 (recovery key).
