# Feature Spec: HealthKit Auto-Tracking

## Metadata
- **Module:** habits
- **Priority Score:** 30 / 50 (A-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 4 x3 + Complexity 1 x2 + CrossModule 4 x1 + PaidUser 3 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Health module HealthKit integration (S-Tier, Sprint 1 spec exists)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Streaks ($4.99 one-time, Apple Design Award winner) built its entire differentiator on HealthKit auto-completion: habits like "Walk 10,000 steps" or "Sleep 7+ hours" complete automatically from Apple Health data without the user manually tapping anything. This is the most-requested feature in habit app reviews because manual completion is the #1 reason users abandon habit trackers. By connecting habits to HealthKit data sources, users' phones do the tracking for them. MyLife's health module already has a HealthKit integration spec (S-Tier, 43/50), and the habits module supports measurable habits with numeric targets. Connecting these two creates automatic, zero-friction habit tracking.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Streaks | Yes | $4.99 one-time | Auto-complete habits from HealthKit: steps, distance, flights climbed, exercise minutes, stand hours, mindful minutes, sleep, water, calories. Core selling point. |
| Habitify | Partial | $59.88/yr | HealthKit step count integration only. Limited data sources. |
| Habitica | No | N/A | No health data integration. |
| Fabulous | No | N/A | No auto-tracking from health data. |
| I Am Sober | No | N/A | No health data integration. |

### Target User
Streaks users who want HealthKit auto-completion integrated with a full habit ecosystem (not just 12 habits). Also fitness-conscious users who already track with Apple Watch / Apple Health and want their health data to feed into habit streaks automatically. Migration: Streaks user limited to 12 habits gets unlimited auto-tracked habits with MyLife.

## Technical Context

### Where This Lives in MyLife

```
modules/habits/src/
  healthkit/
    bridge.ts                   -- NEW: HealthKit-to-habit mapping, auto-completion logic
    data-sources.ts             -- NEW: Catalog of supported HealthKit data sources
    __tests__/bridge.test.ts    -- NEW: Bridge tests
  db/
    healthkit-links.ts          -- NEW: HealthKit link CRUD
    schema.ts                   -- MODIFY: Add hb_healthkit_links table
  types.ts                      -- MODIFY: Add HealthKit link schemas
  definition.ts                 -- MODIFY: Add to V3 migration
  index.ts                      -- MODIFY: Export HealthKit bridge + types
apps/mobile/app/(habits)/
  add-habit.tsx                 -- MODIFY: Add "Auto-track from Health" option
  habit-detail.tsx              -- MODIFY: Show HealthKit source indicator
apps/web/app/habits/
  (web: no HealthKit -- show "Available on iOS" badge)
```

### Wireframe Position

```
Hub Dashboard
  └── MyHabits card
       ├── Today tab
       │    └── [Auto-tracked habit card shows Apple Health icon + auto-completed status]
       ├── Habits tab
       │    └── [Add Habit] -> "Track from Apple Health" toggle
       │    └── [Habit detail] -> "Synced from Apple Health" source badge
       ├── Stats tab
       └── Settings tab
            └── [HealthKit Permissions section]
```

### Data Model

```sql
-- Link between a habit and a HealthKit data source
CREATE TABLE IF NOT EXISTS hb_healthkit_links (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
  data_source TEXT NOT NULL,
  metric TEXT NOT NULL,
  threshold REAL NOT NULL,
  comparison TEXT NOT NULL DEFAULT 'gte'
    CHECK (comparison IN ('gte', 'lte', 'eq', 'gt', 'lt')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(habit_id)
);

CREATE INDEX IF NOT EXISTS hb_healthkit_links_habit_idx ON hb_healthkit_links(habit_id);
CREATE INDEX IF NOT EXISTS hb_healthkit_links_source_idx ON hb_healthkit_links(data_source);
```

### Dependencies
- **Internal:** `@mylife/habits` (completions, measurable habits, streaks), `@mylife/health` (HealthKit integration from Sprint 1 spec), `@mylife/db`
- **External:** `expo-apple-healthkit` or `react-native-health` (HealthKit API access on iOS). The Health module's HealthKit spec will establish the library choice; this spec uses whatever that spec installs.
- **Cross-Module:** Health module provides the HealthKit data pipeline. This spec builds a bridge from that data to habit completions. The habits module already supports cross-module via `habitsCrossModule`.

## Functional Requirements

### User Stories
1. As a user, I want to link a habit to a HealthKit metric (e.g., "Walk 10,000 steps") so it completes automatically.
2. As a user, I want my step count / sleep / exercise minutes habit to show as completed without me tapping anything.
3. As a user, I want to see which habits are auto-tracked vs manual so I know which ones need my attention.
4. As a user, I want to configure the threshold (e.g., 8,000 steps instead of 10,000) for auto-completion.
5. As a user, I want auto-completed habits to count toward my streak just like manual completions.

### Behavior Specification

**Supported HealthKit data sources:**

| Data Source | Metric | Default Threshold | Unit |
|-------------|--------|------------------|------|
| Steps | stepCount | 10,000 | steps |
| Distance Walking/Running | distanceWalkingRunning | 5.0 | km |
| Flights Climbed | flightsClimbed | 10 | flights |
| Active Energy Burned | activeEnergyBurned | 500 | kcal |
| Exercise Minutes | appleExerciseTime | 30 | minutes |
| Stand Hours | appleStandHour | 12 | hours |
| Mindful Minutes | mindfulSession | 10 | minutes |
| Sleep Duration | sleepAnalysis | 7.0 | hours |
| Water Intake | dietaryWater | 2000 | ml |
| Heart Rate (resting) | restingHeartRate | 70 | bpm (lte) |

**Creating an auto-tracked habit:**
1. User taps "Add Habit" on the Habits tab.
2. A toggle appears: "Auto-track from Apple Health."
3. When enabled:
   - Habit type automatically set to 'measurable'.
   - Data source picker shows the supported sources above.
   - Threshold input pre-filled with default, user can adjust.
   - Comparison operator defaults to 'gte' (greater than or equal). For resting heart rate, defaults to 'lte'.
   - Frequency automatically set to 'daily' (HealthKit syncs daily data).
4. On save, an `hb_healthkit_links` record is created linking the habit to the data source.

**Auto-sync flow:**
1. When the Today tab loads (or habits module initializes), the sync engine runs.
2. For each active HealthKit-linked habit:
   a. Query the Health module for today's value of the linked metric.
   b. Compare the value against the threshold using the comparison operator.
   c. If the condition is met and no completion exists for today, auto-record a completion.
   d. If the condition is met, also record a measurement in `hb_measurements` with the actual value.
   e. Update `last_synced_at` on the link.
3. Sync is lightweight (one HealthKit query per linked habit). Target: < 500ms total.

**Visual indicators:**
- Auto-tracked habits show a small Apple Health icon (heart) on their card.
- If the metric is partially met (e.g., 7,500 of 10,000 steps), show progress: "7,500 / 10,000 steps."
- When auto-completed, the habit card shows a green checkmark with "Auto-tracked" badge.
- Manual completion is still possible (user can override/force-complete).

**Permission handling:**
1. First time a user creates a HealthKit-linked habit, request HealthKit read permissions for the specific data type.
2. If permission denied, show a message: "Enable Health access in Settings > Privacy > Health > MyLife."
3. Link remains in the database but marked as inactive until permission is granted.

### Edge Cases

- **HealthKit not available (Android, web):** Auto-track toggle hidden. Show "Available on iOS" badge. Habits can still be tracked manually.
- **HealthKit permission denied:** Link saved as inactive. Show permission guidance. Re-check on next app open.
- **Data not yet available for today:** Show "Waiting for health data" status. Sync again on next open.
- **User manually completes an auto-tracked habit:** Valid. Manual completion takes precedence. No duplicate completion if auto-sync runs later.
- **Threshold changed after habit creation:** Applies from today forward. Past completions are not retroactively changed.
- **HealthKit returns 0 (no data):** Habit not completed. Show "0 / 10,000 steps" progress.
- **Multiple habits linked to the same data source:** Supported. Each can have different thresholds (e.g., "Walk 5K" and "Walk 10K").
- **User switches from auto-tracked to manual:** Deactivate the HealthKit link. Future completions are manual. Historical auto-completions remain.
- **Large gap in HealthKit data (phone off for a day):** Only sync today's data. Do not retroactively complete past days.
- **Module disabled:** Sync stops. Links and completions persist.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Auto-track from Apple Health" toggle appears when creating a habit (iOS only)
- [ ] **AC-2:** Data source picker shows all 10 supported metrics
- [ ] **AC-3:** Threshold is configurable with a sensible default per metric
- [ ] **AC-4:** Auto-tracked habit card shows Apple Health icon badge
- [ ] **AC-5:** Habit auto-completes when HealthKit metric meets the threshold
- [ ] **AC-6:** Progress shows partial completion (e.g., "7,500 / 10,000 steps")
- [ ] **AC-7:** Auto-completed habit counts toward streak
- [ ] **AC-8:** Manual completion still works on auto-tracked habits
- [ ] **AC-9:** HealthKit permission is requested on first link creation
- [ ] **AC-10:** Android/web shows "Available on iOS" badge instead of auto-track toggle
- [ ] **AC-11:** Sync runs on Today tab load and completes within 500ms

### Technical Criteria
- [ ] **TC-1:** `syncHealthKitHabits` queries Health module for each linked metric and auto-records completions
- [ ] **TC-2:** HealthKit link is UNIQUE per habit (one link per habit)
- [ ] **TC-3:** Auto-completion records both a completion and a measurement with actual value
- [ ] **TC-4:** Sync checks for existing today-completion before creating duplicates
- [ ] **TC-5:** V3 migration creates hb_healthkit_links table
- [ ] **TC-6:** Bridge functions are testable with mock HealthKit data (no real device needed)
- [ ] **TC-7:** Platform detection correctly hides HealthKit features on non-iOS platforms

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Auto-sync must NOT create duplicate completions for the same day
- [ ] **NC-2:** Auto-sync must NOT retroactively complete past days
- [ ] **NC-3:** HealthKit must NOT be queried on Android or web (platform guard)
- [ ] **NC-4:** Denied HealthKit permission must NOT crash the app
- [ ] **NC-5:** Auto-tracked habits must NOT prevent manual completion

## UI Specification

### Mobile (Expo)

- Module accent: `#8B5CF6` (habits purple)
- HealthKit badge: Small red heart icon (Apple Health branding)
- Auto-completed status: Green checkmark with "Auto" label
- Progress: Purple progress bar inside the habit card

Auto-tracked habit card on Today tab:
```
[Habit Card: Walk 10,000 Steps]
  🏃 Walk 10,000 Steps           [❤️ HealthKit badge]
  [===========-------] 7,500 / 10,000 steps
  "75% - keep moving!"
```

Auto-completed card:
```
[Habit Card: Walk 10,000 Steps]
  🏃 Walk 10,000 Steps           [❤️ Auto ✓]
  [===================] 12,341 steps
  "Auto-tracked from Apple Health"
```

Add habit form with HealthKit toggle:
```
[New Habit]
  Name: [Walk 10,000 Steps]

  [Auto-track from Apple Health]    [toggle ON]

  Data source: [Steps ▾]
  Target: [10000] steps
  Comparison: [≥ (at least)]
```

### Web (Next.js)

- HealthKit toggle hidden
- Auto-tracked habits show "Tracked on iOS via Apple Health" informational badge
- All habit functionality still works manually on web

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton card while HealthKit syncs | Today tab opening |
| Not available (Android/Web) | Toggle hidden, "Available on iOS" badge | Non-iOS platform |
| Permission needed | "Enable Health access" prompt | First HealthKit link creation |
| Permission denied | "Go to Settings" guidance, link inactive | User denied permission |
| Syncing | Brief "Syncing health data..." indicator | Sync in progress |
| Partial progress | Progress bar with current / target | Metric below threshold |
| Auto-completed | Green check, "Auto-tracked" badge | Metric meets threshold |
| Manual override | Completed with regular checkmark | User manually completed |
| No data today | "Waiting for health data" | HealthKit returned 0 |

## Test Requirements

### Unit Tests
- [ ] `syncHealthKitHabits`: steps = 12000, threshold = 10000 -> auto-complete fires
- [ ] `syncHealthKitHabits`: steps = 8000, threshold = 10000 -> no completion, returns progress
- [ ] `syncHealthKitHabits`: already completed today -> no duplicate
- [ ] `syncHealthKitHabits`: resting HR = 65, threshold = 70, comparison lte -> auto-complete
- [ ] `checkThreshold`: value 10000, threshold 10000, comparison 'gte' -> true
- [ ] `checkThreshold`: value 9999, threshold 10000, comparison 'gte' -> false
- [ ] `checkThreshold`: value 65, threshold 70, comparison 'lte' -> true
- [ ] `getAutoTrackProgress`: steps 7500 of 10000 -> { current: 7500, target: 10000, percentage: 75 }
- [ ] Data source catalog: all 10 sources have valid defaults
- [ ] Platform guard: `isHealthKitAvailable()` returns false on non-iOS

### Integration Tests
- [ ] Full flow: create auto-tracked step habit -> mock HealthKit returns 12000 -> habit auto-completes -> streak increments
- [ ] Permission flow: create link -> deny permission -> link inactive -> grant permission -> sync works
- [ ] Manual override: auto-tracked habit + manual completion -> no duplicate on sync

### QA Verification Script

1. Open the app on **iOS device/simulator**
2. Navigate to MyHabits > Habits tab
3. Tap "Add Habit"
4. Verify: "Auto-track from Apple Health" toggle is visible -- AC-1
5. Enable the toggle
6. Verify: Data source picker shows steps, distance, etc. -- AC-2
7. Select "Steps", threshold 10000 -- AC-3
8. Save the habit
9. Verify: HealthKit permission prompt appears -- AC-9
10. Grant permission
11. Navigate to Today tab
12. Verify: Step habit shows Apple Health badge -- AC-4
13. Verify: Current step count from HealthKit shown as progress -- AC-6
14. Walk or use Health app to log 10000+ steps
15. Open MyHabits again
16. Verify: Habit auto-completed with green "Auto" badge -- AC-5
17. Verify: Streak incremented -- AC-7
18. Manually complete the habit
19. Verify: Still shows completed, no duplicate -- AC-8
20. Open the app on **web**
21. Verify: No HealthKit toggle, "Available on iOS" badge -- AC-10

## gstack Quality Gates

Based on Complexity score 1 (Complex):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required for Complex features (Complexity <= 1):
- [ ] `/office-hours` (builder mode) -- validate approach before spec finalization
- [ ] `/plan-eng-review` -- run on this spec BEFORE building

### Required if this feature has UI:
- [ ] `/browse` -- verify auto-tracked habit cards, HealthKit badges, progress bars

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Measurable habits exist with target values and measurements.
- Timed sessions and completions infrastructure is mature.
- No HealthKit integration in habits module.
- Health module HealthKit spec exists (Sprint 1, S-Tier) but may not be built yet.

### After This Work
- HealthKit-to-habit bridge: auto-sync, threshold checking, progress tracking.
- New table: `hb_healthkit_links`.
- Updated Add Habit form with HealthKit toggle (iOS only).
- Auto-completion from HealthKit data on Today tab load.
- Apple Health badges on auto-tracked habit cards.

### Files Changed
- `modules/habits/src/healthkit/bridge.ts` -- NEW: HealthKit sync engine
- `modules/habits/src/healthkit/data-sources.ts` -- NEW: Supported HealthKit metrics catalog
- `modules/habits/src/healthkit/__tests__/bridge.test.ts` -- NEW: Bridge tests with mock data
- `modules/habits/src/db/healthkit-links.ts` -- NEW: Link CRUD
- `modules/habits/src/db/schema.ts` -- MODIFY: Add hb_healthkit_links table
- `modules/habits/src/types.ts` -- MODIFY: Add HealthKitLink, DataSource schemas
- `modules/habits/src/definition.ts` -- MODIFY: V3 migration
- `modules/habits/src/index.ts` -- MODIFY: Export HealthKit bridge
- `apps/mobile/app/(habits)/add-habit.tsx` -- MODIFY: HealthKit toggle + data source picker
- `apps/mobile/app/(habits)/today.tsx` -- MODIFY: Auto-sync on load, progress bars, badges

### Known Limitations
- **iOS only.** Android Health Connect integration is a separate future feature.
- **No background sync.** Sync runs when user opens the Today tab. No background task.
- **No write-back to HealthKit.** This spec only reads from HealthKit. Writing habit completions back to Health is a future feature.
- **Depends on Health module HealthKit spec.** If that spec hasn't been built yet, this feature provides a mock interface that can be connected later.
- **No custom HealthKit data types.** Only the 10 predefined sources. Custom data types are a future enhancement.

### Context for Next Agent
- The Health module's HealthKit integration (Sprint 1 spec) establishes the HealthKit library and permission flow. This spec's bridge calls into the Health module's API to read data. If the Health module isn't built yet, create a `HealthKitDataProvider` interface that can be mocked for testing and swapped with the real implementation later.
- Use `Platform.OS === 'ios'` to guard all HealthKit code. The toggle, data source picker, and sync logic should all be wrapped in platform checks.
- The sync should be idempotent: calling it multiple times on the same day produces the same result (check for existing completion before creating).
- For measurements, record the actual value (e.g., 12,341 steps) in `hb_measurements` even though the threshold was 10,000. This gives accurate data for stats and charts.
- The data source catalog (`data-sources.ts`) should be a const array with: `{ id, label, healthKitIdentifier, defaultThreshold, unit, defaultComparison }`. This makes it easy to add new sources later.
- `expo-apple-healthkit` or `react-native-health` both work with Expo. Check which one the Health module spec chose and use the same library.
