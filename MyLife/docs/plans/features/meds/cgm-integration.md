# Feature Spec: CGM Integration

## Metadata
- **Module:** meds
- **Priority Score:** 16 / 50 (C-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 1 x3 + Complexity 1 x2 + CrossModule 3 x1 + PaidUser 2 x1
- **Sprint:** Sprint 5+
- **Estimated CC Time:** 6-8 hours
- **Depends On:** Blood glucose logging (built -- `md_glucose_readings`), glucose engine (built -- `estimateA1c`, `calculateTimeInRange`, `classifyGlucose`), HbA1c calculator (B-Tier, should be built first)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Continuous Glucose Monitors (CGMs) are the most significant advancement in diabetes management in decades. Devices like Dexcom G7, FreeStyle Libre 3, and Medtronic Guardian produce a glucose reading every 1-5 minutes, generating 288+ readings per day. MySugr (owned by Roche, $35.99/yr) prominently features CGM integration as its top premium differentiator. The problem: CGM data flowing through MySugr feeds Roche's pharmaceutical R&D pipeline. MyLife can integrate CGM data via Apple HealthKit (which already receives CGM data from Dexcom, Libre, and Guardian companion apps) while keeping all that data on-device. Low Complexity score (1) because HealthKit CGM integration involves significant platform-specific API surface, data volume handling, and real-time sync challenges.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| MySugr | Yes | Yes ($35.99/yr) | Direct CGM integration (Dexcom, Libre). Owned by Roche -- data feeds pharma pipeline. |
| Glucose Buddy | Yes | Yes ($39.99/yr) | Dexcom integration, HealthKit sync for Libre. |
| Sugarmate (Tandem) | Yes | Free | Dexcom API direct integration. Acquired by Tandem Diabetes Care. |
| Dexcom Clarity | Yes | Free | Dexcom-only. Built by the CGM manufacturer. |
| CareClinic | No | N/A | No CGM integration. Manual glucose only. |
| Medisafe | No | N/A | No glucose features. |

### Target User
Type 1 diabetics using CGMs (estimated 2M+ in US, growing rapidly as CGMs become available for Type 2 and pre-diabetes). Specifically: MySugr users paying $35.99/yr or Glucose Buddy users paying $39.99/yr who want their CGM data integrated with medication tracking, insulin logging, and correlation analysis -- without that data being funneled to pharmaceutical companies. Migration path: connect CGM via HealthKit (already set up on their phone), get medication+insulin+CGM correlation, all on-device.

## Technical Context

### Where This Lives in MyLife

```
modules/meds/src/
  cgm/
    engine.ts                      -- NEW: CGM data processing, TIR calculation, AGP generation
    healthkit-sync.ts              -- NEW: HealthKit CGM data reader (iOS only)
    __tests__/engine.test.ts       -- NEW: Engine tests
  db/
    cgm.ts                         -- NEW: CRUD for CGM readings (high-volume)
    schema.ts                      -- MODIFY: Add md_cgm_readings, md_cgm_sync_state tables (V4)
  models/
    cgm.ts                         -- NEW: Zod schemas for CGM data
    index.ts                       -- MODIFY: Export CGM models
  definition.ts                    -- MODIFY: Add to V4 migration, add cgm screens
  index.ts                         -- MODIFY: Export CGM engine + types
apps/mobile/app/(meds)/
  cgm.tsx                          -- NEW: CGM dashboard (Ambulatory Glucose Profile)
  cgm-settings.tsx                 -- NEW: CGM sync configuration
apps/web/app/meds/
  cgm/page.tsx                     -- NEW: Web CGM dashboard (read-only, no HealthKit)
```

### Wireframe Position

```
Hub Dashboard
  └── MyMeds card
       ├── Today tab
       │    └── [CGM live card: current glucose, trend arrow, TIR]
       ├── History tab
       │    └── Blood Glucose section
       │         ├── [Manual Glucose History]
       │         ├── [A1c Dashboard]
       │         └── [CGM Dashboard] ← YOU ARE HERE
       │              ├── [Ambulatory Glucose Profile (AGP)]
       │              ├── [Time in Range pie chart]
       │              ├── [Daily overlay chart (spaghetti plot)]
       │              ├── [Glucose variability stats (CV, SD, GMI)]
       │              └── [Insulin + meal overlay markers]
       └── Settings tab
            └── [CGM Sync Configuration]
                 ├── [HealthKit permissions]
                 ├── [Sync interval]
                 └── [Target range configuration]
```

### Data Model

```sql
-- CGM readings (high-volume: up to 288/day)
CREATE TABLE IF NOT EXISTS md_cgm_readings (
  id TEXT PRIMARY KEY,
  value REAL NOT NULL CHECK (value > 0 AND value <= 600),
  unit TEXT NOT NULL DEFAULT 'mg/dL' CHECK (unit IN ('mg/dL', 'mmol/L')),
  range_status TEXT NOT NULL CHECK (range_status IN ('very_low', 'low', 'in_range', 'high', 'very_high')),
  source TEXT NOT NULL DEFAULT 'healthkit' CHECK (source IN ('healthkit', 'manual', 'import')),
  device_name TEXT,
  measured_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sync state tracking (for incremental HealthKit imports)
CREATE TABLE IF NOT EXISTS md_cgm_sync_state (
  id TEXT PRIMARY KEY DEFAULT 'default',
  last_sync_at TEXT NOT NULL,
  last_anchor TEXT,
  readings_synced INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Dependencies
- **Internal:** `@mylife/meds` glucose engine (`classifyGlucose`, `calculateTimeInRange`, `estimateA1c`, `calculateAverageGlucose`), insulin tracking (`getInsulinEntries` for overlay), FODMAP tracking (`md_food_diary` for meal overlay, if built)
- **External:** `expo-health` or `react-native-health` (HealthKit integration, iOS only). `HealthKit` authorization for `HKQuantityTypeIdentifierBloodGlucose`. No new external APIs.
- **Cross-Module:** Health module HealthKit sync can share authorization flow. Nutrition module meal data can overlay on CGM chart. Workouts exercise data can overlay on CGM chart.

## Functional Requirements

### User Stories
1. As a CGM user, I want my Dexcom/Libre readings automatically imported via HealthKit so I do not have to manually enter glucose values.
2. As a diabetic, I want to see my Ambulatory Glucose Profile (AGP) showing the typical glucose pattern over 14 days so I can identify recurring highs and lows.
3. As a diabetic, I want to see Time in Range (TIR) metrics so I know what percentage of the day my glucose is in target.
4. As a diabetic, I want insulin dose markers overlaid on my glucose chart so I can see how my insulin affects my levels.
5. As a diabetic, I want Glucose Management Indicator (GMI) calculated from my CGM data so I have a more accurate A1c estimate than fingerstick-based calculation.

### Behavior Specification

1. **Setup flow:**
   a. User navigates to Settings -> CGM Sync Configuration
   b. System requests HealthKit authorization for blood glucose reading
   c. User grants permission
   d. System performs initial sync: reads all HealthKit glucose samples from the past 90 days
   e. System deduplicates against existing `md_glucose_readings` (match by timestamp +/- 1 minute)
   f. System saves CGM readings to `md_cgm_readings` and updates sync state
2. **Ongoing sync:**
   a. On each app foreground, system checks HealthKit for new readings since last sync
   b. Incremental import using HealthKit anchor queries
   c. New readings auto-classified via `classifyGlucose()` and saved
3. **CGM Dashboard:**
   a. **Current glucose:** latest reading with trend arrow (rising/falling/stable based on last 3 readings)
   b. **AGP chart:** Standard Ambulatory Glucose Profile (14-day view)
      - Median line (50th percentile) in bold
      - Interquartile range (25th-75th percentile) as shaded band
      - 10th-90th percentile as lighter band
      - Target range highlighted
   c. **Time in Range:** Stacked horizontal bar or pie chart
      - Very Low (<54 mg/dL): dark red
      - Low (54-69 mg/dL): red
      - In Range (70-180 mg/dL): green
      - High (181-250 mg/dL): yellow
      - Very High (>250 mg/dL): orange
   d. **Glucose variability:**
      - Coefficient of Variation (CV%): target <36%
      - Standard Deviation
      - Glucose Management Indicator (GMI): A1c estimate from CGM average
   e. **Daily overlay (spaghetti plot):** multiple days overlaid on a 24-hour x-axis
      - Insulin markers as triangles
      - Meal markers as circles (if food diary data exists)
4. **Trend arrow calculation:**
   a. Take the 3 most recent readings
   b. Calculate rate of change (mg/dL per minute)
   c. Arrows: double-up (>3 mg/dL/min), up (2-3), diagonal-up (1-2), flat (<1), diagonal-down, down, double-down

### Edge Cases

- HealthKit not available (Android): show "CGM integration requires iOS" with manual entry fallback
- Web platform: show CGM dashboard as read-only (data synced from mobile, no HealthKit on web)
- HealthKit permission denied: show explanation and re-request option, all CGM features disabled
- No CGM data in HealthKit: show "No CGM data found. Make sure your CGM app is syncing to Apple Health"
- Massive initial import (90 days x 288/day = 25,920 readings): batch insert with progress bar, use transactions
- Duplicate readings (CGM app and manual entry at same time): dedup by timestamp proximity (+/- 1 min)
- CGM gaps (sensor change, signal loss): show gaps in chart, do not interpolate
- Time zone changes during travel: use UTC internally, display in local time
- Mixed units (mg/dL and mmol/L from different CGM apps): normalize to user-preferred unit
- Module disabled: sync stops, existing data preserved
- Very old readings (>90 days): age-out from CGM readings table to prevent unbounded growth (keep in md_glucose_readings as compressed aggregates)

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** HealthKit authorization flow guides user to grant blood glucose access
- [ ] **AC-2:** Initial sync imports CGM readings from HealthKit with progress indicator
- [ ] **AC-3:** Ongoing sync runs automatically on app foreground
- [ ] **AC-4:** Current glucose card shows latest reading with trend arrow
- [ ] **AC-5:** AGP chart displays median, IQR, and 10th-90th bands over 14-day period
- [ ] **AC-6:** Time in Range display shows percentage in each zone with color coding
- [ ] **AC-7:** Glucose variability shows CV%, SD, and GMI
- [ ] **AC-8:** Daily overlay (spaghetti plot) shows multiple days on 24-hour axis
- [ ] **AC-9:** Insulin dose markers appear on daily overlay chart
- [ ] **AC-10:** Meal markers appear on daily overlay if food diary data exists
- [ ] **AC-11:** Sync configuration screen shows last sync time and reading count
- [ ] **AC-12:** Web dashboard shows CGM data (read-only, synced from mobile)

### Technical Criteria
- [ ] **TC-1:** `md_cgm_readings` table handles 25,000+ readings without performance degradation
- [ ] **TC-2:** `md_cgm_sync_state` tracks incremental sync anchor for HealthKit
- [ ] **TC-3:** Initial bulk import uses batched SQLite transactions (1000 rows per transaction)
- [ ] **TC-4:** Deduplication: readings with measured_at within 60 seconds of existing entry are skipped
- [ ] **TC-5:** AGP calculation: compute percentiles (10, 25, 50, 75, 90) in 5-minute time bins over 14 days
- [ ] **TC-6:** TIR calculation reuses existing `calculateTimeInRange()` from glucose engine
- [ ] **TC-7:** GMI formula: GMI = 3.31 + (0.02392 * average_mg_dL)
- [ ] **TC-8:** Trend arrow: rate of change from 3 most recent readings, thresholds in mg/dL/min
- [ ] **TC-9:** Incremental sync completes in <3 seconds for typical daily readings (288)
- [ ] **TC-10:** Index on `measured_at DESC` ensures fast time-range queries on 25K+ rows

### Negative Criteria
- [ ] **NC-1:** CGM data must NOT be sent to any external service -- read from HealthKit, store locally
- [ ] **NC-2:** Must NOT request HealthKit write permissions -- read-only access
- [ ] **NC-3:** Must NOT modify existing `md_glucose_readings` table -- CGM uses its own table
- [ ] **NC-4:** Must NOT auto-delete HealthKit data from the system health store
- [ ] **NC-5:** Must NOT show CGM features on Android (graceful degradation to manual entry)
- [ ] **NC-6:** GMI must NOT be labeled as "A1c" -- it is a separate metric (GMI ~ eA1c, but clinically distinct)

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Current glucose card: large number (e.g., "142"), trend arrow, TIR mini bar. Glass card.
- AGP chart: median line bold `#06B6D4`, IQR band `rgba(6, 182, 212, 0.2)`, 10-90 band `rgba(6, 182, 212, 0.08)`
- Target range: green highlight band (70-180 by default)
- TIR: stacked horizontal bar with 5 color segments
- Spaghetti plot: each day as a thin semi-transparent line, today's line bold
- Insulin markers: small downward triangles `#38BDF8`
- Meal markers: small circles `#FFD60A`
- Trend arrows: standard CGM arrow set (double-up, up, diagonal-up, flat, diagonal-down, down, double-down)
- Module accent: `#06B6D4` (meds cyan)

### Web (Next.js)
- Route: `/meds/cgm`
- Same tokens via CSS variables
- Wider AGP chart with tooltip on hover
- Note: "Sync CGM data from the iOS app. Web displays data read-only."
- Recharts for rendering

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | "Syncing CGM data..." with spinner | HealthKit query in progress |
| No HealthKit | "CGM integration requires iOS" + manual glucose entry link | Running on Android or web |
| No permission | "Grant HealthKit access to import CGM data" + authorize button | Permission not granted |
| No data | "No CGM data found in Apple Health" + troubleshooting tips | HealthKit empty |
| Syncing | Progress bar: "Importing 25,920 readings..." | Initial bulk import |
| Error | "Could not read CGM data" + retry + "Check HealthKit permissions" | HealthKit query fails |
| Success | Full CGM dashboard: current glucose, AGP, TIR, variability, overlay | Data available |
| Stale | Current glucose card shows "Last reading: 45 min ago" warning | Gap in CGM data |

## Test Requirements

### Unit Tests
- [ ] `classifyGlucose` (existing): correctly classifies CGM range values
- [ ] `calculateTimeInRange` (existing): handles 288+ readings per day
- [ ] `calculateGMI(150)`: returns 6.9 (GMI formula verification)
- [ ] `calculateGMI(100)`: returns 5.7
- [ ] `calculateTrendArrow`: 3 rising readings (100, 110, 125) returns 'rising'
- [ ] `calculateTrendArrow`: 3 stable readings (120, 121, 120) returns 'flat'
- [ ] `calculateTrendArrow`: 3 dropping readings (200, 180, 150) returns 'falling_fast'
- [ ] `calculateAGP`: computes correct percentiles for 14 days of 5-minute binned data
- [ ] `calculateCV`: coefficient of variation from readings array
- [ ] `deduplicateReadings`: filters out readings within 60s of existing timestamps
- [ ] `batchInsertReadings`: handles 1000+ readings in single transaction
- [ ] `getLatestReading`: returns most recent CGM reading

### Integration Tests
- [ ] Full flow: mock HealthKit data -> sync -> readings in database -> AGP renders correctly
- [ ] Incremental sync: add new mock readings -> sync again -> only new readings imported
- [ ] Dedup: manual glucose entry at 10:00 + CGM reading at 10:01 -> only CGM reading kept in cgm table

### QA Verification Script

1. Open the app on iOS simulator
2. Navigate to MyMeds -> Settings -> CGM Sync Configuration
3. Tap "Connect to Apple Health"
4. Grant blood glucose read permission -- AC-1
5. Verify: initial sync begins with progress indicator -- AC-2
6. Wait for sync to complete
7. Navigate to History -> Blood Glucose -> CGM Dashboard
8. Verify: current glucose displayed with trend arrow -- AC-4
9. Verify: AGP chart shows median line with percentile bands -- AC-5
10. Verify: Time in Range stacked bar with 5 color zones -- AC-6
11. Verify: CV%, SD, and GMI displayed -- AC-7
12. Navigate to daily overlay view
13. Verify: multiple days overlaid on 24-hour axis -- AC-8
14. Add an insulin entry (Log Insulin screen)
15. Return to daily overlay
16. Verify: insulin marker appears on chart -- AC-9
17. Background the app, then foreground
18. Verify: sync runs automatically (check sync state timestamp) -- AC-3
19. Navigate to sync configuration
20. Verify: last sync time and reading count shown -- AC-11
21. Open web at `/meds/cgm`
22. Verify: CGM data shown read-only with note about iOS sync -- AC-12
23. Verify: no health data in network requests (Safari dev tools) -- NC-1
24. Check Android: verify graceful "requires iOS" message -- NC-5

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to `/meds/cgm`, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for AGP, TIR, GMI, trend arrow calculations

### Post-merge:
- [ ] `/parity-check` -- if module has standalone counterpart

## Handoff State

### Before This Work
The meds module has manual glucose logging (`md_glucose_readings`), glucose engine with classification and A1c estimation, but no automatic CGM data import, no AGP visualization, and no GMI calculation.

### After This Work
CGM data automatically imports from Apple HealthKit, stored in a dedicated high-volume table. Dashboard shows AGP, Time in Range, glucose variability (CV%, SD, GMI), daily overlay with insulin/meal markers, and current glucose with trend arrows. iOS-only for data import; web shows read-only dashboard.

### Files Changed
- `modules/meds/src/cgm/engine.ts` -- AGP calculation, GMI, trend arrows, CV%, data processing
- `modules/meds/src/cgm/healthkit-sync.ts` -- HealthKit blood glucose reader with incremental sync
- `modules/meds/src/cgm/__tests__/engine.test.ts` -- Engine tests
- `modules/meds/src/db/cgm.ts` -- High-volume CRUD for CGM readings, sync state management
- `modules/meds/src/db/schema.ts` -- V4 tables (md_cgm_readings, md_cgm_sync_state)
- `modules/meds/src/models/cgm.ts` -- Zod schemas
- `modules/meds/src/models/index.ts` -- Re-export CGM models
- `modules/meds/src/definition.ts` -- V4 migration, add cgm screens
- `modules/meds/src/index.ts` -- Export CGM engine + types
- `apps/mobile/app/(meds)/cgm.tsx` -- CGM dashboard (AGP, TIR, overlay)
- `apps/mobile/app/(meds)/cgm-settings.tsx` -- CGM sync configuration
- `apps/web/app/meds/cgm/page.tsx` -- Web CGM dashboard (read-only)

### Known Limitations
- iOS only for HealthKit import. Android has Google Health Connect but CGM support is limited and would require a separate integration.
- HealthKit is read-only -- MyLife reads CGM data but does not write to HealthKit. Users must have a CGM companion app (Dexcom, LibreLink) already syncing to HealthKit.
- High data volume (25K+ readings for 90 days). SQLite performs well with proper indexing, but very long history (>1 year) may need pruning or aggregation strategy.
- AGP calculation is computationally intensive (14 days x 288 readings/day = 4,032 readings, binned into 288 5-minute slots with percentile calculation). May need to cache the result and recompute only when new data arrives.
- No real-time CGM streaming (that would require a persistent Bluetooth connection to the CGM device). Data arrives via HealthKit with a delay of minutes to hours depending on the CGM app's sync frequency.

### Context for Next Agent
- HealthKit CGM data type: `HKQuantityTypeIdentifierBloodGlucose`. Use `HKAnchoredObjectQuery` for incremental sync.
- The existing glucose engine functions (`classifyGlucose`, `calculateTimeInRange`, `estimateA1c`) operate on `GlucoseReading[]`. The CGM engine should convert `md_cgm_readings` rows to `GlucoseReading` format to reuse these functions.
- GMI is NOT the same as eA1c (estimated A1c from fingerstick). GMI uses a different formula: `GMI = 3.31 + (0.02392 * avg_mg)`. The existing `estimateA1c` function uses the ADAG formula: `eA1c = (avg + 46.7) / 28.7`. Both should be available, clearly labeled.
- V4 migration: coordinate with other B+C feature tables. The `md_cgm_readings` table will be by far the largest table in the meds module.
- Consider SQLite WAL mode for concurrent read/write during bulk imports.
