# Meerkat Prompt 06 - Friends And Messages

Date: 2026-06-24

## Summary

Implemented Prompt 06 across the native and web Meerkat clients. Friends now use the existing safe identity path rather than a new social schema: a friend is an active paired device created by signed pairing payloads or friend-code rendezvous with TOFU key pinning. Messages now show real paired friends while clearly explaining that private DM storage and delivery are not built yet.

## Changes

- Native Friends tab:
  - Added relay-backed friend-code publish and add flow using `publishFriendCode` and `pairWithFriendCode`.
  - Shows friend rows from real paired devices, with labels for Friend, Safety code, Message, and Block.
  - Shows five-emoji safety codes when derivable, records safety-code confirmation through `confirmPeerSas`, and blocks through real local revocation via `revokePeer`.
  - Keeps private messages honest with an unavailable explanation instead of fake conversations.

- Native Messages tab:
  - Lists real paired friends as private-message candidates.
  - Keeps community messages as the live path.
  - States that DMs never appear in public feed views and will be feed opt-in only after DM storage exists.

- Web:
  - Added Friends and Messages as first-class panes in the rail and view-state reducer.
  - Added friend-code add flow to the web provider using `resolveIdentityFromRendezvous`, `evaluateBundleTrust`, TOFU pinning, and `completePairing`.
  - Exposed web SAS helpers and local block/revoke helpers, mirroring the native provider.
  - Added Friends and Messages views with safety-code checks, block, and honest DM unavailable copy.

- Tests:
  - Added native and web `friends-core` tests for checked, unknown, blocked, inactive, and DM-unavailable friend row states.

## Data Model

Prompt 06 does not add a separate friends table. The V1 friend model is the existing `sync_paired_devices` relationship plus pinned identity and revocation records from `@mylife/sync`.

- Friend: active paired device that is not locally revoked.
- Safety checked: row in `sync_sas_verifications` for the peer.
- Blocked: local signed revocation recorded through `applySignedRevocation`.
- Message candidate: real friend row, but private DM storage is unavailable in this slice.

## Privacy Guarantees

- Friend-code requests publish only signed public identity material to the relay.
- Pairing still uses TOFU pinning and rejects invalid signatures or changed pinned keys.
- Safety-code verification is derived from the pairwise shared secret.
- Blocking is a real local revocation that future sync handshakes reject on this device.
- DMs are not stored, sent, or shown in any feed. The UI says this explicitly.

## Limitations

- No pending friend-request inbox exists yet. Adding by code resolves and pairs immediately if the published identity verifies.
- No private DM table, encrypted DM mailbox, delivery receipt, read receipt, online presence, or group DM exists yet.
- Block is local revocation. Cross-community moderation and owner review are Prompt 07 work.

## Verification

- `pnpm --filter @mylife/meerkat-app exec vitest run app/__tests__/friends-core.test.ts`
- `pnpm --filter @mylife/meerkat-web exec vitest run src/lib/__tests__/friends-core.test.ts`
- `pnpm --filter @mylife/meerkat-app typecheck`
- `pnpm --filter @mylife/meerkat-web typecheck`
- `pnpm --filter @mylife/meerkat-web test`
- `pnpm --filter @mylife/meerkat-app test`
- `pnpm gate:function --file 'apps/meerkat/app/(root)/data/friends-core.ts'`
- `pnpm gate:function --file apps/meerkat-web/src/lib/friends-core.ts`
- `node scripts/check-meerkat-parity.mjs`
- `pnpm gate:function:changed`

`pnpm --filter @mylife/meerkat-app test` initially hit the known timing-sensitive `saveFilesBulk` function-gate slope failure in `community-files.function-gate.test.ts`. The test now uses 1000/2000/4000 row samples instead of the noisy 500-row baseline; the focused gate and full app suite pass.

## Next

Prompt 07: Communities and safety.
