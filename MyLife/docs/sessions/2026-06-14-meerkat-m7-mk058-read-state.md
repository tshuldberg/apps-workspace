# Meerkat M7 MK-058 Read State And Unread Counts

Date: 2026-06-14
Branch: `feature/meerkat-network`

## Work Completed

- Added `cm_read_state` helpers in `apps/meerkat/app/(root)/data/community-core.ts`: monotonic `markChannelRead`, row loading, per-channel unread counts, and per-community channel unread maps.
- Wired `ChatProvider` so viewing a channel marks the newest visible event read and records the read-state row through the existing community sync change tracker.
- Added unread badges to the Communities channel list, including accessible labels for channels with unread messages.
- Hardened `packages/sync/src/protocol/sync-session.ts` so LWW snapshots and covered change IDs are filtered to the outbound session scope before `SYNC_DATA` is sent. A shared community session no longer transmits `personal_replica` read-state rows for the receiver to reject.
- Added MK-058 coverage in app community-core tests and sync live-session tests.
- Updated the paired `apps/meerkat/CLAUDE.md` and `apps/meerkat/AGENTS.md` guidance with the live `cm_` table set and channel-messaging honesty boundary.

## Verification

- `pnpm --filter @mylife/meerkat-app test -- community-core`
- `pnpm --filter @mylife/sync test -- channel-chat-session`
- `pnpm --filter @mylife/meerkat-app typecheck`
- `pnpm --filter @mylife/sync typecheck`
- `pnpm gate:function --file packages/sync/src/protocol/sync-session.ts`
- `pnpm gate:function --file "apps/meerkat/app/(root)/data/community-core.ts"`
- `pnpm gate:function --file "apps/meerkat/app/(root)/providers/ChatProvider.tsx"`
- `pnpm gate:function --file "apps/meerkat/app/(root)/(tabs)/communities.tsx"`
- `pnpm gate:function:changed`
- `pnpm check:generated-artifacts`
- `pnpm check:parity --quiet`

## Notes

- Read state is personal replica data. It may sync across a user's own devices, but it is omitted from shared community sessions and never crosses the group wire.
- `cm_read_state` was already part of the community sync policy. This slice made it functional and added the outbound privacy filter needed to keep it off shared sessions.
- M7 is code-complete. Native device exit-demo QA remains pending because the standalone app targets iOS and Android only.
