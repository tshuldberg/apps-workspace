# 2026-06-13 - Meerkat M7 MK-056 History Fetch

## Summary

Implemented the host-seeded channel history fetch path for MK-056.

`@mylife/sync` now exposes `fetchChannelHistory` for the Node-oriented sync surface. It combines descriptor/manifest host URLs, fetches catalog pieces with `WebSeedClient`, verifies every piece, decrypts the MK-055 snapshot with the community epoch group key, validates snapshot and message signatures, and merges the fetched events with live local events by content id. It returns explicit `no_hosts` and `fetch_failed` outcomes so callers can show partial history honestly.

The app data layer now has `mergeChannelMessageEvents`, which writes only valid signed channel events, skips live duplicates, and stores attachment rows for fetched events. The channel screen copy was updated to stop referring to MK-055/MK-056 as future work while still saying host history is partial unless a host catalog is available.

## Files Changed

- `packages/sync/src/protocol/channel-history.ts`
- `packages/sync/src/__tests__/channel-history.test.ts`
- `packages/sync/src/index.ts`
- `packages/meerkat-relay/src/__tests__/channel-history-fetch-e2e.test.ts`
- `apps/meerkat/app/(root)/data/community-core.ts`
- `apps/meerkat/app/__tests__/community-core.test.ts`
- `apps/meerkat/app/(root)/(tabs)/channel/[communityId]/[channelId].tsx`
- `docs/plans/active/15-M7-channel-chat-implementation.md`
- `memory.md`

## Verification

- `pnpm --filter @mylife/sync test -- channel-history`
- `pnpm --filter @mylife/meerkat-relay test -- channel-history-fetch`
- `pnpm --filter @mylife/meerkat-app test -- community-core`
- `pnpm --filter @mylife/sync typecheck`
- `pnpm --filter @mylife/meerkat-relay typecheck`
- `pnpm --filter @mylife/meerkat-app typecheck`
- `pnpm --filter @mylife/sync test` - 74 files, 1034 tests
- `pnpm --filter @mylife/meerkat-relay test` - 15 files, 72 tests
- `pnpm --filter @mylife/meerkat-app test` - 4 files, 40 tests
- `pnpm gate:function --file packages/sync/src/protocol/channel-history.ts`
- `pnpm gate:function --file apps/meerkat/app/(root)/data/community-core.ts`
- `pnpm --dir packages/sync exec vitest run --maxWorkers=2`
- `pnpm gate:function:changed` - rerun reported no changed tracked source files after the automatic commit
- `pnpm check:generated-artifacts`
- `pnpm check:parity --quiet`

## Notes

- The MK-056 acceptance test lives in `@mylife/meerkat-relay` because it needs the real `MeerkatSeederNode` and `startSeederHttp` host path. A fresh member with zero live messages fetches a signed encrypted history catalog from a lone local HTTP seeder and reconstructs the ordered backlog.
- `channel-history.ts` remains exported from the full sync barrel, not `index.native.ts`, because this path still depends on Node-oriented catalog/web-seed pieces.
- `pnpm gate:function:changed` first failed inside the wrapper while the visible sync test log showed no assertion failure. The exact underlying sync command passed immediately afterward, and the gate rerun reported no changed tracked source files because `HEAD` had advanced to `1f666b991 feat(meerkat): add channel chat history` during the run.
- MK-057 is next: offline delivery via the MK-033 v2 mailbox.
