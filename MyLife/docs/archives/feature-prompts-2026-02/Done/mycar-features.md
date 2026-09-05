# MyCar Feature Set

## Problem Statement

You are working in the MyLife monorepo at `/Users/trey/Desktop/Apps/MyLife/`. MyLife is a unified hub app consolidating 10+ privacy-first personal app modules into a single cross-platform application. Each module implements a `ModuleDefinition` contract from `@mylife/module-registry` and stores data in a shared SQLite database using table-name prefixes (`cr_` for car).

**MyCar** is a privacy-first vehicle maintenance and expense tracking app. The standalone source of truth lives at `/Users/trey/Desktop/Apps/MyLife/MyCar/` with `packages/shared/src/` containing: `db/` (schema), `models/`, `repositories/`, `backup/`, `constants/`, `expenses/`, `fuel/`, `reminders/`, `export/`, and `__tests__/`. The hub module lives at `modules/car/`.

**What already exists:** Multi-vehicle profiles, full service log (oil changes, tire rotation, inspections, etc.), fuel log with economy calculation (MPG/L per 100km), general expense tracking, service reminders with mileage-based and time-based intervals, document storage with expiry tracking (insurance, registration, inspection certificates), settings, backup/restore, CSV and PDF export. A comprehensive test suite exists.

**MyCar is standalone** (no absorbed apps). It is the vehicle management platform within the MyLife suite.

**What needs to be built (2 feature sets):**

### Feature Set 1: Analytics and Visualization

MyCar has the data but no visualization. Users log fuel and expenses but cannot see trends, charts, or projections.

**Features:**
- Fuel efficiency charts: line chart showing MPG (or L/100km) over time per vehicle, with rolling average and trend line
- Expense reports and analytics dashboard: monthly/annual spending breakdown by category (fuel, maintenance, insurance, registration), total cost of ownership per vehicle
- Route/trip logging for tax deductions: log business vs. personal trips with mileage, purpose, and date for IRS mileage deduction reporting
- Multi-fuel type support: track electric (kWh), hybrid (MPG + kWh), and flex-fuel (E85/regular) alongside gasoline/diesel
- Cost-per-mile calculation: total expenses divided by total miles driven, displayed as a running metric

### Feature Set 2: Safety and Maintenance Intelligence

Features that make MyCar proactive rather than reactive.

**Features:**
- Recall alert checker: query the NHTSA Recalls API by VIN or year/make/model and display active recalls with severity, description, and remedy status
- Pre-trip inspection checklist: configurable checklist (tires, lights, fluids, brakes, wipers) that users complete before long trips, with history and reminders
- Predictive maintenance: based on service log patterns and manufacturer intervals, suggest upcoming maintenance before the reminder threshold (e.g., "Oil change due in ~500 miles based on your driving pattern")
- Maintenance cost comparison: show average cost for a service type across the user's history and flag outliers ("This oil change cost 40% more than your average")

---

## Acceptance Criteria

### Feature Set 1: Analytics and Visualization

1. User opens Fuel Stats for their Honda Civic -> sees a line chart showing MPG per fill-up over the last 12 months, a rolling 5-fillup average line, and a trend arrow (improving/declining); below the chart, summary cards show average MPG, best MPG, worst MPG, and total gallons consumed
2. User opens Expense Report and selects "2025" -> sees a bar chart with monthly spending stacked by category (fuel, maintenance, insurance, other); a summary shows total cost of ownership ($4,200) and cost-per-mile ($0.28/mile based on 15,000 miles driven)
3. User taps "Log Trip" -> enters date, start/end odometer readings (or distance), purpose ("client meeting"), and tags it as "business" -> the trip appears in a trip log; user taps "Export for Taxes" -> gets a CSV with all business trips, total business miles, and IRS standard mileage deduction amount for the tax year
4. User adds an electric vehicle and logs a charge (45 kWh, $8.10) -> fuel stats show kWh per mile (or miles per kWh) instead of MPG; cost-per-mile calculation includes electricity cost

### Feature Set 2: Safety and Maintenance Intelligence

5. User enters their VIN on a vehicle profile -> taps "Check Recalls" -> the app queries NHTSA and displays 2 active recalls with campaign number, description ("airbag inflator may rupture"), severity, and remedy ("contact dealer for free replacement"); results are cached locally for 30 days
6. User opens "Pre-Trip Checklist" before a road trip -> sees a list of items (tire pressure, oil level, coolant, lights, wipers, brakes); checks each one off -> the completed checklist is saved with a date stamp; 6 months later, a reminder suggests running the checklist again
7. User has logged 5 oil changes over 2 years -> the app calculates their average interval (5,200 miles) and displays "Oil change predicted in ~600 miles" when they are within 15% of the average interval

---

## Constraint Architecture

**Musts:**
- All data stored in local SQLite with `cr_` prefix (new tables: `cr_fuel_stats_cache`, `cr_trip_log`, `cr_recalls`, `cr_checklists`, `cr_checklist_items`, `cr_checklist_completions`, `cr_maintenance_predictions`)
- NHTSA Recalls API is the only permitted network call (free, no API key required: `https://api.nhtsa.gov/recalls/recallsByVehicle`)
- Fuel efficiency supports 4 fuel types: gasoline (MPG), diesel (MPG), electric (mi/kWh), and hybrid (MPG + mi/kWh)
- Trip logging must include IRS standard mileage rate for the current tax year (2026: verify rate at build time)
- Existing tests must continue to pass
- Both standalone (`MyCar/`) and hub module (`modules/car/`) must receive changes

**Must-nots:**
- Do not modify existing service log, fuel log, or expense tables
- Do not add cloud sync or user accounts
- Do not use OBD-II or Bluetooth vehicle diagnostics (out of scope for this phase)
- Do not modify `packages/module-registry/` or other modules
- Do not add GPS-based trip tracking (manual odometer entry only)

**Preferences:**
- Charts rendered via lightweight SVG library (prefer consistency with other MyLife modules)
- NHTSA recall results cached in SQLite for 30 days to minimize network calls
- Predictive maintenance uses simple linear regression on the user's service interval history (no ML frameworks)
- Cost-per-mile should be a computed field that updates whenever a fuel or expense entry is added
- Trip log CSV export should match common tax software import formats

**Escalation triggers:**
- If NHTSA API changes its schema or becomes unavailable, fall back to manual VIN lookup and document the issue
- If the existing fuel log schema cannot accommodate electric/hybrid fuel types without breaking changes, propose a migration strategy
- If IRS mileage rates require annual manual updates, add a configuration constant with a comment to update yearly

---

## Subtask Decomposition

**Subtask 1: Fuel Efficiency Charts and Multi-Fuel (90 min)**
Build fuel stats query engine: MPG over time, rolling average, trend calculation. Add multi-fuel support (gasoline, diesel, electric, hybrid) to the fuel log with appropriate unit conversions. Build the chart UI with line graph and summary cards.

**Subtask 2: Expense Analytics Dashboard (60 min)**
Build expense aggregation queries: monthly/annual breakdown by category, total cost of ownership, cost-per-mile. Build the dashboard UI with stacked bar chart and summary cards. Support date range filtering.

**Subtask 3: Trip Logging and Tax Export (60 min)**
Add `cr_trip_log` table. Build trip CRUD (date, distance, purpose, business/personal flag). Calculate IRS mileage deduction (business miles x standard rate). Build CSV export for tax filing.

**Subtask 4: NHTSA Recall Checker (60 min)**
Add `cr_recalls` table for caching results. Build NHTSA API client that queries by VIN or year/make/model. Parse and display recall results with severity, description, and remedy. Cache results for 30 days.

**Subtask 5: Pre-Trip Checklist and Predictive Maintenance (60 min)**
Add checklist tables. Build configurable checklist with default items. Implement completion tracking with date stamps and reminders. Build predictive maintenance engine: calculate average service intervals from history and predict next due date/mileage.

---

## Evaluation Design

1. **Fuel chart accuracy:** Insert 10 fuel entries with known MPG values -> `getFuelStats(vehicleId)` returns correct per-entry MPG, rolling average, and trend direction matching manual calculation
2. **Cost-per-mile:** Insert $2,000 of expenses and 10,000 miles driven -> `getCostPerMile(vehicleId)` returns $0.20/mile
3. **NHTSA integration:** Query NHTSA for a known recalled vehicle (e.g., 2014 Honda Civic) -> `checkRecalls(vin)` returns at least 1 recall with campaign number and description
4. **Predictive maintenance:** Insert 4 oil changes at intervals of [5000, 5200, 4800, 5100] miles -> `predictNextService('oil_change', vehicleId)` returns approximately 5025 miles from last service
5. **Type safety and tests:** `pnpm typecheck` exits 0; existing tests pass; `pnpm check:parity` exits 0
