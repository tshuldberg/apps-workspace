# MyNutrition - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** Claude (Spec Writer Agent)
> **Reviewer:** Trey

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyNutrition
- **Tagline:** "Know what you eat, own what you track"
- **Module ID:** `nutrition`
- **Feature ID Prefix:** NU
- **Table Prefix:** `nu_`
- **Tier:** Premium (MyLife Pro)
- **Accent Color:** #22C55E (green)
- **Icon:** Apple (nutrition/health symbol)

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Alex the Active | 22-35, exercises 4-5 days/week, tracks macros to optimize performance | Hit daily protein target, balance macros around workouts, track calorie surplus/deficit accurately |
| Maria the Mindful Eater | 28-45, health-conscious, wants to understand what she eats without obsessing | Log meals casually, see micronutrient gaps (iron, vitamin D), maintain awareness without calorie anxiety |
| Jordan the Weight Manager | 25-50, has a specific weight goal (loss or gain), needs calorie tracking | Set calorie deficit/surplus based on TDEE, track daily intake vs budget, see weekly trends and adherence |
| Priya the Parent | 30-45, cooks for a family, wants to ensure balanced nutrition for kids | Log family meals, check nutritional completeness of home-cooked recipes, plan nutrient-dense weekly menus |
| Sam the Scanner | 20-40, eats packaged foods frequently, hates manual data entry | Scan barcodes to log foods instantly, build a favorites list for repeat meals, copy yesterday's lunch to today |
| Dr. Chen the Data-Driven | 35-60, manages a health condition, shares nutrition reports with a clinician | Track specific micronutrients (sodium, potassium, vitamin K), export weekly reports, set medical dietary limits |

### 1.3 Core Value Proposition

MyNutrition is a comprehensive, privacy-first calorie and nutrient tracker that replaces MyFitnessPal ($80-100/yr), Lose It! ($40/yr), and Cronometer ($60/yr). It ships with the full USDA FoodData Central database (8,000+ common foods with 65+ nutrients per food), Open Food Facts barcode scanning (2.5M+ products), and on-device nutrition calculations. Users track calories, macronutrients, micronutrients, water intake, and custom foods entirely offline with zero accounts, zero analytics, and zero data breaches. Unlike every major competitor, MyNutrition never learns what you eat, never sells that data, and never requires a subscription to unlock basic features like barcode scanning or micronutrient views.

### 1.4 Competitive Landscape

| Competitor | Price | Strengths | Weaknesses | Our Differentiator |
|-----------|-------|-----------|------------|-------------------|
| MyFitnessPal | $80-100/yr | 14M food database, social features, wearable sync | 150M account data breach (2018), shares location data for ads, paywalls barcode scanning in some regions | All data on-device, no breach risk, barcode scanning always free |
| Lose It! | $40/yr | 32M food database, AI photo logging, clean UI | Cloud-required, ad-supported free tier, limited free micronutrients | Fully offline, no ads, full micronutrient tracking included |
| Cronometer | $60/yr | Best micronutrient tracking (84+ nutrients), research-grade USDA data | Cloud account required, limited free tier, niche audience | Same USDA data quality, fully offline, broader audience appeal |
| Yazio | $33/yr | Combined fasting + nutrition, meal plans | Cloud-required, limited free tier, no micronutrient depth | MyFast integration for fasting, deeper micronutrients, offline |
| Noom | $209/yr | Behavioral coaching, psychology-based approach | Extremely expensive, collects 50+ health questions, shares with third-party analytics | No psychology gatekeeping, no data collection, 40x cheaper as part of MyLife Pro |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All food logs, nutrition data, custom foods, goals, and body metrics are stored locally on the device in SQLite
- Zero analytics, zero telemetry, zero tracking
- No account required for any functionality
- Users own their data with full CSV/JSON export and delete capabilities
- No data ever leaves the device unless the user explicitly initiates an export
- The USDA FoodData Central database is bundled with the app (public domain, no network calls required)
- Barcode scanning queries a bundled subset of Open Food Facts (open-source, Creative Commons licensed); no scanned barcodes are transmitted to any server
- Food logs reveal medical conditions, eating disorders, religious practices, allergies, pregnancy status, and body image concerns. MyNutrition treats this data as among the most sensitive personal information a person can generate.
- Marketing angle: "MyFitnessPal lost 150 million accounts. MyNutrition cannot lose yours, because we never have them."

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| NU-001 | Food Logging | P0 | Core | None | Not Started |
| NU-002 | Food Database (USDA FoodData Central) | P0 | Core | None | Not Started |
| NU-003 | Barcode Scanning | P0 | Core | NU-002 | Not Started |
| NU-004 | Macronutrient Tracking | P0 | Core | NU-001 | Not Started |
| NU-005 | Daily Nutrition Dashboard | P0 | Core | NU-001, NU-004 | Not Started |
| NU-006 | Meal Categorization | P0 | Core | NU-001 | Not Started |
| NU-007 | Calorie and Macro Goals | P0 | Core | NU-004 | Not Started |
| NU-008 | BMR and TDEE Calculator | P0 | Core | NU-007 | Not Started |
| NU-009 | Food Search | P0 | Data Management | NU-002 | Not Started |
| NU-010 | Custom Food Creation | P1 | Data Management | NU-001 | Not Started |
| NU-011 | Recipe Nutrition Calculator | P1 | Core | NU-002, NU-010 | Not Started |
| NU-012 | Micronutrient Tracking | P1 | Analytics | NU-001, NU-002 | Not Started |
| NU-013 | Water Intake Tracking | P1 | Core | None | Not Started |
| NU-014 | Favorite Foods and Quick Add | P1 | Data Management | NU-001 | Not Started |
| NU-015 | Copy Meals Between Days | P1 | Core | NU-001, NU-006 | Not Started |
| NU-016 | Weekly Nutrition Reports | P1 | Analytics | NU-001, NU-004, NU-007 | Not Started |
| NU-017 | Streak Tracking | P1 | Analytics | NU-001 | Not Started |
| NU-018 | Calorie Deficit/Surplus Tracking | P1 | Analytics | NU-007, NU-008 | Not Started |
| NU-019 | Meal Planning | P1 | Core | NU-001, NU-006 | Not Started |
| NU-020 | Weight Goal Integration | P1 | Analytics | NU-008, NU-018 | Not Started |
| NU-021 | Nutrient Reports and Charts | P1 | Analytics | NU-004, NU-012 | Not Started |
| NU-022 | Food Diary Notes | P2 | Data Management | NU-001 | Not Started |
| NU-023 | CSV/JSON Export | P1 | Import/Export | NU-001 | Not Started |
| NU-024 | Data Import (MFP, Cronometer, Lose It!) | P2 | Import/Export | NU-001, NU-002 | Not Started |
| NU-025 | Settings and Preferences | P1 | Settings | None | Not Started |
| NU-026 | Onboarding Flow | P1 | Onboarding | NU-007, NU-008, NU-025 | Not Started |
| NU-027 | AI Photo Food Logging | P2 | Core | NU-001, NU-002 | Not Started |
| NU-028 | Restaurant Menu Database | P2 | Data Management | NU-002 | Not Started |
| NU-029 | Caffeine Tracking | P2 | Data Management | NU-013 | Not Started |
| NU-030 | Home Screen Widgets | P2 | Core | NU-005, NU-013 | Not Started |
| NU-031 | Apple Watch Quick-Log | P2 | Core | NU-001, NU-013, NU-014 | Not Started |

**Priority Legend:**
- **P0** - MVP must-have. The product does not launch without this.
- **P1** - High-value. Ship shortly after MVP or include if time allows.
- **P2** - Nice-to-have. Adds polish and delight but product is usable without it.
- **P3** - Future/low-priority. Planned for later phases or may be cut.

**Category Legend:**
- **Core** - Fundamental product functionality
- **Data Management** - CRUD operations, organization, search, custom data entry
- **Analytics** - Stats, reports, insights, visualizations, progress tracking
- **Import/Export** - Data portability (import from competitors, export user data)
- **Settings** - User preferences, configuration, customization
- **Onboarding** - First-run experience, tutorials, goal setup

---

## 3. Feature Specifications

### NU-001: Food Logging

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-001 |
| **Feature Name** | Food Logging |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As Alex the Active, I want to log every food I eat throughout the day, so that I can track my total calorie and macro intake against my performance goals.

**Secondary:**
> As Maria the Mindful Eater, I want to log meals casually without feeling pressured to be perfectly accurate, so that I can build nutritional awareness without obsessing over exact numbers.

**Tertiary:**
> As Sam the Scanner, I want to quickly add a food item I have eaten before, so that I can log my meals in under 10 seconds for frequently eaten foods.

#### 3.3 Detailed Description

Food Logging is the foundational feature of MyNutrition. Every other feature in the module depends on the ability to record what a user eats. A food log entry represents a single food item consumed at a specific time, in a specific quantity, assigned to a specific meal slot (breakfast, lunch, dinner, or snack).

Users create log entries by selecting a food from the database (NU-002), scanning a barcode (NU-003), choosing from favorites (NU-014), or creating a custom food on the fly (NU-010). Each log entry records the food reference, the serving size (quantity and unit), the meal slot, the date and time, and the resulting nutrition values. Nutrition values are computed at log time based on the food's per-serving nutrient profile multiplied by the quantity.

The food log is organized by date, with each date divided into meal slots. Users can view their log for any past date, edit serving sizes after the fact, move entries between meal slots, and delete entries. The log supports both precise tracking (weighed portions in grams) and casual tracking (estimated servings like "1 medium apple" or "1 cup cooked rice").

Unlike MyFitnessPal, which requires an internet connection to search its cloud food database, MyNutrition performs all food lookups and nutrition calculations locally. The food log is stored in SQLite and never transmitted to any server.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is the foundational feature)

**External Dependencies:**
- Local storage for SQLite database
- System clock for timestamping log entries

**Assumed Capabilities:**
- User can navigate between screens via tab bar or sidebar
- Local database is initialized and writable
- Module has been enabled in the MyLife hub

#### 3.5 User Interface Requirements

##### Screen: Daily Food Log

**Layout:**
- The screen header displays the current date with left/right arrow buttons to navigate between dates, and a calendar icon to jump to any date via a date picker
- Below the header, a calorie summary bar shows "X of Y kcal" with a horizontal progress bar (green when under goal, amber at 90-100%, red when over 100%)
- Below the calorie bar, a macro summary row displays three mini progress rings for protein, carbs, and fat (each showing grams consumed vs. goal)
- The main content area is a scrollable vertical list divided into four collapsible sections: Breakfast, Lunch, Dinner, Snacks
- Each section header shows the meal name, a meal subtotal in kcal, and an "Add Food" button (plus icon)
- Each food entry row displays: food name (primary text), serving size and unit (secondary text), and calorie count (right-aligned)
- Tapping a food entry opens the Food Entry Detail modal
- Swiping left on a food entry reveals a Delete button
- Long-pressing a food entry opens a context menu with options: Edit, Copy to Another Meal, Copy to Another Day, Move to Another Meal, Delete
- A floating action button labeled "+" at the bottom-right corner opens the Add Food flow (search screen)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty (first use) | No food entries exist for the current date | Illustration of an empty plate with message "No meals logged yet. Tap + to log your first food." and a prominent "Log Food" button |
| Empty (returning user) | No entries for a navigated-to date | Message "Nothing logged for [date]." with a "Log Food" button and a "Copy from Yesterday" button if the previous date has entries |
| Populated | One or more entries exist | Normal list view grouped by meal slots |
| Loading | Database query is executing | Skeleton placeholder rows in each meal section (max 300ms before showing) |
| Error | Database read fails | "Could not load your food log. Tap to retry." with a retry button |

**Interactions:**
- Tap date arrows: navigates to previous/next date, loads that date's log entries
- Tap calendar icon: opens date picker modal, selecting a date navigates to it
- Tap "Add Food" on a meal section: opens Add Food search screen with the meal slot pre-selected
- Tap food entry row: opens Food Entry Detail modal for editing
- Swipe left on food entry: reveals red "Delete" button; tapping it shows a confirmation toast "Deleted [food name]" with a 5-second "Undo" action
- Long press food entry: opens context menu (Edit, Copy to Meal, Copy to Day, Move to Meal, Delete)
- Tap floating "+" button: opens Add Food search screen with meal slot defaulting to the current time-based meal (before 10am = Breakfast, 10am-2pm = Lunch, 2pm-5pm = Snack, after 5pm = Dinner)
- Pull down: refreshes the date's data (useful after background import)
- Collapse/expand meal section: tapping a meal section header toggles its entries visible/hidden

**Transitions/Animations:**
- Date navigation animates with a horizontal slide (left for forward, right for backward), 200ms duration
- Deleting a food entry animates the row out with a fade + collapse, 250ms duration
- Adding a food entry animates the new row in with a fade + expand at the correct position, 200ms duration
- Meal section collapse/expand animates with a vertical accordion effect, 200ms duration

##### Modal: Food Entry Detail

**Layout:**
- Title bar shows the food name with a close button (X) on the left and a "Save" button on the right
- Below the title, a serving size section with a numeric input field for quantity (default 1), a unit picker dropdown (e.g., g, oz, cup, serving, piece), and the calculated calories for the current serving size updating in real time
- Below serving size, a full nutrition facts panel displaying: calories, total fat, saturated fat, trans fat, cholesterol, sodium, total carbohydrate, dietary fiber, total sugars, added sugars, protein, vitamin D, calcium, iron, potassium (matching the FDA Nutrition Facts label format)
- A "Meal" picker showing Breakfast, Lunch, Dinner, or Snacks with the current assignment highlighted
- A "Time" picker showing the logged time (defaults to current time, user can adjust)
- A "Delete Entry" button at the bottom in red

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| New entry | User is adding a new food | "Save" button is labeled "Add"; quantity defaults to 1 serving |
| Editing | User tapped an existing entry | "Save" button is labeled "Save"; fields pre-populated with current values |

**Interactions:**
- Changing quantity: recalculates all nutrition values in real time (nutrition = per_serving_value * quantity)
- Changing unit: recalculates quantity proportionally if unit conversion is possible (e.g., switching from "cup" to "g" converts using the food's gram weight per cup); if conversion is not possible, resets quantity to 1
- Tapping "Save"/"Add": validates inputs, saves entry, dismisses modal, returns to Daily Food Log with the entry visible
- Tapping "Delete Entry": shows confirmation dialog "Delete [food name] from [meal]?", on confirm deletes entry and dismisses modal
- Tapping close (X): if changes were made, shows "Discard changes?" confirmation; otherwise dismisses immediately

#### 3.6 Data Requirements

##### Entity: FoodLogEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique identifier for this log entry |
| food_id | string | Required, references Food.id or CustomFood.id | None | The food item that was consumed |
| food_source | enum | One of: usda, open_food_facts, custom, recipe | None | Which database the food came from |
| food_name | string | Required, max 500 chars | None | Denormalized food name for display without joins |
| date | string | Required, ISO 8601 date (YYYY-MM-DD) | Current date | The calendar date this entry belongs to |
| meal_slot | enum | One of: breakfast, lunch, dinner, snack | Auto (time-based) | Which meal this entry is assigned to |
| time_logged | datetime | ISO 8601 | Current timestamp | The time the food was consumed (user-adjustable) |
| quantity | float | Required, min: 0.01, max: 9999.99 | 1.0 | Number of servings or units consumed |
| serving_unit | string | Required, max 50 chars | "serving" | The unit of measurement (g, oz, cup, serving, piece, ml, etc.) |
| serving_weight_grams | float | Min: 0.01, max: 99999.0 | null | The gram equivalent of one serving unit (for conversion) |
| calories | float | Min: 0, max: 99999 | 0 | Total calories for this entry (computed: per_serving * quantity) |
| protein_g | float | Min: 0 | 0 | Total protein in grams |
| carbs_g | float | Min: 0 | 0 | Total carbohydrates in grams |
| fat_g | float | Min: 0 | 0 | Total fat in grams |
| fiber_g | float | Min: 0 | null | Dietary fiber in grams |
| sugar_g | float | Min: 0 | null | Total sugars in grams |
| sodium_mg | float | Min: 0 | null | Sodium in milligrams |
| cholesterol_mg | float | Min: 0 | null | Cholesterol in milligrams |
| saturated_fat_g | float | Min: 0 | null | Saturated fat in grams |
| trans_fat_g | float | Min: 0 | null | Trans fat in grams |
| notes | string | Max 1000 chars | null | Optional user notes about this entry |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- FoodLogEntry references Food or CustomFood via food_id + food_source
- FoodLogEntry belongs to a logical DailyLog grouped by date

**Indexes:**
- (date) - primary query: "show me all entries for this date"
- (date, meal_slot) - query: "show me breakfast entries for this date"
- (food_id) - query: "how often have I eaten this food?"
- (created_at) - query: "most recently logged entries" for undo/recent history

**Validation Rules:**
- food_id must reference an existing food record in one of the food tables
- quantity must be greater than 0
- date must be a valid calendar date and must not be more than 365 days in the future
- meal_slot must be one of the four valid values
- Nutrition values (calories, protein_g, carbs_g, fat_g) must be non-negative
- food_name must not be empty after trimming whitespace

**Example Data:**

```json
{
  "id": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "food_id": "usda-171688",
  "food_source": "usda",
  "food_name": "Chicken breast, roasted, skin not eaten",
  "date": "2026-03-06",
  "meal_slot": "lunch",
  "time_logged": "2026-03-06T12:30:00Z",
  "quantity": 1.5,
  "serving_unit": "serving",
  "serving_weight_grams": 140.0,
  "calories": 280.5,
  "protein_g": 53.1,
  "carbs_g": 0.0,
  "fat_g": 6.15,
  "fiber_g": 0.0,
  "sugar_g": 0.0,
  "sodium_mg": 108.0,
  "cholesterol_mg": 157.5,
  "saturated_fat_g": 1.65,
  "trans_fat_g": 0.0,
  "notes": null,
  "created_at": "2026-03-06T12:31:15Z",
  "updated_at": "2026-03-06T12:31:15Z"
}
```

#### 3.7 Business Logic Rules

##### Nutrition Calculation for Log Entry

**Purpose:** Compute the total nutrition values for a food log entry based on the food's per-serving nutrients and the user's quantity.

**Inputs:**
- food: Food - the food item with per-serving nutrient values
- quantity: float - the number of servings the user consumed
- serving_unit: string - the unit of measurement selected by the user

**Logic:**

```
1. LOOK UP the food's nutrient profile from the appropriate database (usda, open_food_facts, custom, recipe)
2. DETERMINE the gram weight of the user's selected serving unit:
   a. IF serving_unit matches one of the food's defined serving sizes, USE that serving's gram weight
   b. IF serving_unit is "g", the quantity IS the gram weight directly
   c. IF serving_unit is "oz", convert to grams: gram_weight = quantity * 28.3495
   d. IF serving_unit is "ml" and food has a density value, convert: gram_weight = quantity * density
3. COMPUTE scaling_factor = (quantity * serving_gram_weight) / food.reference_serving_grams
4. FOR EACH nutrient in the food's profile:
     entry_nutrient_value = food.per_serving_nutrient_value * scaling_factor
5. ROUND all nutrient values to 1 decimal place
6. RETURN computed nutrition values
```

**Formulas:**
- `entry_calories = food.calories_per_serving * scaling_factor`
- `entry_protein_g = food.protein_g_per_serving * scaling_factor`
- `entry_carbs_g = food.carbs_g_per_serving * scaling_factor`
- `entry_fat_g = food.fat_g_per_serving * scaling_factor`
- `calorie_cross_check = (entry_protein_g * 4) + (entry_carbs_g * 4) + (entry_fat_g * 9)`

**Edge Cases:**
- Quantity of 0 or negative: reject with validation error, do not save
- Food has no nutrient data for a specific field (e.g., fiber_g is null): store null, do not display as 0
- User enters extremely large quantity (e.g., 9999 servings): allow but show a confirmation warning "That is [X] calories. Is this correct?"
- Food has no gram weight for the selected serving unit: show error "Cannot convert to this unit for this food. Please select a different unit."
- Rounding: always round to 1 decimal place using round-half-up

##### Meal Slot Auto-Assignment

**Purpose:** Automatically assign a meal slot when the user does not explicitly choose one.

**Inputs:**
- current_time: datetime - the device's current local time

**Logic:**

```
1. EXTRACT hour from current_time in local timezone
2. IF hour >= 5 AND hour < 10 THEN meal_slot = "breakfast"
3. ELSE IF hour >= 10 AND hour < 14 THEN meal_slot = "lunch"
4. ELSE IF hour >= 14 AND hour < 17 THEN meal_slot = "snack"
5. ELSE IF hour >= 17 AND hour < 22 THEN meal_slot = "dinner"
6. ELSE meal_slot = "snack" (late night defaults to snack)
7. RETURN meal_slot
```

**Edge Cases:**
- Logging a meal for a past date: use the user-selected time, not the current time, for auto-assignment
- User overrides the auto-assigned meal: the override takes precedence and is saved

##### Daily Nutrition Totals

**Purpose:** Calculate the total nutrition consumed for a given date across all meal slots.

**Inputs:**
- date: string - the calendar date to summarize

**Logic:**

```
1. QUERY all FoodLogEntry records WHERE date = input_date
2. FOR EACH nutrient field (calories, protein_g, carbs_g, fat_g, etc.):
     daily_total = SUM of that field across all entries (skip null values)
3. FOR EACH meal_slot:
     meal_total = SUM of calories across entries in that meal slot
4. RETURN daily totals and per-meal totals
```

**Edge Cases:**
- No entries for the date: return all totals as 0
- All entries have null for a specific nutrient (e.g., fiber_g): return null for that daily total (not 0)
- Mix of null and non-null values for a nutrient: sum only the non-null values and annotate the total as "partial" (some entries may not have this nutrient)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails when saving entry | Toast: "Could not save food entry. Please try again." | User taps retry or entry is auto-retried on next save attempt |
| Food reference not found (orphaned food_id) | Entry displays food_name (denormalized) with a warning badge: "Original food data not found" | User can edit the entry manually or delete it |
| Quantity field left empty or zero | Inline validation: "Enter a quantity greater than 0" | User corrects the value; error clears on valid input |
| Date navigation to far-future date | Date picker limits selection to today + 7 days for logging | User selects a valid date |
| Serving unit conversion fails | Inline message: "Cannot convert between these units for this food" | User selects a different serving unit |
| Extremely large calorie total (>10,000 kcal in one entry) | Confirmation dialog: "This entry totals [X] calories. Continue?" | User confirms or corrects quantity |
| Database read fails on daily log load | Full-screen error: "Could not load your food log. Tap to retry." | User taps retry button |

**Validation Timing:**
- Quantity validation runs on input change (debounced 300ms)
- Serving unit validation runs on unit selection
- Form-level validation runs on Save/Add tap
- Cross-field validation (nutrition sanity check) runs on Save/Add tap

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is on the Daily Food Log screen for today,
   **When** they tap the "+" floating action button,
   **Then** the Add Food search screen opens with the meal slot pre-selected based on current time.

2. **Given** the user has selected a food from the search results,
   **When** they set quantity to 2 servings and tap "Add",
   **Then** the entry appears in the correct meal section with calories equal to 2x the per-serving calories, and the daily calorie total updates immediately.

3. **Given** the user has 3 food entries logged for lunch,
   **When** they swipe left on the second entry and tap "Delete",
   **Then** the entry is removed with an animation, the lunch and daily totals recalculate, and a toast with "Undo" appears for 5 seconds.

4. **Given** the user taps "Undo" on the delete toast within 5 seconds,
   **When** the undo completes,
   **Then** the deleted entry reappears in its original position and all totals recalculate to include it.

5. **Given** the user is viewing the food log for March 5,
   **When** they tap the right arrow to navigate to March 6,
   **Then** the screen slides left to show March 6's food log with its own entries and totals.

**Edge Cases:**

6. **Given** the user has no entries logged for the current date,
   **When** the Daily Food Log screen loads,
   **Then** an empty state illustration is shown with the message "No meals logged yet. Tap + to log your first food." and a "Log Food" button.

7. **Given** the user is viewing a past date that has no entries and the previous date has entries,
   **When** the empty state displays,
   **Then** a "Copy from Yesterday" button is visible alongside the "Log Food" button.

8. **Given** the user sets quantity to 0.001 (below minimum threshold of 0.01),
   **When** they attempt to save,
   **Then** the system shows "Enter a quantity of at least 0.01" and does not save.

**Negative Tests:**

9. **Given** the user is on the Food Entry Detail modal,
   **When** they clear the quantity field and tap Save,
   **Then** the system shows inline validation "Enter a quantity greater than 0"
   **And** no data is modified.

10. **Given** the user attempts to log a food entry with a date more than 365 days in the future,
    **When** they select the date in the date picker,
    **Then** dates beyond 365 days from today are disabled and cannot be selected
    **And** no entry is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates entry calories correctly for whole servings | food: 200 kcal/serving, quantity: 2 | calories: 400.0 |
| calculates entry calories correctly for fractional servings | food: 150 kcal/serving, quantity: 0.5 | calories: 75.0 |
| calculates entry calories with gram-based quantity | food: 165 kcal/100g, quantity: 250, unit: "g" | calories: 412.5 |
| auto-assigns breakfast for 7am | current_time: 07:00 | meal_slot: "breakfast" |
| auto-assigns lunch for 12pm | current_time: 12:00 | meal_slot: "lunch" |
| auto-assigns snack for 3pm | current_time: 15:00 | meal_slot: "snack" |
| auto-assigns dinner for 7pm | current_time: 19:00 | meal_slot: "dinner" |
| auto-assigns snack for midnight | current_time: 00:00 | meal_slot: "snack" |
| rejects quantity of zero | quantity: 0 | validation error: "Enter a quantity greater than 0" |
| rejects negative quantity | quantity: -1 | validation error: "Enter a quantity greater than 0" |
| handles null fiber_g in daily total | entries: [{fiber_g: 3}, {fiber_g: null}, {fiber_g: 2}] | daily_fiber_g: 5.0 (partial) |
| returns zero totals for date with no entries | date: "2026-01-01", entries: [] | all totals: 0 |
| rounds nutrient values to 1 decimal | food: 33.333 kcal/serving, quantity: 1 | calories: 33.3 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add food entry and verify daily totals | 1. Open daily log, 2. Add a 300 kcal food to lunch, 3. Check daily total | Daily total shows 300 kcal, lunch subtotal shows 300 kcal |
| Delete entry and verify totals recalculate | 1. Log has 500 kcal total (two entries: 200 + 300), 2. Delete the 200 kcal entry, 3. Check totals | Daily total shows 300 kcal |
| Edit serving size and verify recalculation | 1. Entry shows 1 serving (200 kcal), 2. Open detail, change to 1.5 servings, save, 3. Check entry | Entry shows 300 kcal, daily total updates accordingly |
| Copy entry to another meal slot | 1. Long press a breakfast entry, 2. Select "Copy to Lunch", 3. Check lunch section | Identical entry appears in lunch section, breakfast entry remains |
| Navigate between dates | 1. Log food on March 5, 2. Navigate to March 6, 3. Navigate back to March 5 | March 6 is empty or shows its own entries; March 5 still shows the logged food |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user logs their first meal | 1. Open app (empty state), 2. Tap "+", 3. Search "chicken breast", 4. Select result, 5. Set quantity to 1.5 servings, 6. Tap "Add" | Daily log shows 1 entry under the auto-assigned meal slot, calorie total reflects 1.5 servings of chicken breast, empty state is gone |
| User logs a full day of meals | 1. Add 3 breakfast items, 2. Add 2 lunch items, 3. Add 2 dinner items, 4. Add 1 snack | All 8 entries appear in correct meal sections, daily calorie total is the sum of all entries, macro rings show correct protein/carbs/fat totals |
| User corrects a mistake | 1. Log "Coca-Cola" under breakfast, 2. Realize it was diet, 3. Delete Coca-Cola, 4. Add "Diet Coke" instead | Daily log shows Diet Coke (0 kcal) where Coca-Cola was, totals recalculate to subtract regular Coca-Cola calories |

---

### NU-002: Food Database (USDA FoodData Central)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-002 |
| **Feature Name** | Food Database (USDA FoodData Central) |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As Alex the Active, I want to search a comprehensive food database with accurate nutrition data, so that I can log foods with confidence that the calorie and macro counts are correct.

**Secondary:**
> As Dr. Chen the Data-Driven, I want food entries with 65+ nutrient values including micronutrients, so that I can track specific nutrients my clinician has asked me to monitor.

**Tertiary:**
> As Priya the Parent, I want to search for common everyday foods like "chicken breast" or "brown rice" and immediately see nutrition per serving, so that I can quickly assess the nutritional value of family meals.

#### 3.3 Detailed Description

The Food Database is the nutritional backbone of MyNutrition. It provides accurate, research-grade nutrient data for thousands of common foods by bundling the USDA FoodData Central database directly into the app. This database is maintained by the United States Department of Agriculture and is public domain, meaning no licensing fees and no network calls required.

The bundled dataset focuses on the USDA "SR Legacy" and "Foundation Foods" subsets, which contain approximately 8,000 commonly consumed foods with comprehensive nutrient profiles (65+ nutrients per food including all vitamins, minerals, amino acids, and fatty acids). Each food includes one or more serving size definitions (e.g., "1 cup," "100g," "1 medium") with gram-weight equivalents, enabling accurate portion-based nutrition calculations.

The database is stored in a read-only SQLite database bundled with the app binary. This database is separate from the user's data database and is never modified at runtime. Updates to the food database are delivered via app updates. The separation ensures that the food reference data does not bloat the user's data file and cannot be corrupted by user operations.

Unlike competitors that rely on user-submitted food data (MyFitnessPal has millions of inaccurate user entries), MyNutrition uses only USDA-verified data for its core database. This eliminates the "garbage in, garbage out" problem that plagues community-sourced food databases.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is foundational data infrastructure)

**External Dependencies:**
- Bundled SQLite database file containing USDA FoodData Central data (included in app binary)
- Sufficient device storage for the bundled database (estimated 15-25 MB)

**Assumed Capabilities:**
- App can read a bundled read-only database file
- SQLite full-text search (FTS5) is available on the target platform

#### 3.5 User Interface Requirements

The Food Database does not have its own dedicated screen. It powers the food search experience (NU-009) and provides nutrient data to every feature that displays nutrition information. The UI requirements here cover the data display format used wherever food database information is shown.

##### Component: Nutrition Facts Panel

**Layout:**
- The panel follows the FDA Nutrition Facts label format for familiarity
- Header: "Nutrition Facts" in bold
- Serving size line: "[quantity] [unit] ([gram_weight]g)"
- Horizontal divider (thick)
- Calories line: "Calories" (left-aligned, bold) with value (right-aligned, large font)
- Horizontal divider (thick)
- "% Daily Value*" header (right-aligned, bold)
- Nutrient lines grouped by category:
  - Fat section: Total Fat, Saturated Fat (indented), Trans Fat (indented), Polyunsaturated Fat (indented), Monounsaturated Fat (indented)
  - Cholesterol
  - Sodium
  - Carbohydrate section: Total Carbohydrate, Dietary Fiber (indented), Total Sugars (indented), Added Sugars (indented 2x)
  - Protein
  - Horizontal divider (thin)
  - Micronutrients: Vitamin D, Calcium, Iron, Potassium (and any others available)
- Footer: "* % Daily Value based on a 2,000 calorie diet" (small text)
- Each nutrient line shows: nutrient name (left), amount with unit (center-right), % daily value (right)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Full data | All nutrient fields populated | Complete nutrition facts panel |
| Partial data | Some nutrient fields are null | Available nutrients shown; missing ones omitted (not shown as 0) |
| No data | Food has no nutrient data at all | Message: "Nutrition data not available for this food" |
| Loading | Nutrient data is being fetched from the bundled DB | Skeleton placeholder for the panel (max 200ms) |

**Interactions:**
- Tap on a nutrient line: expands an info tooltip explaining what the nutrient is and its daily recommended intake
- Scroll: panel is scrollable if it exceeds screen height
- Pinch-to-zoom: not applicable

##### Component: Serving Size Selector

**Layout:**
- A dropdown/picker listing all available serving sizes for the food
- Each option shows: "[description] ([gram_weight]g)" (e.g., "1 cup, chopped (130g)", "100g", "1 medium (118g)")
- The first option is the food's default serving size
- A "Custom" option at the bottom allows the user to enter a custom gram weight

**Interactions:**
- Selecting a serving size recalculates all displayed nutrition values proportionally
- Selecting "Custom" reveals a numeric input field for grams

#### 3.6 Data Requirements

##### Entity: Food (USDA)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| fdc_id | integer | Primary key (USDA's FDC ID) | None | USDA FoodData Central unique identifier |
| description | string | Required, max 500 chars | None | Food name/description (e.g., "Chicken, breast, roasted, skin not eaten") |
| food_category | string | Max 200 chars | null | USDA food category (e.g., "Poultry Products") |
| brand_owner | string | Max 200 chars | null | Brand name (for branded foods, otherwise null) |
| data_source | enum | One of: sr_legacy, foundation, branded | None | Which USDA dataset this food comes from |
| calories_per_100g | float | Min: 0 | 0 | Energy in kcal per 100 grams |
| protein_g_per_100g | float | Min: 0 | 0 | Protein in grams per 100 grams |
| carbs_g_per_100g | float | Min: 0 | 0 | Total carbohydrates in grams per 100 grams |
| fat_g_per_100g | float | Min: 0 | 0 | Total fat in grams per 100 grams |
| fiber_g_per_100g | float | Min: 0 | null | Dietary fiber in grams per 100 grams |
| sugar_g_per_100g | float | Min: 0 | null | Total sugars in grams per 100 grams |
| sodium_mg_per_100g | float | Min: 0 | null | Sodium in mg per 100 grams |
| cholesterol_mg_per_100g | float | Min: 0 | null | Cholesterol in mg per 100 grams |
| saturated_fat_g_per_100g | float | Min: 0 | null | Saturated fat in grams per 100 grams |
| trans_fat_g_per_100g | float | Min: 0 | null | Trans fat in grams per 100 grams |
| monounsaturated_fat_g_per_100g | float | Min: 0 | null | Monounsaturated fat in grams per 100 grams |
| polyunsaturated_fat_g_per_100g | float | Min: 0 | null | Polyunsaturated fat in grams per 100 grams |
| vitamin_a_mcg_per_100g | float | Min: 0 | null | Vitamin A in micrograms per 100 grams |
| vitamin_c_mg_per_100g | float | Min: 0 | null | Vitamin C in milligrams per 100 grams |
| vitamin_d_mcg_per_100g | float | Min: 0 | null | Vitamin D in micrograms per 100 grams |
| vitamin_e_mg_per_100g | float | Min: 0 | null | Vitamin E in milligrams per 100 grams |
| vitamin_k_mcg_per_100g | float | Min: 0 | null | Vitamin K in micrograms per 100 grams |
| vitamin_b6_mg_per_100g | float | Min: 0 | null | Vitamin B6 in milligrams per 100 grams |
| vitamin_b12_mcg_per_100g | float | Min: 0 | null | Vitamin B12 in micrograms per 100 grams |
| thiamin_mg_per_100g | float | Min: 0 | null | Thiamin (B1) in milligrams per 100 grams |
| riboflavin_mg_per_100g | float | Min: 0 | null | Riboflavin (B2) in milligrams per 100 grams |
| niacin_mg_per_100g | float | Min: 0 | null | Niacin (B3) in milligrams per 100 grams |
| folate_mcg_per_100g | float | Min: 0 | null | Folate in micrograms per 100 grams |
| calcium_mg_per_100g | float | Min: 0 | null | Calcium in milligrams per 100 grams |
| iron_mg_per_100g | float | Min: 0 | null | Iron in milligrams per 100 grams |
| magnesium_mg_per_100g | float | Min: 0 | null | Magnesium in milligrams per 100 grams |
| phosphorus_mg_per_100g | float | Min: 0 | null | Phosphorus in milligrams per 100 grams |
| potassium_mg_per_100g | float | Min: 0 | null | Potassium in milligrams per 100 grams |
| zinc_mg_per_100g | float | Min: 0 | null | Zinc in milligrams per 100 grams |
| copper_mg_per_100g | float | Min: 0 | null | Copper in milligrams per 100 grams |
| manganese_mg_per_100g | float | Min: 0 | null | Manganese in milligrams per 100 grams |
| selenium_mcg_per_100g | float | Min: 0 | null | Selenium in micrograms per 100 grams |
| caffeine_mg_per_100g | float | Min: 0 | null | Caffeine in milligrams per 100 grams |
| alcohol_g_per_100g | float | Min: 0 | null | Alcohol (ethanol) in grams per 100 grams |
| water_g_per_100g | float | Min: 0 | null | Water content in grams per 100 grams |
| search_keywords | string | Max 1000 chars | null | Space-separated keywords for FTS5 indexing (includes common aliases, abbreviations) |

##### Entity: FoodServing

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | integer | Primary key, auto-increment | Auto | Unique serving definition ID |
| fdc_id | integer | Required, references Food.fdc_id | None | The food this serving belongs to |
| description | string | Required, max 200 chars | None | Serving description (e.g., "1 cup, chopped", "1 medium", "1 tbsp") |
| gram_weight | float | Required, min: 0.1 | None | Gram equivalent of this serving |
| is_default | boolean | - | false | Whether this is the food's default serving size |
| sequence | integer | Min: 0 | 0 | Display order for serving options |

**Relationships:**
- Food has many FoodServing records (one-to-many via fdc_id)
- Food is referenced by FoodLogEntry via food_id when food_source = "usda"

**Indexes:**
- Food: FTS5 virtual table on (description, search_keywords, food_category) for full-text search
- Food: (food_category) for category browsing
- FoodServing: (fdc_id) for serving lookups
- FoodServing: (fdc_id, is_default) for quick default serving lookup

**Validation Rules:**
- All nutrient values per 100g must be non-negative
- calories_per_100g should approximately equal: (protein_g_per_100g * 4) + (carbs_g_per_100g * 4) + (fat_g_per_100g * 9) + (alcohol_g_per_100g * 7), within a 10% tolerance
- Every food must have at least one FoodServing record
- Exactly one FoodServing per food should have is_default = true

**Example Data:**

```json
{
  "fdc_id": 171688,
  "description": "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
  "food_category": "Poultry Products",
  "brand_owner": null,
  "data_source": "sr_legacy",
  "calories_per_100g": 165.0,
  "protein_g_per_100g": 31.02,
  "carbs_g_per_100g": 0.0,
  "fat_g_per_100g": 3.57,
  "fiber_g_per_100g": 0.0,
  "sugar_g_per_100g": 0.0,
  "sodium_mg_per_100g": 74.0,
  "cholesterol_mg_per_100g": 85.0,
  "saturated_fat_g_per_100g": 1.01,
  "vitamin_b6_mg_per_100g": 0.6,
  "vitamin_b12_mcg_per_100g": 0.34,
  "iron_mg_per_100g": 1.04,
  "potassium_mg_per_100g": 256.0,
  "zinc_mg_per_100g": 1.0,
  "selenium_mcg_per_100g": 27.6,
  "search_keywords": "chicken breast grilled baked boneless skinless poultry"
}
```

#### 3.7 Business Logic Rules

##### Nutrient Lookup by Serving

**Purpose:** Retrieve nutrient values for a food based on a specific serving size rather than per 100g.

**Inputs:**
- fdc_id: integer - the USDA food ID
- serving_id: integer - the selected serving definition (or null for default)
- quantity: float - the number of servings

**Logic:**

```
1. LOOK UP the Food record by fdc_id
2. IF serving_id is null, LOOK UP the FoodServing WHERE fdc_id = fdc_id AND is_default = true
   ELSE LOOK UP the FoodServing by serving_id
3. SET gram_weight = serving.gram_weight * quantity
4. SET scaling_factor = gram_weight / 100.0
5. FOR EACH nutrient field in Food:
     IF nutrient_per_100g is NOT null:
       result_nutrient = nutrient_per_100g * scaling_factor
       ROUND to 1 decimal place
     ELSE:
       result_nutrient = null
6. RETURN all computed nutrient values
```

**Edge Cases:**
- Food has no default serving: use the first FoodServing ordered by sequence
- No FoodServing records exist (data integrity issue): fall back to 100g as the serving
- scaling_factor is extremely large (>100): compute normally but flag for UI warning
- Nutrient value rounds to 0.0 but is not null: display as "< 0.1" rather than "0"

##### Percent Daily Value Calculation

**Purpose:** Compute the % Daily Value for a nutrient based on FDA reference daily intakes (2,000 calorie diet).

**Inputs:**
- nutrient_amount: float - the amount of the nutrient in the serving
- nutrient_type: string - which nutrient this is

**Logic:**

```
1. LOOK UP the daily reference value for nutrient_type from the FDA Daily Value table:
   - Total Fat: 78g
   - Saturated Fat: 20g
   - Cholesterol: 300mg
   - Sodium: 2300mg
   - Total Carbohydrate: 275g
   - Dietary Fiber: 28g
   - Added Sugars: 50g
   - Protein: 50g
   - Vitamin D: 20mcg
   - Calcium: 1300mg
   - Iron: 18mg
   - Potassium: 4700mg
   - Vitamin A: 900mcg RAE
   - Vitamin C: 90mg
   - Vitamin E: 15mg
   - Vitamin K: 120mcg
   - Thiamin: 1.2mg
   - Riboflavin: 1.3mg
   - Niacin: 16mg
   - Vitamin B6: 1.7mg
   - Folate: 400mcg DFE
   - Vitamin B12: 2.4mcg
   - Phosphorus: 1250mg
   - Magnesium: 420mg
   - Zinc: 11mg
   - Copper: 0.9mg
   - Manganese: 2.3mg
   - Selenium: 55mcg
2. IF daily_reference_value exists for nutrient_type:
     percent_dv = (nutrient_amount / daily_reference_value) * 100
     ROUND to nearest integer
3. ELSE:
     percent_dv = null (no DV established for this nutrient)
4. RETURN percent_dv
```

**Edge Cases:**
- nutrient_amount is 0: return 0%
- nutrient_amount is null: return null (do not display % DV)
- Percent exceeds 100%: display the actual percentage (e.g., "250%") with no cap
- Trans fat: FDA does not establish a Daily Value; always return null for % DV

##### FTS5 Search Ranking

**Purpose:** Rank food search results by relevance when the user types a query.

**Inputs:**
- query: string - the user's search text

**Logic:**

```
1. TOKENIZE query into individual words
2. RUN FTS5 MATCH query against the Food FTS5 table
3. RANK results using FTS5 bm25() function with column weights:
   - description: weight 10.0 (most important - this is the food name)
   - search_keywords: weight 5.0 (aliases and common names)
   - food_category: weight 2.0 (category matches are useful but less specific)
4. APPLY secondary sort: for equal BM25 scores, sort by data_source priority:
   - sr_legacy first (most commonly consumed foods)
   - foundation second (research-grade but less common)
   - branded last (specific products)
5. LIMIT results to 50 per query
6. RETURN ranked results
```

**Edge Cases:**
- Empty query: return no results (do not return all foods)
- Single character query: require minimum 2 characters before searching
- Query with no matches: return empty list with message "No foods found for [query]"
- Special characters in query: strip all non-alphanumeric characters except spaces and hyphens

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Bundled database file is missing or corrupted | Full-screen error: "Food database could not be loaded. Please reinstall the app." | User reinstalls the app to restore the bundled database |
| FTS5 search query causes a SQLite error | Toast: "Search failed. Try a different search term." | User modifies their search query |
| Food record found but all nutrient values are null | Nutrition Facts panel shows "Nutrition data not available for this food" | User can still log the food but with zero nutrition values, or choose a different food |
| Serving definition references a non-existent food | Serving is hidden from the UI; error logged internally | No user-facing impact; data integrity check at app startup can flag these |
| Database takes >500ms to return search results | Loading spinner appears after 200ms; if >2 seconds, show "Searching..." text | Results appear when ready; user can modify query to narrow results |

**Validation Timing:**
- Search query validation (minimum 2 characters) runs on input change
- Database integrity check runs once at app launch (background, non-blocking)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the app is installed and the food database is bundled,
   **When** the user searches for "chicken breast",
   **Then** results appear within 200ms showing USDA chicken breast entries with calories, protein, carbs, and fat per serving.

2. **Given** the user selects "Chicken, breast, roasted" from search results,
   **When** the nutrition facts panel loads,
   **Then** it displays all available nutrients in the FDA Nutrition Facts format with correct per-serving values and % Daily Values.

3. **Given** the user changes the serving size from "1 serving (140g)" to "100g",
   **When** the serving picker updates,
   **Then** all nutrient values recalculate proportionally (e.g., if calories were 231 for 140g, they become 165 for 100g).

**Edge Cases:**

4. **Given** the user searches for a food that exists in both SR Legacy and Foundation datasets,
   **When** results are displayed,
   **Then** the SR Legacy version appears first (higher ranking for common foods).

5. **Given** a food has null values for vitamin E and manganese but has values for all other nutrients,
   **When** the nutrition facts panel displays,
   **Then** vitamin E and manganese are omitted from the panel (not shown as 0).

**Negative Tests:**

6. **Given** the user types a single character "c" in the search bar,
   **When** the character is entered,
   **Then** no search is triggered and a hint appears: "Type at least 2 characters to search"
   **And** no database query is executed.

7. **Given** the bundled food database file has been corrupted,
   **When** the app attempts to open the database,
   **Then** a full-screen error message is shown: "Food database could not be loaded. Please reinstall the app."
   **And** food logging features are disabled.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates nutrients for default serving | fdc_id: 171688, serving: default (140g), quantity: 1 | calories: 231.0, protein_g: 43.4 |
| calculates nutrients for 100g serving | fdc_id: 171688, serving: 100g, quantity: 1 | calories: 165.0, protein_g: 31.0 |
| calculates nutrients for multiple servings | fdc_id: 171688, serving: default, quantity: 2 | calories: 462.0, protein_g: 86.9 |
| computes % DV for sodium correctly | sodium_mg: 460 | percent_dv: 20 |
| computes % DV for iron correctly | iron_mg: 3.6 | percent_dv: 20 |
| returns null % DV for trans fat | trans_fat_g: 2.0 | percent_dv: null |
| handles null nutrient gracefully | vitamin_e_per_100g: null, serving: 140g | vitamin_e: null (not 0) |
| strips special characters from search query | query: "chicken!! breast @#" | cleaned_query: "chicken breast" |
| rejects single-character search | query: "c" | error: minimum 2 characters |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Search and view food details | 1. Search "banana", 2. Select first result, 3. View nutrition panel | Nutrition panel shows complete data for banana with correct per-serving values |
| Change serving size and verify recalculation | 1. View food with default serving 100g, 2. Switch to "1 medium (118g)" | All nutrient values scale by factor of 1.18 |
| Verify FTS5 ranking with ambiguous query | 1. Search "apple" | "Apple, raw" appears before "Apple juice" which appears before "Apple, dried" |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User browses food database for meal prep | 1. Search "rice", 2. Compare "Brown rice" vs "White rice" nutrient panels, 3. Select brown rice, 4. Set serving to 2 cups | User sees complete nutrition for 2 cups of brown rice with all vitamins and minerals |

---

### NU-003: Barcode Scanning

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-003 |
| **Feature Name** | Barcode Scanning |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As Sam the Scanner, I want to scan the barcode on a packaged food item with my phone's camera, so that I can log it in under 5 seconds without manually typing anything.

**Secondary:**
> As Jordan the Weight Manager, I want scanned foods to automatically fill in all nutrition data, so that I can trust my calorie count without manually looking up every product.

**Tertiary:**
> As Priya the Parent, I want to scan a cereal box to quickly check its sugar content per serving, so that I can make better choices for my family at the grocery store.

#### 3.3 Detailed Description

Barcode Scanning allows users to point their device's camera at a product barcode (UPC, EAN-13, EAN-8) and instantly retrieve the product's nutrition information. This eliminates the most significant friction point in food logging: manual data entry. Users simply scan, confirm the serving size, and the food is logged.

The feature uses the Open Food Facts database, an open-source, community-maintained database containing nutrition data for over 2.5 million products worldwide. A curated subset of this database (focused on products available in the user's region) is bundled with the app to enable offline scanning. For products not found in the bundled subset, the app can optionally query the Open Food Facts API if the user has granted network permission and has connectivity.

When a barcode is scanned, the system looks up the product by its barcode number in the local database. If found, the product's nutrition data is displayed and the user can adjust the serving size and log it. If not found locally, the app offers to search Open Food Facts online (with user consent). If still not found, the user can manually create a custom food entry linked to that barcode for future scans.

Unlike MyFitnessPal which paywalls barcode scanning in some regions, MyNutrition makes barcode scanning free and unlimited on all platforms.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-002: Food Database - provides the nutrient data structure and Nutrition Facts panel component

**External Dependencies:**
- Device camera hardware
- Camera permission granted by the user
- Bundled Open Food Facts database subset (estimated 5-10 MB for top 200K products)
- Optional: network access for querying Open Food Facts API for products not in the bundled subset

**Assumed Capabilities:**
- Device has a rear-facing camera capable of autofocus
- Platform provides barcode detection APIs (Vision framework on iOS, ML Kit on Android, not applicable on web)

#### 3.5 User Interface Requirements

##### Screen: Barcode Scanner

**Layout:**
- Full-screen camera viewfinder with a semi-transparent overlay
- A rectangular scan region in the center of the viewfinder (approximately 70% width, 15% height) with animated corner brackets indicating where to aim the barcode
- Below the scan region, instructional text: "Point your camera at a barcode"
- At the top, a close button (X) and a flashlight toggle button
- At the bottom, a "Can't scan? Search manually" link that navigates to the food search screen (NU-009)
- When a barcode is detected, the scan region border turns green and a brief haptic feedback fires

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Scanning | Camera active, waiting for barcode | Viewfinder with animated scan region and instruction text |
| Detected | Barcode captured, looking up product | Scan region turns green, "Looking up product..." text replaces instruction |
| Found (local) | Product found in bundled database | Transitions to Product Preview sheet showing product name, brand, nutrition summary, and "Log Food" button |
| Found (online) | Product found via Open Food Facts API | Same as Found (local) with a small "Online" badge indicating the source |
| Not found | Barcode not in any database | Sheet showing "Product not found" with barcode number displayed, and two buttons: "Create Custom Food" and "Try Again" |
| Camera denied | User has not granted camera permission | Full-screen message: "Camera access is needed to scan barcodes" with a "Open Settings" button and a "Search manually instead" link |
| No camera | Device does not have a camera (web) | Message: "Barcode scanning requires a camera. Search for foods manually." with a text input for entering barcode numbers manually |

**Interactions:**
- Camera auto-detects barcodes continuously; no tap-to-capture required
- Tap flashlight icon: toggles the device's flash/torch on and off
- Tap close (X): dismisses the scanner and returns to the previous screen
- Tap "Can't scan? Search manually": navigates to food search screen
- On barcode detection: automatic lookup begins (no user action required)
- Tap "Log Food" on the Product Preview: opens the Food Entry Detail modal (from NU-001) with the product pre-filled
- Tap "Create Custom Food" on the Not Found sheet: opens custom food creation (NU-010) with the barcode pre-filled

**Transitions/Animations:**
- Camera viewfinder appears with a fade-in, 200ms
- Scan region corners pulse gently (breathing animation) while scanning
- On barcode detection, corners stop pulsing and briefly flash green, 150ms
- Product Preview sheet slides up from the bottom, 250ms

##### Sheet: Product Preview

**Layout:**
- Product name in bold (large text)
- Brand name below (secondary text, if available)
- Product image thumbnail (if available from Open Food Facts; otherwise a placeholder food icon)
- Compact nutrition summary: Calories, Protein, Carbs, Fat in a horizontal 4-column layout
- Serving size text: "Per [serving_description] ([gram_weight]g)"
- "View Full Nutrition" expandable section (shows the Nutrition Facts Panel from NU-002)
- "Log Food" primary button (full width)
- "Cancel" text button below

**Interactions:**
- Tap "Log Food": opens Food Entry Detail modal with this product pre-filled, serving defaulting to 1, meal slot auto-assigned
- Tap "View Full Nutrition": expands to show the full Nutrition Facts Panel
- Tap "Cancel": dismisses the sheet and returns to the scanner for another scan
- Swipe down: dismisses the sheet (same as Cancel)

#### 3.6 Data Requirements

##### Entity: BarcodeProduct

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| barcode | string | Primary key, max 20 chars | None | Product barcode (UPC, EAN-13, EAN-8) |
| product_name | string | Required, max 500 chars | None | Product name (e.g., "Kirkland Organic Peanut Butter") |
| brand | string | Max 200 chars | null | Brand name (e.g., "Kirkland Signature") |
| image_url | string | Max 500 chars | null | URL of product image from Open Food Facts (cached locally after first load) |
| serving_description | string | Max 200 chars | null | Default serving description (e.g., "2 tbsp (32g)") |
| serving_weight_grams | float | Min: 0.1 | null | Gram weight of the default serving |
| calories_per_serving | float | Min: 0 | 0 | Calories per serving |
| protein_g_per_serving | float | Min: 0 | 0 | Protein per serving in grams |
| carbs_g_per_serving | float | Min: 0 | 0 | Carbohydrates per serving in grams |
| fat_g_per_serving | float | Min: 0 | 0 | Fat per serving in grams |
| fiber_g_per_serving | float | Min: 0 | null | Fiber per serving in grams |
| sugar_g_per_serving | float | Min: 0 | null | Sugar per serving in grams |
| sodium_mg_per_serving | float | Min: 0 | null | Sodium per serving in milligrams |
| saturated_fat_g_per_serving | float | Min: 0 | null | Saturated fat per serving in grams |
| trans_fat_g_per_serving | float | Min: 0 | null | Trans fat per serving in grams |
| cholesterol_mg_per_serving | float | Min: 0 | null | Cholesterol per serving in milligrams |
| data_source | enum | One of: bundled, online, user_created | None | Where this product data came from |
| off_product_id | string | Max 50 chars | null | Open Food Facts internal product ID |
| last_verified | datetime | ISO 8601 | null | When the data was last verified against Open Food Facts |
| created_at | datetime | Auto-set | Current timestamp | When this record was created locally |
| updated_at | datetime | Auto-set | Current timestamp | When this record was last updated |

**Relationships:**
- BarcodeProduct is referenced by FoodLogEntry via food_id when food_source = "open_food_facts"
- BarcodeProduct can be linked to a CustomFood if the user creates one for a missing barcode

**Indexes:**
- (barcode) - primary lookup by scanned barcode
- (product_name) - search by name
- (brand) - filter by brand

**Validation Rules:**
- barcode must be a valid UPC (12 digits), EAN-13 (13 digits), or EAN-8 (8 digits) format
- product_name must not be empty after trimming
- Nutrition values must be non-negative
- At least calories_per_serving must be provided (other nutrients can be null)

**Example Data:**

```json
{
  "barcode": "0096619153404",
  "product_name": "Organic Creamy Peanut Butter",
  "brand": "Kirkland Signature",
  "image_url": "https://images.openfoodfacts.org/images/products/009/661/915/3404/front_en.5.400.jpg",
  "serving_description": "2 tbsp (32g)",
  "serving_weight_grams": 32.0,
  "calories_per_serving": 190.0,
  "protein_g_per_serving": 7.0,
  "carbs_g_per_serving": 7.0,
  "fat_g_per_serving": 16.0,
  "fiber_g_per_serving": 2.0,
  "sugar_g_per_serving": 1.0,
  "sodium_mg_per_serving": 0.0,
  "saturated_fat_g_per_serving": 2.5,
  "trans_fat_g_per_serving": 0.0,
  "cholesterol_mg_per_serving": 0.0,
  "data_source": "bundled",
  "off_product_id": "0096619153404",
  "last_verified": "2026-01-15T00:00:00Z",
  "created_at": "2026-01-15T00:00:00Z",
  "updated_at": "2026-01-15T00:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Barcode Lookup Pipeline

**Purpose:** Resolve a scanned barcode to a product with nutrition data, using a cascading lookup strategy.

**Inputs:**
- barcode: string - the scanned barcode number
- network_allowed: boolean - whether the user has granted permission for online lookups

**Logic:**

```
1. VALIDATE barcode format:
   a. STRIP any non-digit characters
   b. CHECK length: must be 8, 12, or 13 digits
   c. IF invalid, RETURN error: "Invalid barcode format"
2. LOOK UP barcode in local BarcodeProduct table
3. IF found locally:
   a. RETURN product data with source = "local"
4. IF NOT found locally AND network_allowed = true:
   a. QUERY Open Food Facts API: GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json
   b. IF API returns product with nutrition data:
      i. MAP API response to BarcodeProduct fields
      ii. SAVE product to local BarcodeProduct table (data_source = "online")
      iii. RETURN product data with source = "online"
   c. IF API returns product without nutrition data:
      i. RETURN partial product (name and brand only) with flag: "nutrition_incomplete"
   d. IF API request fails (timeout, error):
      i. RETURN error: "Could not look up product online. Check your connection."
5. IF NOT found locally AND network_allowed = false:
   a. RETURN not_found with message: "Product not found in local database. Enable online lookup in Settings to search more products."
6. IF NOT found anywhere:
   a. RETURN not_found with barcode number and option to create custom food
```

**Edge Cases:**
- Barcode has a leading zero that was stripped: pad to expected length
- Same product has both UPC-12 and EAN-13 barcodes (EAN-13 is UPC-12 with a leading 0): check both formats
- Open Food Facts API returns data in a different locale (e.g., French product names): use English fields if available, fall back to original language
- Product exists in Open Food Facts but has no nutrition data: treat as partial match, show name/brand but prompt user to add nutrition manually
- Rate limiting on Open Food Facts API: implement 1-second delay between consecutive API requests; if rate limited, show "Please wait a moment and try again"

##### Barcode Format Validation

**Purpose:** Validate that a scanned or manually entered barcode is a legitimate product barcode format.

**Inputs:**
- barcode: string - the raw barcode value

**Logic:**

```
1. STRIP all non-digit characters from barcode
2. CHECK length:
   a. 8 digits: EAN-8
   b. 12 digits: UPC-A
   c. 13 digits: EAN-13
   d. Any other length: INVALID
3. VALIDATE check digit:
   a. FOR UPC-A and EAN-13: compute check digit using standard algorithm
      - Sum odd-position digits, multiply by 3
      - Sum even-position digits
      - Total = odd_sum + even_sum
      - Check digit = (10 - (total % 10)) % 10
      - IF computed check digit does not match the last digit: INVALID
   b. FOR EAN-8: same algorithm but with 8 digits
4. IF valid, RETURN normalized barcode string
5. IF invalid, RETURN error with reason
```

**Edge Cases:**
- Barcode starts with leading zeros: preserve them (they are significant)
- Barcode contains letters or symbols: strip them but warn user if result is unexpected length
- Camera reads a QR code instead of a barcode: reject with message "QR codes are not supported. Please scan a product barcode (UPC or EAN)."

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Camera permission denied | Full-screen: "Camera access is needed to scan barcodes" with "Open Settings" button | User grants permission in device settings and returns to app |
| Camera permission not yet requested | System permission dialog appears on first scan attempt | User grants or denies; denial shows the denied state above |
| Barcode cannot be read (blurry, damaged) | After 10 seconds of no detection, show hint: "Try holding your phone closer or improving lighting" | User adjusts phone position; can also tap "Search manually" |
| Product not found in any database | Sheet: "Product not found" with barcode displayed and "Create Custom Food" / "Try Again" buttons | User creates custom food or tries scanning again |
| Open Food Facts API timeout (>5 seconds) | Toast: "Online lookup timed out. Try again or search manually." | User retries or uses manual search |
| Open Food Facts API returns malformed data | Treat as "not found" with option to create custom food | User creates custom food for this barcode |
| Flashlight not available on device | Flashlight toggle button is hidden | No recovery needed; feature gracefully absent |
| Multiple barcodes visible to camera | System reads the most prominent/centered barcode | If wrong barcode is captured, user can dismiss and rescan |

**Validation Timing:**
- Barcode format validation runs immediately on detection (before lookup)
- Network availability check runs before attempting API call

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has granted camera permission,
   **When** they open the barcode scanner and point the camera at a product barcode that exists in the bundled database,
   **Then** the barcode is detected within 2 seconds, the product name and nutrition summary appear in a bottom sheet, and a "Log Food" button is available.

2. **Given** the user has scanned a product and sees the Product Preview,
   **When** they tap "Log Food",
   **Then** the Food Entry Detail modal opens with the product's nutrition data pre-filled, serving size defaulting to 1 serving, and the meal slot auto-assigned based on current time.

3. **Given** the user has network access enabled and scans a barcode not in the bundled database,
   **When** the barcode is detected,
   **Then** the app queries Open Food Facts online, finds the product, displays it in the Product Preview, and saves it locally for future offline access.

**Edge Cases:**

4. **Given** the user scans a barcode for a product that has no nutrition data in Open Food Facts,
   **When** the partial product data is returned,
   **Then** the app shows the product name and brand with a message "Nutrition data not available" and offers "Add nutrition manually" which opens custom food creation with the barcode pre-filled.

5. **Given** the environment has very low lighting,
   **When** the user opens the scanner,
   **Then** the flashlight toggle is visible and functional; tapping it illuminates the barcode for easier scanning.

**Negative Tests:**

6. **Given** the user has not granted camera permission,
   **When** they attempt to open the barcode scanner,
   **Then** a message appears: "Camera access is needed to scan barcodes" with an "Open Settings" button
   **And** the camera is not activated.

7. **Given** the user scans a QR code instead of a product barcode,
   **When** the QR code is detected,
   **Then** the system ignores it and continues scanning for a valid barcode (UPC or EAN format)
   **And** no lookup is triggered.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| validates 12-digit UPC barcode | "041631000564" | valid: true, format: "UPC-A" |
| validates 13-digit EAN barcode | "5901234123457" | valid: true, format: "EAN-13" |
| validates 8-digit EAN barcode | "96385074" | valid: true, format: "EAN-8" |
| rejects 10-digit barcode | "1234567890" | valid: false, error: "Invalid barcode length" |
| rejects barcode with bad check digit | "041631000560" | valid: false, error: "Invalid check digit" |
| strips non-digit characters | "0-41631-00056-4" | cleaned: "041631000564", valid: true |
| UPC to EAN-13 conversion | UPC: "041631000564" | EAN-13: "0041631000564" |
| local lookup returns cached product | barcode: "0096619153404", exists in local DB | product found, source: "local" |
| online lookup caches result locally | barcode: "9999999999999", not in local DB, API returns data | product saved to local DB with data_source: "online" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Scan barcode and log food | 1. Open scanner, 2. Scan a known barcode, 3. Tap "Log Food", 4. Confirm serving, 5. Save | Food appears in daily log with correct nutrition from barcode database |
| Scan unknown barcode and create custom food | 1. Open scanner, 2. Scan unknown barcode, 3. Tap "Create Custom Food", 4. Fill in nutrition, 5. Save | Custom food is created with barcode linked; future scans of same barcode find this custom food |
| Offline scan of online-cached product | 1. Scan barcode while online (product cached), 2. Go offline, 3. Scan same barcode again | Product found from local cache, no network request needed |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User scans breakfast cereal | 1. Open app, 2. Tap "+", 3. Tap barcode icon, 4. Scan cereal box, 5. Adjust serving to 1.5, 6. Tap "Log Food" | Cereal appears under Breakfast with calories = 1.5x per-serving calories, daily total updates |

---

### NU-004: Macronutrient Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-004 |
| **Feature Name** | Macronutrient Tracking |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As Alex the Active, I want to see my daily protein, carbohydrate, and fat intake broken down by grams and percentages, so that I can ensure I am hitting my macro targets for muscle building and performance.

**Secondary:**
> As Jordan the Weight Manager, I want to see how my macros distribute across the day, so that I can adjust my eating patterns to stay within my target ratios.

**Tertiary:**
> As Dr. Chen the Data-Driven, I want to track my macro ratios over time, so that I can share macro adherence data with my dietitian.

#### 3.3 Detailed Description

Macronutrient Tracking provides real-time visibility into the user's daily intake of the three macronutrients: protein, carbohydrates, and fat. While calorie counting tells you how much you ate, macro tracking tells you the composition of what you ate. This distinction matters for athletes who need specific protein targets, people managing blood sugar who need to control carbohydrates, and anyone following a structured diet plan (keto, high-protein, balanced, etc.).

The feature displays macros in three formats: absolute grams consumed, percentage of total calories from each macro, and progress toward user-defined gram targets. The calorie contribution of each macro is calculated using the Atwater general factors: protein contributes 4 calories per gram, carbohydrates contribute 4 calories per gram, fat contributes 9 calories per gram, and alcohol contributes 7 calories per gram. These factors are used throughout the application whenever macro-to-calorie conversions are needed.

Macro data is computed from food log entries (NU-001). Every food in the USDA database (NU-002) and barcode database (NU-003) includes protein, carbohydrate, and fat values. When a user logs a food, the macro grams for that entry are stored alongside the calorie count. Daily macro totals are the sum of all entry-level macros for a given date.

The macro tracking display appears in the Daily Nutrition Dashboard (NU-005), in the Weekly Nutrition Reports (NU-016), and as a compact summary in the Daily Food Log (NU-001). This feature defines the data model and calculation logic; the display components are specified in their respective features.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-001: Food Logging - provides the food log entries that contain macro data

**External Dependencies:**
- None (all data is computed locally from food log entries)

**Assumed Capabilities:**
- Food log entries contain protein_g, carbs_g, and fat_g fields
- User's macro goals have been set (either via onboarding or goals feature)

#### 3.5 User Interface Requirements

##### Component: Macro Progress Rings

**Layout:**
- Three circular progress rings displayed in a horizontal row, evenly spaced
- Each ring shows: macro name (Protein / Carbs / Fat) above the ring, grams consumed inside the ring (large number), grams remaining below the ring in secondary text
- Ring fill color indicates the macro: Protein = blue, Carbs = amber/yellow, Fat = pink/red
- Ring fill percentage represents grams consumed / gram goal
- Below the three rings, a thin horizontal stacked bar shows the calorie percentage breakdown (% of total calories from each macro), color-coded to match the rings

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Under goal | Consumed < goal for this macro | Ring partially filled, remaining grams shown below |
| At goal | Consumed equals goal (within 2% tolerance) | Ring fully filled, "Goal reached" text replaces remaining grams, brief celebratory animation (ring pulse) |
| Over goal | Consumed > goal | Ring filled to 100% with an overflow indicator (ring border turns to warning color), "X g over" text in red replaces remaining grams |
| No goal set | User has not set a macro goal | Ring shows grams consumed with no fill animation, text below says "No goal set" |
| No data | No food logged for this date | All rings empty (0g) with target grams shown below |

**Interactions:**
- Tap a macro ring: expands a detail card below showing a per-meal breakdown for that macro (e.g., Breakfast: 20g protein, Lunch: 35g protein, Dinner: 40g protein, Snack: 5g protein)
- Tap the percentage bar: toggles between showing percentage view and gram view

**Transitions/Animations:**
- Rings animate their fill from 0 to current value when the screen loads, 500ms duration, ease-out curve
- When a new food is logged, the affected rings smoothly animate from the old value to the new value, 300ms duration

##### Component: Macro Percentage Bar

**Layout:**
- A single horizontal bar divided into colored segments representing the calorie contribution of each macro
- Protein segment (blue), Carbs segment (amber), Fat segment (pink/red), and optionally Alcohol segment (purple) if alcohol calories are present
- Below the bar, percentage labels for each segment: "P: 30% | C: 40% | F: 30%"
- The bar has a fixed width matching the parent container

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Balanced | All three macros contribute to total | Tri-color bar with percentage labels |
| Single-macro dominant | One macro is >70% of calories | That segment dominates the bar; others are thin slivers with percentages still shown |
| No data | No food logged | Empty gray bar with "No data" text |
| Includes alcohol | Alcohol calories are present | Fourth segment (purple) appears; percentages for all four shown |

#### 3.6 Data Requirements

Macronutrient tracking does not introduce new entities. It computes derived values from FoodLogEntry (defined in NU-001) and stores goal data in NutritionGoal (defined in NU-007). The key derived computations are:

##### Derived Data: Daily Macro Summary

| Field | Type | Computation | Description |
|-------|------|-------------|-------------|
| total_protein_g | float | SUM(food_log_entries.protein_g) WHERE date = target_date | Total protein consumed in grams |
| total_carbs_g | float | SUM(food_log_entries.carbs_g) WHERE date = target_date | Total carbohydrates consumed in grams |
| total_fat_g | float | SUM(food_log_entries.fat_g) WHERE date = target_date | Total fat consumed in grams |
| total_alcohol_g | float | SUM(food_log_entries.alcohol_g) WHERE date = target_date | Total alcohol consumed in grams (if tracked) |
| protein_calories | float | total_protein_g * 4 | Calories contributed by protein |
| carbs_calories | float | total_carbs_g * 4 | Calories contributed by carbohydrates |
| fat_calories | float | total_fat_g * 9 | Calories contributed by fat |
| alcohol_calories | float | total_alcohol_g * 7 | Calories contributed by alcohol |
| total_macro_calories | float | protein_calories + carbs_calories + fat_calories + alcohol_calories | Total calories from macros |
| protein_pct | float | (protein_calories / total_macro_calories) * 100 | Percentage of calories from protein |
| carbs_pct | float | (carbs_calories / total_macro_calories) * 100 | Percentage of calories from carbohydrates |
| fat_pct | float | (fat_calories / total_macro_calories) * 100 | Percentage of calories from fat |
| alcohol_pct | float | (alcohol_calories / total_macro_calories) * 100 | Percentage of calories from alcohol |

#### 3.7 Business Logic Rules

##### Macro Calorie Conversion (Atwater Factors)

**Purpose:** Convert macronutrient grams to their calorie equivalents using the standard Atwater general factors.

**Inputs:**
- protein_g: float - grams of protein
- carbs_g: float - grams of carbohydrates
- fat_g: float - grams of fat
- alcohol_g: float - grams of alcohol (optional, default 0)

**Logic:**

```
1. protein_calories = protein_g * 4
2. carbs_calories = carbs_g * 4
3. fat_calories = fat_g * 9
4. alcohol_calories = alcohol_g * 7
5. total_macro_calories = protein_calories + carbs_calories + fat_calories + alcohol_calories
6. IF total_macro_calories > 0:
     protein_pct = ROUND((protein_calories / total_macro_calories) * 100, 1)
     carbs_pct = ROUND((carbs_calories / total_macro_calories) * 100, 1)
     fat_pct = ROUND((fat_calories / total_macro_calories) * 100, 1)
     alcohol_pct = ROUND((alcohol_calories / total_macro_calories) * 100, 1)
     // Adjust largest percentage to ensure they sum to exactly 100%
     adjustment = 100.0 - (protein_pct + carbs_pct + fat_pct + alcohol_pct)
     ADD adjustment to the largest percentage
   ELSE:
     all percentages = 0
7. RETURN all values
```

**Formulas:**
- `protein_calories = protein_g * 4`
- `carbs_calories = carbs_g * 4`
- `fat_calories = fat_g * 9`
- `alcohol_calories = alcohol_g * 7`
- `macro_pct = (macro_calories / total_macro_calories) * 100`

**Edge Cases:**
- All macros are 0: return 0 for all percentages, do not divide by zero
- Only one macro has a value: that macro is 100%, others are 0%
- Macro calorie total differs from logged calorie total: display both but do not hide the discrepancy (some foods have calorie values that differ slightly from the Atwater calculation due to rounding or specific Atwater factors)
- Negative macro values (data error): treat as 0 for calculations, flag for review
- Alcohol present but not explicitly tracked: if a food has alcohol_g in its nutrient profile, include it in the percentage calculation

##### Macro Goal Progress

**Purpose:** Calculate how far the user is toward their daily macro gram targets.

**Inputs:**
- consumed_g: float - grams of the macro consumed so far today
- goal_g: float - the user's daily goal in grams for this macro

**Logic:**

```
1. IF goal_g is null or 0:
     RETURN { progress_pct: null, remaining_g: null, status: "no_goal" }
2. progress_pct = ROUND((consumed_g / goal_g) * 100, 0)
3. remaining_g = ROUND(goal_g - consumed_g, 1)
4. IF remaining_g < 0:
     status = "over"
     over_g = ABS(remaining_g)
   ELSE IF remaining_g <= goal_g * 0.02:
     status = "at_goal"
   ELSE:
     status = "under"
5. RETURN { progress_pct, remaining_g, status, over_g (if applicable) }
```

**Edge Cases:**
- consumed_g exceeds goal_g by more than 50%: progress_pct is capped at 100% for the ring display but actual percentage is tracked internally
- Goal is set to a very small value (e.g., 1g protein): progress is still calculated normally
- User has not eaten anything yet: progress is 0%, remaining equals goal

##### Per-Meal Macro Breakdown

**Purpose:** Show how macros are distributed across meal slots for a given day.

**Inputs:**
- date: string - the calendar date
- macro: string - which macro to break down (protein, carbs, fat)

**Logic:**

```
1. QUERY all FoodLogEntry records WHERE date = input_date
2. GROUP entries by meal_slot
3. FOR EACH meal_slot:
     meal_macro_total = SUM of the selected macro field across entries in that meal_slot
4. RETURN array of { meal_slot, macro_total_g } sorted by meal order (breakfast, lunch, dinner, snack)
```

**Edge Cases:**
- A meal slot has no entries: include it in the result with total = 0
- All entries are in one meal slot: other slots show 0g

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Macro goal not set | Ring shows consumed grams with no progress fill; "No goal set" text | Tapping "No goal set" navigates to goal setup (NU-007) |
| Food entry missing macro data (protein_g is null) | That entry contributes 0 to the macro total; a small warning icon appears on the entry in the food log | User can edit the entry to add macro values manually |
| Percentage calculation results in NaN | Display "0%" for all macros | Automatically resolved when user logs food |
| Macro totals disagree with calorie total by >15% | No user-facing alert (this is normal due to Atwater factor rounding in food databases) | None needed; discrepancy is expected and documented |

**Validation Timing:**
- Macro totals recalculate immediately when a food log entry is added, edited, or deleted
- Percentage calculations run on every macro total update

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has logged 3 meals today totaling 120g protein, 200g carbs, and 60g fat,
   **When** the macro progress rings display,
   **Then** each ring shows the correct gram value, and the percentage bar shows P: 28%, C: 47%, F: 25%.

2. **Given** the user's protein goal is 150g and they have consumed 120g,
   **When** the protein ring displays,
   **Then** it shows 80% fill, "120g" inside the ring, and "30g left" below.

3. **Given** the user taps on the protein ring,
   **When** the detail card expands,
   **Then** it shows a per-meal breakdown: Breakfast: 30g, Lunch: 45g, Dinner: 40g, Snack: 5g.

**Edge Cases:**

4. **Given** the user has consumed 160g protein against a 150g goal,
   **When** the protein ring displays,
   **Then** the ring is 100% filled with an overflow indicator, and "10g over" appears in red below.

5. **Given** the user has logged only fat (no protein or carbs) - a pure oil/butter entry,
   **When** the percentage bar displays,
   **Then** Fat shows 100%, Protein shows 0%, Carbs shows 0%.

6. **Given** the user has logged a beer with alcohol content,
   **When** the percentage bar displays,
   **Then** a fourth segment (Alcohol) appears in the bar with its percentage labeled.

**Negative Tests:**

7. **Given** no food has been logged today,
   **When** the macro display loads,
   **Then** all rings show 0g, all percentages show 0%, and no division-by-zero errors occur.

8. **Given** a food entry has null protein_g (data missing from source),
   **When** the daily protein total is calculated,
   **Then** that entry contributes 0g to the total and a warning icon appears on the entry in the food log.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates protein calories correctly | protein_g: 50 | protein_calories: 200 |
| calculates carb calories correctly | carbs_g: 100 | carbs_calories: 400 |
| calculates fat calories correctly | fat_g: 30 | fat_calories: 270 |
| calculates alcohol calories correctly | alcohol_g: 14 | alcohol_calories: 98 |
| computes macro percentages for balanced diet | P: 150g, C: 200g, F: 67g | P: 30.0%, C: 40.0%, F: 30.0% |
| percentages sum to exactly 100% | P: 33g, C: 33g, F: 33g | P + C + F = 100.0% (adjustment applied to largest) |
| handles zero total calories | P: 0, C: 0, F: 0 | all percentages: 0% |
| handles single macro only | P: 0, C: 0, F: 50g | F: 100%, P: 0%, C: 0% |
| goal progress under target | consumed: 80, goal: 100 | progress_pct: 80, remaining: 20, status: "under" |
| goal progress at target | consumed: 100, goal: 100 | progress_pct: 100, remaining: 0, status: "at_goal" |
| goal progress over target | consumed: 120, goal: 100 | progress_pct: 100 (capped), over_g: 20, status: "over" |
| goal progress with no goal | consumed: 50, goal: null | status: "no_goal" |
| per-meal breakdown sums correctly | breakfast: 30g, lunch: 40g, dinner: 35g, snack: 10g | total: 115g |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Log food and verify macro update | 1. Daily total shows P: 50g, 2. Log chicken breast (31g protein), 3. Check macro ring | Protein ring updates to show 81g |
| Delete food and verify macro recalculation | 1. Daily total shows P: 100g from 3 entries, 2. Delete entry with 30g protein | Protein ring updates to show 70g |
| Edit serving size and verify macro change | 1. Entry shows 1 serving (25g carbs), 2. Change to 2 servings | Carb ring increases by 25g |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User tracks macros for a full day | 1. Log breakfast (3 items), lunch (2 items), dinner (3 items), snack (1 item) | Macro rings show accurate totals matching the sum of all logged food macros; percentage bar correctly represents the calorie split |

---

### NU-005: Daily Nutrition Dashboard

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-005 |
| **Feature Name** | Daily Nutrition Dashboard |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As Jordan the Weight Manager, I want a single glanceable screen that shows my daily calorie intake, macro breakdown, and goal progress, so that I can quickly assess whether I am on track without navigating through multiple screens.

**Secondary:**
> As Maria the Mindful Eater, I want to see a nutritional overview of my day that highlights what I have eaten well and what nutrients I might be missing, so that I can make informed choices about my remaining meals.

**Tertiary:**
> As Sam the Scanner, I want a dashboard that shows my intake so far with a quick-add button, so that I can log and check my progress in a single workflow.

#### 3.3 Detailed Description

The Daily Nutrition Dashboard is the home screen of the MyNutrition module. It provides a comprehensive at-a-glance view of the user's nutritional intake for the current day (or any selected date). The dashboard aggregates data from all food log entries and presents it in a visually rich, easy-to-scan layout.

The dashboard is divided into sections: calorie progress (large central display), macronutrient rings (protein, carbs, fat), meal breakdown (what was eaten when), and optional sections for water intake (NU-013), micronutrient highlights (NU-012), and streak information (NU-017). The dashboard updates in real time as foods are logged, edited, or deleted.

The dashboard is the primary entry point when a user opens MyNutrition from the hub. It prioritizes speed and clarity: a user should be able to open the dashboard and understand their nutritional status for the day in under 3 seconds. No scrolling is required to see the core metrics (calories and macros); secondary information is below the fold.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-001: Food Logging - provides the log entries that populate the dashboard
- NU-004: Macronutrient Tracking - provides macro ring components and percentage bar

**External Dependencies:**
- None (all data is computed locally)

**Assumed Capabilities:**
- Module is enabled in MyLife hub
- Database is initialized and contains (or can compute) daily nutrition summaries

#### 3.5 User Interface Requirements

##### Screen: Dashboard (Home Tab)

**Layout:**
- **Header section:** Date display (e.g., "Thursday, March 6") with left/right arrows for date navigation and a calendar icon for date picker
- **Calorie section (above the fold):** A large circular progress ring in the center of the screen showing calories consumed vs. calorie goal. Inside the ring: consumed calories (large bold number), "/" separator, goal calories (smaller number), and "kcal" label. Below the ring: "X kcal remaining" or "X kcal over" text
- **Macro section:** Three smaller progress rings in a row below the calorie ring, one each for Protein, Carbs, Fat (as defined in NU-004 Macro Progress Rings component). Below the rings, the macro percentage bar
- **Meal summary section (below the fold, scrollable):** Four horizontal cards for Breakfast, Lunch, Dinner, Snacks. Each card shows: meal name, total calories for that meal, number of items logged, and a compact list of food names (max 3 visible, "+X more" if more exist). Each card has a "+" button to add food to that meal
- **Quick actions row:** A horizontal row of shortcut buttons: "Scan Barcode" (camera icon), "Quick Add" (lightning bolt icon), "Copy Yesterday" (copy icon), "Log Water" (water drop icon)
- **Nutrition highlights section (optional, shown if NU-012 enabled):** A horizontal scrollable row of nutrient cards showing notable nutrients: those significantly over DV (green badge "150% Vitamin C"), those significantly under DV (amber badge "12% Iron"), or those exactly at DV (blue badge)
- **Streak section (optional, shown if NU-017 enabled):** A small card showing current logging streak in days with a flame icon

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty (first use) | No food logged, no goals set | Simplified dashboard with onboarding prompts: "Set your goals" button above the calorie ring (which shows 0/0), "Log your first meal" call-to-action in the meal section, quick actions still visible |
| Empty (returning, goals set) | Goals set but no food logged today | Calorie ring shows "0 / [goal]" with full remaining; meal cards show "No foods logged" with "+" buttons |
| Partially logged | Some meals logged | Calorie ring fills proportionally; logged meals show food entries; unlogged meals show "No foods logged" |
| Fully logged | All meal slots have entries | Full calorie and macro rings; all meal cards populated |
| Over goal | Consumed > calorie goal | Calorie ring at 100% with red overflow indicator; text shows "X kcal over" in red |
| Loading | Data is being computed | Skeleton placeholders for ring and meal cards (max 200ms) |

**Interactions:**
- Tap calorie ring: navigates to detailed calorie breakdown screen showing per-meal calorie distribution, calorie trend for the past 7 days, and net calorie balance
- Tap a macro ring: expands per-meal macro breakdown (as defined in NU-004)
- Tap a meal card: navigates to the Daily Food Log (NU-001) scrolled to that meal section
- Tap "+" on a meal card: opens Add Food search with that meal slot pre-selected
- Tap "Scan Barcode": opens barcode scanner (NU-003)
- Tap "Quick Add": opens quick calorie entry dialog (enter a calorie number without selecting a specific food)
- Tap "Copy Yesterday": copies all food entries from the previous day to today (with confirmation)
- Tap "Log Water": opens water logging quick action (NU-013)
- Tap a nutrient highlight card: navigates to full micronutrient view (NU-012)
- Tap streak card: navigates to streak history (NU-017)
- Pull down: refreshes all dashboard data
- Date navigation: same as Daily Food Log date navigation

**Transitions/Animations:**
- Dashboard loads with a staggered fade-in: calorie ring first (0ms), macro rings (100ms delay), meal cards (200ms delay)
- Calorie and macro rings animate their fill on load, 500ms, ease-out
- When navigating dates, the entire dashboard content slides horizontally (200ms)

#### 3.6 Data Requirements

The dashboard does not introduce new persistent entities. It computes and displays derived data from:
- FoodLogEntry (NU-001): daily totals and per-meal breakdowns
- NutritionGoal (NU-007): calorie and macro targets
- WaterLogEntry (NU-013): daily water intake (if feature enabled)

##### Derived Data: Dashboard Summary

| Field | Type | Computation | Description |
|-------|------|-------------|-------------|
| date | string | User-selected or current date | The date being displayed |
| calories_consumed | float | SUM(FoodLogEntry.calories) WHERE date = target | Total calories consumed |
| calories_goal | float | From NutritionGoal | Daily calorie target |
| calories_remaining | float | calories_goal - calories_consumed | Calories left to consume (negative if over) |
| protein_g | float | SUM(FoodLogEntry.protein_g) WHERE date = target | Total protein grams |
| carbs_g | float | SUM(FoodLogEntry.carbs_g) WHERE date = target | Total carb grams |
| fat_g | float | SUM(FoodLogEntry.fat_g) WHERE date = target | Total fat grams |
| meals | array | GROUP FoodLogEntry BY meal_slot | Per-meal food lists with subtotals |
| water_ml | float | SUM(WaterLogEntry.amount_ml) WHERE date = target | Total water intake (if tracked) |
| streak_days | integer | Consecutive days with at least 1 food entry | Current logging streak |

#### 3.7 Business Logic Rules

##### Dashboard Data Aggregation

**Purpose:** Compute all values needed to render the dashboard for a given date.

**Inputs:**
- date: string - the target calendar date
- user_goals: NutritionGoal - the user's current goals

**Logic:**

```
1. QUERY all FoodLogEntry records WHERE date = target_date
2. COMPUTE calorie totals:
   calories_consumed = SUM(calories) across all entries
   calories_remaining = user_goals.calorie_goal - calories_consumed
3. COMPUTE macro totals (using NU-004 logic):
   protein_g = SUM(protein_g)
   carbs_g = SUM(carbs_g)
   fat_g = SUM(fat_g)
4. GROUP entries by meal_slot:
   FOR EACH meal_slot in (breakfast, lunch, dinner, snack):
     meal_entries = entries WHERE meal_slot = current_slot
     meal_calories = SUM(calories) for meal_entries
     meal_food_names = LIST of food_name from meal_entries (max 3 for display, with "+N more" count)
5. IF water tracking is enabled:
     QUERY WaterLogEntry records WHERE date = target_date
     water_ml = SUM(amount_ml)
6. COMPUTE streak (see Streak Calculation in NU-017)
7. RETURN dashboard_summary object
```

**Edge Cases:**
- No entries for the date: all totals are 0, meals show empty state
- Goals not set: display consumed values without progress rings (rings show raw numbers only)
- Date is in the future: show empty dashboard with no special messaging
- Database query takes >200ms: show skeleton loading state

##### Quick Calorie Entry

**Purpose:** Allow users to log a calorie amount without selecting a specific food (for fast approximate tracking).

**Inputs:**
- calories: integer - the calorie amount to log
- meal_slot: enum - which meal to add it to (optional, auto-assigned if omitted)
- label: string - optional description (e.g., "afternoon snack")

**Logic:**

```
1. VALIDATE calories: must be between 1 and 9999
2. IF meal_slot is not provided, auto-assign using Meal Slot Auto-Assignment logic (NU-001)
3. CREATE a FoodLogEntry with:
   food_id = "quick-add-[uuid]"
   food_source = "custom"
   food_name = label OR "Quick add: [calories] kcal"
   calories = input calories
   protein_g = 0 (unknown)
   carbs_g = 0 (unknown)
   fat_g = 0 (unknown)
   date = current date
   meal_slot = assigned meal
4. SAVE entry
5. REFRESH dashboard totals
```

**Edge Cases:**
- Calories = 0: reject with "Enter a calorie amount"
- Calories > 5000: show confirmation "That is [X] calories. Continue?"
- Quick add entries have unknown macros: they contribute to calorie total but not to macro totals; the macro percentage bar footnotes "Includes [X] kcal from quick adds (macros unknown)"

##### Copy Yesterday Logic

**Purpose:** Copy all food log entries from the previous day to today, enabling easy reuse for users with consistent eating patterns.

**Inputs:**
- source_date: string - the date to copy from (defaults to yesterday)
- target_date: string - the date to copy to (defaults to today)

**Logic:**

```
1. QUERY all FoodLogEntry records WHERE date = source_date
2. IF no entries found:
     RETURN error: "No food entries found for [source_date]"
3. IF target_date already has entries:
     SHOW confirmation: "Today already has [N] entries. Copy [M] entries from yesterday? They will be added to your existing entries."
4. FOR EACH entry in source entries:
     CREATE new FoodLogEntry with:
       - new unique id
       - same food_id, food_source, food_name
       - date = target_date
       - same meal_slot
       - time_logged = corresponding time today (same hour/minute, today's date)
       - same quantity, serving_unit, serving_weight_grams
       - same nutrition values
       - notes = null (do not copy notes)
5. SAVE all new entries
6. REFRESH dashboard
7. SHOW toast: "Copied [N] entries from [source_date]"
```

**Edge Cases:**
- Yesterday has no entries: show "Nothing to copy" message
- Today already has entries: add copied entries alongside existing ones (do not replace)
- Copying from a day with 20+ entries: still copy all; show count in confirmation

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Dashboard data query fails | Full-screen: "Could not load your dashboard. Tap to retry." | User taps retry button |
| Goals not configured | Dashboard shows consumed values but rings have no goal reference; "Set Goals" prompt appears | User taps "Set Goals" to navigate to NU-007 |
| Quick add with empty calorie field | Inline: "Enter a calorie amount" | User enters a valid number |
| Copy yesterday fails (no entries) | Toast: "No entries found for yesterday" | User can manually log or choose a different date to copy |
| Copy yesterday partially fails (some entries fail to copy) | Toast: "Copied [N] of [M] entries. [K] entries could not be copied." | Partial copy is saved; failed entries are skipped |

**Validation Timing:**
- Dashboard aggregation runs on screen load and after any food log change
- Quick add calorie validation runs on input change
- Copy yesterday validation runs before the copy operation begins

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has logged 1,200 kcal against a 2,000 kcal goal,
   **When** the dashboard loads,
   **Then** the calorie ring shows 60% fill with "1,200 / 2,000 kcal" inside and "800 kcal remaining" below.

2. **Given** the user taps "Quick Add" and enters 350 calories for a snack,
   **When** they confirm,
   **Then** a "Quick add: 350 kcal" entry appears under Snacks, the calorie ring updates, and the macro percentage bar adds a footnote about unknown macros.

3. **Given** yesterday the user logged 8 food entries,
   **When** they tap "Copy Yesterday" on today's empty dashboard and confirm,
   **Then** all 8 entries are copied to today with today's date, the dashboard populates fully, and a toast confirms "Copied 8 entries."

**Edge Cases:**

4. **Given** the user has consumed 2,300 kcal against a 2,000 kcal goal,
   **When** the dashboard loads,
   **Then** the calorie ring is at 100% with a red overflow indicator, and text shows "300 kcal over" in red.

5. **Given** the user has not set any goals and has logged 500 kcal,
   **When** the dashboard loads,
   **Then** the calorie ring shows "500 kcal" with no progress fill, and a "Set Goals" prompt appears near the ring.

6. **Given** the user navigates the dashboard to a date 30 days ago,
   **When** the dashboard loads for that date,
   **Then** the historical data displays correctly with the correct date shown in the header.

**Negative Tests:**

7. **Given** the database is empty (no entries, no goals),
   **When** the dashboard loads for the first time,
   **Then** the onboarding empty state is shown with "Set your goals" and "Log your first meal" prompts
   **And** no errors or crashes occur.

8. **Given** the user taps "Copy Yesterday" but yesterday has no entries,
   **When** the copy is attempted,
   **Then** a toast shows "No entries found for yesterday"
   **And** no entries are created for today.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| computes calorie remaining correctly | consumed: 1500, goal: 2000 | remaining: 500 |
| computes calorie over correctly | consumed: 2200, goal: 2000 | remaining: -200 |
| groups entries by meal slot | 5 entries across 3 meals | 3 meal groups with correct entry counts |
| quick add creates valid entry | calories: 350, meal: "snack" | FoodLogEntry with calories: 350, macros: 0 |
| quick add rejects zero calories | calories: 0 | validation error |
| copy yesterday creates new entries | source: 3 entries from yesterday | 3 new entries with today's date and new IDs |
| copy yesterday preserves nutrition | source entry: 200 kcal, 30g protein | copied entry: 200 kcal, 30g protein |
| copy yesterday does not copy notes | source entry: notes: "felt bloated" | copied entry: notes: null |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Dashboard updates after logging food | 1. Dashboard shows 0 kcal, 2. Log a 400 kcal food, 3. Return to dashboard | Calorie ring shows 400 kcal, meal section shows the food |
| Dashboard updates after deleting food | 1. Dashboard shows 800 kcal, 2. Delete a 300 kcal entry, 3. Dashboard refreshes | Calorie ring shows 500 kcal |
| Date navigation preserves state | 1. View today's dashboard, 2. Navigate to yesterday, 3. Navigate back to today | Today's data is still correct after round-trip navigation |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User checks morning progress | 1. Open MyNutrition, 2. Dashboard shows today, 3. See breakfast entries and calorie progress | Dashboard shows accurate calorie ring, macro rings, and breakfast meal card with logged foods |
| User copies yesterday's meals | 1. Open dashboard (empty today), 2. Tap "Copy Yesterday", 3. Confirm copy | All of yesterday's entries appear under today's meals, calorie and macro totals match yesterday's values |

---

### NU-006: Meal Categorization

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-006 |
| **Feature Name** | Meal Categorization |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As Priya the Parent, I want to organize my food entries into breakfast, lunch, dinner, and snacks, so that I can see what I ate at each meal and plan balanced nutrition throughout the day.

**Secondary:**
> As Alex the Active, I want to see per-meal calorie and macro breakdowns, so that I can optimize my pre-workout and post-workout nutrition timing.

**Tertiary:**
> As Maria the Mindful Eater, I want to move a food entry from one meal to another if I categorized it incorrectly, so that my log accurately reflects my eating pattern.

#### 3.3 Detailed Description

Meal Categorization organizes food log entries into four standard meal slots: Breakfast, Lunch, Dinner, and Snacks. This structure mirrors how people naturally think about their eating patterns and matches the conventions established by every major nutrition tracking app.

Each food log entry (NU-001) is assigned to exactly one meal slot. The assignment can be automatic (based on the time of day when the food is logged) or manual (the user selects a meal slot). Users can change the meal assignment after logging by moving entries between meal slots.

The meal categorization system provides the organizational structure that makes the Daily Food Log (NU-001) and Dashboard (NU-005) meaningful. Without meal categories, food entries would be an undifferentiated chronological list. With them, users can see their eating pattern through the day, identify which meals are heavy or light, and make informed decisions about what to eat next.

The four meal slots are fixed in the current version. Custom meal names (e.g., "Pre-Workout", "Second Breakfast", "Elevenses") are not supported in the MVP but are a candidate for a future enhancement.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-001: Food Logging - meal_slot is a field on FoodLogEntry

**External Dependencies:**
- System clock for time-based auto-assignment

**Assumed Capabilities:**
- FoodLogEntry entity includes the meal_slot field

#### 3.5 User Interface Requirements

##### Component: Meal Slot Picker

**Layout:**
- A horizontal row of four buttons: Breakfast, Lunch, Dinner, Snack
- Each button shows an icon (sun rising for breakfast, sun for lunch, moon for dinner, cookie for snack) and the meal name
- The currently selected meal slot is highlighted with a filled background; others are outlined
- Appears in the Food Entry Detail modal (NU-001) and the Add Food flow

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Auto-assigned | Meal was determined by time of day | Selected button is highlighted; a small "auto" badge appears |
| User-selected | User explicitly chose a meal | Selected button is highlighted; no badge |
| Required | Form cannot be submitted without a meal selection | All buttons are outlined; if user tries to submit, a hint appears: "Select a meal" |

**Interactions:**
- Tap a meal button: selects that meal slot, deselects the previous one
- The selection persists until the user changes it or the entry is saved

##### Component: Meal Section Header (in Daily Food Log)

**Layout:**
- A horizontal bar spanning the full width with: meal icon (left), meal name (left-center, bold), calorie subtotal (right), expand/collapse chevron (far right), and "+" add button (right of calorie total)
- Background color is slightly tinted with the meal's color (warm yellow for breakfast, orange for lunch, indigo for dinner, green for snack)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Expanded, with entries | Meal has food entries and section is open | Header bar with entries listed below |
| Expanded, empty | Meal has no entries and section is open | Header bar with "No foods logged" message and "Add Food" link |
| Collapsed, with entries | Meal has entries but section is collapsed | Header bar only; entry count shown: "(3 items)" |
| Collapsed, empty | Meal is empty and section is collapsed | Header bar only; "(0 items)" shown |

**Interactions:**
- Tap header bar: toggles expand/collapse
- Tap "+" button: opens Add Food flow with this meal pre-selected
- Long press header bar: no action (reserved for future custom meal names)

#### 3.6 Data Requirements

Meal Categorization does not introduce new entities. The meal_slot field is defined on FoodLogEntry (NU-001). This feature defines the semantics and display behavior of that field.

##### Derived Data: Per-Meal Summary

| Field | Type | Computation | Description |
|-------|------|-------------|-------------|
| meal_slot | enum | Grouping key | breakfast, lunch, dinner, or snack |
| entry_count | integer | COUNT(FoodLogEntry) WHERE meal_slot = X AND date = target | Number of entries in this meal |
| meal_calories | float | SUM(FoodLogEntry.calories) WHERE meal_slot = X AND date = target | Total calories for this meal |
| meal_protein_g | float | SUM(FoodLogEntry.protein_g) WHERE meal_slot = X AND date = target | Total protein for this meal |
| meal_carbs_g | float | SUM(FoodLogEntry.carbs_g) WHERE meal_slot = X AND date = target | Total carbs for this meal |
| meal_fat_g | float | SUM(FoodLogEntry.fat_g) WHERE meal_slot = X AND date = target | Total fat for this meal |
| food_names | array | LIST(FoodLogEntry.food_name) WHERE meal_slot = X AND date = target, ordered by time_logged | Food names for display |

#### 3.7 Business Logic Rules

##### Move Entry Between Meals

**Purpose:** Allow users to reassign a food log entry from one meal slot to another.

**Inputs:**
- entry_id: string - the food log entry to move
- new_meal_slot: enum - the target meal slot

**Logic:**

```
1. LOOK UP FoodLogEntry by entry_id
2. IF entry not found, RETURN error: "Entry not found"
3. SET old_meal_slot = entry.meal_slot
4. IF new_meal_slot == old_meal_slot, RETURN (no change needed)
5. UPDATE entry.meal_slot = new_meal_slot
6. UPDATE entry.updated_at = current timestamp
7. REFRESH per-meal summaries for both old_meal_slot and new_meal_slot
8. RETURN success with old and new meal slots for undo support
```

**Edge Cases:**
- Moving to the same meal: no-op, no error
- Moving an entry that was just deleted (race condition): return "Entry not found" error
- Moving entries does not change their time_logged value (the time represents when the food was eaten, not which meal it belongs to)

##### Meal Time Ranges

**Purpose:** Define the default time ranges for each meal slot used in auto-assignment.

**Logic:**

```
Default meal time ranges (user's local timezone):
- Breakfast: 05:00 - 09:59
- Lunch:     10:00 - 13:59
- Snack:     14:00 - 16:59
- Dinner:    17:00 - 21:59
- Late night (22:00 - 04:59): defaults to Snack

These ranges are used only for auto-assignment. Users can override the assignment at any time.
Future enhancement: allow users to customize these time ranges in Settings (NU-025).
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Move operation fails (database error) | Toast: "Could not move entry. Please try again." | User retries the move |
| Entry not found during move | Toast: "This entry no longer exists" | Entry is removed from the UI |
| Meal section fails to load entries | Section shows "Could not load entries. Tap to retry." | User taps to retry |

**Validation Timing:**
- Meal slot validation runs immediately on selection
- Per-meal summary recalculates on any entry add, edit, delete, or move

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is adding a food entry at 7:30 AM,
   **When** the Add Food screen loads,
   **Then** the Breakfast meal slot is auto-selected and highlighted.

2. **Given** the user long-presses a food entry in the Breakfast section,
   **When** they select "Move to Lunch" from the context menu,
   **Then** the entry moves from Breakfast to Lunch, both meal subtotals recalculate, and a toast confirms the move.

3. **Given** the user has entries in Breakfast and Lunch but none in Dinner or Snacks,
   **When** the Daily Food Log displays,
   **Then** Breakfast and Lunch sections are expanded showing their entries, and Dinner and Snacks sections show "No foods logged" with "Add Food" links.

**Edge Cases:**

4. **Given** the user logs a food at 11:30 PM,
   **When** the meal slot auto-assigns,
   **Then** the food is assigned to Snacks (late night default).

5. **Given** the user moves all entries out of the Lunch section,
   **When** the last entry is moved,
   **Then** the Lunch section shows "No foods logged" and its calorie subtotal shows 0.

**Negative Tests:**

6. **Given** the user tries to move an entry to the same meal it is already in,
   **When** the move is attempted,
   **Then** no change occurs, no error is shown, and no toast appears.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| auto-assigns breakfast at 6am | hour: 6 | meal_slot: "breakfast" |
| auto-assigns lunch at 12pm | hour: 12 | meal_slot: "lunch" |
| auto-assigns snack at 3pm | hour: 15 | meal_slot: "snack" |
| auto-assigns dinner at 6pm | hour: 18 | meal_slot: "dinner" |
| auto-assigns snack at 11pm | hour: 23 | meal_slot: "snack" |
| auto-assigns snack at 2am | hour: 2 | meal_slot: "snack" |
| auto-assigns breakfast at 5am boundary | hour: 5 | meal_slot: "breakfast" |
| auto-assigns lunch at 10am boundary | hour: 10 | meal_slot: "lunch" |
| move entry updates meal_slot | entry.meal_slot: "breakfast", new: "lunch" | entry.meal_slot: "lunch" |
| move to same meal is no-op | entry.meal_slot: "lunch", new: "lunch" | no change, no error |
| per-meal calorie sum is correct | lunch entries: [200, 350, 150] | meal_calories: 700 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Move entry and verify subtotals | 1. Breakfast: 500 kcal (2 entries), Lunch: 300 kcal (1 entry), 2. Move 200 kcal entry from Breakfast to Lunch | Breakfast: 300 kcal, Lunch: 500 kcal, daily total unchanged |
| Add food to specific meal | 1. Tap "+" on Dinner section, 2. Select and log a food | Food appears under Dinner, not under auto-assigned meal |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User organizes a full day's meals | 1. Log 3 breakfast items (auto-assigned), 2. Log 2 lunch items (auto-assigned), 3. Move 1 breakfast item to Snacks, 4. Log 2 dinner items | Each meal section shows correct entries and subtotals; daily total is the sum of all meals |

---

### NU-007: Calorie and Macro Goals

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-007 |
| **Feature Name** | Calorie and Macro Goals |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As Jordan the Weight Manager, I want to set a daily calorie goal based on my weight loss objective, so that I have a clear target to stay under each day.

**Secondary:**
> As Alex the Active, I want to set specific gram targets for protein, carbs, and fat, so that I can follow my trainer's prescribed macro split.

**Tertiary:**
> As Maria the Mindful Eater, I want the app to suggest reasonable goals based on my body stats, so that I do not have to research how many calories I should eat.

#### 3.3 Detailed Description

Calorie and Macro Goals allow users to define their daily nutritional targets. These goals power the progress rings on the dashboard (NU-005), the calorie remaining calculations, and the deficit/surplus tracking (NU-018). Without goals, MyNutrition is a passive logger; with goals, it becomes an active coaching tool that tells users whether they are on track.

Users can set goals in two ways: manually (entering specific numbers) or automatically (using the BMR/TDEE calculator from NU-008 to determine a calorie target based on their body stats and objectives). For macros, users can set targets in grams directly or by percentage of total calories (e.g., 30% protein, 40% carbs, 30% fat), and the system converts percentages to gram targets based on the calorie goal.

Goals persist across days. The user sets them once and they remain active until changed. A history of goal changes is maintained so that analytics features can account for goal adjustments when calculating adherence over time.

Common preset macro splits are offered for convenience: Balanced (30/40/30), High Protein (40/30/30), Low Carb (30/20/50), Keto (20/5/75), and Custom. The user can start with a preset and customize from there.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-004: Macronutrient Tracking - goals require macro tracking to be meaningful

**External Dependencies:**
- None

**Assumed Capabilities:**
- User can navigate to a goal-setting screen from Settings or Dashboard

#### 3.5 User Interface Requirements

##### Screen: Goal Setup

**Layout:**
- **Calorie goal section:** A large numeric input showing the daily calorie target. Below it, two buttons: "Calculate for Me" (navigates to BMR/TDEE calculator, NU-008) and "Enter Manually". An info text explains: "Your daily calorie target is the number of calories you aim to consume each day."
- **Macro goal section:** Below the calorie goal, a section titled "Macronutrient Targets" with:
  - A toggle: "Set macros by" with options "Percentage" and "Grams"
  - If Percentage mode: three sliders (or numeric inputs) for Protein %, Carbs %, Fat %. A validation row shows whether they sum to 100%. Below, the computed gram targets are displayed: "= Xg protein, Yg carbs, Zg fat"
  - If Grams mode: three numeric input fields for Protein (g), Carbs (g), Fat (g). Below, the computed percentage split is displayed
  - Preset buttons row: Balanced, High Protein, Low Carb, Keto, Custom
- **Calorie distribution section (optional):** A collapsible "Advanced" section with per-meal calorie budgets. Default: Breakfast 25%, Lunch 35%, Dinner 30%, Snacks 10%. Users can adjust percentages or set specific calorie numbers per meal.
- **Save button:** Full-width primary button at the bottom

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| First setup | No goals exist yet | All fields empty with helpful placeholder text: "e.g., 2000" for calories, preset buttons visible |
| Editing | Goals already exist | Fields pre-populated with current goal values; "Save" button labeled "Update Goals" |
| Percentage mode | User is setting macros by percentage | Three percentage inputs with sum validation; gram equivalents shown below |
| Grams mode | User is setting macros by grams | Three gram inputs; percentage equivalents shown below |
| Invalid percentages | Macro percentages do not sum to 100% | Red warning: "Percentages must sum to 100% (currently [X]%)" and Save is disabled |
| Valid | All inputs valid | Save button is enabled |

**Interactions:**
- Tap "Calculate for Me": navigates to BMR/TDEE calculator (NU-008) which returns a suggested calorie target
- Tap a preset button (Balanced, etc.): fills in the macro percentages and computes gram targets from the current calorie goal
- Change calorie goal while in percentage mode: gram targets auto-recalculate
- Change a macro percentage: other percentages do NOT auto-adjust (user must balance them manually); sum validation updates in real time
- Tap "Save"/"Update Goals": validates all inputs, saves goals, shows toast "Goals saved", returns to previous screen
- Tap "Advanced" collapse toggle: expands/collapses the per-meal budget section

**Transitions/Animations:**
- Switching between Percentage and Grams mode animates the input fields with a crossfade, 200ms
- Preset button selection highlights with a scale-up animation, 150ms
- Invalid percentage warning fades in, 200ms

##### Modal: Goal Change Confirmation (when editing existing goals)

**Layout:**
- Title: "Update Your Goals?"
- Body text explaining the change: "Your calorie goal will change from [old] to [new] kcal. This affects your daily targets going forward."
- "Effective from" date picker (defaults to today)
- Two buttons: "Update" (primary) and "Cancel"

**Interactions:**
- Tap "Update": saves new goals with the effective date, preserving old goals in history
- Tap "Cancel": returns to the editing screen without saving

#### 3.6 Data Requirements

##### Entity: NutritionGoal

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto | Unique goal record ID |
| calorie_goal | integer | Required, min: 500, max: 10000 | None | Daily calorie target in kcal |
| protein_goal_g | float | Min: 0, max: 500 | null | Daily protein target in grams |
| carbs_goal_g | float | Min: 0, max: 1000 | null | Daily carbohydrate target in grams |
| fat_goal_g | float | Min: 0, max: 500 | null | Daily fat target in grams |
| protein_goal_pct | float | Min: 0, max: 100 | null | Protein as percentage of calories |
| carbs_goal_pct | float | Min: 0, max: 100 | null | Carbs as percentage of calories |
| fat_goal_pct | float | Min: 0, max: 100 | null | Fat as percentage of calories |
| macro_mode | enum | One of: percentage, grams | "percentage" | How the user defined their macro targets |
| preset | enum | One of: balanced, high_protein, low_carb, keto, custom | "balanced" | Which preset was used (or custom) |
| breakfast_pct | float | Min: 0, max: 100 | 25 | Percentage of daily calories for breakfast |
| lunch_pct | float | Min: 0, max: 100 | 35 | Percentage of daily calories for lunch |
| dinner_pct | float | Min: 0, max: 100 | 30 | Percentage of daily calories for dinner |
| snack_pct | float | Min: 0, max: 100 | 10 | Percentage of daily calories for snacks |
| effective_date | string | Required, ISO 8601 date | Current date | Date this goal becomes active |
| is_active | boolean | - | true | Whether this is the current active goal |
| source | enum | One of: manual, calculated, onboarding | "manual" | How this goal was created |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

**Relationships:**
- Only one NutritionGoal can have is_active = true at any time
- Previous goals are preserved for historical analytics (is_active = false)

**Indexes:**
- (is_active) - quick lookup of current goal
- (effective_date) - historical goal lookup for date-range analytics

**Validation Rules:**
- calorie_goal must be between 500 and 10,000
- If macro_mode is "percentage": protein_goal_pct + carbs_goal_pct + fat_goal_pct must equal 100 (within 0.5 tolerance for rounding)
- If macro_mode is "percentage": gram targets are computed from percentages and calorie_goal
- If macro_mode is "grams": percentage targets are computed from grams and calorie_goal
- breakfast_pct + lunch_pct + dinner_pct + snack_pct must equal 100 (within 0.5 tolerance)
- effective_date must not be in the future by more than 30 days

**Example Data:**

```json
{
  "id": "g1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "calorie_goal": 2000,
  "protein_goal_g": 150.0,
  "carbs_goal_g": 200.0,
  "fat_goal_g": 66.7,
  "protein_goal_pct": 30.0,
  "carbs_goal_pct": 40.0,
  "fat_goal_pct": 30.0,
  "macro_mode": "percentage",
  "preset": "balanced",
  "breakfast_pct": 25.0,
  "lunch_pct": 35.0,
  "dinner_pct": 30.0,
  "snack_pct": 10.0,
  "effective_date": "2026-03-01",
  "is_active": true,
  "source": "calculated",
  "created_at": "2026-03-01T09:00:00Z",
  "updated_at": "2026-03-01T09:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Percentage to Grams Conversion

**Purpose:** Convert macro percentage targets to gram targets based on the calorie goal.

**Inputs:**
- calorie_goal: integer - daily calorie target
- protein_pct: float - protein as percentage of total calories
- carbs_pct: float - carbs as percentage of total calories
- fat_pct: float - fat as percentage of total calories

**Logic:**

```
1. VALIDATE protein_pct + carbs_pct + fat_pct == 100 (within 0.5 tolerance)
2. protein_calories = calorie_goal * (protein_pct / 100)
3. carbs_calories = calorie_goal * (carbs_pct / 100)
4. fat_calories = calorie_goal * (fat_pct / 100)
5. protein_goal_g = ROUND(protein_calories / 4, 1)   // 4 cal/g for protein
6. carbs_goal_g = ROUND(carbs_calories / 4, 1)       // 4 cal/g for carbs
7. fat_goal_g = ROUND(fat_calories / 9, 1)            // 9 cal/g for fat
8. RETURN { protein_goal_g, carbs_goal_g, fat_goal_g }
```

**Formulas:**
- `protein_g = (calorie_goal * protein_pct / 100) / 4`
- `carbs_g = (calorie_goal * carbs_pct / 100) / 4`
- `fat_g = (calorie_goal * fat_pct / 100) / 9`

**Edge Cases:**
- Percentages sum to 99.5 or 100.5 due to rounding: accept and normalize to 100%
- Calorie goal is very low (500 kcal) with high protein %: gram target may seem unrealistic; show info note but do not block
- Calorie goal changes while in percentage mode: gram targets auto-recalculate silently

##### Grams to Percentage Conversion

**Purpose:** Compute the percentage split when users set macro goals in grams.

**Inputs:**
- calorie_goal: integer
- protein_g: float
- carbs_g: float
- fat_g: float

**Logic:**

```
1. protein_cal = protein_g * 4
2. carbs_cal = carbs_g * 4
3. fat_cal = fat_g * 9
4. total_macro_cal = protein_cal + carbs_cal + fat_cal
5. IF total_macro_cal == 0:
     all percentages = 0
     RETURN
6. protein_pct = ROUND((protein_cal / total_macro_cal) * 100, 1)
7. carbs_pct = ROUND((carbs_cal / total_macro_cal) * 100, 1)
8. fat_pct = ROUND((fat_cal / total_macro_cal) * 100, 1)
9. // Adjust for rounding to ensure sum = 100%
   adjustment = 100.0 - (protein_pct + carbs_pct + fat_pct)
   ADD adjustment to the largest percentage
10. // Note: total_macro_cal may differ from calorie_goal
    IF ABS(total_macro_cal - calorie_goal) > calorie_goal * 0.05:
      SHOW info: "Your macro gram targets total [total_macro_cal] kcal, which differs from your [calorie_goal] kcal goal by [diff] kcal."
11. RETURN { protein_pct, carbs_pct, fat_pct }
```

**Edge Cases:**
- Macro grams compute to more calories than the calorie goal: show informational note, do not block
- Macro grams compute to fewer calories than the calorie goal: show informational note
- All macro grams are 0: return 0% for all
- Only one macro is set (e.g., protein only): that macro is 100% of macro calories; note that total differs from calorie goal

##### Macro Preset Definitions

**Purpose:** Provide standard macro splits for common dietary approaches.

**Logic:**

```
Presets (protein% / carbs% / fat%):
- Balanced:     30 / 40 / 30
- High Protein: 40 / 30 / 30
- Low Carb:     30 / 20 / 50
- Keto:         20 / 5  / 75
- Custom:       user-defined (no preset values applied)
```

##### Goal History Management

**Purpose:** Maintain a history of goal changes for analytics.

**Inputs:**
- new_goal: NutritionGoal - the updated goal values
- effective_date: string - when the new goal takes effect

**Logic:**

```
1. FIND the current active goal (is_active = true)
2. SET current_goal.is_active = false
3. SET current_goal.updated_at = now
4. CREATE new_goal with:
   - is_active = true
   - effective_date = input effective_date
   - all goal values from input
5. SAVE both records
6. RETURN new_goal
```

**Edge Cases:**
- No previous goal exists (first-time setup): skip step 1-3, just create new goal
- Effective date is in the past: allow (user may be correcting a goal retroactively), but show confirmation
- Multiple rapid goal changes: each one creates a new record; no debouncing

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Calorie goal below 500 | Inline validation: "Minimum calorie goal is 500 kcal" | User increases the value |
| Calorie goal above 10,000 | Inline validation: "Maximum calorie goal is 10,000 kcal" | User decreases the value |
| Macro percentages do not sum to 100% | Red warning: "Percentages must sum to 100% (currently [X]%)" with Save disabled | User adjusts percentages |
| Macro grams imply calorie total >150% of calorie goal | Info note (not blocking): "Your macro targets total [X] kcal, which is [Y]% more than your calorie goal" | User can adjust or proceed |
| Meal distribution percentages do not sum to 100% | Warning: "Meal percentages must sum to 100%" | User adjusts percentages |
| Database save fails | Toast: "Could not save your goals. Please try again." | User taps retry |
| Calorie goal field left empty | Inline: "Enter a calorie goal" | User enters a value |

**Validation Timing:**
- Calorie goal validation runs on input change (debounced 300ms)
- Macro percentage sum validation runs on any percentage change
- Meal distribution sum validation runs on any percentage change
- Form-level validation runs on Save

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is on the Goal Setup screen for the first time,
   **When** they enter 2000 kcal as their calorie goal and select the "Balanced" preset,
   **Then** the macro percentages show 30/40/30 and the gram targets show 150g protein, 200g carbs, 66.7g fat.

2. **Given** the user changes the calorie goal from 2000 to 1800 while the "Balanced" preset is active,
   **When** the calorie field updates,
   **Then** the gram targets auto-recalculate to 135g protein, 180g carbs, 60g fat.

3. **Given** the user taps "Save" with valid goals,
   **When** the save completes,
   **Then** a toast shows "Goals saved", the dashboard (NU-005) now uses these goals for progress rings, and the user returns to the previous screen.

4. **Given** the user already has goals and edits them,
   **When** they save the updated goals,
   **Then** a confirmation shows the change (old vs. new), the previous goal is preserved in history with is_active = false, and the new goal is active.

**Edge Cases:**

5. **Given** the user sets macros in grams mode with values that total more calories than the calorie goal,
   **When** the grams are entered,
   **Then** an informational note appears: "Your macro targets total [X] kcal, which is [Y]% more than your 2000 kcal goal."

6. **Given** the user enters protein: 50%, carbs: 30%, fat: 15% (total: 95%),
   **When** the validation runs,
   **Then** a red warning appears: "Percentages must sum to 100% (currently 95%)" and the Save button is disabled.

**Negative Tests:**

7. **Given** the user enters a calorie goal of 200,
   **When** validation runs,
   **Then** the system shows "Minimum calorie goal is 500 kcal"
   **And** the Save button is disabled.

8. **Given** the user clears the calorie goal field and taps Save,
   **When** form validation runs,
   **Then** the system shows "Enter a calorie goal"
   **And** no data is saved.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| converts balanced preset to grams at 2000 kcal | cal: 2000, P: 30%, C: 40%, F: 30% | P: 150.0g, C: 200.0g, F: 66.7g |
| converts balanced preset to grams at 1500 kcal | cal: 1500, P: 30%, C: 40%, F: 30% | P: 112.5g, C: 150.0g, F: 50.0g |
| converts keto preset to grams at 2000 kcal | cal: 2000, P: 20%, C: 5%, F: 75% | P: 100.0g, C: 25.0g, F: 166.7g |
| converts grams to percentages | P: 150g, C: 200g, F: 67g | P: 30.0%, C: 40.0%, F: 30.0% (adjusted) |
| rejects percentages summing to 90% | P: 30%, C: 30%, F: 30% | error: sum is 90%, must be 100% |
| accepts percentages summing to 100.3% (rounding) | P: 33.4%, C: 33.4%, F: 33.5% | accepted, normalized to 100% |
| rejects calorie goal below 500 | calorie_goal: 400 | error: minimum 500 |
| rejects calorie goal above 10000 | calorie_goal: 11000 | error: maximum 10000 |
| deactivates old goal on update | old_goal.is_active: true | old_goal.is_active: false, new_goal.is_active: true |
| computes meal calorie budgets | cal: 2000, breakfast: 25%, lunch: 35%, dinner: 30%, snack: 10% | breakfast: 500, lunch: 700, dinner: 600, snack: 200 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Set goals and verify dashboard | 1. Set 2000 kcal goal with balanced macros, 2. Open dashboard | Calorie ring shows "0 / 2000 kcal", macro rings show gram targets |
| Update goals and verify history | 1. Set 2000 kcal goal, 2. Change to 1800 kcal goal, 3. Query goal history | Two goal records exist: old one inactive, new one active |
| Preset selection fills values correctly | 1. Enter 2500 kcal, 2. Tap "High Protein" preset | Percentages show 40/30/30, grams show P: 250g, C: 187.5g, F: 83.3g |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user completes goal setup | 1. Open MyNutrition first time, 2. Dashboard prompts "Set Goals", 3. Enter 2000 kcal, 4. Select Balanced, 5. Save | Dashboard shows calorie ring with 2000 target, macro rings with 150/200/67 gram targets, all at 0% progress |

---

### NU-008: BMR and TDEE Calculator

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-008 |
| **Feature Name** | BMR and TDEE Calculator |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As Jordan the Weight Manager, I want the app to calculate how many calories I burn each day based on my age, weight, height, and activity level, so that I can set a scientifically grounded calorie goal instead of guessing.

**Secondary:**
> As Alex the Active, I want to see my TDEE broken down by BMR and activity multiplier, so that I understand how my exercise frequency affects my daily calorie budget.

**Tertiary:**
> As Dr. Chen the Data-Driven, I want to calculate TDEE using the Mifflin-St Jeor equation, so that I have a clinically validated estimate to share with my healthcare provider.

#### 3.3 Detailed Description

The BMR and TDEE Calculator estimates the number of calories a user burns each day at rest (BMR - Basal Metabolic Rate) and in total including activity (TDEE - Total Daily Energy Expenditure). This calculation provides the scientific foundation for setting calorie goals in NU-007.

The calculator uses the Mifflin-St Jeor equation, which is the most widely recommended formula by the American Dietetic Association for estimating BMR. The formula accounts for sex, weight, height, and age. The user's BMR is then multiplied by an activity factor to produce the TDEE, which represents the total calories burned in a day including physical activity.

Users enter their body stats once during initial setup (or via the onboarding flow in NU-026) and can update them at any time from Settings. The calculator suggests a calorie goal based on the user's weight objective: maintenance (eat at TDEE), weight loss (eat below TDEE), or weight gain (eat above TDEE). Standard adjustments are offered: mild deficit/surplus (250 kcal/day, approximately 0.25 kg/week), moderate deficit/surplus (500 kcal/day, approximately 0.5 kg/week), and aggressive deficit/surplus (750 kcal/day, approximately 0.75 kg/week).

The calculator never sets goals automatically. It suggests a calorie target and the user must confirm before it is applied. This prevents confusion and ensures the user understands their target.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-007: Calorie and Macro Goals - the calculator's output feeds into goal setup

**External Dependencies:**
- None (pure mathematical computation)

**Assumed Capabilities:**
- User can enter body metrics (weight, height, age, sex)
- Unit conversion between imperial and metric is available

#### 3.5 User Interface Requirements

##### Screen: TDEE Calculator

**Layout:**
- **Body stats section:** Four input fields arranged in a form layout:
  - Sex: two toggle buttons ("Male" / "Female")
  - Age: numeric input with "years" label (range: 13-120)
  - Weight: numeric input with a unit toggle (kg / lbs). Default unit matches device locale (metric for most of the world, imperial for US)
  - Height: numeric input with unit toggle. In metric: single field in cm. In imperial: two fields for feet and inches
- **Activity level section:** Five selectable cards, each showing:
  - Activity level name (bold)
  - Description text (smaller)
  - Multiplier value in parentheses
  - The five levels are:
    - Sedentary: "Little or no exercise, desk job" (1.2)
    - Lightly Active: "Light exercise 1-3 days/week" (1.375)
    - Moderately Active: "Moderate exercise 3-5 days/week" (1.55)
    - Active: "Hard exercise 6-7 days/week" (1.725)
    - Very Active: "Very hard exercise, physical job, or training 2x/day" (1.9)
- **Results section (appears after inputs are complete):**
  - BMR value in large text: "Your BMR: X,XXX kcal/day"
  - TDEE value in large text: "Your TDEE: X,XXX kcal/day"
  - An explanation line: "This means you burn approximately X,XXX calories per day."
- **Goal suggestion section:**
  - Title: "Choose Your Objective"
  - Three option cards:
    - "Lose Weight" with sub-options: Mild (-250 kcal/day), Moderate (-500 kcal/day), Aggressive (-750 kcal/day)
    - "Maintain Weight" showing TDEE as the target
    - "Gain Weight" with sub-options: Mild (+250 kcal/day), Moderate (+500 kcal/day), Aggressive (+750 kcal/day)
  - Selected option shows the calculated calorie target in bold: "Suggested goal: X,XXX kcal/day"
  - Estimated weekly weight change: "Approximately X.XX kg/week" (or lbs/week if imperial)
- **Apply button:** "Set as My Calorie Goal" - full-width primary button. Disabled until the user selects an objective.

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Input incomplete | Not all body stats or activity level entered | Results section is hidden; form shows remaining required fields with placeholders |
| Calculating | All inputs provided | Results section appears with BMR and TDEE values; goal suggestion section appears below |
| Objective selected | User has chosen lose/maintain/gain | "Set as My Calorie Goal" button is enabled with the suggested calorie target shown |
| Previously saved | User returns to calculator with existing body stats | Fields are pre-populated with saved values; results show immediately |

**Interactions:**
- Enter/change any body stat: BMR and TDEE recalculate immediately (no submit button for calculation)
- Tap an activity level card: card is highlighted, TDEE recalculates
- Tap a weight objective (lose/maintain/gain): sub-options appear for that objective; tapping a sub-option updates the suggested calorie goal
- Toggle weight unit (kg/lbs): converts the current value between units; BMR recalculates
- Toggle height unit (cm / ft-in): converts the current value; BMR recalculates
- Tap "Set as My Calorie Goal": navigates to Goal Setup (NU-007) with the suggested calorie value pre-filled
- Tap back: returns to previous screen without applying changes

**Transitions/Animations:**
- Results section animates in with a slide-up + fade, 300ms, when all inputs are first completed
- Goal suggestion cards animate in with a staggered fade, 100ms delay between each
- Calorie target number animates (count up/down) when the objective changes, 200ms

#### 3.6 Data Requirements

##### Entity: UserBodyStats

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto | Unique record ID |
| sex | enum | One of: male, female | None | Biological sex for BMR calculation |
| age_years | integer | Required, min: 13, max: 120 | None | User's age in years |
| weight_kg | float | Required, min: 20.0, max: 350.0 | None | User's weight in kilograms |
| height_cm | float | Required, min: 100.0, max: 275.0 | None | User's height in centimeters |
| activity_level | enum | One of: sedentary, lightly_active, moderately_active, active, very_active | None | Self-reported physical activity level |
| preferred_weight_unit | enum | One of: kg, lbs | Device locale default | User's preferred weight display unit |
| preferred_height_unit | enum | One of: cm, ft_in | Device locale default | User's preferred height display unit |
| bmr_kcal | float | Computed, min: 0 | None | Calculated BMR in kcal/day |
| tdee_kcal | float | Computed, min: 0 | None | Calculated TDEE in kcal/day |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

**Relationships:**
- UserBodyStats is a singleton record (only one per user)
- UserBodyStats is referenced by NutritionGoal (NU-007) when source = "calculated"

**Indexes:**
- None needed (singleton record, queried by primary key or "get the only record")

**Validation Rules:**
- sex is required
- age_years must be between 13 and 120 (app is not for children under 13)
- weight_kg must be between 20.0 and 350.0 kg
- height_cm must be between 100.0 and 275.0 cm
- activity_level must be one of the five defined levels
- If the user enters weight in lbs, convert to kg before storing: kg = lbs / 2.20462
- If the user enters height in ft/in, convert to cm before storing: cm = (feet * 30.48) + (inches * 2.54)

**Example Data:**

```json
{
  "id": "bs-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "sex": "male",
  "age_years": 30,
  "weight_kg": 80.0,
  "height_cm": 178.0,
  "activity_level": "moderately_active",
  "preferred_weight_unit": "kg",
  "preferred_height_unit": "cm",
  "bmr_kcal": 1780.0,
  "tdee_kcal": 2759.0,
  "created_at": "2026-03-01T09:00:00Z",
  "updated_at": "2026-03-01T09:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Mifflin-St Jeor BMR Calculation

**Purpose:** Calculate the user's Basal Metabolic Rate using the Mifflin-St Jeor equation.

**Inputs:**
- sex: enum - male or female
- weight_kg: float - weight in kilograms
- height_cm: float - height in centimeters
- age_years: integer - age in years

**Logic:**

```
1. IF sex == "male":
     BMR = (10 * weight_kg) + (6.25 * height_cm) - (5 * age_years) + 5
2. IF sex == "female":
     BMR = (10 * weight_kg) + (6.25 * height_cm) - (5 * age_years) - 161
3. ROUND BMR to nearest integer
4. RETURN BMR
```

**Formulas:**
- Men: `BMR = 10 * weight_kg + 6.25 * height_cm - 5 * age_years + 5`
- Women: `BMR = 10 * weight_kg + 6.25 * height_cm - 5 * age_years - 161`

**Edge Cases:**
- Very low BMR (below 800 kcal): show informational note "Your calculated BMR is unusually low. If this does not seem right, double-check your inputs."
- Very high BMR (above 3000 kcal): show informational note "Your calculated BMR is unusually high."
- Age exactly 13: allow (minimum age)
- Age above 100: allow but show note "BMR estimates may be less accurate for ages above 80"

##### TDEE Calculation

**Purpose:** Calculate Total Daily Energy Expenditure from BMR and activity factor.

**Inputs:**
- bmr: float - Basal Metabolic Rate in kcal/day
- activity_level: enum - one of five levels

**Logic:**

```
1. LOOK UP activity_factor from activity_level:
   - sedentary: 1.2
   - lightly_active: 1.375
   - moderately_active: 1.55
   - active: 1.725
   - very_active: 1.9
2. TDEE = ROUND(bmr * activity_factor)
3. RETURN TDEE
```

**Formulas:**
- `TDEE = BMR * activity_factor`

**Edge Cases:**
- None significant; multiplication of validated inputs

##### Calorie Goal Suggestion

**Purpose:** Suggest a daily calorie target based on the user's TDEE and weight objective.

**Inputs:**
- tdee: integer - Total Daily Energy Expenditure
- objective: enum - lose, maintain, gain
- intensity: enum - mild, moderate, aggressive (not applicable for maintain)

**Logic:**

```
1. LOOK UP adjustment from objective + intensity:
   - lose + mild: -250
   - lose + moderate: -500
   - lose + aggressive: -750
   - maintain: 0
   - gain + mild: +250
   - gain + moderate: +500
   - gain + aggressive: +750
2. suggested_calories = tdee + adjustment
3. IF suggested_calories < 1200:
     suggested_calories = 1200
     SHOW warning: "We do not recommend eating below 1,200 kcal/day without medical supervision. Your calculated target was [original] kcal."
4. IF suggested_calories > 6000:
     SHOW warning: "Your calculated target exceeds 6,000 kcal/day. Please verify your inputs."
5. weekly_weight_change_kg = ABS(adjustment) * 7 / 7700
   // 7700 kcal approximately equals 1 kg of body weight
   ROUND to 2 decimal places
6. RETURN { suggested_calories, weekly_weight_change_kg, warning (if any) }
```

**Formulas:**
- `suggested_calories = TDEE + adjustment`
- `weekly_weight_change_kg = |adjustment| * 7 / 7700`
- `weekly_weight_change_lbs = weekly_weight_change_kg * 2.20462`

**Edge Cases:**
- TDEE minus aggressive deficit results in less than 1200 kcal: floor at 1200 with warning
- TDEE is already very low (e.g., sedentary elderly woman): maintenance may be below 1500; do not flag as warning, this is normal
- Gain + aggressive + very active TDEE could result in 5000+ kcal: allow but show informational note

##### Unit Conversion

**Purpose:** Convert between imperial and metric units for weight and height.

**Inputs:**
- value: float - the numeric value to convert
- from_unit: string - source unit
- to_unit: string - target unit

**Logic:**

```
Weight conversions:
- lbs to kg: value / 2.20462
- kg to lbs: value * 2.20462

Height conversions:
- ft_in to cm: (feet * 30.48) + (inches * 2.54)
- cm to ft_in:
    total_inches = value / 2.54
    feet = FLOOR(total_inches / 12)
    inches = ROUND(total_inches % 12, 1)

All conversions: ROUND to 1 decimal place
```

**Edge Cases:**
- Fractional inches (e.g., 5 ft 11.5 in): accept and convert precisely
- Zero inches component: display as "5 ft 0 in" not "5 ft"
- Conversion rounding: converting kg to lbs and back may not return the exact original value; this is acceptable

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Age below 13 | Inline: "You must be at least 13 years old to use this feature" | User enters a valid age |
| Weight outside valid range | Inline: "Enter a weight between 20 and 350 kg (44 and 772 lbs)" | User corrects the value |
| Height outside valid range | Inline: "Enter a height between 100 and 275 cm (3'3" and 9'0")" | User corrects the value |
| No activity level selected | "Select as My Calorie Goal" button remains disabled; hint below activity section: "Select your activity level" | User selects an activity level |
| Suggested calories below 1200 | Warning banner: "We do not recommend eating below 1,200 kcal/day without medical supervision." | User can still proceed or choose a less aggressive deficit |
| All fields empty and user taps back | No validation errors shown; changes are discarded | User can return later |
| Database save fails | Toast: "Could not save your body stats. Please try again." | User retries |

**Validation Timing:**
- Individual field validation runs on blur (when the user leaves the field)
- BMR/TDEE recalculates on every valid input change
- Activity level validation runs when user attempts to apply a goal

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user enters sex: male, age: 30, weight: 80 kg, height: 178 cm, activity: moderately active,
   **When** the calculator runs,
   **Then** BMR displays as 1,780 kcal/day and TDEE displays as 2,759 kcal/day.

2. **Given** the user selects "Lose Weight" with "Moderate" intensity,
   **When** the goal suggestion appears,
   **Then** the suggested calorie goal is 2,259 kcal/day with "Approximately 0.45 kg/week" weight loss estimate.

3. **Given** the user taps "Set as My Calorie Goal",
   **When** the action completes,
   **Then** the Goal Setup screen (NU-007) opens with 2,259 pre-filled as the calorie goal.

4. **Given** the user enters weight in lbs (176) and height in feet/inches (5'10"),
   **When** the calculator runs,
   **Then** the values are correctly converted to metric internally and the BMR/TDEE match the metric calculation.

**Edge Cases:**

5. **Given** a 65-year-old sedentary female weighing 55 kg at 160 cm,
   **When** the calculator runs with "Lose Weight - Aggressive",
   **Then** the suggested calorie is floored at 1,200 kcal with a warning about medical supervision, because TDEE (1,401) minus 750 would be 651 kcal.

6. **Given** the user toggles weight from kg to lbs,
   **When** their current weight of 80 kg is converted,
   **Then** the field updates to 176.4 lbs and the BMR does not change.

**Negative Tests:**

7. **Given** the user enters age as 10,
   **When** validation runs,
   **Then** the system shows "You must be at least 13 years old to use this feature"
   **And** no BMR is calculated.

8. **Given** the user has filled in all body stats but has not selected an activity level,
   **When** they attempt to tap "Set as My Calorie Goal",
   **Then** the button is disabled and a hint reads "Select your activity level"
   **And** no goal is set.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| BMR for 30yo male 80kg 178cm | sex: male, age: 30, wt: 80, ht: 178 | BMR: 1780 |
| BMR for 25yo female 60kg 165cm | sex: female, age: 25, wt: 60, ht: 165 | BMR: 1370 |
| BMR for 50yo male 100kg 185cm | sex: male, age: 50, wt: 100, ht: 185 | BMR: 1911 |
| BMR for 40yo female 70kg 170cm | sex: female, age: 40, wt: 70, ht: 170 | BMR: 1402 |
| TDEE with sedentary activity | BMR: 1780, activity: sedentary | TDEE: 2136 |
| TDEE with moderately active | BMR: 1780, activity: moderately_active | TDEE: 2759 |
| TDEE with very active | BMR: 1780, activity: very_active | TDEE: 3382 |
| calorie suggestion for moderate loss | TDEE: 2759, objective: lose, intensity: moderate | suggested: 2259 |
| calorie suggestion floored at 1200 | TDEE: 1400, objective: lose, intensity: aggressive | suggested: 1200 (with warning) |
| weekly weight change for 500 deficit | adjustment: -500 | weekly_change: 0.45 kg |
| lbs to kg conversion | 176 lbs | 79.8 kg |
| kg to lbs conversion | 80 kg | 176.4 lbs |
| ft-in to cm conversion | 5 ft 10 in | 177.8 cm |
| cm to ft-in conversion | 178 cm | 5 ft 10.1 in |
| rejects age below 13 | age: 10 | validation error |
| rejects weight below 20 kg | weight: 15 | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full calculator flow to goal | 1. Enter body stats, 2. Select activity, 3. Select objective, 4. Tap "Set as Goal", 5. Verify Goal Setup screen | Goal Setup has correct calorie pre-filled |
| Body stats persistence | 1. Enter stats and save, 2. Close calculator, 3. Reopen calculator | Fields are pre-populated with saved values |
| Unit toggle preserves value | 1. Enter 80 kg, 2. Toggle to lbs, 3. Toggle back to kg | Weight shows 80 kg (round-trip accuracy within 0.1) |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user calculates TDEE and sets goal | 1. Open onboarding, 2. Enter body stats (male, 28, 75 kg, 180 cm), 3. Select "Moderately Active", 4. Choose "Lose Weight - Moderate", 5. Tap "Set as Goal", 6. Save goal | Dashboard shows calorie ring with calculated deficit target, body stats are saved for future recalculation |

---

### NU-009: Food Search

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-009 |
| **Feature Name** | Food Search |
| **Priority** | P0 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As Sam the Scanner, I want to type a food name and see matching results instantly, so that I can find and log what I ate without scrolling through long lists.

**Secondary:**
> As Priya the Parent, I want search results to show calories and macros at a glance, so that I can compare similar foods quickly without opening each one.

**Tertiary:**
> As Alex the Active, I want to search my recently logged foods and favorites first, so that I can relog the same chicken breast I eat every day in 2 taps.

#### 3.3 Detailed Description

Food Search is the primary way users find foods to log. It provides a unified search experience across all food sources: the USDA database (NU-002), barcode products (NU-003), custom foods (NU-010), saved recipes (NU-011), and recently logged foods. The search interface is optimized for speed: results should begin appearing within 100ms of the user typing.

The search screen is the gateway to food logging. When a user taps "+" on the daily food log or dashboard, they land on this screen. It combines text-based search with a tabbed view of recent foods, favorites, and food categories for browsing. Results are ranked by relevance using FTS5 (for USDA foods) and recency/frequency (for personal foods).

The search also supports filter options: filter by food source (USDA, barcode, custom), filter by food category (Fruits, Vegetables, Meats, Dairy, Grains, etc.), and sort by relevance, calories, or protein content. These filters help users like Dr. Chen who want to compare specific types of foods.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-002: Food Database - provides the USDA food data to search

**External Dependencies:**
- FTS5 full-text search support in the local database

**Assumed Capabilities:**
- Database is initialized with the bundled USDA food data
- FTS5 virtual table is set up for food search

#### 3.5 User Interface Requirements

##### Screen: Food Search

**Layout:**
- **Search bar:** Prominent text input at the top of the screen with a magnifying glass icon, placeholder text "Search foods...", and a barcode scanner button on the right side of the search bar
- **Tab bar:** Below the search bar, a horizontal tab row with four tabs: "All", "Recent", "Favorites", "Custom"
- **Results list:** A scrollable vertical list below the tabs. Each result row shows:
  - Food name (primary text, bold)
  - Brand or category (secondary text, gray)
  - Calories per serving (right-aligned, prominent)
  - Macro summary below the food name: "P: Xg | C: Xg | F: Xg" in small text
  - Serving size description in small text: "per 1 serving (Xg)"
  - A source badge (small pill) indicating: "USDA", "Barcode", "Custom", or "Recipe"
- **Category browser (shown when search is empty and "All" tab selected):** A grid of category cards (Fruits, Vegetables, Meats and Poultry, Seafood, Dairy, Grains, Beverages, Snacks, etc.) each with a representative icon. Tapping a category filters the food list by that category.
- **Recently logged section (shown on "Recent" tab):** A list of the user's 50 most recently logged foods, sorted by most recent first. Each entry shows how many times the food has been logged and when it was last logged.

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Idle (no query) | Search bar is empty, "All" tab selected | Category browser grid is shown |
| Idle (Recent tab) | Search bar is empty, "Recent" tab selected | List of 50 most recently logged foods |
| Idle (Favorites tab) | Search bar is empty, "Favorites" tab selected | List of favorited foods, or empty state "No favorites yet. Tap the heart icon on any food to add it." |
| Idle (Custom tab) | Search bar is empty, "Custom" tab selected | List of user-created custom foods, or empty state with "Create Custom Food" button |
| Typing (< 2 chars) | User has typed 1 character | Hint text: "Type at least 2 characters to search" |
| Searching | User has typed 2+ characters | Search results appear, updating as the user types (debounced 150ms) |
| Results | Matching foods found | Scrollable list of matching foods, grouped by source |
| No results | No matches for the query | Message: "No foods found for '[query]'" with suggestions: "Try a different spelling" and "Create a custom food" link |
| Loading | Database query in progress | Skeleton rows (max 3) below the search bar |

**Interactions:**
- Type in search bar: results update after 150ms debounce; minimum 2 characters
- Tap a result: opens Food Entry Detail modal (NU-001) with the food pre-filled
- Tap barcode button: opens barcode scanner (NU-003)
- Tap a category card: filters results to that USDA food category
- Tap "Recent" tab: shows recently logged foods
- Tap "Favorites" tab: shows favorited foods
- Tap "Custom" tab: shows custom foods with a "Create Custom Food" button
- Tap heart icon on a result: toggles favorite status for that food
- Long press a result: shows options - "Add to Favorites", "View Nutrition Facts", "Copy to Clipboard"
- Tap "Create Custom Food" (on no-results or custom tab): navigates to custom food creation (NU-010)
- Swipe down on search bar: dismisses keyboard

**Transitions/Animations:**
- Results appear with a staggered fade-in, 50ms delay between each row, max 5 rows animated (rest appear instantly)
- Category grid cards animate in with a subtle scale-up, 100ms stagger
- Tab switching content cross-fades, 150ms

#### 3.6 Data Requirements

##### Entity: RecentFood

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto | Unique record ID |
| food_id | string | Required | None | References the food in its source database |
| food_source | enum | One of: usda, open_food_facts, custom, recipe | None | Which database the food belongs to |
| food_name | string | Required, max 500 chars | None | Food name for display |
| calories_per_serving | float | Min: 0 | 0 | Calories for quick display in search results |
| protein_g_per_serving | float | Min: 0 | 0 | Protein for quick display |
| carbs_g_per_serving | float | Min: 0 | 0 | Carbs for quick display |
| fat_g_per_serving | float | Min: 0 | 0 | Fat for quick display |
| serving_description | string | Max 200 chars | null | Default serving description |
| log_count | integer | Min: 1 | 1 | Number of times this food has been logged |
| last_logged_at | datetime | ISO 8601 | Current timestamp | When this food was most recently logged |
| is_favorite | boolean | - | false | Whether the user has favorited this food |
| created_at | datetime | Auto-set | Current timestamp | First time this food was logged |
| updated_at | datetime | Auto-set | Current timestamp | Last update time |

**Relationships:**
- RecentFood references food records across all food tables (USDA Food, BarcodeProduct, CustomFood, Recipe)
- RecentFood is updated whenever a FoodLogEntry is created with this food_id

**Indexes:**
- (last_logged_at DESC) - recent foods query
- (is_favorite) - favorites list query
- (food_id, food_source) - unique constraint to prevent duplicates
- (food_name) - text search within recent/favorite foods

**Validation Rules:**
- log_count must be at least 1
- food_id + food_source must be unique (one RecentFood per unique food)
- When a food is logged, update last_logged_at and increment log_count

**Example Data:**

```json
{
  "id": "rf-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "food_id": "usda-171688",
  "food_source": "usda",
  "food_name": "Chicken, breast, roasted",
  "calories_per_serving": 231.0,
  "protein_g_per_serving": 43.4,
  "carbs_g_per_serving": 0.0,
  "fat_g_per_serving": 5.0,
  "serving_description": "1 serving (140g)",
  "log_count": 47,
  "last_logged_at": "2026-03-06T12:30:00Z",
  "is_favorite": true,
  "created_at": "2026-01-15T08:00:00Z",
  "updated_at": "2026-03-06T12:30:00Z"
}
```

#### 3.7 Business Logic Rules

##### Unified Search Ranking

**Purpose:** Search across all food sources and rank results by relevance, recency, and frequency.

**Inputs:**
- query: string - the user's search text (minimum 2 characters)
- active_tab: enum - all, recent, favorites, custom

**Logic:**

```
1. IF active_tab == "recent":
     QUERY RecentFood WHERE food_name LIKE query, ORDER BY last_logged_at DESC, LIMIT 50
     RETURN results
2. IF active_tab == "favorites":
     QUERY RecentFood WHERE food_name LIKE query AND is_favorite = true, ORDER BY log_count DESC
     RETURN results
3. IF active_tab == "custom":
     QUERY CustomFood WHERE name LIKE query, ORDER BY updated_at DESC
     RETURN results
4. IF active_tab == "all":
     a. QUERY RecentFood WHERE food_name matches query, ORDER BY log_count DESC, LIMIT 5
        - Label these as "Your Foods" section
     b. QUERY Food (USDA) FTS5 with query, ranked by bm25(), LIMIT 25
        - Label these as "USDA Foods" section
     c. QUERY BarcodeProduct WHERE product_name LIKE query, LIMIT 10
        - Label these as "Barcode Products" section
     d. QUERY CustomFood WHERE name LIKE query, LIMIT 5
        - Label these as "Custom Foods" section
     e. MERGE results with section headers
     f. DEDUPLICATE: if a food appears in both "Your Foods" and another section, keep only the "Your Foods" version
     g. RETURN merged results
```

**Edge Cases:**
- Query matches thousands of USDA foods: limit to 25 per section with "Show more" option
- Query matches nothing: return empty with "No foods found" message
- Special characters in query: strip for FTS5 search but preserve for LIKE queries
- User's recent/favorite foods always appear at the top of "All" results, regardless of USDA relevance ranking

##### Recent Food Tracking

**Purpose:** Maintain a list of recently and frequently logged foods for quick access.

**Inputs:**
- food_id: string - the food being logged
- food_source: enum - the food's source database

**Logic:**

```
1. LOOK UP existing RecentFood WHERE food_id = input AND food_source = input
2. IF found:
     INCREMENT log_count by 1
     SET last_logged_at = now
     UPDATE record
3. IF NOT found:
     CREATE new RecentFood with:
       - food_id, food_source from input
       - food_name, calories, macros copied from the source food record
       - log_count = 1
       - last_logged_at = now
4. PRUNE: if total RecentFood records > 500, DELETE the oldest by last_logged_at (but never delete favorites)
```

**Edge Cases:**
- Food source record is deleted but RecentFood exists: display the denormalized data, show a warning badge
- Pruning would delete a favorite: skip favorites during pruning
- Two rapid logs of the same food: log_count increments correctly (no race condition)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| FTS5 search fails | Toast: "Search encountered an error. Showing recent foods instead." Falls back to Recent tab. | User can retry their search or browse recent foods |
| Search returns no results | "No foods found for '[query]'. Try a different spelling." with "Create a custom food" link | User modifies query or creates custom food |
| Database timeout on search (>500ms) | Loading indicator shown; if >2 seconds: "Search is taking longer than usual..." | Results appear when ready; user can modify query |
| Recent food references a deleted custom food | Entry shows food name with a "Food deleted" badge | User can dismiss the entry from recents |
| Too many results (>100) | Only first 50 shown with "Showing top 50 results. Refine your search for more specific results." | User types more specific query |

**Validation Timing:**
- Minimum character validation runs on every keystroke
- Search debounce fires 150ms after last keystroke
- Results load incrementally (personal foods first, then USDA)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens the food search screen,
   **When** they type "chicken" in the search bar,
   **Then** results appear within 200ms showing USDA chicken entries, any recently logged chicken foods at the top, and source badges on each result.

2. **Given** the user has logged "Greek yogurt" 15 times previously,
   **When** they type "yogurt" in the search bar with "All" tab selected,
   **Then** "Greek yogurt" appears first in the "Your Foods" section, followed by USDA yogurt entries.

3. **Given** the user taps the "Favorites" tab,
   **When** they have 5 favorited foods,
   **Then** all 5 favorites are listed sorted by log count (most frequently logged first).

4. **Given** the user taps a search result,
   **When** the Food Entry Detail modal opens,
   **Then** the food name, nutrition data, and default serving size are pre-filled.

**Edge Cases:**

5. **Given** the user has no recent foods or favorites,
   **When** they tap the "Recent" or "Favorites" tab,
   **Then** appropriate empty states are shown with guidance text.

6. **Given** the user types "xyzabc123" (no matches in any database),
   **When** the search executes,
   **Then** "No foods found" message appears with a "Create a custom food" link.

**Negative Tests:**

7. **Given** the user types a single character "c",
   **When** the character is entered,
   **Then** no search executes and the hint "Type at least 2 characters to search" appears.

8. **Given** the search database is temporarily unavailable,
   **When** the user types a query,
   **Then** an error toast appears and the screen falls back to showing recent foods.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| search requires minimum 2 chars | query: "a" | no search triggered |
| search triggers at 2 chars | query: "ch" | search triggered |
| recent foods ranked by log_count | foods with counts [5, 12, 3, 8] | order: [12, 8, 5, 3] |
| favorites filtered correctly | 10 foods, 3 favorited | favorites tab shows 3 |
| deduplication removes cross-section duplicates | food in "Your Foods" and "USDA Foods" | only "Your Foods" version shown |
| recent food log_count increments | existing recent with count: 5 | count after log: 6 |
| prune keeps favorites | 501 recents, 10 are favorites | 500 remain, all 10 favorites kept |
| search strips special characters for FTS5 | query: "mac & cheese!!" | cleaned: "mac cheese" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Search, select, and log food | 1. Type "banana", 2. Tap first result, 3. Set quantity, 4. Save | Food logged, recent food list updated with banana |
| Favorite a food from search | 1. Search "oatmeal", 2. Tap heart icon on a result, 3. Switch to Favorites tab | Oatmeal appears in Favorites list |
| Category browsing | 1. Open search (empty), 2. Tap "Fruits" category | Results filtered to show only fruits from USDA database |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User finds and logs a frequently eaten food | 1. Tap "+" on dashboard, 2. See "chicken breast" in Recent section, 3. Tap it, 4. Confirm 1 serving, 5. Save | Food logged in 3 taps; recent food count incremented |

---

### NU-010: Custom Food Creation

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-010 |
| **Feature Name** | Custom Food Creation |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As Priya the Parent, I want to create custom food entries for home-cooked dishes that are not in the database, so that I can accurately track the nutrition of meals I cook from scratch.

**Secondary:**
> As Sam the Scanner, I want to save nutrition data for a product I scanned that was not found in the barcode database, so that future scans of the same product are instant.

**Tertiary:**
> As Alex the Active, I want to create custom foods for my specific protein shake blend, so that I can log my daily shake with accurate macros in one tap.

#### 3.3 Detailed Description

Custom Food Creation allows users to manually define food items that do not exist in the USDA or barcode databases. Users enter the food name, serving size, and nutrition facts either by typing values from a nutrition label or by building a food from ingredients. Created custom foods appear in search results (NU-009) and can be favorited, logged, and used in recipes (NU-011).

This feature is critical for comprehensive food tracking because no database covers every food. Home-cooked meals, local restaurant dishes, farmers market products, and niche dietary items frequently lack database entries. By enabling custom food creation, MyNutrition ensures users can always log what they eat with accurate nutrition data.

Custom foods are stored locally alongside USDA and barcode data. They appear in search results with a "Custom" badge and are included in data exports (NU-023). Users can edit and delete custom foods at any time. Deleting a custom food does not delete past log entries that reference it; those entries retain their denormalized nutrition data.

If the user arrived at custom food creation via a barcode scan (NU-003), the barcode number is pre-filled and linked to the custom food. Future scans of that barcode will find the custom food.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-001: Food Logging - custom foods are logged as food entries

**External Dependencies:**
- None (all data is entered manually and stored locally)

**Assumed Capabilities:**
- User can navigate to the custom food creation form
- Database is writable

#### 3.5 User Interface Requirements

##### Screen: Create/Edit Custom Food

**Layout:**
- **Header:** "Create Custom Food" (or "Edit Custom Food" when editing). Close button (X) on the left, "Save" button on the right.
- **Name section:** A text input for the food name (required). Placeholder: "e.g., Mom's Chicken Soup"
- **Brand section:** An optional text input for brand name. Placeholder: "e.g., Homemade"
- **Barcode section:** An optional text input for barcode (pre-filled if arriving from barcode scan). A small "Scan" button next to the field to scan a barcode and link it.
- **Serving size section:** Two fields: serving description text input (e.g., "1 bowl", "1 scoop", "100g") and a numeric field for gram weight per serving.
- **Nutrition section:** A form modeled after the FDA Nutrition Facts label with input fields for each nutrient. Fields are organized in groups:
  - Required (highlighted): Calories, Total Fat (g), Total Carbohydrate (g), Protein (g)
  - Optional macros: Saturated Fat (g), Trans Fat (g), Cholesterol (mg), Sodium (mg), Dietary Fiber (g), Total Sugars (g), Added Sugars (g)
  - Optional micronutrients (collapsed by default, expandable): Vitamin D, Calcium, Iron, Potassium, Vitamin A, Vitamin C, and additional micronutrients
- **Notes section:** An optional multiline text input for notes (max 500 chars). Placeholder: "e.g., From the recipe on page 42"
- **Action section:** A "Save" button (full width, primary) and a "Delete Food" link (red, only shown when editing)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Creating | New custom food | All fields empty (except barcode if pre-filled); "Save" button labeled "Create" |
| Editing | Editing existing custom food | All fields pre-populated; "Save" button labeled "Update"; "Delete Food" link visible |
| Invalid | Required fields missing | Inline validation errors on empty required fields; Save disabled |
| Valid | All required fields filled | Save button enabled |
| From barcode | Arrived via failed barcode scan | Barcode field pre-filled; partial product data pre-filled if available |

**Interactions:**
- Enter values in nutrition fields: no real-time calculation (these are raw input fields)
- Tap "Expand micronutrients": shows additional nutrient input fields
- Tap "Save"/"Create": validates required fields, saves custom food, shows toast "Custom food created", returns to search screen
- Tap "Delete Food": confirmation dialog "Delete [food name]? This cannot be undone. Existing log entries will keep their nutrition data." On confirm, deletes the custom food record.
- Tap close (X): if any field has been modified, shows "Discard changes?" confirmation; otherwise dismisses immediately
- Tap "Scan" next to barcode field: opens barcode scanner to capture a barcode

**Transitions/Animations:**
- Micronutrient section expands/collapses with an accordion animation, 200ms
- Save success toast slides in from the bottom, 200ms

#### 3.6 Data Requirements

##### Entity: CustomFood

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto | Unique custom food ID |
| name | string | Required, max 500 chars | None | Custom food name |
| brand | string | Max 200 chars | null | Optional brand name |
| barcode | string | Max 20 chars, unique if not null | null | Linked barcode (if created from scan) |
| serving_description | string | Required, max 200 chars | None | Serving description (e.g., "1 bowl (350g)") |
| serving_weight_grams | float | Min: 0.1, max: 99999 | None | Gram weight per serving |
| calories | float | Required, min: 0, max: 99999 | None | Calories per serving |
| protein_g | float | Required, min: 0, max: 9999 | None | Protein per serving in grams |
| carbs_g | float | Required, min: 0, max: 9999 | None | Carbohydrates per serving in grams |
| fat_g | float | Required, min: 0, max: 9999 | None | Fat per serving in grams |
| saturated_fat_g | float | Min: 0 | null | Saturated fat per serving |
| trans_fat_g | float | Min: 0 | null | Trans fat per serving |
| cholesterol_mg | float | Min: 0 | null | Cholesterol per serving |
| sodium_mg | float | Min: 0 | null | Sodium per serving |
| fiber_g | float | Min: 0 | null | Dietary fiber per serving |
| sugar_g | float | Min: 0 | null | Total sugars per serving |
| added_sugar_g | float | Min: 0 | null | Added sugars per serving |
| vitamin_d_mcg | float | Min: 0 | null | Vitamin D per serving |
| calcium_mg | float | Min: 0 | null | Calcium per serving |
| iron_mg | float | Min: 0 | null | Iron per serving |
| potassium_mg | float | Min: 0 | null | Potassium per serving |
| notes | string | Max 500 chars | null | User notes about this food |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

**Relationships:**
- CustomFood is referenced by FoodLogEntry via food_id when food_source = "custom"
- CustomFood can be linked to a BarcodeProduct via the barcode field
- CustomFood can be referenced by RecentFood

**Indexes:**
- (name) - search by name
- (barcode) - lookup by barcode
- (created_at DESC) - list custom foods by newest first

**Validation Rules:**
- name must not be empty after trimming
- serving_description must not be empty after trimming
- calories, protein_g, carbs_g, and fat_g are required
- All numeric nutrition values must be non-negative
- If barcode is provided, it must be unique among custom foods and valid barcode format
- Calorie cross-check: if |(protein_g*4 + carbs_g*4 + fat_g*9) - calories| > calories * 0.20, show a non-blocking warning: "The calories do not match the macro values. Please double-check."

**Example Data:**

```json
{
  "id": "cf-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Mom's Chicken Noodle Soup",
  "brand": "Homemade",
  "barcode": null,
  "serving_description": "1 bowl (350g)",
  "serving_weight_grams": 350.0,
  "calories": 220.0,
  "protein_g": 18.0,
  "carbs_g": 22.0,
  "fat_g": 6.0,
  "saturated_fat_g": 1.5,
  "sodium_mg": 890.0,
  "fiber_g": 2.0,
  "sugar_g": 3.0,
  "notes": "Recipe from Mom, serves 6",
  "created_at": "2026-03-01T10:00:00Z",
  "updated_at": "2026-03-01T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Calorie-Macro Cross-Check

**Purpose:** Validate that the user-entered calorie value is consistent with the macro values.

**Inputs:**
- calories: float - user-entered calories
- protein_g: float
- carbs_g: float
- fat_g: float

**Logic:**

```
1. computed_calories = (protein_g * 4) + (carbs_g * 4) + (fat_g * 9)
2. difference = ABS(computed_calories - calories)
3. IF difference > calories * 0.20:
     SHOW non-blocking warning: "The entered calories ([calories]) differ from the calculated value ([computed_calories] kcal based on macros) by [difference] kcal. Please verify your entries."
4. This is informational only. The user can save regardless.
```

**Edge Cases:**
- Calories is 0 and macros are all 0: no warning (valid for items like water)
- Calories is 0 but macros are non-zero: show warning
- Food contains alcohol or fiber that explains the calorie discrepancy: warning still shows but user can ignore

##### Custom Food Deletion

**Purpose:** Delete a custom food while preserving existing log entries.

**Inputs:**
- custom_food_id: string - the food to delete

**Logic:**

```
1. LOOK UP CustomFood by custom_food_id
2. CHECK if any FoodLogEntry references this food
3. SHOW confirmation with count: "Delete [name]? [N] log entries use this food. Those entries will keep their nutrition data but will show a 'Food deleted' badge."
4. ON confirm:
     DELETE the CustomFood record
     DELETE the RecentFood record for this food (if exists)
     DO NOT modify any FoodLogEntry records (they retain denormalized data)
5. RETURN success
```

**Edge Cases:**
- Custom food has no log entries: simpler confirmation message
- Custom food is linked to a barcode: barcode association is removed; future scans of that barcode return "not found"

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Name field left empty | Inline: "Enter a food name" | User fills in the name |
| Calories field left empty | Inline: "Enter the calories per serving" | User fills in calories |
| Protein, carbs, or fat left empty | Inline: "Enter a value (use 0 if none)" | User fills in the value |
| Calorie-macro mismatch >20% | Non-blocking warning below nutrition section | User can correct values or ignore and save |
| Barcode already linked to another custom food | Inline: "This barcode is already linked to [food name]" | User clears the barcode or edits the existing food |
| Serving weight is 0 or negative | Inline: "Enter a valid serving weight in grams" | User corrects the value |
| Database save fails | Toast: "Could not save custom food. Please try again." | User retries |
| Delete fails | Toast: "Could not delete custom food. Please try again." | User retries |

**Validation Timing:**
- Required field validation runs on blur
- Calorie-macro cross-check runs on any nutrition field change (debounced 500ms)
- Barcode uniqueness check runs on blur of the barcode field
- Form-level validation runs on Save

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens the Create Custom Food screen,
   **When** they enter "Protein Shake" with 200 kcal, 30g protein, 10g carbs, 3g fat, serving "1 scoop (40g)",
   **Then** the food is created, a toast confirms "Custom food created", and the food appears in search results with a "Custom" badge.

2. **Given** the user arrived from a failed barcode scan with barcode "1234567890123",
   **When** the Create Custom Food screen opens,
   **Then** the barcode field is pre-filled with "1234567890123" and scanning that barcode in the future finds this custom food.

3. **Given** the user edits an existing custom food to change calories from 200 to 250,
   **When** they save,
   **Then** the custom food is updated, and future log entries using this food show 250 kcal per serving. Past log entries retain their original 200 kcal values.

**Edge Cases:**

4. **Given** the user enters 200 kcal but macros that compute to 350 kcal (P:30, C:30, F:15),
   **When** the cross-check runs,
   **Then** a warning appears: "The entered calories (200) differ from the calculated value (350 kcal based on macros)..." but the user can still save.

5. **Given** the user deletes a custom food that has 10 existing log entries,
   **When** they confirm deletion,
   **Then** the custom food is removed from search, but all 10 log entries remain with their nutrition data intact and a "Food deleted" badge.

**Negative Tests:**

6. **Given** the user tries to save with an empty name,
   **When** they tap Create,
   **Then** the system shows "Enter a food name"
   **And** no record is created.

7. **Given** the user enters a barcode that belongs to another custom food,
   **When** the barcode field loses focus,
   **Then** the system shows "This barcode is already linked to [food name]"
   **And** the Save button is disabled until resolved.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates custom food with valid data | name: "Shake", cal: 200, P: 30, C: 10, F: 3 | record created with all values |
| rejects empty name | name: "" | validation error: "Enter a food name" |
| rejects missing calories | calories: null | validation error: "Enter the calories per serving" |
| calorie-macro cross-check passes | cal: 200, P: 25, C: 15, F: 5 | no warning (computed: 205, within 20%) |
| calorie-macro cross-check warns | cal: 100, P: 25, C: 15, F: 5 | warning shown (computed: 205, >20% diff) |
| rejects duplicate barcode | barcode: "123" (already exists) | error: "barcode already linked" |
| allows null barcode | barcode: null | no error |
| deletion preserves log entries | delete food with 5 entries | food deleted, 5 entries intact |
| serving weight must be positive | weight: 0 | validation error |
| accepts zero-calorie food | cal: 0, P: 0, C: 0, F: 0 | record created (valid for water, tea, etc.) |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create and log custom food | 1. Create "Protein Shake" custom food, 2. Search "Protein Shake", 3. Tap result, 4. Log it | Custom food appears in search, logs correctly with accurate nutrition |
| Create from barcode and rescan | 1. Scan unknown barcode, 2. Create custom food with barcode, 3. Scan same barcode again | Second scan finds the custom food instantly |
| Edit custom food | 1. Create food with 200 kcal, 2. Log it, 3. Edit food to 250 kcal, 4. Log it again | First entry: 200 kcal, second entry: 250 kcal |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User creates a custom food from a nutrition label | 1. Open Create Custom Food, 2. Enter all values from a product nutrition label, 3. Save, 4. Search and log the food | Custom food in database, one log entry with matching nutrition, food appears in Recent and search |

---

### NU-011: Recipe Nutrition Calculator

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-011 |
| **Feature Name** | Recipe Nutrition Calculator |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As Priya the Parent, I want to add ingredients to a recipe and have the app calculate the per-serving nutrition automatically, so that I can log home-cooked meals with accurate calorie and nutrient counts.

**Secondary:**
> As Maria the Mindful Eater, I want to save recipes I cook regularly and log them with one tap, so that I do not have to recalculate nutrition every time I make the same dish.

**Tertiary:**
> As Alex the Active, I want to adjust the number of servings in a recipe and see the per-serving nutrition update instantly, so that I can scale recipes for meal prep.

#### 3.3 Detailed Description

The Recipe Nutrition Calculator allows users to build recipes by combining multiple food ingredients, each with a specific quantity and serving size. The system sums the nutritional values of all ingredients and divides by the number of servings to produce a per-serving nutrition profile. This per-serving profile can then be logged as a single food entry, saved for future use, and edited at any time.

This feature addresses the biggest gap in food tracking for home cooks: the inability to accurately log meals made from multiple ingredients. Without a recipe calculator, users must either log each ingredient separately (tedious for a 10-ingredient stew) or create a rough custom food entry (inaccurate). The recipe calculator solves both problems by automating the math.

Recipes are stored locally and appear in search results (NU-009) with a "Recipe" badge. Each recipe records its ingredient list, quantities, and the resulting per-serving nutrition. When the user edits a recipe (changes an ingredient or adjusts quantities), the nutrition profile recalculates. Past log entries that used the old recipe version retain their original nutrition values.

If the MyRecipes module is enabled in MyLife, recipes created here are optionally shared with MyRecipes and vice versa. This cross-module integration is handled via the integration points defined in Section 6.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-002: Food Database - ingredients are selected from the food database
- NU-010: Custom Food Creation - recipes produce a food entry similar to custom foods

**External Dependencies:**
- None (all computation is local)

**Assumed Capabilities:**
- User can search for foods to add as ingredients
- Food database contains per-serving and per-100g nutrient data

#### 3.5 User Interface Requirements

##### Screen: Recipe Builder

**Layout:**
- **Header:** "New Recipe" (or "Edit Recipe"). Close button (X) on the left, "Save Recipe" button on the right.
- **Name and servings section:**
  - Recipe name text input (required). Placeholder: "e.g., Chicken Stir Fry"
  - Number of servings numeric input (required, min: 0.25, max: 100). Default: 1.
  - Serving description text input (optional). Placeholder: "e.g., 1 bowl, 1 plate"
- **Ingredients section:**
  - Title "Ingredients" with an "Add Ingredient" button (plus icon)
  - A list of added ingredients, each showing:
    - Ingredient name (primary text)
    - Quantity and unit (secondary text, e.g., "200g" or "1 cup")
    - Calories contributed by this ingredient (right-aligned)
    - A delete button (X) to remove the ingredient
    - Tapping the ingredient row opens an edit dialog to change quantity or unit
  - At the bottom of the list: total calories from all ingredients in bold
- **Nutrition summary section (updates in real time):**
  - Title: "Per Serving Nutrition"
  - A compact Nutrition Facts panel showing the computed per-serving values
  - Calorie value large and bold, macros (P/C/F) in a row below, followed by available micronutrients
- **Notes section:** Optional text input for recipe notes (e.g., cooking instructions). Max 2000 chars.

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No ingredients added | Ingredients section shows "Add your first ingredient" prompt with "Add Ingredient" button |
| Building | 1+ ingredients added | Ingredient list visible, nutrition summary updates in real time |
| Valid | Name entered, 1+ ingredients, servings > 0 | "Save Recipe" button enabled |
| Invalid | Missing name or zero ingredients | "Save Recipe" disabled; missing fields highlighted |

**Interactions:**
- Tap "Add Ingredient": opens the Food Search screen (NU-009); selecting a food adds it as an ingredient with a quantity dialog
- Tap an ingredient row: opens an edit dialog to change quantity, serving unit, or remove the ingredient
- Tap delete (X) on an ingredient: removes the ingredient after brief confirmation, nutrition recalculates
- Change number of servings: per-serving nutrition recalculates in real time
- Tap "Save Recipe": validates, saves the recipe, shows toast "Recipe saved"
- Tap close (X): if changes exist, confirms discard

**Transitions/Animations:**
- Adding an ingredient: new row animates in with a slide-down + fade, 200ms
- Removing an ingredient: row animates out with a slide-left + fade, 200ms
- Nutrition summary values animate (count up/down) when ingredients change, 200ms

#### 3.6 Data Requirements

##### Entity: Recipe

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto | Unique recipe ID |
| name | string | Required, max 500 chars | None | Recipe name |
| servings | float | Required, min: 0.25, max: 100 | 1 | Number of servings the recipe makes |
| serving_description | string | Max 200 chars | null | Description of one serving (e.g., "1 bowl") |
| total_calories | float | Computed, min: 0 | 0 | Total calories for the entire recipe |
| per_serving_calories | float | Computed, min: 0 | 0 | Calories per serving (total / servings) |
| per_serving_protein_g | float | Computed | 0 | Protein per serving |
| per_serving_carbs_g | float | Computed | 0 | Carbs per serving |
| per_serving_fat_g | float | Computed | 0 | Fat per serving |
| per_serving_fiber_g | float | Computed | null | Fiber per serving |
| per_serving_sugar_g | float | Computed | null | Sugar per serving |
| per_serving_sodium_mg | float | Computed | null | Sodium per serving |
| notes | string | Max 2000 chars | null | Recipe notes or cooking instructions |
| ingredient_count | integer | Computed, min: 1 | 0 | Number of ingredients |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

##### Entity: RecipeIngredient

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto | Unique ingredient entry ID |
| recipe_id | string | Required, references Recipe.id | None | The recipe this ingredient belongs to |
| food_id | string | Required | None | References the food in its source database |
| food_source | enum | One of: usda, open_food_facts, custom | None | Which food database |
| food_name | string | Required, max 500 chars | None | Denormalized food name |
| quantity | float | Required, min: 0.01 | 1 | Number of servings or units |
| serving_unit | string | Required, max 50 chars | "serving" | Unit of measurement |
| serving_weight_grams | float | Min: 0.01 | null | Gram weight of one serving unit |
| calories | float | Computed, min: 0 | 0 | Total calories for this ingredient amount |
| protein_g | float | Computed | 0 | Total protein for this ingredient amount |
| carbs_g | float | Computed | 0 | Total carbs for this ingredient amount |
| fat_g | float | Computed | 0 | Total fat for this ingredient amount |
| sequence | integer | Min: 0 | 0 | Display order of ingredient in the list |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Relationships:**
- Recipe has many RecipeIngredient records (one-to-many via recipe_id)
- RecipeIngredient references food records via food_id + food_source
- Recipe is referenced by FoodLogEntry via food_id when food_source = "recipe"

**Indexes:**
- Recipe: (name) for search
- Recipe: (created_at DESC) for listing
- RecipeIngredient: (recipe_id, sequence) for ordered ingredient listing

**Validation Rules:**
- Recipe must have at least 1 ingredient
- Recipe name must not be empty
- servings must be at least 0.25 and at most 100
- Each ingredient must have a valid food reference and positive quantity

**Example Data:**

```json
{
  "id": "rcp-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Chicken Stir Fry",
  "servings": 4,
  "serving_description": "1 plate",
  "total_calories": 1200.0,
  "per_serving_calories": 300.0,
  "per_serving_protein_g": 35.0,
  "per_serving_carbs_g": 25.0,
  "per_serving_fat_g": 8.0,
  "ingredient_count": 5,
  "notes": "Cook chicken first, add veggies, then sauce",
  "created_at": "2026-03-01T10:00:00Z",
  "updated_at": "2026-03-01T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Recipe Nutrition Calculation

**Purpose:** Compute the total and per-serving nutrition for a recipe based on its ingredients.

**Inputs:**
- ingredients: array of RecipeIngredient - each with food reference, quantity, and serving unit
- servings: float - number of servings the recipe yields

**Logic:**

```
1. FOR EACH ingredient in ingredients:
     a. LOOK UP the food's nutrient profile from the appropriate database
     b. COMPUTE ingredient nutrients using the Nutrition Calculation logic from NU-001:
        nutrient_value = food.per_serving_value * scaling_factor
     c. STORE computed nutrients on the RecipeIngredient record
2. FOR EACH nutrient field:
     recipe_total_nutrient = SUM of ingredient nutrient values across all ingredients
     (skip null values; if ALL ingredients have null for a nutrient, recipe total is null)
3. FOR EACH nutrient field:
     per_serving_nutrient = ROUND(recipe_total_nutrient / servings, 1)
4. UPDATE Recipe with computed per-serving values
5. RETURN recipe nutrition summary
```

**Formulas:**
- `recipe_total_calories = SUM(ingredient_calories) for all ingredients`
- `per_serving_calories = recipe_total_calories / servings`
- Same pattern for all nutrients

**Edge Cases:**
- servings is 0.25 (quarter recipe): per-serving values are 4x the total; display correctly
- An ingredient has null for a micronutrient but others have values: sum only the non-null values and annotate as "partial"
- All ingredients have null for a nutrient: recipe per-serving for that nutrient is null
- Recipe has only 1 ingredient: per-serving = ingredient total / servings
- User changes the number of servings after saving: per-serving values recalculate, stored values update

##### Recipe Version Management

**Purpose:** Handle recipe edits without corrupting historical food log entries.

**Inputs:**
- recipe_id: string - the recipe being edited
- new_ingredients: array - updated ingredient list

**Logic:**

```
1. UPDATE the Recipe record with new ingredient list
2. RECOMPUTE recipe nutrition using the Recipe Nutrition Calculation logic
3. UPDATE Recipe per-serving values
4. DO NOT modify any existing FoodLogEntry records that reference this recipe
   (they retain their denormalized nutrition values from the time of logging)
5. FUTURE log entries using this recipe will use the new per-serving values
```

**Edge Cases:**
- User removes all ingredients: recipe becomes invalid; prompt to add at least one
- User deletes a food that is used as an ingredient: ingredient shows food name (denormalized) with a warning badge

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No ingredients added on save | "Add at least one ingredient" message | User adds an ingredient |
| Recipe name empty | Inline: "Enter a recipe name" | User fills in the name |
| Servings set to 0 | Inline: "Servings must be at least 0.25" | User corrects the value |
| Ingredient food reference not found | Ingredient shows name with "Food not found" badge; nutrition shows last known values | User can remove the ingredient or the values are retained |
| Nutrition calculation fails for an ingredient | Ingredient shows "Could not calculate nutrition" warning; excluded from totals | User can edit the ingredient or remove it |
| Database save fails | Toast: "Could not save recipe. Please try again." | User retries |

**Validation Timing:**
- Recipe name validation runs on blur
- Servings validation runs on input change
- Nutrition recalculation runs whenever an ingredient is added, edited, or removed
- Form-level validation runs on Save

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user creates a recipe "Chicken Stir Fry" with 4 servings, adding chicken breast (200g), broccoli (150g), soy sauce (2 tbsp), rice (1 cup), and olive oil (1 tbsp),
   **When** the nutrition summary displays,
   **Then** per-serving values are the sum of all ingredient nutrients divided by 4, rounded to 1 decimal.

2. **Given** the user saves the recipe,
   **When** they search for "Chicken Stir Fry" in the food search,
   **Then** the recipe appears with a "Recipe" badge showing per-serving calories and macros.

3. **Given** the user logs 1.5 servings of the saved recipe,
   **When** the food entry is created,
   **Then** the entry nutrition is 1.5 times the per-serving values.

**Edge Cases:**

4. **Given** a recipe has 3 ingredients where 2 have iron values and 1 has null iron,
   **When** per-serving iron is calculated,
   **Then** iron is computed from the 2 non-null values divided by servings, annotated as partial.

5. **Given** the user changes servings from 4 to 2 without changing ingredients,
   **When** the nutrition summary updates,
   **Then** all per-serving values double.

**Negative Tests:**

6. **Given** the user tries to save a recipe with no ingredients,
   **When** they tap Save,
   **Then** the system shows "Add at least one ingredient"
   **And** no recipe is created.

7. **Given** the user sets servings to 0,
   **When** validation runs,
   **Then** the system shows "Servings must be at least 0.25"
   **And** Save is disabled.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates per-serving from 2 ingredients | ing1: 200 kcal, ing2: 300 kcal, servings: 2 | per_serving: 250.0 |
| handles fractional servings | total: 800 kcal, servings: 3 | per_serving: 266.7 |
| sums macros correctly | ing1: P:20/C:30/F:10, ing2: P:15/C:20/F:5, servings: 1 | per_serving: P:35/C:50/F:15 |
| handles null nutrient in one ingredient | ing1: iron:3mg, ing2: iron:null, servings: 2 | per_serving_iron: 1.5 (partial) |
| handles all-null nutrient | ing1: vit_e:null, ing2: vit_e:null, servings: 2 | per_serving_vit_e: null |
| rejects zero servings | servings: 0 | validation error |
| rejects empty ingredient list | ingredients: [] | validation error |
| ingredient deletion recalculates | remove 200kcal ingredient from 500kcal total, 2 servings | per_serving: 150.0 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Build recipe and log it | 1. Create recipe with 3 ingredients, 2. Save, 3. Search recipe name, 4. Log 1 serving | Food entry matches per-serving nutrition of recipe |
| Edit recipe and verify new log | 1. Create recipe, 2. Log it, 3. Edit recipe (add ingredient), 4. Log again | First entry has old nutrition, second has new nutrition |
| Delete ingredient and verify recalc | 1. Recipe has 3 ingredients (600 kcal total), 2. Remove 200 kcal ingredient | Total drops to 400 kcal, per-serving recalculates |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User creates and logs a recipe | 1. Open recipe builder, 2. Name "Overnight Oats", 3. Add oats, milk, yogurt, berries, honey, 4. Set servings to 2, 5. Save, 6. Log 1 serving for breakfast | Recipe saved with 5 ingredients; breakfast entry shows per-serving calories; dashboard totals include this entry |

---

### NU-012: Micronutrient Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-012 |
| **Feature Name** | Micronutrient Tracking |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As Dr. Chen the Data-Driven, I want to see my daily intake of 20+ vitamins and minerals compared to recommended daily values, so that I can identify nutritional gaps and discuss them with my clinician.

**Secondary:**
> As Maria the Mindful Eater, I want to see which micronutrients I am consistently low on, so that I can adjust my diet or consider supplementation.

**Tertiary:**
> As Priya the Parent, I want to check if my family's meals provide enough iron, calcium, and vitamin D, so that I can ensure my children are getting adequate nutrition.

#### 3.3 Detailed Description

Micronutrient Tracking extends the nutrition tracking beyond calories and macros to include vitamins and minerals. While most food tracking apps focus exclusively on calories, protein, carbs, and fat, MyNutrition leverages the comprehensive USDA database to track 25+ micronutrients. This positions MyNutrition on par with Cronometer (which tracks 84+ nutrients) as one of the most thorough nutrition trackers available.

The feature displays daily micronutrient intake as a percentage of the FDA Daily Value, highlighting nutrients that are significantly above or below recommended levels. Users can see which foods contributed the most to each micronutrient and identify patterns over time (e.g., consistently low iron intake). The micronutrient view is accessible from the dashboard (NU-005) as a highlights row and from a dedicated micronutrient detail screen.

Micronutrient data comes from the USDA food database (NU-002), which provides 65+ nutrient values per food. Custom foods (NU-010) may have partial micronutrient data (only the values the user entered). The system handles mixed data completeness gracefully, showing available data and noting when coverage is partial.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-001: Food Logging - provides the food entries with nutrient data
- NU-002: Food Database - provides micronutrient values per food

**External Dependencies:**
- None (all data is local)

**Assumed Capabilities:**
- USDA food entries include micronutrient fields (vitamin_a, vitamin_c, vitamin_d, etc.)
- FDA Daily Value reference table is available (defined in NU-002)

#### 3.5 User Interface Requirements

##### Screen: Micronutrient Detail

**Layout:**
- **Header:** "Micronutrients" with the current date and date navigation arrows
- **Summary bar:** A horizontal progress bar showing overall micronutrient coverage: "X of Y tracked nutrients meet 80%+ of Daily Value"
- **Nutrient list:** A scrollable list of micronutrients, each row showing:
  - Nutrient name (left, bold)
  - Amount consumed with unit (center, e.g., "12.5 mg")
  - Horizontal progress bar showing % of Daily Value (background bar, colored fill)
  - % Daily Value number (right, e.g., "69%")
  - Color coding: green (>= 80% DV), amber (40-79% DV), red (< 40% DV), blue (> 100% DV for nutrients where excess is notable)
- **Nutrient groups:** The list is organized into collapsible groups:
  - Vitamins: Vitamin A, Vitamin C, Vitamin D, Vitamin E, Vitamin K, Thiamin (B1), Riboflavin (B2), Niacin (B3), Vitamin B6, Folate, Vitamin B12
  - Minerals: Calcium, Iron, Magnesium, Phosphorus, Potassium, Zinc, Copper, Manganese, Selenium, Sodium
- **Tapping a nutrient row:** Expands to show:
  - A breakdown of which foods contributed to this nutrient today (top 5 contributors)
  - Each contributor shows: food name, amount of nutrient from that food, and percentage of total intake
  - A brief description of the nutrient's function (e.g., "Iron: Essential for oxygen transport in blood")

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Full data | All USDA foods logged today | Complete micronutrient list with accurate totals |
| Partial data | Mix of USDA and custom foods (custom may lack micronutrients) | Totals shown with a note: "Based on X of Y foods with micronutrient data" |
| No data | No foods logged | All nutrients show 0% with message "Log foods to see your micronutrient intake" |
| Custom foods only | Only custom foods logged (likely no micronutrient data) | Message: "Micronutrient data is not available for custom foods. Log foods from the USDA database for detailed micronutrient tracking." |

**Interactions:**
- Tap nutrient row: expands/collapses the food contributor breakdown
- Date navigation: same as Daily Food Log
- Tap summary bar: scrolls to the first nutrient below 80% DV
- Long press a nutrient: shows a tooltip with the FDA Daily Value for that nutrient

**Transitions/Animations:**
- Progress bars animate from 0 to current value on screen load, 400ms, ease-out
- Nutrient contributor breakdown expands with an accordion animation, 200ms

#### 3.6 Data Requirements

Micronutrient tracking does not introduce new entities. It computes derived values from FoodLogEntry (NU-001) and the nutrient data in Food (NU-002). The key derived computations are:

##### Derived Data: Daily Micronutrient Summary

| Field | Type | Computation | Description |
|-------|------|-------------|-------------|
| nutrient_name | string | Static list of 21 tracked nutrients | Name of the micronutrient |
| total_amount | float | SUM(ingredient nutrient) across all FoodLogEntry for the date | Total intake for the day |
| unit | string | Static (mg, mcg) | Unit of measurement |
| daily_value | float | From FDA Daily Value table (NU-002) | Recommended daily intake |
| percent_dv | float | (total_amount / daily_value) * 100 | Percentage of Daily Value consumed |
| status | enum | green / amber / red / blue | Color-coded status based on % DV thresholds |
| food_contributors | array | Top 5 foods contributing to this nutrient | Foods sorted by contribution amount |
| data_coverage | float | (entries_with_nutrient_data / total_entries) * 100 | What percentage of logged foods have data for this nutrient |

#### 3.7 Business Logic Rules

##### Micronutrient Aggregation

**Purpose:** Calculate daily totals for all tracked micronutrients from food log entries.

**Inputs:**
- date: string - the calendar date to summarize
- nutrient_list: array - the 21 tracked micronutrients

**Logic:**

```
1. QUERY all FoodLogEntry records WHERE date = input_date
2. FOR EACH nutrient in nutrient_list:
     a. total_amount = 0
     b. entries_with_data = 0
     c. contributors = []
     d. FOR EACH entry:
          IF entry has a non-null value for this nutrient:
            total_amount += entry.nutrient_value
            entries_with_data += 1
            ADD { food_name: entry.food_name, amount: entry.nutrient_value } to contributors
     e. percent_dv = compute using FDA Daily Value (NU-002 logic)
     f. SORT contributors by amount DESC, LIMIT to top 5
     g. data_coverage = (entries_with_data / total_entries) * 100
     h. status:
          IF percent_dv >= 100: "blue"
          ELSE IF percent_dv >= 80: "green"
          ELSE IF percent_dv >= 40: "amber"
          ELSE: "red"
3. RETURN array of nutrient summaries
```

**Edge Cases:**
- No entries have data for a specific nutrient: total is 0, data_coverage is 0%, show nutrient as "No data available" instead of 0%
- Only 1 of 5 entries has iron data: show iron total from that 1 entry with data_coverage = 20%, note "Partial data"
- Custom food entries typically lack micronutrient data: they contribute to calorie and macro totals but not to micronutrient totals
- Percent DV exceeds 500%: display the actual number (no cap)

##### Micronutrient Coverage Score

**Purpose:** Calculate an overall micronutrient coverage score for the day.

**Inputs:**
- nutrient_summaries: array - all computed nutrient summaries for the day

**Logic:**

```
1. nutrients_tracked = COUNT nutrients where data_coverage > 0
2. nutrients_meeting_80pct = COUNT nutrients where percent_dv >= 80
3. coverage_score = (nutrients_meeting_80pct / nutrients_tracked) * 100
4. IF nutrients_tracked == 0:
     coverage_score = null
     display_text = "No micronutrient data available"
5. ELSE:
     display_text = "[nutrients_meeting_80pct] of [nutrients_tracked] tracked nutrients meet 80%+ of Daily Value"
6. RETURN { coverage_score, display_text }
```

**Edge Cases:**
- No USDA foods logged: coverage_score is null
- All nutrients above 80%: score is 100%
- Only 3 nutrients have data: score is based on those 3

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No micronutrient data available for any logged food | Message: "Micronutrient data is not available for the foods you logged today. Log foods from the food database for detailed tracking." | User logs USDA database foods |
| Partial data for a nutrient | Nutrient row shows total with "(partial)" annotation and a small info icon | Tapping info explains: "Only X of Y logged foods have data for this nutrient" |
| FDA Daily Value not defined for a nutrient | Nutrient shows amount consumed but no progress bar or % DV | None needed; nutrient amount is still useful |
| Database query fails | Full-screen: "Could not load micronutrient data. Tap to retry." | User retries |

**Validation Timing:**
- Micronutrient aggregation runs on screen load and when date changes
- Contributor breakdown is computed on demand (when user taps a nutrient row)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has logged 5 USDA foods today,
   **When** they open the Micronutrient Detail screen,
   **Then** all 21 tracked nutrients display with amounts, % DV, and color-coded progress bars.

2. **Given** the user taps on "Iron" which shows 69% DV,
   **When** the contributor breakdown expands,
   **Then** the top 5 foods contributing iron are listed with their individual iron amounts and percentage of the total.

3. **Given** the user's vitamin C intake is 150% DV (from citrus fruits),
   **When** the nutrient row displays,
   **Then** vitamin C shows a blue progress bar, "135 mg", and "150%".

**Edge Cases:**

4. **Given** the user has logged 3 USDA foods and 2 custom foods (no micronutrient data on custom),
   **When** the micronutrient screen loads,
   **Then** nutrient totals are computed from the 3 USDA foods only, with a note: "Based on 3 of 5 foods with micronutrient data."

5. **Given** no USDA foods have been logged today (only custom foods),
   **When** the micronutrient screen loads,
   **Then** a message appears: "Micronutrient data is not available for custom foods."

**Negative Tests:**

6. **Given** no foods have been logged today,
   **When** the micronutrient screen loads,
   **Then** all nutrients show 0% with the message "Log foods to see your micronutrient intake"
   **And** no errors occur.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| aggregates iron from 3 foods | foods: [2mg, 3mg, 1mg] | total: 6mg, %DV: 33% |
| handles null nutrient values | foods: [iron: 3mg, iron: null, iron: 2mg] | total: 5mg, data_coverage: 67% |
| computes coverage score | 21 nutrients, 15 at 80%+ DV | score: 71% (15/21) |
| status green at 80%+ | percent_dv: 85 | status: "green" |
| status amber at 40-79% | percent_dv: 55 | status: "amber" |
| status red below 40% | percent_dv: 20 | status: "red" |
| status blue above 100% | percent_dv: 150 | status: "blue" |
| top 5 contributors sorted | 8 foods with iron values | top 5 by descending amount |
| no data returns null score | all entries have null micronutrients | coverage_score: null |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Log food and check micronutrients | 1. Log spinach (high iron), 2. Open micronutrient screen | Iron shows significant % DV, spinach listed as contributor |
| Mix USDA and custom foods | 1. Log 2 USDA foods, 1 custom food, 2. Open micronutrient screen | Micronutrient totals from USDA foods only, data_coverage reflects 2/3 |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User reviews micronutrient gaps | 1. Log a full day of meals (6 USDA foods), 2. Open micronutrient screen, 3. Identify low nutrients | All 21 nutrients displayed; red/amber nutrients indicate dietary gaps; user can see which foods to add |

---

### NU-013: Water Intake Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-013 |
| **Feature Name** | Water Intake Tracking |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As Jordan the Weight Manager, I want to track how much water I drink each day against a daily goal, so that I can maintain adequate hydration which supports my weight management.

**Secondary:**
> As Alex the Active, I want quick-tap buttons to log common water amounts (1 glass, 1 bottle) without typing, so that I can log hydration in under 2 seconds between sets at the gym.

**Tertiary:**
> As Maria the Mindful Eater, I want to see my weekly water intake trends, so that I can identify days when I am not drinking enough.

#### 3.3 Detailed Description

Water Intake Tracking provides a simple, fast interface for logging water consumption throughout the day. Users set a daily water goal (default: 2,500 ml / 84 oz) and log water intake with quick-tap buttons for common amounts. The feature displays a visual progress indicator showing intake versus goal.

Hydration tracking is one of the most requested features in nutrition apps. MyFitnessPal, Cronometer, and standalone apps like WaterMinder all offer this functionality. MyNutrition integrates water tracking directly into the nutrition module rather than requiring a separate app.

The interface is optimized for speed. Logging water should take no more than 2 taps: one to open the water logger and one to tap a preset amount. Users can also enter custom amounts. The water log for the day is displayed as a timeline showing each logged drink with its timestamp.

If the MyFast module is enabled, the water tracker can display hydration during fasting windows, as water consumption is typically allowed during intermittent fasting.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (water tracking is independent of food logging)

**External Dependencies:**
- None (all data is stored locally)

**Assumed Capabilities:**
- Local database is initialized and writable

#### 3.5 User Interface Requirements

##### Screen/Widget: Water Tracker

**Layout:**
- **Goal display:** A large circular water drop progress indicator showing ml consumed vs. goal. Inside the drop: consumed amount (large bold number), "/" separator, goal amount (smaller number), and "ml" label. Below: "X ml remaining" or "Goal reached!" text.
- **Quick-add buttons:** A row of preset buttons: 250 ml (1 glass), 500 ml (water bottle), 750 ml (large bottle), and a "Custom" button. Each button shows the amount and a water icon.
- **Unit toggle:** A small toggle for ml / fl oz display. Preset buttons relabel when toggled (e.g., 250 ml becomes 8 oz).
- **Today's log:** Below the quick-add buttons, a scrollable timeline of water entries for today. Each entry shows: time (e.g., "10:30 AM"), amount (e.g., "500 ml"), and a delete (X) button.
- **The water tracker appears in two contexts:**
  - As a section on the Dashboard (NU-005) - compact view showing just the progress indicator and quick-add buttons
  - As a full screen accessible from the Dashboard "Log Water" button - shows the complete view with timeline

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No water logged | 0 ml consumed | Empty water drop indicator, "0 / [goal] ml", full goal remaining |
| Partial | Some water logged | Partially filled water drop, "X / [goal] ml", remaining amount shown |
| Goal reached | Consumed >= goal | Full water drop with celebratory animation (ripple effect), "Goal reached!" in green |
| Over goal | Consumed > goal by significant amount | Full drop, "X ml over goal" text, no negative connotation (extra water is fine) |
| No goal set | User has not set a water goal | Drop shows consumed amount without progress; "Set a water goal" link below |

**Interactions:**
- Tap a preset button: instantly logs that amount of water with the current timestamp, progress updates immediately, brief haptic feedback
- Tap "Custom": opens a numeric input dialog for entering a custom amount (min: 1 ml, max: 5000 ml)
- Tap delete (X) on a log entry: removes the entry, progress recalculates, shows "Undo" toast for 5 seconds
- Tap the progress indicator: opens the full water tracker screen (if viewing from dashboard compact view)
- Tap unit toggle: switches between ml and fl oz display (1 fl oz = 29.5735 ml)
- Long press a log entry: shows edit option to change the amount

**Transitions/Animations:**
- Water drop fill animates smoothly when water is logged, 300ms
- Quick-add button shows a brief ripple animation on tap, 150ms
- Goal reached triggers a single ripple animation through the drop, 500ms

#### 3.6 Data Requirements

##### Entity: WaterLogEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto | Unique water entry ID |
| date | string | Required, ISO 8601 date | Current date | Calendar date of this entry |
| amount_ml | float | Required, min: 1, max: 5000 | None | Amount of water in milliliters |
| time_logged | datetime | ISO 8601 | Current timestamp | When the water was consumed |
| source | enum | One of: preset, custom, quick_action | "preset" | How this entry was created |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

##### Entity: WaterGoal

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto | Unique goal ID |
| daily_goal_ml | float | Required, min: 500, max: 10000 | 2500 | Daily water intake target in ml |
| preferred_unit | enum | One of: ml, fl_oz | ml | Display unit preference |
| is_active | boolean | - | true | Whether this is the current goal |
| effective_date | string | ISO 8601 date | Current date | When this goal became active |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Relationships:**
- WaterLogEntry is a standalone entity, grouped by date
- WaterGoal is a singleton with history (similar to NutritionGoal)

**Indexes:**
- WaterLogEntry: (date) for daily total query
- WaterLogEntry: (date, time_logged) for timeline display
- WaterGoal: (is_active) for current goal lookup

**Validation Rules:**
- amount_ml must be between 1 and 5000
- daily_goal_ml must be between 500 and 10,000
- date must be a valid calendar date

**Example Data:**

```json
{
  "id": "wl-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "date": "2026-03-06",
  "amount_ml": 500.0,
  "time_logged": "2026-03-06T10:30:00Z",
  "source": "preset",
  "created_at": "2026-03-06T10:30:15Z"
}
```

#### 3.7 Business Logic Rules

##### Daily Water Total

**Purpose:** Calculate total water intake for a given date.

**Inputs:**
- date: string - the calendar date

**Logic:**

```
1. QUERY all WaterLogEntry records WHERE date = input_date
2. total_ml = SUM(amount_ml) across all entries
3. LOOK UP active WaterGoal
4. remaining_ml = goal.daily_goal_ml - total_ml
5. progress_pct = ROUND((total_ml / goal.daily_goal_ml) * 100, 0)
6. IF remaining_ml <= 0:
     status = "goal_reached"
   ELSE:
     status = "in_progress"
7. RETURN { total_ml, goal_ml, remaining_ml, progress_pct, status, entry_count }
```

**Edge Cases:**
- No entries: total is 0 ml
- No goal set: display total without progress; status = "no_goal"
- Goal is reached exactly: status = "goal_reached"
- Total exceeds goal by 2x or more: display normally, no warning (overhydration is rarely a concern for typical users)

##### Unit Conversion (Water)

**Purpose:** Convert water amounts between milliliters and fluid ounces.

**Inputs:**
- amount: float - the numeric value
- from_unit: enum - ml or fl_oz
- to_unit: enum - ml or fl_oz

**Logic:**

```
1. IF from_unit == "ml" AND to_unit == "fl_oz":
     result = ROUND(amount / 29.5735, 1)
2. IF from_unit == "fl_oz" AND to_unit == "ml":
     result = ROUND(amount * 29.5735, 0)
3. RETURN result
```

**Edge Cases:**
- Rounding: ml values are displayed as integers; fl oz values to 1 decimal

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Custom amount is 0 or negative | Inline: "Enter an amount greater than 0" | User corrects the value |
| Custom amount exceeds 5000 ml | Inline: "Maximum single entry is 5,000 ml" | User reduces the amount |
| Database save fails on quick-add | Toast: "Could not log water. Please try again." | User taps the button again |
| No water goal set | Progress indicator shows consumed amount only; "Set a water goal" link | User taps link to set a goal |
| Delete undo expires | Entry is permanently deleted; no further recovery | None needed |

**Validation Timing:**
- Custom amount validation runs on input change
- Quick-add validation is implicit (preset amounts are always valid)
- Daily total recalculates on every add, edit, or delete

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user's water goal is 2,500 ml and they have logged 1,000 ml so far,
   **When** they tap the "500 ml" quick-add button,
   **Then** a new 500 ml entry appears in the timeline, total updates to 1,500 ml, progress shows 60%, and "1,000 ml remaining" displays.

2. **Given** the user has consumed 2,400 ml against a 2,500 ml goal,
   **When** they log another 250 ml,
   **Then** the total reaches 2,650 ml, the water drop indicator fills completely, "Goal reached!" appears with a ripple animation, and "150 ml over goal" shows.

3. **Given** the user toggles the unit from ml to fl oz,
   **When** the display updates,
   **Then** all amounts convert to fluid ounces (e.g., 2,500 ml becomes 84.5 fl oz) and preset buttons relabel (e.g., "8 oz" instead of "250 ml").

**Edge Cases:**

4. **Given** the user has 3 water entries totaling 750 ml,
   **When** they delete the middle entry (250 ml) and tap "Undo" within 5 seconds,
   **Then** the entry reappears and the total returns to 750 ml.

5. **Given** no water goal is set,
   **When** the water tracker displays,
   **Then** consumed amount is shown without a progress ring and a "Set a water goal" link appears.

**Negative Tests:**

6. **Given** the user enters 0 in the custom amount field,
   **When** they try to log it,
   **Then** the system shows "Enter an amount greater than 0"
   **And** no entry is created.

7. **Given** the user enters 6000 ml as a custom amount,
   **When** validation runs,
   **Then** the system shows "Maximum single entry is 5,000 ml"
   **And** no entry is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| daily total from 3 entries | entries: [250, 500, 250] | total: 1000 ml |
| progress percentage | total: 1500, goal: 2500 | progress: 60% |
| goal reached status | total: 2500, goal: 2500 | status: "goal_reached" |
| ml to fl oz conversion | 250 ml | 8.5 fl oz |
| fl oz to ml conversion | 8 fl oz | 237 ml |
| rejects amount of 0 | amount: 0 | validation error |
| rejects amount over 5000 | amount: 5001 | validation error |
| handles no goal | goal: null, total: 500 | status: "no_goal", total: 500 |
| handles empty day | entries: [] | total: 0, remaining: 2500 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Log water and verify dashboard | 1. Tap "Log Water" on dashboard, 2. Tap 500 ml, 3. Return to dashboard | Dashboard water section shows 500 ml progress |
| Delete water entry | 1. Log 500 ml, 2. Delete entry, 3. Check total | Total returns to previous value |
| Change water goal | 1. Set goal to 3000 ml, 2. Log 1000 ml, 3. Check progress | Progress shows 33% (1000/3000) |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User tracks water for a full day | 1. Log 250 ml at 8am, 2. Log 500 ml at 10am, 3. Log 500 ml at 1pm, 4. Log 500 ml at 4pm, 5. Log 250 ml at 7pm, 6. Log 500 ml at 9pm | Total: 2,500 ml, goal reached, 6 entries in timeline, dashboard shows full water progress |

---

### NU-014: Favorite Foods and Quick Add

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-014 |
| **Feature Name** | Favorite Foods and Quick Add |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As Sam the Scanner, I want to mark foods I eat frequently as favorites and log them with one tap, so that I can log my daily breakfast in under 5 seconds.

**Secondary:**
> As Alex the Active, I want a "Quick Add" list of my most common meals with pre-set serving sizes, so that I can log my post-workout shake without adjusting anything.

**Tertiary:**
> As Priya the Parent, I want to create quick-add templates for family meals (e.g., "kids' lunch plate" = PB&J + apple + milk), so that I can log multiple items at once.

#### 3.3 Detailed Description

Favorite Foods and Quick Add reduces food logging friction for repeat meals. Most people eat the same 20-30 foods regularly. By allowing users to favorite foods and create quick-add entries with pre-set serving sizes, MyNutrition transforms a multi-step search-and-log process into a single-tap action.

Favorites are indicated by a heart icon on any food in search results, food detail modals, or the daily food log. Favorited foods appear in the "Favorites" tab of the food search (NU-009) and can be sorted by name, frequency, or recency.

Quick Add goes further than favorites by saving a specific food with a specific serving size as a one-tap logging template. For example, a user can create a Quick Add for "Morning Oatmeal - 1.5 cups" so that tapping it immediately logs 1.5 cups of oatmeal to the current meal without any intermediate screens.

Multi-item Quick Adds (meal templates) allow users to group multiple foods into a single quick-add entry. Tapping a meal template logs all component foods at once. This is particularly useful for routine meals like "Standard Breakfast" (eggs + toast + coffee) or "Gym Shake" (protein powder + banana + milk).

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-001: Food Logging - quick add creates food log entries

**External Dependencies:**
- None

**Assumed Capabilities:**
- Food search (NU-009) shows a favorites tab
- Foods can be displayed with a heart icon for favoriting

#### 3.5 User Interface Requirements

##### Component: Favorite Toggle (Heart Icon)

**Layout:**
- A heart icon (outlined when not favorited, filled when favorited) displayed on:
  - Food search result rows (right side)
  - Food Entry Detail modal (top-right corner)
  - Food log entry rows (accessible via long press context menu)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Not favorited | is_favorite = false | Outlined heart icon |
| Favorited | is_favorite = true | Filled red heart icon |

**Interactions:**
- Tap heart icon: toggles favorite status with a brief scale animation (heart grows and shrinks, 200ms)
- Adding to favorites: toast "Added to favorites"
- Removing from favorites: toast "Removed from favorites" with 5-second undo

##### Screen: Quick Add Manager

**Layout:**
- **Header:** "Quick Adds" with an "Add Quick Add" button (plus icon)
- **Quick add list:** A scrollable list of saved quick-add entries. Each entry shows:
  - Name (user-defined label, e.g., "Morning Oatmeal")
  - Food(s) and serving size(s) (e.g., "Oatmeal - 1.5 cups (360 kcal)")
  - Total calories for the quick add
  - A "Log" button on the right side
  - For multi-item quick adds: shows the count of items and total calories
- **Empty state:** "No quick adds yet. Create one to log your favorite meals instantly." with an "Add Quick Add" button

**Interactions:**
- Tap "Log" on a quick add: immediately creates food log entry(ies) for the current date and auto-assigned meal slot, shows toast "Logged [name] ([X] kcal)"
- Tap the quick add row (not the Log button): opens edit screen to modify name, food, serving size
- Swipe left on a quick add: reveals "Delete" button
- Tap "Add Quick Add": opens a creation flow:
  1. Search and select a food (or multiple foods for a meal template)
  2. Set serving size for each food
  3. Enter a label for the quick add
  4. Save

**Transitions/Animations:**
- "Log" button shows a brief check mark animation on successful log, 300ms
- New quick add rows animate in with slide-down, 200ms

#### 3.6 Data Requirements

##### Entity: QuickAdd

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto | Unique quick add ID |
| label | string | Required, max 200 chars | None | User-defined name for this quick add |
| total_calories | float | Computed, min: 0 | 0 | Total calories across all items |
| item_count | integer | Computed, min: 1 | 1 | Number of food items in this quick add |
| usage_count | integer | Min: 0 | 0 | Number of times this quick add has been used |
| last_used_at | datetime | ISO 8601 | null | When this quick add was last logged |
| sequence | integer | Min: 0 | Auto | Display order in the quick add list |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

##### Entity: QuickAddItem

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto | Unique item ID |
| quick_add_id | string | Required, references QuickAdd.id | None | The quick add this item belongs to |
| food_id | string | Required | None | References the food |
| food_source | enum | One of: usda, open_food_facts, custom, recipe | None | Food source database |
| food_name | string | Required, max 500 chars | None | Denormalized food name |
| quantity | float | Required, min: 0.01 | 1 | Serving quantity |
| serving_unit | string | Required, max 50 chars | "serving" | Serving unit |
| calories | float | Computed, min: 0 | 0 | Calories for this item at the set quantity |
| protein_g | float | Computed | 0 | Protein for this item |
| carbs_g | float | Computed | 0 | Carbs for this item |
| fat_g | float | Computed | 0 | Fat for this item |
| sequence | integer | Min: 0 | 0 | Order within the quick add |

**Relationships:**
- QuickAdd has many QuickAddItem records (one-to-many)
- QuickAddItem references food records via food_id + food_source

**Indexes:**
- QuickAdd: (last_used_at DESC) for sorting by recency
- QuickAdd: (usage_count DESC) for sorting by frequency
- QuickAddItem: (quick_add_id, sequence) for ordered item list

**Validation Rules:**
- label must not be empty
- Each quick add must have at least 1 item
- Each item must have a valid food reference and positive quantity

**Example Data:**

```json
{
  "id": "qa-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "label": "Morning Oatmeal",
  "total_calories": 420.0,
  "item_count": 3,
  "usage_count": 23,
  "last_used_at": "2026-03-06T07:30:00Z",
  "sequence": 0,
  "created_at": "2026-02-01T08:00:00Z",
  "updated_at": "2026-03-01T08:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Quick Add Execution

**Purpose:** Log all items in a quick add as food log entries in one action.

**Inputs:**
- quick_add_id: string - the quick add to execute
- date: string - the target date (defaults to today)
- meal_slot: enum - the target meal (defaults to auto-assigned)

**Logic:**

```
1. LOOK UP QuickAdd and its QuickAddItem records
2. IF meal_slot not provided, auto-assign using Meal Slot Auto-Assignment (NU-001)
3. FOR EACH item in QuickAddItem:
     CREATE a FoodLogEntry with:
       - food_id, food_source, food_name from item
       - quantity, serving_unit from item
       - date = input_date
       - meal_slot = assigned meal
       - all nutrition values from item
       - time_logged = current timestamp
4. INCREMENT QuickAdd.usage_count
5. SET QuickAdd.last_used_at = now
6. RETURN count of entries created
7. SHOW toast: "Logged [label] ([total_calories] kcal)"
```

**Edge Cases:**
- Quick add references a deleted food: log with denormalized data; show info note
- Quick add with 10+ items: all items are logged; toast shows count "Logged 10 items"
- Logging a quick add for a past date: use the past date but current time_logged

##### Favorite Toggle

**Purpose:** Toggle the favorite status of a food in the RecentFood table.

**Inputs:**
- food_id: string
- food_source: enum

**Logic:**

```
1. LOOK UP RecentFood WHERE food_id = input AND food_source = input
2. IF found:
     TOGGLE is_favorite (true to false, or false to true)
     UPDATE record
3. IF NOT found (food has never been logged):
     CREATE new RecentFood with:
       - food_id, food_source
       - food_name, nutrition from source food
       - log_count = 0
       - is_favorite = true
4. RETURN new is_favorite value
```

**Edge Cases:**
- Favoriting a food that has never been logged: create a RecentFood entry with log_count = 0
- Un-favoriting the last favorite: favorites tab shows empty state

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Quick add item references deleted food | Item still shows in quick add with name; logs with denormalized data | User can edit the quick add to replace the item |
| Database save fails on quick add log | Toast: "Could not log [label]. Please try again." | User retries |
| Quick add label empty | Inline: "Enter a name for this quick add" | User fills in label |
| Quick add with no items | "Add at least one food item" on save attempt | User adds a food |
| Favorite toggle fails | Toast: "Could not update favorite. Please try again." | User retries |

**Validation Timing:**
- Label validation runs on blur
- Item count validation runs on save attempt
- Quick add execution runs atomically (all items or none)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has created a quick add "Morning Oatmeal" with oatmeal (1.5 cups), blueberries (0.5 cup), and almond milk (1 cup),
   **When** they tap "Log" on the quick add at 7:30 AM,
   **Then** 3 food log entries are created under Breakfast for today, the total calories match the quick add total, and a toast confirms "Logged Morning Oatmeal (420 kcal)".

2. **Given** the user taps the heart icon on "Greek Yogurt" in search results,
   **When** the toggle completes,
   **Then** the heart fills red, a toast shows "Added to favorites", and Greek Yogurt appears in the Favorites tab.

3. **Given** the user has 5 quick adds sorted by usage count,
   **When** they open the Quick Add Manager,
   **Then** the most frequently used quick add appears first.

**Edge Cases:**

4. **Given** a quick add contains a food that has been deleted from custom foods,
   **When** the user taps "Log",
   **Then** the entry is created using the denormalized food name and nutrition, and a note badge indicates the food source is no longer available.

5. **Given** the user un-favorites their only favorite food,
   **When** the Favorites tab is viewed,
   **Then** the empty state message "No favorites yet" appears.

**Negative Tests:**

6. **Given** the user tries to save a quick add with no label,
   **When** they tap Save,
   **Then** the system shows "Enter a name for this quick add"
   **And** the quick add is not saved.

7. **Given** the user tries to save a quick add with zero items,
   **When** they tap Save,
   **Then** the system shows "Add at least one food item"
   **And** the quick add is not saved.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| quick add creates correct entry count | quick add with 3 items | 3 FoodLogEntry records created |
| quick add uses correct meal slot at 7am | execution at 07:00 | meal_slot: "breakfast" |
| quick add increments usage count | usage_count: 5 before | usage_count: 6 after |
| favorite toggle on unfavorited food | is_favorite: false | is_favorite: true |
| favorite toggle on favorited food | is_favorite: true | is_favorite: false |
| favorite creates RecentFood if missing | food never logged, favorite toggled | RecentFood created with log_count: 0, is_favorite: true |
| quick add total calories computed | items: [200, 150, 70] | total: 420 |
| rejects empty label | label: "" | validation error |
| rejects zero items | items: [] | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create and use quick add | 1. Create "Gym Shake" with protein powder + banana, 2. Tap "Log" on gym shake, 3. Check food log | Two entries in food log matching quick add items |
| Favorite from search and verify tab | 1. Search "apple", 2. Tap heart on first result, 3. Go to Favorites tab | Apple appears in Favorites |
| Delete quick add | 1. Create quick add, 2. Swipe left and delete, 3. Check quick add list | Quick add is removed from list |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User sets up and uses daily meal templates | 1. Create "Weekday Breakfast" quick add (eggs, toast, OJ), 2. Create "Weekday Lunch" quick add (sandwich, apple, water), 3. Log breakfast quick add, 4. Log lunch quick add | 5 food entries logged across 2 meals, dashboard shows correct calorie and macro totals |

---

### NU-015: Copy Meals Between Days

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-015 |
| **Feature Name** | Copy Meals Between Days |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As Sam the Scanner, I want to copy yesterday's lunch to today because I ate the same thing, so that I can log repeat meals without searching for each food again.

**Secondary:**
> As Jordan the Weight Manager, I want to copy my entire meal plan from Monday to Tuesday through Friday, so that I can set up a week of consistent eating in minutes.

**Tertiary:**
> As Priya the Parent, I want to copy a specific meal from one day to another, so that I can quickly log when the family has the same dinner two nights in a row.

#### 3.3 Detailed Description

Copy Meals Between Days enables users to duplicate food log entries from one date to another. This dramatically reduces logging time for users with consistent eating patterns, which research shows is the majority of people. Users can copy a single meal slot (e.g., copy Monday's lunch to Tuesday) or an entire day (copy all of Monday's meals to Tuesday).

The feature builds on the "Copy Yesterday" shortcut introduced in the Dashboard (NU-005) by adding more granular control: users choose the source date, the target date, and which meal slots to copy. Copied entries are new records with new IDs and the target date; they reference the same foods and use the same quantities as the originals.

This feature is accessible from the Daily Food Log (NU-001) via long press on a meal section header ("Copy to...") and from the dashboard via the "Copy Yesterday" quick action.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-001: Food Logging - provides the entries to copy
- NU-006: Meal Categorization - provides meal slot structure

**External Dependencies:**
- None

**Assumed Capabilities:**
- Food log entries exist for at least one date
- Date navigation is available

#### 3.5 User Interface Requirements

##### Modal: Copy Meals

**Layout:**
- **Header:** "Copy Meals" with a close button (X)
- **Source section:**
  - "From" label with a date picker showing the source date (defaults to yesterday)
  - Below the date, a list of meal slots for that date with checkboxes. Each slot shows: meal name, entry count, and calorie total. Only meal slots with entries are shown. A "Select All" toggle at the top.
- **Target section:**
  - "To" label with a date picker showing the target date (defaults to today)
  - If the target date already has entries, a note: "[N] entries already exist for [target date]. Copied entries will be added alongside them."
- **Summary section:**
  - "Will copy [N] entries ([X] kcal) from [source_date] to [target_date]"
- **Action button:** "Copy [N] Entries" primary button (full width)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Source selected | Source date has entries | Meal checkboxes shown with counts and calories |
| No source entries | Source date has no entries | "No meals logged on [date]. Choose a different date." |
| All meals selected | Select All checked | All meal checkboxes checked, summary shows full count |
| Partial selection | Some meals checked | Only checked meals counted in summary |
| Target has entries | Target date already has entries | Info note about existing entries being preserved |

**Interactions:**
- Change source date: meal checkbox list updates for the new date
- Toggle meal checkboxes: summary updates with new count and calorie total
- Toggle "Select All": checks/unchecks all meal slots
- Change target date: info note updates if target has existing entries
- Tap "Copy [N] Entries": executes the copy, shows toast "Copied [N] entries to [target date]", dismisses the modal

**Transitions/Animations:**
- Meal list updates with a fade transition when source date changes, 150ms
- Copy button shows a loading state during copy, 200ms

#### 3.6 Data Requirements

Copy Meals does not introduce new entities. It creates new FoodLogEntry records (NU-001) based on existing entries.

#### 3.7 Business Logic Rules

##### Meal Copy Logic

**Purpose:** Copy selected food log entries from one date to another.

**Inputs:**
- source_date: string - the date to copy from
- target_date: string - the date to copy to
- selected_meal_slots: array of enum - which meal slots to copy (or all)

**Logic:**

```
1. QUERY FoodLogEntry WHERE date = source_date AND meal_slot IN selected_meal_slots
2. IF no entries found:
     RETURN error: "No entries to copy"
3. FOR EACH source_entry:
     CREATE new FoodLogEntry with:
       - id = new UUID
       - food_id, food_source, food_name = same as source
       - date = target_date
       - meal_slot = same as source
       - time_logged = source entry time with target_date
       - quantity, serving_unit, serving_weight_grams = same as source
       - All nutrition values = same as source
       - notes = null (do not copy notes)
4. SAVE all new entries
5. RETURN { copied_count, total_calories }
```

**Edge Cases:**
- Source and target are the same date: allow (user may want to duplicate entries within the same day)
- Target date already has entries in the same meal slot: add copied entries alongside existing ones
- Source has 30+ entries: copy all; no limit on entry count
- Source entry references a deleted food: copy the denormalized data (food_name, nutrition values are stored on the entry)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Source date has no entries | "No meals logged on [date]" in the source section | User selects a different source date |
| No meal slots selected | Copy button disabled; hint: "Select at least one meal to copy" | User checks a meal slot |
| Database write fails during copy | Toast: "Could not copy entries. Please try again." | User retries; partial copies are rolled back |
| Target date is more than 7 days in the future | Warning: "Copying to a date more than 7 days ahead. Continue?" | User confirms or chooses a closer date |

**Validation Timing:**
- Source date validation runs on date change
- Meal selection validation runs on checkbox change
- Copy execution runs as a single transaction (all or nothing)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** yesterday's lunch has 3 entries totaling 650 kcal,
   **When** the user opens Copy Meals, selects yesterday, checks "Lunch" only, and taps "Copy 3 Entries",
   **Then** 3 new entries appear under today's Lunch section with the same foods and nutrition values.

2. **Given** the user wants to copy all of Monday's meals to Wednesday,
   **When** they select Monday as source, Wednesday as target, check "Select All", and copy,
   **Then** all Monday entries appear under Wednesday grouped by their original meal slots.

**Edge Cases:**

3. **Given** today already has 2 breakfast entries and the user copies yesterday's 3 breakfast entries to today,
   **When** the copy completes,
   **Then** today has 5 breakfast entries (2 original + 3 copied), and the breakfast calorie total reflects all 5.

4. **Given** a source entry references a custom food that was later deleted,
   **When** the entry is copied,
   **Then** the copy retains the food name and nutrition values from the denormalized source entry.

**Negative Tests:**

5. **Given** the source date has no food entries,
   **When** the Copy Meals modal opens for that date,
   **Then** "No meals logged on [date]" appears and the copy button is disabled.

6. **Given** the user has not selected any meal checkboxes,
   **When** they look at the copy button,
   **Then** it is disabled with the hint "Select at least one meal to copy."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| copies correct number of entries | 3 entries from source, all selected | 3 new entries created |
| preserves nutrition values | source: 200 kcal, 30g protein | copy: 200 kcal, 30g protein |
| assigns new IDs | source entry id: "abc" | copy entry id: new UUID (not "abc") |
| sets target date | source date: "2026-03-05", target: "2026-03-06" | copy date: "2026-03-06" |
| does not copy notes | source notes: "felt good" | copy notes: null |
| copies only selected meals | 5 entries (3 lunch, 2 dinner), select lunch only | 3 copies created |
| handles empty source | source: 0 entries | error: no entries to copy |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Copy and verify dashboard | 1. Log 5 entries on Monday, 2. Copy all to Tuesday, 3. View Tuesday dashboard | Tuesday shows same calorie and macro totals as Monday |
| Copy specific meal | 1. Log breakfast and lunch on Monday, 2. Copy only breakfast to Tuesday | Tuesday has breakfast entries only; lunch is empty |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User preps the week | 1. Log all meals for Monday, 2. Copy entire day to Tuesday, Wednesday, Thursday, Friday | All 5 weekdays have identical food logs; dashboard shows matching nutrition for each day |

---

### NU-016: Weekly Nutrition Reports

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-016 |
| **Feature Name** | Weekly Nutrition Reports |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As Jordan the Weight Manager, I want to see a weekly summary of my average daily calories and macro adherence, so that I can evaluate whether my eating pattern is aligned with my goals over time rather than obsessing over single days.

**Secondary:**
> As Dr. Chen the Data-Driven, I want a printable weekly nutrition report I can share with my dietitian, so that we can review my eating patterns together at appointments.

**Tertiary:**
> As Maria the Mindful Eater, I want to see which days I logged and which I missed, so that I can build a habit of consistent tracking.

#### 3.3 Detailed Description

Weekly Nutrition Reports aggregate 7 days of food log data into a summary that shows trends, averages, and adherence to goals. While daily tracking is essential for moment-to-moment decisions, weekly reports reveal patterns that daily views miss: are calories trending up over the week? Is protein consistently low on weekends? How many days met the calorie goal?

The report covers a Monday-through-Sunday week (configurable) and includes: average daily calories, average daily macros, goal adherence percentage (how many days met the calorie goal), per-day calorie bar chart, best and worst days, logging streak, and a highlight of top-consumed foods for the week.

Reports are generated on-demand and can be accessed from a Reports tab or screen. Past weeks are browsable. The current (in-progress) week shows partial data with a note indicating incomplete data.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-001: Food Logging - provides the daily food entries
- NU-004: Macronutrient Tracking - provides macro data
- NU-007: Calorie and Macro Goals - provides targets for adherence calculation

**External Dependencies:**
- None

**Assumed Capabilities:**
- At least 1 day of food log data exists

#### 3.5 User Interface Requirements

##### Screen: Weekly Report

**Layout:**
- **Header:** "Week of [date range]" (e.g., "Mar 3 - Mar 9, 2026") with left/right arrows for week navigation
- **Summary cards row:** Three cards showing:
  - Average Daily Calories: "[X] kcal/day" with comparison to goal ("X kcal below/above goal")
  - Goal Adherence: "[X] of 7 days on target" with a percentage
  - Logging Consistency: "[X] of 7 days logged" with a percentage
- **Daily calorie chart:** A bar chart with 7 bars (one per day, Mon-Sun). Each bar shows daily calorie total. A horizontal line indicates the calorie goal. Bars are colored: green if within 10% of goal, amber if 10-20% deviation, red if >20% deviation.
- **Average macros section:** Three horizontal bars showing the week's average protein, carbs, and fat intake in grams compared to goals. Below each bar: "Avg: Xg / Goal: Yg"
- **Top foods section:** A ranked list of the top 10 most-consumed foods for the week, showing: rank, food name, times logged, and total calories from that food
- **Day-by-day breakdown (collapsible):** A table with one row per day showing: date, calories consumed, protein, carbs, fat, number of entries, and a status icon (check for on-target, X for off-target)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Full week | All 7 days have entries | Complete report with all sections |
| Partial week | Current week, some days logged | Report with logged days; unlogged days shown as empty bars; averages computed from logged days only |
| No data | Selected week has no entries | "No food logged during this week" with navigation arrows to find a week with data |
| No goals | Goals not set | Calorie bars shown without goal line; adherence section shows "Set goals to track adherence" |

**Interactions:**
- Tap a bar in the calorie chart: highlights that day and shows a tooltip with the exact calorie total and macro breakdown
- Tap "Day-by-day breakdown": expands/collapses the detailed table
- Tap a top food: navigates to that food's detail showing all the times it was logged that week
- Week navigation arrows: loads the previous/next week's report
- Long press the report: share/export options (text summary, image, PDF)

**Transitions/Animations:**
- Bar chart bars animate from 0 to their values on load, 400ms, staggered 50ms per bar
- Summary card values count up on load, 300ms

#### 3.6 Data Requirements

Weekly reports do not introduce new persistent entities. They compute derived data from FoodLogEntry (NU-001) and NutritionGoal (NU-007).

##### Derived Data: Weekly Report

| Field | Type | Computation | Description |
|-------|------|-------------|-------------|
| week_start | string | Monday of the selected week | Start of the reporting period |
| week_end | string | Sunday of the selected week | End of the reporting period |
| days_logged | integer | COUNT DISTINCT date WHERE entries exist | Number of days with at least 1 entry |
| avg_daily_calories | float | SUM(calories) / days_logged | Average calories per logged day |
| avg_daily_protein_g | float | SUM(protein_g) / days_logged | Average protein per logged day |
| avg_daily_carbs_g | float | SUM(carbs_g) / days_logged | Average carbs per logged day |
| avg_daily_fat_g | float | SUM(fat_g) / days_logged | Average fat per logged day |
| days_on_target | integer | COUNT days WHERE |calories - goal| <= goal * 0.10 | Days within 10% of calorie goal |
| daily_totals | array | Per-day calorie and macro totals | 7-element array with daily summaries |
| top_foods | array | Foods ranked by total calories contributed | Top 10 foods for the week |

#### 3.7 Business Logic Rules

##### Weekly Report Generation

**Purpose:** Compute the weekly nutrition report for a given week.

**Inputs:**
- week_start: string - Monday of the target week
- goal: NutritionGoal - the active goal for adherence calculation

**Logic:**

```
1. SET week_end = week_start + 6 days
2. QUERY all FoodLogEntry WHERE date BETWEEN week_start AND week_end
3. GROUP entries by date to get daily_totals (7 days, some may be empty)
4. days_logged = COUNT of days with at least 1 entry
5. IF days_logged == 0:
     RETURN empty report
6. total_calories = SUM(calories) across all entries
7. avg_daily_calories = ROUND(total_calories / days_logged, 0)
8. Compute avg macros similarly
9. IF goal exists:
     days_on_target = COUNT days WHERE ABS(daily_calories - goal.calorie_goal) <= goal.calorie_goal * 0.10
     adherence_pct = ROUND((days_on_target / 7) * 100, 0)
   ELSE:
     days_on_target = null
     adherence_pct = null
10. TOP FOODS:
     GROUP all entries by food_id
     SUM calories per food_id
     SORT by total_calories DESC
     LIMIT to 10
     INCLUDE: food_name, times_logged, total_calories
11. RETURN weekly_report object
```

**Edge Cases:**
- Only 1 day logged: averages are that day's values; adherence is 1/7 or 0/7
- Week is in the future: return empty report
- Current week (partial): compute from available days; note "Week in progress" in the header
- Goal changed mid-week: use the goal that was active for each day (query goal history by effective_date)
- Days with only water entries (no food): count as "logged" but 0 calories

##### Adherence Calculation

**Purpose:** Determine whether a day was "on target" for the calorie goal.

**Inputs:**
- daily_calories: float - total calories consumed on a specific day
- calorie_goal: float - the goal for that day

**Logic:**

```
1. deviation = ABS(daily_calories - calorie_goal)
2. tolerance = calorie_goal * 0.10  (10% tolerance)
3. IF deviation <= tolerance:
     status = "on_target"
   ELSE IF deviation <= calorie_goal * 0.20:
     status = "close"
   ELSE:
     status = "off_target"
4. RETURN status
```

**Edge Cases:**
- Calorie goal is 0 or null: day cannot be evaluated for adherence; skip
- Day has 0 calories but has logged water: count as a logged day that is off-target

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No data for selected week | "No food logged during this week" message with navigation arrows | User navigates to a different week |
| Goals not set | Adherence section shows "Set goals to track adherence" link | User taps to set goals |
| Partial week data | Report generated from available days; "Week in progress" note | None needed; report is accurate for available data |
| Database query fails | "Could not generate report. Tap to retry." | User retries |

**Validation Timing:**
- Report generation runs on screen load
- Navigating weeks triggers regeneration

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has logged food for all 7 days of the past week averaging 1,900 kcal/day against a 2,000 kcal goal,
   **When** they open the Weekly Report,
   **Then** the report shows avg: 1,900 kcal/day, 7/7 days logged, and the adherence count reflects days within 10% of 2,000.

2. **Given** the bar chart shows 7 bars,
   **When** the user taps on Wednesday's bar,
   **Then** a tooltip appears showing Wednesday's exact calorie total and macro breakdown.

3. **Given** the user has eaten chicken breast 12 times during the week,
   **When** the top foods section displays,
   **Then** chicken breast appears ranked by total calories contributed with "12 times logged."

**Edge Cases:**

4. **Given** the user only logged Monday and Thursday of the past week,
   **When** the report generates,
   **Then** averages are computed from 2 days, 5 bars are empty/gray, and "2 of 7 days logged" appears.

5. **Given** the user's calorie goal changed mid-week from 2,000 to 1,800,
   **When** adherence is calculated,
   **Then** Mon-Wed are evaluated against 2,000 and Thu-Sun against 1,800.

**Negative Tests:**

6. **Given** no food has been logged during the selected week,
   **When** the report attempts to generate,
   **Then** "No food logged during this week" message appears
   **And** no charts or statistics are rendered.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| average from 7 days | totals: [1800, 2000, 1900, 2100, 1950, 2050, 1900] | avg: 1957 |
| average from 3 days (partial week) | totals: [1800, 0, 2000, 0, 0, 1900, 0], logged: [1,3,6] | avg: 1900 |
| adherence on-target within 10% | daily: 1950, goal: 2000 | status: "on_target" |
| adherence off-target > 20% | daily: 1500, goal: 2000 | status: "off_target" |
| top foods ranked correctly | food A: 1500 kcal total, food B: 2000 kcal total | B ranked first |
| handles zero logged days | all days: 0 entries | empty report returned |
| days_on_target counts correctly | 7 days, 5 within 10% of goal | days_on_target: 5 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full week report | 1. Log food for 7 consecutive days, 2. Open weekly report for that week | All metrics display correctly, all 7 bars populated |
| Navigate between weeks | 1. View this week's report, 2. Tap left arrow, 3. View last week's report | Each week shows its own data independently |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User reviews weekly performance | 1. Track food for a full week, 2. Open weekly report, 3. Identify top foods and adherence | Complete weekly summary with all charts, averages, and top foods; adherence percentage shown |

---

### NU-017: Streak Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-017 |
| **Feature Name** | Streak Tracking |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As Jordan the Weight Manager, I want to see how many consecutive days I have logged my food, so that I am motivated to maintain my tracking habit and not break my streak.

**Secondary:**
> As Maria the Mindful Eater, I want to see my longest-ever logging streak, so that I can feel proud of my consistency and aim to beat my record.

**Tertiary:**
> As Sam the Scanner, I want a streak notification to remind me to log when I have not logged anything by evening, so that I do not accidentally break my streak.

#### 3.3 Detailed Description

Streak Tracking counts consecutive days the user has logged at least one food entry. The current streak is prominently displayed on the Dashboard (NU-005) as a motivational element. Streaks are a proven habit-building mechanic used by apps like Duolingo, Snapchat, and Apple Fitness.

A day "counts" toward the streak if it has at least 1 FoodLogEntry (water entries alone do not count). The streak breaks if a full calendar day passes with zero food log entries. The system tracks both the current streak and the longest (all-time best) streak.

Users can optionally enable a streak reminder notification that fires at a configurable time (default: 8:00 PM) on days when no food has been logged. This provides a gentle nudge without being intrusive.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-001: Food Logging - streak is based on food log entries

**External Dependencies:**
- Optional: push notification permission for streak reminders

**Assumed Capabilities:**
- Database can query distinct dates with food log entries

#### 3.5 User Interface Requirements

##### Component: Streak Badge (Dashboard)

**Layout:**
- A compact card on the Dashboard showing: a flame icon, the current streak number (large bold text), and "day streak" label
- Below: "Best: X days" showing the all-time longest streak
- If streak is 0: shows "Start your streak! Log food today." with no flame icon

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Active streak | Current streak > 0 | Flame icon (animated glow), streak count, "day streak" |
| Streak milestone | Streak hits 7, 14, 30, 60, 90, 180, 365 | Flame icon with special color (bronze/silver/gold), milestone badge: "1 week!", "2 weeks!", "1 month!", etc. |
| No streak | 0 consecutive days | Gray flame icon, "Start your streak! Log food today." |
| New record | Current streak > longest streak | Extra "New record!" badge with confetti animation |

**Interactions:**
- Tap the streak badge: navigates to the streak detail screen
- Streak milestone: a one-time celebration animation (confetti burst, 1 second) plays when the milestone is first reached

##### Screen: Streak Detail

**Layout:**
- Current streak: large number with flame animation
- Longest streak: number with crown icon
- Calendar heatmap: a grid showing the past 90 days, each cell colored: green (logged), gray (not logged), today's cell highlighted
- Streak history: a list of past streaks showing: start date, end date, length in days

**Interactions:**
- Tap a day on the calendar heatmap: shows a tooltip with that day's calorie total (or "No food logged")
- Scroll: calendar extends further into the past

#### 3.6 Data Requirements

##### Entity: StreakRecord

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto | Unique record ID |
| current_streak | integer | Min: 0 | 0 | Current consecutive days logged |
| longest_streak | integer | Min: 0 | 0 | All-time longest streak |
| streak_start_date | string | ISO 8601 date | null | Start date of current streak |
| last_logged_date | string | ISO 8601 date | null | Most recent date with food entries |
| reminder_enabled | boolean | - | false | Whether streak reminder is active |
| reminder_time | string | HH:MM format | "20:00" | Time to send streak reminder |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

**Relationships:**
- StreakRecord is a singleton (one per user)
- Streak is computed from FoodLogEntry dates

**Indexes:**
- None needed (singleton)

**Validation Rules:**
- current_streak must be non-negative
- longest_streak must be >= current_streak
- reminder_time must be a valid HH:MM between 00:00 and 23:59

#### 3.7 Business Logic Rules

##### Streak Calculation

**Purpose:** Compute the current streak length by counting consecutive days with at least 1 food log entry.

**Inputs:**
- today: string - current calendar date

**Logic:**

```
1. QUERY DISTINCT dates from FoodLogEntry, ordered by date DESC
2. SET streak = 0
3. SET check_date = today
4. IF today has no food entries AND yesterday has no food entries:
     streak = 0
     RETURN
5. IF today has no food entries BUT yesterday has entries:
     SET check_date = yesterday
     (today is not over yet; give credit for yesterday as current)
6. WHILE check_date has at least 1 FoodLogEntry:
     streak = streak + 1
     check_date = check_date - 1 day
7. SET streak_start_date = check_date + 1 day (the first day of the streak)
8. IF streak > longest_streak:
     longest_streak = streak
9. UPDATE StreakRecord with current_streak, longest_streak, streak_start_date, last_logged_date
10. RETURN { current_streak, longest_streak, streak_start_date }
```

**Edge Cases:**
- User logs food at 11:59 PM: counts for today (the logging date)
- User has not logged today but it is early morning: check yesterday; if yesterday is logged, show yesterday's streak as current (streak is not broken until midnight passes with no entries)
- User backfills a past date: recalculate streak (could extend if the backfill bridges a gap)
- First ever food entry: streak = 1
- User deletes their only entry for today: streak recalculates; today may no longer count

##### Streak Milestones

**Purpose:** Identify when the user reaches a streak milestone for celebration.

**Logic:**

```
Milestones: [7, 14, 30, 60, 90, 180, 365]
Labels: ["1 week!", "2 weeks!", "1 month!", "2 months!", "3 months!", "6 months!", "1 year!"]

1. AFTER updating current_streak:
     FOR EACH milestone in milestones:
       IF current_streak == milestone:
         TRIGGER celebration animation
         SHOW milestone badge for 24 hours
         BREAK (show only the most recent milestone)
```

**Edge Cases:**
- User reaches 365 and keeps going: no further milestones defined; the streak number continues incrementing
- User re-reaches a milestone after breaking a streak: celebrate again (milestones are per-streak, not per-user)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Streak calculation fails | Streak badge shows "..." (loading) | Recalculates on next app open |
| Reminder notification permission denied | Reminder toggle shows "Notifications are off" with a link to device settings | User enables notifications in settings |
| Streak data corrupted (current > longest) | Auto-correct: set longest = current | None needed; self-healing |

**Validation Timing:**
- Streak recalculates on every food log add or delete
- Streak check runs on app launch (to detect day rollover)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has logged food for 7 consecutive days,
   **When** the Dashboard loads,
   **Then** the streak badge shows "7" with a flame icon and a "1 week!" milestone badge with a celebration animation.

2. **Given** the user's current streak is 15 days and their longest streak is 12 days,
   **When** the streak badge displays,
   **Then** it shows "15" with a "New record!" badge.

3. **Given** the user taps the streak badge,
   **When** the streak detail screen opens,
   **Then** the calendar heatmap shows green cells for the last 15 consecutive days and gray cells for days before the streak began.

**Edge Cases:**

4. **Given** the user has not logged food today but it is only 10 AM and yesterday was day 7 of their streak,
   **When** the streak badge displays,
   **Then** it shows "7" (yesterday's streak count is current; today is not yet over).

5. **Given** the user backfills a missed day that was in the middle of two streaks,
   **When** the streak recalculates,
   **Then** the two streaks merge into one continuous streak.

**Negative Tests:**

6. **Given** the user has never logged food,
   **When** the streak badge displays,
   **Then** it shows "Start your streak! Log food today." with a gray flame icon.

7. **Given** the user broke their streak yesterday (no entries),
   **When** the streak badge displays today (also no entries),
   **Then** the streak shows 0.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| streak of 5 consecutive days | dates: [Mar 2-6], today: Mar 6 | current_streak: 5 |
| streak breaks on gap | dates: [Mar 1,2,3,5,6], today: Mar 6 | current_streak: 2 (Mar 5-6) |
| streak counts today even if early | dates: [Mar 4,5], today: Mar 5 (no entry yet for today) | current_streak: 1 (Mar 4) - today is not over |
| first entry starts streak at 1 | dates: [Mar 6], today: Mar 6 | current_streak: 1 |
| longest streak updates | current: 10, longest: 8 | longest: 10 |
| longest streak does not downgrade | current: 3, longest: 10 | longest: 10 |
| milestone at day 7 | current_streak: 7 | milestone: "1 week!" |
| milestone at day 30 | current_streak: 30 | milestone: "1 month!" |
| no milestone at day 8 | current_streak: 8 | milestone: null |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Log food and verify streak increment | 1. Streak is 3, 2. Log food today, 3. Check streak | Streak shows 4 |
| Delete only entry and verify streak | 1. Streak is 5, today has 1 entry, 2. Delete entry | Streak recalculates (may drop to 4 or 0) |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User builds a 7-day streak | 1. Log food each day for 7 days, 2. Check dashboard on day 7 | Streak badge shows 7 with "1 week!" milestone, confetti animation, heatmap shows 7 green cells |

---

### NU-018: Calorie Deficit/Surplus Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-018 |
| **Feature Name** | Calorie Deficit/Surplus Tracking |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As Jordan the Weight Manager, I want to see my daily and weekly calorie deficit relative to my TDEE, so that I can verify I am on track to lose my target amount of weight per week.

**Secondary:**
> As Alex the Active, I want to see my weekly calorie surplus to confirm I am eating enough to support muscle gain, so that I can adjust if I am under-eating for my bulking phase.

**Tertiary:**
> As Dr. Chen the Data-Driven, I want to see a running 7-day average deficit/surplus trend, so that I can observe whether my eating pattern is consistently aligned with my goal or just occasionally hitting targets.

#### 3.3 Detailed Description

Calorie Deficit/Surplus Tracking provides visibility into the difference between calories consumed and calories burned (TDEE). A deficit means the user ate less than they burned (leading to weight loss), and a surplus means they ate more (leading to weight gain). This is the core metric for anyone with a weight goal.

The feature displays the daily deficit/surplus (TDEE minus calories consumed), a rolling 7-day average, and a cumulative weekly total. It also projects the expected weight change based on the weekly deficit/surplus using the standard conversion of 7,700 kcal per kilogram of body weight.

This feature goes beyond the simple "calories remaining" display on the Dashboard (NU-005) by incorporating TDEE as the reference point rather than just the calorie goal. If a user's calorie goal is already a deficit (e.g., TDEE of 2,500 minus 500 = 2,000 goal), this feature shows the actual deficit achieved, which may differ from the planned deficit if the user over- or under-eats.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-007: Calorie and Macro Goals - provides the calorie goal
- NU-008: BMR and TDEE Calculator - provides the TDEE baseline

**External Dependencies:**
- None

**Assumed Capabilities:**
- TDEE has been calculated (body stats entered)
- Food log entries exist

#### 3.5 User Interface Requirements

##### Screen: Deficit/Surplus Tracker

**Layout:**
- **Header:** "Calorie Balance" with date navigation
- **Daily balance card:**
  - Title: "Today's Balance"
  - TDEE line: "TDEE: [X] kcal" (from body stats)
  - Consumed line: "Consumed: [X] kcal" (from food log)
  - Balance line: "[X] kcal deficit" (green) or "[X] kcal surplus" (amber/red for unintended, green for bulking)
  - Visual: a horizontal gauge with TDEE as the center point, consumed amount shown as a marker
- **Weekly summary card:**
  - "This Week's Balance"
  - Total deficit/surplus for the week
  - Daily average deficit/surplus
  - Projected weight change: "At this rate: [X] kg/week [loss/gain]"
- **7-day trend chart:** A line chart showing daily balance (deficit or surplus) for the past 7 days. The x-axis is dates, y-axis is kcal. A zero line separates deficit (below) from surplus (above). Each point is color-coded: green for deficit (when goal is to lose), red for surplus (when goal is to lose), and vice versa for bulking.
- **Rolling average line:** A secondary line on the chart showing the 7-day rolling average balance

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Deficit | Consumed < TDEE | Balance shown in green with a down arrow; "deficit" label |
| Surplus | Consumed > TDEE | Balance shown in amber/green (context-dependent) with an up arrow; "surplus" label |
| Balanced | Consumed within 2% of TDEE | Balance shown in blue; "balanced" label |
| No TDEE | Body stats not entered | "Enter your body stats to calculate TDEE" link to NU-008 |
| No food logged | TDEE exists but no food entries | Balance equals full TDEE as deficit; note "No food logged today" |

**Interactions:**
- Tap daily balance card: shows a breakdown by meal (how much each meal contributed to the balance)
- Tap a point on the 7-day chart: shows tooltip with that day's exact numbers
- Tap weekly summary: navigates to the full Weekly Report (NU-016)
- Tap "Enter your body stats": navigates to TDEE calculator (NU-008)

#### 3.6 Data Requirements

Deficit/surplus tracking does not introduce new entities. It computes derived data from FoodLogEntry (NU-001), UserBodyStats (NU-008), and NutritionGoal (NU-007).

##### Derived Data: Daily Calorie Balance

| Field | Type | Computation | Description |
|-------|------|-------------|-------------|
| date | string | Target date | The day being analyzed |
| tdee | float | From UserBodyStats | Estimated daily energy expenditure |
| consumed | float | SUM(FoodLogEntry.calories) for date | Total calories consumed |
| balance | float | consumed - tdee | Positive = surplus, negative = deficit |
| balance_abs | float | ABS(balance) | Absolute difference |
| balance_type | enum | deficit / surplus / balanced | Classification of the balance |
| projected_weekly_kg | float | (balance * 7) / 7700 | Estimated weekly weight change at this rate |

#### 3.7 Business Logic Rules

##### Daily Balance Calculation

**Purpose:** Calculate the daily calorie balance (deficit or surplus).

**Inputs:**
- date: string - the target calendar date
- tdee: float - user's TDEE from body stats

**Logic:**

```
1. QUERY total calories consumed for date from FoodLogEntry
2. balance = consumed - tdee
3. IF ABS(balance) <= tdee * 0.02:
     balance_type = "balanced"
   ELSE IF balance < 0:
     balance_type = "deficit"
   ELSE:
     balance_type = "surplus"
4. RETURN { consumed, tdee, balance, balance_type }
```

**Edge Cases:**
- No food logged: consumed = 0, balance = -tdee (full deficit)
- TDEE is null: cannot compute; show prompt to enter body stats
- Consumed exactly equals TDEE: balance_type = "balanced"

##### Weekly Deficit/Surplus Aggregation

**Purpose:** Compute total and average deficit/surplus over 7 days.

**Inputs:**
- week_dates: array of 7 dates
- tdee: float - user's TDEE (assumed constant for the week)

**Logic:**

```
1. FOR EACH date in week_dates:
     COMPUTE daily_balance using Daily Balance Calculation
2. total_balance = SUM(daily_balance) across all 7 days
3. days_with_data = COUNT days with at least 1 food entry
4. avg_daily_balance = total_balance / days_with_data
5. projected_weekly_weight_kg = total_balance / 7700
   (negative = weight loss, positive = weight gain)
6. projected_weekly_weight_lbs = projected_weekly_weight_kg * 2.20462
7. RETURN { total_balance, avg_daily_balance, projected_weekly_weight_kg, days_with_data }
```

**Edge Cases:**
- Only 1 day logged: weekly projection is based on that single day (less reliable)
- No days logged: return null projections
- TDEE changed mid-week: use the TDEE that was active for each day

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| TDEE not calculated | "Enter your body stats to see your calorie balance" link | User navigates to TDEE calculator |
| No food logged for the day | Balance shows full deficit (consumed = 0) with note "No food logged today" | User logs food |
| Body stats outdated (>90 days old) | Info banner: "Your body stats were last updated [X] days ago. Update for more accurate balance tracking." | User updates body stats |

**Validation Timing:**
- Daily balance recalculates whenever food is logged, edited, or deleted
- Weekly aggregation recalculates on screen load

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user's TDEE is 2,500 kcal and they consumed 2,000 kcal today,
   **When** the deficit tracker displays,
   **Then** it shows "500 kcal deficit" in green, and projected weight change shows "Approximately 0.45 kg/week loss."

2. **Given** the user has 7 days of data with an average deficit of 400 kcal/day,
   **When** the weekly summary displays,
   **Then** total weekly deficit is 2,800 kcal, and projected weight change is "0.36 kg/week loss."

3. **Given** the user taps a point on the 7-day chart for Wednesday,
   **When** the tooltip appears,
   **Then** it shows Wednesday's TDEE, consumed, and balance values.

**Edge Cases:**

4. **Given** the user's goal is to gain weight and they consumed 3,000 kcal against a TDEE of 2,500,
   **When** the balance displays,
   **Then** "500 kcal surplus" appears in green (surplus is positive for bulking goals).

5. **Given** the user has not entered body stats,
   **When** the deficit tracker screen opens,
   **Then** a prompt appears: "Enter your body stats to see your calorie balance" with a link to the TDEE calculator.

**Negative Tests:**

6. **Given** no food has been logged today,
   **When** the daily balance calculates,
   **Then** consumed shows 0, balance shows the full TDEE as deficit, and a note reads "No food logged today."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| deficit calculation | consumed: 1800, tdee: 2500 | balance: -700, type: "deficit" |
| surplus calculation | consumed: 3000, tdee: 2500 | balance: 500, type: "surplus" |
| balanced within 2% | consumed: 2480, tdee: 2500 | type: "balanced" |
| weekly projection from 500 deficit | balance: -500/day * 7 = -3500 | projected: -0.45 kg/week |
| weekly projection from 300 surplus | balance: 300/day * 7 = 2100 | projected: 0.27 kg/week |
| handles no food logged | consumed: 0, tdee: 2000 | balance: -2000, type: "deficit" |
| handles null tdee | tdee: null | error: TDEE required |
| average from partial week | 3 days: [-500, -400, -600], 4 days: no data | avg: -500/day |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Log food and check balance | 1. TDEE: 2500, 2. Log 2000 kcal food, 3. Open deficit tracker | Shows 500 kcal deficit |
| Weekly balance after 7 days | 1. Log food for 7 days, 2. Open deficit tracker | Weekly total and projection shown |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User tracks deficit for weight loss | 1. Set up body stats, 2. Calculator shows TDEE of 2500, 3. Set goal to 2000 (500 deficit), 4. Track food for a week, 5. Review deficit tracker | 7-day chart shows daily balances, weekly projection shows expected weight loss |

---

### NU-019: Meal Planning

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-019 |
| **Feature Name** | Meal Planning |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As Priya the Parent, I want to plan my family's meals for the week ahead of time and see the nutritional breakdown before cooking, so that I can ensure balanced nutrition across the week.

**Secondary:**
> As Jordan the Weight Manager, I want to pre-plan tomorrow's meals so that I can see whether they fit my calorie goal before I eat, so that I make proactive choices instead of reactive ones.

**Tertiary:**
> As Alex the Active, I want to create a meal plan template for training days vs. rest days, so that I can cycle between pre-built plans without re-entering foods every time.

#### 3.3 Detailed Description

Meal Planning lets users schedule foods for future dates. Instead of logging reactively after eating, users can plan ahead: add foods to tomorrow's or next week's meals before consuming them. When the planned date arrives, the user can confirm the plan (converting planned entries to actual log entries) or adjust as needed.

A meal plan shows the same structure as the daily food log (meals divided into breakfast, lunch, dinner, snack) but with a "Planned" status instead of "Logged." Planned entries appear in a distinct visual style (e.g., lighter opacity, dashed border) to distinguish them from confirmed entries. Planned entries contribute to projected calorie and macro totals for the day, allowing users to evaluate whether their plan meets their goals before executing it.

Users can create meal plan templates (reusable plan structures) that can be applied to any date or date range. For example, a "Cutting Day" template with 1,800 kcal worth of planned meals can be applied to Monday through Friday in one action.

If the MyRecipes module is enabled, planned meals can pull from saved recipes, further streamlining the planning process.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-001: Food Logging - planned entries convert to food log entries
- NU-006: Meal Categorization - plans use the same meal slot structure

**External Dependencies:**
- None

**Assumed Capabilities:**
- Date navigation supports future dates
- Food search is available for selecting planned foods

#### 3.5 User Interface Requirements

##### Screen: Meal Planner

**Layout:**
- **Header:** "Meal Plan" with a date selector (day view or week view toggle)
- **Day view:** Identical layout to the Daily Food Log (NU-001) but with planned entries shown in a distinct style:
  - Planned entry rows have a dashed left border and slightly reduced opacity
  - A "Confirm" button on each planned entry to convert it to a logged entry
  - A "Confirm All" button at the top to convert all planned entries to logged entries at once
  - The calorie and macro summary shows projected totals from planned + logged entries combined
- **Week view:** A 7-column grid (Mon-Sun) with each column showing:
  - Date header
  - Compact meal summaries (meal name + calorie total per meal)
  - Daily calorie total at the bottom of each column
  - Color coding: green if total is within 10% of goal, amber/red otherwise
- **Templates section (accessible via a "Templates" tab):**
  - A list of saved meal plan templates
  - Each template shows: name, total calories, meal count
  - "Apply Template" button to apply to a selected date or date range
  - "Create Template from Day" to save the current day's plan as a template

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No planned entries for the date | "Plan your meals" prompt with "Add Food" and "Apply Template" buttons |
| Planned | Entries exist but none confirmed | All entries shown in planned style (dashed border) |
| Mixed | Some planned, some confirmed | Confirmed entries in standard style, planned in dashed style |
| All confirmed | All entries confirmed | Identical to normal Daily Food Log |

**Interactions:**
- Tap "Add Food" in a meal section: opens food search to add a planned entry
- Tap "Confirm" on a planned entry: converts it to a logged entry (changes style to solid, sets time_logged to now)
- Tap "Confirm All": converts all planned entries for the day
- Tap a planned entry: opens edit dialog (change food, quantity, or delete)
- Toggle between day view and week view
- Tap a column in week view: navigates to that day's day view
- Tap "Apply Template": opens template selection, then date/range selection
- Drag and drop (week view): reorder or move planned entries between days

#### 3.6 Data Requirements

##### Entity: MealPlanEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto | Unique plan entry ID |
| food_id | string | Required | None | References the food |
| food_source | enum | One of: usda, open_food_facts, custom, recipe | None | Food source |
| food_name | string | Required, max 500 chars | None | Denormalized food name |
| date | string | Required, ISO 8601 date | None | The planned date |
| meal_slot | enum | One of: breakfast, lunch, dinner, snack | None | Meal assignment |
| quantity | float | Required, min: 0.01 | 1 | Planned serving quantity |
| serving_unit | string | Required, max 50 chars | "serving" | Serving unit |
| calories | float | Computed, min: 0 | 0 | Planned calories |
| protein_g | float | Computed | 0 | Planned protein |
| carbs_g | float | Computed | 0 | Planned carbs |
| fat_g | float | Computed | 0 | Planned fat |
| status | enum | One of: planned, confirmed | "planned" | Whether this entry has been confirmed |
| confirmed_at | datetime | ISO 8601 | null | When the entry was confirmed |
| food_log_entry_id | string | References FoodLogEntry.id | null | The created food log entry (after confirmation) |
| template_id | string | References MealPlanTemplate.id | null | Template this entry came from (if any) |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last update time |

##### Entity: MealPlanTemplate

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto | Unique template ID |
| name | string | Required, max 200 chars | None | Template name (e.g., "Cutting Day") |
| total_calories | float | Computed | 0 | Total calories for all entries |
| entry_count | integer | Computed, min: 1 | 0 | Number of entries in template |
| usage_count | integer | Min: 0 | 0 | Times this template has been applied |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last update time |

**Relationships:**
- MealPlanEntry may reference a MealPlanTemplate
- MealPlanEntry converts to FoodLogEntry on confirmation (linked via food_log_entry_id)

**Indexes:**
- MealPlanEntry: (date, meal_slot) for daily plan view
- MealPlanEntry: (date, status) for filtering planned vs. confirmed
- MealPlanTemplate: (name) for search

**Validation Rules:**
- date must be a valid calendar date (past dates allowed for backfilling)
- meal_slot is required
- quantity must be positive
- template must have at least 1 entry

#### 3.7 Business Logic Rules

##### Plan Confirmation

**Purpose:** Convert a planned entry to a logged food entry.

**Inputs:**
- plan_entry_id: string - the planned entry to confirm

**Logic:**

```
1. LOOK UP MealPlanEntry by plan_entry_id
2. IF status == "confirmed": RETURN (already confirmed)
3. CREATE new FoodLogEntry with:
     - food_id, food_source, food_name from plan entry
     - date = plan entry date
     - meal_slot = plan entry meal_slot
     - quantity, serving_unit from plan entry
     - All nutrition values from plan entry
     - time_logged = current timestamp
4. SET plan_entry.status = "confirmed"
5. SET plan_entry.confirmed_at = now
6. SET plan_entry.food_log_entry_id = new entry ID
7. RETURN new FoodLogEntry
```

**Edge Cases:**
- Confirming an entry for a past date: set time_logged to a reasonable time for the meal slot on the past date
- Food referenced by plan has been deleted: use denormalized data
- Confirming all entries: process as a batch with a single database transaction

##### Template Application

**Purpose:** Apply a meal plan template to one or more dates.

**Inputs:**
- template_id: string - the template to apply
- target_dates: array of strings - the dates to apply to

**Logic:**

```
1. LOOK UP MealPlanTemplate and its entries
2. FOR EACH target_date in target_dates:
     FOR EACH template_entry:
       CREATE new MealPlanEntry with:
         - All food and nutrition data from template entry
         - date = target_date
         - status = "planned"
         - template_id = input template_id
3. INCREMENT template.usage_count
4. RETURN count of entries created
```

**Edge Cases:**
- Target date already has planned entries: add template entries alongside existing ones
- Applying to 7 dates with a 5-entry template: creates 35 plan entries
- Template references a deleted food: use denormalized data, show warning badge

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Confirmation fails | Toast: "Could not confirm entry. Please try again." | User retries |
| Template with deleted food references | Warning badge on affected entries in template preview | User can edit template to replace the food |
| No templates exist | Templates tab shows empty state with "Create your first template" button | User creates a template |
| Template name empty | Inline: "Enter a template name" | User provides a name |

**Validation Timing:**
- Plan entry validation runs on creation (same as food log entry validation)
- Template validation runs on save
- Confirmation validation runs before creating the food log entry

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user plans tomorrow's meals by adding 3 foods to breakfast and 2 to lunch,
   **When** they view tomorrow in the planner,
   **Then** 5 planned entries appear with dashed borders, and the projected calorie total for the day reflects all 5 entries.

2. **Given** the user taps "Confirm All" on a day with 6 planned entries,
   **When** confirmation completes,
   **Then** all 6 entries convert to logged entries (solid style), 6 FoodLogEntry records are created, and the dashboard totals update.

3. **Given** the user saves a "Training Day" template from Monday's plan,
   **When** they apply it to Wednesday and Friday,
   **Then** both Wednesday and Friday show identical planned entries matching Monday's meals.

**Edge Cases:**

4. **Given** a planned entry exists for today and the user also logs a different food manually,
   **When** the day view displays,
   **Then** the manual entry appears in solid style and the planned entry in dashed style, both contributing to the day's projected total.

5. **Given** the user applies a template to a date that already has 3 planned entries,
   **When** the template is applied,
   **Then** the template entries are added alongside the existing 3 entries.

**Negative Tests:**

6. **Given** the user tries to confirm a planned entry that has already been confirmed,
   **When** confirmation is attempted,
   **Then** no duplicate food log entry is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| plan confirmation creates FoodLogEntry | planned entry with 300 kcal | FoodLogEntry created with 300 kcal |
| plan confirmation sets status | planned entry, status: "planned" | status becomes "confirmed" |
| template creates correct entry count | template: 4 entries, dates: [Mon, Tue, Wed] | 12 MealPlanEntry records |
| projected total includes planned + logged | planned: 500 kcal, logged: 300 kcal | projected total: 800 kcal |
| double confirmation is no-op | already confirmed entry | no new FoodLogEntry, no error |
| rejects empty template name | name: "" | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Plan and confirm meals | 1. Plan 3 meals for tomorrow, 2. Navigate to tomorrow, 3. Confirm all | 3 food log entries created, dashboard shows totals |
| Create and apply template | 1. Plan a day, 2. Save as template, 3. Apply to 3 other days | 3 days have identical planned entries |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User plans a full week | 1. Create "Cutting Day" template, 2. Create "Rest Day" template, 3. Apply Cutting to Mon/Wed/Fri, 4. Apply Rest to Tue/Thu, 5. View week planner | Week view shows 5 planned days with appropriate calorie targets per template |

---

### NU-020: Weight Goal Integration

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-020 |
| **Feature Name** | Weight Goal Integration |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As Jordan the Weight Manager, I want to set a target weight and a target date, and have the app calculate the daily calorie budget needed to reach that goal, so that I have a clear, time-bound plan.

**Secondary:**
> As Alex the Active, I want to log my daily weigh-ins and see a weight trend chart overlaid with my calorie data, so that I can see the correlation between what I eat and how my weight changes.

**Tertiary:**
> As Dr. Chen the Data-Driven, I want to compare my actual weight change to the projected weight change based on my deficit, so that I can calibrate my TDEE estimate over time.

#### 3.3 Detailed Description

Weight Goal Integration connects nutrition tracking to concrete weight objectives. Users set a starting weight, a goal weight, and a target date. The system calculates the required daily calorie deficit or surplus, validates that the rate is safe (0.25-1.0 kg/week for weight loss, 0.25-0.5 kg/week for gain), and adjusts the calorie goal accordingly.

The feature includes a simple weigh-in logger where users record their daily or weekly weight. A weight trend chart shows actual weight over time alongside the projected weight path based on calorie data. This provides feedback on whether the calorie plan is working as expected.

The weight trend uses a 7-day exponential moving average to smooth out daily fluctuations caused by water retention, meal timing, and other factors. This prevents users from being discouraged by normal day-to-day weight swings of 0.5-2 kg.

If the user's actual weight loss/gain rate differs significantly from the projected rate for 2+ consecutive weeks, the system suggests recalibrating TDEE. This accounts for metabolic adaptation and inaccuracies in the initial TDEE estimate.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-008: BMR and TDEE Calculator - provides TDEE for calorie calculations
- NU-018: Calorie Deficit/Surplus Tracking - provides deficit data for projection

**External Dependencies:**
- None

**Assumed Capabilities:**
- User has entered body stats (weight, height, age)
- Calorie goals have been set

#### 3.5 User Interface Requirements

##### Screen: Weight Goal

**Layout:**
- **Goal setup section:**
  - Current weight display (from body stats) with a "Weigh In" button
  - Goal weight numeric input (kg or lbs, matching preferred unit)
  - Target date picker (minimum 2 weeks from today, maximum 2 years)
  - Required deficit/surplus display: "You need a [X] kcal/day [deficit/surplus] to reach your goal"
  - Rate display: "[X] kg/week [loss/gain]"
  - Safety check: green check if rate is 0.25-1.0 kg/week loss or 0.25-0.5 kg/week gain; amber warning if rate is higher
- **Weight chart section:**
  - A line chart showing weight over time (past 90 days default, adjustable range)
  - Primary line: actual weigh-in data points
  - Trend line: 7-day exponential moving average (smoother curve)
  - Projected line: dashed line from current weight to goal weight at goal date
  - Goal weight shown as a horizontal target line
- **Weigh-in log:** Below the chart, a scrollable list of weigh-in entries showing date, weight, and change from previous entry. Most recent at top.

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No goal set | No weight goal configured | Setup form with "Set Weight Goal" prompt |
| Goal active | Goal set and in progress | Chart with goal line, rate info, and progress |
| On track | Trend line is within 10% of projected path | Green "On Track" badge |
| Behind | Trend line is > 10% behind projected path | Amber "Behind Schedule" with suggestion to review calorie intake |
| Ahead | Trend line is > 10% ahead of projected path | Blue "Ahead of Schedule" badge |
| Goal reached | Current weight <= goal weight (loss) or >= goal weight (gain) | Celebration message: "Goal Reached!" with confetti |
| No weigh-ins | Goal set but no weight data logged | Chart empty with "Log your first weigh-in" prompt |

**Interactions:**
- Tap "Weigh In": opens a quick entry dialog with numeric input (defaults to last recorded weight), date (defaults to today), and Save button
- Pinch-to-zoom on weight chart: adjusts time range
- Tap a point on the chart: shows tooltip with date, weight, and trend weight
- Tap "Edit Goal": returns to goal setup with current values pre-filled
- Swipe left on a weigh-in entry: delete with undo

#### 3.6 Data Requirements

##### Entity: WeightGoal

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto | Unique goal ID |
| start_weight_kg | float | Required, min: 20 | None | Weight when goal was set |
| goal_weight_kg | float | Required, min: 20 | None | Target weight |
| target_date | string | Required, ISO 8601 date | None | Date to reach goal by |
| required_daily_adjustment | float | Computed | None | Kcal/day deficit (negative) or surplus (positive) |
| weekly_rate_kg | float | Computed | None | Projected kg/week change |
| is_active | boolean | - | true | Whether this is the current goal |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

##### Entity: WeighIn

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto | Unique record ID |
| date | string | Required, ISO 8601 date, unique | Current date | Weigh-in date |
| weight_kg | float | Required, min: 20, max: 350 | None | Recorded weight in kg |
| notes | string | Max 200 chars | null | Optional notes (e.g., "after breakfast") |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Relationships:**
- WeightGoal is a singleton with history (is_active flag)
- WeighIn records are standalone, ordered by date

**Indexes:**
- WeighIn: (date DESC) for timeline display
- WeightGoal: (is_active) for current goal lookup

**Validation Rules:**
- goal_weight must differ from start_weight by at least 0.5 kg
- target_date must be at least 14 days in the future
- target_date must be at most 730 days (2 years) in the future
- Only 1 weigh-in per date (latest entry replaces previous for same date)
- Rate should not exceed 1.0 kg/week loss or 0.5 kg/week gain (warning, not blocking)

#### 3.7 Business Logic Rules

##### Weight Goal Calorie Calculation

**Purpose:** Calculate the daily calorie adjustment needed to reach a weight goal by a target date.

**Inputs:**
- start_weight_kg: float
- goal_weight_kg: float
- target_date: string
- tdee: float

**Logic:**

```
1. weight_diff_kg = goal_weight_kg - start_weight_kg
   (negative = weight loss, positive = weight gain)
2. days_to_goal = number of days between today and target_date
3. weekly_rate_kg = (weight_diff_kg / days_to_goal) * 7
4. total_kcal_change = weight_diff_kg * 7700
   (7700 kcal per kg of body weight)
5. daily_adjustment = ROUND(total_kcal_change / days_to_goal, 0)
6. suggested_calorie_goal = tdee + daily_adjustment
7. IF suggested_calorie_goal < 1200:
     SHOW warning: "This rate requires eating below 1,200 kcal/day. Consider extending your target date."
8. IF ABS(weekly_rate_kg) > 1.0:
     SHOW warning: "Losing more than 1 kg/week is not recommended. Consider a longer timeline."
9. IF weekly_rate_kg > 0.5:
     SHOW warning: "Gaining more than 0.5 kg/week may result in excess fat gain."
10. RETURN { daily_adjustment, suggested_calorie_goal, weekly_rate_kg }
```

**Edge Cases:**
- Target date is very soon (14 days) with large weight change: rate may be extreme; show warning
- Weight gain goal: daily_adjustment is positive (eat more than TDEE)
- Goal weight equals current weight: no adjustment needed, suggest maintenance

##### Exponential Moving Average (Weight Trend)

**Purpose:** Smooth daily weight fluctuations to reveal the true trend.

**Inputs:**
- weigh_ins: array of { date, weight_kg } sorted by date ASC
- smoothing_factor: float - default 0.1 (lower = smoother)

**Logic:**

```
1. IF weigh_ins is empty: RETURN empty array
2. SET trend[0] = weigh_ins[0].weight_kg
3. FOR i = 1 to length(weigh_ins):
     trend[i] = (smoothing_factor * weigh_ins[i].weight_kg) + ((1 - smoothing_factor) * trend[i-1])
4. RETURN array of { date, trend_weight }
```

**Edge Cases:**
- Only 1 weigh-in: trend equals that single value
- Large gap between weigh-ins (e.g., 2 weeks): trend may lag significantly; still calculate normally
- Weight fluctuation of >2 kg between consecutive days: normal; trend line smooths this out

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Goal requires <1200 kcal/day | Warning banner with suggestion to extend target date | User adjusts target date or goal |
| Rate exceeds 1 kg/week loss | Amber warning about safety | User can proceed or adjust goal |
| Target date in the past | Inline: "Target date must be in the future" | User selects a future date |
| Weigh-in for today already exists | Confirmation: "Replace today's weigh-in of [X] kg with [Y] kg?" | User confirms or cancels |
| No TDEE available | "Enter body stats to calculate your calorie target" link | User enters body stats |

**Validation Timing:**
- Goal calculations run on any input change
- Safety warnings appear in real time as the user adjusts values
- Weigh-in uniqueness check runs on save

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user weighs 80 kg, sets a goal of 75 kg, and target date 70 days away with TDEE of 2,500,
   **When** the calculation runs,
   **Then** daily adjustment is -550 kcal, suggested goal is 1,950 kcal, rate is 0.50 kg/week.

2. **Given** the user logs a weigh-in of 79.2 kg,
   **When** the weight chart updates,
   **Then** a new data point appears, the trend line adjusts, and the projected path line shows whether they are on track.

3. **Given** the user has logged 14 weigh-ins over 2 weeks,
   **When** the weight chart displays,
   **Then** the trend line smoothly connects the data points, filtering out daily fluctuations.

**Edge Cases:**

4. **Given** the user's actual weight loss is 0.3 kg/week but projected was 0.5 kg/week for 3 consecutive weeks,
   **When** the system detects the discrepancy,
   **Then** a suggestion appears: "Your actual rate differs from projected. Consider recalibrating your TDEE."

5. **Given** the user reaches their goal weight,
   **When** they log a weigh-in at or below the goal,
   **Then** a "Goal Reached!" celebration appears with confetti and an option to set a new goal or switch to maintenance.

**Negative Tests:**

6. **Given** the user sets a goal that requires losing 1.5 kg/week,
   **When** the calculation runs,
   **Then** a safety warning appears: "Losing more than 1 kg/week is not recommended."

7. **Given** the user tries to set a target date 5 days from now,
   **When** validation runs,
   **Then** "Target date must be at least 2 weeks in the future" appears.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| daily adjustment for 5kg loss in 70 days | start: 80, goal: 75, days: 70 | adjustment: -550, rate: 0.50 kg/week |
| daily adjustment for 5kg gain in 100 days | start: 70, goal: 75, days: 100 | adjustment: +385 |
| warns on >1 kg/week loss | rate: -1.2 kg/week | warning shown |
| warns on <1200 kcal target | tdee: 1800, adjustment: -700 | warning: below 1200 |
| EMA with 5 data points | weights: [80, 79.5, 80.2, 79.8, 79.3], factor: 0.1 | trend smoothly decreasing |
| EMA with single point | weights: [80] | trend: [80] |
| rejects target date <14 days | target: today + 7 | validation error |
| rejects identical start and goal weight | start: 80, goal: 80 | validation error |
| one weigh-in per date | existing entry for today | replacement confirmation |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Set weight goal and verify calorie target | 1. Set goal from 80 to 75 kg in 70 days, 2. Check calorie goal | Calorie goal adjusts to TDEE - 550 |
| Log weigh-ins and check trend | 1. Log 7 daily weigh-ins, 2. View weight chart | Chart shows data points and EMA trend line |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User sets and tracks a weight goal | 1. Enter body stats, 2. Set goal (80 to 75 kg, 10 weeks), 3. Log food daily for 2 weeks, 4. Log daily weigh-ins, 5. Review progress | Weight chart shows trend, calorie balance aligns with goal, on-track/behind badge accurate |

---

### NU-021: Nutrient Reports and Charts

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-021 |
| **Feature Name** | Nutrient Reports and Charts |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As Dr. Chen the Data-Driven, I want to see line charts of my daily calorie, protein, and sodium intake over the past 30 days, so that I can identify long-term trends and share them with my clinician.

**Secondary:**
> As Jordan the Weight Manager, I want to see a monthly calorie average trend, so that I can see whether my eating pattern is consistently improving or regressing over months.

**Tertiary:**
> As Maria the Mindful Eater, I want to see a pie chart of where my calories come from (which food categories), so that I can understand my dietary composition.

#### 3.3 Detailed Description

Nutrient Reports and Charts provide long-term visual analytics of the user's nutrition data. While the Weekly Report (NU-016) covers 7-day windows and the Dashboard (NU-005) shows the current day, this feature offers 30-day, 90-day, and custom date range views with interactive line charts, bar charts, and pie charts.

The reports cover: calorie trends (daily and rolling average), macro ratio trends, individual nutrient trends (any of the 21+ tracked nutrients), calorie distribution by meal, calorie distribution by food category, and top food frequency analysis. Users can select the time period, the nutrient to chart, and the chart type.

This feature positions MyNutrition as a serious data tool for health-conscious users and healthcare professionals, on par with Cronometer's reporting capabilities.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-004: Macronutrient Tracking - provides macro data
- NU-012: Micronutrient Tracking - provides micronutrient data

**External Dependencies:**
- None

**Assumed Capabilities:**
- At least 7 days of food log data for meaningful charts

#### 3.5 User Interface Requirements

##### Screen: Reports

**Layout:**
- **Header:** "Reports" with a time period picker: "7D | 30D | 90D | Custom"
- **Report type tabs:** "Calories | Macros | Nutrients | Categories"
- **Calories tab:**
  - Line chart: daily calorie intake over the selected period
  - Rolling 7-day average line overlaid
  - Calorie goal line (horizontal)
  - Below chart: stats cards showing average, highest day, lowest day, days on target
- **Macros tab:**
  - Stacked bar chart: daily macro composition (protein, carbs, fat)
  - Donut chart: average macro ratio for the period
  - Below chart: average daily grams for each macro
- **Nutrients tab:**
  - Nutrient selector dropdown (choose any tracked nutrient)
  - Line chart: daily intake of the selected nutrient
  - Daily Value line overlaid
  - Below chart: average intake, % DV average, trend direction (up/down/stable)
- **Categories tab:**
  - Pie chart: percentage of total calories from each food category (Fruits, Vegetables, Meats, Dairy, Grains, Beverages, etc.)
  - Below chart: ranked list of categories with calorie totals

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Sufficient data | 7+ days of data in range | Full charts with all metrics |
| Insufficient data | <7 days of data in range | Charts shown with available data; note: "Limited data - [N] days available" |
| No data | 0 days in range | "No nutrition data for this period. Log food to see reports." |
| Custom date range | User selected custom dates | Charts for the custom range |

**Interactions:**
- Tap time period buttons: reloads charts for 7D, 30D, 90D, or opens date range picker for Custom
- Tap a point on a line chart: shows tooltip with date and exact value
- Tap a donut/pie segment: highlights the segment and shows percentage and calorie value
- Pinch-to-zoom on charts: adjusts the visible date range
- Long press a chart: share/export options (save as image, copy data)

#### 3.6 Data Requirements

Nutrient reports do not introduce new entities. All data is computed from FoodLogEntry (NU-001) and NutritionGoal (NU-007).

##### Derived Data: Report Metrics

| Field | Type | Computation | Description |
|-------|------|-------------|-------------|
| period_start | string | User-selected or preset | Start of reporting period |
| period_end | string | User-selected or preset | End of reporting period |
| daily_values | array | Per-day aggregations from FoodLogEntry | Array of daily totals for the selected metric |
| rolling_average | array | 7-day rolling average of daily_values | Smoothed trend line |
| period_average | float | AVG(daily_values) for days with data | Overall average |
| highest_day | object | MAX daily total with date | Best/highest day |
| lowest_day | object | MIN daily total with date (>0) | Lowest day (excluding zero) |
| days_on_target | integer | Days within 10% of goal | Goal adherence count |
| trend_direction | enum | up / down / stable | Whether the metric is trending up or down |
| category_breakdown | array | Calories grouped by food category | Category-level calorie distribution |

#### 3.7 Business Logic Rules

##### Report Data Aggregation

**Purpose:** Aggregate nutrition data over a date range for charting.

**Inputs:**
- start_date: string
- end_date: string
- metric: string - which nutrient/metric to aggregate

**Logic:**

```
1. QUERY FoodLogEntry WHERE date BETWEEN start_date AND end_date
2. GROUP BY date
3. FOR EACH day:
     daily_total = SUM(metric_field) for the selected metric
4. COMPUTE rolling_average:
     FOR EACH day at index i:
       IF i >= 6:
         rolling_avg[i] = AVG(daily_total[i-6..i])
       ELSE:
         rolling_avg[i] = AVG(daily_total[0..i])
5. period_average = AVG(daily_total) for days with data (skip zero-entry days)
6. highest_day = MAX(daily_total) with corresponding date
7. lowest_day = MIN(daily_total > 0) with corresponding date
8. DETERMINE trend_direction:
     first_half_avg = AVG of first half of daily_totals
     second_half_avg = AVG of second half of daily_totals
     IF second_half_avg > first_half_avg * 1.05: "up"
     ELSE IF second_half_avg < first_half_avg * 0.95: "down"
     ELSE: "stable"
9. RETURN report data
```

**Edge Cases:**
- Sparse data (only 3 of 30 days logged): rolling average uses available data only; note partial coverage
- All days have same value: trend = "stable"
- Single day of data: rolling average equals that day's value; trend not computed

##### Category Breakdown

**Purpose:** Group calories by food category for pie chart display.

**Inputs:**
- start_date, end_date: string - date range

**Logic:**

```
1. QUERY FoodLogEntry with food category data WHERE date in range
2. GROUP by food_category (from the linked food record)
3. SUM calories per category
4. SORT by total calories DESC
5. IF more than 8 categories: group smallest into "Other"
6. COMPUTE percentages: (category_total / grand_total) * 100
7. RETURN category_breakdown
```

**Edge Cases:**
- Custom foods may not have a food_category: group as "Other"
- All foods are in one category: single segment at 100%

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No data for selected period | "No nutrition data for this period" message | User selects a different date range |
| Insufficient data for trend analysis | Charts shown with available data; trend shows "Insufficient data for trend" | None needed |
| Chart rendering fails | "Could not render chart. Tap to retry." | User retries |
| Custom date range invalid (end before start) | "End date must be after start date" | User corrects dates |

**Validation Timing:**
- Data aggregation runs on period selection
- Chart rendering is async with loading indicators

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 30 days of food log data,
   **When** they open Reports with "30D" selected on the Calories tab,
   **Then** a line chart shows 30 data points of daily calories with a rolling average line and goal line.

2. **Given** the user switches to the Macros tab,
   **When** the stacked bar chart loads,
   **Then** each day shows protein (blue), carbs (amber), and fat (pink) segments proportional to their gram values.

3. **Given** the user selects "Iron" in the Nutrients tab,
   **When** the chart loads,
   **Then** a line chart shows daily iron intake with the FDA Daily Value (18 mg) as a horizontal reference line.

**Edge Cases:**

4. **Given** only 5 of the past 30 days have data,
   **When** the 30D report loads,
   **Then** the chart shows 5 data points, and a note reads "Limited data - 5 of 30 days available."

5. **Given** 80% of the user's calories come from the "Grains" and "Dairy" categories,
   **When** the Categories pie chart displays,
   **Then** two large segments dominate with smaller segments for other categories.

**Negative Tests:**

6. **Given** the user selects a custom date range where end date is before start date,
   **When** validation runs,
   **Then** "End date must be after start date" appears and charts do not render.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| 7-day rolling average correct | daily: [100,200,150,180,160,190,170] | avg[6]: 164.3 |
| trend up detected | first half avg: 1800, second half avg: 2000 | trend: "up" |
| trend stable | first half avg: 1950, second half avg: 2000 | trend: "stable" |
| trend down detected | first half avg: 2200, second half avg: 1900 | trend: "down" |
| category breakdown percentages | A: 1000, B: 500, C: 500 | A: 50%, B: 25%, C: 25% |
| small categories grouped into Other | 10 categories, 3 with <3% each | 8 categories shown, "Other" for the rest |
| highest day identified | days: [1800, 2200, 1900, 2500, 2000] | highest: 2500 on day 4 |
| handles zero-entry days in average | days: [2000, 0, 1800, 0, 2200], days with data: 3 | avg: 2000 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| View 30-day calorie report | 1. Log food for 30 days, 2. Open Reports, select 30D | Line chart with 30 points, stats cards with correct values |
| Switch between nutrient charts | 1. View calcium chart, 2. Switch to iron chart | Chart updates to show iron data with iron's DV line |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User reviews monthly nutrition trends | 1. Track food for 30 days, 2. Open Reports, 3. Review Calories, Macros, Nutrients, Categories tabs | All four tabs show meaningful charts with accurate data, trends identified |

---

### NU-022: Food Diary Notes

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-022 |
| **Feature Name** | Food Diary Notes |
| **Priority** | P2 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As Maria the Mindful Eater, I want to add notes about how I felt after a meal, so that I can track the connection between food and my energy, mood, and digestion.

**Secondary:**
> As Dr. Chen the Data-Driven, I want to annotate specific meals with notes about symptoms or medication timing, so that I can build a food diary to share with my gastroenterologist.

#### 3.3 Detailed Description

Food Diary Notes adds a journaling dimension to food logging. Users can attach free-text notes to individual food log entries or to entire meal slots. Notes might include how a food made them feel ("stomach upset after lunch"), environmental context ("ate out at restaurant"), emotional context ("stress eating"), or health observations ("energy crashed 2 hours after high-carb lunch").

This feature distinguishes MyNutrition from pure calorie counters by supporting mindful eating practices. Instead of reducing food to numbers, notes help users understand the qualitative aspects of their relationship with food.

Notes are stored locally and included in data exports (NU-023). They can be searched and filtered, enabling users to find patterns like "every time I eat dairy, I note bloating."

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-001: Food Logging - notes attach to food log entries

**External Dependencies:**
- None

**Assumed Capabilities:**
- Food log entries support a notes field (defined in NU-001 entity)

#### 3.5 User Interface Requirements

##### Component: Note Attachment

**Layout:**
- A "Note" text input field in the Food Entry Detail modal (NU-001), positioned below the nutrition information
- The field shows a pencil icon and placeholder text: "How did this food make you feel?"
- Character counter showing "[X] / 1,000 chars"
- When a note exists, a small note icon appears on the food entry row in the daily log

##### Screen: Daily Diary View

**Layout:**
- An alternative view of the daily food log that emphasizes notes
- Each meal section shows: meal name, food entries (compact), and expanded notes
- Entries without notes are shown in a condensed format
- A "Day Note" text area at the top for a general note about the day (not tied to a specific food or meal)
- Below the food entries: a "Day Summary" note field for end-of-day reflections

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No notes | No notes on any entry or day | Standard food log view; diary view shows "No notes yet" |
| Some notes | Some entries have notes | Entries with notes are highlighted; diary view shows them expanded |
| Day note exists | User has written a day-level note | Day note appears at the top of the diary view |

**Interactions:**
- Tap note field on food entry: opens text editor with auto-focus
- Tap "Day Note" area: opens text editor for day-level note
- Save note: auto-saves on blur (no explicit save button needed)
- Tap note icon on a food entry row in the regular log: navigates to or reveals that entry's note

#### 3.6 Data Requirements

Notes for food log entries are stored in the existing FoodLogEntry.notes field (NU-001).

##### Entity: DailyNote

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto | Unique note ID |
| date | string | Required, ISO 8601 date, unique | None | The calendar date for this note |
| content | string | Max 2000 chars | null | The day-level diary note |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last update time |

**Relationships:**
- DailyNote is a per-date singleton (one per day)
- FoodLogEntry.notes handles entry-level notes

**Indexes:**
- DailyNote: (date) for lookup
- FoodLogEntry: full-text search on notes field for diary search

**Validation Rules:**
- content must not exceed 2,000 characters
- FoodLogEntry.notes must not exceed 1,000 characters

#### 3.7 Business Logic Rules

##### Diary Search

**Purpose:** Search through food diary notes to find patterns.

**Inputs:**
- query: string - search text
- date_range: optional start_date and end_date

**Logic:**

```
1. SEARCH FoodLogEntry.notes using LIKE '%query%' (case-insensitive)
2. SEARCH DailyNote.content using LIKE '%query%' (case-insensitive)
3. MERGE results, sorted by date DESC
4. RETURN matching entries with:
   - Date
   - Food name (for entry notes) or "Day Note" (for daily notes)
   - Matching text with query highlighted
   - Surrounding context (50 chars before and after match)
```

**Edge Cases:**
- Query matches across multiple entries on the same day: show all matches grouped by date
- No matches: "No notes found matching '[query]'"
- Empty query: show all entries with notes, most recent first

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Note exceeds character limit | Character counter turns red; text truncated at limit | User shortens the note |
| Note save fails | Toast: "Could not save note. Please try again." | Auto-retry on next focus loss |
| Diary search fails | "Search failed. Try again." | User retries |

**Validation Timing:**
- Character count validation runs on every keystroke
- Note auto-saves 1 second after the user stops typing (debounced)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens the Food Entry Detail modal for a logged lunch,
   **When** they type "felt energized after this meal" in the note field,
   **Then** the note auto-saves, and a note icon appears on the entry row in the daily food log.

2. **Given** the user writes a day note "Stressful day, ate more than planned but felt okay about it",
   **When** they switch to the diary view,
   **Then** the day note appears at the top with all food entries and their individual notes below.

3. **Given** the user searches diary notes for "bloating",
   **When** 3 entries across different dates match,
   **Then** all 3 results appear with the matching text highlighted and the associated food name and date.

**Edge Cases:**

4. **Given** the user types exactly 1,000 characters in an entry note,
   **When** they try to type the 1,001st character,
   **Then** the character is not accepted and the counter shows "1,000 / 1,000" in red.

**Negative Tests:**

5. **Given** the user searches for "xyznonexistent" in diary notes,
   **When** no entries match,
   **Then** "No notes found matching 'xyznonexistent'" appears.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| saves entry note | entry_id: "abc", note: "felt great" | note saved on entry |
| saves day note | date: "2026-03-06", content: "good day" | DailyNote created |
| enforces entry note 1000 char limit | 1001 char string | truncated to 1000 |
| enforces day note 2000 char limit | 2001 char string | truncated to 2000 |
| diary search finds matching notes | query: "bloating" | entries with "bloating" in notes |
| diary search case insensitive | query: "TIRED" | matches "tired", "Tired", "TIRED" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add note and verify in diary view | 1. Log food, 2. Add note "stomach hurt", 3. Switch to diary view | Entry shows with note expanded |
| Search notes across dates | 1. Add "headache" note on 3 different dates, 2. Search "headache" | All 3 results returned with dates |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User keeps a food diary for a week | 1. Log meals daily for 7 days, 2. Add notes to at least 1 entry per day, 3. Add day notes on 3 days, 4. Search notes for "energy" | Diary view shows annotated entries, search finds relevant notes across the week |

---

### NU-023: CSV/JSON Export

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-023 |
| **Feature Name** | CSV/JSON Export |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As Dr. Chen the Data-Driven, I want to export my food log data as a CSV file, so that I can share it with my clinician or analyze it in a spreadsheet.

**Secondary:**
> As a privacy-conscious user, I want to export all my MyNutrition data in a machine-readable format, so that I have a full backup and can switch to another app if I choose.

#### 3.3 Detailed Description

CSV/JSON Export gives users full ownership of their data by allowing them to export their food log, custom foods, recipes, goals, weigh-ins, water logs, and diary notes in standard formats. This is a core privacy commitment: if a user decides to leave MyNutrition, they can take every piece of data with them.

The export supports two formats: CSV (human-readable, spreadsheet-compatible) and JSON (machine-readable, complete). Users can export all data or select specific date ranges and data types. The export produces one or more files depending on the format and scope.

CSV exports produce separate files per entity type: food_log.csv, custom_foods.csv, recipes.csv, weigh_ins.csv, water_log.csv, daily_notes.csv. JSON exports produce a single all-data.json file containing all entities as nested arrays.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-001: Food Logging - provides food log data to export

**External Dependencies:**
- Device file system for saving exported files
- System share sheet for sharing exported files

**Assumed Capabilities:**
- App can write files to a user-accessible location or share via system share sheet

#### 3.5 User Interface Requirements

##### Screen: Export Data

**Layout:**
- **Format selection:** Two large toggle buttons: "CSV" and "JSON"
- **Date range section:** "All Data" (default) or "Date Range" with start/end date pickers
- **Data types section:** Checkboxes for: Food Log, Custom Foods, Recipes, Goals, Weigh-Ins, Water Log, Diary Notes. "Select All" toggle at top (default: all selected).
- **Preview section:** A summary showing: "X food entries, Y custom foods, Z recipes..." based on current selection
- **Export button:** "Export [format]" primary button (full width)
- **Export progress:** Progress bar showing file generation progress for large exports

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Ready | Options selected, data exists | Export button enabled with data preview |
| No data | Selected range/types have no data | "No data to export for the selected options" and button disabled |
| Exporting | Export in progress | Progress bar, disabled button showing "Exporting..." |
| Complete | Export file generated | Success message with share button and file size |

**Interactions:**
- Toggle format: switches between CSV and JSON descriptions
- Toggle date range: reveals date pickers when "Date Range" is selected
- Toggle data type checkboxes: preview updates in real time
- Tap "Export": generates the file(s), then opens the system share sheet
- Tap share after export: opens system share sheet with the file(s) attached

#### 3.6 Data Requirements

No new entities. Export reads existing entities and serializes them.

##### CSV Export Schema: food_log.csv

| Column | Source | Description |
|--------|--------|-------------|
| date | FoodLogEntry.date | Log date |
| meal | FoodLogEntry.meal_slot | Meal category |
| food_name | FoodLogEntry.food_name | Food name |
| quantity | FoodLogEntry.quantity | Serving quantity |
| unit | FoodLogEntry.serving_unit | Serving unit |
| calories | FoodLogEntry.calories | Total calories |
| protein_g | FoodLogEntry.protein_g | Protein |
| carbs_g | FoodLogEntry.carbs_g | Carbs |
| fat_g | FoodLogEntry.fat_g | Fat |
| fiber_g | FoodLogEntry.fiber_g | Fiber |
| sugar_g | FoodLogEntry.sugar_g | Sugar |
| sodium_mg | FoodLogEntry.sodium_mg | Sodium |
| notes | FoodLogEntry.notes | Entry notes |
| source | FoodLogEntry.food_source | Data source |
| time | FoodLogEntry.time_logged | Logged time |

#### 3.7 Business Logic Rules

##### Export Generation

**Purpose:** Generate export files in the selected format and scope.

**Inputs:**
- format: enum - csv or json
- date_range: optional start_date and end_date (null = all data)
- data_types: array of strings - which entity types to include

**Logic:**

```
1. FOR EACH selected data_type:
     QUERY all records of that type within the date range
2. IF format == "csv":
     FOR EACH data_type:
       GENERATE a CSV file with headers and data rows
       USE UTF-8 encoding with BOM for Excel compatibility
       ESCAPE commas and newlines in text fields
     BUNDLE files into a ZIP archive: "mynutrition-export-YYYY-MM-DD.zip"
3. IF format == "json":
     BUILD a JSON object with each data_type as a top-level key
     INCLUDE metadata: { export_date, app_version, total_records }
     SAVE as "mynutrition-export-YYYY-MM-DD.json"
4. RETURN file path and file size
```

**Edge Cases:**
- Very large export (10,000+ entries): use streaming to avoid memory issues; show progress bar
- Text fields containing commas or newlines: properly escape for CSV
- Null fields in CSV: output empty cell (not "null" string)
- Unicode food names: preserve in UTF-8 encoding
- Export with no data selected: button is disabled; this state is prevented

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No data to export | "No data to export" message, button disabled | User logs data first or selects a different range |
| File system write fails | Toast: "Could not save export file. Check available storage." | User frees storage and retries |
| Export of 50,000+ entries takes >10 seconds | Progress bar with "Exporting [X]% - [N] entries processed" | User waits; can cancel via back button |
| JSON file exceeds 100 MB | Warning: "Export file is very large ([X] MB). Continue?" | User confirms or narrows date range |

**Validation Timing:**
- Data availability check runs when options change
- Export runs on button tap

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 90 days of food log data,
   **When** they select CSV format, all data types, all dates, and tap Export,
   **Then** a ZIP file is generated containing food_log.csv, custom_foods.csv, etc., the share sheet opens, and the file size is displayed.

2. **Given** the user selects JSON format and a 7-day date range,
   **When** they export,
   **Then** a single JSON file is generated with only entries from those 7 days.

**Edge Cases:**

3. **Given** the user exports CSV and opens food_log.csv in a spreadsheet,
   **When** a food name contains a comma (e.g., "Chicken, breast, roasted"),
   **Then** the CSV correctly escapes the value and the spreadsheet displays it in a single cell.

**Negative Tests:**

4. **Given** the user selects a date range with no data,
   **When** the export screen updates,
   **Then** "No data to export" message appears and the button is disabled.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| CSV escapes commas | food_name: "Chicken, roasted" | CSV cell: "\"Chicken, roasted\"" |
| CSV handles null fields | fiber_g: null | empty cell in CSV |
| JSON includes metadata | export any data | metadata object with export_date, app_version |
| date range filters correctly | range: Mar 1-7, entries on Mar 3, 5, 9 | exports only Mar 3 and 5 entries |
| all data types included | select all | all entity types present in export |
| UTF-8 encoding preserved | food_name: "Creme brulee" | correct encoding in output |
| ZIP contains all CSV files | export all data types as CSV | ZIP has 7 files |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full CSV export | 1. Log food for 7 days, 2. Export all as CSV | ZIP file with valid CSV files, row counts match entry counts |
| JSON round-trip | 1. Export as JSON, 2. Inspect JSON structure | All entities present, data matches database |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User exports data for clinician | 1. Open Export, 2. Select CSV + last 30 days + Food Log only, 3. Tap Export, 4. Share via email | Clinician receives a CSV with 30 days of food log data |

---

### NU-024: Data Import (MFP, Cronometer, Lose It!)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-024 |
| **Feature Name** | Data Import (MFP, Cronometer, Lose It!) |
| **Priority** | P2 |
| **Category** | Import/Export |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As Jordan the Weight Manager, I want to import my 2 years of MyFitnessPal food log data, so that I do not lose my tracking history when switching to MyNutrition.

**Secondary:**
> As Dr. Chen the Data-Driven, I want to import my Cronometer data with full micronutrient history, so that I can continue my detailed nutrient tracking without starting over.

#### 3.3 Detailed Description

Data Import allows users to bring their historical food tracking data from competing apps into MyNutrition. Supporting import from the three most popular competitors (MyFitnessPal, Cronometer, and Lose It!) removes the biggest barrier to switching: loss of historical data.

Each competitor provides data export in CSV format with different column layouts. The importer parses each format, maps columns to MyNutrition's schema, previews the data for user review, and imports entries as FoodLogEntry records. Imported foods that do not match the local USDA database are created as custom foods.

The import process is non-destructive: it never modifies existing data. If the user imports data for dates that already have entries, the imported entries are added alongside existing ones (not replacing them). A confirmation dialog warns the user when date overlap is detected.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-001: Food Logging - imported entries become food log entries
- NU-002: Food Database - for matching imported foods to USDA entries

**External Dependencies:**
- User must export data from the source app (CSV file from MFP, Cronometer, or Lose It!)
- File picker to select the CSV from device storage

**Assumed Capabilities:**
- App can read files from device storage via system file picker
- CSV parsing library is available

#### 3.5 User Interface Requirements

##### Screen: Import Data

**Layout:**
- **Source selection:** Three cards: "MyFitnessPal", "Cronometer", "Lose It!" each with the competitor's icon. Below the cards, instructions: "Export your data from [selected app], then upload the CSV file here."
- **File selection:** A "Select File" button that opens the system file picker. After selection, the file name and size are displayed.
- **Preview section (after file loaded):**
  - Summary: "[N] entries found, spanning [date range]"
  - Date overlap warning (if applicable): "[M] entries overlap with existing data for those dates"
  - Preview table: first 10 entries showing date, food name, calories, protein, carbs, fat
  - A "Parsing errors" section listing any rows that could not be parsed (with row number and reason)
- **Import button:** "Import [N] Entries" primary button. A "Skip [M] overlapping" option if overlap exists.

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Source selection | No file loaded | Three source cards with instructions |
| File loaded | CSV parsed successfully | Preview with summary and sample rows |
| Parsing errors | Some rows could not be parsed | Error list with row numbers and reasons |
| Importing | Import in progress | Progress bar: "Importing [X] of [N] entries..." |
| Complete | Import finished | Success: "Imported [N] entries. [M] entries skipped (errors)." |
| File invalid | File cannot be parsed as CSV | Error: "This file could not be read. Please ensure it is a valid CSV export from [selected app]." |

**Interactions:**
- Tap a source card: highlights it and shows source-specific export instructions
- Tap "Select File": opens system file picker for CSV files
- Scroll preview table: shows more imported entries
- Tap "Import [N] Entries": begins import with progress bar
- Tap a parsing error row: shows details about why that row failed

#### 3.6 Data Requirements

Import does not introduce new entities. It creates FoodLogEntry (NU-001) and CustomFood (NU-010) records from imported data.

##### Import Column Mappings

**MyFitnessPal CSV format:**

| MFP Column | Maps To |
|------------|---------|
| Date | FoodLogEntry.date |
| Meal | FoodLogEntry.meal_slot (Breakfast/Lunch/Dinner/Snacks) |
| Food Name | FoodLogEntry.food_name |
| Calories | FoodLogEntry.calories |
| Fat (g) | FoodLogEntry.fat_g |
| Carbohydrates (g) | FoodLogEntry.carbs_g |
| Protein (g) | FoodLogEntry.protein_g |
| Cholesterol (mg) | FoodLogEntry.cholesterol_mg |
| Sodium (mg) | FoodLogEntry.sodium_mg |
| Sugar (g) | FoodLogEntry.sugar_g |
| Fiber (g) | FoodLogEntry.fiber_g |

**Cronometer CSV format:**

| Cronometer Column | Maps To |
|-------------------|---------|
| Day | FoodLogEntry.date |
| Group | FoodLogEntry.meal_slot |
| Food Name | FoodLogEntry.food_name |
| Amount | FoodLogEntry.quantity |
| Unit | FoodLogEntry.serving_unit |
| Energy (kcal) | FoodLogEntry.calories |
| Protein (g) | FoodLogEntry.protein_g |
| Carbs (g) | FoodLogEntry.carbs_g |
| Fat (g) | FoodLogEntry.fat_g |
| (plus 80+ additional nutrient columns) | Mapped to corresponding fields |

**Lose It! CSV format:**

| Lose It Column | Maps To |
|----------------|---------|
| Date | FoodLogEntry.date |
| Type | FoodLogEntry.meal_slot |
| Name | FoodLogEntry.food_name |
| Quantity | FoodLogEntry.quantity |
| Calories | FoodLogEntry.calories |
| Fat (g) | FoodLogEntry.fat_g |
| Carbs (g) | FoodLogEntry.carbs_g |
| Protein (g) | FoodLogEntry.protein_g |
| Saturated Fat (g) | FoodLogEntry.saturated_fat_g |
| Fiber (g) | FoodLogEntry.fiber_g |
| Sugar (g) | FoodLogEntry.sugar_g |
| Sodium (mg) | FoodLogEntry.sodium_mg |

#### 3.7 Business Logic Rules

##### Import Pipeline

**Purpose:** Parse, validate, match, and import food entries from a competitor CSV.

**Inputs:**
- file: CSV file content
- source: enum - mfp, cronometer, loseit
- skip_overlapping: boolean - whether to skip entries for dates that already have data

**Logic:**

```
1. DETECT source format from column headers (or use user-selected source)
2. PARSE CSV rows using the appropriate column mapping
3. FOR EACH parsed row:
     a. VALIDATE required fields (date, food_name, calories)
     b. IF date parsing fails: add to error list with reason
     c. MAP meal slot name to enum (e.g., "Breakfast" -> "breakfast")
     d. TRY to match food_name to USDA database using fuzzy search
        IF match found with >80% confidence:
          SET food_id = USDA fdc_id, food_source = "usda"
        ELSE:
          CREATE or find CustomFood with the imported name and nutrition
          SET food_id = custom food id, food_source = "custom"
     e. SET quantity = 1 (unless source provides it)
     f. COMPUTE nutrition values from imported columns
4. IF skip_overlapping:
     REMOVE entries where date already has FoodLogEntry records
5. PREVIEW: return parsed entries for user review
6. ON user confirmation:
     INSERT all valid entries as FoodLogEntry records
     SET food_source = "custom" and note = "Imported from [source]"
7. RETURN { imported_count, skipped_count, error_count }
```

**Edge Cases:**
- MFP exports dates in various locale formats (MM/DD/YYYY vs. DD/MM/YYYY): detect from context
- Cronometer CSV has 80+ columns: import all available nutrients, skip unknown columns
- Food name in CSV does not match any USDA food: create as custom food
- Duplicate rows in CSV: import both (user may have eaten the same food twice)
- Extremely large CSV (50,000+ rows): process in batches of 500 with progress updates
- Empty calorie field: skip row, add to error list

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| File is not a valid CSV | "This file could not be read as CSV" | User selects a different file |
| Wrong source selected | Column mapping fails; "This does not appear to be a [source] export. Did you mean [detected source]?" | User selects the correct source |
| Some rows have parsing errors | Error list shows row numbers and reasons; valid rows can still be imported | User imports valid rows; errors are skipped |
| Date overlap detected | Warning with count; user can import all or skip overlapping | User chooses to import or skip |
| File is too large (>100 MB) | "File exceeds maximum size of 100 MB" | User splits the file or selects a date range |
| Import fails mid-way | "Import failed after [N] entries. [N] entries were imported successfully." | Partial import is retained; user can retry remaining |

**Validation Timing:**
- File format validation runs immediately on file selection
- Row-level validation runs during parsing
- Overlap detection runs after parsing, before import

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user selects "MyFitnessPal" and uploads a valid MFP CSV export with 500 entries,
   **When** the preview loads,
   **Then** a summary shows "500 entries found, spanning [date range]" with the first 10 entries previewed.

2. **Given** the user confirms the import of 500 MFP entries,
   **When** the import completes,
   **Then** 500 FoodLogEntry records are created, a success message shows "Imported 500 entries", and the food log for imported dates is populated.

**Edge Cases:**

3. **Given** the CSV has 10 rows with missing calorie data,
   **When** parsing completes,
   **Then** the error list shows 10 skipped rows with reason "Missing calories", and the remaining rows are importable.

4. **Given** the user has existing entries on March 1-5 and imports data that includes March 3-10,
   **When** overlap is detected,
   **Then** a warning shows "3 days overlap with existing data" with options to import all or skip overlapping dates.

**Negative Tests:**

5. **Given** the user selects a PDF file instead of a CSV,
   **When** the file is loaded,
   **Then** "This file could not be read as CSV" appears and no import is attempted.

6. **Given** the user selects "Cronometer" but uploads an MFP CSV,
   **When** column mapping fails,
   **Then** a suggestion appears: "This does not appear to be a Cronometer export."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| parses MFP CSV correctly | valid MFP CSV with 5 rows | 5 parsed entries with correct column mapping |
| parses Cronometer CSV correctly | valid Cronometer CSV with 3 rows | 3 parsed entries with micronutrients |
| parses Lose It CSV correctly | valid Lose It CSV with 4 rows | 4 parsed entries |
| skips rows with missing calories | row with empty Calories column | row in error list, not in valid entries |
| detects date format MM/DD/YYYY | date: "03/15/2026" | parsed as March 15, 2026 |
| detects date format DD/MM/YYYY | date: "15/03/2026" | parsed as March 15, 2026 |
| maps meal slot names correctly | "Breakfast", "Lunch", "Dinner", "Snacks" | "breakfast", "lunch", "dinner", "snack" |
| creates custom food for unmatched name | food: "Mom's Special Pasta" | CustomFood created |
| detects date overlap | import Mar 3-10, existing data Mar 1-5 | overlap: Mar 3-5 flagged |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| MFP import end to end | 1. Select MFP source, 2. Upload valid CSV, 3. Preview, 4. Import | All valid entries created as FoodLogEntry, food log populated |
| Import with overlap handling | 1. Have existing data for Mar 1-5, 2. Import CSV with Mar 3-10, 3. Choose skip overlapping | Only Mar 6-10 entries imported |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User migrates from MFP | 1. Export CSV from MFP, 2. Open MyNutrition import, 3. Select MFP, 4. Upload file, 5. Preview and confirm | Full MFP history available in MyNutrition, food log shows imported meals, dashboard reflects imported data |

---

### NU-025: Settings and Preferences

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-025 |
| **Feature Name** | Settings and Preferences |
| **Priority** | P1 |
| **Category** | Settings |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user, I want to configure my measurement units, meal time ranges, and display preferences, so that the app works the way I expect.

**Secondary:**
> As a user, I want to delete all my nutrition data from one place, so that I can start fresh or remove my data before uninstalling.

#### 3.3 Detailed Description

Settings and Preferences provides a centralized configuration screen for all user-configurable options in MyNutrition. This includes measurement units (metric vs. imperial), default serving sizes, meal time range customization, notification preferences, data management (export, delete), and display options.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (settings is independent but affects all features)

**External Dependencies:**
- Device notification permission for reminder settings

**Assumed Capabilities:**
- App has a settings navigation entry point

#### 3.5 User Interface Requirements

##### Screen: Settings

**Layout:**
- A scrollable form organized into sections:
- **Units section:**
  - Weight unit: toggle (kg / lbs)
  - Height unit: toggle (cm / ft-in)
  - Water unit: toggle (ml / fl oz)
  - Energy unit: toggle (kcal / kJ) - 1 kcal = 4.184 kJ
- **Goals section:**
  - "Edit Calorie & Macro Goals" link (navigates to NU-007)
  - "Edit Body Stats" link (navigates to NU-008)
  - "Edit Weight Goal" link (navigates to NU-020)
  - "Edit Water Goal" link (navigates to NU-013)
- **Meal times section:**
  - Custom time ranges for each meal slot (default: Breakfast 5-10, Lunch 10-14, Snack 14-17, Dinner 17-22)
  - Each meal has a start time and end time picker
- **Notifications section:**
  - "Logging reminder" toggle with time picker (default: off)
  - "Streak reminder" toggle with time picker (default: 8:00 PM)
  - "Water reminder" toggle with interval picker (every 1h, 2h, 3h, 4h)
- **Display section:**
  - "Show micronutrients on dashboard" toggle (default: on)
  - "Show water on dashboard" toggle (default: on)
  - "Show streak on dashboard" toggle (default: on)
  - "Default food search tab" picker (All / Recent / Favorites)
- **Data section:**
  - "Export Data" button (navigates to NU-023)
  - "Import Data" button (navigates to NU-024)
  - "Delete All Nutrition Data" button (red, destructive)
- **About section:**
  - "Food Database Version" showing USDA data version
  - "Barcode Database Version" showing OFF data version
  - "App Version"

**Interactions:**
- Toggle any setting: saves immediately (no save button needed)
- Tap "Delete All Nutrition Data": opens confirmation dialog with text input requiring the user to type "DELETE" to confirm
- Tap navigation links: navigate to the respective screens

#### 3.6 Data Requirements

##### Entity: NutritionSettings

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | "settings" | Singleton ID |
| weight_unit | enum | kg / lbs | Device locale | Preferred weight unit |
| height_unit | enum | cm / ft_in | Device locale | Preferred height unit |
| water_unit | enum | ml / fl_oz | ml | Preferred water unit |
| energy_unit | enum | kcal / kj | kcal | Preferred energy unit |
| breakfast_start | string | HH:MM | "05:00" | Breakfast auto-assign start |
| breakfast_end | string | HH:MM | "09:59" | Breakfast auto-assign end |
| lunch_start | string | HH:MM | "10:00" | Lunch start |
| lunch_end | string | HH:MM | "13:59" | Lunch end |
| dinner_start | string | HH:MM | "17:00" | Dinner start |
| dinner_end | string | HH:MM | "21:59" | Dinner end |
| logging_reminder_enabled | boolean | - | false | Daily logging reminder |
| logging_reminder_time | string | HH:MM | "20:00" | Reminder time |
| streak_reminder_enabled | boolean | - | false | Streak protection reminder |
| streak_reminder_time | string | HH:MM | "20:00" | Streak reminder time |
| water_reminder_enabled | boolean | - | false | Periodic water reminder |
| water_reminder_interval_hours | integer | 1, 2, 3, 4 | 2 | Hours between reminders |
| show_micronutrients | boolean | - | true | Show micronutrients on dashboard |
| show_water | boolean | - | true | Show water on dashboard |
| show_streak | boolean | - | true | Show streak on dashboard |
| default_search_tab | enum | all / recent / favorites | "all" | Default food search tab |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last update time |

**Validation Rules:**
- Meal time ranges must not overlap
- All time values must be valid HH:MM format
- Water reminder interval must be 1, 2, 3, or 4 hours

#### 3.7 Business Logic Rules

##### Delete All Data

**Purpose:** Permanently delete all user nutrition data.

**Logic:**

```
1. SHOW confirmation dialog: "This will permanently delete all your nutrition data including food logs, custom foods, recipes, goals, weigh-ins, water logs, and diary notes. This cannot be undone."
2. REQUIRE user to type "DELETE" in a text field
3. ON confirmation:
     DELETE all FoodLogEntry records
     DELETE all CustomFood records
     DELETE all Recipe and RecipeIngredient records
     DELETE all NutritionGoal records
     DELETE all UserBodyStats records
     DELETE all WeightGoal and WeighIn records
     DELETE all WaterLogEntry and WaterGoal records
     DELETE all DailyNote records
     DELETE all RecentFood records
     DELETE all QuickAdd and QuickAddItem records
     DELETE all MealPlanEntry and MealPlanTemplate records
     DELETE StreakRecord
     PRESERVE NutritionSettings (settings are kept)
     PRESERVE bundled food database (read-only, not user data)
4. SHOW toast: "All nutrition data has been deleted"
5. RETURN to dashboard (empty state)
```

**Edge Cases:**
- User types "delete" (lowercase): reject; require exact "DELETE"
- Deletion fails midway: show error and report which data types were deleted

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Meal time ranges overlap | "Breakfast and Lunch times overlap. Adjust the ranges." | User fixes time ranges |
| Notification permission denied | Toggle shows "Notifications are off" with settings link | User enables in device settings |
| Delete confirmation incorrect | "Type DELETE to confirm" hint; button disabled | User types DELETE correctly |
| Settings save fails | Toast: "Could not save setting. Please try again." | User retries |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user toggles weight unit from kg to lbs,
   **When** the change saves,
   **Then** all weight displays throughout the app update to use lbs.

2. **Given** the user changes breakfast time range from 5-10 to 6-11,
   **When** they log food at 10:30 AM,
   **Then** the meal auto-assigns to Breakfast (within the new range).

3. **Given** the user types "DELETE" in the data deletion confirmation,
   **When** deletion completes,
   **Then** all user data is removed and the dashboard shows the first-use empty state.

**Negative Tests:**

4. **Given** the user types "delete" (lowercase) in the deletion confirmation,
   **When** they tap the confirm button,
   **Then** the button remains disabled and a hint shows "Type DELETE in uppercase."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| validates non-overlapping meal times | breakfast: 5-10, lunch: 10-14 | valid (no overlap) |
| detects overlapping meal times | breakfast: 5-11, lunch: 10-14 | error: overlap detected |
| unit toggle persists | set weight_unit to "lbs" | subsequent reads return "lbs" |
| delete all removes all entities | full database | all user tables empty, settings preserved |
| delete requires exact "DELETE" | input: "delete" | rejected |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Change unit and verify display | 1. Change to lbs, 2. Open TDEE calculator | Weight displayed in lbs |
| Delete and verify empty state | 1. Log food, 2. Delete all data, 3. Open dashboard | Dashboard shows empty first-use state |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User configures app for first time | 1. Open settings, 2. Set units to imperial, 3. Customize meal times, 4. Enable streak reminder | All preferences saved, app behavior reflects settings |

---

### NU-026: Onboarding Flow

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-026 |
| **Feature Name** | Onboarding Flow |
| **Priority** | P1 |
| **Category** | Onboarding |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a new user, I want a guided setup that collects my body stats, calculates my TDEE, and sets calorie and macro goals, so that I can start tracking immediately without figuring out everything myself.

**Secondary:**
> As a user switching from MFP, I want the onboarding to offer data import, so that I can bring my history and start where I left off.

#### 3.3 Detailed Description

The Onboarding Flow guides first-time users through essential setup in 4-6 screens. It collects body stats, calculates TDEE, sets calorie and macro goals, configures preferences, and optionally imports data from another app. The flow is designed to be completable in under 2 minutes.

The onboarding is shown once when the user first enables the MyNutrition module. Users can skip individual steps and complete them later from Settings. Every piece of information collected during onboarding is editable after the fact.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-007: Calorie and Macro Goals - goal setup step
- NU-008: BMR and TDEE Calculator - body stats and TDEE step
- NU-025: Settings and Preferences - unit preferences step

**External Dependencies:**
- None

**Assumed Capabilities:**
- Module has been enabled in MyLife hub for the first time

#### 3.5 User Interface Requirements

##### Flow: Onboarding Screens

**Screen 1: Welcome**
- Title: "Welcome to MyNutrition"
- Subtitle: "Know what you eat, own what you track"
- Three value prop bullets:
  - "Track calories, macros, and 25+ micronutrients"
  - "All data stays on your device - private by design"
  - "No account required, no subscription needed"
- "Get Started" primary button
- "Skip Setup" text link

**Screen 2: Body Stats**
- Collects: sex, age, weight, height (same layout as NU-008 TDEE Calculator body stats section)
- Unit toggle available (metric/imperial)
- "Next" button (enabled when all fields filled)
- "Skip" text link

**Screen 3: Activity Level**
- 5 activity level cards (same as NU-008)
- Calculated TDEE displayed after selection: "Your estimated daily burn: X,XXX kcal"
- "Next" button

**Screen 4: Your Goal**
- Three objective cards: Lose Weight, Maintain Weight, Gain Weight
- Intensity sub-options for lose/gain (Mild, Moderate, Aggressive)
- Calculated calorie goal displayed: "Suggested daily goal: X,XXX kcal"
- Macro preset selector: Balanced, High Protein, Low Carb, Keto
- "Next" button

**Screen 5: Preferences**
- Unit preferences (weight, water, energy)
- Streak reminder toggle
- "Switching from another app? Import your data" link
- "Next" button

**Screen 6: Ready**
- Summary card showing: daily calorie goal, macro targets (P/C/F grams), TDEE
- "Start Tracking" primary button
- "Edit any of these later in Settings" text note

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Step by step | User proceeding through screens | Progress dots showing current step (1-6) |
| Skipped steps | User skipped body stats or goal | Summary shows "Not set" for skipped values with "Set up later" note |
| Returning user | User returns to onboarding after partial completion | Resumes from the last incomplete step |

**Interactions:**
- "Get Started" / "Next": advances to next screen with slide animation
- "Skip": advances to next screen without saving current step's data
- "Skip Setup": jumps directly to the dashboard (empty state)
- Back button: returns to previous onboarding screen
- Progress dots: tapping a completed dot navigates back to that step

#### 3.6 Data Requirements

Onboarding does not create new entities. It populates existing entities: UserBodyStats (NU-008), NutritionGoal (NU-007), and NutritionSettings (NU-025).

##### Entity: OnboardingState

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | "onboarding" | Singleton ID |
| completed | boolean | - | false | Whether onboarding has been completed |
| current_step | integer | 1-6 | 1 | Current onboarding step |
| skipped_steps | array | JSON array of integers | [] | Steps the user skipped |
| completed_at | datetime | ISO 8601 | null | When onboarding was completed |

#### 3.7 Business Logic Rules

##### Onboarding Completion

**Purpose:** Mark onboarding as complete and apply all collected settings.

**Logic:**

```
1. IF body stats were entered:
     SAVE UserBodyStats
     COMPUTE BMR and TDEE
2. IF calorie goal was set:
     CREATE NutritionGoal with:
       - calorie_goal from calculated/selected value
       - macro goals from selected preset
       - source = "onboarding"
3. IF preferences were configured:
     SAVE NutritionSettings with selected units
4. SET OnboardingState.completed = true
5. SET OnboardingState.completed_at = now
6. NAVIGATE to Dashboard
```

**Edge Cases:**
- User skips all steps: onboarding marked complete but no goals/stats set; dashboard shows prompts
- User closes the app mid-onboarding: state is saved; next launch resumes from current_step
- User completes onboarding then changes goals: onboarding is not re-triggered

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Body stats save fails | Toast: "Could not save. Please try again." and stays on current step | User retries |
| Onboarding state corrupted | Reset to step 1 | User restarts onboarding |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user enables MyNutrition for the first time,
   **When** the module loads,
   **Then** the onboarding flow begins at the Welcome screen.

2. **Given** the user completes all 6 onboarding steps,
   **When** they tap "Start Tracking",
   **Then** the Dashboard loads with their calorie goal, macro targets, and body stats saved.

3. **Given** the user skips the body stats step,
   **When** they reach the Ready screen,
   **Then** TDEE and calorie goal show "Not set" with a "Set up later" note.

**Negative Tests:**

4. **Given** the user has already completed onboarding,
   **When** they re-open MyNutrition,
   **Then** the dashboard loads directly without showing onboarding again.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| onboarding creates body stats | complete step 2 with valid data | UserBodyStats record created |
| onboarding creates goal | complete step 4 with 2000 kcal, balanced | NutritionGoal with source: "onboarding" |
| skip all creates no records | skip all steps | No UserBodyStats, no NutritionGoal |
| marks completed on finish | complete all steps | OnboardingState.completed = true |
| resumes from saved step | current_step: 3 | flow starts at step 3 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full onboarding flow | 1. Complete all 6 steps, 2. Verify dashboard | Dashboard shows correct goals and TDEE from onboarding |
| Skip and complete later | 1. Skip body stats, 2. Complete other steps, 3. Open settings, 4. Enter body stats | TDEE calculates, goal updates |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user onboards in 2 minutes | 1. Enable MyNutrition, 2. Enter body stats (male, 28, 75kg, 180cm), 3. Select "Moderately Active", 4. Choose "Lose - Moderate", 5. Select "High Protein", 6. Set imperial units, 7. Tap "Start Tracking" | Dashboard ready with 2000 kcal goal, 200/150/44 macro targets, all units in imperial |

---

### NU-027: AI Photo Food Logging

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-027 |
| **Feature Name** | AI Photo Food Logging |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As Sam the Scanner, I want to take a photo of my plate and have the app identify the foods and estimate portions automatically, so that I can log a complex meal without searching for each item individually.

**Secondary:**
> As Priya the Parent, I want to snap a quick photo of a family dinner and get approximate calorie estimates for my portion, so that I can track casually without spending 5 minutes searching for each ingredient.

#### 3.3 Detailed Description

AI Photo Food Logging uses computer vision to identify foods in a photo and estimate their nutritional content. The user takes a photo of their meal, the AI model identifies visible food items, estimates portions, and pre-fills food log entries that the user can review and adjust before saving.

This feature uses an on-device AI model for food recognition to maintain the privacy-first commitment. No meal photos are transmitted to any server. The model identifies common foods (fruits, vegetables, meats, grains, packaged items) and estimates portions based on visual cues (plate size, relative proportions).

The AI provides estimates, not exact values. The user always reviews and can adjust the identified foods, portion sizes, and meal assignment before confirming. This semi-automated approach balances speed (faster than manual search) with accuracy (user correction prevents major errors).

This feature is available on mobile platforms only (requires camera access). On web, it is not available.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-001: Food Logging - identified foods are logged as entries
- NU-002: Food Database - matched foods come from the USDA database

**External Dependencies:**
- On-device AI/ML model for food recognition (bundled with the app, estimated 20-50 MB)
- Camera hardware and permission
- Sufficient device processing power for on-device inference

**Assumed Capabilities:**
- Device supports running a compact ML model for image classification
- Camera can capture food photos with adequate resolution

#### 3.5 User Interface Requirements

##### Screen: Photo Food Logger

**Layout:**
- **Camera view:** Full-screen camera viewfinder with a large circular capture button at the bottom center
- **Capture button area:** Below the viewfinder: "Take Photo" button (center), "Gallery" button (left, to select from photo library), "Cancel" button (right)
- **After capture - Analysis view:**
  - The captured photo displayed at the top (50% of screen)
  - Below the photo, a "Analyzing..." loading indicator with a scanning animation overlay on the photo
  - After analysis: a list of identified food items, each showing:
    - Food name (identified by AI)
    - Estimated portion (e.g., "~1 cup", "~150g")
    - Estimated calories
    - Confidence indicator: high (green dot), medium (amber dot), low (red dot)
    - An "Edit" button to modify the identification or portion
    - A checkbox to include/exclude the item from logging
  - Summary at the bottom: "Total: ~X kcal from Y items"
  - "Log Selected Items" primary button
  - "Retake Photo" text link

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Camera active | Awaiting photo | Viewfinder with capture button |
| Analyzing | Photo taken, AI processing | Photo with scanning animation, "Analyzing..." text |
| Results | AI identified foods | List of identified items with confidence levels |
| No foods detected | AI could not identify any food | "Could not identify any foods in this photo. Try a clearer photo or log manually." |
| Low confidence | All identifications are low confidence | Results shown with amber banner: "These estimates may be inaccurate. Please review carefully." |

**Interactions:**
- Tap capture button: takes photo, transitions to analysis view
- Tap "Gallery": opens photo library picker
- Tap "Edit" on an identified item: opens a mini-search to correct the food identification or adjust the portion
- Toggle checkboxes: include/exclude items from logging
- Tap "Log Selected Items": creates food log entries for all checked items
- Tap "Retake Photo": returns to camera view

#### 3.6 Data Requirements

AI Photo Food Logging does not introduce new persistent entities. It creates FoodLogEntry records (NU-001) from identified foods.

##### Transient Data: PhotoAnalysisResult

| Field | Type | Description |
|-------|------|-------------|
| photo_path | string | Local path to the captured photo (temporary) |
| identified_items | array | List of identified food items |
| identified_items[].food_name | string | AI-identified food name |
| identified_items[].matched_food_id | string | Matched USDA food ID (if match found) |
| identified_items[].confidence | float | Confidence score 0.0-1.0 |
| identified_items[].estimated_quantity | float | Estimated serving quantity |
| identified_items[].estimated_unit | string | Estimated serving unit |
| identified_items[].estimated_calories | float | Estimated calories |
| analysis_duration_ms | integer | How long the analysis took |

This data is transient and not stored persistently. Only the resulting FoodLogEntry records are stored.

#### 3.7 Business Logic Rules

##### Photo Analysis Pipeline

**Purpose:** Analyze a food photo and return identified items with estimated nutrition.

**Inputs:**
- photo: image data - the captured meal photo

**Logic:**

```
1. PREPROCESS photo:
     - Resize to model input dimensions (e.g., 224x224 or 640x640)
     - Normalize pixel values
2. RUN on-device ML model:
     - Identify food items in the photo
     - Estimate bounding boxes for each item
     - Classify each item (food category and specific food)
     - Estimate portion size from visual cues
3. FOR EACH identified item:
     a. MATCH food_name against USDA database using fuzzy search
     b. IF match found (confidence > 0.6):
          SET matched_food_id = USDA fdc_id
          COMPUTE estimated_calories from matched food's nutrition * estimated_quantity
     c. IF no match:
          ESTIMATE calories using category-level averages
     d. ASSIGN confidence level:
          > 0.8: high
          0.6 - 0.8: medium
          < 0.6: low
4. SORT identified items by confidence DESC
5. RETURN PhotoAnalysisResult
```

**Edge Cases:**
- Photo is blurry or too dark: return "Could not analyze photo" with suggestion to improve lighting
- Photo contains non-food items: AI ignores non-food objects
- Photo contains packaged food: AI may identify the package type but suggest barcode scanning for accuracy
- Multiple servings on one plate: AI estimates the user's single portion, not the entire dish
- Model processing takes >5 seconds: show timeout warning; continue processing up to 15 seconds
- Model fails completely: offer manual logging as fallback

##### Portion Estimation

**Purpose:** Estimate food quantity from visual cues.

**Logic:**

```
1. USE plate/bowl detection as a reference size:
     - Standard dinner plate: ~25 cm diameter
     - Standard bowl: ~15 cm diameter
2. ESTIMATE food coverage on the plate as a fraction
3. MAP food type to density:
     - Dense foods (meat, cheese): ~1.5g per cm3
     - Medium foods (rice, pasta): ~1.0g per cm3
     - Light foods (salad, vegetables): ~0.5g per cm3
4. COMPUTE estimated_grams from coverage * depth_estimate * density
5. MAP estimated_grams to the nearest standard serving size
6. RETURN estimated_quantity and estimated_unit
```

**Edge Cases:**
- No plate visible (food on a cutting board, in hand): use absolute size estimation (less accurate)
- Stacked or layered foods: depth estimation is unreliable; default to 1 serving
- Liquids (soups, beverages): estimate by container size

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Camera permission denied | "Camera access needed" with settings link | User grants permission |
| AI model not loaded | "Downloading food recognition model..." progress | Wait for download or use manual logging |
| No foods detected | "Could not identify foods. Try a clearer photo or log manually." | User retakes photo or switches to search |
| Low confidence results | Amber banner: "These estimates may be inaccurate. Review carefully." | User reviews and corrects each item |
| Analysis timeout (>15s) | "Analysis took too long. Please try a simpler photo." | User retakes or logs manually |
| Device too old for ML | "AI food logging is not available on this device. Use manual logging." | Feature hidden on unsupported devices |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user takes a photo of a plate containing grilled chicken, rice, and broccoli,
   **When** the AI analysis completes in under 5 seconds,
   **Then** three items are identified (chicken, rice, broccoli) with estimated portions and calories, each with confidence indicators.

2. **Given** the user reviews the AI results and adjusts the rice portion from "1 cup" to "1.5 cups",
   **When** they tap "Log Selected Items",
   **Then** 3 food log entries are created with the adjusted portions.

**Edge Cases:**

3. **Given** the user takes a photo of a complex salad with 8 ingredients,
   **When** the AI identifies only 5 items (missing dressing, croutons, and cheese),
   **Then** the user can manually add the missing items via the "Edit" button.

4. **Given** the photo is very dark and blurry,
   **When** the AI cannot identify any foods,
   **Then** "Could not identify foods" message appears with "Retake Photo" and "Log Manually" options.

**Negative Tests:**

5. **Given** the user takes a photo of a non-food object,
   **When** the AI processes the image,
   **Then** "No foods detected in this photo" appears.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| identifies single food item | photo of a banana | identified: "banana", confidence: high |
| handles empty plate | photo of empty plate | identified_items: [], message: "No foods detected" |
| matches identified food to USDA | identified: "chicken breast" | matched_food_id: USDA fdc_id for chicken breast |
| low confidence flagged | confidence: 0.45 | confidence_level: "low" |
| analysis within time limit | standard food photo | analysis_duration_ms < 5000 |
| portion estimation for plated food | chicken on standard plate, ~30% coverage | estimated: ~150g |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Photo to food log | 1. Take photo, 2. AI identifies 3 items, 3. User confirms all, 4. Tap "Log" | 3 FoodLogEntry records created with estimated nutrition |
| Photo with corrections | 1. Take photo, 2. AI identifies "rice" as "quinoa", 3. User edits to "rice", 4. Log | Corrected "rice" entry with accurate nutrition |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User logs lunch with a photo | 1. Tap photo icon, 2. Take photo of lunch plate, 3. Review 4 identified items, 4. Correct 1 item, 5. Log all | 4 food entries under lunch, calories estimated and adjustable, dashboard updates |

---

### NU-028: Restaurant Menu Database

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-028 |
| **Feature Name** | Restaurant Menu Database |
| **Priority** | P2 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As Jordan the Weight Manager, I want to search for a Chipotle burrito bowl and get accurate calorie counts, so that I can log restaurant meals without guessing.

**Secondary:**
> As Sam the Scanner, I want to browse nearby restaurant menus and log items with one tap, so that eating out does not break my tracking habit.

#### 3.3 Detailed Description

The Restaurant Menu Database provides nutrition data for popular chain restaurant menu items. In the United States, restaurants with 20 or more locations are required by FDA regulations to publish calorie information. This feature aggregates that publicly available data into a searchable, loggable database.

The initial dataset covers the top 100 US restaurant chains (approximately 15,000 menu items). Data is sourced from publicly posted menu nutrition PDFs and restaurant websites. The database is bundled with the app and updated periodically via app updates.

Users search for restaurants by name and browse their menu items, each showing calories, macros, and available nutrients. Restaurant menu items can be logged directly as food entries, just like USDA foods or barcode products.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-002: Food Database - restaurant items are stored similarly to USDA foods

**External Dependencies:**
- Bundled restaurant menu database (estimated 5-10 MB)

**Assumed Capabilities:**
- Database can store and query restaurant menu items alongside other food data

#### 3.5 User Interface Requirements

##### Screen: Restaurant Search

**Layout:**
- **Search bar:** "Search restaurants or menu items..." with a filter button
- **Restaurant list (when search is empty):** Alphabetical list of available restaurants, each showing: restaurant name, logo/icon, number of menu items available
- **Menu items list (after restaurant selected):** Menu items grouped by category (Entrees, Sides, Drinks, Desserts). Each item shows: item name, calories, and a compact macro row (P/C/F)
- **Filter options:** Category filter (fast food, casual dining, coffee), dietary filter (under 500 kcal, high protein, low carb)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Browse | No search query | Restaurant list (alphabetical) |
| Search results | Query entered | Matching restaurants and/or menu items |
| Restaurant selected | User tapped a restaurant | Menu items for that restaurant |
| No results | No matching restaurants or items | "No restaurants or menu items found for '[query]'" |

**Interactions:**
- Tap a restaurant: shows its menu items
- Tap a menu item: opens Food Entry Detail modal (NU-001) with nutrition pre-filled
- Search: searches both restaurant names and menu item names
- Apply filter: narrows results to matching criteria

#### 3.6 Data Requirements

##### Entity: RestaurantMenuItem

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto | Unique item ID |
| restaurant_name | string | Required, max 200 chars | None | Restaurant chain name |
| item_name | string | Required, max 500 chars | None | Menu item name |
| category | string | Max 100 chars | null | Menu category (Entrees, Sides, etc.) |
| serving_description | string | Max 200 chars | null | Serving description |
| calories | float | Required, min: 0 | None | Calories per serving |
| protein_g | float | Min: 0 | null | Protein per serving |
| carbs_g | float | Min: 0 | null | Carbs per serving |
| fat_g | float | Min: 0 | null | Fat per serving |
| saturated_fat_g | float | Min: 0 | null | Saturated fat |
| sodium_mg | float | Min: 0 | null | Sodium |
| fiber_g | float | Min: 0 | null | Fiber |
| sugar_g | float | Min: 0 | null | Sugar |
| cholesterol_mg | float | Min: 0 | null | Cholesterol |
| data_source_url | string | Max 500 chars | null | Source URL for nutrition data |
| last_verified | datetime | ISO 8601 | null | Last verification date |

**Indexes:**
- (restaurant_name) for restaurant browsing
- (item_name) for menu item search
- (restaurant_name, category) for categorized menu display
- FTS5 on (restaurant_name, item_name, category) for unified search

**Validation Rules:**
- restaurant_name and item_name must not be empty
- calories is required; other nutrients optional

#### 3.7 Business Logic Rules

##### Restaurant Search

**Purpose:** Search across restaurants and menu items.

**Inputs:**
- query: string - search text

**Logic:**

```
1. IF query matches a restaurant name (prefix or fuzzy):
     RETURN matching restaurants with item counts
2. ALSO search menu item names across all restaurants:
     RETURN matching items with their restaurant names
3. COMBINE results:
     - Restaurant matches first
     - Menu item matches second
4. APPLY filters if active (calorie range, dietary filters)
```

**Edge Cases:**
- Query matches both a restaurant and menu items: show both sections
- Restaurant has 100+ items: paginate or categorize

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Restaurant database not loaded | "Restaurant data is loading..." | Retry on next screen open |
| No matching restaurants | "No restaurants found for '[query]'" | User modifies search |
| Menu item has no macro data | Item shows calories only, macros shown as "N/A" | User can log with calories only |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user searches for "Chipotle",
   **When** the search results display,
   **Then** "Chipotle Mexican Grill" appears with its menu item count.

2. **Given** the user taps "Chipotle" and selects "Burrito Bowl - Chicken",
   **When** the Food Entry Detail modal opens,
   **Then** it shows calories (665), protein (40g), carbs (54g), fat (24g) pre-filled.

**Edge Cases:**

3. **Given** a menu item has only calorie data (no macros),
   **When** the item is displayed,
   **Then** calories are shown and macros display "N/A".

**Negative Tests:**

4. **Given** the user searches for a non-existent restaurant "XYZTACOS",
   **When** no results are found,
   **Then** "No restaurants found" message appears.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| search finds restaurant by name | query: "McDonald" | "McDonald's" in results |
| search finds menu item across restaurants | query: "Caesar Salad" | items from multiple restaurants |
| filter by calorie range | max: 500 kcal | only items <= 500 kcal |
| handles null macros | item with only calories | protein/carbs/fat: null |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Browse and log restaurant item | 1. Search "Starbucks", 2. Select "Grande Latte", 3. Log 1 serving | FoodLogEntry created with Starbucks latte nutrition |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User logs a restaurant lunch | 1. Search "Panera", 2. Browse "Soups" category, 3. Select "Broccoli Cheddar", 4. Set quantity to 1, 5. Log under Lunch | Restaurant item appears in lunch, dashboard updates with correct calories |

---

### NU-029: Caffeine Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-029 |
| **Feature Name** | Caffeine Tracking |
| **Priority** | P2 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As Alex the Active, I want to track my daily caffeine intake, so that I can ensure I stay within the recommended 400 mg limit and avoid consuming caffeine too late in the day.

**Secondary:**
> As Dr. Chen the Data-Driven, I want to see my caffeine intake trend over the week alongside my sleep and nutrition data, so that I can identify patterns affecting my health.

#### 3.3 Detailed Description

Caffeine Tracking leverages the caffeine data already present in the USDA food database (caffeine_mg_per_100g) to automatically track caffeine from logged foods like coffee, tea, energy drinks, and chocolate. In addition to passive tracking from food logs, users can quick-log common caffeine drinks with preset amounts.

The feature displays daily caffeine intake against the FDA-recommended limit of 400 mg per day for healthy adults. A caffeine timeline shows when caffeine was consumed and estimates the caffeine still active in the body (caffeine half-life is approximately 5 hours).

Caffeine data is derived from two sources: automatically calculated from logged foods that contain caffeine (USDA data) and manually logged caffeine entries via preset buttons (espresso: 63 mg, drip coffee 8oz: 95 mg, green tea: 28 mg, energy drink: 80 mg).

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-013: Water Intake Tracking - caffeine tracking is architecturally similar and shares the quick-log UI pattern

**External Dependencies:**
- None (caffeine data from USDA database)

**Assumed Capabilities:**
- USDA food entries include caffeine_mg_per_100g field

#### 3.5 User Interface Requirements

##### Component: Caffeine Tracker

**Layout:**
- **Daily caffeine display:** A compact progress bar showing "X / 400 mg caffeine" with color coding: green (<300 mg), amber (300-400 mg), red (>400 mg)
- **Quick-add buttons:** Preset buttons for common caffeine sources: Espresso (63 mg), Coffee 8oz (95 mg), Coffee 12oz (142 mg), Green Tea (28 mg), Black Tea (47 mg), Energy Drink (80 mg), Custom
- **Caffeine timeline (detailed view):** A timeline showing each caffeine entry with time, source, and amount. An overlaid curve shows estimated active caffeine in the body based on 5-hour half-life.
- **Cutoff time indicator:** A marker on the timeline at 2:00 PM (configurable) labeled "Recommended caffeine cutoff" to discourage late-day caffeine

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Under limit | <300 mg | Green progress bar |
| Approaching limit | 300-400 mg | Amber progress bar |
| Over limit | >400 mg | Red progress bar with warning: "Above recommended daily limit" |
| No caffeine | 0 mg | Empty bar with "No caffeine logged today" |

**Interactions:**
- Tap a quick-add button: logs that caffeine amount with current timestamp
- Tap "Custom": opens numeric input for custom mg amount
- Tap progress bar: opens detailed caffeine timeline view
- Tap a timeline entry: shows source food and exact amount

#### 3.6 Data Requirements

##### Entity: CaffeineLogEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto | Unique entry ID |
| date | string | Required, ISO 8601 date | Current date | Calendar date |
| amount_mg | float | Required, min: 1, max: 2000 | None | Caffeine amount in mg |
| source | enum | One of: food_log, preset, custom | None | How this entry was created |
| source_description | string | Max 200 chars | null | Source description (e.g., "Espresso", "Green Tea") |
| food_log_entry_id | string | References FoodLogEntry.id | null | Link to food entry (if derived from food log) |
| time_logged | datetime | ISO 8601 | Current timestamp | When caffeine was consumed |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Indexes:**
- (date) for daily total
- (date, time_logged) for timeline display

#### 3.7 Business Logic Rules

##### Caffeine from Food Log

**Purpose:** Automatically extract caffeine intake from logged foods.

**Logic:**

```
1. WHEN a FoodLogEntry is created or updated:
     LOOK UP the food's caffeine_mg_per_100g value
2. IF caffeine_mg_per_100g is NOT null AND > 0:
     caffeine_mg = (caffeine_mg_per_100g / 100) * serving_weight_grams * quantity
     CREATE or UPDATE CaffeineLogEntry with:
       source = "food_log"
       food_log_entry_id = entry.id
       amount_mg = caffeine_mg
       time_logged = entry.time_logged
3. IF FoodLogEntry is deleted:
     DELETE corresponding CaffeineLogEntry
```

##### Active Caffeine Estimation

**Purpose:** Estimate how much caffeine is still active in the body based on the 5-hour half-life.

**Inputs:**
- caffeine_entries: array of { time, amount_mg } for today

**Logic:**

```
1. SET current_time = now
2. total_active = 0
3. FOR EACH entry:
     hours_elapsed = (current_time - entry.time) in hours
     remaining = entry.amount_mg * (0.5 ^ (hours_elapsed / 5))
     total_active += remaining
4. ROUND total_active to nearest integer
5. RETURN total_active
```

**Edge Cases:**
- Caffeine consumed 24+ hours ago: negligible amount (<1 mg), ignore
- Multiple caffeinated drinks in quick succession: sum their remaining amounts

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Custom amount is 0 | Inline: "Enter an amount greater than 0" | User corrects |
| Custom amount exceeds 2000 mg | Inline: "Maximum is 2,000 mg" | User corrects |
| Over daily limit | Warning banner (non-blocking): "Above the recommended 400 mg daily limit" | Informational only |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user logs a cup of coffee (USDA entry with 95 mg caffeine per 8oz serving),
   **When** the food is logged,
   **Then** a caffeine entry is automatically created for 95 mg and the caffeine progress bar updates.

2. **Given** the user taps the "Espresso" quick-add button at 2:00 PM,
   **When** the log is created,
   **Then** 63 mg is added to today's caffeine total and the timeline shows the entry at 2:00 PM.

**Edge Cases:**

3. **Given** the user consumed 300 mg of caffeine at 8:00 AM and it is now 1:00 PM (5 hours later),
   **When** the active caffeine estimate displays,
   **Then** it shows approximately 150 mg active (half-life).

**Negative Tests:**

4. **Given** daily caffeine is at 380 mg,
   **When** the user logs another 95 mg coffee,
   **Then** the total reaches 475 mg, the bar turns red, and a warning about exceeding 400 mg appears.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| extracts caffeine from food log | food: 95mg caffeine/100g, serving: 237g (1 cup) | caffeine: 225 mg |
| half-life at 5 hours | 200 mg at t=0, current: t+5h | active: 100 mg |
| half-life at 10 hours | 200 mg at t=0, current: t+10h | active: 50 mg |
| daily total from 3 entries | [95, 63, 28] mg | total: 186 mg |
| over-limit detection | total: 450 mg | status: "over_limit" |
| rejects zero amount | amount: 0 | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Log coffee and check caffeine | 1. Log USDA coffee entry, 2. Check caffeine tracker | Caffeine automatically tracked from food |
| Quick-add and daily total | 1. Quick-add espresso (63mg), 2. Quick-add coffee (95mg) | Daily total: 158 mg |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User tracks caffeine for a day | 1. Log morning coffee (food log), 2. Quick-add afternoon espresso, 3. Log green tea, 4. Check caffeine tracker | Timeline shows 3 entries, daily total accurate, active caffeine estimate reflects half-life decay |

---

### NU-030: Home Screen Widgets

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-030 |
| **Feature Name** | Home Screen Widgets |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As Jordan the Weight Manager, I want a home screen widget showing my daily calorie progress, so that I can glance at my tracking status without opening the app.

**Secondary:**
> As Alex the Active, I want a widget showing my macro progress rings, so that I can check if I have hit my protein target at a glance.

#### 3.3 Detailed Description

Home Screen Widgets bring key MyNutrition data to the device's home screen (iOS) or launcher (Android). Widgets provide at-a-glance information without requiring the app to be opened, reducing friction and reinforcing awareness of nutritional intake throughout the day.

Three widget configurations are offered in small, medium, and large sizes:
- Small: Calorie progress ring with consumed/remaining
- Medium: Calorie ring plus macro bars (P/C/F) with gram values
- Large: Calorie ring, macro bars, water progress, and streak count

Widgets update periodically (every 15-30 minutes) and immediately after food is logged in the app. Tapping any widget deep-links into the MyNutrition dashboard.

This feature is mobile-only (iOS WidgetKit, Android App Widget). Not applicable on web.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-005: Daily Nutrition Dashboard - widget data mirrors dashboard data
- NU-013: Water Intake Tracking - large widget includes water progress

**External Dependencies:**
- iOS WidgetKit framework
- Android App Widget framework

**Assumed Capabilities:**
- Platform supports home screen widgets
- App can share data with widget extensions

#### 3.5 User Interface Requirements

##### Widget: Small (2x2)

**Layout:**
- Circular calorie progress ring (centered)
- Inside ring: consumed calories (bold number), "/" goal calories (smaller)
- Below ring: "kcal" label
- Background: matches the module's accent color (green) with dark theme

##### Widget: Medium (4x2)

**Layout:**
- Left half: calorie progress ring (same as small)
- Right half: three horizontal progress bars for Protein, Carbs, Fat
  - Each bar shows: macro name, "Xg / Yg" values, filled bar
  - Bar colors match the app: P=blue, C=amber, F=pink

##### Widget: Large (4x4)

**Layout:**
- Top section: calorie ring (left) and macro bars (right) - same as medium
- Middle section: water progress bar showing "X / Y ml" with drop icon
- Bottom section: streak count with flame icon: "X day streak"
- Bottom-right: quick-add button that deep-links to the Add Food flow

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Data available | Food logged today | Current progress values |
| No data today | No food logged | All values at 0, ring empty |
| No goals set | Goals not configured | "Open app to set goals" text |
| Stale data | Widget has not updated in >1 hour | Shows last known data (no visual indicator of staleness) |

**Interactions:**
- Tap any widget: deep-links to MyNutrition Dashboard
- Tap quick-add button (large widget): deep-links to Add Food flow
- Widget auto-refreshes every 15-30 minutes and after food log changes

#### 3.6 Data Requirements

Widgets read from the same data sources as the Dashboard (NU-005). No new entities are introduced. Data is shared between the app and widget extension via a shared App Group container (iOS) or Content Provider (Android).

#### 3.7 Business Logic Rules

##### Widget Data Refresh

**Purpose:** Provide current nutrition data to home screen widgets.

**Logic:**

```
1. ON widget refresh (periodic or triggered):
     QUERY today's FoodLogEntry totals (calories, protein, carbs, fat)
     QUERY active NutritionGoal (calorie and macro goals)
     QUERY today's WaterLogEntry total (if water tracking enabled)
     QUERY current streak (StreakRecord)
2. WRITE data to shared container:
     { calories_consumed, calorie_goal, protein_g, protein_goal, carbs_g, carbs_goal,
       fat_g, fat_goal, water_ml, water_goal, streak_days, last_updated }
3. TRIGGER widget UI update
```

**Edge Cases:**
- App has not been opened today: widget shows stale data from last sync
- Widget extension cannot access database: show "Open app to refresh" message
- Goals change: widget updates on next refresh cycle

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Widget cannot access shared data | "Open MyNutrition to refresh" text | User opens app, triggering data sync |
| Goals not set | "Set goals in app" text on widget | User opens app and sets goals |
| Widget size not supported | Widget not available in that size option | Only supported sizes shown in widget picker |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has logged 1,500 kcal against a 2,000 kcal goal,
   **When** the small widget displays on the home screen,
   **Then** the ring shows 75% fill with "1,500 / 2,000" and "kcal" label.

2. **Given** the user logs a new food in the app,
   **When** they return to the home screen,
   **Then** the widget updates within 15 minutes (or sooner if triggered) to reflect the new totals.

3. **Given** the user taps the medium widget,
   **When** the app opens,
   **Then** it deep-links directly to the MyNutrition Dashboard.

**Negative Tests:**

4. **Given** no goals are set,
   **When** the widget displays,
   **Then** it shows "Set goals in app" instead of progress rings.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| widget data includes calories | consumed: 1500, goal: 2000 | widget shows 1500/2000 |
| widget data includes macros | P: 120g, C: 180g, F: 55g | macro bars reflect values |
| widget handles no goals | goal: null | "Set goals" text |
| widget handles no data | consumed: 0 | ring at 0%, values at 0 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Data sync after food log | 1. Log 500 kcal food, 2. Check shared container | Container has updated calories |
| Widget tap deep-links to dashboard | 1. Tap widget | App opens to MyNutrition Dashboard |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User adds widget and tracks food | 1. Add medium widget to home screen, 2. Log breakfast (400 kcal), 3. Return to home screen, 4. Widget refreshes | Widget shows 400 kcal progress with macro bars updated |

---

### NU-031: Apple Watch Quick-Log

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NU-031 |
| **Feature Name** | Apple Watch Quick-Log |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As Alex the Active, I want to log water and quick-add calories from my Apple Watch between sets at the gym, so that I can track without pulling out my phone.

**Secondary:**
> As Sam the Scanner, I want to see my calorie progress on my watch face as a complication, so that I always know where I stand.

#### 3.3 Detailed Description

Apple Watch Quick-Log extends MyNutrition to the Apple Watch with a minimal, glanceable interface focused on the most common quick actions: logging water, logging favorite foods (one tap), quick-adding calories, and viewing today's calorie and macro progress.

The watch app does not replicate the full MyNutrition experience. It focuses on three use cases: quick-log water (2-3 taps), quick-log a favorite food (2-3 taps), and glance at progress (0 taps via complication). The full food search and logging workflow remains on the phone.

Data syncs between the watch and phone via the WatchConnectivity framework. Changes made on the watch are reflected on the phone within seconds when both devices are reachable. If the phone is not reachable, changes are queued and synced when connectivity is restored.

This feature is iOS only (Apple Watch). Not applicable on Android or web.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NU-001: Food Logging - watch creates food log entries
- NU-013: Water Intake Tracking - watch logs water entries
- NU-014: Favorite Foods and Quick Add - watch uses quick adds

**External Dependencies:**
- Apple Watch hardware
- WatchOS and WatchConnectivity framework
- Paired iPhone with MyNutrition installed

**Assumed Capabilities:**
- User has an Apple Watch paired with their iPhone
- WatchConnectivity is available for phone-watch data sync

#### 3.5 User Interface Requirements

##### Watch App: Main Screen

**Layout:**
- **Header:** "MyNutrition" with today's date
- **Calorie ring:** A compact calorie progress ring showing consumed/goal (similar to Apple's Activity rings style)
- **Macro row:** Three small numbers: P/C/F grams consumed
- **Action buttons (scrollable below):**
  - "Log Water" button with water drop icon
  - "Quick Add" button with lightning bolt icon
  - "Favorites" button with heart icon

##### Watch App: Log Water Screen

**Layout:**
- Title: "Log Water"
- Preset buttons stacked vertically: 250 ml, 500 ml, 750 ml
- "Custom" button for manual entry via the Digital Crown

**Interactions:**
- Tap a preset: logs water immediately, shows brief check mark confirmation, returns to main screen
- Tap Custom: opens number input using Digital Crown

##### Watch App: Quick Add Screen

**Layout:**
- Title: "Quick Add"
- A scrollable list of the user's Quick Add entries (from NU-014), sorted by usage count
- Each entry shows: label and calorie total
- Maximum 10 quick adds displayed

**Interactions:**
- Tap a quick add: logs all items immediately, shows check mark, returns to main screen

##### Watch App: Favorites Screen

**Layout:**
- Title: "Favorites"
- A scrollable list of the user's top 10 favorite foods, sorted by frequency
- Each entry shows: food name and calories per default serving

**Interactions:**
- Tap a favorite: logs 1 default serving immediately, shows check mark, returns to main screen

##### Watch Complication

**Layout (circular):**
- A mini calorie progress ring with consumed/goal numbers
- Updates every 15 minutes

**Layout (rectangular):**
- Calorie progress bar with "X / Y kcal" text
- Updates every 15 minutes

**Interactions:**
- Tap complication: opens the MyNutrition watch app main screen

#### 3.6 Data Requirements

The watch app does not maintain a separate database. It syncs with the phone app via WatchConnectivity.

##### Sync Data Model

| Field | Direction | Description |
|-------|-----------|-------------|
| daily_calories | Phone to Watch | Today's calorie total and goal |
| daily_macros | Phone to Watch | Today's P/C/F grams and goals |
| daily_water | Phone to Watch | Today's water intake and goal |
| quick_adds | Phone to Watch | Top 10 quick add entries |
| favorites | Phone to Watch | Top 10 favorite foods |
| new_food_log_entry | Watch to Phone | Food entry created on watch |
| new_water_entry | Watch to Phone | Water entry created on watch |

#### 3.7 Business Logic Rules

##### Watch-Phone Sync

**Purpose:** Keep watch and phone data in sync.

**Logic:**

```
1. ON app launch or wake:
     REQUEST latest data from phone via WatchConnectivity
2. ON data received from phone:
     UPDATE local display values (calories, macros, water, quick adds, favorites)
3. ON user action (log food or water):
     CREATE local entry for immediate display
     SEND entry to phone via WatchConnectivity
     IF phone not reachable:
       QUEUE entry for transfer when connectivity is restored
4. ON phone confirmation:
     MARK entry as synced
5. COMPLICATION updates every 15 minutes via background refresh
```

**Edge Cases:**
- Phone not reachable: queue entries; sync when phone is in range
- Multiple entries queued: send all on reconnect
- Watch app opened without ever syncing: show "Connect to phone" message
- Sync conflict (entry created on both): phone version wins; duplicates are prevented by entry ID

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Phone not reachable | "Queued - will sync when phone is nearby" text on logged entry | Auto-syncs when phone is in range |
| No quick adds or favorites set up | "Set up quick adds on your phone" message | User opens phone app to create quick adds |
| Watch app has never synced | "Open MyNutrition on iPhone to sync" | User opens phone app |
| Sync fails repeatedly | "Could not sync with phone. Changes are saved locally." | Retry on next app open |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens the watch app and their phone has today's data (1,200 / 2,000 kcal),
   **When** the main screen loads,
   **Then** the calorie ring shows 60% fill with "1,200 / 2,000 kcal" and P/C/F grams below.

2. **Given** the user taps "Log Water" and taps "500 ml" on the watch,
   **When** the log completes,
   **Then** a check mark confirms, the watch returns to the main screen, and the phone's water tracker updates within seconds.

3. **Given** the user taps their "Morning Oatmeal" quick add on the watch,
   **When** the log completes,
   **Then** all quick add items are logged, the calorie ring updates, and entries appear on the phone.

**Edge Cases:**

4. **Given** the phone is not in Bluetooth range,
   **When** the user logs water on the watch,
   **Then** the entry is queued with "Will sync when phone is nearby" message and syncs automatically later.

5. **Given** the user has no quick adds configured,
   **When** they tap "Quick Add" on the watch,
   **Then** the screen shows "Set up quick adds on your phone."

**Negative Tests:**

6. **Given** the watch app has never synced with the phone,
   **When** the main screen loads,
   **Then** "Open MyNutrition on iPhone to sync" appears with no data displayed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| displays calorie progress | consumed: 1200, goal: 2000 | ring: 60%, text: "1200/2000" |
| queues entry when phone unavailable | phone: unreachable, action: log water | entry queued locally |
| syncs queued entries on reconnect | 3 queued entries, phone: becomes reachable | all 3 sent to phone |
| limits quick adds to 10 | 15 quick adds on phone | watch shows top 10 by usage |
| limits favorites to 10 | 20 favorites on phone | watch shows top 10 by frequency |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Log water on watch, verify on phone | 1. Log 500 ml on watch, 2. Check phone water tracker | Phone shows 500 ml entry from watch |
| Quick add on watch, verify food log | 1. Tap quick add on watch, 2. Check phone food log | Food entries from quick add appear on phone |
| Phone data appears on watch | 1. Log food on phone, 2. Open watch app | Watch shows updated calorie total |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User tracks from watch during workout | 1. Glance at complication (1,200 kcal), 2. Log 500 ml water between sets, 3. Quick-add protein shake after workout, 4. Check phone | Phone shows water entry + protein shake logged from watch, totals match |

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

The data model centers on the FoodLogEntry, which records every food a user consumes. Each entry references a food from one of four sources: the USDA database (Food), barcode products (BarcodeProduct), custom foods (CustomFood), or recipes (Recipe). Recipes are composed of RecipeIngredient records that each reference a food source. Users set goals via NutritionGoal and body stats via UserBodyStats, which together drive the TDEE and calorie target calculations.

Supporting entities track water intake (WaterLogEntry, WaterGoal), body weight (WeighIn, WeightGoal), caffeine (CaffeineLogEntry), daily notes (DailyNote), quick-add templates (QuickAdd, QuickAddItem), meal plans (MealPlanEntry, MealPlanTemplate), recently used foods (RecentFood), streak progress (StreakRecord), onboarding state (OnboardingState), and user settings (NutritionSettings).

All user data tables use the `nu_` prefix in the MyLife hub SQLite database.

### 4.2 Complete Entity Definitions

#### Entity: FoodLogEntry (`nu_food_log_entries`)

Defined in NU-001. Primary table recording all consumed food. Fields: id, food_id, food_source, food_name, date, meal_slot, time_logged, quantity, serving_unit, serving_weight_grams, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, cholesterol_mg, saturated_fat_g, trans_fat_g, notes, created_at, updated_at.

#### Entity: Food (`nu_foods`) - Read-Only Bundled Database

Defined in NU-002. USDA FoodData Central entries stored in a separate read-only SQLite database. Fields: fdc_id, description, food_category, brand_owner, data_source, plus 30+ nutrient fields per 100g, search_keywords.

#### Entity: FoodServing (`nu_food_servings`) - Read-Only Bundled Database

Defined in NU-002. Serving size definitions for USDA foods. Fields: id, fdc_id, description, gram_weight, is_default, sequence.

#### Entity: BarcodeProduct (`nu_barcode_products`)

Defined in NU-003. Products from Open Food Facts (bundled subset + online lookups). Fields: barcode, product_name, brand, image_url, serving_description, serving_weight_grams, plus nutrient fields per serving, data_source, off_product_id, last_verified, created_at, updated_at.

#### Entity: CustomFood (`nu_custom_foods`)

Defined in NU-010. User-created food entries. Fields: id, name, brand, barcode, serving_description, serving_weight_grams, calories, protein_g, carbs_g, fat_g, plus optional nutrient fields, notes, created_at, updated_at.

#### Entity: Recipe (`nu_recipes`)

Defined in NU-011. User-created recipes with computed per-serving nutrition. Fields: id, name, servings, serving_description, total_calories, per_serving nutrients, notes, ingredient_count, created_at, updated_at.

#### Entity: RecipeIngredient (`nu_recipe_ingredients`)

Defined in NU-011. Ingredients within a recipe. Fields: id, recipe_id, food_id, food_source, food_name, quantity, serving_unit, serving_weight_grams, computed nutrient fields, sequence, created_at.

#### Entity: NutritionGoal (`nu_nutrition_goals`)

Defined in NU-007. Calorie and macro goals with history. Fields: id, calorie_goal, protein/carbs/fat goal grams and percentages, macro_mode, preset, meal distribution percentages, effective_date, is_active, source, created_at, updated_at.

#### Entity: UserBodyStats (`nu_user_body_stats`)

Defined in NU-008. Body metrics for BMR/TDEE calculation. Fields: id, sex, age_years, weight_kg, height_cm, activity_level, preferred units, bmr_kcal, tdee_kcal, created_at, updated_at.

#### Entity: WaterLogEntry (`nu_water_log_entries`)

Defined in NU-013. Water intake records. Fields: id, date, amount_ml, time_logged, source, created_at.

#### Entity: WaterGoal (`nu_water_goals`)

Defined in NU-013. Daily water target. Fields: id, daily_goal_ml, preferred_unit, is_active, effective_date, created_at.

#### Entity: WeightGoal (`nu_weight_goals`)

Defined in NU-020. Weight target with timeline. Fields: id, start_weight_kg, goal_weight_kg, target_date, required_daily_adjustment, weekly_rate_kg, is_active, created_at.

#### Entity: WeighIn (`nu_weigh_ins`)

Defined in NU-020. Daily weight recordings. Fields: id, date, weight_kg, notes, created_at.

#### Entity: RecentFood (`nu_recent_foods`)

Defined in NU-009. Recently and frequently logged foods for quick access. Fields: id, food_id, food_source, food_name, nutrient summary fields, serving_description, log_count, last_logged_at, is_favorite, created_at, updated_at.

#### Entity: QuickAdd (`nu_quick_adds`)

Defined in NU-014. Quick-log templates. Fields: id, label, total_calories, item_count, usage_count, last_used_at, sequence, created_at, updated_at.

#### Entity: QuickAddItem (`nu_quick_add_items`)

Defined in NU-014. Items within a quick add. Fields: id, quick_add_id, food_id, food_source, food_name, quantity, serving_unit, nutrient fields, sequence.

#### Entity: MealPlanEntry (`nu_meal_plan_entries`)

Defined in NU-019. Planned food entries for future dates. Fields: id, food_id, food_source, food_name, date, meal_slot, quantity, serving_unit, nutrient fields, status, confirmed_at, food_log_entry_id, template_id, created_at, updated_at.

#### Entity: MealPlanTemplate (`nu_meal_plan_templates`)

Defined in NU-019. Reusable meal plan structures. Fields: id, name, total_calories, entry_count, usage_count, created_at, updated_at.

#### Entity: CaffeineLogEntry (`nu_caffeine_log_entries`)

Defined in NU-029. Caffeine intake records. Fields: id, date, amount_mg, source, source_description, food_log_entry_id, time_logged, created_at.

#### Entity: DailyNote (`nu_daily_notes`)

Defined in NU-022. Per-day diary notes. Fields: id, date, content, created_at, updated_at.

#### Entity: StreakRecord (`nu_streak_record`)

Defined in NU-017. Singleton tracking logging streak. Fields: id, current_streak, longest_streak, streak_start_date, last_logged_date, reminder_enabled, reminder_time, created_at, updated_at.

#### Entity: RestaurantMenuItem (`nu_restaurant_menu_items`) - Read-Only Bundled Database

Defined in NU-028. Chain restaurant menu items. Fields: id, restaurant_name, item_name, category, serving_description, calories, macro and nutrient fields, data_source_url, last_verified.

#### Entity: NutritionSettings (`nu_settings`)

Defined in NU-025. Singleton user preferences. Fields: id, unit preferences, meal time ranges, notification settings, display toggles, default_search_tab, created_at, updated_at.

#### Entity: OnboardingState (`nu_onboarding`)

Defined in NU-026. Singleton onboarding progress. Fields: id, completed, current_step, skipped_steps, completed_at.

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| FoodLogEntry -> Food | many-to-one | Entry references USDA food (when food_source = "usda") |
| FoodLogEntry -> BarcodeProduct | many-to-one | Entry references barcode product (when food_source = "open_food_facts") |
| FoodLogEntry -> CustomFood | many-to-one | Entry references custom food (when food_source = "custom") |
| FoodLogEntry -> Recipe | many-to-one | Entry references recipe (when food_source = "recipe") |
| Food -> FoodServing | one-to-many | Each USDA food has multiple serving size definitions |
| Recipe -> RecipeIngredient | one-to-many | Each recipe has multiple ingredients |
| RecipeIngredient -> Food/CustomFood | many-to-one | Each ingredient references a food source |
| QuickAdd -> QuickAddItem | one-to-many | Each quick add has multiple food items |
| MealPlanEntry -> FoodLogEntry | one-to-one | Confirmed plan entry creates a log entry |
| MealPlanEntry -> MealPlanTemplate | many-to-one | Plan entries may derive from a template |
| CaffeineLogEntry -> FoodLogEntry | many-to-one | Caffeine entries may be derived from food log entries |
| RecentFood -> Food/BarcodeProduct/CustomFood/Recipe | many-to-one | Recent food references a food source |

### 4.4 Indexes

| Entity | Index | Fields | Reason |
|--------|-------|--------|--------|
| FoodLogEntry | idx_fle_date | (date) | Primary query: daily food log |
| FoodLogEntry | idx_fle_date_meal | (date, meal_slot) | Per-meal queries |
| FoodLogEntry | idx_fle_food | (food_id) | Food frequency analysis |
| FoodLogEntry | idx_fle_created | (created_at) | Recent entries for undo |
| Food | FTS5 | (description, search_keywords, food_category) | Full-text food search |
| Food | idx_food_category | (food_category) | Category browsing |
| FoodServing | idx_fs_fdc | (fdc_id) | Serving lookup by food |
| BarcodeProduct | idx_bp_barcode | (barcode) | Barcode lookup |
| CustomFood | idx_cf_name | (name) | Name search |
| CustomFood | idx_cf_barcode | (barcode) | Barcode lookup |
| Recipe | idx_rcp_name | (name) | Name search |
| RecipeIngredient | idx_ri_recipe | (recipe_id, sequence) | Ordered ingredient list |
| NutritionGoal | idx_ng_active | (is_active) | Current goal lookup |
| WaterLogEntry | idx_wle_date | (date) | Daily water total |
| WeighIn | idx_wi_date | (date DESC) | Weight timeline |
| RecentFood | idx_rf_last | (last_logged_at DESC) | Recent foods list |
| RecentFood | idx_rf_favorite | (is_favorite) | Favorites list |
| RecentFood | idx_rf_unique | (food_id, food_source) UNIQUE | Prevent duplicates |
| QuickAdd | idx_qa_usage | (usage_count DESC) | Most-used quick adds |
| MealPlanEntry | idx_mpe_date | (date, meal_slot) | Daily plan view |
| CaffeineLogEntry | idx_cle_date | (date, time_logged) | Daily caffeine timeline |
| RestaurantMenuItem | FTS5 | (restaurant_name, item_name, category) | Restaurant search |

### 4.5 Table Prefix

**MyLife hub table prefix:** `nu_`

All table names in the MyLife hub SQLite database are prefixed with `nu_` to avoid collisions with other modules. For example, the food log entries table is `nu_food_log_entries`.

The bundled USDA food database and restaurant menu database are stored in a separate read-only SQLite file and do not use the `nu_` prefix (they are not user data and are shared infrastructure).

### 4.6 Migration Strategy

- Tables are created when the MyNutrition module is first enabled in the MyLife hub
- Schema version is tracked in the hub's module_migrations table
- Bundled food database is delivered as a separate SQLite file included in the app binary; updates are delivered via app updates
- Data from standalone nutrition apps can be imported via NU-024 (Data Import)
- Destructive migrations (column removal, table drops) are deferred to major version bumps only
- All migrations are forward-only; rollback is achieved by restoring from user backup (NU-023 export)
- When a module is disabled, data is preserved (not deleted) so re-enabling restores the user's data

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Home | House/Dashboard icon | Dashboard | Daily calorie ring, macro rings, meal summary, quick actions |
| Log | Plus/Journal icon | Daily Food Log | Chronological food entries grouped by meal |
| Search | Magnifying glass icon | Food Search | Unified search across all food sources with barcode scanner |
| Reports | Chart/Bar icon | Reports | Weekly reports, nutrient charts, deficit tracker, weight chart |
| Settings | Gear icon | Settings | Goals, body stats, preferences, import/export, data management |

### 5.2 Navigation Flow

```
[Tab 1: Home - Dashboard]
  ├── Calorie Ring Tap -> Calorie Breakdown Screen
  ├── Macro Ring Tap -> Per-Meal Macro Breakdown (inline expand)
  ├── Meal Card Tap -> Daily Food Log (scrolled to meal)
  ├── "+" on Meal Card -> Food Search (meal pre-selected)
  ├── "Scan Barcode" -> Barcode Scanner
  ├── "Quick Add" -> Quick Calorie Entry Dialog
  ├── "Copy Yesterday" -> Copy Meals Modal
  ├── "Log Water" -> Water Tracker Screen
  ├── Nutrient Highlight Tap -> Micronutrient Detail
  └── Streak Badge Tap -> Streak Detail

[Tab 2: Log - Daily Food Log]
  ├── Date Navigation (arrows, calendar)
  ├── "+" FAB -> Food Search
  ├── Food Entry Tap -> Food Entry Detail Modal
  │     ├── Nutrition Facts Panel
  │     ├── Serving Size Selector
  │     └── Note Field
  ├── Food Entry Long Press -> Context Menu
  │     ├── Edit -> Food Entry Detail Modal
  │     ├── Copy to Meal -> Meal Picker
  │     ├── Copy to Day -> Date Picker
  │     ├── Move to Meal -> Meal Picker
  │     └── Delete (with Undo toast)
  └── Meal Section "+" -> Food Search (meal pre-selected)

[Tab 3: Search - Food Search]
  ├── Text Search -> Results List
  │     └── Result Tap -> Food Entry Detail Modal
  ├── Barcode Button -> Barcode Scanner
  │     └── Product Found -> Product Preview Sheet -> Food Entry Detail
  │     └── Product Not Found -> Create Custom Food
  ├── "Recent" Tab -> Recent Foods List
  ├── "Favorites" Tab -> Favorites List
  ├── "Custom" Tab -> Custom Foods List
  │     └── "Create Custom Food" -> Custom Food Form
  ├── Category Card Tap -> Category-Filtered Results
  └── Heart Icon Tap -> Toggle Favorite

[Tab 4: Reports]
  ├── Weekly Report -> Weekly Report Screen
  ├── Nutrient Reports -> Nutrient Charts Screen
  │     ├── Calories Tab -> Calorie Trend Chart
  │     ├── Macros Tab -> Macro Composition Charts
  │     ├── Nutrients Tab -> Individual Nutrient Chart
  │     └── Categories Tab -> Food Category Pie Chart
  ├── Deficit Tracker -> Deficit/Surplus Screen
  ├── Weight Chart -> Weight Goal Screen
  │     └── "Weigh In" -> Weight Entry Dialog
  ├── Micronutrient Detail -> Micronutrient Screen
  └── Streak Detail -> Streak History Screen

[Tab 5: Settings]
  ├── "Edit Goals" -> Goal Setup Screen
  │     └── "Calculate for Me" -> TDEE Calculator
  ├── "Edit Body Stats" -> TDEE Calculator
  ├── "Edit Weight Goal" -> Weight Goal Screen
  ├── "Edit Water Goal" -> Water Goal Settings
  ├── Units Configuration (inline toggles)
  ├── Meal Time Ranges (inline time pickers)
  ├── Notification Preferences (inline toggles)
  ├── Display Preferences (inline toggles)
  ├── "Export Data" -> Export Screen
  ├── "Import Data" -> Import Screen
  ├── "Delete All Data" -> Confirmation Dialog
  ├── Quick Add Manager -> Quick Add List
  │     └── "Create Quick Add" -> Quick Add Builder
  ├── Meal Planner -> Meal Plan Screen
  │     └── "Templates" -> Template Manager
  └── About (database versions, app version)
```

### 5.3 Screen Inventory

| Screen | Route/Path | Purpose | Entry Points |
|--------|-----------|---------|-------------|
| Dashboard | `/nutrition` | Daily calorie and macro overview | Tab 1, module launch |
| Daily Food Log | `/nutrition/log` | View and manage food entries | Tab 2, meal card tap |
| Food Search | `/nutrition/search` | Find foods to log | Tab 3, "+" buttons |
| Barcode Scanner | `/nutrition/scan` | Scan product barcodes | Search screen, quick action |
| Food Entry Detail | `/nutrition/entry/:id` | View/edit a food entry | Tap entry row |
| Custom Food Form | `/nutrition/custom/new` | Create custom food | Search (no results), custom tab |
| Custom Food Edit | `/nutrition/custom/:id/edit` | Edit custom food | Long press custom food |
| Recipe Builder | `/nutrition/recipe/new` | Create recipe | Search, custom tab |
| Recipe Edit | `/nutrition/recipe/:id/edit` | Edit recipe | Long press recipe |
| Goal Setup | `/nutrition/goals` | Set calorie and macro goals | Settings, onboarding |
| TDEE Calculator | `/nutrition/tdee` | Calculate BMR and TDEE | Goal setup, settings |
| Water Tracker | `/nutrition/water` | Log and track water | Dashboard quick action |
| Weekly Report | `/nutrition/reports/weekly` | 7-day summary | Reports tab |
| Nutrient Charts | `/nutrition/reports/charts` | Long-term nutrient trends | Reports tab |
| Deficit Tracker | `/nutrition/reports/deficit` | Calorie balance tracking | Reports tab |
| Micronutrient Detail | `/nutrition/micronutrients` | Daily vitamin and mineral breakdown | Dashboard, reports |
| Streak Detail | `/nutrition/streak` | Streak history and calendar | Dashboard streak badge |
| Weight Goal | `/nutrition/weight` | Weight tracking and goals | Reports tab, settings |
| Meal Planner | `/nutrition/planner` | Plan future meals | Settings |
| Quick Add Manager | `/nutrition/quick-adds` | Manage quick add templates | Settings |
| Export Data | `/nutrition/export` | Export all data | Settings |
| Import Data | `/nutrition/import` | Import from competitors | Settings, onboarding |
| Settings | `/nutrition/settings` | Configure preferences | Tab 5 |
| Diary View | `/nutrition/diary` | Notes-focused food log | Log screen toggle |

### 5.4 Deep Link Patterns

| Pattern | Target | Parameters |
|---------|--------|-----------|
| `mylife://nutrition` | Dashboard | None |
| `mylife://nutrition/log?date=YYYY-MM-DD` | Daily Food Log for date | date: ISO date string |
| `mylife://nutrition/search` | Food Search | None |
| `mylife://nutrition/scan` | Barcode Scanner | None |
| `mylife://nutrition/entry/:id` | Food Entry Detail | id: UUID of entry |
| `mylife://nutrition/water` | Water Tracker | None |
| `mylife://nutrition/add?meal=lunch` | Add Food with meal pre-selected | meal: breakfast/lunch/dinner/snack |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| Eating window enforcement | MyFast | MyNutrition | MyFast sends active eating window start/end times | On food log attempt: if MyFast is enabled and user is in a fasting window, show warning "You are currently fasting. Log this food anyway?" |
| Fasting nutrition correlation | MyNutrition | MyFast | MyNutrition sends daily calorie totals | On MyFast report generation: include nutrition data for eating windows |
| Recipe nutrition auto-log | MyRecipes | MyNutrition | MyRecipes sends completed recipe with servings | When user marks a recipe as "cooked" in MyRecipes: offer to log it in MyNutrition with portion selection |
| Recipe sharing | MyNutrition | MyRecipes | MyNutrition recipes sync to MyRecipes | On recipe create/edit in MyNutrition: if MyRecipes is enabled, offer to save to MyRecipes library |
| Pre/post workout nutrition | MyWorkouts | MyNutrition | MyWorkouts sends workout timestamps and calorie burn data | On workout completion: display pre/post workout nutrition window on MyNutrition dashboard ("You burned X kcal. Protein intake around workout: Yg") |
| Calorie burn adjustment | MyWorkouts | MyNutrition | MyWorkouts sends exercise calorie burn | On workout log: add burned calories to TDEE for the day, updating the deficit/surplus tracker |
| Nutrition logging as habit | MyNutrition | MyHabits | MyNutrition sends daily logging event | At end of day: if MyHabits is enabled, mark "Log food" habit as complete if at least 1 food entry exists |
| Daily calorie to health summary | MyNutrition | MyHealth | MyNutrition sends daily calorie and macro summary | On MyHealth daily report: include nutrition summary (calories, macros, water) |
| Food-medication timing | MyMeds | MyNutrition | MyMeds sends medication schedule with food interaction flags | On food log: if a medication has a "take with food" flag and is due within 1 hour, show reminder "Take [medication] with this meal" |
| Food spending analysis | MyNutrition | MyBudget | MyNutrition sends restaurant meal data | Optional: when logging a restaurant meal, offer to log the cost in MyBudget food category |

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| Food log entries | Local SQLite (nu_food_log_entries) | At rest (OS-level) | No | Never leaves device |
| Custom foods | Local SQLite (nu_custom_foods) | At rest (OS-level) | No | Never leaves device |
| Recipes | Local SQLite (nu_recipes) | At rest (OS-level) | No | Never leaves device |
| Goals and body stats | Local SQLite (nu_nutrition_goals, nu_user_body_stats) | At rest (OS-level) | No | Sensitive body measurements |
| Weight data | Local SQLite (nu_weigh_ins) | At rest (OS-level) | No | Sensitive body data |
| Water and caffeine logs | Local SQLite | At rest (OS-level) | No | Never leaves device |
| Diary notes | Local SQLite (nu_daily_notes) | At rest (OS-level) | No | May contain sensitive health observations |
| USDA food database | Bundled SQLite (read-only) | No | No | Public domain data, no user data |
| Barcode product cache | Local SQLite (nu_barcode_products) | No | No | Products fetched from Open Food Facts API; no user data transmitted |
| Restaurant menu data | Bundled SQLite (read-only) | No | No | Publicly available nutrition data |
| AI food recognition model | Bundled binary | No | No | On-device only; no images transmitted |
| Meal photos (AI logging) | Temporary local storage | No | No | Deleted after analysis; never uploaded |

### 7.2 Network Activity

| Activity | Purpose | Data Sent | Data Received | User Consent |
|----------|---------|-----------|--------------|-------------|
| Barcode lookup (online fallback) | Find products not in bundled database | Barcode number only | Product name, brand, nutrition data | Explicit opt-in in Settings ("Enable online barcode lookup") |
| None (all other features) | N/A | N/A | N/A | N/A |

All core functionality operates entirely offline. The only optional network activity is barcode lookup for products not in the bundled Open Food Facts subset, and this requires explicit user opt-in.

### 7.3 Data That Never Leaves the Device

- Food log entries and what the user eats
- Custom foods and recipes
- Calorie and macro goals
- Body measurements (weight, height, age, sex)
- Weight tracking history
- Water and caffeine intake
- Diary notes and food-related observations
- Meal photos (temporary, deleted after AI analysis)
- Streak and habit data
- Meal plans and templates
- Quick add configurations
- All analytics, reports, and charts

### 7.4 User Data Ownership

- **Export:** Users can export all data in CSV or JSON format (NU-023). Export includes every entity type with full field data.
- **Delete:** Users can delete all module data from Settings (NU-025). Deletion requires typing "DELETE" to confirm. Deletion is irreversible.
- **Portability:** CSV format is compatible with spreadsheet applications. JSON format is machine-readable for programmatic processing. Column headers and field names are documented.
- **Import:** Users can import data from MyFitnessPal, Cronometer, and Lose It! (NU-024), ensuring they are not locked into any platform.

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| App-level lock | Inherits MyLife hub biometric/PIN lock if configured | No module-specific lock; follows hub settings |
| Data at rest | OS-level encryption (iOS Data Protection, Android FBE) | No additional app-level encryption layer |
| Network requests | HTTPS only for Open Food Facts API (when enabled) | Certificate pinning recommended for the single API endpoint |
| Export file security | Exported files are not encrypted | User is responsible for securing exported files; warning shown before export |
| Photo handling | Meal photos for AI logging are stored temporarily and deleted immediately after analysis | Photos never leave local temporary storage; no photo library access required |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| BMR | Basal Metabolic Rate. The number of calories the body burns at rest to maintain basic physiological functions (breathing, circulation, cell production). Measured in kcal/day. |
| TDEE | Total Daily Energy Expenditure. The total number of calories burned in a day, including BMR plus physical activity. Calculated as BMR multiplied by an activity factor. |
| Mifflin-St Jeor | The equation used to estimate BMR. Men: 10*kg + 6.25*cm - 5*age + 5. Women: 10*kg + 6.25*cm - 5*age - 161. Recommended by the American Dietetic Association. |
| Macronutrient (Macro) | One of the three primary nutrient categories that provide energy: protein, carbohydrates, and fat. Alcohol is sometimes counted as a fourth macro. |
| Micronutrient | Vitamins and minerals required in small amounts for proper body function. Examples: iron, calcium, vitamin D, vitamin C. |
| Atwater Factor | The standard calorie-per-gram conversion for each macronutrient: protein = 4 kcal/g, carbohydrates = 4 kcal/g, fat = 9 kcal/g, alcohol = 7 kcal/g. |
| Daily Value (DV) | The FDA-recommended daily intake amount for a nutrient, based on a 2,000 calorie diet. Used to calculate % DV on nutrition labels. |
| % DV | Percentage of Daily Value. How much of the recommended daily intake a serving provides. Example: 18 mg iron out of 18 mg DV = 100% DV. |
| USDA FoodData Central | The United States Department of Agriculture's comprehensive food composition database. Contains nutrient data for 8,000+ foods. Public domain. |
| Open Food Facts | An open-source, community-maintained database of food product information including nutrition data and barcodes. 2.5M+ products. Creative Commons licensed. |
| FTS5 | Full-Text Search version 5. A SQLite extension that enables fast text search across database fields. Used for food name search. |
| UPC | Universal Product Code. A 12-digit barcode standard used primarily in North America for product identification. |
| EAN | European Article Number. A 13-digit (EAN-13) or 8-digit (EAN-8) barcode standard used internationally. |
| Calorie Deficit | Consuming fewer calories than the body burns (TDEE). Results in weight loss. A 500 kcal/day deficit results in approximately 0.45 kg/week loss. |
| Calorie Surplus | Consuming more calories than the body burns (TDEE). Results in weight gain. A 500 kcal/day surplus results in approximately 0.45 kg/week gain. |
| Meal Slot | One of four daily meal categories: Breakfast, Lunch, Dinner, Snack. Each food log entry is assigned to exactly one meal slot. |
| Quick Add | A saved food logging template that logs one or more foods with preset serving sizes in a single tap. |
| Streak | The number of consecutive calendar days the user has logged at least one food entry. Used as a habit-building motivational metric. |
| Serving Size | A standardized or user-defined portion of a food. Can be expressed as a description (e.g., "1 cup"), a gram weight (e.g., "240g"), or a count (e.g., "1 medium"). |
| Food Source | The database a food record comes from: USDA (usda), Open Food Facts barcode (open_food_facts), user-created (custom), or recipe (recipe). |
| EMA | Exponential Moving Average. A smoothing technique that gives more weight to recent data points. Used for weight trend smoothing with a configurable smoothing factor. |
| Meal Plan | A set of planned food entries for a future date. Planned entries can be confirmed (converting them to actual food log entries) when the date arrives. |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | Claude (Spec Writer Agent) | Initial specification - Sections 1-2 and NU-001 through NU-007 |
| 1.1 | 2026-03-07 | Claude (Spec Writer Agent) | Complete specification - NU-008 through NU-031, Sections 4-8 |

---

## Appendix B: Open Questions

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | Should the AI photo food logging model be bundled or downloaded on first use? | NU-027 - model is 20-50 MB. Bundling increases app size; download-on-first-use saves space but requires network. | TBD | - |
| 2 | Should custom meal slot names be supported in a future version? | NU-006 - some users want "Pre-Workout", "Second Breakfast". Currently fixed at 4 slots. | Deferred to post-MVP | - |
| 3 | Should the restaurant menu database cover international chains? | NU-028 - initial dataset is US-focused (top 100 US chains). International chains would increase data size. | Start US-only, expand based on user demand | - |
| 4 | Should the water tracker share data with MyFast for fasting hydration tracking? | NU-013 - water consumption during fasting is common. Cross-module sync would add value. | Planned for Phase 4 cross-module integration | - |
| 5 | What on-device ML framework should be used for food recognition? | NU-027 - Core ML (iOS), TensorFlow Lite (Android), or ONNX Runtime (cross-platform). | TBD - evaluate cross-platform options | - |
