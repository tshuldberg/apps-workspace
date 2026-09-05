# Habitify Gap Tasks -- Wave 3 Handoff

## Overall Status

**Wave 1: COMPLETE (6/6)** -- HAB-01, HAB-02, HAB-05, HAB-06, HAB-09, HAB-11
**Wave 2: COMPLETE (3/3)** -- HAB-03, HAB-04, HAB-08
**Wave 3: NOT STARTED (0/3)** -- HAB-07, HAB-10, HAB-12

## Verification State

- 0 typecheck errors across `@mylife/habits` and `@mylife/mobile`
- 299/299 habits module tests pass
- Schema is at **V6** (28 tables, includes hb_areas + area_id column from HAB-03)
- All changes are uncommitted

## Wave 3 Tasks

### HAB-07: Multiple Time-Based Reminders (Medium)

Full spec: `docs/plans/active/habitify-tasks.md` lines 264-307.

**What to do:**
1. `types.ts` -- Add `ReminderSchema` (id, habitId, time, label, isActive, createdAt)
2. `db/schema.ts` -- Add V7 migration: `CREATE TABLE hb_reminders (...)`, data migration for existing `reminder_time` values
3. `db/reminders.ts` -- NEW: createReminder, getRemindersForHabit, updateReminder, deleteReminder, toggleReminder
4. `db/index.ts` -- Re-export reminder functions
5. `definition.ts` -- Add HABITS_MIGRATION_V7, bump schemaVersion to 7
6. `index.ts` -- Export ReminderSchema, Reminder type, reminder CRUD
7. `add-habit.tsx` -- Add "Reminders" card section with "+ Add Reminder" (TextInput HH:MM format), delete per row
8. `[id].tsx` -- Show/edit reminders on habit detail screen

**Key context:**
- Schema currently at V6. V7 adds hb_reminders table.
- `HabitSchema` has `reminderTime: z.string().nullable()` at line 44 of types.ts -- this stays for backward compat, new table is the source of truth.
- Data migration: `INSERT INTO hb_reminders ... SELECT ... FROM hb_habits WHERE reminder_time IS NOT NULL`
- `db/index.ts` ends at line 195 with areas exports. Append V7 CRUD re-exports after.
- `definition.ts` imports schema items at top. Add V7 imports.
- `habits.test.ts` line 52 has `schemaVersion` assertion -- update to 7.
- `add-habit.tsx` currently has: Template card, Name, Icon, Color, Habit Type, Frequency, Time of Day, Target, Area, Grace Period, Save button. Add Reminders card between Area and Grace Period.

### HAB-10: Magic Fill AI (Large) -- depends on HAB-07

Full spec: `docs/plans/active/habitify-tasks.md` lines 392-448.

**What to do:**
1. `magic-fill/parser.ts` -- NEW: `parseMagicFill(input)` returns MagicFillResult. Pure regex/heuristic. Extracts frequency, duration, count, time-of-day, name.
2. `magic-fill/__tests__/parser.test.ts` -- NEW: 15+ test cases
3. `index.ts` -- Export parseMagicFill, MagicFillResult
4. `add-habit.tsx` -- Add "Magic Fill" card at top with TextInput, debounced preview, Apply button

**Key patterns to extract:**
- Frequency: "daily", "every day", "3x/week", "Mon/Wed/Fri", "weekdays", "weekends"
- Duration: "15 min", "30 minutes", "1 hour" -> timed, targetCount in seconds
- Count: "8 glasses", "10000 steps" -> measurable with unit
- Time: "morning", "evening", "before bed", "at 7am"
- Negation: "No sugar", "Don't smoke" -> negative type

### HAB-12: Habit Start/End Dates (Small) -- depends on HAB-01 (done)

Full spec: `docs/plans/active/habitify-tasks.md` lines 500-542.

**What to do:**
1. `types.ts` -- Add `startDate: z.string().nullable()` and `endDate: z.string().nullable()` to HabitSchema
2. `db/schema.ts` -- V7 or V8 migration (bundle with HAB-07 V7 if doing together, else separate V8): `ALTER TABLE hb_habits ADD COLUMN start_date TEXT`, `ALTER TABLE hb_habits ADD COLUMN end_date TEXT`
3. `db/crud.ts` -- Add `startDate`/`endDate` to rowToHabit, CreateHabitInput, UpdateHabitInput, updateHabit. Add `activeOnDate` filter to getHabits.
4. `definition.ts` -- Bump version if separate migration
5. `index.tsx` -- Update `isDueOnDate()` to skip habits where startDate > date or endDate < date
6. `add-habit.tsx` -- Add "Schedule" card with start/end TextInputs (YYYY-MM-DD format)

**Implementation strategy:**
- Bundle HAB-12 schema changes into HAB-07's V7 migration to avoid a V8.
- HAB-07 first, then HAB-12 (they share the migration), then HAB-10 last (largest).

## Current File State Summary

| File | Current state |
|------|--------------|
| `modules/habits/src/types.ts` | Has AreaSchema (lines 19-27), HabitSchema with areaId (line 45). Add ReminderSchema after AreaSchema. Add startDate/endDate to HabitSchema. |
| `modules/habits/src/db/schema.ts` | V1-V6 defined. V6 ends at line 484. Add V7 after. |
| `modules/habits/src/db/index.ts` | Ends at line 195 with areas re-exports. Add V7 re-exports after. |
| `modules/habits/src/definition.ts` | V6 migration at line 110. HABITS_MODULE at line 125. schemaVersion: 6, migrations array at line 133. |
| `modules/habits/src/index.ts` | Ends at line 488. Areas exports at bottom. |
| `apps/mobile/app/(habits)/add-habit.tsx` | Has template picker, area picker, 24 templates. Save at line 80. |
| `apps/mobile/app/(habits)/[id].tsx` | Habit detail with heatmap + streaks. Add reminders display. |
| `apps/mobile/app/(habits)/index.tsx` | Has date bar, FAB, undo, celebrations, area pills. isDueOnDate at line ~40. |

## Rules

- Run `pnpm typecheck` after editing each file
- All new engine functions must be pure (no DB calls, no side effects)
- All new DB functions go in `modules/habits/src/db/`
- Export new public API items from `modules/habits/src/index.ts`
- Update `habits.test.ts` schemaVersion assertion when bumping
- Add new screens to hamburger menu if created
