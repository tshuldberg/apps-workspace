# Feature Spec: Nutritional Info Per Recipe

## Metadata
- **Module:** recipes
- **Priority Score:** 28 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [3] x3 + Complexity [3] x2 + CrossModule [4] x1 + PaidUser [3] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 4-5 hours
- **Depends On:** none (rc_nutrition_data table and pantry ingredient matching already exist)
- **Blocks:** Meal plan nutrition summaries (future), Nutrition module cross-module bridge

## Business Context

### Why This Feature Exists
Users expect to see calorie and macro breakdowns when browsing recipes, especially health-conscious cooks who plan meals around nutritional targets. The existing rc_nutrition_data table stores per-pantry-item nutrition, but there is no aggregation layer that sums nutrition across all ingredients in a recipe and presents a per-serving breakdown. This is the highest cross-module score (4) of any Recipes feature because it bridges directly to the Nutrition module.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Paprika | Yes | No (included in $4.99 one-time) | Manual nutrition entry per recipe, no auto-calculation |
| AnyList | Yes | Yes ($11.99/yr) | Auto-calculated from ingredient database, per-serving breakdown |
| Recipe One | No | N/A | No nutrition tracking |
| Forkee | No | N/A | No nutrition tracking |

### Target User
Health-conscious home cooks who currently use MyFitnessPal ($79.99/yr) or Cronometer ($49.99/yr) alongside a separate recipe app. They want recipe nutrition in the same app where they plan meals, without double-entering ingredients. Also targets Paprika users ($4.99) who want auto-calculated nutrition instead of manual entry.

## Technical Context

### Where This Lives in MyLife

```
modules/recipes/src/
  nutrition/                        -- NEW: recipe nutrition engine
    recipe-nutrition.ts             -- Aggregation engine: sum ingredients -> per-serving totals
    recipe-nutrition.test.ts        -- Unit tests for aggregation
  types.ts                          -- Add RecipeNutritionSummary type
  index.ts                          -- Export new functions and types

apps/mobile/app/(recipes)/
  recipe-detail.tsx                 -- MODIFIED: add nutrition card below ingredients
  components/NutritionCard.tsx      -- NEW: displays macro breakdown with visual bars

apps/web/app/recipes/
  [id]/page.tsx                     -- MODIFIED: add nutrition section
  components/NutritionCard.tsx      -- NEW: web version of nutrition card
```

### Wireframe Position

```
Hub Dashboard
  └── MyRecipes card
       └── Recipes tab
            └── Recipe Detail screen
                 ├── Title + Image
                 ├── Time / Difficulty / Servings
                 ├── Ingredients list
                 ├── Nutrition Summary Card ← YOU ARE HERE
                 ├── Steps
                 └── Notes
```

### Data Model

No new tables required. The feature uses existing infrastructure:

- `rc_ingredients` -- ingredient list per recipe (with `item`, `quantity_value`, `unit`)
- `rc_nutrition_data` -- per-pantry-item nutrition (calories, fat_g, carbs_g, protein_g, etc.)
- `rc_pantry_items` -- pantry items with names that match against ingredient items

The engine matches each recipe ingredient to pantry items (using the existing `itemsMatch`/`fuzzyItemMatch` functions), looks up nutrition data, scales by quantity, and sums across all ingredients.

New type (added to types.ts):

```typescript
export interface RecipeNutritionSummary {
  recipeId: string;
  servings: number;
  perServing: NutritionBreakdown;
  total: NutritionBreakdown;
  coverage: number;          // 0-1: fraction of ingredients with nutrition data
  missingIngredients: string[]; // ingredient names without nutrition data
}

export interface NutritionBreakdown {
  calories: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  carbs_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  protein_g: number | null;
  sodium_mg: number | null;
}
```

### Dependencies
- **Internal:** `@mylife/recipes` (existing pantry matching, nutrition CRUD), `@mylife/db` (DatabaseAdapter)
- **External:** None (uses existing Open Food Facts data already in rc_nutrition_data)
- **Cross-Module:** Future bridge to `@mylife/nutrition` module for daily intake tracking. The `RecipeNutritionSummary` type is designed to be consumable by the Nutrition module.

## Functional Requirements

### User Stories
1. As a health-conscious cook, I want to see calorie and macro breakdowns per serving on any recipe so that I can make informed meal choices.
2. As a meal planner, I want to know which ingredients are missing nutrition data so that I can fill in the gaps.
3. As a recipe browser, I want nutrition info to load instantly from local data so that I don't wait for API calls.

### Behavior Specification

1. User opens a recipe detail screen.
2. System matches each ingredient in `rc_ingredients` to the closest `rc_pantry_items` entry using `fuzzyItemMatch`.
3. For each matched pantry item, system looks up `rc_nutrition_data` by `pantry_item_id`.
4. System scales each nutrient by `(ingredient.quantity_value / nutrition.serving_size)` where possible, or uses raw values when serving size is unavailable.
5. System sums all scaled nutrients to produce a `total` NutritionBreakdown.
6. System divides totals by `recipe.servings` (default 1) to produce `perServing`.
7. System calculates `coverage` as `(ingredients with nutrition data) / (total ingredients)`.
8. NutritionCard renders: calories prominently, then fat/carbs/protein as horizontal bars with gram values, then a secondary row with fiber/sugar/sodium.
9. If coverage < 1.0, a subtle "Based on X of Y ingredients" label appears.
10. Tapping the coverage label shows the list of missing ingredients.
11. If coverage = 0 (no nutrition data at all), the card shows an empty state: "Add nutrition data to your pantry items to see recipe nutrition."

### Edge Cases

- Recipe with 0 ingredients: show "Add ingredients to see nutrition" empty state.
- All ingredients missing nutrition data: show empty state with CTA to pantry.
- Recipe with null servings: default to 1 serving for division.
- Ingredient with null quantity_value: use nutrition data as-is (assume 1 serving).
- Ingredient unit mismatch (recipe uses "cups", nutrition uses "grams"): show nutrition as available, mark as approximate with a ~ prefix.
- Module disabled mid-use: card simply won't render (standard module lifecycle).
- Very large quantities (e.g., 10000g): cap display at reasonable precision (1 decimal).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Opening a recipe with matched nutrition data shows a NutritionCard below the ingredients section.
- [ ] **AC-2:** NutritionCard displays calories, fat, carbs, and protein per serving with horizontal progress bars.
- [ ] **AC-3:** Per-serving values update correctly when recipe servings change (via scaling).
- [ ] **AC-4:** Coverage label shows "Based on X of Y ingredients" when some ingredients lack nutrition data.
- [ ] **AC-5:** Tapping coverage label reveals the list of missing ingredient names.
- [ ] **AC-6:** Empty state renders with CTA when no ingredients have nutrition data.
- [ ] **AC-7:** NutritionCard uses Cool Obsidian theme (glass card, accent color #22C55E).

### Technical Criteria
- [ ] **TC-1:** `calculateRecipeNutrition(db, recipeId)` returns a correct `RecipeNutritionSummary` for a recipe with full nutrition data.
- [ ] **TC-2:** `calculateRecipeNutrition` returns coverage=0 and null totals for a recipe with no matched nutrition data.
- [ ] **TC-3:** Per-serving calculation correctly divides totals by recipe.servings.
- [ ] **TC-4:** Ingredient-to-pantry matching uses existing `fuzzyItemMatch` with score >= 0.6 threshold.
- [ ] **TC-5:** Nutrition aggregation completes in <50ms for recipes with up to 30 ingredients.
- [ ] **TC-6:** All new types pass Zod validation and typecheck.

### Negative Criteria
- [ ] **NC-1:** This feature must NOT make any network calls. All data comes from local SQLite.
- [ ] **NC-2:** This feature must NOT modify existing rc_nutrition_data or rc_pantry_items records.
- [ ] **NC-3:** NutritionCard must NOT appear on recipe cards in list view (only on detail screen).

## UI Specification

### Mobile (Expo)
- **NutritionCard** sits between ingredients and steps sections on recipe-detail.tsx.
- Card uses glass morphism: `rgba(255,255,255,0.04)` fill, `rgba(255,255,255,0.10)` border, 12px border radius.
- Calories displayed large (24px, bold, `#F0F0F5`).
- Three horizontal bars for Fat/Carbs/Protein, each with gram value right-aligned.
- Bar colors: Fat `#FF9F43` (amber), Carbs `#54A0FF` (blue), Protein `#22C55E` (module accent green).
- Secondary row (fiber, sugar, sodium) in `rgba(240,240,245,0.65)` (textSecondary), smaller font.
- Coverage label in textSecondary, 12px font.

### Web (Next.js)
- Same NutritionCard layout, implemented with CSS variables from globals.css.
- Responsive: full-width card on mobile breakpoints, max-width 400px on desktop.
- Accessible via `/recipes/[id]` route (existing page, new section).

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton shimmer in card area | Initial ingredient/nutrition query |
| Empty | "Add nutrition data to your pantry items" + pantry link | No nutrition data for any ingredient |
| Partial | Nutrition card + "Based on X of Y ingredients" label | Some ingredients have data |
| Success | Full nutrition card, no coverage warning | All ingredients matched |
| Error | Card hidden (graceful degradation) | Unexpected query failure |

## Test Requirements

### Unit Tests
- [ ] `calculateRecipeNutrition`: returns correct totals for 3-ingredient recipe with full data
- [ ] `calculateRecipeNutrition`: returns correct per-serving when servings = 4
- [ ] `calculateRecipeNutrition`: handles recipe with 0 ingredients (coverage 0)
- [ ] `calculateRecipeNutrition`: handles all-unmatched ingredients (coverage 0)
- [ ] `calculateRecipeNutrition`: handles mixed matched/unmatched (partial coverage)
- [ ] `calculateRecipeNutrition`: defaults to servings=1 when recipe.servings is null
- [ ] `calculateRecipeNutrition`: handles null quantity_value gracefully
- [ ] `NutritionBreakdown` sums correctly across multiple nutrition records

### Integration Tests
- [ ] Full flow: create recipe with ingredients -> add pantry items with nutrition -> verify summary
- [ ] Scaling flow: change servings -> verify per-serving values update

### QA Verification Script

1. Open the app on iOS simulator.
2. Navigate to MyRecipes module.
3. Open a recipe that has ingredients matching pantry items with nutrition data.
4. Verify: NutritionCard appears below ingredients section -- corresponds to AC-1.
5. Verify: Card shows calories prominently, with fat/carbs/protein bars -- corresponds to AC-2.
6. Navigate back. Open a recipe with NO matching pantry nutrition data.
7. Verify: Empty state card with "Add nutrition data" message appears -- corresponds to AC-6.
8. Navigate back. Open a recipe where 2 of 5 ingredients have nutrition data.
9. Verify: Card shows nutrition with "Based on 2 of 5 ingredients" label -- corresponds to AC-4.
10. Tap the coverage label.
11. Verify: Missing ingredient names are displayed -- corresponds to AC-5.
12. Open the same recipe on web at `/recipes/[id]`.
13. Verify: Same NutritionCard layout renders correctly -- corresponds to AC-1.
14. Verify: Card uses Cool Obsidian dark theme -- corresponds to AC-7.

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to recipe detail, verify NutritionCard in all 5 states

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for nutrition aggregation engine

### Post-merge:
- [ ] `/parity-check` -- recipes module has archived standalone

## Handoff State

### Before This Work
- `rc_nutrition_data` table exists with per-pantry-item nutrition records.
- `fuzzyItemMatch` and `itemsMatch` exist in `pantry/index.ts` for ingredient-to-pantry matching.
- No aggregation layer exists to sum nutrition across a recipe's ingredients.
- No UI displays recipe-level nutrition information.

### After This Work
- `calculateRecipeNutrition(db, recipeId)` engine function computes per-serving and total nutrition.
- `RecipeNutritionSummary` and `NutritionBreakdown` types exported from module.
- NutritionCard component on both mobile and web recipe detail screens.
- Coverage indicator shows data completeness.

### Files Changed
- `modules/recipes/src/nutrition/recipe-nutrition.ts` -- NEW: aggregation engine
- `modules/recipes/src/nutrition/recipe-nutrition.test.ts` -- NEW: unit tests
- `modules/recipes/src/types.ts` -- ADD RecipeNutritionSummary, NutritionBreakdown
- `modules/recipes/src/index.ts` -- ADD exports
- `apps/mobile/app/(recipes)/recipe-detail.tsx` -- ADD NutritionCard section
- `apps/mobile/app/(recipes)/components/NutritionCard.tsx` -- NEW: mobile nutrition card
- `apps/web/app/recipes/[id]/page.tsx` -- ADD NutritionCard section
- `apps/web/app/recipes/components/NutritionCard.tsx` -- NEW: web nutrition card

### Known Limitations
- Unit conversion between recipe units and nutrition serving sizes is approximate (no universal conversion table).
- Manual nutrition entry for ingredients without pantry matches is not included (future feature).
- Does not aggregate across meal plans (future: meal plan nutrition summary).

### Context for Next Agent
- The `fuzzyItemMatch` function in `pantry/index.ts` returns a score 0-1. Use a threshold of 0.6 for "matched."
- `rc_nutrition_data.pantry_item_id` links nutrition to pantry items. Query by pantry_item_id after matching ingredients to pantry.
- The Nutrition module (`modules/nutrition/`) will eventually consume `RecipeNutritionSummary` via cross-module imports. Design the interface to be module-boundary-clean.
