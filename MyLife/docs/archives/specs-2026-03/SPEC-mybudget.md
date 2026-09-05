# MyBudget - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** spec-mybudget
> **Reviewer:** principal-architect

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyBudget
- **Tagline:** Envelope budgeting made simple
- **Module ID:** `budget`
- **Feature ID Prefix:** BG
- **Table Prefix:** `bg_`
- **Tier:** Premium (included in MyLife Pro)
- **One-time Purchase (standalone):** $4.99

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Budgeting Beginner (Alex) | 22-30, recent grad or early career, minimal budgeting experience, comfortable with mobile apps | Get spending under control, build an emergency fund, avoid overdrafts, understand where money goes |
| YNAB Migrator (Sam) | 28-45, experienced budgeter frustrated with YNAB's $109/yr price, understands envelope methodology | Continue envelope budgeting without a recurring subscription, keep data private and local, import existing budget history |
| Privacy-Conscious Saver (Jordan) | 30-55, distrusts cloud-based finance apps, may use spreadsheets currently, values data ownership | Track finances without sending data to third-party servers, maintain full control over financial data, use bank sync only when explicitly opted in |
| Subscription Tracker (Riley) | 20-40, subscribes to 8-15 services, loses track of renewals and free trials, wants to reduce subscription bloat | See all subscriptions in one place, get renewal reminders before charges hit, identify subscriptions to cancel, understand true monthly cost of all subscriptions |
| Debt Reducer (Morgan) | 25-50, carries credit card or student loan debt, wants a clear payoff plan, motivated by visible progress | Create a debt payoff strategy (snowball or avalanche), see projected payoff dates, track progress month over month |

### 1.3 Core Value Proposition

MyBudget is a privacy-first envelope budgeting app that merges YNAB-style zero-based budgeting with integrated subscription tracking, bank sync, and financial analytics. Every dollar of income is assigned to a purpose (an "envelope"), and spending is tracked against those envelopes in real time. Unlike YNAB ($109/yr), Monarch ($100/yr), or Copilot ($95/yr), MyBudget stores all data locally on the device with zero cloud dependency, costs a one-time $4.99 (standalone) or is included in MyLife Pro, and treats bank sync as entirely optional rather than required. Users who want the discipline of envelope budgeting without handing their complete financial history to a startup's servers choose MyBudget.

### 1.4 Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Differentiator |
|-----------|-----------|------------|-------------------|
| YNAB ($109/yr) | Gold-standard envelope methodology, educational content, 6-user sharing, mature ecosystem | Expensive recurring subscription, requires cloud account, all data on YNAB servers, no subscription tracking | One-time purchase, all data local, integrated subscription catalog with 215 services, no account required |
| Monarch ($100/yr) | Net worth tracking, investment tracking, modern UI, household sharing | Requires cloud account, expensive, no envelope budgeting methodology, limited subscription management | True envelope budgeting, local-first privacy, integrated subscription detection from bank data |
| Rocket Money ($84-168/yr) | Subscription cancellation service, bill negotiation, automatic detection | Requires deep financial access permissions, variable pricing, no real budgeting methodology | Privacy-first (no third-party account access for cancellation), real budgeting methodology, one-time cost |
| Copilot ($95/yr) | AI auto-categorization, investment tracking, clean UI | iOS only, requires cloud, expensive recurring cost, no envelope budgeting | Cross-platform (iOS, Android, Web), local ML training, envelope methodology |
| Tiller ($79/yr) | Google Sheets integration, full customization, spreadsheet power | Requires Google account, steep learning curve, desktop-only workflow | Mobile-first, structured UI with no spreadsheet complexity, works offline |
| Splitwise ($30/yr) | Expense splitting, multi-currency, group tracking | No budgeting, limited to splitting only, cloud-required | Full budgeting system with expense splitting as an integrated feature |
| Expensify ($60/user/yr) | Receipt OCR, business expense reports, corporate features | Business-focused, expensive per-user pricing, cloud-required | Consumer-focused, on-device OCR, one-time pricing |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All user data is stored locally on the device in SQLite
- Zero analytics, zero telemetry, zero tracking
- No account required for core functionality
- Users own their data with full export (CSV, JSON) and delete capabilities
- No data ever leaves the device unless the user explicitly initiates an export or enables bank sync
- Bank sync via Plaid is entirely optional and can be disabled at any time; manual-only mode is always available
- Receipt images from OCR scanning are stored on-device only, never uploaded
- ML auto-categorization model trains and runs locally using only the user's own transaction history
- Exchange rate lookups use free public APIs; only the currency pair is sent, never transaction data
- All currency amounts are stored as integer cents to prevent floating-point rounding errors

**Privacy marketing angle:** "Your finances are between you and your bank. Not you, your bank, and a startup's servers."

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| BG-001 | Envelope Management | P0 | Core | None | Implemented |
| BG-002 | Account Management | P0 | Core | None | Implemented |
| BG-003 | Transaction Entry and Tracking | P0 | Core | BG-001, BG-002 | Implemented |
| BG-004 | Budget Month Engine | P0 | Core | BG-001, BG-003 | Implemented |
| BG-005 | Month-End Rollover | P0 | Core | BG-004 | Implemented |
| BG-006 | Category Groups | P0 | Core | BG-001 | Implemented |
| BG-007 | Savings Goals | P1 | Core | BG-001, BG-004 | Implemented |
| BG-008 | Subscription Catalog and Tracking | P0 | Core | None | Implemented |
| BG-009 | Renewal Calendar | P1 | Core | BG-008 | Implemented |
| BG-010 | Recurring Templates | P1 | Core | BG-003 | Implemented |
| BG-011 | Bank Sync (Plaid) | P1 | Data Management | BG-002, BG-003 | Implemented |
| BG-012 | Recurring Charge Detection | P1 | Data Management | BG-011 | Implemented |
| BG-013 | CSV Import | P1 | Import/Export | BG-003 | Implemented |
| BG-014 | Transaction Rules Engine | P1 | Data Management | BG-003 | Implemented |
| BG-015 | Payday Detection | P1 | Analytics | BG-003 | Implemented |
| BG-016 | Reports Dashboard | P1 | Analytics | BG-003, BG-004 | Implemented |
| BG-017 | Budget Alerts | P1 | Core | BG-004 | Implemented |
| BG-018 | Upcoming Transactions | P1 | Core | BG-010 | Implemented |
| BG-019 | Net Worth Tracking | P0 | Analytics | BG-002 | Implemented |
| BG-020 | Debt Payoff Planner | P1 | Analytics | BG-002 | Implemented |
| BG-021 | Multi-Currency Support | P1 | Core | BG-002, BG-003 | Implemented |
| BG-022 | Investment Tracking | P1 | Analytics | BG-019 | Not Started |
| BG-023 | Expense Splitting | P1 | Social | BG-003 | Not Started |
| BG-024 | Receipt Scanning (OCR) | P1 | Data Management | BG-003 | Not Started |
| BG-025 | ML Auto-Categorization | P2 | Data Management | BG-003, BG-014 | Not Started |
| BG-026 | Subscription Cancellation Assist | P2 | Core | BG-008 | Not Started |
| BG-027 | Age of Money | P2 | Analytics | BG-003, BG-004 | Not Started |
| BG-028 | Loan Planner and Calculator | P2 | Analytics | BG-020 | Not Started |
| BG-029 | Data Export | P1 | Import/Export | BG-003 | Not Started |
| BG-030 | Onboarding Flow | P0 | Onboarding | None | Not Started |
| BG-031 | Settings and Preferences | P0 | Settings | None | Implemented |
| BG-032 | Partner and Family Sharing | P2 | Social | BG-001, BG-003 | Not Started |

**Priority Legend:**
- **P0** - MVP must-have. The product does not launch without this.
- **P1** - High-value. Ship shortly after MVP or include if time allows.
- **P2** - Nice-to-have. Adds polish and delight but product is usable without it.
- **P3** - Future/low-priority. Planned for later phases or may be cut.

**Category Legend:**
- **Core** - Fundamental product functionality
- **Data Management** - CRUD operations, organization, search, import/sync
- **Analytics** - Stats, reports, insights, visualizations
- **Import/Export** - Data portability (import from competitors, export user data)
- **Social** - Sharing, splitting, collaborative features
- **Settings** - User preferences, configuration, customization
- **Onboarding** - First-run experience, tutorials, sample data

---

## 3. Feature Specifications

### BG-001: Envelope Management

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-001 |
| **Feature Name** | Envelope Management |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a budgeter, I want to create and organize spending envelopes (categories), so that I can assign every dollar of income to a specific purpose.

**Secondary:**
> As a YNAB migrator, I want to import my existing category structure with groups, so that I can continue my budgeting workflow without rebuilding from scratch.

#### 3.3 Detailed Description

Envelopes are the core organizational unit of MyBudget. Each envelope represents a spending category (e.g., "Groceries", "Rent", "Fun Money") and holds a monthly budget allocation. Users assign income to envelopes, and spending deducts from the assigned envelope. This is the zero-based budgeting methodology where every dollar has a job.

Envelopes can be organized into groups (e.g., "Fixed Expenses", "Variable Expenses", "Savings") for visual clarity. Each envelope tracks its monthly budget amount, whether surplus rolls over to the next month, and an optional icon and color for quick visual identification.

Users can archive envelopes they no longer use without deleting historical transaction data. Archived envelopes do not appear in the active budget view but remain accessible for reporting.

The system seeds four starter envelopes on first launch (Rent/Mortgage, Groceries, Transportation, Fun Money) to reduce the blank-slate problem for new users.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is a foundational feature)

**External Dependencies:**
- Local SQLite database is initialized and writable

**Assumed Capabilities:**
- User can navigate between screens via tab bar
- Database provider is mounted in the app tree

#### 3.5 User Interface Requirements

##### Screen: Budget Tab (Envelope List)

**Layout:**
- The screen has a top navigation bar showing "Budget" as the title and the current budget month (e.g., "March 2026") with left/right arrows to navigate months
- Below the navigation bar is a summary card showing "Ready to Assign" (the unallocated income amount) in large text, colored green if positive, red if negative, gray if zero
- The main content area is a scrollable vertical list of envelope groups
- Each group has a collapsible header showing the group name and the group total (sum of all envelope budgets in the group)
- Within each group, envelopes are listed with: icon, name, budgeted amount, spent amount, and available amount
- Available amount is color-coded: green if positive, yellow if less than 20% remaining, red if overspent
- A floating action button in the bottom-right corner opens the Add Envelope modal
- Long-pressing an envelope shows a context menu: Edit, Move to Group, Archive, Delete

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No envelopes exist (post-onboarding, all deleted) | Message: "Create your first envelope to start budgeting." with a prominent "Add Envelope" button |
| Loading | Database query in progress | Skeleton placeholder rows matching envelope list layout |
| Populated | 1+ envelopes exist | Normal envelope list grouped by category group |
| Error | Database read fails | Toast: "Could not load envelopes. Please restart the app." |

**Interactions:**
- Tap envelope row: Navigate to Envelope Detail screen
- Long press envelope row: Show context menu (Edit, Move to Group, Archive, Delete)
- Tap group header: Collapse/expand the group
- Tap month arrows: Navigate to previous/next budget month
- Tap "Ready to Assign": Show breakdown popover (total income, total allocated, overspent last month)
- Swipe left on envelope: Reveal Archive and Delete actions
- Drag handle on envelope: Reorder within group (updates sort_order)

**Transitions/Animations:**
- Group collapse/expand animates with a 200ms ease-in-out height transition
- Envelope deletion animates out with a 200ms fade + slide-left
- New envelope animates in from the top of its group

##### Modal: Add/Edit Envelope

**Layout:**
- Bottom sheet modal with fields: Name (text input, required), Icon (emoji picker, optional), Color (color picker, optional), Monthly Budget (currency input, default 0), Rollover Enabled (toggle, default on), Group (dropdown selector)
- Save button at bottom, Cancel in top-left corner
- In edit mode, the modal is pre-filled with current values and titled "Edit Envelope"

**Interactions:**
- Tap Save: Validates name is non-empty, creates/updates envelope, closes modal, scrolls list to the new/updated envelope
- Tap Cancel: Closes modal without saving (confirms if changes were made)
- Currency input: Accepts numeric input with automatic decimal formatting (type "1500" to get "$15.00")

#### 3.6 Data Requirements

##### Entity: Envelope

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| name | string | Required, 1-80 chars, trimmed | None | Display name of the envelope |
| icon | string | Nullable, emoji or icon identifier | null | Visual icon for quick identification |
| color | string | Nullable, hex color code | null | Accent color for the envelope |
| monthly_budget | integer | Non-negative, in cents | 0 | Default monthly allocation in cents |
| rollover_enabled | integer | 0 or 1 (SQLite boolean) | 1 | Whether unspent funds carry forward to next month |
| archived | integer | 0 or 1 (SQLite boolean) | 0 | Whether this envelope is hidden from active views |
| sort_order | integer | Non-negative | 0 | Position within its group for display ordering |
| created_at | string | ISO 8601 datetime | Current timestamp | Record creation time |
| updated_at | string | ISO 8601 datetime | Current timestamp | Last modification time |

**Relationships:**
- Envelope has many Transactions (one-to-many via transaction.envelope_id)
- Envelope has many BudgetAllocations (one-to-many via allocation.category_id)
- Envelope belongs to CategoryGroup (many-to-one via envelope.group_id, standalone only)
- Envelope has many Goals (one-to-many via goal.envelope_id)

**Indexes:**
- `archived, sort_order` - Optimizes the default list query (active envelopes sorted by position)

**Validation Rules:**
- name: Must not be empty after trimming whitespace
- name: Must be unique among non-archived envelopes (case-insensitive)
- monthly_budget: Must be a non-negative integer (cents)
- sort_order: Auto-assigned as max(sort_order) + 1 if not provided

**Example Data:**

```json
{
  "id": "env_a1b2c3d4",
  "name": "Groceries",
  "icon": "🛒",
  "color": "#22C55E",
  "monthly_budget": 60000,
  "rollover_enabled": 1,
  "archived": 0,
  "sort_order": 2,
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-02-01T08:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Envelope Available Balance Calculation

**Purpose:** Calculate how much money is available to spend in an envelope for a given month.

**Inputs:**
- carry_forward: integer (cents) - surplus or deficit rolled from previous month
- allocated: integer (cents) - amount budgeted to this envelope for the current month
- activity: integer (cents) - sum of transaction amounts in this envelope for the current month (negative for spending, positive for inflows)

**Logic:**

```
available = carry_forward + allocated + activity
```

**Formulas:**
- `available = carryForward + allocated + activity`
- `carryForward` for month M = available balance at end of month M-1 (if rollover_enabled = 1), otherwise 0
- `activity` = SUM(amount) for all transactions in this envelope during the month, where outflows are negative and inflows are positive

**Edge Cases:**
- New envelope with no history: carry_forward = 0, allocated = 0, activity = 0, available = 0
- Overspent envelope: available is negative (displayed in red)
- Envelope with rollover disabled: carry_forward always resets to 0 at month boundary, overspending is absorbed

##### Move Money Between Envelopes

**Purpose:** Transfer budget allocation from one envelope to another without creating a transaction.

**Inputs:**
- from_envelope_id: string
- to_envelope_id: string
- amount: integer (cents, must be positive)
- month: string (YYYY-MM)

**Logic:**

```
1. Validate amount > 0
2. Validate from_envelope_id and to_envelope_id are different
3. Validate both envelopes exist and are not archived
4. In a single transaction:
   a. Decrease from_envelope allocation by amount
   b. Increase to_envelope allocation by amount
5. Recalculate available balances for both envelopes
```

**Edge Cases:**
- Moving more than available in source envelope: Allowed (source goes negative/overspent)
- Moving to/from same envelope: Rejected with validation error
- Moving zero or negative amount: Rejected with validation error

**Sort/Filter/Ranking Logic:**
- **Default sort:** By group, then by sort_order within group
- **Available sort options:** Alphabetical, by available amount (ascending/descending), by budgeted amount
- **Filter options:** Active only (default), Archived only, All
- **Search:** Name field, substring matching, case-insensitive

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Name is empty or whitespace | Inline validation below name field: "Envelope name is required" | User fills in the name, error clears on input |
| Duplicate name (non-archived) | Inline validation: "An envelope with this name already exists" | User changes the name |
| Database write fails | Toast: "Could not save envelope. Please try again." | User taps Save again |
| Delete envelope with transactions | Confirmation dialog: "This envelope has X transactions. Deleting it will un-categorize those transactions. Continue?" | User confirms or cancels |

**Validation Timing:**
- Name validation runs on blur and on submit
- Duplicate name check runs on submit

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** no envelopes exist,
   **When** the user taps "Add Envelope", enters "Groceries", sets budget to $600, and taps Save,
   **Then** the envelope appears in the list showing "Groceries" with $600.00 budgeted and $600.00 available.

2. **Given** an envelope "Groceries" exists with $600 budgeted and $0 spent,
   **When** the user edits the envelope and changes the budget to $500,
   **Then** the available amount updates to $500.00.

3. **Given** two envelopes exist ("Groceries" $600, "Fun" $200),
   **When** the user moves $100 from Groceries to Fun,
   **Then** Groceries shows $500 available and Fun shows $300 available.

**Edge Cases:**

4. **Given** an envelope with rollover enabled has $50 remaining at month end,
   **When** the user navigates to the next month,
   **Then** the envelope shows $50 as carry-forward plus any new allocation.

5. **Given** an envelope with rollover disabled has $50 remaining at month end,
   **When** the user navigates to the next month,
   **Then** the carry-forward is $0 and available equals only the new month's allocation.

**Negative Tests:**

6. **Given** the add envelope form is open,
   **When** the user submits with an empty name,
   **Then** the system shows "Envelope name is required" and does not save.

7. **Given** an envelope named "Groceries" exists,
   **When** the user creates another envelope named "Groceries",
   **Then** the system shows "An envelope with this name already exists" and does not save.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates available balance correctly | carry: 5000, allocated: 60000, activity: -15000 | available: 50000 |
| available is zero for new envelope | carry: 0, allocated: 0, activity: 0 | available: 0 |
| available goes negative when overspent | carry: 0, allocated: 30000, activity: -45000 | available: -15000 |
| move money decreases source and increases target | move 10000 from A(50000) to B(20000) | A: 40000, B: 30000 |
| rejects move of zero amount | amount: 0 | validation error |
| rejects move to same envelope | from: env_1, to: env_1 | validation error |
| validates name is not empty | name: "  " | validation error: "name required" |
| validates name max length | name: 81 chars | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create envelope and verify persistence | 1. Create envelope "Rent" with budget 150000, 2. Close and reopen app, 3. Check list | "Rent" appears with $1,500.00 budget |
| Archive envelope hides from active list | 1. Create 3 envelopes, 2. Archive one, 3. Check active list | Only 2 envelopes visible, archived one absent |
| Delete envelope un-categorizes transactions | 1. Create envelope, 2. Add 2 transactions to it, 3. Delete envelope | Transactions exist with null envelope_id |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user sets up budget categories | 1. Complete onboarding, 2. See 4 starter envelopes, 3. Add "Utilities" envelope with $200 budget, 4. Rename "Fun Money" to "Entertainment" | 5 envelopes visible with correct names and budgets, Ready to Assign reflects total income minus total allocations |

---

### BG-002: Account Management

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-002 |
| **Feature Name** | Account Management |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a budgeter, I want to add my financial accounts (checking, savings, credit cards, cash), so that I can track balances and associate transactions with the correct account.

**Secondary:**
> As a privacy-conscious user, I want to manually enter account balances without connecting to my bank, so that I maintain full control over my data.

#### 3.3 Detailed Description

Accounts represent the user's real-world financial accounts. Each account has a type (checking, savings, credit, cash, other), a current balance tracked in cents, and a currency code. Accounts serve as the "where" for transactions (which account did the money flow through?) while envelopes serve as the "why" (what was the money for?).

The system seeds two starter accounts on first launch (Checking and Cash). Users can add additional accounts manually or, if bank sync is enabled, accounts are created automatically from Plaid data. Account balances update automatically as transactions are added. Credit card accounts have negative balances representing debt.

Accounts can be archived but not deleted if they have associated transactions, preserving data integrity.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (foundational feature)

**External Dependencies:**
- Local SQLite database is initialized and writable

**Assumed Capabilities:**
- User can navigate to the Accounts tab

#### 3.5 User Interface Requirements

##### Screen: Accounts Tab

**Layout:**
- Top navigation bar showing "Accounts" as title
- Summary section at top showing total assets (sum of checking + savings + cash balances), total liabilities (sum of credit card balances), and net position (assets minus liabilities)
- Below the summary, accounts are grouped by type: Checking, Savings, Credit Cards, Cash, Other
- Each account row shows: account name, current balance (formatted with currency symbol), and a small trend indicator (up/down arrow comparing to 30 days ago)
- Tapping an account navigates to the Account Detail screen showing recent transactions for that account
- Add Account button in the top-right corner

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No accounts exist | Message: "Add your first account to start tracking." with "Add Account" button |
| Loading | Database query in progress | Skeleton rows |
| Populated | 1+ accounts exist | Grouped account list with balances |
| Error | Database read fails | Toast: "Could not load accounts." |

**Interactions:**
- Tap account row: Navigate to Account Detail (filtered transaction list)
- Tap Add Account: Open Add Account modal
- Long press account: Context menu (Edit, Archive)
- Swipe left on account: Reveal Edit and Archive actions

##### Modal: Add/Edit Account

**Layout:**
- Bottom sheet with fields: Name (text, required), Type (picker: Checking, Savings, Credit Card, Cash, Other), Starting Balance (currency input), Currency (3-letter code, default USD)
- Save and Cancel buttons

#### 3.6 Data Requirements

##### Entity: Account

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| name | string | Required, 1-80 chars | None | Account display name |
| type | enum | One of: cash, checking, savings, credit, other | checking | Account type |
| current_balance | integer | Any integer (cents), negative for credit debt | 0 | Current balance in cents |
| currency | string | Exactly 3 chars, ISO 4217 | "USD" | Currency code |
| archived | integer | 0 or 1 | 0 | Whether this account is hidden |
| sort_order | integer | Non-negative | 0 | Display position within type group |
| created_at | string | ISO 8601 | Current timestamp | Creation time |
| updated_at | string | ISO 8601 | Current timestamp | Last modification time |

**Relationships:**
- Account has many Transactions (one-to-many via transaction.account_id)
- Account has many BankAccounts (one-to-many via bank_account.local_account_id, if bank sync enabled)

**Indexes:**
- `archived, type, sort_order` - Optimizes grouped list query

**Example Data:**

```json
{
  "id": "acc_checking_main",
  "name": "Chase Checking",
  "type": "checking",
  "current_balance": 345670,
  "currency": "USD",
  "archived": 0,
  "sort_order": 0,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-03-06T12:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Balance Calculation

**Purpose:** Keep account balance in sync with transactions.

**Logic:**

```
1. On transaction create: account.current_balance += transaction.amount (inflow positive, outflow negative)
2. On transaction update: reverse old amount, apply new amount
3. On transaction delete: reverse the transaction amount
4. All operations are atomic (single database transaction)
```

**Formulas:**
- `total_assets = SUM(current_balance) WHERE type IN ('checking', 'savings', 'cash') AND archived = 0`
- `total_liabilities = ABS(SUM(current_balance)) WHERE type = 'credit' AND archived = 0`
- `net_position = total_assets - total_liabilities`

**Edge Cases:**
- Credit card with positive balance (overpayment): Displayed as positive, still grouped under liabilities
- Account with zero balance: Displayed normally, not hidden
- Account balance overflow: Integer range supports up to $92,233,720,368,547,758.07 (64-bit integer cents), which is sufficient

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Name is empty | Inline: "Account name is required" | User enters name |
| Duplicate name | Inline: "An account with this name already exists" | User changes name |
| Archive account with pending bank sync | Warning: "This account is connected to bank sync. Archiving will pause sync." | User confirms or cancels |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is on the Accounts tab,
   **When** they add a new checking account "Wells Fargo" with starting balance $2,500.00,
   **Then** the account appears under "Checking" with balance $2,500.00 and total assets updates.

2. **Given** a checking account with balance $2,500.00 and a credit card with balance -$800.00,
   **When** the user views the Accounts tab summary,
   **Then** total assets shows $2,500.00, total liabilities shows $800.00, and net position shows $1,700.00.

**Edge Cases:**

3. **Given** a credit card account with balance -$500.00,
   **When** the user adds a $600 payment transaction,
   **Then** the balance becomes $100.00 (overpayment) and is still grouped under Credit Cards.

**Negative Tests:**

4. **Given** the add account form,
   **When** the user submits with no name,
   **Then** validation error "Account name is required" is shown and nothing is saved.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| total assets excludes credit accounts | checking: 100000, savings: 50000, credit: -30000 | total_assets: 150000 |
| total liabilities is absolute value of credit balances | credit1: -30000, credit2: -15000 | total_liabilities: 45000 |
| net position is assets minus liabilities | assets: 150000, liabilities: 45000 | net_position: 105000 |
| balance updates on transaction create | balance: 100000, outflow: -5000 | new_balance: 95000 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create account and verify in list | 1. Add "Savings" account with $10,000, 2. Check Accounts tab | Account appears under Savings group with $10,000.00 |
| Transaction updates account balance | 1. Create checking account at $5,000, 2. Add $50 outflow transaction, 3. Check balance | Balance shows $4,950.00 |

---

### BG-003: Transaction Entry and Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-003 |
| **Feature Name** | Transaction Entry and Tracking |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a budgeter, I want to quickly record purchases and income as they happen, so that my budget stays accurate and I can see my spending in real time.

**Secondary:**
> As a power user, I want to split a single transaction across multiple envelopes, so that a grocery trip that includes household supplies can be categorized accurately.

#### 3.3 Detailed Description

Transactions are the fundamental data points of MyBudget. Every inflow (income, refund, transfer in) and outflow (purchase, bill payment, transfer out) is recorded as a transaction. Each transaction has an amount (always stored as integer cents), a direction (inflow, outflow, or transfer), an optional envelope assignment (the "why"), an optional account assignment (the "where"), a merchant/payee name, a note, and a date.

Transactions support splitting: a single $150 grocery receipt can be split into $120 for "Groceries" and $30 for "Household Supplies". Splits must sum exactly to the parent transaction amount.

The transaction list supports filtering by envelope, account, direction, and date range, with pagination (up to 500 per page). Transactions are displayed in reverse chronological order by default.

Transfers between accounts are recorded as a special transaction type that creates both an outflow from the source and an inflow to the destination, linked together.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-001: Envelope Management - for categorizing transactions into envelopes
- BG-002: Account Management - for associating transactions with accounts

**External Dependencies:**
- Local SQLite database

**Assumed Capabilities:**
- Envelopes and accounts are already created

#### 3.5 User Interface Requirements

##### Screen: Transactions Tab

**Layout:**
- Top navigation bar with "Transactions" title and a filter icon on the right
- Below the nav, a search bar for merchant/note search
- Filter chips row: All, This Month, This Week, Inflows, Outflows
- Main content is a scrollable list of transactions grouped by date (e.g., "Today", "Yesterday", "March 4, 2026")
- Each transaction row shows: merchant icon/initial, merchant name, envelope name (small text below merchant), amount (right-aligned, green for inflows, red for outflows), and time
- A floating action button opens the Add Transaction screen
- Pull-to-refresh reloads the list

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No transactions exist | Message: "No transactions yet. Tap + to add your first one." |
| Loading | Query in progress | Skeleton rows |
| Populated | Transactions exist | Grouped date list |
| Search Active | Search text entered | Filtered list; if no matches: "No transactions matching '[query]'" |
| Filtered | Filter chips active | Filtered list with active filter highlighted |

**Interactions:**
- Tap transaction: Navigate to Transaction Detail/Edit screen
- Swipe left: Reveal Delete action
- Tap FAB (+): Navigate to Add Transaction screen
- Tap filter icon: Open filter drawer (envelope picker, account picker, date range, direction)
- Pull to refresh: Re-query database
- Infinite scroll: Load next page (500 items per page)

##### Screen: Add/Edit Transaction

**Layout:**
- Full screen with amount input at top (large numeric display)
- Direction toggle: Outflow (default) | Inflow | Transfer
- Below amount: Merchant/Payee (text input with payee cache autocomplete), Envelope (picker), Account (picker), Date (date picker, default today), Note (text input, optional)
- For transfers: Source Account and Destination Account pickers replace single Account picker
- "Add Split" button below envelope picker to split across envelopes
- Save button at bottom

**Split Interface:**
- When "Add Split" is tapped, the single envelope picker is replaced with a split editor
- Each split row: Envelope picker + Amount input
- A "Remaining" indicator shows how much of the total is unassigned
- "Add Split" button to add more rows
- Splits must sum exactly to the total amount; Save is disabled until they do

#### 3.6 Data Requirements

##### Entity: Transaction

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| envelope_id | string | Nullable, references Envelope.id | null | Which envelope this spending is categorized under |
| account_id | string | Nullable, references Account.id | null | Which account this transaction flows through |
| amount | integer | Non-zero, in cents | None | Transaction amount in cents (always positive; direction determines sign) |
| direction | enum | One of: inflow, outflow, transfer | None | Whether money came in, went out, or moved between accounts |
| merchant | string | Nullable, max 200 chars | null | Merchant or payee name |
| note | string | Nullable | null | User note or memo |
| occurred_on | string | YYYY-MM-DD format | Current date | Date the transaction occurred |
| created_at | string | ISO 8601 | Current timestamp | Record creation time |
| updated_at | string | ISO 8601 | Current timestamp | Last modification time |

##### Entity: TransactionSplit (standalone)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| transaction_id | string | References Transaction.id, required | None | Parent transaction |
| envelope_id | string | References Envelope.id, required | None | Envelope for this portion |
| amount | integer | Positive, in cents | None | Amount assigned to this envelope |
| memo | string | Nullable | null | Optional memo for this split |

**Relationships:**
- Transaction belongs to Envelope (many-to-one, nullable)
- Transaction belongs to Account (many-to-one, nullable)
- Transaction has many TransactionSplits (one-to-many)

**Indexes:**
- `occurred_on DESC` - Default sort order
- `envelope_id, occurred_on` - Envelope spending queries
- `account_id, occurred_on` - Account transaction queries
- `merchant` - Payee search and grouping

**Validation Rules:**
- amount: Must be a positive integer (direction determines actual sign)
- If splits exist, envelope_id on the parent transaction must be null (splits handle categorization)
- Sum of split amounts must equal parent transaction amount exactly
- occurred_on: Must be a valid YYYY-MM-DD date string
- For transfers: both source and destination account must be specified and different

**Example Data:**

```json
{
  "id": "txn_grocery_001",
  "envelope_id": "env_groceries",
  "account_id": "acc_checking_main",
  "amount": 8547,
  "direction": "outflow",
  "merchant": "Trader Joe's",
  "note": "Weekly groceries",
  "occurred_on": "2026-03-05",
  "created_at": "2026-03-05T18:30:00Z",
  "updated_at": "2026-03-05T18:30:00Z"
}
```

#### 3.7 Business Logic Rules

##### Transaction Amount Convention

**Purpose:** Define how amounts are stored and interpreted.

**Logic:**

```
1. All amounts stored as positive integers in cents
2. Direction field determines sign for calculations:
   - inflow: adds to account balance, adds to envelope activity
   - outflow: subtracts from account balance, subtracts from envelope activity
   - transfer: subtracts from source account, adds to destination account, no envelope impact
3. Activity for envelope calculations: inflow = +amount, outflow = -amount
```

##### Split Transaction Validation

**Purpose:** Ensure splits are consistent with parent transaction.

**Logic:**

```
1. IF transaction has splits:
   a. Parent transaction envelope_id MUST be null
   b. SUM(split.amount) MUST equal transaction.amount exactly
   c. Each split.amount MUST be positive
   d. Each split.envelope_id MUST reference an existing, non-archived envelope
2. IF adding/editing a split causes sum != parent amount:
   a. Show "Remaining: $X.XX" indicator
   b. Disable Save button until sum matches
```

**Edge Cases:**
- Single split equal to full amount: Allowed (functionally same as no split)
- All splits assigned to same envelope: Allowed but redundant
- Edit parent amount when splits exist: Splits remain, user must adjust to match new total

##### Payee Cache

**Purpose:** Provide autocomplete suggestions when entering merchant names.

**Logic:**

```
1. After saving a transaction with a merchant name:
   a. If merchant not in payee_cache, add it with count = 1
   b. If merchant exists, increment count
2. Autocomplete returns payees matching prefix, sorted by count descending
3. Cache stores last-used envelope for each payee to auto-suggest categorization
```

**Sort/Filter/Ranking Logic:**
- **Default sort:** occurred_on DESC, created_at DESC
- **Available sort options:** Date (newest/oldest), Amount (highest/lowest), Merchant (A-Z)
- **Filter options:** Envelope, Account, Direction, Date range (from/to). Filters combine with AND logic
- **Search:** Merchant and note fields, substring matching, case-insensitive
- **Pagination:** limit (max 500, default 50), offset

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Amount is zero or empty | Inline: "Enter an amount" | User enters amount |
| Splits don't sum to total | "Remaining" indicator shows difference, Save disabled | User adjusts split amounts |
| Referenced envelope was deleted | Transaction saves with null envelope_id, toast: "Envelope no longer exists" | User selects a different envelope |
| Database write fails | Toast: "Could not save transaction. Please try again." | User retries |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a checking account with $5,000 and a "Groceries" envelope with $600 budgeted,
   **When** the user adds a $85.47 outflow to "Groceries" from Checking,
   **Then** the transaction appears in the list, checking balance becomes $4,914.53, and Groceries available decreases by $85.47.

2. **Given** a $150 transaction at Target,
   **When** the user splits it as $120 Groceries + $30 Household,
   **Then** both envelopes show the respective amounts deducted, and the transaction list shows the full $150 with a split indicator.

3. **Given** existing transactions,
   **When** the user filters by "Groceries" envelope and date range March 1-31,
   **Then** only grocery transactions in March are shown.

**Edge Cases:**

4. **Given** a transaction with splits,
   **When** the user edits the parent amount from $150 to $160,
   **Then** the splits remain but a "Remaining: $10.00" indicator appears, and Save is disabled until splits are adjusted.

**Negative Tests:**

5. **Given** the add transaction form,
   **When** the user tries to save with amount $0,
   **Then** validation error "Enter an amount" is shown.

6. **Given** a split transaction,
   **When** splits total $140 but parent amount is $150,
   **Then** Save button is disabled and "Remaining: $10.00" is displayed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| outflow subtracts from envelope activity | amount: 5000, direction: outflow | activity delta: -5000 |
| inflow adds to envelope activity | amount: 200000, direction: inflow | activity delta: +200000 |
| transfer does not affect envelope | direction: transfer | envelope activity: unchanged |
| split validation passes when sum matches | splits: [8000, 7000], parent: 15000 | valid |
| split validation fails when sum differs | splits: [8000, 6000], parent: 15000 | error: sum mismatch |
| payee cache autocomplete returns top matches | query: "Tra", cache: [{Trader Joe's, 15}, {Target, 8}, {Travel Inc, 1}] | [Trader Joe's, Target, Travel Inc] |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Transaction updates account and envelope | 1. Add $50 outflow to Groceries from Checking, 2. Check account balance, 3. Check envelope available | Both reflect $50 deduction |
| Delete transaction reverses impact | 1. Add $50 outflow, 2. Delete it, 3. Check balances | Balances restored to pre-transaction values |
| Split transaction distributes across envelopes | 1. Add $100 transaction, 2. Split 60/40 across two envelopes, 3. Check both envelopes | First: -$60, Second: -$40 |

---

### BG-004: Budget Month Engine

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-004 |
| **Feature Name** | Budget Month Engine |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a budgeter, I want to see a complete picture of my budget for any given month showing income, allocations, spending, and what is left to assign, so that I can make informed spending decisions.

**Secondary:**
> As a planner, I want to allocate money to future months in advance, so that I can budget ahead when I receive extra income.

#### 3.3 Detailed Description

The Budget Month Engine is the central calculation system that ties together income, allocations, and spending into a coherent monthly view. It implements zero-based budgeting: all income must be assigned to envelopes until "Ready to Assign" reaches zero.

For each month, the engine calculates the state of every envelope (carry-forward + allocated + activity = available) and the overall budget state (total income, total allocated, overspent from last month, ready to assign). Users navigate between months to review history or plan ahead.

The "Ready to Assign" metric is the single most important number in the app. It represents unallocated income and should ideally be zero (all dollars have a job). If positive, the user has unassigned money. If negative, the user has over-allocated (assigned more than they earned).

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-001: Envelope Management - provides the envelopes to allocate to
- BG-003: Transaction Entry - provides income and spending data

**External Dependencies:**
- Local SQLite database

#### 3.5 User Interface Requirements

##### Screen: Budget Tab (Month View)

**Layout:**
- This is the same screen as BG-001's Budget Tab, but the focus here is on the month-level calculations
- "Ready to Assign" banner at top with the amount prominently displayed
- Tapping "Ready to Assign" expands a breakdown: "Income This Month", "Allocated This Month", "Overspent Last Month"
- Month navigation arrows (left = previous, right = next) with the current month name in the center
- Each envelope row shows: Budgeted (editable inline), Spent (read-only), Available (calculated)
- Group totals aggregate the values of all envelopes within the group

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Ready to Assign > 0 | Unallocated income exists | Green banner: "$X.XX Ready to Assign" |
| Ready to Assign = 0 | All income allocated | Gray banner: "$0.00 Ready to Assign" with checkmark |
| Ready to Assign < 0 | Over-allocated | Red banner: "-$X.XX Over-Assigned" with warning icon |
| Future month | No income yet | Banner shows carry-forward only |

**Interactions:**
- Tap budgeted amount on envelope row: Inline edit mode with numeric keyboard
- Enter amount and confirm: Updates the allocation for that envelope in the current month
- Tap "Ready to Assign" banner: Expand/collapse the breakdown detail

#### 3.6 Data Requirements

##### Entity: BudgetAllocation

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| category_id | string | References Envelope.id, required | None | Which envelope this allocation is for |
| month | string | YYYY-MM format, required | None | Which budget month this allocation applies to |
| amount | integer | Non-negative, in cents | 0 | Amount allocated to this envelope for this month |
| created_at | string | ISO 8601 | Current timestamp | Creation time |
| updated_at | string | ISO 8601 | Current timestamp | Last modification time |

**Indexes:**
- `month, category_id` UNIQUE - One allocation per envelope per month
- `category_id` - Envelope history queries

**Validation Rules:**
- amount: Must be a non-negative integer
- month: Must be valid YYYY-MM format
- category_id + month: Must be unique (upsert on conflict)

#### 3.7 Business Logic Rules

##### Monthly Budget State Calculation

**Purpose:** Compute the complete budget state for a given month.

**Inputs:**
- month: string (YYYY-MM)
- all envelopes: Envelope[]
- all allocations for the month: BudgetAllocation[]
- all transactions for the month: Transaction[]
- carry-forward values from previous month: Map<envelope_id, cents>

**Logic:**

```
FOR each envelope:
  1. carryForward = previous month's available (if rollover_enabled), else 0
  2. allocated = allocation.amount for this envelope in this month (0 if none)
  3. activity = SUM(transactions in this envelope during this month)
     - inflows add positively
     - outflows add negatively
     - splits: each split's amount applies to its respective envelope
  4. available = carryForward + allocated + activity

AGGREGATE:
  5. totalIncome = SUM(all inflow transactions in this month, regardless of envelope)
  6. totalAllocated = SUM(all allocation.amount for this month)
  7. overspentLastMonth = SUM(ABS(available)) for all envelopes that were negative
     at end of previous month AND had rollover_enabled = 0
  8. readyToAssign = totalIncome - totalAllocated - overspentLastMonth
```

**Formulas:**
- `available = carryForward + allocated + activity`
- `readyToAssign = totalIncome - totalAllocated - overspentLastMonth`
- `groupTotal.budgeted = SUM(allocated) for all envelopes in group`
- `groupTotal.activity = SUM(activity) for all envelopes in group`
- `groupTotal.available = SUM(available) for all envelopes in group`

**Edge Cases:**
- First month ever (no history): All carry-forwards are 0, readyToAssign = income
- Month with no income: readyToAssign = -totalAllocated (negative if any allocations made)
- Future month with no transactions: Shows only carry-forward + any advance allocations
- Overspent envelope with rollover enabled: Negative carry-forward passes to next month (the user must cover it)
- Overspent envelope with rollover disabled: Overspending is absorbed into readyToAssign as a deduction next month

##### Allocate to Category

**Purpose:** Set or update the budget allocation for a specific envelope in a specific month.

**Logic:**

```
1. Validate amount >= 0
2. UPSERT into budget_allocations:
   - If no allocation exists for (category_id, month): INSERT
   - If allocation exists: UPDATE amount
3. Recalculate readyToAssign for the month
4. Return updated month budget state
```

##### Target Types

**Purpose:** Different envelopes can have different budgeting target strategies.

**Types:**
- `monthly` - Fixed monthly target. Progress = allocated / targetAmount * 100
- `savings_goal` - Accumulate toward a total. Progress = available / targetAmount * 100 (can exceed 100%)
- `debt_payment` - Regular debt payment target. Progress = allocated / targetAmount * 100

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Allocation exceeds Ready to Assign | Ready to Assign goes negative (red), warning shown | User reduces allocations or earns more income |
| Database calculation error | Toast: "Budget calculation error. Data may be stale." | Pull to refresh, or restart app |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a new month with $5,000 income deposited,
   **When** the user allocates $1,500 to Rent, $600 to Groceries, $200 to Transport, and $100 to Fun,
   **Then** Ready to Assign shows $2,600 (5000 - 1500 - 600 - 200 - 100).

2. **Given** all income is allocated (Ready to Assign = $0),
   **When** the user increases Groceries allocation by $50,
   **Then** Ready to Assign becomes -$50 (shown in red as "Over-Assigned").

3. **Given** March budget is fully set up,
   **When** the user taps the right arrow to navigate to April,
   **Then** April shows carry-forward values from March and Ready to Assign reflects any advance allocations.

**Edge Cases:**

4. **Given** an envelope with $100 available at month end with rollover disabled,
   **When** the month rolls over,
   **Then** the $100 surplus does NOT carry forward, and the envelope starts at $0 + new allocation.

5. **Given** an envelope overspent by $50 at month end with rollover disabled,
   **When** the month rolls over,
   **Then** next month's Ready to Assign is reduced by $50 (the overspending is covered from general funds).

**Negative Tests:**

6. **Given** an envelope in the budget view,
   **When** the user enters a negative allocation amount,
   **Then** the input is rejected and the previous value is restored.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates readyToAssign correctly | income: 500000, allocated: 300000, overspent: 0 | readyToAssign: 200000 |
| readyToAssign deducts last month overspending | income: 500000, allocated: 300000, overspent: 5000 | readyToAssign: 195000 |
| envelope available includes carry-forward | carry: 5000, allocated: 60000, activity: -20000 | available: 45000 |
| no rollover resets carry-forward to zero | rollover: false, prev_available: 10000 | carryForward: 0 |
| negative rollover carries when enabled | rollover: true, prev_available: -5000 | carryForward: -5000 |
| group totals sum envelopes | env1_available: 10000, env2_available: 20000 | group_available: 30000 |
| allocation upsert updates existing | existing: 50000, new: 60000 | stored: 60000 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full month budget cycle | 1. Add $5000 income, 2. Allocate to 4 envelopes, 3. Spend in 2 envelopes, 4. Check all values | Ready to Assign, all available amounts, and group totals are correct |
| Month navigation preserves state | 1. Set up March budget, 2. Navigate to April, 3. Navigate back to March | March values unchanged |
| Overspend rollover handling | 1. Overspend envelope by $50 (rollover off), 2. Advance to next month | Next month readyToAssign reduced by $50 |

---

### BG-005: Month-End Rollover

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-005 |
| **Feature Name** | Month-End Rollover |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a budgeter, I want unspent money in my envelopes to automatically carry forward to the next month, so that I can accumulate savings in specific categories without manual work.

**Secondary:**
> As a disciplined budgeter, I want the option to NOT roll over surplus in certain envelopes (like "Fun Money"), so that I start fresh each month and avoid accumulating "permission to splurge."

#### 3.3 Detailed Description

Month-end rollover determines what happens to each envelope's available balance when a new month begins. Two behaviors are supported per-envelope:

1. **Rollover enabled (default):** The available balance (positive or negative) carries forward as the next month's carry-forward value. Positive balances accumulate (great for saving toward irregular expenses). Negative balances carry as debt (the user must cover the overspending from future allocations).

2. **Rollover disabled:** At month boundary, surplus is released back to "Ready to Assign" (effectively reset to zero). However, if the envelope was overspent (negative), that overspending is deducted from next month's Ready to Assign as a penalty, ensuring the total budget remains balanced.

Rollover processing is computed on-demand when the user navigates to a new month, not as a scheduled batch job. The system calculates the chain of rollovers from the first month with data through the requested month.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-004: Budget Month Engine - provides monthly state calculations

**External Dependencies:**
- None

#### 3.5 User Interface Requirements

Rollover is primarily a background calculation with UI touchpoints in:
- The "rollover_enabled" toggle on each envelope (see BG-001 Add/Edit Envelope modal)
- The "Ready to Assign" breakdown showing "Overspent Last Month" line item (see BG-004)
- Each envelope's "Available" column showing accumulated carry-forward amounts

No dedicated rollover screen is needed. The behavior is visible through the existing Budget Tab.

#### 3.6 Data Requirements

##### Entity: BudgetRollover

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| category_id | string | References Envelope.id, required | None | Which envelope this rollover applies to |
| from_month | string | YYYY-MM, required | None | Source month |
| to_month | string | YYYY-MM, required | None | Destination month |
| amount | integer | Any integer (cents) | None | Rollover amount: positive = surplus, negative = overspent |
| created_at | string | ISO 8601 | Current timestamp | Creation time |

**Indexes:**
- `to_month, category_id` UNIQUE - One rollover record per envelope per month transition
- `from_month` - Query rollovers originating from a specific month

#### 3.7 Business Logic Rules

##### Calculate Rollover for a Single Envelope

**Purpose:** Determine the carry-forward amount for an envelope from month M to month M+1.

**Inputs:**
- envelope: Envelope (specifically rollover_enabled flag)
- available_at_month_end: integer (cents)

**Logic:**

```
1. Calculate available = carryForward + allocated + activity for month M
2. IF envelope.rollover_enabled = 1:
   RETURN available (carry everything, positive or negative)
3. ELSE (rollover disabled):
   IF available >= 0:
     RETURN 0 (surplus released back to general pool)
   ELSE:
     RETURN 0 (overspending absorbed into next month's readyToAssign penalty)
```

##### Process Month Rollover (Batch)

**Purpose:** Generate rollover records for all envelopes transitioning from month M to M+1.

**Logic:**

```
1. Get all non-archived envelopes
2. FOR each envelope:
   a. Calculate available balance at end of month M
   b. Calculate rollover amount per the single-envelope rule above
   c. INSERT rollover record (category_id, from_month, to_month, amount)
3. Calculate overspent total for non-rollover envelopes:
   overspentLastMonth = SUM(ABS(available)) WHERE available < 0 AND rollover_enabled = 0
4. This overspentLastMonth value feeds into next month's readyToAssign calculation
```

**Edge Cases:**
- Envelope created mid-month: Treated normally, carry-forward from creation month is based on available balance
- Envelope archived during month: Still generates rollover if it had activity, but won't appear in next month's active view
- Month with no transactions: Carry-forward is simply the previous carry-forward plus any allocation

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Rollover calculation fails | Toast: "Budget calculation error for [month]" | Re-navigate to the month to trigger recalculation |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** Groceries envelope has $50 available at end of March with rollover enabled,
   **When** the user navigates to April,
   **Then** Groceries shows $50 carry-forward plus April's allocation.

2. **Given** Fun Money has $30 available at end of March with rollover disabled,
   **When** the user navigates to April,
   **Then** Fun Money starts at $0 carry-forward plus April's allocation.

**Edge Cases:**

3. **Given** Groceries is overspent by $25 at end of March with rollover enabled,
   **When** navigating to April,
   **Then** Groceries shows -$25 carry-forward (user must cover the deficit from April allocation).

4. **Given** Fun Money is overspent by $40 at end of March with rollover disabled,
   **When** navigating to April,
   **Then** Fun Money starts at $0 carry-forward, but April's Ready to Assign is reduced by $40.

**Negative Tests:**

5. **Given** no transactions or allocations exist for May,
   **When** navigating to May,
   **Then** all carry-forwards are correctly computed from the chain of previous months.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| rollover enabled carries positive balance | rollover: true, available: 5000 | carryForward: 5000 |
| rollover enabled carries negative balance | rollover: true, available: -3000 | carryForward: -3000 |
| rollover disabled releases surplus | rollover: false, available: 5000 | carryForward: 0 |
| rollover disabled absorbs overspending | rollover: false, available: -3000 | carryForward: 0, overspent deduction: 3000 |
| batch processes all envelopes | 3 envelopes with varying states | 3 rollover records created |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Multi-month rollover chain | 1. Set up Jan with $100 surplus, 2. Feb adds $200 allocation, 3. No spending in Feb, 4. Check March | March carry-forward is $300 (100 + 200) |

---

### BG-006: Category Groups

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-006 |
| **Feature Name** | Category Groups |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a budgeter with many envelopes, I want to organize them into logical groups (Fixed Expenses, Variable Expenses, Savings), so that my budget view is organized and group totals help me understand spending patterns.

#### 3.3 Detailed Description

Category groups are containers for organizing envelopes into logical sections. They appear as collapsible headers in the budget view. Each group shows aggregate totals (budgeted, activity, available) for all envelopes within it.

Groups can be reordered via drag-and-drop, and envelopes can be moved between groups. A default "Uncategorized" group catches any envelope not explicitly assigned to a group.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-001: Envelope Management

**External Dependencies:**
- None

#### 3.5 User Interface Requirements

Groups are displayed within the Budget Tab (see BG-001). Additional UI:
- Long-press group header: Context menu (Rename, Reorder, Delete)
- "Add Group" option in the budget tab's overflow menu
- Drag handle on group headers for reordering
- Move Envelope action in envelope context menu includes a group picker

#### 3.6 Data Requirements

##### Entity: CategoryGroup

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| name | string | Required, 1-80 chars | None | Group display name |
| sort_order | integer | Non-negative | 0 | Display position |
| is_collapsed | integer | 0 or 1 | 0 | Whether this group is visually collapsed |
| created_at | string | ISO 8601 | Current timestamp | Creation time |
| updated_at | string | ISO 8601 | Current timestamp | Last modification time |

**Relationships:**
- CategoryGroup has many Envelopes (one-to-many via envelope.group_id)

**Validation Rules:**
- name: Must not be empty after trimming
- name: Must be unique (case-insensitive)

#### 3.7 Business Logic Rules

##### Group Aggregation

**Formulas:**
- `group.budgeted = SUM(allocated) for all envelopes in the group for the current month`
- `group.activity = SUM(activity) for all envelopes in the group for the current month`
- `group.available = SUM(available) for all envelopes in the group`

**Edge Cases:**
- Empty group (no envelopes): Shows $0 for all aggregates
- Deleting a group: Envelopes move to "Uncategorized" group, not deleted
- All envelopes in group are archived: Group still visible but shows $0

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Delete group with envelopes | Confirmation: "Envelopes in this group will be moved to Uncategorized." | User confirms or cancels |
| Duplicate group name | Inline: "A group with this name already exists" | User changes name |

#### 3.9 Acceptance Criteria

1. **Given** the user creates groups "Fixed" and "Variable",
   **When** they assign Rent to Fixed and Groceries to Variable,
   **Then** the budget view shows two collapsible sections with correct group totals.

2. **Given** a group "Fixed" with Rent ($1,500) and Insurance ($200),
   **When** the user views the budget tab,
   **Then** the Fixed group header shows $1,700 total budgeted.

3. **Given** a group is deleted,
   **When** it contained 3 envelopes,
   **Then** all 3 envelopes move to Uncategorized and remain fully functional.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| group budgeted sums envelope allocations | envs: [50000, 60000, 20000] | group_budgeted: 130000 |
| empty group shows zero | no envelopes | group_budgeted: 0, group_available: 0 |
| delete group moves envelopes | group with 3 envelopes deleted | 3 envelopes have group_id = uncategorized |

---

### BG-007: Savings Goals

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-007 |
| **Feature Name** | Savings Goals |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a saver, I want to set savings goals for specific envelopes (e.g., "Emergency Fund: $10,000 by December"), so that I can track my progress and know how much to save each month.

**Secondary:**
> As a motivated budgeter, I want to see my goal progress as a percentage and projected completion date, so that I stay motivated and can adjust my plan if I fall behind.

#### 3.3 Detailed Description

Savings goals attach to envelopes and define a target amount and optional target date. The system calculates progress (percentage complete), suggests a monthly contribution to stay on track, determines whether the goal is on-track or behind, and projects when the goal will be completed at the current savings rate.

Goals have four statuses: on_track (saving enough to hit target by date), behind (not saving enough), completed (target reached), and overdue (target date passed without completion).

Multiple goals can exist but each goal is tied to exactly one envelope. The envelope's available balance represents the current amount saved toward the goal.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-001: Envelope Management - goals attach to envelopes
- BG-004: Budget Month Engine - available balance represents savings progress

**External Dependencies:**
- None

#### 3.5 User Interface Requirements

##### Screen: Goals List

**Layout:**
- Accessible from the Budget tab via a "Goals" button in the navigation bar
- List of all active goals, each showing: goal name, envelope name, progress bar (0-100%+), current amount / target amount, target date (if set), status badge (On Track / Behind / Completed / Overdue)
- Completed goals show a checkmark and can be filtered out
- Tap a goal to see detail view
- FAB to add new goal

##### Screen: Goal Detail

**Layout:**
- Goal name and envelope name at top
- Large circular progress indicator showing percentage
- Current amount / Target amount in large text
- Target date (if set) with days remaining
- Suggested monthly contribution amount
- Projected completion date at current rate
- Edit and Delete buttons

##### Modal: Add/Edit Goal

**Layout:**
- Fields: Goal Name (text, required), Envelope (picker, required), Target Amount (currency input, required), Target Date (date picker, optional)

#### 3.6 Data Requirements

##### Entity: Goal

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| envelope_id | string | References Envelope.id, required | None | Envelope this goal tracks |
| name | string | Required, 1-80 chars | None | Goal display name |
| target_amount | integer | Positive, in cents | None | Target savings amount in cents |
| target_date | string | Nullable, YYYY-MM-DD | null | Optional deadline for the goal |
| completed_amount | integer | Non-negative, in cents | 0 | Manually tracked completed amount (if not using envelope balance) |
| is_completed | integer | 0 or 1 | 0 | Whether the goal has been marked complete |
| created_at | string | ISO 8601 | Current timestamp | Creation time |
| updated_at | string | ISO 8601 | Current timestamp | Last modification time |

**Relationships:**
- Goal belongs to Envelope (many-to-one via envelope_id)

**Indexes:**
- `envelope_id` - Look up goals by envelope
- `is_completed` - Filter active vs completed goals

#### 3.7 Business Logic Rules

##### Calculate Goal Progress

**Purpose:** Determine how much progress has been made toward a savings goal.

**Inputs:**
- current_amount: integer (cents) - envelope's available balance
- target_amount: integer (cents)

**Logic:**

```
percentage = ROUND(current_amount / target_amount * 100)
remaining = MAX(0, target_amount - current_amount)
```

**Edge Cases:**
- target_amount is 0: percentage = 100, remaining = 0
- current_amount exceeds target: percentage > 100 (e.g., 150%), remaining = 0
- current_amount is negative (overspent envelope): percentage is negative

##### Suggest Monthly Contribution

**Purpose:** Calculate how much the user should save per month to reach the goal by the target date.

**Inputs:**
- remaining: integer (cents)
- months_left: integer

**Logic:**

```
IF months_left <= 0:
  RETURN remaining (need to save it all now)
IF remaining <= 0:
  RETURN 0 (goal already met)
suggested = CEIL(remaining / months_left)
RETURN suggested
```

##### Determine Goal Status

**Purpose:** Classify the goal's health status.

**Inputs:**
- current_amount, target_amount, target_date, today

**Logic:**

```
1. IF current_amount >= target_amount:
   RETURN 'completed'
2. IF target_date is null:
   RETURN 'on_track' (no deadline, can't be behind)
3. IF today > target_date:
   RETURN 'overdue'
4. Calculate elapsed = days from goal creation to today
5. Calculate total = days from goal creation to target_date
6. savedPercent = current_amount / target_amount
7. elapsedPercent = elapsed / total
8. IF savedPercent >= elapsedPercent:
   RETURN 'on_track'
9. ELSE:
   RETURN 'behind'
```

##### Project Completion Date

**Purpose:** Estimate when the goal will be completed at the current savings rate.

**Inputs:**
- remaining: integer (cents)
- monthly_contribution: integer (cents) - average monthly savings

**Logic:**

```
IF remaining <= 0: RETURN today (already complete)
IF monthly_contribution <= 0: RETURN null (no savings rate, cannot project)
months_needed = CEIL(remaining / monthly_contribution)
projected_date = today + months_needed months
RETURN projected_date
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Target amount is 0 or negative | Inline: "Target amount must be greater than $0" | User enters valid amount |
| Target date is in the past | Inline: "Target date must be in the future" | User selects future date |
| Envelope is archived | Warning: "This envelope is archived. Goal progress will not change." | User un-archives envelope or picks different one |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** an Emergency Fund envelope with $2,000 available,
   **When** the user creates a goal "Emergency Fund" targeting $10,000 by December 2026,
   **Then** the goal shows 20% progress, $8,000 remaining, and a suggested monthly contribution.

2. **Given** a goal at 20% progress with 10 months remaining,
   **When** the user views the goal detail,
   **Then** suggested monthly contribution is CEIL($8,000 / 10) = $800.

3. **Given** a goal with target $5,000 and current $5,200,
   **When** the user views the goal,
   **Then** status shows "Completed" with 104% progress.

**Edge Cases:**

4. **Given** a goal with no target date,
   **When** progress is 30%,
   **Then** status is "On Track" (no deadline means cannot be behind).

5. **Given** a goal with target date March 1, 2026 and today is March 6, 2026 and progress is 80%,
   **When** the user views the goal,
   **Then** status is "Overdue."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates percentage correctly | current: 200000, target: 1000000 | percentage: 20 |
| percentage can exceed 100 | current: 520000, target: 500000 | percentage: 104 |
| percentage handles zero target | current: 100, target: 0 | percentage: 100 |
| suggests correct monthly contribution | remaining: 800000, months: 10 | suggested: 80000 |
| suggests full amount when 0 months left | remaining: 500000, months: 0 | suggested: 500000 |
| status is completed when target met | current: 1000000, target: 1000000 | status: completed |
| status is behind when under-saved | savedPct: 0.2, elapsedPct: 0.5 | status: behind |
| status is on_track when ahead | savedPct: 0.6, elapsedPct: 0.5 | status: on_track |
| status is overdue past target date | today: 2026-04-01, target_date: 2026-03-01, current < target | status: overdue |
| projects completion date | remaining: 600000, monthly: 200000 | months_needed: 3 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Goal progress updates with spending | 1. Create goal for $1000, 2. Add $300 income to envelope, 3. Check goal | 30% progress |
| Goal completes automatically | 1. Goal at 90%, 2. Add income pushing past 100%, 3. Check goal | Status: completed |

---

### BG-008: Subscription Catalog and Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-008 |
| **Feature Name** | Subscription Catalog and Tracking |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a subscription holder, I want to track all my recurring subscriptions in one place with renewal dates and costs, so that I know exactly how much I spend on subscriptions each month and year.

**Secondary:**
> As a new user, I want to quickly add subscriptions from a pre-populated catalog of 215+ services, so that I don't have to manually enter pricing and billing cycle details.

**Tertiary:**
> As a cost-conscious user, I want to see my total monthly and annual subscription costs broken down by category, so that I can identify subscriptions to cut.

#### 3.3 Detailed Description

MyBudget includes a built-in catalog of 215+ popular subscription services (Netflix, Spotify, Adobe Creative Cloud, etc.) with pre-populated pricing, billing cycles, and categories. Users can add subscriptions from the catalog with one tap or create custom subscriptions manually.

Each tracked subscription records: service name, price, currency, billing cycle (weekly/monthly/quarterly/semi-annual/annual/custom), status (active/paused/cancelled/trial), start date, next renewal date, trial end date, notification preferences, and an optional link to the service's website.

The subscription dashboard shows total monthly cost, total annual cost, cost per day, and a breakdown by category (entertainment, productivity, health, etc.). All cost figures normalize different billing cycles to a common period for comparison.

Subscriptions integrate with the budget system: each subscription can be linked to an envelope, and renewal events auto-generate transaction entries.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (can operate independently of the budget system)

**External Dependencies:**
- Local SQLite database

**Assumed Capabilities:**
- User can navigate to the Subscriptions tab

#### 3.5 User Interface Requirements

##### Screen: Subscriptions Tab

**Layout:**
- Top navigation bar with "Subscriptions" title and Add button
- Summary card at top showing: Monthly Total, Annual Total, Daily Cost, Active Count
- Below the summary, subscription list grouped by status: Active, Trial, Paused, Cancelled
- Each subscription row shows: service icon/logo, name, price with billing cycle label (e.g., "$15.99/mo"), next renewal date, status badge
- Active subscriptions are sorted by next renewal date (soonest first)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No subscriptions tracked | Message: "Add your first subscription to start tracking." with catalog browse button |
| Loading | Query in progress | Skeleton rows |
| Populated | 1+ subscriptions | Grouped list with summary card |

**Interactions:**
- Tap subscription row: Navigate to Subscription Detail screen
- Tap Add button: Navigate to Add Subscription screen (catalog browser)
- Swipe left on subscription: Reveal Pause/Cancel/Delete actions
- Long press subscription: Context menu

##### Screen: Add Subscription (Catalog Browser)

**Layout:**
- Search bar at top for finding services in the catalog
- Category filter chips: All, Entertainment, Productivity, Health, Shopping, News, Finance, Utilities
- Grid of subscription cards showing: icon, name, default price
- Tapping a catalog entry opens a pre-filled form; user confirms/adjusts details
- "Add Custom" button at bottom for services not in the catalog

**Interactions:**
- Search: Filters catalog by name with prefix and fuzzy matching
- Tap catalog entry: Pre-fills add form with catalog data (name, default price, billing cycle, category)
- Tap "Add Custom": Opens blank add form

##### Screen: Subscription Detail

**Layout:**
- Service name and icon at top
- Price and billing cycle
- Next renewal date with countdown ("Renews in X days")
- Status with action buttons (Pause, Cancel, Reactivate)
- Price history chart (if price has changed)
- Notification settings (notify X days before renewal)
- Link to service website
- Cost breakdown: monthly equivalent, annual equivalent

#### 3.6 Data Requirements

##### Entity: Subscription

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| name | string | Required, 1-200 chars | None | Service name |
| price | integer | Positive, in cents | None | Subscription price in cents |
| currency | string | 3 chars, ISO 4217 | "USD" | Currency code |
| billing_cycle | enum | weekly/monthly/quarterly/semi_annual/annual/custom | None | How often the subscription bills |
| custom_days | integer | Nullable, positive | null | Number of days in custom billing cycle |
| status | enum | active/paused/cancelled/trial | None | Current subscription status |
| start_date | string | YYYY-MM-DD, required | None | When the subscription started |
| next_renewal | string | YYYY-MM-DD, required | None | Next billing date |
| trial_end_date | string | Nullable, YYYY-MM-DD | null | When free trial ends |
| cancelled_date | string | Nullable, YYYY-MM-DD | null | When subscription was cancelled |
| notes | string | Nullable | null | User notes |
| url | string | Nullable | null | Service website URL |
| icon | string | Nullable | null | Icon identifier or emoji |
| color | string | Nullable | null | Brand color hex code |
| notify_days | integer | Non-negative | 3 | Days before renewal to send notification |
| catalog_id | string | Nullable | null | Reference to catalog entry if added from catalog |
| sort_order | integer | Non-negative | 0 | Display position |
| created_at | string | ISO 8601 | Current timestamp | Creation time |
| updated_at | string | ISO 8601 | Current timestamp | Last modification time |

##### Entity: CatalogEntry (static data, not user-editable)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Unique identifier | None | Catalog entry ID (e.g., "netflix", "spotify") |
| name | string | Required | None | Service display name |
| defaultPrice | integer | In cents | None | Default subscription price |
| billingCycle | enum | Same as Subscription.billing_cycle | None | Typical billing cycle |
| category | enum | entertainment/productivity/health/shopping/news/finance/utilities/other | None | Service category |

**Relationships:**
- Subscription optionally references CatalogEntry (via catalog_id)
- Subscription optionally links to Envelope (for budget integration)

**Indexes:**
- `status, next_renewal` - Active subscriptions sorted by renewal date
- `catalog_id` - Look up user's subscription by catalog entry

#### 3.7 Business Logic Rules

##### Cost Normalization

**Purpose:** Convert any billing cycle to a monthly, annual, or daily equivalent for comparison.

**Formulas:**
- `normalizeToMonthly`:
  - weekly: `price * 52 / 12`
  - monthly: `price`
  - quarterly: `price / 3`
  - semi_annual: `price / 6`
  - annual: `price / 12`
  - custom: `price * (365 / custom_days) / 12`

- `normalizeToAnnual`:
  - weekly: `price * 52`
  - monthly: `price * 12`
  - quarterly: `price * 4`
  - semi_annual: `price * 2`
  - annual: `price`
  - custom: `price * (365 / custom_days)`

- `normalizeToDaily`:
  - Compute annual first, then divide by 365

##### Subscription Cost Summary

**Purpose:** Aggregate all subscription costs.

**Logic:**

```
1. Filter to subscriptions WHERE status IN ('active', 'trial')
2. FOR each active subscription:
   a. Compute monthlyEquivalent = normalizeToMonthly(price, billing_cycle, custom_days)
3. monthlyTotal = SUM(all monthlyEquivalent)
4. annualTotal = SUM(all normalizeToAnnual)
5. dailyCost = annualTotal / 365
6. Group by category for breakdown
7. activeCount = COUNT(filtered subscriptions)
```

##### Calculate Next Renewal

**Purpose:** Determine when a subscription will next renew.

**Logic:**

```
1. Start from the current next_renewal date
2. Add the billing cycle duration:
   - weekly: +7 days
   - monthly: +1 month (same day, capped to month end)
   - quarterly: +3 months
   - semi_annual: +6 months
   - annual: +1 year
   - custom: +custom_days days
3. Handle month-end capping: if start_date is 31st and next month has 30 days, use 30th
```

##### Subscription Status State Machine

| Current State | Trigger | Next State | Side Effects |
|--------------|---------|------------|-------------|
| active | User pauses | paused | Set paused_at timestamp, stop renewal notifications |
| active | User cancels | cancelled | Set cancelled_date, stop renewal tracking |
| trial | Trial expires (trial_end_date reached) | active | Begin normal billing cycle |
| trial | User cancels | cancelled | Set cancelled_date |
| paused | User resumes | active | Clear paused_at, recalculate next_renewal |
| cancelled | User reactivates | active | Clear cancelled_date, set new start_date and next_renewal |

##### Catalog Search

**Purpose:** Find services in the 215-entry catalog.

**Logic:**

```
1. Normalize query: lowercase, trim
2. Filter catalog entries where name starts with query (prefix match)
3. If fewer than 5 results, also include entries where name contains query (substring match)
4. Sort results: prefix matches first (sorted by popularity/alphabetical), then substring matches
5. Return top 20 results
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Price is zero or negative | Inline: "Price must be greater than $0" | User enters valid price |
| Start date is after next renewal | Inline: "Start date must be before next renewal date" | User corrects dates |
| Custom billing cycle with no custom_days | Inline: "Enter the number of days in your billing cycle" | User enters custom_days |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is on the Add Subscription screen,
   **When** they search "Netflix" and select it from the catalog,
   **Then** the form is pre-filled with Netflix's name, default price ($15.49/mo), and monthly billing cycle.

2. **Given** the user has 5 active subscriptions totaling $85/month,
   **When** they view the Subscriptions tab,
   **Then** the summary shows Monthly: $85.00, Annual: $1,020.00, Daily: $2.79, Active: 5.

3. **Given** a subscription with next_renewal = March 15,
   **When** today is March 12,
   **Then** the subscription shows "Renews in 3 days."

**Edge Cases:**

4. **Given** a yearly subscription at $119.99/year,
   **When** viewing the cost summary,
   **Then** monthly equivalent shows $10.00 (ROUND(11999 / 12) = 1000 cents = $10.00).

5. **Given** a subscription on trial ending March 20,
   **When** March 20 arrives,
   **Then** status transitions from "trial" to "active" and billing begins.

**Negative Tests:**

6. **Given** the add subscription form,
   **When** the user selects "custom" billing cycle but leaves custom_days empty,
   **Then** validation error is shown and form cannot be submitted.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| normalizeToMonthly for weekly | price: 999, cycle: weekly | 4328 (999 * 52 / 12, rounded) |
| normalizeToMonthly for annual | price: 11999, cycle: annual | 1000 (11999 / 12, rounded) |
| normalizeToMonthly for quarterly | price: 2999, cycle: quarterly | 1000 (2999 / 3, rounded) |
| normalizeToAnnual for monthly | price: 1549, cycle: monthly | 18588 |
| cost summary sums active only | active: [1000, 2000], cancelled: [500] | monthlyTotal: 3000 |
| catalog search finds prefix match | query: "net", catalog has Netflix, Netgear | returns both |
| catalog search is case insensitive | query: "SPOTIFY" | returns Spotify entry |
| next renewal monthly handles month-end | date: Jan 31, +1 month | Feb 28 (not Feb 31) |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add from catalog and verify tracking | 1. Add Netflix from catalog, 2. Check subscription list, 3. Check cost summary | Netflix appears, costs include it |
| Pause and resume subscription | 1. Add subscription, 2. Pause it, 3. Verify excluded from costs, 4. Resume, 5. Verify included again | Paused subscriptions excluded from cost totals |

---

### BG-009: Renewal Calendar

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-009 |
| **Feature Name** | Renewal Calendar |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a subscription holder, I want to see a calendar view of upcoming renewal dates, so that I can anticipate charges and ensure I have sufficient funds.

#### 3.3 Detailed Description

The Renewal Calendar provides a visual calendar view showing when each active subscription will renew. Users can see at a glance which days have upcoming charges and the total amount due on each day. The calendar highlights the current day and shows a 30-day lookahead by default.

Tapping a day with renewals expands to show the specific subscriptions renewing that day with their amounts. The calendar also supports a list view for users who prefer a chronological list format.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-008: Subscription Catalog and Tracking

#### 3.5 User Interface Requirements

##### Screen: Renewal Calendar

**Layout:**
- Accessible from the Subscriptions tab via a calendar icon button
- Monthly calendar grid at top with dots on days that have renewals (color-coded by amount: green < $20, yellow $20-50, red > $50)
- Below the calendar, a list of renewals for the selected day or upcoming 30 days
- Each renewal row: subscription icon, name, amount, billing cycle
- Total for the day/period shown at bottom
- Toggle between Calendar View and List View

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No active subscriptions | "No upcoming renewals" message |
| Populated | Active subscriptions exist | Calendar with dots and renewal list |
| Day Selected | User tapped a specific day | Shows only that day's renewals |

**Interactions:**
- Tap day with renewals: Show that day's renewal list
- Swipe left/right on calendar: Navigate months
- Tap subscription in renewal list: Navigate to Subscription Detail
- Toggle Calendar/List: Switch display mode

#### 3.6 Data Requirements

No new entities required. This feature queries the existing Subscription entity's `next_renewal` field and projects future renewals using the billing cycle calculation from BG-008.

#### 3.7 Business Logic Rules

##### Project Future Renewals

**Purpose:** Generate a list of future renewal dates for display in the calendar.

**Logic:**

```
1. FOR each active subscription:
   a. Start from next_renewal date
   b. Generate renewal dates by repeatedly adding the billing cycle duration
   c. Continue until exceeding the calendar's visible range (typically 90 days ahead)
2. Group all projected renewals by date
3. Calculate daily totals
```

**Edge Cases:**
- Subscription with renewal today: Highlighted as "Due Today"
- Multiple subscriptions on same day: All shown, amounts summed
- Paused subscriptions: Excluded from calendar projections

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No subscriptions to display | "No upcoming renewals" with link to add subscriptions | User adds subscriptions |

#### 3.9 Acceptance Criteria

1. **Given** Netflix renews on the 15th, Spotify on the 1st, and iCloud on the 1st,
   **When** the user views the calendar for March,
   **Then** March 1 shows a dot (2 renewals), March 15 shows a dot (1 renewal).

2. **Given** the user taps March 1 on the calendar,
   **When** Spotify ($9.99) and iCloud ($2.99) renew that day,
   **Then** both are listed with a daily total of $12.98.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| projects monthly renewals correctly | renewal: March 15, cycle: monthly, range: 90 days | [Mar 15, Apr 15, May 15, Jun 13] |
| groups renewals by date | 3 subs: Mar 1, Mar 1, Mar 15 | {Mar 1: [sub1, sub2], Mar 15: [sub3]} |
| excludes paused subscriptions | 1 active, 1 paused | only active appears |
| calculates daily totals | day has subs: $999, $299 | total: 1298 |

---

### BG-010: Recurring Templates

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-010 |
| **Feature Name** | Recurring Templates |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a budgeter with predictable bills, I want to set up recurring transaction templates (rent on the 1st, car payment on the 15th), so that I don't have to manually enter the same transactions every month.

#### 3.3 Detailed Description

Recurring templates define repeating transactions that occur on a schedule. Each template specifies the amount, direction, envelope, account, merchant, frequency, and anchor date. The system uses templates to project upcoming transactions and, optionally, to auto-create transactions when they come due.

Templates support frequencies: daily, weekly, biweekly, monthly, quarterly, semi-annually, annually, and custom (every N days). Monthly templates anchor to a specific day of the month with end-of-month capping (e.g., a template set for the 31st will fire on the 28th in February).

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-003: Transaction Entry - templates create transactions

#### 3.5 User Interface Requirements

Recurring templates are managed through:
- A "Recurring" section on the Add Transaction screen (toggle to make a transaction recurring)
- A dedicated "Recurring" list accessible from the Transactions tab overflow menu
- Each template row shows: merchant, amount, frequency, next occurrence

##### Modal: Recurring Template Editor

**Layout:**
- Fields: Merchant (text), Amount (currency), Direction (inflow/outflow), Envelope (picker), Account (picker), Frequency (picker: daily/weekly/biweekly/monthly/quarterly/semi-annual/annual/custom), Day of Month or Day of Week (depending on frequency), Custom Interval in Days (if custom), Start Date, End Date (optional)
- Toggle: Auto-create transactions (if on, transactions are created automatically; if off, user is reminded)

#### 3.6 Data Requirements

##### Entity: RecurringTemplate

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| merchant | string | Required, max 200 chars | None | Payee name |
| amount | integer | Positive, in cents | None | Transaction amount |
| direction | enum | inflow/outflow | outflow | Transaction direction |
| envelope_id | string | Nullable, references Envelope.id | null | Target envelope |
| account_id | string | Nullable, references Account.id | null | Target account |
| frequency | enum | daily/weekly/biweekly/monthly/quarterly/semi_annual/annual/custom | None | Recurrence frequency |
| custom_days | integer | Nullable, positive | null | Days between occurrences (custom frequency) |
| anchor_day | integer | 1-31 for monthly+, 0-6 for weekly | None | Day to anchor recurring event |
| start_date | string | YYYY-MM-DD | None | When recurrence begins |
| end_date | string | Nullable, YYYY-MM-DD | null | When recurrence ends (null = indefinite) |
| auto_create | integer | 0 or 1 | 0 | Whether to auto-generate transactions |
| is_active | integer | 0 or 1 | 1 | Whether this template is active |
| last_created | string | Nullable, YYYY-MM-DD | null | Date of last auto-created transaction |
| created_at | string | ISO 8601 | Current timestamp | Creation time |
| updated_at | string | ISO 8601 | Current timestamp | Last modification time |

#### 3.7 Business Logic Rules

##### Calculate Next Occurrence Date

**Purpose:** Determine when a recurring template fires next.

**Inputs:**
- frequency, anchor_day, last_created (or start_date if never created), custom_days

**Logic:**

```
1. base_date = last_created ?? start_date
2. SWITCH frequency:
   - daily: base_date + 1 day
   - weekly: next occurrence of anchor_day (0=Sun, 6=Sat)
   - biweekly: base_date + 14 days
   - monthly: next month with anchor_day, capped to month end
   - quarterly: base_date + 3 months with anchor_day
   - semi_annual: base_date + 6 months with anchor_day
   - annual: base_date + 1 year with anchor_day
   - custom: base_date + custom_days
3. IF end_date is set AND next > end_date: template is expired
4. Month-end capping: if anchor_day is 31 and month has 30 days, use 30
```

##### Generate Upcoming Occurrences

**Purpose:** Project future occurrences over a configurable window (default 30 days).

**Logic:**

```
1. Start from next occurrence date
2. Repeatedly apply calculateNextDate until exceeding window end
3. Return list of {date, amount, merchant, envelope_id, account_id}
4. Group by date for timeline display
```

**Edge Cases:**
- Template with end_date in the past: Skip (expired)
- Daily template over 30-day window: Generates 30 occurrences
- Monthly template on the 29th: Uses 28th in February (non-leap), 29th in leap year February

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Anchor day invalid for frequency | Inline: "Day must be between 1 and 31" | User corrects |
| End date before start date | Inline: "End date must be after start date" | User corrects |

#### 3.9 Acceptance Criteria

1. **Given** a monthly template for "Rent" at $1,500 on the 1st,
   **When** the user views upcoming transactions for March,
   **Then** "Rent - $1,500" appears on March 1.

2. **Given** a biweekly template starting Jan 10,
   **When** viewing upcoming for 30 days,
   **Then** occurrences appear on Jan 10, Jan 24, Feb 7.

3. **Given** a monthly template anchored to day 31,
   **When** calculating February's occurrence,
   **Then** the date is February 28 (or 29 in leap year).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| monthly next date calculation | anchor: 15, last: Feb 15 | Mar 15 |
| monthly handles month-end capping | anchor: 31, last: Jan 31 | Feb 28 |
| biweekly adds 14 days | last: Jan 10 | Jan 24 |
| custom adds N days | custom_days: 10, last: Jan 1 | Jan 11 |
| expired template returns no occurrences | end_date: past | empty list |
| generates correct occurrence count | monthly, 90-day window | 3 occurrences |

---

### BG-011: Bank Sync (Plaid)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-011 |
| **Feature Name** | Bank Sync (Plaid) |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a busy budgeter, I want to optionally connect my bank accounts to automatically import transactions, so that I don't have to manually enter every purchase.

**Secondary:**
> As a privacy-conscious user, I want bank sync to be entirely optional and clearly explained, so that I understand exactly what data is shared and can disable it at any time.

#### 3.3 Detailed Description

Bank sync integrates with Plaid to automatically import transactions from connected bank accounts. This feature is entirely optional - MyBudget works fully offline without any bank connections. When enabled, Plaid securely connects to the user's bank, retrieves transaction data, and imports it into MyBudget.

The sync flow: 1) User initiates connection via Plaid Link UI, 2) Plaid returns a link token, 3) App exchanges it for an access token stored in encrypted local storage, 4) Periodic sync fetches new transactions, 5) Transactions are matched/deduplicated against existing manual entries.

Bank sync supports multiple providers in its architecture (Plaid, MX, TrueLayer, etc.) but only Plaid is currently implemented. The provider router pattern allows adding new providers without changing the sync orchestration layer.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-002: Account Management - bank accounts map to local accounts
- BG-003: Transaction Entry - imported data creates transactions

**External Dependencies:**
- Plaid API credentials (server-side)
- Network connectivity
- User consent for bank data access

**Assumed Capabilities:**
- Server component available for Plaid token exchange (client cannot hold Plaid secrets)

#### 3.5 User Interface Requirements

##### Screen: Connect Bank Account

**Layout:**
- Accessible from Accounts tab via "Connect Bank" button
- Privacy notice explaining what data is accessed and how it is stored
- "Connect with Plaid" button that launches Plaid Link
- List of already-connected banks with status (Active, Error, Disconnected)
- Each connected bank shows: institution name, last sync time, account count

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No connections | No banks connected | Privacy notice + "Connect" CTA |
| Connected | 1+ active connections | Connection list with sync status |
| Syncing | Sync in progress | Loading indicator on affected connection |
| Error | Connection or sync failed | Error badge on connection with "Reconnect" action |

**Interactions:**
- Tap "Connect with Plaid": Launches Plaid Link flow
- Tap connected bank: Shows accounts and sync details
- Tap "Sync Now": Triggers manual sync
- Tap "Disconnect": Removes connection (with confirmation)

#### 3.6 Data Requirements

##### Entity: BankConnection

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| provider | enum | plaid/mx/truelayer/tink/belvo/basiq/akoya/finicity/other | None | Sync provider |
| institution_name | string | Required | None | Bank/institution display name |
| institution_id | string | Required | None | Provider's institution identifier |
| access_token_encrypted | string | Required, encrypted | None | Encrypted access token |
| status | enum | active/error/disconnected/pending | active | Connection status |
| last_sync_at | string | Nullable, ISO 8601 | null | Last successful sync time |
| error_message | string | Nullable | null | Last error message |
| created_at | string | ISO 8601 | Current timestamp | Creation time |
| updated_at | string | ISO 8601 | Current timestamp | Last modification time |

##### Entity: BankAccount

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| connection_id | string | References BankConnection.id | None | Parent connection |
| provider_account_id | string | Required | None | Provider's account identifier |
| local_account_id | string | Nullable, references Account.id | null | Mapped local account |
| name | string | Required | None | Account name from institution |
| type | string | Required | None | Account type from provider |
| balance | integer | In cents | 0 | Last known balance |
| currency | string | 3 chars | "USD" | Account currency |
| created_at | string | ISO 8601 | Current timestamp | Creation time |
| updated_at | string | ISO 8601 | Current timestamp | Last modification time |

##### Entity: BankTransactionRaw

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| bank_account_id | string | References BankAccount.id | None | Source bank account |
| provider_transaction_id | string | Required, unique per connection | None | Provider's transaction ID |
| amount | integer | In cents | None | Transaction amount |
| date | string | YYYY-MM-DD | None | Transaction date |
| name | string | Required | None | Merchant/description from bank |
| pending | integer | 0 or 1 | 0 | Whether transaction is pending |
| category | string | Nullable | null | Provider's category |
| local_transaction_id | string | Nullable, references Transaction.id | null | Mapped local transaction |
| created_at | string | ISO 8601 | Current timestamp | Creation time |

##### Entity: BankSyncState

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| connection_id | string | References BankConnection.id | None | Which connection |
| cursor | string | Nullable | null | Provider's pagination cursor for incremental sync |
| last_sync_at | string | Nullable, ISO 8601 | null | Last sync time |
| created_at | string | ISO 8601 | Current timestamp | Creation time |
| updated_at | string | ISO 8601 | Current timestamp | Last modification time |

##### Entity: BankWebhookEvent

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| provider | enum | Same as BankConnection.provider | None | Provider |
| event_type | string | Required | None | Webhook event type |
| payload | string | JSON blob | None | Raw webhook payload |
| status | enum | pending/processed/failed | pending | Processing status |
| idempotency_key | string | Unique | None | Deduplication key |
| received_at | string | ISO 8601 | Current timestamp | When webhook was received |
| processed_at | string | Nullable, ISO 8601 | null | When processing completed |

#### 3.7 Business Logic Rules

##### Sync Reconciliation Pipeline

**Purpose:** Import bank transactions and match against existing local records.

**Logic:**

```
1. Fetch new transactions from provider using cursor-based pagination
2. FOR each raw bank transaction:
   a. Check if provider_transaction_id already exists (deduplication)
   b. IF pending transaction resolves to posted:
      - Update existing raw record
      - Update linked local transaction if mapped
   c. IF new transaction:
      - Insert into bank_transactions_raw
      - Attempt to match against existing local transactions:
        - Match on: amount, date (+/- 2 days), merchant similarity
        - If match found: link raw to local (set local_transaction_id)
        - If no match: create new local transaction (uncategorized)
   d. IF removed transaction (provider signals removal):
      - Mark raw record as removed
      - Flag linked local transaction for user review
3. Update BankSyncState cursor
4. Update BankConnection.last_sync_at
```

##### Token Vault

**Purpose:** Securely store Plaid access tokens.

**Logic:**
- Tokens are encrypted using the device's secure storage (Keychain on iOS, Keystore on Android)
- Tokens are never stored in plaintext in SQLite
- Token retrieval requires biometric/PIN authentication if device supports it

##### Webhook Idempotency

**Purpose:** Prevent duplicate processing of webhook events.

**Logic:**

```
1. On webhook receipt, compute idempotency_key from event_type + connection_id + timestamp
2. Check if key exists in bank_webhook_events
3. IF exists AND status != 'failed': skip (already processed)
4. IF new: insert with status 'pending', process, update to 'processed' or 'failed'
```

##### Rate Limiting

**Logic:**
- Sliding window rate limiter: max 30 sync requests per user per hour
- Per-connection cooldown: minimum 5 minutes between syncs

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Plaid Link fails | Toast: "Could not connect to your bank. Please try again." | User retries connection |
| Access token expired | Error badge on connection: "Reconnect required" | User re-authenticates via Plaid Link |
| Sync fails (network error) | Toast: "Sync failed. Will retry automatically." | Auto-retry with exponential backoff |
| Duplicate transaction detected | Transaction not imported (silent dedup) | None needed |
| Provider reports removed transaction | Flag on local transaction: "This transaction was removed by your bank" | User reviews and deletes or keeps |

#### 3.9 Acceptance Criteria

1. **Given** the user taps "Connect with Plaid" and completes Plaid Link,
   **When** the connection succeeds,
   **Then** their bank accounts appear in the Accounts tab and initial sync imports recent transactions.

2. **Given** an active bank connection,
   **When** the user taps "Sync Now",
   **Then** new transactions since the last sync are imported and matched against existing records.

3. **Given** a manually-entered $50 Trader Joe's transaction on March 3,
   **When** bank sync imports a $50 Trader Joe's transaction on March 3,
   **Then** the sync recognizes it as a match and links them rather than creating a duplicate.

4. **Given** the user taps "Disconnect" on a bank connection,
   **When** they confirm,
   **Then** the access token is deleted, sync stops, but previously imported transactions remain.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| matches transaction by amount and date | local: $50 Mar 3, bank: $50 Mar 3 | match found |
| matches within 2-day window | local: $50 Mar 3, bank: $50 Mar 5 | match found |
| no match outside window | local: $50 Mar 3, bank: $50 Mar 7 | no match |
| deduplicates by provider_transaction_id | same ID imported twice | only one raw record |
| idempotency key prevents double processing | same webhook twice | processed once |
| rate limiter blocks excessive requests | 31st request in 1 hour | blocked |

---

### BG-012: Recurring Charge Detection

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-012 |
| **Feature Name** | Recurring Charge Detection |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user with bank sync enabled, I want the app to automatically detect recurring charges (subscriptions I might not be tracking), so that I can discover subscriptions I forgot about or didn't know I was paying for.

#### 3.3 Detailed Description

The recurring charge detector analyzes bank transaction data to identify patterns of recurring payments. It groups transactions by normalized payee name, detects frequency patterns (weekly, monthly, annual), calculates a confidence score, and matches against the 215-entry subscription catalog.

Detected recurring charges are presented to the user as suggestions: "We detected you may be paying $15.99/month to Netflix. Would you like to track this subscription?" The user can accept (creates a tracked subscription), dismiss (adds payee to dismissed list), or ignore.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-011: Bank Sync (Plaid) - provides the raw transaction data to analyze

#### 3.5 User Interface Requirements

##### Screen: Detected Subscriptions (within Subscriptions tab)

**Layout:**
- A "Detected" section appears at the top of the Subscriptions tab when recurring charges are found
- Each detected charge shows: payee name, estimated amount, detected frequency, confidence indicator (high/medium/low), and catalog match indicator
- Action buttons: "Track" (adds as subscription) and "Dismiss" (hides this payee)

#### 3.6 Data Requirements

No new persistent entities. Detection results are computed on-demand from bank_transactions_raw. Dismissed payees are stored in the preferences/settings table.

#### 3.7 Business Logic Rules

##### Detect Recurring Charges

**Purpose:** Identify patterns of recurring payments from raw bank transaction data.

**Inputs:**
- transactions: BankTransactionRaw[] (at least 3 months of data recommended)

**Logic:**

```
1. Normalize payee names:
   a. Lowercase
   b. Strip common billing suffixes (recurring, subscription, autopay, etc.)
   c. Trim whitespace
2. Group transactions by normalized payee
3. FOR each payee group with 3+ transactions:
   a. Sort by date ascending
   b. Calculate intervals between consecutive transactions (in days)
   c. Compute mean and standard deviation of intervals
   d. Classify frequency:
      - Mean 5-9 days, stddev < 3: weekly
      - Mean 12-17 days, stddev < 5: biweekly or semi_monthly
      - Mean 25-35 days, stddev < 7: monthly
      - Mean 80-100 days, stddev < 15: quarterly
      - Mean 340-395 days, stddev < 30: annual
   e. Check for semi-monthly: if 80%+ of transactions fall on exactly 2 repeating days of month
   f. Calculate confidence score:
      - intervalConsistency = max(0, 1 - coefficientOfVariation) * 0.4
      - amountConsistency = (amount stddev < 10% of mean ? 0.2 : amount stddev < 25% ? 0.1 : 0)
      - dataPointBonus = min(0.2, (transactionCount - 2) * 0.04)
      - catalogBonus = (matched catalog entry ? 0.2 : 0)
      - confidence = intervalConsistency + amountConsistency + dataPointBonus + catalogBonus
   g. Match against subscription catalog by normalized name
4. Filter results: confidence >= 0.5
5. Exclude dismissed payees
6. Return sorted by confidence descending
```

**Formulas:**
- `coefficientOfVariation = stddev(intervals) / mean(intervals)`
- `confidence = intervalConsistency * 0.4 + amountScore * 0.2 + dataPointBonus(max 0.2) + catalogBonus(0.2)`

**Edge Cases:**
- Payee with only 2 transactions: Insufficient data, skip
- Highly variable amounts (e.g., utility bills): Lower amountConsistency score
- Annual subscriptions: Require 2+ years of data for reliable detection

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Insufficient transaction history | "We need more transaction history to detect recurring charges. Check back after syncing a few months of data." | User waits for more data |
| No recurring charges detected | "No recurring charges detected in your transaction history." | None needed |

#### 3.9 Acceptance Criteria

1. **Given** 6 months of bank data with monthly Netflix charges of $15.99 on the 15th,
   **When** the detector runs,
   **Then** Netflix is detected as a monthly subscription with high confidence (>0.8) and catalog match.

2. **Given** a detected charge for "Spotify",
   **When** the user taps "Track",
   **Then** a subscription entry is created with pre-filled data from the detection and catalog.

3. **Given** the user dismisses a detected charge for "Venmo",
   **When** the detector runs again,
   **Then** Venmo does not appear in the detected list.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| normalizes payee name | "NETFLIX.COM RECURRING" | "netflix.com" |
| detects monthly frequency | intervals: [30, 31, 30, 29, 31] | frequency: monthly |
| detects annual frequency | intervals: [365, 366] | frequency: annual |
| confidence includes catalog bonus | detected + catalog match | confidence includes +0.2 |
| filters below threshold | confidence: 0.3 | excluded from results |
| semi-monthly detection | transactions on 1st and 15th of each month | frequency: semi_monthly |

---

### BG-013: CSV Import

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-013 |
| **Feature Name** | CSV Import |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user switching from another budgeting app or bank export, I want to import transaction data from CSV files, so that I can bring in my financial history without manual re-entry.

#### 3.3 Detailed Description

CSV import supports importing transaction data from CSV files exported by banks, YNAB, Monarch, Mint, or other financial tools. The import flow includes: file selection, column mapping (automatic detection with manual override), data preview, validation with error reporting, and batch import.

The system stores reusable CSV profiles so that users can import from the same bank format repeatedly without re-mapping columns. Partial imports are rolled back on error (all-or-nothing per file).

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-003: Transaction Entry - imported data creates transactions

**External Dependencies:**
- File picker access (device file system or cloud storage)

#### 3.5 User Interface Requirements

##### Screen: CSV Import

**Layout:**
- Step 1: File Selection - file picker button, drag-and-drop zone (web)
- Step 2: Column Mapping - shows first 5 rows of data, dropdown for each column (Date, Amount, Merchant/Payee, Note/Memo, Category, Direction, Skip), auto-detected mappings pre-selected
- Step 3: Preview - shows parsed transactions in a table, highlights rows with warnings (missing date, unparseable amount), shows total count and total amount
- Step 4: Import - progress bar, success/error summary

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| File Selected | CSV loaded | Column mapping interface |
| Preview | Columns mapped | Transaction preview table |
| Importing | Import in progress | Progress bar with count |
| Success | All rows imported | "Imported X transactions" with summary |
| Partial Error | Some rows failed | Error report showing failed rows with reasons |

**Interactions:**
- Tap "Select File": Opens file picker
- Adjust column dropdowns: Updates preview immediately
- Tap "Import": Starts batch import
- Tap failed row: Shows detailed error for that row

#### 3.6 Data Requirements

##### Entity: CsvProfile

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| name | string | Required, 1-80 chars | None | Profile name (e.g., "Chase Checking Export") |
| column_mapping | string | JSON object | None | Saved column index-to-field mapping |
| date_format | string | Required | "YYYY-MM-DD" | Expected date format |
| delimiter | string | Single char | "," | CSV delimiter |
| has_header | integer | 0 or 1 | 1 | Whether first row is a header |
| created_at | string | ISO 8601 | Current timestamp | Creation time |

#### 3.7 Business Logic Rules

##### CSV Parsing

**Logic:**

```
1. Read file, detect encoding (UTF-8, Latin-1)
2. Split by delimiter (auto-detect: comma, semicolon, tab)
3. IF has_header: extract column names from first row
4. Auto-detect column mapping:
   - Look for columns named "Date", "Amount", "Description", "Payee", "Memo", "Category"
   - Match case-insensitively and with common variants
5. Parse each row:
   a. Date: parse using date_format, support common formats (MM/DD/YYYY, YYYY-MM-DD, DD/MM/YYYY)
   b. Amount: strip currency symbols, handle negative numbers and parentheses notation
   c. Direction: infer from amount sign (negative = outflow) or explicit column
6. Validate: date is parseable, amount is a valid number
7. Import in a single database transaction (rollback on any error)
```

**Edge Cases:**
- Amount with parentheses: "(50.00)" = -50.00 (outflow)
- Amount with different decimal separators: "1.500,00" (European format) vs "1,500.00" (US format)
- Empty rows: Skipped
- Duplicate detection: Warn if imported transaction matches existing by date + amount + merchant

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| File is not valid CSV | "This file does not appear to be a valid CSV file." | User selects different file |
| Date column not mapped | "Please select which column contains the transaction date." | User maps the column |
| Unparseable date in row | Row highlighted in red: "Could not parse date: [value]" | User fixes CSV and re-imports |
| Unparseable amount in row | Row highlighted: "Could not parse amount: [value]" | User fixes CSV |
| Import fails mid-batch | All changes rolled back. "Import failed. No data was changed." | User fixes issues and retries |

#### 3.9 Acceptance Criteria

1. **Given** a CSV file from Chase with columns Date, Description, Amount,
   **When** the user selects the file,
   **Then** columns are auto-mapped and a preview of transactions is shown.

2. **Given** a CSV with 100 valid rows,
   **When** the user confirms import,
   **Then** 100 transactions are created and a success message shows "Imported 100 transactions."

3. **Given** a CSV where 3 of 50 rows have invalid dates,
   **When** the user previews the import,
   **Then** 47 rows show as valid (green) and 3 show as errors (red) with explanations.

4. **Given** the user has imported from Chase before and saved a profile,
   **When** they import a new Chase CSV,
   **Then** the saved column mapping is auto-applied.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| parses standard US date | "03/15/2026" | 2026-03-15 |
| parses ISO date | "2026-03-15" | 2026-03-15 |
| parses amount with currency symbol | "$1,500.00" | 150000 (cents) |
| parses negative amount as outflow | "-50.00" | amount: 5000, direction: outflow |
| parses parentheses as negative | "(50.00)" | amount: 5000, direction: outflow |
| auto-detects comma delimiter | "Date,Amount\n03/15,50" | delimiter: "," |
| auto-detects semicolon delimiter | "Date;Amount\n03/15;50" | delimiter: ";" |
| skips empty rows | "Date,Amount\n\n03/15,50" | 1 row parsed |

---

### BG-014: Transaction Rules Engine

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-014 |
| **Feature Name** | Transaction Rules Engine |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a power user, I want to create rules that automatically categorize transactions based on merchant name, amount, or account, so that I spend less time manually assigning envelopes.

#### 3.3 Detailed Description

The transaction rules engine provides rule-based auto-categorization. Users define conditions (if payee contains "Trader Joe", or if amount is greater than $100 from Credit Card) and actions (assign to Groceries envelope, rename payee to "Trader Joe's"). Rules are evaluated in priority order (lower number = higher priority), and all conditions within a rule use AND logic (all must match).

Manual categorization by the user always takes precedence over rule-based categorization. Rules apply to new transactions (manually entered or bank-synced) at the time of creation.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-003: Transaction Entry

#### 3.5 User Interface Requirements

##### Screen: Transaction Rules

**Layout:**
- Accessible from Transactions tab overflow menu or Settings
- List of rules sorted by priority (drag to reorder)
- Each rule row shows: conditions summary (e.g., "Payee contains 'Starbucks'"), action summary (e.g., "Set envelope: Coffee"), match count
- Add Rule button, Edit and Delete actions

##### Modal: Add/Edit Rule

**Layout:**
- Conditions section:
  - Field picker: Payee / Amount / Account
  - Operator picker (varies by field):
    - Payee: contains, equals, starts_with, regex
    - Amount: equals, greater_than, less_than, between
    - Account: equals
  - Value input
  - "Add Condition" button for multiple conditions (AND logic)
- Actions section:
  - Action type: Set Envelope, Rename Payee, Set Memo
  - Action value (envelope picker, text input, etc.)
- Priority input (lower = higher priority)

#### 3.6 Data Requirements

##### Entity: TransactionRule

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| name | string | Required, 1-80 chars | None | Rule display name |
| conditions | string | JSON array, required | None | Array of condition objects |
| actions | string | JSON array, required | None | Array of action objects |
| priority | integer | Non-negative | 0 | Evaluation order (lower = first) |
| is_active | integer | 0 or 1 | 1 | Whether rule is active |
| match_count | integer | Non-negative | 0 | How many transactions this rule has matched |
| created_at | string | ISO 8601 | Current timestamp | Creation time |
| updated_at | string | ISO 8601 | Current timestamp | Last modification time |

**Condition Object Schema:**

```json
{
  "field": "payee" | "amount" | "account_id",
  "operator": "contains" | "equals" | "starts_with" | "regex" | "greater_than" | "less_than" | "between",
  "value": "string or number",
  "value2": "number (only for 'between' operator)"
}
```

**Action Object Schema:**

```json
{
  "type": "set_category" | "rename_payee" | "set_memo",
  "value": "envelope_id or string"
}
```

#### 3.7 Business Logic Rules

##### Rule Evaluation

**Purpose:** Apply matching rules to a transaction.

**Logic:**

```
1. Get all active rules sorted by priority ASC
2. FOR each rule:
   a. Evaluate all conditions against the transaction (AND logic)
   b. IF all conditions match:
      - Apply each action to the transaction
      - Increment rule.match_count
      - STOP (first matching rule wins, unless action is additive)
3. Manual categorization flag: IF user has manually set the envelope,
   skip set_category actions (user choice takes precedence)
```

##### Condition Evaluation

**Logic per condition:**

```
SWITCH field:
  "payee":
    - contains: transaction.merchant.toLowerCase().includes(value.toLowerCase())
    - equals: transaction.merchant.toLowerCase() === value.toLowerCase()
    - starts_with: transaction.merchant.toLowerCase().startsWith(value.toLowerCase())
    - regex: new RegExp(value, 'i').test(transaction.merchant)
  "amount":
    - equals: transaction.amount === value (cents)
    - greater_than: transaction.amount > value
    - less_than: transaction.amount < value
    - between: transaction.amount >= value AND transaction.amount <= value2
  "account_id":
    - equals: transaction.account_id === value
```

**Edge Cases:**
- Regex compilation failure: Rule is skipped, error logged
- Deleted envelope in set_category action: Action skipped, rule still matches for other actions
- No matching rules: Transaction is left uncategorized (or keeps manual categorization)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Invalid regex pattern | Inline: "Invalid pattern. Check your regular expression." | User fixes the regex |
| Rule references deleted envelope | Warning on rule: "Envelope no longer exists" | User edits rule to pick new envelope |
| No conditions defined | Inline: "Add at least one condition" | User adds a condition |

#### 3.9 Acceptance Criteria

1. **Given** a rule "Payee contains 'Starbucks' -> Set envelope: Coffee",
   **When** a transaction with merchant "STARBUCKS #12345" is created,
   **Then** the transaction is auto-assigned to the Coffee envelope.

2. **Given** two rules: Priority 1 (Payee contains 'Amazon' -> Shopping) and Priority 2 (Amount > $100 -> Big Purchases),
   **When** a $150 Amazon transaction is created,
   **Then** the Priority 1 rule matches first and assigns it to Shopping.

3. **Given** a rule exists for Starbucks,
   **When** the user manually assigns a Starbucks transaction to "Business Meals",
   **Then** the manual assignment is preserved (rule does not override).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| contains match is case-insensitive | condition: "starbucks", merchant: "STARBUCKS #123" | match: true |
| starts_with matches prefix | condition: "AMZ", merchant: "AMZN MARKETPLACE" | match: true |
| regex matches pattern | condition: "^UBER.*TRIP$", merchant: "UBER EATS TRIP" | match: true |
| amount between evaluates correctly | condition: [5000, 10000], amount: 7500 | match: true |
| all conditions must match (AND) | 2 conditions, only 1 matches | match: false |
| priority order is respected | rule1: priority 1, rule2: priority 2, both match | rule1 applied |
| manual categorization takes precedence | user set envelope, rule says different | user envelope kept |

---

### BG-015: Payday Detection

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-015 |
| **Feature Name** | Payday Detection |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a budgeter, I want the app to detect my pay schedule from my transaction history, so that I know when my next paycheck arrives and can plan my budget accordingly.

#### 3.3 Detailed Description

The payday detector analyzes inflow transactions to identify recurring income patterns. It classifies frequency (weekly, biweekly, monthly, semi-monthly), predicts the next payday, and generates a payday schedule. This helps users plan budget allocations around their pay cycle.

The detector groups positive-amount transactions by normalized payee, calculates the mean and standard deviation of intervals between payments, and uses statistical thresholds to classify the frequency. A confidence score indicates how reliable the detection is.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-003: Transaction Entry - needs inflow transaction history

#### 3.5 User Interface Requirements

**Display:** Payday information appears in:
- Budget tab header: "Next payday: [date] ([days] days away)"
- Settings page: detected pay schedule with option to confirm/correct

**Interactions:**
- Tap payday indicator: Shows full schedule for next 3 months
- User can manually set pay schedule if detection is wrong

#### 3.6 Data Requirements

No new entities. Detection runs against existing Transaction data. User-confirmed schedule is stored as a setting.

#### 3.7 Business Logic Rules

##### Detect Paydays

**Purpose:** Identify recurring income streams from transaction history.

**Inputs:**
- transactions: Transaction[] (inflows only, sorted by date)

**Logic:**

```
1. Filter to inflow transactions
2. Group by normalized payee name (lowercase, trimmed)
3. FOR each payee group with 3+ transactions:
   a. Sort by date ascending
   b. Calculate intervals between consecutive transactions (days)
   c. Compute mean and standard deviation
   d. Classify frequency:
      - Mean 5-9 days, stddev < 3: weekly
      - Mean 12-17 days, stddev < 5: biweekly (OR semi_monthly, see step e)
      - Mean 25-35 days, stddev < 7: monthly
   e. Semi-monthly check: if 80%+ of transaction dates fall on exactly 2
      repeating day-of-month values (e.g., 1st and 15th), classify as semi_monthly
   f. Calculate confidence = max(0, min(1, 1 - coefficientOfVariation))
4. Return detected paydays sorted by confidence descending
```

**Formulas:**
- `coefficientOfVariation = stddev(intervals) / mean(intervals)`
- `confidence = max(0, min(1, 1 - coefficientOfVariation))`

##### Predict Next Payday

**Purpose:** Calculate the next expected payday.

**Logic:**

```
1. Take the most recent transaction date for the detected payee
2. Add the detected frequency interval:
   - weekly: +7 days
   - biweekly: +14 days
   - monthly: +month (same day)
   - semi_monthly: next of the two anchor days
3. Skip weekends: if projected date falls on Saturday, use preceding Friday;
   if Sunday, use following Monday
4. Return projected date
```

**Edge Cases:**
- User with multiple income sources: Each detected separately
- Irregular freelance income: Low confidence score, not classified
- New user with <3 income transactions: "Insufficient data" message

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Insufficient data (<3 inflows) | "We need more income transactions to detect your pay schedule." | User waits or manually enters schedule |
| Detection confidence is low | "We're not confident in our detection. Please confirm: [detected schedule]" | User confirms or corrects |

#### 3.9 Acceptance Criteria

1. **Given** 6 months of biweekly paychecks from "ACME Corp" on every other Friday,
   **When** payday detection runs,
   **Then** it detects biweekly frequency with high confidence and predicts the next payday.

2. **Given** a user gets paid on the 1st and 15th of every month,
   **When** payday detection runs,
   **Then** it classifies the frequency as semi-monthly with anchor days 1 and 15.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| detects biweekly frequency | intervals: [14, 14, 14, 14, 14] | frequency: biweekly |
| detects monthly frequency | intervals: [30, 31, 30, 31, 28] | frequency: monthly |
| detects semi-monthly | dates: Jan 1, Jan 15, Feb 1, Feb 15, Mar 1, Mar 15 | frequency: semi_monthly, anchors: [1, 15] |
| confidence is high for consistent intervals | stddev: 0.5, mean: 14 | confidence: ~0.96 |
| confidence is low for irregular intervals | stddev: 10, mean: 20 | confidence: 0.5 |
| skips weekend for prediction | predicted: Saturday | returns: preceding Friday |
| skips payee with <3 transactions | group count: 2 | excluded |

---

### BG-016: Reports Dashboard

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-016 |
| **Feature Name** | Reports Dashboard |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a budgeter, I want visual reports showing spending trends, category breakdowns, and income vs. expenses, so that I can understand my financial patterns at a glance.

#### 3.3 Detailed Description

The Reports Dashboard provides visual analytics computed from existing transaction and budget data. It includes four report types: Spending by Category (pie/bar chart), Monthly Spending Trend (line chart over time), Budgeted vs. Spent (per-category comparison), and Top Payees (ranked list). All data is computed from local SQLite data.

Reports support configurable time ranges (this month, last 3 months, last 6 months, this year, custom range) and can be filtered by account.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-003: Transaction Entry - transaction data to analyze
- BG-004: Budget Month Engine - budget allocation data for comparison

#### 3.5 User Interface Requirements

##### Screen: Reports Tab

**Layout:**
- Top navigation bar with "Reports" title
- Time range selector: This Month, 3 Months, 6 Months, Year, Custom
- Report cards in a scrollable list:
  1. **Spending by Category** - horizontal bar chart or pie chart showing outflow amounts per envelope
  2. **Income vs. Expense** - grouped bar chart showing monthly income and spending side by side
  3. **Budgeted vs. Spent** - per-envelope bars showing allocated vs actual spend with percentage used
  4. **Top Payees** - ranked list of merchants by total spend
- Each report card is tappable to open a full-screen detailed view

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No transactions in selected range | "No data for this period." |
| Loading | Computing reports | Skeleton charts |
| Populated | Data exists | Charts and lists |

##### Screen: Spending by Category Detail

**Layout:**
- Full-screen pie chart or horizontal bar chart
- Below the chart, a sorted list of categories with amounts and percentages
- Tap a category to see individual transactions in that category for the period

##### Screen: Income vs. Expense Detail

**Layout:**
- Full-screen grouped bar chart with months on X-axis
- Income bars (green) and expense bars (red) side by side
- Net cash flow line overlaid (income - expense per month)
- Summary below: total income, total expenses, net for the period

##### Screen: Net Worth Report

**Layout:**
- Full-screen line chart showing net worth over time
- Below: current net worth, assets breakdown, liabilities breakdown
- Historical data points from net worth snapshots (see BG-019)

#### 3.6 Data Requirements

No new entities. Reports are computed on-demand from existing Transaction, BudgetAllocation, and Account data.

#### 3.7 Business Logic Rules

##### Spending by Category

**Purpose:** Show how much was spent in each envelope over a period.

**Logic:**

```
1. Query transactions WHERE direction = 'outflow' AND occurred_on BETWEEN from_date AND to_date
2. Group by envelope_id
3. For split transactions: use each split's envelope_id and amount instead of parent
4. Exclude transfers (direction = 'transfer')
5. Calculate total and per-category percentage
6. Sort by amount descending
```

##### Monthly Spending Trend

**Purpose:** Show income and spending per month over a period.

**Logic:**

```
1. Group transactions by month (YYYY-MM extracted from occurred_on)
2. FOR each month:
   - income = SUM(amount) WHERE direction = 'inflow'
   - spending = SUM(amount) WHERE direction = 'outflow'
   - net = income - spending
3. Return array of {month, income, spending, net}
```

##### Budgeted vs. Spent

**Purpose:** Compare budget allocations against actual spending per category.

**Logic:**

```
1. FOR each envelope in the selected month:
   - budgeted = allocation.amount (from BudgetAllocation)
   - spent = ABS(SUM(outflow transactions in this envelope for the month))
   - percentUsed = (spent / budgeted) * 100 (0 if budgeted is 0)
2. Sort by percentUsed descending (most over-budget first)
```

##### Top Payees

**Purpose:** Show which merchants the user spends the most at.

**Logic:**

```
1. Query outflow transactions in date range
2. Group by merchant (normalized: lowercase, trimmed)
3. SUM(amount) per merchant
4. Sort by total descending
5. Return top N (default 10, max 50)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No data for selected period | "No transactions found for this period." | User selects different range |
| Computation takes >2 seconds | Show progress indicator | Auto-completes when done |

#### 3.9 Acceptance Criteria

1. **Given** the user has 3 months of transaction data,
   **When** they view Spending by Category for "Last 3 Months",
   **Then** a chart shows the total spent per envelope with percentages.

2. **Given** monthly income of $5,000 and expenses of $4,200,
   **When** viewing Income vs. Expense,
   **Then** bars show $5,000 (green) and $4,200 (red) with net $800 (positive).

3. **Given** Groceries has $600 budgeted and $480 spent,
   **When** viewing Budgeted vs. Spent,
   **Then** Groceries shows 80% used with a progress bar.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| spending by category groups correctly | 3 transactions across 2 envelopes | 2 category entries with correct totals |
| splits distribute to correct envelopes | split: $80 Groceries + $20 Household | Groceries: 8000, Household: 2000 |
| excludes transfers from spending | 1 outflow, 1 transfer | only outflow in results |
| monthly trend calculates net | income: 500000, spending: 420000 | net: 80000 |
| budgeted vs spent calculates percentage | budgeted: 60000, spent: 48000 | percentUsed: 80 |
| top payees sorts by total | Trader Joe's: $500, Target: $300 | Trader Joe's first |
| handles zero budget gracefully | budgeted: 0, spent: 5000 | percentUsed: 0 (not infinity) |

---

### BG-017: Budget Alerts

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-017 |
| **Feature Name** | Budget Alerts |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a budgeter, I want to receive alerts when I've spent a certain percentage of an envelope's budget, so that I can adjust my spending before overspending.

#### 3.3 Detailed Description

Budget alerts notify the user when spending in an envelope reaches a configured threshold (e.g., 80%, 90%, 100%). Each envelope can have its own alert threshold, and alerts are deduped per month (an 80% alert only fires once per month per envelope, not on every subsequent transaction).

Alerts are delivered as in-app notifications (toast or badge on the Budget tab) and optionally as local push notifications (mobile only). No network is used for notifications.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-004: Budget Month Engine - spending state needed to check thresholds

#### 3.5 User Interface Requirements

**Display:**
- Alert badges on envelope rows in the Budget tab (yellow at threshold, red at 100%)
- In-app notification banner when threshold is crossed
- Settings screen to configure per-envelope alert thresholds
- Alert history log accessible from Settings

##### Screen: Alert Settings

**Layout:**
- List of envelopes with toggle and threshold input for each
- Default threshold: 80%
- Toggle to enable/disable local push notifications
- Alert history link

#### 3.6 Data Requirements

##### Entity: BudgetAlert (config)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| category_id | string | References Envelope.id | None | Which envelope |
| threshold_pct | integer | 1-200 | 80 | Percentage at which to alert |
| is_enabled | integer | 0 or 1 | 1 | Whether this alert is active |
| created_at | string | ISO 8601 | Current timestamp | Creation time |

##### Entity: AlertHistory

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| alert_id | string | References BudgetAlert.id | None | Which alert config |
| month | string | YYYY-MM | None | Which budget month this fired in |
| fired_at | string | ISO 8601 | Current timestamp | When the alert fired |
| spent_pct | integer | Actual percentage at time of alert | None | How much was spent when alert fired |

#### 3.7 Business Logic Rules

##### Check Alerts

**Purpose:** Evaluate all alert configs against current spending.

**Logic:**

```
1. FOR each enabled alert config:
   a. Get the envelope's current month spending state
   b. Calculate spentPct = ABS(activity) / allocated * 100
   c. IF spentPct >= threshold_pct:
      - Check AlertHistory: has this alert already fired this month?
      - IF not fired: create AlertHistory record, trigger notification
      - IF already fired: skip (deduplication)
2. Return list of newly fired alerts
```

**Formulas:**
- `spentPct = ABS(activity) / allocated * 100`
- If allocated is 0 and activity is non-zero, treat as 100% (any spending exceeds zero budget)

**Edge Cases:**
- Envelope with zero allocation: Any spending triggers 100% alert
- Envelope with no alert config: No alerts (user must opt in)
- Multiple thresholds crossed in single transaction: Fire all applicable

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Notification permission denied | In-app alerts still work, toast: "Enable notifications for budget alerts" | User enables in system settings |

#### 3.9 Acceptance Criteria

1. **Given** Groceries has $600 budgeted with 80% alert enabled,
   **When** spending reaches $480 (80%),
   **Then** an alert fires: "Groceries: 80% of budget spent ($480 of $600)."

2. **Given** an 80% alert already fired this month for Groceries,
   **When** another transaction pushes spending to 85%,
   **Then** no new 80% alert fires (deduplication).

3. **Given** alerts at both 80% and 100% configured,
   **When** a single large transaction pushes from 70% to 105%,
   **Then** both the 80% and 100% alerts fire.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| fires alert at threshold | spent: 48000, allocated: 60000, threshold: 80 | alert fires |
| does not fire below threshold | spent: 45000, allocated: 60000, threshold: 80 | no alert |
| deduplicates within month | alert already fired this month | no alert |
| handles zero allocation | allocated: 0, activity: -100 | 100% alert |
| multiple thresholds in one transaction | thresholds: [80, 100], jumped from 70% to 105% | both fire |

---

### BG-018: Upcoming Transactions

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-018 |
| **Feature Name** | Upcoming Transactions |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a budgeter, I want to see a list of upcoming transactions from my recurring templates, so that I can plan for bills and know what is coming before it hits.

#### 3.3 Detailed Description

The Upcoming Transactions view projects future transactions from active recurring templates over a configurable window (default 30 days). It shows what bills and income are expected, when, and how much. Transactions are grouped by date and show a running total of expected outflows.

This view helps users ensure they have enough money allocated to cover upcoming bills and plan ahead for irregular expenses.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-010: Recurring Templates - source of upcoming transaction projections

#### 3.5 User Interface Requirements

##### Screen: Upcoming Transactions

**Layout:**
- Accessible from Transactions tab via "Upcoming" button or Budget tab
- Time window selector: 7 days, 14 days, 30 days, 60 days, 90 days
- Scrollable list of projected transactions grouped by date
- Each row: merchant, amount (red for outflows, green for inflows), envelope, account
- Daily subtotal for each date group
- Grand total at bottom: "Expected outflows: $X,XXX.XX over [N] days"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No recurring templates | "No upcoming transactions. Set up recurring transactions to see future projections." |
| Populated | Templates exist | Grouped date list with projections |

#### 3.6 Data Requirements

No new entities. This feature queries RecurringTemplate and projects future occurrences using the calculation logic from BG-010.

#### 3.7 Business Logic Rules

##### Get Upcoming Transactions

**Purpose:** Project future transactions from active templates.

**Logic:**

```
1. Get all active recurring templates (is_active = 1, not expired)
2. FOR each template:
   a. Generate occurrences within the selected window using calculateNextDate
   b. FOR each occurrence: create projected record {date, merchant, amount, direction, envelope_id, account_id}
3. Merge all projected records
4. Sort by date ascending
5. Group by date
6. Calculate daily subtotals and grand total (outflows only)
```

**Edge Cases:**
- Template with end_date within window: Only shows occurrences up to end_date
- No templates: Empty state message
- Daily template over 90-day window: Generates 90 projected entries (each clearly marked as projected)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No templates exist | Empty state with link to set up recurring transactions | User creates templates |

#### 3.9 Acceptance Criteria

1. **Given** a monthly rent template for $1,500 on the 1st and a biweekly paycheck of $2,500,
   **When** viewing the next 30 days,
   **Then** rent appears on the 1st and paychecks on their respective dates with a total outflow of $1,500 and total inflow of $5,000.

2. **Given** a 30-day window selected,
   **When** viewing upcoming transactions,
   **Then** all projected transactions are grouped by date with daily subtotals.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| projects monthly template | template: 1st of month, window: 30 days | 1 occurrence |
| projects biweekly over 30 days | template: biweekly, window: 30 days | 2 occurrences |
| respects end_date | end_date in 15 days, window: 30 days | occurrences only up to end_date |
| groups by date correctly | 3 templates, 2 on same day | same-day group has 2 entries |
| calculates grand total outflows only | outflows: 150000, inflows: 250000 | outflow total: 150000 |

---

### BG-019: Net Worth Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-019 |
| **Feature Name** | Net Worth Tracking |
| **Priority** | P0 |
| **Category** | Analytics |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a financially-aware user, I want to see my net worth (assets minus liabilities) and track how it changes over time, so that I can measure my overall financial health beyond just monthly budgeting.

#### 3.3 Detailed Description

Net worth tracking aggregates all account balances into a single metric: assets minus liabilities. Assets include checking, savings, and cash accounts. Liabilities include credit card balances. The system captures monthly snapshots of account balances and builds a timeline chart showing net worth progression over time.

This is the #1 most-requested feature across all budgeting apps according to competitive analysis. YNAB, Monarch, Copilot, Tiller, and Rocket Money all offer net worth tracking.

Net worth calculations use existing account balance data, so no manual balance entry is needed beyond what the user already tracks in Account Management (BG-002). Future investment accounts (BG-022) will also feed into net worth.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-002: Account Management - account balances feed the calculation

#### 3.5 User Interface Requirements

##### Screen: Net Worth (within Reports tab)

**Layout:**
- Large net worth number at top: "$XX,XXX.XX" with trend arrow (up/down vs. last month)
- Line chart showing net worth over time (monthly data points)
- Below the chart: Assets section (list of asset accounts with balances) and Liabilities section (list of liability accounts with balances)
- Total Assets, Total Liabilities, and Net Worth summary row
- Time range selector for the chart: 3 months, 6 months, 1 year, All Time

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Insufficient Data | Less than 2 snapshots | "Track your accounts for at least 2 months to see your net worth trend." |
| Populated | 2+ snapshots | Chart with data points |

#### 3.6 Data Requirements

##### Entity: NetWorthSnapshot

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| month | string | YYYY-MM, unique | None | Which month this snapshot covers |
| total_assets | integer | In cents | None | Sum of all asset account balances |
| total_liabilities | integer | In cents (positive value) | None | Sum of absolute values of liability balances |
| net_worth | integer | In cents (can be negative) | None | assets - liabilities |
| account_breakdown | string | JSON | None | Per-account balances at snapshot time |
| captured_at | string | ISO 8601 | Current timestamp | When snapshot was taken |

**Indexes:**
- `month` UNIQUE - One snapshot per month

#### 3.7 Business Logic Rules

##### Calculate Net Worth

**Purpose:** Compute current net worth from account balances.

**Formulas:**
- `total_assets = SUM(current_balance) WHERE type IN ('checking', 'savings', 'cash') AND archived = 0`
- `total_liabilities = SUM(ABS(current_balance)) WHERE type = 'credit' AND archived = 0`
- `net_worth = total_assets - total_liabilities`

##### Capture Snapshot

**Purpose:** Record a monthly snapshot of net worth for historical tracking.

**Logic:**

```
1. Calculate current total_assets, total_liabilities, net_worth
2. Build account_breakdown JSON: {account_id: balance} for all non-archived accounts
3. UPSERT into net_worth_snapshots for the current month
4. If previous snapshot exists for this month, overwrite (user may update balances)
```

**Trigger:** Snapshot is captured automatically on the first day of each month, and manually when the user opens the Net Worth screen (if no snapshot exists for the current month).

##### Build Timeline

**Purpose:** Generate data points for the net worth chart.

**Logic:**

```
1. Query all net_worth_snapshots sorted by month ASC
2. Return array of {month, net_worth, total_assets, total_liabilities}
```

**Edge Cases:**
- Account with zero balance: Included in calculations (counts as $0 asset)
- Archived account: Excluded from current calculation but historical snapshots retain the value at snapshot time
- Credit card with positive balance (overpayment): Treated as an asset for that account, but still grouped under liabilities section visually
- Net worth is negative: Displayed normally (liabilities exceed assets)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No accounts exist | "Add accounts to start tracking net worth." | User creates accounts |
| Snapshot capture fails | Silent retry on next app open | Auto-retries |

#### 3.9 Acceptance Criteria

1. **Given** checking: $5,000, savings: $10,000, credit card: -$2,000,
   **When** the user views Net Worth,
   **Then** it shows Assets: $15,000, Liabilities: $2,000, Net Worth: $13,000.

2. **Given** snapshots exist for January ($10,000), February ($11,500), March ($13,000),
   **When** viewing the Net Worth chart,
   **Then** a line chart shows three data points with an upward trend.

3. **Given** the user's net worth was $13,000 last month and is $14,200 this month,
   **When** viewing the Net Worth screen,
   **Then** "$14,200.00" is displayed with an up arrow and "+$1,200.00 vs last month."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates net worth correctly | assets: 1500000, liabilities: 200000 | netWorth: 1300000 |
| handles negative net worth | assets: 500000, liabilities: 800000 | netWorth: -300000 |
| excludes archived accounts | active checking: 500000, archived savings: 200000 | total_assets: 500000 |
| snapshot captures all account balances | 3 accounts | account_breakdown has 3 entries |
| timeline returns sorted data | snapshots: [Mar, Jan, Feb] | sorted: [Jan, Feb, Mar] |

---

### BG-020: Debt Payoff Planner

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-020 |
| **Feature Name** | Debt Payoff Planner |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a debtor, I want to create a payoff plan for my credit cards and loans with either snowball or avalanche strategy, so that I can see a clear path to becoming debt-free with projected payoff dates.

#### 3.3 Detailed Description

The Debt Payoff Planner helps users create a strategy to eliminate debt. It supports two proven strategies:

1. **Snowball (Dave Ramsey):** Pay minimums on all debts, throw extra at the smallest balance first. Psychologically motivating because debts are eliminated quickly.

2. **Avalanche (mathematically optimal):** Pay minimums on all debts, throw extra at the highest interest rate first. Saves the most money in total interest paid.

Users enter their debts (balance, interest rate, minimum payment) and a total monthly payment budget. The planner generates a month-by-month amortization schedule showing when each debt will be paid off, total interest paid, and the debt-free date.

Interest rates are stored as basis points (1800 = 18.00% APR) for integer precision.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-002: Account Management - credit accounts represent debts

#### 3.5 User Interface Requirements

##### Screen: Debt Payoff Planner

**Layout:**
- Debt list at top: each debt shows name, balance, APR, minimum payment
- Add Debt button
- Total Monthly Payment input (how much the user can pay toward all debts combined)
- Strategy toggle: Snowball / Avalanche
- Results section:
  - Debt-free date
  - Total interest paid
  - Months to payoff
  - Savings vs. minimum payments only
- Amortization schedule (expandable per debt): month-by-month showing payment, principal, interest, remaining balance

**Interactions:**
- Adjust total monthly payment: Results recalculate instantly
- Toggle strategy: Results recalculate
- Tap debt in schedule: Expands full amortization for that debt

##### Modal: Add/Edit Debt

**Layout:**
- Fields: Name (text), Current Balance (currency), Interest Rate (percentage, e.g., 18.99%), Minimum Payment (currency)
- Balance and minimum are in cents; interest rate is entered as percentage and stored as basis points

#### 3.6 Data Requirements

##### Entity: DebtPayoffPlan

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| name | string | Required, 1-80 chars | "My Debt Payoff Plan" | Plan name |
| strategy | enum | snowball/avalanche | snowball | Payoff strategy |
| monthly_budget | integer | Positive, in cents | None | Total monthly payment budget |
| created_at | string | ISO 8601 | Current timestamp | Creation time |
| updated_at | string | ISO 8601 | Current timestamp | Last modification time |

##### Entity: DebtPayoffDebt

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| plan_id | string | References DebtPayoffPlan.id | None | Parent plan |
| name | string | Required, 1-80 chars | None | Debt name |
| balance | integer | Positive, in cents | None | Current balance |
| interest_rate_bps | integer | Non-negative, in basis points | 0 | Annual interest rate (1800 = 18.00%) |
| minimum_payment | integer | Positive, in cents | None | Minimum monthly payment |
| account_id | string | Nullable, references Account.id | null | Linked local account |
| sort_order | integer | Non-negative | 0 | Display position |

#### 3.7 Business Logic Rules

##### Snowball Strategy

**Purpose:** Order debts by balance ascending (smallest first).

**Logic:**

```
1. Sort debts by balance ASC (tiebreaker: highest interest rate first)
2. Pay minimum on all debts
3. Apply remaining budget (monthly_budget - SUM(minimums)) to the first debt
4. When first debt is paid off, redirect its minimum + extra to the next debt
5. Repeat until all debts are $0
```

##### Avalanche Strategy

**Purpose:** Order debts by interest rate descending (highest rate first).

**Logic:**

```
1. Sort debts by interest_rate_bps DESC (tiebreaker: lowest balance first)
2. Same payment waterfall logic as Snowball
```

##### Monthly Interest Calculation

**Formulas:**
- Monthly compounding: `monthlyInterest = balance * (APR / 12)`
  - Where `APR = interest_rate_bps / 10000`
- Daily compounding (optional): `monthlyInterest = balance * ((1 + APR/365)^30.4375 - 1)`

**Default:** Monthly compounding

##### Generate Amortization Schedule

**Purpose:** Create a month-by-month breakdown for a single debt.

**Logic:**

```
1. Start with current balance
2. FOR each month until balance <= 0 (max 600 months / 50 years safety cap):
   a. interest = ROUND(balance * (APR / 12))
   b. payment = MIN(minimum_payment + extra, balance + interest)
   c. principal = payment - interest
   d. balance = balance - principal
   e. Record {month, payment, principal, interest, remainingBalance}
3. Return schedule
```

**Formulas:**
- `APR = interest_rate_bps / 10000`
- `monthlyInterest = ROUND(balance * APR / 12)`
- `principal = payment - monthlyInterest`
- `totalInterest = SUM(interest) across all months`

**Edge Cases:**
- 0% interest debt: No interest accrual, pure principal reduction
- Minimum payment less than monthly interest: Debt grows (warn user)
- Monthly budget less than sum of minimums: Error - insufficient budget
- MAX_MONTHS = 600 (50 years) safety cap to prevent infinite loops

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Monthly budget < sum of minimums | "Your monthly budget must be at least $X (the sum of minimum payments)." | User increases budget |
| Minimum payment < monthly interest | Warning: "The minimum payment on [debt] doesn't cover monthly interest. The balance will grow." | User increases minimum or budget |
| No debts added | "Add at least one debt to create a payoff plan." | User adds debts |
| Payoff exceeds 50 years | "At this rate, payoff would take over 50 years. Consider increasing your monthly payment." | User adjusts budget |

#### 3.9 Acceptance Criteria

1. **Given** two debts: Credit Card ($5,000 at 18.99%, $100 min) and Car Loan ($15,000 at 5.49%, $350 min) with $700/month budget,
   **When** the user selects Snowball strategy,
   **Then** extra $250 goes to Credit Card first (smallest balance), then rolls over to Car Loan after Credit Card is paid off.

2. **Given** the same debts with Avalanche strategy,
   **When** viewing the plan,
   **Then** extra $250 goes to Credit Card first (highest rate) - same result in this case since it is both smallest and highest rate.

3. **Given** a $5,000 debt at 18.99% with $200/month total payment,
   **When** viewing the amortization schedule,
   **Then** month 1 shows interest of ~$79.13, principal of ~$120.87, remaining ~$4,879.13.

4. **Given** a completed payoff plan,
   **When** viewing results,
   **Then** the plan shows debt-free date, total interest paid, and savings vs. minimum-only payments.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| snowball sorts by balance ascending | debts: [15000, 5000, 8000] | order: [5000, 8000, 15000] |
| avalanche sorts by rate descending | rates: [549, 1899, 1200] | order: [1899, 1200, 549] |
| monthly interest at 18.99% on $5000 | balance: 500000, rate_bps: 1899 | interest: 7913 |
| monthly interest at 0% | balance: 500000, rate_bps: 0 | interest: 0 |
| amortization reaches zero | balance: 100000, rate: 0, payment: 10000 | 10 months |
| safety cap at 600 months | balance: huge, payment: tiny | stops at 600 months |
| insufficient budget error | budget: 400, minimums sum: 450 | error |

---

### BG-021: Multi-Currency Support

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-021 |
| **Feature Name** | Multi-Currency Support |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a traveler or international user, I want to record transactions in their original currency and see them converted to my home currency, so that I can budget across currencies without manual conversion.

#### 3.3 Detailed Description

Multi-currency support adds the ability to record transactions in any currency and see them converted to a home (base) currency for budgeting purposes. Each transaction stores the original currency and amount. Exchange rates are fetched from a free public API at the time of transaction entry and stored alongside the transaction. Only the currency pair is sent to the API, never transaction amounts or user data.

Exchange rates are stored as integers with a precision multiplier of 1,000,000 to avoid floating-point issues (e.g., 1 EUR = 1,082,345 means 1.082345 USD per EUR).

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-002: Account Management - accounts have a currency field
- BG-003: Transaction Entry - transactions store currency and conversion data

#### 3.5 User Interface Requirements

**Transaction Entry Changes:**
- Currency selector on the Add Transaction screen (defaults to account's currency)
- When a non-home currency is selected, show the converted amount in home currency below
- Exchange rate displayed with option to manually override

**Account Management Changes:**
- Currency field on Add/Edit Account
- Balance displayed in account's native currency with home currency equivalent

**Reports Changes:**
- All report totals shown in home currency
- Option to see original currency amounts in transaction details

#### 3.6 Data Requirements

##### Entity: Currency

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| code | string | Primary key, 3 chars, ISO 4217 | None | Currency code (USD, EUR, GBP, etc.) |
| name | string | Required | None | Display name ("US Dollar") |
| symbol | string | Required | None | Currency symbol ("$", "EUR", "GBP") |
| decimal_places | integer | 0-4 | 2 | Number of decimal places (0 for JPY, 2 for USD) |

##### Entity: ExchangeRate

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| from_currency | string | 3 chars, references Currency.code | None | Source currency |
| to_currency | string | 3 chars, references Currency.code | None | Target currency |
| rate | integer | Positive | None | Rate * 1,000,000 (RATE_PRECISION) |
| fetched_at | string | ISO 8601 | Current timestamp | When rate was fetched |

**Indexes:**
- `from_currency, to_currency, fetched_at DESC` - Latest rate lookup

#### 3.7 Business Logic Rules

##### Convert Amount

**Purpose:** Convert an amount from one currency to another.

**Inputs:**
- amount_cents: integer (in source currency cents)
- rate: integer (exchange rate * RATE_PRECISION)

**Logic:**

```
RATE_PRECISION = 1_000_000
converted = ROUND(amount_cents * rate / RATE_PRECISION)
RETURN converted
```

**Formula:**
- `converted = ROUND(amountCents * rate / 1_000_000)`

##### Convert to Base Currency

**Purpose:** Convert any amount to the user's home currency.

**Logic:**

```
1. Look up direct rate: from_currency -> to_currency (home)
2. IF direct rate exists: use it
3. ELSE: look up inverse rate (home -> foreign) and compute:
   inverseConverted = ROUND(RATE_PRECISION^2 / inverse_rate)
   Then apply: ROUND(amount * inverseConverted / RATE_PRECISION)
4. IF no rate exists: return null (cannot convert)
```

##### Format Currency Amount

**Purpose:** Display amounts with correct currency symbol and decimal places.

**Logic:**

```
1. Look up Currency.decimal_places for the currency code
2. IF decimal_places = 0 (e.g., JPY): display without decimal point
3. ELSE: display with decimal_places digits after decimal
4. Prepend or append currency symbol per locale convention
```

**Edge Cases:**
- JPY and other zero-decimal currencies: No decimal point displayed, amounts stored directly (100 JPY = 100, not 10000)
- Very small exchange rates (e.g., 1 USD = 0.000013 BTC): RATE_PRECISION of 1,000,000 handles this (rate = 13)
- Stale exchange rate: Rates older than 24 hours trigger a refresh attempt; if offline, use stale rate with a "Rate may be outdated" indicator

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Exchange rate API unavailable | "Could not fetch exchange rate. Enter rate manually or try later." | User enters rate manually |
| Stale rate (>24 hours old) | Small warning: "Exchange rate from [date]. Tap to refresh." | User taps to refresh or accepts stale rate |
| Unknown currency code | "Currency [code] is not supported." | User selects supported currency |

#### 3.9 Acceptance Criteria

1. **Given** a transaction of 50.00 EUR with rate 1.082345 USD/EUR,
   **When** viewing the transaction in USD (home currency),
   **Then** it shows $54.12 (ROUND(5000 * 1082345 / 1000000) = 5412 cents).

2. **Given** a JPY account,
   **When** the user enters a transaction for 15000 JPY,
   **Then** the amount is stored as 15000 (no decimal places) and displayed as "JPY 15,000".

3. **Given** the user is offline,
   **When** they enter a foreign currency transaction,
   **Then** the last cached exchange rate is used with a "Rate may be outdated" indicator.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| converts EUR to USD | amount: 5000, rate: 1082345 | converted: 5412 |
| converts using inverse rate | no direct rate, inverse: 923456 | computed from inverse |
| handles zero-decimal currency (JPY) | amount: 15000, currency: JPY | display: "JPY 15,000" (no decimals) |
| RATE_PRECISION is 1000000 | rate: 1.082345 | stored as: 1082345 |
| round-trips conversion | USD -> EUR -> USD | original amount +/- 1 cent |

---

### BG-022: Investment Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-022 |
| **Feature Name** | Investment Tracking |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As an investor, I want to manually track my investment portfolio (stocks, ETFs, crypto) with current values, so that my net worth reflects my total financial picture including investments.

**Secondary:**
> As a long-term saver, I want to see my portfolio allocation breakdown and simple returns, so that I understand my investment mix and performance.

#### 3.3 Detailed Description

Investment tracking allows users to manually enter investment holdings (ticker symbol, number of shares/units, cost basis). The app looks up current prices from free public APIs (e.g., Yahoo Finance, Alpha Vantage) to show portfolio value, allocation breakdown, and simple returns.

Investment values feed into the net worth calculation (BG-019), giving users a complete picture of their financial health. This is a manual-entry feature for MVP; brokerage sync via Plaid could be added later.

Only the ticker symbol is sent to the price API. No user data, quantities, or portfolio composition is transmitted.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-019: Net Worth Tracking - investment values contribute to net worth

**External Dependencies:**
- Network for price lookups (optional - manual price entry supported)

#### 3.5 User Interface Requirements

##### Screen: Investment Portfolio

**Layout:**
- Accessible from Accounts tab or Reports tab
- Portfolio summary: Total Value, Total Cost Basis, Total Return ($ and %), Day Change
- Allocation pie chart by asset class or sector
- Holdings list: ticker, name, shares, current price, market value, return %, cost basis
- Add Holding button

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No holdings | "Add your first investment to start tracking." |
| Populated | Holdings exist | Portfolio summary with holdings list |
| Prices Stale | Last price fetch >24 hours | "Prices last updated [time]. Tap to refresh." |

##### Modal: Add/Edit Holding

**Layout:**
- Fields: Ticker Symbol (text with autocomplete), Shares/Units (decimal), Cost Basis Per Share (currency), Date Acquired (optional)
- Current price auto-fills from API when ticker is entered
- Save creates the holding

#### 3.6 Data Requirements

##### Entity: InvestmentHolding

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| ticker | string | Required, max 10 chars | None | Ticker symbol (AAPL, VTI, BTC-USD) |
| name | string | Nullable | null | Security name (auto-populated from API) |
| shares | integer | Positive, in millishares (1000 = 1 share) | None | Number of shares * 1000 |
| cost_basis_per_share | integer | Non-negative, in cents | None | Purchase price per share in cents |
| current_price | integer | Non-negative, in cents | None | Last known price per share in cents |
| price_updated_at | string | Nullable, ISO 8601 | null | When price was last fetched |
| asset_class | enum | stock/etf/bond/crypto/reit/other | stock | Asset classification |
| created_at | string | ISO 8601 | Current timestamp | Creation time |
| updated_at | string | ISO 8601 | Current timestamp | Last modification time |

#### 3.7 Business Logic Rules

##### Portfolio Calculations

**Formulas:**
- `marketValue = shares * currentPrice / 1000` (shares stored as millishares)
- `costBasis = shares * costBasisPerShare / 1000`
- `totalReturn = marketValue - costBasis`
- `returnPct = (totalReturn / costBasis) * 100`
- `allocationPct = (holdingMarketValue / totalPortfolioValue) * 100`
- All values in cents

**Edge Cases:**
- Cost basis of 0 (gifted/inherited): Return percentage shows "N/A"
- Fractional shares: Supported via millishares (0.5 shares = 500 millishares)
- Crypto with very small unit prices: Cent-level precision may lose sub-cent values; display note

##### Price Refresh

**Logic:**

```
1. FOR each holding with stale price (>24 hours or manual refresh):
   a. Fetch current price from API using ticker symbol
   b. Update current_price and price_updated_at
2. Recalculate portfolio totals
3. If offline: use last cached price with staleness indicator
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Unknown ticker | "Could not find '[ticker]'. Check the symbol and try again." | User corrects ticker |
| Price API unavailable | "Could not update prices. Showing last known values." | Manual price entry or retry later |
| Fractional share precision | Stored as millishares to avoid floating point | None needed |

#### 3.9 Acceptance Criteria

1. **Given** the user adds 10 shares of AAPL at $150 cost basis,
   **When** current price is $175,
   **Then** market value shows $1,750, return shows +$250 (+16.67%).

2. **Given** a portfolio with holdings in 3 asset classes,
   **When** viewing the allocation chart,
   **Then** a pie chart shows percentage breakdown by asset class.

3. **Given** investment holdings exist,
   **When** viewing Net Worth,
   **Then** investment values are included in the assets total.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates market value | shares: 10000 (10), price: 17500 | marketValue: 175000 |
| calculates return | cost: 150000, market: 175000 | return: 25000, pct: 16.67 |
| handles fractional shares | shares: 500 (0.5), price: 20000 | marketValue: 10000 |
| allocation percentage | holding: 50000, total: 200000 | allocation: 25% |
| zero cost basis | cost: 0 | returnPct: N/A |

---

### BG-023: Expense Splitting

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-023 |
| **Feature Name** | Expense Splitting |
| **Priority** | P1 |
| **Category** | Social |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a roommate or friend who shares expenses, I want to split bills and track who owes whom, so that I can settle up fairly without using a separate app like Splitwise.

#### 3.3 Detailed Description

Expense splitting allows users to split transactions with contacts and track running balances (who owes whom). The feature is local-first: the user records their view of shared expenses and settle-up payments. No account is required for the other party.

Splitting supports equal division, percentage-based splits, and exact amount splits. Users can generate a summary URL or QR code to share the split details with the other party, but this is a one-way share (no real-time sync between users).

Running balances persist across multiple split transactions. When the balance is settled (via cash, Venmo, etc.), the user records a settle-up payment to zero out the balance.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-003: Transaction Entry - splits reference existing transactions

#### 3.5 User Interface Requirements

##### Screen: Splits (accessible from Transactions tab)

**Layout:**
- Contact list showing running balances: "You owe [name] $X" or "[name] owes you $X"
- Tap contact: See split history with that person
- Add Split button

##### Modal: Split a Transaction

**Layout:**
- Select transaction to split (or enter a new one)
- Add participants (from contacts or manual name entry)
- Split method: Equal, Percentage, Exact Amounts
- Each participant row shows their share
- "You paid" or "They paid" selector (who actually paid the bill)
- Save creates split records and updates running balances

##### Screen: Contact Split History

**Layout:**
- Running balance at top
- Chronological list of shared expenses and settle-up payments
- "Settle Up" button to record a payment received/sent
- "Share Summary" button to generate share link

#### 3.6 Data Requirements

##### Entity: SplitContact

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| name | string | Required, 1-80 chars | None | Contact name |
| phone | string | Nullable | null | Phone number for sharing |
| email | string | Nullable | null | Email for sharing |
| running_balance | integer | In cents, positive = they owe you | 0 | Net balance |
| created_at | string | ISO 8601 | Current timestamp | Creation time |

##### Entity: SplitRecord

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| transaction_id | string | Nullable, references Transaction.id | null | Source transaction |
| contact_id | string | References SplitContact.id | None | Who the split is with |
| total_amount | integer | Positive, in cents | None | Total bill amount |
| your_share | integer | Non-negative, in cents | None | Your portion |
| their_share | integer | Non-negative, in cents | None | Their portion |
| who_paid | enum | you/them | None | Who paid the bill |
| description | string | Required | None | What the expense was for |
| split_date | string | YYYY-MM-DD | Current date | When the split occurred |
| is_settled | integer | 0 or 1 | 0 | Whether this has been settled |
| created_at | string | ISO 8601 | Current timestamp | Creation time |

#### 3.7 Business Logic Rules

##### Calculate Running Balance

**Purpose:** Track net balance with each contact.

**Logic:**

```
FOR each split record with a contact:
  IF who_paid = 'you':
    contact.running_balance += their_share (they owe you their portion)
  IF who_paid = 'them':
    contact.running_balance -= your_share (you owe them your portion)

FOR each settle-up payment:
  IF you received payment: contact.running_balance -= payment_amount
  IF you sent payment: contact.running_balance += payment_amount

Positive running_balance = they owe you
Negative running_balance = you owe them
```

##### Split Methods

**Equal split:**
- each_share = FLOOR(total / participant_count)
- remainder = total - (each_share * participant_count)
- First participant gets the remainder cent(s)

**Percentage split:**
- Percentages must sum to 100
- Each share = ROUND(total * percentage / 100)
- Adjust last participant for rounding (ensure sum = total)

**Exact amount split:**
- Amounts must sum to total exactly

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Splits don't sum to total | "Shares must add up to the total." | User adjusts amounts |
| Percentages don't sum to 100 | "Percentages must total 100%." | User adjusts percentages |

#### 3.9 Acceptance Criteria

1. **Given** a $60 dinner bill paid by the user, split equally with 1 friend,
   **When** the split is saved,
   **Then** the friend's running balance increases by $30 (they owe you $30).

2. **Given** a running balance where Alex owes you $50,
   **When** Alex pays you $50 and you record a settle-up,
   **Then** the running balance becomes $0.

3. **Given** a $100 bill split 60/40 by percentage,
   **When** you paid and your share is 60%,
   **Then** their share is $40 and running balance increases by $40.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| equal split of $60 between 2 | total: 6000, participants: 2 | each: 3000 |
| equal split handles remainder | total: 10000, participants: 3 | shares: [3334, 3333, 3333] |
| percentage split 70/30 | total: 10000, pcts: [70, 30] | shares: [7000, 3000] |
| running balance after you-paid split | your_share: 3000, their_share: 3000, who_paid: you | balance: +3000 |
| settle-up reduces balance | balance: 3000, settle: 3000 | balance: 0 |

---

### BG-024: Receipt Scanning (OCR)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-024 |
| **Feature Name** | Receipt Scanning (OCR) |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user who gets paper or digital receipts, I want to scan them with my camera and have the merchant, total, and date auto-extracted, so that I can add transactions quickly without manual entry.

#### 3.3 Detailed Description

Receipt scanning uses on-device OCR (Vision framework on iOS, ML Kit on Android) to extract transaction data from receipt photos. The user takes a photo or selects an existing image, and the system attempts to extract: merchant name, total amount, date, and optionally line items.

Extracted data pre-fills the Add Transaction form. The user reviews and confirms before saving. The original receipt image is stored on-device and attached to the transaction for reference.

All processing happens on-device. No images or receipt data are uploaded to any server.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-003: Transaction Entry - extracted data creates a transaction

**External Dependencies:**
- Camera hardware (for photo capture)
- On-device OCR framework (Vision on iOS, ML Kit on Android)

#### 3.5 User Interface Requirements

##### Screen: Scan Receipt

**Layout:**
- Camera viewfinder with a receipt outline guide
- Capture button at bottom
- Gallery picker to select existing image
- After capture: processing indicator, then extracted data preview:
  - Merchant: [extracted or "Not detected"]
  - Amount: [extracted or blank]
  - Date: [extracted or today's date]
  - Line items (if detected): scrollable list
- "Use" button to pre-fill Add Transaction form
- "Retake" button to try again

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Camera Ready | Viewfinder active | Camera preview with guide overlay |
| Processing | OCR running | Spinner: "Scanning receipt..." |
| Results | Data extracted | Preview of extracted fields |
| Failed | OCR could not extract data | "Could not read receipt. Try a clearer photo." with retake option |

#### 3.6 Data Requirements

No new entities needed for OCR processing. Receipt images are stored as files in the app's local storage directory, and the file path is stored in an optional `receipt_image_path` field on the Transaction entity.

**Addition to Transaction entity:**
- `receipt_image_path`: string, nullable - local file path to the receipt image

#### 3.7 Business Logic Rules

##### OCR Extraction Pipeline

**Logic:**

```
1. Pre-process image:
   a. Convert to grayscale
   b. Apply contrast enhancement
   c. Detect receipt boundaries and crop
2. Run OCR to extract all text blocks with positions
3. Extract merchant:
   a. Look at top 3 text lines (usually store name/logo area)
   b. Match against payee cache and subscription catalog for known merchants
4. Extract total:
   a. Search for keywords: "TOTAL", "AMOUNT DUE", "GRAND TOTAL", "BALANCE DUE"
   b. Find the number immediately following/beside the keyword
   c. If multiple "TOTAL" lines, use the last/largest one (subtotals precede grand total)
   d. Parse as currency amount
5. Extract date:
   a. Search for date patterns: MM/DD/YYYY, MM/DD/YY, YYYY-MM-DD, Month DD, YYYY
   b. Use the first valid date found
6. Extract line items (optional):
   a. Find lines with item descriptions followed by amounts
   b. Return as array of {description, amount}
```

**Edge Cases:**
- Blurry image: Return partial results with confidence indicators
- Multiple totals (subtotal, tax, total): Use the largest/last "total" value
- Receipt in non-English language: Extract numbers and dates (language-agnostic), merchant name may be approximate
- No text detected: Show "Could not read receipt" error

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Camera permission denied | "Camera access required for receipt scanning. Enable in Settings." | Link to system settings |
| OCR extracts nothing | "Could not read receipt. Try a clearer photo or enter manually." | Retake or manual entry |
| Amount not detected | Amount field left blank in preview, user enters manually | Manual entry |
| Image too large | Image compressed before processing (max 4MP) | Automatic |

#### 3.9 Acceptance Criteria

1. **Given** a clear receipt photo from Trader Joe's totaling $85.47 on March 5, 2026,
   **When** the user scans it,
   **Then** merchant shows "Trader Joe's", amount shows $85.47, date shows March 5, 2026.

2. **Given** extracted data from a receipt scan,
   **When** the user taps "Use",
   **Then** the Add Transaction form opens pre-filled with merchant, amount, and date.

3. **Given** a blurry receipt where only the total is readable,
   **When** scanning completes,
   **Then** the amount is extracted and merchant shows "Not detected" for user to fill in.

4. **Given** a receipt image is attached to a transaction,
   **When** viewing the transaction detail,
   **Then** the receipt image is viewable by tapping "View Receipt."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| extracts total from "TOTAL: $85.47" | text block with "TOTAL: $85.47" | amount: 8547 |
| extracts date MM/DD/YYYY | text: "03/05/2026" | date: "2026-03-05" |
| extracts date Month DD, YYYY | text: "March 5, 2026" | date: "2026-03-05" |
| uses largest total when multiple | "SUBTOTAL: $75.00\nTAX: $6.75\nTOTAL: $81.75" | amount: 8175 |
| handles missing merchant | no text in top area | merchant: null |

---

### BG-025: ML Auto-Categorization

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-025 |
| **Feature Name** | ML Auto-Categorization |
| **Priority** | P2 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a frequent budgeter, I want the app to learn from my categorization habits and automatically suggest envelopes for new transactions, so that I spend less time on manual categorization.

#### 3.3 Detailed Description

ML auto-categorization trains a simple on-device classifier using the user's own transaction categorization history. After sufficient training data (50+ manually categorized transactions), the model starts suggesting envelope assignments for new transactions.

The model uses merchant name (tokenized) and amount range as features, and predicts the most likely envelope. Suggestions are shown as a pre-selected envelope with a "Suggested" badge. The user can accept or override.

The model retrains periodically as new categorized transactions are added. All training and inference runs locally - no data leaves the device. This contrasts with Copilot and Monarch, which use cloud-based AI for categorization.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-003: Transaction Entry - training data source
- BG-014: Transaction Rules Engine - ML supplements rule-based categorization (rules take priority)

#### 3.5 User Interface Requirements

**Integration Points:**
- Add Transaction screen: Suggested envelope appears with "AI Suggested" badge when model has a prediction
- User can tap to accept or choose a different envelope
- Settings: "Auto-categorization" toggle with status: "Training ([N] transactions)" or "Active ([N] transactions learned)"
- Settings: "Retrain Model" button

#### 3.6 Data Requirements

The ML model is stored as a local file (Core ML on iOS, TensorFlow Lite on Android). No new database entities - the model learns from existing Transaction records.

**Training data extraction query:**
- All transactions where envelope_id is not null AND direction = 'outflow'
- Features: merchant (tokenized), amount range bucket
- Label: envelope_id

#### 3.7 Business Logic Rules

##### Model Training

**Logic:**

```
1. Extract training data: transactions with non-null envelope_id
2. IF count < 50: model not ready, show "Need X more categorized transactions"
3. Feature engineering:
   a. Tokenize merchant name: split by spaces, lowercase, remove numbers
   b. Amount bucket: [0-500], [500-2000], [2000-5000], [5000-10000], [10000-50000], [50000+] (cents)
4. Train simple classifier (Naive Bayes or k-nearest neighbors)
5. Save model to local storage
6. Log: model version, training count, accuracy on held-out 20%
```

##### Prediction

**Logic:**

```
1. IF model not trained OR auto-categorization disabled: skip
2. IF transaction rules engine matched a rule: use rule result (rules take priority)
3. Extract features from new transaction (merchant tokens + amount bucket)
4. Run prediction
5. IF confidence >= 0.7: suggest top envelope with confidence badge
6. IF confidence < 0.7: no suggestion (too uncertain)
```

**Edge Cases:**
- Brand new envelope with no training data: Model cannot predict it until the user categorizes a few transactions
- Merchant not seen before: Model uses amount bucket and partial token matches
- User categorizes a suggestion differently: Model learns from the correction on next retrain

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Insufficient training data | "Categorize [50 - current] more transactions to enable auto-categorization." | User categorizes more transactions |
| Model training fails | Silent fallback to no suggestions | Auto-retries on next app launch |
| Model file corrupted | Model deleted, retrains from scratch | Automatic |

#### 3.9 Acceptance Criteria

1. **Given** 60+ transactions categorized to various envelopes,
   **When** the model trains successfully,
   **Then** Settings shows "Auto-categorization: Active (60 transactions learned)."

2. **Given** the user frequently categorizes "STARBUCKS" transactions to "Coffee",
   **When** a new Starbucks transaction is entered,
   **Then** "Coffee" is suggested with an "AI Suggested" badge.

3. **Given** a transaction rule exists for "Amazon" -> "Shopping",
   **When** an Amazon transaction is entered,
   **Then** the rule-based categorization is used (not ML), since rules take priority.

4. **Given** the ML suggests "Groceries" but the user selects "Restaurants",
   **When** the model retrains,
   **Then** the correction is incorporated into future predictions.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| requires 50+ transactions | training set: 30 | model: not_ready |
| tokenizes merchant correctly | "TRADER JOE'S #123" | tokens: ["trader", "joe's"] |
| amount bucketing | amount: 7500 | bucket: [5000-10000] |
| high confidence predicts | confidence: 0.85 | suggestion shown |
| low confidence skips | confidence: 0.55 | no suggestion |
| rules take priority over ML | rule matches + ML predicts | rule result used |

---

### BG-026: Subscription Cancellation Assist

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-026 |
| **Feature Name** | Subscription Cancellation Assist |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user who wants to cancel a subscription, I want a direct link to the cancellation page for each service, so that I can cancel quickly without navigating through confusing settings menus.

#### 3.3 Detailed Description

Subscription cancellation assist enhances the 215-entry subscription catalog with direct cancellation URLs, difficulty ratings (easy/medium/hard/impossible), and step-by-step cancellation instructions. Data is sourced from JustDeleteMe's open-source database and curated manually.

When a user views a tracked subscription, they see a "Cancel" button that either opens the direct cancellation URL or shows step-by-step instructions. The difficulty rating helps users understand how hard cancellation will be before they start.

This is a privacy advantage over Rocket Money, which requires deep account access to cancel subscriptions on your behalf.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-008: Subscription Catalog and Tracking

#### 3.5 User Interface Requirements

**Integration into Subscription Detail screen:**
- "Cancel This Subscription" section at bottom of detail screen
- Difficulty badge: Easy (green), Medium (yellow), Hard (red), Impossible (gray)
- "Go to Cancellation Page" button (opens URL in browser)
- Step-by-step instructions expandable section
- After user confirms cancellation: option to mark subscription as cancelled in the app

#### 3.6 Data Requirements

**Addition to CatalogEntry:**
- `cancel_url`: string, nullable - Direct URL to the cancellation page
- `cancel_difficulty`: enum (easy/medium/hard/impossible) - How hard it is to cancel
- `cancel_steps`: string[], nullable - Step-by-step cancellation instructions

#### 3.7 Business Logic Rules

No complex business logic. The feature is primarily data-driven (catalog entries with cancellation metadata).

**Logic:**
- If cancel_url exists: Show "Go to Cancellation Page" button
- If cancel_steps exist: Show expandable instructions
- If neither exists: Show "Visit [service website] and look for account/subscription settings"
- Difficulty is informational only

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Cancel URL is broken/outdated | "This link may be outdated. Visit [service].com directly." | User navigates manually |
| No cancellation data for this service | "No cancellation info available. Visit [service website]." | User finds it themselves |

#### 3.9 Acceptance Criteria

1. **Given** Netflix is in the catalog with cancel_url and difficulty "easy",
   **When** viewing Netflix subscription detail,
   **Then** a green "Easy" badge and "Go to Cancellation Page" button are shown.

2. **Given** a service rated "hard" with step-by-step instructions,
   **When** viewing the cancellation section,
   **Then** instructions are shown with a red "Hard" difficulty badge.

3. **Given** the user taps "Go to Cancellation Page" and then confirms cancellation,
   **When** they mark it cancelled in the app,
   **Then** the subscription status changes to "cancelled" and it is excluded from cost totals.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| catalog entry has cancel URL | entry: "netflix" | cancel_url: non-null |
| difficulty maps to color | difficulty: "hard" | color: red |
| missing cancel data shows fallback | cancel_url: null, cancel_steps: null | fallback message |

---

### BG-027: Age of Money

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-027 |
| **Feature Name** | Age of Money |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a budgeter, I want to see the "Age of Money" metric (how many days my money sits before being spent), so that I can gauge my financial buffer and know if I am living paycheck-to-paycheck or building a cushion.

#### 3.3 Detailed Description

Age of Money follows YNAB's methodology. It calculates the average number of days between when a dollar enters an account (inflow) and when it is spent (outflow). A higher Age of Money indicates a larger financial buffer. New users typically see 3-5 days (paycheck-to-paycheck), while established budgeters target 30+ days.

The calculation uses a FIFO (first-in, first-out) queue approach: the oldest unspent dollar is the first to be "spent" when an outflow occurs. The age of the last 10 outflow-matched dollars is averaged.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-003: Transaction Entry - needs inflow and outflow history
- BG-004: Budget Month Engine - context for understanding the metric

#### 3.5 User Interface Requirements

**Display:** A single metric displayed on:
- Budget tab header area: "Age of Money: [X] days" with trend indicator
- Reports dashboard as a standalone card
- Tapping opens a detail view explaining the metric and showing its trend

**Detail View:**
- Current Age of Money in large text
- 30-day trend chart (daily age values)
- Explanation text: "Your money sits for an average of [X] days before being spent. Higher is better."
- Benchmarks: "<7 days: paycheck to paycheck", "7-14 days: building buffer", "14-30 days: healthy buffer", "30+ days: strong financial health"

#### 3.6 Data Requirements

No new entities. Calculated on-demand from existing Transaction data.

#### 3.7 Business Logic Rules

##### Calculate Age of Money

**Purpose:** Determine the average age of recently spent dollars.

**Logic:**

```
1. Create a FIFO queue of inflow "dollars" (each with a received_date):
   - For each inflow transaction (sorted by date ASC):
     - Enqueue {amount_cents, received_date}
2. Process outflow transactions (sorted by date ASC):
   - For each outflow:
     - Dequeue dollars from the FIFO until the outflow amount is covered
     - For each dequeued chunk: calculate age = outflow_date - received_date (days)
     - Record the weighted average age for this outflow
3. Take the last 10 outflow ages
4. Average them
5. RETURN average_age_days (rounded to nearest integer)
```

**Formulas:**
- `age_of_dollar = outflow_date - inflow_received_date` (in days)
- `age_of_money = AVERAGE(last 10 outflow ages)`

**Edge Cases:**
- No inflows yet: Cannot calculate, show "N/A"
- More outflows than inflows (deficit spending): FIFO queue empties, remaining outflow dollars get age 0
- Very large inflow followed by many small outflows: All outflows aged from the large inflow date
- Transfers are excluded (not income or spending)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Insufficient data (<10 outflows) | "Need more spending data to calculate. Keep tracking!" | User continues using the app |
| No inflows recorded | "Record your income to start tracking Age of Money." | User adds income |

#### 3.9 Acceptance Criteria

1. **Given** a $5,000 paycheck on March 1 and $500 spent on March 8,
   **When** calculating age of money,
   **Then** the $500 spent has an age of 7 days.

2. **Given** a user with 30+ days of consistent budgeting history,
   **When** viewing Age of Money,
   **Then** a number is displayed with a trend chart and benchmark category.

3. **Given** a user with Age of Money at 5 days,
   **When** viewing the metric,
   **Then** the benchmark shows "Paycheck to paycheck" with tips to improve.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| simple age calculation | inflow: Mar 1, outflow: Mar 8 | age: 7 days |
| FIFO ordering | inflow1: Jan 1 $1000, inflow2: Feb 1 $1000, outflow: Feb 15 $500 | age: 45 days (uses Jan 1 money first) |
| averages last 10 outflows | 10 outflows with ages [5,6,7,8,9,10,11,12,13,14] | average: 9.5, rounded: 10 |
| excludes transfers | transfer transaction | not counted in age |
| handles insufficient data | 3 outflows only | "insufficient data" |

---

### BG-028: Loan Planner and Calculator

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-028 |
| **Feature Name** | Loan Planner and Calculator |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As someone considering a loan (mortgage, car, student), I want a calculator that shows monthly payments, total interest, and an amortization schedule for different scenarios, so that I can make informed borrowing decisions.

#### 3.3 Detailed Description

The Loan Planner is a pure computation tool (no external dependencies) that generates amortization schedules. Users input principal, interest rate, and term, and the calculator shows monthly payment, total interest, total cost, and a month-by-month schedule. It also supports "what-if" scenarios for extra payments, showing how additional principal payments reduce total interest and shorten the loan term.

This builds on the debt payoff engine (BG-020) but focuses on prospective loan planning rather than existing debt elimination.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-020: Debt Payoff Planner - shares amortization calculation logic

#### 3.5 User Interface Requirements

##### Screen: Loan Calculator

**Layout:**
- Input section: Principal (currency), Annual Interest Rate (percentage), Term in Months (number), Extra Monthly Payment (currency, optional, default 0)
- Results section (updates as inputs change):
  - Monthly Payment (standard)
  - Monthly Payment with Extra
  - Total Interest (standard vs. with extra)
  - Total Cost (principal + interest)
  - Months to Payoff (standard vs. with extra)
  - Interest Saved by extra payments
- Amortization Schedule (expandable): month-by-month table with Payment, Principal, Interest, Remaining Balance
- "Compare" button to see two scenarios side-by-side (e.g., 15-year vs 30-year mortgage)

#### 3.6 Data Requirements

No persistent storage needed. This is a stateless calculator. Users can optionally save scenarios for reference.

##### Entity: SavedLoanScenario (optional)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| name | string | Required | None | Scenario name |
| principal | integer | Positive, in cents | None | Loan principal |
| interest_rate_bps | integer | Non-negative | None | Annual interest rate in basis points |
| term_months | integer | Positive | None | Loan term in months |
| extra_payment | integer | Non-negative, in cents | 0 | Extra monthly principal payment |
| created_at | string | ISO 8601 | Current timestamp | Creation time |

#### 3.7 Business Logic Rules

##### Standard Loan Payment Calculation

**Purpose:** Calculate the fixed monthly payment for a loan.

**Formula (standard amortization):**

```
r = APR / 12 (monthly rate)
  where APR = interest_rate_bps / 10000
n = term_months

IF r = 0:
  monthly_payment = principal / n
ELSE:
  monthly_payment = principal * (r * (1 + r)^n) / ((1 + r)^n - 1)

Round to nearest cent.
```

##### Extra Payment Impact

**Logic:**

```
1. Generate standard schedule (no extra)
2. Generate schedule with extra payment applied to principal each month
3. Compare:
   - months_saved = standard_months - extra_months
   - interest_saved = standard_total_interest - extra_total_interest
```

**Edge Cases:**
- 0% interest loan: Monthly payment = principal / term, no interest
- Very short term (1 month): Single payment of principal + one month's interest
- Extra payment exceeds remaining balance: Cap at remaining balance
- Very low interest rate: Ensure calculation precision with integer math

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Principal is 0 or negative | Inline: "Enter a loan amount greater than $0" | User corrects |
| Term is 0 | Inline: "Enter a loan term of at least 1 month" | User corrects |
| Interest rate > 100% | Warning: "This is a very high interest rate. Please verify." | User confirms or corrects |

#### 3.9 Acceptance Criteria

1. **Given** a $300,000 mortgage at 6.5% for 30 years (360 months),
   **When** calculating the monthly payment,
   **Then** the result is approximately $1,896.20/month with ~$382,633 total interest.

2. **Given** the same mortgage with $200/month extra payment,
   **When** comparing scenarios,
   **Then** payoff is shortened by ~5-6 years and interest saved is shown.

3. **Given** a 0% interest car loan of $25,000 for 60 months,
   **When** calculating,
   **Then** monthly payment is exactly $416.67 with $0 total interest.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| standard mortgage payment | principal: 30000000, rate: 650 bps, term: 360 | payment: ~189620 |
| zero interest loan | principal: 2500000, rate: 0, term: 60 | payment: 41667 |
| extra payment reduces term | standard: 360 months, extra: 20000/mo | term < 360 |
| extra payment reduces interest | with vs without extra | interest_saved > 0 |
| single month term | principal: 100000, rate: 1200, term: 1 | payment: 101000 (principal + 1 month interest) |

---

### BG-029: Data Export

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-029 |
| **Feature Name** | Data Export |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user who values data ownership, I want to export all my budget data in standard formats (CSV, JSON), so that I can keep backups, analyze data in spreadsheets, or migrate to another tool.

#### 3.3 Detailed Description

Data export allows users to export their complete financial data in CSV and JSON formats. Export covers: transactions, envelopes, accounts, subscriptions, goals, and budget allocations. CSV exports produce one file per entity type. JSON exports produce a single comprehensive file.

Exports are generated on-device and shared via the system share sheet (email, AirDrop, Files, etc.). No data is uploaded to any server.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-003: Transaction Entry - transaction data to export

#### 3.5 User Interface Requirements

##### Screen: Export Data (within Settings)

**Layout:**
- Export format selector: CSV, JSON
- Data scope checkboxes: Transactions, Envelopes, Accounts, Subscriptions, Goals, Budget Allocations (all checked by default)
- Date range filter (optional): Export only data within a date range
- "Export" button
- Progress indicator during generation
- On completion: system share sheet opens with the generated file(s)

#### 3.6 Data Requirements

No new entities. Export reads existing data and generates files.

**CSV file structure per entity:**
- `transactions.csv`: id, date, merchant, amount, direction, envelope, account, note
- `envelopes.csv`: id, name, monthly_budget, rollover_enabled, group, archived
- `accounts.csv`: id, name, type, balance, currency, archived
- `subscriptions.csv`: id, name, price, billing_cycle, status, next_renewal
- `goals.csv`: id, name, envelope, target_amount, current_amount, target_date, status
- `allocations.csv`: month, envelope, amount

**JSON structure:**
- Single object with keys for each entity type, each containing an array of records

#### 3.7 Business Logic Rules

**Logic:**

```
1. Query selected entity types from database
2. Apply date range filter (if set) to transactions and allocations
3. Format data:
   - CSV: header row + data rows, amounts formatted as decimal dollars
   - JSON: structured object, amounts as integer cents with a note about cents format
4. Generate file(s)
5. Present via system share sheet
```

**Edge Cases:**
- Very large dataset (10,000+ transactions): Generate asynchronously with progress indicator
- Empty dataset: Export file with header row only (CSV) or empty arrays (JSON)
- Special characters in merchant names: Properly escaped in CSV (quoted fields)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No data to export | "No data found for the selected options." | User adjusts selection |
| File generation fails | "Export failed. Please try again." | User retries |
| Insufficient storage | "Not enough storage to create export file." | User frees space |

#### 3.9 Acceptance Criteria

1. **Given** the user has 500 transactions,
   **When** they export as CSV with all entities selected,
   **Then** a transactions.csv file is generated with 501 rows (header + 500 data rows) and shared via share sheet.

2. **Given** the user exports as JSON,
   **When** the export completes,
   **Then** a single .json file contains all selected entity types with correct data.

3. **Given** the user sets a date range filter,
   **When** exporting transactions,
   **Then** only transactions within the date range are included.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| CSV header matches entity fields | entity: transactions | header: "id,date,merchant,amount,..." |
| amounts formatted as dollars in CSV | amount: 8547 | "85.47" |
| JSON amounts as cents | amount: 8547 | 8547 |
| date range filters transactions | range: Mar 1-15, data: Mar 1-31 | only Mar 1-15 included |
| special chars escaped in CSV | merchant: 'Trader "Joe''s"' | properly quoted |
| empty dataset produces valid file | no transactions | header-only CSV / empty array JSON |

---

### BG-030: Onboarding Flow

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-030 |
| **Feature Name** | Onboarding Flow |
| **Priority** | P0 |
| **Category** | Onboarding |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a new user, I want a guided first-launch experience that sets up my budget basics (accounts, initial envelopes, first income), so that I can start budgeting immediately without being overwhelmed by a blank slate.

#### 3.3 Detailed Description

The onboarding flow guides new users through the essential setup steps: understanding envelope budgeting, adding their first accounts, setting up initial envelopes, and recording their first income. The flow reduces the blank-slate problem by providing sensible defaults and education about the methodology.

Onboarding consists of 5 steps (swipeable screens):
1. Welcome and value proposition
2. Add accounts (with starter suggestions)
3. Set up envelopes (with starter categories and groups)
4. Enter current balance and initial income
5. Assign dollars to envelopes (first budgeting experience)

Users can skip onboarding and set up manually if they prefer.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is the entry point)

#### 3.5 User Interface Requirements

##### Screen: Onboarding Step 1 - Welcome

**Layout:**
- App icon and "MyBudget" title
- Value proposition: "Every dollar gets a job."
- Brief explanation of envelope budgeting (3 bullet points)
- "Get Started" button
- "Skip Setup" link at bottom

##### Screen: Onboarding Step 2 - Accounts

**Layout:**
- "Where is your money?" heading
- Pre-filled starter accounts: Checking, Cash
- Option to add more accounts
- Each account: name, type, starting balance
- "Next" button

##### Screen: Onboarding Step 3 - Envelopes

**Layout:**
- "What do you spend on?" heading
- Pre-filled starter envelopes in groups:
  - Fixed Expenses: Rent/Mortgage, Utilities, Insurance
  - Variable Expenses: Groceries, Transportation, Fun Money
  - Savings: Emergency Fund
- Checkboxes to include/exclude each starter envelope
- Option to add custom envelopes
- "Next" button

##### Screen: Onboarding Step 4 - Income

**Layout:**
- "How much do you have right now?" heading
- Total starting balance (sum of accounts entered in step 2)
- "Next" button

##### Screen: Onboarding Step 5 - First Budget

**Layout:**
- "Give every dollar a job" heading
- Ready to Assign: $X,XXX.XX (starting balance)
- List of envelopes with editable budget amounts
- As user allocates, Ready to Assign decreases
- "Finish Setup" button (enabled even if not fully allocated)

#### 3.6 Data Requirements

No new entities. Onboarding creates records in existing entities (Account, Envelope, CategoryGroup, BudgetAllocation, Transaction for initial income).

A `has_completed_onboarding` setting is stored in the Settings table to track whether onboarding has been shown.

#### 3.7 Business Logic Rules

##### Seed Default Data

**Logic:**

```
1. Create starter accounts: Checking (balance from user input), Cash ($0)
2. Create category groups: Fixed Expenses, Variable Expenses, Savings
3. Create starter envelopes (only those the user selected):
   - Rent/Mortgage (Fixed, budget: 0)
   - Utilities (Fixed, budget: 0)
   - Insurance (Fixed, budget: 0)
   - Groceries (Variable, budget: 0)
   - Transportation (Variable, budget: 0)
   - Fun Money (Variable, budget: 0)
   - Emergency Fund (Savings, budget: 0)
4. Create initial income transaction from starting balance
5. Set has_completed_onboarding = true
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| User force-quits during onboarding | On next launch, resume from last completed step | Automatic |
| Database seed fails | "Setup encountered an error. Please try again." | User restarts onboarding |

#### 3.9 Acceptance Criteria

1. **Given** a first-time user launches the app,
   **When** they complete all 5 onboarding steps,
   **Then** they arrive at the Budget tab with accounts, envelopes, and initial budget set up.

2. **Given** the user taps "Skip Setup",
   **When** onboarding is skipped,
   **Then** the app opens to an empty Budget tab with default starter data (Checking + Cash accounts, 4 starter envelopes).

3. **Given** onboarding is completed,
   **When** the user closes and reopens the app,
   **Then** onboarding does not appear again.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| seed creates starter accounts | onboarding complete | 2 accounts: Checking, Cash |
| seed creates starter envelopes | all selected | 7 envelopes in 3 groups |
| partial envelope selection | 4 of 7 selected | 4 envelopes created |
| initial income transaction created | starting balance: 500000 | inflow transaction: 500000 |
| has_completed_onboarding is set | after completion | setting: "true" |

---

### BG-031: Settings and Preferences

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-031 |
| **Feature Name** | Settings and Preferences |
| **Priority** | P0 |
| **Category** | Settings |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user, I want to configure app preferences like home currency, month start day, notification settings, and data management options, so that the app works the way I prefer.

#### 3.3 Detailed Description

Settings provides a centralized location for all user preferences and app configuration. Preferences are stored in a simple key-value table in SQLite.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None

#### 3.5 User Interface Requirements

##### Screen: Settings

**Layout:**
- Sections:
  - **Budget Settings:** Home Currency (default USD), Month Start Day (default 1, range 1-28), Number Format (US: 1,000.00 vs EU: 1.000,00)
  - **Notifications:** Budget alert notifications toggle, Subscription renewal reminders toggle, Reminder days before renewal (default 3)
  - **Bank Sync:** Connected accounts list (if any), Connect/Disconnect buttons, Auto-sync toggle
  - **Data:** Export Data, Import CSV, Delete All Data (with triple confirmation)
  - **Auto-Categorization:** ML auto-categorization toggle, Training status, Retrain button
  - **Transaction Rules:** Link to rules management
  - **About:** App version, Privacy policy link, Open source licenses

#### 3.6 Data Requirements

##### Entity: Setting

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| key | string | Primary key, unique | None | Setting identifier |
| value | string | Required | None | Setting value (stored as string, parsed by consumers) |

**Default Settings:**

| Key | Default Value | Description |
|-----|--------------|-------------|
| currency | "USD" | Home currency code |
| monthStartDay | "1" | Day of month the budget cycle starts |
| notificationsEnabled | "true" | Whether push notifications are enabled |
| renewalReminderDays | "3" | Days before renewal to notify |
| autoSyncEnabled | "false" | Whether bank sync runs automatically |
| autoCategorization | "false" | Whether ML suggestions are shown |
| has_completed_onboarding | "false" | Whether user completed onboarding |

#### 3.7 Business Logic Rules

##### Month Start Day

**Logic:** When monthStartDay > 1, the "budget month" runs from day N to day N-1 of the next calendar month. For example, if monthStartDay = 15:
- "March 2026" budget runs from March 15 to April 14
- Transactions on March 14 belong to "February 2026" budget month

**Edge Cases:**
- monthStartDay = 29, 30, or 31: Capped to the last day of months with fewer days
- Maximum allowed: 28 (to ensure every month can have the start day)

##### Delete All Data

**Logic:**

```
1. Show first confirmation: "Are you sure you want to delete all data?"
2. Show second confirmation: "This action cannot be undone. All transactions, budgets, accounts, and subscriptions will be permanently deleted."
3. Show final confirmation: Type "DELETE" to confirm
4. Drop all bg_ tables and recreate empty schema
5. Reset has_completed_onboarding to false
6. Navigate to onboarding
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Setting save fails | Toast: "Could not save setting." | Retry |
| Delete all data interrupted | Partial delete is rolled back (atomic transaction) | User retries |

#### 3.9 Acceptance Criteria

1. **Given** the user changes home currency to EUR,
   **When** viewing budgets and reports,
   **Then** all amounts display with EUR symbol.

2. **Given** the user sets month start day to 15,
   **When** viewing the March budget,
   **Then** it covers March 15 to April 14.

3. **Given** the user taps Delete All Data and completes triple confirmation,
   **When** deletion completes,
   **Then** all data is removed and the app returns to onboarding.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| default currency is USD | no setting | currency: "USD" |
| month start day shifts budget period | startDay: 15, month: March | period: Mar 15 - Apr 14 |
| month start day max is 28 | input: 31 | capped to 28 |
| delete all data clears tables | execute delete | all bg_ tables empty |
| settings persist across restarts | set key, close, reopen | value persisted |

---

### BG-032: Partner and Family Sharing

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BG-032 |
| **Feature Name** | Partner and Family Sharing |
| **Priority** | P2 |
| **Category** | Social |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As part of a couple or family that budgets together, I want to share specific envelopes with my partner so we can both track spending against a shared grocery or household budget.

#### 3.3 Detailed Description

Partner sharing enables two users to share specific envelopes. Each user maintains their own local database but can designate envelopes as "shared." Shared envelope data syncs between devices via a local sync mechanism (initially: export/import, later: peer-to-peer sync via local network or QR code exchange).

This is a V1 approach that avoids cloud infrastructure. YNAB supports up to 6 users but requires cloud accounts. MyBudget's approach keeps data local while enabling basic collaboration.

For MVP, sharing works via manual export/import of shared envelope data. The shared_envelopes table tracks which envelopes are shared and with whom.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BG-001: Envelope Management
- BG-003: Transaction Entry

#### 3.5 User Interface Requirements

##### Envelope Sharing Controls

**Layout:**
- In Envelope Edit modal: "Share this envelope" toggle
- When enabled: Generate a share code (QR or text) for the partner to scan/enter
- Shared envelopes show a shared icon in the budget view
- "Sync Shared Envelopes" button to export/import shared data

#### 3.6 Data Requirements

##### Entity: SharedEnvelope

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| envelope_id | string | References Envelope.id | None | Which envelope is shared |
| partner_name | string | Required | None | Partner's display name |
| partner_device_id | string | Nullable | null | Partner's device identifier (for sync) |
| sync_token | string | Required | None | Shared secret for data exchange |
| last_synced_at | string | Nullable, ISO 8601 | null | Last sync time |
| created_at | string | ISO 8601 | Current timestamp | Creation time |

#### 3.7 Business Logic Rules

##### Share Envelope Flow

**Logic:**

```
1. User A marks envelope as shared
2. System generates a sync_token (random 32-char string)
3. User A shares the token with User B (QR code, text message, etc.)
4. User B enters the token in their app
5. System creates a SharedEnvelope record on both devices
6. To sync: User A exports shared envelope data (transactions, allocations) as JSON
7. User B imports the JSON, merging by transaction ID
8. Conflicts: last-write-wins based on updated_at timestamp
```

**Edge Cases:**
- Offline sync: Data is queued locally until export/import happens
- Conflicting edits: Last-write-wins with updated_at timestamp comparison
- One user deletes a shared transaction: Deletion propagates on next sync

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Invalid sync token | "Invalid sharing code. Check with your partner." | User re-enters token |
| Merge conflict | Last-write-wins applied silently | User reviews merged data |

#### 3.9 Acceptance Criteria

1. **Given** User A shares the "Groceries" envelope,
   **When** User B enters the share code,
   **Then** both users see "Groceries" as a shared envelope with the shared icon.

2. **Given** both users have spent from a shared envelope,
   **When** they sync,
   **Then** both see all transactions from both users in the shared envelope.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates valid sync token | share request | 32-char alphanumeric string |
| merge by transaction ID | local: [t1, t2], remote: [t2, t3] | merged: [t1, t2, t3] |
| last-write-wins on conflict | local t1 updated 12:00, remote t1 updated 12:05 | remote version kept |

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

The data model centers on Envelopes (budget categories) and Transactions. Each Transaction flows through an Account (the "where") and optionally into an Envelope (the "why"). Envelopes are organized into CategoryGroups. Budget Allocations assign money to Envelopes on a per-month basis. Goals attach to Envelopes for savings tracking.

Subscriptions are tracked independently but can link to Envelopes for budget integration. The subscription catalog provides pre-populated service data. Bank sync imports raw transactions from financial institutions and maps them to local Transactions.

Supporting entities handle recurring templates, transaction rules, net worth snapshots, debt payoff plans, exchange rates, alerts, and expense splitting.

### 4.2 Complete Entity Definitions

The following entities are defined in their respective feature sections above:

| Entity | Feature | Table (hub) | Fields |
|--------|---------|-------------|--------|
| Envelope | BG-001 | bg_envelopes | id, name, icon, color, monthly_budget, rollover_enabled, archived, sort_order, created_at, updated_at |
| Account | BG-002 | bg_accounts | id, name, type, current_balance, currency, archived, sort_order, created_at, updated_at |
| Transaction | BG-003 | bg_transactions | id, envelope_id, account_id, amount, direction, merchant, note, occurred_on, created_at, updated_at |
| TransactionSplit | BG-003 | bg_transaction_splits | id, transaction_id, envelope_id, amount, memo |
| CategoryGroup | BG-006 | bg_category_groups | id, name, sort_order, is_collapsed, created_at, updated_at |
| BudgetAllocation | BG-004 | bg_budget_allocations | id, category_id, month, amount, created_at, updated_at |
| BudgetRollover | BG-005 | bg_budget_rollovers | id, category_id, from_month, to_month, amount, created_at |
| Goal | BG-007 | bg_goals | id, envelope_id, name, target_amount, target_date, completed_amount, is_completed, created_at, updated_at |
| Subscription | BG-008 | bg_subscriptions | id, name, price, currency, billing_cycle, custom_days, status, start_date, next_renewal, trial_end_date, cancelled_date, notes, url, icon, color, notify_days, catalog_id, sort_order, created_at, updated_at |
| RecurringTemplate | BG-010 | bg_recurring_templates | id, merchant, amount, direction, envelope_id, account_id, frequency, custom_days, anchor_day, start_date, end_date, auto_create, is_active, last_created, created_at, updated_at |
| BankConnection | BG-011 | bg_bank_connections | id, provider, institution_name, institution_id, access_token_encrypted, status, last_sync_at, error_message, created_at, updated_at |
| BankAccount | BG-011 | bg_bank_accounts | id, connection_id, provider_account_id, local_account_id, name, type, balance, currency, created_at, updated_at |
| BankTransactionRaw | BG-011 | bg_bank_transactions_raw | id, bank_account_id, provider_transaction_id, amount, date, name, pending, category, local_transaction_id, created_at |
| BankSyncState | BG-011 | bg_bank_sync_state | id, connection_id, cursor, last_sync_at, created_at, updated_at |
| BankWebhookEvent | BG-011 | bg_bank_webhook_events | id, provider, event_type, payload, status, idempotency_key, received_at, processed_at |
| TransactionRule | BG-014 | bg_transaction_rules | id, name, conditions, actions, priority, is_active, match_count, created_at, updated_at |
| BudgetAlert | BG-017 | bg_budget_alerts | id, category_id, threshold_pct, is_enabled, created_at |
| AlertHistory | BG-017 | bg_alert_history | id, alert_id, month, fired_at, spent_pct |
| NetWorthSnapshot | BG-019 | bg_net_worth_snapshots | id, month, total_assets, total_liabilities, net_worth, account_breakdown, captured_at |
| DebtPayoffPlan | BG-020 | bg_debt_payoff_plans | id, name, strategy, monthly_budget, created_at, updated_at |
| DebtPayoffDebt | BG-020 | bg_debt_payoff_debts | id, plan_id, name, balance, interest_rate_bps, minimum_payment, account_id, sort_order |
| Currency | BG-021 | bg_currencies | code, name, symbol, decimal_places |
| ExchangeRate | BG-021 | bg_exchange_rates | id, from_currency, to_currency, rate, fetched_at |
| InvestmentHolding | BG-022 | bg_investment_holdings | id, ticker, name, shares, cost_basis_per_share, current_price, price_updated_at, asset_class, created_at, updated_at |
| SplitContact | BG-023 | bg_split_contacts | id, name, phone, email, running_balance, created_at |
| SplitRecord | BG-023 | bg_split_records | id, transaction_id, contact_id, total_amount, your_share, their_share, who_paid, description, split_date, is_settled, created_at |
| CsvProfile | BG-013 | bg_csv_profiles | id, name, column_mapping, date_format, delimiter, has_header, created_at |
| Setting | BG-031 | bg_settings | key, value |
| SharedEnvelope | BG-032 | bg_shared_envelopes | id, envelope_id, partner_name, partner_device_id, sync_token, last_synced_at, created_at |
| PayeeCache | BG-003 | bg_payee_cache | id, name, count, last_envelope_id |

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| Envelope -> Transaction | one-to-many | An envelope has many transactions categorized to it |
| Envelope -> BudgetAllocation | one-to-many | An envelope has monthly budget allocations |
| Envelope -> Goal | one-to-many | An envelope can have savings goals attached |
| Envelope -> BudgetAlert | one-to-many | An envelope can have alert configurations |
| Envelope -> BudgetRollover | one-to-many | An envelope generates rollover records at month boundaries |
| Envelope -> SharedEnvelope | one-to-one | An envelope can optionally be shared |
| CategoryGroup -> Envelope | one-to-many | A group contains multiple envelopes |
| Account -> Transaction | one-to-many | An account has many transactions flowing through it |
| Account -> BankAccount | one-to-many | A local account can map to bank-synced accounts |
| Transaction -> TransactionSplit | one-to-many | A transaction can be split across envelopes |
| Transaction -> SplitRecord | one-to-many | A transaction can be shared/split with contacts |
| BankConnection -> BankAccount | one-to-many | A connection has multiple bank accounts |
| BankConnection -> BankSyncState | one-to-one | A connection has sync state |
| BankAccount -> BankTransactionRaw | one-to-many | A bank account has many raw transactions |
| BudgetAlert -> AlertHistory | one-to-many | An alert config has a history of firings |
| DebtPayoffPlan -> DebtPayoffDebt | one-to-many | A plan contains multiple debts |
| SplitContact -> SplitRecord | one-to-many | A contact has many split records |

### 4.4 Indexes

| Entity | Index | Fields | Reason |
|--------|-------|--------|--------|
| Envelope | idx_env_active | archived, sort_order | Active envelope list query |
| Transaction | idx_txn_date | occurred_on DESC | Default sort order |
| Transaction | idx_txn_envelope | envelope_id, occurred_on | Envelope spending queries |
| Transaction | idx_txn_account | account_id, occurred_on | Account transaction listing |
| Transaction | idx_txn_merchant | merchant | Payee search and grouping |
| BudgetAllocation | idx_alloc_unique | month, category_id (UNIQUE) | One allocation per envelope per month |
| BudgetRollover | idx_rollover_unique | to_month, category_id (UNIQUE) | One rollover per envelope per transition |
| Subscription | idx_sub_renewal | status, next_renewal | Active subscriptions by renewal date |
| NetWorthSnapshot | idx_nw_month | month (UNIQUE) | One snapshot per month |
| ExchangeRate | idx_rate_lookup | from_currency, to_currency, fetched_at DESC | Latest rate lookup |
| BankTransactionRaw | idx_bank_txn_provider | provider_transaction_id | Deduplication |
| Goal | idx_goal_envelope | envelope_id | Goals by envelope |
| AlertHistory | idx_alert_month | alert_id, month | Deduplication check |

### 4.5 Table Prefix

**MyLife hub table prefix:** `bg_`

All table names in the SQLite database are prefixed with `bg_` to avoid collisions with other modules in the MyLife hub. Example: the `envelopes` table becomes `bg_envelopes`.

### 4.6 Migration Strategy

- Tables are created on module enable via the ModuleDefinition migrations array
- Hub module currently at schema version 3; standalone at schema version 4
- Each migration is idempotent (uses CREATE TABLE IF NOT EXISTS)
- Data from the standalone MyBudget app can be imported via the data importer in `@mylife/migration`
- Destructive migrations (column removal) are deferred to major version bumps only
- New tables added in future versions are added as new migration entries

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Budget | Dollar sign in circle | Budget Month View | Envelope list with monthly allocations, spending, and available amounts |
| Transactions | Arrows up/down | Transaction List | Chronological list of all transactions with search and filter |
| Subscriptions | Refresh arrows | Subscription List | Tracked subscriptions with cost summary and renewal dates |
| Reports | Bar chart | Reports Dashboard | Spending charts, income vs expense, budgeted vs spent, top payees |
| Accounts | Building columns | Account List | Financial accounts with balances and net position |

### 5.2 Navigation Flow

```
[Tab 1: Budget]
  ├── Month Navigation (left/right arrows)
  ├── Envelope Detail
  │     ├── Edit Envelope
  │     └── Transaction List (filtered to this envelope)
  ├── Goals List
  │     ├── Goal Detail
  │     └── Add/Edit Goal
  ├── Upcoming Transactions
  └── Add Envelope

[Tab 2: Transactions]
  ├── Add Transaction
  │     ├── Split Editor
  │     └── Recurring Template Toggle
  ├── Transaction Detail/Edit
  ├── Scan Receipt
  ├── Recurring Templates List
  │     └── Add/Edit Template
  ├── Transaction Rules
  │     └── Add/Edit Rule
  ├── Expense Splits
  │     ├── Contact Split History
  │     └── Add Split
  └── Import CSV

[Tab 3: Subscriptions]
  ├── Add Subscription (Catalog Browser)
  ├── Subscription Detail
  │     ├── Edit Subscription
  │     └── Cancellation Assist
  ├── Renewal Calendar
  └── Detected Subscriptions (if bank sync active)

[Tab 4: Reports]
  ├── Spending by Category (detail)
  ├── Income vs Expense (detail)
  ├── Budgeted vs Spent (detail)
  ├── Top Payees (detail)
  ├── Net Worth
  ├── Age of Money
  ├── Debt Payoff Planner
  │     ├── Add/Edit Debt
  │     └── Amortization Schedule
  └── Loan Calculator

[Tab 5: Accounts]
  ├── Account Detail (filtered transactions)
  ├── Add/Edit Account
  ├── Connect Bank (Plaid)
  ├── Investment Portfolio
  │     └── Add/Edit Holding
  └── Net Worth Timeline
```

### 5.3 Screen Inventory

| Screen | Route/Path | Purpose | Entry Points |
|--------|-----------|---------|-------------|
| Budget Month View | `/budget` | Monthly envelope budget overview | Tab 1, app launch |
| Envelope Detail | `/budget/envelope/:id` | Single envelope transactions and history | Tap envelope row |
| Add/Edit Envelope | `/budget/envelope/edit` | Create or modify envelope | FAB or context menu |
| Goals List | `/budget/goals` | All savings goals | Budget tab nav button |
| Goal Detail | `/budget/goals/:id` | Single goal progress and projections | Tap goal row |
| Upcoming Transactions | `/budget/upcoming` | Projected future transactions | Budget tab button |
| Transaction List | `/transactions` | All transactions with filters | Tab 2 |
| Add/Edit Transaction | `/transactions/add` | Create or modify transaction | FAB |
| Scan Receipt | `/transactions/scan` | Camera receipt OCR | Add transaction screen |
| Transaction Rules | `/transactions/rules` | Manage auto-categorization rules | Overflow menu |
| Recurring Templates | `/transactions/recurring` | Manage recurring transaction templates | Overflow menu |
| Expense Splits | `/transactions/splits` | Split expense management | Overflow menu |
| Import CSV | `/transactions/import` | CSV file import | Overflow menu |
| Subscription List | `/subscriptions` | All tracked subscriptions with costs | Tab 3 |
| Add Subscription | `/subscriptions/add` | Browse catalog and add subscription | Add button |
| Subscription Detail | `/subscriptions/:id` | Single subscription with cancellation | Tap subscription row |
| Renewal Calendar | `/subscriptions/calendar` | Visual calendar of renewal dates | Calendar icon |
| Reports Dashboard | `/reports` | Analytics overview | Tab 4 |
| Spending by Category | `/reports/spending` | Category spending breakdown | Tap report card |
| Income vs Expense | `/reports/income-vs-expense` | Monthly income and expense comparison | Tap report card |
| Net Worth | `/reports/net-worth` | Net worth chart and breakdown | Tap report card |
| Debt Payoff Planner | `/reports/debt-payoff` | Debt elimination strategy | Reports dashboard |
| Loan Calculator | `/reports/loan-calculator` | Loan amortization calculator | Reports dashboard |
| Account List | `/accounts` | All accounts with balances | Tab 5 |
| Account Detail | `/accounts/:id` | Account transactions | Tap account row |
| Connect Bank | `/accounts/connect` | Plaid bank connection | Add button |
| Investment Portfolio | `/accounts/investments` | Investment holdings | Accounts tab |
| Settings | `/settings` | App configuration | Overflow menu or profile |
| Onboarding | `/onboarding` | First-launch setup | First app launch |

### 5.4 Deep Link Patterns

| Pattern | Target | Parameters |
|---------|--------|-----------|
| `mylife://budget` | Budget Month View | None |
| `mylife://budget/envelope/:id` | Envelope Detail | id: envelope UUID |
| `mylife://transactions/add` | Add Transaction | None |
| `mylife://subscriptions/:id` | Subscription Detail | id: subscription UUID |
| `mylife://reports/net-worth` | Net Worth | None |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| Grocery spending analysis | Budget | Recipes | Budget sends grocery envelope spending total for the period | On recipe meal plan view |
| Spending habit tracking | Budget | Habits | Budget reports "no impulse purchases today" status | On habit check-in |
| Auto-categorize fuel and maintenance | Budget | Car | Budget auto-tags fuel/maintenance transactions when MyCar is enabled | On transaction create with fuel/auto merchant |
| Fuel cost to cost-per-mile | Budget | Car | Budget provides fuel transaction totals for MyCar's cost calculations | On MyCar dashboard load |

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| All budget data (envelopes, transactions, accounts, etc.) | Local SQLite | At rest (OS-level full-disk encryption) | No | Never leaves device |
| Bank access tokens | Device Keychain (iOS) / Keystore (Android) | Yes (hardware-backed) | No | Encrypted at application level |
| Receipt images | Local file system | At rest (OS-level) | No | Stored on-device only |
| ML categorization model | Local file system | No | No | Trained and runs locally |
| Exchange rate cache | Local SQLite | No | No | Only currency pair sent to API |
| User preferences | Local SQLite | No | No | Settings and configuration |

### 7.2 Network Activity

| Activity | Purpose | Data Sent | Data Received | User Consent |
|----------|---------|-----------|--------------|-------------|
| Bank sync (Plaid) | Import transactions | Plaid link token (via server) | Account and transaction data | Explicit opt-in (user initiates connection) |
| Exchange rate lookup | Convert currencies | Currency pair (e.g., "EUR/USD") | Exchange rate number | Implicit (user enters foreign currency) |
| Investment price lookup | Update portfolio values | Ticker symbol (e.g., "AAPL") | Current price | Implicit (user adds holding) |

All network activity is optional. The app functions fully offline with manual-only mode.

### 7.3 Data That Never Leaves the Device

- Transaction history (amounts, merchants, dates, categories)
- Account balances and names
- Budget allocations and spending patterns
- Subscription details and costs
- Savings goals and progress
- Net worth and financial health metrics
- Receipt images
- Categorization patterns and ML model
- Debt details and payoff plans
- Expense splitting records
- Personal notes and memos

### 7.4 User Data Ownership

- **Export:** Users can export all data in CSV and JSON formats (BG-029)
- **Delete:** Users can delete all module data from Settings with triple confirmation (BG-031)
- **Portability:** Export formats are documented, human-readable, and compatible with common spreadsheet tools
- **No lock-in:** Data can be imported into any tool that accepts CSV

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| Bank token encryption | Plaid access tokens stored in hardware-backed secure storage | Keychain (iOS), Keystore (Android) |
| Webhook signature verification | Plaid webhooks verified using signature validation | Prevents spoofed webhook events |
| Rate limiting | Bank sync: max 30 requests/hour, 5-min cooldown per connection | Prevents abuse |
| Idempotency | Webhook events deduplicated by idempotency key with TTL | Prevents double-processing |
| Sensitive data display | Financial amounts visible by default (no masking for MVP) | Future: optional app lock |
| Audit logging | Bank sync operations logged with timestamps | Debugging and accountability |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| Envelope | A budget category that holds a monthly allocation of money. Named after the physical envelope budgeting method where cash is divided into labeled envelopes. |
| Zero-Based Budgeting | A methodology where every dollar of income is assigned to a specific envelope until "Ready to Assign" reaches zero. Every dollar has a job. |
| Ready to Assign | The amount of income that has not yet been allocated to any envelope. Should be zero in a fully budgeted month. |
| Carry-Forward | The available balance from a previous month that rolls into the current month for a given envelope. |
| Rollover | The process of carrying an envelope's remaining balance (positive or negative) to the next month. |
| Activity | The sum of all transaction amounts for an envelope in a given month. Outflows are negative, inflows are positive. |
| Available | The spendable balance in an envelope: carry-forward + allocated + activity. |
| Allocation | The amount of money budgeted to an envelope for a specific month. |
| Category Group | A container for organizing related envelopes (e.g., "Fixed Expenses", "Variable Expenses"). |
| Billing Cycle | How often a subscription charges: weekly, monthly, quarterly, semi-annually, annually, or custom. |
| Basis Points | A unit for interest rates where 100 basis points = 1.00%. Used for integer-precision rate storage (1899 bps = 18.99% APR). |
| RATE_PRECISION | The integer multiplier (1,000,000) used to store exchange rates without floating-point. A rate of 1.082345 is stored as 1082345. |
| Snowball | A debt payoff strategy that targets the smallest balance first for quick psychological wins. |
| Avalanche | A debt payoff strategy that targets the highest interest rate first to minimize total interest paid. |
| Payee Cache | A local cache of merchant names the user has entered, used for autocomplete suggestions. |
| Age of Money | A metric measuring the average number of days money sits in accounts before being spent. Higher is better. |
| Net Worth | Total assets minus total liabilities. A single number representing overall financial health. |
| Plaid | A financial data aggregation service that connects to banks for automated transaction import. |
| Millishares | The unit for storing fractional share counts (1000 millishares = 1 share). Avoids floating-point for investment tracking. |
| FIFO | First-In, First-Out. The queuing method used to calculate Age of Money: the oldest dollar is "spent" first. |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | spec-mybudget | Initial specification covering 32 features (18 implemented, 14 planned) |

---

## Appendix B: Open Questions

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | Should investment price lookups use Yahoo Finance or Alpha Vantage? | BG-022 requires a free stock price API. Yahoo has broader coverage but less stable API. Alpha Vantage has rate limits on free tier. | TBD | - |
| 2 | What peer-to-peer sync mechanism should partner sharing use? | BG-032 needs a way for two devices to exchange data without cloud infrastructure. Options: Bluetooth, local WiFi, QR code exchange, or iCloud Private Relay. | TBD | - |
| 3 | Should receipt images be stored as full resolution or compressed? | BG-024 receipt images could consume significant storage. Need to balance readability with storage limits. | TBD | - |
| 4 | What ML framework for on-device categorization? | BG-025 needs a lightweight classifier. Options: Core ML (iOS only), TensorFlow Lite (cross-platform), or custom Naive Bayes implementation. | TBD | - |
| 5 | Should the loan calculator save scenarios persistently? | BG-028 could be stateless (pure calculator) or persist saved scenarios for comparison. | TBD | - |


