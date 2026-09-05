# Habitify Gap Tasks -- MyHabits Module

**Created:** 2026-03-29
**Source:** `docs/competitor-analysis/habitify-vs-myhabits.md`
**Module:** `modules/habits/` + `apps/mobile/app/(habits)/`

---

## Rules (apply to every task)

- Add new screens to the hamburger menu in `apps/mobile/app/(habits)/index.tsx` (lines 130-154)
- Use `ACCENT = colors.modules.habits` and Cool Obsidian tokens from `@mylife/ui`
- Run `pnpm typecheck` after editing each file
- Read `modules/habits/src/index.ts` before writing any module code
- All new engine functions must be pure (no DB calls, no side effects)
- All new DB functions go in `modules/habits/src/db/`
- Export new public API items from `modules/habits/src/index.ts`
- New screens go in `apps/mobile/app/(habits)/`

---

## HAB-01: Date Navigation Bar

**Depends on:** None
**Priority:** High
**Complexity:** Medium

**Files to create/edit:**
- `apps/mobile/app/(habits)/index.tsx` (edit)

**Reference logic:**
- `getCompletionsForDate(db, dateString)` from `modules/habits/src/db/crud.ts`
- `getMeasurementsForDate(db, dateString)` from `modules/habits/src/db/measurements.ts`
- `getSessionsForDate(db, dateString)` from `modules/habits/src/db/timed-sessions.ts`
- `isDueToday()` local function in `index.tsx` (must generalize to `isDueOnDate()`)

**Prompt:**

Add a horizontal scrollable date navigation bar to the MyHabits Today screen.

Requirements:
1. Render a horizontal `FlatList` between the top row and metrics grid showing 7 days centered on today.
2. Each date cell shows abbreviated day name (Mon, Tue...) and date number. Current selection is highlighted with `ACCENT` background and white text.
3. Tapping a date changes the `selectedDate` state. The entire screen (habits list, completions, measurements, sessions, metrics) must re-query for the selected date instead of hardcoded `today`.
4. Refactor `isDueToday()` to `isDueOnDate(habit, date)` accepting a `Date` parameter. Use the `DAY_MAP` already defined.
5. Left/right arrow buttons at the edges of the bar allow week-by-week navigation.
6. Today button: if viewing a past date, show a "Today" pill that jumps back.
7. Style: cells are 48x56px, border-radius 12, gap 6. Selected cell uses `ACCENT`. Unselected uses `colors.surfaceElevated` background, `colors.textSecondary` text.

Acceptance criteria:
- User can tap any date in the bar and see that day's habits, completions, and metrics
- Navigating to a past date shows correct habit list (respecting frequency/specific_days for that date)
- "Today" pill appears when not viewing today, returns to today on tap
- Typecheck passes

---

## HAB-02: Floating Action Button (FAB)

**Depends on:** None
**Priority:** High
**Complexity:** Small

**Files to create/edit:**
- `apps/mobile/app/(habits)/index.tsx` (edit)

**Reference logic:**
- Router: `router.push('/(habits)/add-habit')` (already used in other screens)

**Prompt:**

Add a floating action button to the MyHabits Today screen that navigates to the Add Habit screen.

Requirements:
1. Position a circular FAB at bottom-right of the screen (position: absolute, bottom: 24, right: 24).
2. FAB is 56x56px circle with `ACCENT` background color and a white "+" text (fontSize 28, fontWeight 700).
3. On press, navigate to `/(habits)/add-habit`.
4. FAB has elevation shadow: `shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8`.
5. The ScrollView's `contentContainerStyle` needs `paddingBottom` increased to at least 80 so the FAB does not overlap the last habit card.

Acceptance criteria:
- FAB is always visible at bottom-right regardless of scroll position
- Tapping FAB opens Add Habit screen
- FAB does not overlap habit cards
- Typecheck passes

---

## HAB-03: Area Grouping (Schema + Engine + UI)

**Depends on:** None
**Priority:** High
**Complexity:** Large

**Files to create/edit:**
- `modules/habits/src/types.ts` (edit: add AreaSchema)
- `modules/habits/src/db/schema.ts` (edit: V6 migration adding `hb_areas` table and `area_id` column to `hb_habits`)
- `modules/habits/src/db/areas.ts` (create: CRUD for areas)
- `modules/habits/src/db/index.ts` (edit: re-export area functions)
- `modules/habits/src/db/crud.ts` (edit: support area filtering in `getHabits`)
- `modules/habits/src/definition.ts` (edit: bump to V6, add migration)
- `modules/habits/src/index.ts` (edit: export new area types and functions)
- `apps/mobile/app/(habits)/index.tsx` (edit: add area filter pills)
- `apps/mobile/app/(habits)/add-habit.tsx` (edit: add area picker)

**Reference logic:**
- `getHabits(db, filter)` from `modules/habits/src/db/crud.ts`
- `createHabit(db, id, input)` from `modules/habits/src/db/crud.ts`
- `HabitSchema` from `modules/habits/src/types.ts`

**Prompt:**

Add area/category grouping to MyHabits so users can organize habits by life area (Health, Work, Personal, Fitness, etc.).

Requirements:

Schema:
1. Add `AreaSchema = z.object({ id: z.string(), name: z.string(), icon: z.string().nullable(), color: z.string().nullable(), sortOrder: z.number().int(), createdAt: z.string() })` to `types.ts`.
2. Create V6 migration in `schema.ts`:
   - `CREATE TABLE IF NOT EXISTS hb_areas (id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT, color TEXT, sort_order INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')))`
   - `ALTER TABLE hb_habits ADD COLUMN area_id TEXT REFERENCES hb_areas(id)`
3. Add `areaId: z.string().nullable()` to `HabitSchema`.
4. Provide 6 default areas seeded in migration: Health, Work, Personal, Fitness, Learning, Mindfulness.

CRUD (`db/areas.ts`):
5. `createArea(db, id, input)`, `getAreas(db)`, `updateArea(db, id, input)`, `deleteArea(db, id)`, `reorderAreas(db, orderedIds)`.

UI (Today screen):
6. Add a horizontal `ScrollView` of area filter pills below the date bar (or below the header if HAB-01 not yet done). Pills: "All Habits" (default), then one per area, then "+ New Area".
7. When an area is selected, filter `dueHabits` to only those with matching `areaId`. "All Habits" shows everything.
8. "+ New Area" opens an inline modal for name + icon + color entry.

UI (Add Habit screen):
9. Add an "Area" card section with a picker listing all areas + "None".

Acceptance criteria:
- User can create, rename, reorder, and delete areas
- Habits can be assigned to an area during creation or editing
- Today screen filters by area when a pill is tapped
- "All Habits" pill shows all habits regardless of area
- Migration runs cleanly on existing databases (area_id is nullable)
- Typecheck passes
- Export all new types and functions from index.ts

---

## HAB-04: Onboarding Flow

**Depends on:** HAB-03 (uses area grouping for starter habits)
**Priority:** High
**Complexity:** Medium

**Files to create/edit:**
- `apps/mobile/app/(habits)/onboarding.tsx` (create)
- `apps/mobile/app/(habits)/_layout.tsx` (edit: conditional routing)
- `modules/habits/src/db/crud.ts` (reference only: `countHabits`)

**Reference logic:**
- `countHabits(db)` from `modules/habits/src/db/crud.ts`
- `getSetting(db, key)` / `setSetting(db, key, value)` from `modules/habits/src/db/crud.ts`
- `createHabit(db, id, input)` from `modules/habits/src/db/crud.ts`

**Prompt:**

Create a 4-step onboarding flow for first-time MyHabits users.

Requirements:

Step 1 -- Welcome:
1. Full-screen card with large habit icon, "Build Better Habits" headline, "Small actions, big results" subtext.
2. "Get Started" button at bottom.

Step 2 -- Pick Starter Habits:
3. Grid of 6 two-minute starter habits: Drink Water (icon: water drop), Stretch (yoga), Take Vitamins (pill), 1-Min Plank (muscle), 10-Min Walk (walking), 10 Squats (leg).
4. User taps to toggle selection (multi-select). Selected items get `ACCENT` border.
5. "Skip" link and "Continue" button.

Step 3 -- Pick Time of Day:
6. 4 large cards: Morning, Afternoon, Evening, Anytime. Single-select. Determines `timeOfDay` for all selected habits.

Step 4 -- Celebration:
7. "You're all set!" with animated checkmark (use Animated API, no external dependency).
8. Show "Day 1" and a row of 7 dots representing the week (first dot filled with `ACCENT`).
9. "Start Tracking" button that creates all selected habits via `createHabit`, sets `setSetting(db, 'onboarding_complete', 'true')`, and navigates to the Today screen.

Routing:
10. In `_layout.tsx`, check `getSetting(db, 'onboarding_complete')`. If not 'true' and `countHabits(db) === 0`, redirect to onboarding screen.

Acceptance criteria:
- First-time users see onboarding before Today screen
- Selected starter habits are created with correct type, frequency (daily), and timeOfDay
- Onboarding does not appear again after completion
- User can skip onboarding entirely (still sets the flag)
- Progress bar shows 4 steps with current step highlighted
- Add 'Onboarding' entry to hamburger menu (for re-triggering in dev/testing)
- Typecheck passes

---

## HAB-05: Undo Last Action Modal

**Depends on:** None
**Priority:** Medium
**Complexity:** Small

**Files to create/edit:**
- `apps/mobile/app/(habits)/index.tsx` (edit)

**Reference logic:**
- `deleteCompletion(db, id)` from `modules/habits/src/db/crud.ts`
- `deleteMeasurement(db, id)` from `modules/habits/src/db/measurements.ts`
- `deleteSession(db, id)` from `modules/habits/src/db/timed-sessions.ts`

**Prompt:**

Add an undo snackbar/toast to the MyHabits Today screen that appears after any completion action.

Requirements:
1. After `recordCompletion`, `recordMeasurement`, or `endSession` (when completing a timed habit), show a bottom-anchored toast: "Habit completed -- Undo".
2. Toast is 48px tall, full-width minus 32px horizontal margin, positioned 80px from bottom (above FAB if HAB-02 done).
3. Background: `colors.surfaceElevated`, border: `colors.glassBorder`. "Undo" text uses `ACCENT` color.
4. Toast auto-dismisses after 5 seconds (use `setTimeout`).
5. Tapping "Undo" calls the appropriate delete function (`deleteCompletion`, `deleteMeasurement`) for the last recorded action, then dismisses the toast and refreshes.
6. Store the last action in a `useRef<{ type: 'completion' | 'measurement' | 'session'; id: string } | null>`.

Acceptance criteria:
- Completing any habit type shows the undo toast
- Tapping Undo reverses the completion
- Toast auto-dismisses after 5 seconds
- Only one toast visible at a time (new action replaces previous)
- Typecheck passes

---

## HAB-06: Strikethrough on Completed Habits

**Depends on:** None
**Priority:** Low
**Complexity:** Trivial

**Files to create/edit:**
- `apps/mobile/app/(habits)/index.tsx` (edit)

**Reference logic:**
- `done` boolean in `HabitRow` component (already computed at line 254)

**Prompt:**

Add visual strikethrough styling to completed habit names on the Today screen.

Requirements:
1. In the `HabitRow` component, when `done` is true, apply `textDecorationLine: 'line-through'` to the habit name `Text` component (line 377).
2. Also reduce opacity of the entire card to 0.7 when done.
3. Keep the existing dimmed text color behavior (`colors.textSecondary` when done).

Acceptance criteria:
- Completed habit names have a visible strikethrough line
- Completed cards are slightly faded
- Uncompleted habits remain at full opacity with no strikethrough
- Typecheck passes

---

## HAB-07: Multiple Time-Based Reminders

**Depends on:** None
**Priority:** Medium
**Complexity:** Medium

**Files to create/edit:**
- `modules/habits/src/types.ts` (edit: add ReminderSchema)
- `modules/habits/src/db/schema.ts` (edit: V6 or V7 migration for `hb_reminders` table)
- `modules/habits/src/db/reminders.ts` (create: CRUD)
- `modules/habits/src/db/index.ts` (edit: re-export)
- `modules/habits/src/definition.ts` (edit: bump version, add migration)
- `modules/habits/src/index.ts` (edit: export new types/functions)
- `apps/mobile/app/(habits)/add-habit.tsx` (edit: reminder picker section)
- `apps/mobile/app/(habits)/[id].tsx` (edit: show/edit reminders on detail)

**Reference logic:**
- Current `reminderTime` field on `HabitSchema` (single string) -- will be deprecated in favor of the new table
- `createHabit(db, id, input)` from `modules/habits/src/db/crud.ts`

**Prompt:**

Replace the single `reminderTime` field with a multi-reminder system.

Requirements:

Schema:
1. Add `ReminderSchema = z.object({ id: z.string(), habitId: z.string(), time: z.string(), label: z.string().nullable(), isActive: z.boolean(), createdAt: z.string() })` to `types.ts`.
2. Migration: `CREATE TABLE IF NOT EXISTS hb_reminders (id TEXT PRIMARY KEY, habit_id TEXT NOT NULL REFERENCES hb_habits(id), time TEXT NOT NULL, label TEXT, is_active INTEGER DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')))`.
3. Data migration: for any existing habit with `reminder_time` not null, insert a row into `hb_reminders`.

CRUD (`db/reminders.ts`):
4. `createReminder(db, id, habitId, time, label?)`, `getRemindersForHabit(db, habitId)`, `updateReminder(db, id, input)`, `deleteReminder(db, id)`, `toggleReminder(db, id, isActive)`.

UI (Add Habit):
5. Add a "Reminders" card section. Shows list of added times. "+ Add Reminder" button opens a time picker (use a TextInput with HH:MM format for now; native time picker is a future enhancement).
6. Each reminder row shows time, optional label, and a delete button.

Acceptance criteria:
- User can add multiple reminders per habit
- Existing single-reminder data is migrated
- Reminders display on both add-habit and habit detail screens
- Export all new types and functions from index.ts
- Typecheck passes

---

## HAB-08: Starter Habit Templates

**Depends on:** HAB-03 (area grouping for categorization)
**Priority:** Medium
**Complexity:** Small

**Files to create/edit:**
- `modules/habits/src/templates.ts` (create)
- `modules/habits/src/index.ts` (edit: export)
- `apps/mobile/app/(habits)/add-habit.tsx` (edit: template picker)

**Reference logic:**
- `CreateHabitInput` type from `modules/habits/src/db/crud.ts`

**Prompt:**

Add a preset habit template library to reduce blank-slate friction.

Requirements:

Engine (`templates.ts`):
1. Export `HABIT_TEMPLATES: HabitTemplate[]` with at least 20 templates across 6 areas:
   - Health: Drink 8 Glasses Water, Take Vitamins, Floss, Skincare Routine
   - Fitness: Morning Stretch, 10K Steps, Plank 1 Min, 30 Min Workout
   - Mindfulness: Meditate 10 Min, Journal, Gratitude List, Deep Breathing
   - Learning: Read 30 Min, Practice Language, Online Course, Write 500 Words
   - Productivity: Plan Tomorrow, Review Goals, Inbox Zero, No Phone Before 9AM
   - Personal: Call Family, Budget Review, Cook Dinner, Declutter 10 Min
2. Each template has: `name`, `icon`, `color`, `habitType`, `frequency`, `timeOfDay`, `targetCount`, `unit`, `areaName`.
3. Export `getTemplatesByArea(areaName)` and `getAllTemplates()`.

UI (Add Habit):
4. Before the Name input card, add a "Start from Template" expandable section.
5. Shows template cards in a 2-column grid. Tapping one pre-fills the form (name, icon, color, type, frequency, timeOfDay, target).
6. User can still edit any pre-filled field before saving.

Acceptance criteria:
- At least 20 templates across 6 categories
- Tapping a template pre-fills the add-habit form
- User can modify pre-filled values
- Templates are pure data (no DB dependency)
- Typecheck passes

---

## HAB-09: Celebration Animations

**Depends on:** None
**Priority:** Medium
**Complexity:** Small

**Files to create/edit:**
- `apps/mobile/app/(habits)/index.tsx` (edit)

**Reference logic:**
- `recordCompletion()` call in `handleStandard()` at line 260
- `getStreaks(db, habitId)` from `modules/habits/src/db/crud.ts`

**Prompt:**

Add celebration animations when completing habits and hitting streak milestones.

Requirements:
1. When a habit is completed (any type), flash a brief scale-up animation on the action button (scale 1 -> 1.3 -> 1 over 300ms) using `Animated.spring`.
2. When a streak milestone is hit (3, 7, 14, 30, 90, 365 days), show a full-screen overlay:
   - Semi-transparent dark background
   - Large streak number with fire emoji
   - "X day streak!" text in `ACCENT` color
   - 20-30 small colored circles animating from center outward (simulated confetti using `Animated.timing` with random positions)
   - Auto-dismiss after 2.5 seconds or tap to dismiss
3. Check streak after each completion by calling `getStreaks(db, habitId)` and comparing `currentStreak` against the milestone thresholds from `STREAK_MILESTONES` (exported from `modules/habits/src/milestones/engine.ts`).

Acceptance criteria:
- Action button animates on every completion
- Streak milestone overlay appears at 3, 7, 14, 30, 90, 365 days
- Overlay auto-dismisses and does not block interaction
- No external animation libraries (use React Native Animated API only)
- Typecheck passes

---

## HAB-10: Magic Fill AI (Natural Language Habit Parser)

**Depends on:** HAB-03 (area grouping), HAB-07 (multiple reminders)
**Priority:** Medium
**Complexity:** Large

**Files to create/edit:**
- `modules/habits/src/magic-fill/parser.ts` (create)
- `modules/habits/src/magic-fill/__tests__/parser.test.ts` (create)
- `modules/habits/src/index.ts` (edit: export)
- `apps/mobile/app/(habits)/add-habit.tsx` (edit: Magic Fill input)

**Reference logic:**
- `HabitType`, `Frequency`, `TimeOfDay`, `DayOfWeek` from `modules/habits/src/types.ts`
- `CreateHabitInput` from `modules/habits/src/db/crud.ts`

**Prompt:**

Build a local (no-network) natural language parser that converts free-text habit descriptions into structured habit data.

Requirements:

Engine (`magic-fill/parser.ts`):
1. Export `parseMagicFill(input: string): MagicFillResult`.
2. `MagicFillResult = { name: string; habitType: HabitType; frequency: Frequency; specificDays: DayOfWeek[] | null; timeOfDay: TimeOfDay; targetCount: number; unit: string | null; confidence: number }`.
3. Parser must extract:
   - **Frequency patterns:** "daily", "every day", "3x/week", "4 times a week", "Mon/Wed/Fri", "weekdays", "weekends", "every other day"
   - **Duration patterns:** "15 min", "30 minutes", "1 hour", "45min" -> timed habit with targetCount in seconds
   - **Count patterns:** "8 glasses", "10000 steps", "3 sets", "5 pages" -> measurable habit with unit
   - **Time of day:** "morning", "before bed", "after lunch", "at 7am", "evening"
   - **Name extraction:** remaining text after stripping frequency/duration/time tokens
4. Pure regex/heuristic approach. No AI model dependency. No network calls.
5. Confidence score: 0-1 based on how many fields were successfully extracted.

Tests (`__tests__/parser.test.ts`):
6. At least 15 test cases covering:
   - "Read 30 minutes every day" -> timed, daily, 1800s
   - "Drink 8 glasses of water" -> measurable, daily, 8, "glasses"
   - "Meditate 15min Mon Wed Fri morning" -> timed, specific_days, [mon,wed,fri], morning, 900s
   - "Learning guitar 15min 4x/week" -> timed, weekly, 900s
   - "Walk 10000 steps daily" -> measurable, daily, 10000, "steps"
   - "No sugar" -> negative, daily
   - Edge cases: empty string, gibberish

UI (Add Habit):
7. At the top of add-habit screen, add a "Magic Fill" card with a TextInput and a wand icon.
8. As user types, debounce (300ms) and run `parseMagicFill`. Show parsed result preview below the input.
9. "Apply" button fills the form fields from the parse result.
10. User can still modify any field after applying.

Acceptance criteria:
- All 15+ test cases pass
- Parser handles duration, count, frequency, time-of-day, and name extraction
- No network dependency -- fully offline
- UI shows live preview as user types
- Apply fills the form correctly
- Typecheck passes

---

## HAB-11: CSV Import

**Depends on:** None
**Priority:** Medium
**Complexity:** Medium

**Files to create/edit:**
- `modules/habits/src/import.ts` (create)
- `modules/habits/src/import/__tests__/csv-import.test.ts` (create)
- `modules/habits/src/index.ts` (edit: export)
- `apps/mobile/app/(habits)/settings.tsx` (edit: import button)

**Reference logic:**
- `exportAllCSV(db)` from `modules/habits/src/export.ts` (defines the CSV format to match)
- `createHabit(db, id, input)` from `modules/habits/src/db/crud.ts`
- `recordCompletion(db, id, habitId, date, value, notes?)` from `modules/habits/src/db/crud.ts`

**Prompt:**

Add CSV import capability that can re-import data exported by `exportAllCSV`.

Requirements:

Engine (`import.ts`):
1. Export `parseHabitsCSV(csv: string): ParsedHabit[]` and `parseCompletionsCSV(csv: string): ParsedCompletion[]`.
2. Export `importHabits(db, parsedHabits)` and `importCompletions(db, parsedCompletions)`.
3. The import format must match the export format from `export.ts`. Parse the CSV header to determine column mapping.
4. Handle duplicate IDs gracefully: skip if habit with same ID already exists.
5. Return an `ImportResult = { imported: number; skipped: number; errors: string[] }`.

Tests:
6. Test round-trip: export -> import -> verify data matches.
7. Test duplicate handling, malformed CSV, empty CSV.

UI (Settings):
8. Add an "Import Data" card below the Export card in `settings.tsx`.
9. Button opens document picker (use `expo-document-picker` if available, otherwise a TextInput for pasting CSV content).
10. Show import result summary: "Imported X habits, Y completions. Skipped Z duplicates."

Acceptance criteria:
- Round-trip export/import preserves all data
- Duplicates are skipped, not overwritten
- Error messages are user-friendly
- Import result is displayed to user
- Typecheck passes

---

## HAB-12: Habit Start/End Dates

**Depends on:** HAB-01 (date navigation, for testing visibility)
**Priority:** Low
**Complexity:** Small

**Files to create/edit:**
- `modules/habits/src/types.ts` (edit: add startDate/endDate to HabitSchema)
- `modules/habits/src/db/schema.ts` (edit: migration adding columns)
- `modules/habits/src/db/crud.ts` (edit: filter by active date range)
- `modules/habits/src/definition.ts` (edit: bump version)
- `modules/habits/src/index.ts` (edit: ensure re-export)
- `apps/mobile/app/(habits)/add-habit.tsx` (edit: date pickers)
- `apps/mobile/app/(habits)/index.tsx` (edit: filter by date range)

**Reference logic:**
- `isDueOnDate(habit, date)` (from HAB-01 or current `isDueToday`)
- `getHabits(db, filter)` from `modules/habits/src/db/crud.ts`

**Prompt:**

Add optional start date and end date fields to habits for scheduling temporary habits and challenges.

Requirements:

Schema:
1. Add `startDate: z.string().nullable()` and `endDate: z.string().nullable()` to `HabitSchema`.
2. Migration: `ALTER TABLE hb_habits ADD COLUMN start_date TEXT` and `ALTER TABLE hb_habits ADD COLUMN end_date TEXT`.

Logic:
3. In `isDueOnDate` (or `isDueToday`), skip habits where `startDate` is in the future or `endDate` is in the past relative to the selected date.
4. In `getHabits`, add optional `activeOnDate` filter parameter.

UI:
5. In add-habit screen, add "Schedule" card with optional start date and end date inputs (TextInput with YYYY-MM-DD format).
6. "Never" is the default end date (null).
7. On habit detail screen, show start/end date if set.

Acceptance criteria:
- Habits with future start dates do not appear on Today screen until that date
- Habits with past end dates do not appear on Today screen after that date
- Habits with no dates behave as before (always active)
- Typecheck passes

---

## Kickoff Prompt

To begin implementation, run these tasks in dependency order:

**Wave 1 (no dependencies, parallelizable):**
- HAB-01: Date Navigation Bar
- HAB-02: FAB Button
- HAB-05: Undo Modal
- HAB-06: Strikethrough Styling
- HAB-09: Celebration Animations
- HAB-11: CSV Import

**Wave 2 (depends on HAB-03):**
- HAB-03: Area Grouping (must complete first)
- HAB-04: Onboarding Flow (depends on HAB-03)
- HAB-08: Starter Templates (depends on HAB-03)

**Wave 3 (depends on HAB-03 + HAB-07):**
- HAB-07: Multiple Reminders
- HAB-10: Magic Fill AI (depends on HAB-03 + HAB-07)
- HAB-12: Habit Start/End Dates (depends on HAB-01)

Start with: `HAB-02` (smallest, highest impact) then `HAB-06` (trivial) then `HAB-01` (high value).

For each task, the executing agent should:
1. Read `modules/habits/src/index.ts` to confirm current exports
2. Read any referenced source files listed in "Reference logic"
3. Implement the changes described in the prompt
4. Run `pnpm typecheck` after each file edit
5. Run `pnpm gate:function:changed` after all edits complete
6. Add new screen entries to the hamburger menu in `index.tsx` if a new screen was created
