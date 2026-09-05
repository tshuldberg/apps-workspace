# 2026-04-27 BestChef F-003 Pantry Availability

## Summary

Completed `apps/bestchef/Tickets/F-003-recipe-show-pantry-availability.md`.

## Changes

- Added recipe ingredient availability helpers in `apps/bestchef/app/(root)/data/kitchen.ts` for saved recipes and ad hoc community recipe ingredient lists.
- Availability now marks rows as `in-pantry`, `low`, `expired`, or `missing` using best-effort pantry name matching, compatible-unit quantity comparison, and batch expiration checks.
- Added `addIngredientAvailabilityRowsToGroceryList` so low, expired, and missing rows can be inserted into a chosen grocery list without adding already-covered ingredients.
- Updated saved recipe detail and community recipe detail screens with on-hand summaries, per-row badges, and inline grocery list pickers for missing ingredients.
- Added Vitest coverage for saved recipe availability, expired pantry treatment, low quantity treatment, missing-to-grocery insertion, and empty-pantry fallback.

## Verification

- `pnpm --filter @mylife/bestchef-app exec vitest run 'app/(root)/data/__tests__/kitchen.test.ts'`
- `pnpm --filter @mylife/bestchef-app exec tsc --noEmit --pretty false`
- `pnpm --filter @mylife/bestchef-app test`
- `pnpm gate:function:changed`

## Notes

- The first app typecheck caught an optional `Ingredient.item` mismatch in the helper input type. The helper now accepts optional parsed ingredient fields and normalizes them to `null` at the row boundary.
- Next feature ticket is `apps/bestchef/Tickets/F-004-recipe-save-bookmark-to-kitchen.md`.
