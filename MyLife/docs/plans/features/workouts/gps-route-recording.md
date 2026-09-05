# Feature Spec: GPS Route Recording

## Metadata
- **Module:** workouts
- **Priority Score:** 33 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 4 x3 + Complexity 1 x2 + CrossModule 3 x1 + PaidUser 4 x1
- **Sprint:** 5
- **Estimated CC Time:** 5-6 hours
- **Depends On:** none
- **Blocks:** none

## Business Context

### Why This Feature Exists
GPS route recording is Strava's core feature and the primary reason 180M users pay $79.99/yr. Running, cycling, and hiking users need route tracking with distance, pace, elevation, and map visualization. Without GPS, the workouts module is strength-only and misses the entire cardio/outdoor user segment. Complexity is 1 (hard) because it requires background location tracking, efficient GPS coordinate storage, route rendering on a map, pace/distance calculation, and battery optimization.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Strava | Yes | Partial (Free basic, $79.99/yr premium) | Core product: GPS routes, segments, leaderboards, flyovers |
| JEFIT | No | N/A | Gym-focused, no GPS |
| Fitbod | No | N/A | Gym-focused, no GPS |
| Hevy | No | N/A | Gym-focused, no GPS |
| Strong | No | N/A | Gym-focused, no GPS |
| Apple Fitness | Yes | Free | GPS for outdoor workouts via Apple Watch |

### Target User
Runners, cyclists, hikers, and outdoor athletes who want route tracking alongside their strength training in a single app. Users who currently use Strava for cardio and a separate app for strength, and would prefer one unified app. Users who want to see their running/cycling routes on a map with pace and distance data.

## Technical Context

### Where This Lives in MyLife

```
modules/workouts/src/gps/tracker.ts           -- GPS tracking engine (start/pause/stop/resume)
modules/workouts/src/gps/metrics.ts           -- Distance, pace, elevation calculations
modules/workouts/src/gps/types.ts             -- GPS route types
modules/workouts/src/db/schema.ts             -- New wk_gps_routes, wk_gps_points tables
modules/workouts/src/db/crud.ts               -- Route CRUD
modules/workouts/src/index.ts                 -- Export GPS functions
apps/mobile/app/(workouts)/gps-session.tsx    -- GPS workout active session screen
apps/mobile/app/(workouts)/route-detail.tsx   -- Route review with map
```

### Wireframe Position

```
Hub Dashboard
  └── MyWorkouts card
       └── Home tab
            └── "Start GPS Workout" button ← YOU ARE HERE
                 ├── Activity type selector (Run/Cycle/Hike/Walk)
                 ├── Live map with route drawing
                 ├── Real-time stats (distance/pace/time/elevation)
                 └── Route review after completion
```

### Data Model

```sql
-- GPS route metadata
CREATE TABLE IF NOT EXISTS wk_gps_routes (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES wk_workout_sessions(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL DEFAULT 'run' CHECK (activity_type IN ('run', 'cycle', 'hike', 'walk', 'other')),
  name TEXT,
  distance_meters REAL NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  elevation_gain_meters REAL NOT NULL DEFAULT 0,
  elevation_loss_meters REAL NOT NULL DEFAULT 0,
  avg_pace_sec_per_km REAL,                    -- seconds per km (for running/walking)
  avg_speed_kmh REAL,                          -- km/h (for cycling)
  max_speed_kmh REAL,
  calories_estimated INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- GPS coordinate points (stored efficiently)
CREATE TABLE IF NOT EXISTS wk_gps_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id TEXT NOT NULL REFERENCES wk_gps_routes(id) ON DELETE CASCADE,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  altitude_meters REAL,
  speed_mps REAL,                              -- meters per second
  accuracy_meters REAL,
  timestamp_ms INTEGER NOT NULL,               -- milliseconds since epoch for precision
  segment INTEGER NOT NULL DEFAULT 0           -- incremented on pause/resume for gap handling
);

CREATE INDEX IF NOT EXISTS wk_gps_routes_activity_idx ON wk_gps_routes(activity_type);
CREATE INDEX IF NOT EXISTS wk_gps_routes_started_idx ON wk_gps_routes(started_at DESC);
CREATE INDEX IF NOT EXISTS wk_gps_points_route_idx ON wk_gps_points(route_id, timestamp_ms);
```

### Dependencies
- **Internal:** `@mylife/db`, workout sessions (optional link), body map (not used for GPS)
- **External:** `expo-location` (GPS access, background location), `react-native-maps` or `@rnmapbox/maps` (route rendering on map)
- **Cross-Module:** Health module (active calories from GPS workout can feed into energy tracking). Trails module (if GPS routes are outdoor trails, share route data). Surf module (if surf sessions want GPS paddle tracking, future).

## Functional Requirements

### User Stories
1. As a runner, I want to record my route with GPS so I can see my path on a map with distance and pace.
2. As a cyclist, I want speed and elevation data alongside my route.
3. As a hiker, I want elevation gain tracking and trail mapping.
4. As a user, I want to pause/resume GPS tracking without losing my route data.

### Behavior Specification

**Starting a GPS workout:**
1. User taps "Start GPS Workout" on Home tab (or "+" button with GPS option)
2. Activity type selector appears: Run, Cycle, Hike, Walk
3. User selects activity type and taps "Start"
4. System requests location permission (if not already granted)
5. GPS tracking begins, live map appears showing current position
6. Stats overlay shows: distance, elapsed time, current pace (or speed for cycling), elevation

**During GPS tracking:**
1. Location updates recorded at highest available accuracy
2. Update frequency: every 1-5 seconds depending on activity type and speed
   - Running/cycling: every 2 seconds
   - Walking/hiking: every 5 seconds
3. Points stored with latitude, longitude, altitude, speed, accuracy, timestamp
4. Route drawn on the map in real-time (polyline in module accent `#EF4444`)
5. Stats update in real-time:
   - Distance: calculated from GPS points using Haversine formula
   - Pace: current km/pace (running/walking) or km/h speed (cycling)
   - Elapsed time: running clock
   - Elevation: current altitude and total gain

**Pause/Resume:**
1. User taps "Pause" button
2. GPS tracking pauses (no new points recorded)
3. Timer pauses
4. Map stays at last position
5. User taps "Resume" to continue
6. New segment starts (increment `segment` column) so the route doesn't draw a line through the pause gap

**Completion:**
1. User taps "Stop" button
2. Confirmation dialog: "End GPS workout?"
3. On confirm:
   - Calculate final metrics (total distance, average pace/speed, elevation gain/loss, estimated calories)
   - Save route and all points to database
   - Optionally link to a workout session (if it was part of a structured workout)
   - Navigate to route review screen

**Route review:**
1. Full map showing the complete route
2. Stats summary: distance, time, pace, elevation, calories
3. Route name (auto-generated from date + activity, editable)
4. Option to view on the workout history/progress tab

**Route history:**
1. In Progress tab, a "Routes" section shows past GPS workouts
2. Each entry shows: activity type icon, name, date, distance, duration
3. Tapping opens the route detail with map

### Edge Cases

- **Location permission denied:** Show "GPS required for route recording" with link to settings.
- **Poor GPS accuracy (>50m):** Record point but flag as low accuracy. Filter low-accuracy points when rendering route.
- **App backgrounded during GPS tracking:** Continue recording using `expo-location` background location task. Show notification: "GPS workout in progress."
- **Phone loses GPS signal (tunnel, indoor):** Stop recording points. Resume when signal returns. Segment gap handles this.
- **Very long route (1000+ points):** Store all points. For map rendering, downsample to 500 points using Douglas-Peucker algorithm.
- **Battery optimization (Doze mode on Android):** Use background location with foreground service notification.
- **Zero distance moved (standing still):** Don't add new points if distance from last point < 3 meters (noise filter).
- **GPS drift (walking in circles in a building):** Accuracy filter: discard points with accuracy > 100m.
- **Altitude data unavailable:** Store NULL for altitude_meters. Skip elevation calculations.
- **User starts GPS then does a strength workout:** Allow. GPS continues in background. Not ideal UX but doesn't crash.
- **Route crosses the International Date Line:** Haversine formula handles this correctly.
- **Extremely slow activity (<1 km/h for 30+ min):** Allow. Some users walk slowly.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Start GPS Workout" button visible on Home tab
- [ ] **AC-2:** Activity type selector (Run/Cycle/Hike/Walk) shown before start
- [ ] **AC-3:** Live map displays current position and draws route in real-time
- [ ] **AC-4:** Stats overlay shows distance, time, pace/speed, elevation
- [ ] **AC-5:** Pause button stops recording, resume continues with segment gap
- [ ] **AC-6:** Stop button ends session with confirmation dialog
- [ ] **AC-7:** Route review shows full map with complete route and stats summary
- [ ] **AC-8:** Route name auto-generated and editable
- [ ] **AC-9:** Route history visible in Progress tab
- [ ] **AC-10:** Background GPS tracking continues when app is backgrounded

### Technical Criteria
- [ ] **TC-1:** wk_gps_routes and wk_gps_points tables created by migration v4
- [ ] **TC-2:** Distance calculated using Haversine formula with <1% error vs known distances
- [ ] **TC-3:** GPS points filtered for accuracy (>100m discarded) and noise (<3m no-op)
- [ ] **TC-4:** Background location tracking works via expo-location background task
- [ ] **TC-5:** Route rendering downsamples to 500 points for performance
- [ ] **TC-6:** Elevation gain calculated from positive altitude differences (not raw altitude)
- [ ] **TC-7:** Calories estimated using MET values per activity type

### Negative Criteria
- [ ] **NC-1:** Must NOT drain battery excessively (target <10% per hour of tracking)
- [ ] **NC-2:** Must NOT transmit GPS data over the network (all local)
- [ ] **NC-3:** Must NOT require constant foreground app usage (background tracking required)
- [ ] **NC-4:** Must NOT store GPS data when permission is revoked mid-session

## UI Specification

### Mobile (Expo)
- **GPS session screen:** Full-screen map (dark map style matching `#0A0A0F` background). Route polyline in `#EF4444`. Current position: pulsing blue dot. Stats bar at bottom: 4 glass pill stats (Distance, Time, Pace, Elevation) with `#F0F0F5` values on glass background.
- **Controls:** Large circular button bar at bottom. Play/Pause button (60px, `#EF4444`), Stop button (40px, `#FF453A`). Lock button to prevent accidental taps.
- **Route review:** Map fills top half. Stats cards below. Glass card per metric. Module accent `#EF4444` for highlights.
- **Route history:** List of glass cards with activity type emoji (running shoe, bike, mountain, walking), name, date, distance, duration. Sorted by date DESC.

### Web (Next.js)
- `/workouts/gps/active` for live tracking (requires geolocation API).
- `/workouts/routes` for route history.
- `/workouts/routes/[id]` for route detail with full-width map.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Pre-start | Activity type selector | Tap "Start GPS Workout" |
| Active tracking | Live map + route + stats | GPS tracking in progress |
| Paused | Map frozen, "Paused" badge, timer stopped | Tap Pause |
| Completed | Route review with full stats | Tap Stop and confirm |
| No permission | "Location required" message with settings link | Permission denied |
| History | List of past routes | Navigate to Progress > Routes |

## Test Requirements

### Unit Tests
- [ ] `haversineDistance`: 0,0 to 0,1 degree = ~111.32 km
- [ ] `haversineDistance`: same point = 0 meters
- [ ] `calculateTotalDistance`: sums sequential point distances correctly
- [ ] `calculatePace`: 5000m in 1500s = 300 sec/km = 5:00/km
- [ ] `calculateSpeed`: 10000m in 1800s = 20 km/h
- [ ] `calculateElevationGain`: only counts positive altitude differences
- [ ] `calculateElevationGain`: handles null altitudes
- [ ] `filterByAccuracy`: removes points with accuracy > threshold
- [ ] `filterNoise`: removes points <3m from previous point
- [ ] `downsampleRoute`: reduces 1000 points to ~500 while preserving shape
- [ ] `estimateCalories`: running 5km in 25min at 70kg = ~350 cal (approximate)
- [ ] `segmentRoute`: splits points array at segment boundaries

### Integration Tests
- [ ] Full flow: start GPS -> move -> record points -> stop -> route saved with correct distance/pace
- [ ] Pause flow: start -> record -> pause -> resume -> stop -> route has segment gap

### QA Verification Script

1. Navigate to MyWorkouts > Home tab
2. Tap "Start GPS Workout"
3. Verify: Activity type selector shown -- corresponds to AC-2
4. Select "Run" and tap Start
5. Verify: Map appears with current position -- corresponds to AC-3
6. Walk/run for 200m
7. Verify: Route draws on map, distance updates -- corresponds to AC-3, AC-4
8. Tap Pause
9. Verify: Route stops drawing, timer stops -- corresponds to AC-5
10. Tap Resume, walk another 100m
11. Tap Stop
12. Verify: Confirmation dialog appears -- corresponds to AC-6
13. Confirm
14. Verify: Route review shows map, distance ~300m, stats -- corresponds to AC-7
15. Verify: Route name auto-generated ("Evening Run - March 22") -- corresponds to AC-8
16. Navigate to Progress tab > Routes
17. Verify: Route appears in history -- corresponds to AC-9
18. Background the app during tracking
19. Verify: Tracking continues (notification visible) -- corresponds to AC-10

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

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for distance/pace/elevation calculations

### Post-merge:
- [ ] `/parity-check` -- verify standalone parity

## Handoff State

### Before This Work
Workouts module handles strength training (exercises, sets, reps, weights) but has no GPS or cardio route tracking capability.

### After This Work
- GPS tracking engine (start/pause/resume/stop)
- GPS route and point storage with segment support
- Haversine distance calculation
- Pace, speed, and elevation metrics
- Live map rendering with route polyline
- Background location tracking
- Route review and history
- Activity type support (run/cycle/hike/walk)

### Files Changed
- `modules/workouts/src/gps/tracker.ts` -- New: GPS tracking engine
- `modules/workouts/src/gps/metrics.ts` -- New: distance, pace, elevation, calorie calculations
- `modules/workouts/src/gps/types.ts` -- New: GPS route and point types
- `modules/workouts/src/db/schema.ts` -- Extended: wk_gps_routes, wk_gps_points tables
- `modules/workouts/src/db/crud.ts` -- Extended: route CRUD functions
- `modules/workouts/src/db/migrations.ts` -- Extended: migration v4
- `modules/workouts/src/definition.ts` -- Bump schemaVersion, add gps-session and route-detail screens
- `modules/workouts/src/index.ts` -- Export GPS functions
- `apps/mobile/app/(workouts)/gps-session.tsx` -- GPS workout active session
- `apps/mobile/app/(workouts)/route-detail.tsx` -- Route review with map

### Known Limitations
- No segment/leaderboard system (Strava's social moat)
- No route sharing or social features
- No audio cues for pace zones
- No heart rate zone integration
- No auto-pause based on movement detection
- No route planning (recording only, not navigation)
- No GPX import/export
- iOS only for background location (Android requires additional foreground service setup)
- Map rendering requires either MapBox or Apple Maps (choose based on existing project setup)

### Context for Next Agent
- Use `expo-location` for GPS access. The key APIs are:
  - `Location.requestForegroundPermissionsAsync()` and `Location.requestBackgroundPermissionsAsync()`
  - `Location.startLocationUpdatesAsync(taskName, options)` for background tracking
  - `Location.watchPositionAsync(options, callback)` for foreground tracking
- Store GPS points with INTEGER primary key (autoincrement) for performance. UUID is unnecessary for coordinate data.
- The Haversine formula: `d = 2r * arcsin(sqrt(sin^2((lat2-lat1)/2) + cos(lat1)*cos(lat2)*sin^2((lon2-lon1)/2)))` where r = 6371000 meters.
- Elevation gain: iterate through altitudes, sum only positive differences. Smooth altitude data with a 5-point moving average to reduce GPS noise before calculating gain.
- Calorie estimation: use MET values (running ~10 MET, cycling ~8 MET, hiking ~6 MET, walking ~3.5 MET). Formula: `calories = MET * weight_kg * duration_hours`.
- For the map, check if `@rnmapbox/maps` is already a dependency in the monorepo (used by MySurf). If yes, reuse it. If not, use `react-native-maps` with Apple Maps provider.
- Douglas-Peucker algorithm for downsampling: recursively find the point farthest from the line between start/end, keep it if distance > epsilon, recurse on both halves.
- If multiple features share migration v4, coordinate all table creations in a single migration.
