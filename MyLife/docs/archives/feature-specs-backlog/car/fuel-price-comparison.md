# Feature Spec: Fuel Price Comparison

## Metadata
- **Module:** car
- **SPEC-mycar ID:** CR-019
- **Priority Score:** 17 / 50 (C-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [2] x3 + Complexity [1] x2 + CrossModule [1] x1 + PaidUser [2] x1
- **Sprint:** 6
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (reads existing cr_fuel_logs data)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Fuel is the single largest ongoing cost of car ownership for most drivers. The existing MyCar Fuel tab lets users log fill-ups, but the data just sits there as a chronological list. Users have no way to see how their fuel costs trend over time, which stations give them the best prices, or what they should expect to spend next month. This feature transforms raw fuel log data into actionable cost intelligence without requiring any API calls or network access. V1 is a pure offline analytics layer over the user's own fill-up history, which aligns with MyLife's privacy-first approach and avoids the reliability issues of third-party fuel price APIs (GasBuddy has no public API; alternatives are expensive or unreliable).

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| GasBuddy | Yes | Partial (premium removes ads) | Community-reported real-time prices at 150K+ stations, map view, price alerts, rewards program, 29M active users |
| Waze | Yes | No (free) | Crowd-sourced prices reported by drivers, integrated into navigation, limited station detail |
| Gas Guru | Yes | No (free) | OPIS wholesale data feed, station map, price comparison by grade, no user-reported prices |
| CARFAX Car Care | No | N/A | No fuel price or cost analysis features |
| Simply Auto | Partial | Premium tier | Fuel cost statistics from user logs (average price, total spent), no external price data |
| Drivvo | Partial | Free tier | Fuel statistics from logs (cost per mile, average price), no external price feed |
| Fuelio | Partial | Free tier | Fuel cost stats, price per liter/gallon charts, station price map (limited regions) |

### Target User
Daily commuters and road trippers (25-55) who fill up 2-4 times per month and want to understand their fuel spending patterns. Users currently logging fill-ups in Simply Auto or Drivvo who want better cost analytics without switching to a separate app like GasBuddy. Also appeals to budget-conscious drivers who track expenses and want to see fuel costs alongside their MyBudget data. The switching value is moderate (2/5) because the analytics-only approach does not match GasBuddy's real-time crowd-sourced prices, but it serves users who value privacy and already log their fill-ups in MyCar.

## Technical Context

### Where This Lives in MyLife

```
modules/car/src/
  engines/fuel-price-engine.ts                -- NEW: price analytics, trend computation, station analysis, projections
  types.ts                                    -- New Zod schemas: FuelPriceStats, StationAnalysis, PriceTrend, FuelCostProjection
  index.ts                                    -- Re-export new types and engine functions
  __tests__/fuel-price-engine.test.ts         -- NEW: unit tests for fuel price engine

apps/mobile/app/(car)/
  fuel-prices.tsx                              -- NEW: Fuel Prices analytics screen
  components/
    PriceTrendChart.tsx                        -- NEW: Line chart for price over time
    StationCard.tsx                            -- NEW: Station analysis card

apps/web/app/car/
  fuel-prices/page.tsx                         -- NEW: Fuel Prices analytics web page
```

### Wireframe Position

```
Hub Dashboard
  └── MyCar card
       └── Fuel tab
            ├── Fuel log list (existing)
            └── "Fuel Insights" section ← YOU ARE HERE
                 ├── Average price per gallon (current month vs prior)
                 ├── Price trend chart (line chart, 6-12 months)
                 ├── Station analysis (cheapest, most used)
                 └── Monthly cost projection
```

The Fuel Prices analytics are accessible from:
1. A "Fuel Insights" section at the top of the existing Fuel tab (primary entry point, inline)
2. A "View Details" link in the Fuel Insights section that navigates to the full Fuel Prices screen
3. A quick-stat card on the MyCar Dashboard tab showing current average fuel price

### Data Model

No new tables required. This feature reads exclusively from the existing `cr_fuel_logs` table:

```sql
-- Existing table (no changes):
-- cr_fuel_logs (
--   id TEXT PRIMARY KEY,
--   vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
--   gallons REAL NOT NULL,
--   cost_cents INTEGER NOT NULL,
--   odometer_at INTEGER NOT NULL,
--   station TEXT,
--   is_full_tank INTEGER NOT NULL DEFAULT 1,
--   logged_at TEXT NOT NULL,
--   created_at TEXT NOT NULL DEFAULT (datetime('now'))
-- )
```

**Key computation:** Price per gallon = `cost_cents / gallons / 100` (convert cents to dollars).

No migration is needed. The engine operates purely on read queries against existing data.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for SQLite read queries), `@mylife/ui` (Cool Obsidian tokens, chart components), `@mylife/car` (FuelLog type, getFuelLogsByVehicle CRUD)
- **External:** `zod` (schema validation for engine outputs). No charting library dependency for V1; charts are built with SVG/Canvas primitives using existing UI patterns. If the codebase already uses a charting library (e.g., `victory-native` or `react-native-svg`), prefer that.
- **Cross-Module:** Optional future integration with MyBudget for auto-categorizing fuel expenses. Deferred to a cross-module sprint. No cross-module dependency in V1.

## Functional Requirements

### User Stories
1. As a daily commuter, I want to see my average fuel price per gallon over the last month so that I know whether gas prices are going up or down based on my actual fill-ups.
2. As a budget-conscious driver, I want to see a price trend chart over the past 6-12 months so that I can identify seasonal patterns in my fuel costs.
3. As a multi-station shopper, I want to see which gas stations I visit most often and which gives me the cheapest average price, so that I can make smarter fueling decisions.
4. As a household budget planner, I want a projected monthly fuel cost based on my driving patterns, so that I can forecast my car expenses.
5. As a multi-vehicle owner, I want to compare fuel costs across my vehicles so that I can see which car is more expensive to fuel.

### Behavior Specification

**Viewing fuel insights (inline on Fuel tab):**
1. User navigates to MyCar > Fuel tab.
2. At the top of the Fuel tab (above the existing fuel log list), the "Fuel Insights" section displays:
   - Current average price per gallon (based on last 30 days of logs)
   - Month-over-month change indicator (arrow up/down with percentage or cents change)
   - Mini sparkline showing price trend (last 6 fill-ups)
3. A "View Details" link navigates to the full Fuel Prices screen.
4. If the user has fewer than 2 fuel logs, the insights section shows: "Log a few fill-ups to see fuel price insights." No chart or stats are rendered.

**Viewing full Fuel Prices screen:**
1. User taps "View Details" or navigates to the Fuel Prices screen directly.
2. Top section: Summary stats cards in a horizontal scroll:
   - Average price/gallon (all time)
   - Average price/gallon (last 30 days)
   - Cheapest fill-up (price/gallon with station name and date)
   - Most expensive fill-up (price/gallon with station name and date)
   - Total fuel spend (all time, formatted as currency)
3. Middle section: Price Trend Chart
   - X-axis: time (months or fill-up dates depending on data density)
   - Y-axis: price per gallon (dollars)
   - Line chart with dots at each fill-up data point
   - Selectable range: 3 months, 6 months, 12 months, All Time
   - Average line overlay (dashed horizontal line at the average for the selected range)
4. Bottom section: Station Analysis
   - List of unique stations from fuel logs, sorted by average price (cheapest first)
   - Each station card shows: station name, number of visits, average price/gallon, total spent at that station
   - Stations without a name (null station field) are grouped as "Unknown Station"
5. Footer section: Monthly Cost Projection
   - Based on average gallons per month (from last 3 months of data) and current average price per gallon
   - Shows: "Estimated monthly fuel cost: $X.XX"
   - Shows: "Estimated annual fuel cost: $X,XXX.XX"

**Vehicle selector (multi-vehicle):**
1. If the user has multiple vehicles, a vehicle picker appears at the top of the Fuel Prices screen.
2. Options: individual vehicles by name, or "All Vehicles" (aggregated view).
3. Switching vehicles re-computes all stats and re-renders the chart.
4. In "All Vehicles" mode, the station analysis merges data across vehicles. The price trend chart shows separate lines per vehicle (color-coded by vehicle).

**Cost per mile calculation:**
1. If the user has at least 2 full-tank fill-ups for a vehicle, the engine calculates cost per mile:
   - Miles driven = odometer difference between consecutive full-tank fill-ups
   - Gallons used = gallons filled at the later fill-up
   - MPG = miles / gallons
   - Cost per mile = price per gallon / MPG
2. Displayed as an additional stat card: "Cost per mile: $0.XX"
3. If fewer than 2 full-tank fill-ups exist, this stat is omitted (not shown as "--" or "N/A").

### Edge Cases

- **No fuel logs:** Fuel Insights section shows: "Log your first fill-up to start tracking fuel costs." Fuel Prices screen shows empty state with illustration and CTA to add a fuel log.
- **Only 1 fuel log:** Summary stats show that single data point. Trend chart shows a single dot (no line). Month-over-month change shows "N/A" (not enough data). Cost per mile is not shown.
- **2-4 fuel logs:** Enough for basic stats and a short trend line. Month-over-month may still be "N/A" if all logs are in the same month.
- **All fuel logs have null station:** Station Analysis section shows a single entry: "Unknown Station" with aggregated stats. No sorting needed.
- **Same station with different spellings (e.g., "Shell", "SHELL", "Shell Gas"):** V1 treats these as separate stations (case-sensitive match). Known limitation documented. Future improvement: fuzzy matching.
- **Zero-cost fuel log (e.g., free charge for electric):** Price per gallon computes to $0.00. Included in averages (it is valid data). If fuel_type is "electric", label changes to "cost per kWh" in a future iteration (V1 always shows "per gallon").
- **Very old data (5+ years of logs):** "All Time" range may produce a dense chart. The chart component handles this by aggregating to monthly averages when data points exceed 50.
- **Vehicle with no fuel logs but other vehicles have data:** Vehicle picker still shows all vehicles. Selecting the empty vehicle shows the single-vehicle empty state.
- **Module disabled mid-view:** Screen unmounts normally. No crash. Computed data is not persisted (recalculated on each screen mount).
- **Currency formatting:** Uses the `currencyCode` setting from cr_settings (default "USD"). Formats using standard locale formatting.
- **Extremely high or low prices (e.g., $0.01/gal or $99.99/gal from data entry errors):** No filtering in V1. The user corrects their fuel log entries. The engine computes on whatever data exists.
- **Fuel type mismatch (diesel vs gas):** V1 does not separate price analytics by fuel type. All fuel logs for a vehicle are aggregated regardless of the vehicle's fuel_type. This is acceptable because most users have a single fuel type per vehicle.
- **Date range with no logs:** If the user selects "3 months" but has no logs in the last 3 months, show: "No fill-ups in this period. Try a longer range."

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** The Fuel tab shows a "Fuel Insights" section at the top with current average price per gallon and a month-over-month change indicator when the user has 2+ fuel logs.
- [ ] **AC-2:** A mini sparkline in the Fuel Insights section visualizes the price trend of the last 6 fill-ups.
- [ ] **AC-3:** Tapping "View Details" navigates to the full Fuel Prices screen.
- [ ] **AC-4:** The Fuel Prices screen shows summary stat cards: average price (all time), average price (30 days), cheapest fill-up, most expensive fill-up, and total fuel spend.
- [ ] **AC-5:** The Price Trend Chart displays a line chart with dots at each fill-up, with a selectable range (3mo, 6mo, 12mo, All Time).
- [ ] **AC-6:** Changing the chart range re-renders the chart with data filtered to the selected period.
- [ ] **AC-7:** A dashed average line overlays the trend chart showing the mean price for the selected range.
- [ ] **AC-8:** The Station Analysis section lists unique stations sorted by average price (cheapest first), each showing visit count, average price, and total spent.
- [ ] **AC-9:** Stations with null names are grouped under "Unknown Station."
- [ ] **AC-10:** The Monthly Cost Projection shows estimated monthly and annual fuel costs based on recent usage patterns.
- [ ] **AC-11:** With multiple vehicles, a vehicle picker appears. Selecting a different vehicle re-computes all stats and re-renders the chart.
- [ ] **AC-12:** "All Vehicles" mode shows aggregated stats and separate trend lines per vehicle (color-coded).
- [ ] **AC-13:** Cost per mile is displayed when at least 2 full-tank fill-ups exist.
- [ ] **AC-14:** With fewer than 2 fuel logs, the Fuel Insights section shows a prompt to log more fill-ups instead of stats.
- [ ] **AC-15:** With zero fuel logs, the Fuel Prices screen shows an empty state with illustration and CTA to add a fuel log.

### Technical Criteria
- [ ] **TC-1:** `getAveragePricePerGallon(vehicleId, dateRange?)` correctly computes the weighted average price per gallon (total cost / total gallons, not arithmetic mean of individual prices).
- [ ] **TC-2:** `getPriceTrend(vehicleId, months?)` returns an array of { date, pricePerGallon } entries sorted chronologically.
- [ ] **TC-3:** `getStationAnalysis(vehicleId)` returns station stats sorted by average price ascending, with null stations grouped as "Unknown Station."
- [ ] **TC-4:** `getCheapestStation(vehicleId, recentMonths?)` returns the station with the lowest average price per gallon within the specified period.
- [ ] **TC-5:** `getFuelCostProjection(vehicleId, milesPerMonth?)` returns monthly and annual projections based on average consumption rate and current average price.
- [ ] **TC-6:** `getCostPerMile(vehicleId)` correctly computes cost per mile from consecutive full-tank fill-ups (odometer delta / gallons / price).
- [ ] **TC-7:** All engine functions handle empty input (no fuel logs) gracefully, returning null or empty arrays rather than throwing.
- [ ] **TC-8:** All engine functions handle single-item input correctly (1 fuel log produces valid but limited results).
- [ ] **TC-9:** Price computations use proper floating-point handling (cents-based integers divided by gallons, then divided by 100 for display).
- [ ] **TC-10:** Chart data aggregation for "All Time" with 50+ data points groups into monthly averages to prevent chart overcrowding.
- [ ] **TC-11:** No new tables are created. No migrations are run. The feature reads existing cr_fuel_logs data only.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** This feature must NOT create any new database tables or run any migrations.
- [ ] **NC-2:** This feature must NOT make any network calls or API requests. All computation is on-device from local fuel log data.
- [ ] **NC-3:** This feature must NOT modify existing fuel log records. It is read-only over cr_fuel_logs.
- [ ] **NC-4:** Price computations must NOT use simple arithmetic mean of individual price-per-gallon values. Must use weighted average (total cost / total gallons) for accuracy.
- [ ] **NC-5:** The empty state must NOT show broken charts or "NaN" values. All visual elements degrade gracefully to text prompts when data is insufficient.
- [ ] **NC-6:** Vehicle switching must NOT retain stale data from the previous vehicle's analysis. All stats re-compute on selection change.
- [ ] **NC-7:** The Station Analysis must NOT crash or show errors when all station fields are null. The "Unknown Station" grouping must handle this case.

## UI Specification

### Mobile (Expo)

**Fuel Insights Section (inline on Fuel tab, above log list):**
- Background: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Layout: horizontal row
  - Left: large text average price (e.g., "$3.45/gal"), accent color (`#6366F1`) text
  - Right: change indicator - green arrow up (`#30D158`) or red arrow down (`#FF453A`) with cents change text
- Below row: mini sparkline (40px height, accent color line, no axis labels)
- "View Details >" link in `textSecondary` color, right-aligned

**Fuel Prices Full Screen:**
- Background: `#0A0A0F` (background token)
- Module accent: `#6366F1` (indigo)

**Summary Stat Cards (horizontal ScrollView):**
- Cards: `rgba(255,255,255,0.04)` glass, `rgba(255,255,255,0.10)` border, borderRadius 12
- Each card ~140px wide, stacked vertically: label (textSecondary, fontSize 12), value (text color, fontSize 20, fontWeight 700), subtitle (textSecondary, fontSize 11)
- Cards: "Avg Price", "30-Day Avg", "Cheapest", "Most Expensive", "Total Spent", "Cost/Mile" (if available)

**Price Trend Chart:**
- Chart area: 100% width, 220px height
- Background: transparent (sits on page background)
- Line: 2px stroke, accent color (`#6366F1`)
- Data points: 6px circles, accent color fill, white stroke
- Average line: 1px dashed, `rgba(255,255,255,0.3)`
- Y-axis labels: price values in textSecondary
- X-axis labels: month abbreviations in textSecondary
- Range selector: segmented control above chart (3mo | 6mo | 12mo | All), glass background pills, accent background for selected

**Station Analysis Cards:**
- Section header: "Your Stations" in text color, fontSize 18, fontWeight 600
- Cards: glass background, full width, vertical stack
  - Station name (text color, fontSize 16, fontWeight 600)
  - Row: "X visits" (textSecondary) | "Avg $X.XX/gal" (accent color) | "Total $X.XX" (textSecondary)
- Cheapest station badge: small "Best Price" pill in `#30D158` background, positioned at top-right of card

**Monthly Projection Card:**
- Glass background card, full width
- "Monthly Estimate" header (textSecondary)
- Large value: "$XXX.XX/mo" in text color, fontWeight 700
- Subtitle: "~$X,XXX/yr based on your last 3 months" in textSecondary

**Empty States:**
- No fuel logs: centered fuel pump icon (muted), "Start tracking fuel costs" heading, "Log your first fill-up to see price insights, trends, and station analysis." body text, "Log a Fill-Up" button in accent color
- Insufficient data (1 log): partial stats shown, chart area shows single dot with text "More fill-ups needed for trend analysis"
- No data in selected range: "No fill-ups in this period" centered text, "Try a longer range" subtitle

### Web (Next.js)

- Route: `/car/fuel-prices`
- Same tokens via CSS variables
- Layout: sidebar navigation (existing), main content area
- Summary stat cards in a CSS grid (3 columns on desktop, 2 on tablet, 1 on mobile)
- Price trend chart uses SVG (or canvas) with the same visual spec as mobile
- Station analysis as a table with sortable columns (name, visits, avg price, total spent)
- Range selector as tab buttons above the chart
- Vehicle picker as a dropdown in the page header area
- Charts use `backdrop-filter: blur(16px)` glass morphism containers

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton stat cards (5) and skeleton chart area with pulsing animation | Initial data fetch from SQLite |
| Empty (no vehicles) | "Add a vehicle to track fuel costs" + CTA button | No vehicles in cr_vehicles |
| Empty (no fuel logs) | Fuel pump icon, "Start tracking fuel costs" heading, "Log a Fill-Up" CTA | Vehicle exists but no fuel logs |
| Insufficient (1 log) | Partial stats (single data point values), chart with 1 dot, "More fill-ups needed" | Only 1 fuel log exists |
| Success (basic) | All stats, trend chart with line, station list | 2+ fuel logs with varied stations |
| Success (rich) | Full stats including cost/mile, multi-month trend, ranked stations, projections | 10+ fuel logs across months with full-tank fills |
| Multi-vehicle | Vehicle picker visible, stats scoped to selected vehicle | 2+ vehicles in cr_vehicles |
| Range empty | "No fill-ups in this period" with suggestion to try longer range | Selected date range has no fuel logs |
| Error | "Something went wrong loading fuel data" + retry button | SQLite read failure (rare) |

## Test Requirements

### Unit Tests (modules/car/src/__tests__/fuel-price-engine.test.ts)
- [ ] `getAveragePricePerGallon`: returns weighted average (total cost / total gallons) not arithmetic mean
- [ ] `getAveragePricePerGallon`: handles single fuel log correctly
- [ ] `getAveragePricePerGallon`: returns null when no fuel logs exist
- [ ] `getAveragePricePerGallon`: filters by date range when provided
- [ ] `getAveragePricePerGallon`: handles zero-gallon edge case (returns null, no division by zero)
- [ ] `getPriceTrend`: returns entries sorted chronologically (oldest first)
- [ ] `getPriceTrend`: filters to specified month range
- [ ] `getPriceTrend`: returns empty array when no logs exist
- [ ] `getPriceTrend`: aggregates to monthly averages when data points exceed 50
- [ ] `getPriceTrend`: handles logs all in the same month (returns single aggregated point)
- [ ] `getStationAnalysis`: sorts stations by average price ascending
- [ ] `getStationAnalysis`: groups null-station logs under "Unknown Station"
- [ ] `getStationAnalysis`: returns empty array when no logs exist
- [ ] `getStationAnalysis`: correctly computes visit count, average price, and total spent per station
- [ ] `getStationAnalysis`: handles single-station dataset (one entry in result)
- [ ] `getCheapestStation`: returns station with lowest average price
- [ ] `getCheapestStation`: returns null when no logs exist
- [ ] `getCheapestStation`: filters by recent months when specified
- [ ] `getFuelCostProjection`: projects monthly cost from last 3 months of average consumption
- [ ] `getFuelCostProjection`: returns null when fewer than 2 logs exist
- [ ] `getFuelCostProjection`: annual projection is 12x monthly projection
- [ ] `getCostPerMile`: computes correctly from 2 consecutive full-tank fill-ups
- [ ] `getCostPerMile`: returns null when fewer than 2 full-tank fill-ups exist
- [ ] `getCostPerMile`: uses only full-tank fill-ups (ignores partial fills)
- [ ] `getCostPerMile`: handles descending odometer (data entry error) by skipping that pair
- [ ] `getMonthOverMonthChange`: returns positive cents change when current month is more expensive
- [ ] `getMonthOverMonthChange`: returns negative cents change when current month is cheaper
- [ ] `getMonthOverMonthChange`: returns null when insufficient data for comparison (no logs in prior month)

### Integration Tests
- [ ] Full flow: create vehicle, add 10 fuel logs across 3 months with varied stations, verify all engine functions return correct computed values
- [ ] Full flow: multi-vehicle scenario, verify stats are correctly scoped per vehicle and aggregated in "All Vehicles" mode
- [ ] Full flow: delete all fuel logs for a vehicle, verify all engine functions return null/empty gracefully
- [ ] Edge flow: all fuel logs have null station field, verify station analysis returns single "Unknown Station" entry
- [ ] Edge flow: single fuel log, verify partial stats display and no chart rendering errors

### QA Verification Script

1. Open the app on iOS/Android simulator.
2. Navigate to MyCar module. Ensure a vehicle exists.
3. Navigate to Fuel tab. Verify the Fuel Insights section is NOT visible (no fuel logs yet). -- Corresponds to AC-14.
4. Add 1 fuel log: 10 gallons, $35.00 ($3.50/gal), station "Shell", 50000 miles.
5. Return to Fuel tab. Verify the Fuel Insights section shows limited data: "$3.50/gal" average, no sparkline (need 2+ points), no month-over-month change. -- Corresponds to AC-14 partial.
6. Add 5 more fuel logs over the past 3 months with varied stations ("Shell" x2, "Costco" x2, "BP" x1, null x1) and varied prices ($3.20-$3.80/gal).
7. Return to Fuel tab. **Verify:** Fuel Insights section shows average price, month-over-month change arrow, and mini sparkline. -- Corresponds to AC-1, AC-2.
8. Tap "View Details." -- Corresponds to AC-3.
9. **Verify:** Fuel Prices screen loads with summary stat cards (Avg Price, 30-Day Avg, Cheapest, Most Expensive, Total Spent). -- Corresponds to AC-4.
10. **Verify:** Price Trend Chart shows a line with dots at each fill-up. -- Corresponds to AC-5.
11. Tap "3mo" range selector. **Verify:** Chart re-renders showing only last 3 months of data. -- Corresponds to AC-6.
12. Tap "All Time" range selector. **Verify:** Chart shows all data with dashed average line. -- Corresponds to AC-5, AC-7.
13. Scroll to Station Analysis section. **Verify:** Stations listed, sorted by cheapest first. Each shows visit count, avg price, total spent. -- Corresponds to AC-8.
14. **Verify:** The null-station logs appear as "Unknown Station." -- Corresponds to AC-9.
15. **Verify:** The cheapest station has a "Best Price" badge. -- Visual verification.
16. Scroll to Monthly Projection. **Verify:** Monthly and annual estimates are shown. -- Corresponds to AC-10.
17. Add a second vehicle. Add 3 fuel logs for the second vehicle.
18. Return to Fuel Prices screen. **Verify:** Vehicle picker is visible. -- Corresponds to AC-11.
19. Select the second vehicle. **Verify:** All stats re-compute for the second vehicle. -- Corresponds to AC-11.
20. Select "All Vehicles." **Verify:** Aggregated stats and multi-line chart (one line per vehicle, different colors). -- Corresponds to AC-12.
21. Add 2 more full-tank fill-ups for the first vehicle (to get 2+ full-tank fills).
22. Select the first vehicle. **Verify:** "Cost/Mile" stat card appears. -- Corresponds to AC-13.
23. Delete all fuel logs for the first vehicle.
24. Select the first vehicle. **Verify:** Empty state with fuel pump icon and "Log a Fill-Up" CTA. -- Corresponds to AC-15.
25. Open web at `/car/fuel-prices`. **Verify:** Same stats, chart, and station table render correctly. -- Web parity check.
26. **Verify:** Station analysis on web is a sortable table. Click column headers to sort. -- Web-specific.
27. Select a date range with no data. **Verify:** "No fill-ups in this period" message appears. -- Edge case.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 9 (Complexity raw score 1, Large):

### Required for ALL features:
- [ ] `/function-gate-runner` - run after code changes, must pass
- [ ] `/review` - run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` - navigate to `/car/fuel-prices`, click every button, verify all states (loading, empty-no-vehicles, empty-no-logs, insufficient, success-basic, success-rich, multi-vehicle, range-empty, error)
- [ ] Batch QA: after 5 features in car module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` - run on this spec BEFORE building. Fix issues found.

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` - generate eval suite for `fuel-price-engine.ts` (getAveragePricePerGallon, getPriceTrend, getStationAnalysis, getCheapestStation, getFuelCostProjection, getCostPerMile, getMonthOverMonthChange)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` - car module has active standalone counterpart (MyCar/)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Car module has a Fuel tab that shows a chronological list of fuel log entries
- The cr_fuel_logs table has data (if the user has been logging fill-ups) but no analytics layer over it
- No computed fuel statistics, trends, station analysis, or cost projections exist
- The FuelLog type and getFuelLogsByVehicle CRUD are already implemented and exported
- Schema version 2 with 5 tables. No migration changes needed for this feature.

### After This Work
- A "Fuel Insights" section appears inline on the Fuel tab with average price, change indicator, and sparkline
- A dedicated Fuel Prices screen provides deep analytics: summary stats, price trend chart, station analysis, monthly projections
- `fuel-price-engine.ts` contains pure functions for all price analytics computations
- Multi-vehicle support with vehicle picker and per-vehicle or aggregated views
- Cost per mile calculation from full-tank fill-up pairs
- No schema changes, no new tables, no migrations

### Files Changed

- `modules/car/src/engines/fuel-price-engine.ts` - NEW: getAveragePricePerGallon, getPriceTrend, getStationAnalysis, getCheapestStation, getFuelCostProjection, getCostPerMile, getMonthOverMonthChange
- `modules/car/src/types.ts` - Add FuelPriceStatsSchema, StationAnalysisSchema, PriceTrendPointSchema, FuelCostProjectionSchema, CostPerMileSchema Zod schemas and types
- `modules/car/src/index.ts` - Re-export new types and engine functions
- `modules/car/src/__tests__/fuel-price-engine.test.ts` - NEW: 28+ unit tests for fuel price engine
- `apps/mobile/app/(car)/fuel-prices.tsx` - NEW: Fuel Prices analytics screen
- `apps/mobile/app/(car)/components/PriceTrendChart.tsx` - NEW: SVG line chart component for price trend
- `apps/mobile/app/(car)/components/StationCard.tsx` - NEW: Station analysis card component
- `apps/mobile/app/(car)/expenses.tsx` - MODIFIED: add Fuel Insights section at top of existing Fuel tab (or wherever the fuel log list currently renders)
- `apps/web/app/car/fuel-prices/page.tsx` - NEW: Fuel Prices analytics web page

### Known Limitations
- V1 has no external fuel price API integration. All data comes from the user's own fuel logs. Users cannot see prices at stations they have not visited.
- Station name matching is case-sensitive and exact. "Shell" and "SHELL" are treated as different stations. Fuzzy matching is deferred to a future iteration.
- No map visualization of stations in V1. Station analysis is list/table-based only.
- The price trend chart is simple (line + dots). Candlestick charts, area fills, or advanced visualizations are deferred.
- Electric vehicle "fuel" costs are not specially handled. The "per gallon" label is always used even for EVs. Fuel type-aware labels are a future enhancement.
- No export capability (CSV/PDF) for fuel price analytics in V1.
- Cost per mile requires at least 2 full-tank fill-ups. Partial fills cannot be used for MPG calculation because the actual fuel consumed is unknown.

### Context for Next Agent
- The `getFuelLogsByVehicle` function in `db/crud.ts` returns logs sorted by `logged_at DESC`. The fuel price engine may need to re-sort chronologically (ASC) for trend computation, or add a new query with ASC ordering.
- `cost_cents` is stored as an integer (cents). Always divide by 100 for display. Divide by `gallons` for price per gallon. Use `cost_cents / gallons / 100` (not `cost_cents / 100 / gallons`) to maintain precision.
- The `station` field is nullable TEXT. Many users may not fill in the station name. The engine must handle null stations gracefully, and the Station Analysis must explicitly group them.
- The weighted average price computation is important: `SUM(cost_cents) / SUM(gallons) / 100` is correct. An arithmetic mean of individual `cost_cents/gallons` values would be wrong because fill-ups have different volumes.
- For the inline "Fuel Insights" section on the Fuel tab, the implementation should be lightweight (a single component inserted above the existing fuel log list). Do not restructure the entire Fuel tab layout.
- If adding a chart library as a new dependency, discuss with the user first. Prefer lightweight options (`react-native-svg` for mobile, plain SVG for web) over heavy charting libraries.
- The "All Vehicles" multi-line chart requires assigning consistent colors per vehicle. Use each vehicle's accent or a preset palette. Do not use the module accent (`#6366F1`) for all lines.
