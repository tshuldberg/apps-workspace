# Feature Spec: Body Composition

## Metadata
- **Module:** health
- **Priority Score:** 32 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 2 x3 + Complexity 3 x2 + CrossModule 3 x1 + PaidUser 2 x1
- **Sprint:** 5
- **Estimated CC Time:** 3 hours
- **Depends On:** none (can use manual entry or HealthKit)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Body composition tracking (weight, body fat %, lean mass, BMI) goes beyond a simple scale number. Google Fit, Withings, and fitness apps all offer this. Users with smart scales (Withings, Renpho, Eufy) have this data in HealthKit but no unified health view. Weight alone is misleading; body composition tells the real story. Integrating this with workout and nutrition modules creates a complete picture.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Google Fit | Yes | Free | Weight and body fat tracking with goals |
| Apple Health | Yes | Free | Body measurements via HealthKit, no analysis |
| Withings | Yes | Yes ($99.95/yr) | Smart scale sync, body composition trends |
| MyFitnessPal | Yes | Partial ($79.99/yr) | Weight log with goal tracking |

### Target User
Users tracking body weight who want to understand body composition changes over time, not just scale weight. Gym-goers who want to see lean mass increasing while body fat decreases. Users with smart scales who want the data unified in MyLife.

## Technical Context

### Where This Lives in MyLife

```
modules/health/src/body/engine.ts           -- BMI calculation, body composition analysis
modules/health/src/body/types.ts            -- Body measurement types
modules/health/src/body/crud.ts             -- Measurement persistence
modules/health/src/db/schema.ts             -- New hl_body_measurements table
modules/health/src/index.ts                 -- Export body composition functions
apps/mobile/app/(health)/body.tsx           -- Body composition screen
```

### Wireframe Position

```
Hub Dashboard
  └── MyHealth card
       └── Vitals tab
            └── Body section
                 └── Body Composition ← YOU ARE HERE
                      ├── Weight chart with trend line
                      ├── Body fat % (if available)
                      ├── BMI with category
                      └── Measurement history
```

### Data Model

```sql
CREATE TABLE IF NOT EXISTS hl_body_measurements (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  weight_kg REAL,
  body_fat_percent REAL,
  lean_mass_kg REAL,
  bmi REAL,
  waist_cm REAL,
  hip_cm REAL,
  chest_cm REAL,
  height_cm REAL,                      -- Stored once, reused for BMI
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS hl_body_date_idx ON hl_body_measurements(date DESC);
```

### Dependencies
- **Internal:** `@mylife/db`, hl_settings (unit preferences: lbs/kg, ft/cm), HealthKit (weight, body fat from smart scale)
- **External:** None
- **Cross-Module:** Workouts module tracks body weight for progressive overload. Nutrition module uses weight for TDEE. Fast module has weight tracking (could share data).

## Functional Requirements

### User Stories
1. As a user, I want to log my weight and body measurements so I can track changes over time.
2. As a user, I want to see my weight trend (7-day moving average) so daily fluctuations don't mislead me.
3. As a user, I want BMI calculated automatically from my height and weight.
4. As a user with a smart scale, I want body fat % and lean mass imported automatically.

### Behavior Specification

**Logging a measurement:**
1. User navigates to Vitals > Body or taps "Log Weight" quick action
2. Input form shows:
   - Weight (required): numeric with unit toggle (lbs/kg)
   - Body fat % (optional): numeric 1-60%
   - Waist/hip/chest (optional): numeric with unit toggle (in/cm)
3. User enters values and saves
4. BMI auto-calculated from weight + stored height (prompted if height not set)
5. Lean mass derived: weight * (1 - body_fat_percent/100)

**Weight chart:**
1. Line chart showing daily weight with 7-day moving average trend line
2. Period selectors: 1 week, 1 month, 3 months, 6 months, 1 year
3. Trend line smooths daily fluctuations

**Body composition view:**
1. If body fat data available:
   - Body fat % with category (Essential: <14%, Athletic: 14-20%, Fit: 21-24%, Acceptable: 25-31%, High: >31% -- for women; adjust for men)
   - Lean mass trend
   - Fat mass vs lean mass stacked area chart
2. BMI display with WHO category (Underweight <18.5, Normal 18.5-24.9, Overweight 25-29.9, Obese 30+)

**Height setup (one-time):**
1. On first weight log, prompt for height if not set
2. Height stored in hl_body_measurements (reused for all BMI calculations)
3. Editable in settings

### Edge Cases

- **No height entered:** BMI shows "Enter height to calculate BMI" instead of a number.
- **Weight in different units between entries:** Convert all to kg for storage, display in user's preferred unit.
- **Smart scale body fat + manual weight on same day:** Merge into single entry (latest values win).
- **Very low body fat (<5%):** Allow but show warning "This is below essential body fat levels."
- **Very high weight:** No cap. Display correctly.
- **HealthKit weight sync:** Treated same as manual entry but with source='apple_health'.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Weight can be logged with unit toggle (lbs/kg)
- [ ] **AC-2:** BMI auto-calculates from weight and height
- [ ] **AC-3:** Weight chart shows daily values with 7-day trend line
- [ ] **AC-4:** Body fat % and lean mass display when available
- [ ] **AC-5:** BMI category label shown (Normal, Overweight, etc.)
- [ ] **AC-6:** Period selectors change chart range
- [ ] **AC-7:** Height is prompted on first use and editable later

### Technical Criteria
- [ ] **TC-1:** hl_body_measurements table created by migration
- [ ] **TC-2:** BMI formula: weight_kg / (height_m^2) is correct
- [ ] **TC-3:** 7-day moving average calculation is correct
- [ ] **TC-4:** Unit conversion (lbs<->kg, in<->cm) is accurate
- [ ] **TC-5:** Lean mass: weight * (1 - body_fat/100) calculated correctly
- [ ] **TC-6:** All weights stored in kg regardless of display unit

### Negative Criteria
- [ ] **NC-1:** BMI and body fat categories must NOT be presented as medical diagnoses
- [ ] **NC-2:** Must NOT impose unhealthy weight targets
- [ ] **NC-3:** Body composition data must NOT be sent over network

## UI Specification

### Mobile (Expo)
- **Weight chart:** Line chart in `#10B981`, trend line dashed. Glass card background.
- **Body fat section:** Horizontal bar showing fat mass (red-orange) vs lean mass (green). Percentages labeled.
- **BMI badge:** Colored badge (green normal, yellow overweight, red obese).
- **Input form:** Glass cards with numeric inputs. Unit toggle in accent color.

### Web (Next.js)
- `/health/body` route. Responsive chart. Same input form.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No data | "Log your first weight" CTA | No measurements |
| Height needed | Height prompt before BMI | Weight logged, no height |
| Weight only | Weight chart + BMI, no body fat section | No body fat data |
| Full | Weight + body fat + lean mass + BMI | Complete data |
| Trend | Multi-month chart with period selectors | 7+ days of data |

## Test Requirements

### Unit Tests
- [ ] `calculateBmi`: 70kg, 1.75m = 22.9
- [ ] `calculateBmi`: returns null when height missing
- [ ] `getBmiCategory`: 22 = 'normal'
- [ ] `getBmiCategory`: 27 = 'overweight'
- [ ] `calculateLeanMass`: 80kg, 20% fat = 64kg lean
- [ ] `convertLbsToKg`: 150 lbs = 68.04 kg
- [ ] `calculateMovingAverage`: 7-day window correct
- [ ] `logBodyMeasurement`: stores all fields correctly
- [ ] `getWeightHistory`: returns in date order

### Integration Tests
- [ ] Full flow: log weight + height -> BMI calculated -> chart shows data point
- [ ] Trend flow: 7 days of weight -> trend line visible -> period selector works

### QA Verification Script

1. Navigate to MyHealth > Vitals > Body
2. Tap "Log Weight"
3. Enter 160 lbs
4. Verify: Prompted for height -- corresponds to AC-7
5. Enter 5'10"
6. Verify: BMI calculates to ~23.0 -- corresponds to AC-2
7. Verify: BMI shows "Normal" badge -- corresponds to AC-5
8. Log body fat as 18%
9. Verify: Body fat and lean mass display -- corresponds to AC-4
10. Switch unit to kg
11. Verify: Weight displays in kg -- corresponds to AC-1
12. Log weights for 7 days
13. Verify: Chart shows points with trend line -- corresponds to AC-3
14. Tap period selectors
15. Verify: Chart range changes -- corresponds to AC-6

## gstack Quality Gates

Based on Complexity 3 (Inverse), this feature is "Medium" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- BMI and moving average calculations

### Post-merge:
- [ ] `/parity-check` -- skip (no standalone)

## Handoff State

### Before This Work
Health module has no dedicated body composition tracking. Weight can be logged as a vital (hl_vitals vital_type could include weight) but there's no BMI, body fat, or trend analysis.

### After This Work
- Dedicated body measurement table with weight, body fat, lean mass, BMI, circumferences
- BMI auto-calculation with health category
- Weight chart with 7-day moving average trend
- Body composition breakdown (fat vs lean mass)
- Unit conversion for lbs/kg and in/cm

### Files Changed
- `modules/health/src/body/engine.ts` -- BMI, lean mass, moving average
- `modules/health/src/body/types.ts` -- Types
- `modules/health/src/body/crud.ts` -- CRUD
- `modules/health/src/db/schema.ts` -- hl_body_measurements
- `modules/health/src/definition.ts` -- Migration bump
- `modules/health/src/index.ts` -- Exports
- `apps/mobile/app/(health)/body.tsx` -- Body composition UI

### Known Limitations
- No body fat estimation from measurements (Navy method could be added later)
- No progress photos (separate feature)
- No smart scale Bluetooth pairing (uses HealthKit only)
- No target weight/body fat goal system (use health goals for that)

### Context for Next Agent
- Store all weights in kg internally. Convert to lbs for display when user preference is 'lbs' (from hl_settings units.weight).
- The Fast module already has weight tracking. Consider whether body composition data should be shared or kept separate. For now, keep them separate; the body composition table is more detailed.
- BMI is weight_kg / (height_m * height_m). Height should be stored in cm and converted to meters for calculation.
- Body fat category ranges differ by sex. Consider adding a sex field to hl_body_measurements or hl_settings for accurate categorization, or use unisex ranges.
