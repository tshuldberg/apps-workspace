# Feature Spec: Wearable Sync

## Metadata
- **Module:** nutrition
- **Priority Score:** 34 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 4 x3 + Complexity 1 x2 + CrossModule 4 x1 + PaidUser 4 x1
- **Sprint:** 5
- **Estimated CC Time:** 5-6 hours
- **Depends On:** Health module HealthKit integration (data pipeline exists)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Wearable sync imports nutrition-relevant data from Apple Health (HealthKit) and surfaces calorie expenditure data alongside food intake. MyFitnessPal, Cronometer, and MacroFactor all sync with HealthKit to pull active calories burned, enabling accurate TDEE (Total Daily Energy Expenditure) calculation. Complexity is 1 (hard) because it requires building a bidirectional sync pipeline: reading active energy from HealthKit and optionally writing nutrition data back, plus calculating net calories (intake minus expenditure). This is the highest cross-module feature in nutrition (4/5) because it connects health, workouts, and nutrition data into a unified energy balance view.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| MyFitnessPal | Yes | Yes ($79.99/yr) | HealthKit sync for exercise calories, adjusts daily calorie goal |
| Cronometer | Yes | Yes ($49.99/yr) | Apple Health import/export, activity-adjusted energy targets |
| MacroFactor | Yes | Yes ($71.88/yr) | Algorithm-adjusted expenditure from weight trend, not just HealthKit |
| Lose It! | Yes | Yes ($39.99/yr) | HealthKit active energy import, exercise calorie credit |

### Target User
Users with Apple Watch or fitness trackers who want their exercise calories reflected in their nutrition goals. Power users who want accurate TDEE tracking and net calorie calculations (calories eaten minus calories burned). Users who already track workouts in MyWorkouts and want that energy expenditure visible in their nutrition dashboard.

## Technical Context

### Where This Lives in MyLife

```
modules/nutrition/src/sync/healthkit.ts        -- HealthKit nutrition sync adapter
modules/nutrition/src/sync/energy-balance.ts   -- TDEE and net calorie calculations
modules/nutrition/src/sync/types.ts            -- Sync types
modules/nutrition/src/db/schema.ts             -- New nu_energy_log table
modules/nutrition/src/index.ts                 -- Export sync functions
apps/mobile/app/(nutrition)/energy-balance.tsx -- Energy balance detail screen
apps/mobile/app/(nutrition)/sync-settings.tsx  -- Nutrition sync settings
```

### Wireframe Position

```
Hub Dashboard
  └── MyNutrition card
       └── Dashboard tab
            └── Energy Balance card ← YOU ARE HERE
                 ├── Calories In (from food log)
                 ├── Calories Out (from HealthKit/workouts)
                 ├── Net Calories
                 └── TDEE estimate
```

### Data Model

```sql
-- Stores daily energy expenditure data synced from HealthKit or calculated
CREATE TABLE IF NOT EXISTS nu_energy_log (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  basal_calories REAL NOT NULL DEFAULT 0,     -- BMR estimate or HealthKit basal
  active_calories REAL NOT NULL DEFAULT 0,    -- Active energy from HealthKit/workouts
  total_expenditure REAL NOT NULL DEFAULT 0,  -- TDEE = basal + active
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'healthkit', 'calculated')),
  synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS nu_energy_log_date_idx ON nu_energy_log(date);
```

User profile for BMR calculation is stored in nu_settings:
- `userWeightKg` (for Mifflin-St Jeor BMR)
- `userHeightCm`
- `userAge`
- `userSex` ('male' | 'female')
- `activityLevel` ('sedentary' | 'light' | 'moderate' | 'active' | 'very_active')
- `syncEnabled` ('true' | 'false')
- `syncDirection` ('read' | 'write' | 'both')

### Dependencies
- **Internal:** `@mylife/db`, nu_settings, nu_food_log + nu_food_log_items (calorie intake), health module HealthKit adapter
- **External:** expo-health (HealthKit access via health module's existing adapter), expo-sensors (pedometer for step-based estimation fallback)
- **Cross-Module:** Health module provides HealthKit data pipeline (hl_vitals stores active_energy and steps). Workouts module logs exercise sessions with calorie burn estimates. This feature reads from both to build a complete energy expenditure picture.

## Functional Requirements

### User Stories
1. As a user with an Apple Watch, I want my active calories burned to appear in my nutrition dashboard so I can see my net calorie balance.
2. As a user, I want my TDEE (total daily energy expenditure) estimated so I know how many calories I actually burn per day.
3. As a user, I want net calorie tracking (intake minus expenditure) so I can manage my caloric deficit or surplus.
4. As a user without a wearable, I want a BMR-based estimate so I can still see approximate energy expenditure.

### Behavior Specification

**Initial setup:**
1. User navigates to Nutrition Settings > Wearable Sync
2. System checks if Health module has HealthKit enabled
3. If HealthKit is available:
   - Toggle "Sync active calories from Apple Health" (default ON)
   - Toggle "Write nutrition data to Apple Health" (default OFF, opt-in)
   - Sync reads active_energy from hl_vitals for today
4. If HealthKit is NOT available:
   - Show manual BMR setup with user profile inputs (weight, height, age, sex, activity level)
   - System calculates BMR using Mifflin-St Jeor equation

**Energy Balance card (Dashboard tab):**
1. Shows three numbers:
   - **Calories In:** Total from today's food log (sum of nu_food_log_items)
   - **Calories Out:** Total expenditure (basal + active)
   - **Net:** In minus Out (negative = deficit, positive = surplus)
2. Visual: horizontal bar showing In (green) vs Out (red) with net difference
3. Tapping the card navigates to energy-balance detail screen

**Energy Balance detail screen:**
1. Shows daily breakdown:
   - Basal Metabolic Rate (from HealthKit or calculated)
   - Active calories (from HealthKit active_energy)
   - Exercise calories (from workouts module if available)
   - NEAT estimate (non-exercise activity thermogenesis, from steps)
2. 7-day chart showing calories in vs calories out with net line
3. Weekly average TDEE
4. Note: "TDEE estimates are approximate and vary by individual"

**BMR calculation (fallback when no HealthKit):**
1. Mifflin-St Jeor equation:
   - Male: (10 x weight_kg) + (6.25 x height_cm) - (5 x age) + 5
   - Female: (10 x weight_kg) + (6.25 x height_cm) - (5 x age) - 161
2. Activity multiplier:
   - Sedentary: BMR x 1.2
   - Light: BMR x 1.375
   - Moderate: BMR x 1.55
   - Active: BMR x 1.725
   - Very active: BMR x 1.9

**Write-back (optional):**
1. If enabled, writes today's calorie intake to HealthKit as dietary energy consumed
2. Uses the health module's HealthKit write adapter
3. Only writes when user explicitly enables this in settings

### Edge Cases

- **No HealthKit permission:** Fall back to calculated BMR. Show "Connect Apple Health for accurate data" prompt.
- **No user profile entered (for BMR):** Use population averages (70kg, 170cm, age 30, moderate activity) as defaults. Show "Update your profile for better estimates" banner.
- **No food logged today:** Calories In shows 0. Net shows negative (full expenditure as deficit).
- **No active calories from HealthKit:** Show basal only. Note "No activity data available."
- **Midnight rollover:** Energy log is per-date. Sync pulls today's data. Yesterday's data is finalized.
- **Multiple HealthKit sources (Apple Watch + Peloton):** HealthKit handles dedup internally. We read the aggregate.
- **HealthKit returns 0 active calories (early morning):** Display 0, don't show error. It's valid.
- **Very high active calories (>3000):** Allow. Some athletes burn this much. No cap.
- **Health module not enabled:** Fall back to calculated BMR. Cross-module queries return null gracefully.
- **Workouts module not enabled:** Exercise calories section hidden. Active calories from HealthKit still work.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Energy Balance card shows Calories In, Calories Out, and Net on Dashboard tab
- [ ] **AC-2:** Net calorie value is color-coded (green for deficit, red for surplus -- or user-configurable based on goal)
- [ ] **AC-3:** Detail screen shows BMR, active calories, and exercise breakdown
- [ ] **AC-4:** 7-day chart shows calories in vs out with net line
- [ ] **AC-5:** HealthKit sync toggle works in Nutrition Sync Settings
- [ ] **AC-6:** BMR calculated correctly when no HealthKit available
- [ ] **AC-7:** User profile (weight, height, age, sex) editable in settings
- [ ] **AC-8:** TDEE disclaimer displayed on detail screen
- [ ] **AC-9:** Write-back toggle writes dietary calories to HealthKit when enabled

### Technical Criteria
- [ ] **TC-1:** nu_energy_log table created by migration v4
- [ ] **TC-2:** Cross-module query reads hl_vitals active_energy safely (returns null if health module disabled)
- [ ] **TC-3:** Mifflin-St Jeor calculation matches expected values for test inputs
- [ ] **TC-4:** Net calories = sum(nu_food_log_items.calories for date) - nu_energy_log.total_expenditure
- [ ] **TC-5:** HealthKit data merged with existing energy log entries (upsert by date)
- [ ] **TC-6:** Sync runs on app foreground and when navigating to nutrition dashboard

### Negative Criteria
- [ ] **NC-1:** Must NOT write to HealthKit unless user explicitly enables write-back
- [ ] **NC-2:** Must NOT claim medical-grade accuracy for TDEE or BMR estimates
- [ ] **NC-3:** Must NOT block nutrition functionality if HealthKit is unavailable
- [ ] **NC-4:** Must NOT send any health data over the network

## UI Specification

### Mobile (Expo)
- **Energy Balance card:** Glass card with three columns: In (green `#30D158`), Out (red `#FF453A`), Net (white `#F0F0F5` or colored by value). Horizontal stacked bar below.
- **Detail screen:** Background `#0A0A0F`. Breakdown cards (BMR, active, exercise) in glass fill. 7-day chart with dual bars (green in, red out) and net line (white dashed).
- **Sync settings:** Glass toggle cards. Profile inputs with number keyboards. Activity level picker (segmented control).

### Web (Next.js)
- `/nutrition/energy` route. Same card layout, wider chart on desktop.
- Sync settings at `/nutrition/settings/sync`.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No data | "Set up energy tracking" CTA | No profile, no HealthKit |
| Calculated only | BMR-based estimate with "approximate" badge | No HealthKit, profile entered |
| HealthKit synced | Full active + basal data | HealthKit connected |
| No food logged | Calories In = 0, full deficit | Empty food log today |
| Goal met | Net at target (surplus/deficit per user goal) | Intake matches expenditure target |

## Test Requirements

### Unit Tests
- [ ] `calculateBMR`: male 80kg, 180cm, 30yo = 1780 kcal
- [ ] `calculateBMR`: female 60kg, 165cm, 25yo = 1369 kcal
- [ ] `applyActivityMultiplier`: sedentary on 1780 = 2136
- [ ] `applyActivityMultiplier`: active on 1780 = 3069
- [ ] `getNetCalories`: 2000 in, 2500 out = -500
- [ ] `getNetCalories`: 2500 in, 2000 out = +500
- [ ] `upsertEnergyLog`: creates new entry for date with no existing data
- [ ] `upsertEnergyLog`: updates existing entry for same date
- [ ] `getWeeklyEnergyBalance`: returns 7 days of in/out/net data
- [ ] `readActiveCaloriesFromHealth`: returns null when health module disabled

### Integration Tests
- [ ] Full flow: HealthKit sync -> energy log populated -> dashboard card shows balance
- [ ] Fallback flow: no HealthKit -> profile entered -> BMR calculated -> card shows estimate
- [ ] Cross-module flow: workouts exercise calories appear in energy breakdown

### QA Verification Script

1. Navigate to MyNutrition > Dashboard tab
2. Verify: Energy Balance card visible -- corresponds to AC-1
3. Tap the card
4. Verify: Detail screen shows BMR, active, exercise breakdown -- corresponds to AC-3
5. Verify: TDEE disclaimer visible -- corresponds to AC-8
6. Navigate to Settings > Wearable Sync
7. If HealthKit available: toggle sync ON
8. Verify: Active calories populate from HealthKit -- corresponds to AC-5
9. If no HealthKit: enter profile (75kg, 175cm, 28, male, moderate)
10. Verify: BMR shows ~1723 kcal, TDEE ~2670 kcal -- corresponds to AC-6
11. Verify: Profile editable -- corresponds to AC-7
12. Log some food (e.g., 800 cal breakfast)
13. Return to Dashboard
14. Verify: Calories In shows 800, Net recalculates -- corresponds to AC-1
15. Verify: Net color-coded -- corresponds to AC-2
16. Check 7-day chart
17. Verify: Chart shows in vs out data -- corresponds to AC-4
18. Enable write-back toggle
19. Verify: Dietary energy written to HealthKit -- corresponds to AC-9

## gstack Quality Gates

Based on Complexity 1 (Inverse), this feature is "Complex" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Required if Complexity <= 2:
- [ ] `/plan-eng-review` -- run on this spec BEFORE building

### Required if Complexity <= 1:
- [ ] `/office-hours` (builder mode) -- validate approach

### Post-merge:
- [ ] `/parity-check` -- skip (no standalone)

## Handoff State

### Before This Work
Nutrition module tracks food intake (calories in) but has no energy expenditure tracking, no HealthKit sync, and no net calorie balance view.

### After This Work
- Energy expenditure tracking via HealthKit active calories and calculated BMR
- Net calorie balance (intake minus expenditure)
- Energy balance card on Dashboard tab with detail drill-down
- 7-day energy balance chart
- BMR fallback via Mifflin-St Jeor equation
- Optional HealthKit write-back for dietary energy
- Cross-module reading from health (hl_vitals) and workouts

### Files Changed
- `modules/nutrition/src/sync/healthkit.ts` -- New: HealthKit nutrition sync adapter
- `modules/nutrition/src/sync/energy-balance.ts` -- New: TDEE and net calorie calculations
- `modules/nutrition/src/sync/types.ts` -- New: sync types
- `modules/nutrition/src/db/schema.ts` -- Extended: nu_energy_log table
- `modules/nutrition/src/db/migrations.ts` -- Extended: migration v4
- `modules/nutrition/src/definition.ts` -- Bump schemaVersion, add energy-balance screen
- `modules/nutrition/src/index.ts` -- Export sync functions
- `apps/mobile/app/(nutrition)/energy-balance.tsx` -- Energy balance detail
- `apps/mobile/app/(nutrition)/sync-settings.tsx` -- Sync settings UI

### Known Limitations
- No Android Health Connect support (iOS HealthKit only via expo-health)
- No real-time calorie burn streaming (reads aggregate on app foreground)
- BMR calculation uses Mifflin-St Jeor only (no Harris-Benedict or Katch-McArdle)
- No adaptive TDEE based on weight trend analysis (MacroFactor's key differentiator)
- NEAT estimation is rough (step-based approximation)

### Context for Next Agent
- Cross-module queries to hl_vitals must be wrapped in try/catch. The health module may not be enabled, and its tables may not exist. Check `sqlite_master` for table existence before querying.
- Active energy in hl_vitals uses `vital_type='active_energy'` with `unit='kcal'`. RHR is in `vital_type='resting_heart_rate'`.
- The energy log uses a UNIQUE index on date, so use INSERT OR REPLACE for daily upserts.
- BMR calculation requires user profile data in nu_settings. If any field is missing, use population defaults and show an "approximate" badge.
- The write-back feature uses the health module's HealthKit adapter. Do NOT build a separate HealthKit connection; reuse the health module's infrastructure.
- If water tracking integration is also in this migration (v4), coordinate the table creation in the same migration to avoid version conflicts.
