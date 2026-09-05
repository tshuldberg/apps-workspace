# Habitify Gap Tasks -- Handoff Prompt

**Use this prompt to resume the Habitify gap task implementation.**

---

## Status

**Wave 1: COMPLETE (6/6)**
- HAB-01 Date Navigation Bar -- DONE
- HAB-02 FAB Button -- DONE
- HAB-05 Undo Toast -- DONE
- HAB-06 Strikethrough Styling -- DONE
- HAB-09 Celebration Animations -- DONE
- HAB-11 CSV Import -- DONE

**Wave 2: IN PROGRESS (0/3)**
- HAB-03 Area Grouping -- reference files read, no code written yet
- HAB-04 Onboarding Flow -- blocked on HAB-03
- HAB-08 Starter Templates -- blocked on HAB-03

**Wave 3: NOT STARTED (0/3)**
- HAB-07 Multiple Reminders
- HAB-10 Magic Fill AI
- HAB-12 Habit Start/End Dates

## Verification State

- 0 typecheck errors across `@mylife/habits` and `@mylife/mobile`
- 299/299 habits module tests pass (289 existing + 10 new import tests)
- 4/4 mobile habits index tests pass (2 jsdom Animated cleanup warnings -- pre-existing env issue, not real failures)

## Files Changed (uncommitted)

| File | What changed |
|------|-------------|
| `apps/mobile/app/(habits)/index.tsx` | HAB-01 date bar, HAB-02 FAB, HAB-05 undo, HAB-06 strikethrough, HAB-09 celebrations |
| `apps/mobile/app/(habits)/settings.tsx` | HAB-11 import CSV button + handler |
| `modules/habits/src/import.ts` | NEW -- CSV import engine (parseHabitsCSV, parseCompletionsCSV, importHabits, importCompletions, importAllCSV) |
| `modules/habits/src/__tests__/import.test.ts` | NEW -- 10 import tests |
| `modules/habits/src/index.ts` | Added import.ts re-exports |

## What to Do Next: HAB-03 Area Grouping

Read the full task spec at `docs/plans/active/habitify-tasks.md` lines 89-144.

### Implementation checklist for HAB-03:

1. **types.ts** -- Add `AreaSchema` (id, name, icon, color, sortOrder, createdAt) and `areaId: z.string().nullable()` to `HabitSchema`
2. **db/schema.ts** -- Add V6 migration: `CREATE TABLE hb_areas (...)`, `ALTER TABLE hb_habits ADD COLUMN area_id TEXT REFERENCES hb_areas(id)`, seed 6 default areas (Health, Work, Personal, Fitness, Learning, Mindfulness)
3. **db/areas.ts** -- NEW file: createArea, getAreas, updateArea, deleteArea, reorderAreas
4. **db/index.ts** -- Re-export area functions
5. **db/crud.ts** -- Add optional `areaId` filter to `getHabits()`, add `areaId` to `CreateHabitInput` and `createHabit`
6. **definition.ts** -- Import V6 schema, add HABITS_MIGRATION_V6, bump schemaVersion to 6, add to migrations array
7. **index.ts** -- Export AreaSchema, Area type, and area CRUD functions
8. **apps/mobile/app/(habits)/index.tsx** -- Add horizontal ScrollView of area filter pills below date bar. "All Habits" (default), one per area, "+ New Area" opens inline modal
9. **apps/mobile/app/(habits)/add-habit.tsx** -- Add "Area" card section with picker listing all areas + "None"

### Key context already gathered:

- Schema is currently at **V5** with 27 tables. V6 will be the area grouping migration.
- `HabitSchema` in `types.ts` starts at line 19. Add `areaId` field after `sortOrder`.
- `rowToHabit` in `db/crud.ts` maps DB rows to Habit objects -- needs `areaId` mapping.
- `CreateHabitInput` at line 58 of `db/crud.ts` -- add `areaId?: string`.
- `createHabit` at line 72 uses positional SQL params -- add `area_id` column.
- `getHabits` at line 101 -- add optional `areaId` filter condition.
- `definition.ts` exports `HABITS_MODULE` with migrations array -- append V6.
- `db/index.ts` re-exports from all CRUD files -- add areas.ts exports.
- `add-habit.tsx` uses Card sections for each form field -- add Area picker after existing fields.
- `index.tsx` already has `ACCENT = colors.modules.habits` and area filter pills go after the date bar.

### After HAB-03 completes:

- HAB-04 (Onboarding) and HAB-08 (Templates) are unblocked
- Both can be done sequentially since they touch different files
- Then proceed to Wave 3

### Rules (from task spec):

- Add new screens to hamburger menu in index.tsx
- Use `ACCENT = colors.modules.habits` and Cool Obsidian tokens
- Run `pnpm typecheck` after editing each file
- All new engine functions must be pure (no DB calls, no side effects)
- All new DB functions go in `modules/habits/src/db/`
- Export new public API items from `modules/habits/src/index.ts`
