# BestChef Phase 2 Nutrition Provenance Hardening - 2026-04-25

## Summary

Completed Phase 2 of the BestChef Kitchen Intelligence mission-control plan by closing the remaining data-foundation gap around reusable user-corrected serving and unit conversions. Phase 2 now has canonical product and nutrition provenance support, resolver coverage, and persisted conversion corrections that recipe and dish nutrition can reuse locally.

## What Changed

- Added schema v17 with `rc_unit_conversion_corrections`, lookup and uniqueness indexes, and a personal-replica sync policy cap.
- Added `modules/bestchef/src/db/unit-conversions.ts` with create, upsert, read, list, reuse, and delete helpers for normalized ingredient/unit conversion corrections.
- Wired recipe nutrition aggregation to load persisted reusable conversion corrections before resolving ingredient nutrition scale.
- Exported the new correction helpers from the BestChef module barrel.
- Updated schema-version assertions and nutrition tests to cover persisted correction normalization, upsert reuse, and recipe nutrition reuse.
- Updated the Kitchen Intelligence mission-control and backlog docs so Phase 2 reflects the persisted reusable conversion foundation.
- Updated `memory.md` with schema v17 and this session log.

## Files Changed

- `modules/bestchef/src/db/schema.ts`
- `modules/bestchef/src/db/unit-conversions.ts`
- `modules/bestchef/src/nutrition/recipe-nutrition.ts`
- `modules/bestchef/src/definition.ts`
- `modules/bestchef/src/index.ts`
- `modules/bestchef/src/db/__tests__/nutrition.test.ts`
- `modules/bestchef/src/db/__tests__/pantry.test.ts`
- `modules/bestchef/src/social/__tests__/follower-updates.test.ts`
- `modules/bestchef/src/nutrition/__tests__/recipe-nutrition.test.ts`
- `docs/plans/bestchef-kitchen-intelligence-mission-control.html`
- `docs/plans/features/recipes/bestchef-kitchen-intelligence-feature-bug-backlog.md`
- `memory.md`

## Verification

- `pnpm --filter @mylife/bestchef exec vitest run src/db/__tests__/nutrition.test.ts src/nutrition/__tests__/recipe-nutrition.test.ts src/grocery/__tests__/units.test.ts` passed, 59 tests.
- `pnpm --filter @mylife/bestchef typecheck` passed.
- `pnpm --filter @mylife/bestchef test` passed, 688 tests.
- `pnpm --filter @mylife/bestchef-app test:uiux` passed, 19 tests.
- `pnpm --filter @mylife/bestchef-app test` passed, 51 tests.
- `pnpm --filter @mylife/bestchef-app typecheck` passed.
- `pnpm gate:function:changed` passed across the current dirty worktree. Mobile and web lint still report existing warning-only debt, with zero errors.
- `pnpm check:parity --quiet` passed with existing non-fatal standalone tracking warnings.

## Decisions

- Conversion corrections sync as personal kitchen data only. The conversion factors can reflect a user's local products and cooking habits, so they should not escalate to shared workspace scope by default.
- The persisted correction path stays local-first and does not add external analytics or telemetry.
- No `errors_log.md` row was added because the work produced no real test, build, typecheck, gate, parity, runtime, or workflow failure.
