# Feature Spec: Temperature Tracking

## Metadata
- **Module:** cycle
- **Priority Score:** 43 / 50 (S-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 4 x3 + Complexity 4 x2 + CrossModule 3 x1 + PaidUser 5 x1
- **Sprint:** 5
- **Estimated CC Time:** 2-3 hours
- **Depends On:** none (builds on existing cy_ schema)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Basal body temperature (BBT) tracking is the #1 ranked feature across all MyLife modules by priority score. Natural Cycles charges $89.99/yr for temperature-based cycle tracking alone, making it the highest-value single feature in the cycle space. BBT data dramatically improves prediction accuracy by confirming ovulation (temperature spike of 0.2-0.5 F after ovulation) rather than relying solely on cycle length averages. Users who track temperature get clinically-useful fertility awareness instead of statistical guesses.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Natural Cycles | Yes | Yes ($89.99/yr) | FDA-cleared contraception method, requires their thermometer or Oura ring, proprietary algorithm |
| Clue | Yes | Yes ($39.99/yr) | Manual BBT entry, chart overlay on cycle view, no hardware requirement |
| Flo | Yes | Yes ($49.99/yr) | Manual BBT entry in daily log, temperature chart in insights, 440M registered users |
| Ovia | Yes | No (free) | Basic BBT chart, fertility-focused, week-by-week pregnancy guides |

### Target User
Women and people who menstruate who want fertility awareness without paying $90/yr to Natural Cycles or $50/yr to Flo. Specifically targets users who already own a basal thermometer (or smart wearable) and want a private, offline-first way to track temperature alongside their existing cycle data. Secondary audience: users trying to conceive who want the fertile window confirmed by temperature shift rather than estimated by averages.

## Technical Context

### Where This Lives in MyLife

```
modules/cycle/src/types.ts              -- New Zod schemas for temperature data
modules/cycle/src/db/schema.ts          -- New cy_temperatures table DDL
modules/cycle/src/db/crud.ts            -- Temperature CRUD functions
modules/cycle/src/engine/temperature.ts -- BBT analysis: shift detection, coverline calculation
modules/cycle/src/definition.ts         -- Migration version 2
modules/cycle/src/index.ts              -- Export new functions and types
apps/mobile/app/(cycle)/log-day.tsx     -- Temperature input on daily log screen
apps/mobile/app/(cycle)/insights.tsx    -- Temperature chart overlay
apps/web/app/cycle/                     -- Web equivalent screens (when wired)
```

### Wireframe Position

```
Hub Dashboard
  └── MyCycle card
       └── Today tab
            └── Log Day screen
                 └── Temperature section ← YOU ARE HERE (input)
       └── Insights tab
            └── Temperature chart ← YOU ARE HERE (visualization)
       └── Calendar tab
            └── Day cells show temp dot indicator
```

### Data Model

```sql
-- Migration version 2: Temperature tracking
CREATE TABLE IF NOT EXISTS cy_temperatures (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  cycle_day_id TEXT REFERENCES cy_cycle_days(id) ON DELETE SET NULL,
  value_celsius REAL NOT NULL,
  time_taken TEXT,             -- HH:MM format, optional
  method TEXT NOT NULL DEFAULT 'oral',  -- oral | vaginal | skin_wearable
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS cy_temps_date_idx ON cy_temperatures(date DESC);
CREATE INDEX IF NOT EXISTS cy_temps_cycle_day_idx ON cy_temperatures(cycle_day_id);
```

**New Zod schemas:**

```typescript
export const TemperatureMethodSchema = z.enum(['oral', 'vaginal', 'skin_wearable']);
export type TemperatureMethod = z.infer<typeof TemperatureMethodSchema>;

export const TemperatureSchema = z.object({
  id: z.string(),
  date: z.string(),
  cycleDayId: z.string().nullable(),
  valueCelsius: z.number(),
  timeTaken: z.string().nullable(),
  method: TemperatureMethodSchema,
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Temperature = z.infer<typeof TemperatureSchema>;

export const CreateTemperatureInputSchema = z.object({
  date: z.string(),
  valueCelsius: z.number().min(35.0).max(42.0),
  timeTaken: z.string().optional(),
  method: TemperatureMethodSchema.default('oral'),
  notes: z.string().optional(),
});
export type CreateTemperatureInput = z.infer<typeof CreateTemperatureInputSchema>;

export const TemperatureUnitSchema = z.enum(['celsius', 'fahrenheit']);
export type TemperatureUnit = z.infer<typeof TemperatureUnitSchema>;
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for CRUD), existing `cy_cycle_days` table (FK link)
- **External:** None. All data entered manually or via future HealthKit integration (separate feature).
- **Cross-Module:** Health module could consume temperature data via cross-module query for wellness timeline. Prediction engine already has fertile window estimation; temperature data confirms ovulation and can improve confidence scores.

## Functional Requirements

### User Stories
1. As a cycle tracker, I want to log my basal body temperature each morning so that I can confirm ovulation and understand my cycle phases.
2. As a fertility-aware user, I want to see my temperature chart overlaid on my cycle timeline so that I can visually identify the post-ovulation temperature shift.
3. As a user who tracks in Fahrenheit, I want to toggle between Celsius and Fahrenheit display so that I see temperatures in my preferred unit.
4. As a user, I want the system to calculate my coverline (baseline temperature) and detect temperature shifts so that I don't have to interpret raw numbers.

### Behavior Specification

**Logging temperature:**
1. User opens MyCycle and navigates to Today tab or taps "Log Day"
2. Below the flow/symptoms section, a "Temperature" card appears
3. User taps the temperature field and enters a value (e.g., 97.6 F or 36.4 C)
4. User optionally selects measurement time (defaults to blank) and method (defaults to oral)
5. User taps Save
6. System stores value in cy_temperatures with automatic conversion to Celsius for storage
7. If a cy_cycle_day record exists for that date, the temperature is linked via cycle_day_id
8. If no cy_cycle_day exists, one is created automatically (no flow/symptoms, just the temperature link)

**Viewing temperature chart:**
1. User navigates to Insights tab
2. A temperature line chart appears showing the last 2-3 cycles of temperature data
3. The chart includes:
   - Temperature dots connected by lines
   - Coverline (horizontal dashed line at the calculated baseline)
   - Cycle phase background colors (menstrual=red, follicular=blue, ovulation=green, luteal=yellow, all at low opacity)
   - Vertical cycle boundary markers
4. User can scroll horizontally to see older data
5. Tapping a data point shows the exact value, time, and method in a tooltip

**Temperature shift detection:**
1. After at least 6 temperature readings in a cycle, the engine calculates the coverline
2. Coverline = average of the 6 lowest temperatures in the follicular phase
3. When 3 consecutive readings are 0.2+ F (0.1+ C) above the coverline, a "shift detected" indicator appears
4. Shift confirmation is shown on the Insights chart as a highlighted zone
5. Detection result feeds back into prediction confidence (higher confidence when shift matches expected ovulation window)

**Unit toggle:**
1. In MyCycle Settings tab, user can toggle between Celsius and Fahrenheit
2. All display values convert accordingly; storage always uses Celsius
3. Preference is stored in the existing module settings pattern (or a new cy_settings row)

### Edge Cases

- **No temperature for today:** Temperature card shows empty state with "Log temp" prompt. No error.
- **Temperature outside valid range:** Values below 35.0 C (95.0 F) or above 42.0 C (107.6 F) are rejected with inline validation error: "Temperature out of expected range."
- **Duplicate date entry:** UNIQUE constraint on date. If the user logs again for the same date, the existing record is updated (upsert behavior).
- **No cycle_day exists for date:** A minimal cycle_day record is auto-created (null flow, null phase, no symptoms) and linked.
- **Fewer than 6 readings:** Coverline and shift detection return null. Chart still renders with dots but no coverline overlay.
- **Tracking gap (missed days):** Chart shows gaps in the line. Coverline calculation ignores cycles with fewer than 6 follicular-phase readings.
- **User switches method mid-cycle:** Method is stored per-reading. No adjustment is made; the chart treats all readings equally. A future enhancement could flag method inconsistency.
- **Module disabled mid-use:** Data is preserved. Re-enabling shows all historical temperature data.
- **Extremely long cycle (>90 days):** Same gap filtering as existing prediction engine. Temperature chart still renders but coverline is not calculated for that cycle.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Tapping the temperature field on the Log Day screen opens a numeric keypad with one decimal place
- [ ] **AC-2:** Saving a temperature value persists it and shows it on the Log Day screen when returning to that date
- [ ] **AC-3:** The Insights tab shows a temperature line chart with dots for each logged day
- [ ] **AC-4:** The coverline appears as a dashed horizontal line after 6+ readings in a cycle's follicular phase
- [ ] **AC-5:** Temperature shift detection highlights the post-ovulation zone when 3 consecutive readings are 0.2 F / 0.1 C above coverline
- [ ] **AC-6:** Toggling Fahrenheit/Celsius in Settings changes all displayed values without data loss
- [ ] **AC-7:** Calendar day cells show a small temperature dot indicator for days with temperature data
- [ ] **AC-8:** Editing a day's temperature updates the existing record (upsert, not duplicate)
- [ ] **AC-9:** Temperature input validates range (35.0-42.0 C / 95.0-107.6 F) with inline error

### Technical Criteria
- [ ] **TC-1:** cy_temperatures table is created by migration version 2 with correct schema and indexes
- [ ] **TC-2:** Temperature CRUD functions (create, get by date, get by cycle, update, delete) work correctly
- [ ] **TC-3:** All values stored in Celsius regardless of display unit
- [ ] **TC-4:** Coverline calculation returns null with fewer than 6 follicular-phase readings
- [ ] **TC-5:** Shift detection correctly identifies 3 consecutive above-coverline readings
- [ ] **TC-6:** Unit conversion functions produce correct values (C to F: value * 9/5 + 32, F to C: (value - 32) * 5/9)
- [ ] **TC-7:** Auto-creation of cycle_day records works when logging temperature on a date without one
- [ ] **TC-8:** Temperature data survives module disable/re-enable cycle

### Negative Criteria
- [ ] **NC-1:** Temperature data must NOT be sent over the network (offline-first, no telemetry)
- [ ] **NC-2:** Temperature tracking must NOT break existing prediction engine; it may only improve confidence
- [ ] **NC-3:** Deleting a cycle_day must NOT delete the temperature record (ON DELETE SET NULL, not CASCADE)

## UI Specification

### Mobile (Expo)

**Log Day screen - Temperature card:**
- Card uses `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent `#F472B6` for the temperature icon and active state
- Temperature input: large numeric field with one decimal, unit label (F/C) beside it
- Method selector: segmented control (Oral | Vaginal | Wearable)
- Time field: optional, time picker
- Background: `#0A0A0F` (background token)

**Insights tab - Temperature chart:**
- Line chart with temperature dots in `#F472B6` accent
- Coverline as dashed `rgba(240,240,245,0.65)` (textSecondary) horizontal line
- Phase backgrounds at 10% opacity behind chart area
- Shift zone highlighted with `#30D158` (success) at 15% opacity
- X-axis: dates. Y-axis: temperature range (auto-scaled to data +/- 0.5 degrees)

### Web (Next.js)
- Same tokens via CSS variables in `globals.css`
- Temperature chart rendered with same logic, responsive width
- Sidebar navigation: accessible via `/cycle/insights` route
- Input on `/cycle/log` page, inline with existing day logging form

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton placeholder in temperature card | Initial data fetch |
| Empty | "No temperature logged" with "Log temp" button | No data for selected date |
| Error | Inline red text "Temperature out of range" | Value outside 35.0-42.0 C |
| Success | Temperature value displayed with method badge | Valid temperature saved |
| Partial | Chart with gaps in line where days are missing | Intermittent tracking |

## Test Requirements

### Unit Tests
- [ ] `createTemperature`: stores valid Celsius value with correct fields
- [ ] `createTemperature`: rejects value below 35.0 C
- [ ] `createTemperature`: rejects value above 42.0 C
- [ ] `getTemperatureByDate`: returns null for unlogged date
- [ ] `getTemperatureByDate`: returns correct record for logged date
- [ ] `getTemperaturesByCycle`: returns all temps linked to a cycle's days
- [ ] `updateTemperature`: updates value and sets updatedAt
- [ ] `upsertTemperature`: inserts if no record exists, updates if it does
- [ ] `deleteTemperature`: removes record
- [ ] `calculateCoverline`: returns null with fewer than 6 readings
- [ ] `calculateCoverline`: returns average of 6 lowest follicular temps
- [ ] `detectTemperatureShift`: returns false with fewer than 3 above-coverline readings
- [ ] `detectTemperatureShift`: returns true with 3 consecutive readings 0.1+ C above coverline
- [ ] `celsiusToFahrenheit`: 36.5 C returns 97.7 F
- [ ] `fahrenheitToCelsius`: 98.6 F returns 37.0 C
- [ ] Cycle_day auto-creation when logging temp on a date without one

### Integration Tests
- [ ] Full flow: log temperature -> data persisted -> chart shows point -> coverline appears after 6 readings
- [ ] Error flow: enter out-of-range value -> inline error shown -> no data persisted
- [ ] Upsert flow: log temp -> log again for same date -> single record with updated value

### QA Verification Script

1. Open the app on iOS simulator
2. Navigate to MyCycle module from Hub Dashboard
3. Tap Today tab, then "Log Day"
4. Verify: Temperature card is visible below flow/symptoms section -- corresponds to AC-1
5. Enter "98.2" in the temperature field (Fahrenheit mode)
6. Select "Oral" method
7. Tap Save
8. Verify: Temperature shows on the day view -- corresponds to AC-2
9. Navigate back to Today tab, then to the same day
10. Verify: Previously logged temperature is displayed -- corresponds to AC-2
11. Navigate to Insights tab
12. Verify: Temperature chart is visible with at least 1 data point -- corresponds to AC-3
13. Log temperatures for 7 consecutive days with values: 97.2, 97.0, 97.3, 97.1, 97.4, 97.8, 98.0, 98.2
14. Navigate to Insights tab
15. Verify: Coverline appears as a dashed line -- corresponds to AC-4
16. Verify: Temperature shift zone is highlighted -- corresponds to AC-5
17. Navigate to Settings tab
18. Toggle temperature unit to Celsius
19. Verify: All displayed temperatures now show Celsius values -- corresponds to AC-6
20. Navigate to Calendar tab
21. Verify: Days with temperature data show a small dot indicator -- corresponds to AC-7
22. Navigate back to a logged day, change the temperature value
23. Verify: Value is updated, not duplicated -- corresponds to AC-8
24. Enter "94.0" F (below valid range)
25. Verify: Inline error message appears -- corresponds to AC-9

## gstack Quality Gates

Based on Complexity 4 (Inverse), this feature is "Small" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for coverline calculation and shift detection

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- cycle has no standalone counterpart (skip)

## Handoff State

### Before This Work
Cycle module has 3 tables (cy_cycles, cy_cycle_days, cy_symptoms), a prediction engine using weighted moving averages of cycle lengths, and fertile window estimation based on ovulation minus 14 days. No temperature data exists.

### After This Work
- New cy_temperatures table with date-unique temperature records
- Temperature CRUD operations (create, get, update, delete, upsert)
- BBT analysis engine with coverline calculation and shift detection
- Unit conversion utilities (C/F)
- Temperature input integrated into the Log Day screen
- Temperature chart with coverline and shift visualization on Insights
- Calendar day indicators for temperature data
- Settings toggle for temperature display unit

### Files Changed
- `modules/cycle/src/types.ts` -- Added Temperature, TemperatureMethod, TemperatureUnit schemas
- `modules/cycle/src/db/schema.ts` -- Added CREATE_TEMPERATURES DDL
- `modules/cycle/src/db/crud.ts` -- Added temperature CRUD functions
- `modules/cycle/src/engine/temperature.ts` -- New file: coverline, shift detection, unit conversion
- `modules/cycle/src/definition.ts` -- Added migration version 2
- `modules/cycle/src/index.ts` -- Exported new types and functions
- `modules/cycle/src/__tests__/temperature.test.ts` -- New test file
- `apps/mobile/app/(cycle)/log-day.tsx` -- Temperature input card
- `apps/mobile/app/(cycle)/insights.tsx` -- Temperature chart overlay

### Known Limitations
- No HealthKit/wearable auto-import (future Health module integration)
- No hardware thermometer Bluetooth pairing
- Shift detection uses simple 3-day rule, not clinically-validated sympto-thermal method
- Coverline calculation is simplified (6 lowest follicular temps vs. full sympto-thermal rules)

### Context for Next Agent
- Storage is always Celsius; display conversion happens at the UI layer only
- cy_temperatures uses ON DELETE SET NULL for cycle_day_id, not CASCADE, so temperature data survives day-record deletions
- The prediction engine in `engine/prediction.ts` can optionally use confirmed ovulation from shift detection to improve confidence scores, but this integration is an enhancement, not a requirement for initial ship
- The `date` column has a UNIQUE constraint, so upsert logic is needed
