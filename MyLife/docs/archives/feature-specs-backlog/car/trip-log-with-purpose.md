# Feature Spec: Trip Log with Purpose

## Metadata
- **Module:** car
- **SPEC ID:** CR-007
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [3] x3 + Complexity [4] x2 + CrossModule [2] x1 + PaidUser [2] x1
- **Sprint:** 5
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (builds on existing cr_vehicles table and vehicle CRUD layer)
- **Blocks:** none (future GPS mileage tracking feature is a separate spec)

## Business Context

### Why This Feature Exists
Anyone who drives for business, medical appointments, charity work, or as a freelancer needs an accurate trip log for IRS standard mileage deductions. Without one, users either lose money by not claiming deductions or risk audit problems with poor records. Most car care apps ignore this use case entirely, leaving users to juggle a separate app like MileIQ or Expensify just to track purpose-based mileage. Adding a manual trip log with purpose categories and tax-ready summaries to MyCar closes this gap and turns it into a single hub for all vehicle management needs.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Simply Auto | Yes | Free tier | Trip log with categories (personal, business), manual odometer entry, CSV export |
| Drivvo | Yes | Free tier | Basic trip recording, distance calculation, limited categorization |
| Expensify | Yes | Yes ($5-60/yr) | GPS-based mileage tracking with auto-categorization, IRS-compliant reports |
| MileIQ | Yes | Yes ($59.99/yr) | GPS auto-detect trips, swipe to classify, tax summaries |
| CARFAX Car Care | No | N/A | No trip logging capability |
| FIXD | No | N/A | OBD-II focused, no trip or mileage tracking |

### Target User
Self-employed workers, rideshare drivers, freelancers, and anyone who drives for business, medical, or charity purposes and needs to track mileage for IRS deductions. Users currently paying $60/yr for MileIQ or Expensify who want a privacy-first alternative bundled with their vehicle maintenance tracker. Also useful for multi-vehicle households that want a simple record of which car was used for what purpose without GPS surveillance.

## Technical Context

### Where This Lives in MyLife

```
modules/car/src/
  types.ts                            -- New Zod schemas: TripPurpose, Trip, CreateTripInput, TripSummary
  db/schema.ts                        -- New table: cr_trips
  db/crud.ts                          -- New CRUD: createTrip, getTripsByVehicle, getTripsByPurpose,
                                         deleteTrip, getTripSummary, updateTrip
  engines/trip-engine.ts              -- NEW: distance calculation, summary aggregation, validation
  definition.ts                       -- Migration V3 for new table
  index.ts                            -- Re-export new types and engine functions
  __tests__/trip-engine.test.ts       -- NEW: unit tests for trip engine

apps/mobile/app/(car)/
  trips.tsx                           -- NEW: Trips list screen (sub-screen from Dashboard)
  add-trip.tsx                        -- NEW: Add/Edit trip form screen
  trip-summary.tsx                    -- NEW: Summary by purpose for date range

apps/web/app/car/
  trips/page.tsx                      -- NEW: Trips list and summary web page
  trips/actions.ts                    -- NEW: Server actions for trip operations
```

### Wireframe Position

```
Hub Dashboard
  └── MyCar card
       └── Dashboard tab
            └── "Trips" section or quick-action card
                 ├── Trip list (sorted by date, most recent first)
                 ├── "Log Trip" FAB / button
                 └── "View Summary" link ← tax-ready report
```

The Trip Log is accessible from:
1. A "Trips" quick-action card on the MyCar Dashboard tab (primary entry point)
2. A "Trips" screen accessible via the Dashboard tab's secondary navigation
3. Direct navigation from other modules referencing trip data (future)

### Data Model

```sql
-- New table: cr_trips (Migration V3)
CREATE TABLE IF NOT EXISTS cr_trips (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL DEFAULT 'personal',
    route_name TEXT,
    start_odometer INTEGER NOT NULL,
    end_odometer INTEGER NOT NULL,
    distance INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS cr_trips_vehicle_idx ON cr_trips(vehicle_id);
CREATE INDEX IF NOT EXISTS cr_trips_purpose_idx ON cr_trips(purpose);
CREATE INDEX IF NOT EXISTS cr_trips_started_at_idx ON cr_trips(started_at DESC);
CREATE INDEX IF NOT EXISTS cr_trips_vehicle_purpose_idx ON cr_trips(vehicle_id, purpose);
```

**purpose enum values:** `personal`, `business`, `medical`, `charity`, `moving`, `commute`

**distance column:** Computed as `end_odometer - start_odometer`. Stored for query performance (aggregation queries on large trip sets do not need to compute per-row).

**Constraint:** `end_odometer >= start_odometer` enforced at the application layer (Zod validation), not SQL CHECK. Distance must be > 0.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for SQLite operations), `@mylife/ui` (Cool Obsidian tokens, glass card components), `@mylife/module-registry` (Migration type for schema V3)
- **External:** `zod` (schema validation). No external APIs required. No GPS or location services.
- **Cross-Module:** Light future integration with budget module (trip costs could feed into expense categories). Not blocking for this spec. Trip summaries are self-contained.

## Functional Requirements

### User Stories
1. As a freelancer, I want to log each business trip with start/end odometer readings so that I have an accurate record of miles driven for tax deductions.
2. As a multi-vehicle owner, I want to see all trips for a specific vehicle so that I can track usage patterns per car.
3. As a taxpayer, I want to generate a summary of all business miles driven in a date range so that I can claim the IRS standard mileage deduction at tax time.
4. As a driver, I want to categorize trips by purpose (personal, business, medical, charity, moving, commute) so that I can separate deductible from non-deductible mileage.
5. As a privacy-first user, I want all trip data stored locally on my device with no network calls so that my driving patterns stay private.
6. As a user who just logged a trip, I want the vehicle's odometer to auto-update to the trip's end odometer so that I don't have to manually update it separately.

### Behavior Specification

**Logging a new trip:**
1. User navigates to MyCar > Dashboard > Trips section.
2. User taps "Log Trip" button (FAB on mobile, button on web).
3. Form displays with fields:
   - Vehicle selector (defaults to primary vehicle; hidden if only one vehicle)
   - Purpose selector (segmented control with 6 options: personal, business, medical, charity, moving, commute; defaults to "personal")
   - Start odometer (number input, pre-populated with the vehicle's current odometer reading)
   - End odometer (number input, required, must be >= start odometer)
   - Route name (optional text field, e.g., "Home to Office", "Client visit - Acme Corp")
   - Start date/time (date-time picker, defaults to now)
   - End date/time (optional date-time picker, defaults to null)
   - Notes (optional multiline text)
4. As end odometer is entered, the distance field auto-calculates and displays below (read-only, computed from end - start).
5. User taps Save. System validates inputs:
   - start_odometer and end_odometer are required positive integers
   - end_odometer >= start_odometer (distance > 0)
   - purpose is one of the 6 valid enum values
   - started_at is a valid ISO date string
6. System creates the cr_trips record with the computed distance.
7. System updates the vehicle's odometer to the end_odometer value (via existing updateVehicle CRUD).
8. User is returned to the Trips list, which now shows the new trip at the top.

**Viewing trips:**
1. User navigates to MyCar > Dashboard > Trips.
2. Trips list shows all trips for the selected vehicle (or all vehicles) sorted by started_at descending.
3. Each trip card shows: purpose badge (color-coded), route name (or "Unnamed trip"), distance in miles, date, vehicle name (in all-vehicles view).
4. User can filter by purpose using a horizontal scrolling chip filter bar at the top (All, Business, Medical, Charity, Moving, Commute, Personal).
5. User can filter by date range using a date range picker.

**Editing a trip:**
1. User taps a trip card to open the detail/edit view.
2. All fields are editable.
3. If end_odometer changes, distance recalculates.
4. Saving an edit does NOT auto-update the vehicle's odometer (only new trips do this, to avoid regressions from edits).

**Deleting a trip:**
1. User swipes left on a trip card (mobile) or taps a delete icon (web).
2. Confirmation dialog: "Delete this trip? This cannot be undone."
3. If confirmed, the trip record is deleted. The vehicle's odometer is NOT rolled back.

**Viewing trip summary (tax report):**
1. User taps "View Summary" from the Trips screen.
2. Summary screen shows aggregated data grouped by purpose for a configurable date range (defaults to current calendar year).
3. For each purpose category:
   - Total trips count
   - Total miles driven
   - Estimated deduction (miles x IRS standard mileage rate, currently $0.70/mile for 2025)
4. A "Total Deductible Miles" line at the bottom sums business + medical + charity + moving miles (these are the IRS-recognized deductible categories).
5. An export option generates a plain-text or CSV summary suitable for tax filing or accountant review.

### Edge Cases

- **No vehicles exist:** Trips screen shows empty state with CTA "Add a vehicle to start logging trips."
- **No trips logged:** Trips list shows "No trips recorded yet" with "Log Your First Trip" button.
- **Single vehicle:** Vehicle selector is hidden; trips default to the only vehicle.
- **Start odometer > end odometer:** Zod validation rejects. Error message: "End odometer must be greater than or equal to start odometer."
- **Start odometer = end odometer (zero distance):** Rejected. Minimum distance is 1 mile. Error message: "Trip distance must be at least 1 mile."
- **Very large distance (e.g., 5,000 miles in one trip):** Accepted. Validation cap at 10,000 miles per trip with a warning (not blocking): "This trip is over 10,000 miles. Is that correct?"
- **Start odometer less than vehicle's current odometer:** Accepted. The user may be logging a past trip. No warning needed.
- **End odometer less than vehicle's current odometer:** Accepted for the same reason (past trip logging). Odometer is only updated if end_odometer > current odometer.
- **Module disabled mid-use:** Data is preserved. Re-enabling restores all trips.
- **Vehicle deleted:** CASCADE deletes all associated trips. No orphaned trip records.
- **User navigates away mid-form:** Unsaved changes are discarded. No draft persistence.
- **Large trip count (1,000+ trips):** List is paginated or uses infinite scroll. Summary aggregation must complete within 500ms.
- **IRS rate changes:** The rate constant is defined in trip-engine.ts and can be updated per tax year. Summaries for past years use the rate that was in effect for that year.
- **Export with no deductible trips:** Export still generates with zeroes for deductible categories.
- **Duplicate route names:** Allowed. Route names are free-text, not unique.
- **Trips spanning midnight (start 11pm, end 1am next day):** Allowed. started_at and ended_at are independent datetime values.

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** Tapping "Log Trip" from the Dashboard Trips section opens the Add Trip form with start odometer pre-populated from the vehicle's current reading.
- [ ] **AC-2:** The purpose selector shows 6 options (personal, business, medical, charity, moving, commute) with "personal" as the default.
- [ ] **AC-3:** As the user types the end odometer, the distance field auto-calculates and displays in real time.
- [ ] **AC-4:** Saving a valid trip creates a record, updates the vehicle's odometer to the end value (if higher than current), and returns to the Trips list with the new trip visible at the top.
- [ ] **AC-5:** The Trips list shows trips sorted by date (most recent first), each with a color-coded purpose badge, route name, distance, and date.
- [ ] **AC-6:** Filtering by purpose (e.g., tapping "Business" chip) shows only trips with that purpose.
- [ ] **AC-7:** Filtering by date range shows only trips within the selected range.
- [ ] **AC-8:** Tapping a trip card opens the edit view with all fields populated and editable.
- [ ] **AC-9:** Editing a trip's end odometer recalculates the distance. Saving does NOT update the vehicle's odometer.
- [ ] **AC-10:** Deleting a trip shows a confirmation dialog. Confirming removes the trip from the list.
- [ ] **AC-11:** The Summary screen shows aggregated miles and trip counts grouped by purpose for the selected date range.
- [ ] **AC-12:** The Summary screen shows an estimated IRS deduction for deductible categories (business, medical, charity, moving).
- [ ] **AC-13:** The "Total Deductible Miles" line correctly sums only the 4 deductible categories.
- [ ] **AC-14:** Exporting the summary produces a CSV or plain-text file with per-category breakdowns.
- [ ] **AC-15:** When only one vehicle exists, the vehicle selector is hidden and the trip defaults to that vehicle.

### Technical Criteria
- [ ] **TC-1:** Schema migration V3 creates the cr_trips table with all columns, 4 indexes, and correct cr_ prefix.
- [ ] **TC-2:** Zod validation rejects a trip where end_odometer < start_odometer.
- [ ] **TC-3:** Zod validation rejects a trip where distance (end - start) is 0.
- [ ] **TC-4:** Zod validation requires purpose to be one of the 6 enum values.
- [ ] **TC-5:** `createTrip` persists a record with auto-computed distance = end_odometer - start_odometer.
- [ ] **TC-6:** `createTrip` updates the vehicle's odometer to end_odometer when end_odometer > current odometer.
- [ ] **TC-7:** `getTripsByVehicle` returns trips sorted by started_at DESC.
- [ ] **TC-8:** `getTripsByPurpose` returns only trips matching the given purpose for a vehicle.
- [ ] **TC-9:** `getTripSummary` aggregates total trips, total miles, and estimated deduction per purpose for a date range.
- [ ] **TC-10:** `getTripSummary` completes within 500ms for 1,000 trips.
- [ ] **TC-11:** Deleting a vehicle CASCADE-deletes all associated trips.
- [ ] **TC-12:** V3 migration runs cleanly on databases with existing V1+V2 schema without data loss.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Trip logging must NOT make any network calls. All computation is on-device.
- [ ] **NC-2:** Editing an existing trip must NOT update the vehicle's odometer (only new trip creation does this).
- [ ] **NC-3:** Deleting a trip must NOT roll back the vehicle's odometer reading.
- [ ] **NC-4:** Trip data must NOT be accessible to other modules without explicit cross-module integration (future work).
- [ ] **NC-5:** The trip summary must NOT include personal or commute miles in the "Total Deductible Miles" line.
- [ ] **NC-6:** Logging a past trip with an end_odometer lower than the vehicle's current reading must NOT decrease the vehicle's odometer.

## UI Specification

### Mobile (Expo)

**Trips List Screen:**
- Background: `#0A0A0F` (background token)
- Top bar: "Trips" title, vehicle selector dropdown (if multiple vehicles)
- Filter chips: horizontal scroll, `rgba(255,255,255,0.08)` (glassStrong) background when inactive, module accent `#6366F1` background when active, white text
- Trip cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border (glassBorder token)
- Card layout: Purpose badge (left, color-coded pill) | Route name + distance (center) | Date (right, textSecondary)
- Purpose badge colors:
  - Personal: `rgba(255,255,255,0.15)` (neutral)
  - Business: `#6366F1` (module accent / indigo)
  - Medical: `#FF453A` (danger / red)
  - Charity: `#30D158` (success / green)
  - Moving: `#FFD60A` (amber)
  - Commute: `#64D2FF` (iOS system cyan)
- "Log Trip" FAB: bottom-right, `#6366F1` background, white plus icon, elevation shadow
- Empty state: centered car icon, "No trips recorded yet" text in textSecondary, "Log Your First Trip" button in accent color

**Add/Edit Trip Form:**
- Full-screen modal or pushed screen
- Background: `#0A0A0F`
- Form sections on glass cards
- Purpose selector: horizontal segmented control with 6 options, accent-colored active segment
- Odometer inputs: numeric keyboard, large font, units label ("mi") inline
- Distance display: computed in real time, accent-colored text, read-only
- Route name: single-line text input with placeholder "e.g., Home to Office"
- Date picker: native date-time picker
- Notes: multiline text input, max 500 characters
- Save button: full-width, accent background, white text
- Cancel: "X" or back navigation, no draft save

**Trip Summary Screen:**
- Date range selector at top (year picker or custom range)
- Summary cards per purpose: glass card with purpose badge, trip count, total miles, estimated deduction (for deductible categories)
- "Total Deductible Miles" card at bottom: larger font, accent border, shows aggregate of business + medical + charity + moving
- Export button: outline style, "Export CSV" label

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Accessible at `/car/trips` route
- Layout: sidebar navigation (existing), main content area with trip list
- Cards use glass morphism via `backdrop-filter: blur(16px)` and glass token backgrounds
- Filter chips rendered as horizontal button group (not scrollable, enough space on desktop)
- Date range filter as a dropdown calendar
- Trip detail/edit opens as a side panel (not modal)
- Summary view accessible via a "Summary" tab within the trips page
- Export button downloads a `.csv` file via browser download API

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards (3) with pulsing animation | Initial data fetch from SQLite |
| Empty (no vehicles) | Centered car icon, "Add a vehicle to start logging trips" + CTA button | No vehicles in cr_vehicles |
| Empty (no trips) | "No trips recorded yet" message + "Log Your First Trip" button | Vehicle exists but no trips |
| Error | "Something went wrong loading trips" + retry button | SQLite read failure |
| Success | Trip cards sorted by date, filter chips active | Trips loaded |
| Filtered (no results) | "No trips match this filter" with clear filter link | Filter applied but no matching trips |
| Summary (empty) | Summary cards showing 0 for all categories | No trips in selected date range |
| Summary (populated) | Summary cards with counts, miles, deductions per purpose | Trips exist in date range |

## Test Requirements

### Unit Tests (modules/car/src/__tests__/trip-engine.test.ts)
- [ ] `calculateDistance`: returns correct distance for valid start/end odometer (e.g., 20000, 20150 = 150)
- [ ] `calculateDistance`: returns 0 when start = end (rejected by validator but engine function returns 0)
- [ ] `calculateDistance`: handles large values correctly (e.g., 199000, 200000 = 1000)
- [ ] `aggregateTripSummary`: groups trips by purpose and sums miles correctly
- [ ] `aggregateTripSummary`: returns 0 for purposes with no trips
- [ ] `aggregateTripSummary`: filters by date range correctly (includes boundary dates)
- [ ] `aggregateTripSummary`: excludes trips outside the date range
- [ ] `calculateDeduction`: multiplies deductible miles by IRS rate correctly ($0.70/mile)
- [ ] `calculateDeduction`: returns 0 for non-deductible categories (personal, commute)
- [ ] `getDeductibleTotal`: sums only business, medical, charity, and moving miles
- [ ] `getDeductibleTotal`: returns 0 when no deductible trips exist
- [ ] `formatTripSummaryCSV`: produces valid CSV with headers and per-purpose rows
- [ ] `formatTripSummaryCSV`: handles special characters in route names (commas, quotes)
- [ ] Zod CreateTripInputSchema: accepts valid trip with all required fields
- [ ] Zod CreateTripInputSchema: rejects trip where end_odometer < start_odometer
- [ ] Zod CreateTripInputSchema: rejects trip where end_odometer = start_odometer (zero distance)
- [ ] Zod CreateTripInputSchema: rejects invalid purpose value
- [ ] Zod CreateTripInputSchema: accepts trip with optional fields omitted (route_name, ended_at, notes)
- [ ] Zod CreateTripInputSchema: rejects negative odometer values
- [ ] `IRS_MILEAGE_RATES` constant: contains the current year rate of 0.70

### Integration Tests
- [ ] Full flow: create vehicle, log trip, verify trip persisted in cr_trips with correct distance
- [ ] Full flow: log trip, verify vehicle odometer updated to end_odometer
- [ ] Full flow: log trip with end_odometer < current odometer, verify vehicle odometer NOT decreased
- [ ] Full flow: edit trip end_odometer, verify distance recalculated, verify vehicle odometer NOT changed
- [ ] Full flow: delete trip, verify record removed, verify vehicle odometer unchanged
- [ ] Full flow: delete vehicle, verify all associated trips CASCADE-deleted
- [ ] Full flow: get trip summary for date range, verify aggregation matches individual trip records
- [ ] Error flow: attempt to create trip with invalid input, verify validation error returned, no record persisted

### QA Verification Script

1. Open the app on iOS/Android simulator.
2. Navigate to MyCar module. Verify no trips section or empty state is shown. -- Pre-condition.
3. Add a new vehicle (2024 Honda Civic, 20,000 miles). -- Verifies vehicle creation.
4. Navigate to Dashboard > Trips section. Verify empty state shows "No trips recorded yet" with "Log Your First Trip" button. -- Corresponds to AC empty state.
5. Tap "Log Your First Trip". Verify Add Trip form opens with start odometer pre-populated as 20,000. -- Corresponds to AC-1.
6. Verify purpose selector shows 6 options with "personal" selected by default. -- Corresponds to AC-2.
7. Enter end odometer as 20,150. Verify distance auto-calculates and displays "150 mi". -- Corresponds to AC-3.
8. Change purpose to "business". Enter route name "Client visit - Acme Corp". Add a note "Quarterly review meeting".
9. Tap Save. Verify trip appears in the list with business badge (indigo), "Client visit - Acme Corp", "150 mi", today's date. -- Corresponds to AC-4, AC-5.
10. Navigate to vehicle detail. Verify odometer now reads 20,150. -- Corresponds to AC-4, TC-6.
11. Return to Trips. Log a second trip: purpose "medical", start 20,150, end 20,180, route "Doctor appointment".
12. Log a third trip: purpose "personal", start 20,180, end 20,230, route "Weekend drive".
13. Tap "Business" filter chip. Verify only the business trip is shown. -- Corresponds to AC-6.
14. Tap "All" chip. Verify all 3 trips are shown.
15. Tap the business trip card. Verify edit view opens with all fields populated. -- Corresponds to AC-8.
16. Change end odometer to 20,160. Verify distance recalculates to 160. -- Corresponds to AC-9.
17. Save the edit. Navigate to vehicle detail. Verify odometer still reads 20,230 (NOT 20,160). -- Corresponds to AC-9, NC-2.
18. Return to Trips. Swipe left on the personal trip. Verify confirmation dialog appears. -- Corresponds to AC-10.
19. Confirm delete. Verify the personal trip is removed from the list.
20. Verify vehicle odometer still reads 20,230. -- Corresponds to NC-3.
21. Navigate to Trip Summary. Verify summary shows current year with 3 categories reported (business: 1 trip/160 mi, medical: 1 trip/30 mi, personal: deleted so 0). -- Corresponds to AC-11.
22. Verify business row shows estimated deduction: 160 x $0.70 = $112.00. -- Corresponds to AC-12.
23. Verify "Total Deductible Miles" shows 190 (business 160 + medical 30). Personal miles are excluded. -- Corresponds to AC-13, NC-5.
24. Tap "Export CSV". Verify a CSV file is generated/downloaded with per-category breakdowns. -- Corresponds to AC-14.
25. Add a second vehicle. Navigate to Trips with vehicle selector visible. Verify vehicle selector shows both vehicles. -- Corresponds to AC-15 (inverse: selector shown with 2 vehicles).
26. Delete the second vehicle (has no trips). Verify no orphaned trip records.
27. Log a past trip: purpose "charity", start 19,800, end 19,850. Verify the trip is saved with distance 50. Verify vehicle odometer stays at 20,230 (end_odometer 19,850 < current 20,230). -- Corresponds to NC-6.
28. Attempt to save a trip with end_odometer < start_odometer. Verify validation error appears. -- Corresponds to TC-2.
29. Attempt to save a trip with start = end odometer. Verify validation error appears. -- Corresponds to TC-3.
30. Repeat steps 4-24 on web at `/car/trips`. Verify functional parity. -- Web parity check.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to `/car/trips`, click every button, verify all 5 states (loading, empty-no-vehicles, empty-no-trips, error, success)
- [ ] Batch QA: after 5 features in car module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for `trip-engine.ts` (calculateDistance, aggregateTripSummary, calculateDeduction, getDeductibleTotal, formatTripSummaryCSV)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- car module has active standalone counterpart (MyCar/)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Car module has 5 tables: cr_vehicles, cr_maintenance, cr_fuel_logs, cr_settings, cr_maintenance_schedules
- Schema version 2, migrations V1 and V2
- No trip logging, no mileage tracking, no purpose categorization, no tax reporting capability
- Dashboard tab shows vehicle overview, maintenance reminders, and fuel stats but no trip data
- The only odometer update path is manual edit via the vehicle detail screen

### After This Work
- Car module has 6 tables (new: cr_trips) with 4 new indexes
- Schema version 3, migration V3 added
- Full trip lifecycle: log trips with purpose, edit, delete, filter by purpose and date range
- Trip engine with distance calculation, purpose-based aggregation, IRS deduction estimation, and CSV export
- Auto-odometer update on new trip creation (when end > current)
- Dashboard tab shows a Trips section with quick-action card
- Trip summary screen with tax-ready breakdowns by purpose

### Files Changed

- `modules/car/src/types.ts` -- Add TripPurposeSchema, TripSchema, CreateTripInputSchema, TripSummarySchema Zod schemas and types
- `modules/car/src/db/schema.ts` -- Add CREATE_TRIPS table definition and 4 index definitions
- `modules/car/src/db/crud.ts` -- Add createTrip, getTripsByVehicle, getTripsByPurpose, updateTrip, deleteTrip, getTripSummary
- `modules/car/src/engines/trip-engine.ts` -- NEW: calculateDistance, aggregateTripSummary, calculateDeduction, getDeductibleTotal, formatTripSummaryCSV, IRS_MILEAGE_RATES
- `modules/car/src/definition.ts` -- Add CAR_MIGRATION_V3, update schemaVersion to 3
- `modules/car/src/index.ts` -- Re-export new types and engine functions
- `modules/car/src/__tests__/trip-engine.test.ts` -- NEW: 20+ unit tests for trip engine
- `apps/mobile/app/(car)/trips.tsx` -- NEW: Trips list screen with filter chips and FAB
- `apps/mobile/app/(car)/add-trip.tsx` -- NEW: Add/Edit trip form screen
- `apps/mobile/app/(car)/trip-summary.tsx` -- NEW: Trip summary with tax deduction breakdowns
- `apps/web/app/car/trips/page.tsx` -- NEW: Trips list and summary web page
- `apps/web/app/car/trips/actions.ts` -- NEW: Server actions for trip CRUD

### Known Limitations
- No GPS auto-tracking. This is a manual-entry trip log. GPS mileage tracking is a separate feature (not part of this spec).
- IRS mileage rate is a constant in trip-engine.ts. If the rate changes mid-year, past summaries will use the new rate retroactively unless year-specific rate lookup is added (deferred).
- No recurring trip templates (e.g., "daily commute"). Users must log each trip individually.
- No integration with mapping services for route visualization.
- Export is CSV/plain-text only. PDF export is not included.
- No auto-categorization or machine learning to suggest purpose based on patterns.

### Context for Next Agent
- The TripPurposeSchema is a separate enum from MaintenanceTypeSchema and ScheduleServiceTypeSchema. They are intentionally independent.
- The `distance` column is a computed stored value (end_odometer - start_odometer). It must be recalculated if either odometer field is updated.
- The auto-odometer update only fires on `createTrip`, not on `updateTrip`. This is intentional to prevent edits from overwriting subsequent trip data.
- The IRS_MILEAGE_RATES object should be keyed by year (e.g., `{ 2025: 0.70, 2024: 0.67 }`) so that future rate changes do not retroactively affect past year summaries. The current implementation uses a single constant for simplicity; the next agent should evaluate whether year-keyed rates are worth the complexity.
- The "Total Deductible Miles" calculation includes business, medical, charity, and moving (the 4 IRS-recognized deductible categories). Personal and commute are explicitly excluded. If the IRS changes which categories are deductible, update the `DEDUCTIBLE_PURPOSES` constant in trip-engine.ts.
- The cr_trips table uses CASCADE delete on vehicle_id. Deleting a vehicle removes all its trips. This is consistent with the pattern used by cr_maintenance, cr_fuel_logs, and cr_maintenance_schedules.
