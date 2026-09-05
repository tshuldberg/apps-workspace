# Feature Spec: Net Worth Tracking Improvements

## Metadata
- **Module:** budget
- **Priority Score:** 36 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 4 x3 + Complexity 3 x2 + CrossModule 1 x1 + PaidUser 5 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (net worth engine and snapshot table already exist)
- **Blocks:** Investment tracking (P1)

## Business Context

### Why This Feature Exists
Net worth tracking exists in the codebase (engine + snapshots table + CRUD) but the current implementation is minimal: manual snapshot capture, basic total calculation, and a simple timeline builder. Monarch Money ($99.99/yr) and YNAB ($109/yr) both offer rich net worth dashboards with auto-snapshot on transaction import, per-account trend breakdowns, asset vs liability stacked area charts, and milestone celebrations. MyLife's net worth engine works but there's no automated capture, no per-account historical tracking, no visual breakdowns, and the account type system doesn't distinguish investment accounts from checking accounts for net worth grouping. This feature upgrades the existing foundation into a competitor-grade net worth dashboard.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| YNAB | Yes | Yes ($109/yr) | Net worth graph on reports tab. Monthly snapshots auto-captured. Debt accounts tracked. Simple line chart. |
| Monarch Money | Yes | Yes ($99.99/yr) | Rich net worth dashboard. Auto-synced from Plaid. Investment accounts, real estate, crypto. Per-account drill-down. Stacked area chart (assets vs liabilities). Milestones. |
| Copilot | Yes | Yes ($119.88/yr) | Net worth with investment portfolio view. Real-time balance updates. Clean line chart with month-over-month change. |
| Rocket Money | Yes | Yes ($48-144/yr) | Basic net worth tracking. Synced via Plaid. Less visual detail than Monarch/YNAB. |
| PocketGuard | Partial | Yes ($74.99/yr) | Shows account balances but no dedicated net worth trend. |

### Target User
Monarch Money and YNAB users who expect automated net worth tracking with visual breakdowns. Also any financially aware user who wants to answer: "Is my net worth growing?" without maintaining a spreadsheet. Migration path: Monarch user paying $99.99/yr sees MyLife has the same stacked asset/liability visualization at $5/yr.

## Technical Context

### Where This Lives in MyLife

```
modules/budget/src/engine/
  net-worth.ts                -- MODIFY: Add per-account timeline, auto-snapshot trigger, milestone detection
modules/budget/src/db/
  net-worth.ts                -- MODIFY: Add getSnapshotRange, upsertSnapshot
  schema.ts                   -- MODIFY: Extend bg_net_worth_snapshots, add bg_net_worth_milestones
modules/budget/src/types.ts   -- MODIFY: Add milestone types, extended snapshot types
modules/budget/src/definition.ts -- MODIFY: Add V5 migration (or extend into existing V5 if AoM ships first)
apps/mobile/app/(budget)/
  net-worth.tsx               -- NEW: Dedicated net worth detail screen (accessible from Reports > Net Worth or Accounts tab)
apps/web/app/budget/
  net-worth/page.tsx           -- NEW: Dedicated net worth web page
  actions.ts                   -- MODIFY: Add net worth server actions
```

### Wireframe Position

```
Hub Dashboard
  └── MyBudget card
       ├── Budget tab
       ├── Transactions tab
       ├── Subscriptions tab
       ├── Reports tab > Net Worth sub-tab   ← Summary chart here
       ├── Accounts tab                      ← Net worth summary card here
       └── [Net Worth detail screen]         ← Full dashboard (tap from either location)
```

### Data Model

```sql
-- Extend existing bg_net_worth_snapshots with per-account detail column (already has account_balances TEXT)
-- The existing account_balances column stores JSON. No schema change needed for per-account data.

-- NEW: Net worth milestones for celebration moments
CREATE TABLE IF NOT EXISTS bg_net_worth_milestones (
  id TEXT PRIMARY KEY,
  milestone_type TEXT NOT NULL
    CHECK (milestone_type IN ('first_positive', 'round_number', 'all_time_high', 'debt_free', 'custom')),
  value INTEGER NOT NULL,
  achieved_at TEXT NOT NULL,
  dismissed INTEGER NOT NULL DEFAULT 0 CHECK (dismissed IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS bg_net_worth_milestones_type_idx
  ON bg_net_worth_milestones(milestone_type);
CREATE INDEX IF NOT EXISTS bg_net_worth_milestones_achieved_idx
  ON bg_net_worth_milestones(achieved_at DESC);
```

The existing `bg_net_worth_snapshots` table already has:
- `id TEXT PRIMARY KEY`
- `month TEXT NOT NULL UNIQUE` -- YYYY-MM
- `assets INTEGER NOT NULL DEFAULT 0`
- `liabilities INTEGER NOT NULL DEFAULT 0`
- `net_worth INTEGER NOT NULL DEFAULT 0`
- `account_balances TEXT` -- JSON string

The `account_balances` JSON field will be used to store per-account balance breakdowns: `[{id, name, type, balance}]`.

### Dependencies
- **Internal:** `@mylife/budget` (net-worth engine, account CRUD, snapshot CRUD), `@mylife/db` (DatabaseAdapter)
- **External:** None for the engine. The Reports dashboard spec (separate) handles charting library decisions. This spec's UI reuses whatever charting library the Reports spec installs.
- **Cross-Module:** None directly. Future: investment tracking module could feed into net worth.

## Functional Requirements

### User Stories
1. As a budget user, I want net worth snapshots captured automatically so I don't have to remember to log them monthly.
2. As a budget user, I want to see my assets vs liabilities as a stacked area chart so I can visualize both growing over time.
3. As a budget user, I want to see per-account balance trends so I can identify which accounts are growing or shrinking.
4. As a budget user, I want to see month-over-month net worth change (absolute and percentage) so I can track progress.
5. As a budget user, I want milestone celebrations when I hit net worth goals (first positive, round numbers like $10K/$50K/$100K, all-time highs, debt-free) so I stay motivated.
6. As a budget user, I want to see a detailed breakdown of my net worth by account type (checking, savings, credit, investment) so I understand my financial composition.

### Behavior Specification

**Auto-snapshot capture:**
1. Each time any account balance changes (transaction added, account balance updated, bank sync completes), check if the current month's snapshot exists.
2. If it exists, update it with current balances (upsert). If not, create a new one.
3. The snapshot stores: month (YYYY-MM), total assets, total liabilities, net worth, and per-account JSON breakdown.
4. This means net worth history builds automatically without user action.

**Net worth detail screen:**
1. User navigates to the net worth screen (from Reports > Net Worth or Accounts > "View Net Worth" link).
2. Screen shows:
   a. Hero section: Current net worth (large number), month-over-month change (absolute + percentage), color-coded (green if positive change, red if negative).
   b. Stacked area chart: Assets (green area) and liabilities (red area) over time. X-axis: months. Y-axis: dollars.
   c. Net worth line: Overlaid on the stacked area chart as a white line.
   d. Account breakdown section: Grouped by type (Assets: checking, savings, investment | Liabilities: credit, loan). Each account shows current balance and trend arrow.
   e. Milestones section: List of achieved milestones with dates. New (un-dismissed) milestones show a celebration badge.

**Milestone detection:**
1. After each snapshot upsert, run milestone checks:
   - `first_positive`: Net worth crosses from negative to positive for the first time.
   - `round_number`: Net worth crosses $1K, $5K, $10K, $25K, $50K, $100K, $250K, $500K, $1M thresholds.
   - `all_time_high`: Net worth exceeds all previous snapshot values.
   - `debt_free`: Total liabilities reach $0.
2. Each milestone is logged once (UNIQUE on milestone_type + value to prevent duplicates).
3. Un-dismissed milestones show a celebration card on the net worth screen.
4. User can dismiss milestones (sets dismissed = 1).

**Account type mapping for net worth:**
The existing `bg_accounts.type` CHECK constraint allows: `cash`, `checking`, `savings`, `credit`, `other`.
The existing net-worth engine classifies: `checking`, `savings`, `cash`, `investment` as assets; `credit_card`, `loan`, `mortgage` as liabilities.
The V5 migration will extend the accounts type CHECK to include `investment`, `loan`, and `mortgage` for richer net worth grouping.

### Edge Cases

- **No accounts:** Show "Add accounts to track your net worth" with CTA to Accounts tab.
- **All accounts have $0 balance:** Show $0 net worth, chart shows flat line at zero.
- **Only asset accounts (no liabilities):** Liabilities area is empty in the stacked chart. Net worth = assets.
- **Only liability accounts:** Assets area is empty. Net worth is negative. Show appropriate messaging.
- **Very large values (millions):** Format with K/M suffixes on chart axis. Full number in tooltips.
- **Negative net worth crossing to positive:** Trigger `first_positive` milestone.
- **Multiple account type changes in same month:** Snapshot upserts correctly, final snapshot reflects current state.
- **Account archived:** Archived accounts are excluded from future snapshots but historical snapshots retain their data.
- **No snapshot history (brand new user):** Show only current net worth calculation with message "Check back next month to see your trend."
- **account_balances JSON is null on old snapshots:** Handle gracefully. Per-account breakdown only available from snapshots that include it.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Net worth snapshot is automatically captured/updated when an account balance changes
- [ ] **AC-2:** Net worth detail screen shows current net worth with month-over-month change (absolute + percentage)
- [ ] **AC-3:** Stacked area chart shows assets (green) and liabilities (red) over time
- [ ] **AC-4:** Net worth line is overlaid on the stacked area chart
- [ ] **AC-5:** Account breakdown section groups accounts by type and shows individual balances
- [ ] **AC-6:** Milestones are detected and displayed with celebration badges
- [ ] **AC-7:** Milestones can be dismissed by the user
- [ ] **AC-8:** First-positive, round-number ($10K, $100K), all-time-high, and debt-free milestones are all detected correctly
- [ ] **AC-9:** Account types now include investment, loan, and mortgage for proper classification
- [ ] **AC-10:** Net worth screen renders correctly on both mobile and web
- [ ] **AC-11:** Empty state shows helpful message when no accounts exist

### Technical Criteria
- [ ] **TC-1:** Auto-snapshot upserts on the month key (creates if new, updates if exists)
- [ ] **TC-2:** Per-account JSON breakdown is stored in the account_balances field
- [ ] **TC-3:** Milestone detection runs after each snapshot upsert and creates records only for new milestones
- [ ] **TC-4:** V5 migration adds new table and extends account type CHECK without breaking existing data
- [ ] **TC-5:** Net worth calculation handles all account types correctly (assets vs liabilities)
- [ ] **TC-6:** Snapshot CRUD includes getSnapshotRange(startMonth, endMonth) for chart data
- [ ] **TC-7:** Archived accounts are excluded from new snapshot calculations

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Snapshot upsert must NOT create duplicate rows for the same month
- [ ] **NC-2:** Milestones must NOT fire more than once for the same threshold
- [ ] **NC-3:** Net worth calculation must NOT include archived accounts
- [ ] **NC-4:** Auto-snapshot must NOT block the transaction save operation (async/deferred)
- [ ] **NC-5:** Stacked area chart must NOT render with inverted axes (assets always on top)

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#22C55E` (budget green)
- Hero net worth number: 36pt bold, white
- Change indicator: +$X,XXX (+Y.Y%) in green (positive) or -$X,XXX (-Y.Y%) in red (negative)
- Stacked area chart: assets fill `rgba(34,197,94,0.3)` stroke `#22C55E`, liabilities fill `rgba(239,68,68,0.3)` stroke `#EF4444`
- Net worth line: `#F0F0F5` (text token), 2px stroke
- Milestone badge: Accent green background pill with white text

Layout:
```
[Hero Card]
  "Net Worth"
  "$47,250"                         [large, white]
  "+$2,340 (+5.2%) this month"     [green]

[Stacked Area Chart Card]
  [6-month or 12-month view toggle]
  [Chart: green area (assets) + red area (liabilities) + white line (net worth)]

[Account Breakdown Card]
  "Assets"                          [section header]
    Checking    $12,500             [row]
    Savings     $35,000             [row]
    Investment  $8,750              [row]
  "Liabilities"                     [section header]
    Credit Card $9,000              [row]

[Milestones Card]
  "Milestones"
  [🎉 All-time high: $47,250 -- Mar 2026]     [dismissible]
  [✓ Crossed $25,000 -- Jan 2026]              [achieved, dimmed]
```

### Web (Next.js)

- Route: `/budget/net-worth`
- Same tokens via CSS variables
- Responsive: single column mobile, two-column desktop (chart left, breakdown right)
- Chart uses recharts `AreaChart` with stacked areas
- Account breakdown table with sortable columns

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards with pulsing placeholders | Initial data fetch |
| Empty (no accounts) | "Add accounts to start tracking net worth" + CTA | No accounts exist |
| New user (no history) | Current net worth only, "Check back next month for your trend" | Only 1 snapshot |
| Success (positive) | Full dashboard with green trend | Net worth positive and growing |
| Success (negative) | Full dashboard with appropriate colors | Net worth negative |
| Milestone celebration | Animated badge / card for new milestones | New milestone detected |
| Error | "Could not load net worth data" + retry | Data fetch failure |

## Test Requirements

### Unit Tests
- [ ] `calculateNetWorth`: 2 checking ($5000 each) + 1 credit (-$3000) -> assets $10000, liabilities $3000, net $7000
- [ ] `calculateNetWorth`: Empty accounts -> all zeros
- [ ] `calculateNetWorth`: Investment account classified as asset
- [ ] `calculateNetWorth`: Loan and mortgage classified as liability
- [ ] `buildNetWorthTimeline`: 3 monthly snapshots -> 3 points with correct change/changePercent
- [ ] `buildNetWorthTimeline`: Single snapshot -> 1 point with change = 0
- [ ] `detectMilestone`: Net worth crosses $10K -> round_number milestone created
- [ ] `detectMilestone`: Net worth goes from -$500 to $100 -> first_positive milestone
- [ ] `detectMilestone`: Net worth is new all-time high -> all_time_high milestone
- [ ] `detectMilestone`: Liabilities reach $0 -> debt_free milestone
- [ ] `detectMilestone`: Same milestone not detected twice
- [ ] `upsertSnapshot`: Creates new snapshot for new month
- [ ] `upsertSnapshot`: Updates existing snapshot for same month

### Integration Tests
- [ ] Full flow: create 3 accounts -> add transactions -> auto-snapshot captured -> net worth screen shows correct values
- [ ] Milestone flow: start with negative net worth -> add income -> net worth goes positive -> first_positive milestone appears
- [ ] Empty flow: no accounts -> net worth screen shows empty state

### QA Verification Script

1. Open the app on [iOS / web]
2. Navigate to MyBudget > Accounts tab
3. Create checking ($10,000), savings ($25,000), and credit card (-$5,000) accounts
4. Navigate to the net worth detail screen
5. Verify: Hero shows $30,000 net worth -- AC-2
6. Verify: Account breakdown shows assets ($35,000) and liabilities ($5,000) -- AC-5
7. Navigate away and back
8. Verify: Snapshot was auto-captured for current month -- AC-1
9. Modify checking balance to $15,000
10. Verify: Net worth updates to $35,000, change indicator shows +$5,000 -- AC-1, AC-2
11. Verify: Stacked area chart renders (may only have 1 point for new user) -- AC-3, AC-4
12. Verify: Milestones section shows "Crossed $25,000" -- AC-6, AC-8
13. Dismiss the milestone
14. Verify: Milestone no longer shows celebration badge -- AC-7
15. Create a loan account (-$20,000)
16. Verify: Account type "loan" appears under liabilities -- AC-9
17. Verify on web at /budget/net-worth -- AC-10
18. Delete all accounts
19. Verify: Empty state message appears -- AC-11

## gstack Quality Gates

Based on Complexity score 3 (Medium), these gates are required:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to net worth screen, verify all states (empty/new/success/milestone)
- [ ] Batch QA: after 5 features in budget module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for milestone detection

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- budget standalone is archived, N/A for standalone parity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Net worth engine exists: `calculateNetWorth`, `buildNetWorthTimeline`, `captureSnapshot` in `modules/budget/src/engine/net-worth.ts`.
- Snapshot CRUD exists: `modules/budget/src/db/net-worth.ts` with create, get, update, delete operations.
- Snapshot table exists: `bg_net_worth_snapshots` with month, assets, liabilities, net_worth, account_balances columns.
- Account types limited to: `cash`, `checking`, `savings`, `credit`, `other`.
- No auto-snapshot mechanism. No milestones. No per-account trend. No dedicated net worth screen.

### After This Work
- Extended engine with milestone detection, per-account timeline extraction, snapshot range queries.
- New table: `bg_net_worth_milestones`.
- Extended account type CHECK: adds `investment`, `loan`, `mortgage`.
- Auto-snapshot mechanism triggers on account balance changes.
- New screens: mobile net-worth detail, web `/budget/net-worth` page.
- Milestone celebrations appear on net worth screen.

### Files Changed
- `modules/budget/src/engine/net-worth.ts` -- MODIFY: Add detectMilestones, getAccountTimeline, round number thresholds
- `modules/budget/src/engine/__tests__/net-worth.test.ts` -- MODIFY: Add milestone and auto-snapshot tests
- `modules/budget/src/db/net-worth.ts` -- MODIFY: Add upsertSnapshot, getSnapshotRange, milestone CRUD
- `modules/budget/src/db/schema.ts` -- MODIFY: Add bg_net_worth_milestones table, extend account type CHECK
- `modules/budget/src/types.ts` -- MODIFY: Add NetWorthMilestone, MilestoneType Zod schemas
- `modules/budget/src/definition.ts` -- MODIFY: Add V5 migration (milestones table, account type extension)
- `modules/budget/src/index.ts` -- MODIFY: Export new types and functions
- `apps/mobile/app/(budget)/net-worth.tsx` -- NEW: Mobile net worth detail screen
- `apps/web/app/budget/net-worth/page.tsx` -- NEW: Web net worth page
- `apps/web/app/budget/actions.ts` -- MODIFY: Add net worth server actions

### Known Limitations
- **No investment portfolio tracking:** This feature tracks investment account balances but not individual holdings, dividends, or market performance. Investment tracking is a separate P1 feature.
- **No real estate or vehicle values:** Users must create an "other" or "investment" account and manually set the balance. No automated Zillow/KBB integration.
- **Monthly granularity only:** Snapshots are per-month. Users can't see daily net worth fluctuations.
- **No projection/forecasting:** The feature shows historical trend only. Future: extrapolate trend lines.

### Context for Next Agent
- The existing `account_balances` JSON column on `bg_net_worth_snapshots` is the right place for per-account data. Use format: `JSON.stringify([{id, name, type, balance}])`.
- When extending account type CHECK in SQLite, you need to recreate the table (SQLite doesn't support ALTER CHECK). Use the standard pattern: create temp table, copy data, drop original, rename temp. Wrap in a transaction.
- Milestone round-number thresholds in cents: `[100000, 500000, 1000000, 2500000, 5000000, 10000000, 25000000, 50000000, 100000000]` ($1K to $1M).
- Auto-snapshot should be a lightweight function called after account balance writes, not a listener/hook. The calling code (transaction save, account update, bank sync complete) invokes `maybeUpsertMonthlySnapshot(db, accounts)`.
- The Reports > Net Worth sub-tab (from the reports dashboard spec) shows a summary chart. This spec's net worth detail screen shows the full dashboard. They should share the same data-fetching logic.
