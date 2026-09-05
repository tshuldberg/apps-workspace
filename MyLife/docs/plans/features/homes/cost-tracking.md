# Feature Spec: Cost Tracking

## Metadata
- **Module:** homes
- **Priority Score:** 29 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [3] x3 + Complexity [4] x2 + CrossModule [3] x1 + PaidUser [3] x1
- **Sprint:** 7
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Maintenance schedule reminders (A-tier, done)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Homeowners spend an average of $6,000+/year on maintenance, repairs, and improvements but rarely have a consolidated view of where that money goes. Without cost tracking, users cannot answer basic questions like "How much did I spend on HVAC last year?" or "What's this property costing me month over month?" The maintenance reminders feature (A-tier, done) tells users when to do tasks; cost tracking closes the loop by recording what those tasks actually cost. Competitors HomeZada ($59-99/yr) and Centriq ($32/yr) both bundle cost tracking alongside maintenance scheduling, making this a table-stakes capability for competitive parity. The cross-module integration with MyBudget (auto-categorization of home expenses) adds unique value no competitor offers.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| HomeZada | Yes | Yes ($59-99/yr) | Cloud cost tracking tied to maintenance history, vendor logging, receipt photo upload, annual cost reports, home value impact estimates |
| Centriq | Yes | Yes ($32/yr) | Basic cost logging per appliance/system, receipt photo capture, total spend summaries, no vendor management |
| Thumbtack | No | N/A | Provides contractor quotes but no historical cost tracking for the homeowner |
| Angi | No | N/A | Shows average project costs (crowdsourced), no personal spend tracking |

### Target User
Homeowners (30-65) who want to understand their total cost of ownership. Users who currently track home expenses in spreadsheets, Mint/YNAB categories, or paper receipts. HomeZada subscribers ($59-99/yr) who want integrated cost tracking within a hub they already pay for. Landlords tracking maintenance costs per rental property for tax deduction records. The cross-module value proposition (auto-syncing costs to MyBudget envelopes) is a unique MyLife differentiator that no competitor offers.

## Technical Context

### Where This Lives in MyLife

```
modules/homes/src/
  types.ts                                  -- New Zod schemas: CostEntry, CostCategory, CostSummary
  db/schema.ts                              -- New table: hm_cost_entries + indexes
  db/crud.ts                                -- New CRUD: cost entry create/read/update/delete, summary queries
  engines/cost-engine.ts                    -- NEW: getCostSummary, getLifetimeCosts, getMonthlyCostTrend, getCostsBySchedule
  definition.ts                             -- Migration v3 for new table
  __tests__/cost-engine.test.ts             -- NEW: unit tests for cost engine

apps/mobile/app/(homes)/
  costs.tsx                                 -- NEW: Cost overview screen (per property and cross-property)
  add-cost.tsx                              -- NEW: Add/Edit cost entry form
  cost-detail.tsx                           -- NEW: Cost entry detail view

apps/web/app/homes/
  costs/page.tsx                            -- NEW: Cost tracking web page
```

### Wireframe Position

```
Hub Dashboard
  └── MyHomes card
       ├── Search tab (existing listings)
       ├── Saved tab (existing saved listings)
       ├── Properties tab (existing, from maintenance reminders)
       ├── Reminders tab (existing, from maintenance reminders)
       └── Costs tab ← NEW (YOU ARE HERE)
            ├── Property selector (dropdown or segmented)
            ├── Summary cards (monthly, yearly, lifetime)
            ├── Cost entry list sorted by date
            └── "Add Cost" button
```

The Cost tracking view is accessible from:
1. The new "Costs" tab in MyHomes (primary entry point, replaces "Profile" tab)
2. A maintenance reminder detail screen's "Log Cost" action button (links to add-cost pre-filled with schedule context)
3. A property detail screen's "View Costs" section

### Data Model

```sql
-- New table: hm_cost_entries (Migration v3)
CREATE TABLE IF NOT EXISTS hm_cost_entries (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
    schedule_id TEXT REFERENCES hm_maintenance_schedules(id) ON DELETE SET NULL,
    category TEXT NOT NULL DEFAULT 'other',          -- maintenance, repair, improvement, utility, other
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,                   -- stored as cents for precision
    vendor TEXT,
    receipt_photo_uri TEXT,
    cost_date TEXT NOT NULL,                          -- ISO date string (YYYY-MM-DD)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS hm_costs_property_idx
    ON hm_cost_entries(property_id);
CREATE INDEX IF NOT EXISTS hm_costs_category_idx
    ON hm_cost_entries(category);
CREATE INDEX IF NOT EXISTS hm_costs_date_idx
    ON hm_cost_entries(cost_date DESC);
CREATE INDEX IF NOT EXISTS hm_costs_schedule_idx
    ON hm_cost_entries(schedule_id);
```

**category enum values:** `maintenance`, `repair`, `improvement`, `utility`, `other`

**schedule_id:** Nullable FK to hm_maintenance_schedules. When a cost is logged from a reminder detail screen, this links the expense to the specific maintenance schedule. When a schedule is deleted, the cost entry is preserved with schedule_id set to NULL (ON DELETE SET NULL).

**amount_cents:** Integer cents, not floating point. $150.50 is stored as 15050. This matches the pattern used by MyBudget and MyCar modules for financial values.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for SQLite operations), `@mylife/ui` (Cool Obsidian tokens, glass card components), `@mylife/module-registry` (Migration type for schema v3)
- **External:** `zod` (schema validation), `expo-image-picker` (receipt photo capture on mobile). No external APIs required.
- **Cross-Module:** Future integration with `modules/budget/` for auto-categorization of home expenses into budget envelopes. The cost engine will export a `getCostEntriesForBudgetSync` function that returns entries formatted for the budget module's transaction import. This integration is wired as an optional dependency -- cost tracking works standalone without MyBudget enabled.

## Functional Requirements

### User Stories
1. As a homeowner, I want to log the cost of each maintenance task when I mark it complete, so I can track what home upkeep actually costs me.
2. As a multi-property owner, I want to see cost summaries per property and across all properties, so I can compare total cost of ownership.
3. As a homeowner, I want to categorize costs (maintenance, repair, improvement, utility) so I can understand where my money goes.
4. As a homeowner, I want to attach receipt photos to cost entries so I have proof of expenses for warranty claims or tax records.
5. As a homeowner, I want to see monthly and yearly cost trends so I can budget for future home expenses.
6. As a homeowner, I want to log standalone costs (not tied to a maintenance schedule) for one-off repairs or improvements.
7. As a MyBudget user, I want home costs to sync into my budget categories automatically so I don't double-enter expenses.

### Behavior Specification

**Logging a cost from a maintenance reminder:**
1. User navigates to Reminders tab, taps a reminder, and taps "Mark Complete".
2. After marking complete, system presents a dialog: "Log the cost for this task?"
3. If accepted: Add Cost form opens pre-filled with schedule context (task type as description, category set to "maintenance", schedule_id linked).
4. User enters amount (required), vendor (optional), receipt photo (optional), cost date (defaults to today).
5. User taps Save. Cost entry is created and linked to both the property and the schedule.
6. If declined: no cost entry created. User can add one manually later.

**Adding a standalone cost:**
1. User navigates to Costs tab.
2. User taps "Add Cost".
3. Form shows: property selector (required, pre-selected if only one property), category selector (maintenance/repair/improvement/utility/other), description (required), amount (required, numeric with currency formatting), vendor (optional), receipt photo button (optional), cost date (date picker, defaults to today), link to schedule (optional dropdown of active schedules for selected property).
4. User taps Save. Cost entry is created.

**Viewing cost overview:**
1. User navigates to Costs tab.
2. Top section shows summary cards:
   - "This Month" card: total spend for current month, formatted as currency.
   - "This Year" card: total spend for current calendar year.
   - "Lifetime" card: total spend across all time.
3. Below summary: property filter (All Properties / specific property dropdown).
4. Cost entry list sorted by cost_date descending (newest first).
5. Each entry card shows: category icon, description, amount (formatted), vendor (if set), date, property name (in All Properties view).
6. Tapping an entry opens cost detail view.

**Viewing cost detail:**
1. Detail screen shows all fields: category badge, description, amount, vendor, receipt photo (tappable to view full size), cost date, linked schedule name (if any), property name.
2. Action buttons: "Edit", "Delete".

**Editing a cost entry:**
1. User taps "Edit" on cost detail.
2. Same form as Add Cost, pre-filled with existing values.
3. User modifies fields and taps Save. Entry is updated.

**Deleting a cost entry:**
1. User taps "Delete" on cost detail.
2. Confirmation dialog: "Delete this cost entry? This cannot be undone."
3. If confirmed: entry is deleted permanently.

**Receipt photo capture:**
1. User taps receipt photo button on the Add/Edit Cost form.
2. System presents options: "Take Photo" (camera) or "Choose from Library" (gallery).
3. Selected image is stored locally (file URI saved to receipt_photo_uri).
4. On the cost detail screen, tapping the receipt thumbnail opens it full-screen.

**Monthly cost trend:**
1. Accessed from the Costs tab by tapping "View Trend" on the summary section.
2. Shows a list of months (last 12) with total spend per month.
3. Each row: month name, total amount, bar chart indicator (proportional to highest month).
4. Categories are broken out per month as sub-rows (expandable).

### Edge Cases

- **No properties exist:** Costs tab shows empty state "Add a property to start tracking costs." Same CTA as Properties tab empty state.
- **Property with no costs:** Summary cards all show $0.00. Entry list shows "No costs recorded yet" with "Add Cost" CTA.
- **Deleting a property:** CASCADE deletes all associated cost entries. This is expected and documented in the confirmation dialog: "Deleting this property will also remove all cost entries and maintenance schedules."
- **Deleting a schedule linked to cost entries:** Cost entries are preserved (ON DELETE SET NULL on schedule_id). The entry still shows the original description and amount.
- **Amount of $0:** Allowed. Valid for warranty-covered repairs, free services, etc. Zod schema allows amount_cents = 0.
- **Very large amount (> $1M):** Allowed. amount_cents max is Number.MAX_SAFE_INTEGER. Display truncates to abbreviated format ($1.2M) if the formatted string exceeds the card width.
- **Receipt photo file deleted outside the app:** Display a placeholder "Receipt unavailable" image. Do not crash or show a broken image.
- **Cost date in the future:** Allowed. Users may pre-log scheduled contractor visits with known quotes. Zod does not restrict cost_date to past dates.
- **Multiple costs for the same schedule:** Allowed. A maintenance task may incur parts cost and labor cost as separate entries.
- **Module disabled mid-use:** Data preserved. Re-enabling restores all costs.
- **No MyBudget module enabled:** Cost tracking works entirely standalone. The budget sync function is a no-op when budget module is not active.
- **Currency formatting:** Always USD for MVP. No currency selector. Amounts display with 2 decimal places ($150.50).
- **Extremely long description or vendor name:** Truncated with ellipsis in card view. Full text shown in detail view.

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** Adding a cost entry with description "HVAC Service", amount $250.00, category "maintenance", and vendor "Cool Air Co" saves correctly and appears in the Costs tab.
- [ ] **AC-2:** Marking a maintenance reminder complete presents a "Log the cost?" dialog. Accepting opens the Add Cost form pre-filled with schedule context.
- [ ] **AC-3:** Declining the cost dialog after marking complete does not create a cost entry.
- [ ] **AC-4:** The Costs tab shows three summary cards (This Month, This Year, Lifetime) with correct totals.
- [ ] **AC-5:** Filtering by a specific property shows only costs for that property. Summary cards update to reflect the filtered view.
- [ ] **AC-6:** Cost entries are sorted by cost_date descending (newest first).
- [ ] **AC-7:** Tapping a cost entry opens the detail view showing all fields including receipt photo (if attached).
- [ ] **AC-8:** Editing a cost entry updates the record and reflects the change immediately in the list and summary cards.
- [ ] **AC-9:** Deleting a cost entry removes it from the list and updates summary totals. Confirmation dialog is shown first.
- [ ] **AC-10:** Attaching a receipt photo via camera or gallery stores the image and displays a thumbnail in the entry card.
- [ ] **AC-11:** The monthly cost trend view shows the last 12 months with totals and category breakdowns.
- [ ] **AC-12:** Adding a standalone cost (not linked to any schedule) works correctly via the "Add Cost" button on the Costs tab.
- [ ] **AC-13:** Cost entries linked to a schedule show the schedule's task name in the detail view.

### Technical Criteria
- [ ] **TC-1:** Schema migration v3 creates hm_cost_entries table with all columns, indexes, and correct hm_ prefix.
- [ ] **TC-2:** `getCostSummary(db, propertyId, dateRange)` returns correct total_cents, category breakdown, and entry count for the given property and date range.
- [ ] **TC-3:** `getCostSummary` with no propertyId filter returns cross-property totals.
- [ ] **TC-4:** `getLifetimeCosts(db, propertyId)` returns the sum of all cost entries for the property.
- [ ] **TC-5:** `getMonthlyCostTrend(db, propertyId, months)` returns an array of {month, year, totalCents, byCategory} for the last N months.
- [ ] **TC-6:** `getCostsBySchedule(db, scheduleId)` returns all cost entries linked to a specific maintenance schedule.
- [ ] **TC-7:** Zod validation requires description (min 1 char) and amount_cents (integer >= 0).
- [ ] **TC-8:** Zod validation requires cost_date as a valid ISO date string.
- [ ] **TC-9:** Zod validation restricts category to the 5 allowed values (maintenance, repair, improvement, utility, other).
- [ ] **TC-10:** Deleting a property CASCADE-deletes all associated cost entries.
- [ ] **TC-11:** Deleting a schedule SET NULLs the schedule_id on linked cost entries (entries preserved).
- [ ] **TC-12:** Cost entry CRUD operations (create, read, update, delete) persist correctly in SQLite.
- [ ] **TC-13:** `getCostSummary` for a property with 500+ entries completes in < 200ms.
- [ ] **TC-14:** Receipt photo URI stored in receipt_photo_uri column is a valid local file path.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Cost calculations must NOT make any network calls. All computation is on-device.
- [ ] **NC-2:** Adding or editing cost entries must NOT affect hm_maintenance_schedules, hm_properties, or hm_listings records.
- [ ] **NC-3:** Deleting a cost entry must NOT delete the linked maintenance schedule.
- [ ] **NC-4:** Cost tracking must NOT require MyBudget to be enabled. The cross-module sync is optional.
- [ ] **NC-5:** Receipt photos must NOT be uploaded to any server. They remain on-device only.

## UI Specification

### Mobile (Expo)

**Costs Tab:**
- Background: `#0A0A0F` (background token)
- Summary section: 3 glass cards in a horizontal scroll row
  - Each card: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border (glassBorder)
  - Card title: `rgba(240,240,245,0.65)` (textSecondary), e.g., "This Month"
  - Card amount: `#F0F0F5` (text token), large font (24pt), formatted as "$1,234.56"
  - Card icon: Module accent `#D97706` (amber)
- Property filter: segmented control below summary, accent color for selected segment
- Cost entry list: FlatList with glass card items
  - Card layout: Category icon (left, amber accent) | Description + vendor (center, text + textSecondary) | Amount (right, text token, bold) | Date below (textSecondary)
- "Add Cost" FAB: circular button, bottom-right, `#D97706` background, white plus icon

**Add/Edit Cost Form:**
- Background: `#0A0A0F`
- Form fields: glass-bordered input fields
- Property selector: dropdown with glass styling
- Category selector: horizontal chip row (maintenance, repair, improvement, utility, other), selected chip uses `#D97706` fill
- Amount input: numeric keyboard, auto-formatted with dollar sign
- Receipt photo button: dashed-border glass card, camera icon, "Add Receipt" text
- Save button: full-width, `#D97706` background, white text

**Cost Detail:**
- Bottom sheet modal
- Category badge at top (amber background, white text)
- Amount prominently displayed (32pt)
- Receipt photo thumbnail (if present): rounded corners, tappable to expand
- Vendor and date in `textSecondary`
- Linked schedule name (if any) in accent color, tappable to navigate
- "Edit" and "Delete" buttons at bottom, glass styling

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Costs accessible at `/homes/costs` route
- Layout: sidebar navigation (existing), main content area
- Summary cards as a 3-column grid at the top
- Property filter as a dropdown in the header area
- Cost entry table with sortable columns (date, description, category, amount, vendor)
- Receipt photo displayed as a thumbnail in the table row, expandable on click
- Add/Edit cost opens as a side panel (consistent with reminder detail pattern)
- Monthly trend shown as a horizontal bar chart (CSS-only, no chart library)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton summary cards (3) + skeleton list items (5) with pulsing animation | Initial data fetch from SQLite |
| Empty (no properties) | Centered home icon, "Add a property to start tracking costs" + "Add Property" CTA button | No records in hm_properties |
| Empty (no costs) | Summary cards showing $0.00, "No costs recorded yet" message + "Add Cost" CTA button | Property exists but no cost entries |
| Error | "Something went wrong loading costs" + retry button | SQLite read failure |
| Success | Summary cards with totals, cost entry list sorted by date | Data loaded successfully |
| Partial | Summary cards loaded, entry list still loading (skeleton rows below) | Large dataset, staggered fetch |

## Test Requirements

### Unit Tests (modules/homes/src/__tests__/cost-engine.test.ts)
- [ ] `getCostSummary`: returns correct total for a single property with 3 entries
- [ ] `getCostSummary`: returns zero total when no entries exist for property
- [ ] `getCostSummary`: filters by date range correctly (only includes entries within range)
- [ ] `getCostSummary`: returns correct category breakdown (e.g., maintenance: $500, repair: $200)
- [ ] `getCostSummary`: with no propertyId returns cross-property totals
- [ ] `getLifetimeCosts`: returns sum of all entries for a property
- [ ] `getLifetimeCosts`: returns 0 for a property with no entries
- [ ] `getMonthlyCostTrend`: returns correct monthly totals for last 12 months
- [ ] `getMonthlyCostTrend`: returns zero-filled months when no entries exist
- [ ] `getMonthlyCostTrend`: correctly breaks down by category per month
- [ ] `getCostsBySchedule`: returns only entries linked to the given schedule_id
- [ ] `getCostsBySchedule`: returns empty array when no entries linked
- [ ] Zod validation: accepts valid CostEntrySchema with all required fields
- [ ] Zod validation: rejects entry with missing description (empty string)
- [ ] Zod validation: rejects entry with negative amount_cents
- [ ] Zod validation: rejects entry with invalid category value
- [ ] Zod validation: rejects entry with missing cost_date
- [ ] Zod validation: accepts amount_cents = 0 (warranty/free service)
- [ ] `formatCostAmount`: correctly formats 15050 as "$150.50"
- [ ] `formatCostAmount`: correctly formats 0 as "$0.00"
- [ ] `formatCostAmount`: correctly formats 100000000 as "$1,000,000.00"

### Integration Tests
- [ ] Full flow: create property, add 3 cost entries with different categories, verify summary returns correct totals and breakdown
- [ ] Full flow: mark maintenance schedule complete, accept cost dialog, cost entry created with correct schedule_id and property_id
- [ ] Full flow: delete cost entry, verify summary totals update correctly
- [ ] Full flow: edit cost entry amount, verify summary totals reflect the change
- [ ] Full flow: delete property, verify all associated cost entries are CASCADE-deleted
- [ ] Full flow: delete schedule, verify cost entries preserved with schedule_id set to NULL
- [ ] Error flow: create cost entry with invalid data (empty description), validation error returned, no record persisted

### QA Verification Script

1. Open the app on iOS/Android simulator.
2. Navigate to MyHomes module. Verify Costs tab is visible in the tab bar. -- Tab present.
3. Tap Costs tab. Verify empty state with "Add a property..." CTA (assuming no properties). -- Verifies empty state.
4. Add a property "Main House" (from Properties tab if not already present). Return to Costs tab.
5. Verify summary cards show $0.00 for This Month, This Year, and Lifetime. Verify "No costs recorded yet" message with "Add Cost" button. -- Verifies empty costs state.
6. Tap "Add Cost". Fill in: category "maintenance", description "HVAC Service", amount $250.00, vendor "Cool Air Co", date today. Save. -- Corresponds to AC-1.
7. Verify the cost entry appears in the list with correct description, amount ($250.00), and category icon. -- Corresponds to AC-1.
8. Verify summary cards update: This Month = $250.00, This Year = $250.00, Lifetime = $250.00. -- Corresponds to AC-4.
9. Add a second cost: category "repair", description "Leaky Faucet Fix", amount $85.00, vendor "PlumbRight", date 3 months ago. Save.
10. Verify list now shows 2 entries, sorted by date (today's entry first). -- Corresponds to AC-6.
11. Verify This Month = $250.00 (only today's entry), This Year = $335.00 (both), Lifetime = $335.00. -- Corresponds to AC-4, AC-5.
12. Navigate to Reminders tab. Find a due or overdue reminder. Tap it and tap "Mark Complete". -- Setup for AC-2.
13. When "Log the cost?" dialog appears, tap "Yes". Verify Add Cost form opens pre-filled with maintenance context. -- Corresponds to AC-2.
14. Enter amount $180.00. Save. Return to Costs tab. Verify new entry appears with schedule linkage shown. -- Corresponds to AC-2, AC-13.
15. Repeat step 12 with another reminder. Decline the cost dialog. Verify no cost entry is created. -- Corresponds to AC-3.
16. Tap an existing cost entry. Verify detail view shows all fields. -- Corresponds to AC-7.
17. Tap "Edit". Change amount to $300.00. Save. Verify list and summary cards reflect updated amount. -- Corresponds to AC-8.
18. Tap the same entry again. Tap "Delete". Confirm. Verify entry is removed and summary updates. -- Corresponds to AC-9.
19. Add a cost entry with a receipt photo (take photo or choose from library). Verify thumbnail appears on the entry card. -- Corresponds to AC-10.
20. Tap the entry to see detail. Verify receipt photo is displayed. Tap it to view full-size. -- Corresponds to AC-10.
21. Add a second property "Beach Condo". Add costs for it. Switch property filter. Verify costs filter correctly by property. -- Corresponds to AC-5.
22. Select "All Properties" filter. Verify costs from both properties appear. Summary reflects combined totals. -- Corresponds to AC-5.
23. Tap "View Trend" on the summary section. Verify monthly breakdown for the last 12 months. -- Corresponds to AC-11.
24. Delete "Beach Condo" property. Verify its cost entries are also removed. -- Corresponds to TC-10.
25. Repeat key steps (6-11, 16-18) on web at `/homes/costs`. Verify functional parity (minus camera capture). -- Web parity check.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to `/homes/costs`, click every button, verify all 5 states (loading, empty-no-properties, empty-no-costs, error, success)
- [ ] Batch QA: after 5 features in homes module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for `cost-engine.ts` (getCostSummary, getLifetimeCosts, getMonthlyCostTrend, getCostsBySchedule)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- homes module has active standalone counterpart (MyHomes)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Homes module has 5 tables: hm_listings, hm_tours, hm_properties, hm_maintenance_schedules, hm_settings
- Schema version 2, migrations v1 and v2
- Maintenance reminders are functional (A-tier complete)
- No concept of cost tracking for maintenance tasks or home expenses
- No receipt storage capability

### After This Work
- Homes module has 6 tables (new: hm_cost_entries) with 4 new indexes
- Schema version 3, migration v3 added
- New "Costs" tab replaces "Profile" tab (profile moves to settings gear icon in header)
- Full cost lifecycle: add costs (standalone or linked to schedules), view summaries (monthly/yearly/lifetime), filter by property, view trends, edit, delete
- Receipt photo capture and on-device storage
- `cost-engine.ts` contains pure functions for cost aggregation, trend calculation, and summary generation
- "Mark Complete" flow on reminders now offers optional cost logging
- Navigation updated: "Costs" tab added to homes module definition

### Files Changed

- `modules/homes/src/types.ts` -- Add CostCategorySchema, CostEntrySchema, CostSummarySchema, MonthlyCostTrendSchema Zod schemas and types
- `modules/homes/src/db/schema.ts` -- Add CREATE_COST_ENTRIES table, 4 indexes, V3_TABLES export
- `modules/homes/src/db/crud.ts` -- Add cost entry CRUD (create, get, getByProperty, getBySchedule, update, delete), cost summary queries
- `modules/homes/src/engines/cost-engine.ts` -- NEW: getCostSummary, getLifetimeCosts, getMonthlyCostTrend, getCostsBySchedule, formatCostAmount
- `modules/homes/src/definition.ts` -- Add HOMES_MIGRATION_V3, update schemaVersion to 3, replace Profile tab with Costs tab
- `modules/homes/src/index.ts` -- Re-export new types and engine functions
- `modules/homes/src/__tests__/cost-engine.test.ts` -- NEW: 21+ unit tests for cost engine
- `apps/mobile/app/(homes)/costs.tsx` -- NEW: Cost overview screen
- `apps/mobile/app/(homes)/add-cost.tsx` -- NEW: Add/Edit cost entry form
- `apps/mobile/app/(homes)/cost-detail.tsx` -- NEW: Cost detail modal
- `apps/web/app/homes/costs/page.tsx` -- NEW: Cost tracking web page

### Known Limitations
- Currency is USD-only for MVP. No multi-currency support.
- Receipt photos are stored as local file URIs. No cloud backup or sync between devices.
- Monthly trend is text-based (bars via CSS). No interactive chart library.
- Cross-module MyBudget integration is exported as a function signature but not wired until the budget module adds a home expenses category.
- No CSV/PDF export of cost history. Deferred to a future reporting feature.
- No recurring cost auto-entry (e.g., monthly utility bills). Each cost is manually logged.

### Context for Next Agent
- The cost engine should follow the same pure-function pattern as `reminder-engine.ts`. Functions take a DatabaseAdapter and return typed results. No side effects.
- `amount_cents` uses integer cents (not float dollars). This is consistent with MyBudget (`bg_` tables) and MyCar (`cr_` tables). When displaying, divide by 100 and format with 2 decimal places.
- The "Log the cost?" dialog after marking a reminder complete should be triggered by a callback in the reminder detail screen component, not baked into the `markComplete` engine function. Keep the engine pure.
- Receipt photo storage uses `expo-image-picker` on mobile. On web, use a standard `<input type="file" accept="image/*">`. Store the file in the app's document directory and save the URI.
- The "Profile" tab is replaced by "Costs" in definition.ts. This keeps the tab bar at 5 tabs. Profile/settings functionality moves to a gear icon in the header bar (consistent with other modules).
- Migration v3 must be idempotent (CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS). Follow the exact pattern from v1 and v2 in definition.ts.
