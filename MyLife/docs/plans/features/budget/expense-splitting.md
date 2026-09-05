# Feature Spec: Expense Splitting

## Metadata
- **Module:** budget
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 2 x3 + Complexity 3 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** Sprint 3+
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (transaction splits and shared envelopes already exist)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Rocket Money and PocketGuard both offer expense splitting for shared bills and group expenses. Users frequently split costs with roommates, friends, or partners for rent, utilities, dinners, and trips. Currently, MyLife has transaction splits (splitting one transaction across multiple envelopes) but no people-based splitting for tracking who owes whom. This feature adds Splitwise-like functionality directly in the budgeting app, eliminating the need for a separate expense-splitting app.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Rocket Money | Yes | Yes ($48-144/yr) | Bill splitting for couples. Track shared expenses. Settlement tracking. |
| PocketGuard | Yes | Yes ($74.99/yr) | Split expenses with friends. Running balance per person. |
| Splitwise | Yes (standalone) | Freemium | Dedicated expense splitting. Groups, equal/unequal splits, settle up. Industry standard. |
| YNAB | No | N/A | No built-in splitting. Users track manually. |
| Monarch Money | No | N/A | No expense splitting. |
| Copilot | No | N/A | No expense splitting. |

### Target User
Roommates splitting rent/utilities, couples who track shared expenses, friends splitting dinner/travel costs. Migration path: Splitwise user who also budgets in YNAB/Monarch -- now both in one app. Reduces app switching and manual reconciliation.

## Technical Context

### Where This Lives in MyLife

```
modules/budget/src/
  splitting/
    split-engine.ts              -- NEW: Splitting logic (equal, unequal, percentage, shares)
    balance-tracker.ts           -- NEW: Running balance per contact (who owes whom)
    settlement.ts                -- NEW: Settlement tracking and suggestions
    types.ts                     -- NEW: Split, Contact, Balance, Settlement types
    index.ts                     -- NEW: Barrel export
  db/
    schema.ts                    -- MODIFY: V6 migration adds bg_contacts, bg_expense_splits, bg_settlements
    crud.ts                      -- MODIFY: Add splitting CRUD
  types.ts                       -- MODIFY: Add splitting schemas
  definition.ts                  -- MODIFY: V6 migration
  index.ts                       -- MODIFY: Export splitting types and engine
apps/mobile/app/(budget)/
  splits.tsx                     -- NEW: Split overview (balances per contact)
  split-detail.tsx               -- NEW: Individual split detail
  add-split.tsx                  -- NEW: Create expense split
  contacts.tsx                   -- NEW: Manage contacts for splitting
apps/web/app/budget/
  splits/page.tsx                -- NEW: Split overview page
  splits/[id]/page.tsx           -- NEW: Split detail page
  actions.ts                     -- MODIFY: Add splitting server actions
```

### Wireframe Position

```
Hub Dashboard
  └── MyBudget card
       ├── Budget tab
       ├── Transactions tab
       │    └── Transaction detail > "Split with..." button  ← SPLIT FROM TRANSACTION
       ├── Subscriptions tab
       ├── Reports tab
       ├── Accounts tab
       └── Splits (new tab or sub-section)                   ← OVERVIEW
            ├── Balance summary per contact
            ├── Recent splits
            └── Settle up
```

### Data Model

```sql
-- V6 migration: Expense splitting
CREATE TABLE IF NOT EXISTS bg_contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_emoji TEXT NOT NULL DEFAULT '👤',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bg_expense_splits (
  id TEXT PRIMARY KEY,
  transaction_id TEXT REFERENCES bg_transactions(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  total_amount INTEGER NOT NULL,       -- cents
  currency TEXT NOT NULL DEFAULT 'USD',
  split_type TEXT NOT NULL DEFAULT 'equal'
    CHECK (split_type IN ('equal', 'unequal', 'percentage', 'shares')),
  paid_by TEXT NOT NULL DEFAULT 'self',  -- 'self' or contact_id
  date TEXT NOT NULL,                  -- YYYY-MM-DD
  group_name TEXT,                     -- Optional group label (e.g., "Trip to Mexico")
  is_settled INTEGER NOT NULL DEFAULT 0 CHECK (is_settled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bg_split_participants (
  id TEXT PRIMARY KEY,
  split_id TEXT NOT NULL REFERENCES bg_expense_splits(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES bg_contacts(id) ON DELETE SET NULL,
  is_self INTEGER NOT NULL DEFAULT 0 CHECK (is_self IN (0, 1)),
  share_amount INTEGER NOT NULL,       -- cents: this person's share
  share_value REAL,                    -- For percentage (0.0-1.0) or shares (any positive number)
  is_paid INTEGER NOT NULL DEFAULT 0 CHECK (is_paid IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bg_settlements (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES bg_contacts(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,             -- cents: positive = they paid you, negative = you paid them
  transaction_id TEXT REFERENCES bg_transactions(id) ON DELETE SET NULL,
  note TEXT,
  settled_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS bg_contacts_name_idx ON bg_contacts(name);
CREATE INDEX IF NOT EXISTS bg_expense_splits_date_idx ON bg_expense_splits(date DESC);
CREATE INDEX IF NOT EXISTS bg_expense_splits_group_idx ON bg_expense_splits(group_name);
CREATE INDEX IF NOT EXISTS bg_expense_splits_settled_idx ON bg_expense_splits(is_settled);
CREATE INDEX IF NOT EXISTS bg_split_participants_split_idx ON bg_split_participants(split_id);
CREATE INDEX IF NOT EXISTS bg_split_participants_contact_idx ON bg_split_participants(contact_id);
CREATE INDEX IF NOT EXISTS bg_settlements_contact_idx ON bg_settlements(contact_id);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), existing transaction splits (`bg_transaction_splits` for envelope-based splits), transaction CRUD
- **External:** None. All on-device. No payment integration (settlement is tracking only).
- **Cross-Module:** `rsvp` module has its own expense splitting for events -- share the `bg_contacts` table or coordinate on contact ID format for future unification

## Functional Requirements

### User Stories
1. As a budget user, I want to split an expense with one or more contacts so I can track who owes what.
2. As a budget user, I want to see running balances per contact (who owes me, who I owe).
3. As a budget user, I want to split expenses equally, by exact amount, by percentage, or by shares.
4. As a budget user, I want to record when someone pays me back (settle up).
5. As a budget user, I want to group splits by occasion (e.g., "Ski Trip 2026").
6. As a budget user, I want to split directly from an existing transaction.

### Behavior Specification

1. User navigates to Splits section (new tab or sub-section)
2. Overview shows:
   a. Net balance summary: total owed to you, total you owe
   b. Per-contact balances: sorted by amount owed
   c. Recent splits list
3. User creates a new split:
   a. Enter description and total amount
   b. Select who paid (self or a contact)
   c. Add participants (contacts + self)
   d. Choose split type: equal / exact amounts / percentage / shares
   e. System calculates each person's share
   f. Optionally link to an existing transaction
4. Split appears in overview, balances update
5. From transaction detail, user can tap "Split with..." to create a split pre-filled with transaction amount and merchant
6. To settle up:
   a. User taps contact with a balance
   b. Taps "Settle Up"
   c. Enters amount received/paid
   d. Optionally links to a transfer transaction
   e. Balance adjusts
7. Group splits: user assigns a group name, can view all splits in that group

### Edge Cases

- Split with 0 participants: reject, require at least 2 (self + 1 contact)
- Unequal split that doesn't sum to total: show validation error, highlight difference
- Percentage split that doesn't sum to 100%: show validation error
- Contact deleted with outstanding balance: warn and block deletion; must settle first
- Transaction deleted after linking to split: split remains but transaction_id set to NULL
- Split settled partially (e.g., roommate pays half): record partial settlement, balance reflects remainder
- Very large group (10+ people): supported, UI scrolls participant list
- Self is not a participant: allowed (user paid but is not splitting, e.g., gift)
- Currency mismatch: splits use the transaction's currency, settlement in same currency
- Duplicate contact names: allowed, distinguished by id

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Splits overview shows net balance (owed to you / you owe)
- [ ] **AC-2:** Per-contact balance cards show name, avatar, and net amount
- [ ] **AC-3:** "Add Split" form captures description, amount, payer, participants, split type
- [ ] **AC-4:** Equal split auto-divides total evenly (rounding difference to payer)
- [ ] **AC-5:** Unequal split allows exact amounts with validation (sum = total)
- [ ] **AC-6:** Percentage split allows percentages with validation (sum = 100%)
- [ ] **AC-7:** Shares split divides proportionally (e.g., 2 shares vs 1 share)
- [ ] **AC-8:** "Split with..." from transaction detail pre-fills amount and description
- [ ] **AC-9:** "Settle Up" records payment and adjusts contact balance
- [ ] **AC-10:** Group label allows filtering splits by occasion
- [ ] **AC-11:** Contact management: add, edit, delete contacts

### Technical Criteria
- [ ] **TC-1:** All amounts stored as integer cents
- [ ] **TC-2:** Equal split rounding: remainder cent(s) go to payer's share
- [ ] **TC-3:** bg_contacts, bg_expense_splits, bg_split_participants, bg_settlements created in V6
- [ ] **TC-4:** Balance calculation: sum(splits where contact owes me) - sum(splits where I owe contact) - sum(settlements)
- [ ] **TC-5:** Split linked to transaction via bg_expense_splits.transaction_id
- [ ] **TC-6:** Balance calculation returns result in <50ms for 100 contacts
- [ ] **TC-7:** Participant share_amount always positive (direction determined by paid_by field)

### Negative Criteria
- [ ] **NC-1:** Expense splitting data must NOT be sent to any external service
- [ ] **NC-2:** Deleting a contact with outstanding balance must NOT be allowed
- [ ] **NC-3:** Settling up must NOT modify the original split record (creates new settlement)
- [ ] **NC-4:** Split participants must NOT have negative share amounts
- [ ] **NC-5:** Transaction deletion must NOT delete the linked split

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Contact balance cards: `rgba(255,255,255,0.04)` (glass token) with avatar emoji + name + net amount
- Module accent: `#22C55E` (budget green)
- Owed to you: `#30D158` (success green) text
- You owe: `#FF453A` (danger red) text
- Split type selector: segmented control (Equal / Exact / % / Shares)
- Participant rows: contact avatar + name + share amount (editable for non-equal splits)

### Web (Next.js)
- Same tokens via CSS variables
- Route: `/budget/splits` (overview), `/budget/splits/[id]` (detail)
- Two-column: contact balances left, split list right
- Add split: modal with participant picker

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards for balance list | Initial fetch |
| Empty | "No splits yet" + "Split an expense" CTA | No splits created |
| Error | "Could not load splits" + retry | DB error |
| Success | Balance summary, contact cards, recent splits | Data loaded |
| Partial | Some contacts settled (green checkmark), some outstanding | Mixed settlement state |

## Test Requirements

### Unit Tests
- [ ] `calculateEqualSplit`: $100 / 3 people = $33.34, $33.33, $33.33 (remainder to payer)
- [ ] `calculateEqualSplit`: $10 / 2 people = $5.00, $5.00 (even split)
- [ ] `calculatePercentageSplit`: validates sum = 100%, returns per-person amounts
- [ ] `calculateSharesSplit`: 2 shares + 1 share of $90 = $60 + $30
- [ ] `calculateBalance`: net owed/owing per contact from splits and settlements
- [ ] `calculateBalance`: returns 0 for fully settled contact
- [ ] `validateSplit`: rejects unequal amounts that don't sum to total
- [ ] `validateSplit`: rejects percentage that doesn't sum to 100%
- [ ] `validateSplit`: rejects splits with <2 participants
- [ ] Contact CRUD: create, read, update, delete (blocked if balance != 0)
- [ ] Split CRUD: create with participants, read, settle
- [ ] Settlement CRUD: create, read by contact

### Integration Tests
- [ ] Full flow: create contact -> create split -> verify balance -> settle up -> verify balance = 0
- [ ] Transaction link: create transaction -> split from transaction -> verify link
- [ ] Group flow: create 3 splits in group "Ski Trip" -> filter by group -> verify all 3 shown

### QA Verification Script

1. Open app on iOS simulator
2. Navigate to MyBudget > Splits
3. Verify: empty state with "Split an expense" CTA -- Empty state
4. Tap "Manage Contacts", add "Alex" and "Sam"
5. Verify: contacts created -- AC-11
6. Tap "Add Split"
7. Enter: "Dinner", $90, paid by self, participants: self + Alex + Sam, equal split
8. Verify: each person's share is $30.00 -- AC-3, AC-4
9. Save split
10. Verify: Alex owes $30, Sam owes $30 -- AC-1, AC-2
11. Create another split: "Uber", $20, paid by Alex, participants: self + Alex, equal
12. Verify: Alex balance updates to $20 owed (30 - 10 = 20) -- TC-4
13. Tap on Alex's balance card
14. Verify: split history for Alex shown
15. Tap "Settle Up" for Alex, enter $20 received
16. Verify: Alex balance goes to $0 -- AC-9
17. Go to Transactions tab, tap a transaction, tap "Split with..."
18. Verify: amount and description pre-filled -- AC-8
19. Create an unequal split: $100 total, self $60, Alex $40
20. Verify: amounts validated (sum = 100) -- AC-5
21. Try percentage split: self 50%, Alex 30%, Sam 20%
22. Verify: amounts calculated correctly -- AC-6
23. Try shares split: self 2 shares, Alex 1 share of $90
24. Verify: self $60, Alex $30 -- AC-7
25. Assign group "Trip" to a split
26. Filter by group "Trip"
27. Verify: only grouped splits shown -- AC-10
28. Try to delete Alex (has outstanding balance from Sam split)
29. Verify: deletion blocked -- NC-2
30. Open web at `/budget/splits`
31. Verify: same data renders

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to `/budget/splits`, test add/settle/group flows
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for split calculator and balance tracker

### Post-merge:
- [ ] `/parity-check` -- budget module has archived standalone

## Handoff State

### Before This Work
Budget module has transaction splits (`bg_transaction_splits`) for splitting amounts across envelopes, but no people-based expense splitting, no contact management, and no balance tracking.

### After This Work
Full expense splitting system: contacts management, split expenses with multiple split types (equal, unequal, percentage, shares), per-contact running balances, settlement tracking, group labels for occasions, transaction linking. Splitwise-like functionality embedded in the budgeting module.

### Files Changed
- `modules/budget/src/splitting/split-engine.ts` -- Split calculation engine
- `modules/budget/src/splitting/balance-tracker.ts` -- Per-contact balance calculator
- `modules/budget/src/splitting/settlement.ts` -- Settlement tracking
- `modules/budget/src/splitting/types.ts` -- Split, Contact, Balance types
- `modules/budget/src/splitting/index.ts` -- Barrel export
- `modules/budget/src/db/schema.ts` -- V6: bg_contacts, bg_expense_splits, bg_split_participants, bg_settlements
- `modules/budget/src/db/crud.ts` -- Splitting CRUD operations
- `modules/budget/src/types.ts` -- Splitting Zod schemas
- `modules/budget/src/definition.ts` -- V6 migration
- `modules/budget/src/index.ts` -- Export splitting types and engine
- `apps/mobile/app/(budget)/splits.tsx` -- Split overview screen
- `apps/mobile/app/(budget)/split-detail.tsx` -- Split detail screen
- `apps/mobile/app/(budget)/add-split.tsx` -- Create split form
- `apps/mobile/app/(budget)/contacts.tsx` -- Contact management
- `apps/web/app/budget/splits/page.tsx` -- Web split overview
- `apps/web/app/budget/splits/[id]/page.tsx` -- Web split detail
- `apps/web/app/budget/actions.ts` -- Splitting server actions

### Known Limitations
- No payment integration (Venmo, Zelle, etc.) -- settlement is tracking only
- No push notifications when someone owes you
- No debt simplification for group debts (e.g., if A owes B and B owes C, no auto-simplify to A owes C)
- No receipt splitting (split by line item) -- that would combine with receipt OCR feature
- The `bg_contacts` table is budget-scoped; future cross-module contact sharing (with RSVP) would require migration to hub-level

### Context for Next Agent
- The existing `bg_transaction_splits` table handles envelope-based splits (one transaction across multiple budget categories). This new feature handles people-based splits (one expense across multiple people). They are complementary, not replacements.
- Equal split rounding: for $100 / 3, use integer division ($3333 each) and assign remainder ($3334 to payer). Never use floating-point for money math.
- Balance calculation: for each contact, sum all splits where they owe you minus all splits where you owe them minus all settlements. Direction determined by `paid_by` field.
- RSVP module has its own expense splitting feature (`docs/plans/features/rsvp/expense-splitting.md`). Coordinate on `bg_contacts` table design if building both -- consider sharing the contacts table or using compatible schemas.
