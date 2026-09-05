# BestChef Beta Sync Readiness

Date: 2026-04-24

## Summary

Closed the previous BestChef caveat that native only bootstrapped hardened sync primitives. The standalone app now starts the Automerge-backed `SyncEngine`, writes ongoing BestChef social activity into syncable tables, records those writes in `sync_change_log`, and applies inbound CRDT rows back into SQLite.

## Changes

- Added BestChef schema v9 tables for syncable beta social activity:
  - `rc_bestchef_submissions`
  - `rc_bestchef_comments`
  - `rc_bestchef_votes`
- Added sync policy rules for BestChef submissions, comments, and votes with `shared_workspace` scope.
- Updated standalone local submission storage from `rc_settings` JSON blobs to first-class table rows, with compatibility migration from the old JSON keys.
- Attached a BestChef sync recorder to the native database adapter so submission, comment, and vote writes call `SyncEngine.recordChange`.
- Exported `DocumentManager`, `SyncEngine`, scheduler, and status store from the React Native sync entry.
- Started `SyncEngine` during BestChef database provider initialization after sync bootstrap.
- Applied received CRDT document changes back into SQLite during responder sync sessions.
- Wired the full comments screen send button to persist and display local comments.
- Added focused BestChef app tests for table-backed submissions, comments, votes, and sync-change recording.

## Verification

- `pnpm --filter @mylife/bestchef typecheck`
- `pnpm --filter @mylife/bestchef-app typecheck`
- `pnpm --filter @mylife/sync typecheck`
- `pnpm --filter @mylife/bestchef-app test`
- `pnpm --filter @mylife/bestchef test -- --run src/social/__tests__/follower-updates.test.ts`
- `pnpm --filter @mylife/sync test -- --run src/__tests__/crdt.test.ts src/__tests__/payload-security.test.ts`
- `pnpm --filter @mylife/sync test -- --run src/__tests__/engine.test.ts`
- `pnpm gate:function:changed`

## Known Caveat

`pnpm gate:function:changed` passed the BestChef app subgate, including typecheck and `app/(root)/data/__tests__/local-submissions.test.ts`, then failed on the pre-existing unrelated Notes lint blocker at `apps/mobile/app/(notes)/discovery 2.tsx:48`.

Real TestFlight multi-device recipe/comment webs still need production transport or cloud social relay wiring. The BestChef app now creates and logs the right sync data, but the default shared sync transport backends remain simulated unless a native/backend implementation is injected.
