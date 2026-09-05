# Feature Spec: Blood Glucose Logging

## Metadata
- **Module:** meds
- **Priority Score:** 31 / 50 (A-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 4 x3 + Complexity 3 x2 + CrossModule 3 x1 + PaidUser 4 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (generic measurements CRUD already exists)
- **Blocks:** Insulin tracking (insulin doses correlate with glucose readings), HbA1c calculator (B-Tier, builds on glucose data)

## Business Context

### Why This Feature Exists
MySugr (Roche, ~$10M+/yr revenue) and CareClinic ($119.88/yr) both center on structured blood glucose logging as their core diabetes management feature. Finger-prick glucose monitoring is the daily reality for 37.3 million diabetics in the US. MyLife already has a generic `md_measurements` table that stores blood sugar as `type = 'blood_sugar'` with a flat `value TEXT` field, but this prevents meal context tagging ("was this fasting or post-meal?"), target range analysis ("am I in range?"), time-in-range calculations, and A1c estimation. Adding structured glucose logging with meal context, configurable target ranges, and pattern analysis transforms MyLife into a diabetes management companion that competes with dedicated apps.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| MySugr | Yes | Freemium ($59.99/yr) | Glucose logging with meal tags (before/after), target range indicators, time-in-range%, estimated A1c, pattern detection, photo meals. Gold standard. |
| CareClinic | Yes | Yes ($119.88/yr) | Glucose logging with context tags, trend charts, medication correlation, exportable reports. |
| Glucose Buddy | Yes | Freemium ($49.99/yr) | Glucose + food + insulin + activity logging. A1c estimation. Reminders. |
| Medisafe | Partial | Free | Basic glucose entry via health measurements. No meal context, no target analysis. |

### Target User
Diabetics (Type 1 and Type 2) who monitor blood glucose via finger prick or CGM. Specifically: MySugr/Glucose Buddy users who want glucose logging integrated with full medication management, mood tracking, and health correlation. Pre-diabetics monitoring glucose for early intervention. Migration path: MySugr user gets glucose logging + insulin tracking + medication adherence + symptom correlation in one app.

## Technical Context

### Where This Lives in MyLife

```
modules/meds/src/
  glucose/
    engine.ts                   -- NEW: Range analysis, time-in-range, pattern detection, A1c estimation
    __tests__/engine.test.ts    -- NEW: Engine tests
  db/
    glucose.ts                  -- NEW: Glucose reading CRUD
    schema.ts                   -- MODIFY: Add md_glucose_readings table
  models/
    glucose.ts                  -- NEW: Zod schemas for glucose readings
    index.ts                    -- MODIFY: Export glucose models
  definition.ts                 -- MODIFY: Add to V3 migration
  index.ts                      -- MODIFY: Export glucose engine + types
apps/mobile/app/(meds)/
  log-glucose.tsx               -- NEW: Glucose logging screen
  glucose-history.tsx           -- NEW: Glucose history + analytics
apps/web/app/meds/
  glucose/page.tsx              -- NEW: Web glucose dashboard
```

### Wireframe Position

```
Hub Dashboard
  └── MyMeds card
       ├── Today tab
       │    └── [Quick "Log Glucose" card / shortcut]
       │    └── [Current glucose status with range indicator]
       ├── History tab
       │    └── [Glucose History sub-section with charts]
       ├── Medications tab
       └── Settings tab
            └── [Glucose target range configuration]
```

### Data Model

```sql
-- Structured blood glucose readings with meal context
CREATE TABLE IF NOT EXISTS md_glucose_readings (
  id TEXT PRIMARY KEY,
  value REAL NOT NULL CHECK (value > 0 AND value <= 600),
  unit TEXT NOT NULL DEFAULT 'mg/dL' CHECK (unit IN ('mg/dL', 'mmol/L')),
  meal_context TEXT CHECK (meal_context IN (
    'fasting', 'before_meal', 'after_meal', 'bedtime', 'random', 'after_exercise'
  )),
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  in_range INTEGER NOT NULL DEFAULT 0 CHECK (in_range IN (0, 1)),
  range_status TEXT NOT NULL DEFAULT 'in_range'
    CHECK (range_status IN ('very_low', 'low', 'in_range', 'high', 'very_high')),
  notes TEXT,
  measured_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS md_glucose_readings_measured_idx ON md_glucose_readings(measured_at DESC);
CREATE INDEX IF NOT EXISTS md_glucose_readings_context_idx ON md_glucose_readings(meal_context);
CREATE INDEX IF NOT EXISTS md_glucose_readings_range_idx ON md_glucose_readings(range_status);
```

Default target ranges (ADA guidelines, configurable per user):
- **Very Low:** < 54 mg/dL (hypoglycemia, urgent)
- **Low:** 54-69 mg/dL (hypoglycemia)
- **In Range:** 70-180 mg/dL (standard target for most diabetics)
- **High:** 181-250 mg/dL (hyperglycemia)
- **Very High:** > 250 mg/dL (severe hyperglycemia)

Fasting glucose targets (different from post-meal):
- **Normal:** 70-100 mg/dL
- **Pre-diabetic:** 100-125 mg/dL
- **Diabetic:** >= 126 mg/dL

### Dependencies
- **Internal:** `@mylife/meds` (existing measurements system, medication tracking), `@mylife/db`
- **External:** None. All calculations are local math.
- **Cross-Module:** Health module (glucose data in wellness timeline). Nutrition module (carb intake correlated with post-meal glucose). Insulin tracking (glucose readings inform insulin dosing).

## Functional Requirements

### User Stories
1. As a diabetic, I want to log my blood glucose with meal context (fasting, before meal, after meal) so I can identify meal-related patterns.
2. As a user, I want to see whether my reading is in range, low, or high with color-coded feedback so I get instant clarity.
3. As a user, I want to see my Time in Range percentage so I can track my overall glucose control.
4. As a user, I want an estimated A1c based on my average glucose so I can predict my lab results.
5. As a user, I want to see glucose patterns by time of day and meal context so I can identify problem areas.
6. As a user, I want to switch between mg/dL and mmol/L so the app works in my preferred unit system.

### Behavior Specification

**Logging a glucose reading:**
1. User taps "Log Glucose" on the Today tab.
2. A logging screen appears with:
   a. Glucose value field (large numeric input, required). Shows current unit (mg/dL or mmol/L).
   b. As the user types, a range indicator badge appears:
      - Dark red: "Very Low" (< 54 mg/dL) with alert icon
      - Red: "Low" (54-69) with caution icon
      - Green: "In Range" (70-180) with check icon
      - Orange: "High" (181-250) with warning icon
      - Red: "Very High" (> 250) with alert icon
   c. Meal context selector (optional chips): Fasting | Before Meal | After Meal | Bedtime | Random | After Exercise.
   d. If "Before Meal" or "After Meal" selected, meal type appears: Breakfast | Lunch | Dinner | Snack.
   e. Notes field (optional free text).
   f. Time: defaults to now, adjustable.
3. User taps "Log". Reading saved to `md_glucose_readings` with auto-calculated `range_status` and `in_range`.
4. If reading is "Very Low" (< 54), show urgent alert: "Your glucose is very low. If you feel shaky, confused, or dizzy, consume fast-acting carbs (juice, glucose tabs) immediately."
5. If reading is "Very High" (> 250), show alert: "Your glucose is very high. Consider checking for ketones and contact your healthcare provider if this persists."

**Glucose history screen:**
1. User navigates to History > Glucose section.
2. Top: Summary card showing:
   - Latest reading with range badge and timestamp.
   - Time in Range (TIR): percentage of readings in 70-180 mg/dL over last 14 days.
   - Average glucose (last 14 days and last 30 days).
   - Estimated A1c: `(average_glucose_mg + 46.7) / 28.7` (ADAG formula).
   - Readings today: count and range breakdown.
3. Middle: Scatter plot or line chart showing all glucose readings over selected period (7d/14d/30d/90d).
   - Target range band (70-180) shown as green background zone.
   - Below 70 = red zone, above 180 = orange/red zone.
   - Points colored by meal context (fasting = blue, before meal = yellow, after meal = orange, bedtime = purple).
4. Below chart: Pattern analysis card:
   - Average fasting glucose (from fasting readings).
   - Average post-meal glucose (from after_meal readings).
   - Best time of day (lowest average glucose by hour).
   - Worst time of day (highest average glucose by hour).
5. Bottom: Scrollable list of all readings, newest first.
   - Each row: date/time, value with range badge, meal context tag.
   - Tap to edit or delete.

**Unit switching:**
- In Settings, user can toggle between mg/dL and mmol/L.
- Conversion: `mmol/L = mg/dL / 18.0182`.
- All display values convert. Stored values are always in the unit used at entry time (the `unit` column records which was used).
- Target ranges adjust accordingly.

**Settings (stored in `md_settings`):**
- `glucose_unit`: 'mg/dL' (default) or 'mmol/L'.
- `glucose_target_low`: lower bound of target range (default: 70 mg/dL).
- `glucose_target_high`: upper bound of target range (default: 180 mg/dL).
- `glucose_hypo_threshold`: below this is hypoglycemia (default: 70 mg/dL).
- `glucose_hypo_urgent_threshold`: urgent low (default: 54 mg/dL).
- `glucose_hyper_threshold`: above this is hyperglycemia (default: 250 mg/dL).

### Edge Cases

- **Value = 0 or negative:** Reject. Glucose must be > 0.
- **Extremely low (< 20 mg/dL):** Allow but show urgent alert. May be a meter error.
- **Extremely high (> 500 mg/dL):** Allow but show alert. May indicate DKA.
- **No meal context selected:** Treated as 'random'. Still included in TIR calculations but excluded from fasting/post-meal pattern analysis.
- **No readings yet:** History shows empty state: "Log your first glucose reading" with CTA.
- **Single reading:** Charts show single point. TIR = 100% or 0%. A1c estimate based on one reading (show disclaimer).
- **Mixed units:** If user switches from mg/dL to mmol/L mid-use, existing readings display converted but are stored in their original unit. New readings store in the new unit.
- **Old data migration:** Existing `md_measurements` rows with `type = 'blood_sugar'` can be offered for import. Parse the value string to extract the number.
- **Module disabled:** Data persists but UI hidden.
- **mmol/L target ranges:** When unit is mmol/L, default target range is 3.9-10.0 mmol/L (equivalent to 70-180 mg/dL).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Glucose logging screen shows large numeric input with current unit label
- [ ] **AC-2:** Range indicator badge updates in real-time as user types the value
- [ ] **AC-3:** Meal context chips are available (fasting, before meal, after meal, bedtime, random, after exercise)
- [ ] **AC-4:** Meal type selector (breakfast/lunch/dinner/snack) appears when before/after meal is selected
- [ ] **AC-5:** Very Low reading (< 54) shows urgent hypoglycemia alert
- [ ] **AC-6:** Very High reading (> 250) shows hyperglycemia alert
- [ ] **AC-7:** History shows Time in Range percentage
- [ ] **AC-8:** History shows estimated A1c
- [ ] **AC-9:** Chart shows readings with target range band and color-coded points by meal context
- [ ] **AC-10:** Pattern analysis shows average fasting vs post-meal glucose
- [ ] **AC-11:** Unit can be switched between mg/dL and mmol/L in settings
- [ ] **AC-12:** Reading list shows each entry with value, range badge, and meal context
- [ ] **AC-13:** User can edit or delete a reading
- [ ] **AC-14:** Feature works on both mobile and web

### Technical Criteria
- [ ] **TC-1:** `classifyGlucose(value, unit, targets)` returns correct range_status for all boundary values
- [ ] **TC-2:** `calculateTimeInRange(readings, targetLow, targetHigh)` returns correct TIR percentage
- [ ] **TC-3:** `estimateA1c(averageGlucoseMgDl)` returns correct A1c using ADAG formula
- [ ] **TC-4:** `convertGlucose(value, fromUnit, toUnit)` converts correctly between mg/dL and mmol/L
- [ ] **TC-5:** V3 migration creates `md_glucose_readings` table without affecting existing data
- [ ] **TC-6:** Readings store in the unit active at entry time, display converts to current setting
- [ ] **TC-7:** `analyzeGlucosePatterns(readings)` returns correct averages by meal context

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Hypoglycemia alert must NOT block saving the reading
- [ ] **NC-2:** Unit conversion must NOT lose precision (store original value, convert on display)
- [ ] **NC-3:** Changing unit setting must NOT modify stored reading values
- [ ] **NC-4:** Readings without meal context must NOT be excluded from TIR calculations

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token)
- Module accent: `#06B6D4` (meds cyan)
- Range badges:
  - Very Low: `#FF453A` (danger red) with pulse animation
  - Low: `#FF453A` (danger red)
  - In Range: `#30D158` (success green)
  - High: `#FF9F0A` (orange)
  - Very High: `#FF453A` (danger red) with pulse animation
- Chart target zone: `rgba(48, 209, 88, 0.15)` (faint green band)
- Meal context colors on chart: Fasting blue `#0A84FF`, Before meal `#FFD60A`, After meal `#FF9F0A`, Bedtime `#BF5AF2`

Logging screen layout:
```
[Log Blood Glucose]

  ┌────────────────────────┐
  │     [145]              │     [large numeric input]
  │     mg/dL              │     [unit label]
  └────────────────────────┘

  [In Range ✓]                    [range badge, real-time]

  Meal context:
  [Fasting] [Before Meal] [After Meal] [Bedtime] ...

  Meal: (Breakfast) (Lunch) (Dinner) (Snack)    [if before/after]

  [Notes...]                      [optional text]

  [Log Reading]                   [primary button, cyan]
```

Summary card on history:
```
[Glucose Overview]
  Latest: 145 mg/dL [In Range ✓]    2 min ago
  Time in Range: 72%                 [14-day]
  Average: 138 mg/dL                 [14-day]
  Est. A1c: 6.4%
  Today: 4 readings (3 in range, 1 high)
```

### Web (Next.js)

- Route: `/meds/glucose`
- Two-column layout: logging form (left), history + analytics (right)
- Charts use recharts with ADA target range background band
- Period selector: 7d / 14d / 30d / 90d tabs

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards and chart placeholder | Initial load |
| Empty | "Log your first glucose reading" + CTA | No readings |
| Logging | Full form with real-time range badge | User opens log screen |
| History | Charts + TIR + A1c + reading list | Readings exist |
| Urgent low | Red alert with hypoglycemia guidance | Value < 54 mg/dL |
| Urgent high | Red alert with hyperglycemia guidance | Value > 250 mg/dL |
| Error | "Could not save reading" + retry | Save failure |

## Test Requirements

### Unit Tests
- [ ] `classifyGlucose(53, 'mg/dL')` -> 'very_low'
- [ ] `classifyGlucose(54, 'mg/dL')` -> 'low'
- [ ] `classifyGlucose(69, 'mg/dL')` -> 'low'
- [ ] `classifyGlucose(70, 'mg/dL')` -> 'in_range'
- [ ] `classifyGlucose(180, 'mg/dL')` -> 'in_range'
- [ ] `classifyGlucose(181, 'mg/dL')` -> 'high'
- [ ] `classifyGlucose(250, 'mg/dL')` -> 'high'
- [ ] `classifyGlucose(251, 'mg/dL')` -> 'very_high'
- [ ] `classifyGlucose(10.0, 'mmol/L')` -> 'in_range' (= 180.2 mg/dL)
- [ ] `calculateTimeInRange`: 7 of 10 readings in range -> 70%
- [ ] `calculateTimeInRange`: 0 readings -> 0%
- [ ] `calculateTimeInRange`: all in range -> 100%
- [ ] `estimateA1c(154)` -> approximately 7.0% (ADAG: (154 + 46.7) / 28.7 = 6.99)
- [ ] `convertGlucose(180, 'mg/dL', 'mmol/L')` -> approximately 9.99
- [ ] `convertGlucose(10, 'mmol/L', 'mg/dL')` -> approximately 180.18
- [ ] `analyzeGlucosePatterns`: 3 fasting readings avg 95, 3 after_meal readings avg 165 -> correct breakdown
- [ ] `analyzeGlucosePatterns`: empty readings -> empty analysis

### Integration Tests
- [ ] Full flow: log glucose with meal context -> saved to md_glucose_readings -> appears in history with correct range badge
- [ ] TIR calculation: log 10 readings (7 in range, 3 high) -> TIR shows 70%
- [ ] A1c estimation: log 30 readings with average 154 -> estimated A1c shows ~7.0%
- [ ] Unit switch: log in mg/dL, switch to mmol/L -> existing readings display converted

### QA Verification Script

1. Open the app on [iOS / web]
2. Navigate to MyMeds
3. Tap "Log Glucose" on the Today tab
4. Verify: Large numeric input shown with unit label (mg/dL) -- AC-1
5. Type 145
6. Verify: "In Range" green badge appears -- AC-2
7. Verify: Meal context chips available -- AC-3
8. Select "After Meal"
9. Verify: Meal type selector appears (Breakfast/Lunch/Dinner/Snack) -- AC-4
10. Select "Lunch", tap "Log Reading"
11. Log another reading with value 50
12. Verify: "Very Low" red alert with hypoglycemia guidance -- AC-5
13. Log a reading with value 260
14. Verify: "Very High" alert with hyperglycemia guidance -- AC-6
15. Log 5 more readings with various values and contexts
16. Navigate to Glucose History
17. Verify: Time in Range percentage shown -- AC-7
18. Verify: Estimated A1c shown -- AC-8
19. Verify: Chart with target band and color-coded points -- AC-9
20. Verify: Pattern analysis with fasting vs post-meal averages -- AC-10
21. Navigate to Settings, switch to mmol/L -- AC-11
22. Return to History
23. Verify: Readings display in mmol/L
24. Verify: Reading list with values, badges, and context tags -- AC-12
25. Tap a reading and edit it -- AC-13
26. Verify on web -- AC-14

## gstack Quality Gates

Based on Complexity score 3 (Medium):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- log glucose readings, check range classification, verify charts and TIR

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- eval suite for glucose classification, TIR, and A1c estimation

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Generic `md_measurements` table stores blood sugar as `type = 'blood_sugar'` with a flat `value TEXT`.
- No meal context tagging.
- No target range classification.
- No Time in Range calculation.
- No A1c estimation.
- `getMeasurementTrend` returns unstructured value strings.

### After This Work
- Dedicated `md_glucose_readings` table with structured value, unit, meal context, and range status.
- Glucose classification engine with configurable target ranges.
- Time in Range calculation.
- Estimated A1c via ADAG formula.
- Pattern analysis (fasting vs post-meal averages, time-of-day trends).
- Logging screen with real-time range feedback.
- History screen with chart, TIR, A1c, and pattern analysis.
- Unit switching between mg/dL and mmol/L.

### Files Changed
- `modules/meds/src/glucose/engine.ts` -- NEW: Classification, TIR, A1c estimation, pattern analysis
- `modules/meds/src/glucose/__tests__/engine.test.ts` -- NEW: Engine tests
- `modules/meds/src/db/glucose.ts` -- NEW: Glucose reading CRUD
- `modules/meds/src/db/schema.ts` -- MODIFY: Add md_glucose_readings table
- `modules/meds/src/models/glucose.ts` -- NEW: Zod schemas for glucose readings
- `modules/meds/src/models/index.ts` -- MODIFY: Export glucose models
- `modules/meds/src/definition.ts` -- MODIFY: V3 migration
- `modules/meds/src/index.ts` -- MODIFY: Export glucose engine + types
- `apps/mobile/app/(meds)/log-glucose.tsx` -- NEW: Mobile glucose logging
- `apps/mobile/app/(meds)/glucose-history.tsx` -- NEW: Mobile glucose history
- `apps/web/app/meds/glucose/page.tsx` -- NEW: Web glucose dashboard

### Known Limitations
- **No CGM integration.** Dexcom/Libre auto-import is a separate feature (B-Tier). This feature is for manual finger-prick logging.
- **No meal photo logging.** MySugr lets users photo their meals for context. Future feature.
- **No carb input alongside glucose.** Carb tracking is a Nutrition module concern. Future cross-module integration.
- **Linear A1c estimation only.** Uses ADAG formula which assumes linear relationship. Real A1c depends on red blood cell turnover. Show "estimated" disclaimer.
- **No glucose prediction.** Feature is descriptive only, not predictive. No "your glucose will be X in 2 hours" forecasting.

### Context for Next Agent
- Range classification is a pure function: `classifyGlucose(value: number, unit: string, targets?: GlucoseTargets) -> RangeStatus`. Default targets follow ADA guidelines. Users can customize via settings.
- Time in Range: `calculateTimeInRange(readings: GlucoseReading[], targetLow: number, targetHigh: number) -> number`. Returns 0-100 percentage. Only counts readings where value >= targetLow AND value <= targetHigh.
- A1c estimation: `estimateA1c(averageGlucoseMgDl: number) -> number`. Formula: `(avg + 46.7) / 28.7`. Always compute in mg/dL internally, convert to mmol/L for display only.
- Unit conversion: `convertGlucose(value: number, from: 'mg/dL' | 'mmol/L', to: 'mg/dL' | 'mmol/L') -> number`. Factor: 18.0182.
- Stored values preserve their original unit (the `unit` column records which was used). Display logic converts to the user's current setting.
- The insulin tracking feature references glucose readings for auto-filling "blood glucose before" when logging insulin. Query: `SELECT * FROM md_glucose_readings WHERE measured_at >= datetime('now', '-30 minutes') ORDER BY measured_at DESC LIMIT 1`.
- The existing `md_measurements` type constraint includes `'blood_sugar'`. New glucose readings go to `md_glucose_readings` exclusively. A migration helper should offer optional import of old flat data.
