# Feature Spec: Budget Reports Dashboard

## Metadata
- **Module:** budget
- **Priority Score:** 39 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 4 x3 + Complexity 3 x2 + CrossModule 2 x1 + PaidUser 5 x1
- **Sprint:** Sprint 1
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (reporting engine and net worth engine already exist in modules/budget/src/engine/)
- **Blocks:** Investment tracking (P1), ML auto-categorization (P2), Family sharing reports (P2)

## Business Context

### Why This Feature Exists
Reports and charts are the #1 P1 gap for the Budget module. Every major budgeting app provides visual spending analysis as a core feature. Without it, users have raw transaction data but no insight into their spending patterns over time. YNAB's reports are a major selling point at $109/yr. Monarch Money charges $99.99/yr for its analytics dashboard. MyLife already has the reporting engine built (getSpendingByCategory, getMonthlySpendingTrend, getBudgetedVsSpent, getTopPayees, calculateNetWorth, buildNetWorthTimeline) but no UI to display it. This is a rendering-only feature: the hard computation work is done.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| YNAB | Yes | Yes ($109/yr) | Spending by category (donut), income vs expense, net worth trend, age of money. Filterable by date range and account. |
| Monarch Money | Yes | Yes ($99.99/yr) | Rich interactive charts, spending breakdown, cash flow, net worth, investment performance. Custom date ranges. |
| Copilot | Yes | Yes ($119.88/yr) | Premium chart design, spending trends, category breakdowns, income tracking. Real-time updates. |
| Rocket Money | Yes | Yes ($48-144/yr) | Spending by category, bill tracking, net worth. Simpler charts than YNAB/Monarch. |
| PocketGuard | Yes | Yes ($74.99/yr) | "In My Pocket" summary, spending by category, recurring bills overview. |

### Target User
YNAB and Monarch Money users paying $100+/yr who want the same visual spending analysis but at $5/yr with no cloud dependency. Also any budget-conscious user who wants to answer: "Where is my money going?" and "Am I staying within budget?" without exporting to a spreadsheet.

## Technical Context

### Where This Lives in MyLife

```
modules/budget/src/engine/
  reporting.ts              -- Already exists: getSpendingByCategory, getMonthlySpendingTrend, getBudgetedVsSpent, getTopPayees
  net-worth.ts              -- Already exists: calculateNetWorth, buildNetWorthTimeline, captureSnapshot
apps/mobile/app/(budget)/
  reports.tsx               -- Mobile reports tab (tab key: 'reports' already defined in module nav)
apps/web/app/budget/
  reports/page.tsx           -- Web reports page
  actions.ts                 -- Add report-fetching server actions (existing file, extend)
```

### Wireframe Position

```
Hub Dashboard
  └── MyBudget card
       ├── Budget tab
       ├── Transactions tab
       ├── Subscriptions tab
       ├── Reports tab          ← YOU ARE HERE
       └── Accounts tab
```

On web, the reports page lives at `/budget/reports` and is accessible via the Budget module's layout nav. Currently this route falls through to the `[...slug]` catch-all rendering `ModuleWebFallback`.

### Data Model
No new tables or schema changes. This feature reads existing data through the reporting engine:

```
Existing tables used:
  bg_envelopes          -- Category names, monthly budgets (= allocations for getBudgetedVsSpent)
  bg_transactions       -- All transactions (amount, direction, envelope_id, merchant, occurred_on)
  bg_accounts           -- Account balances and types for net worth
  bg_net_worth_snapshots -- Historical net worth snapshots

Existing engine functions (modules/budget/src/engine/):
  getSpendingByCategory(transactions, splits, categories, range)    -> CategorySpending[]
  getMonthlySpendingTrend(transactions, range)                      -> MonthlySpendingPoint[]
  getBudgetedVsSpent(allocations, transactions, splits, categories, range) -> BudgetVsSpentRow[]
  getTopPayees(transactions, range, limit)                          -> TopPayee[]
  calculateNetWorth(accounts)                                       -> NetWorthResult
  buildNetWorthTimeline(snapshots)                                  -> NetWorthTimelinePoint[]
```

### Dependencies
- **Internal:** `@mylife/budget` (reporting engine, net-worth engine, CRUD for transactions/envelopes/accounts/snapshots), `@mylife/db` (DatabaseAdapter)
- **External:** A lightweight charting library. Recommendation: **`victory-native`** for mobile (React Native compatible, Expo-safe, SVG-based) and **`recharts`** for web (React standard, lightweight, composable). Both use the same data format patterns, making it easy to share data-prep logic. Alternative: `react-native-chart-kit` (simpler but less flexible). Do NOT use D3 directly (too heavy, no RN support).
- **Cross-Module:** Reports could eventually pull in subscription cost data from the subscriptions engine. Not in scope for this spec.

## Functional Requirements

### User Stories
1. As a budget user, I want to see a pie/donut chart of my spending by category so I can identify where my money goes.
2. As a budget user, I want to see my spending trend over time so I can tell if I'm spending more or less month over month.
3. As a budget user, I want to compare my budget vs actual spending per envelope so I can see which categories are over or under budget.
4. As a budget user, I want to see my net worth trend so I can track whether I'm building or losing wealth.
5. As a budget user, I want to see income vs expenses side by side so I can understand my savings rate.
6. As a budget user, I want to filter all reports by date range so I can analyze any time period.
7. As a budget user, I want to see my top merchants so I can identify recurring spending patterns.

### Behavior Specification

**Navigating to reports:**
1. User taps "Reports" tab (mobile) or clicks "Reports" in nav (web)
2. Reports page loads with the current month as the default date range
3. Page shows a date range picker at the top (presets: This Month, Last Month, Last 3 Months, Last 6 Months, This Year, Custom)
4. Below the picker, a horizontal scrollable tab bar shows: Overview, Spending, Budget vs Actual, Net Worth
5. Default sub-tab: Overview

**Overview sub-tab:**
1. Shows a summary row: Total Income | Total Spent | Net (income - expenses) | Savings Rate %
2. Below: Spending by Category donut chart (top 6 categories + "Other")
3. Below: Top 5 Merchants list

**Spending sub-tab:**
1. Spending by Category donut/pie chart (all categories, tappable segments)
2. Below: Category breakdown table (name, amount, % of total, transaction count)
3. Below: Monthly Spending Trend line chart
4. Tapping a donut segment filters the trend chart to that category only

**Budget vs Actual sub-tab:**
1. Horizontal bar chart: each envelope shows budgeted (full bar) vs spent (filled portion)
2. Color coding: green (<80%), yellow (80-100%), red (>100%)
3. Below: sortable table with envelope name, budgeted, spent, remaining, % used

**Net Worth sub-tab:**
1. Net worth line chart showing historical trend
2. Below: Current breakdown: Total Assets | Total Liabilities | Net Worth
3. Below: Account list grouped by type (assets vs liabilities) with individual balances

**Date range filtering:**
1. Changing the date range re-fetches data for all sub-tabs
2. Preset buttons provide quick selection
3. Custom range shows two date pickers (start, end)
4. Invalid range (start > end) is prevented by the picker

**Chart interactions:**
1. Tapping/hovering a chart element shows a tooltip with the exact value
2. Donut chart segments are tappable (mobile) / hoverable (web)
3. Line charts show data points on hover/tap
4. Bar charts show exact values on hover/tap

### Edge Cases

- **No transactions in range:** Show empty chart areas with message "No spending data for this period." No errors.
- **Single transaction only:** Charts render with a single data point. Line chart shows a dot, not a line. Donut shows 100% in one segment.
- **No envelopes set up:** Budget vs Actual sub-tab shows "Create envelopes first to see budget comparisons" with CTA.
- **No net worth snapshots:** Net Worth sub-tab shows current net worth calculation only, with message "Track your net worth over time by logging snapshots monthly."
- **All income, no expenses:** Spending charts are empty. Overview shows 100% savings rate.
- **Date range spanning years:** Line chart groups by month. Large datasets (1000+ transactions) computed in reporting engine (already handles this).
- **Module disabled mid-view:** UI unmounts cleanly, no errors.
- **Very long category names:** Truncate in chart labels with ellipsis. Full name in tooltip.
- **Currency formatting:** All amounts in cents internally, displayed as dollars with 2 decimal places and commas.

## Acceptance Criteria

**These are the definitive checks that prove this feature works.**

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

### Technical Criteria
- [ ] **TC-1:** Reports page calls existing engine functions (getSpendingByCategory, getMonthlySpendingTrend, getBudgetedVsSpent, getTopPayees) without duplicating logic
- [ ] **TC-2:** Net worth chart uses buildNetWorthTimeline from existing engine
- [ ] **TC-3:** Date range filtering is applied server-side (via transaction filter params), not client-side filtering of all data
- [ ] **TC-4:** Chart rendering does not block the main thread (data computation in server actions, rendering async)
- [ ] **TC-5:** All amounts display correctly in dollars with proper comma formatting
- [ ] **TC-6:** Web server actions extend the existing budget/actions.ts file (no new action files)

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Reports must NOT duplicate the reporting engine logic (use the existing functions from modules/budget/src/engine/)
- [ ] **NC-2:** Reports must NOT fetch all transactions at once for large datasets (use date range filtering)
- [ ] **NC-3:** Chart library must NOT bundle >100KB gzipped on web
- [ ] **NC-4:** Reports must NOT modify any data (read-only view)
- [ ] **NC-5:** Donut chart must NOT render more than 8 segments (top 7 + "Other" for readability)

## UI Specification

### Mobile (Expo)

The Reports tab is already defined in the budget module navigation (`{ key: 'reports', label: 'Reports', icon: 'pie-chart' }`).

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.06)` border
- Module accent: `#22C55E` (green, budget module)
- Chart colors: Use a palette derived from the accent. Suggestion: `['#22C55E', '#3B82F6', '#F97316', '#8B5CF6', '#EF4444', '#06B6D4', '#F59E0B', '#64748B']` for category segments.

Layout:
```
[Date range picker bar -- horizontal scroll]
  [This Month] [Last Month] [3 Mo] [6 Mo] [Year] [Custom]

[Sub-tab bar -- horizontal scroll]
  [Overview] [Spending] [Budget vs Actual] [Net Worth]

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

Layout:
```
[Date range bar -- pill buttons + optional custom date inputs]

[Sub-tab bar -- segmented control]

[Chart grid -- responsive]
  Desktop: 2-column grid for charts, full-width for tables
  Mobile: single column
```

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton chart placeholders (rounded rectangles pulsing) | Initial data fetch or date range change |
| Empty (no data) | Glass card with "No spending data for this period" + suggestion to add transactions | No transactions in selected range |
| Empty (no envelopes) | "Create envelopes first" card with CTA button on Budget vs Actual tab | No envelopes exist |
| Empty (no snapshots) | Current net worth number + "Log monthly snapshots to see your trend" on Net Worth tab | No hl_net_worth_snapshots rows |
| Error | Glass card with "Something went wrong" + retry button | Engine computation or data fetch fails |
| Success | Charts rendered with data, tooltips functional | Data loaded successfully |
| Partial | Some sub-tabs have data, others show empty state | e.g., transactions exist but no net worth snapshots |

## Test Requirements

### Unit Tests
- [ ] `getSpendingByCategory`: already tested, verify no regression
- [ ] `getMonthlySpendingTrend`: already tested, verify no regression
- [ ] `getBudgetedVsSpent`: already tested, verify no regression
- [ ] `getTopPayees`: already tested, verify no regression
- [ ] `calculateNetWorth`: already tested, verify no regression
- [ ] `buildNetWorthTimeline`: already tested, verify no regression
- [ ] Report data prep helper: transforms engine output to chart-ready format (labels, values, colors)
- [ ] Savings rate calculation: income - expenses / income * 100, handles zero income (returns 0)
- [ ] Date range preset calculation: "This Month" returns correct start/end for current month
- [ ] Category color assignment: assigns consistent colors to categories across renders
- [ ] "Other" bucket: correctly aggregates categories beyond top 7

### Integration Tests
- [ ] Full flow: add 5 transactions across 3 envelopes -> open Reports -> spending chart shows 3 segments with correct amounts
- [ ] Date range flow: change from "This Month" to "Last 3 Months" -> charts update with broader data
- [ ] Empty flow: no transactions -> all charts show empty states without errors
- [ ] Net worth flow: 3 monthly snapshots exist -> net worth trend shows 3 points with change values

### QA Verification Script

1. Open the app on [iOS / web]
2. Navigate to MyBudget > Reports tab
3. Verify: Date range defaults to current month -- AC-1
4. Verify: Overview sub-tab shows Total Income, Total Spent, Net, Savings Rate -- AC-9
5. Verify: Spending donut chart shows categories with proportional segments -- AC-2
6. Verify: Top Merchants list shows 5 merchants sorted by spend -- AC-7
7. Tap "Spending" sub-tab
8. Verify: Full category breakdown with donut + table
9. Tap a donut segment
10. Verify: Tooltip appears with category name and amount -- AC-8
11. Scroll down
12. Verify: Monthly Spending Trend line chart renders -- AC-4
13. Tap "Budget vs Actual" sub-tab
14. Verify: Horizontal bars show budgeted (full) vs spent (filled) with color coding -- AC-5
15. Verify: Over-budget envelopes show red bars, under-budget show green
16. Tap "Net Worth" sub-tab
17. Verify: Line chart shows net worth trend with data points -- AC-6
18. Verify: Current breakdown shows assets, liabilities, net worth
19. Change date range to "Last 3 Months"
20. Verify: All charts update with new data -- AC-3
21. Change date range to "Custom", enter a 2-week range
22. Verify: Charts reflect only transactions in that window -- AC-10
23. Delete all transactions (or use empty account)
24. Verify: Empty state messages appear with CTAs -- AC-12
25. Verify on web at /budget/reports
26. Verify: Same charts render with recharts, responsive layout -- AC-11

## gstack Quality Gates

Based on Complexity score 3 (Medium), these gates are required:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to /budget/reports, click each sub-tab, verify all chart states
- [ ] Batch QA: after 5 features in budget module, run `/qa` on the module URL

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- budget standalone is archived, N/A for standalone parity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Reporting engine exists and is fully tested: `modules/budget/src/engine/reporting.ts` (4 functions: getSpendingByCategory, getMonthlySpendingTrend, getBudgetedVsSpent, getTopPayees) and `modules/budget/src/engine/net-worth.ts` (3 functions: calculateNetWorth, buildNetWorthTimeline, captureSnapshot).
- Budget module definition already declares a "reports" tab (`{ key: 'reports', label: 'Reports', icon: 'pie-chart' }`).
- Web route `/budget/reports` currently falls through to `[...slug]` catch-all showing `ModuleWebFallback`.
- No charting library is installed.
- Budget module has 176 tests passing across 15 test files.

### After This Work
- Mobile: `apps/mobile/app/(budget)/reports.tsx` renders the full reports dashboard with 4 sub-tabs.
- Web: `apps/web/app/budget/reports/page.tsx` renders the same reports with web-optimized charts.
- `apps/web/app/budget/actions.ts` extended with report-fetching server actions.
- `victory-native` added to `apps/mobile/package.json`.
- `recharts` added to `apps/web/package.json`.
- Data prep helpers created for transforming engine output to chart-ready format.
- Tests cover data prep helpers, savings rate calculation, date range presets, and category color assignment.

### Files Changed
- `apps/web/app/budget/reports/page.tsx` -- New web reports page with recharts
- `apps/web/app/budget/actions.ts` -- Extended with fetchReportData, fetchNetWorthTimeline server actions
- `apps/mobile/app/(budget)/reports.tsx` -- New mobile reports screen with victory-native
- `apps/mobile/package.json` -- Add victory-native dependency
- `apps/web/package.json` -- Add recharts dependency
- `modules/budget/src/engine/report-helpers.ts` -- Data prep: chart color assignment, "Other" bucket aggregation, savings rate, date range presets

### Known Limitations
- **No drill-down:** Tapping a category in the donut does not navigate to a filtered transaction list. This is a future enhancement.
- **No export:** Reports cannot be exported as PDF or image. This is a future feature (P2).
- **No custom chart types:** Users cannot choose between pie/donut/bar for the same data. Fixed chart types per sub-tab.
- **No investment tracking:** Net worth tracks bank accounts only, not investment portfolios. Investment tracking is a separate P1 feature.
- **No real-time updates:** Charts do not live-update when transactions are added. User must navigate away and back, or change the date range.
- **Static snapshot frequency:** Net worth trend requires manual or scheduled snapshots. There is no automatic daily snapshot mechanism yet.

### Context for Next Agent
- The reporting engine functions in `modules/budget/src/engine/reporting.ts` expect a specific `Transaction` interface (id, categoryId, amount as negative cents for spending, payee, date, isTransfer). You must map from `BudgetTransaction` (which uses `envelope_id`, `direction`, and `merchant`) to this interface. The mapping is: `categoryId = envelope_id`, `amount = direction === 'outflow' ? -amount : amount`, `payee = merchant`, `date = occurred_on`, `isTransfer = direction === 'transfer'`.
- `getBudgetedVsSpent` needs `AllocationInfo[]`. For V1, use each envelope's `monthly_budget` as the allocation amount. The V4 budget allocations system is more granular but not required for the initial reports dashboard.
- For chart colors, use a fixed palette and assign colors by category sort order. Do not randomize colors between renders.
- `victory-native` requires `react-native-svg` which Expo includes by default. No extra native linking needed.
- `recharts` needs `ResponsiveContainer` wrapper on web for proper sizing. Without it, charts render at 0 width.
- The `[...slug]` catch-all at `apps/web/app/budget/[...slug]/page.tsx` currently handles `/budget/reports`. Once the dedicated `reports/page.tsx` is created, Next.js will route to it automatically (specific routes win over catch-alls).
