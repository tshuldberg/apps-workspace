# MyWorkouts UIUX Phase 3 — Exercise Library, Programs, Generator

**Date:** 2026-04-06
**Scope:** P3-A through P3-D
**Plan:** [docs/plans/myworkouts-uiux-mission-control.html](/Users/trey/Desktop/Apps/MyLife/docs/plans/myworkouts-uiux-mission-control.html)
**Theme:** Cool Obsidian + MyWorkouts amber (#C9894D)

## Phase Summary

Completed Phase 3 of the MyWorkouts mobile UIUX mission control. The workouts surface now includes the redesigned exercise library, a full exercise detail route, richer program create/detail flows, and a 4-step AI workout generator, all aligned to the new glass chrome established in Phases 0 through 2.

## Files Touched

| Area | File | Notes |
|------|------|-------|
| Shared helpers | `apps/mobile/lib/workouts/phase3.ts` | Phase 3 formatting, gradients, inferred equipment, and program summary helpers |
| Shared persistence | `apps/mobile/lib/workouts/settings.ts` | Favorite exercises + per-program cover image storage in `hub_settings` |
| Shared UI | `apps/mobile/app/(workouts)/phase3-kit.tsx` | Route header, sticky action bar, exercise artwork, difficulty stars |
| Exercise library | `apps/mobile/app/(workouts)/exercises.tsx` | Search, category/muscle rails, filter sheet, hero card, and exercise grid |
| Exercise detail | `apps/mobile/app/(workouts)/exercise/[id].tsx` | Hero, stats, videos, instructions, body map, history chart, Add to Workout flow |
| Builder integration | `apps/mobile/app/(workouts)/builder.tsx` | Supports `exerciseId` deep links and existing `focus` param prefill |
| Program create | `apps/mobile/app/(workouts)/program/create.tsx` | Name/description, cover picker, week/day builder, assignment modal |
| Program create alias | `apps/mobile/app/(workouts)/program/new.tsx` | Route alias for the Phase 3 path contract |
| Program detail | `apps/mobile/app/(workouts)/program/[id].tsx` | Hero, progress, subscribe/unsubscribe, collapsible weeks, sticky CTA |
| AI generator | `apps/mobile/app/(workouts)/generate.tsx` | Goal -> equipment -> duration -> preview wizard |
| AI generator alias | `apps/mobile/app/(workouts)/ai-workout.tsx` | Legacy route now re-exports the generator screen |
| Icon support | `modules/workouts/src/ui/components/MaterialSymbol.tsx` | Added symbols needed by the Phase 3 surfaces |
| Mission control | `docs/plans/myworkouts-uiux-mission-control.html` | Marked P3-A through P3-D complete |
| Verification fixes | `apps/mobile/app/(workouts)/gps.tsx` | Added missing SVG `Rect` import and fixed spacing token to unblock mobile typecheck |
| Verification fixes | `apps/mobile/app/(workouts)/watch.tsx` | Fixed spacing token to unblock mobile typecheck |

## Screen Outcomes

### P3-A — Exercise Library
- Rebuilt the library around a custom route header, debounced search, category and muscle rails, a filter sheet, and a featured recent exercise hero
- Added two-column exercise cards with artwork, difficulty stars, inferred equipment, and favorite state
- Wired recent-view persistence and pull-to-refresh

### P3-B — Exercise Detail
- Added a full exercise page with hero artwork, stat chips, favorite/share actions, video modal, instructions, muscle highlight preview, and load-history chart
- Added workout picker actions that can create a new builder draft or inject the exercise into an existing workout draft

### P3-C — Program Detail + Create
- Rebuilt program detail with a cover hero, active subscription card, progress, collapsible weekly schedule, and sticky subscribe/continue CTA
- Rebuilt create-program with steppers, cover selection, per-week assignment, rest-day toggles, and validation before save
- Stored cover art in `hub_settings` instead of adding a new schema table

### P3-D — AI Workout Generator
- Replaced the old generator with a 4-step wizard for goal, equipment, duration, and preview
- Saved generated workouts into the local workout library and marked accepted generations in the existing generation log

## Data / Persistence Notes

- Program cover images use `hub_settings` keys rather than a new workouts schema table.
- Favorite exercises also persist in `hub_settings`.
- Builder deep-linking now supports `exerciseId` without requiring a separate staging screen.

## Verification

- `pnpm --filter @mylife/workouts typecheck` — passed
- `pnpm --filter @mylife/mobile typecheck` — passed
- `pnpm --dir apps/mobile exec eslint 'app/(workouts)/builder.tsx' 'app/(workouts)/exercise/[id].tsx' 'app/(workouts)/exercises.tsx' 'app/(workouts)/generate.tsx' 'app/(workouts)/program/[id].tsx' 'app/(workouts)/program/create.tsx' 'app/(workouts)/program/new.tsx' 'app/(workouts)/ai-workout.tsx' 'app/(workouts)/phase3-kit.tsx' 'app/(workouts)/gps.tsx' 'app/(workouts)/watch.tsx' 'lib/workouts/phase3.ts' 'lib/workouts/settings.ts'` — passed
- `pnpm --filter @mylife/mobile exec vitest run 'app/(workouts)/__tests__/index.test.tsx'` — passed
- `pnpm gate:function:changed` — attempted per repo policy; it expanded to the full dirty mobile worktree, completed lint and typecheck, then exited during the repo-wide mobile test sweep with a generic lifecycle failure unrelated to the Phase 3 files
- `pnpm check:workouts-parity` — not run; no schema or standalone/hub parity rules changed in this session

## Remaining

MyWorkouts Phase 3 is now complete in mission control. Remaining work in the plan:
- Phase 4 calculators and social
- Phase 5 advanced surfaces
- Phase 6 web parity
