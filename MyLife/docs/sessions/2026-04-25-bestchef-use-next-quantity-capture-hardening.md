# BestChef Use-Next Quantity and Capture Hardening

Date: 2026-04-25

## Summary

- Made use-next recipe prompts quantity-aware at the expiring batch level.
- Added prompt status for `ready_to_cook`, `needs_more`, and `check_units` so insufficient or ambiguous expiring quantities do not imply a recipe is ready.
- Updated the Kitchen prompt UI to show which expiring batches drive a prompt and whether those quantities are enough.
- Added Pantry empty and filter-empty actions that route to receipt import, grocery lists, recipe creation, or filter clearing.
- Added receipt review correction controls for item name, quantity, unit, expiration date, lot, candidate rejection, and merge into an existing pantry item.
- Hardened expiration OCR provider failures to return an empty review result instead of throwing.
- Added deterministic fixtures for insufficient quantity, compatible unit conversion, ambiguous units, provider outage, cancellation before confirmation, and receipt edit/merge corrections.

## Files

- `modules/bestchef/src/grocery/units.ts`
- `modules/bestchef/src/types.ts`
- `modules/bestchef/src/pantry/matching.ts`
- `modules/bestchef/src/pantry/expiration.ts`
- `modules/bestchef/src/db/pantry.ts`
- `modules/bestchef/src/db/__tests__/pantry.test.ts`
- `modules/bestchef/src/pantry/__tests__/expiration.test.ts`
- `modules/bestchef/src/pantry/__tests__/food-recognition.test.ts`
- `apps/bestchef/app/(root)/(tabs)/kitchen.tsx`
- `apps/bestchef/app/(root)/pantry.tsx`
- `apps/bestchef/app/(root)/kitchen-receipt-review.tsx`
- `apps/bestchef/app/(root)/data/__tests__/kitchen.test.ts`
- `docs/plans/features/recipes/bestchef-kitchen-intelligence-feature-bug-backlog.md`

## Verification

- Focused module tests passed: `pnpm --filter @mylife/bestchef test -- src/db/__tests__/pantry.test.ts src/pantry/__tests__/expiration.test.ts src/pantry/__tests__/food-recognition.test.ts`
- Focused app tests passed after quoting route-group paths: `pnpm --filter @mylife/bestchef-app test -- 'app/(root)/data/__tests__/kitchen.test.ts' 'app/(root)/__tests__/uiux-interaction-contract.test.ts'`
- `pnpm --filter @mylife/bestchef-app test:uiux` passed: 1 file, 6 tests.
- `pnpm --filter @mylife/bestchef-app test` passed: 5 files, 37 tests.
- `pnpm --filter @mylife/bestchef-app typecheck` passed.
- `pnpm --filter @mylife/bestchef test` passed: 45 files, 668 tests.
- `pnpm gate:function:changed` passed across the current dirty worktree. It included BestChef app typecheck plus focused app tests, `@mylife/bestchef` typecheck plus 108 focused tests, and unrelated changed package gates already present in the worktree. Mobile and web lint emitted existing warning-only debt with 0 errors.
- `pnpm check:parity --quiet` passed. Module parity reported the existing standalone-presence warnings for apps not present in the repo.

## Notes

- `errors_log.md` was not updated because no real build, test, typecheck, gate, or parity failure occurred. The only failed command was a zsh quoting issue before Vitest started.
