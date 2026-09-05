# Feature Spec: Cost Per Mile/km

## Metadata
- **Module:** car
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [3] x3 + Complexity [4] x2 + CrossModule [2] x1 + PaidUser [2] x1
- **Sprint:** 5
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (reads existing `cr_fuel_logs`, `cr_maintenance`, and `cr_vehicles` data)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Vehicle owners rarely know their true cost of ownership. They track fuel and maintenance individually but never see the aggregate picture: what each mile actually costs them. A cost-per-mile dashboard transforms MyCar from a passive record keeper into an ownership intelligence tool. This is the highest cross-module opportunity in the car backlog (score 2) because the budget module can pull total vehicle cost for auto-categorization, and it differentiates MyCar from free competitors that only show individual line items.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Simply Auto | Yes | Premium tier | Detailed cost analysis with per-mile breakdown, pie chart by category, monthly trends |
| Drivvo | Yes | Free tier | Expense reports with cost/km, category filters, date range selector |
| AUTOsist | Yes | Free tier | Running cost tracker, cost-per-mile summary, CSV export |
| CARFAX Car Care | No | N/A | Tracks service history only, no cost aggregation |
| Fuelio | Partial | Free (~$5) | Fuel cost-per-mile only, no maintenance cost integration |
| FIXD | No | N/A | Diagnostic focus, no cost tracking |

### Target User
Multi-vehicle household owners (30-55) who want to compare total ownership cost across vehicles to make informed decisions about repairs vs replacement. Users of Simply Auto's premium tier ($3.99/mo) who want a privacy-first alternative without cloud sync. Also appeals to gig drivers (Uber, Lyft, DoorDash) who need cost-per-mile for tax deductions and profitability tracking.

## Technical Context

### Where This Lives in MyLife

```
modules/car/src/
  engines/cost-engine.ts              -- NEW: cost aggregation, per-mile calculation, trends
  engines/cost-engine.test.ts         -- NEW: unit tests for cost engine
  types.ts                            -- New Zod schemas: CostBreakdown, MonthlyCostTrend, VehicleCostComparison
  index.ts                            -- Re-export new types and engine functions

apps/mobile/app/(car)/
  costs.tsx                           -- NEW: Cost Analysis screen (sub-screen under Dashboard)

apps/web/app/car/
  costs/page.tsx                      -- NEW: Cost Analysis web page
```

### Wireframe Position

```
Hub Dashboard
  └── MyCar card
       └── Dashboard tab
            └── "Cost Analysis" section/card ← YOU ARE HERE
                 ├── Summary: cost per mile + total cost
                 ├── Breakdown pie chart (fuel / maintenance / other)
                 ├── Monthly trend line chart
                 └── Vehicle comparison (if 2+ vehicles)
```

The Cost Analysis view is accessible from:
1. The Dashboard tab in MyCar via a "Cost Analysis" card (primary entry point)
2. A dedicated "Costs" navigation item in the tab bar or sub-nav
3. Tapping a cost summary widget on the vehicle detail screen

### Data Model

No new tables required. This feature is a pure computation engine over existing data.

**Existing tables read:**

```sql
-- cr_fuel_logs: fuel cost data
-- Relevant columns: vehicle_id, cost_cents, odometer_at, logged_at

-- cr_maintenance: maintenance cost data
-- Relevant columns: vehicle_id, cost_cents, odometer_at, performed_at

-- cr_vehicles: vehicle metadata
-- Relevant columns: id, name, odometer, created_at

-- cr_settings: user preferences (distance unit, currency)
-- Relevant columns: key, value
```

**New setting keys (stored in existing cr_settings):**

```sql
-- No migration needed, just new key-value pairs:
-- 'cost_include_insurance' -> '0' or '1' (default '0', reserved for future insurance feature)
-- 'cost_custom_entries_json' -> JSON array of {label, costCents, date} for ad-hoc costs
```

**Custom cost entries structure (stored as JSON in cr_settings):**

```typescript
// Stored in cr_settings with key 'cost_custom_entries_json'
interface CustomCostEntry {
  id: string;          // UUID
  vehicleId: string;   // Links to cr_vehicles
  label: string;       // e.g., "Insurance", "Parking permit", "Toll pass"
  costCents: number;   // Amount in cents
  date: string;        // ISO date string
  isRecurring: boolean; // If true, costCents is per-month
}
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for SQLite queries), `@mylife/ui` (Cool Obsidian tokens, glass card components), `@mylife/module-registry` (no migration needed)
- **External:** `zod` (schema validation). No external APIs required. All computation is on-device.
- **Cross-Module:** Budget module can query `calculateCostPerMile()` and `getCostBreakdown()` to auto-fill a "Vehicle" budget category. This is a one-way dependency (budget reads from car, car does not depend on budget). Integration is deferred to a cross-module sprint but the engine API is designed for it.

## Functional Requirements

### User Stories
1. As a vehicle owner, I want to see my total cost per mile so that I can understand the true cost of driving each vehicle.
2. As a multi-vehicle household, I want to compare cost per mile across vehicles side by side so that I can decide which vehicle to use for long trips or whether to sell one.
3. As a privacy-first user, I want all cost calculations to happen on-device without any network calls, so my financial data stays private.
4. As a gig driver, I want to filter cost analysis by date range so that I can calculate my actual cost per mile for tax purposes during a specific period.
5. As a vehicle owner, I want to see cost trends over time (monthly) so that I can spot when maintenance costs are rising and plan ahead.
6. As a vehicle owner, I want to add custom cost entries (insurance, parking, tolls) so that my cost-per-mile reflects total ownership, not just fuel and repairs.

### Behavior Specification

**Viewing cost summary (happy path):**
1. User navigates to MyCar > Dashboard tab.
2. "Cost Analysis" card shows a summary: total cost, cost per mile, and a mini breakdown (fuel % / maintenance % / other %).
3. User taps the card to open the full Cost Analysis screen.
4. Full screen shows:
   - Header: vehicle selector dropdown (if multiple vehicles) + date range picker (default: "All Time")
   - Summary section: big number for cost per mile (e.g., "$0.42/mi"), total cost, total distance driven
   - Breakdown section: horizontal bar chart or donut showing fuel, maintenance, and custom costs as percentages with dollar amounts
   - Trend section: line chart showing monthly cost per mile over time (last 12 months by default)
5. All values update instantly when vehicle or date range changes.

**Distance calculation:**
1. Distance driven is calculated from fuel log odometer readings: max(odometer_at) - min(odometer_at) within the selected date range.
2. If only one fuel log exists, distance is calculated from the vehicle's initial odometer (from cr_vehicles.odometer at creation, approximated as 0 if unknown) to the single log's odometer_at.
3. If no fuel logs exist, distance is taken from maintenance records: max(odometer_at) - min(odometer_at).
4. If no odometer data exists at all, cost per mile shows "N/A" with a prompt to log fuel or maintenance with odometer readings.

**Adding custom cost entries:**
1. User taps "Add Custom Cost" button on the Cost Analysis screen.
2. Form shows: label text input, amount input (dollars), date picker, vehicle selector, recurring toggle.
3. For recurring costs (e.g., monthly insurance), the cost is prorated across months within the selected date range.
4. User taps Save. Entry is stored as JSON in cr_settings under key `cost_custom_entries_json`.
5. Cost breakdown immediately recalculates to include the custom entry.

**Vehicle comparison:**
1. If the user has 2+ vehicles, a "Compare Vehicles" toggle appears at the top of the Cost Analysis screen.
2. Toggling it on shows a side-by-side card layout:
   - Each vehicle gets a card with: name, cost per mile, total cost, distance driven, and a mini breakdown.
   - Cards are sorted by cost per mile (lowest first = most efficient).
3. Toggling it off returns to the single-vehicle view.

**Date range filtering:**
1. Predefined ranges: "Last 30 Days", "Last 90 Days", "Last 6 Months", "Last 12 Months", "Year to Date", "All Time", "Custom".
2. Custom opens a date range picker with start and end date.
3. Selecting a range filters all fuel logs and maintenance records by their logged_at/performed_at dates.
4. The summary, breakdown, and trend sections all update to reflect the filtered range.

**Unit preference (miles vs km):**
1. The engine reads `distanceUnit` from cr_settings (default: 'miles').
2. If set to 'km', all displays show "cost per km" and distances in kilometers.
3. Odometer values stored in the database are always in the unit the user chose (no conversion at storage time). The cost engine divides cost by distance as-is.

### Edge Cases

- **No fuel logs and no maintenance records:** Cost Analysis screen shows empty state with CTA "Log your first fuel fill-up or maintenance to see cost analysis."
- **Fuel logs exist but no cost data (cost_cents = 0 or null on all):** Show distance driven but cost per mile shows "$0.00/mi" with a note "Some fuel logs are missing cost data."
- **Only one fuel log:** Distance is estimated from vehicle creation odometer to that log's odometer. Show info banner "Add more fuel logs for accurate distance tracking."
- **Maintenance records have cost but no odometer:** These costs are included in the total but do not contribute to distance calculation. This is expected and correct.
- **Date range returns zero records:** Show "No data in this date range" with a suggestion to expand the range.
- **Very large dataset (500+ fuel logs, 200+ maintenance records):** Aggregation must complete within 300ms. Use SQL SUM/MIN/MAX aggregation queries, not in-memory loops over all rows.
- **Currency format:** Use the `currencyCode` setting (default: USD). Format with Intl.NumberFormat. Support USD, EUR, GBP, CAD, AUD.
- **Zero distance driven (all logs at same odometer):** Cost per mile shows "N/A" (division by zero guard).
- **Negative cost entries:** Rejected by validation. Costs must be >= 0.
- **Custom cost entries with future dates:** Accepted but excluded from date-range calculations unless the range includes that date.
- **Vehicle deleted:** Custom cost entries for that vehicle become orphaned. The engine filters them out by checking vehicle existence.
- **Module disabled mid-use:** Data preserved. Re-enabling restores all cost analysis.
- **Mixed recurring and one-time custom costs:** Recurring costs are prorated monthly. A $120/month insurance entry spanning 6 months contributes $720 to the total.

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** The Dashboard tab shows a "Cost Analysis" summary card displaying cost per mile and total cost for the primary vehicle.
- [ ] **AC-2:** Tapping the Cost Analysis card navigates to the full Cost Analysis screen.
- [ ] **AC-3:** The Cost Analysis screen shows a vehicle selector dropdown when 2+ vehicles exist.
- [ ] **AC-4:** Selecting a different vehicle updates all displayed cost data within 300ms.
- [ ] **AC-5:** The date range picker offers 7 presets (Last 30 Days, Last 90 Days, Last 6 Months, Last 12 Months, Year to Date, All Time, Custom) plus a custom date range option.
- [ ] **AC-6:** Selecting a date range filters all cost data and updates the summary, breakdown, and trend sections.
- [ ] **AC-7:** The breakdown section shows fuel, maintenance, and custom costs as labeled segments with both percentages and dollar amounts.
- [ ] **AC-8:** The monthly trend section shows a line chart with one data point per month for cost per mile.
- [ ] **AC-9:** The "Compare Vehicles" toggle (visible with 2+ vehicles) shows side-by-side vehicle cost cards sorted by efficiency (lowest cost per mile first).
- [ ] **AC-10:** Tapping "Add Custom Cost" opens a form with label, amount, date, vehicle, and recurring toggle fields.
- [ ] **AC-11:** Saving a custom cost entry immediately recalculates the breakdown to include it.
- [ ] **AC-12:** The screen respects the distance unit setting (miles vs km) in all labels and calculations.
- [ ] **AC-13:** When no data exists, the screen shows an empty state with a CTA to log fuel or maintenance.

### Technical Criteria
- [ ] **TC-1:** `calculateCostPerMile(vehicleId)` returns total cost in cents divided by distance in user's unit (miles or km), or null if distance is zero.
- [ ] **TC-2:** `getCostBreakdown(vehicleId)` returns `{ fuel, maintenance, custom, total }` where each value is in cents and the sum of fuel + maintenance + custom equals total.
- [ ] **TC-3:** `getMonthlyCostTrend(vehicleId, months)` returns an array of `{ month: string, costPerMile: number, totalCost: number }` sorted chronologically.
- [ ] **TC-4:** `compareVehicleCosts(vehicleIds)` returns an array sorted by costPerMile ascending (most efficient first).
- [ ] **TC-5:** Distance calculation uses SQL `MAX(odometer_at) - MIN(odometer_at)` from fuel logs, falling back to maintenance records if no fuel logs exist.
- [ ] **TC-6:** Cost aggregation uses SQL `SUM(cost_cents)` for both fuel logs and maintenance records, not in-memory iteration.
- [ ] **TC-7:** Custom cost entries are validated: label required (non-empty string), costCents >= 0, date required (valid ISO date string).
- [ ] **TC-8:** Recurring custom costs are prorated correctly: a $100/month entry over a 3-month range contributes $300.
- [ ] **TC-9:** Date range filtering correctly bounds fuel logs by `logged_at` and maintenance records by `performed_at`.
- [ ] **TC-10:** All engine functions are pure (no side effects) except custom cost persistence which goes through the existing `setSetting` CRUD.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Cost calculations must NOT make any network calls. All computation is on-device.
- [ ] **NC-2:** The cost engine must NOT modify any existing fuel log or maintenance records (read-only access).
- [ ] **NC-3:** Division by zero must NOT occur when distance driven is zero. Return null for cost per mile instead.
- [ ] **NC-4:** Custom cost entries must NOT create new database tables. They are stored as JSON in cr_settings.
- [ ] **NC-5:** The cost engine must NOT import or depend on any budget module code. Cross-module integration is the budget module's responsibility.
- [ ] **NC-6:** Deleting a vehicle must NOT leave orphaned custom cost entries visible in the UI (filter by vehicle existence).

## UI Specification

### Mobile (Expo)

**Cost Analysis Dashboard Card (on Dashboard tab):**
- Glass card: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#6366F1` (indigo)
- Layout: Icon (dollar sign in accent color) | "Cost Analysis" title | cost per mile value (large, accent-colored)
- Below: mini horizontal bar showing fuel/maintenance/other proportions in muted colors
- Tap target: entire card

**Cost Analysis Screen:**
- Background: `#0A0A0F` (background token)
- Top bar: "Cost Analysis" title, vehicle selector dropdown (if 2+ vehicles), date range picker button
- Summary section: large glass card with:
  - Cost per mile: `fontSize: 36`, `fontWeight: 800`, accent color (`#6366F1`)
  - Below: "Total: $X,XXX" in `textSecondary` (`rgba(240,240,245,0.65)`)
  - Below: "X,XXX miles driven" in `textSecondary`
- Breakdown section: glass card with horizontal stacked bar
  - Fuel: `#34D399` (green)
  - Maintenance: `#FBBF24` (amber)
  - Custom: `#A78BFA` (purple, lighter than accent)
  - Labels below bar with dollar amounts and percentages
- Trend section: glass card with line chart
  - Line color: `#6366F1` (accent)
  - Grid lines: `rgba(255,255,255,0.06)` (border token)
  - X-axis: month labels (Jan, Feb, ...) in `textSecondary`
  - Y-axis: cost per mile values
  - Fill: gradient from accent at 0.2 opacity to transparent
- "Add Custom Cost" button: accent color outline, glass background, positioned below breakdown
- Compare toggle (if 2+ vehicles): segmented control at top, "Single Vehicle" / "Compare All"

**Vehicle Comparison View:**
- Grid of glass cards (2 columns on tablet, 1 column on phone)
- Each card: vehicle name, cost per mile (large), total cost, distance, mini breakdown bar
- Sorted by cost per mile ascending
- Border highlight on most efficient vehicle: `#30D158` (success)

**Empty State:**
- Centered fuel pump icon in `textSecondary` color
- "No cost data yet" in `text` color (`#F0F0F5`), `fontSize: 18`
- "Log a fuel fill-up or maintenance record to see your cost analysis" in `textSecondary`
- "Log Fuel" and "Log Maintenance" buttons in accent color

### Web (Next.js)

- Same tokens via CSS variables
- Accessible at `/car/costs` route
- Layout: sidebar navigation (existing), main content area
- Summary card uses `backdrop-filter: blur(16px)` with glass token backgrounds
- Breakdown and trend charts rendered with the same color tokens
- Vehicle comparison uses a responsive grid (3 columns on wide, 2 on medium, 1 on narrow)
- Date range picker: dropdown with same 7 presets + custom range
- "Add Custom Cost" opens an inline form panel (not modal) on the right side
- Custom cost entries listed below the form with edit/delete actions

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards (summary + breakdown + trend) with pulsing animation | Initial data fetch from SQLite |
| Empty (no vehicles) | Centered car icon, "Add a vehicle first" + CTA button | No vehicles in cr_vehicles |
| Empty (no cost data) | Fuel pump icon, "No cost data yet" + "Log Fuel" / "Log Maintenance" buttons | Vehicle exists but no fuel logs and no maintenance records with costs |
| Error | "Something went wrong loading cost data" + retry button | SQLite read failure |
| Success (single vehicle) | Full cost analysis with summary, breakdown, trend | Data loaded for one vehicle |
| Success (comparison) | Side-by-side vehicle cost cards | Compare toggle enabled with 2+ vehicles |
| Partial (some data missing) | Summary shows available data with info banner "Some records are missing cost or odometer data" | Mixed data quality |

## Test Requirements

### Unit Tests (modules/car/src/engines/cost-engine.test.ts)
- [ ] `calculateCostPerMile`: returns correct cost per mile with fuel and maintenance data
- [ ] `calculateCostPerMile`: returns correct cost per km when distanceUnit is 'km'
- [ ] `calculateCostPerMile`: returns null when distance driven is zero
- [ ] `calculateCostPerMile`: returns null when no fuel logs and no maintenance records exist
- [ ] `calculateCostPerMile`: handles fuel logs only (no maintenance)
- [ ] `calculateCostPerMile`: handles maintenance only (no fuel logs)
- [ ] `calculateCostPerMile`: respects date range filter
- [ ] `calculateCostPerMile`: includes custom cost entries in total
- [ ] `getCostBreakdown`: returns correct breakdown with all three categories
- [ ] `getCostBreakdown`: fuel + maintenance + custom equals total
- [ ] `getCostBreakdown`: handles zero fuel costs gracefully
- [ ] `getCostBreakdown`: handles zero maintenance costs gracefully
- [ ] `getCostBreakdown`: prorates recurring custom costs correctly across date range
- [ ] `getMonthlyCostTrend`: returns one entry per month sorted chronologically
- [ ] `getMonthlyCostTrend`: handles months with no data (zero cost, cost per mile = 0)
- [ ] `getMonthlyCostTrend`: respects the months parameter limit
- [ ] `getMonthlyCostTrend`: handles a single month of data
- [ ] `compareVehicleCosts`: returns vehicles sorted by cost per mile ascending
- [ ] `compareVehicleCosts`: handles vehicles with no data (cost per mile = null, sorted last)
- [ ] `compareVehicleCosts`: handles a single vehicle (returns array of 1)
- [ ] `getDistanceDriven`: uses fuel log odometer range (max - min)
- [ ] `getDistanceDriven`: falls back to maintenance odometer range when no fuel logs
- [ ] `getDistanceDriven`: returns 0 when no odometer data exists
- [ ] `getDistanceDriven`: respects date range filter
- [ ] Custom cost validation: rejects empty label
- [ ] Custom cost validation: rejects negative costCents
- [ ] Custom cost validation: rejects missing date
- [ ] Custom cost validation: accepts valid entry with all fields

### Integration Tests
- [ ] Full flow: add vehicle, log 3 fuel entries, log 2 maintenance records, verify cost per mile is (sum of all costs) / (max odometer - min odometer)
- [ ] Full flow: add custom cost entry, verify breakdown includes it, delete it, verify breakdown excludes it
- [ ] Full flow: add 2 vehicles with different cost profiles, toggle compare, verify sort order by efficiency
- [ ] Date range flow: log entries across 6 months, select "Last 30 Days", verify only recent entries included
- [ ] Error flow: corrupt custom cost JSON in settings, verify graceful fallback (treat as empty array, no crash)

### QA Verification Script

1. Open the app on iOS/Android simulator.
2. Navigate to MyCar module. Verify no vehicles exist yet. -- Baseline check.
3. Add a new vehicle (2023 Toyota Camry, odometer 15,000 miles). -- Setup.
4. Navigate to Dashboard tab. Verify "Cost Analysis" card shows empty state or "$0.00/mi". -- Corresponds to AC-13.
5. Tap the Cost Analysis card. Verify full Cost Analysis screen opens. -- Corresponds to AC-2.
6. Verify empty state: "No cost data yet" with "Log Fuel" and "Log Maintenance" buttons. -- Corresponds to AC-13.
7. Go back. Navigate to Fuel tab. Log a fuel entry: 12 gallons, $48.00, odometer 15,500. -- Add data.
8. Log a second fuel entry: 11 gallons, $44.00, odometer 16,000. -- Add more data.
9. Navigate to Maintenance tab. Log an oil change: $65.00, odometer 15,800. -- Add maintenance data.
10. Return to Dashboard > Cost Analysis card. Verify it now shows a cost per mile value. -- Corresponds to AC-1.
11. Tap to open full screen. Verify summary shows cost per mile = ($48 + $44 + $65) / (16,000 - 15,500) = $157 / 500 = $0.31/mi. -- Corresponds to TC-1.
12. Verify breakdown shows: Fuel $92.00, Maintenance $65.00, Custom $0.00, Total $157.00. -- Corresponds to AC-7, TC-2.
13. Verify the breakdown percentages: Fuel ~58.6%, Maintenance ~41.4%. -- Corresponds to AC-7.
14. Tap "Add Custom Cost". Fill in: label "Insurance", amount $150.00, date today, recurring = on. Save. -- Corresponds to AC-10.
15. Verify breakdown updates to include Custom category with $150.00 (prorated for current month). -- Corresponds to AC-11.
16. Select date range "Last 30 Days". Verify data filters to only include entries from the last 30 days. -- Corresponds to AC-5, AC-6.
17. Select "All Time". Verify all entries are included again. -- Corresponds to AC-6.
18. Add a second vehicle (2020 Honda Accord, odometer 45,000). -- Setup for comparison.
19. Log fuel for the Accord: 10 gallons, $40.00, odometer 45,300. -- Add data for second vehicle.
20. Return to Cost Analysis. Verify vehicle selector dropdown appears. -- Corresponds to AC-3.
21. Select the Accord. Verify cost data updates to show the Accord's numbers. -- Corresponds to AC-4.
22. Toggle "Compare All". Verify side-by-side cards for both vehicles, sorted by cost per mile (lowest first). -- Corresponds to AC-9.
23. Navigate to Settings. Change distance unit to "km". Return to Cost Analysis. Verify labels show "cost per km" and values adjust accordingly. -- Corresponds to AC-12.
24. Delete the Accord vehicle. Return to Cost Analysis. Verify comparison toggle is gone and only the Camry data shows. -- Verifies orphan cleanup.
25. Repeat steps 4-17 on web at `/car/costs`. Verify functional parity. -- Web parity check.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to `/car/costs`, click every button, verify all 5 states (loading, empty-no-vehicles, empty-no-data, error, success)
- [ ] Batch QA: after 5 features in car module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for `cost-engine.ts` (calculateCostPerMile, getCostBreakdown, getMonthlyCostTrend, compareVehicleCosts)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- car module has active standalone counterpart (MyCar/)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Car module has 5 tables: cr_vehicles, cr_maintenance, cr_fuel_logs, cr_settings, cr_maintenance_schedules
- Schema version 2, migrations v1 and v2
- Fuel logs and maintenance records store cost_cents but no aggregation or analysis exists
- No cost-per-mile calculation, no breakdown by category, no trend charts
- No custom cost entry mechanism
- The Dashboard tab exists but has no cost analysis section

### After This Work
- Car module still has 5 tables (no new tables). Schema version unchanged at 2.
- New engine: `cost-engine.ts` with pure functions for cost analysis
- New setting keys in cr_settings: `cost_custom_entries_json` for custom cost entries
- Full cost analysis lifecycle: view per-mile cost, see category breakdown, track monthly trends, compare vehicles, add custom costs
- Mobile: Cost Analysis screen accessible from Dashboard card and direct navigation
- Web: Cost Analysis page at `/car/costs`
- Cross-module ready: budget module can import `calculateCostPerMile` and `getCostBreakdown` from `@mylife/car`

### Files Changed

- `modules/car/src/engines/cost-engine.ts` -- NEW: calculateCostPerMile, getCostBreakdown, getMonthlyCostTrend, compareVehicleCosts, getDistanceDriven, custom cost CRUD (read/write JSON in cr_settings)
- `modules/car/src/engines/cost-engine.test.ts` -- NEW: 28+ unit tests for cost engine
- `modules/car/src/types.ts` -- Add CostBreakdownSchema, MonthlyCostTrendSchema, VehicleCostComparisonSchema, CustomCostEntrySchema Zod schemas and types
- `modules/car/src/index.ts` -- Re-export new types and engine functions
- `apps/mobile/app/(car)/costs.tsx` -- NEW: Cost Analysis screen with summary, breakdown, trend chart, comparison, custom cost form
- `apps/web/app/car/costs/page.tsx` -- NEW: Cost Analysis web page with same functionality

### Known Limitations
- Charts are described conceptually. The implementing agent should use a lightweight charting approach (e.g., SVG paths for line chart, CSS for bar chart) or a library already in the project. Do not add heavy chart dependencies.
- Custom cost entries are stored as JSON in cr_settings, which is simple but does not scale well beyond ~100 entries. If the feature proves popular, a dedicated cr_custom_costs table should be added in a future migration.
- No integration with MyBudget yet. The engine API is designed for it, but the actual cross-module wiring is deferred.
- Insurance and depreciation costs are manual entries. There is no automatic data source for these.
- Fuel economy (MPG) is a related but separate concern. This spec focuses on cost, not efficiency. MPG tracking could be a future feature.
- The trend chart shows monthly aggregates only. Weekly or daily granularity is not supported in V1.

### Context for Next Agent
- The cost engine must be pure and platform-agnostic. All database access should go through the existing `DatabaseAdapter` interface and existing CRUD functions (`getFuelLogsByVehicle`, `getMaintenanceByVehicle`, `getSetting`, `setSetting`). For performance on large datasets, add new SQL-level aggregation queries directly in the engine (not new CRUD functions) using `db.query()`.
- Custom cost entries are stored as a single JSON blob in cr_settings. The engine should parse this with Zod validation and gracefully handle corrupt JSON (fallback to empty array).
- The `distanceUnit` setting already exists in cr_settings (seeded as 'miles' in migration v1). Read it via `getSetting(db, 'distanceUnit')`. Do not add a new setting for this.
- The `currencyCode` setting already exists in cr_settings (seeded as 'USD' in migration v1). Use it for formatting.
- For the trend chart data, generate monthly buckets by grouping fuel logs by `logged_at` month and maintenance records by `performed_at` month. Months with no records should still appear in the array with zero values to avoid gaps in the chart.
- The `compareVehicleCosts` function should accept an array of vehicle IDs and return results for all of them. Vehicles with no data should have `costPerMile: null` and be sorted last.
