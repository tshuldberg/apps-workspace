# MyHabits Phase 6: Stacking + Programs

**Date:** 2026-04-07  
**Scope:** Complete Phase 6 from `docs/plans/myhabits-uiux-mission-control.html` covering P6-A and P6-B.

## What shipped

- Rebuilt [`apps/mobile/app/(habits)/stacking.tsx`](/Users/trey/Desktop/Apps/MyLife/apps/mobile/app/(habits)/stacking.tsx) into a Plus Jakarta Sans, violet-accent stacking surface with:
  - hero explainer and stack metrics
  - editable chain cards that deep-link into habit detail
  - modal stack planner with anchor selection, add/remove steps, and `react-native-draggable-flatlist` reorder
  - suggestion cards and stack analytics summaries
- Rebuilt [`apps/mobile/app/(habits)/programs.tsx`](/Users/trey/Desktop/Apps/MyLife/apps/mobile/app/(habits)/programs.tsx) into a 3-tab challenges surface with:
  - featured hero program
  - Active / Browse / Completed segmentation
  - duration, difficulty, and focus-area filters
  - cover art rendered through `expo-image`
- Rebuilt [`apps/mobile/app/(habits)/program-detail.tsx`](/Users/trey/Desktop/Apps/MyLife/apps/mobile/app/(habits)/program-detail.tsx) with:
  - cover hero and share action
  - progress summary cards
  - collapsible day-by-day schedule
  - benefits/science and expected-outcomes sections
  - enroll, continue, and confirmed unenroll flows
- Added shared program-cover helpers in [`apps/mobile/app/(habits)/programs-ui.ts`](/Users/trey/Desktop/Apps/MyLife/apps/mobile/app/(habits)/programs-ui.ts).
- Extended `@mylife/habits` Phase 6 APIs so the screens are not doing ad hoc DB work:
  - [`modules/habits/src/db/stacking.ts`](/Users/trey/Desktop/Apps/MyLife/modules/habits/src/db/stacking.ts)
  - [`modules/habits/src/stacking/engine.ts`](/Users/trey/Desktop/Apps/MyLife/modules/habits/src/stacking/engine.ts)
  - [`modules/habits/src/db/challenges.ts`](/Users/trey/Desktop/Apps/MyLife/modules/habits/src/db/challenges.ts)
  - [`modules/habits/src/challenges/engine.ts`](/Users/trey/Desktop/Apps/MyLife/modules/habits/src/challenges/engine.ts)
  - [`modules/habits/src/db/index.ts`](/Users/trey/Desktop/Apps/MyLife/modules/habits/src/db/index.ts)
  - [`modules/habits/src/index.ts`](/Users/trey/Desktop/Apps/MyLife/modules/habits/src/index.ts)
- Added focused integration coverage for the new workflows in [`modules/habits/src/__tests__/phase6-workflows.test.ts`](/Users/trey/Desktop/Apps/MyLife/modules/habits/src/__tests__/phase6-workflows.test.ts).
- Marked P6-A and P6-B done in [`docs/plans/myhabits-uiux-mission-control.html`](/Users/trey/Desktop/Apps/MyLife/docs/plans/myhabits-uiux-mission-control.html).

## Data / UX decisions

- Stack persistence uses the existing `hb_habit_links` table and derives full chains from pairwise links rather than adding a new stack table.
- Program enrollment now seeds built-in programs into `hb_programs` on demand so enrollments satisfy the existing foreign key.
- Enrolling in a program creates or reuses habits where possible, then groups progress by `program_id` to drive Active and Completed tabs.
- Program cover art is generated as SVG data URIs, which keeps the new `expo-image` usage offline-safe and deterministic.

## Verification

- `pnpm --filter @mylife/habits typecheck` ✅
- `pnpm --filter @mylife/habits test` ✅ 21 files / 316 tests
- `pnpm --dir apps/mobile exec eslint 'app/(habits)/stacking.tsx' 'app/(habits)/programs.tsx' 'app/(habits)/program-detail.tsx' 'app/(habits)/programs-ui.ts'` ✅
- `pnpm --filter @mylife/mobile typecheck` ⚠️ failed in unrelated Budget and pre-existing Habits files, not in the new Phase 6 files. Reported blockers included Budget onboarding/splitting and older Habits `[id].tsx` / `add-habit.tsx` issues.
- `pnpm gate:function:changed` ⚠️ failed in the dirty mobile sweep outside this Phase 6 work. The gate stopped on unrelated Budget errors plus pre-existing Habits route issues.
- `pnpm --filter @mylife/mobile exec vitest run 'app/(habits)/__tests__/index.test.tsx'` ⚠️ did not produce a result within the wait window, so it was not used as a verification signal.

## Remaining

- MyHabits Phase 1, Phase 3, and Phase 7 onward are still pending in the mission-control plan.
- The existing mobile typecheck/gate noise needs a separate cleanup pass before repo-wide mobile verification can go green.
