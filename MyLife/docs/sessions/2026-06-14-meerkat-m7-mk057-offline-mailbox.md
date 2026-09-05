# Meerkat M7 MK-057 Offline Channel Mailbox

Date: 2026-06-14
Branch: `feature/meerkat-network`

## Work Completed

- Added `packages/sync/src/protocol/channel-mailbox.ts`, a typed channel-message layer over the MK-033 v2 mailbox.
- Exported the channel mailbox helpers from both `packages/sync/src/index.ts` and `packages/sync/src/index.native.ts`.
- Extended `channel-chat-session.test.ts` with an offline burst case: the sender seals out-of-order channel events, the wire hides device/community/channel/body values, the recipient opens the mailbox envelope on reconnect, and the local ordered log contains every message in order.
- Extended relay mailbox E2E coverage so a real relay parks a sealed channel-message burst while the phone is offline, drains it on reconnect, and purges a channel mailbox envelope after the TTL window.
- Wired `SyncProvider.queueChannelMessageMailbox` and `ChatProvider` so locally created sends, edits, and deletes are best-effort parked to each active paired community member's pair-private mailbox token when a relay URL is configured.
- Moved relay setting keys into `sync-core.ts` so the Sync screen and provider share the same persisted relay URL.
- Marked MK-057 complete in `docs/plans/active/15-M7-channel-chat-implementation.md`.

## Verification

- `pnpm --filter @mylife/sync test -- channel-chat-session`
- `pnpm --filter @mylife/meerkat-relay test -- mailbox-mode-e2e`
- `pnpm --filter @mylife/sync typecheck`
- `pnpm --filter @mylife/meerkat-app typecheck`
- `pnpm --filter @mylife/meerkat-relay typecheck`
- `pnpm gate:function --file packages/sync/src/protocol/channel-mailbox.ts`
- `pnpm gate:function --file "apps/meerkat/app/(root)/providers/SyncProvider.tsx"`
- `pnpm gate:function --file "apps/meerkat/app/(root)/providers/ChatProvider.tsx"`
- `pnpm gate:function:changed`
- `pnpm --filter @mylife/meerkat-relay test`
- `pnpm check:generated-artifacts`
- `pnpm check:parity --quiet`

## Notes

- The app hook is intentionally best-effort. It does not claim a message is remotely delivered. It sends a sealed envelope to the configured relay mailbox token; the relay either forwards it to an online peer or parks it under its TTL mailbox.
- The channel mailbox payload stays inside the v2 sealed box. The relay sees only the opaque token, envelope size, and timing.
- Next M7 item: MK-058 read state and unread counts.
