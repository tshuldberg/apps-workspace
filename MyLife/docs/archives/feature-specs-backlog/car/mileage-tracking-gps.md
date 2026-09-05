# Feature Spec: Mileage Tracking (GPS)

## Metadata
- **Module:** car
- **Priority Score:** 24 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [3] x3 + Complexity [2] x2 + CrossModule [2] x1 + PaidUser [3] x1
- **SPEC-mycar ID:** CR-005
- **Sprint:** 5
- **Estimated CC Time:** 5-6 hours
- **Depends On:** none (builds on existing cr_vehicles table and CRUD layer)
- **Blocks:** none (future: fuel economy per-trip correlation, budget mileage deduction integration)

## Business Context

### Why This Feature Exists
Manual odometer entry is the biggest friction point in vehicle tracking apps. Users forget to log trips, enter incorrect values, or simply stop updating because it feels tedious. GPS-based trip recording eliminates this by automatically calculating distance from location data. The privacy angle is critical: competitors like Expensify and FIXD require cloud sync for GPS mileage, exposing driving patterns to third parties. MyLife records GPS on-device, processes distance locally, and optionally discards raw traces after computing the summary. This is the only privacy-first GPS mileage tracker in the market.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Simply Auto | Yes | Free tier | Manual start/stop GPS trip recording, route display on map, trip categorization |
| FIXD | Yes | Yes ($9.99/mo + OBD device) | Real-time GPS via OBD-II dongle, automatic trip detection, cloud-synced routes |
| Expensify | Yes | Yes ($60/yr) | Automatic background GPS mileage, IRS-compliant reports, requires cloud account |
| Drivvo | Partial | No | Manual mileage entry only, no GPS, odometer-based calculations |
| MileIQ | Yes | Yes ($59.99/yr) | Fully automatic drive detection, cloud-required, swipe to classify trips |

### Target User
Car owners (25-55) who need mileage records for personal awareness, reimbursement, or tax deductions but refuse to use cloud-synced trackers due to privacy concerns. Also appeals to Simply Auto users who want GPS tracking without paying for premium, and FIXD users who want software-only tracking without buying a $20 OBD dongle. The privacy guarantee (zero network, zero cloud, all GPS data stays on-device) is the primary differentiator.

## Technical Context

### Where This Lives in MyLife

```
modules/car/src/
  types.ts                            -- New Zod schemas: GpsTrip, TripPurpose, CreateGpsTripInput
  db/schema.ts                        -- New table: cr_gps_trips + indexes
  db/crud.ts                          -- New CRUD: trip create/read/update/delete/stats
  engines/gps-engine.ts               -- NEW: distance calculation, polyline encoding/decoding, tracking state
  definition.ts                       -- Migration V3 for new table
  __tests__/gps-engine.test.ts        -- NEW: unit tests for GPS engine

apps/mobile/app/(car)/
  trips.tsx                           -- NEW: Trip history list screen
  trip-detail.tsx                     -- NEW: Trip detail with map view
  components/TripRecordingOverlay.tsx  -- NEW: Floating GPS recording controls

apps/web/app/car/
  trips/page.tsx                      -- NEW: Trip history web page
```

### Wireframe Position

```
Hub Dashboard
  └── MyCar card
       └── Garage tab (vehicle detail)
            └── "Trips" section ← YOU ARE HERE
                 ├── "Record Trip" floating action button
                 ├── Trip history cards (sorted by date)
                 └── Monthly mileage summary
```

The trip recording overlay is accessible from:
1. A floating action button (FAB) on the vehicle detail screen
2. A "Record Trip" quick-action on the MyCar dashboard card
3. The Trips sub-screen accessible from vehicle detail

### Data Model

```sql
-- New table: cr_gps_trips (Migration V3)
CREATE TABLE IF NOT EXISTS cr_gps_trips (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL DEFAULT 'personal',
    route_name TEXT,
    start_lat REAL,
    start_lng REAL,
    end_lat REAL,
    end_lng REAL,
    distance_meters INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    polyline_encoded TEXT,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS cr_gps_trips_vehicle_idx
    ON cr_gps_trips(vehicle_id);
CREATE INDEX IF NOT EXISTS cr_gps_trips_started_idx
    ON cr_gps_trips(started_at DESC);
CREATE INDEX IF NOT EXISTS cr_gps_trips_purpose_idx
    ON cr_gps_trips(purpose);
```

**purpose enum values:** `personal`, `business`, `commute`, `medical`, `charity`, `other`

**polyline_encoded format:** Google Encoded Polyline Algorithm (see https://developers.google.com/maps/documentation/utilities/polylinealgorithm). Stores route as a compact ASCII string. A 30-minute city drive with 1-per-second GPS sampling compresses to approximately 2-4 KB as an encoded polyline, compared to 50+ KB for raw coordinate JSON.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for SQLite operations), `@mylife/ui` (Cool Obsidian tokens, glass card components), `@mylife/module-registry` (Migration type for schema V3)
- **External:**
  - `expo-location` (background location tracking on mobile, `LocationAccuracy.High`, `requestBackgroundPermissionsAsync`)
  - `expo-task-manager` (register background location task `CAR_GPS_TRACKING_TASK`)
  - `zod` (schema validation)
  - No external APIs required. No map tile service needed for MVP (route stored as polyline; map view is a future enhancement or uses static inline rendering).
- **Cross-Module:** `trails` module has polyline viewing capability. A shared `PolylineViewer` component could be extracted to `@mylife/ui` in a future sprint. For MVP, the car module implements its own minimal route display.

## Functional Requirements

### User Stories
1. As a car owner, I want to tap "Start Trip" and have the app automatically record my route using GPS so that I get accurate mileage without manual entry.
2. As a freelancer, I want to classify trips as business or personal so that I can track deductible mileage for taxes.
3. As a privacy-conscious user, I want all GPS data to stay on my device with the option to discard raw traces after distance is calculated, so that my driving patterns are never exposed to any server.
4. As a multi-vehicle owner, I want trip mileage to automatically update my vehicle's odometer so that my maintenance reminders stay accurate.
5. As a user reviewing my driving history, I want to see a list of past trips with distance, duration, and purpose so that I can audit my mileage records.
6. As a user, I want to give my trips route names (e.g., "Home to Office") so I can quickly identify recurring drives.

### Behavior Specification

**Starting a trip recording:**
1. User navigates to a vehicle's detail screen or the Trips sub-screen.
2. User taps the "Record Trip" floating action button (FAB).
3. System checks location permissions:
   - If not granted: shows permission request dialog explaining "MyCar needs location access to record trip mileage. All data stays on your device."
   - If "While Using" only (iOS): warns that background tracking requires "Always" permission, offers to open Settings. Proceeds with foreground-only tracking as fallback.
   - If denied: shows info banner "Location access required for GPS tracking. Enable in Settings." with a button linking to device settings.
4. If permissions granted: system creates a new `cr_gps_trips` record with `started_at = now`, `vehicle_id` from the current vehicle, `purpose = 'personal'` (default).
5. System registers a background location task via `expo-task-manager`.
6. The Trip Recording Overlay appears: a compact floating bar at the bottom of the screen showing elapsed time and accumulated distance.
7. GPS points are collected at approximately 1-second intervals with high accuracy.
8. Points are held in memory (not persisted individually). Distance is recalculated incrementally using the Haversine formula as each point arrives.

**During a trip:**
1. The recording overlay persists across screen navigation within the car module.
2. Distance updates in real-time on the overlay (formatted as miles or km based on cr_settings distanceUnit).
3. Elapsed time ticks up in HH:MM:SS format.
4. User can continue using other parts of the app. The background task keeps recording.
5. If the user switches to a different app or locks the phone, the background location task continues (iOS: "Always" permission required; Android: foreground service notification shown).

**Stopping a trip:**
1. User taps "Stop" on the recording overlay.
2. System stops the background location task.
3. System calculates final distance from all collected GPS points using the Haversine formula with cumulative segment summation.
4. System encodes the GPS trace into a Google encoded polyline for compact storage.
5. System updates the trip record: `ended_at = now`, `distance_meters`, `duration_seconds`, `polyline_encoded`, `start_lat/lng`, `end_lat/lng`.
6. System auto-updates the vehicle's odometer: `new_odometer = max(current_odometer, current_odometer + distance_in_miles)`. This ensures the odometer only goes up.
7. Trip completion screen appears showing: distance (mi/km), duration, start/end locations (reverse geocoded to street name if possible, otherwise lat/lng), purpose selector.
8. User can edit purpose, add a route name, and add notes.
9. User taps "Save" to finalize. The in-memory GPS points are discarded (only the encoded polyline is kept).

**Viewing trip history:**
1. User navigates to the Trips sub-screen (accessible from vehicle detail).
2. Screen shows a list of trip cards sorted by date (newest first).
3. Each card shows: route name (or "Unnamed Trip"), distance, duration, purpose badge, date.
4. Monthly summary at the top: total miles, trip count, breakdown by purpose.
5. Tapping a trip opens the trip detail screen.

**Viewing trip detail:**
1. Detail screen shows: route name, date/time range, distance, duration, purpose, notes.
2. If polyline_encoded is present, a simplified route outline is rendered (static polyline on a plain background, or map if a map component is available).
3. Action buttons: "Edit" (change purpose, name, notes), "Delete" (with confirmation dialog).
4. Start and end coordinates displayed as latitude/longitude pairs (reverse geocoding to addresses is a future enhancement).

**Editing a trip:**
1. User taps "Edit" on trip detail.
2. Form shows: route name (text input), purpose (segmented selector), notes (text area).
3. Distance and duration are read-only (GPS-calculated, not user-editable).
4. User taps "Save" to persist changes.

**Discarding raw GPS trace (privacy option):**
1. In MyCar Settings, a toggle exists: "Keep route traces" (default: ON).
2. If OFF: when a trip is saved, `polyline_encoded` is set to NULL. Only distance, duration, and start/end coordinates are kept.
3. Existing trips can have their traces deleted via a "Clear Route Data" button on trip detail.

### Edge Cases

- **No GPS signal (indoor, tunnel, garage):** If fewer than 5 GPS points are collected in the first 60 seconds, show warning: "Weak GPS signal. Move outdoors for accurate tracking." Recording continues, distance may be inaccurate.
- **GPS drift while stationary:** Filter out points where speed < 2 mph and distance from last accepted point < 10 meters. This prevents phantom mileage accumulation while parked.
- **Very short trip (< 0.1 miles):** Accepted and saved. No minimum distance threshold. User can delete manually.
- **Very long trip (> 500 miles):** Accepted. Polyline encoding handles arbitrarily long routes. Memory usage for in-memory points is bounded by discarding raw coordinates after encoding every 1000 points (streaming encode).
- **App crashes during recording:** The background task registered via `expo-task-manager` survives app crashes on both iOS and Android. On next app launch, check for an active background task and an incomplete trip record (ended_at IS NULL). Resume the overlay or prompt the user to stop the stale recording.
- **Multiple vehicles:** Only one trip can be recorded at a time. If the user tries to start a second trip (same or different vehicle), show: "A trip is already being recorded for [vehicle name]. Stop it first?"
- **Battery impact:** Background GPS at high accuracy uses significant battery. Show an estimate on the recording overlay: "GPS active - higher battery usage." On iOS, the system may throttle background location updates; accept reduced accuracy gracefully.
- **User navigates away from car module:** Recording overlay collapses to a persistent notification-style bar at the top of the hub. Tapping it returns to the car module.
- **Location permissions revoked mid-trip:** The background task stops. On next app open, detect the incomplete trip, calculate distance from points collected so far, and prompt: "Location access was revoked. Trip recording stopped. Save partial trip?"
- **Odometer rollback prevention:** The auto-update uses `max(current, current + trip_distance)` so the odometer never decreases from a GPS trip. If the user manually set a lower odometer before the trip, the GPS trip still adds its distance to the value at trip start.
- **Module disabled mid-recording:** Stop the background task, finalize the trip with data collected so far, preserve data. Re-enabling the module shows the saved trip.
- **No vehicles exist:** FAB is hidden. Trips sub-screen shows empty state: "Add a vehicle to start tracking trips."
- **Web platform (no background GPS):** Web uses the Geolocation API which only works while the page is visible. Show warning: "GPS tracking on web only works while this tab is active. Use the mobile app for background tracking." Foreground tracking still works.
- **Android foreground service notification:** Android requires a persistent notification for background location. Use the notification to show elapsed time and distance. Tapping it opens the app.

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** Tapping "Record Trip" on a vehicle with location permissions granted starts GPS recording and shows the recording overlay with elapsed time and distance counters.
- [ ] **AC-2:** The recording overlay persists when navigating between screens within the car module.
- [ ] **AC-3:** Distance on the overlay updates in real-time as the device moves, formatted in the user's preferred unit (mi/km from cr_settings).
- [ ] **AC-4:** Tapping "Stop" ends recording, shows the trip completion screen with final distance, duration, and purpose selector.
- [ ] **AC-5:** Saving a trip creates a record in the trip history list with correct distance, duration, date, and purpose badge.
- [ ] **AC-6:** The vehicle's odometer auto-updates after a trip is saved, increasing by the trip's distance.
- [ ] **AC-7:** Trip history shows cards sorted by date (newest first) with monthly summary at the top.
- [ ] **AC-8:** Tapping a trip card opens the detail screen with all trip data and the route polyline outline (if trace was kept).
- [ ] **AC-9:** Purpose can be changed on the completion screen or via edit on the detail screen. Options: personal, business, commute, medical, charity, other.
- [ ] **AC-10:** Route name can be added or edited on the completion screen and detail screen.
- [ ] **AC-11:** Deleting a trip shows a confirmation dialog. Confirming removes the trip from the list and does NOT roll back the vehicle odometer.
- [ ] **AC-12:** When location permissions are not granted, tapping "Record Trip" shows a permission request dialog with privacy explanation.
- [ ] **AC-13:** When location permissions are denied, an info banner appears with a link to device settings.
- [ ] **AC-14:** The "Keep route traces" toggle in settings controls whether polyline_encoded is stored or discarded on trip save.
- [ ] **AC-15:** "Clear Route Data" on trip detail sets polyline_encoded to NULL for that trip.

### Technical Criteria
- [ ] **TC-1:** Schema migration V3 creates cr_gps_trips table with all columns and 3 indexes, using the cr_ prefix.
- [ ] **TC-2:** `calculateDistance(points)` returns the correct Haversine distance for a known set of GPS coordinates (verified against Google Maps distance for a reference route within 2% tolerance).
- [ ] **TC-3:** `encodePolyline(points)` produces a valid Google encoded polyline string that `decodePolyline(encoded)` can reconstruct to within 0.00001 degrees of the original points.
- [ ] **TC-4:** GPS drift filtering rejects points where speed < 2 mph AND distance from last accepted point < 10 meters.
- [ ] **TC-5:** Trip CRUD operations (create, read, update, delete) persist correctly in SQLite.
- [ ] **TC-6:** Auto-odometer update uses `max(current_odometer, current_odometer + trip_distance_miles)` to prevent rollback.
- [ ] **TC-7:** Only one trip can be recorded at a time. Attempting to start a second trip returns an error.
- [ ] **TC-8:** Incomplete trip detection on app launch finds records where `ended_at IS NULL` and prompts the user.
- [ ] **TC-9:** On web, foreground Geolocation API tracking works when the tab is visible and stops when the tab is hidden.
- [ ] **TC-10:** Trip distance calculation for a known 10-mile route with 600 GPS points completes in < 50ms.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** GPS data must NOT be transmitted over any network. All location processing is on-device.
- [ ] **NC-2:** Raw GPS point arrays must NOT be persisted to SQLite. Only the encoded polyline summary is stored.
- [ ] **NC-3:** Deleting a trip must NOT decrease the vehicle's odometer.
- [ ] **NC-4:** Starting a trip must NOT request notification permissions (those are separate from location permissions).
- [ ] **NC-5:** The recording overlay must NOT block interaction with other screens. It floats above content.
- [ ] **NC-6:** GPS drift while stationary must NOT accumulate phantom mileage.
- [ ] **NC-7:** Disabling the "Keep route traces" setting must NOT retroactively delete polylines from existing trips (only affects new trips).

## UI Specification

### Mobile (Expo)

**Trip Recording Overlay (floating bar, anchored to bottom):**
- Background: `rgba(255,255,255,0.08)` (glassStrong token) with `BlurView` (`intensity: 30`)
- Border: `rgba(255,255,255,0.10)` (glassBorder token), `borderRadius: 16`
- Height: 64px, positioned 16px above the tab bar
- Left section: red recording dot (pulsing animation, `#FF453A`), elapsed time in `HH:MM:SS`, `fontSize: 16`, `fontWeight: 600`, color `#F0F0F5`
- Center section: distance in bold, e.g., "12.4 mi", `fontSize: 20`, `fontWeight: 800`, color `#6366F1` (car accent)
- Right section: "Stop" button, `backgroundColor: #FF453A`, `borderRadius: 12`, white text

**Trip Completion Screen (modal, slides up):**
- Background: `#0A0A0F` (background token)
- Header: checkmark icon in accent circle, "Trip Recorded" title
- Stats row: distance card + duration card side by side, glass background
- Route name input: glass card with text input, placeholder "Name this route (optional)"
- Purpose selector: horizontal scrollable pill list
  - Each pill: `borderRadius: 999`, `paddingHorizontal: 16`, `paddingVertical: 8`
  - Selected: `#6366F1` background, white text
  - Unselected: `rgba(255,255,255,0.04)` background, `rgba(240,240,245,0.65)` text
- Notes text area: glass card, 3 lines, placeholder "Add notes..."
- "Save Trip" button: full-width, `#6366F1` background, `borderRadius: 12`, white text, `fontWeight: 600`

**Trip History Screen (trips.tsx):**
- Background: `#0A0A0F` (background token)
- Monthly summary card at top: glass background, total miles, trip count, purpose breakdown as small colored dots
- Trip cards: glass background, `borderRadius: 12`, glassBorder
  - Left: purpose color dot (personal=blue, business=green, commute=amber, medical=red, charity=purple, other=gray)
  - Center: route name or "Unnamed Trip" (primary text), date + duration (secondary text `rgba(240,240,245,0.65)`)
  - Right: distance in bold, accent-colored
- Floating action button: `#6366F1` background, white "+" icon, `borderRadius: 999`, positioned bottom-right above tab bar

**Trip Detail Screen (trip-detail.tsx):**
- Route polyline section: full-width card, 200px height, light gray background with the polyline drawn as a colored stroke (accent color). If no polyline, show "Route trace not available."
- Stats grid: 2x2 cards (distance, duration, start time, end time)
- Purpose badge: colored pill matching the purpose category
- Notes section: glass card with the notes text
- Action buttons: "Edit" (accent outline) and "Delete" (danger outline), full-width, stacked

### Web (Next.js)

- Same tokens via CSS variables
- Accessible at `/car/trips` route
- Layout: sidebar navigation (existing), main content area with trip list
- Trip cards use the same glass morphism via `backdrop-filter: blur(16px)` and glass token backgrounds
- Trip detail opens as a side panel (not modal) for better UX on wide screens
- Recording overlay: top banner bar (not floating bottom bar) since web has no tab bar
- Purpose selector: horizontal button group instead of pills
- "Record Trip" button in the header area (web uses foreground-only Geolocation API)
- Warning banner on web: "GPS tracking on web only works while this tab is active."

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards (3) with pulsing animation | Initial data fetch from SQLite |
| Empty (no vehicles) | Centered car icon, "Add a vehicle to start tracking trips" + CTA button | No vehicles in cr_vehicles |
| Empty (no trips) | "No trips recorded yet" message + "Record your first trip" button | Vehicle exists but no trips |
| Error | "Something went wrong loading trips" + retry button | SQLite read failure |
| Success | Trip cards sorted by date with monthly summary | Trips loaded successfully |
| Recording | Floating overlay with live distance/time, pulsing red dot | Active GPS recording |
| Partial (permissions issue) | Info banner about location permissions + link to Settings | Location access denied or restricted |

## Test Requirements

### Unit Tests (modules/car/src/__tests__/gps-engine.test.ts)
- [ ] `calculateDistance([])`: returns 0 for empty array
- [ ] `calculateDistance([single point])`: returns 0 for single point
- [ ] `calculateDistance(two points)`: returns correct Haversine distance for known coordinates (SF to LA = ~559 km within 1% tolerance)
- [ ] `calculateDistance(multi-segment)`: cumulative distance matches expected for a known route
- [ ] `calculateDistance`: handles points at same location (returns 0 for that segment)
- [ ] `calculateDistance`: handles antipodal points (max distance ~20,000 km)
- [ ] `encodePolyline([])`: returns empty string for empty array
- [ ] `encodePolyline(known points)`: produces expected encoded string matching Google reference implementation
- [ ] `decodePolyline(encoded)`: reconstructs points to within 0.00001 degrees of originals
- [ ] `encodePolyline` -> `decodePolyline` roundtrip: 100 random points survive encoding/decoding within tolerance
- [ ] `filterDriftPoints(points)`: removes stationary drift points (speed < 2 mph, distance < 10m)
- [ ] `filterDriftPoints(points)`: keeps legitimate movement points
- [ ] `filterDriftPoints([])`: returns empty array for empty input
- [ ] `filterDriftPoints`: preserves first and last points regardless of speed
- [ ] `metersToMiles(1609.34)`: returns approximately 1.0
- [ ] `metersToKilometers(1000)`: returns exactly 1.0
- [ ] `calculateAutoOdometer(currentOdometer, tripDistanceMeters)`: returns max of current and current + distance in miles
- [ ] `calculateAutoOdometer`: never returns a value less than currentOdometer
- [ ] Zod validation: rejects trip with missing vehicle_id
- [ ] Zod validation: accepts trip with null polyline_encoded (trace discarded)
- [ ] Zod validation: rejects purpose value not in the enum

### Integration Tests
- [ ] Full flow: create vehicle, start trip, add GPS points, stop trip, trip persisted with correct distance and polyline
- [ ] Full flow: save trip, vehicle odometer increases by trip distance
- [ ] Full flow: delete trip, trip removed from SQLite, odometer unchanged
- [ ] Full flow: edit trip purpose and route name, changes persisted
- [ ] Error flow: start trip with no location permissions, graceful error message returned
- [ ] Error flow: attempt to start second trip while one is active, error returned with active trip info
- [ ] Privacy flow: "Keep route traces" OFF, save trip, polyline_encoded is NULL in database

### QA Verification Script

1. Open the app on iOS/Android simulator.
2. Navigate to MyCar module. Add a new vehicle (2023 Toyota Camry, 45000 miles). -- Verifies vehicle creation.
3. Navigate to the vehicle's detail screen. Verify a "Record Trip" FAB is visible. -- Verifies UI presence.
4. Tap "Record Trip". If location permissions not yet granted, verify the permission dialog appears with privacy explanation. Grant permissions. -- Corresponds to AC-12.
5. Verify the recording overlay appears at the bottom of the screen with a pulsing red dot, "00:00:00" elapsed time, and "0.0 mi" distance. -- Corresponds to AC-1.
6. Simulate movement (use Xcode location simulation or Android emulator route replay, e.g., "City Bicycle Ride"). Wait 30 seconds. -- Generates GPS data.
7. Verify the distance counter on the overlay increases as the simulated device moves. -- Corresponds to AC-3.
8. Navigate to the MyCar Reminders tab while recording. Verify the recording overlay remains visible. -- Corresponds to AC-2.
9. Navigate back to the vehicle detail. Verify the overlay still shows correct elapsed time and accumulated distance. -- Corresponds to AC-2.
10. Tap "Stop" on the recording overlay. -- Stops recording.
11. Verify the trip completion screen appears showing distance (> 0 mi), duration, and a purpose selector defaulted to "personal". -- Corresponds to AC-4.
12. Enter route name "Test Route Alpha". Select purpose "business". Add a note "QA test trip". -- Tests input fields.
13. Tap "Save Trip". -- Saves the trip.
14. Verify the trip appears in the trip history list with "Test Route Alpha", the distance, "business" badge, and today's date. -- Corresponds to AC-5.
15. Navigate to the vehicle detail. Verify the odometer has increased by approximately the trip distance. -- Corresponds to AC-6.
16. Navigate to the Trips sub-screen. Verify the monthly summary shows the correct total miles and 1 trip count. -- Corresponds to AC-7.
17. Tap the trip card. Verify the detail screen shows all trip data: route name, distance, duration, purpose, notes, and a route polyline outline. -- Corresponds to AC-8.
18. Tap "Edit". Change purpose to "commute". Tap "Save". Verify the purpose badge updates to "commute". -- Corresponds to AC-9.
19. Tap "Clear Route Data" (if available). Verify the polyline section now shows "Route trace not available." -- Corresponds to AC-15.
20. Go back. Record a second trip (simulate 2 minutes of movement). On the completion screen, verify purpose defaults to "personal". Save with default values. -- Verifies multiple trips.
21. Verify both trips appear in the history list, sorted newest first. -- Corresponds to AC-7.
22. Delete the second trip via its detail screen. Verify confirmation dialog appears. Confirm. Verify the trip is removed from the list. -- Corresponds to AC-11.
23. Check the vehicle's odometer. Verify it has NOT decreased after deletion. -- Corresponds to NC-3.
24. Navigate to MyCar Settings. Find "Keep route traces" toggle. Turn it OFF. -- Tests privacy setting.
25. Record a short third trip. Save it. Open its detail. Verify polyline section shows "Route trace not available." -- Corresponds to AC-14.
26. While a trip is recording, attempt to start another trip on the same or different vehicle. Verify an error message prevents it. -- Corresponds to TC-7.
27. Force-quit the app while a trip is recording (background task active). Reopen the app. Verify the app detects the incomplete trip and prompts to resume or save the partial trip. -- Corresponds to TC-8.
28. Repeat steps 3-17 on web at `/car/trips`. Verify foreground tracking works and the warning banner about tab-only tracking is visible. -- Web parity check.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 2 (Large):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to `/car/trips`, click every button, verify all 7 states (loading, empty-no-vehicles, empty-no-trips, error, success, recording, partial-permissions)
- [ ] Batch QA: after 5 features in car module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for `gps-engine.ts` (calculateDistance, encodePolyline, decodePolyline, filterDriftPoints, calculateAutoOdometer)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- car module has active standalone counterpart (MyCar/)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Car module has 5 tables: cr_vehicles, cr_maintenance, cr_fuel_logs, cr_settings, cr_maintenance_schedules
- Schema version 2, migrations V1 and V2
- No trip tracking, no GPS functionality, no location permissions usage
- Odometer is updated only via manual user entry
- No `expo-location` or `expo-task-manager` dependencies in the car module

### After This Work
- Car module has 6 tables (new: cr_gps_trips) with 3 new indexes
- Schema version 3, migration V3 added
- Full GPS trip lifecycle: start recording, collect points, stop, calculate distance, encode polyline, save trip, auto-update odometer
- `gps-engine.ts` contains pure functions for Haversine distance, polyline encoding/decoding, drift filtering, and odometer calculation
- Mobile: background GPS tracking via expo-location + expo-task-manager
- Web: foreground-only tracking via Geolocation API
- Privacy controls: "Keep route traces" toggle, "Clear Route Data" per-trip action

### Files Changed

- `modules/car/src/types.ts` -- Add TripPurposeSchema, GpsTripSchema, CreateGpsTripInputSchema Zod schemas and types
- `modules/car/src/db/schema.ts` -- Add CREATE_GPS_TRIPS table, 3 indexes, CREATE_GPS_TRIP_INDEXES export
- `modules/car/src/db/crud.ts` -- Add trip CRUD functions: createGpsTrip, getGpsTripsByVehicle, getGpsTripById, updateGpsTrip, deleteGpsTrip, getMonthlyTripStats, getActiveRecording
- `modules/car/src/db/index.ts` -- Re-export new CRUD functions and schema constants
- `modules/car/src/engines/gps-engine.ts` -- NEW: calculateDistance, encodePolyline, decodePolyline, filterDriftPoints, metersToMiles, metersToKilometers, calculateAutoOdometer
- `modules/car/src/definition.ts` -- Add CAR_MIGRATION_V3, update schemaVersion to 3
- `modules/car/src/index.ts` -- Re-export new types and engine functions
- `modules/car/src/__tests__/gps-engine.test.ts` -- NEW: 21+ unit tests for GPS engine
- `apps/mobile/app/(car)/trips.tsx` -- NEW: Trip history list screen
- `apps/mobile/app/(car)/trip-detail.tsx` -- NEW: Trip detail screen
- `apps/mobile/app/(car)/components/TripRecordingOverlay.tsx` -- NEW: Floating GPS recording controls
- `apps/mobile/app/(car)/_layout.tsx` -- Add Trips tab, hide trip-detail from tab bar
- `apps/web/app/car/trips/page.tsx` -- NEW: Trip history web page

### Known Limitations
- Background GPS tracking is mobile-only. Web supports foreground-only via Geolocation API.
- No map tile rendering for route display in MVP. The polyline is drawn on a plain background as a stroke outline. Adding MapView (e.g., react-native-maps or MapLibre) is a future enhancement.
- Reverse geocoding of start/end coordinates to street addresses is deferred. Coordinates are displayed as lat/lng pairs.
- No automatic trip detection (auto-start when driving detected). Trips must be manually started and stopped.
- No OBD-II integration. Distance is purely GPS-based, which is less accurate than odometer-based measurement on winding roads or in areas with poor GPS signal.
- Battery usage warning is informational only; no battery-saving GPS mode (reduced accuracy) in MVP.
- Streaming polyline encoding (for very long trips) is noted in the edge cases but may be implemented as a simple batch encode at trip end for MVP, with streaming as a follow-up optimization if memory issues arise.

### Context for Next Agent
- The `gps-engine.ts` must contain only pure functions with no platform dependencies. All `expo-location` and `expo-task-manager` calls belong in a mobile-only hook (e.g., `useGpsTracking` in `apps/mobile/app/(car)/hooks/`). The web implementation uses the browser's `navigator.geolocation` API directly.
- The `polyline_encoded` field uses Google's encoding algorithm, which represents each coordinate as a variable-length encoded difference from the previous coordinate. The encoding/decoding functions should match the reference implementation at https://developers.google.com/maps/documentation/utilities/polylinealgorithm exactly.
- The background location task name must be `CAR_GPS_TRACKING_TASK` and registered at the module level via `TaskManager.defineTask()`. This task receives location updates and dispatches them to the in-memory point accumulator.
- The `cr_gps_trips` table uses `distance_meters` (INTEGER) rather than miles to avoid floating-point precision issues in SQLite. Conversion to miles/km happens at the presentation layer using `metersToMiles()` or `metersToKilometers()`.
- Auto-odometer update happens at trip save time, not during recording. The vehicle's odometer should reflect the cumulative total, not the in-progress trip distance.
- The `purpose` column uses a TEXT type in SQLite (not a constraint) so new purpose values can be added without a migration. Validation happens at the application layer via Zod.
- The trails module also deals with polylines (hiking/biking routes). If both modules are wired, consider extracting polyline utilities to a shared package in a future sprint. For now, keep them independent to avoid coupling.
