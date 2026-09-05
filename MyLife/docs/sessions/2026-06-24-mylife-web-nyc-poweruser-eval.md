# Session: MyLife Web (Desktop) NYC Power-User Readiness Evaluation

**Date:** 2026-06-24
**Branch:** `feature/meerkat-prompt01-ia` (eval is incidental to this branch)
**Deliverable:** `docs/reports/REPORT-mylife-web-nyc-poweruser-eval-2026-06-24.md`

## What was asked
The user moved to NYC and wants to be the first power user, running their whole active life from one browser (the `apps/web` desktop surface): daily live music + events, guitar/music/salsa/language/basketball lessons, gym + workout routine, city walking, restaurant exploration + macro tracking, overall health, daily supplement (creatine) adherence, and secure cross-device data transfer via Meerkat. Asked for an evaluation of needs + how well the desktop/web version can manage them.

## Method
- Booted `pnpm --filter web dev` (localhost:3000), drove Playwright at desktop viewport (1440x900), probed HTTP status of every relevant route.
- Ran an 8-agent code-grounded Workflow (7 need-cluster analyses against `apps/web` + `modules/*` source, then a synthesis pass). ~1.0M subagent tokens, 183 tool calls.

## Headline result
Readiness **52/100**. Excellent chassis; five strong tracking surfaces (Workouts, Nutrition, Dining, Sports>Play, Lifelong). Two framed-as-the-point needs missing on web (live-music/events discovery; secure Meerkat sync). A third of drivers coded-but-hidden. No daily reminders on web by design.

## Bugs found during live testing
### 1. FIXED — `@mylife/ui` barrel leaks React Native into the web bundle
- `/nutrition` returned 500; Turbopack's shared graph cascaded → most routes 500 (only `/classes` survived).
- Root cause: `packages/ui/src/index.ts` re-exports every component (all import `react-native`); RN's `index.js` uses Flow syntax the web bundler can't parse. `@mylife/ui` has no `sideEffects:false`, so importing even a pure value (`fontStacks`) drags the whole RN barrel in. `next.config.ts` documents the intended rule ("barrel exports only design tokens, no RN") — violated.
- Fix (web-only, isolated): repointed 3 importers to pure submodules:
  - `apps/web/app/nutrition/_lib/design.ts` → `@mylife/ui/src/tokens/typography`
  - `apps/web/app/garden/_lib/design.ts` → `@mylife/ui/src/tokens/typography`
  - `apps/web/app/nutrition/settings/page.tsx` → `@mylife/ui/src/constants/brand`
- Verified: routes 200; `pnpm --filter web typecheck` exit 0.
- Durable follow-up: add `sideEffects:false` to `packages/ui/package.json` and/or keep RN components out of the main barrel.

### 2. NOT FIXED — `@mylife/sync` barrel leaks Node `fs`
- `/settings/data-sync` 500s (production `next build` breaker). Client component imports runtime values from the `@mylife/sync` barrel, which re-exports `blob/blob-store.ts` (`import { promises as fs } from 'fs'`).
- Remedy (one file): repoint to `@mylife/sync/src/hooks` (`useSyncStatus`, `useSetSyncTier`) + `@mylife/sync/src/types` (`STORAGE_LIMITS`, `tierRequiresAuth`, `isCloudTier`, `SyncTier`) — both fs/blob-free. Underlying screen is a non-functional mock regardless.

## Key findings (per need)
- **Events/live music:** Gap. Manhattan mobile-standalone + HIDDEN, no web route; engine exists (NYC Open Data needs no key).
- **Classes:** Blocked — no web semester creation; academic framing; Lifelong courses work for the language course.
- **Fitness:** Workouts Full; basketball via `/sports/play` real but hidden; city walking Partial (no web recording-create; Health steps gated out).
- **Dining/macros:** Dining Full (but hidden + map placeholder); Nutrition Full; the two don't join (`buildNutritionLogFromVisit` dead on web).
- **Health/supplements:** Health Blocked (missing from `WEB_SUPPORTED_MODULE_IDS`); Meds adherence Partial; reminders Gap (no web push).
- **Sync/Meerkat:** Gap. Mesh-sync screens are mocks; no SyncEngine instantiated; Meerkat separate app, own data only. Only real cross-device path = manual whole-DB `.sqlite` backup/restore.
- **Hub shell:** Full chassis; module roster half-unplugged (HIDDEN_MODULE_IDS + WEB_SUPPORTED_MODULE_IDS gating). Premium gating inert behind `_testMode=true` (flip → 9/10 drivers need Pro).

## Top recommendations
1. (S) Unhide dining/rsvp/sleep/sports; add `health` to `WEB_SUPPORTED_MODULE_IDS`.
2. (S) Wire `createSemester` into Classes web.
3. (S) Fix the `@mylife/sync` web 500 (repoint data-sync imports).
4. (M) Make Meds a real supplement tracker (time-of-day, populate due-today, decrement supply).
5. (M) In-tab reminder layer (service worker + Notification) for open-hub nudges.
6. (M) Connect Dining→Nutrition + real dining map/geocoding.
7. (L) Manhattan web Discover route (NYC Open Data first).
8. (L) Real `@mylife/sync` web wiring (SyncEngine + X25519/SAS pairing), then Meerkat.

## Files changed
- `apps/web/app/nutrition/_lib/design.ts`, `apps/web/app/garden/_lib/design.ts`, `apps/web/app/nutrition/settings/page.tsx` (import repoints — the fix)
- `errors_log.md` (2 rows), `docs/reports/REPORT-mylife-web-nyc-poweruser-eval-2026-06-24.md` (new), `memory.md` (session row)

## Notes / not done
- Did not commit/push automatically (eval on an unrelated meerkat branch — left for user to place on the right branch).
- Did not unhide modules or fix the sync 500 (product-gating + separate package decisions surfaced to user).
- Dev server may be left in a poisoned Turbopack state after probing `/settings/data-sync`; a restart clears it.
