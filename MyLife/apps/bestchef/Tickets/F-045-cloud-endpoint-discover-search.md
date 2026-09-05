# Discover screen — wire fixture cards through cloud queries

## Summary

`app/(root)/discover.tsx` still imports `DEMO_DISHES` and `DEMO_CHEFS` directly to render the trending row, the cuisine count chips, and the chef-only filter results. It does not gate on `shouldShowDemoContent()`, so a public-launch build still renders fixture cards in the trending and chef sections.

The submission search path is already wired to `bc_submissions`; only the trending and "By Cuisine" / "By Chefs" sections need migration.

## Acceptance Criteria

1. [ ] Trending row reads from a cloud trending query (or `getTopDishes`/`getTrendingDishes`) instead of `DEMO_DISHES.slice(0, 8)`.
2. [ ] Cuisine card counts come from a cloud aggregate (or fall back to `0` with a graceful "no data yet" pill) rather than `DEMO_DISHES.filter(...)`.
3. [ ] Chef filter renders results from `searchChefs()` (already exported from `@mylife/bestchef`) instead of `DEMO_CHEFS.filter(...)`.
4. [ ] Loading skeleton, error retry, and empty state are present on each section.
5. [ ] All `DEMO_*` imports are removed from this file (or gated behind `__DEV__ && shouldUseDemoFixturesInDev()`).

## Source surface

- `app/(root)/discover.tsx` (lines 23, 40, 132, 192, 256, 277, 289, 357)

## Related

- Parent: F-044 (replace DEMO_* fixtures with live cloud content).
- Follow-up of P15-D.

## Severity

- [x] **Must have** — public launch readiness.

## Status

Closed for real 2026-07-11 (commit `3247fb2c`).

The original 2026-06-09 "Done" claim was INCORRECT. The cloud read paths did land on that date: `discover.tsx` resolves trending dishes, dish search, cuisine counts, and recipe-row visuals from the `bc_dishes` catalog via `app/(root)/data/cloud-dishes.ts` (`loadDishCatalog` / `loadTrendingDishes`, 5-minute shared cache), and chef results come from cloud `searchChefs()` via `mapChefProfileToRow`. But the adversarial production audit of 2026-07-10 (finding H16, `docs/reports/REPORT-bestchef-adversarial-production-audit-2026-07-10.md`) proved fixtures were still reachable in public builds across the discover/feed/recipe surfaces, so the "closed" state was false when written.

Genuinely closed 2026-07-11 in commit `3247fb2c`: every remaining `DEMO_*` / `SAMPLE_*` substitution in public builds was removed or gated behind `shouldUseDemoFixturesInDev()`, and the mechanical `check:no-ungated-fixtures` gate now scans all fixture usage sites for a demo-policy guard (polarity-aware) and is wired into `check:parity`, so an ungated fixture reappearing turns the gate red. Covered by `app/(root)/data/__tests__/cloud-dishes.test.ts` (cloud path, demo fallback, public-launch fail-closed).
