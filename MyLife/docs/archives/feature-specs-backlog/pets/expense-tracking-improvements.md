# Feature Spec: Expense Tracking Improvements

## Metadata
- **Module:** pets
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 2 x3 + Complexity 4 x2 + CrossModule 3 x1 + PaidUser 2 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 2-3 hours
- **Depends On:** Expense CRUD (V1), Vet visit log (V1), Grooming log (V2)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Pet ownership costs are rising (average $1,500-$3,000/year per dog) and owners lack visibility into where their money goes. The existing `pt_expenses` table captures raw expense entries and `calculateOwnershipCost()` sums them, but there is no budget tracking, no category breakdown, no monthly trends, no spending alerts, and no cross-pet aggregation. The `calculateAverageMonthlyCost()` function exists in `engine/weight.ts` but belongs in a dedicated expense engine. This feature transforms passive expense logging into an active budget management tool with visual breakdowns, category budgets, and trend analysis. No major pet tracking competitor offers budget alerts or category-level spending analysis.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| 11pets | Partial | Premium ($20/yr) | Basic expense log with category totals, no budgets, no trends, no charts |
| PetDesk | No | N/A | No financial features |
| Pawp | No | N/A | Emergency fund only, no expense tracking |
| FitBark | No | N/A | Activity tracker only, no financial features |

### Target User
Cost-conscious pet owners who want to understand and control their pet spending. Multi-pet households that need aggregate cost visibility. Budget-minded owners who set monthly spending limits for categories like food, grooming, and vet visits. Currently these users track pet expenses in spreadsheets, Mint/YNAB (which lack pet-specific categories), or not at all. Migration path: users already logging vet visits and grooming (which auto-create expenses) get budgets and charts as a natural upgrade.

## Technical Context

### Where This Lives in MyLife

```
modules/pets/src/db/schema.ts          -- V4 migration: pt_expense_budgets
modules/pets/src/definition.ts         -- Add expense budget table to PETS_MIGRATION_V4
modules/pets/src/types.ts              -- New Zod schemas: ExpenseBudget, ExpenseSummary, ExpenseTrend, BudgetProgress
modules/pets/src/db/crud.ts            -- New CRUD: setExpenseBudget, getExpenseBudgets, listExpensesByCategory, getExpenseSummary
modules/pets/src/engine/expenses.ts    -- Pure functions: monthly spending, budget progress, cost breakdown, trends
modules/pets/src/index.ts              -- Re-export new public API
modules/pets/src/__tests__/expenses.test.ts -- Engine + CRUD tests
apps/mobile/app/(pets)/expenses.tsx    -- Per-pet expense dashboard screen
apps/mobile/app/(pets)/components/SpendingPieChart.tsx   -- Category pie chart component
apps/mobile/app/(pets)/components/MonthlySpendChart.tsx  -- Monthly bar chart component
apps/mobile/app/(pets)/components/BudgetProgressBar.tsx  -- Budget progress bar component
apps/web/app/pets/[petId]/expenses/page.tsx              -- Web expense dashboard
```

### Wireframe Position

```
Hub Dashboard
  └── MyPets card
       └── Pets tab (pet list)
            └── Pet Detail
                 └── Health tab
                      └── Expenses ← YOU ARE HERE
```

The expense dashboard is accessible from the pet detail screen under the Health tab. It replaces the existing simple expense list with a richer dashboard view. The raw expense list is still accessible as a sub-section.

### Data Model

V4 adds one new table. Note: if other Sprint 3 features also target V4, combine all DDL into a single PETS_MIGRATION_V4.

```sql
-- V4 Migration: Expense budgets

CREATE TABLE IF NOT EXISTS pt_expense_budgets (
  id TEXT PRIMARY KEY,
  pet_id TEXT REFERENCES pt_pets(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  monthly_budget_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pet_id, category)
);

-- Note: pet_id is nullable. NULL pet_id = global budget for that category across all pets.

-- Indexes
CREATE INDEX IF NOT EXISTS pt_expense_budgets_pet_idx
  ON pt_expense_budgets(pet_id, category);
CREATE INDEX IF NOT EXISTS pt_expenses_category_idx
  ON pt_expenses(pet_id, category, spent_on);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter, Migration), `@mylife/module-registry` (ModuleDefinition), `@mylife/ui` (Cool Obsidian tokens, glass card components)
- **External:** None. Charts are built with simple SVG/Canvas primitives, no charting library needed.
- **Cross-Module:** The expense engine could feed into the MyBudget module in the future (pet spending as an envelope category). No cross-module wiring in this version. The existing `calculateAverageMonthlyCost()` in `engine/weight.ts` should be preserved for backwards compatibility but the new engine supersedes it functionally.

## Functional Requirements

### User Stories
1. As a pet owner, I want to set a monthly budget for each expense category (vet, food, grooming, etc.) so that I can control spending per area.
2. As a pet owner, I want to see a pie chart showing spending by category so that I understand where my money goes.
3. As a pet owner, I want to see a monthly bar chart showing spending trends over the last 12 months so that I can spot seasonal patterns.
4. As a pet owner, I want to get a warning when spending in a category exceeds 80% of my budget so that I can course-correct before overspending.
5. As a multi-pet owner, I want to see aggregate spending across all pets so that I know my total pet cost.
6. As a pet owner, I want to see a cost-of-ownership breakdown (total spent since adoption, average monthly, projected annual) so that I understand the full financial picture.

### Behavior Specification

**Setting a category budget:**
1. User navigates to the expense dashboard for a pet
2. User taps "Set Budgets" button
3. System opens Budget Editor bottom sheet showing all expense categories (vet, food, grooming, medication, supplies, boarding, training, insurance, other) with input fields for monthly budget amount
4. User enters dollar amounts for desired categories (leave others blank for no budget)
5. User taps Save
6. System upserts `pt_expense_budgets` records for each category with a value
7. Budget progress bars appear on the expense dashboard for categories with budgets

**Viewing the expense dashboard:**
1. User navigates to pet detail, Health tab, Expenses section
2. System loads expense data and budgets for this pet
3. Dashboard shows (top to bottom):
   - Monthly summary card: total spent this month, budget progress bars for each budgeted category
   - Category pie chart: spending breakdown by category (all time or selected period)
   - Monthly trend bar chart: last 12 months of total spending
   - Cost-of-ownership summary: total since adoption, monthly average, projected annual
   - Recent expenses list (last 10 entries)

**Budget alerts:**
1. System calculates current month spending per category vs. budget
2. If any category exceeds 80% of budget, a warning banner appears at the top of the dashboard
3. Warning text: "[Category] spending is at [X]% of your $[budget] monthly budget"
4. If over 100%, warning uses danger styling: "[Category] spending ($[actual]) exceeds your $[budget] monthly budget"
5. Warnings are informational only (no push notifications in this version)

**Cross-pet summary:**
1. From the module-level pets list (not pet detail), user taps "All Pet Expenses"
2. System aggregates expenses across all active pets
3. Summary shows: total spent (all time), monthly average, breakdown by pet, breakdown by category
4. Pie chart shows per-pet spending proportion

**Viewing expenses by category:**
1. User taps a category segment in the pie chart
2. System filters the expense list to show only entries in that category
3. User can tap "All" to clear the filter

### Edge Cases

- **No budget set:** Budget progress bars are hidden for that category. No warnings generated. Pie chart and trend chart still display.
- **No expenses at all:** Dashboard shows empty state with "Log your first pet expense" CTA. Charts show "No data" placeholder.
- **Cross-pet summary with one pet:** Still works. Shows single-pet total. Pie chart has one segment.
- **Vet/grooming auto-expenses:** These are already created by `createVetVisit()` and `createGroomingRecord()` in the existing CRUD. They appear automatically in the expense dashboard and count against budgets. No duplicate handling needed.
- **Category "other" budget:** Allowed. "Other" is a valid category in the enum.
- **Budget set to 0:** Block save. Budget must be a positive amount.
- **Month with no expenses:** Bar chart shows a 0-height bar for that month. Budget progress shows 0%.
- **Very large expense (> $10,000):** No cap. Display with appropriate formatting. Pie chart scales dynamically.
- **Pet archived:** Expenses remain queryable. Budget progress stops showing warnings (no active spending expected).
- **Module disabled:** Routes removed, data preserved. Re-enabling restores everything.
- **Global budget (pet_id = NULL):** A budget with NULL pet_id applies as a default for all pets in that category. Pet-specific budgets override global budgets.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can set a monthly budget amount for any expense category
- [ ] **AC-2:** Budget progress bars show current month spending vs. budget for each budgeted category
- [ ] **AC-3:** Warning banner appears when spending in any category exceeds 80% of budget
- [ ] **AC-4:** Over-budget warning uses danger red styling when spending exceeds 100% of budget
- [ ] **AC-5:** Category pie chart shows spending breakdown by category with correct proportions
- [ ] **AC-6:** Monthly trend bar chart shows last 12 months of total spending
- [ ] **AC-7:** Cost-of-ownership summary shows total since adoption, monthly average, and projected annual
- [ ] **AC-8:** Tapping a pie chart segment filters the expense list to that category
- [ ] **AC-9:** Cross-pet summary aggregates expenses across all active pets
- [ ] **AC-10:** Empty state shows "Log your first pet expense" CTA when no expenses exist
- [ ] **AC-11:** Recent expenses list shows the last 10 entries in reverse chronological order

### Technical Criteria
- [ ] **TC-1:** V4 migration creates `pt_expense_budgets` table with UNIQUE(pet_id, category) constraint
- [ ] **TC-2:** `calculateMonthlySpending()` returns correct per-category totals for a given month
- [ ] **TC-3:** `calculateBudgetProgress()` returns correct percentage and triggers warning at 80%+
- [ ] **TC-4:** `getCostOfOwnershipBreakdown()` returns correct category proportions for pie chart data
- [ ] **TC-5:** `getExpenseTrend()` returns 12 monthly data points with correct totals, including $0 months
- [ ] **TC-6:** `calculateAverageMonthlyCost()` (enhanced version) correctly divides total by months owned
- [ ] **TC-7:** `setExpenseBudget()` upserts (creates on first call, updates on subsequent) for same pet+category
- [ ] **TC-8:** New `pt_expenses_category_idx` index is created for category-filtered queries

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Setting a budget for one pet must NOT affect other pets' budgets
- [ ] **NC-2:** Budget warnings must NOT generate push notifications (informational only in this version)
- [ ] **NC-3:** Expense data must NOT send any network requests (offline-first, local-only)
- [ ] **NC-4:** Disabling the Pets module must NOT delete expense or budget data
- [ ] **NC-5:** The existing `calculateAverageMonthlyCost()` in `engine/weight.ts` must NOT be removed (backwards compatibility)

## UI Specification

### Mobile (Expo)

- **Background:** `#0A0A0F` (background token)
- **Dashboard cards:** `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border, 12px border radius
- **Module accent:** `#F59E0B` (amber)
- **Budget progress bars:** 8px height, rounded ends. Track: `rgba(255,255,255,0.06)`. Fill: `#F59E0B` (under 80%), `#FF9500` (80-99%), `#FF453A` (100%+). Bar label: category name left-aligned, percentage right-aligned, both in `rgba(240,240,245,0.65)` (textSecondary)
- **Warning banner:** `rgba(245,158,11,0.12)` background with `#F59E0B` text for 80-99%. `rgba(255,69,58,0.12)` background with `#FF453A` text for 100%+. Warning icon prefix.
- **Pie chart:** SVG with segments colored by category. Category legend below with colored dots. Accent colors per category:
  - vet: `#FF453A`, food: `#30D158`, grooming: `#5E5CE6`, medication: `#FF9500`
  - supplies: `#64D2FF`, boarding: `#BF5AF2`, training: `#FFD60A`, insurance: `#F59E0B`, other: `rgba(240,240,245,0.40)`
- **Monthly bar chart:** 12 vertical bars, `#F59E0B` fill, `rgba(255,255,255,0.06)` background. Month labels (J, F, M...) below in textSecondary. Tallest bar fills available height, others proportional.
- **Cost summary card:** Glass card with large total in `#F0F0F5` 24px bold, monthly average and projected annual in textSecondary 14px
- **Layout:** ScrollView with sections: warning banner (conditional, top), summary card with budget bars (top), pie chart card (middle), bar chart card (middle), cost-of-ownership card (middle), recent expenses list (bottom)

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Expense dashboard accessible via `/pets/[petId]/expenses` route
- Sidebar navigation: "Expenses" appears as a sub-nav item under the pet detail
- Charts use SVG with CSS transitions (300ms ease) for segment and bar animations
- Pie chart is interactive: hover shows tooltip with category name and amount
- Budget editor uses modal dialog instead of bottom sheet
- Cross-pet summary accessible via `/pets/expenses` (no petId)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton pie chart circle + 3 skeleton progress bars | Initial data fetch |
| Empty | Illustration with "No expenses recorded yet", "Log your first pet expense" CTA | No expenses for this pet |
| No Budgets | Charts and cost summary visible, but no budget progress bars or warnings | Expenses exist but no budgets set |
| Under Budget | Green-tinted progress bars, no warning banner | All categories under 80% of budget |
| Near Budget | Amber progress bars, warning banner with amber styling | At least one category at 80-99% |
| Over Budget | Red progress bars, warning banner with red danger styling | At least one category at 100%+ |
| Error | Toast: "Could not load expense data." with retry action | Database read fails |

## Test Requirements

### Unit Tests (engine/expenses.ts)
- [ ] `calculateMonthlySpending`: returns correct totals per category for a given month
- [ ] `calculateMonthlySpending`: returns empty map when no expenses in month
- [ ] `calculateMonthlySpending`: ignores expenses from other months
- [ ] `calculateBudgetProgress`: returns 50% when $50 spent of $100 budget
- [ ] `calculateBudgetProgress`: returns 100% when budget is exactly met
- [ ] `calculateBudgetProgress`: returns 150% when $150 spent of $100 budget
- [ ] `calculateBudgetProgress`: returns `warning: true` when >= 80%
- [ ] `calculateBudgetProgress`: returns `overBudget: true` when >= 100%
- [ ] `calculateBudgetProgress`: returns null when no budget is set for category
- [ ] `getCostOfOwnershipBreakdown`: returns correct per-category proportions
- [ ] `getCostOfOwnershipBreakdown`: returns empty array when no expenses
- [ ] `getCostOfOwnershipBreakdown`: sums correctly across all categories
- [ ] `getExpenseTrend`: returns 12 data points for last 12 months
- [ ] `getExpenseTrend`: includes $0 for months with no expenses
- [ ] `getExpenseTrend`: sums all categories per month
- [ ] `calculateAverageMonthlyCost`: returns total / months_owned
- [ ] `calculateAverageMonthlyCost`: returns total when no adoption date (treats as 1 month)
- [ ] `calculateAverageMonthlyCost`: minimum 1 month denominator (prevents division by zero)

### Integration Tests (CRUD)
- [ ] `setExpenseBudget` creates budget on first call and returns it
- [ ] `setExpenseBudget` updates budget on second call (upsert behavior)
- [ ] `setExpenseBudget` enforces UNIQUE(pet_id, category) constraint
- [ ] `getExpenseBudgets` returns all budgets for a pet
- [ ] `getExpenseBudgets` returns empty array for pet with no budgets
- [ ] `listExpensesByCategory` filters expenses to specified category
- [ ] `listExpensesByCategory` returns empty array for category with no expenses
- [ ] `getExpenseSummary` returns correct monthly total for current month
- [ ] V4 migration runs cleanly on existing V3 database
- [ ] V4 migration creates pt_expenses_category_idx index
- [ ] Delete pet CASCADE deletes expense budgets

### QA Verification Script

1. Open the app on mobile (iOS simulator or device)
2. Navigate to MyPets module from hub dashboard
3. Tap an existing pet (or create one: "Luna", dog, golden retriever, adoption date = 2025-01-01)
4. Navigate to Health tab, Expenses section
5. **Verify empty state:** See "No expenses recorded yet" and CTA -- AC-10
6. Log a vet visit with cost $150 (this auto-creates a vet expense)
7. Log a grooming session with cost $80 (this auto-creates a grooming expense)
8. Manually add expense: category = food, label = "Kibble monthly", amount = $65.00, date = today
9. Navigate back to Expenses dashboard
10. **Verify:** Pie chart shows 3 segments (vet, grooming, food) -- AC-5
11. **Verify:** Monthly bar chart shows current month with data -- AC-6
12. **Verify:** Cost summary shows total = $295.00 -- AC-7
13. Tap "Set Budgets"
14. Enter: food = $100/mo, vet = $200/mo, grooming = $100/mo
15. Tap Save
16. **Verify:** Budget progress bars appear for food (65%), vet (75%), grooming (80%) -- AC-1, AC-2
17. **Verify:** Warning banner appears for grooming at 80% -- AC-3
18. Add another grooming expense: $30
19. **Verify:** Grooming now at 110%, warning banner turns red: "Grooming spending ($110.00) exceeds your $100.00 monthly budget" -- AC-4
20. Tap the "food" segment in the pie chart
21. **Verify:** Expense list filters to show only food entries -- AC-8
22. Add another pet "Max" with expenses
23. Navigate to module-level "All Pet Expenses"
24. **Verify:** Cross-pet summary shows Luna + Max totals, per-pet breakdown -- AC-9
25. **Verify:** Recent expenses list shows last 10 entries sorted by date -- AC-11

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for expense engine (monthly spending, budget progress, cost breakdown, trend)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- pets module has no standalone counterpart (skip)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- `pt_expenses` table exists (V1) with columns: id, pet_id, category, label, amount_cents, spent_on, notes, created_at
- `createPetExpense()` and `listExpensesForPet()` CRUD exist in `crud.ts`
- `ExpenseCategorySchema` enum exists in `types.ts` with: vet, food, grooming, medication, supplies, boarding, training, other
- `calculateOwnershipCost()` in `engine/weight.ts` sums all expenses (total cost)
- `calculateAverageMonthlyCost()` in `engine/weight.ts` divides total by months since adoption
- `createVetVisit()` auto-creates vet expense when costCents is provided
- `createGroomingRecord()` auto-creates grooming expense when costCents is provided
- No budget tracking per category
- No spending breakdown charts
- No monthly trend analysis
- No budget alerts
- No cross-pet expense aggregation
- No mobile or web UI for expense dashboard

### After This Work
- V4 migration adds `pt_expense_budgets` table with UNIQUE(pet_id, category) constraint
- V4 migration adds `pt_expenses_category_idx` index on existing `pt_expenses` table
- New Zod schemas: `ExpenseBudgetSchema`, `ExpenseSummarySchema`, `ExpenseTrendSchema`, `BudgetProgressSchema`, `SetExpenseBudgetInputSchema`
- New CRUD: `setExpenseBudget()`, `getExpenseBudgets()`, `listExpensesByCategory()`, `getExpenseSummary()`
- New engine: `engine/expenses.ts` with `calculateMonthlySpending()`, `calculateBudgetProgress()`, `getCostOfOwnershipBreakdown()`, `getExpenseTrend()`, enhanced `calculateAverageMonthlyCost()`
- Mobile screen at `apps/mobile/app/(pets)/expenses.tsx` with pie chart, bar chart, budget bars
- Web page at `apps/web/app/pets/[petId]/expenses/page.tsx`
- 29+ new tests covering engine logic and CRUD operations

### Files Changed

- `modules/pets/src/db/schema.ts` -- V4 table DDL: pt_expense_budgets, new index on pt_expenses
- `modules/pets/src/definition.ts` -- Add expense budget DDL to PETS_MIGRATION_V4, bump schemaVersion
- `modules/pets/src/types.ts` -- New schemas: ExpenseBudget, ExpenseSummary, ExpenseTrend, BudgetProgress, SetExpenseBudgetInput
- `modules/pets/src/db/crud.ts` -- New CRUD: setExpenseBudget, getExpenseBudgets, listExpensesByCategory, getExpenseSummary
- `modules/pets/src/engine/expenses.ts` -- New engine file with 5 pure functions
- `modules/pets/src/index.ts` -- Re-export new public API
- `modules/pets/src/__tests__/expenses.test.ts` -- Unit + integration tests
- `apps/mobile/app/(pets)/expenses.tsx` -- Per-pet expense dashboard screen
- `apps/mobile/app/(pets)/components/SpendingPieChart.tsx` -- Category pie chart component
- `apps/mobile/app/(pets)/components/MonthlySpendChart.tsx` -- Monthly bar chart component
- `apps/mobile/app/(pets)/components/BudgetProgressBar.tsx` -- Budget progress bar component
- `apps/web/app/pets/[petId]/expenses/page.tsx` -- Web expense dashboard

### Known Limitations
- No recurring expense automation. Budgets are monthly targets but recurring expenses (food, insurance premiums) must be logged manually each month.
- No receipt photo attachment on expenses. Future enhancement could use `pt_pet_photos` with an expense tag.
- Charts are simple SVG/Canvas. No interactive tooltips on mobile (web has hover tooltips). A future version could use a charting library for richer interactions.
- No CSV/PDF export of expense reports. The existing `exportPetData()` includes raw expenses in the JSON bundle, but no formatted expense report.
- No integration with MyBudget module yet. Pet expenses live entirely within the pets module. Future cross-module work could sync pet expenses as an envelope category in MyBudget.
- Budget alerts are in-app only (no push notifications). The alerts display when the user opens the expense dashboard.
- The `calculateAverageMonthlyCost()` in `engine/weight.ts` is preserved for backwards compatibility. New code should use the enhanced version in `engine/expenses.ts` which handles additional edge cases.

### Context for Next Agent
- The V4 migration may be shared with other Sprint 3 features (Exercise Walk Log, Insurance). If multiple features target V4, combine all DDL into a single `PETS_MIGRATION_V4` in `definition.ts`. Each feature's schema exports should be separate in `schema.ts` for clarity.
- The `pt_expense_budgets.pet_id` is nullable. A budget with `NULL` pet_id is a global default for that category. When calculating budget progress, check for a pet-specific budget first, then fall back to global budget. If neither exists, no budget applies.
- Auto-expenses from vet visits and grooming records are already being created by existing CRUD functions. These count against budgets automatically. No special handling needed.
- The pie chart category colors are hardcoded in the UI spec. Use these exact colors for consistency. The "insurance" category color matches the module accent (#F59E0B) because insurance is a pets-module concept.
- The `getExpenseTrend()` function should return exactly 12 data points, one per month, going back from the current month. Months with no expenses should have `totalCents: 0`. The return type should include `{ month: string; totalCents: number }[]` where month is "YYYY-MM" format.
- The existing `pt_expenses` table does not have a category+date index. The V4 migration should add `pt_expenses_category_idx ON pt_expenses(pet_id, category, spent_on)` to support the new category-filtered queries efficiently.
