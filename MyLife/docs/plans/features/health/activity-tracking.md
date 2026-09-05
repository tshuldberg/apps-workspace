# Feature Spec: Activity Tracking

## Metadata
- **Module:** health
- **Priority Score:** 35 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 4 x3 + Complexity 1 x2 + CrossModule 4 x1 + PaidUser 2 x1
- **Sprint:** 5
- **Estimated CC Time:** 4-5 hours
- **Depends On:** HealthKit integration (for automatic step/energy data)
- **Blocks:** Readiness score (activity factor)

## Business Context

### Why This Feature Exists
Activity tracking (steps, active energy, distance, floors climbed) is a core expectation of any health app. Apple Health and Google Fit provide this natively, but users want a unified view within MyLife alongside their other health data. The activity ring/goal system gamifies daily movement and feeds into the readiness score algorithm. Complexity is 1 (hard) because it requires platform APIs and real-time pedometer access.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Apple Health | Yes | Free | Activity rings (Move/Exercise/Stand), native iOS integration |
| Google Fit | Yes | Free | Heart Points, step goals, activity recognition |
| Bearable | Partial | Yes ($34.99/yr) | Imports activity data from HealthKit |
| Strava | Yes | Partial ($79.99/yr) | GPS-tracked activities, step count via phone |

### Target User
Users who want to track daily movement within MyLife without opening Apple Health or a separate fitness app. Users who want their step count and active energy to appear alongside vitals, sleep, and mood data in the wellness timeline.

## Technical Context

### Where This Lives in MyLife

```
modules/health/src/activity/engine.ts       -- Activity ring calculations, daily summaries
modules/health/src/activity/types.ts        -- Activity data types
modules/health/src/activity/crud.ts         -- Daily activity summary persistence
modules/health/src/db/schema.ts             -- New hl_activity_summaries table
modules/health/src/index.ts                 -- Export activity functions
apps/mobile/app/(health)/today.tsx          -- Activity rings on Today tab
apps/mobile/app/(health)/activity.tsx       -- Activity detail/history screen
```

### Wireframe Position

```
Hub Dashboard
  └── MyHealth card
       └── Today tab
            └── Activity Rings ← YOU ARE HERE
                 ├── Steps ring + count
                 ├── Active Energy ring + calories
                 ├── Move Minutes ring
                 └── Daily summary
```

### Data Model

```sql
CREATE TABLE IF NOT EXISTS hl_activity_summaries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  steps INTEGER NOT NULL DEFAULT 0,
  steps_goal INTEGER NOT NULL DEFAULT 10000,
  active_energy_cal REAL NOT NULL DEFAULT 0,
  active_energy_goal REAL NOT NULL DEFAULT 500,
  move_minutes INTEGER NOT NULL DEFAULT 0,
  move_minutes_goal INTEGER NOT NULL DEFAULT 30,
  distance_meters REAL,
  floors_climbed INTEGER,
  source TEXT NOT NULL DEFAULT 'manual',  -- manual | apple_health | health_connect
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS hl_activity_date_idx ON hl_activity_summaries(date);
```

Individual step/energy readings already flow into `hl_vitals` (vital_type='steps', 'active_energy'). The activity summary table aggregates these into daily totals with goals.

### Dependencies
- **Internal:** `@mylife/db`, hl_vitals (raw step/energy data from HealthKit sync), hl_settings (goals)
- **External:** `expo-sensors` (Pedometer API for real-time step counting on iOS/Android), HealthKit via healthkit adapter
- **Cross-Module:** Feeds readiness score (activity factor). Workouts module could read active energy. Nutrition module could use for TDEE calculation.

## Functional Requirements

### User Stories
1. As a user, I want to see my daily steps, active energy, and move minutes on the Today tab so I can track my daily activity at a glance.
2. As a user, I want activity rings that fill as I progress toward my goals so I'm motivated to move.
3. As a user, I want to customize my daily goals (steps, calories, minutes) to match my fitness level.
4. As a user, I want to see my activity history and trends over 7/30 days.

### Behavior Specification

**Daily activity display:**
1. Today tab shows 3 activity rings (Apple Health-inspired but MyLife-themed):
   - Steps ring (outer): fills as steps approach goal
   - Active Energy ring (middle): fills as calories approach goal
   - Move Minutes ring (inner): fills as active minutes approach goal
2. Below rings: numeric values with goal progress (e.g., "7,432 / 10,000 steps")
3. Data sources: HealthKit sync (if connected) or real-time pedometer (fallback)

**Real-time pedometer:**
1. If HealthKit is not connected, use Expo Pedometer API
2. Pedometer updates step count in real-time while app is in foreground
3. Steps are aggregated into hl_activity_summaries at the end of each day (or on app close)

**HealthKit-sourced activity:**
1. If HealthKit is connected, steps and active energy come from HealthKit sync
2. hl_vitals records with vital_type='steps' and 'active_energy' are summed for the day
3. Activity summary is computed from these aggregated values

**Goal customization:**
1. User navigates to activity settings (via gear icon on activity card or health settings)
2. Adjustable goals: Steps (default 10,000), Active Energy (default 500 cal), Move Minutes (default 30)
3. Goals stored in hl_settings or in the activity_summaries row

**Activity history:**
1. Tapping the activity card opens activity detail screen
2. 7-day bar chart showing daily steps with goal line
3. 30-day average stats
4. Best day and streak tracking (consecutive days meeting all 3 goals)

### Edge Cases

- **No pedometer available:** Show manual entry option for steps.
- **HealthKit and pedometer both available:** Prefer HealthKit data (more comprehensive).
- **Day boundary (midnight):** Finalize previous day's summary at midnight or next app open.
- **Step count resets mid-day:** Handle device restart by using cumulative count from HealthKit.
- **No data for a day:** Show 0s with "No activity recorded."
- **Goal of 0:** Prevent. Minimum 100 steps, 50 cal, 5 minutes.
- **Extremely high step count (100k+):** Display correctly, no cap.
- **Module disabled:** Data preserved. Re-enabling shows history.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Three activity rings display on the Today tab with correct fill proportions
- [ ] **AC-2:** Step count updates in real-time via pedometer or HealthKit
- [ ] **AC-3:** Ring fills completely (with celebration indicator) when goal is reached
- [ ] **AC-4:** Numeric values show current / goal for each metric
- [ ] **AC-5:** Goals are customizable from activity settings
- [ ] **AC-6:** Activity history shows 7-day bar chart with goal line
- [ ] **AC-7:** 30-day average stats display correctly
- [ ] **AC-8:** Streak counter tracks consecutive days meeting all 3 goals

### Technical Criteria
- [ ] **TC-1:** hl_activity_summaries table created by migration
- [ ] **TC-2:** Daily summary aggregates steps from hl_vitals correctly
- [ ] **TC-3:** Real-time pedometer updates step count within 1 second
- [ ] **TC-4:** Day rollover correctly finalizes previous day and starts new day
- [ ] **TC-5:** Goal values are persisted and loaded correctly
- [ ] **TC-6:** Streak calculation handles gaps correctly (resets on missed day)

### Negative Criteria
- [ ] **NC-1:** Activity tracking must NOT drain battery excessively (use pedometer wisely)
- [ ] **NC-2:** Real-time updates must NOT block the main UI thread
- [ ] **NC-3:** Activity data must NOT be sent over the network

## UI Specification

### Mobile (Expo)
- **Activity rings:** Three concentric rings on dark background. Outer (steps): `#10B981`. Middle (energy): `#F472B6`. Inner (minutes): `#3B82F6`. Track: `rgba(255,255,255,0.06)`. Ring fills clockwise.
- **Goal completion:** Ring flashes briefly and shows a sparkle effect when 100% reached.
- **Numerics:** Below rings, three rows with icon + current/goal in glass cards.
- **History:** Bar chart with `#10B981` bars, dashed goal line in `rgba(240,240,245,0.65)`.

### Web (Next.js)
- Same ring design via SVG circles
- `/health/activity` route
- No real-time pedometer on web (shows HealthKit-synced data or manual entry)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton rings | Data fetch |
| No data | Empty rings with "0 / goal" | No activity today |
| In progress | Partially filled rings | Activity logged |
| Goal met | Full ring with celebration | Goal reached |
| History | Bar chart + stats | Tap activity card |

## Test Requirements

### Unit Tests
- [ ] `aggregateDailySteps`: sums all step vitals for a date
- [ ] `aggregateDailySteps`: returns 0 for no data
- [ ] `calculateRingProgress`: 5000/10000 = 0.5
- [ ] `calculateRingProgress`: caps at 1.0 (no overflow)
- [ ] `calculateStreak`: 3 consecutive goal-met days = 3
- [ ] `calculateStreak`: gap resets streak to 0
- [ ] `createActivitySummary`: stores all fields correctly
- [ ] `getActivityHistory`: returns summaries in date order

### Integration Tests
- [ ] Full flow: pedometer counts steps -> summary updated -> rings reflect progress
- [ ] HealthKit flow: sync steps from HealthKit -> daily aggregate computed -> rings update

### QA Verification Script

1. Open app, navigate to MyHealth > Today tab
2. Verify: 3 activity rings visible -- corresponds to AC-1
3. Walk around with phone (or use HealthKit test data)
4. Verify: Step count updates -- corresponds to AC-2
5. Set step goal to 100 (for testing), reach it
6. Verify: Ring fills completely with celebration -- corresponds to AC-3
7. Verify: Shows "100 / 100 steps" -- corresponds to AC-4
8. Open activity settings, change step goal to 8000
9. Verify: Goal updates -- corresponds to AC-5
10. Tap activity card for detail
11. Verify: 7-day chart visible -- corresponds to AC-6

## gstack Quality Gates

Based on Complexity 1 (Inverse), this feature is "Complex" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Required if Complexity <= 2:
- [ ] `/plan-eng-review` -- run on this spec BEFORE building

### Required if Complexity <= 1:
- [ ] `/office-hours` (builder mode) -- validate approach

### Post-merge:
- [ ] `/parity-check` -- skip (no standalone)

## Handoff State

### Before This Work
Health module stores step and active energy data in hl_vitals via HealthKit sync, but has no daily aggregation, no goals, no rings visualization.

### After This Work
- Daily activity summary table with goal tracking
- Three-ring activity visualization on Today tab
- Real-time pedometer integration (fallback when no HealthKit)
- Customizable goals
- Activity history with 7-day charts and streaks

### Files Changed
- `modules/health/src/activity/engine.ts` -- Ring calculations, streaks
- `modules/health/src/activity/types.ts` -- Activity types
- `modules/health/src/activity/crud.ts` -- Summary CRUD
- `modules/health/src/db/schema.ts` -- hl_activity_summaries
- `modules/health/src/definition.ts` -- Migration bump
- `modules/health/src/index.ts` -- Exports
- `apps/mobile/app/(health)/today.tsx` -- Activity rings
- `apps/mobile/app/(health)/activity.tsx` -- History screen

### Known Limitations
- No GPS tracking (that belongs in Workouts/Trails modules)
- No stand hours (Apple Watch-specific)
- No automatic exercise detection
- Pedometer not available on web

### Context for Next Agent
- Steps and active energy already exist in hl_vitals (vital_type='steps', 'active_energy'). The activity summary aggregates these per day.
- Use expo-sensors Pedometer API for real-time step counting: `Pedometer.watchStepCount()`
- Activity rings should use SVG or Canvas for the circular progress. On mobile, react-native-svg with animated fills works well.
- The streak logic should match the Habits module pattern (consecutive days meeting ALL 3 goals).
