# MyBudget - Feature Gap Design Doc
**Source:** Competitive Feature Analysis (2026-03-05)
**Status:** Implemented (20 tables)

## Current State

MyBudget is a fully implemented envelope budgeting module with a 215-entry subscription catalog, optional bank sync via Plaid, recurring transaction detection, payday detection, savings goals, and CSV import. All local data is stored in SQLite with the `bg_` table prefix. Bank sync is optional and can be disabled for a fully offline experience.

## Competitors Analyzed

| Competitor | Price | Category | Key Strength |
|-----------|-------|----------|-------------|
| YNAB | $109/yr | Envelope budgeting | Methodology, education, 6-user sharing |
| Monarch | $100/yr | Comprehensive finance | Net worth, investment tracking, modern UI |
| Rocket Money | $84-168/yr | Bill management | Subscription cancellation, bill negotiation |
| Copilot | $95/yr | AI-powered finance | Auto-categorization, investment tracking |
| Tiller | $79/yr | Spreadsheet finance | Google Sheets integration, full customization |
| Splitwise | $30/yr | Expense splitting | Group expense splitting, multi-currency |
| Expensify | $60/user/yr | Expense management | Receipt OCR, business expense reports |

## Feature Gaps

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|--------------------------|-------|
| Net worth tracking | P0 | YNAB, Monarch, Copilot, Tiller, Rocket Money | Low | Track assets (bank accounts, investments, property), liabilities (loans, credit cards), and net worth over time. Essential financial overview. |
| Reports/charts dashboard | P1 | YNAB, Monarch, Copilot, Tiller | Medium | Spending trends, category breakdowns, income vs. expense, month-over-month comparisons. Visual financial health at a glance. |
| Investment tracking | P1 | Monarch, Copilot | Medium | Portfolio value, asset allocation pie chart, returns over time. Can start with manual entry, add brokerage sync later. |
| Expense splitting | P1 | Splitwise, Expensify | Medium | Split bills with friends/roommates, running balances, settle-up tracking. Local-first with optional share links. |
| Receipt scanning (OCR) | P1 | Splitwise, Expensify | Medium | Camera capture, extract merchant/amount/date using on-device OCR (Vision framework on iOS, ML Kit on Android). |
| Multi-currency support | P1 | Splitwise, Expensify | Low | Track spending in multiple currencies with exchange rate snapshots. Important for travel and international users. |
| ML auto-categorization | P2 | Monarch, Copilot | Medium | Auto-categorize transactions using on-device ML trained on user's own categorization history. No cloud needed. |
| Loan planner/calculator | P2 | YNAB | Low | Amortization schedules, extra payment scenarios, payoff date projections. Pure math, no external dependencies. |
| Age of Money metric | P2 | YNAB | Low | Calculate how long money sits in accounts before being spent. Good budgeting health indicator. |
| Subscription cancellation assist | P2 | Rocket Money | Low | Direct links to cancel pages for detected subscriptions. Curate cancel URLs in the subscription catalog. |
| Partner/family sharing | P2 | YNAB (6 users) | Medium | Shared budget access for couples/families. Requires sync layer but can start with export/import. |
| Bill negotiation tips | P3 | Rocket Money | Low | Suggestions for lowering bills (switch providers, call retention departments). Static content, low effort. |
| Credit score monitoring | P3 | Rocket Money | High | Requires credit bureau API integration (TransUnion, Equifax). Significant compliance and cost overhead. Deprioritize. |

## Recommended Features to Build

1. **Net worth tracking** - Add an assets and liabilities ledger with a net worth timeline chart. Users manually enter account balances (or auto-pull from Plaid-connected accounts). Track property values, vehicle values, loan balances, and credit card debt. Show net worth trend over time. This is the #1 most-requested feature across all budgeting apps.

2. **Reports/charts dashboard** - Build a visual analytics page with spending by category (pie/bar), income vs. expense (monthly bar chart), spending trends (line chart over time), and top merchants. All computed from existing transaction data in SQLite.

3. **Receipt scanning (OCR)** - Camera capture that extracts merchant name, total amount, date, and optionally line items using on-device OCR. Attach receipt images to transactions. Store images in the app's local file system, not cloud.

4. **Expense splitting** - Split bills with contacts, track running balances, and record settle-up payments. Local-first with optional share links (generate a summary URL or QR code). No account required for the other party.

5. **Investment tracking** - Manual portfolio entry (ticker, shares, cost basis) with price lookups from free APIs (Yahoo Finance, Alpha Vantage). Show total portfolio value, allocation breakdown, and simple returns. Can add brokerage sync via Plaid later.

6. **Multi-currency support** - Add currency field to transactions and accounts. Store exchange rate at time of transaction. Show spending in original currency and home currency. Use free exchange rate APIs for daily rates.

7. **ML auto-categorization** - Train a simple on-device classifier on the user's own categorization history. After enough training data (50-100 categorized transactions), start suggesting categories for new transactions. Runs entirely locally.

8. **Loan planner/calculator** - Amortization schedule generator with extra payment scenarios. Input: principal, rate, term, extra payments. Output: payoff date, total interest, month-by-month schedule. Pure computation, no external dependencies.

9. **Age of Money metric** - Calculate the average age of dollars spent, following YNAB's methodology. Indicates financial buffer health. Computed from transaction timestamps and envelope balances.

10. **Subscription cancellation assist** - For each detected subscription in the 215-entry catalog, provide a direct "Cancel" link to the service's cancellation page. Curate URLs in the catalog data.

## Privacy Competitive Advantage

YNAB, Monarch, and Copilot all require cloud accounts and store your complete financial history on their servers. Your transaction data, income, spending patterns, and net worth are some of the most sensitive personal data that exists. These services have been targets of data breaches and could be compelled to share data with law enforcement or advertisers.

Rocket Money's business model literally involves accessing your accounts to cancel subscriptions on your behalf, requiring deep financial access permissions.

MyBudget keeps everything in local SQLite. Bank sync via Plaid is entirely optional and can be disabled. Receipt images stay on-device. The ML auto-categorization model trains and runs locally. No cloud account needed. No corporation has access to your spending patterns or income.

Marketing angle: "Your finances are between you and your bank. Not you, your bank, and a startup's servers."

## Cross-Module Integration

| Module | Integration |
|--------|------------|
| **MyRecipes** | Grocery spending analysis. Tag grocery transactions and correlate with meal planning. "You spent $X on groceries this week across Y trips." |
| **MyHabits** | Spending habit tracking. "No impulse purchases today" as a trackable habit. Budget check-in streaks. |
| **MyCar** | Auto-categorize fuel and maintenance transactions. Pull fuel costs into MyCar's cost-per-mile calculations. |
| **MyFast** | No direct integration. |
| **MySubs** | Subscription data flows between MyBudget's recurring detection and the subscription catalog. Unified subscription management. |
