# MyRecipes - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** Claude (spec-myrecipes agent)
> **Reviewer:** Trey

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyRecipes (branded as MyGarden in the hub - "Grow it, cook it, host it")
- **Tagline:** Your kitchen companion, from garden to table
- **Module ID:** `recipes`
- **Feature ID Prefix:** `RC`

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Home Cook | Ages 25-45, cooks 4-6 times/week, moderate tech comfort | Store and organize recipes, plan weekly meals, generate shopping lists |
| Recipe Collector | Ages 20-50, saves recipes from websites, cookbooks, and family | Import recipes from URLs, scan paper recipes, organize large collections |
| Meal Planner | Ages 28-50, families or health-conscious individuals | Weekly meal planning, auto-generated grocery lists, nutritional awareness |
| Garden Enthusiast | Ages 30-60, grows herbs/vegetables, seasonal cooking | Track garden plants, link harvests to recipes, seasonal meal planning |
| Entertainer | Ages 25-55, hosts dinner parties and gatherings | Event planning with menus, guest RSVP management, dietary restriction tracking |
| Privacy-Conscious Cook | Any age, concerned about data collection | Full data ownership, no cloud dependency, no tracking of dietary habits |

### 1.3 Core Value Proposition

MyRecipes is a comprehensive, privacy-first kitchen companion that manages the entire food lifecycle: growing ingredients in the garden, storing and discovering recipes, planning meals for the week, generating shopping lists, cooking with step-by-step guidance and timers, and hosting events with menu planning and guest management. Unlike Paprika, Mela, or Plan to Eat, MyRecipes combines recipe management, meal planning, garden tracking, and event hosting in a single offline-first app with zero recurring costs and zero data collection. All data stays on-device in local SQLite.

### 1.4 Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Differentiator |
|-----------|-----------|------------|-------------------|
| Paprika 3 | Solid recipe management, web import, cross-platform | No meal planning depth, no garden features, no events, paid per-platform ($4.99 iOS, $29.99 desktop) | Full meal planning, garden tracking, event hosting, single purchase |
| Mela | Beautiful UI, video recipe import, excellent web scraper | No meal planning, no garden, no events, iOS/Mac only | Cross-platform, meal planning, garden, events, broader import support |
| Plan to Eat | Best-in-class meal planning and grocery lists | $49.97/yr subscription, cloud-required, no offline, no garden/events | Offline-first, no subscription, garden integration, event hosting |
| Crouton | Clean cooking mode, good timer support | Limited features, small user base, no meal planning | Far more comprehensive feature set |
| Recipe Keeper | Good cross-platform support, family sharing | Basic meal planning, no garden, dated UI | Modern UI, garden, events, better cooking mode |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All recipe data, meal plans, garden logs, and event details are stored locally on the device in SQLite
- Zero analytics, zero telemetry, zero tracking
- No account required for any functionality
- Users own their data with full export (JSON, CSV) and delete capabilities
- No data ever leaves the device unless the user explicitly initiates an export or share action
- Web recipe import fetches the URL content to parse recipe data but transmits no user information
- OCR scanning for paper recipes runs entirely on-device using platform vision APIs
- Nutritional calculations use a bundled food composition database with no network calls
- Voice commands in cooking mode use platform speech recognition APIs with no audio transmitted to external servers
- Recipe sharing generates a local image or self-contained file; no server or account required

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| RC-001 | Recipe CRUD | P0 | Core | None | Implemented |
| RC-002 | Ingredient Management | P0 | Core | RC-001 | Implemented |
| RC-003 | Recipe Steps | P0 | Core | RC-001 | Implemented |
| RC-004 | Recipe Categories and Tags | P0 | Data Management | RC-001 | Implemented |
| RC-005 | Ingredient Parser | P0 | Core | RC-002 | Implemented |
| RC-006 | Recipe Scaling | P0 | Core | RC-002, RC-005 | Implemented |
| RC-007 | Unit Conversion | P0 | Core | RC-005 | Implemented |
| RC-008 | Cooking Mode | P0 | Core | RC-003 | Implemented |
| RC-009 | Multiple Cooking Timers | P0 | Core | RC-008 | Implemented |
| RC-010 | Web Recipe Import | P0 | Import/Export | RC-001, RC-005 | Implemented |
| RC-011 | Meal Planner Calendar | P0 | Core | RC-001 | Implemented |
| RC-012 | Auto-Generated Shopping List | P0 | Core | RC-011, RC-002 | Implemented |
| RC-013 | Pantry Tracker | P1 | Core | RC-012 | Implemented |
| RC-014 | Allergy and Dietary Detection | P1 | Core | RC-002 | Implemented |
| RC-015 | Recipe Search and Filtering | P0 | Data Management | RC-001, RC-004 | Implemented |
| RC-016 | Garden Plant Tracking | P1 | Garden | None | Implemented |
| RC-017 | Garden Layout Planner | P1 | Garden | RC-016 | Implemented |
| RC-018 | Harvest Tracking | P1 | Garden | RC-016 | Implemented |
| RC-019 | Garden-to-Recipe Linking | P1 | Garden | RC-018, RC-001 | Implemented |
| RC-020 | Event Hosting | P1 | Social | RC-001 | Implemented |
| RC-021 | RSVP System | P1 | Social | RC-020 | Implemented |
| RC-022 | Event Menu Planning | P1 | Social | RC-020, RC-001 | Implemented |
| RC-023 | Event Allergy Warnings | P1 | Social | RC-022, RC-014 | Implemented |
| RC-024 | Potluck Coordination | P1 | Social | RC-020, RC-021 | Implemented |
| RC-025 | Event Timeline | P1 | Social | RC-020 | Implemented |
| RC-026 | Video Recipe Import | P1 | Import/Export | RC-001, RC-005 | Not Started |
| RC-027 | Paper Recipe OCR Scanning | P1 | Import/Export | RC-001, RC-005 | Not Started |
| RC-028 | Nutritional Info Per Recipe | P1 | Analytics | RC-002, RC-005 | Not Started |
| RC-029 | Voice Control in Cooking Mode | P2 | Core | RC-008 | Not Started |
| RC-030 | AI Recipe Suggestions | P2 | Analytics | RC-013, RC-001 | Not Started |
| RC-031 | Print Recipes | P2 | Import/Export | RC-001 | Not Started |
| RC-032 | Recipe Sharing | P2 | Social | RC-001 | Not Started |
| RC-033 | Import from External Apps | P1 | Import/Export | RC-001, RC-005 | Not Started |
| RC-034 | Cooking History Log | P1 | Analytics | RC-001, RC-008 | Not Started |
| RC-035 | Recipe Ratings | P0 | Core | RC-001 | Implemented |
| RC-036 | Freezer Inventory | P2 | Core | RC-013 | Not Started |
| RC-037 | Settings and Preferences | P0 | Settings | None | Implemented |
| RC-038 | Garden Journal | P1 | Garden | RC-016 | Implemented |
| RC-039 | Onboarding and First-Run | P1 | Onboarding | RC-001 | Not Started |

**Priority Legend:**
- **P0** - MVP must-have. The product does not launch without this.
- **P1** - High-value. Ship shortly after MVP or include if time allows.
- **P2** - Nice-to-have. Adds polish and delight but product is usable without it.
- **P3** - Future/low-priority. Planned for later phases or may be cut.

**Category Legend:**
- **Core** - Fundamental product functionality
- **Data Management** - CRUD operations, organization, search
- **Analytics** - Stats, reports, insights, nutritional data
- **Import/Export** - Data portability (import from competitors, URL scraping, OCR, export)
- **Social** - Sharing, events, guest management
- **Settings** - User preferences, configuration, customization
- **Onboarding** - First-run experience, tutorials, sample data
- **Garden** - Plant tracking, garden layout, harvests

---

## 3. Feature Specifications

### RC-001: Recipe CRUD

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-001 |
| **Feature Name** | Recipe CRUD |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a home cook, I want to create, view, edit, and delete recipes, so that I can build and maintain my personal recipe collection.

**Secondary:**
> As a recipe collector, I want to store recipes with photos, source URLs, prep/cook times, difficulty, and personal notes, so that I have all relevant information in one place.

#### 3.3 Detailed Description

Recipe CRUD is the foundational feature of MyRecipes. Users can create recipes with a rich set of metadata including title, description, servings, prep time, cook time, total time, difficulty level, source URL, photo, favorite status, personal rating, and free-form notes. Recipes are stored in local SQLite with the `rc_` table prefix.

The recipe list displays recipes sorted by most recently created by default, with support for filtering and sorting by various fields. Each recipe card shows the title, photo (if available), difficulty badge, prep/cook time, and favorite indicator. Tapping a recipe opens the full detail view with all metadata, ingredients, steps, and tags.

Users can mark recipes as favorites for quick access and assign a 1-5 star rating for personal quality tracking. The notes field supports free-form text for personal modifications, tips, or memories associated with the recipe.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (foundational feature)

**External Dependencies:**
- Local storage for SQLite database
- Camera or photo library access for recipe photos (optional)

**Assumed Capabilities:**
- User can navigate between screens via tab bar
- Local database is initialized and writable

#### 3.5 User Interface Requirements

##### Screen: Recipe List

**Layout:**
- Top navigation bar showing "Recipes" title and an "Add" button (plus icon) on the right
- Below the nav bar, a search bar with filter toggle buttons (Favorites, Difficulty, Tags)
- Main content area is a scrollable grid (2 columns on phone, 3-4 on tablet/web) of recipe cards
- Each card displays: recipe photo (or placeholder), title, difficulty badge, total time, and a favorite heart icon
- Tapping a card navigates to the Recipe Detail screen
- The floating action button in the bottom-right corner opens the Add Recipe screen

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No recipes exist | Illustration of a cookbook with message "No recipes yet. Tap + to add your first recipe." and a prominent "Add Recipe" button |
| Loading | Database query in progress | Skeleton card placeholders (4-6 cards) |
| Populated | Recipes exist | Grid of recipe cards sorted by created_at DESC |
| Error | Database read fails | Toast: "Could not load recipes. Please try again." with retry button |
| Search Active | User is filtering | Filtered grid; if no matches: "No recipes match your search." |

**Interactions:**
- Tap card: Navigate to Recipe Detail
- Long press card: Context menu with Edit, Delete, Toggle Favorite
- Swipe left on card (mobile): Reveal Delete button
- Pull-to-refresh: Reload recipe list from database
- Tap favorite heart: Toggle favorite status without navigating

##### Screen: Recipe Detail

**Layout:**
- Full-width hero photo at top (or colored placeholder with recipe icon if no photo)
- Below photo: title (large), difficulty badge, prep/cook/total time row, servings count
- Star rating display (tappable to change)
- Favorite heart toggle button in the top-right
- Tabbed content area below with tabs: Ingredients, Steps, Notes
- Action bar at bottom: Edit, Cook (launches cooking mode), Scale, Share

**Interactions:**
- Tap Edit: Navigate to Edit Recipe screen
- Tap Cook: Launch Cooking Mode (RC-008)
- Tap Scale: Open scaling dialog (RC-006)
- Tap Share: Open share options (RC-032)
- Tap star rating: Update rating inline
- Tap favorite heart: Toggle favorite status

##### Screen: Add/Edit Recipe

**Layout:**
- Scrollable form with the following fields in order:
  - Photo picker (tap to add/change photo from camera or library)
  - Title (text input, required)
  - Description (multiline text input, optional)
  - Servings (number input, optional)
  - Prep Time (number input in minutes, optional)
  - Cook Time (number input in minutes, optional)
  - Difficulty (segmented control: Easy / Medium / Hard, optional)
  - Source URL (text input, optional)
  - Notes (multiline text input, optional)
- "Ingredients" section with add/reorder/delete capability (see RC-002)
- "Steps" section with add/reorder/delete capability (see RC-003)
- "Tags" section with add/delete capability (see RC-004)
- Save button in the top-right; Cancel/Back in the top-left

**Interactions:**
- Tap Save: Validate required fields, persist to database, navigate back to detail or list
- Tap Cancel: Confirm discard if changes exist, then navigate back
- Drag handles on ingredients/steps: Reorder via drag-and-drop

#### 3.6 Data Requirements

##### Entity: Recipe

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique recipe identifier |
| title | TEXT | Required, NOT NULL, min 1 char | None | Recipe title |
| description | TEXT | Optional | null | Short description of the recipe |
| servings | INTEGER | Optional, positive if provided | null | Number of servings the recipe makes |
| prep_time_mins | INTEGER | Optional, non-negative | null | Preparation time in minutes |
| cook_time_mins | INTEGER | Optional, non-negative | null | Cooking time in minutes |
| total_time_mins | INTEGER | Optional, non-negative | null | Total time in minutes (may differ from prep + cook) |
| difficulty | TEXT | One of: easy, medium, hard | null | Recipe difficulty level |
| source_url | TEXT | Optional, valid URL if provided | null | URL where the recipe was found |
| image_uri | TEXT | Optional | null | Local file path or URI to recipe photo |
| is_favorite | INTEGER | 0 or 1 | 0 | Whether recipe is marked as favorite |
| rating | INTEGER | 0-5 | 0 | Personal rating (0 = unrated) |
| notes | TEXT | Optional | null | Personal notes about the recipe |
| created_at | TEXT | ISO 8601, auto-set | datetime('now') | Record creation timestamp |
| updated_at | TEXT | ISO 8601, auto-set on modification | datetime('now') | Last modification timestamp |

**Indexes:**
- `rc_recipes_title_idx` on `title` - title search
- `rc_recipes_favorite_idx` on `is_favorite` WHERE `is_favorite = 1` - favorite filtering
- `rc_recipes_difficulty_idx` on `difficulty` - difficulty filtering
- `rc_recipes_created_idx` on `created_at` - default sort order

**Validation Rules:**
- `title`: Must not be empty string after trimming whitespace
- `servings`: If provided, must be a positive integer
- `prep_time_mins`, `cook_time_mins`, `total_time_mins`: If provided, must be non-negative integers
- `difficulty`: If provided, must be one of 'easy', 'medium', 'hard'
- `rating`: Must be integer between 0 and 5 inclusive

**Example Data:**

```json
{
  "id": "r-abc123",
  "title": "Pasta Carbonara",
  "description": "Classic Roman pasta with eggs, cheese, and guanciale",
  "servings": 4,
  "prep_time_mins": 15,
  "cook_time_mins": 20,
  "total_time_mins": 35,
  "difficulty": "medium",
  "source_url": null,
  "image_uri": "/local/photos/carbonara.jpg",
  "is_favorite": 1,
  "rating": 5,
  "notes": "Use pecorino romano, not parmesan. Reserve extra pasta water.",
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-02-20T18:45:00Z"
}
```

#### 3.7 Business Logic Rules

##### Recipe Total Time Calculation

**Purpose:** Auto-calculate total_time_mins when not explicitly provided.

**Inputs:**
- prep_time_mins: integer | null
- cook_time_mins: integer | null
- total_time_mins: integer | null (user override)

**Logic:**

```
1. IF total_time_mins is explicitly provided by user, use that value
2. ELSE IF both prep_time_mins and cook_time_mins are provided:
     total_time_mins = prep_time_mins + cook_time_mins
3. ELSE total_time_mins = null (unknown)
```

**Edge Cases:**
- User provides total_time_mins of 45 but prep (10) + cook (20) = 30: Use user's value (45) since they may account for resting time
- Only prep_time provided: total_time_mins = null (not enough info)
- All times are null: total_time_mins = null

##### Default Sort Order

**Default sort:** Most recently created first (`created_at DESC`)

**Available sort options:** Title A-Z, Title Z-A, Newest First, Oldest First, Rating (highest first), Prep Time (shortest first), Cook Time (shortest first)

**Tiebreaker:** When primary sort values are equal, break ties by `created_at DESC`

**Filter options:** Favorites only, Difficulty (easy/medium/hard), Tag, Search text (title substring match)

**Search:** Title field, substring match, case-insensitive

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on save | Toast: "Could not save recipe. Please try again." | User taps Save again; form data is preserved |
| Required title field blank | Inline validation: "Recipe title is required" below title field | User fills in title; error clears on input |
| Photo file not found | Recipe displays placeholder image | User can re-add photo from Edit screen |
| Duplicate recipe title | No error (duplicates are allowed) | N/A |

**Validation Timing:**
- Title required validation runs on blur and on save
- Numeric fields (servings, times) validate on blur for format correctness

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** no recipes exist,
   **When** the user taps Add, fills in title "Pasta Carbonara" and servings 4, and taps Save,
   **Then** a new recipe appears in the recipe list with title "Pasta Carbonara".

2. **Given** a recipe "Pasta Carbonara" exists,
   **When** the user opens it and taps Edit, changes the title to "Classic Carbonara", and saves,
   **Then** the recipe list shows "Classic Carbonara" and the detail screen reflects the updated title.

3. **Given** a recipe "Pasta Carbonara" exists,
   **When** the user deletes it via long press context menu and confirms,
   **Then** the recipe no longer appears in the list and the recipe count decreases by 1.

**Edge Cases:**

4. **Given** a recipe has no photo,
   **When** the user views the recipe detail,
   **Then** a styled placeholder image is displayed instead of a broken image.

5. **Given** 100+ recipes exist,
   **When** the user scrolls the recipe list,
   **Then** recipes load in pages of 50 with smooth infinite scroll.

**Negative Tests:**

6. **Given** the Add Recipe form is open,
   **When** the user tries to save with an empty title,
   **Then** the system shows inline error "Recipe title is required" and does not save.
   **And** no database record is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates recipe with minimal fields | title: "Pasta" | Recipe object with title "Pasta", is_favorite: 0, rating: 0 |
| creates recipe with all fields | full input object | Recipe object with all fields matching input |
| returns null for non-existent recipe | id: "nonexistent" | null |
| counts recipes correctly | 3 recipes created | count: 3 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create and retrieve recipe | 1. Create recipe, 2. Query by ID | Retrieved recipe matches created recipe |
| Update recipe title | 1. Create recipe, 2. Update title, 3. Query | Title reflects update, updated_at changes |
| Delete recipe cascades | 1. Create recipe with ingredients and tags, 2. Delete recipe | Recipe, ingredients, and tags all removed |

---

### RC-002: Ingredient Management

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-002 |
| **Feature Name** | Ingredient Management |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a home cook, I want to add, edit, reorder, and remove ingredients from my recipes, so that I have an accurate list of what I need to prepare each dish.

#### 3.3 Detailed Description

Each recipe contains an ordered list of ingredients. Ingredients are stored as separate records linked to a recipe, with fields for name, quantity (as a string to support fractions like "2 1/2"), unit, and sort order. Ingredients cascade-delete when their parent recipe is deleted.

Users add ingredients one at a time or paste a block of text that gets parsed via the Ingredient Parser (RC-005). Ingredients can be reordered via drag-and-drop handles and edited inline. The sort_order field determines display order.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-001: Recipe CRUD - Ingredients belong to a recipe

#### 3.5 User Interface Requirements

##### Section: Ingredients (within Add/Edit Recipe)

**Layout:**
- Section header "Ingredients" with an "Add" button
- Ordered list of ingredient rows, each showing: drag handle, quantity + unit, name, delete (X) button
- Tapping an ingredient row makes it editable inline
- "Add ingredient" row at the bottom with text input and quick-parse support
- "Paste ingredients" option that accepts multi-line text (one ingredient per line) and parses each via RC-005

**Interactions:**
- Tap Add: Focus on new ingredient input
- Drag handle: Reorder ingredient in the list
- Tap ingredient: Edit inline
- Tap X: Remove ingredient (no confirmation needed for single ingredient)
- Paste multi-line text: Parse each line as a separate ingredient

#### 3.6 Data Requirements

##### Entity: Ingredient

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique ingredient identifier |
| recipe_id | TEXT | Foreign key to rc_recipes(id), NOT NULL, CASCADE | None | Parent recipe |
| name | TEXT | Required, NOT NULL, min 1 char | None | Ingredient name (e.g., "all-purpose flour") |
| quantity | TEXT | Optional | null | Quantity as string (e.g., "2 1/2", "1-2", "3") |
| unit | TEXT | Optional | null | Unit of measure (e.g., "cups", "tbsp", "oz") |
| sort_order | INTEGER | NOT NULL | 0 | Display order within the recipe |

**Indexes:**
- `rc_ingredients_recipe_idx` on `recipe_id` - fast lookup by recipe

**Validation Rules:**
- `name`: Must not be empty after trimming
- `recipe_id`: Must reference an existing recipe

**Example Data:**

```json
{
  "id": "i-001",
  "recipe_id": "r-abc123",
  "name": "all-purpose flour",
  "quantity": "2 1/2",
  "unit": "cups",
  "sort_order": 0
}
```

#### 3.7 Business Logic Rules

##### Ingredient Sort Order Management

**Purpose:** Maintain consistent ordering when ingredients are added, removed, or reordered.

**Logic:**

```
1. New ingredient: sort_order = (max sort_order in recipe) + 1, or 0 if first
2. Reorder ingredient: Update sort_order of moved ingredient and shift affected items
3. Delete ingredient: No reindex needed (gaps in sort_order are acceptable)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Empty ingredient name | Inline error: "Ingredient name is required" | User fills in name |
| Database write fails | Toast: "Could not save ingredient" | User retries |

#### 3.9 Acceptance Criteria

1. **Given** a recipe exists,
   **When** the user adds an ingredient "2 cups flour",
   **Then** the ingredient appears in the ingredient list with quantity "2", unit "cups", name "flour".

2. **Given** a recipe has 3 ingredients,
   **When** the user drags ingredient #3 to position #1,
   **Then** the ingredient list reflects the new order and sort_order values are updated.

3. **Given** a recipe has ingredients,
   **When** the recipe is deleted,
   **Then** all associated ingredients are also deleted (CASCADE).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| adds ingredient to recipe | recipe_id, name: "flour", qty: "2", unit: "cups" | Ingredient record created with correct fields |
| retrieves ingredients in sort order | 3 ingredients with sort_order 0, 1, 2 | Array of 3 ingredients in order |
| updates ingredient name | id, name: "New Name" | Ingredient name updated |
| deletes single ingredient | ingredient id | Ingredient removed, others unchanged |

---

### RC-003: Recipe Steps

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-003 |
| **Feature Name** | Recipe Steps |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a home cook, I want to add step-by-step instructions to my recipes with optional timer durations, so that I can follow the recipe in sequence during cooking.

#### 3.3 Detailed Description

Each recipe contains an ordered list of preparation steps. Each step has a step number, instruction text, an optional timer duration in minutes, and a sort order. The timer_minutes field is auto-detected from the instruction text using the `detectStepTimerMinutes` function (e.g., "Bake for 25 minutes at 350F" auto-sets timer to 25) but can be overridden manually.

Steps are displayed as a numbered list in the recipe detail view and serve as the primary content for Cooking Mode (RC-008). Steps cascade-delete when their parent recipe is deleted.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-001: Recipe CRUD - Steps belong to a recipe

#### 3.5 User Interface Requirements

##### Section: Steps (within Add/Edit Recipe)

**Layout:**
- Section header "Steps" with an "Add Step" button
- Numbered list of step rows, each showing: drag handle, step number, instruction text (multiline), timer badge (if timer_minutes is set), delete button
- Tapping a step makes it editable inline with a multiline text input
- Timer icon next to instruction that shows auto-detected or manually set duration
- "Add step" row at the bottom

**Interactions:**
- Tap Add Step: Add new step at end, focus text input
- Drag handle: Reorder steps (step numbers auto-recalculate)
- Tap step: Edit instruction text inline
- Tap timer icon: Manual override of timer duration
- Tap X: Remove step

#### 3.6 Data Requirements

##### Entity: Step

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique step identifier |
| recipe_id | TEXT | Foreign key to rc_recipes(id), NOT NULL, CASCADE | None | Parent recipe |
| step_number | INTEGER | Required, positive | None | Display step number (1-based) |
| instruction | TEXT | Required, NOT NULL, min 1 char | None | Step instruction text |
| timer_minutes | INTEGER | Optional, positive if provided | null | Timer duration in minutes for this step |
| sort_order | INTEGER | NOT NULL | 0 | Sort position within the recipe |

**Indexes:**
- `rc_steps_recipe_idx` on `recipe_id` - fast lookup by recipe

**Example Data:**

```json
{
  "id": "s-001",
  "recipe_id": "r-abc123",
  "step_number": 1,
  "instruction": "Bring a large pot of salted water to a boil. Cook spaghetti until al dente, about 8 minutes.",
  "timer_minutes": 8,
  "sort_order": 0
}
```

#### 3.7 Business Logic Rules

##### Timer Auto-Detection (detectStepTimerMinutes)

**Purpose:** Automatically extract timer duration from recipe step instruction text.

**Inputs:**
- instruction: string - The step instruction text

**Logic:**

```
1. Convert instruction to lowercase
2. Check for time ranges first (e.g., "10-15 minutes"):
   a. Match pattern: (\d+)\s*-\s*(\d+)\s*(minute|min|minutes|hour|hours|hr|hrs)
   b. IF match found: use the HIGHER number (conservative - user can always stop early)
   c. IF unit starts with 'h': multiply by 60
3. Check for explicit time mentions:
   a. Match hours: (\d+)\s*(hour|hours|hr|hrs)
   b. Match minutes: (\d+)\s*(minute|minutes|min|mins)
   c. Calculate total = (hours * 60) + minutes
4. IF total > 0: RETURN total
5. ELSE: RETURN null (no timer detected)
```

**Edge Cases:**
- "Bake for 25 minutes" returns 25
- "Simmer for 1 hour 10 minutes" returns 70
- "Cook 10-15 minutes" returns 15 (upper bound)
- "Let rest for 5 minutes" returns 5
- "Stir constantly" returns null (no time reference)
- "3 hours" returns 180

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Empty step instruction | Inline error: "Step instruction is required" | User fills in text |
| Timer parse fails | No timer badge shown; user can set manually | User taps timer icon to set duration |

#### 3.9 Acceptance Criteria

1. **Given** a recipe exists,
   **When** the user adds a step "Bake for 25 minutes at 350F",
   **Then** the step is created with step_number 1, instruction text, and timer_minutes 25.

2. **Given** a step has auto-detected timer of 25 minutes,
   **When** the user manually overrides the timer to 30 minutes,
   **Then** the timer_minutes is 30 (manual override wins).

3. **Given** a recipe has 5 steps,
   **When** step #2 is deleted,
   **Then** the remaining steps renumber to 1, 2, 3, 4.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| detects minutes from instruction | "Bake for 25 minutes at 350F" | 25 |
| detects hours and minutes | "Simmer for 1 hour 10 minutes" | 70 |
| detects range (uses upper bound) | "Cook 10-15 minutes" | 15 |
| returns null for no time | "Stir constantly" | null |
| detects hours only | "Roast for 2 hours" | 120 |

---

### RC-004: Recipe Categories and Tags

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-004 |
| **Feature Name** | Recipe Categories and Tags |
| **Priority** | P0 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a recipe collector, I want to tag my recipes with categories like "Italian", "Quick Meals", "Vegetarian", so that I can organize and filter my collection.

#### 3.3 Detailed Description

Recipes can have multiple tags assigned via a many-to-many relationship through the `rc_recipe_tags` table. Tags are simple strings (no separate tag entity or taxonomy). Users type tags when creating or editing recipes. The tag list on a recipe is displayed as chips/badges.

Tags serve as a flexible categorization system. Users can filter the recipe list by tag to see all recipes with a specific tag. Common tag patterns include cuisine type (Italian, Mexican, Thai), meal type (Breakfast, Lunch, Dinner, Snack, Dessert), dietary (Vegetarian, Vegan, Gluten-Free, Dairy-Free), and custom labels (Quick, Party, Holiday, Family Favorite).

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-001: Recipe CRUD - Tags belong to a recipe

#### 3.5 User Interface Requirements

##### Section: Tags (within Recipe Detail and Add/Edit Recipe)

**Layout:**
- Horizontal scrollable row of tag chips below the recipe metadata
- In edit mode: tag chips with X buttons to remove, plus a text input with autocomplete suggesting existing tags
- Tapping a tag from any recipe navigates to filtered list showing all recipes with that tag

**Interactions:**
- Tap tag (detail view): Navigate to recipe list filtered by that tag
- Tap X on tag (edit mode): Remove tag from recipe
- Type in tag input: Autocomplete suggests existing tags; Enter creates/assigns the tag
- Tap suggested tag: Assign existing tag to recipe

#### 3.6 Data Requirements

##### Entity: RecipeTag

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique tag assignment identifier |
| recipe_id | TEXT | Foreign key to rc_recipes(id), NOT NULL, CASCADE | None | Parent recipe |
| tag | TEXT | Required, NOT NULL, min 1 char | None | Tag string (e.g., "Italian", "Quick") |

**Indexes:**
- `rc_recipe_tags_recipe_idx` on `recipe_id` - all tags for a recipe
- `rc_recipe_tags_tag_idx` on `tag` - all recipes with a specific tag

**Validation Rules:**
- `tag`: Must not be empty after trimming; stored as-is (case-sensitive)
- Duplicate tag on same recipe: Silently ignored (no error, no duplicate created)

#### 3.7 Business Logic Rules

##### Tag Autocomplete

**Purpose:** Suggest existing tags as the user types to encourage consistent naming.

**Logic:**

```
1. Collect all DISTINCT tags from rc_recipe_tags
2. Filter by prefix match (case-insensitive) against user input
3. Sort by frequency (most-used tags first)
4. Return top 10 suggestions
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Empty tag submitted | Input is silently ignored (no tag created) | User types a valid tag |
| Tag already exists on recipe | Silently ignored (no duplicate) | N/A |

#### 3.9 Acceptance Criteria

1. **Given** a recipe exists,
   **When** the user adds tags "Italian" and "Quick",
   **Then** both tags appear as chips on the recipe detail.

2. **Given** recipes "Pasta" (tag: Italian) and "Sushi" (tag: Japanese) exist,
   **When** the user filters by tag "Italian",
   **Then** only "Pasta" appears in the results.

3. **Given** a recipe has tag "Italian",
   **When** the user removes the "Italian" tag,
   **Then** the tag no longer appears on the recipe and filtering by "Italian" excludes this recipe.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| adds tag to recipe | recipe_id, tag: "italian" | RecipeTag record created |
| retrieves all tags for recipe | recipe with 2 tags | Array of 2 RecipeTag objects |
| filters recipes by tag | tag: "italian" | Only recipes with "italian" tag |
| deletes tag | tag id | Tag removed, recipe unchanged |

---

### RC-005: Ingredient Parser

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-005 |
| **Feature Name** | Ingredient Parser |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a home cook, I want to type or paste ingredient text like "2 1/2 cups all-purpose flour, sifted" and have it automatically parsed into structured quantity, unit, and name fields, so that I do not have to manually fill in each field separately.

#### 3.3 Detailed Description

The ingredient parser is critical business logic that transforms free-text ingredient strings into structured data (quantity, unit, name). It handles fractions, mixed numbers, ranges, optional ingredients, alternative ingredients, and preparation notes. This parser powers manual text entry, URL recipe import (RC-010), OCR import (RC-027), and recipe scaling (RC-006).

The parser must handle the full range of real-world recipe ingredient formats found in cookbooks, food blogs, and handwritten recipes. It runs entirely on-device with no network calls.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-002: Ingredient Management - Parser produces Ingredient records

**External Dependencies:**
- None (pure text processing, no network)

#### 3.5 User Interface Requirements

No dedicated UI. The parser runs behind the scenes when users type or paste ingredient text. Parsed results are shown as structured fields (quantity, unit, name) that users can edit if the parse was incorrect.

#### 3.6 Data Requirements

No new entities. Parser output populates Ingredient entity fields (quantity, unit, name).

#### 3.7 Business Logic Rules

##### Ingredient Text Parsing Algorithm

**Purpose:** Parse a free-text ingredient string into structured quantity, unit, and name components.

**Inputs:**
- text: string - Raw ingredient text (e.g., "2 1/2 cups all-purpose flour, sifted")

**Output:**
- quantity: string | null - Numeric quantity as a string (to preserve fractions)
- unit: string | null - Unit of measure (normalized)
- name: string - Ingredient name (with prep notes stripped or appended)

**Logic:**

```
1. TRIM whitespace from input
2. REMOVE leading bullet points, dashes, or list markers: /^[\-\*\u2022]\s*/
3. EXTRACT optional marker: if text contains "(optional)" or "optional", remove it and flag
4. EXTRACT preparation notes: text after comma is treated as prep notes
   e.g., "flour, sifted" -> name: "flour", prep: "sifted"
5. EXTRACT alternatives: if " or " appears, treat first item as primary
   e.g., "milk or cream" -> name: "milk" (alt: "cream")
6. PARSE quantity:
   a. Unicode fractions: replace \u00BC with 1/4, \u00BD with 1/2, \u00BE with 3/4,
      \u2153 with 1/3, \u2154 with 2/3, \u2155 with 1/5, \u2156 with 2/5,
      \u2157 with 3/5, \u215B with 1/8, \u215C with 3/8
   b. Mixed numbers: match /^(\d+)\s+(\d+)\/(\d+)/
      e.g., "2 1/2" -> quantity = "2.5"
   c. Simple fractions: match /^(\d+)\/(\d+)/
      e.g., "1/4" -> quantity = "0.25"
   d. Ranges: match /^(\d+[\d\/\s]*)\s*[-\u2013]\s*(\d+[\d\/\s]*)/
      e.g., "1-2" -> quantity = "1-2" (stored as string, not averaged)
   e. Decimals: match /^(\d+\.?\d*)/
      e.g., "2.5" -> quantity = "2.5"
   f. Word numbers: "one" -> 1, "two" -> 2, ... "twelve" -> 12,
      "a" or "an" -> 1, "half" -> 0.5, "quarter" -> 0.25
   g. No number found: quantity = null (e.g., "salt to taste")
7. PARSE unit (after quantity is extracted):
   a. Match against known unit list (case-insensitive):
      Volume: cup/cups/c, tablespoon/tablespoons/tbsp/T/tbs,
              teaspoon/teaspoons/tsp/t, fluid ounce/fl oz/fl. oz,
              milliliter/milliliters/ml/mL, liter/liters/l/L,
              pint/pints/pt, quart/quarts/qt, gallon/gallons/gal
      Weight: ounce/ounces/oz, pound/pounds/lb/lbs,
              gram/grams/g, kilogram/kilograms/kg
      Count:  piece/pieces/pc, slice/slices, clove/cloves,
              sprig/sprigs, stalk/stalks, bunch/bunches,
              head/heads, can/cans, package/packages/pkg,
              bag/bags, box/boxes, jar/jars, bottle/bottles
      Size:   pinch/pinches, dash/dashes, handful/handfuls,
              small/medium/large (when before a noun)
   b. Normalize to canonical form:
      cups -> cup, tablespoons/tbsp/T/tbs -> tbsp,
      teaspoons/tsp/t -> tsp, ounces/oz -> oz,
      pounds/lbs -> lb, grams/g -> g,
      milliliters/ml -> mL, liters/l -> L
   c. No unit found: unit = null (ingredient is counted or "to taste")
8. REMAINING text after quantity and unit extraction = ingredient name
9. CLEAN name: trim whitespace, remove leading "of " (e.g., "of flour" -> "flour")
10. RETURN { quantity, unit, name }
```

**Fraction-to-Decimal Conversion Table:**

| Fraction | Decimal | Fraction | Decimal |
|----------|---------|----------|---------|
| 1/8 | 0.125 | 1/2 | 0.5 |
| 1/4 | 0.25 | 5/8 | 0.625 |
| 1/3 | 0.333 | 2/3 | 0.667 |
| 3/8 | 0.375 | 3/4 | 0.75 |

**Parse Examples:**

| Input | Quantity | Unit | Name |
|-------|----------|------|------|
| "2 1/2 cups all-purpose flour, sifted" | "2.5" | "cup" | "all-purpose flour, sifted" |
| "3 large eggs" | "3" | null | "large eggs" |
| "1/4 tsp salt" | "0.25" | "tsp" | "salt" |
| "salt and pepper to taste" | null | null | "salt and pepper to taste" |
| "1-2 cups milk or cream" | "1-2" | "cup" | "milk" |
| "one 14-oz can diced tomatoes" | "1" | null | "14-oz can diced tomatoes" |
| "a handful of fresh basil" | "1" | "handful" | "fresh basil" |
| "2 cloves garlic, minced" | "2" | "clove" | "garlic, minced" |
| "1 (15 oz) can black beans" | "1" | null | "(15 oz) can black beans" |
| "butter (optional)" | null | null | "butter" |

**Edge Cases:**
- Leading zeros: "01 cup" -> quantity "1"
- Very large quantities: "100 g" -> quantity "100", unit "g"
- Multiple commas: "flour, sifted, measured" -> name includes all prep notes
- Empty string: returns { quantity: null, unit: null, name: "" } (rejected by validation)
- "to taste" suffix: preserved in name, no quantity/unit
- Parenthetical sizes: "1 (15 oz) can" - parse "1" as quantity, rest as name

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Parser cannot parse quantity | quantity = null, entire text becomes name | User can manually edit the parsed fields |
| Unknown unit | unit = null, unit text becomes part of name | User can manually set unit |
| Ambiguous parse | Best-effort parse shown to user | User adjusts parsed fields as needed |

#### 3.9 Acceptance Criteria

1. **Given** the user types "2 1/2 cups all-purpose flour",
   **When** the parser processes the text,
   **Then** quantity = "2.5", unit = "cup", name = "all-purpose flour".

2. **Given** the user types "salt and pepper to taste",
   **When** the parser processes the text,
   **Then** quantity = null, unit = null, name = "salt and pepper to taste".

3. **Given** the user pastes 5 lines of ingredients,
   **When** each line is parsed,
   **Then** 5 structured ingredient records are created with correct quantity/unit/name splits.

4. **Given** the parser produces incorrect results,
   **When** the user manually edits the quantity, unit, or name fields,
   **Then** the manual edits are saved (parser result is not final).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| parses simple quantity + unit + name | "2 cups flour" | qty: "2", unit: "cup", name: "flour" |
| parses mixed number fraction | "2 1/2 cups flour" | qty: "2.5", unit: "cup", name: "flour" |
| parses fraction only | "1/4 tsp salt" | qty: "0.25", unit: "tsp", name: "salt" |
| handles no quantity | "salt to taste" | qty: null, unit: null, name: "salt to taste" |
| handles range | "1-2 cups milk" | qty: "1-2", unit: "cup", name: "milk" |
| normalizes unit names | "3 tablespoons butter" | qty: "3", unit: "tbsp", name: "butter" |
| handles unicode fractions | "\u00BD cup sugar" | qty: "0.5", unit: "cup", name: "sugar" |
| strips optional marker | "1 cup butter (optional)" | qty: "1", unit: "cup", name: "butter" |
| handles word numbers | "one large onion" | qty: "1", unit: null, name: "large onion" |
| handles prep notes after comma | "2 cloves garlic, minced" | qty: "2", unit: "clove", name: "garlic, minced" |

---

### RC-006: Recipe Scaling

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-006 |
| **Feature Name** | Recipe Scaling |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a home cook, I want to scale a recipe up or down (e.g., double it, halve it, or set a specific number of servings), so that ingredient quantities automatically adjust.

#### 3.3 Detailed Description

Recipe scaling multiplies all ingredient quantities by a scale factor. The scale factor is determined by the ratio of desired servings to original servings, or by a direct multiplier (0.5x, 2x, 3x, etc.). The scaling engine handles fractional results, unit boundary crossings (e.g., 2x "1/4 tsp" = "1/2 tsp", not "2/4 tsp"), and gracefully handles ingredients without quantities (they pass through unchanged).

Scaling is a temporary view transformation. It does not modify the stored recipe data. The user can return to the original servings at any time. Scaled quantities are displayed in a user-friendly format (simplified fractions, sensible units).

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-002: Ingredient Management - scaling operates on ingredient quantities
- RC-005: Ingredient Parser - parsed quantity format enables scaling math

#### 3.5 User Interface Requirements

##### Modal: Scale Recipe

**Layout:**
- Title: "Scale Recipe"
- Original servings display: "Original: 4 servings"
- Servings input: number stepper or text field for target servings
- Quick multiplier buttons: 0.5x, 1x, 1.5x, 2x, 3x, 4x
- Preview of scaled ingredient list below (showing original and scaled quantities side by side)
- Apply/Close buttons

**Interactions:**
- Tap multiplier button: Update target servings and preview
- Edit servings field: Recalculate preview
- Tap Apply: Display recipe with scaled quantities (non-destructive view)
- Tap Close: Return to original quantities

#### 3.6 Data Requirements

No new entities. Scaling produces ephemeral display values from existing Ingredient data.

#### 3.7 Business Logic Rules

##### Scaling Algorithm

**Purpose:** Calculate scaled ingredient quantities with user-friendly formatting.

**Inputs:**
- originalQuantity: string | null - The original quantity string (e.g., "2.5", "1-2")
- scaleFactor: number - The multiplier (e.g., 2.0 for doubling)

**Logic:**

```
1. IF originalQuantity is null or empty: RETURN null (unscalable, pass through)
2. IF originalQuantity contains a range (e.g., "1-2"):
   a. Parse both numbers
   b. Scale each independently: low * scaleFactor, high * scaleFactor
   c. RETURN formatted range (e.g., "2-4")
3. Parse originalQuantity to a decimal number
4. Multiply by scaleFactor: result = parsedQuantity * scaleFactor
5. FORMAT result:
   a. IF result is a whole number: return as integer string (e.g., "4")
   b. IF result maps to a common fraction (within 0.01 tolerance):
      0.125 -> "1/8", 0.25 -> "1/4", 0.333 -> "1/3", 0.375 -> "3/8",
      0.5 -> "1/2", 0.625 -> "5/8", 0.667 -> "2/3", 0.75 -> "3/4",
      0.875 -> "7/8"
   c. IF result has a whole part and fractional part (e.g., 2.5):
      Return as mixed number: "2 1/2"
   d. ELSE: Round to 2 decimal places
6. RETURN formatted string
```

##### Unit Boundary Crossing

**Purpose:** Convert to a more natural unit when scaled quantity becomes awkward.

**Rules:**

| Condition | Conversion |
|-----------|-----------|
| tsp >= 3 | Convert to tbsp (divide by 3) |
| tbsp >= 4 | Convert to 1/4 cup (divide by 4) |
| cup >= 4 | Convert to quart (divide by 4) |
| oz >= 16 | Convert to lb (divide by 16) |
| g >= 1000 | Convert to kg (divide by 1000) |
| mL >= 1000 | Convert to L (divide by 1000) |

**Edge Cases:**
- 2x "1/4 tsp" = "1/2 tsp" (not "2/4 tsp")
- 3x "1 tbsp" = "3 tbsp" (stays as tbsp, below cup threshold)
- 4x "1 tbsp" = "1/4 cup" (crosses to cup)
- 0.5x "1 cup" = "1/2 cup"
- 2x "8 oz" = "1 lb"
- Scaling "salt to taste" (null quantity): unchanged, displayed as-is
- Scaling by 0: All quantities become 0 (edge case, should be blocked by UI min=0.25)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Recipe has no servings set | Scaling modal shows multiplier buttons only (no servings-based scaling) | User uses multiplier buttons |
| Ingredient has no quantity | Ingredient shown as-is with note "cannot scale" | User manually adjusts |
| Very large scale factor (>10x) | Warning: "Scaling to very large quantities. Double-check results." | User proceeds or adjusts |

#### 3.9 Acceptance Criteria

1. **Given** a recipe with 4 servings and ingredient "1 cup flour",
   **When** the user scales to 8 servings (2x),
   **Then** the ingredient displays as "2 cups flour".

2. **Given** an ingredient "1/4 tsp salt",
   **When** the user applies 2x scale,
   **Then** the ingredient displays as "1/2 tsp salt" (simplified fraction).

3. **Given** an ingredient "1 tbsp butter",
   **When** the user applies 4x scale,
   **Then** the ingredient displays as "1/4 cup butter" (unit boundary crossing).

4. **Given** an ingredient "salt to taste" (no quantity),
   **When** any scale factor is applied,
   **Then** the ingredient displays unchanged as "salt to taste".

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| doubles whole number | qty: "2", scale: 2 | "4" |
| halves to fraction | qty: "1", scale: 0.5 | "1/2" |
| doubles fraction | qty: "1/4", scale: 2 | "1/2" |
| scales mixed number | qty: "2.5", scale: 2 | "5" |
| scales range | qty: "1-2", scale: 3 | "3-6" |
| returns null for null qty | qty: null, scale: 2 | null |
| unit boundary tsp to tbsp | qty: "1", unit: "tsp", scale: 3 | qty: "1", unit: "tbsp" |
| unit boundary tbsp to cup | qty: "1", unit: "tbsp", scale: 4 | qty: "1/4", unit: "cup" |

---

### RC-007: Unit Conversion

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-007 |
| **Feature Name** | Unit Conversion |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a home cook, I want to convert between measurement units (cups to mL, oz to g, F to C), so that I can follow recipes regardless of the measurement system used.

#### 3.3 Detailed Description

The unit conversion engine handles volume, weight, and temperature conversions. It is used inline within recipe views (tap a measurement to see its conversion), during recipe scaling, and in shopping list aggregation. The system supports US customary, metric, and imperial units.

Users can set a preferred measurement system (US or Metric) in settings. When set, the app can display all measurements in the preferred system. Conversions use standard culinary ratios.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-005: Ingredient Parser - Provides normalized unit strings

#### 3.5 User Interface Requirements

**Inline Conversion:**
- Tapping any quantity+unit in a recipe ingredient or step shows a popover with the converted value
- Example: Tap "2 cups" shows "473 mL" in a small tooltip

**Conversion Tool (in Settings or standalone):**
- Two-column converter: input value + unit on left, output value + unit on right
- Dropdown for source and target units
- Category tabs: Volume, Weight, Temperature

#### 3.6 Data Requirements

No new entities. Conversion tables are constants in code.

#### 3.7 Business Logic Rules

##### Volume Conversion Table (base unit: mL)

| Unit | mL Equivalent |
|------|--------------|
| tsp | 4.929 |
| tbsp | 14.787 |
| fl oz | 29.574 |
| cup | 236.588 |
| pint (pt) | 473.176 |
| quart (qt) | 946.353 |
| gallon (gal) | 3785.41 |
| mL | 1 |
| L | 1000 |

##### Weight Conversion Table (base unit: grams)

| Unit | Grams Equivalent |
|------|-----------------|
| oz | 28.3495 |
| lb | 453.592 |
| g | 1 |
| kg | 1000 |

##### Temperature Conversion Formulas

```
Fahrenheit to Celsius: C = (F - 32) * 5/9
Celsius to Fahrenheit: F = (C * 9/5) + 32
```

##### Conversion Algorithm

**Logic:**

```
1. Convert source value to base unit (mL for volume, g for weight)
2. Convert from base unit to target unit
3. Round to sensible precision:
   - Volume: 1 decimal place for mL/L, whole numbers for cups/tbsp/tsp
   - Weight: 1 decimal place for g/kg, 1 decimal place for oz/lb
   - Temperature: whole numbers
4. Format result with unit label
```

**Edge Cases:**
- Converting between volume and weight: Not supported without ingredient density data. Display message: "Volume-to-weight conversion depends on the ingredient. Use a kitchen scale for best results."
- Zero value: Return "0 [target unit]"
- Negative value: Only valid for temperature. Block for volume/weight.

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Incompatible unit types (volume to weight) | Message: "Cannot convert between volume and weight without ingredient density" | User selects compatible units |
| Unknown unit | Message: "Unknown unit" | User manually enters value |

#### 3.9 Acceptance Criteria

1. **Given** an ingredient shows "2 cups flour",
   **When** the user taps the measurement,
   **Then** a popover shows "473 mL".

2. **Given** a step mentions "350F",
   **When** the user taps the temperature,
   **Then** a popover shows "177C".

3. **Given** the user's preferred system is Metric,
   **When** viewing a recipe with US measurements,
   **Then** converted metric values are shown alongside or replacing US values.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| converts cups to mL | 2 cups | 473 mL |
| converts oz to g | 8 oz | 227 g |
| converts F to C | 350 F | 177 C |
| converts C to F | 200 C | 392 F |
| converts tbsp to tsp | 1 tbsp | 3 tsp |
| converts lb to kg | 2.5 lb | 1.1 kg |

---

### RC-008: Cooking Mode

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-008 |
| **Feature Name** | Cooking Mode |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a home cook, I want a step-by-step cooking view with large text and keep-screen-awake, so that I can follow the recipe hands-free while cooking.

#### 3.3 Detailed Description

Cooking Mode is a full-screen, distraction-free view designed for active cooking. It displays one step at a time in large, readable text. The screen stays awake during cooking mode (using expo-keep-awake or equivalent). Users swipe left/right or tap arrows to navigate between steps.

Each step shows the step number, instruction text, and a timer button if the step has an associated timer_minutes value. Tapping the timer button starts a countdown timer for that step. Multiple timers can run simultaneously (see RC-009). A persistent ingredients reference panel is accessible via a slide-up drawer.

Cooking Mode is launched from the Recipe Detail screen via the "Cook" button. It exits via a close button or swipe-down gesture, with a confirmation if timers are still running.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-003: Recipe Steps - Steps provide the content for cooking mode

**External Dependencies:**
- expo-keep-awake or equivalent for screen wake lock
- Device speakers/haptics for timer alarms

#### 3.5 User Interface Requirements

##### Screen: Cooking Mode

**Layout:**
- Full-screen view with dark background for reduced eye strain in kitchen lighting
- Top bar: recipe title, current step number / total steps, close (X) button
- Main area: large text (24-32pt) showing the current step instruction
- Timer button below instruction (if step has timer): shows timer badge with duration
- Bottom navigation: left arrow, step dots indicator, right arrow
- Slide-up drawer handle at bottom for ingredient reference panel
- When a timer is running: persistent timer bar at the top showing all active timers

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Active Step | Viewing a step | Step number, large instruction text, timer button if applicable |
| Timer Running | Timer is counting down | Persistent timer bar with countdown, step timer button shows remaining time |
| Timer Complete | Timer reaches 0:00 | Alert sound/vibration, full-screen overlay "Timer Done: [step description]", dismiss button |
| All Steps Complete | User navigates past last step | Summary screen: "Cooking complete!" with option to log to history (RC-034) |

**Interactions:**
- Swipe left: Next step
- Swipe right: Previous step
- Tap left arrow: Previous step
- Tap right arrow: Next step
- Tap timer button: Start timer for current step
- Tap running timer in bar: Navigate to that step
- Swipe up from bottom: Reveal ingredient reference drawer
- Tap X: If timers running, confirm exit. Otherwise, exit immediately.

**Transitions/Animations:**
- Step transitions: horizontal slide animation (300ms)
- Timer bar: slides down from top when first timer starts
- Ingredient drawer: slides up from bottom with spring animation

#### 3.6 Data Requirements

No new entities. Cooking Mode reads from Step and Ingredient entities.

#### 3.7 Business Logic Rules

##### Screen Wake Lock

**Logic:**

```
1. ON cooking mode enter: Activate screen wake lock (preventAutoLock)
2. ON cooking mode exit: Release screen wake lock
3. ON app background: Keep wake lock active (timers may be running)
4. ON app terminate: Release wake lock, fire local notification if timers running
```

##### Step Navigation

**Logic:**

```
1. Steps are displayed in sort_order
2. Current step index starts at 0
3. Navigate forward: index = min(index + 1, totalSteps - 1)
4. Navigate backward: index = max(index - 1, 0)
5. At first step: back arrow is disabled/hidden
6. At last step: forward arrow shows "Done" label
7. Tapping Done at last step: Show completion summary
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Recipe has no steps | Cooking mode shows message: "No steps available. Add steps to this recipe first." with "Edit Recipe" button | User navigates to edit recipe |
| Timer alarm fails to sound | Timer bar shows visual alert with screen flash | User sees visual indicator |
| App crashes during cooking | On next launch, offer to resume cooking mode for the last recipe | User taps "Resume" or dismisses |

#### 3.9 Acceptance Criteria

1. **Given** a recipe has 5 steps,
   **When** the user enters Cooking Mode,
   **Then** the first step is displayed in large text and the screen does not auto-lock.

2. **Given** the user is on step 3 of 5,
   **When** the user swipes left,
   **Then** step 4 is displayed with a slide animation.

3. **Given** step 2 has timer_minutes = 10,
   **When** the user taps the timer button on step 2 and then navigates to step 3,
   **Then** the timer bar at the top shows the step 2 countdown and the user can continue cooking step 3.

4. **Given** a timer reaches 0:00,
   **When** the alarm fires,
   **Then** the device plays an alarm sound, vibrates, and shows a full-screen "Timer Done" overlay.

5. **Given** timers are running,
   **When** the user taps the close button,
   **Then** a confirmation dialog asks "Timers are still running. Exit anyway?" with Cancel and Exit options.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| step navigation clamps at 0 | index: 0, action: back | index: 0 (no change) |
| step navigation clamps at max | index: 4, total: 5, action: forward | index: 4 (no change), show "Done" |
| step navigation forward | index: 2, action: forward | index: 3 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Enter and navigate cooking mode | 1. Open recipe with 3 steps, 2. Tap Cook, 3. Swipe through all steps | Each step displays correctly, final step shows "Done" |
| Timer persists across step navigation | 1. Start timer on step 1, 2. Navigate to step 3 | Timer bar shows step 1 countdown |

---

### RC-009: Multiple Cooking Timers

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-009 |
| **Feature Name** | Multiple Cooking Timers |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a home cook, I want to run multiple named timers simultaneously (e.g., "boil pasta 8 min" and "roast vegetables 25 min"), so that I can track parallel cooking tasks.

#### 3.3 Detailed Description

The timer system supports up to 10 concurrent named timers. Each timer has a label (from the step description or user-defined), duration, remaining time, and state (running, paused, completed). Timers persist across step navigation in cooking mode and fire an alarm (sound + vibration + visual overlay) when they complete.

Timers are ephemeral - they exist only during a cooking session and are not persisted to the database. The timer bar at the top of cooking mode shows all active timers as a horizontally scrollable strip of countdown badges.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-008: Cooking Mode - Timers live within cooking mode

**External Dependencies:**
- Audio playback for alarm sounds
- Haptic feedback for timer completion
- Local notifications for timers completing when app is backgrounded

#### 3.5 User Interface Requirements

##### Component: Timer Bar

**Layout:**
- Horizontal strip at the top of cooking mode (below recipe title)
- Each timer shown as a pill/badge: [label] [MM:SS] [pause/resume button]
- Active timers scroll horizontally if more than 3
- Tapping a timer navigates to its associated step
- Completed timers flash and show checkmark

##### Modal: Add Custom Timer

**Layout:**
- Title: "Add Timer"
- Label input (defaults to current step description, editable)
- Duration picker: minutes (0-240) and seconds (0-59)
- Start button

**Interactions:**
- Tap Start: Timer begins counting down immediately
- Tap outside modal: Cancel without starting timer

#### 3.6 Data Requirements

No persistent entities. Timer state is held in memory during the cooking session.

**In-Memory Timer Object:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique timer identifier |
| label | string | Timer name (from step or user-defined) |
| durationSeconds | number | Original duration in seconds |
| remainingSeconds | number | Current remaining seconds |
| state | enum | 'running' | 'paused' | 'completed' |
| stepIndex | number | null | Associated step index (null for custom timers) |
| startedAt | number | Timestamp when timer was started |

#### 3.7 Business Logic Rules

##### Timer Countdown

**Logic:**

```
1. Timer ticks every 1 second (using setInterval or requestAnimationFrame)
2. Each tick: remainingSeconds = remainingSeconds - 1
3. IF remainingSeconds <= 0:
   a. Set state = 'completed'
   b. Fire alarm: play sound, trigger haptics, show overlay
   c. IF app is backgrounded: fire local notification
4. Pause: Clear interval, preserve remainingSeconds
5. Resume: Restart interval from current remainingSeconds
```

##### Timer Limit

**Rule:** Maximum 10 concurrent timers. If user tries to start an 11th, show message: "Maximum 10 timers reached. Complete or dismiss a timer first."

##### Background Timer Behavior

**Logic:**

```
1. ON app background:
   a. Calculate expected completion time for each running timer:
      completionTime = now + remainingSeconds
   b. Schedule local notification for each running timer
2. ON app foreground:
   a. Cancel scheduled notifications
   b. Recalculate remainingSeconds based on elapsed wall-clock time
   c. Fire any timers that completed while backgrounded
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Timer tick drifts due to JS event loop | Recalculate from wall clock on each tick | Automatic correction |
| Notification permission denied | Timers work in-app but no background notifications; warn user | Prompt to enable notifications in Settings |
| Max timers reached | Toast: "Maximum 10 timers. Dismiss a completed timer first." | User dismisses a timer |

#### 3.9 Acceptance Criteria

1. **Given** cooking mode is active,
   **When** the user starts timers on step 1 (8 min) and step 3 (25 min),
   **Then** both timers appear in the timer bar and count down independently.

2. **Given** a timer reaches 0:00,
   **When** the alarm fires,
   **Then** the device plays an alarm sound, vibrates, and shows the timer label in an overlay.

3. **Given** a timer is running and the app is backgrounded,
   **When** the timer completes,
   **Then** a local notification fires with the timer label.

4. **Given** the user pauses a timer at 5:30 remaining,
   **When** the user resumes 2 minutes later,
   **Then** the timer resumes from 5:30 (not recalculated).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| timer decrements each tick | remaining: 60, tick | remaining: 59 |
| timer completes at zero | remaining: 1, tick | remaining: 0, state: 'completed' |
| pause preserves remaining | remaining: 30, pause | remaining: 30, state: 'paused' |
| max timer limit enforced | 10 active timers, start 11th | Error: max reached |

---

### RC-010: Web Recipe Import

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-010 |
| **Feature Name** | Web Recipe Import |
| **Priority** | P0 |
| **Category** | Import/Export |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a recipe collector, I want to paste a URL from a food blog and have the recipe automatically imported with title, ingredients, steps, and photo, so that I do not have to manually copy each field.

#### 3.3 Detailed Description

Web Recipe Import fetches a URL, parses the HTML to extract structured recipe data, and creates a recipe record. The import uses a multi-strategy approach: first try JSON-LD structured data (schema.org/Recipe), then Microdata, then heuristic HTML parsing as a fallback.

The majority of recipe websites (estimated 80%+) use schema.org/Recipe markup, making JSON-LD the most reliable extraction method. For sites without structured data, the heuristic parser looks for common HTML patterns (ingredient lists, step lists, time metadata).

After extraction, the user sees a preview of the imported recipe with all parsed fields editable before saving. This allows users to correct any parsing errors before the recipe is committed to the database.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-001: Recipe CRUD - Import creates a recipe
- RC-005: Ingredient Parser - Parses extracted ingredient text into structured format

**External Dependencies:**
- Network access to fetch URL content
- URL must be publicly accessible (no authentication)

#### 3.5 User Interface Requirements

##### Screen: Import from URL

**Layout:**
- URL text input at top with "Import" button
- Paste button for clipboard URL
- Loading state: progress indicator with "Fetching recipe..."
- Preview state: full recipe form pre-populated with extracted data (all fields editable)
- Save button to commit the imported recipe

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Input | Waiting for URL | URL text field, paste button, import button |
| Loading | Fetching and parsing URL | Spinner with "Importing recipe from [domain]..." |
| Preview | Recipe parsed successfully | Pre-populated recipe form, all fields editable, Save button |
| Partial | Some fields extracted | Pre-populated form with warning: "Some fields could not be extracted. Please review." |
| Error | URL unreachable or unparseable | Error message: "Could not import recipe from this URL. Try a different URL or add the recipe manually." |

#### 3.6 Data Requirements

No new entities. Import populates Recipe, Ingredient, Step, and RecipeTag entities.

#### 3.7 Business Logic Rules

##### Web Scraping Strategy

**Purpose:** Extract structured recipe data from a web page URL.

**Strategy Priority (try in order):**

```
1. JSON-LD (schema.org/Recipe):
   a. Find all <script type="application/ld+json"> tags in the HTML
   b. Parse each as JSON
   c. Look for objects with "@type": "Recipe" (may be nested in @graph)
   d. Extract fields:
      - name -> title
      - description -> description
      - recipeYield -> servings (parse number from string like "4 servings")
      - prepTime -> prep_time_mins (parse ISO 8601 duration PT15M)
      - cookTime -> cook_time_mins (parse ISO 8601 duration PT30M)
      - totalTime -> total_time_mins (parse ISO 8601 duration PT45M)
      - image -> image_uri (first URL if array)
      - recipeIngredient -> ingredients (array of strings, each parsed via RC-005)
      - recipeInstructions -> steps (may be array of strings, HowToStep objects, or HowToSection)
      - recipeCategory / recipeCuisine / keywords -> tags
      - url -> source_url

2. Microdata (schema.org/Recipe):
   a. Find elements with itemtype="http://schema.org/Recipe"
   b. Extract itemprop attributes for the same fields as JSON-LD
   c. Map to the same output structure

3. Heuristic HTML parsing (fallback):
   a. Title: <h1> or <h2> containing recipe-related text, or <title> tag
   b. Ingredients: Look for <ul> or <ol> near text containing "ingredient"
   c. Steps/Instructions: Look for <ol> near text containing "instruction" or "direction"
   d. Image: Largest <img> in the main content area
   e. Times: Look for text patterns like "Prep Time: 15 minutes"
   f. Servings: Look for text patterns like "Serves 4" or "Yield: 6"
```

##### ISO 8601 Duration Parsing

**Purpose:** Convert schema.org duration strings to minutes.

**Logic:**

```
1. Match pattern: PT(\d+H)?(\d+M)?(\d+S)?
2. hours = parsed H value or 0
3. minutes = parsed M value or 0
4. seconds = parsed S value or 0 (round up to next minute if > 0)
5. RETURN (hours * 60) + minutes + (seconds > 0 ? 1 : 0)
```

**Examples:**
- "PT15M" -> 15 minutes
- "PT1H30M" -> 90 minutes
- "PT45M" -> 45 minutes
- "PT2H" -> 120 minutes

##### HowToStep Parsing

**Purpose:** Extract step text from various schema.org instruction formats.

**Logic:**

```
1. IF recipeInstructions is array of strings:
   Each string is one step instruction
2. IF recipeInstructions is array of HowToStep objects:
   Extract "text" field from each object
3. IF recipeInstructions is array of HowToSection objects:
   Each section has "itemListElement" array of HowToStep objects
   Flatten all steps, preserving section names as step group headers
4. IF recipeInstructions is a single string:
   Split by newlines or sentence boundaries (". " followed by capital letter)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| URL unreachable (404, timeout) | "Could not reach this website. Check the URL and try again." | User re-enters URL |
| No recipe found on page | "No recipe data found on this page. Try a different URL or add manually." | User tries different URL or manual entry |
| Partial extraction | Preview form with warning badge on empty fields | User fills in missing fields manually |
| Network timeout (>15 seconds) | "Request timed out. Try again or check your connection." | User retries |
| Invalid URL format | Inline error: "Please enter a valid URL" | User corrects URL |

#### 3.9 Acceptance Criteria

1. **Given** a URL to a recipe page with JSON-LD schema.org/Recipe markup,
   **When** the user imports the URL,
   **Then** the preview shows correctly parsed title, ingredients, steps, times, and photo.

2. **Given** a URL to a recipe page without structured data,
   **When** the heuristic parser runs,
   **Then** the preview shows best-effort extraction with editable fields.

3. **Given** a URL to a non-recipe page,
   **When** the import fails,
   **Then** the user sees an error message and can try a different URL.

4. **Given** a successful import preview,
   **When** the user edits some fields and taps Save,
   **Then** a new recipe is created with the edited values and source_url set to the original URL.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| parses JSON-LD Recipe | HTML with JSON-LD script | Extracted recipe fields |
| parses ISO 8601 duration PT15M | "PT15M" | 15 |
| parses ISO 8601 duration PT1H30M | "PT1H30M" | 90 |
| parses HowToStep array | [{text: "Step 1"}, {text: "Step 2"}] | ["Step 1", "Step 2"] |
| handles missing fields gracefully | JSON-LD with only name and ingredients | title and ingredients populated, others null |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full import flow | 1. Enter URL, 2. Import, 3. Preview, 4. Save | Recipe created with all parsed fields and source_url |

---

### RC-011: Meal Planner Calendar

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-011 |
| **Feature Name** | Meal Planner Calendar |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a meal planner, I want to assign recipes to specific days and meal slots (breakfast, lunch, dinner, snack), so that I can plan my weekly meals in advance.

#### 3.3 Detailed Description

The Meal Planner provides a weekly calendar view where users assign recipes to day+slot combinations. Each week is identified by its Monday start date (automatically normalized). Users can browse recipes and drag or tap-to-assign them to calendar slots.

The planner creates `rc_meal_plans` (one per week) and `rc_meal_plan_items` (one per day+slot assignment) records. Each meal plan item links a recipe to a specific day of the week (0=Monday through 6=Sunday) and meal slot (breakfast, lunch, dinner, snack). A UNIQUE constraint prevents duplicate assignments to the same day+slot within a plan.

Meal plans drive the auto-generated shopping list (RC-012) and integrate with the pantry tracker (RC-013) to deduct items already on hand.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-001: Recipe CRUD - Meal plans reference recipes

#### 3.5 User Interface Requirements

##### Screen: Meal Planner (Tab)

**Layout:**
- Week navigation bar at top: left arrow, "Week of [date]" label, right arrow, "Today" button
- 7-column grid representing Monday through Sunday
- Each column divided into 4 rows: Breakfast, Lunch, Dinner, Snack
- Each cell shows assigned recipe thumbnail and title (or empty with "+" button)
- Tapping an empty cell opens recipe picker to assign a recipe
- Tapping a filled cell shows recipe detail with option to change or remove
- "Shopping List" button in top-right generates list for the visible week (RC-012)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty Week | No meals planned for the week | Grid with all empty cells showing "+" placeholders, prompt: "Plan your week! Tap + to add a meal." |
| Populated | Some or all slots filled | Recipe thumbnails and titles in assigned cells |
| Loading | Fetching meal plan data | Skeleton grid |

**Interactions:**
- Tap empty cell: Open recipe picker modal
- Tap filled cell: Show recipe mini-card with Edit, Remove, View Recipe options
- Swipe left on week: Navigate to next week
- Swipe right on week: Navigate to previous week
- Long press filled cell: Drag to move to different slot/day
- Tap Shopping List: Generate shopping list for current week (RC-012)

#### 3.6 Data Requirements

##### Entity: MealPlan

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique meal plan identifier |
| week_start_date | TEXT | Required, UNIQUE, ISO date (YYYY-MM-DD) | None | Monday of the plan week |
| created_at | TEXT | ISO 8601, auto-set | datetime('now') | Record creation timestamp |
| updated_at | TEXT | ISO 8601, auto-set on modification | datetime('now') | Last modification timestamp |

##### Entity: MealPlanItem

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique item identifier |
| meal_plan_id | TEXT | Foreign key to rc_meal_plans(id), NOT NULL, CASCADE | None | Parent meal plan |
| recipe_id | TEXT | Foreign key to rc_recipes(id), NOT NULL, CASCADE | None | Assigned recipe |
| day_of_week | INTEGER | 0-6 (Mon-Sun), NOT NULL | None | Day within the week |
| meal_slot | TEXT | One of: breakfast, lunch, dinner, snack | None | Meal type |
| servings | INTEGER | Positive, NOT NULL | 1 | Number of servings for this meal |
| created_at | TEXT | ISO 8601, auto-set | datetime('now') | Record creation timestamp |
| updated_at | TEXT | ISO 8601, auto-set on modification | datetime('now') | Last modification timestamp |

**Constraints:**
- UNIQUE (meal_plan_id, day_of_week, meal_slot) - one recipe per slot per day

**Indexes:**
- `rc_meal_plans_week_idx` on `week_start_date`
- `rc_meal_plan_items_plan_idx` on `meal_plan_id`
- `rc_meal_plan_items_recipe_idx` on `recipe_id`

#### 3.7 Business Logic Rules

##### Week Start Date Normalization

**Purpose:** Ensure all week references use Monday as the start date.

**Logic:**

```
1. Parse input date string to Date object
2. Get day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
3. Calculate offset to Monday: (dayOfWeek + 6) % 7
4. Subtract offset days from input date
5. RETURN normalized date as YYYY-MM-DD string
```

**Examples:**
- "2026-03-04" (Wednesday) -> "2026-03-02" (Monday)
- "2026-03-02" (Monday) -> "2026-03-02" (Monday, unchanged)
- "2026-03-08" (Sunday) -> "2026-03-02" (Monday of that week)

##### Meal Plan Upsert

**Purpose:** Assign a recipe to a day+slot, creating the meal plan if it does not exist.

**Logic:**

```
1. Normalize week_start_date to Monday
2. Get or create MealPlan for that week
3. Check if MealPlanItem exists for (plan_id, day_of_week, meal_slot)
4. IF exists: UPDATE recipe_id and servings
5. ELSE: INSERT new MealPlanItem
6. RETURN the MealPlanItem
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Referenced recipe deleted | Meal plan item still shows but with "Recipe deleted" badge | User taps to reassign or remove |
| Database write fails | Toast: "Could not update meal plan" | User retries |

#### 3.9 Acceptance Criteria

1. **Given** no meal plan exists for the current week,
   **When** the user assigns a recipe to Tuesday Dinner,
   **Then** a new meal plan is created for the week and the recipe appears in the Tuesday Dinner cell.

2. **Given** Tuesday Dinner already has "Pasta" assigned,
   **When** the user assigns "Steak" to Tuesday Dinner,
   **Then** "Steak" replaces "Pasta" in the cell (upsert behavior).

3. **Given** a week has 5 meals planned,
   **When** the user taps Shopping List,
   **Then** a consolidated shopping list is generated from all 5 recipes' ingredients.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| normalizes Wednesday to Monday | "2026-03-04" | "2026-03-02" |
| normalizes Sunday to Monday | "2026-03-08" | "2026-03-02" |
| Monday stays Monday | "2026-03-02" | "2026-03-02" |
| upsert creates new item | empty slot | new MealPlanItem created |
| upsert updates existing item | filled slot, different recipe | recipe_id updated |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Plan week and generate list | 1. Assign 2 recipes to week, 2. Generate shopping list | List aggregates ingredients from both recipes |

---

### RC-012: Auto-Generated Shopping List

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-012 |
| **Feature Name** | Auto-Generated Shopping List |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a meal planner, I want to automatically generate a shopping list from my weekly meal plan that aggregates duplicate ingredients, groups by store aisle, and lets me check off items, so that grocery shopping is efficient.

#### 3.3 Detailed Description

The shopping list is generated from all meal plan items for a given week. It aggregates ingredients across all planned recipes, combining duplicates (same ingredient name, case-insensitive) by summing quantities when units match. Items already in the pantry (RC-013) are flagged as "in stock" and optionally hidden.

The list can be grouped by category/aisle (produce, dairy, meat, pantry staples, etc.) based on ingredient name heuristics. Users can check off items as they shop and manually add items not tied to any recipe.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-011: Meal Planner Calendar - Provides the recipes for the week
- RC-002: Ingredient Management - Ingredients to aggregate

#### 3.5 User Interface Requirements

##### Screen: Shopping List

**Layout:**
- Header showing "Shopping List" and the week date range
- Toggle: "Hide in-stock items" (filters out pantry items)
- Grouped sections by category (Produce, Dairy, Meat, Bakery, Pantry, Other)
- Each item row: checkbox, quantity + unit, ingredient name, source recipe indicator
- Checked items move to bottom with strikethrough
- "Add Item" button at bottom for manual additions
- "Share" button to export list as text

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No meals planned for the week | Message: "No meals planned this week. Plan meals first to generate a shopping list." with link to Meal Planner |
| Populated | Meals planned | Grouped list of aggregated ingredients |
| All Checked | Every item checked off | Celebratory message: "All done! Happy cooking!" |

**Interactions:**
- Tap checkbox: Toggle checked state (checked items strike through and move to bottom)
- Tap item: Show source recipe(s) that need this ingredient
- Long press item: Edit quantity or remove from list
- Tap "Add Item": Text input to add manual item
- Tap "Share": Copy list as formatted text to clipboard or share sheet

#### 3.6 Data Requirements

Shopping list items are derived at runtime from meal plan and ingredient data. No separate persistent storage is needed for the core list. Checked state can be stored in-memory for the session or in a lightweight settings key.

**Derived Item Shape:**

| Field | Type | Description |
|-------|------|-------------|
| item | string | Ingredient name (lowercase, trimmed) |
| quantity | number or null | Aggregated quantity (sum of matching ingredients) |
| unit | string or null | Unit of measure |
| in_stock | boolean | Whether the pantry has this item |
| checked | boolean | Whether user has checked this off |
| source_recipes | string[] | Recipe titles that use this ingredient |

#### 3.7 Business Logic Rules

##### Ingredient Aggregation Algorithm

**Purpose:** Combine duplicate ingredients across multiple recipes into a single shopping list entry.

**Logic:**

```
1. Collect all ingredients from all MealPlanItems for the week
2. For each ingredient:
   a. Normalize name: trim whitespace, lowercase
   b. Parse quantity to number (if parseable)
3. Group by normalized name
4. For each group:
   a. IF all quantities are parseable numbers AND all units match:
      Sum quantities
   b. ELSE: quantity = null (display as "various" or list individual quantities)
5. Check pantry (gd_harvests table) for matching item names
6. Flag items found in pantry as in_stock = true
7. Sort by category, then alphabetically within category
8. RETURN consolidated list
```

##### Aisle/Category Assignment Heuristic

**Purpose:** Group shopping list items by store section.

**Category Dictionary:**

| Category | Keywords/Patterns |
|----------|-----------------|
| Produce | lettuce, tomato, onion, garlic, potato, carrot, celery, pepper, mushroom, avocado, lime, lemon, apple, banana, berry, herb, basil, cilantro, parsley, spinach, kale, broccoli, zucchini, squash, cucumber, corn, ginger, green onion, scallion |
| Dairy | milk, cream, cheese, butter, yogurt, sour cream, egg, whipping cream, half and half, cottage cheese, ricotta, mozzarella, cheddar, parmesan, cream cheese |
| Meat & Seafood | chicken, beef, pork, lamb, turkey, sausage, bacon, ham, shrimp, salmon, tuna, fish, steak, ground beef, ground turkey, prosciutto, guanciale, pancetta |
| Bakery & Bread | bread, roll, tortilla, pita, baguette, croissant, bun, flatbread, naan |
| Frozen | frozen, ice cream |
| Canned & Jarred | canned, can of, jar of, tomato sauce, tomato paste, broth, stock, coconut milk (canned), beans (canned) |
| Pantry & Dry Goods | flour, sugar, salt, pepper, oil, vinegar, soy sauce, rice, pasta, noodle, oat, cereal, baking soda, baking powder, vanilla, cocoa, chocolate, honey, maple syrup, peanut butter, jam, mustard, ketchup, mayo, hot sauce, spice, cumin, paprika, cinnamon, nutmeg, oregano, thyme, rosemary |
| Beverages | wine, beer, juice, soda, coffee, tea, water |
| Other | Everything that does not match above categories |

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Quantities cannot be aggregated (different units) | Show individual entries with recipe source | User sees "2 cups + 100g" listed separately |
| Pantry data unavailable | All items shown as not in stock | User manually checks off items they have |

#### 3.9 Acceptance Criteria

1. **Given** a meal plan with 2 recipes both using "onion" (1 whole + 2 whole),
   **When** the shopping list is generated,
   **Then** "onion" appears once with quantity 3.

2. **Given** "garlic" is in the pantry,
   **When** the shopping list includes garlic,
   **Then** garlic is flagged as "in stock" with a visual indicator.

3. **Given** the user checks off "flour" on the shopping list,
   **When** viewing the list,
   **Then** "flour" shows strikethrough and moves to the bottom of its category group.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| aggregates same ingredient | onion: qty 1 + qty 2 | onion: qty 3 |
| flags pantry items | ingredient in pantry | in_stock: true |
| handles null quantities | "salt to taste" + "salt to taste" | quantity: null |
| assigns produce category | "tomato" | category: "Produce" |
| assigns dairy category | "cheddar cheese" | category: "Dairy" |

---

### RC-013: Pantry Tracker

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-013 |
| **Feature Name** | Pantry Tracker |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a meal planner, I want to track what ingredients I have on hand in my pantry, so that the shopping list automatically deducts items I already have.

#### 3.3 Detailed Description

The Pantry Tracker maintains an inventory of ingredients the user has at home. When generating a shopping list from a meal plan, pantry items are cross-referenced to flag items already in stock. Users can manually add, edit, and remove pantry items with optional quantity, unit, and expiration date tracking.

In the current implementation, pantry data is stored in the `gd_harvests` table (which tracks garden harvest items). The shopping list generation cross-references ingredient names against harvest item names. A future dedicated pantry table may replace this approach to support broader pantry management beyond garden harvests.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-012: Auto-Generated Shopping List - Pantry data used to flag in-stock items

#### 3.5 User Interface Requirements

##### Screen: Pantry (sub-screen or section within Meal Planner tab)

**Layout:**
- List of pantry items grouped by category (same categories as shopping list)
- Each item row: name, quantity + unit, expiration date (if set), freshness indicator
- "Add Item" button to manually add pantry items
- "Scan Receipt" option (future: OCR receipt to auto-add purchased items)
- Search/filter bar at top

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No pantry items | Message: "Your pantry is empty. Add items manually or they will be added from garden harvests." |
| Populated | Items exist | Grouped list with quantities and freshness indicators |
| Expiring Soon | Items within 3 days of expiration | Warning badge with count: "3 items expiring soon" |

**Interactions:**
- Tap item: Edit quantity, unit, expiration date
- Swipe left: Delete item
- Tap "Add Item": Form with name, quantity, unit, expiration date
- Tap expiring badge: Filter to show only expiring items

#### 3.6 Data Requirements

Currently uses `gd_harvests` table. Future dedicated pantry entity:

##### Entity: PantryItem (future, extends current harvest-based approach)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique item identifier |
| name | TEXT | Required, NOT NULL | None | Item name |
| quantity | REAL | Optional | null | Quantity on hand |
| unit | TEXT | Optional | null | Unit of measure |
| category | TEXT | Optional | null | Store category (Produce, Dairy, etc.) |
| expiration_date | TEXT | Optional, ISO date | null | Best-by or use-by date |
| added_at | TEXT | ISO 8601 | datetime('now') | When item was added to pantry |
| created_at | TEXT | ISO 8601 | datetime('now') | Record creation timestamp |
| updated_at | TEXT | ISO 8601 | datetime('now') | Last modification timestamp |

#### 3.7 Business Logic Rules

##### Pantry Deduction in Shopping List

**Logic:**

```
1. For each shopping list item, check pantry for matching name (case-insensitive)
2. IF match found:
   a. Flag as in_stock = true
   b. IF pantry quantity >= shopping list quantity: fully covered
   c. IF pantry quantity < shopping list quantity: show remaining needed
   d. IF pantry quantity is null: flag as in_stock (unknown quantity)
3. IF no match: in_stock = false
```

##### Expiration Warning

**Logic:**

```
1. For each pantry item with an expiration_date:
   a. Calculate days until expiration: expiration_date - today
   b. IF days <= 0: Badge "Expired" (red)
   c. IF days <= 3: Badge "Expiring soon" (yellow)
   d. IF days > 3: No badge
2. Sort expired/expiring items to top of pantry list
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Negative quantity entered | Inline error: "Quantity must be positive" | User corrects value |
| Past expiration date entered | Warning: "This date is in the past" (allow save) | User can adjust or keep |

#### 3.9 Acceptance Criteria

1. **Given** "flour" is in the pantry with quantity 5 cups,
   **When** a shopping list needs 2 cups flour,
   **Then** flour is flagged as "in stock" on the shopping list.

2. **Given** a pantry item has expiration date 2 days from now,
   **When** the user views the pantry,
   **Then** the item shows a yellow "Expiring soon" badge.

3. **Given** the user adds "milk" to the pantry,
   **When** they generate a shopping list that needs milk,
   **Then** milk is flagged as in stock.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| flags matching pantry item | pantry: "flour", list: "flour" | in_stock: true |
| case-insensitive match | pantry: "Flour", list: "flour" | in_stock: true |
| no match returns not in stock | pantry: "sugar", list: "flour" | in_stock: false |
| expired item detection | expiry: yesterday | status: "expired" |
| expiring soon detection | expiry: 2 days from now | status: "expiring_soon" |

---

### RC-014: Allergy and Dietary Detection

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-014 |
| **Feature Name** | Allergy and Dietary Detection |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a home cook with food allergies in my family, I want the app to automatically scan recipe ingredients for common allergens and display warnings, so that I can avoid serving unsafe food.

#### 3.3 Detailed Description

The allergy detection system scans recipe ingredient names against a dictionary of common allergens and dietary categories. It flags ingredients that match known allergen patterns and displays warning badges on the recipe detail screen. This is used both for personal recipe browsing and for event hosting (RC-023) where guest allergies are cross-referenced against menu ingredients.

The detection runs entirely on-device using string matching against a local allergen dictionary. No network calls are made. The system covers the "Big 9" allergens (as defined by FDA) plus additional common dietary restrictions.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-002: Ingredient Management - Scans ingredient names for allergens

#### 3.5 User Interface Requirements

**Display (on Recipe Detail):**
- Allergen warning section below ingredients list
- Each detected allergen shown as a colored badge: "Contains: Gluten, Dairy, Eggs"
- Dietary compatibility badges: "Vegetarian", "Vegan", "Gluten-Free" (if no matching allergens found)
- Tap a badge to see which specific ingredients triggered the detection

#### 3.6 Data Requirements

No new entities. Allergen dictionary is a constant in code.

#### 3.7 Business Logic Rules

##### Allergen Detection Dictionary

**Purpose:** Map ingredient name patterns to allergen categories.

**Big 9 Allergens (FDA):**

| Allergen | Ingredient Patterns |
|----------|-------------------|
| **Gluten** | wheat, flour (unless explicitly gluten-free flour), barley, rye, spelt, semolina, couscous, farro, bulgur, seitan, bread, pasta (unless gluten-free), noodle (unless rice noodle), cracker, breadcrumb, panko, tortilla (flour), soy sauce (contains wheat unless tamari) |
| **Dairy** | milk, cream, cheese, butter, yogurt, whey, casein, ghee, sour cream, ice cream, custard, ricotta, mozzarella, cheddar, parmesan, brie, gouda, half and half, condensed milk, evaporated milk, cream cheese, cottage cheese, buttermilk |
| **Eggs** | egg, eggs, mayonnaise, mayo, meringue, aioli, hollandaise, custard (also dairy) |
| **Tree Nuts** | almond, cashew, walnut, pecan, pistachio, macadamia, hazelnut, brazil nut, pine nut, chestnut, praline, marzipan, frangipane, nut butter (unless peanut butter) |
| **Peanuts** | peanut, peanut butter, peanut oil, groundnut |
| **Soy** | soy, soybean, tofu, tempeh, edamame, miso, soy sauce, tamari, soy milk, soy protein |
| **Fish** | fish, salmon, tuna, cod, halibut, tilapia, trout, anchovy, sardine, bass, snapper, mahi, swordfish, mackerel, fish sauce, Worcestershire sauce (contains anchovies) |
| **Shellfish** | shrimp, crab, lobster, crawfish, crayfish, prawn, scallop, clam, mussel, oyster, squid, calamari, octopus |
| **Sesame** | sesame, tahini, sesame oil, sesame seed, halvah |

**Dietary Detection:**

| Diet | Logic |
|------|-------|
| Vegetarian | No meat/fish/shellfish ingredients detected |
| Vegan | Vegetarian AND no dairy/eggs/honey detected |
| Gluten-Free | No gluten ingredients detected |
| Dairy-Free | No dairy ingredients detected |
| Nut-Free | No tree nut or peanut ingredients detected |

##### Detection Algorithm

**Logic:**

```
1. For each ingredient in the recipe:
   a. Normalize name: lowercase, trim
   b. For each allergen category:
      Check if ingredient name contains any pattern from that category
   c. IF match found: add allergen category to recipe's allergen set
2. Generate dietary badges:
   a. Check which allergen categories are NOT present
   b. Assign positive dietary labels accordingly
3. RETURN { allergens: Set<string>, diets: Set<string> }
```

**Edge Cases:**
- "coconut milk" should NOT flag Dairy (it is plant-based)
- "almond milk" should flag Tree Nuts but NOT Dairy
- "gluten-free flour" should NOT flag Gluten
- "coconut" alone should NOT flag Tree Nuts (FDA does not classify coconut as tree nut, but some people are allergic)
- "butter" flags Dairy; "peanut butter" flags Peanuts but NOT Dairy
- Compound ingredient names: match against each word and the full phrase

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| False positive detection | Allergen badge shown incorrectly | User can dismiss/override with note |
| Ingredient not in dictionary | No allergen detected (safe by default, may miss niche allergens) | User relies on personal knowledge |

#### 3.9 Acceptance Criteria

1. **Given** a recipe contains "flour" and "milk",
   **When** the allergen scan runs,
   **Then** badges "Contains: Gluten, Dairy" are displayed.

2. **Given** a recipe contains only "rice", "chicken", and "vegetables",
   **When** the allergen scan runs,
   **Then** badges "Gluten-Free, Dairy-Free, Nut-Free" are displayed.

3. **Given** a recipe contains "almond milk",
   **When** the allergen scan runs,
   **Then** "Tree Nuts" is flagged but "Dairy" is NOT flagged.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| detects gluten in flour | ["flour"] | allergens: ["Gluten"] |
| detects dairy in milk | ["milk", "sugar"] | allergens: ["Dairy"] |
| detects multiple allergens | ["flour", "eggs", "milk"] | allergens: ["Gluten", "Eggs", "Dairy"] |
| no allergens in rice and chicken | ["rice", "chicken"] | allergens: [] |
| coconut milk is not dairy | ["coconut milk"] | allergens: [] (no dairy) |
| almond milk flags tree nuts | ["almond milk"] | allergens: ["Tree Nuts"] |
| detects vegetarian diet | ["rice", "vegetables", "tofu"] | diets includes: "Vegetarian" |
| detects vegan diet | ["rice", "vegetables", "olive oil"] | diets includes: "Vegan" |

---

### RC-015: Recipe Search and Filtering

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-015 |
| **Feature Name** | Recipe Search and Filtering |
| **Priority** | P0 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a recipe collector with 100+ recipes, I want to search by title, filter by tag, difficulty, and favorites, so that I can quickly find the recipe I need.

#### 3.3 Detailed Description

The recipe search and filtering system provides multiple ways to narrow the recipe list. Title search uses substring matching (LIKE query). Filters can be combined: for example, search "pasta" + filter by tag "Italian" + filter by difficulty "easy" returns only easy Italian pasta recipes. Filters are applied via toggle buttons and a search bar above the recipe list.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-001: Recipe CRUD - Searches recipe data
- RC-004: Recipe Categories and Tags - Tag filtering

#### 3.5 User Interface Requirements

**Components (on Recipe List screen):**
- Search text input with magnifying glass icon and clear button
- Filter bar below search: horizontal scroll of filter chips
  - "Favorites" toggle chip
  - "Difficulty" dropdown chip (Easy, Medium, Hard)
  - Tag chips (dynamically populated from existing tags, scrollable)
- Active filters shown as filled chips; inactive as outlined
- Result count: "12 recipes" below filter bar

**Interactions:**
- Type in search: Filter results in real-time (debounced 300ms)
- Tap filter chip: Toggle filter on/off
- Tap clear on search: Reset search text
- Tap "Clear all" link: Reset all filters

#### 3.6 Data Requirements

No new entities. Filtering uses existing Recipe, RecipeTag data with SQL WHERE clauses.

#### 3.7 Business Logic Rules

##### Combined Filter Logic

**Logic:**

```
1. Start with all recipes: SELECT * FROM rc_recipes
2. IF search text provided: AND title LIKE '%search%' (case-insensitive)
3. IF favorites filter active: AND is_favorite = 1
4. IF difficulty filter set: AND difficulty = 'easy|medium|hard'
5. IF tag filter set: AND id IN (SELECT recipe_id FROM rc_recipe_tags WHERE tag = ?)
6. Apply sort order (default: created_at DESC)
7. Apply pagination: LIMIT 50 OFFSET ?
```

**Filters combine with AND logic.** All active filters must match for a recipe to appear.

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No results match filters | "No recipes match your filters." with "Clear Filters" button | User adjusts or clears filters |
| Search query very long (>200 chars) | Truncate to 200 characters | Automatic |

#### 3.9 Acceptance Criteria

1. **Given** recipes "Pasta Carbonara" and "Steak Frites" exist,
   **When** the user searches "Pasta",
   **Then** only "Pasta Carbonara" appears.

2. **Given** recipes tagged "Italian" and "Japanese" exist,
   **When** the user filters by tag "Italian",
   **Then** only Italian-tagged recipes appear.

3. **Given** search "Pasta" and difficulty "easy" filters are both active,
   **When** only one pasta recipe is easy,
   **Then** only that one recipe appears (AND logic).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| search by title substring | search: "Pasta" | recipes with "Pasta" in title |
| filter by favorites | is_favorite: true | only favorited recipes |
| filter by difficulty | difficulty: "easy" | only easy recipes |
| filter by tag | tag: "italian" | only recipes tagged "italian" |
| combined filters | search: "Pasta" + difficulty: "easy" | easy pasta recipes only |
| empty search returns all | search: "" | all recipes |

---

### RC-016: Garden Plant Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-016 |
| **Feature Name** | Garden Plant Tracking |
| **Priority** | P1 |
| **Category** | Garden |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a garden enthusiast, I want to track my garden plants including species, planting date, location, and watering schedule, so that I can manage my garden alongside my kitchen.

#### 3.3 Detailed Description

Garden Plant Tracking allows users to maintain a digital inventory of their plants. Each plant record includes species name, location type (indoor, outdoor, raised bed, container), planting date, watering interval, last watered date, and notes. The system calculates the next watering date based on the interval and last watered timestamp.

Plant care logging tracks watering, fertilizing, pruning, repotting, and general notes. The care log provides a history of actions taken for each plant. The watering schedule integrates with the app's notification system to remind users when plants need water.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (independent garden sub-system)

**External Dependencies:**
- Local notifications for watering reminders (optional)

#### 3.5 User Interface Requirements

##### Screen: Garden (Tab)

**Layout:**
- Top section: "Needs Water" alert strip showing plants due for watering today
- Plant grid/list: each card shows species name, location badge, days since planted, watering status indicator (green = watered recently, yellow = due soon, red = overdue)
- "Add Plant" floating action button
- Toggle between grid view and list view

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No plants | Illustration with "Start your garden! Add your first plant." |
| Populated | Plants exist | Grid of plant cards with status indicators |
| Overdue Watering | Plants need water | Red badge on "Needs Water" strip with count |

**Interactions:**
- Tap plant card: Navigate to plant detail with care log
- Tap water drop icon on card: Quick-mark as watered (updates last_watered_at)
- Long press: Edit or delete plant
- Tap "Needs Water" strip: Filter to show only overdue plants

##### Screen: Plant Detail

**Layout:**
- Plant info header: species, location, planting date, watering interval
- Watering status: "Next watering: [date]" with "Water Now" button
- Care log timeline: chronological list of care actions
- "Log Care" button to add watering, fertilizing, pruning, repotting, or note entry
- "Related Recipes" section showing recipes that use this plant's produce (via RC-019)

#### 3.6 Data Requirements

##### Entity: GardenPlant

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique plant identifier |
| species | TEXT | Required, NOT NULL | None | Plant species name (e.g., "Tomato", "Basil") |
| location | TEXT | One of: indoor, outdoor, raised_bed, container | None | Where the plant is grown |
| planting_date | TEXT | Required, ISO date | None | When the plant was planted |
| watering_interval_days | INTEGER | Required, positive, min 1 | 3 | Days between watering |
| last_watered_at | TEXT | Optional, ISO datetime | null | Last time the plant was watered |
| notes | TEXT | Optional | null | Free-form notes about the plant |
| created_at | TEXT | ISO 8601, auto-set | datetime('now') | Record creation timestamp |
| updated_at | TEXT | ISO 8601, auto-set on modification | datetime('now') | Last modification timestamp |

##### Entity: PlantCareLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique log entry identifier |
| plant_id | TEXT | Foreign key to gd_plants(id), NOT NULL, CASCADE | None | Parent plant |
| care_type | TEXT | One of: watered, fertilized, pruned, repotted, note | None | Type of care action |
| performed_at | TEXT | Required, ISO datetime | None | When the care was performed |
| notes | TEXT | Optional | null | Notes about this care action |
| created_at | TEXT | ISO 8601, auto-set | datetime('now') | Record creation timestamp |

**Indexes:**
- `gd_plants_species_idx` on `species`
- `gd_plants_water_idx` on `last_watered_at`
- `gd_plant_care_logs_plant_idx` on `plant_id`

#### 3.7 Business Logic Rules

##### Next Watering Date Calculation

**Purpose:** Calculate when a plant next needs to be watered.

**Inputs:**
- last_watered_at: string | null
- planting_date: string
- watering_interval_days: number

**Logic:**

```
1. base_date = last_watered_at if available, otherwise planting_date
2. Parse base_date to Date (use date portion only, ignore time)
3. Add watering_interval_days to base_date
4. RETURN resulting date as YYYY-MM-DD string
```

**Examples:**
- Plant watered on 2026-03-01, interval 3 days -> next watering: 2026-03-04
- Plant never watered, planted 2026-02-15, interval 7 -> next watering: 2026-02-22
- Interval enforced minimum of 1 day

##### Mark Plant Watered

**Logic:**

```
1. Update gd_plants SET last_watered_at = current timestamp
2. Insert care log entry with care_type = 'watered'
3. Both operations in same function call for consistency
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Invalid planting date (future) | Warning: "Planting date is in the future" (allow save) | User can adjust |
| Watering interval 0 or negative | Inline error: "Interval must be at least 1 day" | User corrects |

#### 3.9 Acceptance Criteria

1. **Given** the user creates a plant "Tomato" with planting date 2026-08-12 and watering interval 3,
   **When** the plant has never been watered,
   **Then** the next watering date is 2026-08-15.

2. **Given** a plant was last watered on 2026-03-01 with interval 3,
   **When** the user taps "Water Now" on 2026-03-04,
   **Then** last_watered_at updates and a care log entry is created.

3. **Given** 3 plants are overdue for watering,
   **When** the user views the Garden tab,
   **Then** the "Needs Water" strip shows "3 plants need water" with red indicators.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates next watering from planting date | planted: 2026-08-12, interval: 3, never watered | 2026-08-15 |
| calculates next watering from last watered | last_watered: 2026-03-01, interval: 3 | 2026-03-04 |
| enforces minimum interval of 1 | interval: 0 | clamped to 1 |

---

### RC-017: Garden Layout Planner

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-017 |
| **Feature Name** | Garden Layout Planner |
| **Priority** | P1 |
| **Category** | Garden |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a garden enthusiast, I want to visually plan my garden beds with a grid layout showing where each plant is positioned, so that I can optimize space and companion planting.

#### 3.3 Detailed Description

The Garden Layout Planner provides a visual grid editor for designing garden beds. Users create named layouts with configurable grid dimensions (2x2 to 24x24). Each cell in the grid can be assigned a plant from the user's plant inventory or left empty. The grid state is stored as a JSON array of cell objects.

Multiple layouts are supported (e.g., "Front Yard Bed", "Raised Bed 1", "Container Garden"). Layouts are saved and can be edited over time as the garden changes.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-016: Garden Plant Tracking - Plants to place in the layout

#### 3.5 User Interface Requirements

##### Screen: Garden Layout Editor

**Layout:**
- Layout name input at top
- Grid dimension controls: width (2-24) and height (2-24) steppers
- Visual grid: colored cells representing plants (color-coded by species)
- Empty cells shown in earth tone
- Plant palette on side/bottom: scrollable list of user's plants to tap-and-place
- Save button

**Interactions:**
- Tap empty cell: Open plant picker to assign a plant
- Tap occupied cell: Show plant info popup with option to remove
- Pinch to zoom: Zoom in/out on larger grids
- Tap Save: Persist layout to database

#### 3.6 Data Requirements

##### Entity: GardenLayout

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique layout identifier |
| name | TEXT | Required, NOT NULL | 'Garden Layout' | Layout name |
| grid_width | INTEGER | 2-24, NOT NULL | 8 | Grid width in cells |
| grid_height | INTEGER | 2-24, NOT NULL | 8 | Grid height in cells |
| cells_json | TEXT | Valid JSON array, NOT NULL | '[]' | JSON array of GardenLayoutCell objects |
| created_at | TEXT | ISO 8601, auto-set | datetime('now') | Record creation timestamp |
| updated_at | TEXT | ISO 8601, auto-set on modification | datetime('now') | Last modification timestamp |

**GardenLayoutCell Shape (JSON):**

```json
{
  "x": 0,
  "y": 0,
  "plantId": "p1",
  "species": "Tomato"
}
```

#### 3.7 Business Logic Rules

##### Grid Dimension Clamping

**Logic:**

```
1. Clamp grid_width to range [2, 24], round down to integer
2. Clamp grid_height to range [2, 24], round down to integer
3. If value is NaN or non-finite, use default of 8
```

##### Cell Sanitization

**Logic:**

```
1. For each cell in the input array:
   a. Clamp x to non-negative integer (floor)
   b. Clamp y to non-negative integer (floor)
   c. Normalize plantId to string or null
   d. Normalize species to string or null
2. Deduplicate by coordinate: if multiple cells have same (x, y), keep the last one
3. RETURN sanitized array
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Invalid JSON in cells_json | Return empty cell array | Layout shows empty grid |
| Grid dimensions out of range | Clamped to [2, 24] | Automatic |

#### 3.9 Acceptance Criteria

1. **Given** the user creates a layout "Raised Bed 1" with 4x3 grid,
   **When** they place "Tomato" at position (0,0) and save,
   **Then** the layout persists and shows Tomato in the correct cell on reload.

2. **Given** a layout has grid width 8,
   **When** the user changes width to 25,
   **Then** the width is clamped to 24.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| clamps grid width to max 24 | width: 30 | 24 |
| clamps grid width to min 2 | width: 1 | 2 |
| sanitizes cell coordinates | x: -1, y: 0.7 | x: 0, y: 0 |
| deduplicates cells by coordinate | two cells at (0,0) | keeps last one |
| parses valid cells_json | valid JSON string | array of GardenLayoutCell |
| handles invalid JSON | "not json" | empty array |

---

### RC-018: Harvest Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-018 |
| **Feature Name** | Harvest Tracking |
| **Priority** | P1 |
| **Category** | Garden |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a garden enthusiast, I want to log what I harvest from my garden including item name, quantity, and date, so that I can track my garden's yield over time and link harvests to recipes.

#### 3.3 Detailed Description

Harvest tracking logs individual harvest events from garden plants. Each harvest records the item name (e.g., "Tomatoes"), quantity, unit, harvest date, optional plant association, and notes. Harvests serve double duty as a pantry data source - the shopping list generator (RC-012) cross-references harvest items to flag ingredients as "in stock".

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-016: Garden Plant Tracking - Harvests link to plants (optional)

#### 3.5 User Interface Requirements

**Section within Plant Detail:**
- "Harvests" list showing all harvests from this plant
- "Log Harvest" button with form: item name, quantity, unit, date, note

**Standalone Harvest Log (within Garden tab):**
- Chronological list of all harvests across all plants
- Summary stats: total harvests this season, variety count

#### 3.6 Data Requirements

##### Entity: Harvest

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique harvest identifier |
| plant_id | TEXT | Foreign key to gd_plants(id), ON DELETE SET NULL | null | Source plant (null if not linked) |
| item_name | TEXT | Required, NOT NULL | None | What was harvested (e.g., "Tomatoes") |
| quantity | REAL | Optional | null | Amount harvested |
| unit | TEXT | Optional | null | Unit of measure (e.g., "lbs", "bushel") |
| harvested_at | TEXT | Required, ISO datetime | None | When the harvest occurred |
| note | TEXT | Optional | null | Notes about this harvest |
| created_at | TEXT | ISO 8601, auto-set | datetime('now') | Record creation timestamp |

**Indexes:**
- `gd_harvests_item_idx` on `item_name`

#### 3.7 Business Logic Rules

##### Pantry Integration

Harvest items are cross-referenced by the shopping list generator. The match is by `item_name` (case-insensitive, substring match against ingredient names).

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Empty item name | Inline error: "Item name is required" | User fills in name |

#### 3.9 Acceptance Criteria

1. **Given** a plant "Tomato" exists,
   **When** the user logs a harvest of "Tomatoes" (5 lbs),
   **Then** the harvest appears in both the plant's harvest list and the global harvest log.

2. **Given** a harvest of "Basil" exists,
   **When** a shopping list includes "basil",
   **Then** basil is flagged as "in stock".

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates harvest record | item: "Tomatoes", qty: 5, unit: "lbs" | Harvest record created |
| links harvest to plant | plant_id: "p1" | harvest.plant_id = "p1" |
| harvest appears in pantry check | harvest: "basil", shopping: "basil" | in_stock: true |

---

### RC-019: Garden-to-Recipe Linking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-019 |
| **Feature Name** | Garden-to-Recipe Linking |
| **Priority** | P1 |
| **Category** | Garden |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a garden enthusiast, I want to see which recipes I can make using ingredients from my garden harvest, so that I can cook with what I grow.

#### 3.3 Detailed Description

Garden-to-Recipe Linking connects harvested items to recipes that use matching ingredients. When a user harvests "Tomatoes", the system suggests recipes containing tomato-related ingredients. This is powered by a substring match of the harvest item name against recipe ingredient names.

The `gd_harvest_recipe_links` table stores explicit links between harvests and recipes, with an optional `match_reason` field explaining why the match was made.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-018: Harvest Tracking - Harvest items to match
- RC-001: Recipe CRUD - Recipes to suggest

#### 3.5 User Interface Requirements

**On Harvest Log entry:**
- After logging a harvest, show "Recipes you can make" suggestion list

**On Plant Detail:**
- "Related Recipes" section listing recipes that use this plant's produce

#### 3.6 Data Requirements

##### Entity: HarvestRecipeLink

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique link identifier |
| harvest_id | TEXT | Foreign key to gd_harvests(id), NOT NULL, CASCADE | None | Source harvest |
| recipe_id | TEXT | Foreign key to rc_recipes(id), NOT NULL, CASCADE | None | Matched recipe |
| match_reason | TEXT | Optional | null | Why this recipe was linked (e.g., "ingredient: tomato") |
| created_at | TEXT | ISO 8601, auto-set | datetime('now') | Record creation timestamp |

#### 3.7 Business Logic Rules

##### Recipe Matching Algorithm

**Logic:**

```
1. Normalize harvest item name to lowercase
2. Query rc_ingredients WHERE lower(name) LIKE '%harvestItem%'
3. JOIN with rc_recipes to get recipe title
4. Return DISTINCT recipe matches with the matching ingredient name
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No matching recipes | "No recipes found using [item]. Try adding a recipe with this ingredient!" | User adds recipes |

#### 3.9 Acceptance Criteria

1. **Given** a recipe "Tomato Soup" uses ingredient "tomato",
   **When** the user harvests "Tomatoes",
   **Then** "Tomato Soup" appears in the "Recipes you can make" suggestions.

2. **Given** no recipes use "eggplant",
   **When** the user harvests "Eggplant",
   **Then** the system shows "No recipes found using Eggplant."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| matches harvest to recipe ingredient | harvest: "tomato", recipe has "tomato" | recipe returned in results |
| case-insensitive match | harvest: "Basil", ingredient: "fresh basil" | match found |
| no match returns empty | harvest: "eggplant", no matching ingredients | empty array |

---

### RC-020: Event Hosting

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-020 |
| **Feature Name** | Event Hosting |
| **Priority** | P1 |
| **Category** | Social |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As an entertainer, I want to create events with a date, time, location, description, and guest capacity, so that I can plan dinner parties and gatherings through my recipe app.

#### 3.3 Detailed Description

Event Hosting allows users to create and manage events directly within MyRecipes. Each event has a title, date, time, location, description, capacity limit, and a unique invite token for sharing. Events integrate with the recipe system through menu planning (RC-022) and guest management (RC-021).

The invite token is a randomly generated string that can be shared with guests to RSVP. This keeps the system fully offline and peer-to-peer - no server required. The host creates the event, shares the invite token (via text, email, or any messaging app), and guests use the token to RSVP from their own device if they have the app, or the host can record RSVPs manually.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-001: Recipe CRUD - Events reference recipes via menus

#### 3.5 User Interface Requirements

##### Screen: Events (Tab)

**Layout:**
- Upcoming events list sorted by event_date ASC
- Past events section (collapsed by default)
- Each event card: title, date, time, location, guest count/capacity, RSVP summary badge
- "Create Event" floating action button

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No events | Illustration: "No events planned. Host your first gathering!" |
| Upcoming | Future events exist | List of upcoming event cards |
| Past | Only past events | "No upcoming events" with past events section expanded |

##### Screen: Create/Edit Event

**Layout:**
- Title input (required)
- Date picker (required)
- Time picker (required)
- Location input (optional)
- Description multiline input (optional)
- Capacity number input (optional)
- Save button

##### Screen: Event Detail

**Layout:**
- Event header: title, date, time, location
- Description section
- "Invite Link" section: invite token with "Copy" and "Share" buttons
- Menu section (RC-022): list of recipes on the menu with course labels
- Guest list section (RC-021): list of guests with RSVP status
- Timeline section (RC-025): schedule of the event
- "Allergy Warnings" badge if any detected (RC-023)

#### 3.6 Data Requirements

##### Entity: Event

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique event identifier |
| title | TEXT | Required, NOT NULL | None | Event title |
| event_date | TEXT | Required, ISO date | None | Event date (YYYY-MM-DD) |
| event_time | TEXT | Required | None | Event start time (HH:MM) |
| location | TEXT | Optional | null | Event location/address |
| description | TEXT | Optional | null | Event description |
| capacity | INTEGER | Optional, positive if provided | null | Maximum number of guests |
| invite_token | TEXT | UNIQUE, auto-generated | Auto | Shareable invite code |
| created_at | TEXT | ISO 8601, auto-set | datetime('now') | Record creation timestamp |
| updated_at | TEXT | ISO 8601, auto-set on modification | datetime('now') | Last modification timestamp |

**Indexes:**
- `ev_events_date_idx` on `event_date`

#### 3.7 Business Logic Rules

##### Invite Token Generation

**Logic:**

```
1. Generate token: "invite-" + 8 random hex characters
2. Ensure uniqueness (UNIQUE constraint on column)
3. Token is generated once at event creation and never changes
```

##### Event Capacity Check

**Logic:**

```
1. Count guests with RSVP response = 'attending'
2. IF capacity is set AND attending_count >= capacity:
   Show "Event is full" warning when new RSVP is attempted
3. RSVP is still accepted (soft cap, not hard block)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Empty title | Inline error: "Event title is required" | User fills in title |
| Past date selected | Warning: "This date is in the past" (allow save) | User can adjust |
| Capacity exceeded | Warning badge: "Event is over capacity" | Host can increase capacity |

#### 3.9 Acceptance Criteria

1. **Given** the user creates an event "Garden Dinner" for 2026-08-20 at 18:00 with capacity 8,
   **When** the event is saved,
   **Then** the event appears in the Events tab with an auto-generated invite token.

2. **Given** an event has invite token "invite-a1b2c3d4",
   **When** the host taps "Copy Invite Link",
   **Then** the token is copied to the clipboard.

3. **Given** an event has capacity 8 and 8 attending guests,
   **When** a 9th guest RSVPs as attending,
   **Then** the RSVP is accepted but an "over capacity" warning is shown.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates event with all fields | title, date, time, capacity | Event with invite_token generated |
| invite token is unique string | N/A | starts with "invite-", 8+ hex chars |
| retrieves event by invite token | valid token | Event object |
| returns null for invalid token | "invalid-token" | null |

---

### RC-021: RSVP System

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-021 |
| **Feature Name** | RSVP System |
| **Priority** | P1 |
| **Category** | Social |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As an entertainer, I want guests to RSVP to my events with their response (attending, maybe, declined), dietary preferences, and allergies, so that I can plan food and seating accordingly.

#### 3.3 Detailed Description

The RSVP system manages guest responses to events. Guests can be added manually by the host or can self-register via the invite token (RC-020). Each guest has a name, optional contact info, dietary preferences, and allergy information. RSVPs track the response (attending, maybe, declined) with an optional note and timestamp.

The system supports both host-managed RSVPs (host enters guest info and response) and token-based self-service RSVPs (guest uses invite token to submit their own response). For token-based RSVPs, the system matches returning guests by name (case-insensitive) to update rather than duplicate.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-020: Event Hosting - RSVPs belong to events

#### 3.5 User Interface Requirements

##### Section: Guest List (on Event Detail)

**Layout:**
- Guest list with RSVP status indicators: green check (attending), yellow question (maybe), red X (declined), gray dash (no response)
- Summary bar: "5 attending, 2 maybe, 1 declined"
- "Add Guest" button for manual guest entry
- Each guest row: name, RSVP status, dietary info badge, allergies badge

**Interactions:**
- Tap guest: View/edit guest details (name, contact, dietary preferences, allergies, response)
- Tap "Add Guest": Form for name, contact, dietary preferences, allergies
- Long press guest: Quick-set RSVP status

##### Screen: RSVP via Token (guest-facing)

**Layout:**
- Event info header: title, date, time, location
- Menu preview (if set)
- RSVP form: name, response (attending/maybe/declined), dietary preferences, allergies, note
- "Submit RSVP" button

#### 3.6 Data Requirements

##### Entity: Guest

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique guest identifier |
| event_id | TEXT | Foreign key to ev_events(id), NOT NULL, CASCADE | None | Parent event |
| name | TEXT | Required, NOT NULL | None | Guest name |
| contact | TEXT | Optional | null | Email or phone |
| dietary_preferences | TEXT | Optional | null | Comma-separated dietary preferences |
| allergies | TEXT | Optional | null | Comma-separated allergy list |
| created_at | TEXT | ISO 8601, auto-set | datetime('now') | Record creation timestamp |
| updated_at | TEXT | ISO 8601, auto-set on modification | datetime('now') | Last modification timestamp |

##### Entity: RSVP

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique RSVP identifier |
| event_id | TEXT | Foreign key to ev_events(id), NOT NULL, CASCADE | None | Parent event |
| guest_id | TEXT | Foreign key to ev_guests(id), NOT NULL, CASCADE | None | Responding guest |
| response | TEXT | One of: attending, maybe, declined | None | RSVP response |
| note | TEXT | Optional | null | Guest's note to host |
| responded_at | TEXT | Required, ISO datetime | None | When response was submitted |
| created_at | TEXT | ISO 8601, auto-set | datetime('now') | Record creation timestamp |
| updated_at | TEXT | ISO 8601, auto-set on modification | datetime('now') | Last modification timestamp |

**Constraints:**
- UNIQUE (event_id, guest_id) - one RSVP per guest per event

**Indexes:**
- `ev_guests_event_idx` on `event_id`
- `ev_rsvps_event_idx` on `event_id`

#### 3.7 Business Logic Rules

##### Token-Based RSVP Flow

**Purpose:** Allow guests to self-RSVP using an invite token.

**Logic:**

```
1. Look up event by invite_token
2. IF event not found: return null (invalid token)
3. Search for existing guest by normalized name (case-insensitive):
   a. IF guest exists: update their contact/dietary/allergies if new values provided
   b. IF guest does not exist: create new guest record
4. Upsert RSVP:
   a. IF RSVP exists for this guest+event: UPDATE response and note
   b. ELSE: INSERT new RSVP
5. RETURN { event, guest } on success
```

##### RSVP Summary

**Logic:**

```
1. GROUP BY response from ev_rsvps WHERE event_id = ?
2. COUNT each response type (attending, maybe, declined)
3. RETURN { attending: N, maybe: N, declined: N }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Invalid invite token | "This invite link is not valid. Check with the host." | User contacts host |
| Empty guest name | Inline error: "Name is required" | User fills in name |
| Duplicate guest name | Updates existing guest record (no error) | Automatic merge |

#### 3.9 Acceptance Criteria

1. **Given** an event with invite token exists,
   **When** a guest submits RSVP with name "Alex", response "attending", and allergy "nut",
   **Then** a guest record and RSVP record are created, and the event summary shows 1 attending.

2. **Given** guest "Alex" already RSVP'd as "attending",
   **When** Alex submits another RSVP with response "declined",
   **Then** Alex's RSVP is updated (not duplicated) to "declined".

3. **Given** an event has 3 attending, 1 maybe, 1 declined,
   **When** the host views the event detail,
   **Then** the summary bar shows "3 attending, 1 maybe, 1 declined".

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates guest and RSVP via token | valid token, name, response | guest + RSVP created |
| updates existing guest on re-RSVP | same name, different response | response updated, no duplicate guest |
| returns null for invalid token | "bad-token" | null |
| RSVP summary counts correctly | 2 attending, 1 maybe | { attending: 2, maybe: 1, declined: 0 } |

---

### RC-022: Event Menu Planning

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-022 |
| **Feature Name** | Event Menu Planning |
| **Priority** | P1 |
| **Category** | Social |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As an entertainer, I want to assign recipes from my collection to an event's menu with course labels (appetizer, main, side, dessert, drink), so that I have a complete meal plan for my gathering.

#### 3.3 Detailed Description

Event Menu Planning links recipes to events as menu items. Each menu item has a course type and servings count. The menu is displayed on the event detail screen and included in the invite bundle that guests see when RSVPing. Setting the menu replaces any existing menu items for that event (transactional replacement).

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-020: Event Hosting - Menus belong to events
- RC-001: Recipe CRUD - Menu items reference recipes

#### 3.5 User Interface Requirements

##### Section: Menu (on Event Detail)

**Layout:**
- Menu items grouped by course: Appetizer, Main, Side, Dessert, Drink
- Each item: recipe title, servings count, course badge
- "Edit Menu" button opens recipe picker with course assignment
- "Generate Shopping List" button for event ingredients

#### 3.6 Data Requirements

##### Entity: MenuItem

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique menu item identifier |
| event_id | TEXT | Foreign key to ev_events(id), NOT NULL, CASCADE | None | Parent event |
| recipe_id | TEXT | Foreign key to rc_recipes(id), NOT NULL, CASCADE | None | Recipe on the menu |
| course | TEXT | One of: appetizer, main, side, dessert, drink | 'main' | Course type |
| servings | INTEGER | Positive, NOT NULL | 1 | Servings to prepare |
| created_at | TEXT | ISO 8601, auto-set | datetime('now') | Record creation timestamp |
| updated_at | TEXT | ISO 8601, auto-set on modification | datetime('now') | Last modification timestamp |

**Indexes:**
- `ev_menu_items_event_idx` on `event_id`

#### 3.7 Business Logic Rules

##### Set Event Menu (Transactional)

**Logic:**

```
1. BEGIN transaction
2. DELETE all existing menu items for the event
3. INSERT new menu items from the provided recipe list
4. COMMIT transaction
5. On failure: ROLLBACK, no partial menu state
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Referenced recipe deleted | Menu item shows "Recipe deleted" badge | Host updates menu |
| Transaction fails | Toast: "Could not update menu" | User retries |

#### 3.9 Acceptance Criteria

1. **Given** an event exists and recipe "Peanut Slaw" exists,
   **When** the host adds "Peanut Slaw" to the menu as a side with 6 servings,
   **Then** the menu shows "Peanut Slaw" under "Side" with 6 servings.

2. **Given** a menu has 3 items,
   **When** the host updates the menu with 2 different items,
   **Then** the old 3 items are removed and only the new 2 remain.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| sets menu items | event_id, [recipe1, recipe2] | 2 menu items created |
| replaces existing menu | event with menu, new recipe list | old items deleted, new items created |

---

### RC-023: Event Allergy Warnings

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-023 |
| **Feature Name** | Event Allergy Warnings |
| **Priority** | P1 |
| **Category** | Social |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As an entertainer, I want to see warnings when my event menu contains ingredients that match guests' reported allergies, so that I can ensure food safety for all guests.

#### 3.3 Detailed Description

Event Allergy Warnings cross-reference guest allergy information with the ingredients in the event menu recipes. If a guest reports "nut" as an allergy and a menu recipe contains "peanut" or "almond", a warning is generated linking the guest, the allergy, the recipe, and the specific ingredient.

This builds on the general allergen detection (RC-014) but is event-specific, matching individual guest allergies rather than general allergen categories.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-022: Event Menu Planning - Menu provides recipes to scan
- RC-014: Allergy and Dietary Detection - Allergen scanning logic
- RC-021: RSVP System - Guests provide allergy information

#### 3.5 User Interface Requirements

**On Event Detail:**
- "Allergy Warnings" badge showing count (e.g., "2 warnings")
- Tap badge: shows list of warnings, each with guest name, allergy, recipe name, ingredient
- Warning severity: red for direct match, yellow for possible match

#### 3.6 Data Requirements

No new entities. Warnings are computed at runtime.

**Warning Shape:**

| Field | Type | Description |
|-------|------|-------------|
| guest_name | string | Guest who has the allergy |
| allergy | string | The reported allergy |
| recipe_id | string | Recipe on the menu |
| recipe_title | string | Recipe name |
| ingredient | string | Specific ingredient that triggered the warning |

#### 3.7 Business Logic Rules

##### Allergy Warning Generation

**Logic:**

```
1. Get all guests for the event from ev_guests
2. For each guest with non-empty allergies:
   a. Split allergies string by comma, trim, lowercase
3. Get all recipes on the event menu from ev_menu_items JOIN rc_recipes
4. For each menu recipe:
   a. Get all ingredients from rc_ingredients WHERE recipe_id = ?
   b. For each ingredient:
      For each guest allergy:
        IF ingredient name (lowercase) contains allergy string:
          Add warning { guest_name, allergy, recipe_id, recipe_title, ingredient }
5. Special cases:
   - allergy = "nut": match any ingredient containing "nut" (catches peanut, walnut, etc.)
6. RETURN array of warnings
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No guest allergies reported | No warnings section displayed | N/A |
| False positive | Warning shown for non-allergenic match | Host can dismiss individual warnings |

#### 3.9 Acceptance Criteria

1. **Given** guest "Alex" has allergy "nut" and menu includes "Peanut Slaw" with ingredient "peanut",
   **When** allergy warnings are generated,
   **Then** a warning links Alex, "nut", "Peanut Slaw", and "peanut".

2. **Given** no guests have allergies,
   **When** allergy warnings are generated,
   **Then** zero warnings are returned.

3. **Given** a guest has allergy "dairy" and the menu has a recipe with "butter",
   **When** allergy warnings are generated,
   **Then** a warning is generated for the dairy/butter match.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| detects nut allergy match | guest: allergy "nut", ingredient: "peanut" | warning generated |
| no warnings when no allergies | guests with no allergies | empty array |
| matches allergy substring | guest: allergy "dairy", ingredient: "butter" | Note: only matches if "dairy" substring is in ingredient. Butter would not match "dairy" literally - this relies on the allergen dictionary from RC-014 for comprehensive matching |

---

### RC-024: Potluck Coordination

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-024 |
| **Feature Name** | Potluck Coordination |
| **Priority** | P1 |
| **Category** | Social |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As an entertainer hosting a potluck, I want guests to claim dishes they will bring, so that I can ensure variety and avoid duplicates.

#### 3.3 Detailed Description

Potluck Coordination allows guests to claim dishes they will bring to an event. Each claim records the guest, dish name, optional note, and timestamp. The host can see all claimed dishes on the event detail screen. This is a simple coordination tool, not a full recipe assignment - guests just name what they plan to bring.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-020: Event Hosting - Potluck claims belong to events
- RC-021: RSVP System - Guests who claim dishes

#### 3.5 User Interface Requirements

**On Event Detail:**
- "Potluck" section showing claimed dishes
- Each claim: guest name, dish name, note
- "Claim a Dish" button for guests (via invite token flow)

#### 3.6 Data Requirements

##### Entity: PotluckClaim

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique claim identifier |
| event_id | TEXT | Foreign key to ev_events(id), NOT NULL, CASCADE | None | Parent event |
| guest_id | TEXT | Foreign key to ev_guests(id), NOT NULL, CASCADE | None | Guest making the claim |
| dish_name | TEXT | Required, NOT NULL | None | Name of the dish |
| note | TEXT | Optional | null | Additional notes |
| claimed_at | TEXT | Required, ISO datetime | None | When the claim was made |
| created_at | TEXT | ISO 8601, auto-set | datetime('now') | Record creation timestamp |

**Indexes:**
- `ev_potluck_event_idx` on `event_id`

#### 3.7 Business Logic Rules

No complex logic. Simple CRUD for potluck claims.

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Empty dish name | Inline error: "Dish name is required" | User fills in name |

#### 3.9 Acceptance Criteria

1. **Given** an event exists and guest "Alex" is attending,
   **When** Alex claims "Caesar Salad",
   **Then** "Caesar Salad" by Alex appears in the potluck section.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates potluck claim | event_id, guest_id, dish: "Salad" | PotluckClaim created |

---

### RC-025: Event Timeline

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-025 |
| **Feature Name** | Event Timeline |
| **Priority** | P1 |
| **Category** | Social |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As an entertainer, I want to create a timeline/schedule for my event (e.g., "6:00 PM Guests arrive", "6:30 PM Appetizers", "7:30 PM Main course"), so that I can plan the flow of the evening.

#### 3.3 Detailed Description

The Event Timeline provides an ordered list of schedule entries for an event. Each entry has a label and a start time. The timeline is displayed on the event detail screen and included in the invite bundle for guests.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-020: Event Hosting - Timelines belong to events

#### 3.5 User Interface Requirements

**On Event Detail:**
- "Schedule" section showing timeline entries in chronological order
- Each entry: time badge, label text
- "Add Entry" button to add new timeline items
- Drag handles to reorder entries

#### 3.6 Data Requirements

##### Entity: EventTimeline

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique entry identifier |
| event_id | TEXT | Foreign key to ev_events(id), NOT NULL, CASCADE | None | Parent event |
| label | TEXT | Required, NOT NULL | None | Schedule entry label |
| starts_at | TEXT | Required | None | Start time for this entry |
| sort_order | INTEGER | NOT NULL | 0 | Display order |
| created_at | TEXT | ISO 8601, auto-set | datetime('now') | Record creation timestamp |
| updated_at | TEXT | ISO 8601, auto-set on modification | datetime('now') | Last modification timestamp |

**Indexes:**
- `ev_timeline_event_idx` on `event_id`

#### 3.7 Business Logic Rules

Timeline entries are sorted by sort_order ASC, then starts_at ASC as tiebreaker.

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Empty label | Inline error: "Label is required" | User fills in label |

#### 3.9 Acceptance Criteria

1. **Given** an event exists,
   **When** the host adds timeline entries "6 PM - Guests arrive", "7 PM - Dinner",
   **Then** both entries appear in chronological order on the event detail.

2. **Given** an event has a timeline,
   **When** a guest views the event via invite bundle,
   **Then** the timeline is included in the bundle data.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates timeline entry | event_id, label, starts_at | Entry created |
| invite bundle includes timeline | event with timeline entries | bundle.timeline has entries |

---

### RC-026: Video Recipe Import

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-026 |
| **Feature Name** | Video Recipe Import |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a recipe collector, I want to paste a YouTube, Instagram Reels, or TikTok URL and have the recipe extracted from the video description, captions, or metadata, so that I can save video recipes to my collection.

#### 3.3 Detailed Description

Video Recipe Import extends the URL import system (RC-010) to handle video platform URLs. Rather than downloading or processing video content, the system extracts recipe data from the video's metadata: title, description text, closed captions/subtitles, and structured data if available.

For YouTube, the system fetches the video page and extracts the description (which frequently contains full recipe text), any JSON-LD data, and optionally chapter markers that correspond to recipe steps. For Instagram and TikTok, the system attempts to extract caption text which may contain ingredient lists and instructions.

After extraction, the text is run through the ingredient parser (RC-005) and a step parser to create structured recipe data. The user reviews and edits the parsed result before saving.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-001: Recipe CRUD - Import creates a recipe
- RC-005: Ingredient Parser - Parses extracted ingredient text
- RC-010: Web Recipe Import - Shares URL fetching infrastructure

**External Dependencies:**
- Network access to fetch video page metadata
- Video pages must be publicly accessible

#### 3.5 User Interface Requirements

Uses the same Import from URL screen as RC-010. The system auto-detects video URLs (youtube.com, youtu.be, instagram.com/reel, tiktok.com) and applies video-specific extraction.

**Additional States:**

| State | Condition | Display |
|-------|-----------|---------|
| Video Detected | URL matches video platform | Badge: "Video recipe detected - extracting from description and captions" |
| Partial Extract | Some fields found in description | Preview with populated fields, warning: "Video recipes may need more manual editing" |
| No Recipe Found | Description has no recipe content | "No recipe data found in this video's description. Try adding the recipe manually." |

#### 3.6 Data Requirements

No new entities. Uses existing Recipe, Ingredient, Step entities.

#### 3.7 Business Logic Rules

##### Video Platform Detection

**Logic:**

```
1. Parse URL hostname and path
2. Detect platform:
   - YouTube: hostname contains "youtube.com" or "youtu.be"
   - Instagram: hostname contains "instagram.com" and path contains "/reel/" or "/p/"
   - TikTok: hostname contains "tiktok.com"
3. RETURN platform identifier or null (not a video URL)
```

##### YouTube Recipe Extraction

**Logic:**

```
1. Fetch video page HTML
2. Extract JSON-LD data (may contain recipe markup from some creators)
3. Extract video description from meta tags or page data:
   a. Find og:description meta tag
   b. Find description in embedded JSON data
4. Parse description text:
   a. Look for "Ingredients" header (case-insensitive)
   b. Lines after "Ingredients" until next header = ingredient list
   c. Look for "Instructions", "Directions", or "Steps" header
   d. Lines after that header until next header = step list
   e. Look for "Servings:", "Prep time:", "Cook time:" labels
5. Parse each ingredient line via RC-005 parser
6. Parse each instruction line as a step
7. Title = video title (from og:title)
8. source_url = original video URL
9. RETURN parsed recipe data for preview
```

##### Instagram/TikTok Extraction

**Logic:**

```
1. Fetch page HTML
2. Extract post caption/description from meta tags (og:description)
3. Attempt to parse recipe content from caption text:
   a. Same "Ingredients"/"Instructions" header scanning as YouTube
   b. Captions tend to be shorter - may only contain ingredient list
4. Title = post title or first line of caption
5. RETURN parsed data (likely partial)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Private video | "This video is private or unavailable" | User checks video access |
| No recipe in description | "No recipe found in the video description" | User adds manually |
| Rate limited by platform | "Could not access this video right now. Try again later." | User retries |

#### 3.9 Acceptance Criteria

1. **Given** a YouTube URL with recipe in the description (Ingredients and Instructions sections),
   **When** the user imports the URL,
   **Then** the preview shows parsed ingredients, steps, and title from the video.

2. **Given** a TikTok URL with a short caption containing no structured recipe,
   **When** the import attempt fails to find recipe data,
   **Then** the user sees a helpful message suggesting manual entry.

3. **Given** a YouTube video with JSON-LD recipe markup,
   **When** the URL is imported,
   **Then** structured data extraction takes priority over description parsing.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| detects YouTube URL | "https://youtube.com/watch?v=abc" | platform: "youtube" |
| detects TikTok URL | "https://tiktok.com/@user/video/123" | platform: "tiktok" |
| detects Instagram Reel | "https://instagram.com/reel/abc" | platform: "instagram" |
| non-video URL returns null | "https://example.com" | platform: null |
| parses recipe from description | description with Ingredients section | parsed ingredient array |

---

### RC-027: Paper Recipe OCR Scanning

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-027 |
| **Feature Name** | Paper Recipe OCR Scanning |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a recipe collector, I want to photograph a handwritten or printed recipe (from a cookbook, recipe card, or family recipe) and have the text extracted via OCR and parsed into a structured recipe, so that I can digitize my paper recipe collection.

#### 3.3 Detailed Description

Paper Recipe OCR uses on-device text recognition (Apple Vision framework on iOS, ML Kit on Android) to extract text from a photographed recipe. The extracted text is then parsed using the same ingredient parser (RC-005) and step parsing logic to produce a structured recipe.

All OCR processing runs entirely on-device with no network calls, preserving the privacy-first design. The user takes a photo or selects from their photo library, the OCR engine extracts text, and the result is shown in a preview for editing before saving.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-001: Recipe CRUD - Creates a recipe from OCR output
- RC-005: Ingredient Parser - Parses extracted text

**External Dependencies:**
- Camera hardware for taking photos
- On-device OCR engine (Apple Vision / ML Kit)
- Photo library access for selecting existing photos

#### 3.5 User Interface Requirements

##### Screen: Scan Recipe

**Layout:**
- Camera viewfinder with "Capture" button (or "Select from Library" option)
- After capture: preview of the photo with detected text regions highlighted
- "Extract" button to run OCR
- After extraction: text editor showing raw extracted text (editable)
- "Parse Recipe" button to run ingredient/step parser on the text
- After parsing: standard recipe preview form (same as URL import preview)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Camera | Ready to capture | Camera viewfinder with capture button |
| Processing | OCR running | Photo with scanning animation overlay |
| Raw Text | OCR complete | Editable text view of extracted content |
| Parsed | Text parsed into recipe | Recipe preview form (editable) |
| Error | OCR failed | "Could not read text from this image. Try a clearer photo." |

**Interactions:**
- Tap Capture: Take photo
- Tap Select from Library: Open photo picker
- Tap Extract: Run OCR on the captured/selected image
- Edit raw text: Correct OCR errors before parsing
- Tap Parse Recipe: Parse text into structured recipe
- Tap Save: Save the parsed recipe

#### 3.6 Data Requirements

No new entities. OCR output is transient; parsed recipe uses existing Recipe, Ingredient, Step entities.

#### 3.7 Business Logic Rules

##### OCR Text-to-Recipe Parsing

**Purpose:** Convert raw OCR text into structured recipe fields.

**Logic:**

```
1. Receive raw text from OCR engine
2. Split into lines, trim each line
3. Attempt to identify sections:
   a. Title: first non-empty line (or line with largest font if OCR provides font info)
   b. Ingredient section: lines following a line containing "ingredient" (case-insensitive)
      OR lines that start with a number/fraction followed by a unit
   c. Step section: lines following a line containing "instruction", "direction", "method", or "step"
      OR numbered lines (1., 2., 3.)
   d. Metadata: scan for patterns like "Serves X", "Prep: X min", "Cook: X min"
4. Parse each ingredient line via RC-005 ingredient parser
5. Parse each step line as a recipe step (strip leading numbers)
6. Assemble recipe preview from parsed sections
```

##### OCR Quality Heuristics

**Logic:**

```
1. IF extracted text length < 20 characters: "Could not read text clearly"
2. IF no ingredient-like lines detected: warn "No ingredients found"
3. IF no step-like lines detected: warn "No instructions found"
4. Allow user to edit raw text to correct OCR errors before parsing
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Image too blurry | "Could not read text. Try a sharper photo." | User retakes photo |
| Handwriting illegible | Partial text extracted with gaps | User edits raw text to fill gaps |
| OCR permission denied | "Camera access needed to scan recipes. Enable in Settings." | Link to system Settings |
| Non-recipe photo | "No recipe content detected." | User tries different photo or enters manually |

#### 3.9 Acceptance Criteria

1. **Given** the user photographs a printed recipe card with clear text,
   **When** OCR processes the image,
   **Then** the raw text output contains the recipe title, ingredients, and instructions.

2. **Given** OCR extracts text with minor errors,
   **When** the user corrects the errors in the raw text editor and taps Parse,
   **Then** the corrected text is parsed into a proper recipe structure.

3. **Given** the image is too blurry to read,
   **When** OCR processes the image,
   **Then** the user sees "Could not read text. Try a sharper photo."

4. **Given** OCR extracts a recipe successfully,
   **When** the user reviews and saves,
   **Then** a new recipe is created with all fields populated from the OCR+parse result.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| identifies ingredient section | text with "Ingredients:" header | ingredient lines extracted |
| identifies step section | text with "Directions:" header | step lines extracted |
| parses metadata | "Serves 4\nPrep: 15 min" | servings: 4, prep_time: 15 |
| rejects too-short text | "abc" (3 chars) | error: text too short |
| handles numbered steps | "1. Do this\n2. Do that" | 2 parsed steps |

---

### RC-028: Nutritional Info Per Recipe

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-028 |
| **Feature Name** | Nutritional Info Per Recipe |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a health-conscious cook, I want to see the estimated calories, protein, carbs, fat, and fiber per serving for each recipe, auto-calculated from the ingredient list, so that I can make informed dietary choices.

#### 3.3 Detailed Description

Nutritional Info calculates per-serving macronutrient data for each recipe by looking up each ingredient in a bundled food composition database (based on USDA FoodData Central). Each ingredient's quantity and unit are converted to grams, looked up in the database, and the nutritional values are summed across all ingredients, then divided by the number of servings.

The food database is bundled with the app as a local SQLite table or JSON asset. It contains approximately 8,000-10,000 common food items with nutritional data per 100g. No network calls are required.

If the MyNutrition module is also enabled, the two modules share the same food database to avoid duplication.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-002: Ingredient Management - Ingredients to analyze
- RC-005: Ingredient Parser - Parsed quantities for calculation
- RC-007: Unit Conversion - Convert ingredient units to grams

**External Dependencies:**
- Bundled food composition database (USDA-based, ~2-5 MB)

#### 3.5 User Interface Requirements

**On Recipe Detail:**
- "Nutrition" card below ingredients section
- Shows per-serving values: Calories, Protein (g), Carbs (g), Fat (g), Fiber (g)
- Visual bar chart showing macro distribution (% calories from protein/carbs/fat)
- "View Details" expands to show per-ingredient breakdown
- Warning badge if some ingredients could not be matched: "Estimates exclude 2 unmatched ingredients"

**On Expanded Nutrition Detail:**
- Table listing each ingredient with its individual nutritional contribution
- Unmatched ingredients highlighted with "Not found in database" note
- Total row at bottom

#### 3.6 Data Requirements

##### Entity: FoodItem (bundled database, read-only)

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER | USDA food ID |
| name | TEXT | Food item name (e.g., "All-purpose flour") |
| calories_per_100g | REAL | Energy in kcal per 100g |
| protein_per_100g | REAL | Protein in grams per 100g |
| carbs_per_100g | REAL | Carbohydrates in grams per 100g |
| fat_per_100g | REAL | Fat in grams per 100g |
| fiber_per_100g | REAL | Dietary fiber in grams per 100g |
| serving_weight_g | REAL | Common serving size in grams |
| category | TEXT | Food category (e.g., "Grains", "Dairy", "Vegetables") |

**Matching aliases table:**

| Field | Type | Description |
|-------|------|-------------|
| alias | TEXT | Common ingredient name used in recipes |
| food_id | INTEGER | References FoodItem.id |

#### 3.7 Business Logic Rules

##### Nutritional Calculation Algorithm

**Purpose:** Calculate per-serving nutritional values for a recipe.

**Inputs:**
- ingredients: array of { name, quantity, unit }
- servings: number

**Logic:**

```
1. FOR each ingredient:
   a. Match ingredient name to food database:
      i. Exact match on food name or alias (case-insensitive)
      ii. If no exact match: try substring match
      iii. If no match: mark as "unmatched", skip
   b. Convert ingredient quantity + unit to grams:
      i. If unit is a weight unit (g, kg, oz, lb): direct conversion
      ii. If unit is a volume unit (cup, tbsp, tsp): use density approximation
         (food database provides serving_weight_g as proxy)
      iii. If unit is null (count): use serving_weight_g as weight per count
   c. Calculate nutrient contribution:
      weight_in_grams = converted weight
      calories = (weight_in_grams / 100) * calories_per_100g
      protein = (weight_in_grams / 100) * protein_per_100g
      carbs = (weight_in_grams / 100) * carbs_per_100g
      fat = (weight_in_grams / 100) * fat_per_100g
      fiber = (weight_in_grams / 100) * fiber_per_100g
2. SUM all nutrient values across matched ingredients
3. DIVIDE totals by servings to get per-serving values
4. ROUND to nearest integer (calories) or 1 decimal (macros)
5. Calculate macro percentages:
   protein_pct = (protein * 4 / calories) * 100
   carbs_pct = (carbs * 4 / calories) * 100
   fat_pct = (fat * 9 / calories) * 100
6. RETURN { calories, protein, carbs, fat, fiber, protein_pct, carbs_pct, fat_pct, unmatched_count }
```

##### Volume-to-Weight Approximations

For common ingredients where volume is specified but weight is needed:

| Ingredient Category | Approx g per cup |
|--------------------|-----------------|
| Flour (all-purpose) | 120 |
| Sugar (granulated) | 200 |
| Sugar (brown, packed) | 220 |
| Butter | 227 |
| Milk | 244 |
| Water | 237 |
| Rice (uncooked) | 185 |
| Oats | 80 |
| Oil (any) | 218 |
| Honey | 340 |

**Edge Cases:**
- Ingredient "salt to taste" (no quantity): Skip, 0 calories
- Ingredient "1 large egg": Use standard egg weight (50g)
- Ingredient range "1-2 cups milk": Use midpoint (1.5 cups)
- Recipe servings is null: Show total nutrients, not per-serving
- All ingredients unmatched: Show "Nutritional data unavailable for this recipe"

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Some ingredients unmatched | Warning: "Nutrition estimates exclude N unmatched ingredients" with list | User accepts estimate or manually enters nutrition |
| All ingredients unmatched | "Nutritional data unavailable" | User can manually enter per-serving values |
| Servings is null | Show total nutrition (not per-serving) with note: "Set servings for per-serving values" | User sets servings on recipe |

#### 3.9 Acceptance Criteria

1. **Given** a recipe "Pasta Carbonara" with ingredients flour, eggs, cheese, guanciale (4 servings),
   **When** nutritional info is calculated,
   **Then** per-serving calories, protein, carbs, fat, and fiber are displayed.

2. **Given** an ingredient "truffle oil" is not in the food database,
   **When** nutritional info is calculated,
   **Then** a warning shows "Estimates exclude 1 unmatched ingredient: truffle oil".

3. **Given** a recipe has servings set to null,
   **When** nutritional info is displayed,
   **Then** total values are shown with a note to set servings.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates calories for single ingredient | 100g flour (364 cal/100g) | 364 calories |
| divides by servings | 1000 cal total, 4 servings | 250 cal per serving |
| handles unmatched ingredient | "truffle oil" | unmatched_count: 1 |
| converts cup of flour to grams | 1 cup flour | ~120g |
| calculates macro percentages | cal: 400, protein: 20g, carbs: 50g, fat: 15g | protein: 20%, carbs: 50%, fat: 34% |
| handles null servings | total: 800 cal, servings: null | returns total, not per-serving |

---

### RC-029: Voice Control in Cooking Mode

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-029 |
| **Feature Name** | Voice Control in Cooking Mode |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a home cook with messy hands, I want to use voice commands like "next step", "start timer 10 minutes", and "read ingredients" to control cooking mode hands-free, so that I do not have to touch my phone while cooking.

#### 3.3 Detailed Description

Voice Control adds a hands-free interaction layer to Cooking Mode (RC-008). The system uses platform speech recognition APIs (SFSpeechRecognizer on iOS, SpeechRecognizer on Android) to listen for voice commands. All speech processing runs on-device with no audio transmitted to external servers.

The voice control activates when the user enters cooking mode and taps a microphone button. The system listens continuously for wake commands and responds with visual feedback and optional text-to-speech responses.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-008: Cooking Mode - Voice commands control cooking mode navigation and timers
- RC-009: Multiple Cooking Timers - Voice can start/stop timers

**External Dependencies:**
- Microphone access permission
- On-device speech recognition API
- Text-to-speech API (for spoken responses)

#### 3.5 User Interface Requirements

**In Cooking Mode:**
- Microphone button in the bottom bar (tap to enable/disable voice control)
- Listening indicator animation when voice control is active
- Visual feedback showing recognized command text
- Spoken confirmation of actions (optional, configurable in settings)

#### 3.6 Data Requirements

No new entities. Voice commands map to existing cooking mode actions.

#### 3.7 Business Logic Rules

##### Voice Command Dictionary

| Command Pattern | Action | Response |
|----------------|--------|----------|
| "next step" / "next" | Navigate to next step | Visual: step advances. Speech: "[Step N]: [instruction preview]" |
| "previous step" / "back" / "go back" | Navigate to previous step | Visual: step goes back. Speech: "Step [N]" |
| "start timer [N] minutes" / "set timer [N] minutes" | Start timer for N minutes | Visual: timer starts. Speech: "Timer set for [N] minutes" |
| "stop timer" / "cancel timer" | Stop most recent timer | Visual: timer stops. Speech: "Timer cancelled" |
| "read ingredients" / "what ingredients" | Read ingredient list aloud via TTS | Speech: Reads full ingredient list |
| "read step" / "repeat" / "read again" | Read current step aloud | Speech: Reads current step instruction |
| "how much [ingredient]" | Look up quantity for specific ingredient | Speech: "[quantity] [unit] [ingredient name]" |
| "what step am I on" | Report current position | Speech: "You are on step [N] of [total]" |
| "how much time left" | Report remaining time on active timer(s) | Speech: "[timer label]: [time remaining]" |

##### Speech Recognition Pipeline

**Logic:**

```
1. Request microphone permission
2. Initialize speech recognizer (on-device mode)
3. Start continuous recognition session
4. On each recognition result:
   a. Convert recognized text to lowercase
   b. Match against command patterns (fuzzy matching, keyword extraction)
   c. IF command matched: execute action, provide feedback
   d. IF no match: ignore (avoid false positives)
5. On voice control disabled: stop recognition session
```

**Edge Cases:**
- Background noise in kitchen: Use keyword detection confidence threshold (>70%)
- "Next" could be part of normal conversation: Only respond when voice control is explicitly enabled
- Multiple people talking: Use most recent recognized phrase
- Timer number parsing: "ten" -> 10, "fifteen" -> 15, "half an hour" -> 30

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Microphone permission denied | "Microphone access needed for voice control. Enable in Settings." | Link to Settings |
| Speech recognition unavailable | "Voice control is not available on this device" | User uses touch controls |
| Command not recognized | Brief "?" animation, no action taken | User repeats or tries different phrasing |

#### 3.9 Acceptance Criteria

1. **Given** voice control is enabled in cooking mode,
   **When** the user says "next step",
   **Then** cooking mode advances to the next step.

2. **Given** voice control is enabled,
   **When** the user says "start timer 10 minutes",
   **Then** a 10-minute timer starts and the user hears "Timer set for 10 minutes."

3. **Given** voice control is enabled,
   **When** the user says "read ingredients",
   **Then** the full ingredient list is read aloud via text-to-speech.

4. **Given** voice control is enabled,
   **When** the user says something that is not a recognized command,
   **Then** nothing happens (no false action).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| recognizes "next step" | "next step" | action: NEXT_STEP |
| recognizes "start timer 10 minutes" | "start timer 10 minutes" | action: START_TIMER, duration: 10 |
| recognizes "read ingredients" | "read ingredients" | action: READ_INGREDIENTS |
| ignores unrecognized input | "hello world" | action: null |
| parses word numbers | "start timer fifteen minutes" | action: START_TIMER, duration: 15 |

---

### RC-030: AI Recipe Suggestions

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-030 |
| **Feature Name** | AI Recipe Suggestions |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a meal planner, I want the app to suggest recipes I can make based on what is in my pantry, my dietary preferences, available time, and ingredients that are about to expire, so that I reduce food waste and meal planning effort.

#### 3.3 Detailed Description

AI Recipe Suggestions answers the question "What can I make tonight?" by matching the user's pantry contents against recipe ingredient lists. The system uses a local matching algorithm (no LLM required for V1) that scores recipes based on ingredient overlap with the pantry, dietary preference alignment, time availability, and expiration urgency of pantry items.

The suggestion engine runs entirely on-device. A future version may integrate LLM capabilities for creative recipe generation, but V1 focuses on a simple, fast matching algorithm.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-013: Pantry Tracker - Provides ingredients on hand
- RC-001: Recipe CRUD - Recipes to suggest from

#### 3.5 User Interface Requirements

##### Screen: Suggestions (sub-screen or section on Home tab)

**Layout:**
- "What can I make?" header
- Optional filters: max time available, dietary preference, "use expiring items first" toggle
- Suggested recipe cards ranked by match score
- Each card: recipe title, photo, match percentage, missing ingredient count, time
- "Missing: 2 ingredients" badge showing what the user needs to buy

**Interactions:**
- Tap suggestion: View recipe detail
- Tap "Missing ingredients": Show list of items not in pantry with "Add to shopping list" button
- Pull to refresh: Recalculate suggestions

#### 3.6 Data Requirements

No new entities. Suggestions are computed at runtime from Recipe and Pantry data.

#### 3.7 Business Logic Rules

##### Recipe Scoring Algorithm

**Purpose:** Rank recipes by how well they match the user's current pantry and preferences.

**Inputs:**
- pantryItems: Set of ingredient names (lowercase)
- recipes: all user recipes with ingredients
- filters: { maxTime?: number, dietary?: string[], useExpiringFirst?: boolean }

**Logic:**

```
1. FOR each recipe:
   a. Get ingredient list
   b. Count matched ingredients (name found in pantry, case-insensitive substring match)
   c. Count total ingredients
   d. ingredient_score = matched / total (0.0 to 1.0)
   e. missing_count = total - matched
2. Apply filters:
   a. IF maxTime set: exclude recipes where total_time_mins > maxTime
   b. IF dietary set: exclude recipes that violate dietary preferences (via RC-014)
3. Calculate final score:
   a. base_score = ingredient_score * 100
   b. IF useExpiringFirst AND recipe uses expiring pantry items:
      bonus = 20 points per expiring ingredient used
   c. IF recipe is favorited: bonus += 5
   d. final_score = base_score + bonus
4. Sort by final_score DESC
5. RETURN top 20 suggestions with match details
```

**Edge Cases:**
- No pantry items: Show all recipes sorted by favorites/rating (no ingredient matching)
- No recipes match filters: "No recipes match your criteria. Try adjusting filters or add more recipes."
- Recipe with 1 ingredient: High match score if ingredient is in pantry (but low complexity recipe)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Empty pantry | "Add items to your pantry to get personalized suggestions" with link to Pantry | User adds pantry items |
| No matching recipes | "No recipes match your current pantry and filters" | User adjusts filters |

#### 3.9 Acceptance Criteria

1. **Given** the pantry contains "tomato, onion, garlic, pasta" and a recipe "Pasta Marinara" uses "tomato, onion, garlic, pasta, basil",
   **When** suggestions are generated,
   **Then** "Pasta Marinara" appears with 80% match (4/5 ingredients) and "Missing: basil".

2. **Given** the user sets max time to 30 minutes,
   **When** suggestions are generated,
   **Then** only recipes with total_time_mins <= 30 appear.

3. **Given** pantry item "milk" expires tomorrow,
   **When** the "use expiring items first" toggle is on,
   **Then** recipes using milk are ranked higher.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| scores 100% match | pantry has all ingredients | score: 100 |
| scores 50% match | pantry has half of ingredients | score: ~50 |
| filters by max time | maxTime: 30, recipe: 45 min | recipe excluded |
| boosts expiring items | expiring pantry item used in recipe | score increased by 20 |
| handles empty pantry | no pantry items | returns recipes sorted by rating/favorites |

---

### RC-031: Print Recipes

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-031 |
| **Feature Name** | Print Recipes |
| **Priority** | P2 |
| **Category** | Import/Export |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a home cook, I want to print a recipe in a clean, ink-friendly format with large text, clear ingredient list, and numbered steps, so that I can have a paper copy in the kitchen.

#### 3.3 Detailed Description

Print Recipes generates a clean, printable layout for any recipe. The layout is optimized for standard paper sizes (US Letter and A4) with large, readable text, clear section headers, and minimal ink usage (no dark backgrounds). The print view includes the recipe title, servings, prep/cook/total time, ingredient list, numbered steps, and optionally the recipe photo.

On web, this uses a print stylesheet. On mobile, this generates a shareable PDF or uses the platform's print dialog.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-001: Recipe CRUD - Recipe data to print

#### 3.5 User Interface Requirements

**Print Preview:**
- Clean white background, black text
- Recipe title in large bold header
- Metadata row: servings, prep time, cook time, total time
- Two-column layout (where space allows): ingredients on left, steps on right
- Steps numbered with clear spacing
- Optional recipe photo (checkbox to include/exclude)
- Source URL in footer (if available)
- "Print" button triggers platform print dialog

#### 3.6 Data Requirements

No new entities. Reads existing Recipe, Ingredient, Step data.

#### 3.7 Business Logic Rules

##### Print Layout

**Layout rules:**
- Title: 24pt bold
- Section headers (Ingredients, Steps): 18pt bold
- Body text: 14pt
- Ingredient list: bullet points
- Steps: numbered list with 1.5x line spacing
- Page margins: 1 inch / 2.54 cm
- Photo: max 3 inches wide if included

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Recipe has no steps | Print shows ingredients only with note "No steps available" | User adds steps |
| Printer not available | Platform print dialog shows error | User checks printer connection |

#### 3.9 Acceptance Criteria

1. **Given** a recipe with title, ingredients, and steps,
   **When** the user taps Print,
   **Then** a clean, printer-friendly layout is generated and the print dialog opens.

2. **Given** the user unchecks "Include photo",
   **When** the print layout is generated,
   **Then** the photo is excluded, saving ink.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates print HTML | recipe with all fields | HTML with title, ingredients, steps |
| excludes photo when option off | includePhoto: false | No img element in output |

---

### RC-032: Recipe Sharing

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-032 |
| **Feature Name** | Recipe Sharing |
| **Priority** | P2 |
| **Category** | Social |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a home cook, I want to share a recipe as an attractive image card or a text-based link, so that I can send recipes to friends via messaging apps without requiring them to have the app.

#### 3.3 Detailed Description

Recipe Sharing generates a shareable recipe card either as an image (PNG) or as formatted text. The image card includes the recipe photo, title, key metadata, and ingredient list in an attractive, branded layout. The text version includes the full recipe as plain text (suitable for messaging or email).

No server is required. The image is rendered locally and shared via the platform share sheet. The text version is copied to the clipboard or shared directly.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-001: Recipe CRUD - Recipe data to share

#### 3.5 User Interface Requirements

**Share Options (from Recipe Detail):**
- "Share as Image": Generate recipe card image and open share sheet
- "Share as Text": Copy formatted recipe text to clipboard
- "Export as JSON": Export recipe as JSON file (for importing into another MyRecipes instance)

#### 3.6 Data Requirements

No new entities. Generates ephemeral shareable content from existing data.

#### 3.7 Business Logic Rules

##### Text Format

```
[Recipe Title]
Servings: [N] | Prep: [X] min | Cook: [Y] min

INGREDIENTS
- [quantity] [unit] [name]
- [quantity] [unit] [name]
...

INSTRUCTIONS
1. [step text]
2. [step text]
...

Source: [URL if available]
Shared from MyRecipes
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Image generation fails | Fall back to text sharing | User shares as text |
| Share sheet cancelled | No action | N/A |

#### 3.9 Acceptance Criteria

1. **Given** a recipe with photo and ingredients,
   **When** the user taps "Share as Image",
   **Then** an attractive recipe card image is generated and the share sheet opens.

2. **Given** a recipe with all fields,
   **When** the user taps "Share as Text",
   **Then** the formatted recipe text is copied to the clipboard with a toast confirmation.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates text format | recipe with all fields | formatted text string |
| generates JSON export | recipe with ingredients and steps | valid JSON object |

---

### RC-033: Import from External Apps

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-033 |
| **Feature Name** | Import from External Apps |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user switching from Paprika, Mela, or Recipe Keeper, I want to import my existing recipe collection from their export format, so that I do not lose my recipes when switching apps.

#### 3.3 Detailed Description

Import from External Apps supports importing recipe data from popular recipe management apps' export formats. Each app has a different export format, so a dedicated parser is needed for each. Supported formats include Paprika (.paprikarecipes), Mela (JSON export), Recipe Keeper (CSV/JSON), Crouton (JSON), and generic CSV/JSON.

The import flow: user selects the source app, provides the export file, the system parses and previews the recipes, and the user confirms import. Partial imports are supported - if some recipes fail to parse, the valid ones are imported and errors are reported.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-001: Recipe CRUD - Creates recipes from imported data
- RC-005: Ingredient Parser - Parses ingredient text from imported data

#### 3.5 User Interface Requirements

##### Screen: Import Recipes

**Layout:**
- Source selection: list of supported apps (Paprika, Mela, Recipe Keeper, Crouton, Generic CSV, Generic JSON)
- File picker button for the selected source
- Import progress bar
- Preview of imported recipes with count: "Found 45 recipes"
- Error summary: "3 recipes could not be parsed" with details
- "Import All" button to save valid recipes

#### 3.6 Data Requirements

No new entities. Import creates Recipe, Ingredient, Step, and RecipeTag records.

#### 3.7 Business Logic Rules

##### Paprika Format (.paprikarecipes)

**Format:** Gzipped archive containing individual recipe files as HTML or JSON.

**Parsing:**
```
1. Decompress .paprikarecipes file (gzip)
2. Extract individual recipe files
3. For each recipe file:
   a. Parse as JSON or HTML
   b. Map fields: name -> title, ingredients -> ingredients (parse each line),
      directions -> steps (split by newlines or numbered lines),
      prep_time -> prep_time_mins, cook_time -> cook_time_mins,
      servings -> servings, source -> source_url,
      image_data -> image_uri (save base64 as local file),
      categories -> tags
```

##### Mela Format (JSON)

**Parsing:**
```
1. Parse JSON file
2. Extract recipe array
3. For each recipe:
   Map: title, ingredients (newline-separated string), instructions,
   prepTime, cookTime, yield -> servings, images, categories -> tags
```

##### Generic CSV Format

**Expected columns:** title, ingredients, instructions, servings, prep_time, cook_time, source_url, tags

**Parsing:**
```
1. Parse CSV with header row
2. For each row:
   a. title = title column
   b. ingredients = split by newline or semicolon, parse each via RC-005
   c. instructions = split by newline or numbered pattern
   d. Map remaining fields directly
```

##### Generic JSON Format

**Expected structure:**
```json
{
  "recipes": [
    {
      "title": "string",
      "ingredients": ["string"],
      "instructions": ["string"],
      "servings": 4,
      "prepTime": 15,
      "cookTime": 30,
      "sourceUrl": "string",
      "tags": ["string"]
    }
  ]
}
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| File format not recognized | "Could not read this file. Make sure it is a supported export format." | User checks file |
| Partial parse failure | "Imported 42 of 45 recipes. 3 could not be parsed." with error details | User can manually add failed recipes |
| Duplicate recipe title | Import creates the recipe (duplicates allowed) | User can delete duplicates later |
| Empty file | "No recipes found in this file." | User checks export process |

#### 3.9 Acceptance Criteria

1. **Given** a Paprika export file containing 20 recipes,
   **When** the user imports the file,
   **Then** 20 recipes are created with titles, ingredients, steps, and tags preserved.

2. **Given** a CSV file with 10 recipes where 2 have missing titles,
   **When** the import runs,
   **Then** 8 recipes are imported and 2 failures are reported with reason "Missing title".

3. **Given** a generic JSON file,
   **When** the user selects "Generic JSON" and imports,
   **Then** recipes are created with all fields mapped correctly.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| parses Paprika format | valid .paprikarecipes | array of parsed recipes |
| parses Mela JSON | valid Mela export | array of parsed recipes |
| parses generic CSV | CSV with header row | array of parsed recipes |
| handles missing title in CSV | row with empty title | parse error for that row |
| handles empty file | empty file | empty array, no crash |

---

### RC-034: Cooking History Log

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-034 |
| **Feature Name** | Cooking History Log |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a home cook, I want to track when I made each recipe and add personal notes about modifications and results, so that I can improve my cooking over time and remember what worked.

#### 3.3 Detailed Description

The Cooking History Log records each time a user cooks a recipe. Each log entry captures the recipe, the date cooked, a personal note (modifications, results, tips for next time), and an optional photo of the finished dish. The log is displayed on the recipe detail screen as a timeline and accessible as a global cooking diary.

A cooking history entry is automatically prompted when the user completes Cooking Mode (RC-008) but can also be added manually. Over time, the history shows how often each recipe is made and provides a personal cooking journal.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-001: Recipe CRUD - History entries reference recipes
- RC-008: Cooking Mode - Auto-prompt after completing cooking mode

#### 3.5 User Interface Requirements

**On Recipe Detail:**
- "Cooking History" section showing past cook dates as a timeline
- Each entry: date, note snippet, photo thumbnail
- Tap entry: expand to full note and photo
- "Log a Cook" button to manually add an entry

**Global Cooking Diary (accessible from Home tab):**
- Chronological feed of all cooking history entries across all recipes
- Filter by date range
- "Cooked X recipes this month" summary stat

#### 3.6 Data Requirements

##### Entity: CookingHistoryEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique entry identifier |
| recipe_id | TEXT | Foreign key to rc_recipes(id), ON DELETE CASCADE | None | Recipe that was cooked |
| cooked_at | TEXT | Required, ISO datetime | None | When the recipe was made |
| note | TEXT | Optional | null | Personal notes, modifications, results |
| photo_uri | TEXT | Optional | null | Photo of the finished dish |
| created_at | TEXT | ISO 8601, auto-set | datetime('now') | Record creation timestamp |

#### 3.7 Business Logic Rules

##### Auto-Prompt After Cooking Mode

**Logic:**

```
1. When user completes Cooking Mode (reaches "Done" on last step):
   a. Show modal: "How did it turn out?"
   b. Fields: note (multiline), photo picker, "Save" and "Skip" buttons
   c. IF Save: Create CookingHistoryEntry with current timestamp
   d. IF Skip: No entry created
```

##### Cooking Frequency Stats

**Logic:**

```
1. COUNT cooking history entries per recipe
2. "Most cooked" = recipe with highest count
3. "Last cooked" = most recent cooked_at per recipe
4. "This month" = COUNT entries WHERE cooked_at in current month
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails | Toast: "Could not save cooking log" | User retries |

#### 3.9 Acceptance Criteria

1. **Given** the user finishes cooking mode for "Pasta Carbonara",
   **When** the completion modal appears and the user writes "Added extra pepper, turned out great" and saves,
   **Then** a cooking history entry appears on the recipe detail with today's date and the note.

2. **Given** a recipe has been cooked 5 times,
   **When** the user views the recipe detail,
   **Then** the cooking history section shows 5 entries in reverse chronological order.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates history entry | recipe_id, cooked_at, note | entry created |
| counts cooks per recipe | 3 entries for recipe_id | count: 3 |
| retrieves history chronologically | 3 entries | sorted by cooked_at DESC |

---

### RC-035: Recipe Ratings

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-035 |
| **Feature Name** | Recipe Ratings |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a home cook, I want to rate my recipes on a 1-5 star scale, so that I can quickly identify my favorite and best recipes.

#### 3.3 Detailed Description

Recipe Ratings uses the `rating` field on the Recipe entity (integer, 0-5 where 0 = unrated). Users tap stars on the recipe detail screen to set or change the rating. Ratings are personal and private. The recipe list can be sorted by rating (highest first).

This feature is already implemented as part of the Recipe entity (RC-001) but is documented separately because ratings serve as a distinct user-facing feature with its own interaction pattern and sorting capability.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-001: Recipe CRUD - Rating is a field on the Recipe entity

#### 3.5 User Interface Requirements

**On Recipe Detail:**
- 5-star rating display (filled stars for the rating, empty for remaining)
- Tap a star to set rating (tap 3rd star = 3 stars)
- Tap the current rating star again to clear rating (set to 0)

**On Recipe List:**
- Star rating shown on recipe cards
- Sort option: "Rating (highest first)"

#### 3.6 Data Requirements

Uses existing `rating` field on Recipe entity (INTEGER, 0-5).

#### 3.7 Business Logic Rules

**Rating Logic:**
- Tap star N: Set rating to N
- Tap star N when rating is already N: Set rating to 0 (clear)
- Rating 0 displays as "Unrated" (no stars filled)

#### 3.8 Error Handling

No error states. Rating is a simple integer update.

#### 3.9 Acceptance Criteria

1. **Given** a recipe with no rating (0),
   **When** the user taps the 4th star,
   **Then** the rating is set to 4 and 4 filled stars are displayed.

2. **Given** a recipe with rating 4,
   **When** the user taps the 4th star again,
   **Then** the rating clears to 0.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| sets rating | recipe_id, rating: 4 | recipe.rating = 4 |
| clears rating | recipe with rating 4, set to 0 | recipe.rating = 0 |
| validates rating range | rating: 6 | validation error (max 5) |

---

### RC-036: Freezer Inventory

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-036 |
| **Feature Name** | Freezer Inventory |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a meal planner, I want to separately track frozen items with freeze date and recommended use-by guidance, so that I can manage my freezer contents and avoid food waste.

#### 3.3 Detailed Description

Freezer Inventory extends the Pantry Tracker (RC-013) with a dedicated section for frozen items. Each frozen item records the item name, quantity, freeze date, and a recommended use-by duration based on the item category. The system alerts users when frozen items approach their recommended use-by window.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-013: Pantry Tracker - Freezer is a specialized extension of pantry

#### 3.5 User Interface Requirements

**Freezer Section (within Pantry):**
- Separate "Freezer" tab or section within the Pantry screen
- Each item: name, quantity, freeze date, "Use by" date, freshness indicator
- "Add to Freezer" button
- Items sorted by use-by date (soonest first)

#### 3.6 Data Requirements

##### Entity: FreezerItem

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique item identifier |
| name | TEXT | Required, NOT NULL | None | Item name |
| quantity | REAL | Optional | null | Quantity |
| unit | TEXT | Optional | null | Unit of measure |
| freeze_date | TEXT | Required, ISO date | None | When item was frozen |
| use_by_months | INTEGER | Positive | 3 | Recommended months before use |
| note | TEXT | Optional | null | Notes |
| created_at | TEXT | ISO 8601 | datetime('now') | Record creation timestamp |
| updated_at | TEXT | ISO 8601 | datetime('now') | Last modification timestamp |

#### 3.7 Business Logic Rules

##### Freezer Use-By Guidance

| Item Category | Recommended Months |
|--------------|-------------------|
| Raw meat (beef, pork, lamb) | 6 |
| Raw poultry | 9 |
| Raw fish/seafood | 3 |
| Cooked meals/leftovers | 3 |
| Bread/baked goods | 3 |
| Vegetables (blanched) | 12 |
| Fruit | 12 |
| Soups/stocks | 4 |
| Butter | 6 |
| Cheese (hard) | 6 |
| Default (unspecified) | 3 |

**Use-By Date Calculation:**
```
use_by_date = freeze_date + use_by_months months
```

**Freshness Indicator:**
- Green: more than 1 month until use-by
- Yellow: less than 1 month until use-by
- Red: past use-by date

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Freeze date in future | Warning: "Freeze date is in the future" | User adjusts |

#### 3.9 Acceptance Criteria

1. **Given** the user adds "Chicken breast" to the freezer on 2026-03-01,
   **When** the use-by guidance is calculated (poultry = 9 months),
   **Then** the use-by date shows 2026-12-01.

2. **Given** a frozen item passes its use-by date,
   **When** the user views the freezer,
   **Then** the item shows a red "Past use-by" indicator.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates use-by date | freeze: 2026-03-01, months: 9 | 2026-12-01 |
| flags overdue item | use-by: yesterday | status: overdue |
| flags soon-expiring item | use-by: 2 weeks from now | status: expiring_soon |

---

### RC-037: Settings and Preferences

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-037 |
| **Feature Name** | Settings and Preferences |
| **Priority** | P0 |
| **Category** | Settings |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user, I want to configure my preferred measurement system, default servings, and other preferences, so that the app works the way I expect.

#### 3.3 Detailed Description

Settings stores user preferences in the `rc_settings` key-value table. Default settings are seeded on module initialization. Available settings include measurement system (US/Metric), default servings, default difficulty, and cooking mode preferences.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None

#### 3.5 User Interface Requirements

##### Screen: Settings (Tab)

**Layout:**
- Grouped list of settings sections:
  - **General:** Measurement system (US/Metric toggle), default servings (number), default difficulty (segmented control)
  - **Cooking Mode:** Voice control enabled, spoken confirmations enabled, keep screen awake
  - **Notifications:** Watering reminders, timer alerts
  - **Data:** Export all data (JSON), Delete all data (with confirmation)

#### 3.6 Data Requirements

##### Entity: Settings (key-value)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| defaultServings | string (number) | "4" | Default servings for new recipes |
| measurementSystem | string | "us" | "us" or "metric" |
| defaultDifficulty | string | "medium" | Default difficulty for new recipes |

#### 3.7 Business Logic Rules

Settings are read via `getSetting(key)` and written via `setSetting(key, value)`. Default values are seeded on module initialization via SEED_SETTINGS SQL statements.

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Setting write fails | Toast: "Could not save setting" | User retries |
| Missing setting key | Return null, use hardcoded default | Automatic fallback |

#### 3.9 Acceptance Criteria

1. **Given** the default measurement system is "us",
   **When** the user switches to "metric",
   **Then** unit conversions throughout the app display metric values.

2. **Given** the user changes default servings to 2,
   **When** they create a new recipe,
   **Then** the servings field defaults to 2.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| gets existing setting | key: "measurementSystem" | "us" |
| sets and retrieves setting | key: "measurement", value: "metric" | "metric" |
| returns null for missing key | key: "nonexistent" | null |

---

### RC-038: Garden Journal

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-038 |
| **Feature Name** | Garden Journal |
| **Priority** | P1 |
| **Category** | Garden |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a garden enthusiast, I want to capture photos of my plants with notes and optional species identification, so that I can track my garden's growth over time.

#### 3.3 Detailed Description

The Garden Journal allows users to photograph plants and add timestamped entries with notes. Each journal entry can optionally be linked to a specific plant from the garden inventory. The journal provides a visual timeline of the garden's progression across seasons.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-016: Garden Plant Tracking - Journal entries can link to plants

**External Dependencies:**
- Camera access for taking photos

#### 3.5 User Interface Requirements

**Screen: Garden Journal (accessible from Garden tab)**

**Layout:**
- Chronological photo grid/timeline of journal entries
- Each entry: photo thumbnail, date, plant link (if any), note snippet
- "Add Entry" button with camera/library picker
- Filter by plant or date range

#### 3.6 Data Requirements

##### Entity: GardenJournalEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique entry identifier |
| plant_id | TEXT | Foreign key to gd_plants(id), ON DELETE SET NULL | null | Linked plant (optional) |
| photo_path | TEXT | Required, NOT NULL | None | Path to photo file |
| note | TEXT | Optional | null | Journal note |
| identified_species | TEXT | Optional | null | Species identified from photo (manual or future ML) |
| captured_at | TEXT | Required, ISO datetime | None | When the photo was taken |
| created_at | TEXT | ISO 8601, auto-set | datetime('now') | Record creation timestamp |

**Indexes:**
- `gd_garden_journal_plant_idx` on `plant_id`

#### 3.7 Business Logic Rules

No complex logic. Simple CRUD with chronological display.

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Camera permission denied | "Camera access needed. Enable in Settings." | Link to system Settings |
| Photo file missing | Placeholder shown in timeline | User can delete or re-add entry |

#### 3.9 Acceptance Criteria

1. **Given** the user takes a photo of their tomato plant,
   **When** they save the journal entry with a note "First flowers!",
   **Then** the entry appears in the journal timeline with the photo, note, and today's date.

2. **Given** a journal entry is linked to plant "Tomato",
   **When** the user views the tomato plant detail,
   **Then** the journal entry appears in the plant's timeline.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates journal entry | photo_path, note, captured_at | entry created |
| links entry to plant | plant_id, photo_path | entry.plant_id set |
| returns entries chronologically | 3 entries | sorted by captured_at DESC |

---

### RC-039: Onboarding and First-Run

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RC-039 |
| **Feature Name** | Onboarding and First-Run |
| **Priority** | P1 |
| **Category** | Onboarding |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a new user, I want a brief introduction to MyRecipes' features with optional sample data, so that I can quickly understand the app's capabilities.

#### 3.3 Detailed Description

The onboarding flow shows on first launch and introduces the three main pillars: Recipes, Garden, and Events. It includes optional sample data loading (5 sample recipes with ingredients and steps) so new users have something to explore immediately.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RC-001: Recipe CRUD - Sample data creation

#### 3.5 User Interface Requirements

**Onboarding Screens (3 swipeable pages):**
1. "Your Kitchen Companion" - Recipe management, import, cooking mode
2. "Grow It" - Garden tracking, harvest-to-recipe linking
3. "Host It" - Event planning, RSVP, menu management

**Final screen:**
- "Load Sample Recipes" toggle (default: on)
- "Get Started" button

#### 3.6 Data Requirements

No new entities. Onboarding flag stored as a setting ("onboarding_complete" = "true").

#### 3.7 Business Logic Rules

**Sample Data:**
- 5 sample recipes: Pasta Carbonara, Garden Salad, Chicken Stir Fry, Banana Bread, Tomato Soup
- Each with 4-8 ingredients and 3-6 steps
- 2 tagged as favorites

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Sample data load fails | Toast: "Could not load sample recipes" | User proceeds without samples |

#### 3.9 Acceptance Criteria

1. **Given** the app is launched for the first time,
   **When** the user completes onboarding with sample data enabled,
   **Then** 5 sample recipes are loaded and the onboarding flag is set.

2. **Given** onboarding is complete,
   **When** the app is launched again,
   **Then** onboarding is not shown (goes directly to home screen).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| loads sample recipes | loadSamples: true | 5 recipes created |
| sets onboarding flag | complete onboarding | setting "onboarding_complete" = "true" |
| skips if already complete | flag already set | onboarding not shown |

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

The data model centers on the **Recipe** entity, which is the primary object users create and interact with. Each Recipe has many **Ingredients**, **Steps**, and **Tags** (one-to-many). Recipes are assigned to **MealPlanItems** within weekly **MealPlans** for meal planning.

A parallel garden subsystem tracks **GardenPlants** with **PlantCareLogs**, visual **GardenLayouts**, photo **GardenJournalEntries**, and **Harvests**. Harvests connect back to recipes through **HarvestRecipeLinks**, creating a garden-to-table pipeline.

The events subsystem manages **Events** with **Guests**, **RSVPs**, **MenuItems** (linking events to recipes), **PotluckClaims**, and **EventTimelines**. Guests provide allergy information that is cross-referenced against menu recipe ingredients for safety warnings.

New entities for future features include **CookingHistoryEntries** (RC-034), **FreezerItems** (RC-036), **PantryItems** (RC-013 future), and a bundled read-only **FoodItem** database for nutritional calculations (RC-028).

### 4.2 Complete Entity Definitions

All entity definitions are provided in their respective feature specifications (Section 3). The canonical entities are:

**Recipe Domain (rc_ prefix):**
- Recipe (RC-001, Section 3.6)
- Ingredient (RC-002, Section 3.6)
- Step (RC-003, Section 3.6)
- RecipeTag (RC-004, Section 3.6)
- MealPlan (RC-011, Section 3.6)
- MealPlanItem (RC-011, Section 3.6)
- Settings (RC-037, Section 3.6)
- CookingHistoryEntry (RC-034, Section 3.6) - New

**Garden Domain (gd_ prefix):**
- GardenPlant (RC-016, Section 3.6)
- PlantCareLog (RC-016, Section 3.6)
- GardenLayout (RC-017, Section 3.6)
- GardenJournalEntry (RC-038, Section 3.6)
- Harvest (RC-018, Section 3.6)
- HarvestRecipeLink (RC-019, Section 3.6)

**Events Domain (ev_ prefix):**
- Event (RC-020, Section 3.6)
- Guest (RC-021, Section 3.6)
- RSVP (RC-021, Section 3.6)
- MenuItem (RC-022, Section 3.6)
- PotluckClaim (RC-024, Section 3.6)
- EventTimeline (RC-025, Section 3.6)

**Standalone Entities:**
- FreezerItem (RC-036, Section 3.6) - New
- PantryItem (RC-013, Section 3.6) - Future
- FoodItem (RC-028, Section 3.6) - Bundled read-only database

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| Recipe -> Ingredient | one-to-many | A recipe has many ingredients (CASCADE delete) |
| Recipe -> Step | one-to-many | A recipe has many steps (CASCADE delete) |
| Recipe -> RecipeTag | one-to-many | A recipe has many tags (CASCADE delete) |
| Recipe -> MealPlanItem | one-to-many | A recipe can appear in many meal plan slots (CASCADE delete) |
| Recipe -> MenuItem | one-to-many | A recipe can appear on many event menus (CASCADE delete) |
| Recipe -> HarvestRecipeLink | one-to-many | A recipe can be linked to many harvests (CASCADE delete) |
| Recipe -> CookingHistoryEntry | one-to-many | A recipe has many cooking history entries (CASCADE delete) |
| MealPlan -> MealPlanItem | one-to-many | A meal plan contains items for the week (CASCADE delete) |
| GardenPlant -> PlantCareLog | one-to-many | A plant has many care log entries (CASCADE delete) |
| GardenPlant -> GardenJournalEntry | one-to-many | A plant has many journal entries (SET NULL on delete) |
| GardenPlant -> Harvest | one-to-many | A plant produces many harvests (SET NULL on delete) |
| Harvest -> HarvestRecipeLink | one-to-many | A harvest can link to many recipes (CASCADE delete) |
| Event -> Guest | one-to-many | An event has many guests (CASCADE delete) |
| Event -> RSVP | one-to-many | An event has many RSVPs (CASCADE delete) |
| Event -> MenuItem | one-to-many | An event has many menu items (CASCADE delete) |
| Event -> PotluckClaim | one-to-many | An event has many potluck claims (CASCADE delete) |
| Event -> EventTimeline | one-to-many | An event has many timeline entries (CASCADE delete) |
| Guest -> RSVP | one-to-many | A guest has one RSVP per event (UNIQUE constraint) |
| Guest -> PotluckClaim | one-to-many | A guest can claim multiple dishes (CASCADE delete) |

### 4.4 Indexes

| Entity | Index | Fields | Reason |
|--------|-------|--------|--------|
| Recipe | rc_recipes_title_idx | title | Title search |
| Recipe | rc_recipes_favorite_idx | is_favorite (partial) | Favorite filtering |
| Recipe | rc_recipes_difficulty_idx | difficulty | Difficulty filtering |
| Recipe | rc_recipes_created_idx | created_at | Default sort order |
| Ingredient | rc_ingredients_recipe_idx | recipe_id | Ingredients by recipe |
| Step | rc_steps_recipe_idx | recipe_id | Steps by recipe |
| RecipeTag | rc_recipe_tags_recipe_idx | recipe_id | Tags by recipe |
| RecipeTag | rc_recipe_tags_tag_idx | tag | Recipes by tag |
| MealPlan | rc_meal_plans_week_idx | week_start_date | Week lookup |
| MealPlanItem | rc_meal_plan_items_plan_idx | meal_plan_id | Items by plan |
| MealPlanItem | rc_meal_plan_items_recipe_idx | recipe_id | Plans using recipe |
| GardenPlant | gd_plants_species_idx | species | Species search |
| GardenPlant | gd_plants_water_idx | last_watered_at | Watering schedule |
| PlantCareLog | gd_plant_care_logs_plant_idx | plant_id | Logs by plant |
| GardenJournal | gd_garden_journal_plant_idx | plant_id | Journal by plant |
| Harvest | gd_harvests_item_idx | item_name | Pantry/shopping list matching |
| Event | ev_events_date_idx | event_date | Event chronology |
| Guest | ev_guests_event_idx | event_id | Guests by event |
| RSVP | ev_rsvps_event_idx | event_id | RSVPs by event |
| MenuItem | ev_menu_items_event_idx | event_id | Menu by event |
| PotluckClaim | ev_potluck_event_idx | event_id | Claims by event |
| EventTimeline | ev_timeline_event_idx | event_id | Timeline by event |

### 4.5 Table Prefix

**MyLife hub table prefixes:**
- `rc_` - Recipe domain tables (recipes, ingredients, steps, tags, settings, meal plans)
- `gd_` - Garden domain tables (plants, care logs, layouts, journal, harvests, harvest-recipe links)
- `ev_` - Events domain tables (events, guests, RSVPs, menu items, potluck claims, timelines)

All table names in the SQLite database use these prefixes to avoid collisions with other modules in the MyLife hub. The `rc_` prefix is the module's primary prefix as declared in the ModuleDefinition.

### 4.6 Migration Strategy

- **Migration V1:** Creates recipe core tables (rc_recipes, rc_ingredients, rc_steps, rc_recipe_tags, rc_settings) with indexes and seed settings
- **Migration V2:** Creates MyGarden expansion tables (meal plans, garden, events) with indexes
- **Future Migration V3:** Will add cooking history, freezer inventory, pantry, and nutritional database tables
- Tables are created on module enable. Schema version is tracked in the module migrations system.
- Data from standalone MyRecipes app can be imported via the data importer (see RC-033)
- Destructive migrations (column removal) are deferred to major versions only

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Home | home | Home Dashboard | Overview with recent recipes, watering alerts, upcoming events |
| Recipes | book-open | Recipe List | Browse, search, and filter all recipes |
| Meal Planner | calendar | Meal Planner Calendar | Weekly meal planning with day/slot grid |
| Garden | leaf | Garden Dashboard | Plant inventory, watering status, layouts, journal |
| Events | users | Events List | Upcoming and past events with RSVP management |
| Settings | settings | Settings Screen | Preferences, import/export, data management |

### 5.2 Navigation Flow

```
[Tab 1: Home]
  +-- Recent Recipes section
  |     +-- Recipe Detail
  +-- Needs Water section
  |     +-- Plant Detail
  +-- Upcoming Events section
        +-- Event Detail

[Tab 2: Recipes]
  +-- Recipe List (search, filter)
  |     +-- Recipe Detail
  |     |     +-- Edit Recipe
  |     |     +-- Cooking Mode
  |     |     |     +-- Timer Bar
  |     |     |     +-- Ingredient Drawer
  |     |     |     +-- Completion / History Prompt
  |     |     +-- Scale Recipe (modal)
  |     |     +-- Nutrition Info (expandable)
  |     |     +-- Cooking History
  |     |     +-- Share Options
  |     |     +-- Print Preview
  |     +-- Add Recipe
  +-- Import from URL
  +-- Scan Recipe (OCR)
  +-- Import from App

[Tab 3: Meal Planner]
  +-- Weekly Calendar Grid
  |     +-- Recipe Picker (modal, per slot)
  +-- Shopping List
  |     +-- Item Detail (source recipes)
  +-- Pantry Tracker
  |     +-- Freezer Inventory
  +-- Suggestions ("What can I make?")

[Tab 4: Garden]
  +-- Plant Grid/List
  |     +-- Plant Detail
  |     |     +-- Care Log Timeline
  |     |     +-- Harvest List
  |     |     +-- Related Recipes
  |     |     +-- Journal Entries
  |     +-- Add Plant
  +-- Garden Layouts
  |     +-- Layout Editor
  +-- Garden Journal
  |     +-- Add Journal Entry
  +-- Harvest Log

[Tab 5: Events]
  +-- Events List (upcoming, past)
  |     +-- Event Detail
  |     |     +-- Edit Event
  |     |     +-- Guest List / RSVP Management
  |     |     +-- Menu Planning
  |     |     +-- Potluck Claims
  |     |     +-- Event Timeline
  |     |     +-- Allergy Warnings
  |     +-- Create Event
  +-- RSVP via Token (guest-facing)

[Tab 6: Settings]
  +-- General Preferences
  +-- Cooking Mode Settings
  +-- Notification Settings
  +-- Import/Export
  +-- Delete All Data (confirmation)
```

### 5.3 Screen Inventory

| Screen | Route/Path | Purpose | Entry Points |
|--------|-----------|---------|-------------|
| Home Dashboard | `/home` | Overview of recent activity and alerts | Tab bar, app launch |
| Recipe List | `/recipes` | Browse and search all recipes | Tab bar, back navigation |
| Recipe Detail | `/recipes/:id` | View full recipe with all metadata | Tap recipe card anywhere |
| Add Recipe | `/recipes/add` | Create a new recipe | FAB on recipe list, home |
| Edit Recipe | `/recipes/:id/edit` | Edit existing recipe | Edit button on detail |
| Cooking Mode | `/recipes/:id/cook` | Step-by-step cooking view | Cook button on detail |
| Import from URL | `/recipes/import-url` | Import recipe from web URL | Add menu, import screen |
| Scan Recipe | `/recipes/scan` | OCR import from photo | Add menu |
| Import from App | `/recipes/import-app` | Import from external app export | Settings, import screen |
| Meal Planner | `/meal-plan` | Weekly meal calendar | Tab bar |
| Shopping List | `/meal-plan/shopping` | Auto-generated grocery list | Button on meal planner |
| Pantry Tracker | `/meal-plan/pantry` | Pantry inventory management | Meal planner sub-nav |
| Freezer Inventory | `/meal-plan/pantry/freezer` | Frozen item management | Pantry sub-section |
| Suggestions | `/meal-plan/suggestions` | AI recipe suggestions | Meal planner sub-nav |
| Garden Dashboard | `/garden` | Plant overview and watering status | Tab bar |
| Plant Detail | `/garden/plants/:id` | Individual plant info and care log | Tap plant card |
| Add Plant | `/garden/plants/add` | Create new plant record | FAB on garden |
| Garden Layout Editor | `/garden/layouts/:id` | Visual garden bed planner | Garden layouts list |
| Garden Journal | `/garden/journal` | Photo timeline of garden | Garden sub-nav |
| Harvest Log | `/garden/harvests` | All harvest records | Garden sub-nav |
| Events List | `/events` | Browse upcoming and past events | Tab bar |
| Event Detail | `/events/:id` | Full event info with guests, menu, timeline | Tap event card |
| Create Event | `/events/create` | Create new event | FAB on events |
| RSVP via Token | `/events/rsvp/:token` | Guest RSVP form | Shared invite link |
| Settings | `/settings` | App preferences and data management | Tab bar |

### 5.4 Deep Link Patterns

| Pattern | Target | Parameters |
|---------|--------|-----------|
| `mylife://recipes/:id` | Recipe Detail | id: UUID of the recipe |
| `mylife://recipes/add` | Add Recipe | None |
| `mylife://recipes/import?url=:url` | Import from URL (pre-filled) | url: web URL to import |
| `mylife://meal-plan` | Meal Planner | None |
| `mylife://garden/plants/:id` | Plant Detail | id: UUID of the plant |
| `mylife://events/:id` | Event Detail | id: UUID of the event |
| `mylife://events/rsvp/:token` | RSVP via Token | token: invite token string |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| Nutritional data sharing | Recipes | Nutrition | Recipes provide ingredient lists; Nutrition provides food composition database | On recipe view (nutritional calc) |
| Meal plan respects fasting | Recipes | Fast | Meal planner checks fasting windows before suggesting meal slots | On meal plan display |
| Garden harvest suggestions | Recipes (Garden) | Recipes | Harvest items trigger recipe suggestions | On harvest log |
| Grocery spending tracking | Recipes | Budget | Shopping list items can be sent to Budget for cost tracking | User-initiated export |
| Dietary pattern analysis | Recipes | Health | Meal plan nutritional data surfaces dietary patterns | On health module view |
| Event dietary collection | Recipes (Events) | RSVP | Guest dietary preferences collected during RSVP | On RSVP submission |

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| Recipe collection | Local SQLite | At rest (OS-level) | No | All recipes, ingredients, steps, tags |
| Meal plans | Local SQLite | At rest (OS-level) | No | Weekly meal assignments |
| Garden data | Local SQLite | At rest (OS-level) | No | Plants, care logs, layouts, harvests |
| Event data | Local SQLite | At rest (OS-level) | No | Events, guests, RSVPs, menus |
| Recipe photos | Local filesystem | At rest (OS-level) | No | User-captured photos |
| Garden journal photos | Local filesystem | At rest (OS-level) | No | Garden progress photos |
| User preferences | Local SQLite | No | No | Settings key-value pairs |
| Food composition database | Bundled asset | No | No | Read-only USDA-derived data |

### 7.2 Network Activity

| Activity | Purpose | Data Sent | Data Received | User Consent |
|----------|---------|-----------|--------------|-------------|
| Web recipe import | Fetch recipe from URL | URL only | HTML page content | Implicit (user initiates) |
| Video recipe import | Fetch video page metadata | URL only | HTML page content | Implicit (user initiates) |

### 7.3 Data That Never Leaves the Device

- All recipe data (titles, ingredients, steps, notes, ratings)
- Meal planning history and shopping lists
- Garden plant data, care logs, layouts, harvests
- Event details, guest lists, RSVP responses
- Cooking history and personal notes
- Pantry and freezer inventory
- User preferences and settings
- Recipe photos and garden journal photos
- OCR-processed text from paper recipes
- Voice command audio (processed on-device, never transmitted)
- Nutritional calculations (computed locally from bundled database)

### 7.4 User Data Ownership

- **Export:** Users can export all their data as JSON (complete database dump) or CSV (per-entity)
- **Delete:** Users can delete all module data from Settings (irreversible, with confirmation dialog requiring typed confirmation "DELETE")
- **Portability:** Export format is documented and human-readable
- **Selective Delete:** Users can delete individual recipes, plants, events without affecting other data

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| Invite token security | Tokens are randomly generated hex strings | Not cryptographically secure (convenience, not security-critical) |
| Data deletion confirmation | Two-step confirmation with typed input | Prevents accidental full data deletion |
| Photo storage | Stored in app sandbox | Not accessible to other apps |
| OCR processing | On-device only | No image data transmitted |
| Voice recognition | On-device only | No audio transmitted |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| Cooking Mode | Full-screen, step-by-step recipe view with screen wake lock and timer support |
| Garden-to-Table | Feature that links garden harvests to recipes that use those ingredients |
| Ingredient Parser | Algorithm that converts free-text ingredient strings (e.g., "2 1/2 cups flour") into structured quantity/unit/name fields |
| Invite Token | A randomly generated string shared with guests to RSVP to an event without requiring an account |
| Meal Slot | One of four daily meal types: breakfast, lunch, dinner, snack |
| Menu Item | A recipe assigned to an event's menu with a course type (appetizer, main, side, dessert, drink) |
| Module Definition | The contract that registers a module with the MyLife hub, defining its ID, name, migrations, navigation, and capabilities |
| OCR | Optical Character Recognition - converting photographed text into digital text |
| Pantry | User's on-hand ingredient inventory, used to deduct items from shopping lists |
| Potluck Claim | A guest's commitment to bring a specific dish to an event |
| Recipe Scaling | Multiplying all ingredient quantities by a factor to adjust serving size |
| RSVP | "Repondez s'il vous plait" - a guest's response to an event invitation (attending, maybe, declined) |
| Table Prefix | A short string (e.g., "rc_") prepended to all SQLite table names to avoid naming collisions in the shared MyLife hub database |
| Unit Conversion | Converting between measurement systems (US customary, metric) for volume, weight, and temperature |
| Week Start Date | The Monday of a given week, used as the canonical identifier for weekly meal plans |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | Claude (spec-myrecipes agent) | Initial specification covering 39 features across recipe management, meal planning, garden tracking, event hosting, and new capabilities |

---

## Appendix B: Open Questions

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | Should pantry have its own dedicated table or continue using gd_harvests? | Current implementation cross-references harvests as pantry items, but a dedicated pantry table would be more flexible for non-garden items | TBD | |
| 2 | Should the food composition database be shared with MyNutrition module? | Both modules need USDA nutritional data. Sharing avoids duplication but creates a cross-module dependency | TBD | |
| 3 | What is the maximum supported recipe collection size? | Performance testing needed for SQLite with 10,000+ recipes, especially for search and filtering | TBD | |
| 4 | Should event allergy warnings use the RC-014 allergen dictionary or direct string matching? | Current implementation uses direct string matching of guest allergy text against ingredient names. Dictionary approach would be more comprehensive but may produce more false positives | TBD | |
| 5 | Should voice commands work when the app is backgrounded? | Platform restrictions may prevent background audio processing. Cooking timers already handle background via notifications | TBD | |
| 6 | How should recipe sharing work between two MyRecipes users? | Options: JSON file transfer, QR code, local network discovery. Each has trade-offs for usability vs complexity | TBD | |

