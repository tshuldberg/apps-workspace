# Feature Spec: Blood Oxygen Tracking

## Metadata
- **Module:** health
- **Priority Score:** 31 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 2 x3 + Complexity 3 x2 + CrossModule 2 x1 + PaidUser 2 x1
- **Sprint:** 5
- **Estimated CC Time:** 2-3 hours
- **Depends On:** HealthKit integration (primary data source)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Blood oxygen saturation (SpO2) tracking became mainstream during COVID-19 and remains a standard feature in Apple Health and Google Fit. Apple Watch Series 6+ measures SpO2. MyHealth already stores blood oxygen in hl_vitals (vital_type='blood_oxygen') but has no dedicated visualization, trend analysis, or alerts. This feature elevates SpO2 from a raw number to a useful health metric with context and trends.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Apple Health | Yes | Free | SpO2 chart, nightly measurements from Apple Watch |
| Google Fit | Yes | Free | Blood oxygen readings with trends |
| Masimo | Yes | $149 device | FDA-cleared pulse oximeter with dedicated app |
| Withings | Yes | Yes ($99.95/yr) | SpO2 via ScanWatch with sleep apnea detection |

### Target User
Apple Watch users who want to understand their SpO2 readings, especially overnight measurements. Users concerned about respiratory health or sleep apnea who want to track trends and spot anomalies.

## Technical Context

### Where This Lives in MyLife

```
modules/health/src/spo2/analysis.ts         -- SpO2 trend analysis engine
modules/health/src/spo2/types.ts            -- SpO2 analysis types
modules/health/src/index.ts                 -- Export SpO2 analysis functions
apps/mobile/app/(health)/vital-detail.tsx   -- Enhanced SpO2 visualization
```

### Wireframe Position

```
Hub Dashboard
  └── MyHealth card
       └── Vitals tab
            └── Blood Oxygen section
                 └── SpO2 Detail ← YOU ARE HERE
                      ├── Current reading with context
                      ├── 30-day trend chart
                      ├── Overnight readings chart
                      └── Alert if consistently low
```

### Data Model

No new tables. SpO2 data is already stored in `hl_vitals` with `vital_type='blood_oxygen'`. Unit is percentage (%). This feature adds analysis and visualization.

**New types:**

```typescript
export interface Spo2Analysis {
  latestReading: number;        // % (e.g., 97)
  overnightAverage: number | null;
  thirtyDayAverage: number;
  lowestReading: number;
  category: 'normal' | 'borderline' | 'low';
  trend: 'stable' | 'declining' | 'improving';
  alertMessage: string | null;  // Non-null if consistently below 95%
}
```

### Dependencies
- **Internal:** `@mylife/db`, hl_vitals (vital_type='blood_oxygen'), HealthKit for data source
- **External:** None
- **Cross-Module:** Wellness timeline shows SpO2 readings. Readiness score could incorporate SpO2 as a factor.

## Functional Requirements

### User Stories
1. As a user, I want to see my SpO2 trend over 30 days so I can monitor respiratory health.
2. As a user, I want overnight SpO2 readings highlighted so I can detect sleep-related oxygen dips.
3. As a user, I want an alert if my SpO2 is consistently below normal.

### Behavior Specification

**SpO2 detail view:**
1. User taps blood oxygen card on Vitals tab
2. Detail screen shows:
   a. **Current/latest reading:** Large percentage with color-coded category
   b. **Category:**
      - Normal: 95-100% (green)
      - Borderline: 90-94% (yellow)
      - Low: <90% (red, with alert)
   c. **30-day chart:** Line chart with readings over time
   d. **Overnight chart:** Subset of readings during sleep hours (10 PM - 7 AM) highlighted
   e. **30-day average** and **lowest reading** stats
3. If consistently below 95% for 7+ days: alert banner "Your blood oxygen has been below normal for [N] days. Consider consulting a healthcare provider."

**Manual entry:**
1. User can log SpO2 reading manually from the Vitals tab
2. Input: percentage (whole number 70-100)
3. Stored in hl_vitals with source='manual'

### Edge Cases

- **No SpO2 data:** Empty state with "Connect Apple Health to track blood oxygen" CTA.
- **Single reading:** Show value without trend or average.
- **Reading below 70%:** Likely a sensor error. Display but flag: "This reading may be inaccurate."
- **All readings above 95%:** No alert. Just show "Normal" category.
- **Mixed manual and HealthKit:** Display all. Source badge on each.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** SpO2 detail screen shows latest reading with color-coded category
- [ ] **AC-2:** 30-day trend chart displays with readings over time
- [ ] **AC-3:** Overnight readings are highlighted or shown in separate chart
- [ ] **AC-4:** Alert banner appears if SpO2 consistently below 95% for 7+ days
- [ ] **AC-5:** Manual SpO2 entry works with validation (70-100%)
- [ ] **AC-6:** 30-day average and lowest reading stats displayed
- [ ] **AC-7:** Empty state shown with HealthKit CTA when no data exists

### Technical Criteria
- [ ] **TC-1:** `analyzeSpo2` correctly calculates average and identifies trend
- [ ] **TC-2:** Category thresholds: 95+ normal, 90-94 borderline, <90 low
- [ ] **TC-3:** Alert triggers only after 7+ consecutive below-95 days
- [ ] **TC-4:** Overnight filter correctly identifies readings between 10 PM - 7 AM
- [ ] **TC-5:** Manual entry validates range 70-100%

### Negative Criteria
- [ ] **NC-1:** Must NOT claim to diagnose sleep apnea or respiratory conditions
- [ ] **NC-2:** Alert must NOT use panic-inducing language (informational, not emergency)

## UI Specification

### Mobile (Expo)
- **Current reading:** Large percentage in `#F0F0F5`. Category badge: normal `#30D158`, borderline `#FFD60A`, low `#FF453A`.
- **Trend chart:** Line chart in `#3B82F6`. Normal zone (95-100%) shaded green at 10% opacity.
- **Overnight highlight:** Different dot color or background shade on the chart.
- **Alert banner:** `rgba(255,69,58,0.15)` background with warning icon.

### Web (Next.js)
- `/health/vitals/spo2` route. Same chart design.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No data | Empty state + HealthKit CTA | No SpO2 readings |
| Normal | Green category, no alert | Readings 95-100% |
| Borderline | Yellow category, no alert | Readings 90-94% |
| Low alert | Red category + alert banner | Below 95% for 7+ days |

## Test Requirements

### Unit Tests
- [ ] `analyzeSpo2`: normal category for avg 97%
- [ ] `analyzeSpo2`: borderline for avg 93%
- [ ] `analyzeSpo2`: low for avg 88%
- [ ] `shouldAlert`: true when 7+ consecutive days below 95
- [ ] `shouldAlert`: false when fewer than 7 days below 95
- [ ] `getOvernightReadings`: filters to 10 PM - 7 AM correctly
- [ ] `validateSpo2Input`: accepts 70-100, rejects 69 and 101

### Integration Tests
- [ ] Full flow: sync SpO2 from HealthKit -> chart renders -> category correct
- [ ] Alert flow: 7 days of low readings -> alert banner appears

### QA Verification Script

1. Log SpO2 readings for 3 days: 97%, 96%, 98%
2. Navigate to MyHealth > Vitals > Blood Oxygen
3. Verify: Latest reading (98%) with "Normal" green badge -- corresponds to AC-1
4. Verify: 3-point chart visible -- corresponds to AC-2
5. Verify: Stats show avg 97% and lowest 96% -- corresponds to AC-6
6. Log 7 days of readings at 93%
7. Verify: Alert banner appears -- corresponds to AC-4
8. Log a manual reading
9. Verify: Accepted with validation -- corresponds to AC-5

## gstack Quality Gates

Based on Complexity 3 (Inverse), this feature is "Medium" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Post-merge:
- [ ] `/parity-check` -- skip (no standalone)

## Handoff State

### Before This Work
Blood oxygen stored as raw values in hl_vitals with no dedicated analysis or visualization.

### After This Work
- SpO2 analysis engine with categories, trends, and alerts
- Enhanced vital-detail screen for SpO2 with overnight highlighting
- Alert system for consistently low readings
- Manual entry with validation

### Files Changed
- `modules/health/src/spo2/analysis.ts` -- New: SpO2 analysis engine
- `modules/health/src/spo2/types.ts` -- New: Spo2Analysis type
- `modules/health/src/index.ts` -- Export SpO2 functions
- `apps/mobile/app/(health)/vital-detail.tsx` -- Enhanced for SpO2

### Known Limitations
- No sleep apnea detection algorithm
- No FDA-cleared accuracy claims
- Overnight filtering uses fixed hours (10 PM - 7 AM), not actual sleep session times
- No trend predictions

### Context for Next Agent
- SpO2 data lives in hl_vitals WHERE vital_type='blood_oxygen'. Unit is '%'.
- Do NOT use medical terminology or claim diagnostic capability. Use "Consider consulting a healthcare provider" not "You may have a condition."
- Category thresholds (95/90) are WHO-based but simplified for consumer use.
- The vital-detail screen already exists and is shared with HRV; detect vital_type and render appropriate analysis.
