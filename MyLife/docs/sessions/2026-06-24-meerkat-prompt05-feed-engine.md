# Meerkat Prompt 05 Feed Engine

Date: 2026-06-24

## Scope

Built the first local, explainable feed layer for Meerkat on mobile and web. The feed combines only records already present on this device: joined community posts, replies to the user's posts, mentions, unread channel highlights, and files shared in joined communities.

## Changes

- Added native `feed-core.ts` with deterministic feed controls, local ranking, channel mute filtering, hidden public sources, and documented excluded sources.
- Mirrored the same feed-core evaluator in `apps/meerkat-web/src/lib/feed-core.ts`.
- Replaced the native Feed tab placeholder with source toggles, feed cards, audience labels, reasons, and quick actions to open threads, channels, or files.
- Added the web Feed pane, rail entry, reducer actions, feed card styling, and controlled post-thread navigation from feed items.
- Added native feed-core tests for combined item derivation, source toggles, public-source hiding, and muted channel filtering.
- Extended the web/native parity test to include Prompt 05 feed helpers.

## Feed Item Types

- `mention`: a signed v2 message mentions the local device.
- `reply`: someone else replied to a post authored by the local device.
- `unread`: a joined community channel has unread local activity.
- `post`: a joined community post recorded on this device.
- `file`: a signed message attachment shared in a joined community.

## Ranking Signals

Ranking is local and deterministic: mentions, replies to your posts, unread channel highlights, posts, files, then signed HLC time and item id. No server ranking or engagement feed is involved.

## Controls

Present controls: Friends, Communities, Messages, Posts, Files, Unread.

Hidden control: Public. It remains hidden because no real public hosted source exists yet.

## Excluded Sources

- Friend-only posts are waiting on the friends graph.
- Direct messages and group DMs are waiting on Prompt 06 and are not feed sources yet.
- Public hosted sources are hidden until real hosted public sources exist.
- Block and report-hidden filtering are waiting on Prompt 07 moderation tables.

## Verification

- `pnpm --filter @mylife/meerkat-app exec vitest run app/__tests__/feed-core.test.ts`
- `pnpm --filter @mylife/meerkat-app typecheck`
- `pnpm --filter @mylife/meerkat-web typecheck`
- `pnpm --filter @mylife/meerkat-app test`
- `pnpm --filter @mylife/meerkat-web test`
- `node scripts/check-meerkat-parity.mjs`
- `pnpm gate:function:changed`
- `pnpm gate:function --file apps/meerkat/app/(root)/data/feed-core.ts`
- `pnpm gate:function --file apps/meerkat-web/src/lib/feed-core.ts`
- `git diff --check`
- Browser smoke: Vite served `http://localhost:5175/`; app title loaded as "Meerkat web". The only console error was an unrelated missing `/favicon.ico`.

## Handoff

Prompt 06 should build the friends graph and private messages. Feed integration should remain private-mode only for DMs, and no DM should appear in a public feed mode.
