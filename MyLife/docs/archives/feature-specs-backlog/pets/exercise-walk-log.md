# Feature Spec: Exercise & Walk Log Enhancements

## Metadata
- **Module:** pets
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 3 x3 + Complexity 3 x2 + CrossModule 3 x1 + PaidUser 3 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Pet profile CRUD (V1), Exercise logs (V2)
- **Blocks:** Multi-pet dashboard

## Business Context

### Why This Feature Exists
Pet owners who walk dogs daily want to track exercise consistency, set daily activity goals, and log multi-pet walks without duplicate entry. The existing V2 `pt_exercise_logs` table captures raw logs, but there is no goal-setting, no streak tracking, no weekly/monthly stats aggregation, and no multi-pet walk grouping. FitBark charges $70 for a hardware device that tracks activity; this feature delivers the software analytics layer at no additional hardware cost. Adding goal progress rings and streak counters transforms passive logging into an engaging daily habit.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| 11pets | Yes | Premium ($20/yr) | Per-pet activity log with daily goals, weekly summary, no multi-pet walk grouping |
| FitBark | Yes | Hardware ($70) | GPS + accelerometer activity tracking, daily/weekly goals, breed recommendations |
| Pawp | No | N/A | Focused on vet telehealth, no exercise tracking |
| PetDesk | No | N/A | Vet booking only, no activity features |

### Target User
Dog owners who walk their pets daily (especially multi-dog households) and want to ensure each pet meets breed-appropriate exercise needs. Currently these users use FitBark ($70 device + subscription), Apple Health (human-only, no per-pet breakdown), or manual notes. Migration path: users who already log walks in MyPets get goals and streaks for free as a premium upgrade.

## Technical Context

### Where This Lives in MyLife

```
modules/pets/src/db/schema.ts          -- V4 migration: pt_exercise_goals + ALTER TABLE pt_exercise_logs
modules/pets/src/definition.ts         -- Add PETS_MIGRATION_V4
modules/pets/src/types.ts              -- New Zod schemas: ExerciseGoal, ExerciseProgress, ExerciseStreak, ExerciseSummary
modules/pets/src/db/crud.ts            -- New CRUD: setExerciseGoal, getExerciseGoal, listExerciseLogsForDate
modules/pets/src/engine/exercise.ts    -- Pure functions: progress, streak, summary, breed recommendation
modules/pets/src/index.ts              -- Re-export new public API
modules/pets/src/__tests__/exercise.test.ts -- Engine + CRUD tests
apps/mobile/app/(pets)/exercise.tsx    -- Per-pet exercise screen with progress ring
apps/mobile/app/(pets)/components/ExerciseProgressRing.tsx  -- Circular progress component
apps/mobile/app/(pets)/components/ExerciseStreakBadge.tsx    -- Streak counter badge
apps/web/app/pets/[petId]/exercise/page.tsx                 -- Web exercise screen
```

### Wireframe Position

```
Hub Dashboard
  └── MyPets card
       └── Pets tab (pet list)
            └── Pet Detail
                 └── Health tab
                      └── Exercise & Walk Log ← YOU ARE HERE
```

The exercise log is accessible from the pet detail screen under the Health tab. Each pet has its own progress ring and log. Multi-pet walks are initiated from a dedicated "Walk" FAB on the pet list screen.

### Data Model

The existing V2 schema has `pt_exercise_logs` with columns: `id`, `pet_id`, `activity_type`, `duration_minutes`, `distance_km`, `logged_at`, `notes`, `created_at`. V4 adds a new table and extends the existing table.

```sql
-- V4 Migration: Exercise goals + multi-pet walk support

-- New table: exercise goals (one per pet)
CREATE TABLE IF NOT EXISTS pt_exercise_goals (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  daily_goal_minutes INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pet_id)
);

-- Extend existing exercise logs with group_id and start_time
ALTER TABLE pt_exercise_logs ADD COLUMN group_id TEXT;
ALTER TABLE pt_exercise_logs ADD COLUMN start_time TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS pt_exercise_goals_pet_idx
  ON pt_exercise_goals(pet_id);
CREATE INDEX IF NOT EXISTS pt_exercise_logs_group_idx
  ON pt_exercise_logs(group_id);
CREATE INDEX IF NOT EXISTS pt_exercise_logs_pet_date_idx
  ON pt_exercise_logs(pet_id, logged_at);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter, Migration), `@mylife/module-registry` (ModuleDefinition), `@mylife/ui` (Cool Obsidian tokens, glass card components, progress ring primitives)
- **External:** None. No GPS or hardware integrations in this version.
- **Cross-Module:** Potential future link to MyHealth (step counts, calories burned). Potential link to MyHabits (daily exercise as a trackable habit). No cross-module wiring in this version.

## Functional Requirements

### User Stories
1. As a dog owner, I want to set a daily exercise goal in minutes for each pet so that I can track whether my dog is getting enough activity.
2. As a dog owner, I want to see a progress ring showing today's exercise vs. my goal so that I get immediate visual feedback.
3. As a multi-dog household manager, I want to log a walk for multiple pets at once with a shared group_id so that I do not duplicate effort.
4. As a pet owner, I want to see my exercise streak (consecutive days meeting the goal) so that I stay motivated.
5. As a pet owner, I want weekly and monthly exercise summaries with total minutes, average daily minutes, and top activities so that I can spot trends.
6. As a new pet owner, I want breed-based exercise recommendations so that I set an appropriate daily goal for my pet's breed.

### Behavior Specification

**Setting an exercise goal:**
1. User navigates to a pet's detail screen, Health tab
2. User taps the exercise section or "Set Goal" CTA
3. System opens Set Goal bottom sheet with a numeric input for daily minutes and a breed recommendation (if available)
4. User enters a value (e.g., 60 minutes) and taps Save
5. System upserts `pt_exercise_goals` for this pet
6. Progress ring appears on the exercise section header showing 0% (or current day's progress)

**Viewing daily progress:**
1. User navigates to pet exercise screen
2. System queries today's exercise logs and the pet's goal
3. Progress ring displays `totalMinutesToday / dailyGoalMinutes` as a percentage
4. Below the ring: streak badge showing consecutive days with goal met
5. Below the streak: list of today's exercise entries
6. Below today: weekly summary card (total minutes, avg per day, top activity)

**Logging a multi-pet walk:**
1. User taps "Walk" FAB from the pet list screen
2. System opens pet selector showing all active pets with checkboxes
3. User selects 2+ pets, sets activity type (defaults to "walk"), duration, distance (optional), notes
4. User taps "Log Walk"
5. System generates a shared `group_id` (UUID) and creates one `pt_exercise_logs` entry per selected pet, each with the same `group_id`
6. Each pet's progress ring updates independently

**Deleting a multi-pet walk entry:**
1. User swipes left on an exercise log entry that has a `group_id`
2. System shows "Delete for [pet name] only?" confirmation
3. If confirmed, system deletes only that pet's entry (not the other pets' entries sharing the same `group_id`)

**Viewing exercise streak:**
1. System calculates streak by walking backwards from today
2. Today counts as "in progress" if goal not yet met (does not break streak)
3. A day with `totalMinutes >= dailyGoalMinutes` counts as a streak day
4. If yesterday was missed but today is in progress, streak resets to 0

### Edge Cases

- **No goal set:** Progress ring is hidden. Show "Set a daily goal" CTA instead. Summary and streak still display based on raw logs.
- **Streak grace period:** Today is always "in progress" and does not break the streak. Only completed days (yesterday and before) can break it.
- **Multi-pet walk delete:** Deleting one pet's entry from a multi-pet walk does NOT affect other pets' entries. Each entry is independently owned.
- **Overachievement:** Progress ring caps at 100% visually (ring is full) but shows actual percentage in text (e.g., "135%"). No penalty for exceeding goal.
- **No exercise logs today:** Progress ring shows 0%. Streak is not broken until the day completes with no logs.
- **Goal changed mid-day:** New goal takes effect immediately. Progress recalculates against new goal.
- **Pet archived:** Exercise logs remain queryable. Goal persists but progress ring is hidden.
- **Very large duration:** Cap input at 1440 minutes (24 hours). Validate on input schema.
- **Distance is 0:** Valid (treadmill walk, indoor play). Allow 0.0 km.
- **Module disabled:** Routes removed, data preserved. Re-enabling restores everything.
- **Empty breed or unknown breed:** Breed recommendation returns null. Show generic "30-60 minutes" suggestion.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can set a daily exercise goal in minutes for a specific pet
- [ ] **AC-2:** Progress ring displays today's exercise as a percentage of the daily goal, capped at 100% visually
- [ ] **AC-3:** Streak badge shows consecutive days where the pet met its exercise goal
- [ ] **AC-4:** User can log a single-pet exercise entry with activity type, duration, optional distance, and notes
- [ ] **AC-5:** User can log a multi-pet walk by selecting 2+ pets, creating one entry per pet with a shared group_id
- [ ] **AC-6:** Deleting a multi-pet walk entry only removes that pet's entry, not the others
- [ ] **AC-7:** Weekly summary shows total minutes, average daily minutes, and most frequent activity type
- [ ] **AC-8:** Monthly summary shows total minutes, daily average, and activity breakdown
- [ ] **AC-9:** Breed-based exercise recommendation appears when setting a goal (if breed data is available)
- [ ] **AC-10:** "Set a daily goal" CTA appears when no goal is set; progress ring is hidden until a goal exists
- [ ] **AC-11:** Exercise entries display in reverse chronological order on the exercise screen

### Technical Criteria
- [ ] **TC-1:** V4 migration creates `pt_exercise_goals` table with `UNIQUE(pet_id)` constraint
- [ ] **TC-2:** V4 migration adds `group_id TEXT` and `start_time TEXT` columns to `pt_exercise_logs` via ALTER TABLE
- [ ] **TC-3:** `calculateExerciseProgress()` returns correct progress percentage including 0%, 100%, and >100% cases
- [ ] **TC-4:** `calculateExerciseStreak()` correctly handles today as "in progress", does not count it as a break
- [ ] **TC-5:** `getExerciseSummary()` aggregates weekly and monthly stats accurately across all activity types
- [ ] **TC-6:** `getBreedExerciseRecommendation()` returns breed-specific minutes for known breeds and null for unknown breeds
- [ ] **TC-7:** `setExerciseGoal()` upserts (creates on first call, updates on subsequent calls) for the same pet
- [ ] **TC-8:** Multi-pet walk creates N separate log entries sharing the same group_id
- [ ] **TC-9:** All new indexes are created and queries targeting date ranges use them

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Setting an exercise goal for one pet must NOT affect other pets' goals
- [ ] **NC-2:** Deleting a multi-pet walk entry must NOT delete entries for other pets in the same group
- [ ] **NC-3:** Progress ring must NOT show more than 100% fill (text percentage can exceed 100%)
- [ ] **NC-4:** Disabling the Pets module must NOT delete exercise logs or goals
- [ ] **NC-5:** Exercise data must NOT send any network requests (offline-first, local-only)

## UI Specification

### Mobile (Expo)

- **Background:** `#0A0A0F` (background token)
- **Exercise cards:** `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border, 12px border radius
- **Module accent:** `#F59E0B` (amber)
- **Progress ring:** 120px diameter, 8px stroke width. Track: `rgba(255,255,255,0.06)`. Fill: `#F59E0B` (accent). Center text: percentage in `#F0F0F5` (text token), 24px bold
- **Streak badge:** Pill shape, `rgba(245,158,11,0.15)` background, `#F59E0B` text, flame icon prefix
- **Multi-pet walk FAB:** 56px circle, `#F59E0B` background, white "+" icon, positioned bottom-right on pet list screen
- **Activity type pills:** Horizontal scroll, selected pill uses `#F59E0B` background, unselected uses glass token
- **Weekly summary card:** Glass card with bar chart (7 bars for each day), `#F59E0B` fill bars on `rgba(255,255,255,0.06)` track
- **Layout:** ScrollView with sections: progress ring + streak (top), today's entries (middle), weekly summary card (bottom), "Log Exercise" button fixed at bottom

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Exercise screen accessible via `/pets/[petId]/exercise` route
- Sidebar navigation: "Exercise" appears as a sub-nav item under the pet detail
- Progress ring uses SVG with CSS transitions (300ms ease) for the arc animation
- Multi-pet walk modal uses dialog instead of bottom sheet
- Weekly chart uses CSS grid bars instead of canvas

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton progress ring (pulsing circle) + 3 skeleton cards | Initial data fetch |
| Empty (no goal) | "Set a daily exercise goal" CTA button, no progress ring, empty log list with "Log your first walk" message | No goal set, no logs |
| Empty (goal set) | Progress ring at 0%, streak shows "0 days", empty log list | Goal set but no logs today |
| Populated | Progress ring with percentage, streak badge, list of exercise entries | Logs exist for today |
| Goal Met | Progress ring at 100% with confetti pulse animation, streak incremented | Today's total >= goal |
| Error | Toast: "Could not load exercise data." with retry action | Database read fails |

## Test Requirements

### Unit Tests (engine/exercise.ts)
- [ ] `calculateExerciseProgress`: returns 0 when no logs exist for today
- [ ] `calculateExerciseProgress`: returns 50 when 30 of 60 goal minutes logged
- [ ] `calculateExerciseProgress`: returns 100 when goal is exactly met
- [ ] `calculateExerciseProgress`: returns 150 when 90 of 60 goal minutes logged (overachievement)
- [ ] `calculateExerciseProgress`: returns null when no goal is set
- [ ] `calculateExerciseStreak`: returns 0 when no logs exist
- [ ] `calculateExerciseStreak`: returns 3 when last 3 completed days met goal
- [ ] `calculateExerciseStreak`: returns 0 when yesterday was missed (today in progress)
- [ ] `calculateExerciseStreak`: returns 5 when 5 consecutive days met goal and today is in progress
- [ ] `calculateExerciseStreak`: handles non-consecutive dates (skipped days break streak)
- [ ] `getExerciseSummary`: returns correct weekly total minutes
- [ ] `getExerciseSummary`: returns correct monthly average daily minutes
- [ ] `getExerciseSummary`: identifies most frequent activity type
- [ ] `getExerciseSummary`: returns zeroes when no logs in range
- [ ] `getBreedExerciseRecommendation`: returns 60 for "golden retriever"
- [ ] `getBreedExerciseRecommendation`: returns 30 for "french bulldog" (low energy breed)
- [ ] `getBreedExerciseRecommendation`: returns null for unknown breed
- [ ] `getBreedExerciseRecommendation`: returns null for null breed

### Integration Tests (CRUD)
- [ ] `setExerciseGoal` creates goal on first call and returns it
- [ ] `setExerciseGoal` updates goal on second call (upsert behavior)
- [ ] `getExerciseGoal` returns null for pet with no goal
- [ ] Multi-pet walk creates N entries with shared group_id
- [ ] Deleting one entry from a group does not affect others
- [ ] V4 migration runs cleanly on existing V3 database
- [ ] V4 migration adds group_id and start_time columns to pt_exercise_logs
- [ ] Existing exercise logs have NULL group_id and start_time after migration
- [ ] Delete pet cascades to exercise goals

### QA Verification Script

1. Open the app on mobile (iOS simulator or device)
2. Navigate to MyPets module from hub dashboard
3. Tap an existing pet (or create one: "Luna", dog, golden retriever)
4. Navigate to the Health tab, Exercise section
5. **Verify empty state:** See "Set a daily exercise goal" CTA, no progress ring -- AC-10
6. Tap "Set a daily exercise goal"
7. **Verify:** Breed recommendation shows "Recommended: 60 min/day for golden retrievers" -- AC-9
8. Enter 60 minutes, tap Save
9. **Verify:** Progress ring appears at 0%, streak shows "0 days" -- AC-2, AC-3
10. Tap "Log Exercise"
11. Fill in: activity = walk, duration = 30 min, distance = 2.5 km
12. Tap Save
13. **Verify:** Progress ring shows 50%, entry appears in list -- AC-2, AC-4, AC-11
14. Log another exercise: activity = fetch, duration = 35 min
15. **Verify:** Progress ring shows 100% (visually full), text says "108%" -- AC-2, NC-3
16. **Verify:** Streak badge updates -- AC-3
17. Go back to pet list, tap Walk FAB
18. Select Luna + another pet "Max"
19. Fill in: duration = 45 min, distance = 3.0 km
20. Tap "Log Walk"
21. **Verify:** Both Luna and Max have new exercise entries -- AC-5
22. Navigate to Luna's exercise screen
23. Swipe left on the group walk entry, delete
24. **Verify:** Only Luna's entry is removed. Navigate to Max -- Max's entry still exists -- AC-6, NC-2
25. Check weekly summary card
26. **Verify:** Shows total minutes, daily average, top activity -- AC-7
27. Create a second pet "Max" with different breed
28. Set a different goal for Max
29. **Verify:** Luna's goal is unchanged -- NC-1

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 3 (Medium):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for exercise engine (progress calculator, streak counter, summary aggregator)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- pets module has no standalone counterpart (skip)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- `pt_exercise_logs` table exists (V2) with columns: id, pet_id, activity_type, duration_minutes, distance_km, logged_at, notes, created_at
- `createExerciseLog()` and `listExerciseLogsForPet()` CRUD exist in `crud.ts`
- `ExerciseLogSchema`, `CreateExerciseLogInputSchema`, and `ExerciseActivityTypeSchema` Zod schemas exist in `types.ts`
- No exercise goal setting
- No progress tracking or streak counting
- No multi-pet walk grouping
- No exercise summary aggregation
- No breed-based exercise recommendations
- No mobile or web UI screens for exercise management

### After This Work
- V4 migration adds `pt_exercise_goals` table with UNIQUE(pet_id) constraint
- V4 migration extends `pt_exercise_logs` with `group_id TEXT` and `start_time TEXT` columns
- New Zod schemas: `ExerciseGoalSchema`, `ExerciseProgressSchema`, `ExerciseStreakSchema`, `ExerciseSummarySchema`
- New CRUD: `setExerciseGoal`, `getExerciseGoal`, `listExerciseLogsForDate`
- New engine: `engine/exercise.ts` with `calculateExerciseProgress()`, `calculateExerciseStreak()`, `getExerciseSummary()`, `getBreedExerciseRecommendation()`
- Mobile screen at `apps/mobile/app/(pets)/exercise.tsx` with progress ring, streak badge, entry list
- Web page at `apps/web/app/pets/[petId]/exercise/page.tsx`
- 25+ new tests covering engine logic and CRUD operations

### Files Changed

- `modules/pets/src/db/schema.ts` -- V4 table DDL: pt_exercise_goals, ALTER TABLE pt_exercise_logs, new indexes
- `modules/pets/src/definition.ts` -- Add PETS_MIGRATION_V4, bump schemaVersion to 4
- `modules/pets/src/types.ts` -- New schemas: ExerciseGoal, ExerciseProgress, ExerciseStreak, ExerciseSummary, CreateExerciseGoalInput
- `modules/pets/src/db/crud.ts` -- New CRUD: setExerciseGoal, getExerciseGoal, listExerciseLogsForDate
- `modules/pets/src/engine/exercise.ts` -- New engine file with 4 pure functions
- `modules/pets/src/index.ts` -- Re-export new public API
- `modules/pets/src/__tests__/exercise.test.ts` -- Unit + integration tests
- `apps/mobile/app/(pets)/exercise.tsx` -- Per-pet exercise screen
- `apps/mobile/app/(pets)/components/ExerciseProgressRing.tsx` -- Circular progress ring component
- `apps/mobile/app/(pets)/components/ExerciseStreakBadge.tsx` -- Streak badge component
- `apps/web/app/pets/[petId]/exercise/page.tsx` -- Web exercise page

### Known Limitations
- No GPS route recording. Distance is manually entered. Future feature could integrate with device GPS.
- No Apple Health / Google Fit sync. Exercise data is local-only. Future cross-module integration with MyHealth could bridge this.
- Breed recommendations cover a limited set of popular breeds. Unknown breeds get a generic suggestion.
- Streak calculation does not account for rest days or recovery periods. A future enhancement could add configurable rest day allowances.
- Multi-pet walk does not support different durations per pet (all pets share the same duration in a group walk).

### Context for Next Agent
- The existing `pt_exercise_logs` table (V2) does not have `group_id` or `start_time`. After V4 migration, existing rows will have NULL for both new columns. Handle NULL `group_id` gracefully -- treat as a single-pet entry.
- `listExerciseLogsForPet()` already sorts by `logged_at DESC`. The new `listExerciseLogsForDate()` should filter by date and maintain the same sort order.
- The `ExerciseActivityTypeSchema` enum already exists in `types.ts` with values: walk, run, hike, swim, fetch, play, training, other. Reuse this for the multi-pet walk form.
- For `calculateExerciseStreak()`, the function receives a list of daily totals (date + totalMinutes) and a goal. It should not query the database directly -- keep it pure.
- The progress ring component should be reusable. Consider placing it in `@mylife/ui` if other modules (MyHealth, MyHabits) will need similar progress rings in the future.
- Breed exercise recommendations are stored as a static lookup table in the engine file (similar to how `engine/alerts.ts` stores breed health alerts). No external API calls.
