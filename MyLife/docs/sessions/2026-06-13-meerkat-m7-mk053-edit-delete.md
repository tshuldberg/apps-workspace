# Meerkat M7 MK-053 Edit/Delete

Date: 2026-06-13
Branch: `feature/meerkat-network`

## Summary

Continued the M7 channel chat work after MK-050 through MK-052. This session implemented the first MK-053 app slice: author-only message edit and delete controls in the channel screen, backed by signed immutable supersede events. Deletes now record a signed tombstone event and then shred any local per-entity keys for the message supersede thread when such keys exist.

## What Changed

- Added `listChannelMessageThreadIds` and `destroyChannelMessageKeys` in `apps/meerkat/app/(root)/data/community-core.ts`.
- Added `editMessage` and `deleteMessage` in `ChatProvider`, using `createChannelMessage` with `supersedes` instead of mutating existing rows.
- Added a reducer `setError` action for edit/delete authorization and write failures that are not optimistic sends.
- Updated `/channel/[communityId]/[channelId]` with author-only edit/delete icon actions, edit composer mode, signed delete confirmation copy, and an updated partial-history notice that stays honest about host history and shred propagation gaps.
- Extended `community-core.test.ts` to cover redaction key shredding for a supersede thread and mutation error state.

## Verification

- `pnpm --filter @mylife/meerkat-app typecheck`
- `pnpm --filter @mylife/meerkat-app test`
- `pnpm --filter @mylife/sync typecheck`
- `pnpm --filter @mylife/sync test -- channel-message channel-chat-session entity-keys`
- `pnpm gate:function --file apps/meerkat/app/(root)/data/community-core.ts`
- `pnpm gate:function --file apps/meerkat/app/(root)/providers/ChatProvider.tsx`
- `pnpm gate:function --file apps/meerkat/app/(root)/data/chat-state.ts`
- `pnpm gate:function --file apps/meerkat/app/(root)/(tabs)/channel/[communityId]/[channelId].tsx`
- `pnpm gate:function:changed`
- `pnpm check:meerkat-parity`
- `pnpm check:parity --quiet`

`gate:function:changed` also ran the full `@mylife/sync` suite: 73 files, 1028 tests.

## QA Notes

Expo browser QA is still not possible from this workspace because `expo start --web` exits with: `"web" is not included in the project app.json "platforms" array.` The remaining visual/runtime QA needs an Expo device build or simulator run.

Open Brain was configured in the Claude MCP inventory but pending approval, so no `capture_memory` call was available from this session.

## Remaining Items

- Run the channel screen on a native Expo target and verify loading, empty, error, success, partial-history, edit, and delete states.
- Finish the stronger MK-053 redaction acceptance when MK-055/MK-056 host-seeded history exists: deleting a message should make prior seeded ciphertext unreadable on another device after shred propagation.
- Continue M7 with MK-054 attachments, MK-055 history snapshots, MK-056 scrollback, MK-057 offline delivery, and MK-058 read state.
