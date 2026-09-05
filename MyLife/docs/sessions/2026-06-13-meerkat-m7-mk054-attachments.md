# 2026-06-13 Meerkat M7 MK-054 Attachments

## Summary

Continued the Meerkat M7 channel-chat work after MK-053 edit/delete. This slice completed the first MK-054 attachment path:

- `ChannelMessageEvent` now signs attachment metadata (`id`, `blobHash`, `name`, `mimeType`, `size`) as part of the canonical event.
- Native and full sync engines now accept a `SessionBlobProvider` and pass it into initiator/responder sessions, so the existing blob phase can move referenced bytes.
- Meerkat community schema now includes `cm_message_attachments` rows with exact `blob_hash` fields for blob discovery, plus `attachments_json` on `cm_messages` for signed render metadata.
- `ensureSyncSchema` seeds the community blob policy through the sync package default (`wifi_only`, size capped).
- New `ExpoBlobStore` stores raw attachment bytes under `documentDirectory/meerkat/blobs/`, verifies content hashes on write, exposes preview data URIs, and exports files to cache for OS sharing.
- Channel screen now supports document picking, attachment-only sends, removable draft chips, inline image previews when bytes are local, and an OS share/open handoff for stored attachments.

## Files Touched

- `packages/sync/src/protocol/channel-message.ts`
- `packages/sync/src/engine/sync-engine.native.ts`
- `packages/sync/src/engine/sync-engine.ts`
- `packages/sync/src/index.ts`
- `packages/sync/src/index.native.ts`
- `packages/sync/src/__tests__/channel-message.test.ts`
- `apps/meerkat/app/(root)/data/community-core.ts`
- `apps/meerkat/app/(root)/data/expo-blob-store.ts`
- `apps/meerkat/app/(root)/data/sync-core.ts`
- `apps/meerkat/app/(root)/data/chat-state.ts`
- `apps/meerkat/app/(root)/providers/ChatProvider.tsx`
- `apps/meerkat/app/(root)/providers/SyncProvider.tsx`
- `apps/meerkat/app/(root)/(tabs)/channel/[communityId]/[channelId].tsx`
- `apps/meerkat/app/__tests__/community-core.test.ts`
- `apps/meerkat/app/__tests__/sync-core.test.ts`
- `apps/meerkat/package.json`
- `pnpm-lock.yaml`

## Verification

- `pnpm --filter @mylife/meerkat-app typecheck`
- `pnpm --filter @mylife/sync typecheck`
- `pnpm --filter @mylife/meerkat-app test`
- `pnpm --filter @mylife/sync test -- channel-message blob-pipeline`
- `pnpm --filter @mylife/sync test`
- `pnpm gate:function --file packages/sync/src/protocol/channel-message.ts`
- `pnpm gate:function --file packages/sync/src/engine/sync-engine.native.ts`
- `pnpm gate:function --file packages/sync/src/engine/sync-engine.ts`
- `pnpm gate:function --file apps/meerkat/app/(root)/data/community-core.ts`
- `pnpm gate:function --file apps/meerkat/app/(root)/data/expo-blob-store.ts`
- `pnpm gate:function --file apps/meerkat/app/(root)/providers/SyncProvider.tsx`
- `pnpm gate:function --file apps/meerkat/app/(root)/providers/ChatProvider.tsx`
- `pnpm gate:function --file apps/meerkat/app/(root)/data/chat-state.ts`
- `pnpm gate:function --file apps/meerkat/app/(root)/data/sync-core.ts`
- `pnpm gate:function --file apps/meerkat/app/(root)/(tabs)/channel/[communityId]/[channelId].tsx`
- `pnpm gate:function:changed`
- `pnpm --filter @mylife/meerkat-app build`
- `pnpm check:generated-artifacts`
- `pnpm check:meerkat-parity`
- `pnpm check:parity --quiet`

## Notes

- Expo web QA is still not available for Meerkat because `app.json` excludes the web platform. Native bundle export passed for Android and iOS.
- Real device runtime QA is still pending: pick a document/image, send it, run a relay or LAN session, confirm the peer receives the attachment row and blob bytes, preview/open it, and verify over-cap handling on device.
- The Open Brain MCP server was listed but pending approval in this environment, so no Open Brain capture was made.
