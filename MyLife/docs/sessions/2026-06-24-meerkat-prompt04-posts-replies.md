# Meerkat Prompt 04 Posts And Replies

Date: 2026-06-24

## Scope

Built the first consumer post and reply surface on top of the MK-P01 signed v2 channel message contract. The slice keeps normal users in the social product layer: create a post, see post cards, open a thread, reply with inherited audience, and edit or delete authored post events.

## Changes

- Added native post helpers in `apps/meerkat/app/(root)/data/community-core.ts` for signed v2 root posts, signed v2 replies, `cm_posts` indexing, post cards, and thread trees.
- Extended native `ChatProvider` with `sendPost` and `replyToPost`, and preserved v2 post fields during edit/delete.
- Added a native post composer and post cards to channel screens, filtered post events out of the raw chat list, and added the thread route at `apps/meerkat/app/(root)/(tabs)/post/[communityId]/[channelId]/[postId].tsx`.
- Mirrored the same helpers and provider APIs in `apps/meerkat-web/src/lib/meerkat-data.ts` and `apps/meerkat-web/src/lib/MeerkatProvider.tsx`.
- Added web `PostsPanel` and `PostThreadView`, wired them into `ChannelView`, and added matching CSS.
- Added native coverage for card derivation, inherited reply audience, and edited-root reply attachment; added web/native parity coverage for the Prompt 04 helpers.

## Decisions

- A post root uses a generated stable post id before signing. The event content id cannot be its own `postId` because `postId` is already part of the signed v2 payload.
- The UI derives cards and threads from verified signed `cm_messages` events. `cm_posts` is a local replicated index for roots, not the trusted source of visible body text.
- Prompt 04 intentionally excludes reactions, bump sorting, followers, anonymous posting, public directory, and hosted public reach.

## Verification

- `pnpm --filter @mylife/meerkat-app typecheck`
- `pnpm --filter @mylife/meerkat-web typecheck`
- `pnpm --filter @mylife/meerkat-app test`
- `pnpm --filter @mylife/meerkat-web test`
- `node scripts/check-meerkat-parity.mjs`
- `pnpm gate:function:changed`
- `git diff --check`

## Handoff

Prompt 05 should build the Feed engine layer 1 over real local data. Start from Prompt 04 community posts, existing channel messages, files, and read-state. Keep feed controls deterministic and explainable, hide public hosted sources unless they are real, and document any muted, blocked, or report-hidden gaps for Prompt 07.
