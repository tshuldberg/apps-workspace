# BestChef Kitchen Intelligence Feature and Bug Backlog

Date: 2026-04-25

This backlog converts the Kitchen tab feedback into feature and bug tickets using the structure from:

- `/Users/trey/Downloads/general-feature-request-template.md`
- `/Users/trey/Downloads/general-bug-report-template.md`

This backlog is the canonical Kitchen implementation record. The completed generated HTML mission control was removed on 2026-07-09 and remains available in git history.

Production Launch Mission Control: `docs/plans/features/recipes/bestchef-production-launch-mission-control.md`

## Current Review Snapshot

The BestChef standalone app now has saved recipes, full recipe entry, recipe steps, recipe grocery flags, organized multiple grocery lists, checked item pantry copy, pantry CRUD, pantry batches, receipt import review, grocery photo review, expiration photo OCR, universal nutrition detail panels, quick health summaries, recipe and dish nutrition aggregation, Kitchen/Grocery/Saved Recipe slider navigation, media-first recipe and pantry cards, and a Kitchen upload hub for finished and planned grocery or food import paths. The 2026-04-25 production launch review rates BestChef as internal-beta ready, not public-production ready, with the P0/P1 operational blockers tracked in the Production Launch Mission Control. The shared `@mylife/bestchef` module has additional MyLife Recipes capabilities that should be ported rather than rebuilt:

- Recipes: `rc_recipes`, `rc_ingredients`, `rc_steps`, ingredient parser, timer detection, favorites, tags, grocery flags.
- Grocery lists: `rc_shopping_lists`, `rc_shopping_list_items`, list metadata, active and archived filters, duplication, recipe ingredient import, custom item parsing, section categorization.
- Pantry: `rc_pantry_items`, storage filters, section filters, expiration filters, barcode field, photo path field.
- Nutrition: `rc_nutrition_data`, Open Food Facts barcode lookup, recipe nutrition aggregation, `health-bridge`, cloud `nutrition_json`.
- Capture patterns: `import/ai-recipe-extract.ts`, `pantry/food-recognition.ts`, Budget receipt parser and receipt attachment automation.
- Server patterns: `bc_recipe_snapshots`, `bc_media_assets`, `bc_media_variants`, RLS policies, content event functions.
- UIUX guard: `apps/bestchef/app/(root)/__tests__/uiux-interaction-contract.test.ts` and `/soon`.

## Source Research Summary

- USDA FoodData Central: official REST API for nutrient data, search, branded foods, and Foundation Foods. Requires API key and stores data under CC0. Source: https://fdc.nal.usda.gov/api-guide/
- USDA FoodData Central data docs: distinguishes analytically derived Foundation Foods, label-based Branded Foods, and FNDDS data. Source: https://fdc.nal.usda.gov/data-documentation/
- Open Food Facts: open product database for ingredients, nutrition, and product images, with user-contributed quality caveats and ODbL licensing. Source: https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/
- Open Food Facts image upload: write operations require authentication and user-owned or user-consented images. Source: https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorial-uploading-photo-to-a-product/
- GS1 US Data Hub: official product, location, company, and license API documentation for GS1 Data Hub subscribers. Source: https://www.help.gs1us.org/api-documentation
- Amazon Textract AnalyzeExpense: extracts receipt line items and summary fields from receipt documents. Source: https://docs.aws.amazon.com/textract/latest/dg/API_AnalyzeExpense.html
- Google Vision OCR: `TEXT_DETECTION` and `DOCUMENT_TEXT_DETECTION` extract text from images, with dense document support. Source: https://docs.cloud.google.com/vision/docs/ocr
- FDA Nutrition Facts Label: defines current user-facing nutrition label concepts such as serving size, calories, %DV, added sugars, vitamin D, potassium, calcium, and iron. Source: https://www.fda.gov/food/nutrition-facts-label/whats-nutrition-facts-label

## Ticket Index

| ID | Type | Title | Priority | Status |
|----|------|-------|----------|--------|
| KITCH-B001 | Bug | UIUX interactions can exist without a function or valid route | Must have | Resolved for current app |
| KITCH-F000 | Feature | Local kitchen management baseline | Must have | Implemented |
| KITCH-F001 | Feature | Organized multi-list grocery workspace | Must have | Implemented |
| KITCH-F002 | Feature | Multi-source grocery and food upload hub | Must have | Implemented |
| KITCH-F003 | Feature | Canonical food product and nutrition source model | Must have | Implemented |
| KITCH-F004 | Feature | Nutrition resolver across USDA, Open Food Facts, GS1, and manual data | Must have | Implemented |
| KITCH-F005 | Feature | Serving and unit conversion layer for recipe nutrition | Should have | Implemented |
| KITCH-F006 | Feature | Receipt capture and OCR import | Must have | Implemented |
| KITCH-F007 | Feature | Receipt line item to pantry matcher | Must have | Implemented |
| KITCH-F008 | Feature | Receipt import error and privacy handling | Must have | Implemented |
| KITCH-F009 | Feature | Grocery photo food candidate detection | Must have | Implemented |
| KITCH-F010 | Feature | Photo candidate confirmation and enrichment | Must have | Implemented |
| KITCH-F011 | Feature | Pantry batches with expiration sections | Must have | Implemented |
| KITCH-F012 | Feature | Expiration date image OCR | Must have | Implemented |
| KITCH-F013 | Feature | Use-next pantry filters and recipe prompts | Should have | Implemented |
| KITCH-F014 | Feature | Universal nutrition detail panel | Must have | Implemented |
| KITCH-F015 | Feature | Quick health detail summary | Should have | Implemented |
| KITCH-F016 | Feature | Recipe and dish nutrition aggregation | Must have | Implemented |
| KITCH-F017 | Feature | Kitchen, Grocery, Recipe slider shell | Should have | Implemented |
| KITCH-F018 | Feature | Media-first recipe and pantry cards | Should have | Implemented |
| KITCH-F019 | Feature | BestChef server product data cache | Must have | Implemented core |
| KITCH-F020 | Feature | User contribution and moderation workflow | Should have | Implemented core |
| KITCH-F021 | Feature | Mesh sync policy for kitchen data | Must have | Implemented |
| KITCH-F022 | Feature | Interaction contract expansion | Must have | Implemented |
| KITCH-F023 | Feature | Capture workflow test fixtures | Should have | Implemented |
| KITCH-F024 | Feature | Visual and accessibility QA for Kitchen tab | Should have | Implemented |

## KITCH-B001 - Bug - UIUX interactions can exist without a function or valid route

### Summary

Some interactive controls could be added without a handler or could route to a missing page. This breaks user trust and makes future feature placeholders feel dead.

### Current Behavior

Before this pass, the static audit found interactive Pressables in BestChef root surfaces without a real `onPress` path.

### Expected Behavior

Every Pressable has a function. Every route target resolves to a page, and intentionally deferred follow-ups route to `/soon`. Root stack navigation remains animated.

### Steps to Reproduce

1. Add a `<Pressable>` under `apps/bestchef/app/(root)` with no `onPress`.
2. Run `pnpm --filter @mylife/bestchef-app test:uiux`.
3. Observe the failing file and line in the test output.

### Acceptance Criteria

1. [x] A universal `/soon` page exists and is registered in the root stack.
2. [x] `test:uiux` fails if a Pressable has no action.
3. [x] `test:uiux` fails if a route target does not resolve to a route file.
4. [x] Root stack transitions include slide animations.
5. [x] Future extension covers menus, gesture handlers, modals, disabled future actions, and icon-only recipe shell accessibility.

### Severity and Impact

Severity: Major. Affects all users when a dead interaction is shipped.

### Technical Notes

Relevant files:

- `apps/bestchef/app/(root)/__tests__/uiux-interaction-contract.test.ts`
- `apps/bestchef/app/(root)/soon.tsx`
- `apps/bestchef/app/(root)/_layout.tsx`

## KITCH-F000 - Feature - Local kitchen management baseline

### Problem Statement

Home cooks need a private Kitchen space where they can save recipes, mark recipes for grocery planning, manage multiple grocery lists, and keep a pantry inventory.

### Desired Outcome

Users can create full recipes, flag recipes for grocery, add flagged recipes to grocery lists, manage multiple lists, check purchased items, and copy checked items into pantry.

### User Scenarios

1. Happy path: A user creates a private recipe with ingredients and steps, turns on Grocery, then adds it to a grocery list.
2. Alternate path: A user creates a second list for a party and adds a different recipe to that list.
3. Edge case: A user deletes a saved recipe and the app returns to Kitchen without a broken route.

### Acceptance Criteria

1. [x] Saved recipe creation supports title, description, servings, prep time, cook time, difficulty, ingredients, and steps.
2. [x] Recipe detail supports favorite, Grocery flag, add to list, and delete.
3. [x] Grocery supports multiple lists, custom items, checked states, archive, restore, and delete.
4. [x] Pantry supports manual add, filters, use-one action, and delete.
5. [x] App and shared module tests pass for implemented local behavior.

### Scope Boundaries

In scope: local standalone app behavior and shared module support.

Not in scope: receipt OCR, grocery photo recognition, expiration batch OCR, or server sharing.

### Technical Context

Relevant files include `apps/bestchef/app/(root)/(tabs)/kitchen.tsx`, `apps/bestchef/app/(root)/grocery.tsx`, `apps/bestchef/app/(root)/pantry.tsx`, `apps/bestchef/app/(root)/recipes/new.tsx`, `apps/bestchef/app/(root)/saved-recipe/[id].tsx`, and shared module shopping list, recipe, and schema files.

## KITCH-F001 - Feature - Organized multi-list grocery workspace

### Problem Statement

Users need multiple grocery lists for different stores, events, households, and recipe plans. The current list manager works, but it needs stronger organization and faster management.

### Desired Outcome

Users can create, rename, duplicate, archive, restore, sort, filter, and manage multiple lists with active, archived, and event/store views.

### User Scenarios

1. Happy path: A user creates "Costco", "Weekly", and "Dinner Party" lists and switches between them.
2. Alternate path: A user archives a completed list and later restores it.
3. Edge case: A user tries to delete the only active list and the app creates or prompts for a replacement state.

### Acceptance Criteria

1. [x] Lists persist with name, active state, updated date, optional store/event metadata, archive timestamp, and updated-date ordering.
2. [x] Archived lists are hidden by default but available through a clear archived view.
3. [x] Users can duplicate a list. Shared module supports preserving checked state; standalone duplicates into a fresh unchecked active list.
4. [x] Item sections remain grouped by grocery section.
5. [x] Every KITCH button has a handler and pressed feedback or an animated route transition.
6. [x] Grocery items expose an action menu for check state, nutrition details, and deletion.

### Scope Boundaries

In scope: local list UX, organization, persistence, and tests.

Not in scope: server sharing and household collaborative editing.

### Business Case

Priority: Must have. Multiple organized lists are central to grocery planning.

### Technical Context

Build on `rc_shopping_lists`, `rc_shopping_list_items`, `getGroceryListBundle`, and `/grocery`.

### Implementation Notes - 2026-04-25

- Schema v14 adds `store_name`, `event_name`, `event_date`, and `archived_at` to `rc_shopping_lists`.
- `@mylife/bestchef` now exposes active, archived, and all list filters plus archive, restore, rename, and duplicate helpers.
- Standalone `/grocery` adds active, archived, and all filters, metadata editing, duplicate, archive/restore, improved list switching, and focused data tests.
- Standalone `/grocery` now exposes a per-item action menu backed by `removeGroceryListItem`, so items can be checked, inspected, or deleted without dead-end UI.
- Sync policy now includes `shopping_lists` and `shopping_list_items` as `personal_replica` kitchen data.
- Manual drag sorting is not part of this pass. Lists are ordered by active state, archive timestamp, and latest update.

## KITCH-F002 - Feature - Multi-source grocery and food upload hub

### Problem Statement

Users need several ways to add grocery and food information. Today, entry points are spread across manual recipe, grocery, and pantry screens.

### Desired Outcome

Kitchen has a clear upload hub for text, barcode, receipt photo, grocery photo, expiration photo, recipe ingredients, clipboard, and manual pantry entry.

### User Scenarios

1. Happy path: A user opens Kitchen, taps Add Food, and chooses receipt photo.
2. Alternate path: A user chooses barcode and lands on the existing barcode lookup flow when ported.
3. Edge case: A planned but unfinished option routes to `/soon` with the feature name.

### Acceptance Criteria

1. [x] Every requested upload method is visible from Kitchen.
2. [x] Implemented methods route to real pages.
3. [x] Planned methods route to `/soon`.
4. [x] Permission prompts appear before camera or photo library usage in capture screens.
5. [x] `test:uiux` passes after adding every entry point.

### Scope Boundaries

In scope: navigation shell, option cards, permissions, and future placeholders.

Not in scope: full provider implementation for every capture method.

### Business Case

Priority: Must have. Upload breadth is a direct user requirement.

### Technical Context

Use Expo Image Picker patterns from submit/import-photo surfaces and the new `/soon` fallback.

### Implementation Notes - 2026-04-25

- Kitchen now shows an Add Food upload hub with manual food, barcode, receipt photo, grocery photo, expiration photo, recipe ingredients, and clipboard entry points.
- Manual food routes to `/pantry`; recipe ingredients route to `/recipes/new`.
- Receipt photo, grocery photo, and expiration photo now route to real capture/review screens. Barcode and clipboard still route to `/soon` with feature context until their provider flows are built.
- Receipt, grocery photo, and expiration photo capture screens request camera or photo-library permission before launching native pickers.
- The UIUX contract keeps `/soon` registered, verifies animated stack transitions, validates route targets, checks KITCH surfaces for pressed feedback or animated navigation, and locks in upload permission preflights.
- No external analytics were added because MyLife is privacy-first and prohibits telemetry; every upload card is instead backed by an explicit local route handler.

## KITCH-F003 - Feature - Canonical food product and nutrition source model

### Problem Statement

Pantry rows currently mix user inventory with product identity and nutrition facts. Auto-add workflows need product aliases, source candidates, confidence, serving basis, and user confirmation.

### Desired Outcome

Pantry items reference product identities, nutrition records, barcode aliases, and confirmation state without losing private inventory data.

### User Scenarios

1. Happy path: A receipt item matches an existing product and creates a new pantry batch.
2. Alternate path: A barcode returns two candidates and the user chooses one.
3. Edge case: No data source has nutrition, so the item is saved with missing nutrition and a manual entry option.

### Acceptance Criteria

1. [x] Product identity is separate from pantry inventory.
2. [x] Nutrition facts store source, source ID, confidence, serving basis, and fetched timestamp.
3. [x] Manual overrides never overwrite source records without user confirmation.
4. [x] Multiple barcodes or aliases can point to one product.
5. [x] Local migrations and module tests cover the schema.

### Scope Boundaries

In scope: local schema, types, CRUD, migrations, and tests.

Not in scope: public server contribution moderation.

### Business Case

Priority: Must have. Receipt and photo workflows cannot be accurate without this.

### Technical Context

Extend around `rc_pantry_items`, `rc_nutrition_data`, `NutritionSourceSchema`, and product/barcode lookup code.

Implementation notes, 2026-04-25: schema v12 adds `rc_food_products`, `rc_food_product_aliases`, and `rc_food_confirmations`; pantry rows now hold optional `product_id`, `nutrition_data_id`, and confirmation status while retaining private quantity/location/expiration fields; nutrition rows carry product links, source IDs, source URLs, confidence, serving basis, fetched timestamp, parent manual override IDs, and user confirmation fields.

## KITCH-F004 - Feature - Nutrition resolver across USDA, Open Food Facts, GS1, and manual data

### Problem Statement

No single data source provides reliable coverage for all groceries, branded foods, generic foods, and user-created meals.

### Desired Outcome

Users see ranked nutrition candidates from local cache, Open Food Facts, USDA FoodData Central, optional GS1 product identity, and manual data.

### User Scenarios

1. Happy path: A barcode lookup finds Open Food Facts nutrition and a matching USDA branded entry.
2. Alternate path: A generic "banana" item uses USDA Foundation or FNDDS data.
3. Edge case: Sources disagree, so the UI shows both with source labels and asks the user to confirm.

### Acceptance Criteria

1. [x] Resolver searches local cache before network providers.
2. [x] Provider responses are normalized into one candidate shape.
3. [x] Every candidate displays source and confidence.
4. [x] Low-confidence data is not auto-selected.
5. [x] API key, rate limit, and licensing constraints are documented.

### Scope Boundaries

In scope: resolver interface, provider adapters, caching, and candidate UI.

Not in scope: paid provider commitment until product/legal choice is made.

### Business Case

Priority: Must have. Full nutrition facts are a required end state.

### Technical Context

Build on `lookupBarcode`, `createNutritionData`, and `@mylife/nutrition-engine`.

### Implementation Notes - 2026-04-25

- `resolveNutritionCandidates` in `modules/bestchef/src/db/nutrition.ts` returns a local-first ranked candidate list plus provider statuses.
- Candidate display data includes source label, confidence label, API access, rate-limit, license, attribution, and constraints.
- Open Food Facts reads do not require an API key, must use a custom User-Agent, and follow public API limits of 100 read product requests/min and 10 search requests/min. Data is ODbL with share-alike obligations, contents use DbCL, and product images are CC BY-SA.
- USDA FoodData Central is API-key gated through data.gov, has a default 1,000 requests/hour/IP limit, and publishes data as CC0/public domain with requested source attribution.
- GS1 US Data Hub is an identity source only in this pass. Live calls stay stubbed until a GS1 US subscription, API add-on, endpoint, API key, and legal approval exist.

## KITCH-F005 - Feature - Serving and unit conversion layer for recipe nutrition

### Problem Statement

Current recipe nutrition uses a unitless scalar. That is acceptable for some count-based items but inaccurate for volume, weight, and package units.

### Desired Outcome

Recipe nutrition uses normalized units, serving bases, density hints, confidence, and user correction for conversions.

### User Scenarios

1. Happy path: "200g rice" maps to a per-100g nutrition record and scales correctly.
2. Alternate path: "1 cup milk" uses a known conversion.
3. Edge case: "1 bunch cilantro" remains approximate and is labeled as low confidence.

### Acceptance Criteria

1. [x] Weight, volume, count, serving, and package units are normalized.
2. [x] Recipe totals show coverage and conversion confidence.
3. [x] Users can correct a conversion.
4. [x] Corrections can be reused for future matching.
5. [x] Existing recipe nutrition tests are updated.

### Business Case

Priority: Should have. It improves nutrition reliability and reduces misleading totals.

### Implementation Notes - 2026-04-25

- `modules/bestchef/src/grocery/units.ts` now normalizes aliases, supports weight, volume, count, serving, package, can, bunch, clove, and slice units, and exposes reusable correction hooks.
- Recipe nutrition now scales per-100g, per-100ml, per-serving, per-package, and per-item records with conversion confidence and low-confidence ingredient labels.
- Common density hints cover milk, water or broth, oils, flour, sugar, syrups, and butter. Unknown or ambiguous conversions remain approximate and are surfaced as low confidence.
- Schema v17 adds `rc_unit_conversion_corrections` so user-corrected ingredient conversions persist locally, sync as personal kitchen data, and are reused by recipe and dish nutrition calculations.

## KITCH-F006 - Feature - Receipt capture and OCR import

### Problem Statement

Users want to take a picture of a receipt and have items loaded into pantry with nutrition facts as the end state.

### Desired Outcome

The app captures a receipt, extracts merchant, date, totals, line items, and confidence, then presents editable candidates.

### User Scenarios

1. Happy path: A grocery receipt produces 20 line-item candidates for review.
2. Alternate path: A low-quality receipt still returns raw OCR text and manual correction.
3. Edge case: OCR provider is unavailable, so the app keeps the image and offers manual entry.

### Acceptance Criteria

1. [x] Receipt image capture and hub attachment storage work in the standalone mobile app.
2. [x] OCR provider abstraction plus Budget parser reuse returns line items and summary fields.
3. [x] Raw OCR, redacted OCR, provider status, provider error, and confidence are stored.
4. [x] The review screen lets users edit and merge lines.
5. [x] The review screen lets users ignore and confirm lines.
6. [x] No pantry data is created before user confirmation.

### Scope Boundaries

In scope: capture, OCR adapter, parser, review UI, and tests.

Not in scope: automatic credit card or payment data storage.

### Technical Context

Port ideas from `modules/budget/src/engine/receipt-parser.ts` and add a provider adapter for Amazon Textract AnalyzeExpense or Google Document AI.

### Implementation Notes - 2026-04-25

- Added shared receipt import tables in BestChef schema v15: `rc_receipt_imports` and `rc_receipt_import_lines`.
- Added `createReceiptImportDraft`, OCR provider interfaces, Claude vision provider shell, manual/static OCR providers for review and tests, raw OCR storage, redacted OCR storage, and hub attachment linking.
- Added standalone `/kitchen-receipt` and `/kitchen-receipt-review` routes, with Kitchen upload hub and Pantry entry points.
- Receipt review now supports line-level item, quantity, unit, expiration, and lot corrections, plus explicit candidate selection so a user can merge into an existing pantry item or reject the candidate and create a corrected item.
- Phase 3 completion added a receipt OCR provider selection surface with local manual OCR text, user-keyed Claude Vision, managed-cloud, and on-device provider states. Unsupported production paths remain non-mutating until approved, and missing provider keys are blocked before import review.
- Live Textract, Document AI, or native on-device OCR adapter approval remains tracked in the production launch plan, not as a Phase 3 local workflow blocker.

## KITCH-F007 - Feature - Receipt line item to pantry matcher

### Problem Statement

Receipt OCR line items are often abbreviated and do not directly map to pantry names or nutrition facts.

### Desired Outcome

Receipt lines become pantry candidates with product match, quantity, storage location, section, nutrition, and confirmation state.

### User Scenarios

1. Happy path: "ORG MILK 1GAL" maps to Organic Milk with dairy section and nutrition.
2. Alternate path: "BANANA" maps to a generic USDA food.
3. Edge case: "MISC GROCERY" stays unmatched and is not added automatically.

### Acceptance Criteria

1. [x] Matcher searches existing pantry, product cache, barcode aliases, product aliases, and local nutrition candidates.
2. [x] Users can confirm or ignore each matched pantry candidate in review.
3. [x] Confirmed items create pantry entries or pantry batches.
4. [x] Nutrition records are linked with source and confidence when a candidate is available.
5. [x] Ambiguous items remain in a review queue.

### Business Case

Priority: Must have. Receipt auto-load is the highest-risk requested automation.

### Implementation Notes - 2026-04-25

- Added receipt-line normalization for abbreviated receipt text and barcode extraction.
- Added `matchReceiptLineToPantry` to rank pantry items, barcode aliases, product aliases, product cache rows, and nutrition candidates.
- Added `confirmReceiptImportLines`, `confirmReceiptLineToPantry`, and `ignoreReceiptImportLine`. Confirmed lines create or update pantry batches and link product/nutrition provenance; unconfirmed lines remain in review.
- Receipt review quantity, unit, item name, expiration, lot, and merge correction paths are now wired through `ReceiptLineConfirmationInput`.
- Phase 3 completion added optional network nutrition enrichment during receipt review through `ReceiptImportDraftOptions`, `matchReceiptLineToPantry`, and the standalone receipt import screen. Provider candidates are review-only until the user explicitly confirms a line.

## KITCH-F008 - Feature - Receipt import error and privacy handling

### Problem Statement

Receipts include payment details and noisy OCR lines. Auto-importing without privacy and error handling can add wrong pantry items or expose sensitive data.

### Desired Outcome

The app redacts or ignores sensitive lines, shows low-confidence warnings, and offers manual fallback without corrupting pantry data.

### User Scenarios

1. Happy path: The receipt review hides card digits and keeps food lines.
2. Alternate path: Provider returns a partial parse and the user edits missing data.
3. Edge case: A payment line is never shown as a pantry candidate.

### Acceptance Criteria

1. [x] Payment numbers and authorization lines are excluded from pantry candidates.
2. [x] Low-confidence and ambiguous lines are clearly marked in review.
3. [x] Provider failures leave the capture stored with error state and no pantry mutation.
4. [x] Receipts default to private personal-replica scope.
5. [x] Tests cover noisy OCR and sensitive lines.

### Business Case

Priority: Must have. Protects user privacy and prevents wrong data.

### Implementation Notes - 2026-04-25

- Extended the Budget receipt parser with payment-line detection and redaction helpers, then reused it from BestChef through a narrow package subpath.
- Stores raw OCR for audit and a redacted OCR copy for review display. Payment-line redaction metadata avoids duplicating original payment text outside `raw_ocr_text`.
- Provider failures are represented as receipt imports with `provider_status = failed`, `review_status = failed`, and zero pantry mutations.

## KITCH-F009 - Feature - Grocery photo food candidate detection

### Problem Statement

Users want to photograph groceries and get an approximate list of foods to confirm and add to pantry.

### Desired Outcome

The app detects multiple food candidates from a grocery image with name, category, confidence, and optional crop.

### User Scenarios

1. Happy path: A photo of milk, eggs, and apples yields three candidates.
2. Alternate path: A shelf photo yields candidates grouped by confidence.
3. Edge case: A non-food object is ignored or marked low confidence.

### Acceptance Criteria

1. [x] Multi-item detection returns candidate list, not only one primary food.
2. [x] Each candidate has name, grocery section, confidence, and source image link.
3. [x] Users can reject wrong candidates.
4. [x] Confirmed candidates can move to pantry review.
5. [x] Camera permission and failure paths are handled.

### Technical Context

Extend `modules/bestchef/src/pantry/food-recognition.ts`.

### Implementation Notes - 2026-04-25

- `identifyFood` now returns a `FoodRecognitionResult` with multiple `FoodRecognitionCandidate` records, labels, confidence, grocery section, storage location, quantity/unit hints, and raw provider text.
- The standalone `/kitchen-photo` screen supports camera/library/manual fixture input and routes to `/kitchen-photo-review`.
- The app uses deterministic sample JSON for tests and local review when no provider key is supplied.
- Phase 4 completion added optional normalized bounding boxes and crop URIs to grocery photo candidates. Review surfaces crop/region evidence, and confirmed pantry batches retain crop URI plus original source image when available.

## KITCH-F010 - Feature - Photo candidate confirmation and enrichment

### Problem Statement

Vision candidates need user confirmation, quantities, storage location, expiration, and nutrition enrichment before becoming pantry data.

### Desired Outcome

Users can edit photo-detected candidates and enrich them with nutrition and product data.

### Acceptance Criteria

1. [x] Candidate review supports edit, confirm, reject, and confirm all safe candidates.
2. [x] Confirmed candidates create pantry item or batch records.
3. [x] Nutrition resolver is available from each candidate.
4. [x] Source image is retained as evidence.
5. [x] Low-confidence candidates require individual confirmation.

### Business Case

Priority: Must have. Prevents false positives from becoming inventory.

### Implementation Notes - 2026-04-25

- Shared confirmation helpers create or link canonical food products, OCR label aliases, optional nutrition records, pantry items, and pantry batches only after user confirmation.
- `/kitchen-photo-review` defaults high-confidence candidates to selected, leaves lower-confidence candidates unselected, and lets users edit name, quantity, unit, expiration date, and lot before pantry mutation.
- Grocery photo candidates now run per-candidate nutrition and product lookup before review, using local cache first plus Open Food Facts, USDA FoodData Central, GS1 when configured, and an explicit unknown/manual fallback with missing facts left as `null`.
- `/kitchen-photo-review` shows source choices for each candidate. Users can choose a source candidate, choose pantry-only to reject all matches, or leave low-confidence nutrition matches unselected until they explicitly pick one.
- Confirmation now creates or links food product identity, OCR/barcode aliases, selected nutrition source records with source ID, confidence, serving basis, fetched timestamp, confirmation state, and pantry item/batch records in one confirmation-gated flow.
- Crop evidence and source photo evidence are stored together on confirmed pantry batches, so media cards can show a tighter food crop while preserving the original grocery photo as provenance.

## KITCH-F011 - Feature - Pantry batches with expiration sections

### Problem Statement

Current pantry items have one expiration date. Real kitchens often have multiple batches of the same ingredient with different dates and images.

### Desired Outcome

Users can manage batch-level quantities, expiration dates, purchase sources, receipt links, and photos under one pantry item.

### User Scenarios

1. Happy path: A user has two yogurt batches with different expiration dates.
2. Alternate path: A receipt import creates new batches for existing products.
3. Edge case: A batch has no date and appears in the no-date section.

### Acceptance Criteria

1. [x] Pantry item and pantry batch are separate entities.
2. [x] Batch supports quantity, unit, expiration, purchase date, source, receipt link, lot/batch code, and photos.
3. [x] UI filters expired, expiring soon, fresh, no date, and use next.
4. [x] Batch deletion does not delete the product if other batches exist.
5. [x] Existing single-date pantry data migrates safely.

### Business Case

Priority: Must have. This directly addresses LOT-style expiration management.

### Implementation Notes - 2026-04-25

- Schema v13 adds `rc_pantry_batches` with lot code, quantity, unit, expiration, purchase date, source, receipt link, photo evidence, and timestamps.
- Existing pantry rows are migrated into one batch per item when no batch exists.
- Standalone pantry sections group batches by expired, expiring soon, fresh, and no date, and mark the use-next batch.

## KITCH-F012 - Feature - Expiration date image OCR

### Problem Statement

Typing expiration dates is slow and error-prone. Users want to photograph an expiration date and assign it to ingredients.

### Desired Outcome

The app reads expiration date images and lets users confirm the detected date for one or more batches.

### Acceptance Criteria

1. [x] Camera and library inputs support expiration image capture.
2. [x] OCR returns date candidates with confidence and visible reason/context.
3. [x] Ambiguous formats require user selection.
4. [x] Invalid dates never overwrite existing batch data.
5. [x] Confirmed dates attach to selected batch records or create the intended batch only after confirmation.
6. [x] The original image and crop/region evidence, where available, are retained on the batch.

### Technical Context

Use Apple Vision on-device where available and Google Vision OCR as an optional cloud provider.

### Implementation Notes - 2026-04-25

- Shared expiration OCR now has `ExpirationOcrProvider`, static fixture parsing, and a Claude Vision provider shell. Apple Vision and Google Vision remain planned provider adapters.
- The parser recognizes ISO, slash/dash, written month, and compact dates, ranks visible expiration labels above lot/packed dates, and returns normalized `YYYY-MM-DD` candidates with confidence.
- `/expiration-photo` lets users read dates, select or type a date, assign to an existing pantry item or create a needs-review item, and persist photo evidence on the batch.

### Implementation Notes - 2026-04-25 Phase 5 Hardening

- `/expiration-photo` now exposes explicit provider choices for manual text, Claude Vision, managed cloud, and on-device OCR. Managed cloud and on-device choices return non-mutating unavailable reviews until provider infrastructure is approved.
- Expiration candidates now carry confidence, visible OCR context, reason text, manual-selection flags, and optional crop/region evidence. Ambiguous slash dates produce selectable alternatives and the app clears the default selection until the user chooses a date.
- `confirmExpirationDateForPantryBatch` validates real calendar dates before mutation, rejects stale selected batch/item ids, and preserves existing batch data on invalid input.
- Confirmed expiration photos retain original image plus crop evidence on the selected or newly created batch. Live Apple Vision and managed cloud credentials remain production launch work, not Phase 5 app logic.

## KITCH-F013 - Feature - Use-next pantry filters and recipe prompts

### Problem Statement

Users need quick views for what to use next before food expires.

### Desired Outcome

Pantry shows expiration sections and recipe suggestions based on expiring batches.

### Acceptance Criteria

1. [x] Pantry filters include expired, today, next 3 days, next 7 days, fresh, and no date.
2. [x] Use-next view sorts by expiration urgency.
3. [x] Recipe suggestions explain which expiring batches they use.
4. [x] Batch quantities are respected in all recipe prompt edge cases.
5. [x] Empty states route to recipe creation or grocery list actions.

### Implementation Notes - 2026-04-25

- Pantry adds All, Use Next, Expired, Today, Next 3 Days, Next 7 Days, Fresh, and No Date filters over batch rows.
- `suggestRecipesForUseNextBatches` ranks recipe prompts by expiring batch urgency and recipe match percentage, and the Kitchen tab shows which batches are driving each prompt.
- Quantity handling originally used the recipe-to-pantry match engine and active batch filtering; the follow-up below makes prompt copy strict about expiring batch sufficiency.

### Implementation Notes - 2026-04-25 Follow-up

- Use-next recipe prompts now compute batch-level quantity sufficiency for expiring batches, including compatible unit conversion where confidence is high.
- Prompt status distinguishes `ready_to_cook`, `needs_more`, and `check_units`, so insufficient expiring quantities and ambiguous count units do not imply the recipe can be made.
- The Kitchen tab shows ready, needs more, or check units copy for each prompt, including the expiring batch quantities used for the decision.
- Pantry empty and filter-empty states now include real actions for receipt import, grocery lists, recipe creation, and clearing filters.
- Phase 5 hardening verified the filter set, quantity-aware prompts, useful empty-state routes, and UI contract coverage as complete.

## KITCH-F014 - Feature - Universal nutrition detail panel

### Problem Statement

Nutrition facts should be available wherever food, ingredient, dish, or recipe data appears.

### Desired Outcome

One reusable detail panel can expand on pantry items, batches, grocery items, ingredients, dishes, and recipes.

### Acceptance Criteria

1. [x] Panel shows serving basis, calories, macros, fiber, sugar, saturated fat, sodium, and currently missing added sugar when it is not stored.
2. [x] Panel shows source, source ID, confidence, fetched timestamp, and confirmed timestamp when available.
3. [x] Missing facts are shown as missing, not zero.
4. [x] Users can edit or choose a better source where permitted.
5. [x] Pantry batches, grocery items, saved recipes, recipe ingredients, recipe submissions, and dishes have an affordance to open the panel where data exists or is missing.

### Implementation Notes - 2026-04-25

- Added a reusable `NutritionDetail` model in `@mylife/bestchef` for pantry items, pantry batches, grocery items, recipe ingredients, saved recipes, recipe submissions, and dishes.
- Added standalone `NutritionPanel` rendering for FDA-style core label concepts that are stored today: serving basis, calories, total fat, saturated fat, carbohydrates, fiber, total sugar, protein, sodium, source, source ID, confidence, fetched timestamp, confirmed timestamp, missing fields, and source breakdown.
- Missing data remains `null` through the detail model and UI renders it as missing. Added sugar is surfaced as missing until the schema stores it directly.
- Source choice now exists in both grocery photo review and the reusable nutrition panel where persistence is permitted. Pantry-backed rows list linked nutrition records and require confirmation before changing the selected source.

### Business Case

Priority: Must have. Full nutrition facts everywhere is a direct requirement.

## KITCH-F015 - Feature - Quick health detail summary

### Problem Statement

Users need a fast health summary without opening a full nutrition label every time.

### Desired Outcome

Foods and recipes show quick health details such as protein, fiber, sodium, saturated fat, added sugar, and confidence.

### Acceptance Criteria

1. [x] Quick summary is available on food, ingredient, recipe, and dish cards.
2. [x] Summary references FDA label concepts without presenting medical advice.
3. [x] Low-confidence or incomplete nutrition is labeled.
4. [x] The full nutrition panel is one tap away.
5. [x] Tests cover missing, partial, conflicting, and complete nutrition data.

### Implementation Notes - 2026-04-25

- Added `HealthSummary` for protein, fiber, sodium, saturated fat, added sugar, source confidence, and missing-data state.
- Health summary copy avoids medical claims and stores `hasMedicalClaim: false` in the module detail model.
- The summary appears on pantry batch rows, grocery rows, saved recipe details, saved recipe ingredients, recipe submission details, recipe submission ingredients, and dish details.

## KITCH-F016 - Feature - Recipe and dish nutrition aggregation

### Problem Statement

Recipe and dish nutrition should aggregate ingredient data accurately and explain gaps.

### Desired Outcome

Recipes and dishes show total, per-serving, source breakdown, missing ingredients, and conversion confidence.

### Acceptance Criteria

1. [x] Aggregation uses confirmed nutrition records where available.
2. [x] Missing ingredients are listed.
3. [x] Coverage percent is visible.
4. [x] Conversion confidence is visible.
5. [x] Cloud recipe snapshots can store `nutrition_json` when available.

### Implementation Notes - 2026-04-25

- `calculateIngredientListNutrition`, `calculateRecipeNutrition`, and `calculateDishNutrition` now report total nutrients, per-serving nutrients, coverage percent, missing ingredients, missing ingredient reasons, source breakdown, conversion confidence, ambiguous conversions, low-confidence warnings, and missing fields.
- Recipe and dish detail panels use `recipeNutritionToDetail` so aggregation metadata is visible even when coverage is `0%`.
- `publishRecipeToCloud` stores per-serving `nutrition_json` when a recipe has nutrition coverage.
- Focused tests now cover missing, partial, conflicting, and complete nutrition data plus dish aggregation.

## KITCH-F017 - Feature - Kitchen, Grocery, Recipe slider shell

### Problem Statement

Kitchen, Grocery, and Recipe views should support swipe navigation and media-friendly browsing.

### Desired Outcome

Users can cycle views with left, right, up, and down gestures, plus accessible button equivalents.

### User Scenarios

1. Happy path: Swipe left moves from Kitchen to Grocery.
2. Alternate path: Swipe up opens capture/media mode.
3. Edge case: Reduced-motion users receive simpler transitions.

### Gesture Map - 2026-04-25

| Surface | Swipe left | Swipe right | Swipe up | Swipe down | Button equivalents |
|---------|------------|-------------|----------|------------|--------------------|
| Kitchen | Grocery lists | Recipe slider, routed to `/soon` until a current recipe lane exists | Cooking videos, routed to `/soon` until media mode is attached | Pantry | Visible Grocery, Recipes, Videos, and Pantry buttons in the slider shell |
| Grocery | Recipe slider, routed to `/soon` until list-to-recipe selection exists | Kitchen | Receipt/photo capture, routed to `/soon` until a single grocery capture lane is chosen | Pantry | Visible Recipes, Kitchen, Capture, and Pantry buttons in the slider shell |
| Saved recipe | Grocery lists | Kitchen | Cooking mode/video, routed to `/soon` until cooking media is implemented | Pantry | Visible Grocery, Kitchen, Cook, and Pantry buttons in the slider shell |

All slider shell transitions animate through the local shell. Reduced-motion users bypass transform movement and use the target route directly. Any gesture target that is not finished routes to `/soon` with feature and source context.

### Acceptance Criteria

1. [x] Gesture map is documented before implementation.
2. [x] Every gesture has a visible button alternative.
3. [x] Every transition is animated and respects reduced motion.
4. [x] No card text overlaps at mobile sizes.
5. [x] Future gesture actions route to `/soon`.

### Implementation Notes - 2026-04-25

- Added the standalone `KitchenSliderShell` for Kitchen, Grocery, and Saved Recipe surfaces.
- Left, right, up, and down swipes use the documented map and share the same route handlers as the visible slider buttons.
- The shell animates route transitions with `Animated.timing`; reduced-motion users bypass transform movement through `AccessibilityInfo.isReduceMotionEnabled`.
- Future gesture targets route to `/soon` with feature and source context instead of dead controls.
- The UIUX contract now checks the documented map, shell wiring, gestures, button alternatives, animation, reduced motion, and `/soon` fallback.
- Phase 7 hardening re-verified the shell with focused UIUX tests before marking the mission-control card done.

## KITCH-F018 - Feature - Media-first recipe and pantry cards

### Problem Statement

Kitchen views should encourage pictures and videos, especially for groceries, expiration batches, recipes, and shared data.

### Desired Outcome

Cards support recipe media, batch photos, receipt thumbnails, food-photo crops, and cooking videos while remaining scannable.

### Acceptance Criteria

1. [x] Media slots have stable aspect ratios.
2. [x] Missing media falls back to a useful nonblank state.
3. [x] Recipe videos and photos can appear in slider views.
4. [x] Batch photos and receipt thumbnails appear on pantry details.
5. [x] Media actions route to real pages or `/soon`.

### Implementation Notes - 2026-04-25

- Added standalone `MediaSlot` with stable recipe, pantry batch, receipt, food-photo, and video aspect ratios plus nonblank fallback labels.
- Kitchen saved recipe cards, Grocery list/item rows, Saved Recipe detail, and Pantry batch cards now reserve media space even when no image exists.
- Pantry batch media switches between receipt thumbnail, food-photo crop, expiration photo, and generic batch fallback based on batch source and stored photo evidence.
- Shared `@mylife/bestchef` `RecipeCard` and `PantryItemCard` now expose media-first props and preserve stable slots with nonblank fallbacks for hub parity.
- Shared media cards now expose explicit accessible labels for active controls, and `PantryItemCard` renders a non-interactive container when no row action is supplied so shared cards do not create dead press targets.
- Feed video unfinished actions route to `/soon`; offline download and mute stay real actions.

## KITCH-F019 - Feature - BestChef server product data cache

### Problem Statement

Shared nutrition and product improvements need server storage, but private pantry quantities must stay private.

### Desired Outcome

BestChef server stores normalized product candidates, source metadata, license constraints, contribution status, and moderation state.

### Acceptance Criteria

1. [x] Server product records are separate from private pantry inventory.
2. [x] Product source and license are stored.
3. [x] RLS prevents private pantry data leaks.
4. [x] Media assets can link to product evidence.
5. [x] Shared cache supports web and mobile.

### Technical Context

Extend BestChef cloud schema near `bc_recipe_snapshots` and `bc_media_assets`.

### Implementation Notes - 2026-04-25 Phase 8 Completion

- Added server `bc_product_records`, `bc_product_aliases`, `bc_product_nutrition`, `bc_product_contributions`, and `bc_product_evidence` tables to the authoritative schema and core Supabase migration.
- Product records store source, source id, confidence, license, attribution, fetched timestamp, confirmed timestamp, moderation status, and publication status.
- Public deltas publish only approved, published product records plus approved evidence with explicit image sharing consent.
- Product contribution private payload enforcement is now recursive at the Supabase check-constraint layer, so nested pantry, receipt, local image, raw OCR, parsed receipt, redaction, crop, and candidate keys cannot bypass the TypeScript sanitizer.

## KITCH-F020 - Feature - User contribution and moderation workflow

### Problem Statement

Users should be able to share food data, label photos, corrections, and nutrition improvements safely.

### Desired Outcome

Contribution flow supports private draft, submitted, verified, rejected, and superseded states.

### Acceptance Criteria

1. [x] Users explicitly opt in before sharing product data.
2. [x] Image license and consent are captured.
3. [x] Moderators can approve, reject, or supersede contributions.
4. [x] Users can see contribution status.
5. [x] Open Food Facts contribution rules are respected if data is sent there.

### Implementation Notes - 2026-04-25 Phase 8 Completion

- Contribution records now support `private_draft`, `submitted`, `verified`, `rejected`, and `superseded` states.
- Submission validation strips or rejects private pantry quantities, pantry/batch ids, receipt row ids, receipt image URIs, local image/crop URIs, image base64, raw/redacted OCR text, parsed receipt JSON, redaction JSON, bounding boxes, raw receipt descriptions, and review candidate JSON before server submission.
- Open Food Facts export status is tracked separately from BestChef moderation so upstream contribution rules can be honored before sending data there.

## KITCH-F021 - Feature - Mesh sync policy for kitchen data

### Problem Statement

Kitchen data mixes private inventory, shared recipes, and public product data. Sync scopes must prevent accidental sharing.

### Desired Outcome

Every Kitchen entity declares sync scope and max scope.

### Acceptance Criteria

1. [x] Pantry items and batches default to personal replica.
2. [x] Receipts and source images never publish by default.
3. [x] Shared product data requires explicit contribution.
4. [x] Grocery lists can support personal and shared workspace scopes by policy.
5. [x] Module parity checks pass after policy changes.

### Implementation Notes - 2026-04-25 Phase 8 Completion

- Local food products, aliases, confirmations, nutrition, user unit conversions, pantry items, pantry batches, receipt imports, and receipt lines now declare `maxScope: 'personal_replica'`.
- Receipt import sync strips raw OCR/photo URI, and receipt line sync strips review candidate JSON.
- Shopping lists and shopping list items default to `personal_replica` and can reach `shared_workspace` by policy.
- Direct mesh sharing now checks `maxScope` ordering before sharing an entity, so personal-capped kitchen data cannot be shared as workspace data.
- Server `bc_product_*` product cache tables stay out of local mesh entity rules and publish only through explicit contribution, license/consent, moderation, and approved public-delta paths.

## KITCH-F022 - Feature - Interaction contract expansion

### Problem Statement

The current UIUX guard covers Pressables and routes. Future UI will add gestures, menus, modals, and deferred actions.

### Desired Outcome

The guard test fails when any interactive surface lacks a function, animation, route, or `/soon` fallback.

### Acceptance Criteria

1. [x] Guard covers Pressable, Touchable, menu items, modals, and gesture handlers.
2. [x] Guard recognizes direct pressed animation and route transition animation.
3. [x] Missing future actions must route to `/soon`.
4. [x] Test reports file and line for failures.
5. [x] `pnpm --filter @mylife/bestchef-app test:uiux` is listed in release checks.

### Implementation Notes - 2026-04-25

- Expanded `apps/bestchef/app/(root)/__tests__/uiux-interaction-contract.test.ts` from Pressable and route-only checks to Pressable, Touchable, menu, modal, gesture, route-transition, pressed-feedback, accessibility-label, and `/soon` fallback checks.
- The contract reports file and line references for route and interaction failures so QA output points to the control that needs repair.
- Icon-only Kitchen, Grocery, Pantry, receipt/photo review, expiration OCR, `/soon`, report menu, and error boundary controls now expose explicit accessibility labels where the static contract required one.
- `apps/bestchef/package.json` keeps `test:uiux` as the release check entry point for this contract.

## KITCH-F023 - Feature - Capture workflow test fixtures

### Problem Statement

OCR and vision workflows need deterministic tests to avoid regressions and false confidence.

### Desired Outcome

Receipt, grocery photo, expiration OCR, nutrition resolver, and pantry batch workflows have fixtures for happy paths and edge cases.

### Acceptance Criteria

1. [x] Receipt fixtures include clear, noisy, partial, and sensitive-payment examples.
2. [x] Grocery photo fixtures include multi-item and non-food examples.
3. [x] Expiration fixtures include ambiguous formats.
4. [x] Nutrition resolver fixtures include conflicting sources.
5. [x] Tests cover cancellation and provider outage.

### Implementation Notes - 2026-04-25 QA Expansion

- Added `modules/bestchef/src/import/__tests__/capture-fixtures.test.ts` with deterministic receipt OCR, grocery photo, and expiration OCR fixtures for clear, noisy, partial, ambiguous, sensitive-payment, non-food, provider outage, and cancellation cases.
- Receipt fixtures reuse the shared import draft and receipt OCR provider abstractions, preserve raw sensitive payment text for review provenance, and assert redacted review data does not expose the payment number.
- Grocery photo fixtures cover multi-item recognition, provider-markdown noise, non-food rejection, nutrition provider outage, and no pantry mutation before confirmation.
- Expiration OCR fixtures cover clear labels, ambiguous date formats, missing-date partial OCR, and provider outage without mutating pantry.
- Nutrition resolver fixtures now cover local cache, manual input, USDA FoodData Central, Open Food Facts, and GS1 conflicts with complete, partial, incomplete, and missing-data candidates. All provider behavior is stubbed.

### Implementation Notes - 2026-04-25 Follow-up

- Added deterministic fixtures for receipt OCR provider outage, grocery nutrition provider outage, expiration OCR provider outage, and cancellation before confirmation across receipt, grocery photo, and expiration review flows.
- Provider outages and cancelled reviews leave pantry unchanged until the user confirms selected candidates.

## KITCH-F024 - Feature - Visual and accessibility QA for Kitchen tab

### Problem Statement

Dense grocery, pantry, nutrition, capture, and slider views are prone to overlap, unclear touch targets, and missing accessibility labels.

### Desired Outcome

Kitchen tab QA verifies mobile layouts, accessibility, animation, and text containment.

### Acceptance Criteria

1. [x] Touch targets meet mobile size expectations.
2. [x] Every interactive control has visible text or accessibility label.
3. [x] Long product names do not overlap controls.
4. [x] Reduced motion is respected where applicable.
5. [x] Visual QA screenshots are attached to implementation sessions.

### Visual and Accessibility QA Notes - 2026-04-25

- Kitchen: slider actions have visible button alternatives for gestures, unfinished upload paths route to `/soon`, route transitions are animated, reduced-motion users bypass transform movement, icon-only controls have labels, and media slots use stable aspect ratios to avoid layout jumps.
- Grocery: primary list, custom item, back, and capture controls have labels or visible text; empty-state actions route to real screens or `/soon`; long item names stay in row text columns rather than covering action controls.
- Pantry: top navigation and receipt import controls have labels, batch rows keep use-next and expiration metadata in separate text blocks, filters use stable chip sizing, and no-date or empty states expose real routes.
- Photo review: candidate selection, pantry-only fallback, nutrition source choice, quantity/unit edits, expiration, and confirmation controls are deterministic and confirmation-gated; low-confidence source choices stay unselected until user action.
- Receipt review: line corrections, merge behavior, provider outage state, redacted payment display, and confirmation are tested without live OCR; sensitive payment strings are not surfaced in redacted review data.
- Expiration OCR: clear, ambiguous, partial, and outage states are represented; users can select a candidate date or type one before any batch mutation.
- Nutrition panel: missing values render as missing rather than zero, source confidence and missing fields are visible, and the panel uses label/value rows to keep long source names from overlapping numeric facts.
- Simulator screenshot evidence is attached in `docs/sessions/2026-04-26-bestchef-phase-9-qa-gates-release-readiness.md` for Kitchen, Grocery, Pantry, Receipt Import, Grocery Photo, Expiration Photo, and Recipe Entry. Evidence paths live under `output/playwright/bestchef-phase-9/` and exclude earlier unusable captures that showed the deep-link prompt or debugger warning.

### Implementation Notes - 2026-04-26 Phase 9 Completion

- Completed the remaining screenshot-evidence requirement with 1170x2532 iPhone 16e simulator captures for the core Kitchen tab surfaces.
- Added a UIUX contract assertion that the Phase 9 session doc keeps the screenshot evidence paths attached and that this backlog no longer regresses to a pending screenshot state.
- Expo web was not used for visual QA because the standalone app declares iOS and Android platforms only; simulator evidence came from the installed `com.bestchef.bestchef` app.
