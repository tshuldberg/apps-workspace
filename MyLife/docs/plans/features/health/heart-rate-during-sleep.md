# Feature Spec: Heart Rate During Sleep

## Metadata
- **Module:** health
- **Priority Score:** 29 / 50 (B-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 2 x3 + Complexity 3 x2 + CrossModule 3 x1 + PaidUser 2 x1
- **Sprint:** 6
- **Estimated CC Time:** 2-3 hours
- **Depends On:** HealthKit integration (primary data source), Sleep stage analysis (sleep session context)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Heart rate during sleep is a core sleep insight offered by Apple Health, Google Fit, Oura, and Whoop. Users with Apple Watch already have this data collected nightly, but MyHealth currently only stores raw HR readings in hl_vitals without correlating them to sleep sessions. This feature overlays heart rate data onto sleep sessions, showing resting HR, HR dips during deep sleep, and anomalous spikes. It transforms sleep tracking from "how long did I sleep" to "how well did my body recover."

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Apple Health | Yes | Free | Heart rate chart overlaid on sleep stages, nightly resting HR |
| Oura | Yes | Yes ($5.99/mo) | Nighttime HR curve, lowest HR, HR variability during sleep |
| Whoop | Yes | Yes ($30/mo) | Sleep HR with recovery metrics, HR during each stage |
| Sleep Cycle | Yes | Yes ($39.99/yr) | Heart rate chart alongside sleep analysis |
| AutoSleep | Yes | $8 one-time | HR dip detection, deep sleep HR correlation |

### Target User
Apple Watch users who want to understand their heart rate behavior during sleep. Fitness-conscious users who use nighttime HR as a recovery signal. Users already tracking sleep in MyHealth who want the missing dimension of cardiac data overlaid on their sleep sessions.

## Technical Context

### Where This Lives in MyLife

```
modules/health/src/sleep/hr-analysis.ts     -- Sleep HR analysis engine
modules/health/src/sleep/types.ts           -- Extended with sleep HR types
modules/health/src/index.ts                 -- Export sleep HR functions
apps/mobile/app/(health)/sleep-detail.tsx   -- HR chart on sleep detail screen
apps/web/app/health/sleep/[id]/page.tsx     -- Web sleep detail with HR overlay
```

### Wireframe Position

```
Hub Dashboard
  +-- MyHealth card
       +-- Vitals tab
            +-- Sleep section
                 +-- Sleep Detail (tap a session)
                      +-- Heart Rate During Sleep <-- YOU ARE HERE
                           |-- HR curve chart (overlaid on hypnogram)
                           |-- Lowest HR with timestamp
                           |-- Average sleeping HR
                           +-- HR by stage comparison
```

### Data Model

No new tables. This feature reads existing data from two tables:

1. `hl_sleep_sessions` -- provides the sleep window (start_time, end_time, stage data)
2. `hl_vitals` where `vital_type = 'heart_rate'` -- provides individual HR readings within the sleep window

**New types (no schema change):**

```typescript
export interface SleepHeartRatePoint {
  timestamp: string;        // ISO datetime
  bpm: number;              // Heart rate value
  stage: 'deep' | 'rem' | 'light' | 'awake' | null;  // Sleep stage at that time
}

export interface SleepHeartRateAnalysis {
  averageBpm: number;           // Average HR across entire sleep session
  lowestBpm: number;            // Minimum HR reading
  lowestBpmAt: string;          // Timestamp of lowest reading
  highestBpm: number;           // Maximum HR reading
  restingBpm: number | null;    // Latest resting HR from hl_vitals for comparison
  hrDip: number;                // Percentage dip from daytime average to sleep average
  dataPoints: SleepHeartRatePoint[];  // All HR readings within sleep window
  stageAverages: {
    deep: number | null;
    rem: number | null;
    light: number | null;
    awake: number | null;
  };
}
```

### Dependencies
- **Internal:** `@mylife/db`, hl_vitals (heart_rate readings), hl_sleep_sessions (sleep windows), sleep stage analysis (for stage overlay)
- **External:** None (uses data already synced from HealthKit)
- **Cross-Module:** Readiness score uses resting HR as a factor. Wellness timeline shows HR events. HRV tracking provides related recovery context.

## Functional Requirements

### User Stories
1. As a user, I want to see my heart rate curve during sleep so I can understand how my body recovers at night.
2. As a user, I want to know my lowest heart rate and when it occurred so I can identify my deepest recovery point.
3. As a user, I want to compare my HR across sleep stages to understand the relationship between sleep depth and heart rate.
4. As a user, I want to see how much my HR dips during sleep compared to my daytime average so I can gauge recovery quality.

### Behavior Specification

**Viewing sleep HR:**
1. User navigates to Vitals > Sleep and taps a sleep session to see detail
2. Sleep detail screen already shows duration, quality, and stage breakdown (from sleep stage analysis feature)
3. Below the hypnogram, a new "Heart Rate" section shows:
   a. **HR curve chart:** Line chart of BPM over time, x-axis = sleep window, colored by sleep stage
   b. **Summary stats card:**
      - Average sleeping HR (e.g., "52 bpm avg")
      - Lowest HR (e.g., "48 bpm at 3:42 AM")
      - HR dip (e.g., "18% below daytime avg")
   c. **Stage comparison card:**
      - Average HR per stage in horizontal bars (Deep: 48, REM: 56, Light: 54, Awake: 65)
      - Color-coded to match stage colors

**Data collection:**
1. HR data comes from hl_vitals where vital_type='heart_rate' and recorded_at falls between sleep session start_time and end_time
2. If no HR data exists within the sleep window, show "No heart rate data for this session. Connect Apple Watch via HealthKit to see sleep heart rate."
3. If HR data exists but no stage data, show the HR curve without stage coloring (plain line)

**HR dip calculation:**
1. Collect daytime HR readings: hl_vitals heart_rate readings NOT within any sleep window from the past 7 days
2. Calculate average daytime HR
3. Calculate average sleeping HR from the current session
4. Dip = ((daytime_avg - sleep_avg) / daytime_avg) * 100
5. Typical healthy dip is 10-20%. Show context: "Normal range is 10-20%."

### Edge Cases

- **No HR data during sleep window:** Show empty state with HealthKit CTA. Do not show fabricated data.
- **Very sparse HR data (<5 readings):** Show readings as dots instead of a connected line. Note: "Limited data. More frequent readings require Apple Watch."
- **HR data but no sleep session:** This scenario does not apply (feature only activates within a sleep detail screen).
- **Sleep session crosses midnight:** Handle start_time on day N and end_time on day N+1 correctly.
- **Multiple sleep sessions in one night (polyphasic):** Each session shows its own HR data independently.
- **Extremely high HR during sleep (>120 bpm):** Display without filtering. Could indicate sleep apnea, fever, or nightmare.
- **Module disabled:** Data preserved. Re-enabling shows history.
- **Stage data available but no stage timestamps:** Distribute stages proportionally across the sleep window for approximate stage-HR mapping.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Heart rate curve displays on the sleep detail screen below the hypnogram
- [ ] **AC-2:** HR curve is colored by sleep stage when stage data is available
- [ ] **AC-3:** Average sleeping HR displays correctly
- [ ] **AC-4:** Lowest HR value and timestamp display correctly
- [ ] **AC-5:** HR dip percentage shows with "Normal range" context
- [ ] **AC-6:** Stage average comparison shows HR per stage in horizontal bars
- [ ] **AC-7:** Empty state shows HealthKit CTA when no HR data exists
- [ ] **AC-8:** Sparse data (<5 points) shows dots instead of connected line

### Technical Criteria
- [ ] **TC-1:** HR query correctly filters by sleep session time window (start_time to end_time)
- [ ] **TC-2:** HR dip calculation uses daytime-only HR average (excludes readings during any sleep session)
- [ ] **TC-3:** Stage-HR mapping correctly assigns readings to stages
- [ ] **TC-4:** Average, min, and max calculations handle edge cases (empty arrays, single values)
- [ ] **TC-5:** Cross-midnight sleep sessions handled correctly

### Negative Criteria
- [ ] **NC-1:** Must NOT fabricate HR data when no readings exist
- [ ] **NC-2:** Must NOT send HR data over the network
- [ ] **NC-3:** Must NOT modify or delete existing HR readings in hl_vitals

## UI Specification

### Mobile (Expo)
- **HR curve chart:** Line chart in glass card. Line color follows stage palette: Deep `#4C51BF`, REM `#7C3AED`, Light `#60A5FA`, Awake `#F87171`. Default (no stage) uses module accent `#10B981`. Y-axis = BPM, X-axis = time.
- **Summary card:** Glass card below chart. Three stat blocks in a row: Avg HR, Lowest HR, HR Dip. Values in `#F0F0F5` (24px bold), labels in `rgba(240,240,245,0.65)`.
- **Stage comparison:** Horizontal bars in glass card. Each bar colored by stage, width proportional to BPM range.
- **Empty state:** Glass card with Apple Watch icon, text "Connect Apple Watch to see sleep heart rate", CTA button "Set Up HealthKit".

### Web (Next.js)
- `/health/sleep/[id]` route. Same chart tokens. Responsive chart with hover tooltips showing exact BPM and timestamp.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No data | Empty state with HealthKit CTA | No HR readings in sleep window |
| Sparse | Dots (not connected) with note | <5 HR readings in window |
| HR only | Green line chart (no stage colors) | HR data exists, no stage data |
| Full | Stage-colored HR curve + all stats | HR + stage data available |
| Error | "Could not load heart rate data" + retry | Data fetch fails |

## Test Requirements

### Unit Tests
- [ ] `getSleepHeartRateData`: filters HR vitals by sleep window correctly
- [ ] `getSleepHeartRateData`: returns empty array when no HR data in window
- [ ] `calculateSleepHrAnalysis`: average of [50, 60, 70] = 60
- [ ] `calculateSleepHrAnalysis`: lowest and highest identified correctly
- [ ] `calculateHrDip`: daytime avg 72, sleep avg 54 = 25% dip
- [ ] `calculateHrDip`: returns 0 when no daytime data
- [ ] `mapHrToStages`: correctly assigns HR readings to sleep stages
- [ ] `getStageAverages`: calculates per-stage averages correctly
- [ ] `getStageAverages`: handles missing stages (returns null)
- [ ] Cross-midnight: start 23:00, end 06:30, HR at 02:00 is included

### Integration Tests
- [ ] Full flow: sleep session with HR data -> detail screen shows curve + stats
- [ ] Empty flow: sleep session without HR data -> empty state with CTA

### QA Verification Script

1. Sync heart rate and sleep data from Apple Watch via HealthKit
2. Navigate to MyHealth > Vitals > Sleep
3. Tap a sleep session that has HR data
4. Verify: Heart rate curve chart visible below hypnogram -- corresponds to AC-1
5. Verify: Line is colored by sleep stage (blue/purple/light blue/red) -- corresponds to AC-2
6. Verify: Average sleeping HR stat is shown -- corresponds to AC-3
7. Verify: Lowest HR value and time are shown -- corresponds to AC-4
8. Verify: HR dip percentage with "Normal range 10-20%" context -- corresponds to AC-5
9. Verify: Stage comparison bars show avg HR per stage -- corresponds to AC-6
10. Delete all HR vitals, view a sleep session
11. Verify: Empty state with HealthKit CTA -- corresponds to AC-7

## gstack Quality Gates

Based on Complexity 3 (Inverse), this feature is "Medium" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for HR analysis calculations

### Post-merge:
- [ ] `/parity-check` -- skip (no standalone)

## Handoff State

### Before This Work
Health module has HR readings in hl_vitals and sleep sessions in hl_sleep_sessions, but they are not correlated. Sleep detail shows duration, quality, and stage breakdown but no heart rate data.

### After This Work
- Sleep HR analysis engine correlating HR readings to sleep windows
- HR curve visualization on sleep detail screen
- Summary stats: average HR, lowest HR, HR dip percentage
- Per-stage HR comparison
- Graceful degradation for missing HR data

### Files Changed
- `modules/health/src/sleep/hr-analysis.ts` -- Sleep HR analysis engine (NEW)
- `modules/health/src/sleep/types.ts` -- Extended with SleepHeartRatePoint, SleepHeartRateAnalysis types
- `modules/health/src/index.ts` -- Export sleep HR functions
- `apps/mobile/app/(health)/sleep-detail.tsx` -- HR chart section added
- `apps/web/app/health/sleep/[id]/page.tsx` -- Web HR chart

### Known Limitations
- No real-time HR monitoring during sleep (requires Apple Watch background processing)
- No HR anomaly detection (e.g., auto-flagging arrhythmia during sleep)
- No HR comparison across nights (single-session view only)
- Stage-HR mapping is approximate when detailed stage timestamps are not available
- No export of sleep HR data to PDF or CSV

### Context for Next Agent
- HR data lives in hl_vitals with vital_type='heart_rate'. Filter by recorded_at BETWEEN start_time AND end_time of the sleep session.
- The sleep session's deep_minutes/rem_minutes/light_minutes give total stage durations but not timestamps. You need to approximate stage boundaries by dividing the sleep window proportionally. If HealthKit provides HKCategorySample for sleep stages with timestamps, those would be more precise (but are not currently stored).
- The HR dip calculation needs daytime HR, which means querying hl_vitals for heart_rate readings that do NOT fall within any sleep session window. Use a NOT EXISTS subquery or filter in the engine.
- For the chart, recommend using victory-native (mobile) or recharts (web). The stage-colored line can be achieved by segmenting the data into per-stage arrays and drawing each segment in its stage color.
