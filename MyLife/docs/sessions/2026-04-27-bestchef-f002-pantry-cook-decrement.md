# 2026-04-27 - BestChef F-002 Pantry Cook Decrement

## Completed

- Completed `apps/bestchef/Tickets/F-002-pantry-decrement-when-recipe-cooked.md`.
- Added `rc_recipe_cook_history` schema V19, indexes, personal-replica sync scope, and exported cook-history/review/apply types.
- Added shared cooking APIs for pantry review, best-effort unit conversion, batch-aware decrement apply, unmatched ingredient add-to-pantry, and timestamped cook history.
- Wired saved recipe detail with **I cooked this**, a review sheet for every ingredient, editable decrement quantity/unit fields, one-tap **Add to Pantry**, apply confirmation, and last-cooked display.
- Added focused module and app data tests for conversion, pantry mutation, unmatched ingredient add, and history persistence.

## Verification

- `pnpm --filter @mylife/bestchef exec vitest run src/db/__tests__/cooking.test.ts`
- `pnpm --filter @mylife/bestchef-app exec vitest run 'app/(root)/data/__tests__/kitchen.test.ts'`
- `pnpm --filter @mylife/bestchef exec tsc --noEmit --pretty false`
- `pnpm --filter @mylife/bestchef-app exec tsc --noEmit --pretty false`
- `pnpm --filter @mylife/bestchef test`
- `pnpm gate:function:changed`

## Notes

- Saved recipe cook review defaults to one cooked recipe; callers can pass a multiplier through the `servings` field for double batches.
- Public submission CookProof pantry decrement remains outside this local F-002 path because public submissions are not guaranteed to exist as saved `rc_recipes` rows.
