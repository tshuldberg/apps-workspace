# Feature Spec: Cost Analysis

## Metadata
- **Module:** subs
- **Priority Score:** 29 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 3 x3 + Complexity 4 x2 + CrossModule 3 x1 + PaidUser 3 x1
- **Sprint:** Sprint 8
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Database schema, All CRUD functions
- **Blocks:** none

## Business Context

### Why This Feature Exists
Users know they pay for subscriptions but rarely see the cumulative impact. Rocket Money's biggest hook is showing users they spend $200+/mo on subscriptions they barely think about. Bobby does this too with its simple cost overview. Cost analysis transforms MySubs from a passive list into an active financial awareness tool. It answers "how much am I really spending?" with breakdowns by category, billing cycle, and time period, plus trend tracking via price history.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Rocket Money | Yes | Yes ($48-144/yr) | Comprehensive spending analysis with bank-synced data. Shows total spend, category breakdown, spending trends, "hidden subscriptions" detection. |
| Bobby | Yes | No ($1.99) | Simple cost overview: total monthly/annual, per-category totals, visual cost breakdown with colored segments. |

### Target User
Budget-conscious users who want to understand their subscription spending without connecting bank accounts. Users migrating from Bobby who want the cost overview they're used to. Users who've never tracked subscriptions and will be shocked by their total spend (motivating them to use Cancellation Assist next).

## Technical Context

### Where This Lives in MyLife

```
modules/subs/src/
  engines/
    cost-analysis.ts       -- NEW: Cost analysis engine (normalization, breakdowns, trends)
    __tests__/
      cost-analysis.test.ts -- NEW: Engine tests
  types.ts                 -- MODIFY: Add cost analysis result types
  index.ts                 -- MODIFY: Export engine functions
apps/mobile/app/(subs)/
  index.tsx                -- MODIFY: Add cost breakdown section to Dashboard
  cost-report.tsx          -- NEW: Full cost analysis report screen
apps/web/app/subs/
  page.tsx                 -- MODIFY: Add cost breakdown to Dashboard
  reports/
    page.tsx               -- NEW: Full cost analysis report
```

### Wireframe Position

```
Hub Dashboard
  └── MySubs card
       └── Dashboard tab
            ├── Hero card (total spend)    ← ENHANCED: More detail
            ├── Cost Breakdown section     ← NEW
            ├── Spending Trends section    ← NEW
            └── [View Full Report →]       ← NEW: Links to report screen
```

### Data Model

No new tables. Uses existing:
- `sb_subscriptions` -- cost_cents, billing_cycle, status, category_id
- `sb_categories` -- name, color for chart segments
- `sb_price_history` -- old_cost_cents, new_cost_cents, changed_on for trend data

### Dependencies
- **Internal:** `@mylife/subs` (CRUD functions, types), `@mylife/db` (DatabaseAdapter)
- **External:** None. Charts rendered with basic Views/Canvas -- no charting library required.
- **Cross-Module:** Budget module has similar cost normalization functions. If both modules are active, the hub dashboard could aggregate. But this is a future integration, not a blocker.

## Functional Requirements

### User Stories
1. As a user, I want to see my total monthly and annual subscription costs so I know the real number.
2. As a user, I want to see spending broken down by category so I know where my money goes (e.g., 40% streaming, 25% productivity).
3. As a user, I want to see a price change timeline so I know which subscriptions have gotten more expensive.
4. As a user, I want monthly/annual/weekly cost views so I can think about my spending in the timeframe that makes sense to me.
5. As a user, I want to see year-over-year spending trends if I have enough history.

### Behavior Specification

**Cost Normalization Engine:**
All cost calculations go through a normalization layer:

```typescript
function normalizeToMonthly(costCents: number, cycle: BillingCycle): number
function normalizeToAnnual(costCents: number, cycle: BillingCycle): number
function normalizeToWeekly(costCents: number, cycle: BillingCycle): number
```

Normalization rules:
- Weekly to monthly: cost * (52 / 12) = cost * 4.333...
- Monthly: cost * 1
- Quarterly to monthly: cost / 3
- Yearly to monthly: cost / 12
- Lifetime: 0 (no recurring cost)

Annual = monthly * 12. Weekly = monthly / (52/12).

**Cost Summary (enhanced Dashboard hero card):**

```typescript
interface CostSummary {
  totalMonthlyCents: number;
  totalAnnualCents: number;
  totalWeeklyCents: number;
  activeCount: number;
  pausedCount: number;
  cancelledCount: number;
  trialCount: number;
  averageMonthlyCents: number;
  mostExpensive: { name: string; monthlyCents: number } | null;
  cheapest: { name: string; monthlyCents: number } | null;
}
```

`getCostSummary(db): CostSummary` -- Computes all summary metrics for active subscriptions.

**Category Breakdown:**

```typescript
interface CategoryBreakdown {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string;
  monthlyCents: number;
  annualCents: number;
  percentage: number;  // of total monthly
  subscriptionCount: number;
  subscriptions: { name: string; monthlyCents: number }[];
}
```

`getCategoryBreakdown(db): CategoryBreakdown[]` -- Returns breakdown sorted by monthlyCents DESC. Uncategorized subscriptions grouped under "Other" with `categoryId: null`.

**Billing Cycle Breakdown:**

```typescript
interface CycleBreakdown {
  cycle: BillingCycle;
  count: number;
  totalMonthlyCents: number;
  percentage: number;
}
```

`getCycleBreakdown(db): CycleBreakdown[]` -- Groups active subs by billing cycle with normalized costs.

**Price Change Analysis:**

```typescript
interface PriceChangeAnalysis {
  subscriptionId: string;
  subscriptionName: string;
  currentCostCents: number;
  originalCostCents: number;
  totalChangeCents: number;
  totalChangePercent: number;
  changes: { date: string; oldCents: number; newCents: number; changeCents: number; changePercent: number }[];
  direction: 'increased' | 'decreased' | 'stable';
}
```

`getPriceChanges(db): PriceChangeAnalysis[]` -- Returns all subscriptions with price history, sorted by largest increase first.

**Spending Projection:**

```typescript
interface SpendingProjection {
  next30DaysCents: number;
  next90DaysCents: number;
  next12MonthsCents: number;
  upcomingCharges: { name: string; date: string; amountCents: number }[];
}
```

`getSpendingProjection(db): SpendingProjection` -- Projects upcoming charges based on active subscriptions' renewal dates and costs.

**Dashboard enhancements:**
1. Hero card adds: weekly cost toggle, average cost per sub
2. New "Cost Breakdown" section with horizontal stacked bar:
   - Each segment colored by category color
   - Tap a segment to see category detail
   - Labels show top 3 categories by percentage
3. New "Price Changes" section:
   - Shows subscriptions with recent price increases (last 6 months)
   - Each card: name, old price, new price, change percentage
   - If no changes: section hidden
4. "View Full Report" link at bottom of Dashboard

**Full Report screen (cost-report.tsx):**
1. Time period selector: This Month / This Quarter / This Year / All Time
2. Total spend card (monthly/annual/weekly toggle)
3. Category donut/ring chart with legend
4. Billing cycle distribution
5. Price change timeline (vertical list, sorted by date)
6. Spending projection: "Next 30 days: $X, Next 12 months: $X"
7. Per-subscription cost table (sortable by name, cost, category)

### Edge Cases

- **No subscriptions:** All totals $0.00. "No subscriptions to analyze" message. Report screen shows empty state.
- **All lifetime subscriptions:** Monthly/annual costs are $0.00 (lifetime = no recurring). Show "All subscriptions are lifetime purchases" note.
- **Single subscription:** Percentages are 100%. "Most expensive" and "cheapest" are the same.
- **No categories assigned:** All subs grouped under "Other" with a single 100% segment.
- **Zero-cost subscription (free tier):** Included in counts but contributes $0 to costs. Not shown as "cheapest" unless it's the only one.
- **Subscription with no price history:** Not included in Price Changes section. Direction is "stable".
- **Price decreased:** Show as a positive event ("Price dropped 15%") in green.
- **Very many categories (10+):** Show top 5 in the chart, group remaining as "Other".
- **Floating point precision:** All calculations use integer cents. Division results rounded to nearest cent.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Dashboard hero card shows total monthly, annual, and (toggled) weekly costs
- [ ] **AC-2:** Dashboard shows cost breakdown by category with colored segments
- [ ] **AC-3:** Tapping a category segment shows the subscriptions in that category
- [ ] **AC-4:** Price changes section shows subscriptions with recent increases
- [ ] **AC-5:** "View Full Report" navigates to the full cost analysis screen
- [ ] **AC-6:** Report screen shows time period selector with correct totals per period
- [ ] **AC-7:** Category chart displays correct proportions and colors
- [ ] **AC-8:** Price change timeline shows chronological history with amounts and percentages
- [ ] **AC-9:** Spending projection shows next 30 days, 90 days, and 12 months
- [ ] **AC-10:** Per-subscription table is sortable by name, cost, and category
- [ ] **AC-11:** Feature works on both mobile and web

### Technical Criteria
- [ ] **TC-1:** `normalizeToMonthly` correctly handles all 5 billing cycles
- [ ] **TC-2:** `normalizeToAnnual` correctly handles all 5 billing cycles
- [ ] **TC-3:** `getCostSummary` computes all fields correctly
- [ ] **TC-4:** `getCategoryBreakdown` percentages sum to 100% (with rounding)
- [ ] **TC-5:** `getPriceChanges` correctly computes total change from original to current
- [ ] **TC-6:** `getSpendingProjection` uses actual renewal dates, not estimates
- [ ] **TC-7:** All monetary calculations use integer cents (no floats)
- [ ] **TC-8:** Engine functions are pure (no side effects, no database writes)
- [ ] **TC-9:** `pnpm typecheck` passes with no errors

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Cost analysis must NOT modify any subscription data
- [ ] **NC-2:** Must NOT display costs with more than 2 decimal places
- [ ] **NC-3:** Must NOT include cancelled/expired subscriptions in active cost totals
- [ ] **NC-4:** Must NOT use floating-point dollars for intermediate calculations

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#10B981` (emerald green)
- Category colors: from `sb_categories.color` field
- Price increase: `#EF4444` (danger red)
- Price decrease: `#30D158` (success green)
- Cost amounts: `#F0F0F5` (primary text) with accent underline for totals

Dashboard cost breakdown:
```
[Cost Breakdown]
  ████████████░░░░░░░  Streaming 40% ($58.97)
  ████████░░░░░░░░░░░  Productivity 25% ($36.99)
  ████░░░░░░░░░░░░░░░  Cloud 15% ($22.99)
  ███░░░░░░░░░░░░░░░░  Other 20% ($29.98)

[Price Changes]
  Netflix    $15.99 → $22.99    ↑ 44%    [red]
  Spotify    $9.99 → $10.99     ↑ 10%    [red]

                          [View Full Report →]
```

### Web (Next.js)

- Route: `/subs/reports` for full report
- Dashboard at `/subs` enhanced with inline breakdown
- Category chart: CSS-rendered ring chart (no external lib)
- Responsive: breakdown stacks vertically on narrow screens

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton for breakdown and chart areas | Initial computation |
| Empty | "No subscriptions to analyze" with add CTA | Zero subscriptions |
| Success | Full breakdown with charts and projections | Active subscriptions exist |
| No changes | Price Changes section hidden | No price history records |
| Error | "Could not compute cost analysis" with retry | Engine computation fails |

## Test Requirements

### Unit Tests
- [ ] `normalizeToMonthly(1000, 'weekly')` returns 4333 (rounded)
- [ ] `normalizeToMonthly(1000, 'monthly')` returns 1000
- [ ] `normalizeToMonthly(3000, 'quarterly')` returns 1000
- [ ] `normalizeToMonthly(12000, 'yearly')` returns 1000
- [ ] `normalizeToMonthly(5000, 'lifetime')` returns 0
- [ ] `normalizeToAnnual(1000, 'monthly')` returns 12000
- [ ] `normalizeToAnnual(1000, 'yearly')` returns 1000
- [ ] `getCostSummary`: 3 active subs returns correct totals, counts, most expensive, cheapest
- [ ] `getCostSummary`: no subscriptions returns all zeros
- [ ] `getCostSummary`: mix of active + cancelled only counts active
- [ ] `getCategoryBreakdown`: 2 categories returns correct percentages summing to 100
- [ ] `getCategoryBreakdown`: uncategorized subs grouped under "Other"
- [ ] `getCategoryBreakdown`: single category returns 100%
- [ ] `getCycleBreakdown`: mix of monthly and yearly groups correctly
- [ ] `getPriceChanges`: sub with 2 increases returns correct total change
- [ ] `getPriceChanges`: sub with decrease shows direction 'decreased'
- [ ] `getPriceChanges`: sub with no history returns direction 'stable'
- [ ] `getSpendingProjection`: 2 monthly subs renewing in 15 and 25 days -> next30Days correct
- [ ] `getSpendingProjection`: yearly sub renewing in 60 days -> in next90Days but not next30Days
- [ ] Rounding: percentages always sum to exactly 100

### Integration Tests
- [ ] Full flow: create 3 subs in different categories -> getCostSummary + getCategoryBreakdown return consistent data
- [ ] Price tracking: create sub -> update price twice -> getPriceChanges shows correct timeline
- [ ] Projection accuracy: create monthly sub starting today -> getSpendingProjection.next12MonthsCents = 12 * monthlyCost

### QA Verification Script

1. Open MySubs on iOS/web
2. Add 3 subscriptions:
   - Netflix: $22.99/mo, category: Streaming
   - Spotify: $10.99/mo, category: Music
   - iCloud: $2.99/mo, category: Cloud Storage
3. Navigate to Dashboard tab
4. Verify: Hero card shows $36.97/mo, $443.64/yr -- AC-1
5. Verify: Cost breakdown shows 3 colored segments -- AC-2
6. Verify: Streaming is largest segment (~62%) -- AC-7
7. Tap the Streaming segment -- AC-3
8. Verify: Shows Netflix as the only streaming subscription -- AC-3
9. Update Netflix price from $22.99 to $24.99
10. Return to Dashboard
11. Verify: Price Changes section appears with Netflix showing $22.99 -> $24.99 (↑9%) -- AC-4
12. Tap "View Full Report" -- AC-5
13. Verify: Report screen loads with time period selector -- AC-6
14. Verify: Category chart matches Dashboard breakdown -- AC-7
15. Verify: Spending projection shows next 30/90/12mo values -- AC-9
16. Verify: Per-subscription table shows all 3 subs -- AC-10
17. Sort by cost descending -- AC-10
18. Verify: Netflix (now $24.99) first, then Spotify, then iCloud -- AC-10
19. Verify on web -- AC-11

## gstack Quality Gates

Based on Complexity score 4 (Simple), these gates are required:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to /subs dashboard, verify cost breakdown renders, tap through to report

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for cost normalization and breakdown engine

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- subs has no standalone counterpart, N/A
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- CRUD functions exist. UI exists with basic hero card showing total monthly/annual. No cost breakdown, no category analysis, no price change tracking, no projections.

### After This Work
- Cost analysis engine with normalization, category breakdown, cycle breakdown, price change analysis, and spending projections.
- Enhanced Dashboard with cost breakdown visualization and price change alerts.
- Full cost report screen with charts, tables, and projections.

### Files Changed
- `modules/subs/src/engines/cost-analysis.ts` -- NEW: Cost analysis engine (6 functions)
- `modules/subs/src/engines/__tests__/cost-analysis.test.ts` -- NEW: Engine tests
- `modules/subs/src/types.ts` -- MODIFY: Add CostSummary, CategoryBreakdown, CycleBreakdown, PriceChangeAnalysis, SpendingProjection types
- `modules/subs/src/index.ts` -- MODIFY: Export engine functions
- `apps/mobile/app/(subs)/index.tsx` -- MODIFY: Add cost breakdown and price changes sections
- `apps/mobile/app/(subs)/cost-report.tsx` -- NEW: Full cost analysis report screen
- `apps/web/app/subs/page.tsx` -- MODIFY: Add cost breakdown to dashboard
- `apps/web/app/subs/reports/page.tsx` -- NEW: Full cost report page

### Known Limitations
- **No trend analysis over time.** The engine computes a snapshot of current costs. Historical spend tracking (e.g., "you spent $X last month vs $Y this month") would require a periodic snapshot mechanism. Future enhancement.
- **Projection is simple.** Uses current cost * frequency. Does not account for anticipated price increases, trial-to-paid conversions, or planned cancellations.
- **Charts are basic.** CSS/Canvas-rendered, not a charting library. Good enough for segments and bars. Not interactive (no hover tooltips, no drill-down animations).

### Context for Next Agent
- Use `normalizeToMonthly` and `normalizeToAnnual` from the cost analysis engine for all cost displays throughout the module. These are the canonical normalization functions.
- The `getCategoryBreakdown` function handles the "Other" grouping for uncategorized subs. Don't re-implement this in UI code.
- Price change data comes from `sb_price_history` which is auto-populated by `updateSubscription` in the CRUD layer. No additional price tracking mechanism is needed.
- The spending projection uses `sb_renewal_events` for upcoming charge dates. If renewal events haven't been generated for a subscription, the projection falls back to calculating from `next_renewal_date` + `billing_cycle`.
- Percentages should sum to 100%. The engine handles rounding (largest remainder method) to ensure this.
