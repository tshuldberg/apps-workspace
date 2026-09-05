# MyRecipes Module Audit

**ID:** recipes | **Prefix:** rc_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.2.0
**One-line promise:** Your kitchen, completely private

## User Value
- Full recipe library with ingredients, steps, tags, scaling, and print mode
- Meal planner that auto-generates aisle-grouped shopping lists
- Pantry tracking with barcode lookup (Open Food Facts) and AI food identification
- Import from URLs (JSON-LD/Microdata), photos, and videos (YouTube/TikTok/Instagram)
- Cooking mode with voice commands, step timers, and hands-free navigation

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Recipe CRUD + ingredients/steps/tags | src/db/crud.ts | shipped |
| Collections | src/db/collections.ts | shipped |
| Per-recipe nutrition | src/db/nutrition.ts | shipped |
| Pantry inventory + staples | src/db/pantry.ts | shipped |
| Meal planner + shopping list gen | src/db/mygarden.ts | shipped |
| Custom shopping lists | schema V5 | shipped |
| Share tokens | schema V6 | shipped |
| URL recipe parser (JSON-LD/Microdata/Meta) | src/parser/url-parser.ts | shipped |
| Barcode lookup | src/pantry/open-food-facts.ts | shipped (network) |
| AI food recognition | src/pantry/food-recognition.ts | shipped (Claude Vision) |
| Cooking mode + voice control | src/voice, app/(recipes)/cooking-mode.tsx | shipped |
| Video import | app/(recipes)/import-video.tsx | shipped |
| Print HTML | src/print | shipped |
| Cross-module deep links (Garden, RSVP) | src/integrations | shipped |

## Data Model
Prefix `rc_`, schema v7. Tables: rc_recipes, rc_ingredients, rc_steps, rc_recipe_tags, rc_settings, rc_collections, rc_recipe_collections, rc_nutrition_data, rc_pantry_items, rc_pantry_staples, rc_meal_plans, rc_meal_plan_items, rc_shopping_lists, rc_shopping_list_items, rc_share_tokens. V7 dropped legacy gd_/ev_ tables (garden + rsvp modules now own that data).

## Screens / User Flows
Mobile tabs: Home, Recipes, Meal Planner, Settings. Screens: recipe detail, add, cooking-mode, import-url, import-photo, import-video, import-review, shopping-lists, pantry, collections, print-preview. Web routes: library, add, collections, meal-planner, grocery, pantry, import, settings.

## Distinctive / Moat-worthy
- Multi-source import pipeline (URL + photo + video + voice transcript) with AI fallback
- Cross-module orchestration (cook from garden harvest, plan food for RSVP) without owning the data
- 189 tests across 16 files; fully offline-capable for core flows

## Gaps vs competitors
- No ingredient substitution suggestions (Whisk/Samsung Food)
- No social recipe discovery (AnyList shared lists exist, but MyLife keeps local-first)
- No video hosting or first-party recipe marketplace

## Investor-facing hook
A private Whisk + Paprika replacement with AI import, voice cooking, and cross-module meal-to-garden-to-party orchestration at zero marginal cloud cost.
