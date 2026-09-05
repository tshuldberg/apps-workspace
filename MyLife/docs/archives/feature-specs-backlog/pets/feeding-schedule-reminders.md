# Feature Spec: Feeding Schedule & Reminders

## Metadata
- **Module:** pets
- **Priority Score:** 30 / 50 (A-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 4 x3 + Complexity 4 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Pet profile CRUD (already built, V1 schema includes `pt_feeding_schedules`)
- **Blocks:** Multi-pet dashboard daily task feed, Pet sitter info card export

## Business Context

### Why This Feature Exists
Pet owners with multi-meal schedules (puppies eat 3-4x/day, cats with medical diets need precise timing) currently rely on phone alarms or sticky notes. The existing `pt_feeding_schedules` table stores basic label/time/food data, but there is no meal logging, no daily completion tracking, no local push notification reminders, no dietary info storage, and no food transition tracking. This feature transforms the bare schedule into an interactive daily feeding dashboard that closes the gap with 11pets and PetDesk.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| 11pets | Yes | Premium | Per-pet feeding schedule with meal logging, reminders, dietary notes, multi-pet daily view |
| PetDesk | Yes | Free | Vet-practice-integrated feeding reminders, basic schedule, no food transition tracking |
| Pawp | No | N/A | Focused on vet telehealth, no feeding tools |
| FitBark | No | N/A | Activity tracker only, no feeding features |

### Target User
Multi-pet household managers (2-5 pets, mix of dogs/cats) who juggle different feeding schedules and dietary needs per pet. Also puppy/kitten owners on strict feeding regimens from their vet who need meal-time reminders and portion tracking. Currently these users use 11pets ($4.99/mo premium) or generic reminder apps that lack pet-specific context.

## Technical Context

### Where This Lives in MyLife

```
modules/pets/src/db/schema.ts          -- V3 migration: pt_feeding_logs, pt_dietary_info, pt_food_transitions
modules/pets/src/definition.ts         -- Add PETS_MIGRATION_V3
modules/pets/src/types.ts              -- New Zod schemas: FeedingLog, DietaryInfo, FoodTransition, enums
modules/pets/src/db/crud.ts            -- New CRUD: feeding logs, dietary info, food transitions, daily completion
modules/pets/src/engine/feeding.ts     -- Pure functions: daily completion check, transition ratio calculator
modules/pets/src/index.ts              -- Re-export new public API
modules/pets/src/__tests__/feeding.test.ts -- Engine + CRUD tests
apps/mobile/app/(pets)/feeding.tsx     -- Per-pet feeding schedule screen
apps/mobile/app/(pets)/components/MealCard.tsx         -- Meal card with "Fed" toggle
apps/mobile/app/(pets)/components/FoodTransitionBar.tsx -- Transition progress bar
apps/web/app/pets/[petId]/feeding/page.tsx             -- Web feeding screen
```

### Wireframe Position

```
Hub Dashboard
  └── MyPets card
       └── Pets tab (pet list)
            └── Pet Detail
                 └── Reminders tab (or direct nav)
                      └── Feeding Schedule ← YOU ARE HERE
```

The feeding schedule is accessible from the pet detail screen, either via the existing "Reminders" tab in the navigation or as a dedicated section within the pet detail view. The multi-pet daily view is accessible from the module-level dashboard.

### Data Model

The existing V1 schema has `pt_feeding_schedules` with basic columns (`id`, `pet_id`, `label`, `food_name`, `amount`, `feed_at`, `notes`, `created_at`, `updated_at`). V3 adds three new tables and extends the existing table with new columns.

```sql
-- V3 Migration: Extend feeding schedules + add logs, dietary info, transitions

-- Add new columns to existing pt_feeding_schedules
ALTER TABLE pt_feeding_schedules ADD COLUMN portion_size REAL;
ALTER TABLE pt_feeding_schedules ADD COLUMN portion_unit TEXT DEFAULT 'cups';
ALTER TABLE pt_feeding_schedules ADD COLUMN portion_unit_custom TEXT;
ALTER TABLE pt_feeding_schedules ADD COLUMN meal_label TEXT;
ALTER TABLE pt_feeding_schedules ADD COLUMN reminder_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE pt_feeding_schedules ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Feeding logs: one-tap "Fed" tracking per schedule per day
CREATE TABLE IF NOT EXISTS pt_feeding_logs (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES pt_feeding_schedules(id) ON DELETE CASCADE,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  fed_at TEXT NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Dietary info: one record per pet (allergies, restrictions, special instructions)
CREATE TABLE IF NOT EXISTS pt_dietary_info (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  allergies TEXT NOT NULL DEFAULT '[]',
  restrictions TEXT NOT NULL DEFAULT '[]',
  special_instructions TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pet_id)
);

-- Food transitions: track gradual food switches
CREATE TABLE IF NOT EXISTS pt_food_transitions (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  previous_food TEXT NOT NULL,
  new_food TEXT NOT NULL,
  start_date TEXT NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS pt_feeding_logs_schedule_date_idx
  ON pt_feeding_logs(schedule_id, date);
CREATE INDEX IF NOT EXISTS pt_feeding_logs_pet_date_idx
  ON pt_feeding_logs(pet_id, date);
CREATE INDEX IF NOT EXISTS pt_dietary_info_pet_idx
  ON pt_dietary_info(pet_id);
CREATE INDEX IF NOT EXISTS pt_food_transitions_pet_status_idx
  ON pt_food_transitions(pet_id, status);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter, Migration), `@mylife/module-registry` (ModuleDefinition), `@mylife/ui` (Cool Obsidian tokens, glass card components)
- **External:** `expo-notifications` (local push notifications for meal reminders on mobile), no external APIs
- **Cross-Module:** None for MVP. Future: feeding routines could surface as trackable habits in MyHabits module.

## Functional Requirements

### User Stories
1. As a pet owner, I want to set up a feeding schedule for each pet with meal times, portion sizes, and food brand so that I maintain a consistent feeding routine.
2. As a multi-pet household manager, I want to see all feeding times across all pets on a single daily view so that I do not mix up who gets fed when.
3. As a pet owner, I want to tap a single "Fed" button to log a meal as complete with a timestamp so that I can track whether each pet was fed on schedule.
4. As a pet owner, I want to receive a local push notification at each scheduled meal time so that I never forget a feeding.
5. As a pet owner transitioning my pet to new food, I want to see a daily ratio guide (old vs. new food percentages) so that I follow the vet-recommended gradual transition.
6. As a pet sitter, I want to see dietary restrictions and allergies prominently on the feeding screen so that I avoid giving the wrong food.

### Behavior Specification

**Setting up a feeding schedule:**
1. User navigates to a pet's detail screen
2. User taps the "Reminders" tab or a "Feeding" section
3. System shows the feeding schedule screen (empty state if no meals exist)
4. User taps "+" or "Add a Meal" CTA
5. System opens Add Meal bottom sheet with fields: meal time (time picker), food name (text), portion size (numeric), portion unit (picker), meal label (optional picker), reminder toggle (default on), notes (optional text)
6. User fills in fields and taps "Save"
7. System validates input (food name required, portion > 0), persists to `pt_feeding_schedules`, schedules local notification if reminder enabled
8. Meal card appears in the schedule list sorted by time

**Logging a meal as fed:**
1. User views the feeding schedule for a pet
2. Each meal card shows an empty circle toggle on the right
3. User taps the "Fed" toggle on a meal card
4. System creates a `pt_feeding_logs` record with current timestamp and today's date
5. Toggle animates to a filled green checkmark, card shows "Fed at HH:MM AM/PM"
6. If all meals for today are now logged, a banner appears: "All meals complete for today!"

**Food transition tracking:**
1. User taps "Start Food Transition" button on the feeding screen
2. System opens Food Transition modal: previous food, new food, start date, duration (7/10/14 days), notes
3. User fills in fields and saves
4. System validates (previous != new food), creates `pt_food_transitions` record, cancels any existing active transition for this pet
5. Transition progress bar appears at the top of the feeding screen showing current day, ratio, and visual progress

**Managing dietary info:**
1. User taps "Dietary Info" in the feeding screen nav
2. System opens Dietary Info modal: allergies (tag input), restrictions (tag input), special instructions (multiline text)
3. User adds/removes tags and saves
4. System upserts `pt_dietary_info` record (one per pet)
5. If allergies exist, a warning banner shows at the top of the feeding screen: "Allergic to: [items]"

### Edge Cases

- **No schedules exist:** Show empty state with food bowl illustration and "Add a Meal" CTA. `all_complete` returns true (vacuously).
- **Meal time not yet reached today:** Status is "pending", not "missed". Only meals with past times and no log are "missed".
- **Multiple feeding logs for same schedule+date:** Use the first one logged. The "Fed" toggle should be disabled after the first tap for that day (prevent double-logging). Allow undo within 5 seconds.
- **Duplicate meal times for same pet:** Show non-blocking warning "You already have a meal at this time. Save anyway?" Do not prevent save.
- **Food transition with same food names:** Block save, show "Previous and new food must be different."
- **Multiple active transitions:** Only 1 active transition per pet. Starting a new transition auto-cancels (sets status = 'cancelled') the previous one.
- **Pet is deleted:** CASCADE deletes all feeding schedules, logs, dietary info, and transitions.
- **Module is disabled:** Routes removed, data preserved. Re-enabling restores everything.
- **Notification permissions denied:** Save meal without reminder. Show toast: "Meal saved, but reminder could not be set. Enable notifications in Settings."
- **Very long food name (200 chars):** Truncate display with ellipsis on the card. Full name visible in edit modal.
- **Timezone changes:** `fed_at` stores full ISO timestamp. `date` stores YYYY-MM-DD in local timezone at time of logging. No retroactive date adjustment.
- **Pet archived:** Feeding schedules remain but reminders should be cancelled. Unarchiving re-enables reminders.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can add a new meal to a pet's feeding schedule with time, food name, portion size+unit, and optional label/notes
- [ ] **AC-2:** Meal cards display in time-ascending order with food name, portion, and fed/unfed status for today
- [ ] **AC-3:** Tapping "Fed" on a meal card logs the meal with current timestamp and shows "Fed at HH:MM" with green checkmark
- [ ] **AC-4:** When all meals for today are logged, a "All meals complete for today!" banner appears
- [ ] **AC-5:** User can edit an existing meal's time, food, portion, label, notes, and reminder setting
- [ ] **AC-6:** User can delete a meal via swipe-left gesture (mobile) or delete button (web) with confirmation
- [ ] **AC-7:** User can set dietary info (allergies, restrictions, special instructions) per pet
- [ ] **AC-8:** When allergies are set, a warning banner shows at the top of the feeding screen
- [ ] **AC-9:** User can start a food transition with previous food, new food, start date, and duration
- [ ] **AC-10:** Active food transition shows a progress bar with current day, ratio percentages, and phase label
- [ ] **AC-11:** Local push notification fires at each scheduled meal time when reminder is enabled (mobile only)
- [ ] **AC-12:** Empty state shows food bowl illustration and "Add a Meal" CTA when no meals exist

### Technical Criteria
- [ ] **TC-1:** V3 migration adds `pt_feeding_logs`, `pt_dietary_info`, `pt_food_transitions` tables and extends `pt_feeding_schedules` with new columns
- [ ] **TC-2:** V3 migration is idempotent (safe to re-run) and has correct down migration
- [ ] **TC-3:** `getDailyFeedingStatus()` returns correct completion state (pending/fed/missed) for each schedule based on current time and logs
- [ ] **TC-4:** `calculateTransitionRatio()` returns correct old/new percentages for all 3 durations (7, 10, 14 days) at every phase boundary
- [ ] **TC-5:** Feeding log CRUD correctly creates, lists by date, and prevents duplicate logs for same schedule+date
- [ ] **TC-6:** Dietary info CRUD correctly upserts (one record per pet) and handles JSON array fields
- [ ] **TC-7:** Food transition auto-cancels previous active transition when a new one is started for the same pet
- [ ] **TC-8:** All new indexes are created and queries use them (no full table scans for common operations)
- [ ] **TC-9:** Portion unit supports 8 built-in options plus "custom" with user-provided label

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Adding a feeding schedule must NOT affect other pets' schedules (data isolation)
- [ ] **NC-2:** Deleting a pet must NOT leave orphaned feeding logs, dietary info, or transitions (CASCADE)
- [ ] **NC-3:** Food transition must NOT allow same food for previous and new
- [ ] **NC-4:** Logging a meal as "Fed" must NOT create duplicate logs for the same schedule on the same date
- [ ] **NC-5:** Disabling the Pets module must NOT delete any feeding data
- [ ] **NC-6:** Feeding schedule changes must NOT send network requests (offline-first, local-only)

## UI Specification

### Mobile (Expo)

- **Background:** `#0A0A0F` (background token)
- **Meal cards:** `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border, 12px border radius
- **Module accent:** `#F59E0B` (amber, from pets definition.ts)
- **Fed toggle:** Empty circle (unfed) -> filled circle with checkmark in `#30D158` (success green)
- **Missed indicator:** Red dot with `#FF453A` (danger red) and "Missed" label
- **Allergy banner:** `rgba(255,69,58,0.12)` background with `#FF453A` text and warning icon
- **Transition progress bar:** `#F59E0B` fill on `rgba(255,255,255,0.06)` track, rounded ends
- **Layout:** ScrollView with sections: dietary banner (conditional), transition bar (conditional), meal card list, "Add a Meal" button at bottom
- **Bottom sheet for Add/Edit Meal:** Glass morphism background via expo-blur BlurView

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Feeding schedule accessible via `/pets/[petId]/feeding` route
- Sidebar navigation: "Feeding" appears as a sub-nav item under the pet detail
- Meal cards use CSS `backdrop-filter: blur(12px)` for glass effect
- "Fed" toggle uses CSS transitions (200ms ease) for the checkmark animation
- Add/Edit Meal uses a modal dialog instead of bottom sheet

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | 3 skeleton meal cards with pulsing animation | Initial data fetch |
| Empty | Food bowl illustration, "No feeding schedule set up yet", "Add a Meal" button | No meals for this pet |
| Populated | List of meal cards with fed/unfed/missed status | Meals exist |
| All Fed | Normal content + "All meals complete for today!" banner with checkmark | All meals logged today |
| Transition Active | Transition progress bar section at top + normal meal list | Active food transition exists |
| Error | Toast: "Could not load feeding schedule." with retry action | Database read fails |

## Test Requirements

### Unit Tests (engine/feeding.ts)
- [ ] `getDailyFeedingStatus`: returns all_complete=true when all meals fed
- [ ] `getDailyFeedingStatus`: returns all_complete=false when 1 of 2 meals unfed
- [ ] `getDailyFeedingStatus`: returns "pending" for future meal time
- [ ] `getDailyFeedingStatus`: returns "missed" for past unfed meal
- [ ] `getDailyFeedingStatus`: returns all_complete=true when no schedules (vacuous truth)
- [ ] `getDailyFeedingStatus`: handles multiple logs for same schedule+date (uses first)
- [ ] `calculateTransitionRatio`: day 0 of 10 returns old=75%, new=25%
- [ ] `calculateTransitionRatio`: day 5 of 10 returns old=50%, new=50%
- [ ] `calculateTransitionRatio`: day 8 of 10 returns old=25%, new=75%
- [ ] `calculateTransitionRatio`: day 10 of 10 returns complete
- [ ] `calculateTransitionRatio`: day 0 of 7 returns old=75%, new=25%
- [ ] `calculateTransitionRatio`: day 6 of 7 returns complete
- [ ] `calculateTransitionRatio`: day 0 of 14 returns old=75%, new=25%
- [ ] `calculateTransitionRatio`: day 13 of 14 returns complete
- [ ] `calculateTransitionRatio`: negative elapsed days returns "not started"
- [ ] `calculateTransitionRatio`: returns correct progress_pct at each boundary

### Integration Tests (CRUD)
- [ ] Create feeding log and verify it appears in daily listing
- [ ] Create feeding log rejects duplicate for same schedule+date
- [ ] Upsert dietary info creates on first call, updates on second
- [ ] Dietary info allergies stored and retrieved as JSON array
- [ ] Create food transition auto-cancels previous active transition
- [ ] Food transition rejects same previous and new food
- [ ] Delete pet cascades to feeding logs, dietary info, and transitions
- [ ] V3 migration runs cleanly on fresh database
- [ ] V3 migration runs cleanly on existing V2 database with feeding schedule data

### QA Verification Script

1. Open the app on mobile (iOS simulator or device)
2. Navigate to MyPets module from hub dashboard
3. Tap an existing pet (or create one first: "Luna", dog, golden retriever)
4. Navigate to the feeding/reminders area
5. **Verify empty state:** See food bowl illustration and "Add a Meal" button -- AC-12
6. Tap "Add a Meal"
7. Fill in: time = 07:30, food = "Blue Buffalo Chicken", portion = 1.5, unit = cups, label = breakfast, reminder = on
8. Tap Save
9. **Verify:** Meal card appears with "07:30 AM", "Blue Buffalo Chicken", "1.5 cups" -- AC-1, AC-2
10. Add a second meal: time = 17:30, food = "Wellness Core", portion = 1, unit = cups, label = dinner
11. **Verify:** Both meals listed, breakfast first, dinner second -- AC-2
12. Tap "Fed" on the breakfast meal
13. **Verify:** Checkmark appears, "Fed at [current time]" shown -- AC-3
14. **Verify:** Banner does NOT show "All meals complete" (1 of 2 fed) -- AC-4 negative
15. Tap "Fed" on the dinner meal
16. **Verify:** "All meals complete for today!" banner appears -- AC-4
17. Tap the breakfast meal card to edit
18. Change food name to "Blue Buffalo Lamb" and save
19. **Verify:** Card updates with new food name -- AC-5
20. Swipe left on dinner meal, tap Delete, confirm
21. **Verify:** Only breakfast meal remains -- AC-6
22. Tap "Dietary Info" button
23. Add allergies: "chicken", "soy". Add restriction: "grain-free". Save
24. **Verify:** Warning banner shows "Allergic to: chicken, soy" -- AC-7, AC-8
25. Tap "Start Food Transition"
26. Fill in: previous = "Blue Buffalo Lamb", new = "Orijen Original", duration = 10 days, start = today
27. **Verify:** Transition bar appears showing "Day 1 of 10 - 75% Blue Buffalo Lamb / 25% Orijen Original" -- AC-9, AC-10
28. Lock phone for 1 minute past a scheduled meal time
29. **Verify:** Local notification fires with "[Luna] - Meal Time: Breakfast: Blue Buffalo Lamb - 1.5 cups" -- AC-11
30. Create a second pet "Max" with different feeding schedule
31. **Verify:** Max's feeding data is completely independent from Luna's -- NC-1

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for feeding engine (transition ratio calculator, daily completion check)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- pets module has no standalone counterpart (skip)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- `pt_feeding_schedules` table exists (V1) with basic columns: id, pet_id, label, food_name, amount, feed_at, notes, timestamps
- `createFeedingSchedule()` and `listFeedingSchedulesForPet()` CRUD exist in `crud.ts`
- `FeedingScheduleSchema` and `CreateFeedingScheduleInputSchema` Zod schemas exist in `types.ts`
- No feeding log tracking (cannot mark meals as "fed")
- No dietary info storage
- No food transition tracking
- No local notification integration for feeding reminders
- No mobile or web UI screens for feeding management

### After This Work
- V3 migration adds `pt_feeding_logs`, `pt_dietary_info`, `pt_food_transitions` tables
- V3 migration extends `pt_feeding_schedules` with `portion_size`, `portion_unit`, `portion_unit_custom`, `meal_label`, `reminder_enabled`, `sort_order`
- New Zod schemas for all new entities and enums
- Full CRUD for feeding logs, dietary info, food transitions
- Pure engine functions: `getDailyFeedingStatus()`, `calculateTransitionRatio()`
- Mobile screen at `apps/mobile/app/(pets)/feeding.tsx` with meal cards, fed toggle, dietary banner, transition bar
- Web page at `apps/web/app/pets/[petId]/feeding/page.tsx`
- Local push notifications via `expo-notifications` for meal reminders (mobile)
- 25+ new tests covering engine logic and CRUD operations

### Files Changed

- `modules/pets/src/db/schema.ts` -- V3 table DDL and indexes
- `modules/pets/src/definition.ts` -- Add PETS_MIGRATION_V3
- `modules/pets/src/types.ts` -- New schemas: FeedingLog, DietaryInfo, FoodTransition, PortionUnit, MealLabel, TransitionStatus enums
- `modules/pets/src/db/crud.ts` -- New CRUD: createFeedingLog, listFeedingLogsForDate, upsertDietaryInfo, getDietaryInfo, createFoodTransition, getActiveTransition, cancelActiveTransition, updateFeedingSchedule, deleteFeedingSchedule
- `modules/pets/src/engine/feeding.ts` -- New pure functions: getDailyFeedingStatus, calculateTransitionRatio
- `modules/pets/src/index.ts` -- Re-export all new public API
- `modules/pets/src/__tests__/feeding.test.ts` -- Unit + integration tests
- `apps/mobile/app/(pets)/feeding.tsx` -- Per-pet feeding schedule screen
- `apps/mobile/app/(pets)/components/MealCard.tsx` -- Meal card component with "Fed" toggle
- `apps/mobile/app/(pets)/components/FoodTransitionBar.tsx` -- Transition progress bar
- `apps/web/app/pets/[petId]/feeding/page.tsx` -- Web feeding schedule page

### Known Limitations
- Food transition auto-completion (marking as "completed" when duration elapses) requires the user to open the feeding screen. No background task auto-completes transitions.
- Reminder notifications are mobile-only (expo-notifications). Web has no push notification support in this version.
- No cross-pet daily feeding dashboard view in this feature (that belongs to the Multi-Pet Dashboard feature, PT-015).
- No feeding analytics or historical charts (future feature: "feeding consistency score").
- Portion tracking is string-based for `amount` field (existing V1 column) but structured for new `portion_size` + `portion_unit` columns. Migration does not retroactively parse existing `amount` strings.

### Context for Next Agent
- The existing `pt_feeding_schedules` table (V1) uses `feed_at` as a TEXT column storing "HH:MM" format. The V3 migration adds columns via ALTER TABLE, so existing rows will have NULL for new columns. Handle NULL `portion_size`/`portion_unit` gracefully in the UI (fall back to displaying the legacy `amount` string).
- The existing `listFeedingSchedulesForPet()` in `crud.ts` already sorts by `feed_at ASC`. New feeding log queries should join against this or query separately and merge in the UI layer.
- Notification scheduling uses `expo-notifications` `scheduleNotificationAsync` with a daily trigger. When a schedule is deleted or reminder toggled off, cancel the notification using the schedule ID as the notification identifier.
- The `pt_dietary_info.allergies` and `pt_dietary_info.restrictions` columns store JSON arrays as TEXT. Parse with `JSON.parse()` on read, `JSON.stringify()` on write. Validate that each item is a non-empty string, max 100 chars, max 20 items.
- For the food transition ratio calculator, the spec defines exact phase boundaries for 7, 10, and 14 day durations. Implement as a lookup table, not a continuous formula, to match the SPEC-mypets.md specification exactly.
