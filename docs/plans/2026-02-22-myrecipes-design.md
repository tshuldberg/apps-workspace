# MyRecipes — Design Document

**Date:** 2026-02-22
**Status:** Draft
**Author:** MyApps Product Team

---

## Overview

**MyRecipes** — Your cookbook, offline forever.

A privacy-first recipe manager and digital cookbook that keeps all your recipes on your device. Import recipes from any URL using schema.org/Recipe structured data parsing, enter recipes manually, organize with tags, and cook with a distraction-free step-by-step mode. Generate grocery lists from selected recipes. No accounts, no cloud sync, no dietary profiling, no ads.

MyRecipes is the anti-Yummly cookbook for people who just want to save and cook recipes without being profiled. Whirlpool-owned Yummly tracks your dietary preferences to serve appliance ads. Pinterest saves your recipes on their servers. MyRecipes keeps everything on your device and costs $4.99 once.

---

## Problem Statement

Recipe management has a privacy and usability problem:

1. **Recipe websites are unusable.** The average recipe blog has 2,000 words of preamble before the recipe, 15 ads, auto-playing video, and cookie consent banners. Users just want the ingredients and steps.
2. **Yummly profiles your eating habits.** Owned by Whirlpool since 2017, Yummly tracks every recipe you save, every ingredient you search, and every dietary preference you express — then uses that data to sell kitchen appliances and targeted ads.
3. **Pinterest is a discovery tool, not a cookbook.** Recipes saved to Pinterest boards are just links to the original ad-bloated blog posts. No offline access, no grocery lists, no cooking mode.
4. **Paprika ($4.99) is the best option but aging.** Last meaningful update in 2023. Solid recipe importer and grocery list, but the UI feels dated and it hasn't kept up with modern iOS/Android features.
5. **No app combines URL import + cooking mode + grocery list + privacy.** Users cobble together solutions: save URLs in Notes, screenshot ingredients, manually build grocery lists in Reminders.
6. **Dietary profiling is invasive.** Apps like Yummly, Mealime, and MyFitnessPal build detailed dietary profiles (allergies, preferences, restrictions, calorie targets) that are shared with advertisers and data brokers. Cooking should not require a health questionnaire.

MyRecipes fills the gap: a modern recipe manager with URL import, cooking mode, and grocery lists — with zero profiling and zero network dependency.

---

## Target User Persona

### Primary: "The Home Cook" (Jamie, 25-45)

- **Demographics:** Cooks 3-5 times per week, saves 2-5 new recipes per month from blogs, YouTube, and social media
- **Behavior:** Has 50+ recipe bookmarks scattered across Chrome, Pinterest, Instagram saves, and screenshots. Tries a new recipe weekly. Follows food bloggers and cooking YouTubers.
- **Pain point:** "I can never find that recipe I saved. And when I do, the blog post takes forever to load and is full of ads."
- **Motivation:** Wants a single place for all recipes that works offline in the kitchen. Clean view of ingredients and steps.
- **Willingness to pay:** $5 is trivial compared to the grocery bill. Pays for one good cookbook app gladly.

### Secondary: "The Meal Prepper" (Alex, 22-35)

- **Demographics:** Plans meals for the week, batch cooks on Sundays, shops with a list
- **Behavior:** Selects 4-6 recipes for the week, generates a shopping list, shops once
- **Pain point:** "I manually combine ingredients from multiple recipes into one shopping list. It takes 20 minutes."
- **Motivation:** Automated grocery list generation from selected recipes

### Tertiary: "The Family Recipe Keeper" (Pat, 35-60)

- **Demographics:** Has handwritten family recipes from parents/grandparents. Wants to digitize and preserve them.
- **Behavior:** Types recipes by hand. Wants photos attached. May share with family members via export.
- **Pain point:** "Grandma's lasagna recipe is on a stained index card. I need a digital backup."
- **Motivation:** Preservation and organization of personal/family recipes

---

## Competitive Landscape

| App | Price | Est. Users | Est. Revenue | Privacy Stance | Key Weakness |
|-----|-------|-----------|-------------|----------------|-------------|
| **Yummly** | Free (ad-supported) | 30M+ | ~$50M/yr (ads + Whirlpool data) | Whirlpool-owned; profiles dietary habits; tracks searches; serves targeted ads | Privacy nightmare; heavy ads; optimized for Whirlpool's data needs, not user needs |
| **Paprika** | $4.99 (mobile) / $29.99 (Mac) | 2M+ (est.) | ~$8M (lifetime) | On-device; optional iCloud sync; no profiling | Aging UI (last major update 2023); separate purchase per platform; no modern iOS widgets |
| **Mealime** | Free / $5.99/mo Pro | 5M+ | ~$15M/yr | Requires account; dietary profiling for meal planning; cloud-based | Subscription; dietary profiling required for core features; limited recipe import |
| **Pinterest** | Free (ad-supported) | 450M+ MAU | $3B/yr | Cloud-based; tracks everything; serves ads | Not a recipe app — just bookmarks to ad-bloated blogs; no offline, no grocery list |
| **CopyMeThat** | Free / $3/mo | 500K+ | ~$1M/yr | Web-based; requires account | Subscription; web-first, not mobile-native; limited cooking mode |
| **Apple Notes / Google Keep** | Free | Billions | $0 (bundled) | Platform-dependent | Not designed for recipes; no structured data; no import; no grocery list generation |

### Opportunity

Paprika proved the market for a privacy-friendly recipe manager at a one-time price. But Paprika is showing its age and charges separately per platform. The opportunity is:
- Modern native UI (dark mode, widgets, haptics)
- Single purchase across all platforms (universal Expo app)
- Better URL importer using 2026-era schema.org parsing
- Step-by-step cooking mode optimized for kitchen use (large text, voice-friendly, timer integration)
- Grocery list generation from selected recipes (Paprika has this but it's clunky)
- Zero dietary profiling — the anti-Yummly positioning

---

## Key Features (MVP)

### 1. Recipe Management

- Add recipes manually: title, description, prep time, cook time, servings, ingredients, steps, tags, photo
- Structured ingredient entry: quantity, unit, item, prep notes (e.g., "2 cups flour, sifted")
- Structured step entry: numbered steps with optional step-level timers
- Recipe photo: take a photo or pick from camera roll (stored on-device)
- Tags for organization: cuisine (Italian, Mexican, Thai...), meal type (breakfast, lunch, dinner, snack, dessert), dietary (vegetarian, vegan, gluten-free...), custom tags
- Favorites system: star recipes for quick access
- Recipe scaling: adjust servings up/down, ingredients auto-recalculate
- Duplicate recipe (for creating variations)

### 2. URL Import (Recipe Schema Parser)

- Paste a URL from any recipe blog
- Parser extracts recipe data from:
  1. **schema.org/Recipe JSON-LD** (primary — most food blogs use this for SEO)
  2. **schema.org/Recipe microdata** (fallback)
  3. **hRecipe microformat** (legacy fallback)
  4. **Meta tags** (og:title, og:image as last resort)
- Extracted fields: title, ingredients, steps, prep time, cook time, servings, yield, image URL, source URL, description
- Preview screen shows extracted data — user can edit before saving
- Import quality indicator: "Extracted 8/9 fields" with checkmarks
- If extraction fails, offer manual entry pre-filled with whatever was found
- Downloaded recipe image stored locally (not hotlinked)
- Source URL preserved for attribution (but recipe is fully usable offline)

**Privacy note on URL import:** This is the ONE feature that requires a network call — fetching the HTML from the recipe URL. The fetch happens once at import time. No tracking headers are sent. The HTML is parsed locally, the recipe data is extracted and stored in SQLite, and the raw HTML is discarded. After import, the recipe works fully offline.

### 3. Step-by-Step Cooking Mode

Full-screen, distraction-free mode designed for kitchen use:

- Large text (24px+ for ingredients, 20px+ for steps) — readable from 3 feet away
- One step at a time, swipe to advance
- Keep-awake: screen stays on during cooking mode (no auto-lock)
- Ingredients reference: swipe up from bottom to peek at full ingredient list without leaving current step
- Step timers: tap a time mentioned in a step to start a countdown timer
- Multiple concurrent timers (e.g., "cook pasta 8 min" and "roast veggies 25 min")
- Timer completion: haptic feedback + sound alert
- Progress indicator: "Step 3 of 12"
- Voice-friendly: large tap targets for greasy/wet hands

### 4. Search and Filter

- Full-text search across recipe titles, ingredients, tags, and descriptions
- Filter by tag (multiple tags with AND logic)
- Filter by prep time (under 15 min, under 30 min, under 60 min)
- Filter by favorites
- Sort by: recently added, alphabetical, prep time, cook time
- Quick access: "Favorites," "Recently Added," "Quick Meals (<30 min)"

### 5. Grocery List Generation

- Select multiple recipes for the week
- Generate combined grocery list automatically
- Intelligent ingredient merging: "2 cups flour" + "1 cup flour" = "3 cups flour"
- Group by grocery section: Produce, Dairy, Meat, Pantry, Frozen, Bakery, Other
- Check off items while shopping
- Add custom items to the list (things not from recipes)
- Ingredient unit normalization: 4 tbsp butter → 1/4 cup butter where applicable
- Pantry items: mark common pantry staples (salt, pepper, oil) to auto-exclude or dim in grocery list
- Share grocery list as text (for sending to a partner)
- Clear completed items / clear all

### 6. Collections

- Organize recipes into collections: "Weeknight Dinners," "Holiday Baking," "Meal Prep Sunday"
- A recipe can belong to multiple collections
- Default collections: All Recipes, Favorites, Recently Added
- Custom collections with cover photo (from a recipe in the collection)

### 7. Import/Export

- Export individual recipe as text (formatted for sharing via Messages, email, etc.)
- Export all recipes as JSON (full backup)
- Import from JSON backup (restore on new device)
- Share recipe as a nicely formatted card image (for social media)

---

## Technical Architecture

### Stack

- **Mobile:** Expo (React Native) — iOS + Android from single codebase
- **Web:** Next.js 15 — Desktop recipe browsing and entry
- **Database:** SQLite via `expo-sqlite` (mobile) / `better-sqlite3` (web)
- **Monorepo:** Turborepo
- **Package Manager:** pnpm
- **Language:** TypeScript everywhere
- **HTML parsing:** `cheerio` (server-side DOM for URL import, bundled in the app)
- **Image handling:** `expo-image-picker` + `expo-file-system` for recipe photos
- **Notifications:** `expo-notifications` for cooking timers
- **Payments:** RevenueCat (App Store IAP), Lemon Squeezy (direct)

### Monorepo Structure

```
MyRecipes/
├── apps/
│   ├── mobile/                # Expo (React Native) — iOS + Android
│   │   ├── app/               # Expo Router file-based routing
│   │   │   ├── (tabs)/        # Tab navigation
│   │   │   │   ├── index.tsx          # Recipe library (home)
│   │   │   │   ├── search.tsx         # Search and filter
│   │   │   │   └── grocery.tsx        # Grocery list
│   │   │   ├── recipe/[id].tsx        # Recipe detail view
│   │   │   ├── recipe/[id]/cook.tsx   # Cooking mode (full screen)
│   │   │   ├── add.tsx                # Add recipe (manual entry)
│   │   │   ├── import.tsx             # Import from URL
│   │   │   ├── collection/[id].tsx    # Collection view
│   │   │   └── settings.tsx           # App settings
│   │   ├── components/        # Mobile-specific components
│   │   ├── hooks/             # Mobile-specific hooks
│   │   └── assets/            # Icons, images, fonts
│   └── web/                   # Next.js 15 — Web/desktop
│       ├── app/
│       └── components/
├── packages/
│   ├── shared/                # Shared business logic
│   │   ├── src/
│   │   │   ├── db/            # Database layer (SQLite operations)
│   │   │   ├── models/        # TypeScript types and Zod schemas
│   │   │   ├── parser/        # Recipe URL parser
│   │   │   │   ├── index.ts   # Main parser orchestrator
│   │   │   │   ├── json-ld.ts # schema.org/Recipe JSON-LD extractor
│   │   │   │   ├── microdata.ts # schema.org microdata extractor
│   │   │   │   ├── meta.ts    # Open Graph / meta tag fallback
│   │   │   │   └── normalize.ts # Normalize extracted data to Recipe schema
│   │   │   ├── grocery/       # Grocery list engine
│   │   │   │   ├── merge.ts   # Ingredient merging logic
│   │   │   │   ├── categorize.ts # Grocery section classification
│   │   │   │   └── units.ts   # Unit conversion and normalization
│   │   │   ├── scaling/       # Recipe scaling logic
│   │   │   └── utils/         # Date helpers, fraction formatting
│   │   └── package.json
│   ├── ui/                    # Shared UI components
│   │   ├── src/
│   │   │   ├── tokens/        # Design tokens
│   │   │   ├── components/    # Cross-platform UI primitives
│   │   │   └── icons/         # Icon set
│   │   └── package.json
│   ├── eslint-config/
│   └── typescript-config/
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── CLAUDE.md
├── timeline.md
└── README.md
```

### Data Model (SQLite Schema)

```sql
-- Recipes — the core entity
CREATE TABLE recipes (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    title           TEXT NOT NULL,
    description     TEXT,
    prep_time_min   INTEGER,  -- minutes
    cook_time_min   INTEGER,  -- minutes
    total_time_min  INTEGER,  -- computed or manual override
    servings        INTEGER,
    yield_text      TEXT,  -- free-form yield description (e.g., "12 cookies")
    source_url      TEXT,  -- original URL if imported
    source_name     TEXT,  -- site name or "Manual Entry"
    image_path      TEXT,  -- local file path to stored image
    is_favorite     INTEGER NOT NULL DEFAULT 0,
    rating          INTEGER CHECK (rating BETWEEN 1 AND 5),  -- user's personal rating
    notes           TEXT,  -- personal notes (substitutions, tips)
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ingredients — structured ingredient data per recipe
CREATE TABLE ingredients (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    recipe_id       TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    section         TEXT,  -- optional grouping (e.g., "For the sauce", "For the dough")
    quantity        REAL,  -- numeric quantity (nullable for "to taste" ingredients)
    unit            TEXT,  -- cup, tbsp, tsp, oz, lb, g, kg, ml, L, piece, clove, etc.
    item            TEXT NOT NULL,  -- ingredient name ("all-purpose flour")
    prep_note       TEXT,  -- "diced", "sifted", "at room temperature"
    is_optional     INTEGER NOT NULL DEFAULT 0,
    sort_order      INTEGER NOT NULL DEFAULT 0
);

-- Steps — numbered cooking instructions
CREATE TABLE steps (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    recipe_id       TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    section         TEXT,  -- optional grouping (e.g., "Prepare the filling")
    step_number     INTEGER NOT NULL,
    instruction     TEXT NOT NULL,
    timer_minutes   INTEGER,  -- optional timer for this step
    sort_order      INTEGER NOT NULL DEFAULT 0
);

-- Tags — flexible tagging system
CREATE TABLE tags (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name            TEXT NOT NULL UNIQUE,
    type            TEXT NOT NULL DEFAULT 'custom' CHECK (type IN (
        'cuisine', 'meal_type', 'dietary', 'custom'
    )),
    color           TEXT  -- hex color for visual distinction
);

-- Recipe-Tag junction
CREATE TABLE recipe_tags (
    recipe_id       TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    tag_id          TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (recipe_id, tag_id)
);

-- Collections — user-created recipe groupings
CREATE TABLE collections (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name            TEXT NOT NULL,
    description     TEXT,
    cover_recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Recipe-Collection junction
CREATE TABLE recipe_collections (
    recipe_id       TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    collection_id   TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (recipe_id, collection_id)
);

-- Grocery Lists — named grocery lists (usually one active at a time)
CREATE TABLE grocery_lists (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name            TEXT NOT NULL DEFAULT 'Shopping List',
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Grocery Items — items on a grocery list
CREATE TABLE grocery_items (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    list_id         TEXT NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
    recipe_id       TEXT REFERENCES recipes(id) ON DELETE SET NULL,  -- source recipe (null for manual items)
    section         TEXT NOT NULL DEFAULT 'other' CHECK (section IN (
        'produce', 'dairy', 'meat', 'pantry', 'frozen', 'bakery',
        'beverages', 'snacks', 'condiments', 'other'
    )),
    item            TEXT NOT NULL,
    quantity        REAL,
    unit            TEXT,
    is_checked      INTEGER NOT NULL DEFAULT 0,
    is_pantry_staple INTEGER NOT NULL DEFAULT 0,  -- auto-excluded or dimmed
    sort_order      INTEGER NOT NULL DEFAULT 0
);

-- Pantry Staples — items the user always has on hand
CREATE TABLE pantry_staples (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    item            TEXT NOT NULL UNIQUE  -- normalized item name
);

-- User Preferences
CREATE TABLE preferences (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL
);

-- Seed default tags
INSERT INTO tags (id, name, type) VALUES
    ('cuisine-italian', 'Italian', 'cuisine'),
    ('cuisine-mexican', 'Mexican', 'cuisine'),
    ('cuisine-thai', 'Thai', 'cuisine'),
    ('cuisine-chinese', 'Chinese', 'cuisine'),
    ('cuisine-japanese', 'Japanese', 'cuisine'),
    ('cuisine-indian', 'Indian', 'cuisine'),
    ('cuisine-french', 'French', 'cuisine'),
    ('cuisine-mediterranean', 'Mediterranean', 'cuisine'),
    ('cuisine-korean', 'Korean', 'cuisine'),
    ('cuisine-american', 'American', 'cuisine'),
    ('meal-breakfast', 'Breakfast', 'meal_type'),
    ('meal-lunch', 'Lunch', 'meal_type'),
    ('meal-dinner', 'Dinner', 'meal_type'),
    ('meal-snack', 'Snack', 'meal_type'),
    ('meal-dessert', 'Dessert', 'meal_type'),
    ('meal-appetizer', 'Appetizer', 'meal_type'),
    ('meal-side', 'Side Dish', 'meal_type'),
    ('meal-drink', 'Drink', 'meal_type'),
    ('diet-vegetarian', 'Vegetarian', 'dietary'),
    ('diet-vegan', 'Vegan', 'dietary'),
    ('diet-gluten-free', 'Gluten-Free', 'dietary'),
    ('diet-dairy-free', 'Dairy-Free', 'dietary'),
    ('diet-keto', 'Keto', 'dietary'),
    ('diet-paleo', 'Paleo', 'dietary');

-- Indexes
CREATE INDEX idx_recipes_title ON recipes(title);
CREATE INDEX idx_recipes_favorite ON recipes(is_favorite) WHERE is_favorite = 1;
CREATE INDEX idx_recipes_created ON recipes(created_at);
CREATE INDEX idx_ingredients_recipe ON ingredients(recipe_id);
CREATE INDEX idx_ingredients_item ON ingredients(item);
CREATE INDEX idx_steps_recipe ON steps(recipe_id);
CREATE INDEX idx_recipe_tags_recipe ON recipe_tags(recipe_id);
CREATE INDEX idx_recipe_tags_tag ON recipe_tags(tag_id);
CREATE INDEX idx_recipe_collections_recipe ON recipe_collections(recipe_id);
CREATE INDEX idx_recipe_collections_collection ON recipe_collections(collection_id);
CREATE INDEX idx_grocery_items_list ON grocery_items(list_id);
CREATE INDEX idx_grocery_items_checked ON grocery_items(is_checked);
```

### Recipe URL Parser

The parser lives in `packages/shared/src/parser/` and follows a priority chain:

```typescript
// Parser priority chain
async function parseRecipeUrl(url: string): Promise<ParsedRecipe> {
  const html = await fetchHtml(url);  // single network call

  // Try extraction methods in priority order
  const jsonLd = extractJsonLd(html);       // schema.org/Recipe in <script type="application/ld+json">
  if (jsonLd.confidence > 0.8) return normalize(jsonLd);

  const microdata = extractMicrodata(html);  // schema.org/Recipe in itemscope/itemprop attributes
  if (microdata.confidence > 0.6) return normalize(microdata);

  const meta = extractMeta(html);            // og:title, og:image, meta description
  return normalize(meta);                    // always returns something, even if sparse
}

interface ParsedRecipe {
  title: string;
  description?: string;
  ingredients: ParsedIngredient[];
  steps: string[];
  prepTime?: number;       // minutes
  cookTime?: number;       // minutes
  servings?: number;
  yield?: string;
  imageUrl?: string;
  sourceUrl: string;
  sourceName: string;
  confidence: number;      // 0-1, how complete the extraction was
  fieldsExtracted: string[];  // for UI feedback
}

interface ParsedIngredient {
  raw: string;             // original text from the page
  quantity?: number;
  unit?: string;
  item: string;
  prepNote?: string;
}
```

Ingredient parsing uses a rule-based parser (not ML) that handles common patterns:
- "2 cups all-purpose flour, sifted" → { quantity: 2, unit: "cup", item: "all-purpose flour", prepNote: "sifted" }
- "1/2 tsp salt" → { quantity: 0.5, unit: "tsp", item: "salt" }
- "3 large eggs" → { quantity: 3, unit: "piece", item: "eggs", prepNote: "large" }
- "Salt and pepper to taste" → { item: "salt and pepper", prepNote: "to taste" }
- "1 (14.5 oz) can diced tomatoes" → { quantity: 1, unit: "can (14.5 oz)", item: "diced tomatoes" }

### Grocery List Engine

The grocery engine in `packages/shared/src/grocery/` handles:

**Ingredient merging:**
```typescript
// Same item + compatible units → merge quantities
"2 cups flour" + "1 cup flour" → "3 cups flour"
"1 lb chicken" + "2 lb chicken" → "3 lb chicken"

// Same item + different units → convert if possible
"4 tbsp butter" + "1/2 cup butter" → "3/4 cup butter"  // 4 tbsp = 1/4 cup

// Same item + incompatible units → list separately
"2 cloves garlic" + "1 tsp garlic powder" → both listed (different forms)
```

**Section categorization:**
Ingredient items are classified into grocery sections using a keyword-based classifier:
- Produce: fruits, vegetables, herbs, lettuce, onion, garlic, tomato...
- Dairy: milk, cheese, butter, cream, yogurt, eggs...
- Meat: chicken, beef, pork, fish, salmon, shrimp...
- Pantry: flour, sugar, rice, pasta, canned goods, oil, vinegar...
- Frozen: frozen vegetables, ice cream, frozen fruit...
- Bakery: bread, rolls, tortillas, pita...
- Beverages: juice, wine, beer, stock, broth...
- Condiments: ketchup, mustard, soy sauce, hot sauce...

**Pantry staple handling:**
Users mark common items as "pantry staples" (salt, pepper, olive oil, etc.). These items appear dimmed in the grocery list with a "probably have it" indicator. User can toggle to include/exclude.

### Privacy Architecture

- **One-time network call for URL import only.** When importing a recipe from a URL, a single HTTP GET fetches the page HTML. No cookies, no auth headers, no tracking parameters. The fetch uses a generic User-Agent.
- **No analytics.** No Firebase, no Mixpanel, no crash reporting.
- **No account.** No email, no sign-up. Works immediately on launch.
- **No dietary profiling.** Tags exist for organization, but no algorithm analyzes eating patterns.
- **Images stored locally.** Imported recipe images are downloaded once and stored on-device. No hotlinking to external servers.
- **SQLite on-device.** All data in app sandbox. No iCloud, no cloud backup.
- **Export is explicit.** JSON backup and text sharing are user-initiated.
- **No food recommendation engine.** The app doesn't suggest recipes based on behavior. It's a filing cabinet, not an algorithm.

---

## UI/UX Direction

### Design Language

- **Dark mode native** — Deep charcoal (#1A1A2E) background
- **Warm accent palette:**
  - Amber (#F5A623) — favorites, timers running, active cooking state
  - Coral (#FF6B6B) — timer alerts, missing ingredients, warnings
  - Teal (#4ECDC4) — tags, import success, grocery list checked items
  - Warm cream (#FFF5E6) — recipe card backgrounds (slightly lighter than the dark bg for depth)
  - Muted lavender (#A0A0C8) — secondary text, borders
- **Typography:** Inter for all text; cooking mode uses larger weights for readability
- **Recipe cards:** Photo-forward cards with rounded corners (12px), recipe image as background with gradient overlay and white title text
- **No shield icons.** Privacy communicated through behavior and copy.

### Screen Flow

#### 1. Recipe Library (Home Tab)

Grid of recipe cards with search bar at top.

```
┌─────────────────────────────────────┐
│ MyRecipes              [+] [Import] │
│─────────────────────────────────────│
│ 🔍 Search recipes...                │
│                                     │
│ [All] [Favorites] [Quick] [Recent]  │
│                                     │
│ ┌────────────┐ ┌────────────┐      │
│ │  [photo]   │ │  [photo]   │      │
│ │            │ │            │      │
│ │ Pasta      │ │ Thai Green │      │
│ │ Carbonara  │ │ Curry      │      │
│ │ 30 min ★   │ │ 45 min     │      │
│ └────────────┘ └────────────┘      │
│ ┌────────────┐ ┌────────────┐      │
│ │  [photo]   │ │  [photo]   │      │
│ │            │ │            │      │
│ │ Banana     │ │ Sheet Pan  │      │
│ │ Bread      │ │ Chicken    │      │
│ │ 65 min ★   │ │ 40 min     │      │
│ └────────────┘ └────────────┘      │
│                                     │
│─────────────────────────────────────│
│  [Library]    [Search]    [Grocery] │
└─────────────────────────────────────┘
```

- 2-column grid of photo cards
- Quick filter chips: All, Favorites, Quick (<30 min), Recently Added
- Long-press a card for context menu: Favorite, Add to Collection, Add to Grocery List, Share, Delete
- Pull-to-refresh doesn't do anything (local data) — but visually indicates "everything is on your device"
- Empty state: "Add your first recipe" with two CTAs: "Import from URL" and "Add Manually"

#### 2. Recipe Detail View

Full recipe view with prominent "Start Cooking" button.

```
┌─────────────────────────────────────┐
│ ←                          ★  ···  │
│                                     │
│ [        Recipe Photo          ]    │
│                                     │
│ Pasta Carbonara                     │
│ Classic Italian • 30 min • 4 servings │
│ [Italian] [Dinner] [Quick]          │
│                                     │
│ Servings: [−] 4 [+]                │
│                                     │
│ INGREDIENTS                         │
│ □ 1 lb spaghetti                   │
│ □ 4 oz guanciale, diced            │
│ □ 4 large egg yolks                │
│ □ 1 cup Pecorino Romano, grated    │
│ □ Freshly cracked black pepper     │
│                                     │
│ STEPS                               │
│ 1. Bring a large pot of salted...  │
│ 2. Cook guanciale in a cold pan... │
│ 3. Whisk egg yolks and cheese...   │
│ 4. Toss hot pasta with the egg...  │
│                                     │
│ [ 🍳 Start Cooking ]               │
│                                     │
│ Source: seriouseats.com             │
│ Notes: Use guanciale, not bacon... │
└─────────────────────────────────────┘
```

- Serving adjuster: tap +/- to scale recipe, ingredients update in real-time
- Ingredient checkboxes: tap to strike through (helpful when prepping)
- "Start Cooking" button enters full-screen cooking mode
- Three-dot menu: Edit, Duplicate, Add to Collection, Add to Grocery List, Share, Delete
- Source link shown at bottom (for attribution, opens in browser if tapped)
- Personal notes section

#### 3. Cooking Mode (Full Screen)

Distraction-free, one-step-at-a-time view.

```
┌─────────────────────────────────────┐
│ ✕ Pasta Carbonara    Step 2 of 6   │
│─────────────────────────────────────│
│                                     │
│                                     │
│  Cook the guanciale in a cold      │
│  skillet over medium heat until     │
│  the fat renders and the pieces    │
│  are crispy, about 8 minutes.      │
│                                     │
│         [ ⏱ 8:00 ]                 │
│                                     │
│                                     │
│                                     │
│                                     │
│─────────────────────────────────────│
│ ▲ Ingredients                      │
│─────────────────────────────────────│
│       [ ← Prev ]  [ Next → ]       │
└─────────────────────────────────────┘
```

- Large text (22px+) for readability at arm's length
- Keep-awake enabled (screen never dims)
- Tappable timer badges extract time values from step text
- Multiple timers can run simultaneously (shown as floating badges at top)
- Swipe left/right or tap buttons to navigate steps
- Pull up from bottom to see full ingredient list as an overlay
- Minimal chrome — just the step text, timer, and navigation
- Exit button (X) in corner with confirmation dialog

#### 4. URL Import Flow

```
┌─────────────────────────────────────┐
│ Import Recipe                Cancel │
│─────────────────────────────────────│
│                                     │
│ Paste a recipe URL:                 │
│ ┌─────────────────────────────────┐│
│ │ https://seriouseats.com/pasta...│ │
│ └─────────────────────────────────┘│
│                                     │
│ [ Paste from Clipboard ]            │
│                                     │
│         [ Import ]                  │
│                                     │
│ Extracts ingredients, steps, and    │
│ cooking times from recipe blogs.    │
│ The URL is fetched once — after     │
│ that, the recipe is fully offline.  │
└─────────────────────────────────────┘
```

After tapping Import:

```
┌─────────────────────────────────────┐
│ Review Import              Cancel   │
│─────────────────────────────────────│
│ Extracted 8/9 fields ✓             │
│                                     │
│ Title: [Pasta Carbonara        ]   │
│ Prep:  [15] min  Cook: [15] min    │
│ Servings: [4]                       │
│                                     │
│ INGREDIENTS (5 found ✓)            │
│ [editable list...]                  │
│                                     │
│ STEPS (6 found ✓)                  │
│ [editable list...]                  │
│                                     │
│ Tags: [Italian ✕] [Dinner ✕] [+]  │
│                                     │
│         [ Save Recipe ]             │
└─────────────────────────────────────┘
```

- User reviews and edits all extracted fields before saving
- Missing fields highlighted with a "fill in" prompt
- Tag suggestions based on detected cuisines/ingredients
- "Save Recipe" commits to SQLite and navigates to the recipe detail view

#### 5. Grocery List (Tab)

```
┌─────────────────────────────────────┐
│ Grocery List              [Share]   │
│─────────────────────────────────────│
│ 3 recipes • 24 items               │
│                                     │
│ PRODUCE                             │
│ ☑ 2 large onions                   │
│ ☐ 1 bunch basil                    │
│ ☐ 3 cloves garlic                  │
│ ☐ 2 bell peppers                   │
│                                     │
│ DAIRY                               │
│ ☐ 1.5 cups Pecorino Romano         │
│ ☐ 2 cups heavy cream               │
│ ☑ 1 dozen eggs                     │
│                                     │
│ MEAT                                │
│ ☐ 4 oz guanciale                   │
│ ☐ 2 lb chicken thighs              │
│                                     │
│ PANTRY (probably have)              │
│ · salt          · black pepper      │
│ · olive oil     · all-purpose flour │
│                                     │
│ [ + Add Item ]                      │
│                                     │
│ [ Clear Checked ] [ Clear All ]     │
│─────────────────────────────────────│
│  [Library]    [Search]    [Grocery] │
└─────────────────────────────────────┘
```

- Grouped by grocery section with collapsible headers
- Checked items get strikethrough and move to bottom of section
- Pantry staples section at bottom, dimmed, with "probably have" label
- "Add Item" for manual additions
- "Share" exports as formatted text
- Recipes contributing to the list shown at top as tappable chips

#### 6. Search & Filter (Tab)

```
┌─────────────────────────────────────┐
│ Search                              │
│─────────────────────────────────────│
│ 🔍 [chicken thighs            ]    │
│                                     │
│ FILTERS                             │
│ Cuisine: [Any ▼]                   │
│ Meal:    [Dinner ▼]               │
│ Time:    [< 30 min ▼]             │
│ Tags:    [+]                        │
│                                     │
│ 3 results                           │
│ ┌────────────┐ ┌────────────┐      │
│ │ Sheet Pan  │ │ Thai Green │      │
│ │ Chicken    │ │ Curry      │      │
│ └────────────┘ └────────────┘      │
│ ┌────────────┐                      │
│ │ Chicken    │                      │
│ │ Parmesan   │                      │
│ └────────────┘                      │
│─────────────────────────────────────│
│  [Library]    [Search]    [Grocery] │
└─────────────────────────────────────┘
```

- Full-text search across titles, ingredients, tags, descriptions
- Filter dropdowns for cuisine, meal type, prep time
- Results displayed as the same photo card grid
- Ingredient search: searching "chicken thighs" finds recipes that contain chicken thighs as an ingredient, not just recipes with "chicken" in the title

### Onboarding Flow (First Launch)

1. **Welcome** — "Your recipes, your device. No accounts, no ads, no dietary profiling." CTA: "Get Started"
2. **Choose your path** — Two cards: "Import from URL" and "Add Manually." User picks one to try immediately.
3. **First recipe** — Guided through their chosen flow. For URL import: paste a link, see the magic of extraction, review and save. For manual: quick form with title, ingredients, steps.
4. **Done** — "Your first recipe is saved. It works offline forever." Shows the recipe in the library. Points to grocery list and cooking mode as next features to try.

Total onboarding: under 2 minutes including entering the first recipe.

---

## Monetization

### Pricing Model

**One-time purchase: $4.99**

No subscriptions. No ads. No in-app purchases. No premium tier. Pay once, use forever.

### Revenue Projections (Conservative)

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| Downloads (free trial) | 60,000 | 150,000 | 280,000 |
| Conversion rate | 10% | 13% | 15% |
| Paid users | 6,000 | 19,500 | 42,000 |
| Revenue (after 30% App Store cut) | $21,000 | $68,100 | $146,700 |
| Cumulative paid users | 6,000 | 25,500 | 67,500 |

### Purchase Structure

- **Free trial:** Full functionality for 21 days. After trial, limited to 10 recipes and no URL import. Existing recipes remain accessible (read-only for recipes beyond the limit). This preserves data and creates natural conversion pressure when the user hits the limit.
- **App Store IAP:** $4.99 via RevenueCat
- **Direct purchase:** $4.99 via Lemon Squeezy (web version)

### Why $4.99 Works

1. **Paprika set the precedent at $4.99.** MyRecipes matches that price point with a more modern UI, better URL parser, and cooking mode.
2. **Less than a single cookbook.** Users routinely spend $25-40 on physical cookbooks. A digital recipe manager for $4.99 is obvious value.
3. **Zero recurring costs.** No server, no API (aside from user-initiated URL fetches that cost nothing). Pure margin after App Store cut.
4. **Target audience buys apps.** Home cooks who care about organization are willing to pay for good tools. They're not the "everything must be free" demographic.

---

## Marketing Angle

### Core Message

**"Your cookbook, offline forever."**

Secondary messages:
- "Your recipes, your device. No dietary profiling."
- "Import any recipe from the web. Cook without wifi."
- "The recipe app that doesn't track what you eat."

### The Privacy Angle

While MyBudget leads with financial privacy and MySubs leads with irony, MyRecipes leads with the creepiness of dietary profiling:
- "Yummly knows what you had for dinner. We don't."
- "Your cooking habits are nobody's business."
- "No accounts. No profiles. No 'based on your eating patterns' recommendations."

This isn't paranoia — Yummly/Whirlpool genuinely uses recipe data to target appliance ads, and health insurance companies have explored purchasing dietary data from apps. The privacy angle is both principled and practical.

### Launch Channels

#### Reddit (Primary — organic)
- **r/cooking** (25M) — "I built a recipe app that imports from any URL and works offline" (demo post with screenshots of the import feature)
- **r/mealprep** (3M) — "I built an app that generates grocery lists from your selected recipes"
- **r/recipes** (4M) — Share-and-tell with the cooking mode demo
- **r/privacy** (1.8M) — "A recipe app that doesn't profile your diet"
- **r/Paprika** — If subreddit exists, position as the "Paprika for 2026"

#### Food Blogger Outreach
- Contact mid-tier food bloggers (10K-100K followers) who complain about recipe blog UX
- Offer: "Your readers can import your recipes into MyRecipes with one tap. Here's how the schema.org/Recipe support works."
- This creates a symbiotic relationship: bloggers promote the app, their readers import recipes more easily

#### Content Marketing
- Blog post: "Why Your Recipe App Shouldn't Know What You Eat" (privacy angle)
- Blog post: "How to Import Any Recipe from the Web" (SEO for recipe management)
- Blog post: "Paprika Alternatives 2026" (comparison SEO)
- Blog post: "The Best Way to Organize Digital Recipes" (broad SEO)

#### Product Hunt
- Category: Productivity, Food & Drink
- Tagline: "Your cookbook, offline forever"
- Demo video: 30-second screen recording of importing a recipe URL → cooking mode → grocery list

#### App Store Optimization
- Keywords: recipe manager, cookbook, recipe import, meal prep, grocery list, recipe organizer, cooking, offline recipes
- Subtitle: "Import, Cook, Shop — All Offline"
- Screenshots: URL import flow, cooking mode with timer, grocery list, recipe library grid

---

## MVP Timeline

### Pre-Development (Week 0)
- Finalize design tokens and component library spec
- Set up Turborepo monorepo with pnpm
- Configure shared TypeScript, ESLint, Prettier configs
- Create SQLite schema with seed data (default tags)
- Research top 50 recipe blog HTML structures for parser testing
- Collect 20 test URLs from popular recipe sites

### Phase 1: Foundation (Weeks 1-2)
- Implement SQLite database layer with all tables
- Build recipe CRUD operations in `packages/shared`
- Create design token system and base UI components in `packages/ui`
- Build ingredient parsing engine (text → structured ingredient)
- Build recipe scaling logic (serving adjustment → ingredient recalculation)
- Unit tests for ingredient parser and scaler
- Implement tag CRUD and recipe-tag association

### Phase 2: Recipe UI (Weeks 3-4)
- Build Recipe Library tab (grid of photo cards)
- Build Recipe Detail view with ingredient list and steps
- Build Add Recipe screen (manual entry with structured fields)
- Implement favorites toggle
- Implement collections CRUD and recipe-collection management
- Build settings screen
- Implement recipe photo capture and storage
- Wire all views to SQLite database

### Phase 3: URL Import (Weeks 5-6)
- Build URL import screen (URL input + clipboard paste)
- Implement JSON-LD parser for schema.org/Recipe
- Implement microdata parser (fallback)
- Implement meta tag parser (last resort)
- Build normalizer to convert extracted data to app schema
- Build review/edit screen for imported recipes
- Implement recipe image download and local storage
- Test against 50+ recipe sites: Serious Eats, AllRecipes, Food Network, NYT Cooking, Budget Bytes, Smitten Kitchen, Bon Appetit, etc.
- Handle edge cases: recipes behind paywalls (graceful failure), recipes without schema markup (meta fallback), AMP pages

### Phase 4: Cooking Mode & Grocery (Weeks 7-8)
- Build full-screen cooking mode with step navigation
- Implement keep-awake screen behavior
- Build step-level timer with alarm/haptic
- Implement multiple concurrent timers
- Build ingredient overlay (pull-up sheet)
- Build grocery list engine (ingredient merging, unit conversion, section categorization)
- Build Grocery List tab UI
- Implement pantry staples management
- Build "add recipes to grocery list" workflow
- Implement grocery list sharing (formatted text export)
- Unit tests for ingredient merging and unit conversion

### Phase 5: Search & Polish (Weeks 9-10)
- Build Search tab with full-text search
- Implement tag and time filters
- Implement ingredient-based search
- Build onboarding flow (4-step wizard)
- Implement JSON export/import (full backup/restore)
- Implement recipe sharing (formatted text + card image)
- Polish animations, haptics, and transitions
- Performance optimization: recipe library scroll with 500+ recipes
- Accessibility audit (VoiceOver support for cooking mode)

### Phase 6: Launch Prep (Weeks 11-12)
- App Store screenshots and metadata
- Write App Store description and keywords
- Set up RevenueCat for IAP
- Set up Lemon Squeezy for direct sales
- Build simple marketing landing page
- Record 30-second demo video (import → cook → grocery)
- Beta test with 25+ home cooks
- Fix bugs from beta feedback
- Submit to App Store review

### Phase 7: Launch (Week 13)
- App Store release
- Product Hunt launch
- Reddit posts (r/cooking, r/mealprep, r/recipes, r/privacy)
- Food blogger outreach (10 initial contacts)
- Begin content marketing cadence

### Post-MVP Roadmap (Not in scope for MVP)
- iPad-optimized layout (2-column recipe view)
- Mac App Store release
- Meal planning calendar (plan meals for the week, auto-generate grocery list)
- Recipe sharing via QR code (encode recipe as compact format, scan to import)
- Cooking mode voice control ("Hey Siri, next step" via SiriKit)
- Nutritional info estimation (optional, on-device calculation from USDA database)
- Widget showing a random recipe suggestion from favorites
- Recipe photo OCR (photograph a handwritten recipe card, extract text)
- Import from other apps (Paprika JSON export, CopyMeThat, etc.)
- Dark/light theme toggle (MVP is dark-only)
- Localization (10+ languages)
- Measurement unit toggle (US customary / metric, converts all recipes)

---

## Acceptance Criteria

### Functional Requirements

1. **Manual recipe entry:** User can create a recipe with title, description, prep/cook time, servings, structured ingredients (quantity, unit, item, prep note), numbered steps, tags, and photo. All data persisted in SQLite.
2. **URL import:** User can paste a recipe URL and the app extracts title, ingredients, steps, times, servings, and image from schema.org/Recipe markup. Extraction works on at least 80% of top 50 recipe sites. User reviews and edits before saving.
3. **Recipe scaling:** User can adjust serving count on any recipe, and ingredient quantities update proportionally in real-time.
4. **Cooking mode:** Full-screen step-by-step view with large text, keep-awake, step navigation, ingredient overlay, and tappable step timers. Multiple timers can run simultaneously.
5. **Search:** Full-text search across recipe titles, ingredient names, tag names, and descriptions returns results in <100ms for 500 recipes.
6. **Grocery list:** User can select multiple recipes and generate a merged grocery list. Same ingredients from different recipes combine quantities. Items grouped by grocery section. Pantry staples dimmed.
7. **Collections:** User can create named collections and add/remove recipes. A recipe can belong to multiple collections.
8. **Favorites:** User can star/unstar recipes. Favorites filter shows only starred recipes.
9. **Tags:** User can tag recipes with cuisine, meal type, dietary, and custom tags. Filter by single or multiple tags.
10. **Export/Import:** User can export all recipes as JSON and import from a JSON backup. Individual recipes can be shared as formatted text.

### Non-Functional Requirements

11. **Privacy:** App makes no network requests except when the user explicitly imports a recipe URL. No analytics, no telemetry, no crash reporting. Verified by proxy monitoring.
12. **Performance:** Recipe library scrolls at 60fps with 500+ recipes. URL import completes in <5 seconds on 4G. Grocery list generation for 10 recipes completes in <500ms.
13. **Offline:** All recipes, photos, cooking mode, search, and grocery lists work with no network connection. Only URL import requires connectivity.
14. **Cooking mode reliability:** Screen stays awake during entire cooking session. Timers continue running in the background if the user briefly switches apps. Timer alarms are audible.
15. **Data integrity:** No data loss during recipe editing, import, or app crashes. SQLite WAL mode for concurrent read/write safety.
16. **Platform:** Runs on iOS 16+ and Android 13+.

### Launch Requirements

17. **App Store approval:** Passes Apple review on first submission.
18. **Payment flow:** RevenueCat IAP works end-to-end (purchase, restore, free trial).
19. **Parser coverage:** URL import successfully extracts recipes from at least 40 of the top 50 recipe websites (80% coverage).
20. **Onboarding:** New user can import their first recipe from a URL in under 90 seconds from first launch.
21. **Beta validation:** At least 20 beta testers have used the app for 1+ week, importing 10+ recipes each, with no data loss.
22. **Cooking mode tested:** At least 10 beta testers have completed a full cooking session using cooking mode, confirming timers and step navigation work correctly.
