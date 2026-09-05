# Meerkat Prompt 01 Information Architecture

Date: 2026-06-24

## Summary

Implemented Prompt 01 for Meerkat: moved mobile primary navigation from node-first tabs to user-first social tabs and cleaned primary copy on mobile and web.

## What Changed

- Mobile tab bar is now `Feed`, `Communities`, `Messages`, `Friends`, `Me`.
- Old `Node` tab moved to hidden route `node.tsx` as `Local library`.
- Old `Share`, `Identity`, and `Settings` tabs are hidden from the tab bar and reachable from `Me`.
- Added honest placeholder entry points for `Feed`, `Messages`, and `Friends`.
- Kept `Communities` as a real primary surface and removed protocol-first copy from its visible text.
- Cleaned visible channel, file, attachment, and advanced-sharing copy where those flows are reachable from primary navigation.
- Updated web welcome, onboarding, and status-pill copy to match the user-first direction without claiming hosted delivery or automatic connectivity.

## Old To New Tab Map

| Old primary tab | New location |
|---|---|
| `Node` | `Me` -> `Local library` |
| `Share` | `Me` -> `Advanced sharing` |
| `Identity` | `Me` -> `Edit profile` |
| `Communities` | `Communities` |
| `Settings` | `Me` -> `Settings` |

## Honest Placeholders

- `Feed` shows real joined-community unread highlights only. It says posts, replies, files, and DMs will appear only after those surfaces exist.
- `Messages` routes users to real community channels and explicitly says direct messages and group DMs are not built yet.
- `Friends` exposes the real friend code and paired-device list, but says the mutual friends graph, friend requests, followers, and direct-message list are not built in this slice.

## Files Changed

- `apps/meerkat/app/(root)/(tabs)/_layout.tsx`
- `apps/meerkat/app/(root)/(tabs)/index.tsx`
- `apps/meerkat/app/(root)/(tabs)/messages.tsx`
- `apps/meerkat/app/(root)/(tabs)/friends.tsx`
- `apps/meerkat/app/(root)/(tabs)/me.tsx`
- `apps/meerkat/app/(root)/(tabs)/node.tsx`
- `apps/meerkat/app/(root)/(tabs)/communities.tsx`
- `apps/meerkat/app/(root)/(tabs)/channel/[communityId]/[channelId].tsx`
- `apps/meerkat/app/(root)/(tabs)/files/[communityId].tsx`
- `apps/meerkat/app/(root)/(tabs)/share.tsx`
- `apps/meerkat/app/(root)/components/AttachmentCard.tsx`
- `apps/meerkat-web/src/ui/App.tsx`
- `apps/meerkat-web/src/ui/onboarding/OnboardingOverlay.tsx`
- `apps/meerkat-web/src/ui/shell/StatusPill.tsx`
- `errors_log.md`

## Verification

- `pnpm --filter @mylife/meerkat-app typecheck` passed.
- `pnpm --filter @mylife/meerkat-web typecheck` passed.
- `pnpm --filter @mylife/meerkat-web test` passed.
- `node scripts/check-meerkat-parity.mjs` passed.
- `pnpm --filter @mylife/meerkat-app test` failed once on the known intermittent `saveFilesBulk` complexity slope row, then passed on rerun.
- `pnpm gate:function:changed` passed for Meerkat app and web.
- `rg -n "\x{2014}"` on changed UI files returned no matches.

## Remaining Work

- Prompt 02 should build the 60-second onboarding path.
- Feed remains a real community-unread placeholder until Prompt 04 or Prompt 05 builds post and feed engines.
- Messages and Friends remain honest placeholders until the friend graph and DM schema work lands.
- Web still uses its existing community shell rather than matching mobile tabs. This slice updated labels and front-door copy only.
