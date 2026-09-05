# Feature Spec: Sleep Stage Analysis

## Metadata
- **Module:** health
- **Priority Score:** 34 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 3 x3 + Complexity 2 x2 + CrossModule 3 x1 + PaidUser 3 x1
- **Sprint:** 5
- **Estimated CC Time:** 3-4 hours
- **Depends On:** HealthKit integration (for automatic sleep stage data)
- **Blocks:** Readiness score (sleep factor uses stage breakdown)

## Business Context

### Why This Feature Exists
The existing sleep tracking logs total duration and quality score but does not visualize the breakdown of sleep stages (deep, REM, light, awake). Apple Health, Google Fit, and dedicated sleep apps all show sleep stage hypnograms. Users with Apple Watch, Oura, or similar devices already have stage data collected; MyHealth just needs to display and analyze it. This transforms the sleep section from a simple logger into a diagnostic tool.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Apple Health | Yes | Free | Hypnogram chart, stage percentages, trends |
| Google Fit | Yes | Free | Sleep stages with breakdown bars |
| Oura | Yes | Yes ($5.99/mo) | Detailed sleep staging with scores |
| Sleep Cycle | Yes | Yes ($39.99/yr) | Audio-based sleep analysis, hypnogram |

### Target User
Apple Watch or wearable users who want to understand their sleep quality beyond just hours. Users who want to know if they're getting enough deep sleep and REM for recovery and memory consolidation.

## Technical Context

### Where This Lives in MyLife

```
modules/health/src/sleep/analysis.ts        -- Sleep stage analysis engine
modules/health/src/sleep/types.ts           -- Extended with stage analysis types
modules/health/src/sleep/crud.ts            -- Extended: stage percentage calculations
modules/health/src/index.ts                 -- Export analysis functions
apps/mobile/app/(health)/sleep-detail.tsx   -- Hypnogram chart + stage breakdown
```

### Wireframe Position

```
Hub Dashboard
  └── MyHealth card
       └── Vitals tab
            └── Sleep section
                 └── Sleep Detail ← YOU ARE HERE
                      ├── Hypnogram (timeline chart)
                      ├── Stage breakdown (pie/bar)
                      ├── Stage trends (7-day)
                      └── Sleep quality factors
```

### Data Model

No new tables. The existing `hl_sleep_sessions` already has columns for `deep_minutes`, `rem_minutes`, `light_minutes`, and `awake_minutes`. This feature adds analysis and visualization of this existing data.

**New types (no schema change):**

```typescript
export interface SleepStageBreakdown {
  deepPercent: number;
  remPercent: number;
  lightPercent: number;
  awakePercent: number;
  deepMinutes: number;
  remMinutes: number;
  lightMinutes: number;
  awakeMinutes: number;
  totalSleepMinutes: number; // excludes awake
}

export interface SleepStageTarget {
  stage: 'deep' | 'rem' | 'light';
  targetPercent: number;    // recommended % of total sleep
  actualPercent: number;
  status: 'low' | 'normal' | 'high';
}

export interface SleepAnalysis {
  breakdown: SleepStageBreakdown;
  targets: SleepStageTarget[];
  sleepEfficiency: number;   // (total - awake) / total * 100
  trend: 'improving' | 'stable' | 'declining';
}
```

### Dependencies
- **Internal:** `@mylife/db`, hl_sleep_sessions (existing data), HealthKit integration (source of stage data)
- **External:** None
- **Cross-Module:** Readiness score uses sleep analysis for its sleep factor. Wellness timeline shows sleep events.

## Functional Requirements

### User Stories
1. As a user, I want to see a hypnogram of my sleep stages so I can visualize how my night progressed.
2. As a user, I want to know if my deep sleep and REM percentages are healthy so I can understand my sleep quality.
3. As a user, I want to track sleep stage trends over 7 days so I can spot patterns.

### Behavior Specification

**Sleep detail view (enhanced):**
1. User taps a sleep session from the Vitals tab or Today tab
2. Sleep detail screen now includes:
   a. **Hypnogram chart:** Horizontal timeline showing stage transitions (Awake at top, REM, Light, Deep at bottom)
   b. **Stage breakdown:** Stacked horizontal bar or pie showing percentages
   c. **Target comparison:** Each stage compared to recommended ranges:
      - Deep: 13-23% of total sleep (recommended)
      - REM: 20-25% of total sleep (recommended)
      - Light: 45-55% of total sleep (expected)
      - Awake: <10% (healthy)
   d. **Sleep efficiency:** (total - awake) / total * 100, displayed as percentage
3. If stage data is missing (manual entry with no breakdown), show "No stage data available. Connect Apple Health for detailed sleep analysis."

**7-day trends:**
1. Below the single-night view, a 7-day stacked bar chart shows stage breakdown per night
2. Each bar is divided into deep/REM/light/awake segments
3. Trend indicator: comparing this week's average deep sleep to last week's

### Edge Cases

- **No stage data (manual entry):** Show total duration only. Display CTA to connect HealthKit.
- **Partial stage data (stages don't sum to total):** Display available data with note about discrepancy.
- **Very short sleep (<2 hours):** Display but flag as "nap" rather than full sleep session.
- **0 minutes of deep sleep:** Show 0% with "Below recommended" in orange.
- **Awake time > sleep time:** Cap awake percentage at meaningful value; likely a tracking error.
- **Multiple sleep sessions in one day (naps):** Each shown independently. Daily summary aggregates.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Sleep detail screen shows a hypnogram chart with time on x-axis and stages on y-axis
- [ ] **AC-2:** Stage breakdown shows percentages for deep, REM, light, and awake
- [ ] **AC-3:** Each stage percentage is compared to recommended ranges with color coding
- [ ] **AC-4:** Sleep efficiency percentage is displayed
- [ ] **AC-5:** 7-day stacked bar chart shows stage trends
- [ ] **AC-6:** Sessions without stage data show "No stage data" message with HealthKit CTA
- [ ] **AC-7:** Trend indicator shows if deep sleep is improving or declining

### Technical Criteria
- [ ] **TC-1:** `analyzeSleepStages` correctly calculates percentages from minutes
- [ ] **TC-2:** Target comparison uses correct recommended ranges
- [ ] **TC-3:** Sleep efficiency formula is correct
- [ ] **TC-4:** 7-day trend calculation uses rolling average comparison
- [ ] **TC-5:** Null stage minutes handled gracefully (treated as no data, not 0)

### Negative Criteria
- [ ] **NC-1:** Analysis must NOT modify sleep session data
- [ ] **NC-2:** Must NOT show misleading health claims (use "recommended" not "healthy/unhealthy")

## UI Specification

### Mobile (Expo)
- **Hypnogram:** Horizontal chart. Y-axis stages top-to-bottom: Awake, REM, Light, Deep. Colors: Awake `#FF453A`, REM `#3B82F6`, Light `#A78BFA`, Deep `#10B981`. Time axis at bottom.
- **Stage breakdown:** Horizontal stacked bar or donut chart with same colors.
- **Target badges:** Green check for "normal", orange warning for "low" or "high".
- **Sleep efficiency:** Large percentage in `#F0F0F5`.

### Web (Next.js)
- Same chart design at `/health/sleep/[id]` route.
- Responsive hypnogram that scales to viewport width.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton chart | Data fetch |
| Full data | Hypnogram + breakdown + targets | Stage data available |
| No stage data | Duration only + HealthKit CTA | Manual entry without stages |
| Partial | Available stages shown + note | Incomplete stage data |
| Trend | 7-day stacked chart | Multiple nights logged |

## Test Requirements

### Unit Tests
- [ ] `analyzeSleepStages`: 60 deep + 90 rem + 210 light + 40 awake = correct percentages
- [ ] `analyzeSleepStages`: handles null deep_minutes (returns null percentage)
- [ ] `getSleepEfficiency`: (400 - 40) / 400 * 100 = 90%
- [ ] `compareToTargets`: 15% deep = 'normal' (within 13-23%)
- [ ] `compareToTargets`: 10% deep = 'low' (below 13%)
- [ ] `getStageTrend`: decreasing deep over 7 days = 'declining'
- [ ] `getStageTrend`: stable deep over 7 days = 'stable'

### Integration Tests
- [ ] Full flow: log sleep with stages -> open detail -> hypnogram renders -> breakdown correct
- [ ] No stage flow: log sleep without stages -> "No stage data" message shown

### QA Verification Script

1. Log a sleep session with stages: deep=90, rem=100, light=200, awake=30, total=420 min
2. Navigate to MyHealth > Vitals > Sleep > tap the session
3. Verify: Hypnogram chart shows stage transitions -- corresponds to AC-1
4. Verify: Stage breakdown shows correct percentages -- corresponds to AC-2
5. Verify: Deep (21%) shows green "normal", REM (24%) shows green -- corresponds to AC-3
6. Verify: Sleep efficiency shows 93% -- corresponds to AC-4
7. Log sleep for 7 days
8. Verify: 7-day stacked chart appears -- corresponds to AC-5
9. Log a manual sleep session without stage data
10. Verify: "No stage data" with HealthKit CTA -- corresponds to AC-6

## gstack Quality Gates

Based on Complexity 2 (Inverse), this feature is "Large" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Required if Complexity <= 2:
- [ ] `/plan-eng-review` -- run on this spec BEFORE building

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for sleep analysis

### Post-merge:
- [ ] `/parity-check` -- skip (no standalone)

## Handoff State

### Before This Work
Sleep sessions stored with stage minutes columns but never analyzed or visualized. Sleep detail only shows total duration and quality score.

### After This Work
- Sleep stage analysis engine with percentage calculations and target comparisons
- Hypnogram chart visualization
- Stage breakdown display with color-coded target comparison
- 7-day stage trend tracking
- Sleep efficiency metric
- Graceful handling of sessions without stage data

### Files Changed
- `modules/health/src/sleep/analysis.ts` -- New: stage analysis engine
- `modules/health/src/sleep/types.ts` -- Extended: SleepStageBreakdown, SleepAnalysis types
- `modules/health/src/index.ts` -- Export analysis functions
- `apps/mobile/app/(health)/sleep-detail.tsx` -- Enhanced with hypnogram and breakdown

### Known Limitations
- No audio-based sleep tracking (requires microphone access, ML model)
- No sleep score algorithm beyond existing quality score
- Relies on external devices for stage data (cannot detect stages from phone alone)

### Context for Next Agent
- hl_sleep_sessions already has deep_minutes, rem_minutes, light_minutes, awake_minutes columns. No schema change needed.
- Null stage minutes means "no data" not "0 minutes." Treat nulls differently from zeros.
- The sleep-detail screen is already registered in the module definition navigation.
- Use recommended ranges from sleep science: Deep 13-23%, REM 20-25%, Light 45-55%, Awake <10%.
