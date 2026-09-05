# Feature Spec: Wrong-Turn Alerts

## Metadata
- **Module:** trails
- **Priority Score:** 30 / 50 (A-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [4] x3 + Complexity [2] x2 + CrossModule [1] x1 + PaidUser [4] x1
- **Sprint:** 5
- **Estimated CC Time:** 2-3 hours
- **Depends On:** Offline map downloads (V2 migration for map infrastructure), GPS trail recording (existing V1)
- **Blocks:** turn-by-turn navigation (P2, extends alert system with voiced directions)

## Business Context

### Why This Feature Exists
Getting lost on a trail is the #1 safety concern for hikers. AllTrails added wrong-turn alerts as a premium feature and markets it as their key safety differentiator, driving conversions among safety-conscious hikers. The feature detects when a user strays from their planned route and alerts them before they get dangerously off-trail. In remote areas without cell signal, a simple "you've left the trail" vibration can prevent multi-hour detours, injuries from bushwhacking, and search-and-rescue situations. Combined with offline maps (which this depends on), wrong-turn alerts complete the core offline safety toolkit that justifies Trails as a premium module.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| AllTrails | Yes | Yes ($26.99-53.99/yr) | "Off-Trail Alerts" -- vibration + banner when user deviates >30m from planned route. Works offline. Premium-only feature prominently marketed in upgrade prompts. |
| Gaia GPS | No | N/A | No deviation detection. Shows track on map but no active monitoring. Users must manually check position against route. |
| Komoot | Partial | Yes ($29.99 one-time) | Turn-by-turn voice nav alerts at each decision point but no continuous deviation detection between turns. More navigation than safety. |
| Strava | No | N/A | No route deviation alerts. Focused on performance metrics, not navigation safety. |

### Target User
AllTrails premium users ($27-54/yr) who value the off-trail alert as a safety feature. Solo hikers (28-55) on unfamiliar trails who worry about missing a junction or taking a wrong fork. Parents hiking with children who need an extra layer of safety awareness. Trail runners moving fast through switchbacks where a wrong turn at pace means a long backtrack. Users in areas with poor trail markings (overgrown paths, winter conditions, unmarked junctions).

## Technical Context

### Where This Lives in MyLife

```
modules/trails/src/
  types.ts                        -- New DeviationAlert, AlertSettings, RouteGeofence schemas
  db/schema.ts                    -- New tr_alert_settings table (migration V3)
  db/crud.ts                      -- CRUD for alert settings
  engine/
    deviation-detector.ts         -- NEW: core deviation detection engine
    route-geofence.ts             -- NEW: route corridor geometry builder
  definition.ts                   -- Add V3 migration, bump schemaVersion to 3
  index.ts                        -- Export new alert functions and types

apps/mobile/app/(trails)/
  recording.tsx                   -- Updated: deviation alert overlay during active recording
  trail-detail.tsx                -- Updated: "Follow this trail" button to start guided recording

apps/web/app/trails/
  page.tsx                        -- Updated: alert settings configuration
```

### Wireframe Position

```
Hub Dashboard
  └── MyTrails card
       └── Map tab
            └── [Start Recording with route guidance]
                 └── Deviation Alert overlay ← YOU ARE HERE (during active recording)
       └── Trail Detail screen
            └── "Follow This Trail" button (starts guided recording)
       └── Settings tab
            └── Alert Settings (threshold, vibration, sound)
```

### Data Model

```sql
-- Migration V3: Alert settings and deviation history
CREATE TABLE IF NOT EXISTS tr_alert_settings (
  id TEXT PRIMARY KEY NOT NULL,
  deviation_threshold_meters REAL NOT NULL DEFAULT 30.0,    -- distance before alert fires
  alert_cooldown_seconds INTEGER NOT NULL DEFAULT 60,       -- minimum time between alerts
  vibration_enabled INTEGER NOT NULL DEFAULT 1,
  sound_enabled INTEGER NOT NULL DEFAULT 0,
  auto_pause_on_deviation INTEGER NOT NULL DEFAULT 0,       -- pause recording on off-trail
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tr_deviation_events (
  id TEXT PRIMARY KEY NOT NULL,
  recording_id TEXT NOT NULL REFERENCES tr_recordings(id) ON DELETE CASCADE,
  trail_id TEXT REFERENCES tr_trails(id) ON DELETE SET NULL,
  lat REAL NOT NULL,                                        -- position when deviation detected
  lng REAL NOT NULL,
  deviation_meters REAL NOT NULL,                           -- how far off-trail
  nearest_trail_lat REAL NOT NULL,                          -- closest point on planned route
  nearest_trail_lng REAL NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0,                  -- user dismissed the alert
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tr_deviation_events_recording ON tr_deviation_events(recording_id);
CREATE INDEX IF NOT EXISTS idx_tr_deviation_events_trail ON tr_deviation_events(trail_id);
```

### Dependencies
- **Internal:** `@mylife/trails` (GPS waypoints, trail data, recording system, geo engine with haversineDistance), `@mylife/db` (DatabaseAdapter, migration orchestration)
- **External:**
  - Mobile: `expo-haptics` for vibration feedback, `expo-av` for optional alert sound, `expo-location` for continuous GPS (already used for recordings)
  - Web: No vibration/sound. Visual-only alerts. Web deviation detection for planning/review only.
- **Cross-Module:** None (score: 1). This is entirely within the trails module.

## Functional Requirements

### User Stories
1. As a solo hiker on an unfamiliar trail, I want to be alerted when I stray from the planned route so that I can turn back before getting lost.
2. As a trail runner moving fast through switchbacks, I want a vibration alert the moment I miss a turn so that I don't run an extra mile before realizing my mistake.
3. As a parent hiking with children, I want the app to watch for wrong turns so that I can focus on my kids instead of constantly checking the map.
4. As a hiker in poor visibility (fog, winter, dense forest), I want deviation alerts that work without me looking at the screen so that I know immediately if I leave the trail.
5. As a privacy-conscious hiker, I want deviation detection to run entirely on-device so that my location is never sent to a server.

### Behavior Specification

**Setting up guided recording:**
1. User opens a saved trail's detail screen
2. User taps "Follow This Trail" button
3. System loads the trail's waypoint data (from tr_waypoints of a previous recording on this trail, or from imported GPX) as the reference route
4. Recording starts with deviation detection enabled
5. Map shows the reference route as a translucent overlay plus the live GPS track

**Deviation detection (runs during active recording with a reference route):**
1. On each GPS update (1Hz from expo-location), the deviation detector runs
2. Detector calculates the minimum distance from the user's current position to any segment of the reference route polyline
3. If distance exceeds the configured threshold (default 30m):
   a. First check cooldown: if an alert was fired within the last N seconds (default 60s), skip
   b. Fire alert: vibration (if enabled) + sound (if enabled) + visual banner
   c. Record a deviation event in tr_deviation_events
   d. Show banner: "You're [X]m off trail" with a directional arrow pointing back toward the nearest route point
4. If user returns within threshold: dismiss the banner automatically, mark deviation event as acknowledged
5. Deviation detection runs entirely on-device with no network calls

**Visual alert during recording:**
1. When deviation detected, a glass-morphism banner slides down from top of map
2. Banner shows: warning icon, "Off Trail - [X]m", directional arrow pointing to nearest route point, distance back to trail
3. Banner background: semi-transparent danger red (`#FF453A` at 20% opacity) with glass border
4. Banner persists until user returns within threshold or dismisses manually
5. Map also draws a thin dashed line from user position to nearest route point

**Alert settings:**
1. User navigates to Settings > Alert Settings
2. Configurable options:
   - Deviation threshold: 15m / 30m / 50m / 100m (picker, default 30m)
   - Alert cooldown: 30s / 60s / 120s (picker, default 60s)
   - Vibration: on/off toggle (default on)
   - Sound: on/off toggle (default off)
   - Auto-pause on deviation: on/off toggle (default off)
3. Settings are persisted in tr_alert_settings (singleton row, created on first access)

**Post-hike deviation review:**
1. After completing a guided recording, the recording detail screen shows a "Deviations" section
2. Each deviation event shown on a mini-map with the deviation point highlighted
3. Summary: "2 off-trail alerts during this hike, max deviation: 85m"
4. Helps user identify confusing junctions for future reference

### Edge Cases

- **No reference route available:** If user starts recording without selecting a trail to follow, deviation detection is not active. Recording works normally without alerts.
- **Reference route with sparse waypoints:** The geofence builder interpolates between waypoints to create a continuous corridor. Segments longer than 100m are subdivided for accurate distance calculation.
- **GPS accuracy worse than threshold:** If GPS accuracy (from `expo-location` `coords.accuracy`) exceeds 50% of the deviation threshold, increase the effective threshold to avoid false alerts. Example: 30m threshold + 20m accuracy = effective 40m threshold.
- **Extremely winding trail (switchbacks):** On tight switchbacks, the user may be 30m from a lower switchback while still on-trail on a higher one. The detector checks distance to the nearest segment of the reference route, not just the next expected segment. This handles switchbacks correctly.
- **User intentionally leaves trail:** User can dismiss the alert banner or disable alerts for the current recording via a "Mute Alerts" button on the banner. Muting lasts for the current recording only.
- **Module disabled during guided recording:** If trails module is disabled mid-recording (unusual but possible), the recording ends normally. Deviation events already recorded are preserved.
- **Very long trail (>50km):** The route geofence uses a spatial index (sort segments by lat/lng bucket) to avoid O(n) distance checks on every GPS update. Performance target: <10ms per GPS update even on a 1,000-segment route.
- **Returning to trail after deviation:** The system must not fire a second alert when the user crosses back within threshold. Use a state machine: NORMAL -> DEVIATED (alert fires) -> RETURNING (alert visible but no new alert) -> NORMAL (banner dismissed).
- **Multiple reference routes for same trail:** If a trail has multiple recorded tracks, use the most recent one as the reference. Future enhancement: merge multiple tracks into a "consensus route."
- **Offline operation:** Deviation detection is purely computational (haversine distance, no network). Works fully offline as long as the reference route waypoints are in local SQLite.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can tap "Follow This Trail" on a trail detail screen to start a guided recording
- [ ] **AC-2:** During guided recording, map shows the reference route as a translucent overlay behind the live track
- [ ] **AC-3:** When user moves >30m from the reference route, a vibration fires within 2 seconds
- [ ] **AC-4:** When user moves >30m from the reference route, a visual banner appears showing distance off-trail and direction back
- [ ] **AC-5:** When user returns within 30m of the reference route, the alert banner automatically dismisses
- [ ] **AC-6:** User can tap "Mute Alerts" on the banner to suppress further alerts for the current recording
- [ ] **AC-7:** User can configure deviation threshold (15m/30m/50m/100m) in Settings > Alert Settings
- [ ] **AC-8:** User can toggle vibration on/off and sound on/off independently
- [ ] **AC-9:** After completing a guided recording, deviation summary shows count and max deviation distance
- [ ] **AC-10:** Deviation detection works with airplane mode on (fully offline)
- [ ] **AC-11:** Alert cooldown prevents repeated alerts within the configured interval (default 60s)

### Technical Criteria
- [ ] **TC-1:** `tr_alert_settings` and `tr_deviation_events` tables are created by migration V3
- [ ] **TC-2:** `deviationDistance()` correctly calculates minimum distance from a point to a polyline (not just to vertices)
- [ ] **TC-3:** Deviation detection completes in <10ms per GPS update on a route with 1,000 segments
- [ ] **TC-4:** GPS accuracy is factored into effective threshold (accuracy > 50% of threshold increases effective threshold)
- [ ] **TC-5:** State machine correctly transitions: NORMAL -> DEVIATED -> RETURNING -> NORMAL without duplicate alerts
- [ ] **TC-6:** Deviation events are persisted to SQLite with correct recording_id, position, and nearest-route-point
- [ ] **TC-7:** Route geofence correctly handles switchbacks (nearest segment, not next expected segment)

### Negative Criteria
- [ ] **NC-1:** Deviation detection must NOT send GPS data to any server (all computation on-device)
- [ ] **NC-2:** Deviation detection must NOT drain battery significantly more than a normal recording (target: <5% additional battery per hour)
- [ ] **NC-3:** False positive rate must NOT exceed 1 per 10km of on-trail hiking on trails with clean GPS signal
- [ ] **NC-4:** Muting alerts for the current recording must NOT persist to the next recording
- [ ] **NC-5:** Deviation events must NOT be deleted when the user dismisses the alert banner (they are historical data)

## UI Specification

### Mobile (Expo)

**Recording Screen (updated for guided mode):**
- Reference route drawn as translucent lime polyline (lime `#65A30D` at 40% opacity, 4px width)
- Live GPS track drawn as solid lime polyline (lime `#65A30D` at 100% opacity, 3px width)
- Blue GPS dot with accuracy circle

**Deviation Alert Banner:**
- Position: slides down from top of map, below status bar
- Background: `rgba(255, 69, 58, 0.15)` (danger red glass) with `rgba(255, 69, 58, 0.30)` border
- Content: Warning triangle icon + "Off Trail - 47m" + directional arrow + "Mute Alerts" text button
- Dismiss: auto-dismisses when user returns on-trail, or tap X to dismiss manually
- Dashed line: thin dashed red line from GPS dot to nearest route point on map

**Alert Settings Screen:**
- Background: `#0A0A0F`
- Glass cards for each setting group
- Threshold picker: segmented control with 4 options (15m / 30m / 50m / 100m)
- Cooldown picker: segmented control with 3 options (30s / 60s / 120s)
- Vibration toggle: standard iOS-style switch
- Sound toggle: standard iOS-style switch
- Auto-pause toggle: standard iOS-style switch with helper text "Pause recording when off-trail"
- Module accent: `#65A30D` (lime) for active states

**Post-Hike Deviation Summary:**
- Section in recording detail screen below the route map
- Card showing: "2 Off-Trail Alerts" with max deviation distance
- Tap to expand: list of deviation events with timestamps and distances
- Each event tappable to center map on that deviation point

### Web (Next.js)

- Alert settings configurable in the Trails settings section
- Deviation review visible in recording detail view
- No real-time deviation detection on web (GPS tracking is mobile-only)
- Web shows deviation history from mobile recordings

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton for alert settings | Initial settings fetch |
| Normal | Green "On Trail" subtle indicator | GPS within threshold of reference route |
| Deviated | Red alert banner + vibration + dashed line to route | GPS > threshold from reference route |
| Muted | Grey "Alerts Muted" indicator, no vibration/banner | User tapped "Mute Alerts" |
| No Reference | No deviation UI shown | Recording without a selected trail to follow |
| Settings | Alert configuration screen | User navigates to Settings > Alert Settings |

## Test Requirements

### Unit Tests
- [ ] `deviationDistance(point, polyline)`: returns 0 when point is on the polyline
- [ ] `deviationDistance(point, polyline)`: returns correct perpendicular distance to segment midpoint
- [ ] `deviationDistance(point, polyline)`: returns distance to nearest vertex when perpendicular falls outside segment
- [ ] `deviationDistance(point, polyline)`: handles single-segment polyline
- [ ] `deviationDistance(point, polyline)`: handles polyline with 1,000+ segments in <10ms
- [ ] `buildRouteGeofence(waypoints)`: interpolates sparse waypoints (>100m apart)
- [ ] `buildRouteGeofence(waypoints)`: preserves dense waypoints without modification
- [ ] `effectiveThreshold(baseThreshold, gpsAccuracy)`: increases threshold when accuracy is poor
- [ ] `effectiveThreshold(baseThreshold, gpsAccuracy)`: does not increase threshold when accuracy is good
- [ ] `DeviationStateMachine.update(distance)`: transitions NORMAL -> DEVIATED when distance > threshold
- [ ] `DeviationStateMachine.update(distance)`: transitions DEVIATED -> NORMAL when distance < threshold
- [ ] `DeviationStateMachine.update(distance)`: respects cooldown (no re-alert within cooldown window)
- [ ] `DeviationStateMachine.mute()`: prevents alerts until recording ends
- [ ] `createAlertSettings()`: creates singleton row with defaults
- [ ] `getAlertSettings()`: returns existing settings or creates defaults
- [ ] `updateAlertSettings()`: updates threshold, cooldown, toggles
- [ ] `createDeviationEvent()`: persists event with correct fields
- [ ] `getDeviationsByRecording()`: returns events ordered by created_at

### Integration Tests
- [ ] Full guided recording flow: start with reference route -> simulate on-trail GPS -> verify no alerts
- [ ] Deviation flow: start guided recording -> simulate off-trail GPS -> verify alert fires and event persisted
- [ ] Return flow: deviate -> return on-trail -> verify alert dismisses and state resets
- [ ] Mute flow: deviate -> mute -> continue off-trail -> verify no further alerts
- [ ] Settings flow: change threshold to 50m -> verify alert fires at 50m not 30m

### QA Verification Script
1. Open the app on iOS simulator
2. Navigate to Trails > Settings > Alert Settings
3. Verify: default settings show 30m threshold, vibration on, sound off -- corresponds to AC-7, AC-8
4. Change threshold to 50m, verify it persists after leaving and returning to settings
5. Navigate to a saved trail with recorded waypoints
6. Tap "Follow This Trail"
7. Verify: recording starts, reference route visible as translucent overlay -- corresponds to AC-1, AC-2
8. Simulate GPS position on the reference route for 30 seconds
9. Verify: no alert banner appears (user is on-trail)
10. Simulate GPS position 60m from the reference route
11. Verify: vibration fires, alert banner slides down showing distance and direction -- corresponds to AC-3, AC-4
12. Wait 10 seconds, verify no second alert fires (cooldown active) -- corresponds to AC-11
13. Simulate GPS returning to within 30m of the reference route
14. Verify: alert banner automatically dismisses -- corresponds to AC-5
15. Simulate going off-trail again
16. Tap "Mute Alerts" on the banner
17. Verify: banner dismisses, no further vibrations during this recording -- corresponds to AC-6
18. Stop the recording
19. View the recording detail screen
20. Verify: "Deviations" section shows alert count and max deviation distance -- corresponds to AC-9
21. Enable airplane mode, start a new guided recording
22. Simulate going off-trail
23. Verify: alert fires even in airplane mode -- corresponds to AC-10
24. Verify: no network requests were made during the recording -- corresponds to NC-1

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to alert settings screen, verify all states render. Test guided recording overlay.

### Required: Complexity <= 2 (this feature is Complexity 2 = Large):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Validate geofence approach and battery impact.

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for deviation-detector and route-geofence engines

### Post-merge:
- [ ] `/parity-check` -- trails module parity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Trails module has GPS recording, waypoints, and distance/elevation analytics
- Haversine distance function exists in `engine/geo.ts` (reusable for deviation calculation)
- No route guidance, no deviation detection, no alert system
- Offline maps infrastructure (V2 migration) expected to be in place (dependency)
- 4 tables in V1, 5 tables after V2 (tr_offline_regions from offline maps feature)

### After This Work
- New V3 migration adds `tr_alert_settings` and `tr_deviation_events` tables
- New `engine/deviation-detector.ts` with point-to-polyline distance, state machine, cooldown logic
- New `engine/route-geofence.ts` with corridor builder and spatial indexing for performance
- Trail detail screen has "Follow This Trail" button for guided recording
- Recording screen shows reference route overlay and deviation alert banner
- Alert settings screen for customizing thresholds and notification preferences
- Post-hike deviation summary in recording detail view

### Files Changed
- `modules/trails/src/types.ts` -- New `DeviationAlertSchema`, `AlertSettingsSchema`, `DeviationEventSchema`, `DeviationState` enum
- `modules/trails/src/db/schema.ts` -- V3 migration SQL for `tr_alert_settings` and `tr_deviation_events`
- `modules/trails/src/db/crud.ts` -- CRUD for alert settings (get/create/update singleton) and deviation events (create, list by recording)
- `modules/trails/src/definition.ts` -- Add TRAILS_MIGRATION_V3, bump schemaVersion to 3
- `modules/trails/src/engine/deviation-detector.ts` -- Core deviation detection: point-to-polyline distance, effective threshold, DeviationStateMachine class
- `modules/trails/src/engine/route-geofence.ts` -- Route corridor builder: waypoint interpolation, spatial bucket indexing
- `modules/trails/src/index.ts` -- Export new alert and deviation functions
- `modules/trails/src/__tests__/deviation-detector.test.ts` -- Unit tests for deviation engine
- `modules/trails/src/__tests__/route-geofence.test.ts` -- Unit tests for geofence builder
- `apps/mobile/app/(trails)/recording.tsx` -- Deviation alert overlay during guided recording
- `apps/mobile/app/(trails)/trail-detail.tsx` -- "Follow This Trail" button
- `apps/web/app/trails/page.tsx` -- Alert settings and deviation review sections

### Known Limitations
- **No turn-by-turn navigation in V1:** This feature detects deviation, it does not provide voiced step-by-step directions. Turn-by-turn nav is a separate P2 feature that extends this foundation.
- **Reference route required:** Deviation detection only works when the user selects a trail with existing waypoint data. Freestyle recordings have no reference route and thus no alerts.
- **Single reference route per recording:** Cannot compare against multiple route variants simultaneously. Future enhancement could use consensus routing from multiple past recordings.
- **No crowd-sourced route corrections:** If the official trail has been rerouted and the reference route is outdated, the system will alert incorrectly. Users should re-record the trail to update the reference.
- **Web is review-only:** Real-time deviation detection requires continuous GPS, which is mobile-only. Web shows deviation history and settings but no live alerts.

### Context for Next Agent
- The `haversineDistance` function in `engine/geo.ts` calculates point-to-point distance. The deviation detector needs point-to-segment distance (perpendicular distance to the nearest line segment, not just nearest vertex). Implement this as a new function, not by modifying haversineDistance.
- Battery impact is the biggest risk. The deviation detector runs on every GPS update (1Hz). Keep the per-update computation under 10ms. Use spatial bucketing (divide route into lat/lng grid cells) to avoid checking every segment.
- The state machine is critical for UX. Without it, the user gets spammed with alerts every second while off-trail. The state machine (NORMAL -> DEVIATED -> RETURNING -> NORMAL) with cooldown ensures one alert per deviation event.
- `expo-haptics` provides `impactAsync(ImpactFeedbackStyle.Heavy)` for the vibration alert. Use the "Heavy" style for safety alerts (more noticeable than "Light" or "Medium").
- AllTrails uses 30m as their default threshold. Match this default so users migrating from AllTrails get familiar behavior, but allow customization down to 15m for runners who want tighter alerts.
