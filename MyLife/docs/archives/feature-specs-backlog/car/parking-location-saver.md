# Feature Spec: Parking Location Saver

## Metadata
- **Module:** car
- **Priority Score:** 22 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [2] x3 + Complexity [4] x2 + CrossModule [1] x1 + PaidUser [1] x1
- **SPEC-mycar ID:** CR-011
- **Sprint:** 5
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (builds on existing cr_vehicles table and CRUD layer)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Finding your parked car is a universal friction point, especially in garages, airports, event venues, and dense urban areas. Apple Maps and Google Maps offer basic "parked car" pins, but they lack garage level/spot metadata, meter expiration alerts, and photo attachment. Simply Auto includes a parking pin but couples it with premium subscription features. By building parking location saving into MyCar, users get a single app that handles both day-to-day vehicle management and the "where did I park?" problem, with richer metadata than any built-in mapping app provides. The meter expiration timer with local notifications is the differentiator: no competitor sends a push alert 10 minutes before your meter runs out.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Apple Maps | Partial | No (free) | Auto-detects parked car via Bluetooth disconnect, drops pin on map. No level/spot, no meter timer, no photo. Clears on next drive. |
| Google Maps | Partial | No (free) | Manual "Save parking" pin with optional photo and notes. Meter timer with notification. No level/spot field. |
| Simply Auto | Yes | Partial (premium) | Save parking location pin on map. Manual entry only. No meter timer. Premium tier only. |
| CARFAX Car Care | No | N/A | No parking location feature. |
| Drivvo | No | N/A | No parking location feature. |
| SpotHero | Partial | No (free) | Shows booked parking spot location, not a general-purpose "find my car" tool. Reservation-based only. |

### Target User
Urban drivers (20-45) who park in garages, metered street spots, or large lots (airports, malls, stadiums) and routinely forget where they left their car. Users of Apple Maps "parked car" who want richer metadata (level, spot number, photo, meter timer). Privacy-conscious users who do not want their parking history tracked in Google or Apple's cloud. The feature is lightweight enough to use daily and valuable enough to justify the MyCar module subscription for occasional-use drivers.

## Technical Context

### Where This Lives in MyLife

```
modules/car/src/
  types.ts                            -- New Zod schemas: ParkingLocation, SaveParkingInput
  db/schema.ts                        -- New table: cr_parking_locations
  db/crud.ts                          -- New CRUD: saveParking, getActiveParking, clearParking, getParkingHistory
  engines/parking-engine.ts           -- NEW: meter expiration calc, distance formatting, auto-clear logic
  definition.ts                       -- Migration v3 for new table
  index.ts                            -- Re-export new types and engine functions
  __tests__/parking-engine.test.ts    -- NEW: unit tests for parking engine

apps/mobile/app/(car)/
  parking.tsx                         -- NEW: Parking location screen with map + save/clear actions
  components/ParkingCard.tsx          -- NEW: Dashboard quick-action card for parking

apps/web/app/car/
  parking/page.tsx                    -- NEW: Parking location web page
```

### Wireframe Position

```
Hub Dashboard
  └── MyCar card
       ├── Dashboard tab
       │    └── "Where Did I Park?" quick-action card ← ENTRY POINT 1
       └── Parking screen ← ENTRY POINT 2 (from tab bar or quick-action)
            ├── Map view with pin
            ├── Parking details (level, spot, photo, meter)
            └── "Found My Car" / "Clear" button
```

The Parking Location feature is accessible from:
1. A "Where Did I Park?" quick-action card on the MyCar Dashboard tab (primary entry point)
2. Direct navigation to the parking screen
3. Push notification tap when meter is about to expire (deep links to parking screen)

### Data Model

```sql
-- New table: cr_parking_locations (Migration v3)
CREATE TABLE IF NOT EXISTS cr_parking_locations (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    altitude REAL,
    accuracy REAL,
    level TEXT,
    spot TEXT,
    photo_uri TEXT,
    meter_expires_at TEXT,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    saved_at TEXT NOT NULL DEFAULT (datetime('now')),
    cleared_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS cr_parking_vehicle_active_idx
    ON cr_parking_locations(vehicle_id, is_active);
CREATE INDEX IF NOT EXISTS cr_parking_saved_at_idx
    ON cr_parking_locations(saved_at DESC);
```

**Key constraints:**
- Only one active parking location per vehicle at a time (enforced at the application layer).
- `latitude` and `longitude` are required (non-null). The user must grant location permission to save.
- `meter_expires_at` is an ISO datetime string. Null means no metered parking.
- `is_active` = 1 means the car is currently parked here. Clearing sets `is_active = 0` and populates `cleared_at`.
- Old parking records are retained for history (optional feature). By default, records older than 30 days with `is_active = 0` are pruned on app launch.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for SQLite operations), `@mylife/ui` (Cool Obsidian tokens, glass card components), `@mylife/module-registry` (Migration type for schema v3)
- **External:** `expo-location` (GPS coordinates on mobile), `expo-notifications` (meter expiration push notification on mobile), `react-native-maps` or `@rnmapbox/maps` (map display on mobile, check which map library the codebase already uses), `zod` (schema validation). On web: browser Geolocation API for coordinates, Leaflet or MapLibre GL JS for map display.
- **Cross-Module:** None. Parking is self-contained within the car module. Future: trails module could share map components, but no coupling in this spec.

## Functional Requirements

### User Stories
1. As a driver, I want to save my parking location with a single tap so that I can find my car later without trying to remember where I parked.
2. As a driver who parks in garages, I want to record the parking level and spot number so that I can navigate to the correct floor and spot.
3. As a driver who parks at metered spots, I want to set my meter expiration time and receive a notification 10 minutes before it runs out so that I avoid parking tickets.
4. As a driver, I want to see my parked car on a map with walking directions so that I can navigate back to it efficiently.
5. As a driver, I want to take a photo of my parking spot so that I have a visual reference (useful in large garages where all levels look identical).
6. As a privacy-first user, I want all parking data stored locally with no cloud transmission so that my location patterns remain private.
7. As a multi-vehicle user, I want to save parking for any of my vehicles and see which vehicle is parked where.

### Behavior Specification

**Saving a parking location:**
1. User taps the "Save Parking" quick-action card on the MyCar dashboard, or navigates to the Parking screen.
2. If the user has multiple vehicles, a vehicle selector appears (defaults to primary vehicle). If only one vehicle exists, it is auto-selected.
3. If the selected vehicle already has an active parking location, a confirmation dialog appears: "You already have a saved parking spot for {vehicle_name}. Replace it?" User can replace or cancel.
4. System requests location permissions if not already granted.
5. If permissions granted: system captures current GPS coordinates (latitude, longitude, altitude, accuracy).
6. If permissions denied: show error message "Location access is required to save your parking spot. Enable it in Settings." with a link to device settings. No parking location is saved.
7. After GPS capture, the Parking Details form appears with:
   - Map preview showing the pin at captured coordinates (not editable in MVP)
   - Level field (optional text input, e.g., "P3", "Level 2", "Roof")
   - Spot field (optional text input, e.g., "A-42", "Row F Spot 12")
   - Photo button (opens camera or photo picker, optional)
   - Meter expiration toggle (off by default)
   - If meter toggle is on: time picker for expiration time (defaults to 2 hours from now)
   - Notes field (optional text area)
8. User taps "Save". System creates a `cr_parking_locations` record with `is_active = 1`.
9. If meter expiration is set: system schedules a local notification for 10 minutes before `meter_expires_at` with title "{vehicle_name}: Meter expires soon" and body "Your parking meter expires in 10 minutes."
10. User returns to the Dashboard. The quick-action card now shows "Parked at {time}" with a mini-map thumbnail or address snippet.

**Viewing the saved parking location:**
1. User taps the parking card on the Dashboard (or navigates to Parking screen).
2. Map view shows the parking pin with the car icon.
3. Below the map: parking details (level, spot, time parked, duration since saved).
4. If meter expiration is set: countdown timer showing time remaining. Color-coded: green (> 30 min), amber (10-30 min), red (< 10 min or expired).
5. Action buttons: "Get Directions" (opens default maps app with walking directions to the pin), "Found My Car" (clears the parking location).
6. If a photo was saved: tappable photo thumbnail that expands to full-screen.

**Clearing the parking location ("Found My Car"):**
1. User taps "Found My Car" button.
2. Confirmation dialog: "Mark your car as found?" with "Yes" and "Cancel" buttons.
3. If confirmed: system sets `is_active = 0`, populates `cleared_at` with current timestamp, cancels any pending meter notification.
4. The parking card on the Dashboard returns to the "Save Parking" state.
5. The cleared record is retained in the database for history purposes.

**Auto-clear behavior:**
1. If a parking location has been active for more than 24 hours with no meter set, the parking card shows a subtle info banner: "Still parked here? Tap to keep or clear."
2. The parking location is NOT automatically cleared. The 24-hour nudge is informational only.
3. Old inactive records (> 30 days) are pruned on app launch to keep the database clean.

**Meter expiration notification:**
1. When a parking location is saved with a meter expiration time, a local notification is scheduled for 10 minutes before expiration.
2. Notification title: "{vehicle_name}: Meter expires soon"
3. Notification body: "Your parking meter expires in 10 minutes at {formatted_time}."
4. Tapping the notification opens the Parking screen with the active parking location.
5. If the user clears the parking location before the notification fires, the notification is cancelled.
6. If the meter expiration time passes without the user clearing the parking location, the meter countdown shows "EXPIRED" in red.

**Parking history (optional):**
1. At the bottom of the Parking screen, a "History" section shows recent parking locations (last 10, sorted by most recent).
2. Each history entry shows: date/time saved, date/time cleared, duration parked, approximate address (reverse geocoded if available, otherwise raw coordinates).
3. History can be toggled on/off in car settings via a `parking_history_enabled` setting (default: off for maximum privacy).

### Edge Cases

- **No vehicles exist:** Parking screen shows empty state with CTA "Add a vehicle to save parking locations."
- **Location permissions denied:** Show error with link to device settings. Do not save parking.
- **Location accuracy is poor (> 100m):** Show warning "Location accuracy is low ({accuracy}m). Your parking pin may not be precise." Still allow saving.
- **GPS unavailable (airplane mode, indoor with no signal):** Show error "Unable to get your location. Make sure Location Services are enabled and you have a clear view of the sky." Do not save.
- **User saves parking then immediately tries to save again for same vehicle:** Confirmation dialog "Replace existing parking spot?" prevents accidental overwrites.
- **User saves parking for Vehicle A, then saves for Vehicle B:** Both can have active parking simultaneously. Each vehicle has its own independent parking state.
- **Meter expiration in the past:** If user enters a meter time that has already passed, show validation error "Meter expiration must be in the future."
- **Meter expiration more than 24 hours away:** Accepted. Some overnight parking situations warrant long meter times.
- **Photo storage:** Photos are stored as local file URIs. If the photo file is deleted externally, the parking record shows a "Photo unavailable" placeholder.
- **Very large parking history (1000+ records):** Pruning runs on app launch, keeping only the last 30 days of cleared records. Active records are never pruned.
- **Module disabled mid-use:** Active parking data and pending notifications are preserved in SQLite. Re-enabling restores the state. Notifications may not fire while the module is disabled (platform-dependent).
- **Vehicle deleted while it has active parking:** CASCADE deletes the parking record. Pending meter notification is orphaned (no crash, just a notification for a deleted vehicle). The notification handler should gracefully handle missing vehicle data.
- **App backgrounded or killed while parking is active:** Parking data is persisted in SQLite. On next launch, the parking screen shows the saved location. Meter notifications are scheduled with the OS and fire independently of app state.
- **User manually changes device time forward past meter expiration:** Meter countdown shows "EXPIRED" based on system clock. No special handling needed.
- **No network available:** Entire feature works offline. Map tiles may not load without network, but coordinates are saved. Show a "Map unavailable offline" placeholder if tiles fail to load.

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** Tapping "Save Parking" on the dashboard captures GPS coordinates and opens the parking details form within 3 seconds.
- [ ] **AC-2:** The parking details form shows fields for level, spot, photo, meter toggle, and notes.
- [ ] **AC-3:** Saving parking with all optional fields populated creates a record and shows the parking card on the dashboard with "Parked at {time}".
- [ ] **AC-4:** Saving parking with no optional fields (only GPS coordinates) succeeds and shows the parking card.
- [ ] **AC-5:** The parking screen shows the saved location on a map with a car icon pin.
- [ ] **AC-6:** The parking screen displays level, spot, photo thumbnail, time since parked, and notes when populated.
- [ ] **AC-7:** Tapping "Get Directions" opens the device's default maps application with walking directions to the parking pin.
- [ ] **AC-8:** Tapping "Found My Car" shows a confirmation dialog. Confirming clears the parking and returns the dashboard card to "Save Parking" state.
- [ ] **AC-9:** With meter expiration set, a countdown timer is visible on the parking screen. The timer updates in real-time.
- [ ] **AC-10:** The meter countdown is color-coded: green when > 30 minutes remain, amber when 10-30 minutes remain, red when < 10 minutes remain or expired.
- [ ] **AC-11:** When meter expiration is set, a push notification fires 10 minutes before expiration (mobile only).
- [ ] **AC-12:** Tapping the meter notification opens the parking screen.
- [ ] **AC-13:** For multi-vehicle users, a vehicle selector appears when saving parking. The primary vehicle is pre-selected.
- [ ] **AC-14:** Two different vehicles can have active parking locations simultaneously, each showing independently.
- [ ] **AC-15:** If a vehicle already has active parking, saving new parking for that vehicle shows a "Replace?" confirmation.
- [ ] **AC-16:** After 24 hours with no meter set, the parking card shows an informational nudge: "Still parked here?"

### Technical Criteria
- [ ] **TC-1:** Schema migration v3 creates `cr_parking_locations` table with all columns, indexes, and correct `cr_` prefix.
- [ ] **TC-2:** `saveParking()` inserts a record with `is_active = 1` and correct GPS coordinates.
- [ ] **TC-3:** `saveParking()` deactivates any existing active parking for the same vehicle before inserting the new record.
- [ ] **TC-4:** `getActiveParking(vehicleId)` returns only the record where `is_active = 1` for that vehicle, or null if none.
- [ ] **TC-5:** `getActiveParkingAll()` returns active parking for all vehicles in a single query.
- [ ] **TC-6:** `clearParking(id)` sets `is_active = 0` and populates `cleared_at` without deleting the record.
- [ ] **TC-7:** `getParkingHistory(vehicleId, limit)` returns cleared records sorted by `saved_at DESC`, limited to `limit` rows.
- [ ] **TC-8:** `pruneOldParking(daysOld)` deletes inactive records older than the specified number of days.
- [ ] **TC-9:** Deleting a vehicle CASCADE-deletes all associated parking records.
- [ ] **TC-10:** Zod validation rejects parking with latitude outside [-90, 90] or longitude outside [-180, 180].
- [ ] **TC-11:** Zod validation rejects meter_expires_at that is in the past at save time.
- [ ] **TC-12:** On mobile, `expo-location` returns coordinates with accuracy metadata populated.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Parking location data must NOT be transmitted over the network. All storage is local SQLite only.
- [ ] **NC-2:** Clearing parking must NOT delete the record from the database. It must only set `is_active = 0`.
- [ ] **NC-3:** The auto-clear nudge at 24 hours must NOT automatically delete or clear the parking. It is informational only.
- [ ] **NC-4:** Saving parking for Vehicle A must NOT affect the active parking of Vehicle B.
- [ ] **NC-5:** Location permissions must NOT be requested at module enable or app launch. Only when the user initiates "Save Parking."
- [ ] **NC-6:** Parking history records must NOT be kept indefinitely. Pruning must run on app launch for records older than 30 days.
- [ ] **NC-7:** A photo URI referencing a deleted file must NOT crash the app. It must show a placeholder.

## UI Specification

### Mobile (Expo)

**Dashboard Quick-Action Card (no active parking):**
- Glass card: `rgba(255,255,255,0.04)` background, `rgba(255,255,255,0.10)` border
- Parking icon (car + pin) in module accent `#6366F1`
- Text: "Save Parking" in `#F0F0F5` (text token), subtitle "Tap to save your car's location" in `rgba(240,240,245,0.65)` (textSecondary)
- Full-width tappable area

**Dashboard Quick-Action Card (active parking):**
- Same glass card with a subtle accent border (`rgba(99,102,241,0.3)`)
- Mini-map thumbnail (120x80px) or address snippet on the left
- "Parked at {time}" title, "{duration} ago" subtitle
- If meter active: small countdown badge in the top-right corner of the card, color-coded (green/amber/red)

**Parking Details Form (save flow):**
- Background: `#0A0A0F` (background token)
- Map preview: 200px height, non-interactive, centered on captured coordinates with a pin
- Form fields on glass cards:
  - Level: text input, placeholder "e.g., P3, Level 2"
  - Spot: text input, placeholder "e.g., A-42, Row F"
  - Photo: camera button with thumbnail preview if taken
  - Meter: toggle switch. When on, time picker appears (default: 2 hours from now)
  - Notes: multiline text input, placeholder "Any other details..."
- "Save" button: full-width, accent color `#6366F1` background, white text, `borderRadius: 12`
- "Cancel" button: ghost style, `rgba(255,255,255,0.08)` background

**Parking Screen (viewing saved location):**
- Map view: fills top half of screen (approximately 300px), interactive, shows pin with car icon
- Below map: glass card with parking details
  - Level and spot in large text if populated
  - "Parked {duration} ago" in textSecondary
  - If meter set: countdown timer in large text (e.g., "1:42:30 remaining"), color-coded
  - Photo thumbnail (tappable to expand) if taken
  - Notes in textSecondary if populated
- Action buttons (stacked vertically, full-width):
  - "Get Directions": outlined button with compass/navigation icon, accent border
  - "Found My Car": solid button with checkmark icon, success color `#30D158` background
- History section (if enabled): scrollable list of past parking records below the action buttons

**24-hour nudge banner:**
- Info banner: `rgba(255,214,10,0.1)` background (amber tint), `rgba(255,214,10,0.3)` border
- Text: "Still parked here? Tap to keep or clear." in `#FFD60A` (amber)
- Appears above the action buttons on the parking screen

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Accessible at `/car/parking` route
- Layout: sidebar navigation (existing car sidebar), main content area
- Map view: MapLibre GL JS or Leaflet, 400px height, interactive
- Parking details displayed in a side panel next to the map on wide screens
- Form fields use the same glass card pattern with `backdrop-filter: blur(16px)`
- "Get Directions" opens Google Maps or Apple Maps in a new tab with walking directions URL
- No push notifications on web. Meter countdown is in-page only.
- Geolocation API (`navigator.geolocation.getCurrentPosition`) for GPS capture on web
- If Geolocation API is unavailable or denied: show the same error as mobile with guidance to enable in browser settings

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton card on dashboard, spinner on parking screen | Initial data fetch from SQLite |
| Empty (no vehicles) | Centered car icon, "Add a vehicle to save parking locations" + CTA button | No vehicles in cr_vehicles |
| Empty (no active parking) | Dashboard card shows "Save Parking" with tap prompt. Parking screen shows "No active parking." | No active cr_parking_locations records |
| Error (location denied) | Error message with "Enable Location in Settings" link | Location permissions denied |
| Error (GPS unavailable) | Error message "Unable to get your location" | GPS timeout or failure |
| Success (parked, no meter) | Dashboard card with "Parked at {time}", parking screen with map pin and details | Active parking record without meter |
| Success (parked, meter active) | Same as above + countdown timer (green/amber/red) | Active parking record with meter_expires_at |
| Success (meter expired) | Countdown shows "EXPIRED" in red | Current time past meter_expires_at |
| History | Scrollable list of past parking records below active parking | parking_history_enabled = true and cleared records exist |

## Test Requirements

### Unit Tests (modules/car/src/__tests__/parking-engine.test.ts)
- [ ] `isMeterExpiringSoon(expiresAt, now)`: returns false when > 10 minutes remain
- [ ] `isMeterExpiringSoon(expiresAt, now)`: returns true when <= 10 minutes remain
- [ ] `isMeterExpired(expiresAt, now)`: returns false when expiration is in the future
- [ ] `isMeterExpired(expiresAt, now)`: returns true when expiration is in the past
- [ ] `getMeterStatus(expiresAt, now)`: returns "ok" when > 30 minutes remain
- [ ] `getMeterStatus(expiresAt, now)`: returns "warning" when 10-30 minutes remain
- [ ] `getMeterStatus(expiresAt, now)`: returns "urgent" when < 10 minutes remain
- [ ] `getMeterStatus(expiresAt, now)`: returns "expired" when past expiration
- [ ] `getMeterStatus(null, now)`: returns null when no meter is set
- [ ] `formatDurationSinceParked(savedAt, now)`: returns "5 min ago" for recent parking
- [ ] `formatDurationSinceParked(savedAt, now)`: returns "2 hr 30 min ago" for multi-hour parking
- [ ] `formatDurationSinceParked(savedAt, now)`: returns "1 day 3 hr ago" for day-plus parking
- [ ] `isStaleParking(savedAt, now)`: returns false when parking is < 24 hours old
- [ ] `isStaleParking(savedAt, now)`: returns true when parking is >= 24 hours old
- [ ] `formatMeterCountdown(expiresAt, now)`: returns "1:42:30" format for active meter
- [ ] `formatMeterCountdown(expiresAt, now)`: returns "EXPIRED" when past expiration
- [ ] `validateCoordinates(lat, lng)`: returns true for valid lat [-90,90] and lng [-180,180]
- [ ] `validateCoordinates(lat, lng)`: returns false for lat outside [-90,90]
- [ ] `validateCoordinates(lat, lng)`: returns false for lng outside [-180,180]
- [ ] `validateCoordinates(0, 0)`: returns true (null island is valid coordinates)
- [ ] Zod `SaveParkingInputSchema`: accepts input with all optional fields omitted
- [ ] Zod `SaveParkingInputSchema`: accepts input with all optional fields populated
- [ ] Zod `SaveParkingInputSchema`: rejects latitude > 90
- [ ] Zod `SaveParkingInputSchema`: rejects longitude < -180
- [ ] Zod `SaveParkingInputSchema`: rejects meter_expires_at in the past (when validation context includes current time)

### Integration Tests
- [ ] Full flow: save parking for vehicle, verify record persisted with `is_active = 1` and correct coordinates
- [ ] Full flow: save parking, then clear parking, verify `is_active = 0` and `cleared_at` populated
- [ ] Full flow: save parking for vehicle that already has active parking, verify old record deactivated and new record created
- [ ] Full flow: delete vehicle, verify all associated parking records CASCADE-deleted
- [ ] Full flow: prune old parking records, verify only inactive records older than threshold are deleted
- [ ] Error flow: attempt to save parking with invalid coordinates, verify validation error and no record persisted

### QA Verification Script

1. Open the app on iOS/Android simulator.
2. Navigate to MyCar module. Add a vehicle (2024 Toyota Camry). -- Verifies vehicle creation.
3. On the MyCar Dashboard, locate the "Save Parking" quick-action card. -- Verifies card appears in empty state.
4. Tap "Save Parking." -- Verify location permission dialog appears (AC-1).
5. Grant location permission. Verify GPS coordinates are captured and the parking details form appears with a map preview. -- Corresponds to AC-1.
6. Enter Level: "P2", Spot: "B-15". -- Verifies level/spot fields work.
7. Tap the photo button. Take or select a photo. Verify thumbnail appears in the form. -- Verifies photo capture.
8. Toggle Meter on. Verify time picker appears with default 2 hours from now. Adjust to 1 hour from now. -- Corresponds to AC-9.
9. Add a note: "Near the elevator." Tap Save. -- Corresponds to AC-3.
10. Verify the Dashboard card now shows "Parked at {time}" with a mini-map or address snippet. -- Corresponds to AC-3.
11. Verify the meter countdown badge appears on the card (should be green since > 30 min). -- Corresponds to AC-10.
12. Tap the parking card. Verify the Parking screen shows the map with a pin, level "P2", spot "B-15", photo thumbnail, meter countdown, and notes. -- Corresponds to AC-5, AC-6.
13. Verify meter countdown is green and counting down in real-time. -- Corresponds to AC-9, AC-10.
14. Tap the photo thumbnail. Verify it expands to full-screen. Dismiss. -- Verifies photo viewing.
15. Tap "Get Directions." Verify the device's maps app opens with walking directions to the parking pin. -- Corresponds to AC-7.
16. Return to the app. Wait or simulate time to within 10 minutes of meter expiration.
17. Verify the meter countdown turns red. -- Corresponds to AC-10.
18. Verify a push notification fires: "{vehicle_name}: Meter expires soon". -- Corresponds to AC-11.
19. Tap the notification. Verify the Parking screen opens. -- Corresponds to AC-12.
20. Tap "Found My Car." Verify confirmation dialog appears. Tap "Yes." -- Corresponds to AC-8.
21. Verify the Dashboard card returns to "Save Parking" state. -- Corresponds to AC-8.
22. Save parking again for the Camry without any optional fields (no level, spot, photo, meter, notes). Verify it succeeds. -- Corresponds to AC-4.
23. Add a second vehicle (2022 Honda Civic). Save parking for the Civic. Verify both vehicles show independent active parking. -- Corresponds to AC-13, AC-14.
24. Attempt to save parking again for the Camry. Verify "Replace?" confirmation appears. -- Corresponds to AC-15.
25. Deny location permissions (via device settings). Attempt to save parking. Verify error message with settings link. -- Verifies NC-5 and error handling.
26. Re-enable permissions. Save parking with no meter. Wait 24 hours (simulate). Verify nudge banner appears: "Still parked here?" -- Corresponds to AC-16.
27. Verify the nudge does not auto-clear the parking. -- Corresponds to NC-3.
28. Delete the Camry vehicle. Verify associated parking records are removed. -- Corresponds to TC-9.
29. Repeat core flow (steps 3-12, 20-21) on web at `/car/parking`. Verify functional parity minus push notifications and camera capture. -- Web parity check.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to `/car/parking`, click every button, verify all 5 states (loading, empty-no-vehicles, empty-no-parking, error-location-denied, success-with-meter)
- [ ] Batch QA: after 5 features in car module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for `parking-engine.ts` (meter status, duration formatting, stale detection)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- car module has active standalone counterpart (MyCar/)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Car module has 5 tables: `cr_vehicles`, `cr_maintenance`, `cr_fuel_logs`, `cr_settings`, `cr_maintenance_schedules`
- Schema version 2, migrations v1 and v2
- No parking or location-related functionality exists
- No `expo-location` or map dependency in the car module
- Dashboard has no quick-action cards related to parking

### After This Work
- Car module has 6 tables (new: `cr_parking_locations`) with 2 new indexes
- Schema version 3, migration v3 added
- Full parking lifecycle: save location with GPS, optional level/spot/photo/meter/notes, view on map, get directions, clear when found
- `parking-engine.ts` contains pure functions for meter status, duration formatting, stale detection, and coordinate validation
- Mobile: push notification 10 minutes before meter expiration
- Web: in-page meter countdown at `/car/parking` (no push notifications)
- Dashboard quick-action card with two states (save vs. active parking)

### Files Changed

- `modules/car/src/types.ts` -- Add ParkingLocationSchema, SaveParkingInputSchema, MeterStatus type
- `modules/car/src/db/schema.ts` -- Add CREATE_PARKING_LOCATIONS table, 2 indexes
- `modules/car/src/db/crud.ts` -- Add saveParking, getActiveParking, getActiveParkingAll, clearParking, getParkingHistory, pruneOldParking
- `modules/car/src/engines/parking-engine.ts` -- NEW: isMeterExpiringSoon, isMeterExpired, getMeterStatus, formatDurationSinceParked, isStaleParking, formatMeterCountdown, validateCoordinates
- `modules/car/src/definition.ts` -- Add CAR_MIGRATION_V3, update schemaVersion to 3
- `modules/car/src/index.ts` -- Re-export new types and engine functions
- `modules/car/src/__tests__/parking-engine.test.ts` -- NEW: 25+ unit tests for parking engine
- `apps/mobile/app/(car)/parking.tsx` -- NEW: Parking location screen with map, details, and actions
- `apps/mobile/app/(car)/components/ParkingCard.tsx` -- NEW: Dashboard quick-action card
- `apps/web/app/car/parking/page.tsx` -- NEW: Parking location web page

### Known Limitations
- Map display requires network connectivity for tile loading. Coordinates are saved offline but the map may not render without network.
- Reverse geocoding (coordinates to street address) is not included in MVP. The parking screen shows the map pin location, not a text address.
- Photo storage uses local file URIs. Photos are not backed up or synced between devices.
- No automatic parking detection via Bluetooth disconnect from car (Apple Maps has this). Saving is always manual.
- No integration with parking payment apps (SpotHero, ParkMobile). Meter tracking is manual.
- Walking directions delegate to the native maps app rather than providing in-app navigation.
- Web: no camera access for photos. Photo attachment is file-picker only on web.
- The 30-day pruning of history records is a simple age-based cleanup, not configurable by the user (beyond enabling/disabling history entirely).

### Context for Next Agent
- The `cr_parking_locations` table uses a soft-delete pattern (`is_active = 0` + `cleared_at`) rather than hard deletes. The `pruneOldParking` function is the only code that hard-deletes records, and it only targets inactive records older than a threshold.
- The `saveParking` function must deactivate any existing active parking for the same `vehicle_id` before inserting the new record. This is a two-step operation (UPDATE then INSERT), not a single upsert, because we want to preserve the old record in history.
- Meter notification scheduling should be in a separate mobile-only hook (e.g., `useParkingNotifications`) that wraps `expo-notifications`, not in the shared engine module. Keep the engine pure and platform-agnostic.
- The map component choice depends on what the rest of MyLife uses. Check `modules/surf/` and `modules/trails/` for existing map library usage before adding a new one. Prefer reusing the existing map component.
- The GPS capture on mobile should use `expo-location`'s `getCurrentPositionAsync` with `Accuracy.High` for best results. On web, use the browser's Geolocation API with `enableHighAccuracy: true`.
- The vehicle selector in the save flow should match the pattern used in other car module forms (e.g., the maintenance log form). Check `apps/mobile/app/(car)/` for existing vehicle selector components.
