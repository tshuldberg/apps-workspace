# Feature Spec: Loan Planner

## Metadata
- **Module:** budget
- **Priority Score:** 28 / 50 (B-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 2 x3 + Complexity 3 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 3+
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (debt payoff engine and loan/mortgage account types already exist from V5)
- **Blocks:** none

## Business Context

### Why This Feature Exists
The budget module already has a debt payoff engine (snowball/avalanche strategies, amortization schedules) but lacks a dedicated loan planning tool. YNAB is the only major competitor with full loan tracking, and users with student loans, car loans, mortgages, or personal loans need a purpose-built interface to plan new loans, compare terms, visualize total interest cost, and track payoff progress. The existing debt payoff planner focuses on optimizing existing debts; the loan planner focuses on evaluating and tracking individual loan terms before and during the loan lifecycle.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| YNAB | Yes | Yes ($109/yr) | Loan accounts with tracking. Shows principal vs interest breakdown. Links to budget categories. Amortization visualization. |
| Monarch Money | No | N/A | Tracks loan accounts via Plaid balance but no amortization or planning tools. |
| Copilot | No | N/A | Shows loan account balances. No planning calculator. |
| Rocket Money | No | N/A | Basic balance display. No loan planning. |
| PocketGuard | No | N/A | No loan planning tools. |

### Target User
Anyone with loans (student, auto, mortgage, personal) who wants to understand their total interest cost, compare refinancing options, and track principal vs interest over time. Migration path: YNAB user who values loan tracking and planning at a fraction of the cost.

## Technical Context

### Where This Lives in MyLife

```
modules/budget/src/
  engine/
    loan-planner.ts              -- NEW: Loan calculation engine (amortization, comparison, what-if)
  db/
    schema.ts                    -- MODIFY: V6 migration adds bg_loans table
    crud.ts                      -- MODIFY: Add loan CRUD
  types.ts                       -- MODIFY: Add Loan, LoanInsert, LoanPayment schemas
  definition.ts                  -- MODIFY: V6 migration
  index.ts                       -- MODIFY: Export loan types and engine
apps/mobile/app/(budget)/
  loans.tsx                      -- NEW: Loan list and summary screen
  loan-detail.tsx                -- NEW: Individual loan detail with amortization chart
  loan-calculator.tsx            -- NEW: New loan / refinance comparison calculator
apps/web/app/budget/
  loans/page.tsx                 -- NEW: Loan management page
  loans/[id]/page.tsx            -- NEW: Loan detail page
  actions.ts                     -- MODIFY: Add loan server actions
```

### Wireframe Position

```
Hub Dashboard
  └── MyBudget card
       ├── Budget tab
       ├── Transactions tab
       ├── Subscriptions tab
       ├── Reports tab
       ├── Accounts tab
       │    └── Loan/Mortgage accounts > "View Loan Details"  ← ENTRY FROM ACCOUNTS
       └── Loans (new sub-section or linked from Accounts)    ← DEDICATED VIEW
```

### Data Model

```sql
-- V6 migration: Dedicated loan tracking
CREATE TABLE IF NOT EXISTS bg_loans (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES bg_accounts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  loan_type TEXT NOT NULL
    CHECK (loan_type IN ('mortgage', 'auto', 'student', 'personal', 'heloc', 'business', 'other')),
  original_principal INTEGER NOT NULL,   -- cents
  current_balance INTEGER NOT NULL,      -- cents (updated as payments are made)
  interest_rate INTEGER NOT NULL,        -- basis points (e.g., 650 = 6.50%)
  term_months INTEGER NOT NULL,
  start_date TEXT NOT NULL,              -- YYYY-MM-DD
  monthly_payment INTEGER NOT NULL,      -- cents (calculated or manual)
  extra_payment INTEGER NOT NULL DEFAULT 0,
  compounding TEXT NOT NULL DEFAULT 'monthly'
    CHECK (compounding IN ('monthly', 'daily')),
  lender TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bg_loan_payments (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL REFERENCES bg_loans(id) ON DELETE CASCADE,
  transaction_id TEXT REFERENCES bg_transactions(id) ON DELETE SET NULL,
  payment_date TEXT NOT NULL,
  total_amount INTEGER NOT NULL,         -- cents
  principal_amount INTEGER NOT NULL,     -- cents
  interest_amount INTEGER NOT NULL,      -- cents
  extra_amount INTEGER NOT NULL DEFAULT 0,
  remaining_balance INTEGER NOT NULL,    -- cents
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS bg_loans_active_idx ON bg_loans(is_active);
CREATE INDEX IF NOT EXISTS bg_loans_account_idx ON bg_loans(account_id);
CREATE INDEX IF NOT EXISTS bg_loan_payments_loan_idx ON bg_loan_payments(loan_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS bg_loan_payments_transaction_idx ON bg_loan_payments(transaction_id);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), existing debt payoff engine (`calculateSnowball`, `calculateAvalanche`, `generateAmortizationSchedule`), account types (V5 added 'loan', 'mortgage')
- **External:** None. All calculations on-device.
- **Cross-Module:** `homes` module could link mortgage loans to property records in the future

## Functional Requirements

### User Stories
1. As a budget user, I want to add my loans with their terms (rate, principal, term) so I can track payoff progress.
2. As a budget user, I want to see an amortization schedule showing principal vs interest breakdown per month.
3. As a budget user, I want to compare loan scenarios (e.g., 15yr vs 30yr mortgage, or current vs refinance rate).
4. As a budget user, I want to see how extra payments affect total interest and payoff date.
5. As a budget user, I want loan payments linked to my transactions for automatic balance tracking.
6. As a budget user, I want to see total interest paid, remaining interest, and payoff progress at a glance.

### Behavior Specification

1. User navigates to Accounts tab or new Loans section
2. User taps "Add Loan" and enters: name, type, original principal, interest rate, term, start date, lender (optional)
3. System calculates monthly payment using standard amortization formula
4. System generates full amortization schedule
5. Loan detail screen shows:
   a. Progress ring: % principal paid
   b. Key stats: total interest (lifetime), interest paid so far, remaining interest
   c. Payoff date (projected with current payment)
   d. Amortization chart: stacked bar (principal vs interest per month)
   e. Payment history linked to transactions
6. "What If" calculator:
   a. User adjusts rate, term, or extra payment
   b. Side-by-side comparison: original terms vs modified terms
   c. Difference in total interest and payoff date highlighted
7. When a transaction is categorized to a loan account, system prompts to link as loan payment
8. Linked payment auto-splits into principal and interest based on amortization schedule
9. Current balance updates after each linked payment

### Edge Cases

- Variable rate loan: store initial rate, allow manual rate updates (no auto-adjustment)
- Loan already partially paid: user enters current balance (not original principal) as starting point; system back-calculates payments made
- Extra payment exceeds remaining balance: cap at remaining balance, mark loan as paid off
- Loan with 0% interest (promotional): amortization is simple principal/term division
- Very large loan (>$1M): ensure integer math doesn't overflow (cents as bigint-safe integers)
- Loan payment transaction deleted: unlink from loan, recalculate current balance
- Multiple loans for same account: each loan tracked independently
- Refinancing: create new loan, optionally mark old one as inactive with link to new

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Add Loan" form captures name, type, principal, rate, term, start date
- [ ] **AC-2:** Monthly payment auto-calculated and shown before saving
- [ ] **AC-3:** Loan detail shows progress ring with % principal paid
- [ ] **AC-4:** Amortization chart shows principal vs interest stacked bars per month
- [ ] **AC-5:** Key stats displayed: total interest, paid so far, remaining, payoff date
- [ ] **AC-6:** "What If" calculator shows side-by-side comparison of loan scenarios
- [ ] **AC-7:** Extra payment input shows impact on total interest and payoff date
- [ ] **AC-8:** Transactions to loan accounts can be linked as loan payments
- [ ] **AC-9:** Linked payments show principal/interest split
- [ ] **AC-10:** Current balance updates after each linked payment
- [ ] **AC-11:** Loan list shows all active loans with balances and rates

### Technical Criteria
- [ ] **TC-1:** Amortization uses standard formula: M = P[r(1+r)^n]/[(1+r)^n-1]
- [ ] **TC-2:** All amounts stored as integer cents
- [ ] **TC-3:** Interest rates stored as basis points (integer, e.g., 650 = 6.50%)
- [ ] **TC-4:** Amortization schedule calculation completes in <100ms for 360-month loan
- [ ] **TC-5:** bg_loans and bg_loan_payments created via V6 migration
- [ ] **TC-6:** Loan payment links to both bg_loan_payments and bg_transactions via foreign keys
- [ ] **TC-7:** What-if comparison is pure computation (no DB writes for scenarios)

### Negative Criteria
- [ ] **NC-1:** Loan data must NOT be sent to any external service
- [ ] **NC-2:** Deleting a loan must NOT delete linked transactions (only unlinks)
- [ ] **NC-3:** Loan calculations must NOT use floating-point for currency (integer cents only)
- [ ] **NC-4:** Inactive loans must NOT appear in active loan totals

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Loan cards: `rgba(255,255,255,0.04)` (glass token) with loan type icon + name + balance + rate
- Module accent: `#22C55E` (budget green)
- Progress ring: green fill on `#1A1A24` (surfaceElevated) track
- Amortization chart: green bars (principal) + red/amber bars (interest)
- What-if: split screen with "Current" and "Modified" columns

### Web (Next.js)
- Same tokens via CSS variables
- Route: `/budget/loans` (list), `/budget/loans/[id]` (detail)
- Amortization table with expandable chart
- What-if calculator in modal or side panel

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards for loan list | Initial fetch |
| Empty | "No loans tracked" + "Add your first loan" CTA | No loans added |
| Error | "Could not load loan details" + retry | DB read failure |
| Success | Loan cards with balances, rates, progress rings | Loans loaded |
| Partial | Loan without linked payments shows "No payments recorded yet" | New loan, no payments |

## Test Requirements

### Unit Tests
- [ ] `calculateMonthlyPayment`: standard 30yr mortgage at 6.5% matches known value
- [ ] `calculateMonthlyPayment`: handles 0% interest (principal/months)
- [ ] `generateAmortizationSchedule`: 360 entries for 30yr, each with principal + interest = payment
- [ ] `generateAmortizationSchedule`: final balance is $0 (within rounding tolerance of 1 cent)
- [ ] `calculateTotalInterest`: returns sum of all interest entries in schedule
- [ ] `applyExtraPayment`: reduces remaining months and total interest
- [ ] `compareScenarios`: returns difference in total interest and payoff date
- [ ] `splitPayment`: correctly splits payment into principal and interest for given month number
- [ ] Loan CRUD: create, read, update, delete, list active
- [ ] Loan payment CRUD: create, read by loan, link to transaction

### Integration Tests
- [ ] Full flow: add loan -> make payment -> verify balance updates -> check amortization
- [ ] What-if flow: compare 15yr vs 30yr -> verify interest difference is correct
- [ ] Deletion flow: delete loan -> verify transactions remain unlinked

### QA Verification Script

1. Open app on iOS simulator
2. Navigate to MyBudget > Accounts tab
3. Verify: "Add Loan" option available
4. Add a loan: "Home Mortgage", $300,000, 6.50%, 30 years, 2026-01-01
5. Verify: monthly payment calculated (~$1,896.20) -- AC-1, AC-2
6. Save and open loan detail
7. Verify: progress ring shows 0% paid (new loan) -- AC-3
8. Verify: amortization chart shows 360 bars -- AC-4
9. Verify: total interest shown (~$382,633 for this example) -- AC-5
10. Tap "What If" calculator
11. Change term to 15 years
12. Verify: side-by-side shows interest savings (~$200K+ difference) -- AC-6
13. Enter $200/month extra payment on original terms
14. Verify: payoff date moves earlier, total interest decreases -- AC-7
15. Go back to Transactions, create a $1,896 outflow to mortgage account
16. Verify: prompt to link as loan payment -- AC-8
17. Link the payment
18. Verify: payment shows principal/interest split -- AC-9
19. Verify: loan balance decreased by principal portion -- AC-10
20. Navigate to loan list
21. Verify: mortgage shows with updated balance -- AC-11
22. Open on web at `/budget/loans`
23. Verify: loan list renders with same data
24. Open `/budget/loans/[id]`
25. Verify: amortization table and chart render

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to `/budget/loans`, test add/detail/what-if flows
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for loan amortization engine

### Post-merge:
- [ ] `/parity-check` -- budget module has archived standalone

## Handoff State

### Before This Work
Budget module has debt payoff engine (snowball/avalanche, amortization), 'loan' and 'mortgage' account types (V5), and DebtPayoffPlan/DebtPayoffDebt tables. No dedicated loan tracking with terms, no payment splitting, no what-if comparison tool.

### After This Work
Full loan planner with bg_loans and bg_loan_payments tables. Add loans with full terms (principal, rate, term, type). Amortization schedule generation with principal/interest breakdown. What-if scenario comparison. Payment linking from transactions with auto principal/interest split. Progress tracking with visual dashboard.

### Files Changed
- `modules/budget/src/engine/loan-planner.ts` -- Loan calculation engine
- `modules/budget/src/db/schema.ts` -- V6: bg_loans, bg_loan_payments tables
- `modules/budget/src/db/crud.ts` -- Loan and loan payment CRUD
- `modules/budget/src/types.ts` -- Loan, LoanInsert, LoanPayment schemas
- `modules/budget/src/definition.ts` -- V6 migration
- `modules/budget/src/index.ts` -- Export loan types and engine
- `apps/mobile/app/(budget)/loans.tsx` -- Loan list screen
- `apps/mobile/app/(budget)/loan-detail.tsx` -- Loan detail with amortization
- `apps/mobile/app/(budget)/loan-calculator.tsx` -- What-if comparison
- `apps/web/app/budget/loans/page.tsx` -- Web loan list
- `apps/web/app/budget/loans/[id]/page.tsx` -- Web loan detail
- `apps/web/app/budget/actions.ts` -- Loan server actions

### Known Limitations
- Variable rate loans tracked as fixed rate with manual updates (no automatic rate adjustment)
- No integration with bank sync for automatic payment detection (must manually link)
- No tax deduction calculation for mortgage interest
- ARM (adjustable rate mortgage) rate-change schedules not modeled

### Context for Next Agent
- The existing `generateAmortizationSchedule` in `engine/debt-payoff.ts` handles basic amortization but is designed for the debt payoff planner context. The new `loan-planner.ts` should have its own standalone functions that are more detailed (principal/interest split per payment, running balance, cumulative interest)
- Interest rates in basis points: 650 = 6.50%, stored as INTEGER to avoid float issues
- Monthly payment formula: M = P * [r(1+r)^n] / [(1+r)^n - 1] where r = annual_rate/12/10000 (basis points to monthly decimal), n = term_months
- The what-if engine should accept two LoanInput objects and return a comparison result (no DB involvement)
- Link bg_loan_payments.transaction_id to existing bg_transactions for audit trail
