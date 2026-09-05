# Feature Spec: Water Tracking Integration

## Metadata
- **Module:** nutrition
- **Priority Score:** 35 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 3 x3 + Complexity 4 x2 + CrossModule 3 x1 + PaidUser 3 x1
- **Sprint:** 5
- **Estimated CC Time:** 2-3 hours
- **Depends On:** none (uses existing nu_settings)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Water tracking is a standard feature in every major nutrition app and a top-requested user feature for calorie counters. MyFitnessPal, Cronometer, and Lose It! all include it. Complexity is 4 (easy) because it's a simple quantity logger with daily goals and a visual progress indicator. Water intake integrates with the nutrition dashboard to give a complete picture of daily intake, and can cross-reference with health module hydration data.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| MyFitnessPal | Yes | Free (basic), Premium for reminders | Quick-add cups/ml, daily goal, reminders |
| Cronometer | Yes | Free | Water logged as a nutrient, tracked against RDA |
| Lose It! | Yes | Free | Water tracker with daily goal and history chart |
| MacroFactor | No | N/A | No dedicated water tracking |

### Target User
Users who track macros and want water intake alongside their food diary. Health-conscious users who want hydration reminders and daily water goals integrated into their nutrition dashboard rather than a separate app.

## Technical Context

### Where This Lives in MyLife

```
modules/nutrition/src/water/types.ts         -- Water tracking types
modules/nutrition/src/water/crud.ts          -- Water entry CRUD
modules/nutrition/src/water/goals.ts         -- Water goal calculation
modules/nutrition/src/db/schema.ts           -- New nu_water_log table
modules/nutrition/src/index.ts               -- Export water functions
apps/mobile/app/(nutrition)/water.tsx        -- Water tracking screen
```

### Wireframe Position

```
Hub Dashboard
  └── MyNutrition card
       └── Diary tab
            └── Water section (above meals) ← YOU ARE HERE
                 ├── Daily progress ring
                 ├── Quick-add buttons (cup/bottle/custom)
                 ├── Today's entries
                 └── Weekly trend chart
```

### Data Model

```sql
CREATE TABLE IF NOT EXISTS nu_water_log (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  amount_ml REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'quick_add', 'healthkit')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS nu_water_log_date_idx ON nu_water_log(date);
```

Water goal is stored in `nu_settings` with key `waterGoalMl` (default: '2500', stored as string, parsed to number). Container presets are also stored in settings: `waterContainersMl` (JSON array, default: '[250, 500, 750]').

### Dependencies
- **Internal:** `@mylife/db`, nu_settings (water goal, container presets)
- **External:** None. Optional: expo-notifications for reminders (future enhancement).
- **Cross-Module:** Health module's wellness timeline can display water intake. Health readiness score could factor hydration. HealthKit sync can import water data from Apple Health.

## Functional Requirements

### User Stories
1. As a user tracking my nutrition, I want to log water intake alongside my food so I can see my full daily intake picture.
2. As a user, I want quick-add buttons for common container sizes so logging is fast and frictionless.
3. As a user, I want a daily water goal with a visual progress indicator so I can tell at a glance if I'm hydrated.
4. As a user, I want to see my water intake trend over the past 7 days.

### Behavior Specification

**Water section on Diary tab:**
1. At the top of the Diary tab (above meal entries), a water progress ring shows current intake vs goal.
2. Inside the ring: current amount (e.g., "1.5 L") and goal (e.g., "/ 2.5 L").
3. Below the ring: quick-add buttons for preset container sizes (default: 250ml cup, 500ml bottle, 750ml large bottle).
4. Tapping a quick-add button immediately creates a water log entry and animates the progress ring.

**Custom water entry:**
1. User taps "+" or "Custom" below the quick-add buttons.
2. A number input appears for entering a specific amount in ml or oz (based on unit preference setting).
3. User confirms and the entry is logged.

**Water log list:**
1. Below the quick-add buttons, a list shows today's water entries with times and amounts.
2. Each entry has a swipe-to-delete action.

**Settings:**
1. In Nutrition Settings tab, a "Water" section allows:
   - Setting daily water goal (ml or oz)
   - Customizing container presets (add/remove/edit sizes)
   - Unit preference: ml or oz

**Weekly trend:**
1. In the Trends tab, a bar chart shows daily water intake for the past 7 days with the goal line overlaid.

### Edge Cases

- **No water logged today:** Show empty state with "Stay hydrated!" message and goal amount.
- **Exceeding goal:** Allow. Progress ring fills to 100% and shows overflow amount. No cap.
- **Zero goal:** Prevent. Minimum 500ml (17oz).
- **Unit conversion:** 1 oz = 29.5735 ml. Store always in ml, display in user's preferred unit.
- **Very large entry (>5000ml):** Allow but show confirmation: "Log 5L of water?"
- **Deleting the only entry:** Return to empty state.
- **Multiple entries at same time:** All logged independently.
- **HealthKit water data (future):** Source field supports 'healthkit' for when wearable sync imports water.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Water progress ring shows on Diary tab with current intake and goal
- [ ] **AC-2:** Quick-add buttons for preset container sizes work with one tap
- [ ] **AC-3:** Progress ring animates when water is added
- [ ] **AC-4:** Custom amount entry accepts ml or oz based on unit preference
- [ ] **AC-5:** Today's water entries listed with time and amount
- [ ] **AC-6:** Swipe-to-delete removes a water entry and updates the progress ring
- [ ] **AC-7:** Water goal adjustable in Settings
- [ ] **AC-8:** Container presets customizable in Settings
- [ ] **AC-9:** 7-day water trend bar chart visible in Trends tab

### Technical Criteria
- [ ] **TC-1:** nu_water_log table created by migration v4
- [ ] **TC-2:** Water entries stored in ml regardless of display unit
- [ ] **TC-3:** Daily total query aggregates all entries for a given date correctly
- [ ] **TC-4:** Settings for waterGoalMl and waterContainersMl stored and retrieved correctly
- [ ] **TC-5:** Deleting an entry updates the daily total immediately

### Negative Criteria
- [ ] **NC-1:** Water tracking must NOT replace or interfere with food logging
- [ ] **NC-2:** Water entries must NOT count toward calorie totals
- [ ] **NC-3:** Must NOT require network access

## UI Specification

### Mobile (Expo)
- **Progress ring:** 120px diameter. Fill color: `#3B82F6` (water blue). Track: `rgba(255,255,255,0.06)`. Text inside: current/goal in `#F0F0F5`.
- **Quick-add buttons:** Row of glass cards (`rgba(255,255,255,0.04)`) with amount labels. Module accent `#F97316` for selected state.
- **Entry list:** Glass cards with time (secondary text `rgba(240,240,245,0.65)`) and amount. Swipe-to-delete reveals `#FF453A` danger background.
- **Trend chart:** Bar chart with bars in `#3B82F6`. Goal line dashed `rgba(240,240,245,0.65)`. Background `#0A0A0F`.

### Web (Next.js)
- `/nutrition/water` route. Same progress ring and quick-add layout.
- Trend chart wider on desktop with 7-day bars.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Empty | Progress ring at 0%, "Stay hydrated!" | No entries today |
| Partial | Ring partially filled, entry list | Some water logged |
| Goal met | Ring at 100%, green checkmark | Intake >= goal |
| Over goal | Ring at 100% + overflow text | Intake > goal |
| Settings | Goal and container editor | Settings tab |

## Test Requirements

### Unit Tests
- [ ] `createWaterEntry`: stores amount_ml, date, source
- [ ] `getWaterEntriesForDate`: returns all entries for a given date
- [ ] `getDailyWaterTotal`: sums amount_ml correctly
- [ ] `getDailyWaterTotal`: returns 0 for date with no entries
- [ ] `deleteWaterEntry`: removes entry and total recalculates
- [ ] `convertMlToOz`: 250ml = ~8.45oz
- [ ] `convertOzToMl`: 8oz = ~236.59ml
- [ ] `getWeeklyWaterTotals`: returns 7 daily totals for the past week

### Integration Tests
- [ ] Full flow: quick-add water -> total updates -> progress ring reflects new total
- [ ] Settings flow: change goal from 2500ml to 3000ml -> progress percentage recalculates

### QA Verification Script

1. Navigate to MyNutrition > Diary tab
2. Verify: Water progress ring visible at top, showing 0/2.5L -- corresponds to AC-1
3. Tap "250ml" quick-add button
4. Verify: Ring animates to ~10%, entry appears in list -- corresponds to AC-2, AC-3
5. Tap "500ml" quick-add button
6. Verify: Ring updates to ~30%, two entries in list -- corresponds to AC-5
7. Tap "Custom" and enter 1000ml
8. Verify: Entry added -- corresponds to AC-4
9. Swipe-delete the 250ml entry
10. Verify: Entry removed, ring recalculates -- corresponds to AC-6
11. Navigate to Settings > Water
12. Change goal to 1500ml
13. Verify: Ring percentage recalculates -- corresponds to AC-7
14. Add a custom container size (350ml)
15. Verify: New quick-add button appears -- corresponds to AC-8
16. Navigate to Trends tab
17. Verify: 7-day water chart visible -- corresponds to AC-9

## gstack Quality Gates

Based on Complexity 4 (Inverse), this feature is "Small" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Post-merge:
- [ ] `/parity-check` -- skip (no standalone)

## Handoff State

### Before This Work
Nutrition module tracks food with macros, goals, barcode scanning, and AI photo logging but has no water/hydration tracking.

### After This Work
- Water log table with CRUD operations
- Quick-add buttons for preset container sizes
- Daily progress ring on Diary tab
- Weekly water trend chart on Trends tab
- Settings for goal and container customization
- Unit conversion (ml/oz)

### Files Changed
- `modules/nutrition/src/water/types.ts` -- New: water tracking types
- `modules/nutrition/src/water/crud.ts` -- New: water entry CRUD
- `modules/nutrition/src/water/goals.ts` -- New: goal progress and weekly trends
- `modules/nutrition/src/db/schema.ts` -- Extended: nu_water_log table
- `modules/nutrition/src/db/migrations.ts` -- Extended: migration v4
- `modules/nutrition/src/definition.ts` -- Bump schemaVersion to 4
- `modules/nutrition/src/index.ts` -- Export water functions
- `apps/mobile/app/(nutrition)/water.tsx` -- Water tracking screen/section

### Known Limitations
- No hydration reminders (requires expo-notifications, future enhancement)
- No smart goal adjustment based on activity/weather
- No integration with HealthKit water data yet (source field supports it for future)
- No caffeine/alcohol tracking (water only)

### Context for Next Agent
- Water amounts are always stored in ml in the database. Display conversion to oz uses 1 oz = 29.5735 ml.
- The progress ring is a section within the Diary tab, not a separate screen. Place it above the meal entries.
- Container presets are stored as a JSON array string in nu_settings with key 'waterContainersMl'. Parse with JSON.parse().
- Default goal is 2500ml (~84oz). Store as string in nu_settings with key 'waterGoalMl'.
- The `source` column differentiates manual entries from quick-adds for analytics. Both are user-initiated but quick-adds can be analyzed separately to understand usage patterns.
