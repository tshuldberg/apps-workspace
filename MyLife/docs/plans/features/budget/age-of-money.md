# Feature Spec: Age of Money Metric

## Metadata
- **Module:** budget
- **Priority Score:** 38 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 4 x3 + Complexity 4 x2 + CrossModule 1 x1 + PaidUser 5 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (transaction data and accounts already exist)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Age of Money (AoM) is YNAB's signature financial health metric, showing users how many days old the money they spend today actually is. A higher AoM means you're spending money that's been in your account longer, indicating you're living on last month's income rather than this month's. This is the single most powerful behavioral nudge in envelope budgeting because it gives users one number to optimize. YNAB charges $109/yr and prominently features this metric on their dashboard.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| YNAB | Yes | Yes ($109/yr) | Age of Money on dashboard. Rolling 10-transaction average. Counts days between inflow and outflow. Goal: 30+ days. Also tracks "Days of Buffering" as a secondary metric. |
| Monarch Money | No | N/A | No equivalent metric. Has net worth and cash flow but not AoM. |
| Copilot | No | N/A | No equivalent metric. Focuses on spending insights instead. |
| Rocket Money | No | N/A | No equivalent metric. Focuses on subscription/bill tracking. |
| PocketGuard | No | N/A | Has "In My Pocket" (remaining spendable) but not AoM. |

### Target User
YNAB users paying $109/yr who are already trained on the AoM concept and expect it in any serious budgeting app. Also budget-conscious users who want a single "health score" for their finances without reading charts. The migration path: YNAB user sees MyLife has AoM, recognizes it as a serious budgeting tool, not a toy.

## Technical Context

### Where This Lives in MyLife

```
modules/budget/src/engine/
  age-of-money.ts             -- NEW: AoM calculation engine (pure functions)
  age-of-money.test.ts        -- NEW: Unit tests for AoM engine
modules/budget/src/db/
  age-of-money.ts             -- NEW: AoM snapshot CRUD (bg_age_of_money_snapshots)
modules/budget/src/db/schema.ts -- MODIFY: Add bg_age_of_money_snapshots table
modules/budget/src/types.ts     -- MODIFY: Add AoM Zod schemas
modules/budget/src/definition.ts -- MODIFY: Add V5 migration
modules/budget/src/index.ts     -- MODIFY: Export new engine + types
apps/mobile/app/(budget)/
  budget.tsx                    -- MODIFY: Add AoM card to budget dashboard
apps/web/app/budget/
  page.tsx                      -- MODIFY: Add AoM card to budget dashboard
```

### Wireframe Position

```
Hub Dashboard
  └── MyBudget card
       ├── Budget tab           ← AoM card shows here (top of budget dashboard)
       ├── Transactions tab
       ├── Subscriptions tab
       ├── Reports tab          ← AoM trend also visible on Reports > Overview
       └── Accounts tab
```

The AoM metric appears as a prominent card at the top of the Budget tab, showing the current number with a trend indicator (up/down arrow vs last month). The user taps the card to see a detail view with the historical AoM trend.

### Data Model

```sql
-- V5 Migration: Age of Money snapshots for trend tracking
CREATE TABLE IF NOT EXISTS bg_age_of_money_snapshots (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  age_days INTEGER NOT NULL,
  sample_size INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date)
);

CREATE INDEX IF NOT EXISTS bg_age_of_money_snapshots_date_idx
  ON bg_age_of_money_snapshots(date DESC);
```

No changes to existing tables. The engine computes AoM from `bg_transactions` (inflows and outflows) and `bg_accounts` (current balances).

### Dependencies
- **Internal:** `@mylife/budget` (transaction CRUD, account CRUD, existing engine types), `@mylife/db` (DatabaseAdapter)
- **External:** None. Pure calculation engine.
- **Cross-Module:** None. AoM is budget-internal.

## Functional Requirements

### User Stories
1. As a budget user, I want to see how old the money I'm spending is so I know if I'm living on last month's income or this month's.
2. As a budget user, I want to see my AoM trend over time so I can tell if my financial behavior is improving.
3. As a budget user, I want a clear explanation of what AoM means so I can understand the metric without prior YNAB experience.
4. As a budget user, I want daily AoM snapshots captured automatically so I can track my progress without manual action.

### Behavior Specification

**How Age of Money is calculated (YNAB method):**

The FIFO queue approach:
1. Build a queue of all inflows (deposits, income) ordered by date, each with their remaining amount.
2. For the most recent N outflow transactions (default: 10), calculate how old the money was that funded each outflow by consuming from the inflow queue in FIFO order.
3. The "age" of a single outflow is: `today - date of the inflow that funded it` (in days).
4. AoM = average age across the sample of recent outflows.

Step-by-step:
1. Fetch all transactions ordered by date ascending.
2. Build an inflow queue: `[{date, remainingAmount}]` -- each inflow starts with its full amount as remaining.
3. For the last 10 outflows (configurable via `sampleSize`), simulate spending:
   a. Take the oldest inflow with remaining > 0.
   b. Deduct the outflow amount from that inflow's remaining.
   c. If the outflow exceeds the inflow's remaining, continue to the next inflow (split across inflows).
   d. Record the weighted average age for this outflow based on the inflows consumed.
4. Average the ages across all sampled outflows.
5. Result is a single integer: days.

**Displaying AoM on the Budget dashboard:**
1. User opens the Budget tab.
2. At the top, a card shows: "Age of Money: X days" with a colored indicator.
3. Color coding: < 14 days = red (urgent), 14-29 days = yellow (improving), 30+ days = green (healthy).
4. Below the number: a small sparkline showing the last 30 days of AoM snapshots.
5. Below the sparkline: a trend indicator showing change from last month ("up 5 days" or "down 3 days").
6. Tapping the card expands to show a detailed explanation and a full AoM trend chart.

**AoM snapshot capture:**
1. Each time the Budget tab is opened, check if today's snapshot exists.
2. If not, compute the current AoM and save a snapshot.
3. This gives passive daily tracking without requiring a background process.

### Edge Cases

- **No inflows at all:** AoM is undefined. Display "Add income transactions to calculate your Age of Money" with a CTA.
- **No outflows at all:** AoM is undefined (no spending to measure). Display "Start tracking spending to see your Age of Money."
- **Fewer than 10 outflows:** Use whatever outflows exist (minimum 1). Label shows "Based on X transactions."
- **Very old inflows (years):** AoM can be hundreds of days. Cap display at 365+ days with a congratulatory message.
- **Inflow queue exhausted:** If total outflows exceed total inflows (net negative), the remaining outflows have age 0 (they were funded by deficit/credit). Include these in the average.
- **Transfer transactions:** Exclude transfers from both inflow queue and outflow sample. Transfers move money between accounts, they don't represent income or spending.
- **Split transactions:** Use the full transaction amount, not individual split amounts. The split is for envelope categorization, not for AoM accounting.
- **Module disabled mid-computation:** Engine is a pure function, no side effects. Safe to abort.
- **First-time user with no history:** Show an onboarding card explaining AoM with a "Learn More" link.
- **Large transaction history (10,000+ transactions):** Engine processes sequentially. Performance target: < 200ms for 10,000 transactions. If needed, limit lookback window to 12 months.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Budget tab shows an AoM card with the current value in days
- [ ] **AC-2:** AoM card shows color indicator: red (<14 days), yellow (14-29), green (30+)
- [ ] **AC-3:** AoM card shows a sparkline of the last 30 days
- [ ] **AC-4:** AoM card shows a trend indicator (change from 30 days ago)
- [ ] **AC-5:** Tapping the AoM card shows a detail view with explanation and full trend chart
- [ ] **AC-6:** With no transactions, AoM card shows a helpful empty state with CTA
- [ ] **AC-7:** AoM updates each time the Budget tab is opened (daily snapshot)
- [ ] **AC-8:** AoM renders correctly on both mobile (Expo) and web (Next.js)
- [ ] **AC-9:** Explanation text is clear and understandable to users unfamiliar with YNAB's AoM concept

### Technical Criteria
- [ ] **TC-1:** `calculateAgeOfMoney` returns correct value for known test scenarios (see test cases below)
- [ ] **TC-2:** FIFO queue correctly handles split funding across multiple inflows
- [ ] **TC-3:** Transfers are excluded from both inflow queue and outflow sample
- [ ] **TC-4:** AoM computation completes in < 200ms for 10,000 transactions
- [ ] **TC-5:** Snapshots are saved to `bg_age_of_money_snapshots` with UNIQUE(date) constraint
- [ ] **TC-6:** V5 migration creates the new table without affecting existing data
- [ ] **TC-7:** Engine functions are pure (no side effects, no database calls in engine layer)

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** AoM calculation must NOT include transfer transactions
- [ ] **NC-2:** AoM must NOT modify any transaction or account data (read-only computation)
- [ ] **NC-3:** AoM must NOT crash or throw on empty transaction history
- [ ] **NC-4:** AoM snapshot must NOT overwrite existing snapshots for the same date
- [ ] **NC-5:** AoM must NOT block the UI thread (computation runs in server action / async)

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- AoM Card: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#22C55E` (budget green)
- AoM number: Large bold text (32pt), color-coded (red/yellow/green)
- Sparkline: Thin line (2px stroke), accent green, inside the card (height: 40px)
- Trend indicator: Small text below sparkline, up arrow (green) or down arrow (red)

Layout:
```
[AoM Card -- full width, top of Budget tab]
  "Age of Money"                    [i info icon]
  "47 days"                         [large, green]
  [sparkline ~~~~~~~~~~~~]          [30-day trend]
  "Up 5 days from last month"      [small, green]
```

Tapped detail view (modal or expanded card):
```
[AoM Detail]
  "Age of Money: 47 days"
  "Your Age of Money measures how long dollars sit in your
   account before you spend them. A higher number means
   you're spending older money, which indicates you're
   ahead of your bills."
  [Full trend chart -- line chart, last 6 months]
  "Based on your last 10 transactions"
```

### Web (Next.js)

- Same tokens via CSS variables
- AoM card at top of `/budget` dashboard page
- Sparkline uses a lightweight inline SVG (no charting library needed for sparkline)
- Detail view renders inline (expandable section) rather than modal
- Responsive: card is full-width on mobile, max-width 400px on desktop

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton card with pulsing placeholder | Initial AoM computation |
| Empty (no income) | "Add income transactions to track Age of Money" | No inflow transactions |
| Empty (no spending) | "Start tracking spending to see Age of Money" | No outflow transactions |
| Healthy (30+ days) | Green number, up-trend sparkline | AoM >= 30 |
| Improving (14-29 days) | Yellow number, positive trend | 14 <= AoM < 30 |
| Urgent (<14 days) | Red number, possibly declining trend | AoM < 14 |
| Error | "Could not calculate Age of Money" + retry | Computation failure |

## Test Requirements

### Unit Tests
- [ ] `calculateAgeOfMoney`: 3 inflows ($1000 each on Jan 1, Feb 1, Mar 1), 10 outflows ($100 each) on Mar 15 -> AoM should be ~74 days (spending Jan money)
- [ ] `calculateAgeOfMoney`: Single inflow today, single outflow today -> AoM = 0 days
- [ ] `calculateAgeOfMoney`: Inflows 30 days ago, all outflows today -> AoM = 30 days
- [ ] `calculateAgeOfMoney`: Empty transactions -> returns null (not computable)
- [ ] `calculateAgeOfMoney`: Only inflows, no outflows -> returns null
- [ ] `calculateAgeOfMoney`: Only outflows, no inflows -> AoM = 0 (deficit spending)
- [ ] `calculateAgeOfMoney`: Transfers excluded from both queues
- [ ] `calculateAgeOfMoney`: Outflow split across multiple inflows computes weighted average age
- [ ] `calculateAgeOfMoney`: Sample size parameter (default 10) limits outflows considered
- [ ] `buildFifoQueue`: Correctly orders inflows by date ascending
- [ ] `buildFifoQueue`: Skips negative amounts (outflows) and zero amounts
- [ ] `captureAoMSnapshot`: Creates snapshot with correct date and age value

### Integration Tests
- [ ] Full flow: add 5 income transactions over 3 months, add 10 expense transactions -> AoM card shows correct value
- [ ] Snapshot flow: open Budget tab -> snapshot saved -> close and reopen -> same snapshot, no duplicate
- [ ] Empty flow: no transactions -> empty state card without errors

### QA Verification Script

1. Open the app on [iOS / web]
2. Navigate to MyBudget > Budget tab
3. Verify: AoM card is visible at the top of the dashboard -- AC-1
4. Verify: AoM shows a number in days with appropriate color (green if 30+) -- AC-2
5. Verify: Sparkline shows a 30-day trend line -- AC-3
6. Verify: Trend text shows change from previous period -- AC-4
7. Tap the AoM card
8. Verify: Detail view shows explanation text and full trend chart -- AC-5, AC-9
9. Navigate away and back to Budget tab
10. Verify: AoM updates without creating a duplicate snapshot -- AC-7
11. Create a new account with no transactions
12. Navigate to Budget tab
13. Verify: AoM shows empty state with helpful message -- AC-6
14. Verify on web at /budget
15. Verify: Same AoM card renders with correct styling -- AC-8
16. Add 3 income transactions (different dates) and 5 expense transactions
17. Verify: AoM computes and displays correctly based on FIFO method -- TC-1

## gstack Quality Gates

Based on Complexity score 4 (Small), these gates are required:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to /budget, verify AoM card in all states (healthy/improving/urgent/empty)

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for the AoM FIFO engine

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- budget standalone is archived, N/A for standalone parity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Budget module has 29 tables, V4 schema, 176 tests across 15 test files.
- Transaction data model supports inflows/outflows with direction field.
- Account data model tracks current balances.
- No AoM calculation exists anywhere in the codebase.
- Budget dashboard exists on both mobile and web.

### After This Work
- New engine: `modules/budget/src/engine/age-of-money.ts` with `calculateAgeOfMoney`, `buildFifoQueue`, and helper functions.
- New CRUD: `modules/budget/src/db/age-of-money.ts` for snapshot persistence.
- New table: `bg_age_of_money_snapshots` (V5 migration).
- Updated types: AoM Zod schemas in `modules/budget/src/types.ts`.
- Updated dashboard: AoM card on both mobile and web Budget tab.
- Tests cover engine logic, edge cases, and snapshot CRUD.

### Files Changed
- `modules/budget/src/engine/age-of-money.ts` -- NEW: AoM FIFO calculation engine
- `modules/budget/src/engine/__tests__/age-of-money.test.ts` -- NEW: Engine unit tests
- `modules/budget/src/db/age-of-money.ts` -- NEW: Snapshot CRUD
- `modules/budget/src/db/schema.ts` -- MODIFY: Add bg_age_of_money_snapshots CREATE + index
- `modules/budget/src/types.ts` -- MODIFY: Add AoMSnapshot Zod schema
- `modules/budget/src/definition.ts` -- MODIFY: Add V5 migration
- `modules/budget/src/index.ts` -- MODIFY: Export AoM engine + types
- `apps/mobile/app/(budget)/budget.tsx` -- MODIFY: Add AoM card component
- `apps/web/app/budget/page.tsx` -- MODIFY: Add AoM card component
- `apps/web/app/budget/actions.ts` -- MODIFY: Add fetchAgeOfMoney server action

### Known Limitations
- **No automatic daily snapshots:** Snapshots are captured on Budget tab open. Users who don't open the app daily will have gaps. A future background task could fill gaps.
- **No "Days of Buffering" metric:** YNAB also offers this secondary metric (how many days your current balance can cover). This is a separate future feature.
- **12-month lookback limit:** For performance, the engine only looks back 12 months. Users with longer histories may see slightly different values than if all history were included.
- **No per-account AoM:** The metric is calculated across all accounts combined. Per-account AoM is a future enhancement.

### Context for Next Agent
- The engine must be a pure function. The database layer (snapshot CRUD) is separate from the engine.
- Transaction mapping: `BudgetTransaction` uses `direction` ('inflow'/'outflow'/'transfer') and `amount` (always positive cents). For the FIFO queue, use inflow transactions sorted by `occurred_on` ascending. For the outflow sample, take the most recent N non-transfer outflows.
- The sparkline on the AoM card should be a simple inline SVG path, not a full charting library. It only needs 30 data points.
- V5 migration must be additive (new table only). Do not alter existing tables.
- YNAB uses a rolling 10-transaction sample. Make this configurable via a `sampleSize` parameter (default 10) so it can be tuned later.
