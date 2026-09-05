# Feature Spec: Tire Tracking

## Metadata
- **Module:** car
- **Priority Score:** 23 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [2] x3 + Complexity [4] x2 + CrossModule [1] x1 + PaidUser [2] x1
- **SPEC-mycar ID:** CR-013
- **Sprint:** 5
- **Estimated CC Time:** 4-5 hours
- **Depends On:** none (builds on existing cr_vehicles table and CRUD layer)
- **Blocks:** none (future: seasonal tire swap tracking, tire purchase price comparison)

## Business Context

### Why This Feature Exists
Tires are the most expensive recurring maintenance item on a vehicle after engine work, costing $400-$1200 per set. Yet most drivers have no idea how much tread they have left, when their last rotation was, or when they need replacements. The typical discovery moment is a mechanic telling them "your tires are worn" during an oil change, giving the driver zero time to comparison shop. Tire tracking with tread depth measurements and wear-rate prediction gives users advance notice, often months before replacement is needed, allowing them to budget and shop for the best deal. This feature is straightforward to build (Complexity 4/5) with high utility for the subset of car-savvy users who already track maintenance.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Simply Auto | Yes | Free tier | Basic tire log with brand/model, rotation tracking, replacement reminders by mileage |
| TireGuru | Yes | Free (dedicated app) | Tread depth tracking, wear rate graphs, rotation patterns, tire comparison shopping |
| CARFAX Car Care | Partial | No | Generic maintenance reminders for "tire rotation" but no per-tire tread tracking |
| Drivvo | Partial | No | Tire replacement can be logged as a maintenance record but no tread depth or rotation tracking |
| FIXD | No | N/A | No tire-specific tracking beyond generic maintenance |

### Target User
Vehicle owners (30-60) who are cost-conscious about tire purchases and want data-driven replacement timing. Particularly valuable for multi-vehicle households where tracking 16+ tires across 4 cars is otherwise impossible without spreadsheets. Also appeals to enthusiast drivers who run different tire sets for summer/winter and need to track which set is mounted and how much life remains on each.

## Technical Context

### Where This Lives in MyLife

```
modules/car/src/
  types.ts                            -- New Zod schemas: TireSet, TireMeasurement, TireRotation, TirePosition, TireHealth
  db/schema.ts                        -- New tables: cr_tire_sets, cr_tire_measurements, cr_tire_rotations + indexes
  db/crud.ts                          -- New CRUD: tire set, measurement, rotation create/read/update/delete
  engines/tire-engine.ts              -- NEW: wear rate calculation, replacement prediction, rotation scheduling, health assessment
  definition.ts                       -- Migration V3 (or V4 if GPS spec goes first) for new tables
  __tests__/tire-engine.test.ts       -- NEW: unit tests for tire engine

apps/mobile/app/(car)/
  tires.tsx                           -- NEW: Tires overview screen (accessible from vehicle detail)
  tire-set-detail.tsx                 -- NEW: Tire set detail with measurement history
  add-measurement.tsx                 -- NEW: Log tread depth measurement form
  add-rotation.tsx                    -- NEW: Log tire rotation form

apps/web/app/car/
  tires/page.tsx                      -- NEW: Tires overview web page
```

### Wireframe Position

```
Hub Dashboard
  └── MyCar card
       └── Garage tab (vehicle detail)
            └── "Tires" section ← YOU ARE HERE
                 ├── Current tire set summary (brand, tread health bars)
                 ├── "Log Measurement" button
                 ├── "Log Rotation" button
                 └── Tire set history (previous sets)
```

The Tires section is accessible from:
1. A "Tires" card on the vehicle detail screen (primary entry point)
2. A "Tires" quick-action on each vehicle card in the Garage tab
3. Reminder notifications when rotation or replacement is due (future integration with reminder engine)

### Data Model

```sql
-- New table: cr_tire_sets (Migration V3)
CREATE TABLE IF NOT EXISTS cr_tire_sets (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    brand TEXT,
    model_name TEXT,
    size TEXT,
    purchased_at TEXT,
    purchase_price_cents INTEGER,
    purchase_odometer INTEGER,
    is_current INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- New table: cr_tire_measurements
CREATE TABLE IF NOT EXISTS cr_tire_measurements (
    id TEXT PRIMARY KEY,
    tire_set_id TEXT NOT NULL REFERENCES cr_tire_sets(id) ON DELETE CASCADE,
    position TEXT NOT NULL,
    tread_depth_32nds INTEGER NOT NULL,
    measured_at TEXT NOT NULL,
    odometer_at INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- New table: cr_tire_rotations
CREATE TABLE IF NOT EXISTS cr_tire_rotations (
    id TEXT PRIMARY KEY,
    tire_set_id TEXT NOT NULL REFERENCES cr_tire_sets(id) ON DELETE CASCADE,
    rotated_at TEXT NOT NULL,
    odometer_at INTEGER,
    pattern TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS cr_tire_sets_vehicle_idx
    ON cr_tire_sets(vehicle_id);
CREATE INDEX IF NOT EXISTS cr_tire_sets_current_idx
    ON cr_tire_sets(vehicle_id, is_current);
CREATE INDEX IF NOT EXISTS cr_tire_measurements_set_idx
    ON cr_tire_measurements(tire_set_id);
CREATE INDEX IF NOT EXISTS cr_tire_measurements_date_idx
    ON cr_tire_measurements(measured_at DESC);
CREATE INDEX IF NOT EXISTS cr_tire_rotations_set_idx
    ON cr_tire_rotations(tire_set_id);
```

**position enum values:** `FL` (front-left), `FR` (front-right), `RL` (rear-left), `RR` (rear-right), `spare`

**pattern format:** Comma-separated position swaps, e.g., `"FL->RR,FR->RL,RL->FL,RR->FR"` for a standard X-pattern rotation. Common patterns:
- Forward cross: `"FL->RR,FR->RL,RL->FL,RR->FR"`
- Rearward cross: `"FL->RL,FR->RR,RL->FR,RR->FL"`
- X-pattern: `"FL->RR,FR->RL,RL->FR,RR->FL"`
- Front-to-rear: `"FL->RL,FR->RR,RL->FL,RR->FR"`
- Side-to-side: `"FL->FR,FR->FL,RL->RR,RR->RL"`

**Tread depth conventions:** Measured in 32nds of an inch (US standard). New tires are typically 10/32" to 12/32". Legal minimum is 2/32". Recommended replacement threshold is 4/32" for wet conditions, 2/32" for dry-only.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for SQLite operations), `@mylife/ui` (Cool Obsidian tokens, glass card components, progress bar component), `@mylife/module-registry` (Migration type for schema V3)
- **External:** `zod` (schema validation). No external APIs required. No tire database lookup (manual entry only for MVP).
- **Cross-Module:** None for MVP. Future integration with the reminder engine (tire rotation due dates and replacement predictions feeding into cr_maintenance_schedules) is deferred to a follow-up spec.

## Functional Requirements

### User Stories
1. As a car owner, I want to track which tires are on my vehicle (brand, model, size) so I know what to reorder when it is time to replace them.
2. As a car owner, I want to log tread depth measurements per tire position so I can see how my tires are wearing over time and catch uneven wear early.
3. As a safety-conscious driver, I want the app to predict when my tires will need replacement based on my wear rate so I can plan ahead rather than being surprised at the shop.
4. As a car owner, I want to log tire rotations with the pattern used so I can keep a history and know when the next rotation is due.
5. As a multi-set owner (summer/winter tires), I want to track multiple tire sets per vehicle and mark which set is currently mounted.
6. As a cost-conscious driver, I want to see how much I paid for my current tire set and how many miles I have gotten from them so I can evaluate cost-per-mile.

### Behavior Specification

**Adding a tire set to a vehicle:**
1. User navigates to a vehicle's detail screen and taps the "Tires" section.
2. If no tire set exists, an empty state is shown: "No tire sets tracked. Add your current tires to start tracking tread wear."
3. User taps "Add Tire Set".
4. Form shows: brand (text input), model name (text input), size (text input, placeholder "225/45R17"), purchase date (date picker), purchase price (currency input), purchase odometer (number input), notes (text area).
5. All fields except notes are optional. At minimum, the system creates the record even if only the brand is provided.
6. On save, the new set is marked as `is_current = 1`. Any existing `is_current = 1` set for this vehicle is switched to `is_current = 0`.
7. The tire overview screen now shows the current set with a card.

**Viewing tire set overview:**
1. The Tires screen shows two sections: "Current Set" at the top and "Previous Sets" below.
2. Current Set card shows: brand + model, size, purchase date, miles driven (current odometer minus purchase_odometer), cost per mile (purchase_price / miles_driven).
3. Below the card, a 4-position tire diagram shows tread health for each position:
   - Each position (FL, FR, RL, RR) displayed as a rectangle with a health bar inside.
   - Health bar color: green (8/32+), amber (5-7/32), red (2-4/32), dark red with "REPLACE" label (< 2/32).
   - If no measurement exists for a position, show "No data" in gray.
4. Spare tire (if measured) shown separately below the 4-position diagram.
5. Previous Sets section lists archived tire sets with brand, date range, and total miles driven.

**Logging a tread depth measurement:**
1. User taps "Log Measurement" on the tires screen.
2. Form shows the 4-position tire diagram. User taps a position (FL, FR, RL, RR, or spare) to select it.
3. A tread depth picker appears: a vertical slider or number stepper, ranging from 1/32 to 16/32, with major marks at 2/32 (legal min), 4/32 (wet safety), and 10/32 (new tire).
4. User sets the depth. The selected position's visual updates in real-time.
5. User can tap additional positions to measure them in the same session (batch entry).
6. Odometer input (optional, auto-filled from vehicle's current odometer).
7. Date input (defaults to today).
8. User taps "Save All Measurements". One cr_tire_measurements record is created per position measured.

**Viewing measurement history:**
1. User taps "View History" on the tire set card or navigates to tire set detail.
2. Detail screen shows:
   - Tire set info (brand, model, size, purchase date, miles driven, cost per mile).
   - Per-position tread depth history as a simple list: date, depth, odometer. Sorted newest first.
   - Wear rate per position: calculated as (initial depth - latest depth) / miles driven, expressed as "X/32 per 1,000 miles".
   - Predicted replacement date per position: extrapolates wear rate to determine when tread will reach 2/32.
   - Overall tire set health: "Good" (all positions >= 5/32), "Fair" (any position 3-4/32), "Low" (any position 2/32), "Replace Now" (any position < 2/32).
3. If fewer than 2 measurements exist for a position, wear rate and prediction show "Insufficient data (need 2+ measurements)".

**Logging a tire rotation:**
1. User taps "Log Rotation" on the tires screen.
2. Form shows: date (defaults to today), odometer (auto-filled from vehicle), rotation pattern selector with preset options:
   - Forward cross
   - Rearward cross
   - X-pattern
   - Front-to-rear
   - Side-to-side
   - Custom (text input for non-standard patterns)
3. User selects a pattern and taps "Save".
4. A cr_tire_rotations record is created.
5. Rotation history appears on the tire set detail screen.

**Switching tire sets:**
1. User taps "Switch Set" on the tires screen (or adds a new set).
2. If adding a new set: the current set is archived (is_current = 0) and the new set becomes current.
3. If reactivating a previous set (e.g., switching back to summer tires): user taps a previous set card and taps "Make Current". That set's is_current is set to 1, and the currently mounted set's is_current is set to 0.
4. The tires screen updates to show the newly current set.

### Edge Cases

- **No tire sets for vehicle:** Tires section shows empty state with "Add Tire Set" CTA. All tire-related actions (Log Measurement, Log Rotation) are hidden.
- **Tire set with no measurements:** Health bars show "No data" for all positions. Wear rate and prediction sections show "Log your first tread depth to start tracking wear." No calculation errors.
- **Only 1 measurement per position:** Wear rate shows "Insufficient data (need 2+ measurements)". Replacement prediction unavailable. Health bar still renders based on the single measurement value.
- **Measurement with tread depth of 0/32:** Accepted (could be a flat tire or worn to slicks). Health status = "Replace Now" with red indicator.
- **Measurement with tread depth > 12/32 (e.g., 15/32 for truck tires):** Accepted. Max allowed is 16/32. Validation rejects values > 16 or < 0.
- **Uneven wear (e.g., FL at 3/32, others at 8/32):** The overall health status takes the worst position. "Low" status displayed with a note: "FL tire shows significantly more wear. Check alignment."
- **Tread depth increases between measurements:** This can happen if the user enters data out of order or corrects a mistake. The wear rate calculation uses the first and latest measurement chronologically, not sequentially. If the latest is higher than the first, wear rate shows "0/32 per 1,000 miles" rather than a negative value.
- **No odometer on measurements:** Wear rate calculation requires odometer data. If any measurement lacks an odometer value, show "Odometer data needed for wear rate calculation" and fall back to time-based prediction only.
- **Purchase price missing:** Cost per mile section shows "Add purchase price for cost analysis" instead of a calculation.
- **Purchase odometer missing:** Miles driven section shows "Add purchase odometer for mileage tracking" instead of a calculation.
- **Vehicle deleted:** CASCADE deletes all tire sets, measurements, and rotations for that vehicle.
- **Tire set deleted:** CASCADE deletes all measurements and rotations for that set.
- **Very old tire set (5+ years):** Show age warning: "This tire set is over [X] years old. Rubber degrades with age regardless of tread depth. Consider replacement." Triggered when purchase_date is more than 5 years ago.
- **Multiple current sets:** Should not happen. The create/switch logic enforces at most one is_current = 1 per vehicle. If corrupt data exists (e.g., from a bug), the UI shows the first one found and logs a warning.
- **Module disabled mid-use:** Data preserved. Re-enabling shows all tire data intact.
- **Rotation with no measurements before/after:** Rotation is logged independently. It does not require measurements. The rotation history is informational.

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** Adding a tire set creates a record and displays it as the "Current Set" on the tires screen with brand, model, and size visible.
- [ ] **AC-2:** Adding a new tire set automatically archives the previous current set (is_current switches from 1 to 0).
- [ ] **AC-3:** The 4-position tire diagram shows health bars for FL, FR, RL, RR based on the latest tread depth measurement for each position.
- [ ] **AC-4:** Health bar colors are: green (8/32+), amber (5/32 to 7/32), red (2/32 to 4/32), dark red with "REPLACE" label (< 2/32).
- [ ] **AC-5:** Tapping a position on the measurement form selects it and shows the tread depth picker.
- [ ] **AC-6:** Multiple positions can be measured in a single session (batch entry). All measurements save with the same date and odometer.
- [ ] **AC-7:** Tread depth picker ranges from 1/32 to 16/32 with visual marks at 2/32 (legal min), 4/32 (wet safety), and 10/32 (new tire).
- [ ] **AC-8:** Measurement history shows per-position depth readings sorted by date (newest first).
- [ ] **AC-9:** Wear rate per position displays as "X.X/32 per 1,000 miles" when 2+ measurements with odometer data exist.
- [ ] **AC-10:** Predicted replacement date shows a calendar date when the tread is expected to reach 2/32, based on extrapolated wear rate and average monthly mileage.
- [ ] **AC-11:** Overall tire set health status shows as "Good", "Fair", "Low", or "Replace Now" based on the worst position.
- [ ] **AC-12:** Logging a rotation saves the date, odometer, and rotation pattern. The rotation appears in the rotation history list.
- [ ] **AC-13:** Preset rotation patterns (Forward cross, Rearward cross, X-pattern, Front-to-rear, Side-to-side) are selectable from a list. "Custom" allows free-text input.
- [ ] **AC-14:** "Previous Sets" section lists archived tire sets with brand, date range, and total miles driven.
- [ ] **AC-15:** Tapping a previous set and selecting "Make Current" archives the currently mounted set and reactivates the selected one.
- [ ] **AC-16:** Cost per mile displays correctly as total purchase price divided by miles driven since purchase.
- [ ] **AC-17:** Tire age warning appears when the purchase date is more than 5 years ago.

### Technical Criteria
- [ ] **TC-1:** Schema migration V3 creates cr_tire_sets, cr_tire_measurements, and cr_tire_rotations tables with all columns and 5 indexes, using the cr_ prefix.
- [ ] **TC-2:** `calculateWearRate(measurements)` returns the correct rate in 32nds per 1,000 miles for a known measurement set.
- [ ] **TC-3:** `calculateWearRate` returns 0 when fewer than 2 measurements exist (does not throw).
- [ ] **TC-4:** `predictReplacementDate(tireSet, measurements, avgMilesPerMonth)` returns a future date when tread will reach 2/32, or null if wear rate is 0.
- [ ] **TC-5:** `getTireHealth(measurements)` returns the correct status string per position and overall for a known measurement set.
- [ ] **TC-6:** `getRecommendedRotationOdometer(lastRotation, intervalMiles)` returns the next rotation due odometer correctly.
- [ ] **TC-7:** Tire set CRUD operations (create, read, update, delete) persist correctly in SQLite.
- [ ] **TC-8:** Measurement CRUD operations persist correctly. Batch measurement creation (4 positions in one call) creates exactly 4 records.
- [ ] **TC-9:** Rotation CRUD operations persist correctly.
- [ ] **TC-10:** Deleting a tire set CASCADE-deletes all associated measurements and rotations.
- [ ] **TC-11:** Deleting a vehicle CASCADE-deletes all associated tire sets (and their measurements and rotations).
- [ ] **TC-12:** Creating a new current tire set atomically sets all other sets for that vehicle to is_current = 0.
- [ ] **TC-13:** Zod validation rejects tread_depth_32nds < 0 or > 16.
- [ ] **TC-14:** Zod validation rejects position values not in the enum (FL, FR, RL, RR, spare).

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Tire tracking must NOT make any network calls. All computation is on-device.
- [ ] **NC-2:** Deleting a tire set must NOT delete the vehicle or any other vehicle data (only tire-related records).
- [ ] **NC-3:** A negative wear rate must NOT be displayed. If the latest measurement is deeper than the first, show 0.
- [ ] **NC-4:** Adding a tire set must NOT modify existing maintenance schedules (tire data and maintenance reminders are independent in this spec).
- [ ] **NC-5:** Switching the current tire set must NOT delete the archived set. It only toggles is_current.
- [ ] **NC-6:** Tire data must NOT appear in the maintenance records list. Tires are a separate section.
- [ ] **NC-7:** The "Replace Now" health status must NOT dismiss or auto-clear. It persists until a new measurement shows higher tread depth or the user replaces the set.

## UI Specification

### Mobile (Expo)

**Tires Overview Screen (tires.tsx):**
- Background: `#0A0A0F` (background token)
- "Current Set" card: glass background `rgba(255,255,255,0.04)`, `glassBorder`, `borderRadius: 12`
  - Header row: brand + model in `fontSize: 16`, `fontWeight: 600`, color `#F0F0F5` (text token). Size badge in `fontSize: 12`, `rgba(240,240,245,0.65)` (textSecondary).
  - Stats row: miles driven, cost per mile, purchase date in 3 small stat boxes with glass background.
  - Age warning (if applicable): amber banner below stats, `#FFD60A` left border, clock icon.

**Tire Position Diagram (within Current Set card):**
- 4 rectangles arranged in a 2x2 grid representing FL, FR, RL, RR (vehicle top-down view)
- Each rectangle: 72px wide, 100px tall, `borderRadius: 8`, `rgba(255,255,255,0.04)` background
- Inside each rectangle: position label ("FL") at top, tread depth value ("8/32") centered, health bar at bottom
- Health bar: 60px wide, 6px tall, `borderRadius: 3`
  - Green fill: `#30D158` for 8/32+
  - Amber fill: `#FFD60A` for 5-7/32
  - Red fill: `#FF453A` for 2-4/32
  - Dark red fill with pulsing animation: `#CC0000` for < 2/32
- "No data" positions: gray text `rgba(240,240,245,0.35)`, no health bar
- Spare tire: single smaller rectangle below the 2x2 grid, same styling

**Tread Depth Picker (add-measurement.tsx):**
- Full-screen form with the 4-position diagram (interactive)
- Tapping a position highlights it with a `#6366F1` (accent) border, `2px` solid
- Depth stepper: large number display "8/32", `fontSize: 48`, `fontWeight: 800`
- "-" and "+" buttons flanking the number, `rgba(255,255,255,0.08)` background, `borderRadius: 12`
- Reference marks below stepper: "2/32 Legal Min", "4/32 Wet Safety", "10/32 New Tire" in `fontSize: 11`, colored to match health bar thresholds
- "Next Position" button to advance to the next unmeasured position without closing the picker

**Rotation Form (add-rotation.tsx):**
- Date and odometer inputs at top (glass card)
- Rotation pattern selector: vertical list of preset cards
  - Each card: glass background, pattern name in bold, brief description in textSecondary, small diagram showing arrow directions
  - Selected card: `#6366F1` left border, accent background overlay `rgba(99,102,241,0.1)`
- "Custom" option: text input field for free-form pattern entry
- "Save Rotation" button: full-width, accent background, white text

**Tire Set Detail (tire-set-detail.tsx):**
- Header: brand + model, size, purchase info
- Measurement history: scrollable list, grouped by date
  - Each row: position badge (colored circle with "FL"), depth value, odometer, date
- Wear rate section: 4 progress indicators (one per position) showing rate
- Predicted replacement: calendar icon + date + "~X months from now" in textSecondary
- Rotation history: timeline list with dates, odometers, and pattern labels
- Overall health badge: colored pill at top-right of header

**Previous Sets Section:**
- Below current set, "Previous Sets" header in textSecondary
- Collapsed by default if 3+ archived sets (expandable with "Show all" link)
- Each card: glass background, brand/model, date range ("Jan 2024 - Nov 2025"), total miles, "Make Current" button (outline, accent color)

**Action Buttons (bottom of tires screen):**
- Two buttons side by side: "Log Measurement" (filled, accent) and "Log Rotation" (outline, accent)
- Both `borderRadius: 12`, `fontWeight: 600`

### Web (Next.js)

- Same tokens via CSS variables
- Accessible at `/car/tires` route
- Layout: sidebar navigation (existing), main content area
- Tire position diagram is rendered as an SVG with interactive hover states and click-to-select for measurements
- Measurement history displayed as a sortable table with columns: Date, Position, Depth, Odometer, Notes
- Rotation history as a separate table below measurements
- Tire set detail opens as a side panel (not modal) for better UX on wide screens
- Previous sets shown in a collapsible accordion
- Tread depth picker uses a standard number input with +/- buttons (no slider)
- Health bars use CSS `linear-gradient` and `width` percentage transitions

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton card with pulsing animation for tire set area | Initial data fetch from SQLite |
| Empty (no vehicles) | Centered car icon, "Add a vehicle to start tracking tires" + CTA button | No vehicles in cr_vehicles |
| Empty (no tire sets) | "No tire sets tracked" message, "Add Tire Set" button | Vehicle exists but no tire sets |
| Empty (no measurements) | Tire diagram with "No data" in all positions, "Log your first measurement" CTA | Tire set exists but no measurements |
| Error | "Something went wrong loading tire data" + retry button | SQLite read failure |
| Success (healthy) | Green health bars, "Good" status badge, full data | All positions >= 5/32 |
| Success (mixed) | Mix of green/amber/red health bars, worst status displayed | Different wear levels per position |
| Success (critical) | Red/dark red health bars, "Replace Now" badge with pulsing animation | Any position < 2/32 |
| Partial (some positions measured) | Measured positions show health bars, unmeasured show "No data" | Only some positions have measurements |

## Test Requirements

### Unit Tests (modules/car/src/__tests__/tire-engine.test.ts)
- [ ] `calculateWearRate([])`: returns 0 for empty measurements array
- [ ] `calculateWearRate([single measurement])`: returns 0 for single measurement (need 2+)
- [ ] `calculateWearRate(two measurements)`: returns correct rate in 32nds per 1,000 miles (e.g., initial 10/32 at 30,000 mi, current 7/32 at 36,000 mi = 0.5/32 per 1,000 mi)
- [ ] `calculateWearRate`: uses chronologically first and last measurements, not array order
- [ ] `calculateWearRate`: returns 0 when latest depth >= initial depth (no negative rates)
- [ ] `calculateWearRate`: returns 0 when odometer difference is 0 (avoids division by zero)
- [ ] `predictReplacementDate(tireSet, measurements, avgMilesPerMonth)`: returns correct future date for known wear rate
- [ ] `predictReplacementDate`: returns null when wear rate is 0 (cannot predict)
- [ ] `predictReplacementDate`: returns null when fewer than 2 measurements exist
- [ ] `predictReplacementDate`: returns a past date when tread is already at or below 2/32 (indicating immediate replacement needed)
- [ ] `predictReplacementDate`: handles fractional months correctly (e.g., 2.5 months from now)
- [ ] `getTireHealth(measurements)`: returns "good" when all positions >= 8/32
- [ ] `getTireHealth(measurements)`: returns "good" when all positions >= 5/32 and < 8/32 returns "fair"
- [ ] `getTireHealth(measurements)`: returns "fair" when any position is 5-7/32
- [ ] `getTireHealth(measurements)`: returns "low" when any position is 2-4/32
- [ ] `getTireHealth(measurements)`: returns "replace" when any position < 2/32
- [ ] `getTireHealth(measurements)`: overall status takes the worst position
- [ ] `getTireHealth([])`: returns "unknown" for empty measurements
- [ ] `getRecommendedRotationOdometer(45000, 7500)`: returns 52500
- [ ] `getRecommendedRotationOdometer`: returns null when lastRotation odometer is null
- [ ] `getPositionHealth(depth)`: returns correct status string for boundary values (1, 2, 4, 5, 7, 8, 10, 12, 16)
- [ ] `getCostPerMile(priceCents, purchaseOdometer, currentOdometer)`: returns correct cost
- [ ] `getCostPerMile`: returns null when purchaseOdometer is null
- [ ] `getCostPerMile`: returns null when priceCents is null
- [ ] `getCostPerMile`: returns null when milesDriven is 0 (avoids division by zero)
- [ ] Zod validation: rejects tread_depth_32nds < 0
- [ ] Zod validation: rejects tread_depth_32nds > 16
- [ ] Zod validation: rejects position not in enum
- [ ] Zod validation: accepts all valid positions (FL, FR, RL, RR, spare)
- [ ] Zod validation: accepts tire set with only brand field provided

### Integration Tests
- [ ] Full flow: create vehicle, add tire set, log 4 measurements (one per position), verify all displayed correctly
- [ ] Full flow: log second measurement batch at higher odometer, verify wear rate and prediction are calculated
- [ ] Full flow: log rotation, verify rotation appears in history with correct pattern
- [ ] Full flow: add new tire set, verify previous set archived (is_current = 0) and new set shown as current
- [ ] Full flow: reactivate a previous set via "Make Current", verify it becomes current and the old current is archived
- [ ] Full flow: delete tire set, verify all associated measurements and rotations are also deleted
- [ ] Full flow: delete vehicle, verify all tire sets (and their children) are also deleted
- [ ] Error flow: attempt to create measurement with invalid position, validation error returned

### QA Verification Script

1. Open the app on iOS/Android simulator.
2. Navigate to MyCar module. Add a new vehicle (2022 Honda CR-V, 35000 miles). -- Verifies vehicle creation.
3. Navigate to the vehicle's detail screen. Verify a "Tires" section is visible. -- Verifies UI presence.
4. Tap the "Tires" section. Verify empty state: "No tire sets tracked" with "Add Tire Set" button. -- Corresponds to empty state.
5. Tap "Add Tire Set". Fill in: brand "Michelin", model "Defender LTX", size "235/65R17", purchase date "2024-01-15", price $720, purchase odometer 28000. -- Tests tire set creation.
6. Tap "Save". Verify the tires screen shows the "Current Set" card with "Michelin Defender LTX", "235/65R17", and purchase info. -- Corresponds to AC-1.
7. Verify the 4-position tire diagram shows "No data" for all positions (no measurements yet). -- Corresponds to empty measurements state.
8. Tap "Log Measurement". Verify the interactive 4-position diagram appears. -- Corresponds to AC-5.
9. Tap "FL". Verify the position highlights with accent border and the depth picker appears. -- Corresponds to AC-5.
10. Set tread depth to 9/32. Verify reference marks are visible (2/32 Legal Min, 4/32 Wet Safety, 10/32 New Tire). -- Corresponds to AC-7.
11. Tap "Next Position" to advance to FR. Set depth to 9/32. -- Tests batch entry.
12. Set RL to 8/32 and RR to 8/32. -- Completes all 4 positions.
13. Verify odometer field is auto-filled with 35000. Verify date defaults to today. -- Auto-fill check.
14. Tap "Save All Measurements". -- Corresponds to AC-6.
15. Verify the tires screen now shows health bars for all 4 positions. FL and FR at 9/32 (green), RL and RR at 8/32 (green). -- Corresponds to AC-3, AC-4.
16. Verify overall health status shows "Good". -- Corresponds to AC-11.
17. Update the vehicle's odometer to 41000 (via vehicle edit). Log a second measurement batch: FL 7/32, FR 7/32, RL 6/32, RR 6/32 at odometer 41000. -- Tests wear tracking.
18. Navigate to tire set detail (tap "View History"). Verify measurement history shows both measurement batches. -- Corresponds to AC-8.
19. Verify wear rate per position shows approximately 0.33/32 per 1,000 miles for FL/FR (from 9 to 7 over 6000 miles) and 0.33/32 for RL/RR. -- Corresponds to AC-9.
20. Verify predicted replacement date is displayed for each position. FL/FR: approximately (7-2)/0.33 * 1000 / avg_monthly_miles months from now. -- Corresponds to AC-10.
21. Verify overall health status changed from "Good" to "Fair" (positions at 6/32 are below 8/32 but above 4/32). -- Corresponds to AC-11.
22. Tap "Log Rotation". Select "X-pattern" from the preset list. Verify odometer auto-filled to 41000. -- Tests rotation form.
23. Tap "Save Rotation". Verify rotation appears in the rotation history. -- Corresponds to AC-12.
24. Verify rotation shows "X-pattern" label and the swap description. -- Corresponds to AC-13.
25. Go back to tires screen. Tap "Add Tire Set". Fill in: brand "Continental", model "CrossContact LX25", size "235/65R17". Save. -- Tests set switching.
26. Verify the Michelin set moved to "Previous Sets" and the Continental set is now "Current Set". -- Corresponds to AC-2, AC-14.
27. In "Previous Sets", tap the Michelin set. Tap "Make Current". Verify the Michelin set becomes current again and Continental moves to Previous. -- Corresponds to AC-15.
28. Verify cost per mile displays correctly for the Michelin set: $720 / (41000 - 28000) miles = $0.055/mi. -- Corresponds to AC-16.
29. Change the Michelin set's purchase date to 6 years ago (2020-01-01). Verify an age warning appears: "This tire set is over 6 years old..." -- Corresponds to AC-17.
30. Delete the Continental tire set via its detail screen. Verify confirmation dialog. Confirm. Verify it disappears from Previous Sets. -- Tests delete.
31. Verify the Michelin set and its measurements/rotations are still intact. -- Corresponds to NC-2.
32. Delete the vehicle. Verify all tire data is also deleted. -- Corresponds to TC-11.
33. Repeat steps 3-20 on web at `/car/tires`. Verify functional parity: tire set creation, measurement logging, health bars, wear rate, rotation logging. -- Web parity check.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to `/car/tires`, click every button, verify all 9 states (loading, empty-no-vehicles, empty-no-sets, empty-no-measurements, error, success-healthy, success-mixed, success-critical, partial)
- [ ] Batch QA: after 5 features in car module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for `tire-engine.ts` (calculateWearRate, predictReplacementDate, getTireHealth, getRecommendedRotationOdometer, getPositionHealth, getCostPerMile)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- car module has active standalone counterpart (MyCar/)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Car module has 5 tables: cr_vehicles, cr_maintenance, cr_fuel_logs, cr_settings, cr_maintenance_schedules
- Schema version 2, migrations V1 and V2
- No tire tracking, no tread depth recording, no rotation history
- Tire-related maintenance (rotation, replacement) is logged as generic maintenance records with type "tire_rotation" but no per-tire granularity
- No tire-specific engine or calculations

### After This Work
- Car module has 8 tables (new: cr_tire_sets, cr_tire_measurements, cr_tire_rotations) with 5 new indexes
- Schema version 3, migration V3 added
- Full tire lifecycle: add tire sets, log tread depth per position, track rotations, predict replacement, monitor wear rate
- `tire-engine.ts` contains pure functions for wear rate calculation, replacement prediction, health assessment, rotation scheduling, and cost analysis
- 4-position tire diagram UI component shows visual health indicators
- Previous/current tire set management with one-tap switching
- Mobile and web parity for all tire tracking features

### Files Changed

- `modules/car/src/types.ts` -- Add TirePositionSchema, TireSetSchema, TireMeasurementSchema, TireRotationSchema, TireHealthSchema, CreateTireSetInputSchema, CreateTireMeasurementInputSchema, CreateTireRotationInputSchema Zod schemas and types
- `modules/car/src/db/schema.ts` -- Add CREATE_TIRE_SETS, CREATE_TIRE_MEASUREMENTS, CREATE_TIRE_ROTATIONS tables, CREATE_TIRE_INDEXES export
- `modules/car/src/db/crud.ts` -- Add tire CRUD functions: createTireSet, getTireSetsByVehicle, getCurrentTireSet, getTireSetById, updateTireSet, deleteTireSet, switchCurrentTireSet, createTireMeasurement, createTireMeasurementBatch, getMeasurementsByTireSet, getLatestMeasurements, deleteTireMeasurement, createTireRotation, getRotationsByTireSet, deleteRotation
- `modules/car/src/db/index.ts` -- Re-export new CRUD functions and schema constants
- `modules/car/src/engines/tire-engine.ts` -- NEW: calculateWearRate, predictReplacementDate, getTireHealth, getPositionHealth, getRecommendedRotationOdometer, getCostPerMile
- `modules/car/src/definition.ts` -- Add CAR_MIGRATION_V3, update schemaVersion to 3
- `modules/car/src/index.ts` -- Re-export new types and engine functions
- `modules/car/src/__tests__/tire-engine.test.ts` -- NEW: 29+ unit tests for tire engine
- `apps/mobile/app/(car)/tires.tsx` -- NEW: Tires overview screen with position diagram and health bars
- `apps/mobile/app/(car)/tire-set-detail.tsx` -- NEW: Tire set detail with measurement history and wear analysis
- `apps/mobile/app/(car)/add-measurement.tsx` -- NEW: Tread depth measurement form with batch entry
- `apps/mobile/app/(car)/add-rotation.tsx` -- NEW: Tire rotation logging form with preset patterns
- `apps/mobile/app/(car)/_layout.tsx` -- Hide tire screens from tab bar (accessible from vehicle detail, not as a tab)
- `apps/web/app/car/tires/page.tsx` -- NEW: Tires overview and detail web page

### Known Limitations
- No automatic tread depth measurement (would require hardware sensor or camera-based measurement, both out of scope for a privacy-first app).
- No tire database for auto-fill of brand/model/size based on vehicle make/model/year. All tire info is manually entered.
- No integration with the reminder engine in this spec. Tire rotation reminders and replacement alerts feeding into cr_maintenance_schedules would be a natural follow-up feature.
- No seasonal tire recommendations or weather-based alerts (e.g., "Switch to winter tires, temperature dropping below 45F"). Deferred to a future weather integration sprint.
- No photo capture for visual tire inspection. A future enhancement could allow users to photograph tread wear.
- Wear rate calculation assumes linear tread wear. In reality, wear accelerates as tires age. The prediction is an estimate, not a guarantee.
- No multi-axle support beyond 4 tires + spare (e.g., dual-rear-wheel trucks with 6 tires). A future update could extend the position enum.

### Context for Next Agent
- The `tire-engine.ts` must contain only pure functions with no platform or database dependencies. All SQLite calls are in `crud.ts`. The engine receives data as function arguments and returns computed results.
- The `is_current` flag on `cr_tire_sets` is an application-level constraint (at most one per vehicle). The CRUD function `switchCurrentTireSet` must atomically set all other sets for the vehicle to `is_current = 0` before setting the new one to `is_current = 1`. Use a transaction wrapper or sequential UPDATE statements within a single function.
- Tread depth is stored as INTEGER in 32nds of an inch. All display formatting (e.g., "8/32") happens at the presentation layer. The engine works with raw integers.
- The `pattern` field in `cr_tire_rotations` is a TEXT column with a human-readable format (e.g., "FL->RR,FR->RL,RL->FL,RR->FR"). There is no programmatic parsing of this field in the engine. It is stored for display purposes only. Future enhancements could parse it to track which physical tire is in which position over time.
- The `purchase_price_cents` field stores price in cents (integer) to avoid floating-point precision issues. Display formatting to dollars/currency happens at the UI layer.
- If the GPS mileage tracking spec (CR-005) is implemented first and uses migration V3, this spec should use migration V4 instead. The migration version must be unique within the car module's migration array.
- The tire position diagram is a key UI component that will be reused across the tires screen, measurement form, and tire set detail. Consider extracting it into a shared component under `apps/mobile/app/(car)/components/TirePositionDiagram.tsx`.
