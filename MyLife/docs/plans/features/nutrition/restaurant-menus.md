# Feature Spec: Restaurant Menus

## Metadata
- **Module:** nutrition
- **Priority Score:** 31 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 4 x3 + Complexity 1 x2 + CrossModule 1 x1 + PaidUser 4 x1
- **Sprint:** 5
- **Estimated CC Time:** 5-6 hours
- **Depends On:** none
- **Blocks:** none

## Business Context

### Why This Feature Exists
Restaurant menu integration is a major switching motivator (4/5) and premium driver (4/5). MyFitnessPal's restaurant database with 500k+ restaurant items is one of its key moat features. Lose It! similarly integrates restaurant nutrition data. Eating out is where calorie tracking breaks down for most users because they can't easily find restaurant-specific nutrition info. Complexity is 1 (hard) because it requires building a restaurant food database, search system, and user contribution pipeline. This is a key competitive feature for paid user conversion.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| MyFitnessPal | Yes | Partial (premium for verified) | 500k+ restaurant items, user-contributed, barcode verified |
| Lose It! | Yes | Yes ($39.99/yr) | Restaurant menu integration, chain database |
| Cronometer | Partial | Yes ($49.99/yr) | Some restaurant items via user community |
| MacroFactor | No | N/A | No restaurant database |

### Target User
Users who eat out frequently and struggle to log restaurant meals accurately. Users who want to make informed choices at restaurants by seeing nutrition info before ordering. Premium users who value the convenience of one-tap logging for chain restaurant items.

## Technical Context

### Where This Lives in MyLife

```
modules/nutrition/src/restaurant/types.ts       -- Restaurant and menu item types
modules/nutrition/src/restaurant/crud.ts         -- Restaurant + menu item CRUD
modules/nutrition/src/restaurant/search.ts       -- Restaurant search engine
modules/nutrition/src/restaurant/seed.ts         -- Initial chain restaurant seed data
modules/nutrition/src/db/schema.ts               -- New nu_restaurants, nu_menu_items tables
modules/nutrition/src/index.ts                   -- Export restaurant functions
apps/mobile/app/(nutrition)/restaurants.tsx       -- Restaurant browser screen
apps/mobile/app/(nutrition)/restaurant-detail.tsx -- Restaurant menu view
apps/mobile/app/(nutrition)/add-restaurant.tsx    -- User contribution screen
```

### Wireframe Position

```
Hub Dashboard
  └── MyNutrition card
       └── Search tab
            └── Restaurant section ← YOU ARE HERE
                 ├── Search restaurants
                 ├── Popular chains
                 ├── Restaurant detail (menu items)
                 └── Log from restaurant menu
```

### Data Model

```sql
-- Restaurant chains and local restaurants
CREATE TABLE IF NOT EXISTS nu_restaurants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('fast_food', 'casual', 'fine_dining', 'cafe', 'pizza', 'asian', 'mexican', 'other')),
  chain INTEGER NOT NULL DEFAULT 0,        -- 1 if chain (McDonald's), 0 if local
  logo_emoji TEXT,                          -- Emoji for display (no images stored)
  website TEXT,
  source TEXT NOT NULL DEFAULT 'seed' CHECK (source IN ('seed', 'user', 'api')),
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Menu items with nutrition data
CREATE TABLE IF NOT EXISTS nu_menu_items (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES nu_restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,                            -- 'Burgers', 'Salads', 'Drinks', etc.
  serving_size TEXT,                        -- '1 sandwich', '12 oz', etc.
  calories REAL NOT NULL DEFAULT 0,
  protein_g REAL NOT NULL DEFAULT 0,
  carbs_g REAL NOT NULL DEFAULT 0,
  fat_g REAL NOT NULL DEFAULT 0,
  fiber_g REAL NOT NULL DEFAULT 0,
  sodium_mg REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'seed' CHECK (source IN ('seed', 'user', 'official')),
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- FTS for restaurant and menu item search
CREATE VIRTUAL TABLE IF NOT EXISTS nu_restaurants_fts USING fts5(
  name, content='nu_restaurants', content_rowid='rowid'
);

CREATE VIRTUAL TABLE IF NOT EXISTS nu_menu_items_fts USING fts5(
  name, description, category, content='nu_menu_items', content_rowid='rowid'
);

CREATE INDEX IF NOT EXISTS nu_restaurants_category_idx ON nu_restaurants(category);
CREATE INDEX IF NOT EXISTS nu_restaurants_chain_idx ON nu_restaurants(chain);
CREATE INDEX IF NOT EXISTS nu_menu_items_restaurant_idx ON nu_menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS nu_menu_items_category_idx ON nu_menu_items(category);
```

### Dependencies
- **Internal:** `@mylife/db`, nu_foods (can create food entries from menu items), nu_food_log (log menu items as meals)
- **External:** None for MVP. Future: Nutritionix API for verified restaurant data.
- **Cross-Module:** Minimal cross-module interaction. Food items created from restaurant menus join the standard nu_foods table and work with all existing nutrition features.

## Functional Requirements

### User Stories
1. As a user eating at a chain restaurant, I want to find the restaurant and see nutrition info for menu items so I can make informed choices.
2. As a user, I want to log a restaurant menu item as a meal with one tap.
3. As a user, I want to add a restaurant or menu item that isn't in the database.
4. As a user, I want to search across all restaurants and menu items to find specific foods.

### Behavior Specification

**Restaurant search:**
1. User navigates to Search tab
2. A "Restaurants" section appears (below the existing food search)
3. User can browse by category (fast food, casual, cafe, etc.) or search by name
4. Popular chains shown as quick-access cards (McDonald's, Chipotle, Starbucks, etc.)
5. Tapping a restaurant opens its detail view

**Restaurant detail:**
1. Shows restaurant name, category, and menu item count
2. Menu items grouped by category (Burgers, Salads, Drinks, Sides, etc.)
3. Each item shows name, calories, and macro summary
4. Tapping an item shows full nutrition detail
5. "Add to Diary" button logs the item to today's food log

**Logging a restaurant item:**
1. User taps "Add to Diary" on a menu item
2. System creates a food entry in nu_foods (source='user', with restaurant context in brand field)
3. System adds a food log item to the selected meal (breakfast/lunch/dinner/snack)
4. User can adjust serving count before confirming
5. Confirmation shows the item added to today's diary

**User contribution:**
1. User taps "Add Restaurant" or "Add Menu Item" on the detail screen
2. For restaurant: name, category, chain/local toggle
3. For menu item: name, category, serving size, calories, macros (protein/carbs/fat)
4. Submitted items marked as source='user', verified=0
5. User-contributed items available immediately to that user

**Seed data:**
1. Ship with 20-30 popular US chain restaurants and 5-10 menu items each
2. Chains: McDonald's, Chipotle, Starbucks, Subway, Chick-fil-A, Taco Bell, Wendy's, Panera, Panda Express, In-N-Out, Five Guys, Shake Shack, Sweetgreen, Popeyes, Domino's, Pizza Hut, Dunkin', Wingstop, Cava, Raising Cane's
3. Nutrition data from publicly available restaurant nutrition PDFs (all major chains publish these)
4. Seed data source='seed', verified=1

### Edge Cases

- **Restaurant not found:** Show "Add Restaurant" CTA. Don't block the user.
- **Menu item has no nutrition data:** Allow adding with 0 values. Show "Nutrition info unavailable" badge.
- **Duplicate restaurant name:** Allow. Differentiate by category or mark as local vs chain.
- **Duplicate menu item:** Allow. Chain restaurants have regional menu variations.
- **Very long menu (100+ items):** Paginate or use expandable category sections.
- **User contributes incorrect data:** Accepted as-is (source='user', verified=0). No validation beyond field types.
- **Logging from restaurant when no meals exist today:** Auto-create a food log entry for the appropriate meal type based on time of day.
- **Chain restaurant with seasonal items:** User can add seasonal items. They persist in the database.
- **Searching across restaurants and regular foods:** Restaurant items appear in a separate "Restaurant" section in search results, not mixed with regular food entries.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Restaurant section visible on Search tab with category browsing
- [ ] **AC-2:** Popular chain restaurants shown as quick-access cards
- [ ] **AC-3:** Restaurant search by name returns matching restaurants
- [ ] **AC-4:** Restaurant detail shows menu items grouped by category
- [ ] **AC-5:** Menu item shows calories and macro summary
- [ ] **AC-6:** "Add to Diary" logs the item to today's food log with one tap
- [ ] **AC-7:** Serving count adjustable before confirming
- [ ] **AC-8:** User can add a new restaurant
- [ ] **AC-9:** User can add a new menu item to a restaurant
- [ ] **AC-10:** Seed data includes 20+ chain restaurants with menu items

### Technical Criteria
- [ ] **TC-1:** nu_restaurants and nu_menu_items tables created by migration v4
- [ ] **TC-2:** FTS tables (nu_restaurants_fts, nu_menu_items_fts) created with sync triggers
- [ ] **TC-3:** Seed data inserted via migration (source='seed', verified=1)
- [ ] **TC-4:** Restaurant item logged as nu_foods entry (source='user') and nu_food_log_item
- [ ] **TC-5:** Search queries both FTS tables and returns ranked results
- [ ] **TC-6:** Menu item CRUD includes proper FK to restaurant (CASCADE delete)

### Negative Criteria
- [ ] **NC-1:** Must NOT require network access for core browsing and logging (all data local)
- [ ] **NC-2:** Must NOT store restaurant logos as images (emoji only)
- [ ] **NC-3:** Must NOT mix restaurant items with regular food search results (separate section)

## UI Specification

### Mobile (Expo)
- **Restaurant section (Search tab):** Horizontal scroll of category filter chips. Below: popular chain cards (glass fill, emoji + name, `#F97316` accent border on selected). Search bar at top with "Search restaurants..." placeholder.
- **Restaurant detail:** Header with emoji, name, category badge. Menu items in expandable glass card sections per category. Each item: name (primary text), calories + macro pills (secondary text), "+" button to add.
- **Add to Diary sheet:** Bottom sheet with item name, serving count stepper, meal type selector, "Add" button in `#F97316`.
- **User contribution:** Form screen with text inputs and category picker. "Submit" button.

### Web (Next.js)
- `/nutrition/restaurants` route. Grid layout for restaurant cards. Detail at `/nutrition/restaurants/[id]`.
- Menu items in a table layout with sortable columns.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Browse | Category chips + popular chains | Initial navigation |
| Search results | Matching restaurants list | Search query entered |
| Restaurant detail | Menu items by category | Restaurant tapped |
| Item detail | Full nutrition info + "Add to Diary" | Menu item tapped |
| Empty restaurant | "Add menu items to get started" | User-created restaurant with no items |
| No results | "Restaurant not found. Add it?" CTA | Search has no matches |

## Test Requirements

### Unit Tests
- [ ] `createRestaurant`: stores name, category, chain flag, source
- [ ] `getRestaurantById`: retrieves with menu item count
- [ ] `searchRestaurants`: FTS search returns matching restaurants
- [ ] `searchRestaurants`: empty query returns all (paginated)
- [ ] `createMenuItem`: stores all nutrition fields with FK
- [ ] `getMenuItems`: returns items for a restaurant grouped by category
- [ ] `searchMenuItems`: FTS search across name and description
- [ ] `logMenuItemAsMeal`: creates nu_foods entry + nu_food_log_item in transaction
- [ ] `logMenuItemAsMeal`: adjusts nutrition for serving count
- [ ] `deleteRestaurant`: cascades to delete all menu items
- [ ] `getPopularChains`: returns chain=1 restaurants sorted by name

### Integration Tests
- [ ] Full flow: search restaurant -> view menu -> tap "Add to Diary" -> item in food log -> daily totals updated
- [ ] Contribution flow: add restaurant -> add menu item -> search finds new restaurant

### QA Verification Script

1. Navigate to MyNutrition > Search tab
2. Verify: Restaurant section visible with category chips -- corresponds to AC-1
3. Verify: Popular chain cards shown (McDonald's, Chipotle, etc.) -- corresponds to AC-2
4. Search "Chipotle"
5. Verify: Chipotle appears in results -- corresponds to AC-3
6. Tap Chipotle
7. Verify: Menu items grouped by category (Burritos, Bowls, etc.) -- corresponds to AC-4
8. Verify: Each item shows calories and macros -- corresponds to AC-5
9. Tap "Chicken Burrito"
10. Tap "Add to Diary"
11. Verify: Serving count stepper shown -- corresponds to AC-7
12. Confirm with 1 serving
13. Verify: Item added to today's food log -- corresponds to AC-6
14. Return to restaurants
15. Tap "Add Restaurant"
16. Enter a local restaurant name and category
17. Verify: Restaurant created -- corresponds to AC-8
18. Tap the new restaurant
19. Tap "Add Menu Item"
20. Enter item name, calories, macros
21. Verify: Item added to restaurant -- corresponds to AC-9
22. Verify: 20+ seed restaurants available -- corresponds to AC-10

## gstack Quality Gates

Based on Complexity 1 (Inverse), this feature is "Complex" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Required if Complexity <= 2:
- [ ] `/plan-eng-review` -- run on this spec BEFORE building

### Required if Complexity <= 1:
- [ ] `/office-hours` (builder mode) -- validate approach

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for restaurant search ranking

### Post-merge:
- [ ] `/parity-check` -- skip (no standalone)

## Handoff State

### Before This Work
Nutrition module has a food database (USDA + Open Food Facts + FatSecret + custom + AI photo) but no restaurant-specific browsing or menu item database.

### After This Work
- Restaurant database with 20+ seeded US chains
- Menu item database with 100+ seeded items (5-10 per chain)
- FTS search for restaurants and menu items
- One-tap logging from restaurant menus to food diary
- User contribution pipeline for new restaurants and items
- Category-based browsing (fast food, casual, cafe, etc.)

### Files Changed
- `modules/nutrition/src/restaurant/types.ts` -- New: restaurant and menu item types
- `modules/nutrition/src/restaurant/crud.ts` -- New: restaurant + menu item CRUD
- `modules/nutrition/src/restaurant/search.ts` -- New: FTS search engine
- `modules/nutrition/src/restaurant/seed.ts` -- New: seed data for 20+ chains
- `modules/nutrition/src/db/schema.ts` -- Extended: nu_restaurants, nu_menu_items, FTS tables
- `modules/nutrition/src/db/migrations.ts` -- Extended: migration v4
- `modules/nutrition/src/definition.ts` -- Bump schemaVersion, add restaurant screens
- `modules/nutrition/src/index.ts` -- Export restaurant functions
- `apps/mobile/app/(nutrition)/restaurants.tsx` -- Restaurant browser
- `apps/mobile/app/(nutrition)/restaurant-detail.tsx` -- Restaurant menu view
- `apps/mobile/app/(nutrition)/add-restaurant.tsx` -- User contribution

### Known Limitations
- No API integration for live restaurant data (all local/seeded)
- No location-based restaurant discovery (no GPS)
- No menu item photos
- No community sharing of user-contributed restaurants
- Seed data is US chains only (no international coverage)
- No menu item verification system (user-contributed items are unverified)
- No price tracking

### Context for Next Agent
- Seed data should be generated as SQL INSERT statements in the migration, similar to how USDA foods are seeded in `data/usda-seed.ts`. Create a `restaurant/seed.ts` that exports INSERT strings.
- Restaurant nutrition data for major chains is publicly available in PDF format on their websites. Use approximate values from these published PDFs.
- When logging a restaurant menu item to the food diary, create a nu_foods entry with `source='user'` and set the `brand` field to the restaurant name. This way the food appears in the regular food search too for future logging.
- FTS triggers for nu_restaurants_fts and nu_menu_items_fts follow the same pattern as nu_foods_fts in schema.ts. Copy and adapt.
- The `logo_emoji` field on restaurants is used instead of image URLs to keep everything local and avoid network requirements. Use food-related emojis: burger for fast food, coffee for cafe, pizza slice for pizza, etc.
- If multiple features share migration v4, coordinate all table creations and seed data in a single migration.
