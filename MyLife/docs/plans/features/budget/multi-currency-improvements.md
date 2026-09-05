# Feature Spec: Multi-Currency Improvements

## Metadata
- **Module:** budget
- **Priority Score:** 28 / 50 (B-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 2 x3 + Complexity 3 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 3+
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (bg_currencies and bg_exchange_rates tables already exist from V4)
- **Blocks:** none

## Business Context

### Why This Feature Exists
The budget module already has multi-currency infrastructure (bg_currencies, bg_exchange_rates, convertAmount, formatCurrencyAmount, convertToBase) but it's limited to manual rate entry and basic conversion. YNAB ($109/yr) is the only major competitor with full multi-currency support, and it's one of their most requested premium features. Users who travel internationally, earn income in multiple currencies, or have foreign bank accounts need automatic rate fetching, per-transaction currency selection, and consolidated reporting in their base currency. This feature upgrades the existing scaffolding into a production-grade multi-currency system.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| YNAB | Yes | Yes ($109/yr) | Full multi-currency. Auto exchange rate fetch. Per-account currency. Transactions in foreign currency auto-convert. Reports in base currency. |
| Monarch Money | Partial | Yes ($99.99/yr) | USD-only. International users must manually convert. |
| Copilot | No | N/A | USD-only. No multi-currency support. |
| Rocket Money | No | N/A | USD-only. |
| PocketGuard | No | N/A | USD-only. |

### Target User
Expats, digital nomads, frequent travelers, and anyone with income or expenses in multiple currencies. Migration path: YNAB power user paying $109/yr who relies on multi-currency for international budgeting gets the same feature at $5/yr.

## Technical Context

### Where This Lives in MyLife

```
modules/budget/src/
  engine/
    multi-currency.ts            -- MODIFY: Add auto-fetch, historical rates, currency picker logic
  db/
    schema.ts                    -- MODIFY: V6 migration adds bg_exchange_rate_history, extends bg_transactions
    crud.ts                      -- MODIFY: Add exchange rate history CRUD, per-transaction currency ops
  types.ts                       -- MODIFY: Add ExchangeRateHistory, CurrencyPreference schemas
  definition.ts                  -- MODIFY: V6 migration
  index.ts                       -- MODIFY: Export new types and functions
apps/mobile/app/(budget)/
  currency-settings.tsx          -- NEW: Manage currencies, set base, toggle auto-fetch
  currency-converter.tsx         -- NEW: Quick converter tool
apps/web/app/budget/
  settings/currencies/page.tsx   -- NEW: Currency management page
  actions.ts                     -- MODIFY: Add currency server actions
```

### Wireframe Position

```
Hub Dashboard
  └── MyBudget card
       ├── Budget tab
       ├── Transactions tab
       │    └── [Add Transaction] > Currency selector  ← PER-TRANSACTION
       ├── Subscriptions tab
       ├── Reports tab                                 ← ALL CONVERTED TO BASE
       ├── Accounts tab > Per-account currency         ← PER-ACCOUNT
       └── Settings > Currencies                       ← MANAGEMENT SCREEN
```

### Data Model

```sql
-- V6 migration: Exchange rate history for historical conversion accuracy
CREATE TABLE IF NOT EXISTS bg_exchange_rate_history (
  id TEXT PRIMARY KEY,
  from_currency TEXT NOT NULL REFERENCES bg_currencies(code) ON DELETE CASCADE,
  to_currency TEXT NOT NULL REFERENCES bg_currencies(code) ON DELETE CASCADE,
  rate INTEGER NOT NULL,          -- Stored as integer with RATE_PRECISION multiplier
  rate_decimal TEXT NOT NULL,
  effective_date TEXT NOT NULL,    -- YYYY-MM-DD
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'ecb', 'frankfurter', 'cached')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS bg_exchange_rate_history_pair_date_idx
  ON bg_exchange_rate_history(from_currency, to_currency, effective_date DESC);

-- Extend bg_transactions with original currency fields
ALTER TABLE bg_transactions ADD COLUMN original_currency TEXT;
ALTER TABLE bg_transactions ADD COLUMN original_amount INTEGER;
ALTER TABLE bg_transactions ADD COLUMN exchange_rate_used TEXT;
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), existing multi-currency engine (`convertAmount`, `formatCurrencyAmount`, `convertToBase`, `RATE_PRECISION`)
- **External:** Frankfurter API (free, open-source, ECB-based exchange rates, no API key) -- used only for rate fetching, not transaction processing
- **Cross-Module:** `surf` module uses Supabase with USD; no cross-module currency conversion needed currently

## Functional Requirements

### User Stories
1. As a budget user, I want to set my base currency so all reports and totals display in my home currency.
2. As a budget user, I want to add transactions in any currency and have them auto-converted to my base currency.
3. As a budget user, I want exchange rates fetched automatically so I don't have to look them up manually.
4. As a budget user, I want to see the original amount and currency on converted transactions.
5. As a budget user, I want to assign a default currency per account (e.g., EUR for my European bank).
6. As a budget user, I want a quick currency converter tool for on-the-go conversions.

### Behavior Specification

1. User navigates to Settings > Currencies
2. User sets base currency (default: USD, seeded in V4)
3. User adds currencies they use (e.g., EUR, GBP, JPY)
4. System fetches current exchange rates from Frankfurter API (if online)
5. Rates cached locally in bg_exchange_rates; historical rates in bg_exchange_rate_history
6. When adding a transaction, user can select currency (defaults to account currency)
7. If transaction currency differs from base, system converts using latest rate
8. Original amount, currency, and rate stored on transaction for audit trail
9. Reports always aggregate in base currency using the rate at time of transaction
10. User can manually override any exchange rate
11. Rates auto-refresh on app open (if >24 hours stale) with no blocking UI

### Edge Cases

- No network for rate fetch: use last cached rate, show "rates from [date]" indicator
- Currency added with no rate: prompt user to enter manual rate or wait for fetch
- Base currency changed: re-display all reports in new base; stored original amounts unchanged
- Transaction created offline in foreign currency: use cached rate, mark with "estimated" badge
- Rate fetch API down: fall back to last cached rates, retry on next app open
- Currency with non-standard decimal places (JPY has 0, KWD has 3): respect `decimal_places` from bg_currencies
- Extremely volatile rate (>10% change in 24h): show warning before using new rate
- User deletes a currency that has transactions: warn and block deletion; must reassign first

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Currency settings screen lists all added currencies with current rates
- [ ] **AC-2:** Base currency is prominently displayed with a "change" option
- [ ] **AC-3:** Adding a currency triggers automatic rate fetch (if online)
- [ ] **AC-4:** Transaction form shows currency selector defaulting to account currency
- [ ] **AC-5:** Entering an amount in foreign currency shows real-time base-currency equivalent
- [ ] **AC-6:** Transaction list shows original amount + currency for foreign transactions
- [ ] **AC-7:** Reports tab aggregates all amounts in base currency
- [ ] **AC-8:** Quick converter tool converts between any two added currencies
- [ ] **AC-9:** Stale rates (>24h) show amber "last updated" timestamp
- [ ] **AC-10:** Account settings allow setting a default currency per account

### Technical Criteria
- [ ] **TC-1:** Exchange rates fetched from Frankfurter API (ECB-based, free, no API key)
- [ ] **TC-2:** Rates stored with RATE_PRECISION multiplier (existing convention) as integers
- [ ] **TC-3:** Historical rates preserved in bg_exchange_rate_history for audit accuracy
- [ ] **TC-4:** Transaction stores original_currency, original_amount, exchange_rate_used
- [ ] **TC-5:** Rate fetch is non-blocking: UI shows cached rate immediately, updates when fetch completes
- [ ] **TC-6:** Rate auto-refresh triggers on app open if last fetch >24 hours ago
- [ ] **TC-7:** All currency amounts stored as integer cents (existing convention)

### Negative Criteria
- [ ] **NC-1:** Rate fetch failure must NOT block transaction creation
- [ ] **NC-2:** Changing base currency must NOT alter stored transaction amounts
- [ ] **NC-3:** Deleting a currency with existing transactions must NOT be allowed
- [ ] **NC-4:** Exchange rate data must NOT be sent to any service other than Frankfurter API
- [ ] **NC-5:** Currency conversion must NOT use floating-point arithmetic (use integer math with RATE_PRECISION)

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Currency cards: `rgba(255,255,255,0.04)` (glass token) with flag emoji + code + rate
- Module accent: `#22C55E` (budget green)
- Currency selector: bottom sheet with search, flag emojis, sorted by usage frequency
- Rate freshness: green dot (fresh <24h), amber dot (stale 1-7d), red dot (stale >7d)

### Web (Next.js)
- Same tokens via CSS variables
- Route: `/budget/settings/currencies`
- Two-column: currency list left, rate chart/converter right
- Currency selector: dropdown with search and flag icons

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Shimmer on rate values | Rate fetch in progress |
| Empty | "Add your first currency" + popular currency buttons (EUR, GBP, JPY, CAD) | No currencies beyond base |
| Error | "Rates unavailable" + last cached date + retry button | Fetch failed |
| Success | All currencies with current rates and freshness indicators | Rates loaded |
| Partial | Mix of fresh and stale rates | Some rates older than 24h |

## Test Requirements

### Unit Tests
- [ ] `convertAmount`: converts between two currencies using integer rate
- [ ] `convertAmount`: handles same-currency conversion (returns original)
- [ ] `convertAmount`: handles JPY (0 decimal places) correctly
- [ ] `formatCurrencyAmount`: formats with correct symbol and decimal places per currency
- [ ] `fetchRates`: parses Frankfurter API response into ExchangeRate records
- [ ] `fetchRates`: handles API error gracefully, returns null
- [ ] `shouldRefreshRates`: returns true when last fetch >24h ago
- [ ] `getHistoricalRate`: retrieves rate for specific date, falls back to nearest available

### Integration Tests
- [ ] Full flow: add currency -> fetch rate -> create foreign transaction -> verify base conversion
- [ ] Offline flow: cached rate used -> transaction created -> rate updated later -> original unaffected
- [ ] Base currency change: all report aggregations reflect new base

### QA Verification Script

1. Open app on iOS simulator
2. Navigate to MyBudget > Settings > Currencies
3. Verify: USD shown as base currency -- AC-2
4. Tap "Add Currency", search for "EUR"
5. Verify: EUR added with current rate -- AC-1, AC-3
6. Navigate to Transactions tab, tap [+]
7. Verify: currency selector visible, defaults to account currency -- AC-4
8. Select EUR as transaction currency, enter 50.00
9. Verify: base-currency equivalent shown in real-time -- AC-5
10. Save transaction
11. Verify: transaction list shows "EUR 50.00" with conversion note -- AC-6
12. Navigate to Reports tab
13. Verify: foreign transaction aggregated in USD (base) -- AC-7
14. Navigate back to Currencies, tap converter tool
15. Enter 100 EUR
16. Verify: converted to USD using current rate -- AC-8
17. Disconnect network, wait 25 hours (or mock time)
18. Verify: rates show amber "stale" indicator -- AC-9
19. Create a transaction in EUR
20. Verify: transaction created using cached rate -- TC-5, NC-1
21. Navigate to Accounts, tap an account
22. Verify: default currency setting available -- AC-10
23. Attempt to delete EUR (has transactions)
24. Verify: deletion blocked with explanation -- NC-3

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to `/budget/settings/currencies`, test add/convert flows
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for currency conversion engine

### Post-merge:
- [ ] `/parity-check` -- budget module has archived standalone

## Handoff State

### Before This Work
Budget module has bg_currencies (with USD seeded), bg_exchange_rates, and basic conversion functions (convertAmount, formatCurrencyAmount, convertToBase, RATE_PRECISION). All manual rate entry. No auto-fetch, no per-transaction currency tracking, no historical rates.

### After This Work
Full multi-currency system: auto rate fetch from Frankfurter API, per-account default currencies, per-transaction currency selection with original amount preservation, historical rate storage, currency management UI, quick converter tool. All reports aggregate in user's base currency.

### Files Changed
- `modules/budget/src/engine/multi-currency.ts` -- Auto-fetch, historical rates, converter logic
- `modules/budget/src/db/schema.ts` -- V6: bg_exchange_rate_history table, transaction currency columns
- `modules/budget/src/db/crud.ts` -- Exchange rate history CRUD, per-transaction currency ops
- `modules/budget/src/types.ts` -- ExchangeRateHistory, CurrencyPreference schemas
- `modules/budget/src/definition.ts` -- V6 migration
- `modules/budget/src/index.ts` -- Export new types and functions
- `apps/mobile/app/(budget)/currency-settings.tsx` -- Currency management screen
- `apps/mobile/app/(budget)/currency-converter.tsx` -- Quick converter tool
- `apps/web/app/budget/settings/currencies/page.tsx` -- Web currency management
- `apps/web/app/budget/actions.ts` -- Currency server actions

### Known Limitations
- Rates from Frankfurter API update once daily (ECB publishes ~16:00 CET)
- No cryptocurrency support in this version
- No live streaming rates (daily snapshot only)
- Historical rates only available back to ECB's start date (1999-01-04)

### Context for Next Agent
- The existing `RATE_PRECISION` constant in `engine/multi-currency.ts` defines the integer multiplier for rate storage -- all rate math must use this
- `bg_exchange_rates` stores the latest rate; `bg_exchange_rate_history` stores date-keyed rates for historical accuracy
- Frankfurter API base URL: `https://api.frankfurter.app` -- endpoints: `/latest`, `/YYYY-MM-DD`, `/currencies`
- The V4 migration already seeds USD as base currency in bg_currencies
- Per-transaction currency fields (`original_currency`, `original_amount`, `exchange_rate_used`) are nullable for backwards compatibility with existing USD-only transactions
