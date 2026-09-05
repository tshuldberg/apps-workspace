# Feature Spec: RSVP Expense Splitting

## Metadata
- **Module:** rsvp
- **Priority Score:** 31 / 50 (A-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 4 x3 + Complexity 2 x2 + CrossModule 3 x1 + PaidUser 3 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Event CRUD (built), RSVP system (built)
- **Blocks:** Event budget tracker (RS-023, P2)

## Business Context

### Why This Feature Exists
After an event, the awkward "who owes whom" conversation kills the social vibe. Hosts track expenses on Venmo request threads, group texts, or spreadsheets. Partiful is the only major event platform with built-in expense splitting, and it is their top differentiator for younger users (20-35). Adding this to MyRSVP closes a key competitive gap and creates a cross-module synergy with MyBudget that no competitor can match: split an event expense and it automatically appears in your budget.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Partiful | Yes | Free | In-app expense logging, equal/custom split, Venmo/Zelle payment links |
| Evite | No | N/A | Only has "chip in" links (external payment) |
| RSVPify | No | N/A | No expense tracking |
| Splitwise | Yes (standalone) | Freemium | Dedicated expense splitting app, complex group balances, payment integrations |

### Target User
Social hosts (25-40) who organize dinners, game nights, and group trips where costs are shared. Currently these users open Splitwise or Venmo after the event to settle up. By embedding expense splitting directly in the event context, settlement happens while the event is fresh and the guest list is already defined.

## Technical Context

### Where This Lives in MyLife

```
modules/rsvp/src/db/schema.ts              -- V2 migration: rv_expenses, rv_expense_splits tables
modules/rsvp/src/definition.ts             -- Add tables to RSVP_MIGRATION_V2
modules/rsvp/src/types.ts                  -- EventExpense, ExpenseSplit, SplitType, Settlement types
modules/rsvp/src/db/crud.ts                -- Expense CRUD, split CRUD, settlement marking
modules/rsvp/src/engine/settlement.ts      -- Pure functions: equal split, settlement minimization
modules/rsvp/src/index.ts                  -- Re-export expense/settlement API
modules/rsvp/src/__tests__/settlement.test.ts  -- Settlement algorithm tests
apps/mobile/app/(rsvp)/expenses.tsx        -- Expense list + settlement screen
apps/mobile/app/(rsvp)/components/AddExpenseSheet.tsx  -- Add expense bottom sheet
apps/web/app/rsvp/[eventId]/expenses/page.tsx  -- Web expenses page
```

### Wireframe Position

```
Hub Dashboard
  └── MyRSVP card
       └── Events tab
            └── Event Detail
                 └── "Expenses" button
                      └── Expense List + Settlements ← YOU ARE HERE
```

### Data Model

```sql
-- V2 Migration: Add expense splitting tables

CREATE TABLE IF NOT EXISTS rv_expenses (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  paid_by_name TEXT NOT NULL,
  split_type TEXT NOT NULL DEFAULT 'equal',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rv_expense_splits (
  id TEXT PRIMARY KEY,
  expense_id TEXT NOT NULL REFERENCES rv_expenses(id) ON DELETE CASCADE,
  participant_name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  is_settled INTEGER NOT NULL DEFAULT 0,
  settled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS rv_expenses_event_idx ON rv_expenses(event_id);
CREATE INDEX IF NOT EXISTS rv_expense_splits_expense_idx ON rv_expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS rv_expense_splits_settled_idx ON rv_expense_splits(is_settled);
```

**Note:** Amounts stored in cents (INTEGER) to avoid floating-point precision issues. Display converts to dollars with 2 decimal places.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/ui` (Cool Obsidian tokens)
- **External:** None (no payment processing -- settlement is manual "mark as paid")
- **Cross-Module:** MyBudget integration. When both modules are enabled, settling an expense can optionally create a budget transaction in the "Entertainment" or "Social" envelope. Uses `@mylife/module-registry` to check if budget module is enabled.

## Functional Requirements

### User Stories
1. As a host, I want to log an event expense (e.g., "Pizza $80") and split it equally among all going guests.
2. As a host, I want to assign custom amounts per person when the split is not equal.
3. As a host, I want to assign an expense to specific people (itemized split) rather than everyone.
4. As a host, I want to see who owes whom and how much, calculated as the minimum number of transactions.
5. As a host, I want to mark debts as settled when someone pays me.
6. As a guest, I want to see what I owe and to whom.

### Behavior Specification

**Adding an expense:**
1. User navigates to event detail and taps "Expenses"
2. User taps "Add Expense" FAB
3. System opens Add Expense bottom sheet with fields:
   - Description (text, required, max 200 chars)
   - Amount (currency input, required, min $0.01)
   - Paid By (dropdown of all going/maybe RSVPs + host name, required)
   - Split Type (segmented control: Equal / Custom / Itemized)
4. **Equal:** System auto-calculates per-person share. Shows list of participants with amounts. Penny rounding applied to first participant.
5. **Custom:** System shows list of participants with editable amount fields. Total must equal expense amount. Inline validation if sum != total.
6. **Itemized:** System shows checkboxes for each participant. Checked participants split equally among themselves.
7. User taps "Save"
8. System creates `rv_expenses` record and `rv_expense_splits` records for each participant
9. Settlement section recalculates

**Viewing settlements:**
1. Below the expense list, a "Settlements" section shows calculated debts
2. Each settlement row: "[Debtor] owes [Creditor] $[amount]" with "Mark Settled" button
3. Settlement algorithm minimizes transactions (greedy algorithm on net balances)
4. If all debts settled: green banner "All settled!"

**Marking as settled:**
1. Host taps "Mark Settled" on a settlement row
2. System marks all relevant `rv_expense_splits` as settled with current timestamp
3. Row updates to show "Settled" with checkmark and timestamp
4. "Undo" available for 5 seconds

### Edge Cases
- **No going RSVPs:** Show message "No confirmed guests to split with. Add guests first."
- **$100 split among 3:** Shares are $33.34, $33.33, $33.33 (penny rounding to first participant)
- **All paid equally:** Settlement section shows "All settled!" with no transactions
- **One person paid everything:** Everyone else pays that person their share
- **Custom split amounts don't sum to total:** Inline validation: "Amounts must add up to $[total]. Currently $[sum]."
- **Zero or negative amount:** Reject with "Amount must be greater than $0"
- **Empty description:** Reject with "Description is required"
- **Event deleted:** CASCADE deletes all expenses and splits
- **RSVP changes after expenses logged:** Expenses remain tied to participant names (not RSVP IDs). Participant list for new expenses uses current RSVPs.
- **Same person pays and owes:** Net balance calculation handles this (they owe less or are owed less)
- **Very large group (50+ people):** Performance target: settlement calculation < 50ms

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can add an expense with description, amount, payer, and split type
- [ ] **AC-2:** Equal split divides amount evenly with correct penny rounding
- [ ] **AC-3:** Custom split shows editable per-person amounts that must sum to total
- [ ] **AC-4:** Itemized split assigns expense to selected subset of participants
- [ ] **AC-5:** Settlement section shows minimum transactions needed to settle all debts
- [ ] **AC-6:** "Mark Settled" button marks a debt as paid with timestamp
- [ ] **AC-7:** "All settled!" banner appears when all debts are resolved
- [ ] **AC-8:** Expense list shows running total and per-person average
- [ ] **AC-9:** User can delete an expense via swipe-left (mobile) or delete button (web)
- [ ] **AC-10:** User can edit an existing expense (description, amount, split)

### Technical Criteria
- [ ] **TC-1:** V2 migration creates rv_expenses and rv_expense_splits tables with correct indexes
- [ ] **TC-2:** Amounts stored in cents (INTEGER) to avoid floating-point rounding
- [ ] **TC-3:** Settlement minimization algorithm produces correct minimum transactions for 2, 3, 4, and 5+ participant scenarios
- [ ] **TC-4:** Penny rounding distributes remainder to first participant (deterministic)
- [ ] **TC-5:** Settlement calculation completes in < 50ms for 50 participants
- [ ] **TC-6:** Custom split validation rejects if sum != total (tolerance: 0 cents)
- [ ] **TC-7:** Cross-module integration with MyBudget creates budget transaction when both modules enabled

### Negative Criteria
- [ ] **NC-1:** Expense splitting must NOT require network access (local-only)
- [ ] **NC-2:** Deleting an event must NOT leave orphaned expense or split records (CASCADE)
- [ ] **NC-3:** Settlement must NOT produce negative transaction amounts
- [ ] **NC-4:** Editing an expense must NOT create duplicate split records (delete + recreate)
- [ ] **NC-5:** Expense data must NOT be visible to guests (host-only view)

## UI Specification

### Mobile (Expo)
- **Background:** `#0A0A0F` (background)
- **Expense cards:** Glass token with module accent `#FB7185` left border
- **Settlement rows:** `rgba(255,255,255,0.04)` background, green checkmark for settled items
- **"All settled!" banner:** `rgba(48,209,88,0.12)` background with `#30D158` text
- **Add Expense FAB:** Circle with "+" icon, `#FB7185` background
- **Split type segmented control:** 3 segments with glass styling

### Web (Next.js)
- Same tokens via CSS variables
- Expenses accessible at `/rsvp/[eventId]/expenses`
- Add Expense uses modal dialog instead of bottom sheet
- Settlement section uses glass cards with checkmark icons

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton expense cards | Initial fetch |
| Empty | "No expenses yet" with "Add Expense" CTA | No expenses for event |
| Has Expenses | Expense list + settlement section | Expenses exist |
| All Settled | Expense list + green "All settled!" banner | All splits marked settled |
| Error | Toast: "Could not load expenses" | Database read fails |

## Test Requirements

### Unit Tests (engine/settlement.ts)
- [ ] `calculateEqualSplit`: $100 / 3 = [$33.34, $33.33, $33.33]
- [ ] `calculateEqualSplit`: $100 / 2 = [$50.00, $50.00]
- [ ] `calculateEqualSplit`: $100 / 1 = [$100.00]
- [ ] `calculateEqualSplit`: $10 / 3 = [$3.34, $3.33, $3.33]
- [ ] `calculateSettlements`: Alice paid $120, Bob $60, Carol $0 at $60/each -> Carol pays Alice $60
- [ ] `calculateSettlements`: All paid equally -> empty settlement list
- [ ] `calculateSettlements`: One person paid everything -> N-1 transactions
- [ ] `calculateSettlements`: Complex 5-person scenario produces minimum transactions
- [ ] `validateCustomSplit`: amounts sum to total -> passes
- [ ] `validateCustomSplit`: amounts sum to $90 for $100 expense -> fails with message
- [ ] `validateCustomSplit`: negative amount -> fails
- [ ] `calculateSettlements`: handles fractional cents (rounds to nearest cent)

### Integration Tests
- [ ] Create expense with equal split -> verify rv_expense_splits records match calculated amounts
- [ ] Create expense with custom split -> verify all splits stored correctly
- [ ] Create expense with itemized split -> verify only selected participants have splits
- [ ] Mark settlement as settled -> verify is_settled=1 and settled_at set
- [ ] Delete expense -> verify splits cascade deleted
- [ ] Delete event -> verify all expenses and splits cascade deleted
- [ ] V2 migration runs cleanly on existing V1 database

### QA Verification Script

1. Open MyRSVP, navigate to an event with 4 going guests (Alice, Bob, Carol, Dave)
2. Tap "Expenses" button on event detail
3. **Verify:** Empty state shows "No expenses yet" with "Add Expense" button -- AC-8
4. Tap "Add Expense"
5. Enter: Description "Pizza", Amount "$80", Paid By "Alice", Split Type "Equal"
6. **Verify:** Per-person amounts shown: $20.00 each -- AC-2
7. Tap Save
8. **Verify:** Expense card appears with "Pizza - $80 (paid by Alice)" -- AC-1
9. **Verify:** Settlement shows: "Bob owes Alice $20", "Carol owes Alice $20", "Dave owes Alice $20" -- AC-5
10. Add another expense: "Drinks $30", Paid By "Bob", Split "Equal"
11. **Verify:** Settlements recalculate with minimized transactions -- AC-5
12. Tap "Mark Settled" on first settlement row
13. **Verify:** Row shows "Settled" with checkmark and timestamp -- AC-6
14. Add expense: "Dessert $15", Paid By "Carol", Split "Custom"
15. Enter custom amounts: Alice $5, Bob $5, Dave $5
16. **Verify:** Custom amounts accepted and saved -- AC-3
17. Try custom amounts that sum to $12 for a $15 expense
18. **Verify:** Validation error "Amounts must add up to $15.00. Currently $12.00" -- TC-6
19. Add expense: "Uber $25", Paid By "Alice", Split "Itemized", select Alice and Bob only
20. **Verify:** Only Alice and Bob appear in splits, $12.50 each -- AC-4
21. Swipe left on "Pizza" expense, tap Delete
22. **Verify:** Expense removed, settlements recalculate -- AC-9
23. Mark all remaining settlements as settled
24. **Verify:** "All settled!" banner appears -- AC-7
25. Create an event with no going RSVPs, try to add expense
26. **Verify:** "No confirmed guests to split with" message shown

## gstack Quality Gates

Based on Complexity Inverse score of 2 (Large):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required for Large features (Complexity <= 2):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building

### Required if this feature has UI:
- [ ] `/browse` -- navigate to expenses page, test all split types, verify all states
- [ ] Batch QA: after 5 features in RSVP module, run `/qa`

### Required for business logic engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for settlement algorithm

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- rv_events with full event lifecycle (create, invite, RSVP, polls, photos, check-in)
- `allow_chip_in` and `chip_in_url` fields exist on events for external payment links
- No expense tracking, no split calculation, no settlement tracking

### After This Work
- V2 migration adds rv_expenses and rv_expense_splits tables
- Pure engine: `calculateEqualSplit()`, `calculateSettlements()`, `validateCustomSplit()`
- Full CRUD: createExpense, listExpensesByEvent, updateExpense, deleteExpense, markSplitSettled
- Mobile screen with expense list, settlement section, add/edit expense sheet
- Web page at `/rsvp/[eventId]/expenses`
- Optional MyBudget cross-module integration
- 12+ unit tests, 7+ integration tests

### Files Changed
- `modules/rsvp/src/db/schema.ts` -- V2 tables and indexes
- `modules/rsvp/src/definition.ts` -- Add RSVP_MIGRATION_V2
- `modules/rsvp/src/types.ts` -- EventExpense, ExpenseSplit, SplitType, Settlement types
- `modules/rsvp/src/db/crud.ts` -- Expense and split CRUD
- `modules/rsvp/src/engine/settlement.ts` -- Split calculation and settlement minimization
- `modules/rsvp/src/index.ts` -- Re-export expense/settlement API
- `modules/rsvp/src/__tests__/settlement.test.ts` -- Algorithm tests
- `apps/mobile/app/(rsvp)/expenses.tsx` -- Expense list screen
- `apps/mobile/app/(rsvp)/components/AddExpenseSheet.tsx` -- Add expense form
- `apps/web/app/rsvp/[eventId]/expenses/page.tsx` -- Web expenses page

### Known Limitations
- No payment processing integration (Venmo, Zelle, etc.) -- settlement is manual "mark as paid"
- No currency selection -- amounts displayed in user's locale currency format but stored as cents
- No receipt photo attachment on expenses
- Settlement algorithm is greedy (O(n log n)), not optimal minimum transactions (NP-hard), but produces near-optimal results for typical group sizes (<20 people)
- Cross-module MyBudget integration is optional and one-directional (RSVP -> Budget)

### Context for Next Agent
- Store amounts in cents (INTEGER) everywhere. Never use floating-point for money. Display formatting should convert cents to dollars: `(amountCents / 100).toFixed(2)`.
- The settlement algorithm should use the greedy approach from the SPEC: sort creditors descending and debtors ascending, match largest debtor with largest creditor, settle minimum of both, repeat. This produces optimal results for <= 3 people and near-optimal for larger groups.
- The `rv_expense_splits.participant_name` is a string, not a foreign key to rv_rsvps. This is intentional because RSVP records may change but expense records should remain stable. Match participants by name.
- V2 migration shares a version number with calendar sync. Both features' DDL should be combined into a single RSVP_MIGRATION_V2 if built in the same sprint.
