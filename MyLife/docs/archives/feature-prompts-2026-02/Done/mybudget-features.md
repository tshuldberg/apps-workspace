# MyBudget Feature Set

## Problem Statement

You are working in the MyLife monorepo at `/Users/trey/Desktop/Apps/MyLife/`. MyLife is a unified hub app consolidating 10+ privacy-first personal app modules into a single cross-platform application. Each module implements a `ModuleDefinition` contract from `@mylife/module-registry` and stores data in a shared SQLite database using table-name prefixes (`bg_` for budget).

**MyBudget** is a privacy-first envelope budgeting app with integrated subscription tracking. The standalone source of truth lives at `/Users/trey/Desktop/Apps/MyLife/MyBudget/`, a Turborepo monorepo with `packages/shared/src/` containing: db schema (13 tables), budget engine, subscription engine with renewal/cost/status lifecycle, 215-entry subscription catalog, CSV parser, Zod models, and bank sync (Plaid). The hub module lives at `modules/budget/` with passthrough web routes in `apps/web/app/budget/`.

**What already exists:** Accounts (checking/savings/credit/cash), envelope budgeting with category groups and targets, transactions with split support, recurring templates, 200+ subscription catalog with lifecycle management (active/cancelled/trial/past-due), Plaid bank sync, CSV import/export, payee cache, goals with targets, transaction rules for auto-categorization, income estimator, payday detector, net cash calculator. The shared package at `MyBudget/packages/shared/src/` contains: `db/`, `engine/`, `subscriptions/`, `catalog/`, `csv/`, `models/`, `bank-sync/`, `utils/`. 200 tests currently passing.

**Consolidation context:** MyBudget absorbs **MySubs**. The subscription tracking catalog is already built into MyBudget (215 entries). No additional MySubs work is needed. MyBudget is the single destination for all budgeting and subscription management.

**What needs to be built (2 feature sets):**

### Feature Set 1: Reporting, Analytics, and Visualization

YNAB and Copilot Money differentiate with rich spending insights. MyBudget has the transaction data but no visualization layer. Users cannot see spending trends, category breakdowns, or net worth over time.

**Features:**
- Spending reports dashboard with charts (pie for category breakdown, bar for monthly trends, line for spending over time)
- Date range filters (this month, last month, quarter, year, custom range)
- Net worth tracking: assets minus liabilities over time, with a line chart showing trajectory
- Debt payoff planning with snowball and avalanche strategies, including interest rate calculations and projected payoff dates
- Budget rollover / carry-forward: unspent envelope amounts roll into the next month automatically
- Scheduled and upcoming transactions view (calendar or timeline format showing what is coming due)

### Feature Set 2: Alerts, Multi-Currency, and Sharing

Power features that move MyBudget from personal tool to household financial hub.

**Features:**
- Budget notifications and alerts: configurable thresholds (80% and 100% of envelope target) with push notifications and in-app banners
- Multi-currency support: per-account currency, exchange rate lookup, unified reporting in a base currency
- Household/partner sharing: local sync between two devices (no cloud required), shared envelopes with individual + joint views

---

## Acceptance Criteria

### Feature Set 1: Reporting, Analytics, and Visualization

1. User navigates to Reports tab -> sees a spending dashboard with a pie chart showing category breakdown for the current month, a bar chart showing monthly spending for the last 6 months, and total spent vs. total budgeted summary
2. User taps a date range picker and selects "Last Quarter" -> all charts and totals update to reflect only transactions within that date range
3. User opens Net Worth screen and adds asset accounts (home, investments) and liability accounts (mortgage, student loan) with balances -> sees a line chart showing net worth trajectory with monthly data points
4. User selects "Debt Payoff Planner" and chooses "Avalanche" strategy -> sees debts ordered by interest rate (highest first) with projected payoff date, total interest paid, and a month-by-month amortization schedule
5. User enables "Rollover" on a grocery envelope with $50 remaining at month end -> the next month's grocery envelope starts with $50 + the new month's target amount
6. User opens "Upcoming" view -> sees a timeline of scheduled transactions for the next 30 days, grouped by date, with amounts and payees

### Feature Set 2: Alerts, Multi-Currency, and Sharing

7. User sets a budget alert at 80% on the "Dining Out" envelope -> when spending reaches 80% of the target, a push notification fires and an in-app banner appears on the budget screen
8. User creates a checking account denominated in EUR and logs a transaction -> the transaction stores in EUR; the reports dashboard converts to the user's base currency (USD) using a stored exchange rate
9. User invites a partner via a local pairing code -> both devices see shared envelopes; each user's personal envelopes remain private

---

## Constraint Architecture

**Musts:**
- All data stored in local SQLite with `bg_` table prefix (new tables: `bg_net_worth_snapshots`, `bg_debt_payoff_plans`, `bg_budget_rollovers`, `bg_alerts`, `bg_alert_history`, `bg_currencies`, `bg_exchange_rates`, `bg_shared_envelopes`)
- Charts rendered client-side using a lightweight library (prefer `react-native-svg-charts` on mobile, SVG or Canvas on web)
- Rollover logic runs automatically at month boundary via the budget engine
- Debt payoff calculator must handle compound interest with monthly/daily compounding options
- Both standalone (`MyBudget/`) and hub module (`modules/budget/`) must receive changes in the same session

**Must-nots:**
- Do not remove or modify existing 13 tables
- Do not add cloud sync for the core budget data (sharing uses local/LAN pairing only)
- Do not depend on external APIs for exchange rates at runtime (allow manual entry; optional API fetch is a preference, not a must)
- Do not modify `packages/module-registry/` or other modules
- Do not break existing 200 passing tests

**Preferences:**
- Extend the existing budget engine in `MyBudget/packages/shared/src/engine/` rather than creating a parallel calculation system
- Use the existing transaction rules system to auto-detect recurring transactions for the "Upcoming" view
- For multi-currency, store exchange rates locally and let users update manually; optionally fetch from a free API (e.g., exchangerate-api.com) if the user taps "Refresh Rates"
- For sharing, use a local-first sync protocol (e.g., CRDT or simple last-write-wins with device ID)

**Escalation triggers:**
- If the existing budget engine architecture cannot support rollover without a significant rewrite, stop and document the required changes
- If multi-currency conversion introduces floating-point precision issues with existing integer-cents storage, flag for a storage format decision
- If local device pairing requires native Bluetooth/WiFi Direct modules not in the Expo ecosystem, defer sharing to a later phase

---

## Subtask Decomposition

**Subtask 1: Reporting Data Layer (90 min)**
Build query functions in the shared package for: spending by category (with date range), monthly spending trend (6-12 months), total budgeted vs. spent, and top payees. Return typed result objects ready for chart rendering. Write unit tests against seeded data.

**Subtask 2: Reports UI with Charts (90 min)**
Build the Reports screen with pie chart (category breakdown), bar chart (monthly trend), and summary cards. Add date range picker (this month, last month, quarter, year, custom). Wire to the data layer queries.

**Subtask 3: Net Worth and Debt Payoff (90 min)**
Add `bg_net_worth_snapshots` and `bg_debt_payoff_plans` tables. Build net worth tracking (manual balance entries, monthly snapshots, line chart). Build debt payoff calculator with snowball and avalanche strategies, interest compounding, and projected payoff dates.

**Subtask 4: Budget Rollover and Upcoming Transactions (60 min)**
Add `bg_budget_rollovers` table. Implement automatic rollover logic in the budget engine that carries forward unspent amounts at month end. Build the "Upcoming" view that queries recurring templates and scheduled transactions for the next 30 days.

**Subtask 5: Alerts and Notifications (60 min)**
Add `bg_alerts` and `bg_alert_history` tables. Build threshold-based alert system (configurable per envelope at 80%/100% or custom). Fire push notifications via Expo Notifications on mobile and browser Notification API on web.

**Subtask 6: Multi-Currency Foundation (60 min)**
Add `bg_currencies` and `bg_exchange_rates` tables. Add currency field to accounts. Build conversion utilities for reporting. Store exchange rates locally with optional manual refresh.

---

## Evaluation Design

1. **Reporting queries:** Seed 100 transactions across 5 categories over 3 months -> `getSpendingByCategory({dateRange: 'this-month'})` returns correct totals per category for the current month only
2. **Rollover:** Set grocery envelope target to $500, spend $450 -> at month rollover, next month's available = $50 + $500 = $550
3. **Debt payoff:** Enter $10,000 at 18% APR with $300/month minimum -> avalanche calculator projects payoff date and total interest within 1% of manual calculation
4. **Alerts:** Set 80% alert on a $100 envelope, log $81 of spending -> alert fires and appears in `bg_alert_history`
5. **Type safety and tests:** `pnpm typecheck` exits 0; `pnpm test` passes (existing 200 + new tests); `pnpm check:parity` exits 0
