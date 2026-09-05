# Feature Spec: Reports/Charts Dashboard

## Metadata
- **Module:** budget
- **Priority Score:** 35 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 4 x3 + Complexity 2 x2 + CrossModule 2 x1 + PaidUser 5 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (reporting engine and net worth engine already exist in modules/budget/src/engine/)
- **Blocks:** Investment tracking (P1), ML auto-categorization (P2), Family sharing reports (P2)

> **Note:** A Sprint 1 spec for this feature exists at `docs/plans/features/sprint-1/budget-reports-dashboard.md` (score 39/50, with Market 5 x3 + Switching 4 x3 + Complexity 3 x2). The Sprint 1 spec was written with an earlier scoring pass. This Sprint 2 spec supersedes it with the final scored-backlog values (35/50) and adds subscription cost integration, income vs expense analysis, and savings rate tracking that the Sprint 1 spec deferred. The Sprint 1 spec remains as reference for the core chart implementation. This spec adds the features that make the reports dashboard complete.

## Business Context

### Why This Feature Exists
Visual reports and charts are the #1 reason users pay for budgeting apps. YNAB ($109/yr), Monarch Money ($99.99/yr), and Copilot ($119.88/yr) all lead with their reporting dashboards in marketing materials. MyLife already has a fully tested reporting engine (6 functions across 2 engine files) but no UI to display the results. The engine handles: spending by category, monthly trends, budget vs actual, top payees, net worth calculation, and net worth timeline. Building the UI is a rendering exercise, not an engineering one. The Sprint 1 spec covers the core 4-tab report view. This spec extends it with: (1) income vs expense analysis using the income estimator engine, (2) subscription cost overlay on spending charts, (3) savings rate calculator, and (4) exportable report summaries.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| YNAB | Yes | Yes ($109/yr) | Spending by category (donut), income vs expense, net worth trend, age of money. Filterable by date range and account. Export to CSV. |
| Monarch Money | Yes | Yes ($99.99/yr) | Rich interactive charts, spending breakdown, cash flow, net worth, investment performance. Custom date ranges. PDF export. |
| Copilot | Yes | Yes ($119.88/yr) | Premium chart design, spending trends, category breakdowns, income tracking. Real-time updates. |
| Rocket Money | Yes | Yes ($48-144/yr) | Spending by category, bill tracking, net worth. Simpler charts. Subscription cost highlighting. |
| PocketGuard | Yes | Yes ($74.99/yr) | "In My Pocket" summary, spending by category, recurring bills overview. |

### Target User
YNAB and Monarch Money users paying $100+/yr who want the same visual spending analysis but at $5/yr with no cloud dependency. Power budgeters who want to answer: "Where is my money going?", "Am I staying within budget?", "What's my savings rate?", and "How much do subscriptions cost me?" without exporting to a spreadsheet.

## Technical Context

### Where This Lives in MyLife

```
modules/budget/src/engine/
  reporting.ts              -- ALREADY EXISTS: getSpendingByCategory, getMonthlySpendingTrend, getBudgetedVsSpent, getTopPayees
  net-worth.ts              -- ALREADY EXISTS: calculateNetWorth, buildNetWorthTimeline, captureSnapshot
  net-cash.ts               -- ALREADY EXISTS: calculateNetCash, calculateCashFlowByPeriod, calculateRunningBalance
  income-estimator.ts       -- ALREADY EXISTS: classifyIncomePattern, detectIncomeStreams, estimateMonthlyIncome
  report-helpers.ts         -- NEW: Chart data prep, color palettes, date range presets, savings rate, "Other" bucket
apps/mobile/app/(budget)/
  reports.tsx               -- NEW: Mobile reports tab (tab key 'reports' already in module nav)
apps/web/app/budget/
  reports/page.tsx          -- NEW: Web reports page
  actions.ts                -- MODIFY: Add report-fetching server actions
```

### Wireframe Position

```
Hub Dashboard
  └── MyBudget card
       ├── Budget tab
       ├── Transactions tab
       ├── Subscriptions tab
       ├── Reports tab           ← YOU ARE HERE
       └── Accounts tab
```

Reports tab contains 5 sub-tabs: Overview | Spending | Budget vs Actual | Income & Savings | Net Worth

### Data Model
No new tables or schema changes. This feature is read-only, consuming existing data through engine functions.

```
Existing tables used:
  bg_envelopes              -- Category names, monthly budgets
  bg_transactions           -- All transactions (amount, direction, envelope_id, merchant, occurred_on)
  bg_transaction_splits     -- Split transactions for multi-category reporting
  bg_budget_allocations     -- Per-envelope per-month allocations
  bg_accounts               -- Account balances and types for net worth
  bg_net_worth_snapshots    -- Historical net worth snapshots
  bg_subscriptions          -- Active subscriptions for cost overlay

Existing engine functions:
  reporting.ts:
    getSpendingByCategory(transactions, splits, categories, range)     -> CategorySpending[]
    getMonthlySpendingTrend(transactions, range)                       -> MonthlySpendingPoint[]
    getBudgetedVsSpent(allocations, transactions, splits, categories, range) -> BudgetVsSpentRow[]
    getTopPayees(transactions, range, limit)                           -> TopPayee[]

  net-worth.ts:
    calculateNetWorth(accounts)                                        -> NetWorthResult
    buildNetWorthTimeline(snapshots)                                   -> NetWorthTimelinePoint[]

  net-cash.ts:
    calculateNetCash(transactions)                                     -> NetCashResult
    calculateCashFlowByPeriod(transactions, periodType)                -> CashFlowPeriod[]

  income-estimator.ts:
    estimateMonthlyIncome(transactions)                                -> IncomeEstimate

  subscriptions/cost.ts:
    calculateSubscriptionSummary(subscriptions)                        -> SubscriptionCostSummary
```

### Dependencies
- **Internal:** `@mylife/budget` (all engine files above), `@mylife/db` (DatabaseAdapter)
- **External:** `victory-native` for mobile charts (Expo-safe, SVG-based), `recharts` for web charts (React standard, lightweight). Both use similar data format patterns.
- **Cross-Module:** Subscription cost data from the subscriptions engine is integrated into spending analysis. No other module dependencies.

## Functional Requirements

### User Stories
1. As a budget user, I want to see a pie/donut chart of my spending by category so I can identify where my money goes.
2. As a budget user, I want to see my spending trend over time so I can tell if I'm spending more or less month over month.
3. As a budget user, I want to compare my budget vs actual spending per envelope so I can see which categories are over or under budget.
4. As a budget user, I want to see my net worth trend so I can track whether I'm building or losing wealth.
5. As a budget user, I want to see income vs expenses side by side so I can understand my cash flow.
6. As a budget user, I want to see my savings rate so I can track what percentage of income I'm keeping.
7. As a budget user, I want to see how much my subscriptions cost as a portion of my total spending.
8. As a budget user, I want to filter all reports by date range so I can analyze any time period.
9. As a budget user, I want to see my top merchants so I can identify recurring spending patterns.

### Behavior Specification

**Navigating to reports:**
1. User taps "Reports" tab (mobile) or clicks "Reports" in nav (web).
2. Reports page loads with the current month as the default date range.
3. Page shows a date range picker at the top (presets: This Month, Last Month, Last 3 Months, Last 6 Months, This Year, All Time, Custom).
4. Below the picker, a horizontal scrollable tab bar shows: Overview, Spending, Budget vs Actual, Income & Savings, Net Worth.
5. Default sub-tab: Overview.

**Overview sub-tab:**
1. Summary row: Total Income | Total Spent | Net (income - expenses) | Savings Rate %
2. Spending by Category donut chart (top 6 categories + "Other")
3. Subscription cost callout: "Subscriptions: $X/mo (Y% of spending)"
4. Top 5 Merchants list

**Spending sub-tab:**
1. Spending by Category donut/pie chart (all categories, tappable segments)
2. Category breakdown table (name, amount, % of total, transaction count)
3. Monthly Spending Trend line chart
4. Tapping a donut segment filters the trend chart to that category only

**Budget vs Actual sub-tab:**
1. Horizontal bar chart: each envelope shows budgeted (full bar) vs spent (filled portion)
2. Color coding: green (<80%), yellow (80-100%), red (>100%)
3. Sortable table: envelope name, budgeted, spent, remaining, % used

**Income & Savings sub-tab (NEW beyond Sprint 1 spec):**
1. Income vs Expense bar chart: side-by-side bars per month (green = income, red = expenses)
2. Savings rate line chart: monthly savings rate % over time
3. Current savings rate callout (large number)
4. Detected income streams list (from income estimator): payee, frequency, monthly estimate, confidence
5. Cash flow summary: inflows, outflows, net cash for the selected range

**Net Worth sub-tab:**
1. Net worth line chart showing historical trend
2. Current breakdown: Total Assets | Total Liabilities | Net Worth
3. Account list grouped by type (assets vs liabilities) with individual balances

**Date range filtering:**
1. Changing the date range re-fetches data for all sub-tabs.
2. Preset buttons provide quick selection.
3. Custom range shows two date pickers (start, end).
4. Invalid range (start > end) is prevented by the picker.
5. "All Time" uses the earliest transaction date as start.

**Chart interactions:**
1. Tapping/hovering a chart element shows a tooltip with the exact value.
2. Donut chart segments are tappable (mobile) / hoverable (web).
3. Line charts show data points on hover/tap.
4. Bar charts show exact values on hover/tap.

### Edge Cases

- **No transactions in range:** Show empty chart areas with message "No spending data for this period." No errors.
- **Single transaction only:** Charts render with a single data point. Line chart shows a dot, not a line.
- **No envelopes set up:** Budget vs Actual tab shows "Create envelopes first to see budget comparisons" with CTA.
- **No net worth snapshots:** Net Worth tab shows current calculation only with "Track your net worth over time by logging snapshots monthly."
- **All income, no expenses:** Spending charts empty. Overview shows 100% savings rate. Income & Savings shows only income bars.
- **All expenses, no income:** Income bars empty. Savings rate shows 0% (or negative indicator).
- **No subscriptions:** Subscription cost callout hidden on Overview.
- **Date range spanning years:** Line chart groups by month. Large datasets handled by engine.
- **Module disabled mid-view:** UI unmounts cleanly.
- **Very long category names:** Truncate in chart labels with ellipsis. Full name in tooltip.
- **Currency formatting:** All amounts in cents internally, displayed as dollars with 2 decimal places and commas.
- **Zero income for savings rate:** Savings rate = 0% (not division by zero error).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Reports tab/page loads within 2 seconds with the current month's data
- [ ] **AC-2:** Spending by Category donut chart renders with correct proportions for each envelope
- [ ] **AC-3:** Changing date range to "Last 3 Months" updates all charts with new data
- [ ] **AC-4:** Monthly Spending Trend line chart shows one point per month with correct totals
- [ ] **AC-5:** Budget vs Actual bar chart shows budgeted vs spent with correct color coding (green/yellow/red)
- [ ] **AC-6:** Net Worth trend line chart shows historical data points with change amounts
- [ ] **AC-7:** Top Merchants list shows correct spending totals sorted by amount
- [ ] **AC-8:** Tapping a donut segment highlights it and shows a tooltip with category name + amount
- [ ] **AC-9:** Overview shows correct Total Income, Total Spent, Net, and Savings Rate %
- [ ] **AC-10:** Custom date range picker allows selecting arbitrary start and end dates
- [ ] **AC-11:** Reports render correctly on both mobile (Expo) and web (Next.js)
- [ ] **AC-12:** Empty state shows warm CTA message when no data exists for the selected range
- [ ] **AC-13:** Income & Savings sub-tab shows income vs expense bars per month
- [ ] **AC-14:** Savings rate line chart shows monthly savings rate % over time
- [ ] **AC-15:** Detected income streams list shows payee, frequency, and monthly estimate
- [ ] **AC-16:** Subscription cost callout on Overview shows monthly sub cost and % of total spending
- [ ] **AC-17:** "All Time" date range preset works and shows data from the earliest transaction

### Technical Criteria
- [ ] **TC-1:** Reports page calls existing engine functions without duplicating logic
- [ ] **TC-2:** Net worth chart uses buildNetWorthTimeline from existing engine
- [ ] **TC-3:** Income & Savings uses estimateMonthlyIncome and calculateNetCash from existing engines
- [ ] **TC-4:** Subscription overlay uses calculateSubscriptionSummary from existing engine
- [ ] **TC-5:** Date range filtering is applied server-side, not client-side filtering
- [ ] **TC-6:** Chart rendering does not block the main thread
- [ ] **TC-7:** All amounts display correctly in dollars with proper comma formatting
- [ ] **TC-8:** report-helpers.ts contains pure functions for chart data prep (tested independently)
- [ ] **TC-9:** Savings rate = (income - expenses) / income * 100, returns 0 when income is 0

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Reports must NOT duplicate the reporting engine logic
- [ ] **NC-2:** Reports must NOT fetch all transactions at once for large datasets
- [ ] **NC-3:** Chart library must NOT bundle >100KB gzipped on web
- [ ] **NC-4:** Reports must NOT modify any data (read-only view)
- [ ] **NC-5:** Donut chart must NOT render more than 8 segments (top 7 + "Other")
- [ ] **NC-6:** Savings rate must NOT show division-by-zero errors

## UI Specification

### Mobile (Expo)

Reports tab defined in module nav: `{ key: 'reports', label: 'Reports', icon: 'pie-chart' }`.

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.06)` border
- Module accent: `#22C55E` (green, budget module)
- Chart color palette: `['#22C55E', '#3B82F6', '#F97316', '#8B5CF6', '#EF4444', '#06B6D4', '#F59E0B', '#64748B']`

Layout:
```
[Date range picker bar -- horizontal scroll]
  [This Month] [Last Month] [3 Mo] [6 Mo] [Year] [All] [Custom]

[Sub-tab bar -- horizontal scroll]
  [Overview] [Spending] [Budget vs Actual] [Income & Savings] [Net Worth]

[Chart area -- scrollable content]
  (content depends on selected sub-tab)
```

Charts use `victory-native` for SVG rendering. Touch interactions: tap segment for tooltip.

### Web (Next.js)

Reports page at `/budget/reports`. Uses `recharts` for chart rendering.

- Same Cool Obsidian tokens via CSS variables
- Charts use dark theme: transparent backgrounds, white/light labels, accent-colored data series
- Responsive: single column on mobile, side-by-side charts on desktop (>1024px)
- Date range picker renders as a flex row of pill buttons with custom date inputs

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton chart placeholders (pulsing rectangles) | Initial data fetch or date range change |
| Empty (no data) | Glass card: "No spending data for this period" + CTA | No transactions in range |
| Empty (no envelopes) | "Create envelopes first" card + CTA on Budget vs Actual | No envelopes exist |
| Empty (no snapshots) | Current net worth + "Log monthly snapshots" on Net Worth | No snapshots |
| Error | "Something went wrong" + retry button | Computation or fetch fails |
| Success | Charts rendered with data, tooltips functional | Data loaded |
| Partial | Some sub-tabs have data, others show empty state | e.g., transactions but no snapshots |

## Test Requirements

### Unit Tests
- [ ] `report-helpers.ts`: assignChartColors maps categories to fixed palette positions
- [ ] `report-helpers.ts`: bucketizeCategories groups categories beyond top 7 into "Other"
- [ ] `report-helpers.ts`: calculateSavingsRate returns correct % for income > 0
- [ ] `report-helpers.ts`: calculateSavingsRate returns 0 for zero income
- [ ] `report-helpers.ts`: getDateRangePreset("thisMonth") returns correct start/end for current month
- [ ] `report-helpers.ts`: getDateRangePreset("lastYear") returns Jan 1 to Dec 31 of previous year
- [ ] `report-helpers.ts`: getDateRangePreset("allTime") returns earliest transaction date as start
- [ ] `report-helpers.ts`: formatCentsAsDollars handles negative, zero, and large values correctly
- [ ] Existing engine tests: verify no regression on getSpendingByCategory, getMonthlySpendingTrend, getBudgetedVsSpent, getTopPayees

### Integration Tests
- [ ] Full flow: add 5 transactions across 3 envelopes -> open Reports -> spending chart shows 3 segments
- [ ] Income & Savings: add 3 income + 5 expense transactions -> savings rate shows correct %
- [ ] Subscription overlay: add 2 active subscriptions -> Overview shows subscription cost callout
- [ ] Date range: change from "This Month" to "Last 3 Months" -> charts update
- [ ] Empty: no transactions -> all charts show empty states
- [ ] Net worth: 3 monthly snapshots -> trend shows 3 points

### QA Verification Script

1. Open the app on [iOS / web]
2. Navigate to MyBudget > Reports tab
3. Verify: Date range defaults to current month -- AC-1
4. Verify: Overview shows Total Income, Total Spent, Net, Savings Rate -- AC-9
5. Verify: Spending donut chart shows categories -- AC-2
6. Verify: Subscription cost callout shows monthly sub cost -- AC-16
7. Verify: Top Merchants list shows 5 merchants -- AC-7
8. Tap "Spending" sub-tab
9. Verify: Category breakdown with donut + table
10. Tap a donut segment
11. Verify: Tooltip with category name and amount -- AC-8
12. Scroll down, verify monthly trend chart -- AC-4
13. Tap "Budget vs Actual"
14. Verify: Horizontal bars with color coding (green/yellow/red) -- AC-5
15. Tap "Income & Savings"
16. Verify: Income vs expense bars per month -- AC-13
17. Verify: Savings rate line chart -- AC-14
18. Verify: Detected income streams list -- AC-15
19. Tap "Net Worth"
20. Verify: Net worth trend line chart -- AC-6
21. Change date range to "Last 3 Months"
22. Verify: All charts update -- AC-3
23. Change to "All Time"
24. Verify: Charts show full history -- AC-17
25. Change to "Custom", enter 2-week range
26. Verify: Charts reflect only that window -- AC-10
27. Delete all transactions (or use empty account)
28. Verify: Empty state messages appear -- AC-12
29. Verify on web at /budget/reports -- AC-11

## gstack Quality Gates

Based on Complexity score 2 (Large), these gates are required:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required for Large features (Complexity <= 2):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature has UI:
- [ ] `/browse` -- navigate to /budget/reports, click each sub-tab, verify all chart states
- [ ] After 5 features in budget module: `/qa` on /budget

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- budget standalone is archived, N/A
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Reporting engine: 4 functions in `modules/budget/src/engine/reporting.ts`.
- Net worth engine: 3 functions in `modules/budget/src/engine/net-worth.ts`.
- Net cash engine: 3 functions in `modules/budget/src/engine/net-cash.ts`.
- Income estimator: 3 functions in `modules/budget/src/engine/income-estimator.ts`.
- Subscription cost: `calculateSubscriptionSummary` in `modules/budget/src/subscriptions/cost.ts`.
- Module nav declares a "reports" tab. Web `/budget/reports` falls through to catch-all.
- No charting libraries installed. No report UI exists.
- 176 tests across 15 files.

### After This Work
- `modules/budget/src/engine/report-helpers.ts` -- NEW: chart data prep, color palette, date presets, savings rate, "Other" bucket, dollar formatting.
- `apps/mobile/app/(budget)/reports.tsx` -- NEW: Mobile reports screen with 5 sub-tabs.
- `apps/web/app/budget/reports/page.tsx` -- NEW: Web reports page.
- `apps/web/app/budget/actions.ts` -- MODIFIED: report-fetching server actions.
- `victory-native` added to mobile, `recharts` added to web.
- Tests cover report-helpers and date range presets.

### Files Changed
- `modules/budget/src/engine/report-helpers.ts` -- NEW: Data prep functions (colors, buckets, savings rate, date presets, formatting)
- `modules/budget/src/engine/__tests__/report-helpers.test.ts` -- NEW: Unit tests for helpers
- `apps/mobile/app/(budget)/reports.tsx` -- NEW: Mobile reports with victory-native
- `apps/web/app/budget/reports/page.tsx` -- NEW: Web reports with recharts
- `apps/web/app/budget/actions.ts` -- MODIFY: Add fetchReportData, fetchIncomeAnalysis, fetchNetWorthTimeline
- `apps/mobile/package.json` -- MODIFY: Add victory-native
- `apps/web/package.json` -- MODIFY: Add recharts

### Known Limitations
- **No drill-down from charts to transaction list.** Future enhancement.
- **No PDF/image export of reports.** Future P2 feature.
- **No custom chart type selection.** Fixed chart types per sub-tab.
- **No investment performance in net worth.** Separate P1 feature.
- **No real-time chart updates.** Navigate away/back to refresh.
- **Income estimator is heuristic.** Confidence scores indicate reliability. Not all income patterns are detected.

### Context for Next Agent
- Transaction mapping for engine functions: `categoryId = envelope_id`, `amount = direction === 'outflow' ? -amount : amount`, `payee = merchant`, `date = occurred_on`, `isTransfer = direction === 'transfer'`.
- `getBudgetedVsSpent` needs `AllocationInfo[]`. For V1, use each envelope's `monthly_budget` as the allocation. V4 `bg_budget_allocations` is more granular but not required initially.
- Chart colors: use the fixed palette and assign by category sort order. Never randomize.
- `victory-native` requires `react-native-svg` (included in Expo by default).
- `recharts` requires `ResponsiveContainer` wrapper on web for proper sizing.
- The `[...slug]` catch-all at `apps/web/app/budget/[...slug]/page.tsx` currently handles `/budget/reports`. Once `reports/page.tsx` exists, Next.js routes to it automatically.
- The Sprint 1 spec at `docs/plans/features/sprint-1/budget-reports-dashboard.md` has additional detail on the core 4 sub-tabs. Use it as supplementary reference.
