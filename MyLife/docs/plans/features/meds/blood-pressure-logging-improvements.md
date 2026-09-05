# Feature Spec: Blood Pressure Logging Improvements

## Metadata
- **Module:** meds
- **Priority Score:** 36 / 50 (A-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 5 x3 + Complexity 4 x2 + CrossModule 3 x1 + PaidUser 4 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (generic measurements CRUD already exists)
- **Blocks:** BP trend visualization (B-Tier, 27/50, builds on structured BP data)

## Business Context

### Why This Feature Exists
Blood pressure tracking is the #1 health measurement feature in medication apps. CareClinic charges $119.88/yr and positions structured BP logging with AHA category classification as a premium differentiator. Medisafe has basic BP entry but no category analysis. MyLife already has a generic `md_measurements` table that stores BP as a single text value (e.g., "120/80"), but this flat storage prevents structured analysis: you cannot query "show me all Stage 1 hypertension readings" or compute average systolic separately from diastolic. Adding dedicated systolic/diastolic fields, AHA category auto-classification, context fields (arm, position, time of day), and pulse tracking transforms basic logging into a clinical-grade BP tracker that competes directly with CareClinic.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| CareClinic | Yes | Yes ($119.88/yr) | Structured systolic/diastolic entry, BP category classification, trend charts with AHA zones, medication correlation. |
| Medisafe | Partial | Free (basic) | Simple BP entry in health measurements. No structured fields, no AHA classification. |
| MyTherapy | Yes | Free | Basic BP logging. Manual systolic/diastolic entry, simple history list. No analytics. |
| MySugr | No | N/A | Focused on diabetes. No BP tracking. |

### Target User
People managing hypertension (1.28 billion adults globally, ~47% of US adults) who track BP alongside medications. Specifically: CareClinic users paying $119.88/yr who want BP tracking integrated with medication adherence, and users of standalone BP apps (SmartBP, Blood Pressure Monitor) who want consolidation into one health app. Migration path: CareClinic user gets BP logging + medication tracking + correlation analysis in one app for less.

## Technical Context

### Where This Lives in MyLife

```
modules/meds/src/
  bp/
    engine.ts                   -- NEW: BP category classification, averages, analysis
    __tests__/engine.test.ts    -- NEW: Engine tests
  db/
    bp.ts                       -- NEW: BP reading CRUD
    schema.ts                   -- MODIFY: Add md_bp_readings table
  models/
    bp-reading.ts               -- NEW: Zod schemas for BP readings
    index.ts                    -- MODIFY: Export BP models
  definition.ts                 -- MODIFY: Add to V3 migration
  index.ts                      -- MODIFY: Export BP engine + types
apps/mobile/app/(meds)/
  log-bp.tsx                    -- NEW: BP logging screen
  bp-history.tsx                -- NEW: BP reading history + chart
apps/web/app/meds/
  bp/page.tsx                   -- NEW: Web BP dashboard
```

### Wireframe Position

```
Hub Dashboard
  └── MyMeds card
       ├── Today tab
       │    └── [Quick "Log BP" card / shortcut]
       ├── History tab
       │    └── [BP History sub-section with chart]
       ├── Medications tab
       └── Settings tab
            └── [BP target ranges configuration]
```

### Data Model

```sql
-- Structured blood pressure readings (replaces flat md_measurements for BP)
CREATE TABLE IF NOT EXISTS md_bp_readings (
  id TEXT PRIMARY KEY,
  systolic INTEGER NOT NULL CHECK (systolic > 0 AND systolic <= 300),
  diastolic INTEGER NOT NULL CHECK (diastolic > 0 AND diastolic <= 200),
  pulse INTEGER CHECK (pulse > 0 AND pulse <= 300),
  arm TEXT CHECK (arm IN ('left', 'right')),
  position TEXT CHECK (position IN ('sitting', 'standing', 'lying')),
  context TEXT CHECK (context IN ('morning', 'evening', 'after_exercise', 'after_medication', 'routine')),
  category TEXT NOT NULL CHECK (category IN ('normal', 'elevated', 'hypertension_1', 'hypertension_2', 'crisis')),
  notes TEXT,
  measured_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS md_bp_readings_measured_idx ON md_bp_readings(measured_at DESC);
CREATE INDEX IF NOT EXISTS md_bp_readings_category_idx ON md_bp_readings(category);
CREATE INDEX IF NOT EXISTS md_bp_readings_context_idx ON md_bp_readings(context);
```

AHA blood pressure categories (auto-classified):
- **Normal:** systolic < 120 AND diastolic < 80
- **Elevated:** systolic 120-129 AND diastolic < 80
- **Hypertension Stage 1:** systolic 130-139 OR diastolic 80-89
- **Hypertension Stage 2:** systolic >= 140 OR diastolic >= 90
- **Hypertensive Crisis:** systolic > 180 OR diastolic > 120

### Dependencies
- **Internal:** `@mylife/meds` (existing measurements system, medication tracking), `@mylife/db` (DatabaseAdapter)
- **External:** None. Classification uses AHA guidelines, no external API.
- **Cross-Module:** Health module (BP readings as a health metric in wellness timeline). Hub activity feed (milestone readings like first normal reading after medication change).

## Functional Requirements

### User Stories
1. As a hypertension patient, I want to log my blood pressure with systolic and diastolic values so I have structured data for my doctor.
2. As a user, I want my BP readings auto-classified into AHA categories so I know if my numbers are normal or concerning.
3. As a user, I want to track pulse alongside BP so I have a complete cardiovascular snapshot.
4. As a user, I want to record which arm I used and my body position so my readings are medically contextualized.
5. As a user, I want to see my average BP for morning vs evening so I can identify patterns.
6. As a user, I want to see how many readings fall into each AHA category so I can track my progress.

### Behavior Specification

**Logging a BP reading:**
1. User taps "Log BP" on the Today tab or navigates to History > BP.
2. A logging screen appears with:
   a. Systolic field (numeric input, required). Large font, easy to tap.
   b. Diastolic field (numeric input, required). Below systolic, separated by "/" visual.
   c. Pulse field (numeric input, optional). Labeled "Pulse (bpm)".
   d. Arm selector: Left | Right (optional, pill toggle).
   e. Position selector: Sitting | Standing | Lying (optional, pill toggle).
   f. Context selector: Morning | Evening | After Exercise | After Medication | Routine (optional, chips).
   g. Notes field (optional free text).
3. As the user types systolic/diastolic, the AHA category badge updates in real-time:
   - Green badge: "Normal"
   - Yellow badge: "Elevated"
   - Orange badge: "Stage 1"
   - Red badge: "Stage 2"
   - Flashing red badge: "Crisis -- seek medical attention"
4. User taps "Save". Reading saved to `md_bp_readings` with auto-calculated category.
5. If the reading is in "Crisis" category, show a dismissable alert: "Your blood pressure reading is very high. If you are experiencing symptoms like chest pain, difficulty breathing, or severe headache, seek emergency medical care."

**BP history screen:**
1. User navigates to History tab > BP section.
2. Top: Summary card showing:
   - Latest reading with category badge and timestamp.
   - 7-day average (systolic/diastolic separately).
   - 30-day average.
   - Category distribution pie/donut: how many readings in each category over last 30 days.
3. Middle: Line chart showing systolic (top line) and diastolic (bottom line) over time.
   - AHA zone bands as colored background regions on the chart.
   - Morning readings as circle markers, evening as square markers.
4. Bottom: Scrollable list of all readings, newest first.
   - Each row shows: date/time, systolic/diastolic, pulse, category badge, context tag.
   - Tap to edit or delete.

**Settings (BP target ranges):**
1. In Settings tab, a "Blood Pressure" section allows:
   - Custom target systolic range (default: < 120).
   - Custom target diastolic range (default: < 80).
   - Reminder to measure (morning, evening, or both).
2. Stored in `md_settings` as `bp_target_systolic`, `bp_target_diastolic`, `bp_reminder_time`.

### Edge Cases

- **Systolic <= diastolic:** Invalid. Show validation error: "Systolic must be higher than diastolic."
- **Extremely high values (systolic > 250 or diastolic > 150):** Allow but show crisis warning.
- **Pulse = 0 or negative:** Reject. Pulse must be > 0 if provided.
- **No readings yet:** History shows empty state: "Log your first blood pressure reading" with CTA.
- **Single reading:** Charts show single point. Averages equal to the single reading.
- **Multiple readings on same day:** All kept. Averages computed across all readings in the period.
- **Old data migration:** Existing `md_measurements` rows with `type = 'blood_pressure'` should be offered as importable. Parse "120/80" format to extract systolic/diastolic. Skip rows that don't match the format.
- **Module disabled:** Data persists but UI hidden.
- **Category edge cases:** When systolic is "Elevated" range but diastolic qualifies as "Stage 1", the higher category wins (Stage 1).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** BP logging screen shows separate systolic and diastolic numeric inputs
- [ ] **AC-2:** AHA category badge updates in real-time as user types values
- [ ] **AC-3:** Pulse field is available and optional alongside BP values
- [ ] **AC-4:** Arm and position selectors are available
- [ ] **AC-5:** Context selector (morning/evening/after exercise/etc.) is available
- [ ] **AC-6:** Crisis reading shows a medical attention alert
- [ ] **AC-7:** History screen shows latest reading with category badge
- [ ] **AC-8:** History screen shows 7-day and 30-day averages (systolic/diastolic separately)
- [ ] **AC-9:** History screen shows category distribution over last 30 days
- [ ] **AC-10:** Line chart displays systolic and diastolic trends over time
- [ ] **AC-11:** Reading list shows each entry with date, values, pulse, category, and context
- [ ] **AC-12:** User can edit or delete a reading from the list
- [ ] **AC-13:** Feature works on both mobile and web
- [ ] **AC-14:** Settings allow custom target systolic/diastolic ranges

### Technical Criteria
- [ ] **TC-1:** `classifyBP(systolic, diastolic)` returns correct AHA category for all boundary values
- [ ] **TC-2:** BP readings saved to `md_bp_readings` with all fields persisted correctly
- [ ] **TC-3:** `calculateBPAverages(readings, period)` returns correct systolic and diastolic averages
- [ ] **TC-4:** `getCategoryDistribution(readings)` returns correct counts per category
- [ ] **TC-5:** V3 migration creates `md_bp_readings` table without affecting existing data
- [ ] **TC-6:** Validation rejects systolic <= diastolic
- [ ] **TC-7:** Old `md_measurements` BP entries can be migrated to structured format

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Crisis alert must NOT block the user from saving the reading
- [ ] **NC-2:** Pulse value must NOT be required (it is optional)
- [ ] **NC-3:** Saving a BP reading must NOT modify or delete existing `md_measurements` data
- [ ] **NC-4:** Category classification must NOT use user's custom targets (always AHA standard)

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token)
- Module accent: `#06B6D4` (meds cyan)
- Category badges:
  - Normal: `#30D158` (success green) background
  - Elevated: `#FFD60A` (yellow) background
  - Stage 1: `#FF9F0A` (orange) background
  - Stage 2: `#FF453A` (danger red) background
  - Crisis: `#FF453A` pulsing/blinking

BP logging screen layout:
```
[Log Blood Pressure]

  ┌─────────────────────┐
  │   [120] / [80]      │     [large numeric inputs]
  │   ♥ [72] bpm        │     [pulse input, smaller]
  └─────────────────────┘

  [Normal ✓]                   [AHA category badge, real-time]

  Arm:    (Left) (Right)       [pill toggle]
  Position: (Sitting) (Standing) (Lying)
  Context: [Morning] [Evening] [Routine] ...  [chips]

  [Notes...]                   [optional text]

  [Save Reading]               [primary button, cyan]
```

### Web (Next.js)

- Route: `/meds/bp`
- Two-column layout: logging form (left), history + chart (right)
- Charts use recharts with AHA zone background bands
- Keyboard: Tab navigates fields, Enter saves

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards and chart placeholder | Initial load |
| Empty | "Log your first blood pressure reading" + CTA | No BP readings |
| Logging | Full form with real-time category badge | User opens log screen |
| History | Chart + reading list + averages | Readings exist |
| Crisis | Red alert banner with medical advice | Systolic > 180 or diastolic > 120 |
| Error | "Could not save reading" + retry | Save failure |

## Test Requirements

### Unit Tests
- [ ] `classifyBP(119, 79)` -> 'normal'
- [ ] `classifyBP(120, 79)` -> 'elevated'
- [ ] `classifyBP(125, 79)` -> 'elevated'
- [ ] `classifyBP(130, 79)` -> 'hypertension_1'
- [ ] `classifyBP(125, 85)` -> 'hypertension_1' (diastolic qualifies even if systolic doesn't)
- [ ] `classifyBP(140, 90)` -> 'hypertension_2'
- [ ] `classifyBP(181, 80)` -> 'crisis'
- [ ] `classifyBP(130, 121)` -> 'crisis' (diastolic crisis)
- [ ] `classifyBP(130, 80)` -> 'hypertension_1' (boundary value)
- [ ] `calculateBPAverages`: 3 readings -> correct systolic and diastolic averages
- [ ] `calculateBPAverages`: empty array -> { systolic: 0, diastolic: 0 }
- [ ] `getCategoryDistribution`: 5 readings across 3 categories -> correct counts
- [ ] Validation: systolic = 80, diastolic = 120 -> rejected
- [ ] `parseLegacyBP("120/80")` -> { systolic: 120, diastolic: 80 }
- [ ] `parseLegacyBP("invalid")` -> null

### Integration Tests
- [ ] Full flow: log BP reading with all fields -> saved to md_bp_readings -> appears in history
- [ ] Category auto-classification: log reading with 135/85 -> saved with category 'hypertension_1'
- [ ] Average calculation: log 3 readings over 3 days -> 7-day average reflects all 3

### QA Verification Script

1. Open the app on [iOS / web]
2. Navigate to MyMeds
3. Tap "Log BP" on the Today tab
4. Verify: Separate systolic and diastolic inputs shown -- AC-1
5. Enter systolic=120, diastolic=78
6. Verify: Category badge shows "Normal" (green) -- AC-2
7. Enter pulse=72
8. Verify: Pulse field accepts the value -- AC-3
9. Select arm "Left" and position "Sitting" -- AC-4
10. Select context "Morning" -- AC-5
11. Tap Save
12. Change values to systolic=185, diastolic=110
13. Verify: Category shows "Crisis" and medical attention alert appears -- AC-6
14. Save the crisis reading
15. Navigate to BP History
16. Verify: Latest reading shown with category badge -- AC-7
17. Verify: Averages shown for 7-day and 30-day -- AC-8
18. Verify: Category distribution shown -- AC-9
19. Verify: Line chart shows systolic and diastolic lines -- AC-10
20. Verify: Reading list shows date, values, pulse, category, context -- AC-11
21. Tap a reading and edit the notes -- AC-12
22. Verify on web -- AC-13
23. Navigate to Settings, check BP target configuration -- AC-14

## gstack Quality Gates

Based on Complexity score 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- log a BP reading, verify category badge, check history chart

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- eval suite for BP classification engine

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Generic `md_measurements` table stores BP as a single text value (e.g., "120/80").
- No structured systolic/diastolic fields.
- No AHA category classification.
- No pulse, arm, position, or context tracking.
- `getMeasurementTrend` returns flat value strings, not numeric systolic/diastolic.

### After This Work
- Dedicated `md_bp_readings` table with structured systolic/diastolic/pulse fields.
- AHA category auto-classification engine.
- BP averages computation (7-day, 30-day, by context).
- Category distribution analysis.
- Logging screen with real-time category feedback.
- History screen with chart and reading list.
- Crisis alert for dangerous readings.

### Files Changed
- `modules/meds/src/bp/engine.ts` -- NEW: BP classification, averages, distribution
- `modules/meds/src/bp/__tests__/engine.test.ts` -- NEW: Engine tests
- `modules/meds/src/db/bp.ts` -- NEW: BP reading CRUD
- `modules/meds/src/db/schema.ts` -- MODIFY: Add md_bp_readings table
- `modules/meds/src/models/bp-reading.ts` -- NEW: Zod schemas for BP
- `modules/meds/src/models/index.ts` -- MODIFY: Export BP models
- `modules/meds/src/definition.ts` -- MODIFY: V3 migration
- `modules/meds/src/index.ts` -- MODIFY: Export BP engine + types
- `apps/mobile/app/(meds)/log-bp.tsx` -- NEW: Mobile BP logging screen
- `apps/mobile/app/(meds)/bp-history.tsx` -- NEW: Mobile BP history
- `apps/web/app/meds/bp/page.tsx` -- NEW: Web BP dashboard

### Known Limitations
- **No HealthKit/Apple Health sync.** Future: auto-import BP readings from Apple Health.
- **No Bluetooth BP cuff integration.** Future: pair with Withings/Omron smart cuffs.
- **No PDF export of BP report.** Current export is markdown only. Future: PDF for doctor visits.
- **No medication correlation overlay on BP chart.** Future: show med start/stop markers on BP trend (infrastructure exists in `getMeasurementTrendWithMedMarkers`).

### Context for Next Agent
- The `md_measurements` table still exists and still stores BP readings for backward compatibility. New BP logging writes to `md_bp_readings` only. A migration helper `parseLegacyBP(value: string)` should parse "120/80" strings for optional import of old data.
- AHA category classification is a pure function: `classifyBP(systolic: number, diastolic: number) -> BPCategory`. When systolic and diastolic fall into different categories, use the higher (worse) category.
- The chart should use AHA zone bands as colored background regions. Zones: Normal (green, y < 120), Elevated (yellow, 120-129), Stage 1 (orange, 130-139), Stage 2 (red, >= 140). These apply to the systolic axis.
- The Zod `MeasurementTypeSchema` in `models/measurement.ts` includes `'heart_rate'` but the SQL CHECK constraint in `schema.ts` does not include it. Note this discrepancy but do not fix it in this feature (it is a separate bug).
- Pulse is separate from heart_rate in `md_measurements`. Pulse in `md_bp_readings` is a quick cardiovascular snapshot taken at the same time as BP.
