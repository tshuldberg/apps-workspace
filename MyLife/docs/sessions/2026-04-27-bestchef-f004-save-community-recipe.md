# 2026-04-27 BestChef F-004 Save Community Recipe

## Summary
- Completed `apps/bestchef/Tickets/F-004-recipe-save-bookmark-to-kitchen.md`.
- Added local Save/Saved controls on community submission detail, with confirm-to-remove and an Open saved recipe action.
- Added Kitchen save-state helpers that copy community title, description, ingredients, steps, hero media, and source-chef attribution into saved recipes.
- Made saved-state refresh tolerate local/demo routes that later resolve to a cloud submission id.
- Added saved recipe source attribution with a link back to the original submission.
- Bumped BestChef local schema to v20 for recipe source attribution fields and updated schema-version assertions.
- Kept duplicated saved recipes independent by clearing the unique source-submission marker on local duplicates.

## Files Changed
- `apps/bestchef/app/(root)/recipe/[id].tsx`
- `apps/bestchef/app/(root)/saved-recipe/[id].tsx`
- `apps/bestchef/app/(root)/data/kitchen.ts`
- `apps/bestchef/app/(root)/data/demo.ts`
- `apps/bestchef/app/(root)/data/local-submissions.ts`
- `apps/bestchef/app/(root)/data/cloud-submissions.ts`
- `apps/bestchef/app/(root)/data/__tests__/kitchen.test.ts`
- `modules/bestchef/src/types.ts`
- `modules/bestchef/src/db/schema.ts`
- `modules/bestchef/src/definition.ts`
- `modules/bestchef/src/db/crud.ts`
- `modules/bestchef/src/__tests__/recipes.test.ts`
- `modules/bestchef/src/print/__tests__/recipe-template.test.ts`
- `modules/bestchef/src/__tests__/vote-proof.test.ts`
- `modules/bestchef/src/db/__tests__/cooking.test.ts`
- `modules/bestchef/src/db/__tests__/nutrition.test.ts`
- `modules/bestchef/src/db/__tests__/pantry.test.ts`
- `modules/bestchef/src/social/__tests__/follower-updates.test.ts`

## Verification
- `pnpm --filter @mylife/bestchef exec tsc --noEmit --pretty false`
- `pnpm --filter @mylife/bestchef-app exec tsc --noEmit --pretty false`
- `pnpm --filter @mylife/bestchef exec vitest run src/__tests__/recipes.test.ts`
- `pnpm --filter @mylife/bestchef-app exec vitest run 'app/(root)/data/__tests__/kitchen.test.ts'`
- `pnpm --filter @mylife/bestchef exec vitest run --pool-options.threads.maxThreads=2 src/__tests__/recipes.test.ts src/__tests__/shopping-lists.test.ts src/__tests__/vote-proof.test.ts src/db/__tests__/nutrition.test.ts src/db/__tests__/pantry.test.ts src/db/__tests__/cooking.test.ts src/print/__tests__/recipe-template.test.ts src/social/__tests__/follower-updates.test.ts`
- `pnpm --filter @mylife/bestchef-app test`
- `pnpm gate:function:changed`

## Notes
- The first full BestChef app test run hit the known timing-sensitive function-gate slope check in `auth-links.function-gate.test.ts`; rerunning the package test passed.
- The first changed-function gate run exposed stale schema-version test assertions from the v20 bump; those are now updated and the gate passes.
