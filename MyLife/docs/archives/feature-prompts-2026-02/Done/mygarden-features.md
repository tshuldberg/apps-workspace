# MyGarden Feature Set

## Problem Statement

You are working in the MyLife monorepo at `/Users/trey/Desktop/Apps/MyLife/`. MyLife is a unified hub app consolidating 10+ privacy-first personal app modules into a single cross-platform application. Each module implements a `ModuleDefinition` contract from `@mylife/module-registry` and stores data in a shared SQLite database using table-name prefixes (`rc_` for recipes, inheriting the original prefix).

**MyGarden** is a new consolidated app that absorbs three previously separate apps: **MyRecipes** (recipe management and pantry tracking), **MyRSVP** (event and dinner party planning), and a new garden-tracking experience. The concept is "garden-to-table": grow it, cook it, host a dinner for it. MyRecipes is being **refactored into MyGarden** as the app name and primary brand.

**Current MyRecipes state:** The standalone source of truth lives at `/Users/trey/Desktop/Apps/MyLife/MyRecipes/`, a Turborepo monorepo with `packages/shared/src/` containing: db schema (11 SQLite tables), models, URL import (Schema.org parser), text ingredient parser, recipe scaling, grocery engine with smart categorization, full pantry management (barcode scanning, photo recognition, expiration tracking, pantry-to-recipe matching, nutrition data). The hub module lives at `modules/recipes/` with web routes in `apps/web/app/recipes/`. The shared package at `MyRecipes/packages/shared/src/` contains: `db/`, `models/`, `parser/`, `scaling/`, `grocery/`, `pantry/`, `utils/`.

**Current MyRSVP state:** The `modules/rsvp/` directory exists in the hub but MyRSVP does not yet have a standalone repository with runtime code. It is design-phase only.

**What needs to be built (3 feature sets):**

### Feature Set 1: Meal Planning and Cooking Mode

The most impactful recipe app features that competitors like Paprika and Mealime offer. Users have recipes but no way to plan meals for the week or get guided through cooking.

**Features:**
- Meal planning calendar: weekly view where users drag recipes into breakfast/lunch/dinner/snack slots
- Auto-generated consolidated grocery list from the meal plan (merges ingredients, respects pantry stock)
- Step-by-step cooking mode: always-on screen, large text, one step at a time, auto-detected timers that start countdown when the step mentions a time (e.g., "bake for 25 minutes")
- AI recipe assistant / substitution engine: suggest ingredient swaps based on pantry contents, dietary restrictions, or missing items
- Recipe print support: full-page format and index card (3x5) format

### Feature Set 2: Garden Tracking (New)

The garden layer that makes this app unique. No major competitor combines garden tracking with recipe management. Users track what they grow, get care reminders, and connect harvests to recipes.

**Features:**
- Plant care tracking: add plants with species, location (indoor/outdoor/raised bed), planting date, and watering schedule
- Watering and care reminders with push notifications
- On-device ML plant identification via camera (TensorFlow Lite / Core ML)
- Garden planner: grid-based layout tool for plotting beds, containers, and plant positions
- Garden journal with photo timeline (track growth over time)
- Harvest tracking: log what you picked, when, and how much, connecting harvests to recipes ("Cook with what you grew")

### Feature Set 3: Event and Dinner Party Planning (MyRSVP Consolidation)

MyRSVP features bring the social/hosting dimension to the garden-to-table flow. Users plan dinner parties, manage guest lists, coordinate potlucks, and link the menu to their recipes.

**Features:**
- Event creation with date, time, location, description, and capacity
- RSVP management: invite guests (via link or contact), track responses (attending/maybe/declined)
- Guest list management with dietary preferences and allergies per guest
- Dinner party menu planning: link recipes from the library to an event menu, auto-generate a shopping list for the party
- Potluck coordination: guests claim dishes from a list, host sees who is bringing what
- Event timeline/agenda: schedule (e.g., "6:00 PM appetizers, 7:00 PM main course") visible to host and guests

---

## Acceptance Criteria

### Feature Set 1: Meal Planning and Cooking Mode

1. User opens Meal Planner tab -> sees a weekly calendar grid with meal slots (breakfast, lunch, dinner, snack) for each day; user drags a recipe from their library into Wednesday Dinner -> the slot fills with the recipe name and thumbnail
2. User taps "Generate Grocery List" on a meal plan -> sees a consolidated list where duplicate ingredients are merged (e.g., two recipes needing onions show total quantity), items already in the pantry are marked "In Stock" and can be toggled off
3. User opens a recipe and taps "Start Cooking" -> enters cooking mode: full-screen, one step at a time, large text, swipe to advance; when a step says "simmer for 15 minutes," a 15-minute countdown timer starts automatically with an audible alert at completion
4. User taps "Suggest Substitution" on an ingredient they are missing -> sees 2-3 AI-generated alternatives with quantity adjustments based on what is in their pantry

### Feature Set 2: Garden Tracking

5. User navigates to Garden tab and taps "Add Plant" -> enters species (with autocomplete), location, and watering schedule -> the plant appears on their garden dashboard with a countdown to next watering
6. User receives a push notification "Time to water your tomatoes" -> taps it -> opens the plant detail with a "Mark Watered" button; tapping it resets the watering countdown
7. User opens Garden Journal and taps the camera icon -> takes a photo of a plant -> the app identifies the species using on-device ML and suggests adding it to the garden; user confirms -> the photo is saved to the plant's growth timeline
8. User logs a harvest ("2 lbs tomatoes, Aug 15") -> the app suggests recipes from their library that use tomatoes, labeled "Cook with your harvest"

### Feature Set 3: Event and Dinner Party Planning

9. User taps "New Event" -> fills in dinner party details (date, time, location, capacity of 8) -> taps "Build Menu" -> sees their recipe library as a picker; selects 3 recipes -> the event now has a linked menu and an auto-generated shopping list for all 3 recipes scaled to 8 servings
10. User shares an event invite link -> guest opens the link, sees event details and menu, taps "Attending" and notes "nut allergy" -> host sees the updated RSVP list with dietary notes and a warning flag on any menu recipe containing nuts

---

## Constraint Architecture

**Musts:**
- Existing 11 recipe tables retain the `rc_` prefix unchanged
- New garden tables use `gd_` prefix (`gd_plants`, `gd_plant_care_logs`, `gd_garden_layouts`, `gd_garden_journal`, `gd_harvests`, `gd_harvest_recipe_links`)
- New event tables use `ev_` prefix (`ev_events`, `ev_guests`, `ev_rsvps`, `ev_menu_items`, `ev_potluck_claims`, `ev_event_timeline`)
- All data stored in local SQLite, zero cloud dependency for core features
- Meal planner must integrate with the existing grocery engine in `MyRecipes/packages/shared/src/grocery/`
- Cooking mode timers must work when the screen is locked (background timer with notification)
- On-device ML only (no cloud-based image recognition APIs)
- The app name changes from MyRecipes to MyGarden; update `ModuleDefinition` name, icon, and tagline accordingly

**Must-nots:**
- Do not remove or modify existing recipe tables or the pantry system
- Do not require user accounts for core garden or recipe features
- Do not add cloud sync for garden data
- Do not modify `packages/module-registry/` types or other modules
- Do not break existing recipe import/export or grocery list functionality

**Preferences:**
- Reuse the existing ingredient parser for cooking mode timer detection (regex for time patterns)
- Use the existing recipe scaling engine for dinner party serving adjustments
- For ML plant identification, prefer `expo-ml-kit` or TensorFlow Lite with a pre-trained plant model under 50MB
- Garden planner grid can use a simple 2D grid (no need for a full CAD-like tool)
- Event invite sharing via native share sheet (URL scheme or deep link)

**Escalation triggers:**
- If on-device ML plant identification models exceed 100MB or require native code outside the Expo ecosystem, defer to a photo-only journal without auto-identification
- If the existing grocery engine cannot handle meal-plan-level aggregation (7 days x 3 meals) without performance issues, flag for optimization
- If the rename from MyRecipes to MyGarden requires changes to the hub module registry ID (changing `recipes` to `garden`), stop and confirm the migration strategy for existing user data

---

## Subtask Decomposition

**Subtask 1: Meal Planning Schema and Engine (90 min)**
Add meal plan tables (`rc_meal_plans`, `rc_meal_plan_items`). Build meal plan CRUD with weekly view data queries. Implement grocery list aggregation that merges ingredients across planned recipes and checks pantry stock.

**Subtask 2: Cooking Mode (90 min)**
Build the step-by-step cooking mode UI: full-screen, one step at a time, swipe navigation. Implement time detection regex that finds patterns like "15 minutes" or "1 hour" in step text and starts a countdown timer. Handle background timer with notification alert.

**Subtask 3: Garden Schema and Plant Tracking (90 min)**
Add garden tables with `gd_` prefix. Build plant CRUD with species autocomplete (bundled plant database), watering schedule calculator, and care reminder notification scheduling.

**Subtask 4: Garden Journal and Harvest Tracking (60 min)**
Build garden journal with photo timeline per plant. Implement harvest logging with quantity and date. Connect harvests to recipe suggestions by matching harvest items to recipe ingredient lists.

**Subtask 5: Event and RSVP System (90 min)**
Add event tables with `ev_` prefix. Build event CRUD, guest management, RSVP tracking, and dietary preference storage. Implement menu linking (select recipes for an event) with auto-scaled shopping list generation.

**Subtask 6: Potluck and Event Timeline (60 min)**
Build potluck coordination (guests claim dishes from a list). Build event timeline/agenda creation. Implement invite sharing via native share sheet.

**Subtask 7: App Rename and Module Definition Update (30 min)**
Update `ModuleDefinition` from MyRecipes to MyGarden: new name, icon, tagline, accent color. Update hub routes. Ensure all existing recipe functionality remains intact under the new brand.

---

## Evaluation Design

1. **Meal plan grocery aggregation:** Create a 3-day meal plan with 2 recipes sharing "onion" as ingredient -> generated grocery list shows one "onion" entry with combined quantity; add onion to pantry -> it shows "In Stock"
2. **Cooking mode timer:** Open a recipe with step "Bake at 350F for 25 minutes" -> cooking mode auto-starts a 25:00 countdown; timer continues when screen locks; notification fires at 0:00
3. **Plant watering:** Add a plant with 3-day watering interval -> `getNextWateringDate()` returns 3 days from now; mark watered -> next date resets to 3 days from today
4. **Harvest-to-recipe:** Log a tomato harvest -> `getRecipesForHarvest('tomato')` returns recipes containing tomatoes in their ingredient list
5. **Type safety and parity:** `pnpm typecheck` exits 0; `pnpm check:parity` exits 0; existing recipe tests still pass
