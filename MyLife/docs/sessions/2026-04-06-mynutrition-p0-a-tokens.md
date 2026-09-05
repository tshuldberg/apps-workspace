# MyNutrition P0-A Tokens And Typography

Date: 2026-04-06

## Summary

Completed `P0-A` from `docs/plans/mynutrition-uiux-mission-control.html`:

- added MyNutrition-scoped typography constants for Plus Jakarta Sans
- added dual-accent Obsidian Noir nutrition tokens and source badge metadata
- added a `MaterialSymbol` bridge for the design icon set
- re-exported the UI surface through `modules/nutrition/src/ui/index.ts` and `modules/nutrition/src/index.ts`
- updated the nutrition package TS/Vitest config so `.tsx` UI exports typecheck inside the module package

## Files Changed

- `modules/nutrition/package.json`
- `modules/nutrition/tsconfig.json`
- `modules/nutrition/vitest.config.ts`
- `modules/nutrition/src/index.ts`
- `modules/nutrition/src/ui/typography.ts`
- `modules/nutrition/src/ui/tokens.ts`
- `modules/nutrition/src/ui/index.ts`
- `modules/nutrition/src/ui/components/MaterialSymbol.tsx`

## Verification

- `pnpm --filter @mylife/nutrition typecheck`

## Notes

- `@expo-google-fonts/plus-jakarta-sans` was already present in `apps/mobile/package.json`, so no mobile dependency edit was required.
- The icon mapping covers the Phase 0 and Phase 1 design symbol set, including meal icons and the nutrition-specific semantic icons.
