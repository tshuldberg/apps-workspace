# BestChef Local Kitchen Management

Date: 2026-04-24
Status: Implemented
Surface: `apps/bestchef` standalone app, shared logic in `modules/bestchef`

## Goal

BestChef must include the private kitchen tools that already exist in the MyLife Recipes codebase: saved recipes, pantry inventory, and persistent grocery lists. The standalone app should not be only a public competition surface. A user should be able to save a recipe, flag it for groceries, add flagged recipes to any grocery list, manage multiple saved lists, and keep a pantry inventory.

## Existing Assets

- Shared local schema already has `rc_recipes`, `rc_ingredients`, `rc_steps`, `rc_pantry_items`, `rc_pantry_staples`, `rc_shopping_lists`, and `rc_shopping_list_items`.
- Shared package already exposes recipe CRUD, pantry CRUD, shopping-list CRUD, ingredient parsing, grocery categorization, pantry matching, and meal-plan shopping-list generation.
- Standalone BestChef already initializes `RECIPES_MODULE.migrations` and has an Expo SQLite adapter.
- Current standalone app routes focus on social BestChef: home, dishes, leaderboard, profile, settings, submit, dish detail, recipe detail.

## Required Behavior

1. Saved recipes
   - Users can create a private saved recipe with title, description, servings, prep time, cook time, difficulty, ingredients, and steps.
   - Saved recipes appear in a Kitchen screen.
   - Recipe detail shows structured ingredients and instructions.
   - Users can favorite a saved recipe and mark it with a Grocery flag.

2. Grocery flags
   - A Grocery flag is persistent recipe state, separate from a specific shopping list.
   - Flagged recipes can be bulk-added to the selected grocery list.
   - Users can also add one recipe directly to a chosen list from recipe detail.
   - Removing the flag does not delete existing grocery-list items.

3. Grocery lists
   - Users can create, rename/archive, restore, delete, and switch between multiple lists.
   - Each list stores custom items and recipe-sourced items.
   - Items can be checked or unchecked.
   - Checked items can be copied into pantry inventory.
   - Lists remain saved after navigation and app restart.

4. Pantry
   - Users can add, update, and delete pantry items.
   - Pantry items track quantity, unit, storage location, grocery section, and expiration date.
   - Pantry view supports search, storage filters, and expiration-aware display.

## Data Model

Add `rc_recipe_grocery_flags`:

| Column | Purpose |
|---|---|
| `recipe_id` | Primary key and foreign key to `rc_recipes.id` |
| `default_multiplier` | Quantity multiplier used when adding recipe ingredients to a list |
| `created_at` | First flag timestamp |
| `updated_at` | Latest flag update timestamp |

Sync scope should be `personal_replica`, matching private local recipes.

## UI Routes

- `/(tabs)/kitchen`: private kitchen dashboard, saved recipe library, grocery and pantry entry points.
- `/recipes/new`: create a saved private recipe.
- `/saved-recipe/[id]`: saved recipe detail, grocery flag, favorite, add-to-list actions.
- `/grocery`: list manager and selected shopping list detail.
- `/pantry`: pantry manager.

## Review Risks

- Do not mix public `rc_bestchef_submissions` with private `rc_recipes`. Public submission detail remains `/recipe/[id]`; private recipe detail uses `/saved-recipe/[id]`.
- Avoid creating a parallel grocery implementation in app-only settings JSON. Use shared `@mylife/bestchef` SQLite tables and functions.
- Migrations must be additive. Existing `schemaVersion` is 10 from media cache work, so this feature uses version 11.
- Keep Expo Router paths unambiguous and wire buttons from Home, Settings, and the new Kitchen tab.
- The UI must stay usable with zero recipes, zero lists, or zero pantry items.

## Implemented Scope

- Added `rc_recipe_grocery_flags` as schema v11 and registered it as `personal_replica` sync state.
- Added shared step CRUD and Grocery flag APIs in `@mylife/bestchef`.
- Added standalone data helpers in `apps/bestchef/app/(root)/data/kitchen.ts`.
- Added Kitchen tab, private recipe creation/detail routes, grocery-list manager, and pantry manager.
- Wired Home and Settings entry points to the new Kitchen, Grocery, and Pantry surfaces.
- Added focused shared-module and standalone-app tests for recipe steps, Grocery flags, flagged recipe list expansion, and pantry copy flows.

## Verification

- `pnpm --filter @mylife/bestchef typecheck`
- `pnpm --filter @mylife/bestchef test`
- `pnpm --filter @mylife/bestchef-app typecheck`
- `pnpm --filter @mylife/bestchef-app test`
- `pnpm gate:function:changed`
- `pnpm check:parity --quiet`
- `pnpm --filter @mylife/bestchef-app build`
