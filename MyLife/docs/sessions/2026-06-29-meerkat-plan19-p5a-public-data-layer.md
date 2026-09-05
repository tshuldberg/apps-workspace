# Meerkat Plan 19 P5a — Public Social Layer mobile DATA layer

Date: 2026-06-29
Branch: `feature/meerkat-public-social`
Plan: `docs/plans/active/19-meerkat-public-social-layer.md` (P5 step 1 + step 2 partial; sections 4.1, 6)

## Scope (this task)
Half of P5: the DATA layer only (feed un-gate + public schema + directory probe service + tests). The Discover/Reader UI is P5b. No screens built here.

## What shipped

### 1. Honest Feed `public` un-gate (mobile + web feed-core, byte-parity core)
- `normalizeFeedControls(controls, publicSourcesAvailable)` now respects the caller's `public` control only when a real source is available; default stays off (opt-in).
- `EvaluateFeedInput.publicSource?: { configured; respondedAt: string|null; entries: VerifiedPublicEntry[] }`.
- `publicSourcesAvailable = !!configured && respondedAt !== null && entries.length > 0` (TC-5: responded-but-empty stays false + hidden).
- `VISIBLE_FEED_CONTROLS` kept as a back-compat base constant; new `getVisibleFeedControls(publicSourcesAvailable)` adds `'public'` only when available. Consumers updated: `apps/meerkat/app/(root)/(tabs)/index.tsx`, `apps/meerkat-web/src/ui/feed/FeedView.tsx`.
- New `FeedItemKind` value `'public'` (+ `KIND_RANK.public = 100`, lowest), new `FeedItem.public?: VerifiedPublicEntry`, `buildPublicFeedItem` carries the entry's real numbers and a `public` audience rule (`createAudienceRule({ type: 'public' })`). Public items built ONLY from verified entries; excluded-source honesty line stays when there are no public items.
- Mobile/web feed-core core logic confirmed byte-identical from `export type FeedControlKey` onward (only import blocks differ, pre-existing).

### 2. SQLite schema (4 tables, byte-identical mobile `community-core.ts` COMMUNITY_DDL + web `schema.ts`)
`cm_publications`, `cm_public_reports`, `cm_public_directory_cache`, `cm_public_feed_cursor` (exact columns per plan section 4.1). The two cache tables are device_local (sync policy already caps them from P0).

### 3. Directory probe service (NEW, mobile + web twin)
`apps/meerkat/app/(root)/data/public-directory-client.ts` (+ `apps/meerkat-web/src/lib/public-directory-client.ts`):
- `VerifiedPublicEntry` mirrors the cache columns.
- `probePublicDirectory(db, { category?, searchTerms?, webSocketImpl?, now?, browseFn?, searchFn? })`: reads `PUBLIC_DIRECTORY_URL_SETTING`; no URL → `{ configured:false }`; calls `browsePublications`/`searchPublications` from `@mylife/sync` (no category/terms → unions across the 9-category taxonomy); maps each verified `DirectoryEntry` → `VerifiedPublicEntry` with REAL `announcing_hosts = entry.announcingHosts` (never 0), `event_count = entry.eventCount` (0 in P2), `latest_wall = descriptor.updatedAt`; INSERT OR REPLACE into `cm_public_directory_cache` (verified=1); network failure → `{ configured:true, respondedAt:null, entries:[] }`.
- `getDirectoryCacheEntries(db, category?)` reads `verified=1` rows ordered by `latest_wall DESC`.

### 4. Setting key
`PUBLIC_DIRECTORY_URL_SETTING = 'public_directory_url'` added to `apps/meerkat/app/(root)/data/sync-core.ts` (next to `RELAY_URL_SETTING_KEY`) and mirrored in `apps/meerkat-web/src/lib/meerkat-data.ts`. Empty/unset by design (honesty).

## Tests (TDD, written first)
Extended `apps/meerkat/app/__tests__/feed-core.test.ts`: +4 feed public-source cases (no source / responded+verified / responded-empty TC-5 / unreachable) and +4 probe-service cases (no-URL, upsert with real announcing_hosts + event_count=0, responded-empty, network failure). feed-core file: 13 tests total.

## Gates (all green)
- `pnpm --filter @mylife/meerkat-app test` — 183 tests pass (23 files)
- `pnpm --filter @mylife/meerkat-app typecheck` — clean
- `pnpm --filter @mylife/meerkat-web typecheck` — clean
- `pnpm --filter @mylife/meerkat-web test` — 72 tests pass (parity test `post-schema-v2-parity` green)
- `node scripts/check-meerkat-parity.mjs` — all checks pass
- `pnpm gate:function:changed` — EXIT 0

## Notes / seams for P5b/P6
- The `@mylife/sync` directory functions (`browsePublications`, `searchPublications`, `lookupPublicationHosts`, `DirectoryEntry`) are reachable from the barrel via `export * from './node'` — no barrel edit was needed.
- `VerifiedPublicEntry` is defined in `public-directory-client.ts` (mobile + web). The web twin client was built in this task (not just the mobile one) so the byte-parity feed-core import target exists and web typecheck stays green; it also pre-stages P6.
- The mobile Feed screen `HonestNotice` copy ("Public control is hidden until a real public hosted source exists") was intentionally left unchanged: it is accurate while no source is configured, and flipping it requires a deployed directory (P5b/P6 + ops). Refine in P5b when the Discover UI lands.
