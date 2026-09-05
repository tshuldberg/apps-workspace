# MyNutrition Phase 4 Mobile

Date: 2026-04-06
Plan: `docs/plans/mynutrition-uiux-mission-control.html` (Phase 4)
Scope: `P4-A` goals + TDEE wizard and `P4-B` settings + export

## Summary

Completed Phase 4 from `docs/plans/mynutrition-uiux-mission-control.html` for the MyNutrition mobile surface:

1. Rebuilt `goals.tsx` into the full goals flow with goal-direction tiles, live TDEE calculations, calorie-target apply flow, macro presets, custom macro overrides, fiber and water targets, and goal-date guidance.
2. Added `modules/nutrition/src/engine/tdee.ts` with pure calorie and macro helpers, unit conversions, and tests, then re-exported the engine from the nutrition package.
3. Rebuilt `apps/mobile/app/(nutrition)/(tabs)/settings.tsx` into grouped glass sections for account, goals, units, preferences, privacy, data, integrations, and about.
4. Rebuilt `export.tsx` with preset and custom date ranges, format toggles, included-data checklists, preview stats, and real file generation plus share-sheet export.
5. Updated mission-control to mark `P4-A` and `P4-B` done and advanced MyNutrition's tracked state in `memory.md`.

## Delivered

### P4-A Goals + TDEE Wizard

- Added a full TDEE workflow on `apps/mobile/app/(nutrition)/goals.tsx` with weight, height, age, sex, activity, and goal-direction inputs.
- Computes BMR, TDEE, daily calorie targets, and macro grams live from the new nutrition engine.
- Supports preset macro splits, auto-balancing percentage edits, optional custom gram overrides, and save-to-goal persistence through the existing nutrition goal APIs.
- Extended `calculateBMR` in `modules/nutrition/src/sync/energy-balance.ts` so the new engine can share the existing Mifflin-St Jeor implementation cleanly.

### P4-B Settings + Export

- Rebuilt `apps/mobile/app/(nutrition)/(tabs)/settings.tsx` into grouped configuration cards with profile, units, meal-preference, privacy, reset, export, and restaurant entry points.
- Rebuilt `apps/mobile/app/(nutrition)/export.tsx` into a multi-format export flow with section selection and live preview metadata.
- CSV and JSON exports write real files. The `pdf` option currently generates printable HTML and shares the `.html` file in this build.

## Files Changed

- `apps/mobile/app/(nutrition)/goals.tsx`
- `apps/mobile/app/(nutrition)/(tabs)/settings.tsx`
- `apps/mobile/app/(nutrition)/export.tsx`
- `modules/nutrition/src/engine/tdee.ts`
- `modules/nutrition/src/engine/index.ts`
- `modules/nutrition/src/index.ts`
- `modules/nutrition/src/sync/energy-balance.ts`
- `modules/nutrition/src/__tests__/tdee.test.ts`
- `modules/nutrition/src/__tests__/schema.test.ts`
- `modules/nutrition/src/ui/components/MaterialSymbol.tsx`
- `docs/plans/mynutrition-uiux-mission-control.html`
- `docs/sessions/2026-04-06-mynutrition-phase-4.md`
- `docs/archives/memory-sessions-2026-04-06-uiux-batch-b.md`
- `memory.md`

## Verification

- `pnpm --filter @mylife/nutrition test`
  - PASS, 17 test files and 189 tests passed
- `pnpm --filter @mylife/mobile exec tsc --noEmit 2>&1 | rg "app/\\(nutrition\\)/(goals|export|\\(tabs\\)/settings)\\.tsx"`
  - no matching TypeScript errors for the changed Phase 4 screens
- `pnpm --filter @mylife/mobile typecheck`
  - blocked by pre-existing errors outside this Phase 4 slice, including `app/(nutrition)/(tabs)/diary.tsx`, `app/(nutrition)/food/[id].tsx`, `app/(nutrition)/log.tsx`, `app/(nutrition)/scan.tsx`, and unrelated `trails` files
- `pnpm gate:function:changed`
  - ran per repo policy
  - failed in the shared mobile typecheck step on the same pre-existing errors outside the changed Phase 4 files

## Notes

- `modules/nutrition/src/__tests__/schema.test.ts` had to be updated to current module reality while adding the new TDEE coverage: schema version `8`, first tab `home`, and `17` navigation screens.
- The export screen uses `expo-file-system/legacy` and `expo-sharing` so users get a real shareable file rather than a copied string blob.
- Phase 5 web parity remains open.
