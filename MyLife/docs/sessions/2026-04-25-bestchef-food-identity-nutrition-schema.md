# BestChef Food Identity And Nutrition Schema

Date: 2026-04-25

## Summary

Implemented KITCH-F003 for BestChef Kitchen Intelligence. The local `@mylife/bestchef` schema now separates canonical product identity from private pantry inventory and stores nutrition provenance with source IDs, confidence, serving basis, fetched timestamps, and user confirmation state.

## What Changed

- Added schema v12 with `rc_food_products`, `rc_food_product_aliases`, and `rc_food_confirmations`.
- Added product and nutrition links to `rc_pantry_items`: `product_id`, `nutrition_data_id`, `confirmation_status`, and `confirmed_at`.
- Extended `rc_nutrition_data` with `product_id`, `source_id`, `source_url`, `confidence`, `serving_basis`, serving quantity/unit, parent override ID, and confirmation fields.
- Added CRUD helpers for products, aliases, confirmations, product-linked nutrition candidates, manual nutrition overrides, and pantry identity confirmation.
- Updated recipe nutrition lookup to use pantry-linked product nutrition before falling back to legacy pantry item nutrition.
- Exported new product identity, alias, confirmation, and nutrition helper types/functions from the package barrel.
- Updated BestChef app/module docs and marked KITCH-F003 implemented in the Kitchen Intelligence backlog.

## Files Changed

- `modules/bestchef/src/db/schema.ts`
- `modules/bestchef/src/definition.ts`
- `modules/bestchef/src/types.ts`
- `modules/bestchef/src/db/nutrition.ts`
- `modules/bestchef/src/db/pantry.ts`
- `modules/bestchef/src/db/index.ts`
- `modules/bestchef/src/index.ts`
- `modules/bestchef/src/nutrition/recipe-nutrition.ts`
- `modules/bestchef/src/pantry/open-food-facts.ts`
- `modules/bestchef/src/db/__tests__/nutrition.test.ts`
- `modules/bestchef/src/db/__tests__/pantry.test.ts`
- `modules/bestchef/src/social/__tests__/follower-updates.test.ts`
- `modules/bestchef/src/cloud/__tests__/grocery-delivery.test.ts`
- `apps/bestchef/CLAUDE.md`
- `modules/bestchef/CLAUDE.md`
- `docs/plans/features/recipes/bestchef-kitchen-intelligence-feature-bug-backlog.md`

## Verification

- `pnpm --filter @mylife/bestchef test -- src/db/__tests__/nutrition.test.ts src/db/__tests__/pantry.test.ts`
- `pnpm --filter @mylife/bestchef typecheck`
- `pnpm --filter @mylife/bestchef test`
- `pnpm --filter @mylife/bestchef-app test:uiux`
- `pnpm --filter @mylife/bestchef-app test`
- `pnpm --filter @mylife/bestchef-app typecheck`
- `pnpm gate:function --file modules/bestchef/src/db/nutrition.ts`
- `pnpm gate:function --file modules/bestchef/src/db/pantry.ts`
- `pnpm gate:function --file modules/bestchef/src/nutrition/recipe-nutrition.ts`
- `pnpm gate:function --file modules/bestchef/src/pantry/open-food-facts.ts`
- `pnpm check:parity --quiet`

`pnpm gate:function:changed` was also run. It failed outside the KITCH-F003 scope because pre-existing dirty web Mood files pulled `react-native/index.js` into an apps/web Vitest run, where Vite failed to parse Flow `import typeof` syntax. This is logged in `errors_log.md` as unresolved.

## Remaining Items

- KITCH-F004 is addressed by [BestChef Nutrition Resolver And Unit Conversion](2026-04-25-bestchef-nutrition-resolver-unit-conversion.md), with local cache, Open Food Facts, USDA-ready, GS1-ready, and manual candidates normalized into one resolver shape.
- KITCH-F005 is addressed by [BestChef Nutrition Resolver And Unit Conversion](2026-04-25-bestchef-nutrition-resolver-unit-conversion.md), with unit and serving conversion for recipe nutrition scaling.
- KITCH-F007 and later receipt/photo flows should consume the new product identity and confirmation helpers instead of writing pantry rows directly.
