# BestChef Nutrition Resolver And Unit Conversion

Date: 2026-04-25

## Summary

Implemented KITCH-F004 and KITCH-F005 for BestChef Kitchen Intelligence. The module now resolves local cache, Open Food Facts, USDA-ready, GS1-ready, and manual nutrition candidates into one normalized shape, exposes source and confidence display metadata, and scales recipe nutrition through unit and serving conversions.

## What Changed

- Added normalized nutrition candidate, provider result, provider status, source display, resolver input, and recipe conversion types.
- Built `resolveNutritionCandidates` as a local-first resolver that collects product, pantry, barcode alias, cache, manual, and provider candidates without requiring paid credentials.
- Added display metadata for source labels, confidence labels, badge tone, attribution, access constraints, API key requirements, rate-limit notes, and licensing notes.
- Converted Open Food Facts lookups into provider candidates and added clean USDA FoodData Central and GS1 Data Hub adapter stubs.
- Added a unit conversion layer for recipe nutrition with alias normalization, volume/weight/count/package compatibility, density hints, correction hooks, and low-confidence fallbacks.
- Updated recipe nutrition totals to use serving basis and unit scaling, with per-ingredient conversion audit data and low-confidence ingredient reporting.
- Updated recipe-to-nutrition automation fixtures and BestChef backlog/review docs for the implemented resolver and conversion behavior.
- Added focused unit tests for unit conversions, recipe nutrition scaling, resolver ordering, source display constraints, and provider no-credential status handling.

## Files Changed

- `modules/bestchef/src/types.ts`
- `modules/bestchef/src/db/nutrition.ts`
- `modules/bestchef/src/pantry/open-food-facts.ts`
- `modules/bestchef/src/nutrition/recipe-nutrition.ts`
- `modules/bestchef/src/grocery/units.ts`
- `modules/bestchef/src/grocery/index.ts`
- `modules/bestchef/src/pantry/index.ts`
- `modules/bestchef/src/index.ts`
- `modules/bestchef/src/grocery/__tests__/units.test.ts`
- `modules/bestchef/src/nutrition/__tests__/recipe-nutrition.test.ts`
- `modules/bestchef/src/db/__tests__/nutrition.test.ts`
- `modules/bestchef/src/automations/recipe-to-nutrition.ts`
- `modules/bestchef/src/automations/__tests__/recipe-to-nutrition.test.ts`
- `docs/plans/features/recipes/bestchef-kitchen-intelligence-feature-bug-backlog.md`
- `docs/plans/features/recipes/bestchef-kitchen-intelligence-codebase-review.md`
- `modules/habits/src/test/function-quality.ts`
- `modules/habits/src/integrations/__tests__/sleep-link.function-gate.test.ts`

## Verification

- `pnpm --filter @mylife/bestchef test -- src/grocery/__tests__/units.test.ts src/nutrition/__tests__/recipe-nutrition.test.ts src/db/__tests__/nutrition.test.ts src/automations/__tests__/recipe-to-nutrition.test.ts`
- `pnpm --filter @mylife/bestchef typecheck`
- `pnpm --filter @mylife/bestchef test`
- `pnpm --filter @mylife/bestchef-app test:uiux`
- `pnpm --filter @mylife/bestchef-app test`
- `pnpm gate:function:changed`
- `pnpm check:parity --quiet`

## Notes

- Open Food Facts remains no-key and public-data based, with User-Agent, rate-limit, attribution, database license, and image consent constraints documented.
- USDA FoodData Central is implemented as key-gated and ready for configured use, with no live dependency in tests or local operation.
- GS1 Data Hub is stubbed as subscription and legal-approval gated until credentials, product scope, and licensing terms are supplied.
- `pnpm gate:function:changed` initially found an unrelated Habits generated function-gate helper outside the package TypeScript root. I added a package-local helper and rewired that generated test import, then verified Habits typecheck and the focused Habits function-gate test before rerunning the full changed-function gate successfully.
- The repo had unrelated dirty BestChef app, sync, payments, sleep, and other work before this session. Those changes were left in place.

## Remaining Items

- KITCH-F007 and later receipt/photo flows should consume the normalized resolver output instead of writing pantry nutrition directly.
- Live USDA and GS1 integrations need real credentials, agreed rate-limit policy, and licensing review before production use.
