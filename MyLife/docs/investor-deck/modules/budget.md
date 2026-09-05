# MyBudget — Module Audit

**ID:** budget | **Prefix:** bg_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.1.0 (schema v6)
**One-line promise:** Know where every dollar went, and why

## User Value
- Envelope budgeting that matches YNAB's rigor without the subscription creep or cloud dependency.
- Bank sync via Plaid plus CSV import, with a 215-entry subscription catalog for detection.
- Debt payoff (snowball/avalanche), loan planner, net worth tracking, and age-of-money metric in one place.
- Shared envelopes, expense splits, and family sharing while keeping data on-device by default.
- Weekly digests, alerts, rules, and a reporting engine without ads or third-party tracking.

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---------|--------|--------|
| Envelope + allocations engine | modules/budget/src/engine/budget.ts, allocations.ts | shipped |
| Bank sync (Plaid) | modules/budget/src/bank-sync/, db/schema (bg_bank_*) | shipped |
| Subscription detection + catalog | modules/budget/src/subscriptions/, db/subscription-catalog.ts | shipped |
| Recurring transactions + templates | modules/budget/src/engine/schedule.ts, db/recurring.ts | shipped |
| Debt payoff (snowball/avalanche) | modules/budget/src/engine/debt-payoff.ts | shipped |
| Loan planner | modules/budget/src/engine/loan-planner.ts, db/loans.ts | shipped |
| Net worth + snapshots + milestones | modules/budget/src/engine/net-worth.ts, milestones.ts | shipped |
| Age of money | modules/budget/src/engine/age-of-money.ts | shipped |
| Investment holdings + price history | modules/budget/src/engine/investment-tracker.ts, db/holdings.ts | shipped |
| Multi-currency + exchange rates | modules/budget/src/engine/multi-currency.ts, db/currency.ts | shipped |
| Expense splitting + settlements | modules/budget/src/engine/expense-splitting.ts, db/splitting.ts | shipped |
| Family sharing + shared envelopes | modules/budget/src/engine/family-sharing.ts, db/families.ts | shipped |
| Transaction rules + auto-categorizer | modules/budget/src/engine/transaction-rules.ts, categorizer.ts | shipped |
| Alerts | modules/budget/src/engine/alerts.ts, db/alerts.ts | shipped |
| Weekly digest | modules/budget/src/engine/weekly-digest.ts | shipped |
| Reports + charts | modules/budget/src/engine/reporting.ts, report-helpers.ts | shipped |
| Receipt parser | modules/budget/src/engine/receipt-parser.ts, db/receipts.ts | shipped |
| Payday detection | modules/budget/src/engine/payday-detector.ts | shipped |
| Spending heatmap + pulse | modules/budget/src/engine/spending-heatmap.ts, spending-pulse.ts | shipped |
| No-spend streaks | modules/budget/src/engine/no-spend-streak.ts | shipped |
| Cancellation assist actions | modules/budget/src/db/cancellation-actions.ts | shipped |
| Rollovers | modules/budget/src/engine/rollover.ts, db/rollovers.ts | shipped |
| CSV export + profiles | modules/budget/src/portability.ts, db/csv_profiles (bg_csv_profiles) | shipped |

## Data Model
- Core envelopes + transactions: bg_envelopes, bg_transactions, bg_transaction_splits, bg_split_participants, bg_settlements, bg_expense_splits, bg_category_groups, bg_budget_allocations, bg_budget_rollovers.
- Bank sync: bg_bank_connections, bg_bank_accounts, bg_bank_sync_state, bg_bank_transactions_raw, bg_bank_webhook_events, bg_accounts, bg_sync_log.
- Subscriptions + recurring: bg_subscriptions, bg_recurring_templates, bg_cancellation_actions.
- Money mgmt: bg_goals, bg_loans, bg_loan_payments, bg_debt_payoff_plans, bg_debt_payoff_debts, bg_holdings, bg_holding_snapshots, bg_price_history, bg_net_worth_snapshots, bg_net_worth_milestones, bg_age_of_money_snapshots.
- Sharing: bg_families, bg_family_members, bg_shared_envelopes, bg_envelope_sharing, bg_contacts.
- Rules + alerts: bg_transaction_rules, bg_payee_cache, bg_categorization_feedback, bg_budget_alerts, bg_alert_history, bg_notification_log.
- Currency: bg_currencies, bg_exchange_rates, bg_exchange_rate_history.
- Misc: bg_receipts, bg_csv_profiles, bg_settings.

## Screens / User Flows
- Mobile: apps/mobile/app/(budget)/ -- index, (tabs), [id], account/, goal/, debt-payoff/, net-worth, investments, loan-planner, age-of-money, family, alerts, currencies, future-months, cash-flow, category-target, checklist, connect-bank, import-csv, create, help, income.
- Web: apps/web/app/budget/ -- page, transactions/, transaction/, envelope/, accounts/, goals/, reports/, charts.tsx, debt-payoff/, loan-planner/, investments/, net-worth/, currencies/, family/, alerts/, rules/, subscriptions/, splitting/, onboarding/, no-spend/, weekly-digest/, review/, age-of-money/, income/, help/, settings/.

## Distinctive / Moat-worthy
- All YNAB + Monarch + Copilot features in one local-first SQLite file, no monthly fee.
- Built-in 215-entry subscription catalog and cancellation action log; Rocket Money style without the concierge markup.
- Family sharing without an account system (envelope-scoped CRDT-friendly sharing).
- Investment tracker embedded alongside envelopes, which neither YNAB nor Rocket Money does.

## Gaps vs competitors (from COMPETITIVE-MATRIX)
- [ ] Reports/charts dashboard (P1) -- partially shipped (engine/reporting.ts, web charts.tsx); polish needed.
- [ ] Receipt OCR (P1) -- parser exists, OCR pipeline not verified.
- [ ] ML auto-categorization (P2) -- rules + feedback shipped, ML layer pending.
- [ ] Net worth improvements (P0) -- snapshots shipped, UI polish needed.

## Investor-facing hook
MyBudget delivers YNAB + Monarch + Rocket Money in a single offline-first file, turning three $100/yr subscriptions into one suite line item.
