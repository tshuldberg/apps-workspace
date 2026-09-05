# Plan: MyBudget Competitive Features

> **STATUS 2026-06-28 (moved queue -> done):** Partially shipped via the V6 migration (2026-03-22) with a divergent architecture: Feature 1 (sharing) shipped as device-invite-code "families" not Supabase "households"; Feature 3 (assets) shipped as a single `bg_holdings` table not separate investments/properties/vehicles tables. **Not shipped / open follow-up backlog:** Feature 2 (OFX/QFX import + import_rules/import_history) and Feature 4 (forecast-engine.ts / scenario-engine.ts) have no implementation. Re-file as fresh scoped plans if revived.

<!-- superpowers:executing-plans -->

## Metadata

```yaml
project: MyBudget (standalone + hub module parity)
priority: 04
effort: XL
dependencies: []
worktree: true
worktree_name: mybudget-competitive
parallel_phases: false
created: 2026-03-05
```

## Objective

Implement the four major competitive gaps between MyBudget and YNAB/Monarch Money:
household collaboration (shared budgets), full account aggregation (Plaid + CSV/OFX/QFX),
broader asset coverage (investments, property, vehicles), and forward-looking forecasting
(cash flow projections, goal timelines, what-if scenarios). Each feature ships in both
the standalone `MyBudget/` app and the `modules/budget/` hub module simultaneously per
the standalone/hub parity rule.

## Scope

### Files Affected

**Schema (packages/shared/src/db/schema.ts)**
- Add tables: `households`, `household_members`, `household_invitations`, `household_sync_log`,
  `import_rules`, `import_history`, `investments`, `holdings`, `properties`, `vehicles`
- Extend `accounts` table type check to include new asset types
- Increment `SCHEMA_VERSION` (currently 4, will become 5)

**Engine (packages/shared/src/engine/)**
- New file: `forecast-engine.ts` — cash flow projection, recurring detection, goal projections
- New file: `scenario-engine.ts` — what-if scenario modeling
- New file: `asset-engine.ts` — investment/property/vehicle valuation logic
- Extend `net-worth.ts` to include new asset types
- Extend `goals.ts` with projection enhancements for forecast integration
- Update `index.ts` exports

**DB CRUD (packages/shared/src/db/)**
- New file: `household-crud.ts` — CRUD for household tables
- New file: `assets-crud.ts` — CRUD for investments, holdings, properties, vehicles
- New file: `import-history-crud.ts` — CRUD for import_rules and import_history
- Extend `net-worth-crud.ts` to handle new asset types

**Bank Sync (packages/shared/src/bank-sync/)**
- New file: `ofx-parser.ts` — OFX/QFX file parser (no external dependencies)
- Extend `connector-service.ts` to expose categorization rule application post-import
- Extend `transaction-sync.ts` to support import_history tracking

**Models (packages/shared/src/models/schemas.ts)**
- Add Zod schemas for all new tables and engine inputs/outputs

**Mobile app (apps/mobile/app/)**
- New screen: `household.tsx` — household management and invitations
- New screen: `forecast.tsx` — cash flow forecast with chart
- New screen: `scenarios.tsx` — what-if scenario editor
- New screen: `assets/investments.tsx` — investment account list + add form
- New screen: `assets/property.tsx` — property list + add form
- New screen: `assets/vehicles.tsx` — vehicle list + add form
- Extend `(tabs)/accounts.tsx` — new asset type buttons + household sync indicator
- Extend `(tabs)/reports.tsx` — add Forecast and Scenarios tabs
- Extend `settings.tsx` — Household section
- Extend `import-csv.tsx` — add OFX/QFX format support

**Web app (apps/web/app/)**
- New route: `household/` — household management page
- New route: `forecast/` — forecast page with recharts timeline
- New route: `scenarios/` — scenario editor
- New route: `assets/` — investments, property, vehicles pages
- Extend `accounts/` and `reports/` to surface new features

**Hub module (modules/budget/src/)**
- Extend `definition.ts` to register new navigation tabs/screens for Forecast and Assets
- Extend `types.ts` to export new asset and household types

**Tests (packages/shared/src/__tests__/ and engine/__tests__/)**
- New test file: `forecast-engine.test.ts`
- New test file: `scenario-engine.test.ts`
- New test file: `asset-engine.test.ts`
- New test file: `ofx-parser.test.ts`
- New test file: `household-crud.test.ts`

### Files NOT to Touch

- `packages/shared/src/catalog/` — subscription catalog unchanged
- `packages/shared/src/subscriptions/` — subscription engine unchanged
- `packages/shared/src/csv/` — existing CSV parser unchanged (OFX goes to bank-sync/)
- `packages/shared/src/bank-sync/providers/plaid.ts` — Plaid provider implementation unchanged
- `packages/ui/` — UI design tokens unchanged
- `apps/mobile/app/(tabs)/budget.tsx` — budget tab unchanged
- `apps/mobile/app/(tabs)/transactions.tsx` — transactions tab unchanged
- `apps/mobile/app/(tabs)/subscriptions.tsx` — subscriptions tab unchanged
- `modules/budget/src/bank-sync/` — hub bank-sync adapter unchanged
- `modules/budget/src/db/` — hub DB adapter unchanged
- `MyLife/` hub-level code outside `modules/budget/` — out of scope

---

## Feature 1: Household Collaboration ("MyBudget Together")

### Overview

Multi-user shared budget via Supabase real-time sync. Households are optional and
opt-in. Local-only mode remains fully functional with no degradation. The household
backend is a thin Supabase layer wrapping the existing SQLite engine; the local SQLite
remains the source of truth for the local user's personal envelopes.

**Complexity: XL**
**Privacy implications:** User emails are stored server-side in Supabase only for
invitation lookup. No financial data leaves the device unless the user explicitly enables
household mode. Shared transaction data synced via Supabase is encrypted in transit.
**Dependencies:** Requires Supabase project (the MySurf/MyWorkouts project can host a
separate `budget` schema, or a dedicated project). Requires `@mylife/auth` package for
Supabase Auth session management.

### Schema Changes

```sql
-- NEW TABLE 1: households
-- One household per subscription group. admin_user_id is the Supabase auth UID.
CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY NOT NULL,              -- UUID, Supabase-generated
  name TEXT NOT NULL,                        -- "The Smith Family Budget"
  admin_user_id TEXT NOT NULL,               -- Supabase auth.users.id
  supabase_household_id TEXT UNIQUE,         -- Foreign ref to Supabase households table
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- NEW TABLE 2: household_members
-- Tracks who belongs to which household and their role.
CREATE TABLE IF NOT EXISTS household_members (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,                     -- Supabase auth.users.id
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL CHECK(role IN ('admin', 'member', 'viewer')),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(household_id, user_id)
);

-- NEW TABLE 3: household_invitations
-- Short-lived invitation tokens. Accepted invitations create a household_members row.
CREATE TABLE IF NOT EXISTS household_invitations (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  invited_by_user_id TEXT NOT NULL,
  invited_email TEXT,                        -- null for link-based invites
  token TEXT NOT NULL UNIQUE,               -- secure random token
  role TEXT NOT NULL CHECK(role IN ('member', 'viewer')) DEFAULT 'member',
  expires_at TEXT NOT NULL,                 -- ISO 8601, 7 day TTL
  accepted_at TEXT,
  accepted_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- NEW TABLE 4: household_sync_log
-- Append-only changelog for conflict resolution and audit.
-- Follows the packages/sync/ changeset pattern.
CREATE TABLE IF NOT EXISTS household_sync_log (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN (
    'transaction', 'budget_allocation', 'category', 'category_group', 'recurring_template'
  )),
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
  payload TEXT NOT NULL,                    -- JSON snapshot of the entity
  client_timestamp TEXT NOT NULL,           -- ISO 8601 from originating device
  server_timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  applied INTEGER NOT NULL DEFAULT 0        -- 0 = pending, 1 = applied to local state
);

-- EXTEND: categories table
-- Add visibility column for shared vs personal envelope control.
ALTER TABLE categories ADD COLUMN sharing_mode TEXT NOT NULL DEFAULT 'personal'
  CHECK(sharing_mode IN ('personal', 'shared', 'readonly'));

-- EXTEND: transactions table
-- Track which household member originated the transaction for attribution.
ALTER TABLE transactions ADD COLUMN household_member_id TEXT
  REFERENCES household_members(id) ON DELETE SET NULL;
```

### Service Layer Design

**File: `packages/shared/src/db/household-crud.ts`**

```typescript
// Functions to implement:
export function createHousehold(db, input: HouseholdInput): Household
export function getHousehold(db, id: string): Household | null
export function updateHousehold(db, id: string, patch: Partial<HouseholdInput>): Household
export function deleteHousehold(db, id: string): void

export function inviteMember(db, input: InvitationInput): HouseholdInvitation
export function acceptInvitation(db, token: string, userId: string, displayName: string): HouseholdMember
export function revokeInvitation(db, invitationId: string): void
export function listInvitations(db, householdId: string): HouseholdInvitation[]

export function listMembers(db, householdId: string): HouseholdMember[]
export function updateMemberRole(db, memberId: string, role: HouseholdRole): HouseholdMember
export function removeMember(db, memberId: string): void

export function logChange(db, entry: SyncLogInput): void
export function getPendingChanges(db, householdId: string, afterTimestamp: string): SyncLogEntry[]
export function markChangesApplied(db, changeIds: string[]): void
```

**File: `packages/shared/src/bank-sync/household-sync.ts`** (new)

Supabase Realtime channel subscription for household budget sync. Uses the
`household_sync_log` table as a changeset queue. On reconnect, fetches all changes
since `last_sync_cursor` and applies them to local SQLite in timestamp order.

Conflict resolution strategy:
- **Last-write-wins** for `budget_allocation` changes (most recent `server_timestamp` wins)
- **Append-only** for `transaction` creates (all members' transactions are preserved)
- **Admin-wins** for `category` structural changes (renaming, reordering)
- On conflict, the sync log entry is preserved and a `household_conflict` record is written
  for user review in the Household screen

### Permission Model

| Action | admin | member | viewer |
|--------|-------|--------|--------|
| View all envelopes | Y | Y (shared only) | Y (shared only) |
| Add transactions | Y | Y | N |
| Move money between envelopes | Y | Y | N |
| Invite members | Y | N | N |
| Change member roles | Y | N | N |
| Delete household | Y | N | N |
| Manage shared/personal visibility | Y | N | N |

### UI Screens

**Settings > Household** (new section in `settings.tsx`):
- "Create a household" CTA if not in one
- Current household name, member list with role badges
- "Invite member" button (opens email input + role selector)
- "Invite via link" button (copies deep link with token)
- "Leave household" / "Delete household" (admin only)
- Pending invitations list with revoke option

**Household member view** (accessible from household screen):
- Avatar, display name, email, role badge
- Their recent transactions (if shared envelopes are visible)
- Change role / remove member controls (admin only)

**Envelope visibility controls** (per category in Budget tab):
- Long-press or edit category to toggle `sharing_mode`: Personal / Shared / Read-only
- Visual indicator on Budget tab envelope cards showing share state

**Invitation acceptance flow** (deep link handler in `_layout.tsx`):
- Parse token from URL
- Validate token (not expired, not already accepted)
- Show household name + inviter name + role
- "Accept" button creates member record via Supabase edge function

### Phased Rollout

1. **Phase 1a** — Schema + CRUD (local only, no Supabase). Envelope sharing_mode column, household tables created but empty. UI: Settings section with "Coming Soon" state.
2. **Phase 1b** — Supabase backend. Edge functions for invitation validation, changeset sync endpoint, RLS policies.
3. **Phase 1c** — Realtime sync. Supabase channel subscription, conflict resolution pipeline, sync indicator in UI.
4. **Phase 1d** — Invitation flow. Deep link parsing, accept/reject UI, email invite (optional Supabase transactional email).

---

## Feature 2: Full Account Aggregation

### Overview

Enables the currently feature-flagged bank sync infrastructure. Plaid is the primary
provider (already scaffolded). Adds OFX/QFX import as a fallback for institutions not
supported by Plaid. Adds an import rules engine for auto-categorization and a
reconciliation UI for matching imported transactions to manually entered ones.

**Complexity: L**
**Privacy implications:** Plaid tokens are stored in the `bank_connections` table
(already exists). Access tokens never leave the server component. Users must explicitly
initiate connection via Plaid Link. Local-only mode is always available as fallback.
OFX/QFX files are parsed entirely on-device with no upload.
**Dependencies:** Plaid API keys (environment config), server component for token
exchange (Next.js API route or Supabase Edge Function).

### Existing Infrastructure (Already Built)

The bank sync scaffolding is substantially complete:
- `bank_connections`, `bank_accounts`, `bank_transactions_raw`, `bank_sync_state`,
  `bank_webhook_events` tables exist in schema
- `packages/shared/src/bank-sync/` has: `connector-service.ts`, `transaction-sync.ts`,
  `auth-guard.ts`, `idempotency.ts`, `webhook-security.ts`, `token-vault.ts`,
  `cloud-adapters.ts`, `provider-router.ts`, `recurring-detector.ts`,
  `subscription-discovery.ts`
- `packages/shared/src/bank-sync/providers/plaid.ts` implements `BankSyncProviderClient`
- Feature flag exists (accounts flag:18, settings flag:51) — remove flag gates to enable

### Schema Changes (Additive)

```sql
-- NEW TABLE: import_rules
-- User-defined auto-categorization rules applied to all imported transactions
-- (Plaid, OFX, QFX). Supplements the existing transaction_rules engine.
CREATE TABLE IF NOT EXISTS import_rules (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  match_field TEXT NOT NULL CHECK(match_field IN ('payee', 'memo', 'amount', 'amount_range')),
  match_type TEXT NOT NULL CHECK(match_type IN ('contains', 'exact', 'starts_with', 'regex', 'gte', 'lte', 'between')),
  match_value TEXT NOT NULL,                -- For amount_range: JSON {min, max}
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  rename_payee TEXT,                        -- Optional payee rename on match
  is_enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'user' CHECK(source IN ('user', 'auto')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- NEW TABLE: import_history
-- Tracks each import batch for deduplication and audit.
CREATE TABLE IF NOT EXISTS import_history (
  id TEXT PRIMARY KEY NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('plaid', 'ofx', 'qfx', 'csv', 'manual')),
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  connection_id TEXT REFERENCES bank_connections(id) ON DELETE SET NULL,
  file_name TEXT,                           -- For OFX/QFX/CSV imports
  transactions_imported INTEGER NOT NULL DEFAULT 0,
  transactions_matched INTEGER NOT NULL DEFAULT 0,  -- Auto-reconciled
  transactions_new INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'complete', 'failed')),
  error_message TEXT
);

-- EXTEND: transactions table
-- Track import source and reconciliation state.
ALTER TABLE transactions ADD COLUMN import_source TEXT
  CHECK(import_source IN ('plaid', 'ofx', 'qfx', 'csv', 'manual') OR import_source IS NULL);
ALTER TABLE transactions ADD COLUMN import_id TEXT REFERENCES import_history(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN bank_transaction_id TEXT
  REFERENCES bank_transactions_raw(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN reconcile_status TEXT NOT NULL DEFAULT 'unreviewed'
  CHECK(reconcile_status IN ('unreviewed', 'matched', 'new', 'dismissed'));
```

### OFX/QFX Parser

**File: `packages/shared/src/bank-sync/ofx-parser.ts`**

OFX (Open Financial Exchange) is a plain-text format with SGML-like tags. QFX is
Intuit's proprietary OFX variant — structurally identical for transaction data.

```typescript
export interface OFXTransaction {
  type: 'debit' | 'credit' | 'check' | 'payment' | 'other';
  datePosted: string;     // YYYY-MM-DD parsed from YYYYMMDD or YYYYMMDDHHMMSS
  amount: number;         // cents, negative = outflow
  fitId: string;          // Financial institution transaction ID (dedup key)
  name: string;           // Payee name
  memo: string | null;
  checkNum: string | null;
}

export interface OFXParseResult {
  accountId: string | null;      // ACCTID from file
  bankId: string | null;         // BANKID/ROUTINGNO
  currency: string;              // Default 'USD'
  transactions: OFXTransaction[];
  startDate: string | null;      // DTSTART
  endDate: string | null;        // DTEND
  balance: number | null;        // LEDGERBAL cents
  errors: string[];              // Non-fatal parse warnings
}

// Main parse function — pure, no I/O
export function parseOFX(content: string): OFXParseResult
export function parseQFX(content: string): OFXParseResult  // Alias, same impl
```

Implementation notes:
- Use regex-based line-by-line parser (no XML library needed for OFX 1.x)
- Handle both SGML-style (`<TAG>VALUE`) and XML-style (`<TAG>VALUE</TAG>`) variants
- Date parsing must handle YYYYMMDD, YYYYMMDDHHMMSS, YYYYMMDDHHMMSS.XXX[timezone]
- Amount: OFX uses decimal strings (e.g., "-42.50") — multiply by 100 and round to cents

### Auto-Categorization Pipeline

Post-import pipeline applied to all imported transactions:

1. Check `bank_transactions_raw.raw_category` against Plaid's category taxonomy → map to local category
2. Apply `transaction_rules` (existing engine) for payee-pattern matching
3. Apply `import_rules` (new) for field-level matching with higher specificity
4. Check `payee_cache` for user's historical category for that payee
5. If no match: mark `reconcile_status = 'unreviewed'` for manual review queue

**File: `packages/shared/src/bank-sync/categorization-pipeline.ts`** (new)

```typescript
export function runCategorizationPipeline(
  transaction: BankTransactionRecord,
  context: {
    transactionRules: TransactionRule[];
    importRules: ImportRule[];
    payeeCache: Map<string, string>;  // payee → category_id
    plaidCategoryMap: Map<string, string>; // plaid category → local category_id
  }
): CategorizationResult

export interface CategorizationResult {
  categoryId: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  source: 'plaid_category' | 'transaction_rule' | 'import_rule' | 'payee_cache' | 'none';
  renamedPayee: string | null;
}
```

### Reconciliation Flow

UI in `(tabs)/accounts.tsx` — "Review Imports" section:

- List of `reconcile_status = 'unreviewed'` transactions grouped by account
- Each row shows: date, payee, amount, suggested category (if any), confidence badge
- Actions: Confirm (accept suggestion), Edit (change category), Dismiss (mark not a real expense), Match (link to existing manual transaction)
- "Match to existing" shows nearby manual transactions within ±3 days and ±5% amount
- Matched transactions: sets `bank_transaction_id` on the manual entry, marks raw as matched
- Batch confirm: "Confirm all high-confidence" button

### Feature Flag Removal

Remove feature flags gating bank sync (accounts flag:18, settings flag:51):
- `apps/mobile/app/(tabs)/accounts.tsx` — remove flag check around "Connect a bank" button
- `apps/mobile/app/settings.tsx` — remove flag check around bank sync settings section
- `apps/web/app/accounts/` — remove flag check

### Phased Rollout

1. **Phase 2a** — Schema additive changes (import_rules, import_history, transaction columns)
2. **Phase 2b** — OFX/QFX parser + tests
3. **Phase 2c** — Remove feature flags, wire Plaid Link flow end-to-end
4. **Phase 2d** — Categorization pipeline + import rules CRUD + UI
5. **Phase 2e** — Reconciliation UI (review queue, match flow)

---

## Feature 3: Broader Asset Coverage

### Overview

Extends the net worth dashboard to track investment accounts (brokerage, 401k, IRA),
real property (home/rental), and vehicles. All valuations are manual by default;
optional API integrations (Zillow for property, KBB for vehicles) are feature-flagged
for a future phase. Investment holdings include cost basis for gain/loss calculation.

**Complexity: L**
**Privacy implications:** All asset data stored locally in SQLite. No valuations
sent externally unless the user explicitly enables optional Zillow/KBB API lookups
(future phase). No external account linking required for manual tracking.
**Dependencies:** Extends the existing `calculateNetWorth` engine and `net_worth_snapshots` table.

### Schema Changes

```sql
-- EXTEND: accounts table
-- Add new account types for investments and liabilities.
-- Requires migration: drop and recreate constraint with expanded type list.
-- New type constraint:
--   CHECK(type IN ('checking', 'savings', 'credit_card', 'cash',
--                  'investment', 'property', 'vehicle', 'loan', 'other'))
-- Note: 'investment' already appears in bank_accounts.type — align here.

-- NEW TABLE: investments
-- Tracks investment accounts with portfolio metadata.
CREATE TABLE IF NOT EXISTS investments (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  investment_type TEXT NOT NULL CHECK(investment_type IN (
    'brokerage', '401k', 'ira', 'roth_ira', '403b', 'hsa', 'crypto', 'other'
  )),
  institution TEXT,                         -- "Fidelity", "Vanguard", etc.
  account_number_last4 TEXT,               -- Last 4 digits for display
  total_value_cents INTEGER NOT NULL DEFAULT 0,  -- Manual or synced total
  total_cost_basis_cents INTEGER,           -- Optional, for overall gain/loss
  as_of_date TEXT,                          -- Date of last manual update
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- NEW TABLE: holdings
-- Individual security positions within an investment account.
CREATE TABLE IF NOT EXISTS holdings (
  id TEXT PRIMARY KEY NOT NULL,
  investment_id TEXT NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  ticker TEXT,                              -- 'AAPL', 'VTI', null for non-security
  name TEXT NOT NULL,                       -- 'Apple Inc.', 'Vanguard Total Stock'
  holding_type TEXT NOT NULL CHECK(holding_type IN (
    'stock', 'etf', 'mutual_fund', 'bond', 'crypto', 'cash', 'option', 'other'
  )),
  quantity_micro INTEGER NOT NULL DEFAULT 0, -- Shares * 1_000_000 (6 decimal precision)
  price_cents INTEGER NOT NULL DEFAULT 0,   -- Current price per share in cents
  value_cents INTEGER NOT NULL DEFAULT 0,   -- quantity * price (computed, stored for perf)
  cost_basis_cents INTEGER,                 -- Total cost basis in cents
  as_of_date TEXT,                          -- Date of last price update
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- NEW TABLE: properties
-- Real estate assets.
CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  property_type TEXT NOT NULL CHECK(property_type IN (
    'primary_residence', 'rental', 'vacation', 'land', 'commercial', 'other'
  )),
  address_line1 TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  address_country TEXT NOT NULL DEFAULT 'US',
  purchase_price_cents INTEGER,             -- Original purchase price
  purchase_date TEXT,                       -- YYYY-MM-DD
  current_value_cents INTEGER NOT NULL DEFAULT 0, -- Manual estimate or Zillow
  mortgage_balance_cents INTEGER,           -- Outstanding mortgage (linked to a liability account)
  zillow_zpid TEXT,                         -- Zillow property ID (for future API lookup)
  value_source TEXT NOT NULL DEFAULT 'manual' CHECK(value_source IN ('manual', 'zillow')),
  last_valued_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- NEW TABLE: vehicles
-- Vehicle assets.
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  make TEXT NOT NULL,                       -- 'Toyota'
  model TEXT NOT NULL,                      -- 'Camry'
  year INTEGER NOT NULL,
  trim TEXT,                                -- 'LE', 'XSE'
  mileage INTEGER,                          -- Odometer reading for value estimation
  purchase_price_cents INTEGER,
  purchase_date TEXT,
  current_value_cents INTEGER NOT NULL DEFAULT 0,
  loan_balance_cents INTEGER,               -- Outstanding loan
  vin TEXT,
  kbb_style_id TEXT,                        -- KBB style ID (for future API lookup)
  value_source TEXT NOT NULL DEFAULT 'manual' CHECK(value_source IN ('manual', 'kbb')),
  last_valued_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Net Worth Engine Extension

**Extend `packages/shared/src/engine/net-worth.ts`:**

```typescript
// Extended AccountInput to handle new types
export interface AccountInput {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit_card' | 'cash' |
        'investment' | 'property' | 'vehicle' | 'loan' | 'other';
  balance: number;  // cents
  isActive: boolean;
}

// New: Extended net worth with asset class breakdown
export interface NetWorthBreakdown {
  liquid: number;           // checking + savings + cash
  investments: number;      // investment accounts total
  property: number;         // property current values
  vehicles: number;         // vehicle current values
  otherAssets: number;
  creditCards: number;      // liabilities
  loans: number;
  otherLiabilities: number;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export function calculateNetWorthBreakdown(accounts: AccountInput[]): NetWorthBreakdown
```

**New file: `packages/shared/src/engine/asset-engine.ts`:**

```typescript
// Investment gain/loss calculation
export function calculateInvestmentGainLoss(holding: {
  currentValue: number;   // cents
  costBasis: number;      // cents
}): { gainLoss: number; gainLossPct: number; isGain: boolean }

// Property equity
export function calculatePropertyEquity(property: {
  currentValue: number;   // cents
  mortgageBalance: number; // cents
}): { equity: number; ltv: number }

// Vehicle depreciation estimate (straight-line approximation)
export function estimateVehicleDepreciation(vehicle: {
  purchasePrice: number;  // cents
  purchaseDate: string;   // YYYY-MM-DD
  currentDate: string;    // YYYY-MM-DD
  annualDepreciationRate?: number; // default 0.15 (15%)
}): { estimatedValue: number; totalDepreciation: number }

// Portfolio allocation breakdown
export function calculatePortfolioAllocation(holdings: Array<{
  type: HoldingType;
  valueCents: number;
}>): Map<HoldingType, { amount: number; percentage: number }>
```

### DB CRUD

**New file: `packages/shared/src/db/assets-crud.ts`:**

```typescript
// Investments
export function createInvestment(db, input: InvestmentInput): Investment
export function getInvestment(db, id: string): Investment | null
export function listInvestments(db): Investment[]
export function updateInvestment(db, id: string, patch: Partial<InvestmentInput>): Investment
export function deleteInvestment(db, id: string): void

// Holdings
export function createHolding(db, input: HoldingInput): Holding
export function listHoldings(db, investmentId: string): Holding[]
export function updateHolding(db, id: string, patch: Partial<HoldingInput>): Holding
export function deleteHolding(db, id: string): void
export function upsertHoldings(db, investmentId: string, holdings: HoldingInput[]): void

// Properties
export function createProperty(db, input: PropertyInput): Property
export function listProperties(db): Property[]
export function updateProperty(db, id: string, patch: Partial<PropertyInput>): Property
export function deleteProperty(db, id: string): void

// Vehicles
export function createVehicle(db, input: VehicleInput): Vehicle
export function listVehicles(db): Vehicle[]
export function updateVehicle(db, id: string, patch: Partial<VehicleInput>): Vehicle
export function deleteVehicle(db, id: string): void
```

### UI Screens

**Net Worth Dashboard** (extend `(tabs)/reports.tsx` or promote to its own Accounts sub-tab):
- Donut chart: asset class breakdown (Liquid / Investments / Property / Vehicles / Liabilities)
- Timeline chart: net worth history from `net_worth_snapshots`
- Asset class cards: each expandable to show individual accounts/holdings

**Investments screen** (`assets/investments.tsx`):
- List of investment accounts with total value and gain/loss
- Expand each to show holdings table (ticker, shares, price, value, gain/loss)
- "Add investment account" → form: type, institution, account number last 4, total value
- "Add holding" → form: ticker/name, type, quantity, price, cost basis
- "Update values" → bulk entry form for quick price updates

**Property screen** (`assets/property.tsx`):
- List of properties with address, current value, equity
- "Add property" → form: type, address, purchase price/date, current value, mortgage balance
- "Estimate depreciation" for vehicles is shown inline

**Vehicles screen** (`assets/vehicles.tsx`):
- List of vehicles with make/model/year, current value
- "Add vehicle" → form: make, model, year, trim, purchase price/date, current value, loan balance
- KBB/NADA reference link shown as external resource (not integrated yet)

**Accounts tab extension** (`(tabs)/accounts.tsx`):
- New "Assets" section below existing accounts
- Cards for: Total Investments, Total Property, Total Vehicles
- Tapping each navigates to the respective asset screen

### Phased Rollout

1. **Phase 3a** — Schema: new tables + accounts type constraint migration
2. **Phase 3b** — Engine: extend net-worth.ts, implement asset-engine.ts
3. **Phase 3c** — CRUD: assets-crud.ts + tests
4. **Phase 3d** — UI: investments, property, vehicles screens
5. **Phase 3e** — Net worth dashboard extension with asset class breakdown

---

## Feature 4: Forecasting / Forward-Looking Planning

### Overview

A cash flow forecasting engine that projects income and expenses 30/60/90 days forward
using recurring transaction patterns. Includes goal-based savings projections, what-if
scenario modeling (income change, new expense, debt payoff), and an interactive
Forecast tab in the Reports section.

**Complexity: L**
**Privacy implications:** All calculations are local. No data leaves the device.
**Dependencies:** Depends on the existing `recurring_templates` table, `goals` engine,
`payday-detector.ts`, `income-estimator.ts`, and `net-cash.ts` engine modules.

### Schema Changes (Minimal)

No new tables required. Forecasting is a pure computation layer over existing data.

```sql
-- EXTEND: recurring_templates
-- Add forecast_include flag so users can exclude seasonal or irregular items.
ALTER TABLE recurring_templates ADD COLUMN include_in_forecast INTEGER NOT NULL DEFAULT 1;

-- EXTEND: goals
-- Add monthly_contribution_cents to make savings projections explicit.
ALTER TABLE goals ADD COLUMN monthly_contribution_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE goals ADD COLUMN auto_contribute INTEGER NOT NULL DEFAULT 0;  -- Future: auto-allocate
```

### Forecast Engine

**New file: `packages/shared/src/engine/forecast-engine.ts`:**

```typescript
// Core projection types
export interface ForecastProjection {
  period: 30 | 60 | 90;            // Days from today
  startDate: string;               // today
  endDate: string;                 // today + period days
  dailyEntries: DailyForecastEntry[];
  summary: ForecastSummary;
}

export interface DailyForecastEntry {
  date: string;                    // YYYY-MM-DD
  projectedIncome: number;         // cents (sum of income recurring on this date)
  projectedExpenses: number;       // cents (sum of expense recurring on this date)
  projectedNet: number;            // income - expenses
  runningBalance: number;          // cumulative from current balance
  events: ForecastEvent[];         // what drives this day's numbers
}

export interface ForecastEvent {
  type: 'income' | 'expense' | 'transfer' | 'subscription';
  label: string;                   // "Paycheck - Employer", "Netflix"
  amount: number;                  // cents, positive
  templateId: string | null;       // source recurring_template id
  confidence: 'confirmed' | 'estimated'; // confirmed = has template, estimated = detected
}

export interface ForecastSummary {
  projectedEndBalance: number;     // Running balance at end of period
  totalProjectedIncome: number;
  totalProjectedExpenses: number;
  lowestBalanceDate: string;       // Date of minimum running balance
  lowestBalance: number;           // Cents
  surplusDays: number;             // Days with positive net cash flow
  deficitDays: number;             // Days with negative net cash flow
}

// Main projection function
export function projectCashFlow(input: {
  currentBalance: number;          // cents, current checking account balance
  recurringTemplates: RecurringTemplate[];
  period: 30 | 60 | 90;
  startDate: string;               // YYYY-MM-DD
}): ForecastProjection

// Detect recurring patterns from transaction history (no templates required)
export function detectRecurringPatterns(transactions: Transaction[]): DetectedPattern[]

export interface DetectedPattern {
  payee: string;
  estimatedAmount: number;         // cents (median of recent occurrences)
  estimatedFrequency: 'weekly' | 'biweekly' | 'monthly';
  nextEstimatedDate: string;       // YYYY-MM-DD
  confidence: number;              // 0-1
  transactionIds: string[];        // Source transactions used for detection
}

// Convert detected patterns to forecast events
export function patternsToForecastEvents(
  patterns: DetectedPattern[],
  dateRange: { start: string; end: string },
): ForecastEvent[]
```

### Scenario Engine

**New file: `packages/shared/src/engine/scenario-engine.ts`:**

```typescript
export interface Scenario {
  id: string;
  name: string;
  description: string | null;
  changes: ScenarioChange[];
}

export type ScenarioChange =
  | { type: 'income_change'; monthlyDeltaCents: number; label: string }
  | { type: 'new_expense'; amount: number; frequency: RecurringFrequency; label: string }
  | { type: 'remove_expense'; recurringTemplateId: string }
  | { type: 'debt_payoff'; debtId: string; extraPaymentCents: number }
  | { type: 'goal_save'; goalId: string; monthlyContributionCents: number };

export interface ScenarioResult {
  baseline: ForecastProjection;        // Without changes
  modified: ForecastProjection;        // With changes applied
  delta: {
    endBalanceDelta: number;           // cents
    projectedSavingsDelta: number;     // cents over period
    goalImpact: GoalImpact[];
  };
}

export interface GoalImpact {
  goalId: string;
  goalName: string;
  baselineProjectedDate: string | null;
  modifiedProjectedDate: string | null;
  deltaMonths: number | null;          // Positive = faster, negative = slower
}

export function runScenario(
  baseline: ForecastProjection,
  scenario: Scenario,
  context: { goals: Goal[] },
): ScenarioResult

// Built-in scenario templates
export const SCENARIO_TEMPLATES: Record<string, Partial<Scenario>> = {
  INCOME_RAISE: { name: 'Income raise', changes: [{ type: 'income_change', ... }] },
  NEW_SUBSCRIPTION: { name: 'New subscription', ... },
  PAY_OFF_DEBT: { name: 'Pay off debt faster', ... },
  SAVE_FOR_GOAL: { name: 'Save for a goal', ... },
};
```

### Goal Projection Integration

**Extend `packages/shared/src/engine/goals.ts`:**

```typescript
// Enhanced projection using cash flow forecast
export function projectGoalWithCashFlow(
  goal: Goal,
  forecastProjection: ForecastProjection,
  monthlyContributionCents: number,
): GoalProjection & {
  forecastConfidence: 'high' | 'medium' | 'low';
  cashFlowRisk: boolean;  // true if projected balance dips near 0 before goal date
}
```

### UI Screens

**Forecast tab** (new tab in `(tabs)/reports.tsx` or standalone route `forecast.tsx`):

Layout: period selector (30 / 60 / 90 days) → summary cards → interactive chart → event list

- **Summary cards:** Projected end balance, Total income, Total expenses, Lowest balance date
- **Timeline chart:** Area chart with income (green), expenses (red), running balance (blue line)
  - X axis: dates, Y axis: dollar amounts
  - Tap a day to see breakdown of events
  - victory-native on mobile, recharts on web
- **Event list:** Scrollable list of upcoming forecast events grouped by week
  - "Confirmed" events (from recurring templates) vs "Estimated" events (detected patterns)
  - Toggle to hide/show estimated events

**Scenarios editor** (`scenarios.tsx`):

- List of saved scenarios with "Run" button
- "New scenario" → name + description + change editor
- Change editor: tabbed (Income / Expenses / Debt / Goals)
  - Income tab: +/- monthly income slider + amount input
  - Expenses tab: add new recurring expense or select existing to remove
  - Debt tab: select debt account, enter extra monthly payment
  - Goals tab: select goal, set monthly contribution
- Scenario result view: side-by-side baseline vs modified forecast chart
- Delta summary: "You'd save $X more over 90 days" / "Goal reached 3 months earlier"

**Goals integration** (`goals.tsx` extension):
- Each goal card now shows projected completion date from cash flow forecast
- "What if I save more?" shortcut → opens scenario editor pre-filled with this goal

### Phased Rollout

1. **Phase 4a** — Schema additive changes (recurring_templates and goals columns)
2. **Phase 4b** — `forecast-engine.ts`: `projectCashFlow`, `detectRecurringPatterns` + tests
3. **Phase 4c** — `scenario-engine.ts`: `runScenario` + template library + tests
4. **Phase 4d** — Goal projection integration (`goals.ts` extension)
5. **Phase 4e** — Forecast tab UI: period selector, chart, event list
6. **Phase 4f** — Scenarios editor UI: change editor, result view, goal integration

---

## Acceptance Criteria

### Feature 1 (Household)
- [ ] Household creation, invitation (email + link), and acceptance flow works end-to-end
- [ ] Shared vs personal envelope visibility is enforced per permission model table
- [ ] Concurrent edit conflict is logged in `household_sync_log` and surfaced to admin
- [ ] Local-only mode continues to work with no Supabase dependency

### Feature 2 (Account Aggregation)
- [ ] Feature flags removed; Plaid Link flow is accessible from Accounts tab
- [ ] OFX/QFX parser correctly parses all standard OFX 1.x files and Quicken QFX exports
- [ ] Categorization pipeline applies rules in correct priority order
- [ ] Reconciliation UI shows all unreviewed imported transactions with batch confirm
- [ ] Import history records every import batch with transaction counts

### Feature 3 (Asset Coverage)
- [ ] Investments, holdings, property, and vehicle CRUD all function correctly
- [ ] Net worth dashboard shows asset class breakdown (liquid / investments / property / vehicles)
- [ ] Net worth snapshot correctly includes new asset types
- [ ] `calculateNetWorthBreakdown` returns accurate totals matching sum of individual assets

### Feature 4 (Forecasting)
- [ ] `projectCashFlow` produces a daily entry for every day in the 30/60/90 day period
- [ ] `detectRecurringPatterns` identifies monthly and biweekly patterns from transaction history with >=75% accuracy on test fixtures
- [ ] Scenario engine correctly calculates delta vs baseline for all 5 change types
- [ ] Forecast UI renders timeline chart with correct income/expense/balance data
- [ ] Lowest balance date is correctly identified and highlighted in the UI

### Cross-Feature
- [ ] All new tables included in `ALL_TABLES` export and covered by migration runner
- [ ] `SCHEMA_VERSION` incremented to 5
- [ ] All new engine functions have corresponding Vitest unit tests
- [ ] All new CRUD functions handle the `db` adapter pattern (expo-sqlite mobile / better-sqlite3 web)
- [ ] Hub module `modules/budget/` updated in parity with standalone `MyBudget/`
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm test` passes with zero failures
- [ ] `pnpm check:parity` passes

---

## Constraints

- All currency amounts stored as integer cents — no floating-point money math anywhere
- No analytics or telemetry — all computation is local
- Dark theme only — no light mode additions
- Household feature must degrade gracefully when Supabase is unavailable (local-only fallback)
- OFX/QFX parser must have zero external dependencies (pure TypeScript)
- New screens must match existing navigation patterns (Expo Router file-based on mobile, Next.js App Router on web)
- Both standalone `MyBudget/` and hub `modules/budget/` must be updated in the same execution
- Do not modify files outside the declared Scope section
- Follow Conventional Commits format for all commits in this plan
- FSL-1.1-Apache-2.0 license header not required on new files (follow existing pattern in repo)

---

## Implementation Order

Execute phases in this order (sequential, not parallel, unless noted):

1. Feature 1, Phase 1a (schema, local only) — unblocks all other features
2. Feature 2, Phase 2a–2b (schema + OFX parser) — additive, no UI changes
3. Feature 3, Phase 3a–3c (schema + engine + CRUD) — additive, no UI changes
4. Feature 4, Phase 4a–4d (schema + engines) — additive, no UI changes
5. Feature 3, Phase 3d–3e (asset UI screens) — can run parallel with Feature 4 UI
6. Feature 4, Phase 4e–4f (forecast UI) — parallel with Feature 3 UI
7. Feature 2, Phase 2c–2e (bank sync UI + reconciliation) — after schema settled
8. Feature 1, Phase 1b–1d (Supabase backend + invitation flow) — last, requires external setup

Phases 5 and 6 can run in parallel if using an Agent Team (web-dev + mobile-dev teammates).

---

## File Ownership (for Agent Teams)

| Zone | Owner | Files |
|------|-------|-------|
| Schema + migrations | budget-dev | `packages/shared/src/db/schema.ts`, `packages/shared/src/db/migrations.ts` |
| Engine modules | budget-dev | `packages/shared/src/engine/forecast-engine.ts`, `scenario-engine.ts`, `asset-engine.ts` |
| CRUD modules | budget-dev | `packages/shared/src/db/household-crud.ts`, `assets-crud.ts`, `import-history-crud.ts` |
| Bank sync | budget-dev | `packages/shared/src/bank-sync/ofx-parser.ts`, `categorization-pipeline.ts` |
| Mobile UI | mobile-dev | `apps/mobile/app/` (new screens), `apps/mobile/app/(tabs)/` (extensions) |
| Web UI | web-dev | `apps/web/app/` (new routes and extensions) |
| Hub module | module-dev | `modules/budget/src/definition.ts`, `modules/budget/src/types.ts` |
| Tests | tester | `packages/shared/src/**/__tests__/` |
