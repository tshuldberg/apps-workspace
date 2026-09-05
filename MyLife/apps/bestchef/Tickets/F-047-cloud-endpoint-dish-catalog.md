# Dish catalog — replace DEMO_DISHES seed list with cloud taxonomy

## Summary

The dish browser (`(tabs)/dishes.tsx`), dish picker in submit (`components/submit/steps/DishSelectionStep.tsx`), recipe detail dish lookup (`recipe/[id].tsx`), dish detail (`dish/[id].tsx`), chef detail (`chef/[id].tsx`), and cloud submission helper (`data/cloud-submissions.ts`) all read `DEMO_DISHES` from `data/demo.ts`. Most of these screens already gate display on `shouldShowDemoContent()`, but the dish catalog itself is fixture-bound: there is no cloud read path for "give me all dishes the user can browse or search".

`@mylife/bestchef` already exports `getAllDishes`, `searchDishes`, `getDishById`, `getDishBySlug` against the cloud `bc_dishes` table. We need to wire these into the surfaces above and seed the cloud table with at least the curated list currently in `DEMO_DISH_SEEDS`.

## Acceptance Criteria

1. [ ] `bc_dishes` is seeded with the curated dish list (one-time editorial seed via `EXPO_PUBLIC_BESTCHEF_SEED_CONTENT_*` provenance).
2. [ ] `(tabs)/dishes.tsx` reads from `searchDishes` / `getAllDishes` with loading + error + empty states.
3. [ ] `dish/[id].tsx` resolves the dish via `getDishById` / `getDishBySlug` and removes the `DEMO_DISHES.find` fallback in production.
4. [ ] `chef/[id].tsx` and `recipe/[id].tsx` resolve dish references through cloud lookups.
5. [ ] `cloud-submissions.ts` resolves dish slugs through `getDishBySlug` instead of the local `DEMO_DISHES` map.
6. [ ] `submit/steps/DishSelectionStep.tsx` reads from `searchDishes` with debounced server-side search.
7. [ ] All `DEMO_DISHES` imports removed from production code paths (or gated behind `shouldUseDemoFixturesInDev()`).

## Source surfaces

- `app/(root)/(tabs)/dishes.tsx`
- `app/(root)/components/submit/steps/DishSelectionStep.tsx`
- `app/(root)/dish/[id].tsx`
- `app/(root)/chef/[id].tsx`
- `app/(root)/recipe/[id].tsx`
- `app/(root)/data/cloud-submissions.ts`

## Related

- Parent: F-044.
- Depends on editorial seed approval flow already in place via `BestChefSeedContentApproval`.
- Follow-up of P15-D.

## Severity

- [x] **Must have** — public launch readiness; the dish catalog is the foundational primitive every social surface depends on.

## Status

Closed for real 2026-07-11 (commit `3247fb2c`).

The original 2026-06-09 "Done" claim was INCORRECT. The cloud dish catalog did land on that date: the dishes tab, submit dish picker (`DishSelectionStep`), `dish/[id]`, and discover all resolve dishes from `bc_dishes` via `app/(root)/data/cloud-dishes.ts` (`searchDishes` / `getDishById`, mapped by `mapCloudDish`), the production catalog is the live `bc_dishes` rows (ChefTom set) growing via `proposeDishCloud`, and taxonomy tag filters stayed demo-only. But `recipe/[id].tsx` still substituted hardcoded Pad Thai `SAMPLE_INGREDIENTS`/`SAMPLE_STEPS` for real submissions with empty arrays with NO demo gate (audit C9), and the discover/feed surfaces still reached fixtures in public builds (audit H16, `docs/reports/REPORT-bestchef-adversarial-production-audit-2026-07-10.md`). So the "closed" state was false when written.

Genuinely closed 2026-07-11 in commit `3247fb2c`: the `recipe/[id]` fabrication and all remaining `DEMO_*` / `SAMPLE_*` substitutions in public builds were removed or gated behind `shouldUseDemoFixturesInDev()`, with the mechanical `check:no-ungated-fixtures` gate (wired into `check:parity`) preventing regression. Fail-closed behavior verified in `app/(root)/data/__tests__/cloud-dishes.test.ts`.
