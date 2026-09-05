# Feature Spec: Investment Tracking

## Metadata
- **Module:** budget
- **Priority Score:** 28 / 50 (B-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 3 x3 + Complexity 1 x2 + CrossModule 1 x1 + PaidUser 4 x1
- **Sprint:** Sprint 3+
- **Estimated CC Time:** 5-6 hours
- **Depends On:** Net worth tracking improvements (uses net worth snapshots for portfolio value history)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Monarch Money ($99.99/yr) and Copilot ($119.88/yr) both offer investment portfolio tracking as a premium feature. Users want a single app to see their complete financial picture: budgeting + investments + net worth. The budget module already has 'investment' account type (V5) and net worth snapshots, but no way to track individual holdings, see asset allocation, or monitor portfolio performance. Investment tracking closes the gap between "I know my account balances" and "I understand my portfolio."

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Monarch Money | Yes | Yes ($99.99/yr) | Full investment tracking via Plaid. Holdings, performance, allocation pie chart. Auto-synced from brokerage. |
| Copilot | Yes | Yes ($119.88/yr) | Investment portfolio view. Real-time sync. Performance charts. Asset class breakdown. |
| YNAB | No | N/A | Investment accounts show balance only. No holdings or performance tracking. |
| Rocket Money | Partial | Yes ($48-144/yr) | Shows investment account balances via Plaid. No detailed holdings. |
| PocketGuard | No | N/A | No investment tracking. |

### Target User
Users with brokerage accounts (401k, IRA, taxable) who want to see their complete financial picture in one app without paying $99-120/yr for Monarch or Copilot. Also YNAB users who track investment balances manually and want actual portfolio visibility. Migration path: Monarch user paying $99.99/yr for investment tracking + budgeting gets both at $5/yr.

## Technical Context

### Where This Lives in MyLife

```
modules/budget/src/
  engine/
    investment-tracker.ts        -- NEW: Portfolio engine (allocation, performance, gain/loss)
  db/
    schema.ts                    -- MODIFY: V6 migration adds bg_holdings, bg_holding_snapshots
    crud.ts                      -- MODIFY: Add holdings CRUD
  types.ts                       -- MODIFY: Add holding schemas, asset class enum
  definition.ts                  -- MODIFY: V6 migration
  index.ts                       -- MODIFY: Export investment types and engine
apps/mobile/app/(budget)/
  investments.tsx                -- NEW: Portfolio overview screen
  holding-detail.tsx             -- NEW: Individual holding detail
  add-holding.tsx                -- NEW: Add/edit holding form
apps/web/app/budget/
  investments/page.tsx           -- NEW: Portfolio overview page
  investments/[id]/page.tsx      -- NEW: Holding detail page
  actions.ts                     -- MODIFY: Add investment server actions
```

### Wireframe Position

```
Hub Dashboard
  └── MyBudget card
       ├── Budget tab
       ├── Transactions tab
       ├── Subscriptions tab
       ├── Reports tab
       │    └── Investments sub-section  ← OVERVIEW CHARTS
       ├── Accounts tab
       │    └── Investment accounts > "View Holdings"  ← ENTRY FROM ACCOUNTS
       └── [Investments detail screen]                  ← FULL PORTFOLIO VIEW
```

### Data Model

```sql
-- V6 migration: Investment holdings
CREATE TABLE IF NOT EXISTS bg_holdings (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES bg_accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,              -- Ticker symbol or fund name
  name TEXT NOT NULL,                -- Full name (e.g., "Vanguard S&P 500 ETF")
  asset_class TEXT NOT NULL DEFAULT 'stock'
    CHECK (asset_class IN ('stock', 'bond', 'etf', 'mutual_fund', 'reit', 'crypto', 'commodity', 'cash_equivalent', 'other')),
  shares REAL NOT NULL,              -- Fractional shares allowed
  cost_basis INTEGER NOT NULL,       -- Total cost basis in cents
  current_price INTEGER,             -- Per-share price in cents (user-updated)
  current_value INTEGER,             -- shares * current_price (computed on update)
  currency TEXT NOT NULL DEFAULT 'USD',
  last_price_update TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Historical snapshots for performance tracking
CREATE TABLE IF NOT EXISTS bg_holding_snapshots (
  id TEXT PRIMARY KEY,
  holding_id TEXT NOT NULL REFERENCES bg_holdings(id) ON DELETE CASCADE,
  date TEXT NOT NULL,                -- YYYY-MM-DD
  shares REAL NOT NULL,
  price_per_share INTEGER NOT NULL,  -- cents
  total_value INTEGER NOT NULL,      -- cents
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(holding_id, date)
);

CREATE INDEX IF NOT EXISTS bg_holdings_account_idx ON bg_holdings(account_id);
CREATE INDEX IF NOT EXISTS bg_holdings_symbol_idx ON bg_holdings(symbol);
CREATE INDEX IF NOT EXISTS bg_holdings_asset_class_idx ON bg_holdings(asset_class);
CREATE INDEX IF NOT EXISTS bg_holdings_active_idx ON bg_holdings(is_active);
CREATE INDEX IF NOT EXISTS bg_holding_snapshots_holding_date_idx
  ON bg_holding_snapshots(holding_id, date DESC);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), net worth engine (snapshots feed into portfolio value), account types (V5 'investment' type)
- **External:** None required. Manual price entry. Future: optional price fetch API (but not in this version to maintain privacy-first approach).
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a budget user, I want to add my investment holdings (stocks, ETFs, funds) so I can see my portfolio in one place.
2. As a budget user, I want to see my asset allocation (stocks vs bonds vs cash) as a pie chart.
3. As a budget user, I want to track gain/loss on each holding (unrealized P&L).
4. As a budget user, I want to see my total portfolio value over time.
5. As a budget user, I want to update prices manually to keep my portfolio current.
6. As a budget user, I want investment value included in my net worth calculation.

### Behavior Specification

1. User navigates to Investments (from Accounts tab or Reports)
2. Portfolio overview shows:
   a. Total portfolio value (sum of all holdings)
   b. Total gain/loss (value - cost basis) with % return
   c. Asset allocation donut chart by asset class
   d. Holdings list sorted by value
3. User taps "Add Holding" to enter: symbol, name, asset class, shares, cost basis, current price
4. System calculates current value (shares x price)
5. Holding detail shows:
   a. Gain/loss (value - cost basis) with % return
   b. Price chart from snapshots (if history exists)
   c. Holding info: shares, avg cost per share, current price
6. User can update prices: tap holding > "Update Price" > enter new price
7. Price updates trigger: holding value recalculation, holding snapshot creation, net worth snapshot update
8. Reports > Investments sub-section shows:
   a. Portfolio value over time (line chart from snapshots)
   b. Allocation breakdown
   c. Top performers and underperformers

### Edge Cases

- Holding with 0 shares (sold entirely): mark as inactive, preserve history
- Fractional shares (e.g., 0.5 shares of BRK.A): REAL column supports this
- Holding with unknown current price: show "Price needed" badge, exclude from totals until updated
- Very large number of holdings (100+): paginate list, lazy-load detail
- Stock split: user manually adjusts shares and cost basis per share
- Dividend reinvestment: user adds new shares at dividend date cost basis
- Crypto holdings: supported via 'crypto' asset class, same workflow
- Currency mismatch (EUR holding in USD account): use multi-currency conversion if available
- No holdings yet: empty state with explanation and "Add your first holding" CTA
- Duplicate symbol across accounts: allowed (e.g., VTI in both IRA and taxable)

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Portfolio overview shows total value and total gain/loss with % return
- [ ] **AC-2:** Asset allocation donut chart shows breakdown by asset class
- [ ] **AC-3:** Holdings list shows each holding with symbol, shares, value, gain/loss
- [ ] **AC-4:** "Add Holding" form captures symbol, name, asset class, shares, cost basis, price
- [ ] **AC-5:** Holding detail shows unrealized gain/loss with % return
- [ ] **AC-6:** Price update flow: tap holding > update price > value recalculates immediately
- [ ] **AC-7:** Portfolio value chart shows history from holding snapshots
- [ ] **AC-8:** Net worth includes investment account values
- [ ] **AC-9:** Inactive holdings (0 shares) hidden from default view, accessible via filter
- [ ] **AC-10:** Holdings sortable by value, gain/loss, or name

### Technical Criteria
- [ ] **TC-1:** All monetary values stored as integer cents
- [ ] **TC-2:** Shares stored as REAL (SQLite float) to support fractional shares
- [ ] **TC-3:** bg_holdings and bg_holding_snapshots created via V6 migration
- [ ] **TC-4:** Price update creates a new snapshot in bg_holding_snapshots
- [ ] **TC-5:** Portfolio calculations (total value, gain/loss, allocation %) complete in <100ms
- [ ] **TC-6:** Holding snapshots used for time-series portfolio value chart
- [ ] **TC-7:** current_value = shares * current_price (recomputed on every price update)

### Negative Criteria
- [ ] **NC-1:** No price data fetched from external APIs (manual entry only in this version)
- [ ] **NC-2:** Holding deletion must NOT delete the associated account
- [ ] **NC-3:** Investment data must NOT be sent to any external service
- [ ] **NC-4:** Portfolio calculations must NOT block the main thread (use async where needed)

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Portfolio summary card: `rgba(255,255,255,0.04)` (glass token), total value large text, gain/loss in green/red
- Module accent: `#22C55E` (budget green)
- Gain: `#30D158` (success green), Loss: `#FF453A` (danger red)
- Donut chart: colored segments per asset class (use CHART_COLORS from engine)
- Holding rows: glass card with symbol badge, name, value right-aligned, gain/loss below

### Web (Next.js)
- Same tokens via CSS variables
- Route: `/budget/investments` (overview), `/budget/investments/[id]` (detail)
- Three-column layout: portfolio summary top, allocation chart left, holdings table right

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards for holdings list | Initial fetch |
| Empty | "No investment holdings" + "Add your first holding" CTA | No holdings |
| Error | "Could not load portfolio" + retry button | DB error |
| Success | Full portfolio: value, gain/loss, allocation chart, holdings | Data loaded |
| Partial | Some holdings missing prices, shown with "Update price" badge | New holdings without price |

## Test Requirements

### Unit Tests
- [ ] `calculatePortfolioValue`: sums all holding current_values
- [ ] `calculatePortfolioGainLoss`: (total value - total cost basis) with % return
- [ ] `calculateAllocation`: returns array of {assetClass, percentage, value} summing to 100%
- [ ] `calculateHoldingGainLoss`: single holding gain/loss with % return
- [ ] `calculateHoldingGainLoss`: handles 0 cost basis without division by zero
- [ ] `updateHoldingValue`: recalculates current_value from shares * price
- [ ] `buildPerformanceTimeline`: creates time-series from holding snapshots
- [ ] Holdings CRUD: create, read, update price, deactivate, list by account
- [ ] Snapshot CRUD: create, read range, latest per holding

### Integration Tests
- [ ] Full flow: add holding -> update price -> verify gain/loss -> check net worth updated
- [ ] Multiple holdings: add 5 holdings -> verify allocation percentages sum to 100%
- [ ] Deactivation: sell all shares -> holding hidden from default view -> history preserved

### QA Verification Script

1. Open app on iOS simulator
2. Navigate to MyBudget > Accounts
3. Create an investment account "Brokerage"
4. Navigate to Investments section
5. Verify: empty state with "Add your first holding" CTA -- Empty state
6. Tap "Add Holding"
7. Enter: VTI, "Vanguard Total Stock Market ETF", stock, 50 shares, $10,000 cost, $220/share
8. Verify: holding appears with value $11,000 and +$1,000 (+10%) gain -- AC-1, AC-3, AC-4
9. Add second holding: BND, "Vanguard Total Bond Market ETF", bond, 100 shares, $7,000 cost, $72/share
10. Verify: asset allocation donut shows stock vs bond split -- AC-2
11. Verify: portfolio total = $18,200, total gain = $1,200 -- AC-1
12. Tap on VTI
13. Verify: detail shows unrealized gain/loss -- AC-5
14. Tap "Update Price", enter $225
15. Verify: value updates to $11,250, gain updates to $1,250 -- AC-6
16. Navigate to Reports
17. Verify: portfolio value chart shows data point -- AC-7
18. Check net worth
19. Verify: investment values included in net worth total -- AC-8
20. Verify: holdings sortable by value, gain, name -- AC-10
21. Open on web at `/budget/investments`
22. Verify: portfolio overview renders with same data
23. Open `/budget/investments/[id]`
24. Verify: holding detail renders

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to `/budget/investments`, test add/update/overview flows
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for portfolio calculation engine

### Post-merge:
- [ ] `/parity-check` -- budget module has archived standalone

## Handoff State

### Before This Work
Budget module has 'investment' account type (V5), net worth snapshots, and basic account balance tracking. No way to track individual holdings, asset allocation, or portfolio performance.

### After This Work
Full investment tracking: add holdings with shares, cost basis, and prices. Portfolio overview with total value, gain/loss, and asset allocation donut. Individual holding detail with unrealized P&L. Manual price updates with snapshot history. Portfolio performance time-series. Net worth integration.

### Files Changed
- `modules/budget/src/engine/investment-tracker.ts` -- Portfolio calculation engine
- `modules/budget/src/db/schema.ts` -- V6: bg_holdings, bg_holding_snapshots tables
- `modules/budget/src/db/crud.ts` -- Holdings and snapshot CRUD
- `modules/budget/src/types.ts` -- Holding, HoldingSnapshot schemas, AssetClass enum
- `modules/budget/src/definition.ts` -- V6 migration
- `modules/budget/src/index.ts` -- Export investment types and engine
- `apps/mobile/app/(budget)/investments.tsx` -- Portfolio overview screen
- `apps/mobile/app/(budget)/holding-detail.tsx` -- Holding detail screen
- `apps/mobile/app/(budget)/add-holding.tsx` -- Add/edit holding form
- `apps/web/app/budget/investments/page.tsx` -- Web portfolio overview
- `apps/web/app/budget/investments/[id]/page.tsx` -- Web holding detail
- `apps/web/app/budget/actions.ts` -- Investment server actions

### Known Limitations
- Manual price entry only (no auto-fetch in v1 for privacy). Future: optional API price fetch.
- No tax lot tracking or FIFO/LIFO cost basis methods (simple average cost basis)
- No dividend tracking as separate income stream
- No options or complex instruments (stocks, bonds, ETFs, mutual funds, REITs, crypto, commodities only)
- Fractional shares use SQLite REAL which has limited precision for very small fractions

### Context for Next Agent
- Use the existing `CHART_COLORS` array from `engine/report-helpers.ts` for allocation chart colors
- Investment account values should feed into `captureSnapshot()` in the net worth engine to keep net worth up to date
- The 'investment' account type was added in V5 via `V5_EXTEND_ACCOUNT_TYPES`
- Holding snapshots serve a dual purpose: portfolio performance chart and net worth history accuracy
- current_value is a denormalized field for query performance -- always recompute it when shares or price changes
