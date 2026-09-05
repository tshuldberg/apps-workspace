# MyWorkouts Phase 0 Foundation

Date: 2026-04-06

## Summary

Completed Phase 0 of `docs/plans/myworkouts-uiux-mission-control.html` sequentially:

1. P0-A: Added MyWorkouts-scoped typography, tokens, and icon abstraction.
2. P0-B: Converted the mobile module shell to a gated 5-tab bottom navigator.
3. P0-C: Added the shared UI primitives and matching unit coverage.

The mission-control tracker was updated to mark `P0-A`, `P0-B`, and `P0-C` as done by default.

## What Changed

### P0-A foundation

- Added `modules/workouts/src/ui/typography.ts` with Plus Jakarta Sans font constants.
- Added `modules/workouts/src/ui/tokens.ts` with:
  - dual accent setup (`WK_ACCENT` gold chrome + hypertrophy/cardio/recovery category colors)
  - surface tiers
  - glass tokens
  - typography presets
  - category color helper
- Added `modules/workouts/src/ui/components/MaterialSymbol.tsx` to normalize design icon names to runtime icons.
- Re-exported the new UI surface through `modules/workouts/src/ui/index.ts` and `modules/workouts/src/index.ts`.
- Updated `apps/mobile/app/(workouts)/_layout.tsx` to:
  - load Plus Jakarta Sans at the module layout level
  - gate rendering on fonts loaded
  - wrap the module in `ModuleLockGuard`

### P0-B tab restructure

- Moved the 5 primary tab screens into `apps/mobile/app/(workouts)/(tabs)/`:
  - `index.tsx`
  - `explore.tsx`
  - `workouts.tsx`
  - `progress.tsx`
  - `settings.tsx`
- Added `apps/mobile/app/(workouts)/(tabs)/_layout.tsx` with:
  - blurred glass tab bar
  - rounded top corners
  - gold active tint
  - MyWorkouts header chrome
  - MaterialSymbol tab icons
- Converted the root workouts layout to a `Stack` that hosts `(tabs)` plus the remaining detail/tool screens.
- Updated moved screen imports and the workouts mobile screen test import path.

### P0-C shared components

- Added these reusable components under `modules/workouts/src/ui/components/`:
  - `StatCard`
  - `BarChart`
  - `GlassPanel`
  - `ProgressRing`
  - `StartWorkoutFAB`
  - `Chip`
  - `SectionLabel`
  - `AsymmetricGrid`
- Added `modules/workouts/__tests__/ui.shared.test.tsx` covering:
  - StatCard label/value rendering
  - BarChart max-value helper and basic label render
- Updated `modules/workouts/vitest.config.ts` to include the new shared UI test file.
- Updated `modules/workouts/tsconfig.json` to use the React TS base.
- Updated `modules/workouts/package.json` and `pnpm-lock.yaml` so the module resolves RN UI peer/dev dependencies from its own package context.

## Verification

- `pnpm --filter @mylife/workouts typecheck`
- `pnpm --filter @mylife/workouts exec vitest run __tests__/ui.shared.test.tsx`
- `pnpm gate:function --file modules/workouts/src/ui/tokens.ts`
- `pnpm --filter @mylife/mobile typecheck 2>&1 | rg 'workouts|modules/workouts|app/\\(workouts\\)'`
  - no workouts-originating type errors remained

## Blockers / Residual Issues

- `pnpm gate:function:changed` does not pass for this workspace right now because of unrelated in-flight Presence errors:
  - `apps/mobile/app/(presence)/breathing-pause.tsx`: missing `react-native-reanimated`
  - `modules/presence/src/ui/components/MaterialSymbol.tsx`: duplicate object key
- Full app-level mobile typecheck is therefore still blocked outside MyWorkouts, even though the workouts-specific slice is clean.

## Files Changed

- `apps/mobile/app/(workouts)/_layout.tsx`
- `apps/mobile/app/(workouts)/(tabs)/_layout.tsx`
- `apps/mobile/app/(workouts)/(tabs)/index.tsx`
- `apps/mobile/app/(workouts)/(tabs)/explore.tsx`
- `apps/mobile/app/(workouts)/(tabs)/workouts.tsx`
- `apps/mobile/app/(workouts)/(tabs)/progress.tsx`
- `apps/mobile/app/(workouts)/(tabs)/settings.tsx`
- `apps/mobile/app/(workouts)/__tests__/index.test.tsx`
- `modules/workouts/src/ui/typography.ts`
- `modules/workouts/src/ui/tokens.ts`
- `modules/workouts/src/ui/index.ts`
- `modules/workouts/src/ui/components/MaterialSymbol.tsx`
- `modules/workouts/src/ui/components/StatCard.tsx`
- `modules/workouts/src/ui/components/BarChart.tsx`
- `modules/workouts/src/ui/components/GlassPanel.tsx`
- `modules/workouts/src/ui/components/ProgressRing.tsx`
- `modules/workouts/src/ui/components/StartWorkoutFAB.tsx`
- `modules/workouts/src/ui/components/Chip.tsx`
- `modules/workouts/src/ui/components/SectionLabel.tsx`
- `modules/workouts/src/ui/components/AsymmetricGrid.tsx`
- `modules/workouts/src/index.ts`
- `modules/workouts/package.json`
- `modules/workouts/tsconfig.json`
- `modules/workouts/vitest.config.ts`
- `modules/workouts/__tests__/ui.shared.test.tsx`
- `docs/plans/myworkouts-uiux-mission-control.html`
- `pnpm-lock.yaml`
