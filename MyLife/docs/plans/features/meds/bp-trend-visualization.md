# Feature Spec: BP Trend Visualization

## Metadata
- **Module:** meds
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 3 x3 + Complexity 3 x2 + CrossModule 3 x1 + PaidUser 3 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Blood pressure logging improvements (A-Tier, 36/50, built -- `md_bp_readings` table, BP engine with AHA classification)
- **Blocks:** none

## Business Context

### Why This Feature Exists
BP trend visualization transforms raw blood pressure data into actionable visual insights. CareClinic ($119.88/yr) positions their BP trend charts with AHA zone overlays as a premium differentiator that justifies their high price point. The BP logging infrastructure already exists in MyLife (V3 migration: `md_bp_readings` with systolic, diastolic, pulse, AHA category, context). This feature adds the visualization layer: time-series line charts with AHA zone bands, medication start/stop markers, statistical summaries, and period comparison. It turns the meds module from a data entry tool into a clinical-grade BP dashboard that patients can show their doctor.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| CareClinic | Yes | Yes ($119.88/yr) | Line chart with AHA zone color bands, 7/30/90-day views, medication correlation markers, PDF export. |
| Blood Pressure Monitor | Yes | Partial ($12.99/yr) | Simple line chart, average display, no medication markers. |
| Medisafe | Partial | Free (basic) | Basic list history. No trend charts. |
| MyTherapy | No | N/A | No BP visualization. Lists only. |
| SmartBP | Yes | Yes ($9.99/yr) | Scatter plot with AHA zones, statistics, Apple Health sync. |

### Target User
Hypertension patients (1.28B adults globally, 47% of US adults) who take daily BP medications and need to track whether their readings are trending toward normal. Specifically: CareClinic users paying $119.88/yr or SmartBP users paying $9.99/yr who want BP trend visualization integrated with their medication adherence tracker. Migration path: same visual BP insights with medication correlation, no separate app needed.

## Technical Context

### Where This Lives in MyLife

```
modules/meds/src/
  bp/
    engine.ts                      -- MODIFY: Add trend analysis, period stats, AHA zone helpers
    __tests__/engine.test.ts       -- MODIFY: Add trend analysis tests
  models/
    bp-reading.ts                  -- MODIFY: Add trend-specific types (BPTrendPoint, PeriodStats)
apps/mobile/app/(meds)/
  bp-trends.tsx                    -- NEW: BP trend visualization screen
apps/web/app/meds/
  bp/trends/page.tsx               -- NEW: Web BP trend dashboard
```

### Wireframe Position

```
Hub Dashboard
  └── MyMeds card
       ├── Today tab
       │    └── [BP Summary Card with mini sparkline]
       ├── History tab
       │    └── Blood Pressure section
       │         ├── [Recent Readings list]
       │         └── [View Trends] ← YOU ARE HERE
       │              ├── [Period selector: 7d / 30d / 90d / 1yr / all]
       │              ├── [Line chart: systolic + diastolic over time]
       │              │    ├── AHA zone color bands (background)
       │              │    └── Medication start/stop markers (vertical lines)
       │              ├── [Statistics card: avg, min, max, category distribution]
       │              └── [Period comparison: this period vs previous]
       └── Settings tab
            └── [BP target ranges configuration]
```

### Data Model

No new tables required. This feature reads from existing tables:

```sql
-- Reads from (V3, already exists):
-- md_bp_readings: systolic, diastolic, pulse, arm, position, context, category, measured_at
-- md_medications: name, created_at, end_date (for medication markers)
```

New TypeScript types (no schema changes):

```typescript
interface BPTrendPoint {
  date: string;           // ISO date from measured_at
  systolic: number;
  diastolic: number;
  pulse: number | null;
  category: BPCategory;
}

interface BPPeriodStats {
  avgSystolic: number;
  avgDiastolic: number;
  avgPulse: number | null;
  minSystolic: number;
  maxSystolic: number;
  minDiastolic: number;
  maxDiastolic: number;
  readingCount: number;
  categoryDistribution: BPCategoryDistribution;
  trendDirection: 'improving' | 'stable' | 'worsening';
}

interface BPPeriodComparison {
  current: BPPeriodStats;
  previous: BPPeriodStats;
  systolicDelta: number;    // negative = improving
  diastolicDelta: number;
  categoryShift: string;    // "Stage 1 → Normal"
}
```

### Dependencies
- **Internal:** `@mylife/meds` BP engine (`classifyBP`, `calculateBPAverages`, `getCategoryDistribution`, `filterReadingsByPeriod`), measurement trends (`getMeasurementTrendWithMedMarkers`)
- **External:** `victory-native` (mobile charts, already in workspace) or `react-native-svg` with custom paths. `recharts` (web charts). No new dependencies needed.
- **Cross-Module:** Health module can surface BP trend summary via crossModule interface. Workouts module can correlate exercise with BP changes.

## Functional Requirements

### User Stories
1. As a hypertension patient, I want to see my BP readings plotted over time with AHA zone bands so I can visually confirm whether my medication is working.
2. As a patient, I want to see medication start/stop markers on my BP chart so I can correlate medication changes with BP trends.
3. As a patient, I want to compare my current 30-day average to the previous 30 days so I can see if I am improving.
4. As a patient, I want to share my BP trend chart with my doctor so they can see my at-home readings.

### Behavior Specification

1. User navigates to MyMeds -> History tab -> Blood Pressure section
2. User taps "View Trends" button
3. System loads BP readings for the default period (30 days)
4. System renders a dual-line chart:
   a. Blue line: systolic readings over time
   b. Cyan line: diastolic readings over time
   c. Background color bands for AHA zones (green=normal, yellow=elevated, orange=stage 1, red=stage 2, dark red=crisis)
   d. Vertical dashed lines for medication start/stop events (with labels)
5. Below the chart, system shows statistics card:
   a. Average systolic/diastolic/pulse
   b. Min/max for the period
   c. Category distribution donut (% of readings in each AHA zone)
   d. Trend direction indicator (improving/stable/worsening)
6. Below stats, system shows period comparison:
   a. Current period vs previous period of same length
   b. Delta values with color coding (green if improving, red if worsening)
   c. Category shift text (e.g., "Average shifted from Elevated to Normal")
7. User can switch period: 7d / 30d / 90d / 1yr / all
8. User can tap a data point on the chart to see the full reading details (pulse, arm, position, context, notes)
9. User can tap "Share" to export the chart and stats as an image or PDF

### Edge Cases

- Fewer than 2 readings in the selected period: show message "Need at least 2 readings to display trends" with CTA to log a reading
- All readings in the same AHA category: trend direction is "stable"
- No readings in previous comparison period: hide comparison section, show "Not enough data for comparison"
- Readings span different contexts (morning vs evening): trend line shows all; tooltip shows context
- Very old readings (>1yr): "All" period may have sparse data; use weekly averages for long periods to avoid cluttered chart
- Gap in readings (e.g., 2-week vacation): show gap in the line (do not interpolate)
- Module disabled mid-use: chart no longer accessible, data preserved

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Dual-line chart renders systolic (blue) and diastolic (cyan) over time
- [ ] **AC-2:** AHA zone color bands appear as horizontal background regions on the chart
- [ ] **AC-3:** Medication start/stop events appear as labeled vertical dashed lines
- [ ] **AC-4:** Period selector (7d/30d/90d/1yr/all) switches chart data within 200ms
- [ ] **AC-5:** Statistics card shows average, min, max, and category distribution for selected period
- [ ] **AC-6:** Trend direction shows improving (green down arrow), stable (gray dash), or worsening (red up arrow)
- [ ] **AC-7:** Period comparison shows delta between current and previous period with color coding
- [ ] **AC-8:** Tapping a data point shows tooltip with full reading details
- [ ] **AC-9:** Share button exports chart + stats as shareable image
- [ ] **AC-10:** Mini sparkline appears on Today tab BP summary card

### Technical Criteria
- [ ] **TC-1:** `getBPTrendData(period)` queries `md_bp_readings` with correct date range filtering
- [ ] **TC-2:** `getBPPeriodStats(readings)` computes averages, min/max, distribution correctly
- [ ] **TC-3:** `comparePeriods(current, previous)` computes deltas and category shift
- [ ] **TC-4:** Trend direction algorithm: compares first-half average to second-half average of the period
- [ ] **TC-5:** Medication markers query `md_medications` for created_at and end_date within date range
- [ ] **TC-6:** Chart renders correctly with 0, 1, 2, 10, 100, and 1000+ data points
- [ ] **TC-7:** Long periods (>90 days) aggregate to weekly averages for performance

### Negative Criteria
- [ ] **NC-1:** Chart must NOT interpolate across gaps in readings (no connecting line through missing days)
- [ ] **NC-2:** Share export must NOT include any data not visible on screen
- [ ] **NC-3:** Trend visualization must NOT require network access
- [ ] **NC-4:** AHA zone bands must NOT change based on user input (they follow fixed AHA guidelines)

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Chart area: glass card with `rgba(255,255,255,0.04)` fill
- Systolic line: `#06B6D4` (meds accent cyan)
- Diastolic line: `#38BDF8` (lighter cyan)
- AHA zone bands (horizontal, behind chart lines):
  - Normal (<120/<80): `rgba(48, 209, 88, 0.08)` (success green, very transparent)
  - Elevated (120-129/<80): `rgba(255, 214, 10, 0.08)` (iOS yellow)
  - Stage 1 (130-139/80-89): `rgba(255, 159, 10, 0.08)` (iOS orange)
  - Stage 2 (>=140/>=90): `rgba(255, 69, 58, 0.08)` (danger red)
  - Crisis (>180/>120): `rgba(255, 69, 58, 0.15)` (danger red, stronger)
- Medication markers: white dashed vertical lines with small labels
- Period selector: horizontal pill buttons
- Stats card: glass card with 2x2 grid (avg, min/max, distribution, trend)

### Web (Next.js)
- Same tokens via CSS variables
- Route: `/meds/bp/trends`
- Wider chart with mouse hover tooltips (not tap)
- Stats in horizontal row below chart
- Recharts library for rendering

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Chart skeleton + pulsing stats placeholders | Initial data query |
| Empty | "No blood pressure readings yet" + "Log your first reading" CTA | Zero readings |
| Insufficient | "Need at least 2 readings for trends" + single reading summary | Only 1 reading |
| Error | "Could not load BP data" + retry button | Database query fails |
| Success | Full chart + stats + comparison | 2+ readings in period |
| Partial | Chart visible but comparison hidden ("not enough data") | Readings in current but not previous period |

## Test Requirements

### Unit Tests
- [ ] `getBPTrendData`: returns sorted BPTrendPoint[] for date range
- [ ] `getBPTrendData`: returns empty array for period with no readings
- [ ] `getBPPeriodStats`: computes correct averages for mixed-category readings
- [ ] `getBPPeriodStats`: handles single reading (min = max = avg)
- [ ] `calculateTrendDirection`: returns 'improving' when second-half avg < first-half avg
- [ ] `calculateTrendDirection`: returns 'worsening' when second-half avg > first-half avg
- [ ] `calculateTrendDirection`: returns 'stable' when delta < 5 mmHg
- [ ] `comparePeriods`: computes correct systolic/diastolic deltas
- [ ] `comparePeriods`: generates category shift text
- [ ] `aggregateToWeekly`: reduces daily readings to weekly averages for long periods

### Integration Tests
- [ ] Full flow: log 10 readings over 30 days -> view trends -> correct chart and stats
- [ ] Period switch: switch from 30d to 7d -> chart updates with fewer data points

### QA Verification Script

1. Open the app on iOS simulator
2. Navigate to MyMeds
3. Log 5+ BP readings across different days and categories (mix of normal, elevated, stage 1)
4. Navigate to History -> Blood Pressure -> View Trends
5. Verify: dual-line chart shows systolic and diastolic lines -- AC-1
6. Verify: AHA zone color bands visible behind chart lines -- AC-2
7. Add a medication with a start date within the chart period
8. Verify: vertical dashed line appears at medication start date -- AC-3
9. Switch period to 7d, then 90d, then back to 30d
10. Verify: chart updates within 200ms each time -- AC-4
11. Verify: stats card shows correct averages and distribution -- AC-5
12. Verify: trend direction indicator shown with appropriate color -- AC-6
13. Log enough readings to have data in a "previous" period
14. Verify: period comparison shows delta values -- AC-7
15. Tap a data point on the chart
16. Verify: tooltip shows full reading details (systolic, diastolic, pulse, arm, context) -- AC-8
17. Tap Share button
18. Verify: share sheet opens with chart image -- AC-9
19. Navigate back to Today tab
20. Verify: mini sparkline appears in BP summary card -- AC-10
21. Repeat key checks on web at `/meds/bp/trends`

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to `/meds/bp/trends`, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for trend analysis engine

### Post-merge:
- [ ] `/parity-check` -- if module has standalone counterpart

## Handoff State

### Before This Work
The meds module has `md_bp_readings` with structured systolic/diastolic/pulse/category data, a BP engine with AHA classification and averages, and a bp-history screen showing readings as a flat list. No trend visualization exists.

### After This Work
A dedicated BP trend visualization screen shows time-series line charts with AHA zone bands, medication markers, statistical summaries, period comparison, and share functionality. Both mobile and web have the feature.

### Files Changed
- `modules/meds/src/bp/engine.ts` -- Add `getBPTrendData`, `getBPPeriodStats`, `calculateTrendDirection`, `comparePeriods`, `aggregateToWeekly`
- `modules/meds/src/bp/__tests__/engine.test.ts` -- Trend analysis tests
- `modules/meds/src/models/bp-reading.ts` -- Add BPTrendPoint, BPPeriodStats, BPPeriodComparison types
- `apps/mobile/app/(meds)/bp-trends.tsx` -- Mobile trend visualization screen
- `apps/web/app/meds/bp/trends/page.tsx` -- Web trend dashboard
- `modules/meds/src/definition.ts` -- Add bp-trends screen to navigation
- `modules/meds/src/index.ts` -- Export new trend functions

### Known Limitations
- Chart library choice (victory-native vs react-native-svg custom) may affect performance with 1000+ data points. Aggregation to weekly averages mitigates this.
- PDF export is image-based (screenshot), not true PDF rendering with selectable text.
- AHA zone thresholds are fixed. User-configurable BP targets are a future enhancement.

### Context for Next Agent
- The BP engine already has `classifyBP`, `calculateBPAverages`, `getCategoryDistribution`, and `filterReadingsByPeriod`. Build trend analysis on top of these.
- `getMeasurementTrendWithMedMarkers` in `measurements/trends.ts` already queries medication start/stop dates. Reuse that pattern for BP medication markers.
- The existing `bp-history.tsx` screen shows a flat list. The new `bp-trends.tsx` is a sibling screen, not a replacement. Link from bp-history to bp-trends.
