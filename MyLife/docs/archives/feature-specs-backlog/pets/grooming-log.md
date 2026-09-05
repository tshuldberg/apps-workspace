# Feature Spec: Grooming Log Enhancements

## Metadata
- **Module:** pets
- **Priority Score:** 23 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 2 x3 + Complexity 4 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** 3
- **Estimated CC Time:** 2-3 hours
- **Depends On:** Pet profile CRUD (V1), Grooming records table (V2)
- **Blocks:** none

## Business Context

### Why This Feature Exists
The `pt_grooming_records` table (V2) stores individual grooming events with manual `next_due_date` entry, but pet owners need automatic scheduling based on configurable intervals. A golden retriever needs a bath every 4-6 weeks, nail trims every 2-3 weeks, and ear cleaning weekly. Currently, users must manually calculate and enter the next due date every time they log a grooming session. This feature adds interval-based auto-scheduling so the next due date is computed automatically, plus a grooming overview showing all types with their last-done and next-due status. 11pets has this built into their premium tier; PetDesk has basic grooming reminders but no interval configuration.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| 11pets | Yes | Premium ($20/yr) | Per-type grooming intervals with reminders, grooming history timeline, multi-pet grooming view |
| PetDesk | Partial | Free | Basic grooming appointment reminders via vet practice, no interval configuration |
| Pawp | No | N/A | Vet telehealth only, no grooming tools |
| FitBark | No | N/A | Activity tracker, no grooming features |
| Dogo | No | N/A | Training-only app |
| Pupford | No | N/A | Content-first, no grooming tracking |

### Target User
Pet owners who maintain regular grooming schedules (bathing, nail trims, ear cleaning, dental care) and want automatic reminders rather than manually calculating "4 weeks from last bath." Especially valuable for multi-pet households where each pet has different grooming frequencies. Also pet owners whose groomer recommends specific intervals (e.g., "bath every 6 weeks, nails every 3 weeks").

## Technical Context

### Where This Lives in MyLife

```
modules/pets/src/db/schema.ts                   -- V4 migration: pt_grooming_intervals table
modules/pets/src/definition.ts                   -- Add PETS_MIGRATION_V4
modules/pets/src/types.ts                        -- New types: GroomingInterval, GroomingOverviewItem
modules/pets/src/db/crud.ts                      -- New CRUD: setGroomingInterval, getGroomingIntervals, updateGroomingRecord, deleteGroomingRecord
modules/pets/src/engine/grooming.ts              -- Pure functions: calculateNextGroomingDate, getGroomingOverview, getOverdueGroomingTasks
modules/pets/src/index.ts                        -- Re-export new public API
modules/pets/src/__tests__/grooming.test.ts      -- Engine + CRUD tests
apps/mobile/app/(pets)/grooming.tsx              -- Per-pet grooming screen
apps/web/app/pets/[petId]/grooming/page.tsx      -- Web grooming screen
```

### Wireframe Position

```
Hub Dashboard
  +-- MyPets card
       +-- Multi-Pet Dashboard
       +-- Pet Detail
       |    +-- Health tab
       |    +-- Reminders tab
       |    |    +-- Grooming  <-- YOU ARE HERE
       |    |    +-- Vaccinations
       |    |    +-- Medications
       |    +-- Settings
       +-- Settings
```

### Data Model

V4 migration adds one new table for grooming intervals:

```sql
-- V4 Migration: Grooming interval scheduling

CREATE TABLE IF NOT EXISTS pt_grooming_intervals (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  grooming_type TEXT NOT NULL,
  interval_days INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pet_id, grooming_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS pt_grooming_intervals_pet_idx
  ON pt_grooming_intervals(pet_id);
```

Existing table (V2, unchanged):
```sql
-- pt_grooming_records (already exists)
-- id TEXT PK, pet_id TEXT FK, grooming_type TEXT, groomed_at TEXT,
-- next_due_date TEXT, provider TEXT, cost_cents INTEGER, notes TEXT, created_at TEXT
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter, Migration), `@mylife/module-registry` (ModuleDefinition), `@mylife/ui` (Cool Obsidian tokens, glass card components)
- **External:** None. All local SQLite.
- **Cross-Module:** None. Grooming costs already create expense records via existing `createPetExpense` CRUD.

## Functional Requirements

### User Stories
1. As a pet owner, I want to set grooming intervals per type (e.g., bath every 28 days, nails every 14 days) so that next due dates are calculated automatically when I log a grooming session.
2. As a pet owner, I want to see an overview of all grooming types with their last-done date and next-due date so that I can see what grooming is coming up at a glance.
3. As a pet owner, I want to see which grooming tasks are overdue across all my pets so that nothing gets missed.
4. As a pet owner, I want to edit or delete a grooming record if I made an error.
5. As a pet owner, I want the option to auto-create an expense record when I log a grooming session with a cost.

### Behavior Specification

**Setting a grooming interval:**
1. User navigates to a pet's grooming section
2. User taps a grooming type (e.g., "Bath")
3. System opens interval settings with a day picker
4. User sets interval (e.g., 28 days)
5. System upserts `pt_grooming_intervals` record (one per pet+type)
6. Future grooming records of this type will auto-calculate `next_due_date` from interval

**Logging a grooming session with auto-scheduling:**
1. User taps "Log Grooming" on the grooming overview
2. User selects grooming type, date, provider (optional), cost (optional), notes (optional)
3. User taps Save
4. System creates `pt_grooming_records` record
5. System checks `pt_grooming_intervals` for this pet+type
6. If interval exists: auto-set `next_due_date` = `groomed_at` + `interval_days`
7. If no interval: `next_due_date` remains null unless user manually set one
8. If `cost_cents` > 0: auto-create `pt_expenses` record with category="grooming"

**Viewing grooming overview:**
1. User opens pet's grooming section
2. System shows a list of all grooming types
3. Each type shows: type name, last groomed date ("Never" if none), next due date, interval (if set), status indicator (overdue/due_soon/current/never)
4. Types with no records and no interval are dimmed but still shown
5. Overdue types are highlighted and sorted to top

**Editing/deleting a grooming record:**
1. User taps an existing grooming record in the history list
2. User can edit date, provider, cost, notes
3. On save, system updates the record
4. If the edited record is the most recent for this type, recalculate `next_due_date` from the new `groomed_at` + interval
5. User can delete via swipe (mobile) or delete button (web) with confirmation
6. On delete, if this was the most recent record, recalculate `next_due_date` from the previous record (or set to null if no previous records)

### Edge Cases

- **No interval set:** `next_due_date` must be manually provided by the user or left null. Auto-calculation is skipped.
- **Interval changed after existing records:** Does not retroactively update past records. Only affects the next grooming log for this type.
- **Cost auto-creates expense:** If `cost_cents` > 0 on a grooming record, auto-create a `pt_expenses` record with `category='grooming'`, `label='[GroomingType] - [PetName]'`, `spent_on=groomed_at`. If cost is 0 or null, skip expense creation.
- **Multiple types overdue simultaneously:** All show in the overview sorted by days overdue (most overdue first).
- **Grooming type "other":** User must provide a description in notes. Interval can be set for "other" but the type name in the overview shows "Other".
- **Pet deleted:** CASCADE deletes grooming records AND grooming intervals.
- **Same grooming type logged twice same day:** Allowed. Both records kept. The most recent by `groomed_at` timestamp is used for next_due_date calculation.
- **Editing a non-latest record:** Does not affect next_due_date (only the most recent record drives the calculation).
- **Delete the only record for a type:** `next_due_date` for that type becomes null (nothing to calculate from).
- **Interval of 0 days:** Rejected by validation. Minimum interval is 1 day.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can set a grooming interval (in days) for each grooming type per pet
- [ ] **AC-2:** Grooming overview shows all 8 grooming types with last-done date, next-due date, and status indicator
- [ ] **AC-3:** When logging a grooming record, if an interval exists for that type, `next_due_date` is auto-calculated
- [ ] **AC-4:** When logging a grooming record with no interval, user can manually set `next_due_date` or leave it blank
- [ ] **AC-5:** Overdue grooming types are highlighted red and sorted to the top of the overview
- [ ] **AC-6:** User can edit an existing grooming record's date, provider, cost, and notes
- [ ] **AC-7:** User can delete a grooming record with confirmation
- [ ] **AC-8:** Logging a grooming record with cost > 0 auto-creates an expense record
- [ ] **AC-9:** Grooming overview shows "Never" for types with no records

### Technical Criteria
- [ ] **TC-1:** V4 migration adds `pt_grooming_intervals` table with UNIQUE(pet_id, grooming_type) constraint
- [ ] **TC-2:** V4 migration is idempotent (safe to re-run) and has correct down migration
- [ ] **TC-3:** `calculateNextGroomingDate()` correctly adds interval_days to groomed_at date
- [ ] **TC-4:** `getGroomingOverview()` returns all 8 grooming types with correct status for each
- [ ] **TC-5:** `getOverdueGroomingTasks()` returns overdue items across all pets sorted by days overdue
- [ ] **TC-6:** `setGroomingInterval()` upserts (insert or update) based on pet_id+grooming_type uniqueness
- [ ] **TC-7:** `updateGroomingRecord()` recalculates next_due_date if editing the most recent record for that type
- [ ] **TC-8:** `deleteGroomingRecord()` recalculates next_due_date from previous record or sets null
- [ ] **TC-9:** Cost-to-expense bridge creates expense with correct category, label, and amount

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Changing an interval must NOT retroactively update past grooming records' next_due_date values
- [ ] **NC-2:** Deleting a pet must NOT leave orphaned grooming intervals (CASCADE)
- [ ] **NC-3:** Setting an interval of 0 days must NOT be allowed (minimum 1 day)
- [ ] **NC-4:** Editing a non-latest grooming record must NOT change the current next_due_date
- [ ] **NC-5:** Disabling the Pets module must NOT delete grooming interval data
- [ ] **NC-6:** Grooming operations must NOT require network access (offline-first)

## UI Specification

### Mobile (Expo)

- **Background:** `#0A0A0F` (background token)
- **Grooming overview cards:** `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border, 12px border radius. Each card is a row with grooming type icon (module accent `#F59E0B`), type name in `#F0F0F5`, last done date in `rgba(240,240,245,0.65)`, status badge.
- **Status badges:** Overdue = `#FF453A` background with white text. Due soon = `#F59E0B` background with dark text. Current = `#30D158` background with dark text. Never = `rgba(255,255,255,0.06)` background with `rgba(240,240,245,0.65)` text.
- **Interval setting:** Bottom sheet with number input and "days" label. Save button in `#F59E0B`.
- **Log grooming form:** Bottom sheet via expo-blur BlurView. Grooming type picker, date picker, provider text input, cost input (currency formatted), notes multiline, save button.
- **History list:** Expandable section below overview. Glass cards with date, provider, cost, edit/delete actions.
- **Layout:** ScrollView with sections: grooming overview grid (2 columns), history list (expandable).

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Grooming page at `/pets/[petId]/grooming` route
- Sidebar navigation: "Grooming" as sub-nav under pet detail
- Overview uses CSS Grid (2 columns at 768px+, 1 column below)
- Glass cards use CSS `backdrop-filter: blur(12px)`
- Log/edit forms use modal dialogs instead of bottom sheets
- History list uses a table layout at wider viewports

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | 8 skeleton grooming type cards with pulsing animation | Initial data fetch |
| Empty | 8 grooming type cards all showing "Never", no history | No grooming records for this pet |
| Populated | Type cards with last-done dates, status badges, history below | Grooming records exist |
| Overdue | Overdue types highlighted red, sorted to top | next_due_date < today |
| Interval set | Small "Every X days" label on type card | Interval configured for this type |
| Error | Toast: "Could not load grooming data." with retry action | Database read fails |

## Test Requirements

### Unit Tests (engine/grooming.ts)
- [ ] `calculateNextGroomingDate`: adds 28 days to a date correctly
- [ ] `calculateNextGroomingDate`: adds 7 days to a date correctly
- [ ] `calculateNextGroomingDate`: handles month boundaries (Jan 31 + 14 days = Feb 14)
- [ ] `calculateNextGroomingDate`: handles year boundaries (Dec 20 + 30 days = Jan 19)
- [ ] `calculateNextGroomingDate`: returns null when interval is null/undefined
- [ ] `getGroomingOverview`: returns all 8 types even when no records exist
- [ ] `getGroomingOverview`: shows "Never" status for types with no records
- [ ] `getGroomingOverview`: shows correct last-done date from most recent record per type
- [ ] `getGroomingOverview`: shows overdue status when next_due_date < reference date
- [ ] `getGroomingOverview`: shows due_soon status when next_due_date within 7 days
- [ ] `getGroomingOverview`: sorts overdue types first, then due_soon, then current, then never
- [ ] `getOverdueGroomingTasks`: returns overdue tasks across 3 pets sorted by days overdue
- [ ] `getOverdueGroomingTasks`: excludes archived pets
- [ ] `getOverdueGroomingTasks`: returns empty array when nothing is overdue

### Integration Tests (CRUD)
- [ ] `setGroomingInterval`: creates new interval for pet+type
- [ ] `setGroomingInterval`: updates existing interval (upsert behavior)
- [ ] `setGroomingInterval`: rejects interval_days of 0
- [ ] `getGroomingIntervals`: returns all intervals for a pet
- [ ] `createGroomingRecord` with interval: auto-sets next_due_date
- [ ] `createGroomingRecord` without interval: next_due_date from user input or null
- [ ] `createGroomingRecord` with cost: auto-creates expense record
- [ ] `createGroomingRecord` without cost: no expense created
- [ ] `updateGroomingRecord`: updates fields and recalculates next_due_date for latest record
- [ ] `updateGroomingRecord`: does not recalculate next_due_date for non-latest record
- [ ] `deleteGroomingRecord`: recalculates from previous record
- [ ] `deleteGroomingRecord`: sets null when deleting the only record
- [ ] Delete pet cascades to grooming intervals
- [ ] V4 migration runs cleanly on existing V3 database

### QA Verification Script

1. Open the app on mobile (iOS simulator or device)
2. Navigate to MyPets module from hub dashboard
3. Tap an existing pet (or create "Luna", dog, golden retriever)
4. Navigate to grooming section
5. **Verify empty state:** All 8 grooming types shown, all "Never" -- AC-9
6. Tap "Bath" type card
7. Set interval to 28 days, save
8. **Verify:** Bath card shows "Every 28 days" label -- AC-1
9. Tap "Log Grooming"
10. Select type = Bath, date = today, provider = "PetSmart", cost = $45, save
11. **Verify:** Bath card shows today's date as last done, next due = today + 28 days -- AC-2, AC-3
12. **Verify:** Expense record created: check pet expenses for $45 grooming entry -- AC-8
13. Tap "Log Grooming" again
14. Select type = Nail Trim, date = today, no interval set, leave next_due_date blank, save
15. **Verify:** Nail Trim shows today as last done, next due = blank -- AC-4
16. Wait or set device date to 29 days later (past Bath due date)
17. **Verify:** Bath card shows overdue status (red), sorted to top -- AC-5
18. Tap the bath grooming record in history
19. Change provider to "Petco", save
20. **Verify:** Record updated with new provider -- AC-6
21. Swipe left on the nail trim record, tap Delete, confirm
22. **Verify:** Nail trim record removed from history -- AC-7

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to `/pets/[petId]/grooming` on web, click every button, verify all 6 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for grooming engine (interval calculation, overview aggregation, overdue detection)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- pets module has no standalone counterpart (skip)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- `pt_grooming_records` table exists (V2) with: id, pet_id, grooming_type, groomed_at, next_due_date, provider, cost_cents, notes, created_at
- `createGroomingRecord()` and `listGroomingRecordsForPet()` CRUD exist in `crud.ts`
- `listDueGroomingReminders()` returns grooming records with upcoming `next_due_date`
- `GroomingTypeSchema` enum has 8 values: bath, nail_trim, haircut, ear_cleaning, teeth_brushing, flea_treatment, deshedding, other
- No interval-based auto-scheduling (next_due_date is always manual)
- No grooming overview showing all types at once
- No update or delete operations for grooming records
- No auto-expense creation from grooming cost

### After This Work
- V4 migration adds `pt_grooming_intervals` table with UNIQUE(pet_id, grooming_type)
- New engine `engine/grooming.ts` with: `calculateNextGroomingDate`, `getGroomingOverview`, `getOverdueGroomingTasks`
- New CRUD: `setGroomingInterval`, `getGroomingIntervals`, `updateGroomingRecord`, `deleteGroomingRecord`
- Enhanced `createGroomingRecord` with auto-scheduling (checks interval, sets next_due_date) and auto-expense creation
- New types: `GroomingInterval`, `GroomingOverviewItem`
- Mobile screen at `apps/mobile/app/(pets)/grooming.tsx`
- Web page at `apps/web/app/pets/[petId]/grooming/page.tsx`
- 28+ new tests covering engine logic and CRUD operations

### Files Changed

- `modules/pets/src/db/schema.ts` -- V4 table DDL: pt_grooming_intervals + index
- `modules/pets/src/definition.ts` -- Add PETS_MIGRATION_V4 to migrations array, bump schemaVersion to 4
- `modules/pets/src/types.ts` -- New schemas: GroomingInterval, GroomingOverviewItem, CreateGroomingIntervalInput, UpdateGroomingRecordInput
- `modules/pets/src/db/crud.ts` -- New CRUD: setGroomingInterval, getGroomingIntervals, updateGroomingRecord, deleteGroomingRecord. Enhanced createGroomingRecord with auto-scheduling and auto-expense.
- `modules/pets/src/engine/grooming.ts` -- New pure functions: calculateNextGroomingDate, getGroomingOverview, getOverdueGroomingTasks
- `modules/pets/src/index.ts` -- Re-export new public API
- `modules/pets/src/__tests__/grooming.test.ts` -- Unit + integration tests
- `apps/mobile/app/(pets)/grooming.tsx` -- Per-pet grooming screen
- `apps/web/app/pets/[petId]/grooming/page.tsx` -- Web grooming page

### Known Limitations
- Changing an interval does not retroactively update existing records. Only affects the next log.
- Expense auto-creation is one-directional: deleting a grooming record does not delete the associated expense.
- No notification/push reminder for overdue grooming (visual only when screen is open).
- "Other" grooming type groups all custom grooming into one bucket. No user-defined custom types.
- No grooming provider directory or history (provider is free text, not a reusable entity).

### Context for Next Agent
- The existing `createGroomingRecord()` in `crud.ts` takes `CreateGroomingRecordInput` which includes an optional `nextDueDate`. The enhancement should: (1) check `pt_grooming_intervals` for this pet+type, (2) if interval exists and user did not provide `nextDueDate`, calculate it from `groomedAt + interval_days`, (3) if user provided `nextDueDate`, use that instead (user override).
- The `GroomingTypeSchema` enum has 8 values defined in `types.ts`. The grooming overview should show all 8 types even if some have no records or intervals.
- Grooming records have an existing index: `pt_grooming_records_pet_idx ON pt_grooming_records(pet_id, groomed_at DESC)`. Use this for efficient queries.
- For the cost-to-expense bridge, use the existing `createPetExpense()` CRUD function. Set `category='grooming'` and `label='Bath - Luna'` (type + pet name). The `spent_on` should match `groomed_at`.
- The V4 migration must be added to the `migrations` array in `definition.ts` after `PETS_MIGRATION_V3`. Bump `schemaVersion` from 3 to 4.
