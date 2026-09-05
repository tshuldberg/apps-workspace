# Feature Spec: Readiness Score

## Metadata
- **Module:** health
- **Priority Score:** 36 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 3 x3 + Complexity 2 x2 + CrossModule 5 x1 + PaidUser 3 x1
- **Sprint:** 5
- **Estimated CC Time:** 3-4 hours
- **Depends On:** HealthKit integration (for automatic vitals), Sleep stage analysis (for sleep score), HRV tracking (for recovery signal)
- **Blocks:** none

## Business Context

### Why This Feature Exists
The readiness score is a daily composite metric (0-100) that tells users how prepared their body is for exertion. Google Fit, Whoop ($30/mo), and Oura ($6/mo) all offer readiness scores. This requires sleep quality, HRV, resting heart rate, and activity data, making it the ultimate cross-module feature (5/5 CrossModule). It justifies the hub's existence because no single standalone app can compute this.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Google Fit | Yes | Free | "Cardio fitness" readiness based on HR and activity |
| Whoop | Yes | Yes ($30/mo) | Recovery score 0-100, requires proprietary band |
| Oura | Yes | Yes ($5.99/mo) | Readiness score based on HRV, temp, sleep, activity |
| Apple Health | No | N/A | No composite readiness score |

### Target User
Fitness-conscious users who want to know if today is a "push hard" day or a "rest" day. Users with Apple Watch or similar wearables who have the raw data but no single app that synthesizes it into an actionable score. Athletes, runners, gym-goers who want recovery-aware training.

## Technical Context

### Where This Lives in MyLife

```
modules/health/src/readiness/engine.ts      -- Readiness score calculation algorithm
modules/health/src/readiness/types.ts       -- Score types and factor weights
modules/health/src/readiness/crud.ts        -- Score persistence and history
modules/health/src/db/schema.ts             -- New hl_readiness_scores table
modules/health/src/index.ts                 -- Export readiness functions
apps/mobile/app/(health)/today.tsx          -- Readiness score card on Today tab
apps/mobile/app/(health)/readiness.tsx      -- Readiness detail/history screen
```

### Wireframe Position

```
Hub Dashboard
  └── MyHealth card
       └── Today tab
            └── Readiness Score card ← YOU ARE HERE (prominent top position)
                 ├── Score circle (0-100)
                 ├── Factor breakdown
                 └── Recommendation text
```

### Data Model

```sql
CREATE TABLE IF NOT EXISTS hl_readiness_scores (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,          -- One score per day
  score INTEGER NOT NULL,             -- 0-100 composite
  sleep_factor REAL NOT NULL,         -- 0-1 weight contribution from sleep
  hrv_factor REAL NOT NULL,           -- 0-1 weight contribution from HRV
  rhr_factor REAL NOT NULL,           -- 0-1 weight contribution from resting HR
  activity_factor REAL NOT NULL,      -- 0-1 weight contribution from activity load
  strain_factor REAL NOT NULL,        -- 0-1 weight from previous day workout strain
  recommendation TEXT NOT NULL,       -- 'rest' | 'light' | 'moderate' | 'intense'
  data_completeness REAL NOT NULL,    -- 0-1 how much input data was available
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS hl_readiness_date_idx ON hl_readiness_scores(date);
```

### Dependencies
- **Internal:** `@mylife/db`, hl_vitals (resting HR, HRV), hl_sleep_sessions (sleep quality/duration), wk_sessions (workout strain from workouts module)
- **External:** None (uses data already in the database)
- **Cross-Module:** Reads from Health (vitals, sleep), Workouts (session strain), and potentially Cycle (luteal phase adjustment). This is the most cross-module feature in the system.

## Functional Requirements

### User Stories
1. As a fitness-conscious user, I want a daily readiness score so I know if I should train hard or rest.
2. As a user, I want to see which factors contributed to my score so I can understand what's affecting my recovery.
3. As a user, I want to see my readiness trend over time so I can spot overtraining.

### Behavior Specification

**Score calculation (runs daily on app open):**
1. System checks if today's score has already been calculated
2. If not, collects input data from last 24 hours:
   - Sleep: duration, quality score, deep sleep %, from hl_sleep_sessions
   - HRV: latest reading, 7-day trend direction, from hl_vitals (type='hrv')
   - Resting HR: latest reading, 7-day baseline comparison, from hl_vitals (type='resting_heart_rate')
   - Activity: yesterday's active energy and workout count from hl_vitals/wk_sessions
   - Strain: yesterday's workout volume/intensity from wk_sessions
3. Each factor is normalized to 0-1:
   - Sleep factor: (actual_hours / target_hours) capped at 1.0, weighted by quality score
   - HRV factor: today's HRV as percentile of user's 30-day range
   - RHR factor: inverse of deviation from 7-day baseline (lower RHR = higher score)
   - Activity factor: moderate activity yesterday = 1.0, none or excessive = lower
   - Strain factor: inverse of yesterday's workout strain (rest after hard day)
4. Composite score = weighted sum:
   - Sleep: 35%
   - HRV: 25%
   - RHR: 15%
   - Activity: 15%
   - Strain: 10%
5. Score mapped to 0-100 integer
6. Recommendation derived from score:
   - 80-100: "intense" (green, great day to push hard)
   - 60-79: "moderate" (yellow, normal training OK)
   - 40-59: "light" (orange, easy activity recommended)
   - 0-39: "rest" (red, recovery day)
7. Data completeness = fraction of input data types that had available data (e.g., if HRV missing, completeness = 0.8)

**Viewing the score:**
1. Today tab shows a prominent readiness card at the top
2. Score displayed in a circular gauge: number in center, colored ring (green/yellow/orange/red)
3. Below score: recommendation text ("Great day to push hard!" / "Take it easy today")
4. Factor breakdown: 5 mini bars showing each factor's contribution
5. Data completeness indicator: "Based on 4 of 5 factors" if any input is missing

**Score history:**
1. Tapping the readiness card opens a detail/history screen
2. 7-day trend chart showing daily scores
3. 30-day average
4. Factor trend (which factors are consistently low)

### Edge Cases

- **No sleep data:** Sleep factor defaults to 0.5 (neutral). Data completeness reduced.
- **No HRV data:** HRV factor defaults to 0.5. Data completeness reduced.
- **No RHR data:** RHR factor defaults to 0.5. Data completeness reduced.
- **No workout data:** Strain factor defaults to 0.8 (assumes rest day is good). Activity factor = 0.5.
- **All data missing:** Score = 50 (neutral) with data_completeness = 0. Message: "Not enough data to calculate an accurate score. Log sleep, vitals, or connect HealthKit."
- **First day (no history):** Use population defaults for baselines (RHR ~70, HRV ~40ms) until 7 days of data accumulates.
- **Score already calculated today:** Return cached score. Recalculate only if user taps "Refresh."
- **Module disabled:** Scores preserved. Re-enabling resumes daily calculation.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Readiness score card appears prominently at the top of the Today tab
- [ ] **AC-2:** Score displays as a colored circular gauge (0-100) with appropriate color (green/yellow/orange/red)
- [ ] **AC-3:** Recommendation text matches the score range
- [ ] **AC-4:** Factor breakdown shows 5 labeled bars with individual contributions
- [ ] **AC-5:** Missing data factors are shown as "No data" with neutral contribution
- [ ] **AC-6:** Tapping the card opens a detail screen with 7-day trend chart
- [ ] **AC-7:** Score recalculates on first app open of the day
- [ ] **AC-8:** Data completeness indicator shows how many factors had data

### Technical Criteria
- [ ] **TC-1:** hl_readiness_scores table created by migration
- [ ] **TC-2:** Score calculation uses correct weights (35/25/15/15/10)
- [ ] **TC-3:** Factor normalization produces values in 0-1 range
- [ ] **TC-4:** Score is cached per day (one score per date, UNIQUE constraint)
- [ ] **TC-5:** Missing input factors default to 0.5 (neutral) and reduce data_completeness
- [ ] **TC-6:** Recommendation mapping is correct for all 4 score ranges
- [ ] **TC-7:** 7-day baseline for RHR uses rolling average from hl_vitals

### Negative Criteria
- [ ] **NC-1:** Readiness score must NOT replace or conflict with existing health goals
- [ ] **NC-2:** Score must NOT be presented as medical advice
- [ ] **NC-3:** Missing data must NOT produce a misleadingly high or low score (defaults to neutral 0.5)

## UI Specification

### Mobile (Expo)
- **Score card:** Large glass card, top of Today tab. Circular gauge in center: ring colored by score zone. Number in `#F0F0F5`, 48px bold. Recommendation text below, 16px `rgba(240,240,245,0.65)`.
- **Color zones:** 80-100 `#30D158` (success), 60-79 `#FFD60A` (yellow), 40-59 `#FF9F0A` (orange), 0-39 `#FF453A` (danger)
- **Factor bars:** 5 horizontal bars in glass card. Each bar fills proportionally to factor value. Label left, value right.
- **Detail screen:** 7-day line chart in `#10B981` accent. Score dots color-coded by zone.

### Web (Next.js)
- Same tokens. Score card on `/health` dashboard.
- `/health/readiness` for detail/history.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Calculating | Spinning indicator in score ring | First open of the day |
| Complete data | Full score with all 5 factors | All input data available |
| Partial data | Score with "Based on X of 5 factors" note | Some inputs missing |
| No data | "Not enough data" message with CTA | All inputs missing |
| History | 7-day trend chart | Tap score card |

## Test Requirements

### Unit Tests
- [ ] `calculateReadinessScore`: returns 80+ with excellent sleep, high HRV, low RHR
- [ ] `calculateReadinessScore`: returns below 40 with poor sleep, low HRV, high RHR
- [ ] `calculateReadinessScore`: returns 50 with all missing data (all factors default 0.5)
- [ ] `normalizeSleepFactor`: 8hrs of 8hr target = 1.0
- [ ] `normalizeSleepFactor`: 4hrs of 8hr target = 0.5
- [ ] `normalizeHrvFactor`: HRV at 90th percentile of 30-day range = ~0.9
- [ ] `normalizeRhrFactor`: RHR 5bpm below baseline = high score
- [ ] `getRecommendation`: score 85 = 'intense'
- [ ] `getRecommendation`: score 45 = 'light'
- [ ] `calculateDataCompleteness`: 4 of 5 factors present = 0.8

### Integration Tests
- [ ] Full flow: log sleep + log HRV + log RHR -> readiness score calculated -> card displays
- [ ] Partial data flow: only sleep logged -> score calculated with 3 neutral defaults -> completeness = 0.4

### QA Verification Script

1. Open app, log 8 hours of sleep with quality score 85
2. Log resting heart rate of 58 bpm
3. Log HRV of 55 ms
4. Navigate to MyHealth > Today tab
5. Verify: Readiness score card appears at top -- corresponds to AC-1
6. Verify: Score is in green zone (should be 70+) with colored ring -- corresponds to AC-2
7. Verify: Recommendation says something like "Great day for training" -- corresponds to AC-3
8. Verify: Factor breakdown shows 5 bars -- corresponds to AC-4
9. Delete HRV data, refresh
10. Verify: HRV bar shows "No data" -- corresponds to AC-5
11. Tap the readiness card
12. Verify: Detail screen with 7-day chart opens -- corresponds to AC-6

## gstack Quality Gates

Based on Complexity 2 (Inverse), this feature is "Large" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for readiness calculation

### Post-merge:
- [ ] `/parity-check` -- health has no standalone counterpart (skip)

## Handoff State

### Before This Work
Health module tracks vitals, sleep, and goals independently. No composite health score exists. Users must interpret raw numbers themselves.

### After This Work
- Daily readiness score engine with 5-factor weighted algorithm
- Score persistence with one-per-day caching
- Color-coded circular gauge on Today tab
- Factor breakdown visualization
- 7-day trend history
- Graceful degradation with missing data

### Files Changed
- `modules/health/src/readiness/engine.ts` -- Score calculation algorithm
- `modules/health/src/readiness/types.ts` -- Score and factor types
- `modules/health/src/readiness/crud.ts` -- Score persistence
- `modules/health/src/db/schema.ts` -- hl_readiness_scores table
- `modules/health/src/definition.ts` -- Migration version bump
- `modules/health/src/index.ts` -- Export readiness functions
- `apps/mobile/app/(health)/today.tsx` -- Readiness card
- `apps/mobile/app/(health)/readiness.tsx` -- Detail/history screen

### Known Limitations
- No machine learning (uses fixed weighted formula)
- No menstrual cycle adjustment (could add luteal phase modifier later)
- No altitude/travel adjustment
- Baselines use population defaults for first 7 days

### Context for Next Agent
- The score formula weights (35/25/15/15/10) are intentionally simple and opinionated. Do not add complexity.
- Missing data defaults to 0.5 (neutral), not 0 (pessimistic). This prevents scaring users with low scores when they simply haven't logged data.
- The readiness score should be computed lazily on app open, not on a background timer. Cache per-day with the UNIQUE constraint on date.
- Read HRV and RHR from hl_vitals where vital_type IN ('hrv', 'resting_heart_rate'). Read sleep from hl_sleep_sessions. Read workouts from wk_sessions if module is enabled.
