# Feature Spec: HbA1c Calculator

## Metadata
- **Module:** meds
- **Priority Score:** 26 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 2 x3 + Complexity 4 x2 + CrossModule 3 x1 + PaidUser 3 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Blood glucose logging (built -- `md_glucose_readings` table, glucose engine with `estimateA1c`, `calculateAverageGlucose`, `analyzeGlucosePatterns`)
- **Blocks:** none

## Business Context

### Why This Feature Exists
HbA1c (glycated hemoglobin) is the gold standard metric for diabetes management, measuring average blood sugar over 2-3 months. MySugr (owned by Roche, $35.99/yr) and Glucose Buddy ($39.99/yr) prominently feature A1c estimation as a core premium feature. The glucose engine already has `estimateA1c()` using the ADAG formula (A1c = (avg_mg + 46.7) / 28.7), but there is no UI for it and no historical A1c tracking. This feature adds a dedicated A1c dashboard showing estimated A1c from logged glucose readings, lab A1c entry for calibration, A1c history chart, and goal tracking with clinician-recommended targets. High Complexity score (4) because this is pure engine work with a simple UI layer.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| MySugr | Yes | Yes ($35.99/yr) | Estimated A1c from glucose logs, lab A1c entry, trend chart, target bands, Roche integration for actual lab results. |
| Glucose Buddy | Yes | Yes ($39.99/yr) | A1c estimator, lab result logging, trend over time, goal setting. |
| CareClinic | Partial | Yes ($119.88/yr) | Generic measurement tracking. No dedicated A1c calculator. |
| Medisafe | No | N/A | No A1c features. |
| mySugr (Roche) | Yes | Yes | User data feeds Roche's pharmaceutical pipeline. |

### Target User
Type 1 and Type 2 diabetics (537M worldwide, 37.3M in the US) who test blood glucose regularly and want to see their estimated A1c between lab visits. Specifically: MySugr users paying $35.99/yr or Glucose Buddy users paying $39.99/yr who want A1c tracking without their diabetes data being owned by Roche or sold to pharma companies. Migration path: equivalent A1c estimation and tracking, fully on-device.

## Technical Context

### Where This Lives in MyLife

```
modules/meds/src/
  glucose/
    engine.ts                      -- MODIFY: Add A1c history, lab entry helpers, goal comparison
    __tests__/engine.test.ts       -- MODIFY: Add A1c calculator tests
  db/
    glucose.ts                     -- MODIFY: Add CRUD for md_a1c_records
    schema.ts                      -- MODIFY: Add md_a1c_records table (V4)
  models/
    glucose.ts                     -- MODIFY: Add A1cRecord, A1cGoal types
    index.ts                       -- MODIFY: Export A1c models
  definition.ts                    -- MODIFY: Add to V4 migration, add a1c screen
  index.ts                         -- MODIFY: Export A1c functions
apps/mobile/app/(meds)/
  a1c.tsx                          -- NEW: A1c dashboard screen
apps/web/app/meds/
  a1c/page.tsx                     -- NEW: Web A1c dashboard
```

### Wireframe Position

```
Hub Dashboard
  └── MyMeds card
       ├── Today tab
       │    └── [A1c estimate badge on glucose summary card]
       ├── History tab
       │    └── Blood Glucose section
       │         ├── [Glucose History list]
       │         └── [A1c Dashboard] ← YOU ARE HERE
       │              ├── [Current estimated A1c from glucose logs]
       │              ├── [Lab A1c entry]
       │              ├── [A1c history chart (estimated + lab)]
       │              ├── [Goal indicator with ADA targets]
       │              └── [Interpretation text]
       └── Settings tab
            └── [A1c goal configuration]
```

### Data Model

```sql
-- A1c records (both estimated from glucose logs and actual lab results)
CREATE TABLE IF NOT EXISTS md_a1c_records (
  id TEXT PRIMARY KEY,
  value REAL NOT NULL CHECK (value >= 3.0 AND value <= 20.0),
  source TEXT NOT NULL CHECK (source IN ('estimated', 'lab')),
  average_glucose REAL,
  reading_count INTEGER,
  period_days INTEGER,
  notes TEXT,
  recorded_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Dependencies
- **Internal:** `@mylife/meds` glucose engine (`estimateA1c`, `calculateAverageGlucose`, `analyzeGlucosePatterns`), glucose CRUD (`getGlucoseReadings`)
- **External:** None. Pure calculation engine.
- **Cross-Module:** Health module can surface A1c estimate via crossModule. Nutrition module can correlate carb intake with A1c trends (future).

## Functional Requirements

### User Stories
1. As a diabetic, I want to see my estimated A1c based on my glucose logs so I know where I stand between lab visits.
2. As a diabetic, I want to enter my actual lab A1c result so I can compare it to the estimate and calibrate my expectations.
3. As a diabetic, I want to see my A1c history over time (both estimated and lab) so I can track long-term progress.
4. As a diabetic, I want to set an A1c goal and see how close I am so I stay motivated.

### Behavior Specification

1. User navigates to MyMeds -> History -> Blood Glucose -> A1c Dashboard
2. System calculates estimated A1c from glucose readings in the last 90 days:
   a. Query `md_glucose_readings` for the past 90 days
   b. Calculate average glucose in mg/dL via `calculateAverageGlucose()`
   c. Apply ADAG formula: A1c = (avg + 46.7) / 28.7
   d. Display result with confidence indicator based on reading count
3. System shows A1c interpretation:
   a. <5.7%: Normal (green)
   b. 5.7-6.4%: Prediabetes range (yellow)
   c. 6.5-7.0%: Diabetes, well-controlled (orange)
   d. 7.0-8.0%: Diabetes, fair control (orange-red)
   e. >8.0%: Diabetes, needs improvement (red)
4. User can tap "Log Lab Result" to enter an actual A1c from a blood test
5. System saves lab result to `md_a1c_records` with source='lab'
6. System periodically auto-saves estimated A1c (weekly) to `md_a1c_records` with source='estimated'
7. A1c history chart shows both estimated (dashed line) and lab (solid dots) values over time
8. Goal section: user sets target A1c (e.g., <7.0%), system shows current vs target with progress ring
9. Below the chart, system shows:
   a. Average glucose used for estimate
   b. Number of readings in the period
   c. Recommendation: if reading count < 30 in 90 days, show "More frequent testing improves accuracy"

### Edge Cases

- Fewer than 7 glucose readings in 90 days: show estimate with "Low Confidence" warning and explanation
- Zero glucose readings: show empty state with CTA to log glucose readings
- Lab A1c much higher/lower than estimated: show note explaining that fingerstick glucose may not capture full picture (post-meal spikes, overnight lows)
- User enters lab A1c outside valid range (3.0-20.0%): validation error
- All readings are in mmol/L: engine converts to mg/dL internally via `convertGlucose()`
- Time zone changes affecting 90-day window: use UTC consistently
- Module disabled: A1c screen inaccessible, data preserved, auto-save paused

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** A1c dashboard shows estimated A1c with one decimal place (e.g., "6.8%")
- [ ] **AC-2:** Confidence indicator shows based on reading count: High (30+), Medium (15-29), Low (<15)
- [ ] **AC-3:** Color-coded interpretation band matches ADA guidelines (Normal/Prediabetes/Controlled/Fair/Needs improvement)
- [ ] **AC-4:** User can enter lab A1c result with date and optional notes
- [ ] **AC-5:** A1c history chart shows estimated values as dashed line and lab values as solid dots
- [ ] **AC-6:** User can set A1c goal; progress ring shows current vs target
- [ ] **AC-7:** Average glucose and reading count displayed below the estimate
- [ ] **AC-8:** Low reading count triggers accuracy warning with testing frequency recommendation
- [ ] **AC-9:** A1c estimate badge visible on Today tab glucose summary card
- [ ] **AC-10:** Web and mobile show equivalent data

### Technical Criteria
- [ ] **TC-1:** `md_a1c_records` table created in V4 migration with correct constraints
- [ ] **TC-2:** `estimateA1c()` correctly applies ADAG formula (verified: avg 150 mg/dL = 7.0%)
- [ ] **TC-3:** `calculateAverageGlucose()` correctly converts mmol/L readings to mg/dL before averaging
- [ ] **TC-4:** Auto-save runs weekly and writes estimated A1c to `md_a1c_records`
- [ ] **TC-5:** A1c CRUD operations: create, read list, read by id, delete
- [ ] **TC-6:** Lab A1c validation enforces 3.0-20.0% range
- [ ] **TC-7:** Calculation completes in <50ms for 1000+ glucose readings

### Negative Criteria
- [ ] **NC-1:** A1c estimate must NOT be presented as a medical diagnosis -- include disclaimer text
- [ ] **NC-2:** Auto-saved estimates must NOT overwrite lab results
- [ ] **NC-3:** A1c calculator must NOT require network access
- [ ] **NC-4:** Must NOT use readings older than 90 days for the current estimate (A1c reflects ~3 months)

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Hero section: large A1c number (e.g., "6.8%") centered, with color ring matching interpretation
- Interpretation badge below: "Well-Controlled" in orange-ish pill
- Confidence badge: "High Confidence (47 readings)" in glass pill
- Goal progress: circular progress ring with target line
- Chart: time-series with estimated line (dashed, `#06B6D4` cyan) and lab dots (solid, `#F0F0F5` white)
- ADA range bands as horizontal zones behind chart
- Module accent: `#06B6D4` (meds cyan)

### Web (Next.js)
- Route: `/meds/a1c`
- Same tokens via CSS variables
- Wider layout: hero A1c on left, chart on right
- Lab entry via modal form
- Recharts for chart rendering

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Pulsing A1c placeholder + chart skeleton | Initial calculation |
| Empty | "No glucose readings yet" + CTA to log glucose | Zero readings in 90 days |
| Low confidence | A1c shown with yellow "Low Confidence" badge + "Log more readings" suggestion | <15 readings |
| Error | "Could not calculate A1c" + retry button | Database query fails |
| Success | Full A1c dashboard with chart, stats, goal | 15+ readings in period |

## Test Requirements

### Unit Tests
- [ ] `estimateA1c(150)`: returns 6.9 (ADAG formula verification)
- [ ] `estimateA1c(126)`: returns 6.0 (boundary: ADA prediabetes threshold)
- [ ] `estimateA1c(97)`: returns 5.0 (normal A1c boundary)
- [ ] `estimateA1c(0)`: returns 1.6 (edge case, should not crash)
- [ ] `getA1cConfidence(47)`: returns 'high'
- [ ] `getA1cConfidence(20)`: returns 'medium'
- [ ] `getA1cConfidence(5)`: returns 'low'
- [ ] `interpretA1c(5.5)`: returns { label: 'Normal', color: 'green' }
- [ ] `interpretA1c(6.0)`: returns { label: 'Prediabetes Range', color: 'yellow' }
- [ ] `interpretA1c(7.5)`: returns { label: 'Fair Control', color: 'orange' }
- [ ] `calculateAverageGlucose` with mixed mg/dL and mmol/L: correctly converts and averages
- [ ] Lab A1c creation: valid value (6.5) saves to md_a1c_records
- [ ] Lab A1c creation: invalid value (2.0) returns validation error

### Integration Tests
- [ ] Full flow: log 30 glucose readings -> open A1c dashboard -> correct estimate displayed
- [ ] Lab entry: enter lab A1c 7.0 -> appears on chart as solid dot -> does not affect estimated line

### QA Verification Script

1. Open the app on iOS simulator
2. Navigate to MyMeds
3. Log 30+ glucose readings across 30 days (mix of fasting and post-meal, range 90-200 mg/dL)
4. Navigate to History -> Blood Glucose -> A1c Dashboard
5. Verify: estimated A1c displayed with one decimal place -- AC-1
6. Verify: confidence badge shows "High Confidence" for 30+ readings -- AC-2
7. Verify: interpretation band color matches ADA guideline for the computed value -- AC-3
8. Tap "Log Lab Result"
9. Enter: A1c = 7.0%, date = today, notes = "Quest Diagnostics"
10. Tap Save
11. Verify: lab result appears on chart as solid dot -- AC-4, AC-5
12. Navigate to Settings
13. Set A1c goal to 6.5%
14. Navigate back to A1c Dashboard
15. Verify: progress ring shows current vs 6.5% target -- AC-6
16. Verify: average glucose and reading count displayed -- AC-7
17. Delete most glucose readings to leave only 5
18. Refresh A1c dashboard
19. Verify: "Low Confidence" warning appears with recommendation to test more -- AC-8
20. Navigate to Today tab
21. Verify: A1c estimate badge shown on glucose summary -- AC-9
22. Repeat on web at `/meds/a1c` -- AC-10
23. Verify: disclaimer text visible ("This is an estimate, not a medical diagnosis") -- NC-1

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to `/meds/a1c`, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for A1c estimation engine

### Post-merge:
- [ ] `/parity-check` -- if module has standalone counterpart

## Handoff State

### Before This Work
The glucose engine has `estimateA1c()` and `calculateAverageGlucose()` functions but no A1c-specific UI, no lab A1c entry, no A1c history tracking, and no goal system.

### After This Work
A dedicated A1c dashboard shows estimated A1c from glucose logs, allows lab A1c entry, displays A1c history chart with both sources, provides ADA interpretation, and supports goal tracking with progress visualization.

### Files Changed
- `modules/meds/src/glucose/engine.ts` -- Add `getA1cConfidence`, `interpretA1c`, A1c auto-save helper
- `modules/meds/src/glucose/__tests__/engine.test.ts` -- A1c calculator tests
- `modules/meds/src/db/glucose.ts` -- Add A1c record CRUD
- `modules/meds/src/db/schema.ts` -- Add `md_a1c_records` table (V4)
- `modules/meds/src/models/glucose.ts` -- Add A1cRecord, A1cGoal, A1cInterpretation types
- `modules/meds/src/models/index.ts` -- Re-export A1c models
- `modules/meds/src/definition.ts` -- V4 migration, add a1c screen to navigation
- `modules/meds/src/index.ts` -- Export A1c functions
- `apps/mobile/app/(meds)/a1c.tsx` -- Mobile A1c dashboard
- `apps/web/app/meds/a1c/page.tsx` -- Web A1c dashboard

### Known Limitations
- ADAG formula accuracy depends on consistent testing. Fingerstick readings miss nocturnal lows and post-meal spikes, so estimated A1c may diverge from lab A1c by 0.5-1.0%.
- No integration with CGM data yet (that is a separate C-Tier feature). CGM integration would dramatically improve A1c estimation accuracy.
- Weekly auto-save means the A1c history has at most ~52 data points per year. Fine for trend analysis.

### Context for Next Agent
- `estimateA1c()` already exists in `glucose/engine.ts`. Do not reimplement -- extend with the helper functions listed in this spec.
- The existing `md_glucose_readings` table has `unit` column (mg/dL or mmol/L). Always normalize to mg/dL via `toMgDl()` before computing averages.
- V4 migration will likely contain tables from multiple B+C features. Coordinate with other V4 tables in the same migration.
