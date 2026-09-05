# Feature Spec: Maintenance Schedule Reminders

## Metadata
- **Module:** car
- **Priority Score:** 31 / 50 (A-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [5] x3 + Complexity [3] x2 + CrossModule [1] x1 + PaidUser [3] x1
- **Sprint:** 5
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (builds on existing cr_maintenance table and CRUD layer)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Vehicle owners routinely forget or misjudge when maintenance is due, leading to costly repairs and reduced vehicle longevity. The highest-scored Car feature in the backlog (switching score of 5/5), maintenance reminders are the single feature most likely to pull users away from CARFAX Car Care and Simply Auto. The existing MyCar module records maintenance history but has no forward-looking scheduling or notification capability. Adding schedule-based reminders with local push notifications transforms MyCar from a passive log into an active vehicle care assistant.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| CARFAX Car Care | Yes | No (free) | Service history tracking with recall alerts, VIN lookup; reminders tied to CARFAX's cloud database of known service intervals per make/model |
| Simply Auto | Yes | Partial (premium tier) | Customizable service reminders by mileage and time intervals, push notifications, multi-vehicle support |
| Drivvo | Yes | Free tier | Maintenance reminders based on mileage and date intervals, manual entry |
| Fuelio | Yes | Free tier (~$5 one-time) | Maintenance log with date/mileage reminders, station price map |

### Target User
Everyday car owners (25-55) who currently use no app or use spreadsheets/paper to track maintenance. Users of CARFAX Car Care (free) who want offline-first privacy, or Simply Auto users who want a unified hub that also handles their budget, books, and workouts. The switching motivation is maximized (5/5) because every competitor in this space has maintenance reminders as table stakes, and MyCar currently lacks them.

## Technical Context

### Where This Lives in MyLife

```
modules/car/src/
  types.ts                            -- New Zod schemas: MaintenanceSchedule, ScheduleStatus
  db/schema.ts                        -- New table: cr_maintenance_schedules + indexes
  db/crud.ts                          -- New CRUD: schedule create/read/update/delete/auto-link
  engines/reminder-engine.ts          -- NEW: due calculation, status determination, default presets
  definition.ts                       -- Migration v2 for new table
  __tests__/reminder-engine.test.ts   -- NEW: unit tests for reminder engine

apps/mobile/app/(car)/
  reminders.tsx                       -- NEW: Upcoming Maintenance screen
  reminder-detail.tsx                 -- NEW: Reminder detail modal/screen
  add-reminder.tsx                    -- NEW: Add/Edit reminder schedule screen

apps/web/app/car/
  reminders/page.tsx                  -- NEW: Upcoming Maintenance web page
```

### Wireframe Position

```
Hub Dashboard
  └── MyCar card
       └── Maintenance tab
            └── "Upcoming" section at top ← YOU ARE HERE
                 ├── Reminder cards (sorted by urgency)
                 └── "Add Custom Reminder" button
```

The Upcoming Maintenance view is accessible from:
1. The Maintenance tab in MyCar (primary entry point)
2. A "Reminders" quick-action on the MyCar dashboard card
3. Push notification tap (deep links to the specific reminder detail)

### Data Model

```sql
-- New table: cr_maintenance_schedules (Migration v2)
CREATE TABLE IF NOT EXISTS cr_maintenance_schedules (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL DEFAULT 'other',
    service_type_custom TEXT,
    interval_miles INTEGER,
    interval_months INTEGER,
    last_service_date TEXT,
    last_service_odometer INTEGER,
    next_due_odometer INTEGER,
    next_due_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    snooze_miles INTEGER NOT NULL DEFAULT 0,
    snooze_date_offset_days INTEGER NOT NULL DEFAULT 0,
    snooze_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS cr_schedules_vehicle_active_idx
    ON cr_maintenance_schedules(vehicle_id, is_active);
CREATE INDEX IF NOT EXISTS cr_schedules_next_due_date_idx
    ON cr_maintenance_schedules(next_due_date ASC);
CREATE INDEX IF NOT EXISTS cr_schedules_next_due_odo_idx
    ON cr_maintenance_schedules(next_due_odometer ASC);

-- Constraint: at least one of interval_miles or interval_months must be non-null.
-- Enforced at the application layer (Zod validation), not SQL CHECK.
```

**service_type enum values:** `oil_change`, `tire_rotation`, `brake_inspection`, `air_filter`, `transmission_fluid`, `coolant`, `spark_plugs`, `battery`, `inspection`, `registration`, `custom`

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for SQLite operations), `@mylife/ui` (Cool Obsidian tokens, glass card components), `@mylife/module-registry` (Migration type for schema v2)
- **External:** `expo-notifications` (mobile local push notifications), `zod` (schema validation). No external APIs required.
- **Cross-Module:** None for MVP. Future integration with MyBudget (auto-categorize maintenance costs) is deferred.

## Functional Requirements

### User Stories
1. As an everyday driver, I want the app to remind me when oil changes, tire rotations, and other maintenance is due based on mileage or time intervals, so that I never miss a critical service.
2. As a multi-vehicle household manager, I want to see a unified "upcoming maintenance" view across all my vehicles, so that I can plan service appointments efficiently.
3. As a privacy-first user, I want all reminder calculations to happen on-device without any server communication, so that my driving patterns and vehicle data stay private.
4. As a new MyCar user, I want the app to offer sensible default maintenance schedules when I add a vehicle, so I don't have to research every interval myself.
5. As a user who just completed a service, I want logging a maintenance record to automatically update the relevant reminder schedule, so I don't have to manually edit the reminder.

### Behavior Specification

**Creating default schedules (onboarding):**
1. User creates a new vehicle (or enables MyCar module for the first time with an existing vehicle).
2. System presents a dialog: "Set up maintenance reminders? We'll add recommended schedules for oil changes, tire rotations, and more."
3. If user accepts: 8 default MaintenanceSchedule records are created for that vehicle with preset intervals:
   - Oil change: 5,000 mi / 6 months
   - Tire rotation: 7,500 mi
   - Brake inspection: 20,000 mi
   - Air filter: 15,000 mi / 12 months
   - Transmission fluid: 30,000 mi
   - Coolant: 30,000 mi / 24 months
   - Spark plugs: 60,000 mi
   - Battery: 48 months
4. If user declines: No schedules created. User can add them manually later.

**Viewing upcoming maintenance:**
1. User navigates to MyCar > Maintenance tab.
2. "Upcoming" section at the top shows reminder cards sorted by urgency (overdue first, then due soon, then OK).
3. Toggle between "By Vehicle" and "All Vehicles" views.
4. Each card shows: service type icon, service name, due condition (e.g., "Due in 1,200 miles or 2 months"), status badge (Overdue/Due Soon/OK), vehicle name (in All Vehicles view).
5. Status badge colors: Red (#FF453A) for Overdue, Amber (#FFD60A) for Due Soon, Green (#30D158) for OK.
6. Status badges use icons alongside color: exclamation for Overdue, clock for Due Soon, checkmark for OK.

**Viewing reminder detail:**
1. User taps a reminder card.
2. Detail screen shows: service type name and icon, current status with explanation ("Oil change is overdue by 500 miles"), last service history (date, odometer, cost).
3. Action buttons: "Log Service Now" (navigates to Add Maintenance pre-filled with service type), "Snooze 500 miles / 1 month", "Edit Interval", "Dismiss Reminder".

**Adding/editing a custom reminder:**
1. User taps "Add Custom Reminder" or "Edit Interval" on an existing reminder.
2. Form shows: service type selector (preset list + "Custom" with text field), interval type ("Mileage", "Time", or "Both" segmented control), mileage interval input, time interval input, last service date picker, last service odometer input.
3. last_service_date and last_service_odometer auto-populate from the most recent matching cr_maintenance record if one exists.
4. User taps Save. System validates at least one interval is set and creates/updates the MaintenanceSchedule record.

**Snoozing a reminder:**
1. User taps "Snooze" on a due or overdue reminder.
2. System adds 500 miles to snooze_miles (if mileage-based) and/or 30 days to snooze_date_offset_days (if time-based).
3. snooze_count increments by 1.
4. Status recalculates immediately.
5. If snooze_count reaches 3, a warning appears: "This service has been snoozed 3 times. Consider scheduling it soon." Snoozing is still allowed.

**Auto-linking maintenance records:**
1. When a user saves a new cr_maintenance record (via the existing maintenance log flow):
2. System finds a matching active MaintenanceSchedule for the same vehicle_id and service_type.
3. If found: updates last_service_date, last_service_odometer, resets snooze_miles/snooze_date_offset_days/snooze_count to 0, recalculates next_due values.

**Push notifications (mobile only):**
1. When a schedule is created, updated, or vehicle odometer changes:
2. For each active schedule, calculate status.
3. If status = "due_soon": schedule a local notification with title "{vehicle_name}: {service_type} due soon" and body "Due in {remaining_miles} miles or by {due_date}".
4. If status = "overdue": schedule a local notification with title "{vehicle_name}: {service_type} overdue" and body "Overdue by {over_miles} miles or {over_days} days". Repeat weekly until resolved.
5. Notification permissions are requested on first reminder creation, not at app launch.

### Edge Cases

- **No vehicles exist:** Upcoming Maintenance screen shows empty state with CTA "Add a vehicle to set up maintenance reminders."
- **Vehicle with no schedules:** Vehicle section shows "No reminders set up" with "Add Reminder" button.
- **Schedule with only mileage interval (no time):** Due calculation uses mileage only. No date-based urgency is shown.
- **Schedule with only time interval (no mileage):** Due calculation uses date only. No mileage-based urgency is shown.
- **Both intervals set, one overdue and one OK:** Whichever is more urgent wins. If overdue by miles but OK by date, status = "overdue".
- **Last service data missing:** Show warning "Set your last service date and odometer for accurate reminders." Reminder shows as "Unknown" status until populated. Auto-populate from most recent matching cr_maintenance record.
- **Odometer rolls back (e.g., user corrects a mistake):** Recalculate all schedule statuses. Allow odometer to decrease without error (correction is valid).
- **Duplicate service type for same vehicle:** Warn "You already have a {service_type} reminder for this vehicle. Replace it?" User confirms or cancels.
- **Module disabled mid-use:** Notifications are cancelled. Data is preserved. Re-enabling restores all schedules.
- **Very large fleet (20 vehicles, 10 schedules each = 200 schedules):** Reminder calculation must complete within 300ms. Use batch queries, not N+1.
- **Notification permissions denied:** In-app reminders still work. Show info banner "Enable notifications in Settings to receive maintenance reminders" with a link to device settings.
- **Vehicle deleted:** CASCADE deletes all associated schedules. Notifications for that vehicle are cancelled.
- **Extremely large mileage intervals (e.g., 200,000 miles):** Accepted. Validation cap at 200,000 miles.
- **Zero or negative interval:** Rejected by Zod validation. interval_miles min 500, interval_months min 1.
- **User navigates away mid-form:** Unsaved changes are discarded. No draft persistence.

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** Creating a new vehicle presents a dialog offering default maintenance schedules. Accepting creates 8 schedule records visible on the Upcoming Maintenance screen.
- [ ] **AC-2:** Declining default schedules creates zero schedules. The Upcoming Maintenance screen shows an empty state with "Add Reminder" CTA.
- [ ] **AC-3:** The Upcoming Maintenance screen shows reminders sorted by urgency: overdue first (red badge + exclamation icon), then due soon (amber badge + clock icon), then OK (green badge + checkmark icon).
- [ ] **AC-4:** Toggling between "By Vehicle" and "All Vehicles" correctly groups or flattens the reminder list.
- [ ] **AC-5:** Tapping a reminder card opens the detail view showing status explanation, last service history, and action buttons.
- [ ] **AC-6:** Tapping "Log Service Now" from a reminder navigates to Add Maintenance with the service type pre-filled.
- [ ] **AC-7:** Snoozing adds 500 miles (and/or 30 days) and immediately recalculates status. The snooze count increments.
- [ ] **AC-8:** After 3 snoozes, a warning message appears. Snoozing is still allowed.
- [ ] **AC-9:** Adding a custom reminder with a service type selector, mileage interval, and/or time interval saves correctly.
- [ ] **AC-10:** Editing an existing reminder's interval updates the schedule and recalculates next_due values.
- [ ] **AC-11:** Dismissing (deactivating) a reminder removes it from the Upcoming list (is_active = 0) but preserves the record.

### Technical Criteria
- [ ] **TC-1:** Schema migration v2 creates cr_maintenance_schedules table with all columns, indexes, and correct cr_ prefix.
- [ ] **TC-2:** `calculateScheduleStatus()` returns "overdue" when current odometer >= next_due_odometer OR current date >= next_due_date.
- [ ] **TC-3:** `calculateScheduleStatus()` returns "due_soon" when current odometer >= next_due_odometer - 500 OR current date >= next_due_date - 30 days.
- [ ] **TC-4:** `calculateScheduleStatus()` returns "ok" when neither overdue nor due_soon thresholds are met.
- [ ] **TC-5:** When a cr_maintenance record is saved with a matching service_type, the corresponding schedule's last_service_date, last_service_odometer are updated, snooze values reset to 0, and next_due values recalculate.
- [ ] **TC-6:** Creating default schedules produces exactly 8 records with the correct preset intervals for the given vehicle.
- [ ] **TC-7:** Zod validation rejects a schedule where both interval_miles and interval_months are null/undefined.
- [ ] **TC-8:** Zod validation rejects interval_miles < 500 or interval_months < 1.
- [ ] **TC-9:** Schedule CRUD operations (create, read, update, delete) persist correctly in SQLite.
- [ ] **TC-10:** Reminder status calculation for 200 schedules (20 vehicles x 10 each) completes in < 300ms.
- [ ] **TC-11:** Deleting a vehicle CASCADE-deletes all associated schedules.
- [ ] **TC-12:** On mobile, local push notifications fire for "due_soon" and "overdue" statuses when notification permissions are granted.
- [ ] **TC-13:** On mobile, if notification permissions are denied, in-app reminders still display correctly with an info banner about enabling notifications.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Reminder calculations must NOT make any network calls. All computation is on-device.
- [ ] **NC-2:** Creating schedules must NOT affect existing cr_maintenance records (read-only relationship from schedule to history).
- [ ] **NC-3:** Deactivating a schedule must NOT delete the record (only sets is_active = 0).
- [ ] **NC-4:** Notification permissions must NOT be requested at app launch or module enable. Only on first reminder creation.
- [ ] **NC-5:** Snoozing must NOT permanently alter the base interval_miles or interval_months values. Only snooze_miles and snooze_date_offset_days are modified.

## UI Specification

### Mobile (Expo)

**Upcoming Maintenance Screen:**
- Background: `#0A0A0F` (background token)
- Top bar: "Reminders" title, segmented control for "By Vehicle" / "All Vehicles"
- Reminder cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border (glassBorder token)
- Module accent: `#6366F1` (indigo, from definition.ts)
- Status badges:
  - Overdue: `#FF453A` background, exclamation icon, white text
  - Due Soon: `#FFD60A` background, clock icon, dark text
  - OK: `#30D158` background, checkmark icon, white text
- Card layout: Icon (left) | Service name + due info (center) | Status badge (right)
- "Add Custom Reminder" button at bottom: accent color outline, glass background
- Empty state: Centered icon, "No reminders set up" text, "Add Reminder" button in accent color

**Reminder Detail Modal:**
- Bottom sheet or full-screen modal on small screens
- Service icon and name at top (large, accent-colored)
- Status explanation in `textSecondary` color
- Last service section: glass card with date, odometer, cost
- Action buttons: full-width, stacked vertically, glass background

### Web (Next.js)

- Same tokens via CSS variables
- Accessible at `/car/reminders` route
- Layout: sidebar navigation (existing), main content area with reminder list
- Cards use the same glass morphism via `backdrop-filter: blur(16px)` and glass token backgrounds
- Toggle for By Vehicle / All Vehicles as tab buttons
- Reminder detail opens as a side panel (not modal) for better UX on wide screens
- "Add Custom Reminder" button in the header area

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards (3) with pulsing animation | Initial data fetch from SQLite |
| Empty (no vehicles) | Centered car icon, "Add a vehicle to set up maintenance reminders" + CTA button | No vehicles in cr_vehicles |
| Empty (no schedules) | "No reminders set up" message + "Add Reminder" button | Vehicle exists but no active schedules |
| Error | "Something went wrong loading reminders" + retry button | SQLite read failure |
| Success (all OK) | Green-badged reminder cards, sorted alphabetically by service type | All schedules in "ok" status |
| Success (mixed statuses) | Overdue cards at top (red), then due soon (amber), then OK (green) | Mixed urgency levels |
| Partial (some vehicles loading) | Not applicable (single SQLite query loads all) | N/A |

## Test Requirements

### Unit Tests (modules/car/src/__tests__/reminder-engine.test.ts)
- [ ] `calculateScheduleStatus`: returns "ok" when vehicle odometer is well below next_due_odometer
- [ ] `calculateScheduleStatus`: returns "due_soon" when within 500 miles of next_due_odometer
- [ ] `calculateScheduleStatus`: returns "overdue" when past next_due_odometer
- [ ] `calculateScheduleStatus`: returns "due_soon" when within 30 days of next_due_date
- [ ] `calculateScheduleStatus`: returns "overdue" when past next_due_date
- [ ] `calculateScheduleStatus`: date overdue takes precedence over mileage OK
- [ ] `calculateScheduleStatus`: mileage overdue takes precedence over date OK
- [ ] `calculateScheduleStatus`: handles schedule with only mileage interval (no date)
- [ ] `calculateScheduleStatus`: handles schedule with only time interval (no mileage)
- [ ] `calculateScheduleStatus`: handles null last_service values gracefully (returns "unknown")
- [ ] `calculateNextDue`: computes correct next_due_odometer from last_service_odometer + interval_miles + snooze_miles
- [ ] `calculateNextDue`: computes correct next_due_date from last_service_date + interval_months + snooze_date_offset_days
- [ ] `getDefaultSchedules`: returns exactly 8 presets with correct intervals
- [ ] `getDefaultSchedules`: oil_change preset has interval_miles=5000 and interval_months=6
- [ ] `getDefaultSchedules`: battery preset has interval_miles=null and interval_months=48
- [ ] Zod validation: rejects schedule with both intervals null
- [ ] Zod validation: rejects interval_miles < 500
- [ ] Zod validation: rejects interval_months < 1
- [ ] Zod validation: accepts schedule with only interval_miles
- [ ] Zod validation: accepts schedule with only interval_months
- [ ] Zod validation: requires service_type_custom when service_type is "custom"

### Integration Tests
- [ ] Full flow: create vehicle, accept defaults, 8 schedules persisted in cr_maintenance_schedules
- [ ] Full flow: log maintenance record, matching schedule auto-updates last_service fields and snooze resets
- [ ] Full flow: snooze a schedule, next_due values shift, status recalculates
- [ ] Full flow: delete vehicle, all associated schedules are CASCADE-deleted
- [ ] Error flow: create schedule with no interval, validation error returned, no record persisted

### QA Verification Script

1. Open the app on iOS/Android simulator.
2. Navigate to MyCar module. Add a new vehicle (2024 Honda Civic, 20000 miles). -- Verifies vehicle creation.
3. When prompted "Set up maintenance reminders?", tap "Yes". -- Corresponds to AC-1.
4. Navigate to Maintenance tab > Upcoming section. Verify 8 reminder cards appear, all showing "OK" status (green badges). -- Corresponds to AC-1, AC-3.
5. Toggle to "All Vehicles" view. Verify cards still appear with vehicle name shown. -- Corresponds to AC-4.
6. Toggle back to "By Vehicle" view. Verify cards grouped under the Honda Civic section. -- Corresponds to AC-4.
7. Update the vehicle's odometer to 24,800 miles (via vehicle edit).
8. Return to Upcoming Maintenance. Verify oil change card now shows "Due Soon" (amber badge, clock icon, "Due in 200 miles"). -- Corresponds to AC-3, TC-3.
9. Tap the oil change card. Verify detail view shows status explanation, "Due in 200 miles or by [date]", and last service info (if available). -- Corresponds to AC-5.
10. Tap "Log Service Now". Verify navigation to Add Maintenance with service type pre-filled as "Oil Change". -- Corresponds to AC-6.
11. Go back. Tap "Snooze 500 miles" on the oil change reminder. Verify status recalculates (should return to "OK" since 24800 < 25000 + 500 = 25500). -- Corresponds to AC-7.
12. Snooze two more times (total 3). Verify warning message appears on the 3rd snooze. -- Corresponds to AC-8.
13. Snooze a 4th time. Verify snooze still works but warning persists. -- Corresponds to AC-8.
14. Update odometer to 26,000 miles. Verify oil change shows "Overdue" (red badge, exclamation icon). -- Corresponds to TC-2.
15. Log an oil change maintenance record at 26,000 miles via the maintenance log flow.
16. Return to Upcoming Maintenance. Verify oil change schedule reset: last service at 26,000, next due at 31,000 (26000 + 5000), status "OK", snooze count back to 0. -- Corresponds to TC-5.
17. Tap "Add Custom Reminder". Add a custom reminder: type "Car Wash", interval 1 month. Save. -- Corresponds to AC-9.
18. Verify the new custom reminder appears in the list with "OK" status. -- Corresponds to AC-9.
19. Tap the custom reminder, tap "Dismiss Reminder". Verify it disappears from the Upcoming list. -- Corresponds to AC-11.
20. Navigate to Settings. If maintenance reminders toggle exists, toggle it off. Verify Upcoming Maintenance screen shows info bar "Reminders are turned off." -- Corresponds to NC-3.
21. Add a second vehicle. Decline default schedules. Verify no schedules appear for the second vehicle. -- Corresponds to AC-2.
22. Delete the second vehicle. Verify no orphaned schedule records remain. -- Corresponds to TC-11.
23. Repeat steps 2-18 on web at `/car/reminders`. Verify functional parity (minus push notifications). -- Web parity check.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 3 (Medium):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to `/car/reminders`, click every button, verify all 5 states (loading, empty-no-vehicles, empty-no-schedules, error, success-mixed)
- [ ] Batch QA: after 5 features in car module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for `reminder-engine.ts` (calculateScheduleStatus, calculateNextDue, getDefaultSchedules)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- car module has active standalone counterpart (MyCar/)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Car module has 4 tables: cr_vehicles, cr_maintenance, cr_fuel_logs, cr_settings
- Schema version 1, migration v1 only
- Maintenance records are logged but there is no scheduling, no forward-looking reminders, no push notifications
- No reminder engine or schedule calculation logic exists
- MaintenanceTypeSchema includes: oil_change, tire_rotation, brakes, battery, inspection, wash, other

### After This Work
- Car module has 5 tables (new: cr_maintenance_schedules) with 3 new indexes
- Schema version 2, migration v2 added
- Full reminder lifecycle: create schedules (default or custom), view upcoming by urgency, snooze, auto-link to maintenance records, dismiss
- `reminder-engine.ts` contains pure functions for status calculation, next-due computation, and default presets
- Mobile: push notifications for due_soon and overdue statuses
- Web: in-app reminder display at /car/reminders (no push notifications)

### Files Changed

- `modules/car/src/types.ts` -- Add MaintenanceScheduleSchema, ScheduleServiceTypeSchema, ScheduleStatusSchema Zod schemas and types
- `modules/car/src/db/schema.ts` -- Add CREATE_MAINTENANCE_SCHEDULES table, 3 indexes
- `modules/car/src/db/crud.ts` -- Add schedule CRUD functions: createSchedule, getSchedulesByVehicle, getActiveSchedules, updateSchedule, deactivateSchedule, deleteSchedulesByVehicle, autoLinkMaintenanceToSchedule
- `modules/car/src/engines/reminder-engine.ts` -- NEW: calculateScheduleStatus, calculateNextDue, getDefaultSchedules, sortByUrgency
- `modules/car/src/definition.ts` -- Add CAR_MIGRATION_V2, update schemaVersion to 2
- `modules/car/src/index.ts` -- Re-export new types and engine functions
- `modules/car/src/__tests__/reminder-engine.test.ts` -- NEW: 21+ unit tests for reminder engine
- `apps/mobile/app/(car)/reminders.tsx` -- NEW: Upcoming Maintenance screen
- `apps/mobile/app/(car)/reminder-detail.tsx` -- NEW: Reminder detail modal
- `apps/mobile/app/(car)/add-reminder.tsx` -- NEW: Add/Edit reminder form
- `apps/web/app/car/reminders/page.tsx` -- NEW: Upcoming Maintenance web page

### Known Limitations
- Push notifications are mobile-only (web does not have local push notification support in this implementation)
- No integration with MyBudget for cost tracking -- deferred to cross-module integration sprint
- Default schedules are generic and not customized per vehicle make/model/year (CARFAX has this via their cloud database; we trade cloud dependency for privacy)
- Odometer must be manually updated by the user (no GPS/OBD-II auto-tracking in this feature)
- Snooze values are additive and simple (500 mi / 30 days) -- no custom snooze amounts in MVP

### Context for Next Agent
- The MaintenanceTypeSchema in `types.ts` currently has 7 values; the schedule system introduces an expanded ScheduleServiceTypeSchema with 11 values (adds air_filter, transmission_fluid, coolant, spark_plugs, registration, custom). These are intentionally separate enums because maintenance records use a simpler set.
- The auto-link logic in `autoLinkMaintenanceToSchedule` matches on vehicle_id + service_type. If the user logs a maintenance record with type "other", it will NOT auto-link to any schedule (since there's no generic "other" schedule). This is intentional.
- The `next_due_odometer` and `next_due_date` columns are computed values stored for query performance (sorting by urgency requires comparing them). They must be recalculated any time last_service values, intervals, or snooze values change.
- The notification scheduling logic should be in a separate mobile-only hook (e.g., `useMaintenanceNotifications`) that wraps `expo-notifications`, not in the shared engine module. Keep the engine pure and platform-agnostic.
