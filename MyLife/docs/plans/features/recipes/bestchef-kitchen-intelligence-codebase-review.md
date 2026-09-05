# BestChef Kitchen Intelligence Codebase Review

Date: 2026-04-24

Scope: `apps/bestchef`, `modules/bestchef`, relevant MyLife mobile Recipes surfaces, Budget receipt parser patterns, and BestChef cloud schema.

## Executive Finding

BestChef now has the local Kitchen baseline needed for full recipe, grocery, and pantry management. The deeper requested scope should build on the existing MyLife Recipes module instead of creating a parallel Kitchen stack. The main missing pieces are capture pipelines, pantry batches, canonical product and nutrition provenance, universal nutrition display, slider UIUX, server contribution flows, and broader interaction QA.

## Standalone BestChef App

### Implemented Surfaces

- `apps/bestchef/app/(root)/(tabs)/kitchen.tsx`: Kitchen overview with stats, saved recipes, quick actions, and search.
- `apps/bestchef/app/(root)/recipes/new.tsx`: Full saved recipe creation with ingredients and steps.
- `apps/bestchef/app/(root)/saved-recipe/[id].tsx`: Saved recipe details, favorite, Grocery flag, add to grocery list, and delete.
- `apps/bestchef/app/(root)/grocery.tsx`: Multiple grocery lists, custom items, checked states, archive, restore, delete, recipe flag import, and copy checked items to pantry.
- `apps/bestchef/app/(root)/pantry.tsx`: Pantry add, filter, use-one, delete, storage location, grocery section, expiration field.
- `apps/bestchef/app/(root)/soon.tsx`: Universal page for intentionally deferred interactions.
- `apps/bestchef/app/(root)/__tests__/uiux-interaction-contract.test.ts`: Static route and interaction contract.

### App Gaps

- No receipt capture screen exists yet for BestChef.
- No grocery photo review flow exists yet.
- No expiration photo OCR flow exists yet.
- Nutrition details are not available everywhere in the standalone UI.
- Pantry has one expiration date per item, not batch or LOT-style inventory.
- Slider and swipe interactions are not implemented yet.
- UIUX guard does not yet cover gesture handlers, menus, modals, or all future disabled actions.

## Shared BestChef Module

### Existing Assets To Reuse

- Recipe CRUD: `modules/bestchef/src/db/crud.ts`.
- Shopping list CRUD and recipe integration: `modules/bestchef/src/db/shopping-lists.ts`.
- Pantry CRUD and filters: `modules/bestchef/src/db/pantry.ts`.
- Nutrition CRUD: `modules/bestchef/src/db/nutrition.ts`.
- Barcode lookup: `modules/bestchef/src/pantry/open-food-facts.ts`.
- Food recognition helper: `modules/bestchef/src/pantry/food-recognition.ts`.
- Recipe nutrition aggregation: `modules/bestchef/src/nutrition/recipe-nutrition.ts`.
- Health bridge and cloud nutrition cards: `modules/bestchef/src/cloud/health-bridge.ts`.
- Recipe import from text/photo pattern: `modules/bestchef/src/import/ai-recipe-extract.ts`.

### Module Gaps

- KITCH-F004/F005 update, 2026-04-25: `NutritionSourceSchema` now supports manual, Open Food Facts, USDA FDC, GS1, BestChef cache, local cache, receipt OCR, and food recognition provenance.
- KITCH-F004/F005 update, 2026-04-25: `calculateRecipeNutrition` now uses the shared unit conversion layer and reports conversion confidence plus low-confidence ingredients.
- `rc_pantry_items` has `expiration_date` and `photo_path`, but no batch, lot, receipt, or image collection entity.
- KITCH-F004 update, 2026-04-25: nutrition resolution now searches local cache first, normalizes manual/provider candidates into one shape, and exposes Open Food Facts, USDA FDC, and GS1 adapter statuses without requiring live paid credentials.
- `identifyFood` returns one primary result. Grocery photo import needs multi-item candidates and confirmation state.

## MyLife Mobile Recipes Patterns

Useful existing patterns:

- `apps/mobile/app/(recipes)/pantry.tsx` has barcode lookup UI using `lookupBarcode`.
- `apps/mobile/app/(recipes)/import-photo.tsx` has recipe photo import patterns and camera/library permission handling.
- Recipes module already separates local logic from UI better than the standalone app, which should guide future porting.

Risk:

- Standalone app and hub module must remain product-intent aligned. Any kitchen data model changes should be applied in shared module first, then wired to standalone and hub surfaces.

## Budget Receipt Patterns

Useful existing patterns:

- `modules/budget/src/engine/receipt-parser.ts` parses OCR text into merchant, date, totals, line items, and confidence.
- `modules/budget/src/automations/receipt-to-budget.ts` stores receipt photos in the hub attachment layer and links them to Budget transactions.

Limitations:

- Budget receipt automation explicitly keeps OCR out of scope. BestChef must add OCR provider adapters for the requested receipt-to-pantry workflow.
- Budget receipt parser handles text, not image OCR. It should be ported as a parsing layer after OCR provider extraction.

## BestChef Cloud Schema

Useful existing assets:

- `bc_recipe_snapshots` includes `nutrition_json`.
- `bc_media_assets` and `bc_media_variants` support image and video metadata, moderation status, storage keys, remote URLs, and content hashes.
- RLS policies and content event triggers already exist for BestChef cloud objects.

Gaps:

- No product data cache table exists for shared product identities, nutrition candidates, barcode aliases, contribution state, or source licensing.
- No pantry or receipt sharing model should be added without sync scope and privacy rules.

## Data Source Review

Recommended layered strategy:

1. Local cache first for privacy, speed, and offline.
2. Open Food Facts for barcode, product label, ingredients, nutrition, and user contribution workflows.
3. USDA FoodData Central for generic foods and authoritative nutrition fallback.
4. GS1 US Data Hub for official GTIN identity where subscription terms allow.
5. OCR provider layer for receipt and expiration text extraction.
6. Manual user confirmation as the final source of truth for personal pantry state.

Key constraints:

- Open Food Facts data is user contributed and must be shown with confidence and source labels. Reads do not require an API key, but API calls must use a custom User-Agent and respect public rate limits of 100 read product requests/min and 10 search requests/min.
- Open Food Facts database data is ODbL with share-alike obligations, database contents use DbCL, and product images are CC BY-SA. Image upload requires user ownership or consent.
- USDA FoodData Central requires a data.gov API key, has a default 1,000 requests/hour/IP limit, and publishes data as CC0/public domain with requested source attribution.
- GS1 Data Hub access and use depend on subscription and terms. The KITCH-F004 adapter stays an identity stub until a GS1 US subscription, API add-on, endpoint, API key, and legal approval exist.
- Receipt images and pantry data default to private scopes.

## QA Review

Added guard:

- `pnpm --filter @mylife/bestchef-app test:uiux`

What it covers now:

- Universal `/soon` page exists.
- `/soon` is registered in root stack.
- Root stack includes animated transitions.
- Every root Pressable has an action.
- Every routed action resolves to an existing page.

Needed next:

- Cover gesture handlers, menus, modals, disabled planned actions, and accessibility labels.
- Add fixture tests for receipt OCR, grocery photo candidates, expiration OCR, nutrition resolver, and batch creation.
- Add visual QA for dense mobile screens and slider gestures.

## Recommended Implementation Order

1. Keep current local baseline stable with `test:uiux`, typecheck, app tests, module tests, function gate, and parity check.
2. Build the canonical food, nutrition provenance, and pantry batch model before receipt and photo automation.
3. Add the upload hub and route unfinished methods to `/soon`.
4. Implement receipt OCR review before pantry mutation.
5. Implement grocery photo candidate review before pantry mutation.
6. Implement expiration OCR and batch UI.
7. Add universal nutrition and health panels across every food surface.
8. Add slider and swipe UIUX with accessible button equivalents.
9. Add server contribution and shared product cache after local confirmation workflows are reliable.
