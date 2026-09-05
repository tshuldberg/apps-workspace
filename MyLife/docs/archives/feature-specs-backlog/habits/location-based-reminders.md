# Feature Spec: Location-Based Reminders

## Metadata
- **Module:** habits
- **Priority Score:** 23 / 50 (B-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 2 x3 + Complexity 2 x2 + CrossModule 2 x1 + PaidUser 2 x1
- **Sprint:** Sprint 4
- **Estimated CC Time:** 4-5 hours
- **Depends On:** HB-001 (Habit Creation & Management)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Streaks (Apple Design Award, $4.99 one-time) offers location-based habit reminders as a differentiator. The insight: many habits are location-dependent. "Workout" is a gym habit. "Take vitamins" is a home habit. "Read" is a commute habit. Triggering a reminder when the user physically arrives at the relevant location eliminates the cognitive load of remembering, which is the #1 reason habits fail. iOS and Android both support geofencing as a system-level service that runs even when the app is closed. This feature bridges the gap between passive tracking and active prompting.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Streaks | Yes | No ($4.99 one-time) | Location reminders via iOS region monitoring. Simple pin-on-map setup. Triggers on arrival/departure. |
| Apple Reminders | Yes | Free | Location-based reminders built into the OS. Not habit-specific but proves the UX pattern. |
| Habitica | No | N/A | No location features. |
| Habitify | No | N/A | Time-based reminders only. |
| Fabulous | No | N/A | Time-based coaching only. |

### Target User
Users with location-dependent habits (gym-goers, commuters, office workers) who forget to log completions. Also users who have habits tied to specific locations ("Stretch when arriving at office," "Take medication when arriving home"). Migration path: Streaks user who values location reminders but wants more than 24 habits, or wants the feature integrated with a full-suite tracking app.

## Technical Context

### Where This Lives in MyLife

```
modules/habits/src/
  location/
    engine.ts                     -- NEW: Geofence registration, notification logic, completion check
    __tests__/engine.test.ts      -- NEW: Engine tests
  db/
    location.ts                   -- NEW: Location reminder CRUD
    schema.ts                     -- MODIFY: Add hb_location_reminders table (V4)
  types.ts                        -- MODIFY: Add LocationReminder, GeoCoordinate, TriggerType schemas
  definition.ts                   -- MODIFY: Add V4 migration
  index.ts                        -- MODIFY: Export location engine + types + CRUD
apps/mobile/app/(habits)/
  habit-detail.tsx                -- MODIFY: Add location reminder configuration section
  (no new screen; configuration is inline on habit detail)
apps/web/app/habits/
  (no web equivalent; location reminders are mobile-only)
```

### Wireframe Position

```
Hub Dashboard
  └── MyHabits card
       ├── Today tab
       │    └── [Habit card] -> [Habit Detail]
       │         └── Location Reminder section ← YOU ARE HERE
       ├── Habits tab
       ├── Stats tab
       └── Settings tab
```

### Data Model

```sql
-- Location reminder configuration per habit
CREATE TABLE IF NOT EXISTS hb_location_reminders (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 100 CHECK (radius_meters >= 50 AND radius_meters <= 500),
  trigger_type TEXT NOT NULL DEFAULT 'arrival'
    CHECK (trigger_type IN ('arrival', 'departure', 'both')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(habit_id)  -- one location reminder per habit
);

CREATE INDEX IF NOT EXISTS hb_location_reminders_habit_idx ON hb_location_reminders(habit_id);
CREATE INDEX IF NOT EXISTS hb_location_reminders_active_idx ON hb_location_reminders(is_active);
```

### Dependencies
- **Internal:** `@mylife/habits` (habit CRUD, completion data for suppression check), `@mylife/db` (DatabaseAdapter)
- **External:**
  - `expo-location` -- geofencing and location permissions
  - `expo-notifications` -- local notifications when geofence triggers
  - `react-native-maps` or expo MapView -- map picker for location selection
  - iOS Core Location region monitoring (via expo-location)
  - Android Geofencing API (via expo-location)
- **Cross-Module:** None directly. Could integrate with Car module (location-based reminders for car maintenance when near a mechanic) in the future.

## Functional Requirements

### User Stories
1. As a gym-goer, I want to be reminded of my "Workout" habit when I arrive at the gym, so I remember to log it.
2. As a commuter, I want to be reminded of my "Read" habit when I leave home, so I start reading on the train.
3. As a user, I want to set my location by dropping a pin on a map, searching an address, or using my current location.
4. As a user who already completed the habit, I want the reminder suppressed so I'm not nagged.

### Behavior Specification

**Setting up a location reminder:**
1. User navigates to a habit's detail screen.
2. "Location Reminder" toggle is visible (mobile only; hidden on web).
3. User enables the toggle.
4. Configuration expands with:
   - Map view with search bar and "Use Current Location" button.
   - Draggable pin on the map for precise placement.
   - Location name text input (e.g., "Gym," "Office," "Home").
   - Radius slider: 50m to 500m, default 100m.
   - Trigger type: "On Arrival" / "On Departure" / "Both" segmented control.
5. User saves. A geofence is registered with the OS.

**Geofence trigger flow:**
1. User enters (or exits, depending on trigger type) the geofenced area.
2. System checks if the habit has already been completed today.
3. If NOT completed: show local notification "Time for [Habit Name]!"
4. If already completed: no notification (suppressed).
5. Notification tap opens the app directly to the habit.

**Geofence registration:**
1. When a location reminder is saved, register a geofence with `expo-location`.
2. When a location reminder is disabled or deleted, remove the geofence.
3. When the app launches, re-register all active geofences (OS may purge them on reboot).

**Location permission flow:**
1. On first location reminder setup, request "Always" location permission.
2. If user grants "When In Use" only: warn that geofencing requires "Always" permission.
3. If user denies location: hide the feature with message "Location permission required."
4. Provide a link to system settings for permission changes.

### Edge Cases

- **Location permission denied:** Feature is disabled with an explanatory message. Toggle is greyed out.
- **Location permission downgraded (Always -> When In Use):** Geofencing stops working. Next app launch shows a warning: "Location permission was changed. Location reminders may not work."
- **Geofence limit reached:** iOS supports 20 region monitors, Android supports 100. If the limit is reached: "Maximum location reminders reached (20 on iOS). Remove one to add another."
- **Multiple habits at the same location:** Each habit gets its own geofence. Multiple notifications may fire. This is acceptable; each is actionable.
- **User in airplane mode:** Geofencing still works (uses cached location and cell/WiFi).
- **Habit deleted:** Location reminder cascade-deleted (FK constraint). Geofence unregistered.
- **Habit archived:** Location reminder stays active. Archived habits can still be completed.
- **App killed/restarted:** Geofences survive app restarts (OS-level). Re-registration happens on launch for robustness.
- **Location accuracy:** GPS accuracy varies. The minimum 50m radius accounts for typical GPS drift. Indoor locations (gym inside a mall) may trigger inconsistently.
- **Web platform:** Feature hidden entirely. Location reminders are mobile-only.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Location Reminder" toggle appears on habit detail screen (mobile only)
- [ ] **AC-2:** Map view allows searching, dropping a pin, and using current location
- [ ] **AC-3:** Radius slider adjusts from 50m to 500m
- [ ] **AC-4:** Trigger type selector offers Arrival, Departure, and Both options
- [ ] **AC-5:** Notification "Time for [Habit Name]!" fires on geofence trigger
- [ ] **AC-6:** Notification is suppressed if the habit is already completed today
- [ ] **AC-7:** Feature is hidden on web platform
- [ ] **AC-8:** Location permission flow handles denied/downgraded states gracefully

### Technical Criteria
- [ ] **TC-1:** `shouldShowNotification(habitId, today, completions)` returns false when habit is completed
- [ ] **TC-2:** `shouldShowNotification(habitId, today, completions)` returns true when habit is not completed
- [ ] **TC-3:** `validateRadius(meters)` rejects values < 50 or > 500
- [ ] **TC-4:** V4 migration creates hb_location_reminders table
- [ ] **TC-5:** UNIQUE(habit_id) prevents multiple location reminders per habit
- [ ] **TC-6:** ON DELETE CASCADE removes location reminder when habit is deleted
- [ ] **TC-7:** Engine functions are pure (no side effects, no database calls)
- [ ] **TC-8:** Geofence registration uses expo-location API correctly

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Location data must NOT be transmitted to any server (privacy-first)
- [ ] **NC-2:** Location reminders must NOT appear on web
- [ ] **NC-3:** Notifications must NOT fire for already-completed habits
- [ ] **NC-4:** Exceeding the OS geofence limit must NOT crash the app

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#8B5CF6` (habits purple)
- Map: dark-themed map style matching Cool Obsidian
- Pin: accent-colored map marker
- Radius circle: semi-transparent accent color fill
- Permission warning: `#EF4444` (danger red) text

Layout (on Habit Detail screen):
```
[Habit Detail Screen]

  [Habit Info Card]
  ...

  [Location Reminder Card]
  Location Reminder  [toggle: ON]

  [Map View - dark themed]
  [📍 pin on map with radius circle]

  Location name: [Gym                  ]
  Radius: [────●──────] 150m
  Trigger: [On Arrival] [On Departure] [Both]

  -- OR if not configured --

  [Location Reminder Card]
  Location Reminder  [toggle: OFF]
```

### Web (Next.js)

Not applicable. Location reminders are mobile-only. No web UI renders.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Toggle off | Simple toggle, no map | Location reminder not configured |
| Toggle on | Map + controls expand | User enables location reminder |
| Map loading | Skeleton map placeholder | Map initializing |
| Permission denied | "Location permission required" with settings link | OS permission denied |
| Geofence limit | "Maximum reminders reached" warning | 20 geofences active (iOS) |
| Hidden (web) | Section not rendered | Platform is web |

## Test Requirements

### Unit Tests
- [ ] `shouldShowNotification`: habit not completed today -> true
- [ ] `shouldShowNotification`: habit completed today -> false
- [ ] `shouldShowNotification`: habit completed yesterday (not today) -> true
- [ ] `validateRadius`: 100 -> valid
- [ ] `validateRadius`: 49 -> invalid (below minimum)
- [ ] `validateRadius`: 501 -> invalid (above maximum)
- [ ] `validateRadius`: 50 -> valid (boundary)
- [ ] `validateRadius`: 500 -> valid (boundary)
- [ ] `validateCoordinates`: valid lat/lng -> true
- [ ] `validateCoordinates`: lat > 90 -> false
- [ ] `validateCoordinates`: lng > 180 -> false
- [ ] `formatNotificationBody`: "Workout" -> "Time for Workout!"
- [ ] `isPlatformSupported`: iOS -> true, Android -> true, web -> false

### Integration Tests
- [ ] Full flow: create location reminder -> geofence registered -> enter region -> notification fires
- [ ] Suppression flow: complete habit -> enter region -> no notification
- [ ] Delete flow: delete habit -> location reminder deleted -> geofence unregistered

### QA Verification Script

1. Open the app on [iOS] (requires location-capable device)
2. Navigate to MyHabits > Habits tab
3. Create a standard habit "Workout"
4. Navigate to Workout detail screen
5. Verify: "Location Reminder" toggle is visible -- AC-1
6. Enable the toggle
7. Verify: Map view with controls expands -- AC-2
8. Search for a nearby address or use "Current Location"
9. Adjust radius slider
10. Verify: Radius adjusts from 50m to 500m -- AC-3
11. Select "On Arrival"
12. Verify: Trigger type saved -- AC-4
13. Walk to the configured location (or simulate in simulator)
14. Verify: Notification "Time for Workout!" appears -- AC-5
15. Complete the "Workout" habit
16. Walk away and back to the location
17. Verify: No notification fires -- AC-6
18. Open app on web
19. Verify: No location reminder section visible -- AC-7
20. Deny location permission, check habit detail
21. Verify: Feature shows permission-required message -- AC-8

## gstack Quality Gates

Based on Complexity score 2 (Large -- requires native APIs, location permissions, map UI):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- verify location configuration UI on habit detail

### Required if Complexity <= 2 (Large):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Validate expo-location approach.

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Habits have time-based reminders via `reminder_time` field.
- No location awareness, no geofencing, no map UI, no location-based notifications.

### After This Work
- New engine: `modules/habits/src/location/engine.ts` with notification suppression, validation, geofence helpers.
- New CRUD: `modules/habits/src/db/location.ts` for location reminder records.
- New table: `hb_location_reminders` (V4 migration).
- Modified: Habit detail screen with location reminder configuration section.
- Geofences registered with the OS via expo-location.

### Files Changed
- `modules/habits/src/location/engine.ts` -- NEW: Location reminder engine
- `modules/habits/src/location/__tests__/engine.test.ts` -- NEW: Engine tests
- `modules/habits/src/db/location.ts` -- NEW: Location reminder CRUD
- `modules/habits/src/db/schema.ts` -- MODIFY: Add V4 table + indexes
- `modules/habits/src/types.ts` -- MODIFY: Add LocationReminder, TriggerType schemas
- `modules/habits/src/definition.ts` -- MODIFY: Add V4 migration
- `modules/habits/src/index.ts` -- MODIFY: Export location engine + types + CRUD
- `apps/mobile/app/(habits)/habit-detail.tsx` -- MODIFY: Add location reminder section

### Known Limitations
- **No saved locations library.** Each habit defines its location independently. If 3 habits are at the gym, the user sets the gym location 3 times. Future: shared location library.
- **No geofence status monitoring.** No UI to see which geofences are currently active. Future: settings screen with active geofences list.
- **No departure time tracking.** The feature triggers notifications but doesn't track how long the user spends at a location. Future: auto-timed sessions based on arrival/departure.
- **GPS accuracy in dense areas.** Indoor locations in large buildings may trigger inconsistently. The 50m minimum radius mitigates this.
- **iOS 20-geofence limit.** Apple limits region monitoring to 20 regions per app. Users with many location-based habits may hit this. The app warns but cannot increase the limit.

### Context for Next Agent
- Use `expo-location` for geofencing: `Location.startGeofencingAsync(taskName, regions)`. Each region needs: `latitude`, `longitude`, `radius`, and an `identifier` (use the location reminder ID).
- Use `expo-notifications` for local notifications: `Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null })` (trigger immediately on geofence event).
- The geofence event handler is a background task registered via `TaskManager.defineTask`. It runs even when the app is closed.
- On app launch, call `syncGeofences()` to ensure all active location reminders have registered geofences. The OS may purge geofences on device restart.
- The completion suppression check (`shouldShowNotification`) queries the database for today's completions. Keep this fast; it runs in a background task context.
- The map UI should use a dark-themed map style. For `react-native-maps`, use `customMapStyle` with a dark JSON style. For expo MapView, check available dark mode options.
- Location data (lat/lng) is stored in the local SQLite database. It NEVER leaves the device. This is critical for privacy compliance.
