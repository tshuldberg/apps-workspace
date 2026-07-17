# BestChef Local Kitchen Research

Date: 2026-04-24
Project: BestChef
Workspace: `/Users/trey/Desktop/Apps/MyLife`
Primary surfaces: `/Users/trey/Desktop/Apps/MyLife/apps/bestchef`, `/Users/trey/Desktop/Apps/MyLife/modules/bestchef`

## Executive Summary

BestChef previously had the local recipe manager substrate in the shared `@mylife/bestchef` module, but the standalone app remained focused on social BestChef workflows. The MyLife Recipes mobile and web surfaces already exposed recipes, shopping lists, and pantry routes, and the shared module already had the core SQLite tables for recipes, ingredients, steps, pantry items, shopping lists, categorization, and ingredient parsing.

The correct implementation path was to port the user-facing kitchen workflows into `apps/bestchef` while extending the shared module only where durable state or missing CRUD APIs were required. That avoids a parallel app-only grocery system and keeps private kitchen data in the same `rc_` schema as the hub recipes module.

## Observed Architecture

| Area | Path | Finding |
|---|---|---|
| Standalone app | `/Users/trey/Desktop/Apps/MyLife/apps/bestchef` | Expo Router app with 38 `.ts` and 32 `.tsx` source files under `app/`; package has 36 dependencies and 4 dev dependencies. |
| Shared module | `/Users/trey/Desktop/Apps/MyLife/modules/bestchef` | Canonical business logic for registry module id `recipes`; `src/` has 115 `.ts`, 10 `.tsx`, and 1 `.sql` file. |
| Existing Recipes UI | `/Users/trey/Desktop/Apps/MyLife/apps/mobile/app/(recipes)` | Full hub UI already included `shopping-lists.tsx`, `shopping-list.tsx`, `pantry.tsx`, `meal-plan.tsx`, and recipe import/detail screens. |
| Existing Recipes web UI | `/Users/trey/Desktop/Apps/MyLife/apps/web/app/recipes` | Web recipes routes already included `grocery/`, `pantry/`, `library/`, `meal-planner/`, and recipe actions. |
| Active schema | `/Users/trey/Desktop/Apps/MyLife/modules/bestchef/src/db/schema.ts` | Existing local tables covered recipes, ingredients, steps, pantry, shopping lists, and media cache. Grocery flags were the missing persistent recipe-level state. |

## Gap Analysis

| Requirement | Pre-work status | Action taken |
|---|---|---|
| Save private recipes in BestChef | Shared CRUD existed, standalone UI missing | Added `/recipes/new`, Kitchen tab, saved recipe detail, and app data helpers. |
| Store recipe instructions | `rc_steps` table existed, shared step CRUD was not exported | Added `addStep`, `getSteps`, `updateStep`, and `deleteStep`. |
| Persistent Grocery flag | Missing durable table and APIs | Added `rc_recipe_grocery_flags` schema v11 and shared flag APIs. |
| Multiple grocery lists | Shared list tables/APIs existed, standalone UI missing | Added `/grocery` list switcher, create/archive/restore/delete, manual items, checked state, and recipe expansion. |
| Pantry management | Shared pantry CRUD existed, standalone UI missing | Added `/pantry` inventory UI with search, expiration state, add/update/delete, and use-one decrement. |
| UI wiring | No standalone entry points | Added Kitchen tab plus Home and Settings links. |
| Parity safety | Standalone social routes used `/recipe/[id]` | Private saved recipes use `/saved-recipe/[id]` to avoid mixing public submissions with private recipes. |

## Data Model Review

The only new table required was `rc_recipe_grocery_flags`:

| Column | Purpose |
|---|---|
| `recipe_id` | Primary key and foreign key to `rc_recipes.id` |
| `default_multiplier` | Default recipe scaling when adding flagged ingredients to a grocery list |
| `created_at` | First flag timestamp |
| `updated_at` | Latest flag update timestamp |

Review decision: Grocery flags are recipe-level intent, not shopping-list items. Removing a Grocery flag should not delete ingredients already copied into a list. Existing grocery list items remain user-managed list state.

Sync decision: `recipe_grocery_flags` is `personal_replica`, matching private recipes and avoiding public social leakage.

## Implemented Files

| File | Purpose | Lines |
|---|---|---:|
| `/Users/trey/Desktop/Apps/MyLife/apps/bestchef/app/(root)/data/kitchen.ts` | Standalone helper layer over shared recipe, grocery, and pantry APIs | 305 |
| `/Users/trey/Desktop/Apps/MyLife/apps/bestchef/app/(root)/(tabs)/kitchen.tsx` | Kitchen dashboard and saved recipe library | 239 |
| `/Users/trey/Desktop/Apps/MyLife/apps/bestchef/app/(root)/recipes/new.tsx` | Private saved recipe creation | 239 |
| `/Users/trey/Desktop/Apps/MyLife/apps/bestchef/app/(root)/saved-recipe/[id].tsx` | Private recipe detail, favorite, Grocery flag, add-to-list | 274 |
| `/Users/trey/Desktop/Apps/MyLife/apps/bestchef/app/(root)/grocery.tsx` | Multiple grocery list manager | 344 |
| `/Users/trey/Desktop/Apps/MyLife/apps/bestchef/app/(root)/pantry.tsx` | Pantry inventory manager | 308 |
| `/Users/trey/Desktop/Apps/MyLife/modules/bestchef/src/db/shopping-lists.ts` | Shared shopping-list and Grocery flag APIs | 414 |
| `/Users/trey/Desktop/Apps/MyLife/modules/bestchef/src/db/crud.ts` | Shared recipe, ingredient, step, and detail CRUD | 723 |

## Test And Validation Review

Added or updated tests:

- `/Users/trey/Desktop/Apps/MyLife/modules/bestchef/src/__tests__/recipes.test.ts`
- `/Users/trey/Desktop/Apps/MyLife/modules/bestchef/src/__tests__/shopping-lists.test.ts`
- `/Users/trey/Desktop/Apps/MyLife/modules/bestchef/src/social/__tests__/follower-updates.test.ts`
- `/Users/trey/Desktop/Apps/MyLife/apps/bestchef/app/(root)/data/__tests__/kitchen.test.ts`

Validation run:

- `pnpm --filter @mylife/bestchef typecheck`: passed.
- `pnpm --filter @mylife/bestchef test`: passed, 44 files and 609 tests.
- `pnpm --filter @mylife/bestchef-app typecheck`: passed.
- `pnpm --filter @mylife/bestchef-app test`: passed, 4 files and 18 tests.
- `pnpm gate:function:changed`: passed.
- `pnpm check:parity --quiet`: passed with existing inventory warnings only.
- `pnpm --filter @mylife/bestchef-app build`: passed for Android and iOS Expo export.

## Risks And Recommendations

Immediate:

- Keep public submission routes and private saved recipe routes separate. Do not reuse `/recipe/[id]` for private saved recipes.
- Keep Grocery flags in shared SQLite APIs. Do not add app-only JSON storage for grocery state.
- Preserve `personal_replica` scope for private kitchen entities.

Short-term:

- Add edit flows for saved recipes, grocery list names, and pantry quantities beyond the current focused controls.
- Add import-to-private-recipe paths from URL/photo/video once the standalone import UX is ready to share the same helper layer.
- Add a visual "already in pantry" subtraction mode when adding recipe ingredients to a grocery list.

Long-term:

- Decide whether BestChef standalone should expose meal planning, cooking mode, and collections from the existing MyLife Recipes surfaces.
- Add cloud backup/export for private recipes only after the mesh sync privacy policy is fully reflected in UI copy and pairing flow.

## Conclusion

The feature should live as a thin standalone UI over the canonical `@mylife/bestchef` local recipe manager. The implementation now follows that shape: durable state is in shared `rc_` tables, BestChef app routes expose complete Kitchen, Grocery, and Pantry workflows, and validation gates pass.
