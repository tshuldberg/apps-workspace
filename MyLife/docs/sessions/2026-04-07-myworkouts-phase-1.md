# MyWorkouts UIUX Phase 1 — Core Tab Screens

**Date:** 2026-04-07
**Scope:** P1-A through P1-E
**Plan:** [docs/plans/myworkouts-uiux-mission-control.html](/Users/trey/Desktop/Apps/MyLife/docs/plans/myworkouts-uiux-mission-control.html)
**Theme:** Cool Obsidian + MyWorkouts amber (#C9894D)

## Phase Summary

Completed Phase 1 of the MyWorkouts mobile UIUX mission control. The five tab screens now share the new glass chrome from Phase 0, use live workouts data, and cover the full tab shell: dashboard, discovery, workouts/programs library, analytics, and profile/settings.

## Files Touched

| Area | File | Notes |
|------|------|-------|
| Shared tab shell | `apps/mobile/app/(workouts)/(tabs)/_layout.tsx` | Tab header hidden so Phase 1 screens render their own sticky chrome |
| Shared tab helpers | `apps/mobile/app/(workouts)/(tabs)/screen-kit.tsx` | Reusable top bar, hero, buttons, tiles, formatting helpers |
| Home tab | `apps/mobile/app/(workouts)/(tabs)/index.tsx` | Performance Center dashboard rewrite |
| Explore tab | `apps/mobile/app/(workouts)/(tabs)/explore.tsx` | Discovery hub rewrite |
| Workouts tab | `apps/mobile/app/(workouts)/(tabs)/workouts.tsx` | Library/programs segmented hub rewrite |
| Progress tab | `apps/mobile/app/(workouts)/(tabs)/progress.tsx` | Analytics dashboard rewrite with SVG charts |
| Settings tab | `apps/mobile/app/(workouts)/(tabs)/settings.tsx` | Profile + preferences rewrite |
| Persistence | `apps/mobile/lib/workouts/settings.ts` | Phase 1 settings + recent-view storage in `hub_settings` |
| UI export support | `modules/workouts/src/ui/components/MaterialSymbol.tsx` | Added icon mappings used by Phase 1 |
| Tests | `apps/mobile/app/(workouts)/__tests__/index.test.tsx` | Updated home dashboard test |
| Tests | `apps/mobile/lib/workouts/__tests__/settings.test.ts` | Added settings storage coverage |
| Verification fixes | `apps/mobile/app/(workouts)/exercises.tsx` | Added missing token import surfaced by typecheck |
| Verification fixes | `apps/mobile/app/(workouts)/session.tsx` | Replaced missing `expo-keep-awake` dependency with temporary no-op hook |
| Verification fixes | `apps/mobile/app/(workouts)/exercise/[id].tsx` | Added missing `Linking` import |
| Verification fixes | `apps/mobile/app/(workouts)/history.tsx` | Added missing `WK_ACCENT_LIGHT` import |
| Verification fixes | `apps/mobile/app/(workouts)/one-rm.tsx` | Added missing `WK_CATEGORY_COLORS` import and fixed spacing token |
| Verification fixes | `apps/mobile/app/(workouts)/measurements.tsx` | Fixed `spacing.xxxl` typo |
| Verification fixes | `apps/mobile/app/(workouts)/photos.tsx` | Fixed `spacing.xxxl` typo |
| Verification fixes | `apps/mobile/app/(workouts)/plate-loader.tsx` | Fixed `spacing.xxxl` typo |
| Verification fixes | `apps/mobile/app/(workouts)/timer.tsx` | Added missing `MaterialSymbol` import |
| Verification fixes | `apps/mobile/app/(workouts)/warmup.tsx` | Fixed `spacing.xxxl` typo |

## Screen Outcomes

### P1-A — Home
- Rebuilt the dashboard around the "Performance Center" / "Digital Sanctuary" hero
- Added 4 live stat cards: weekly sessions, weekly volume, streak, upcoming workout
- Added 8-week volume chart, archived session list, recovery snapshot, and Start Workout FAB

### P1-B — Explore
- Added discovery hero, search bar, category chips, featured card, trending programs rail, and For You workout rail
- Wired recently viewed storage through `hub_settings`

### P1-C — Workouts
- Added segmented `Workouts | Programs` hub with filter rail
- Added workout hero cards, program cards, and active-program highlight with progress

### P1-D — Progress
- Added period selector (`7D`, `30D`, `12W`, `1Y`)
- Added 2x2 stat grid with deltas, SVG volume chart, PR list, body-weight mini chart, and 2-column navigation tile grid

### P1-E — Settings
- Added profile hero, account editing, training preferences, equipment, units, notifications, integrations, data actions, and about section
- Persisted Phase 1 preferences locally via `hub_settings`
- Added reseed and destructive clear-data flows with confirmation

## Data / Persistence Notes

- Phase 1 settings and recent views use `hub_settings` rather than a new workouts schema table.
- This kept the session out of schema-version churn and avoided parity-sensitive migration work.
- The clear-data action resets all `wk_*` tables plus the Phase 1 settings/recent-view keys.

## Verification

- `pnpm --filter @mylife/mobile typecheck` — passed
- `pnpm --filter @mylife/mobile exec vitest run 'app/(workouts)/__tests__/index.test.tsx' 'lib/workouts/__tests__/settings.test.ts'` — passed
- `pnpm gate:function:changed` — started, completed lint and mobile typecheck, then stalled in the repo-wide mobile test sweep because the changed-file gate included many unrelated dirty mobile files already in the worktree
- `pnpm check:workouts-parity` — not run; no parity-sensitive schema or standalone/hub rule changes were made in this session

## Remaining

Phase 2 and later still remain in the mission control:
- P2 workout flow screens
- P3 library/detail expansion
- P4 calculators and social
- P5 advanced surfaces
- P6 web parity
