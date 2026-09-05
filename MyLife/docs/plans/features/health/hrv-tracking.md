# Feature Spec: HRV Tracking

## Metadata
- **Module:** health
- **Priority Score:** 32 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 2 x3 + Complexity 3 x2 + CrossModule 3 x1 + PaidUser 2 x1
- **Sprint:** 5
- **Estimated CC Time:** 2-3 hours
- **Depends On:** HealthKit integration (primary data source for HRV)
- **Blocks:** Readiness score (HRV factor)

## Business Context

### Why This Feature Exists
Heart Rate Variability (HRV) is a key indicator of autonomic nervous system health and recovery. Higher HRV generally indicates better cardiovascular fitness and lower stress. Apple Watch measures HRV nightly. MyHealth already stores HRV in hl_vitals (vital_type='hrv') but has no dedicated visualization, trend analysis, or contextual insights. This feature elevates HRV from a raw number to an actionable health metric.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Apple Health | Yes | Free | HRV chart, nightly measurements from Apple Watch |
| Whoop | Yes | Yes ($30/mo) | HRV as core recovery metric, trend and baseline |
| Oura | Yes | Yes ($5.99/mo) | Nightly HRV with readiness integration |
| Elite HRV | Yes | Freemium | Dedicated HRV app, morning readiness protocol |

### Target User
Users with Apple Watch who want to understand their HRV trends and what they mean for recovery, stress, and fitness. Athletes who use HRV to guide training intensity.

## Technical Context

### Where This Lives in MyLife

```
modules/health/src/hrv/analysis.ts          -- HRV trend analysis engine
modules/health/src/hrv/types.ts             -- HRV analysis types
modules/health/src/index.ts                 -- Export HRV analysis functions
apps/mobile/app/(health)/vital-detail.tsx   -- Enhanced HRV visualization
```

### Wireframe Position

```
Hub Dashboard
  └── MyHealth card
       └── Vitals tab
            └── HRV section
                 └── HRV Detail ← YOU ARE HERE
                      ├── Current HRV with context
                      ├── 30-day trend chart
                      ├── Baseline calculation
                      └── Recovery insights
```

### Data Model

No new tables. HRV data is already stored in `hl_vitals` with `vital_type='hrv'`. This feature adds analysis functions and enhanced visualization.

**New types:**

```typescript
export interface HrvAnalysis {
  currentValue: number;         // Latest HRV reading (ms)
  baseline: number;             // 30-day average
  percentileRank: number;       // Today's value as percentile of 30-day range
  trend: 'improving' | 'stable' | 'declining';
  trendDelta: number;           // Change from 7-day ago average to latest 7-day avg
  category: 'low' | 'below_average' | 'average' | 'above_average' | 'high';
  insight: string;              // Human-readable insight
}
```

### Dependencies
- **Internal:** `@mylife/db`, hl_vitals (vital_type='hrv'), HealthKit sync for data source
- **External:** None
- **Cross-Module:** Readiness score uses HRV as a factor. Wellness timeline shows HRV readings.

## Functional Requirements

### User Stories
1. As a user, I want to see my HRV trend over time so I can understand my recovery trajectory.
2. As a user, I want my HRV compared to my own baseline so I know if today is above or below normal.
3. As a user, I want actionable insights based on my HRV ("Recovery looks good" or "Take it easy today").

### Behavior Specification

**HRV detail view:**
1. User navigates to Vitals tab > HRV card (or taps HRV on Today tab)
2. Detail screen shows:
   a. **Current HRV:** Large number with unit (ms), colored by category
   b. **Baseline:** 30-day average as reference line
   c. **Percentile rank:** "Higher than 75% of your readings"
   d. **Trend chart:** 30-day line chart with baseline as dashed line
   e. **Insight text:** Contextual message based on analysis
3. Category thresholds (personalized to user's baseline):
   - High: >1.2x baseline
   - Above average: 1.0-1.2x baseline
   - Average: 0.8-1.0x baseline
   - Below average: 0.6-0.8x baseline
   - Low: <0.6x baseline
4. Trend direction: compare 7-day average to previous 7-day average

**Insights engine:**
- High HRV + good sleep: "Great recovery. Your body is ready for intense training."
- Low HRV + poor sleep: "Recovery is low. Consider a rest day or light activity."
- Declining trend: "Your HRV has been trending down this week. Watch for overtraining."
- Improving trend: "HRV is improving. Your recovery habits are paying off."

### Edge Cases

- **Fewer than 7 readings:** Show readings without trend/baseline. Message: "Keep tracking for personalized insights (need 7+ days)."
- **No HRV data at all:** Show empty state with "Connect Apple Health to track HRV automatically."
- **Single daily reading vs multiple:** Use the overnight/morning reading if available (lowest recorded_at for the day). If multiple, use the lowest (most rested state).
- **HRV = 0:** Invalid reading, skip/ignore.
- **Very high HRV (200+ms):** Valid in young athletic individuals. No cap.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** HRV detail screen shows current value with color-coded category
- [ ] **AC-2:** 30-day baseline is displayed as a reference value
- [ ] **AC-3:** 30-day trend chart shows HRV readings with baseline dashed line
- [ ] **AC-4:** Percentile rank is displayed ("Higher than X% of your readings")
- [ ] **AC-5:** Contextual insight text is shown based on current HRV and trend
- [ ] **AC-6:** Trend direction indicator (improving/stable/declining) is visible
- [ ] **AC-7:** Empty state shown when no HRV data exists with HealthKit CTA

### Technical Criteria
- [ ] **TC-1:** Baseline calculation uses 30-day rolling average correctly
- [ ] **TC-2:** Percentile rank is calculated against user's own 30-day range
- [ ] **TC-3:** Category thresholds are personalized to user's baseline (not fixed values)
- [ ] **TC-4:** Trend uses 7-day vs previous 7-day comparison
- [ ] **TC-5:** Multiple daily readings resolved to lowest (resting) value

### Negative Criteria
- [ ] **NC-1:** HRV analysis must NOT claim diagnostic medical value
- [ ] **NC-2:** Must NOT use population-based norms (personalized to user's own data only)

## UI Specification

### Mobile (Expo)
- **Current value:** Large number in `#F0F0F5`, category badge color-coded. High=`#30D158`, Above avg=`#10B981`, Average=`#FFD60A`, Below avg=`#FF9F0A`, Low=`#FF453A`.
- **Trend chart:** Line chart in `#10B981`, baseline as dashed `rgba(240,240,245,0.65)`. Area fill below line at 10% opacity.
- **Insight card:** Glass card with insight text. Icon changes based on category.

### Web (Next.js)
- `/health/vitals/hrv` route. Same chart with responsive width.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No data | Empty state + HealthKit CTA | No HRV readings |
| Insufficient | Readings without trend | <7 readings |
| Full | Complete analysis with trend and insights | 7+ readings |

## Test Requirements

### Unit Tests
- [ ] `calculateHrvBaseline`: 30-day average from hl_vitals
- [ ] `calculateHrvBaseline`: handles fewer than 30 days
- [ ] `getHrvPercentile`: value at median of range returns ~50
- [ ] `getHrvCategory`: 1.3x baseline = 'high'
- [ ] `getHrvCategory`: 0.5x baseline = 'low'
- [ ] `getHrvTrend`: increasing 7-day avg = 'improving'
- [ ] `generateHrvInsight`: low HRV returns rest recommendation
- [ ] `resolveDaily HRV`: multiple readings returns lowest

### Integration Tests
- [ ] Full flow: 7 days of HRV data -> analysis shows baseline + trend + insight

### QA Verification Script

1. Log HRV readings for 7 days (values: 35, 40, 38, 42, 45, 41, 43)
2. Navigate to MyHealth > Vitals > HRV
3. Verify: Current value (43ms) with colored category -- corresponds to AC-1
4. Verify: Baseline (~40.6ms) displayed -- corresponds to AC-2
5. Verify: 30-day chart with baseline line -- corresponds to AC-3
6. Verify: Percentile rank shown -- corresponds to AC-4
7. Verify: Insight text appropriate to the reading -- corresponds to AC-5
8. Verify: Trend indicator visible -- corresponds to AC-6

## gstack Quality Gates

Based on Complexity 3 (Inverse), this feature is "Medium" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for HRV analysis

### Post-merge:
- [ ] `/parity-check` -- skip (no standalone)

## Handoff State

### Before This Work
HRV is stored as raw values in hl_vitals with no dedicated analysis, trending, or insights.

### After This Work
- HRV analysis engine with personalized baseline, percentile, trend, category, and insights
- Enhanced vital-detail screen for HRV with trend chart and contextual insight text
- Integration-ready for readiness score

### Files Changed
- `modules/health/src/hrv/analysis.ts` -- New: HRV analysis engine
- `modules/health/src/hrv/types.ts` -- New: HrvAnalysis type
- `modules/health/src/index.ts` -- Export HRV functions
- `apps/mobile/app/(health)/vital-detail.tsx` -- Enhanced for HRV

### Known Limitations
- No real-time HRV measurement from phone camera (requires wearable)
- No morning readiness protocol (single reading, not guided session)
- No HRV during exercise (resting HRV only)

### Context for Next Agent
- HRV data lives in hl_vitals WHERE vital_type='hrv'. Unit is milliseconds (ms).
- Use personalized baselines (user's own 30-day avg), NOT population norms. A 20-year-old athlete might baseline at 80ms while a 50-year-old might baseline at 25ms. Both are valid.
- For daily resolution, pick the lowest HRV reading of the day (represents resting state, typically overnight measurement from Apple Watch).
- The vital-detail screen already exists; this feature enhances it when showing HRV specifically.
