# Feature Spec: Maintenance Schedule Reminders

## Metadata
- **Module:** homes
- **Priority Score:** 32 / 50 (A-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [5] x3 + Complexity [3] x2 + CrossModule [1] x1 + PaidUser [4] x1
- **Sprint:** 5
- **Estimated CC Time:** 4-5 hours
- **Depends On:** none (builds on existing hm_ schema; adds new tables for property ownership and maintenance scheduling)
- **Blocks:** Cost tracking (B-tier), Document storage (B-tier), Home inventory (B-tier)

## Business Context

### Why This Feature Exists
Homeowners routinely forget or misjudge when seasonal and recurring maintenance is due, leading to expensive emergency repairs and reduced property value. HVAC neglect alone costs US homeowners $4B+ annually in premature replacements. The highest switching-score feature (5/5) in the Homes backlog, maintenance reminders are the only A-tier feature and the single capability most likely to convert Homes from a passive listing tracker into an active homeownership tool. Competitors HomeZada ($59-99/yr) and Centriq ($32/yr) both anchor their value proposition on maintenance scheduling. Adding this to a module the user already has through their MyLife subscription eliminates the need for a separate home management app.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| HomeZada | Yes | Yes ($59-99/yr) | Cloud-based maintenance schedules tied to property profile, push reminders, service history, cost tracking, contractor recommendations |
| Centriq | Yes | Yes ($32/yr) | Appliance-centric reminders via product barcode scan, how-to guides, push notifications, warranty tracking |
| Thumbtack | Partial | No (free) | No scheduling; connects users to contractors on-demand. No proactive reminders. |
| Angi | Partial | No (free) | Seasonal maintenance tips (content only). No personalized scheduling. |

### Target User
Homeowners (28-65) who currently rely on memory, sticky notes, or spreadsheets to track home maintenance. Users of HomeZada ($59-99/yr) or Centriq ($32/yr) who want privacy-first, offline scheduling bundled into a hub they already pay for. Also renters responsible for in-unit maintenance (filter changes, smoke detectors) who want a simpler tool than a full homeowner platform. The switching motivation is maximized (5/5) because every dedicated home management competitor has maintenance reminders as their core feature.

## Technical Context

### Where This Lives in MyLife

```
modules/homes/src/
  types.ts                                  -- New Zod schemas: Property, MaintenanceSchedule, ScheduleStatus
  db/schema.ts                              -- New tables: hm_properties, hm_maintenance_schedules, hm_settings + indexes
  db/crud.ts                                -- New CRUD: property and schedule create/read/update/delete, settings
  engines/reminder-engine.ts                -- NEW: due calculation, status determination, default presets
  definition.ts                             -- Migration v2 for new tables
  __tests__/reminder-engine.test.ts         -- NEW: unit tests for reminder engine

apps/mobile/app/(homes)/
  properties.tsx                            -- NEW: My Properties list screen
  property-detail.tsx                       -- NEW: Property detail with reminders
  add-property.tsx                          -- NEW: Add/Edit property screen
  reminders.tsx                             -- NEW: Upcoming Maintenance screen (cross-property)
  reminder-detail.tsx                       -- NEW: Reminder detail modal
  add-reminder.tsx                          -- NEW: Add/Edit reminder schedule screen

apps/web/app/homes/
  properties/page.tsx                       -- NEW: My Properties web page
  reminders/page.tsx                        -- NEW: Upcoming Maintenance web page
```

### Wireframe Position

```
Hub Dashboard
  └── MyHomes card
       ├── Search tab (existing listings)
       ├── Saved tab (existing saved listings)
       ├── Properties tab ← NEW
       │    ├── Property cards (owned/rented homes)
       │    └── "Add Property" button
       └── Reminders tab ← NEW (YOU ARE HERE)
            ├── Reminder cards sorted by urgency
            └── "Add Custom Reminder" button
```

The Upcoming Maintenance view is accessible from:
1. The new "Reminders" tab in MyHomes (primary entry point)
2. A property detail screen's "Maintenance" section
3. Push notification tap (deep links to the specific reminder detail)

### Data Model

```sql
-- New table: hm_properties (Migration v2)
-- Represents homes the user owns or rents, distinct from hm_listings (homes being evaluated for purchase)
CREATE TABLE IF NOT EXISTS hm_properties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                      -- "Main House", "Beach Condo", etc.
    address TEXT,
    city TEXT,
    state TEXT,
    year_built INTEGER,
    sqft INTEGER,
    property_type TEXT NOT NULL DEFAULT 'house',  -- house, condo, apartment, townhouse, other
    ownership_type TEXT NOT NULL DEFAULT 'own',    -- own, rent
    listing_id TEXT REFERENCES hm_listings(id) ON DELETE SET NULL,  -- optional link to original listing
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- New table: hm_maintenance_schedules (Migration v2)
CREATE TABLE IF NOT EXISTS hm_maintenance_schedules (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
    task_type TEXT NOT NULL DEFAULT 'custom',
    task_type_custom TEXT,                    -- required when task_type = 'custom'
    interval_months INTEGER NOT NULL,         -- recurrence interval in months (min 1)
    season_preference TEXT,                   -- spring, summer, fall, winter, null (any)
    last_completed_date TEXT,
    next_due_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    snooze_days INTEGER NOT NULL DEFAULT 0,
    snooze_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- New table: hm_settings (Migration v2)
CREATE TABLE IF NOT EXISTS hm_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS hm_properties_type_idx
    ON hm_properties(property_type);
CREATE INDEX IF NOT EXISTS hm_schedules_property_active_idx
    ON hm_maintenance_schedules(property_id, is_active);
CREATE INDEX IF NOT EXISTS hm_schedules_next_due_idx
    ON hm_maintenance_schedules(next_due_date ASC);
```

**task_type enum values:** `hvac_filter`, `hvac_service`, `gutter_cleaning`, `roof_inspection`, `smoke_detector`, `water_heater_flush`, `dryer_vent`, `pest_control`, `exterior_paint`, `lawn_mower_service`, `window_cleaning`, `plumbing_inspection`, `appliance_service`, `chimney_sweep`, `custom`

**property_type enum values:** `house`, `condo`, `apartment`, `townhouse`, `other`

**ownership_type enum values:** `own`, `rent`

**season_preference enum values:** `spring`, `summer`, `fall`, `winter`, `null` (any time)

**Note:** Unlike the Car module which uses mileage-based intervals, home maintenance is purely time-based (months). Some tasks have seasonal preferences (gutter cleaning in fall, HVAC service in spring/fall) which influence due date calculation.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for SQLite operations), `@mylife/ui` (Cool Obsidian tokens, glass card components), `@mylife/module-registry` (Migration type for schema v2)
- **External:** `expo-notifications` (mobile local push notifications), `zod` (schema validation). No external APIs required.
- **Cross-Module:** None for MVP. Future integration with MyBudget (auto-categorize home maintenance costs) is deferred.

## Functional Requirements

### User Stories
1. As a homeowner, I want the app to remind me when seasonal and recurring maintenance is due (HVAC filters, gutter cleaning, roof inspections), so that I catch problems early and avoid expensive emergency repairs.
2. As a multi-property owner, I want to see a unified "upcoming maintenance" view across all my properties, so that I can plan service appointments efficiently.
3. As a new homeowner, I want the app to suggest a sensible set of default maintenance schedules when I add my first property, so I don't have to research every maintenance interval myself.
4. As a renter, I want to set up lighter maintenance reminders (smoke detectors, HVAC filters) for tasks I'm responsible for, without seeing irrelevant homeowner tasks like roof inspections.
5. As a privacy-first user, I want all reminder calculations to happen on-device without any server communication, so that my home data stays private.
6. As a user who bought a home through MyHomes listings, I want to promote a closed listing into a property for ongoing maintenance tracking, so the transition from buyer to owner is seamless.

### Behavior Specification

**Adding a property:**
1. User navigates to MyHomes > Properties tab.
2. User taps "Add Property".
3. Form shows: property name (required), address, city, state, year built, sqft, property type selector (house/condo/apartment/townhouse/other), ownership type (Own/Rent toggle).
4. User saves. The property record is created.
5. System presents a dialog: "Set up maintenance reminders? We'll add recommended schedules based on your property type."
6. If user accepts: default MaintenanceSchedule records are created (see defaults below).
7. If user declines: no schedules created. User can add them manually later.

**Promoting a listing to a property:**
1. When a listing's status is changed to "closed" (via existing `updateListingStatus`):
2. System presents a prompt: "Congratulations! Would you like to add this as a property for maintenance tracking?"
3. If accepted: a new hm_properties record is created pre-filled from the listing (address, city, state, sqft). The listing_id FK is set.
4. Default reminders dialog follows (same as step 5 above).

**Default schedules by property type:**

For `house` and `townhouse` (10 defaults):
- HVAC filter change: 3 months
- HVAC professional service: 12 months, season: spring
- Gutter cleaning: 6 months, season: fall
- Roof inspection: 12 months, season: spring
- Smoke/CO detector battery: 6 months
- Water heater flush: 12 months
- Dryer vent cleaning: 12 months
- Pest control inspection: 12 months, season: spring
- Window cleaning: 6 months, season: spring
- Lawn mower service: 12 months, season: spring

For `condo` and `apartment` (5 defaults, subset -- no roof/gutter/lawn):
- HVAC filter change: 3 months
- Smoke/CO detector battery: 6 months
- Dryer vent cleaning: 12 months
- Window cleaning: 6 months, season: spring
- Appliance service: 12 months

For `other` (3 basics):
- Smoke/CO detector battery: 6 months
- HVAC filter change: 3 months
- Appliance service: 12 months

For `rent` ownership override: regardless of property type, only include schedules where the renter is typically responsible: HVAC filter, smoke/CO detector battery, dryer vent cleaning, appliance service (max 4).

**Viewing upcoming maintenance:**
1. User navigates to MyHomes > Reminders tab.
2. "Upcoming" section shows reminder cards sorted by urgency (overdue first, then due soon, then OK).
3. Toggle between "By Property" and "All Properties" views.
4. Each card shows: task type icon, task name, due info (e.g., "Due in 2 weeks"), status badge (Overdue/Due Soon/OK), property name (in All Properties view).
5. Status badge colors: Red (#FF453A) for Overdue, Amber (#FFD60A) for Due Soon, Green (#30D158) for OK.
6. Status badges use icons alongside color: exclamation for Overdue, clock for Due Soon, checkmark for OK.

**Viewing reminder detail:**
1. User taps a reminder card.
2. Detail screen shows: task type name and icon, current status with explanation ("Gutter cleaning is overdue by 3 weeks"), last completed date (if any), season preference note (if applicable), custom notes.
3. Action buttons: "Mark Complete" (logs completion, recalculates next_due), "Snooze 2 Weeks", "Edit Schedule", "Dismiss Reminder".

**Adding/editing a custom reminder:**
1. User taps "Add Custom Reminder" or "Edit Schedule" on an existing reminder.
2. Form shows: property selector (if user has multiple), task type selector (preset list + "Custom" with text field), interval months input (numeric stepper, min 1, max 120), season preference selector (Spring/Summer/Fall/Winter/Any), last completed date picker, notes text area.
3. User taps Save. System validates that interval_months >= 1 and creates/updates the schedule.

**Marking a task complete:**
1. User taps "Mark Complete" on a due or overdue reminder.
2. System sets last_completed_date to today, resets snooze_days and snooze_count to 0, recalculates next_due_date.
3. Status badge updates immediately.

**Snoozing a reminder:**
1. User taps "Snooze 2 Weeks" on a due or overdue reminder.
2. System adds 14 to snooze_days.
3. snooze_count increments by 1.
4. Status recalculates immediately (next_due_date effectively shifts forward by snooze_days total).
5. If snooze_count reaches 3, a warning appears: "This task has been snoozed 3 times. Consider scheduling it soon." Snoozing is still allowed.

**Push notifications (mobile only):**
1. When a schedule is created, updated, or marked complete:
2. For each active schedule, calculate status.
3. If status = "due_soon": schedule a local notification with title "{property_name}: {task_type} due soon" and body "Due by {due_date}."
4. If status = "overdue": schedule a local notification with title "{property_name}: {task_type} overdue" and body "Was due on {due_date}." Repeat weekly until resolved.
5. Notification permissions are requested on first reminder creation, not at app launch.

**Due date calculation (`calculateNextDueDate`):**
1. If last_completed_date is set: `next_due_date = last_completed_date + interval_months + snooze_days`
2. If last_completed_date is null (never completed): `next_due_date = created_at + interval_months + snooze_days`
3. Season preference adjustment: if season_preference is set and the raw next_due_date falls outside that season, shift to the first day of the preferred season window:
   - spring: March 1
   - summer: June 1
   - fall: September 1
   - winter: December 1
   - Only shift forward, never backward. If the raw date is already within the season, use it as-is.
4. Status thresholds:
   - "overdue": current date > next_due_date
   - "due_soon": current date > next_due_date - 14 days
   - "ok": otherwise
   - "unknown": last_completed_date is null AND created_at is null (should not happen normally)

### Edge Cases

- **No properties exist:** Reminders tab shows empty state with CTA "Add a property to set up maintenance reminders."
- **Property with no schedules:** Property detail shows "No reminders set up" with "Add Reminder" button.
- **Season preference shifts due date far into the future:** A gutter cleaning due in January with fall preference shifts to September 1 (8 months away). This is correct behavior -- gutter cleaning in January is less useful than waiting for fall.
- **Season preference and short interval conflict:** An HVAC filter (3-month interval) with spring preference would always snap to March. Since HVAC filters should be seasonal-agnostic, the default preset has no season_preference for this task. Warn in the UI if a user sets season_preference on a task with interval < 6 months: "Short-interval tasks may skip cycles with a season preference."
- **Last completed date in the future:** Reject. Zod validation ensures last_completed_date <= today.
- **Module disabled mid-use:** Notifications are cancelled. Data is preserved. Re-enabling restores all schedules.
- **Property deleted:** CASCADE deletes all associated schedules. Notifications for that property are cancelled.
- **Many properties (10 properties, 10 schedules each = 100 schedules):** Reminder calculation must complete within 200ms. Use batch queries, not N+1.
- **Notification permissions denied:** In-app reminders still work. Show info banner "Enable notifications in Settings to receive maintenance reminders" with a link to device settings.
- **Duplicate task type for same property:** Warn "You already have a {task_type} reminder for this property. Replace it?" User confirms or cancels.
- **Listing promoted to property after being deleted:** The listing_id FK uses ON DELETE SET NULL, so the property remains valid.
- **User navigates away mid-form:** Unsaved changes are discarded. No draft persistence.
- **Zero interval_months:** Rejected by Zod validation (min 1).
- **interval_months > 120 (10 years):** Rejected by Zod validation (max 120). Reasonable upper bound for home maintenance.
- **Renter adds property then changes to own:** Re-offer default schedules dialog for the additional owner-only tasks.

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** Adding a new property (type: house, ownership: own) and accepting defaults creates 10 schedule records visible on the Reminders screen.
- [ ] **AC-2:** Adding a new property (type: condo, ownership: own) and accepting defaults creates 5 schedule records.
- [ ] **AC-3:** Adding a new property (type: house, ownership: rent) and accepting defaults creates 4 renter-appropriate schedule records.
- [ ] **AC-4:** Declining default schedules creates zero schedules. The Reminders screen shows an empty state for that property with "Add Reminder" CTA.
- [ ] **AC-5:** The Reminders screen shows reminders sorted by urgency: overdue first (red badge + exclamation icon), then due soon (amber badge + clock icon), then OK (green badge + checkmark icon).
- [ ] **AC-6:** Toggling between "By Property" and "All Properties" correctly groups or flattens the reminder list.
- [ ] **AC-7:** Tapping a reminder card opens the detail view showing status explanation, last completed date, season info, and action buttons.
- [ ] **AC-8:** Tapping "Mark Complete" sets last_completed_date to today, resets snooze, recalculates next_due_date, and updates the status badge immediately.
- [ ] **AC-9:** Snoozing adds 14 days and immediately recalculates status. The snooze count increments.
- [ ] **AC-10:** After 3 snoozes, a warning message appears. Snoozing is still allowed.
- [ ] **AC-11:** Adding a custom reminder with a task type, interval months, and optional season preference saves correctly.
- [ ] **AC-12:** Editing an existing reminder's interval updates the schedule and recalculates next_due_date.
- [ ] **AC-13:** Dismissing (deactivating) a reminder removes it from the Reminders list (is_active = 0) but preserves the record.
- [ ] **AC-14:** Changing a listing status to "closed" presents a promotion dialog. Accepting creates a property pre-filled from the listing.
- [ ] **AC-15:** The Properties tab shows all user properties with name, type, and active reminder count.
- [ ] **AC-16:** Property detail screen shows the property info and a list of its maintenance schedules.

### Technical Criteria
- [ ] **TC-1:** Schema migration v2 creates hm_properties, hm_maintenance_schedules, and hm_settings tables with all columns, indexes, and correct hm_ prefix.
- [ ] **TC-2:** `calculateScheduleStatus()` returns "overdue" when current date > next_due_date.
- [ ] **TC-3:** `calculateScheduleStatus()` returns "due_soon" when current date > next_due_date - 14 days.
- [ ] **TC-4:** `calculateScheduleStatus()` returns "ok" when neither overdue nor due_soon thresholds are met.
- [ ] **TC-5:** `calculateNextDueDate()` correctly adds interval_months to last_completed_date.
- [ ] **TC-6:** `calculateNextDueDate()` falls back to created_at when last_completed_date is null.
- [ ] **TC-7:** `calculateNextDueDate()` applies season_preference by shifting forward to the preferred season start when the raw date falls outside that season.
- [ ] **TC-8:** `calculateNextDueDate()` leaves the date unchanged when it already falls within the preferred season.
- [ ] **TC-9:** `calculateNextDueDate()` correctly adds snooze_days after interval and season adjustments.
- [ ] **TC-10:** Marking a task complete resets snooze_days and snooze_count to 0 and recalculates next_due_date.
- [ ] **TC-11:** `getDefaultSchedules("house", "own")` returns exactly 10 presets with correct intervals and season preferences.
- [ ] **TC-12:** `getDefaultSchedules("condo", "own")` returns exactly 5 presets.
- [ ] **TC-13:** `getDefaultSchedules("house", "rent")` returns exactly 4 renter-appropriate presets.
- [ ] **TC-14:** Zod validation rejects interval_months < 1 or > 120.
- [ ] **TC-15:** Zod validation requires task_type_custom when task_type is "custom".
- [ ] **TC-16:** Zod validation rejects last_completed_date in the future.
- [ ] **TC-17:** Property and schedule CRUD operations (create, read, update, delete) persist correctly in SQLite.
- [ ] **TC-18:** Deleting a property CASCADE-deletes all associated schedules.
- [ ] **TC-19:** Deleting a listing SET NULLs the listing_id FK on any linked property (property is preserved).
- [ ] **TC-20:** Reminder status calculation for 100 schedules (10 properties x 10 each) completes in < 200ms.
- [ ] **TC-21:** On mobile, local push notifications fire for "due_soon" and "overdue" statuses when permissions are granted.
- [ ] **TC-22:** On mobile, if notification permissions are denied, in-app reminders display correctly with an info banner.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Reminder calculations must NOT make any network calls. All computation is on-device.
- [ ] **NC-2:** Adding properties or schedules must NOT affect existing hm_listings or hm_tours records.
- [ ] **NC-3:** Deactivating a schedule must NOT delete the record (only sets is_active = 0).
- [ ] **NC-4:** Notification permissions must NOT be requested at app launch or module enable. Only on first reminder creation.
- [ ] **NC-5:** Snoozing must NOT permanently alter the base interval_months value. Only snooze_days is modified.
- [ ] **NC-6:** Season preference adjustment must NOT shift a due date backward, only forward.

## UI Specification

### Mobile (Expo)

**Properties Tab:**
- Background: `#0A0A0F` (background token)
- Property cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border (glassBorder token)
- Card layout: Property name (bold) | Address subtitle | Type badge | Active reminders count
- Module accent: `#D97706` (amber, from definition.ts)
- "Add Property" button at bottom: accent color outline, glass background
- Empty state: Centered home icon, "No properties yet" text, "Add Property" button in accent color

**Reminders Tab (Upcoming Maintenance):**
- Background: `#0A0A0F` (background token)
- Top bar: "Reminders" title, segmented control for "By Property" / "All Properties"
- Reminder cards: glass token fill with glassBorder
- Status badges:
  - Overdue: `#FF453A` background, exclamation icon, white text
  - Due Soon: `#FFD60A` background, clock icon, dark text
  - OK: `#30D158` background, checkmark icon, white text
- Card layout: Icon (left) | Task name + due info (center) | Status badge (right)
- "Add Custom Reminder" button at bottom: accent color outline, glass background
- Empty state: Centered icon, "No reminders set up" text, "Add Property" button if no properties, "Add Reminder" button if properties exist but no schedules

**Reminder Detail Modal:**
- Bottom sheet or full-screen modal on small screens
- Task icon and name at top (large, accent-colored)
- Status explanation in `textSecondary` color
- Season preference tag if applicable (e.g., "Best in: Fall")
- Last completed section: glass card with date
- Action buttons: full-width, stacked vertically, glass background

**Add Property Screen:**
- Form fields: name (text), address (text), city (text), state (2-letter picker), year built (numeric), sqft (numeric), property type (segmented: House/Condo/Apt/Townhouse/Other), ownership (toggle: Own/Rent)
- Save button: full-width, accent color

### Web (Next.js)

- Same tokens via CSS variables
- Properties accessible at `/homes/properties` route
- Reminders accessible at `/homes/reminders` route
- Layout: sidebar navigation (existing), main content area
- Cards use glass morphism via `backdrop-filter: blur(16px)` and glass token backgrounds
- Property/reminder toggle as tab buttons
- Reminder detail opens as a side panel (not modal) for better UX on wide screens
- "Add Property" and "Add Custom Reminder" buttons in the header area

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards (3) with pulsing animation | Initial data fetch from SQLite |
| Empty (no properties) | Centered home icon, "Add a property to set up maintenance reminders" + CTA button | No records in hm_properties |
| Empty (no schedules) | "No reminders set up" message + "Add Reminder" button | Property exists but no active schedules |
| Error | "Something went wrong loading reminders" + retry button | SQLite read failure |
| Success (all OK) | Green-badged reminder cards, sorted alphabetically by task type | All schedules in "ok" status |
| Success (mixed statuses) | Overdue cards at top (red), then due soon (amber), then OK (green) | Mixed urgency levels |

## Test Requirements

### Unit Tests (modules/homes/src/__tests__/reminder-engine.test.ts)
- [ ] `calculateScheduleStatus`: returns "ok" when next_due_date is > 14 days away
- [ ] `calculateScheduleStatus`: returns "due_soon" when within 14 days of next_due_date
- [ ] `calculateScheduleStatus`: returns "overdue" when past next_due_date
- [ ] `calculateScheduleStatus`: returns "unknown" when next_due_date is null
- [ ] `calculateNextDueDate`: computes correct date from last_completed_date + interval_months
- [ ] `calculateNextDueDate`: falls back to created_at when last_completed_date is null
- [ ] `calculateNextDueDate`: adds snooze_days correctly
- [ ] `calculateNextDueDate`: shifts forward to spring (March 1) when season_preference is "spring" and raw date is in January
- [ ] `calculateNextDueDate`: shifts forward to fall (September 1) when season_preference is "fall" and raw date is in July
- [ ] `calculateNextDueDate`: leaves date unchanged when already in preferred season
- [ ] `calculateNextDueDate`: shifts to next year's season start when raw date is past the current year's window
- [ ] `getDefaultSchedules("house", "own")`: returns exactly 10 presets with correct intervals
- [ ] `getDefaultSchedules("condo", "own")`: returns exactly 5 presets
- [ ] `getDefaultSchedules("apartment", "rent")`: returns exactly 4 renter presets
- [ ] `getDefaultSchedules("house", "rent")`: returns 4 renter-appropriate presets (not full owner set)
- [ ] `getDefaultSchedules`: hvac_filter preset has interval_months=3 and no season_preference
- [ ] `getDefaultSchedules`: gutter_cleaning preset has interval_months=6 and season_preference="fall"
- [ ] Zod validation: rejects schedule with interval_months < 1
- [ ] Zod validation: rejects schedule with interval_months > 120
- [ ] Zod validation: requires task_type_custom when task_type is "custom"
- [ ] Zod validation: rejects last_completed_date in the future
- [ ] Zod validation: accepts valid PropertySchema with all required fields
- [ ] `sortByUrgency`: overdue schedules sort before due_soon, due_soon before ok
- [ ] `markComplete`: sets last_completed_date to today and resets snooze values

### Integration Tests
- [ ] Full flow: create property (house, own), accept defaults, 10 schedules persisted in hm_maintenance_schedules
- [ ] Full flow: create property (condo, rent), accept defaults, 4 renter schedules persisted
- [ ] Full flow: mark task complete, last_completed_date updates, next_due_date recalculates, snooze resets
- [ ] Full flow: snooze a schedule, next_due_date shifts, status recalculates
- [ ] Full flow: promote listing (status -> closed), property created with listing data
- [ ] Full flow: delete property, all associated schedules are CASCADE-deleted
- [ ] Error flow: create schedule with interval_months = 0, validation error returned, no record persisted

### QA Verification Script

1. Open the app on iOS/Android simulator.
2. Navigate to MyHomes module. Tap the Properties tab. Verify empty state with "Add Property" CTA. -- Verifies empty state.
3. Tap "Add Property". Fill in: name "Main House", address "123 Oak St", city "Austin", state "TX", year built 2015, sqft 2400, type "House", ownership "Own". Save. -- Verifies property creation.
4. When prompted "Set up maintenance reminders?", tap "Yes". -- Corresponds to AC-1.
5. Navigate to Reminders tab. Verify 10 reminder cards appear, all showing "OK" status (green badges). -- Corresponds to AC-1, AC-5.
6. Toggle to "All Properties" view. Verify cards still appear with property name shown. -- Corresponds to AC-6.
7. Toggle back to "By Property" view. Verify cards grouped under "Main House". -- Corresponds to AC-6.
8. Find the HVAC filter card. Note it should show next due ~3 months from today. -- Verifies interval calculation.
9. Manually edit the HVAC filter schedule: change last_completed_date to 3 months and 1 day ago.
10. Return to Reminders tab. Verify HVAC filter card now shows "Overdue" (red badge, exclamation icon). -- Corresponds to AC-5, TC-2.
11. Tap the HVAC filter card. Verify detail view shows status explanation and action buttons. -- Corresponds to AC-7.
12. Tap "Mark Complete". Verify status resets to "OK", last completed shows today, next due is ~3 months from today. -- Corresponds to AC-8, TC-10.
13. Manually edit the gutter cleaning schedule: set last_completed_date to 5 months ago.
14. Return to Reminders tab. Verify gutter cleaning shows "Due Soon" (amber badge, clock icon). -- Corresponds to TC-3.
15. Tap gutter cleaning. Tap "Snooze 2 Weeks". Verify status recalculates and snooze count = 1. -- Corresponds to AC-9.
16. Snooze two more times (total 3). Verify warning message on 3rd snooze. -- Corresponds to AC-10.
17. Snooze a 4th time. Verify snooze still works but warning persists. -- Corresponds to AC-10.
18. Tap "Add Custom Reminder". Select property "Main House", task type "Custom", enter "Pool Cleaning", interval 1 month, season "Summer". Save. -- Corresponds to AC-11.
19. Verify the new custom reminder appears in the list. -- Corresponds to AC-11.
20. Tap the custom reminder, tap "Dismiss Reminder". Verify it disappears from the Reminders list. -- Corresponds to AC-13.
21. Go back to Properties tab. Add a second property: "Downtown Condo", type "Condo", ownership "Rent". Accept defaults. -- Corresponds to AC-3.
22. Navigate to Reminders tab. Verify 4 renter-appropriate schedules for the condo (HVAC filter, smoke/CO detector, dryer vent, appliance service). -- Corresponds to AC-3.
23. Toggle to "All Properties". Verify reminders from both properties appear together, sorted by urgency. -- Corresponds to AC-6.
24. Delete the condo property. Verify its schedules are also removed. -- Corresponds to TC-18.
25. Navigate to Saved tab. Add a test listing. Change its status to "closed". Verify promotion dialog appears. Accept. Verify a new property appears in Properties tab pre-filled from the listing. -- Corresponds to AC-14.
26. Repeat key steps (3-12, 18-20) on web at `/homes/properties` and `/homes/reminders`. Verify functional parity (minus push notifications). -- Web parity check.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 3 (Medium):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to `/homes/reminders` and `/homes/properties`, click every button, verify all 5 states (loading, empty-no-properties, empty-no-schedules, error, success-mixed)
- [ ] Batch QA: after 5 features in homes module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for `reminder-engine.ts` (calculateScheduleStatus, calculateNextDueDate, getDefaultSchedules, sortByUrgency, markComplete)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- homes module has active standalone counterpart (MyHomes)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Homes module has 2 tables: hm_listings, hm_tours
- Schema version 1, migration v1 only
- Module is focused on home buying (listing tracking, tours)
- No concept of "owned properties" or maintenance scheduling
- No reminder engine, no push notifications

### After This Work
- Homes module has 5 tables (new: hm_properties, hm_maintenance_schedules, hm_settings) with 3 new indexes
- Schema version 2, migration v2 added
- New "Properties" tab for homes the user owns/rents, with optional link to closed listings
- Full reminder lifecycle: create property, accept default schedules (context-aware by property type and ownership), view upcoming by urgency, mark complete, snooze, add custom reminders, dismiss
- `reminder-engine.ts` contains pure functions for status calculation, next-due computation (with season awareness), and default presets (differentiated by property type and ownership)
- Mobile: push notifications for due_soon and overdue statuses
- Web: in-app reminder display at /homes/reminders and /homes/properties (no push notifications)
- Navigation updated: 2 new tabs (Properties, Reminders) added to the homes module definition

### Files Changed

- `modules/homes/src/types.ts` -- Add PropertySchema, PropertyTypeSchema, OwnershipTypeSchema, MaintenanceScheduleSchema, TaskTypeSchema, ScheduleStatusSchema, SeasonSchema Zod schemas and types
- `modules/homes/src/db/schema.ts` -- Add CREATE_PROPERTIES, CREATE_MAINTENANCE_SCHEDULES, CREATE_SETTINGS tables, 3 indexes
- `modules/homes/src/db/crud.ts` -- Add property CRUD (create, get, update, delete, promote from listing), schedule CRUD (create, get by property, get active, update, deactivate, delete by property, mark complete), settings CRUD
- `modules/homes/src/engines/reminder-engine.ts` -- NEW: calculateScheduleStatus, calculateNextDueDate, getDefaultSchedules, sortByUrgency, markComplete
- `modules/homes/src/definition.ts` -- Add HOMES_MIGRATION_V2, update schemaVersion to 2, add Properties and Reminders tabs to navigation
- `modules/homes/src/index.ts` -- Re-export new types and engine functions
- `modules/homes/src/__tests__/reminder-engine.test.ts` -- NEW: 24+ unit tests for reminder engine
- `apps/mobile/app/(homes)/properties.tsx` -- NEW: My Properties list screen
- `apps/mobile/app/(homes)/property-detail.tsx` -- NEW: Property detail screen
- `apps/mobile/app/(homes)/add-property.tsx` -- NEW: Add/Edit property form
- `apps/mobile/app/(homes)/reminders.tsx` -- NEW: Upcoming Maintenance screen
- `apps/mobile/app/(homes)/reminder-detail.tsx` -- NEW: Reminder detail modal
- `apps/mobile/app/(homes)/add-reminder.tsx` -- NEW: Add/Edit reminder form
- `apps/web/app/homes/properties/page.tsx` -- NEW: My Properties web page
- `apps/web/app/homes/reminders/page.tsx` -- NEW: Upcoming Maintenance web page

### Known Limitations
- Push notifications are mobile-only (web does not have local push notification support)
- No integration with MyBudget for cost tracking -- deferred to "Cost tracking" B-tier feature
- Default schedules are generic and not customized per property age or climate zone (HomeZada uses location-aware schedules)
- No document attachment to schedules (e.g., appliance manual PDF) -- deferred to "Document storage" B-tier feature
- No contractor contact linking -- deferred to "Contractor contacts" B-tier feature
- Season preference is US-centric (spring = March). Southern hemisphere users may need to adjust manually.
- Snooze is fixed at 14 days. No custom snooze amounts in MVP.

### Context for Next Agent
- The Homes module uses `storageType: 'drizzle'` in its ModuleDefinition, but the local SQLite schema and CRUD layer follow the same pattern as other SQLite modules (raw SQL via DatabaseAdapter). The Drizzle/tRPC integration is for future cloud sync, not the local storage layer. Write migration v2 using the same raw SQL pattern as migration v1.
- The `hm_properties` table is a new concept separate from `hm_listings`. Listings represent homes being evaluated for purchase. Properties represent homes the user owns or rents. A listing can optionally link to a property via `listing_id` FK when the purchase closes.
- The `season_preference` logic in `calculateNextDueDate` should be a separate helper function for testability. Season windows: spring (Mar-May), summer (Jun-Aug), fall (Sep-Nov), winter (Dec-Feb). Always shift forward, never backward.
- Navigation changes in `definition.ts` require adding 2 new tabs (Properties, Reminders) to the existing 5-tab layout. Consider replacing "Alerts" (currently generic) with "Reminders" to stay at 5 tabs, or evaluate a 6-tab layout. Check mobile tab bar limits.
- The auto-promotion from listing to property (when status changes to "closed") should be triggered in the existing `updateListingStatus` CRUD function as a callback or event, not by modifying the function's return type. Keep it loosely coupled.
- `hm_settings` seeds: `reminderNotificationsEnabled` = "true", `defaultRemindersOffered` = "true".
