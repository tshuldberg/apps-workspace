# Feature Spec: All CRUD Functions

## Metadata
- **Module:** subs
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 5 x3 + Complexity 3 x2 + CrossModule 0 x1 + PaidUser 0 x1
- **Sprint:** Sprint 8
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Database schema
- **Blocks:** UI, Cost analysis, Renewal calendar, Subscription detection, Cancellation assist, Price comparison

## Business Context

### Why This Feature Exists
CRUD functions are the data access layer that every other Subs feature depends on. Without create/read/update/delete operations for subscriptions, categories, price history, and renewal events, no UI can render, no engine can compute, and no workflow can function. This is the second P0 blocker after the database schema.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Rocket Money | Yes | Partial | Full CRUD with bank sync auto-population. Manual add also supported. |
| Bobby | Yes | No | Simple CRUD with manual entry only. Clean add/edit forms. |

### Target User
Same as Database Schema -- anyone wanting to manage subscriptions locally. The CRUD layer must be clean enough that UI and engine developers can call simple functions without writing raw SQL.

## Technical Context

### Where This Lives in MyLife

```
modules/subs/src/
  db/
    crud.ts                -- NEW: All CRUD operations for sb_ tables
    queries.ts             -- NEW: Complex query helpers (list with filters, aggregations)
    __tests__/
      crud.test.ts         -- NEW: CRUD operation tests
  index.ts                 -- MODIFY: Export CRUD functions
```

### Wireframe Position

```
Hub Dashboard
  └── MySubs card
       └── (not visible to users -- data access layer)
```

Backend-only feature. No UI changes.

### Data Model

No new tables. Operates on the 6 tables created by the Database Schema feature:
- `sb_subscriptions` -- primary CRUD target
- `sb_categories` -- category CRUD
- `sb_price_history` -- append-only price change log
- `sb_renewal_events` -- renewal tracking CRUD
- `sb_cancellation_actions` -- append-only action log
- `sb_price_alternatives` -- alternative pricing CRUD

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for query execution), `@mylife/subs` types (Zod schemas for validation)
- **External:** None
- **Cross-Module:** None directly. Budget module has its own subscription CRUD under `bg_` prefix. These are independent.

## Functional Requirements

### User Stories
1. As the UI layer, I want to call `createSubscription(data)` and get back a validated Subscription object so I can render it immediately.
2. As the UI layer, I want to call `listSubscriptions(filters)` with optional status, category, and sort filters so I can show filtered lists.
3. As the cost analysis engine, I want to call `getSubscriptionWithHistory(id)` so I can access a subscription's price changes in one call.
4. As the renewal calendar, I want to call `getUpcomingRenewals(days)` to get all subscriptions renewing within N days.
5. As a user deleting a subscription, I want CASCADE behavior to clean up all associated records automatically.

### Behavior Specification

**Subscription CRUD:**

1. `createSubscription(db, data: CreateSubscriptionInput): Subscription`
   - Validates input against `CreateSubscriptionSchema` (Zod)
   - Generates UUID for `id`
   - Sets `created_at` and `updated_at` to current ISO timestamp
   - Calculates `next_renewal_date` from `start_date` + `billing_cycle` if not provided
   - Inserts into `sb_subscriptions`
   - Returns the full Subscription object

2. `getSubscription(db, id: string): Subscription | null`
   - Queries `sb_subscriptions` by `id`
   - Returns null if not found
   - Parses through Zod schema before returning

3. `listSubscriptions(db, filters?: SubscriptionFilters): Subscription[]`
   - Optional filters: `status` (string or string[]), `categoryId` (string), `search` (name LIKE match), `sortBy` ('name' | 'cost' | 'nextRenewal' | 'createdAt'), `sortOrder` ('asc' | 'desc')
   - Default sort: `next_renewal_date ASC` (soonest renewal first)
   - Returns array of validated Subscription objects

4. `updateSubscription(db, id: string, data: UpdateSubscriptionInput): Subscription`
   - Validates partial input against `UpdateSubscriptionSchema` (Zod `.partial()`)
   - Updates only provided fields
   - Sets `updated_at` to current timestamp
   - If `cost_cents` changes, automatically creates a `sb_price_history` record with old and new values
   - If `billing_cycle` changes and `next_renewal_date` was auto-calculated, recalculates it
   - Returns the updated Subscription

5. `deleteSubscription(db, id: string): boolean`
   - Deletes from `sb_subscriptions` (CASCADE handles related records)
   - Returns true if a row was deleted, false if ID not found

6. `getSubscriptionCount(db, filters?: { status?: string }): number`
   - Returns count of subscriptions matching optional status filter

**Category CRUD:**

7. `listCategories(db): Category[]`
   - Returns all categories sorted by `sort_order` ASC

8. `createCategory(db, data: CreateCategoryInput): Category`
   - Validates input, generates UUID, inserts
   - Returns the new Category

9. `updateCategory(db, id: string, data: UpdateCategoryInput): Category`
   - Updates name, icon, color, or sort_order

10. `deleteCategory(db, id: string): boolean`
    - Deletes category. Subscriptions referencing it get `category_id = NULL` (ON DELETE SET NULL).

**Price History:**

11. `getPriceHistory(db, subscriptionId: string): PriceHistory[]`
    - Returns all price changes for a subscription, sorted by `changed_on` DESC (most recent first)

12. `addPriceChange(db, data: CreatePriceChangeInput): PriceHistory`
    - Manually record a price change (auto-recording happens in `updateSubscription`)

**Renewal Events:**

13. `getUpcomingRenewals(db, daysAhead: number): (Subscription & { renewal_date: string; amount_cents: number })[]`
    - Joins `sb_subscriptions` with `sb_renewal_events` WHERE renewal_date BETWEEN today AND today + daysAhead
    - Returns subscription info with the upcoming renewal date and amount

14. `markRenewalPaid(db, eventId: string): RenewalEvent`
    - Updates `sb_renewal_events` status to 'paid'
    - Generates the next renewal event based on billing cycle

15. `generateRenewalEvents(db, subscriptionId: string, monthsAhead?: number): RenewalEvent[]`
    - For a subscription, generates renewal events for the next N months (default: 12)
    - Uses billing_cycle to calculate dates
    - Inserts into `sb_renewal_events` if they don't already exist (idempotent)

**Cancellation Actions:**

16. `logCancellationAction(db, data: CreateCancellationActionInput): CancellationAction`
    - Records a cancellation workflow action

17. `getCancellationHistory(db, subscriptionId: string): CancellationAction[]`
    - Returns all cancellation actions for a subscription, sorted by `acted_on` DESC

**Price Alternatives:**

18. `listAlternatives(db, subscriptionId: string): PriceAlternative[]`
    - Returns all price alternatives for a subscription

19. `addAlternative(db, data: CreatePriceAlternativeInput): PriceAlternative`
    - Adds a price alternative/competitor for comparison

20. `deleteAlternative(db, id: string): boolean`
    - Removes a price alternative

**Aggregation Queries:**

21. `getTotalMonthlyCost(db, status?: string): number`
    - Sums all subscription costs normalized to monthly, filtered by status (default: 'active')
    - Normalization: weekly * 4.33, monthly * 1, quarterly / 3, yearly / 12, lifetime = 0

22. `getTotalAnnualCost(db, status?: string): number`
    - Same as above but normalized to annual

23. `getCostByCategory(db): { categoryId: string; categoryName: string; totalMonthlyCents: number; count: number }[]`
    - Groups active subscriptions by category with cost sums

24. `getSubscriptionWithDetails(db, id: string): SubscriptionWithDetails | null`
    - Joins subscription with its category, recent price history (last 5), and upcoming renewal events (next 3)
    - Single call for the detail screen

### Edge Cases

- **Empty database:** All list functions return empty arrays. Count returns 0. Cost functions return 0.
- **Null category_id:** Subscriptions without a category are valid. They appear in lists but not in `getCostByCategory` results (grouped under "Uncategorized").
- **Lifetime billing cycle:** Cost normalization returns 0 for monthly/annual calculations. Lifetime subs have no renewal events.
- **Next renewal date in the past:** If a subscription's `next_renewal_date` is before today, `getUpcomingRenewals` won't return it. The UI should flag this as "renewal overdue" separately.
- **Duplicate subscription names:** Allowed. No unique constraint on `name`.
- **Zero-cost subscription:** Valid (e.g., free tier). `cost_cents = 0` is allowed.
- **Price update to same value:** `updateSubscription` should NOT create a price history record if `cost_cents` hasn't actually changed.
- **Very large cost values:** INTEGER in SQLite handles up to 2^63. No practical limit for cents.
- **Search with special characters:** The `search` filter uses SQLite LIKE with `%` wrapping. Escape `%` and `_` in user input.
- **Concurrent writes:** SQLite WAL mode handles this at the adapter level. CRUD functions don't need explicit locking.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Creating a subscription returns a complete, validated Subscription object
- [ ] **AC-2:** Listing subscriptions with no filters returns all subscriptions sorted by next renewal date
- [ ] **AC-3:** Filtering by status returns only matching subscriptions
- [ ] **AC-4:** Searching by name matches partial strings case-insensitively
- [ ] **AC-5:** Updating a subscription's cost automatically creates a price history record
- [ ] **AC-6:** Deleting a subscription removes all associated records (price history, events, actions, alternatives)
- [ ] **AC-7:** Total monthly cost correctly normalizes across all billing cycles
- [ ] **AC-8:** Upcoming renewals returns subscriptions within the specified day range

### Technical Criteria
- [ ] **TC-1:** All CRUD functions accept a DatabaseAdapter as the first argument (dependency injection)
- [ ] **TC-2:** All input data is validated through Zod schemas before SQL execution
- [ ] **TC-3:** All returned data is parsed through Zod schemas (no raw SQL results leak)
- [ ] **TC-4:** UUID generation uses `crypto.randomUUID()` for all new records
- [ ] **TC-5:** `updated_at` is set on every mutation (create and update)
- [ ] **TC-6:** `generateRenewalEvents` is idempotent (no duplicate events for the same date)
- [ ] **TC-7:** Cost normalization matches: weekly * 52, monthly * 12, quarterly * 4, yearly * 1, lifetime = 0 for annual
- [ ] **TC-8:** `getSubscriptionWithDetails` executes in a single transaction (JOIN or batch queries)
- [ ] **TC-9:** All functions are exported from `modules/subs/src/index.ts`
- [ ] **TC-10:** `pnpm typecheck` passes with no errors

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** CRUD functions must NOT execute raw SQL strings with user input interpolation (use parameterized queries)
- [ ] **NC-2:** Price history must NOT be created when cost_cents hasn't actually changed
- [ ] **NC-3:** Deleting a category must NOT delete subscriptions (only nullifies category_id)
- [ ] **NC-4:** CRUD functions must NOT import or depend on UI code
- [ ] **NC-5:** Functions must NOT throw on empty results (return null/empty array instead)

## UI Specification

No UI changes. This is a data access layer.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| N/A | No visible change | Data layer only |

## Test Requirements

### Unit Tests
- [ ] `createSubscription`: valid input returns complete Subscription with generated id
- [ ] `createSubscription`: missing required field (name) throws validation error
- [ ] `createSubscription`: auto-calculates next_renewal_date from start_date + monthly cycle
- [ ] `createSubscription`: auto-calculates next_renewal_date from start_date + yearly cycle
- [ ] `getSubscription`: existing id returns Subscription
- [ ] `getSubscription`: non-existent id returns null
- [ ] `listSubscriptions`: no filters returns all, sorted by next_renewal_date ASC
- [ ] `listSubscriptions`: filter by status='active' returns only active subs
- [ ] `listSubscriptions`: filter by categoryId returns only matching subs
- [ ] `listSubscriptions`: search by partial name matches case-insensitively
- [ ] `listSubscriptions`: sortBy='cost' + sortOrder='desc' returns highest cost first
- [ ] `updateSubscription`: changes name only, leaves other fields unchanged
- [ ] `updateSubscription`: changing cost_cents creates price history record
- [ ] `updateSubscription`: changing cost_cents to same value does NOT create price history
- [ ] `updateSubscription`: non-existent id throws error
- [ ] `deleteSubscription`: removes subscription and cascaded records
- [ ] `deleteSubscription`: non-existent id returns false
- [ ] `getSubscriptionCount`: returns correct count with and without status filter
- [ ] `listCategories`: returns all categories sorted by sort_order
- [ ] `createCategory`: valid input returns Category
- [ ] `deleteCategory`: nullifies category_id on linked subscriptions
- [ ] `getPriceHistory`: returns changes sorted by date DESC
- [ ] `getPriceHistory`: empty history returns empty array
- [ ] `getUpcomingRenewals`: returns only renewals within day range
- [ ] `getUpcomingRenewals`: past renewals not included
- [ ] `generateRenewalEvents`: monthly sub generates 12 events
- [ ] `generateRenewalEvents`: yearly sub generates 1 event per year
- [ ] `generateRenewalEvents`: idempotent (no duplicates on second call)
- [ ] `markRenewalPaid`: sets status to 'paid' and creates next renewal event
- [ ] `getTotalMonthlyCost`: normalizes weekly ($10/wk = $43.30/mo), monthly, quarterly, yearly correctly
- [ ] `getTotalMonthlyCost`: lifetime subscriptions contribute $0
- [ ] `getTotalAnnualCost`: normalizes correctly (monthly * 12, yearly * 1, etc.)
- [ ] `getCostByCategory`: groups correctly with sum and count
- [ ] `getCostByCategory`: uncategorized subs grouped under "Uncategorized"
- [ ] `getSubscriptionWithDetails`: returns joined data in one call
- [ ] `getSubscriptionWithDetails`: non-existent id returns null
- [ ] `logCancellationAction`: creates record with correct fields
- [ ] `listAlternatives`: returns alternatives for a subscription
- [ ] `addAlternative`: creates valid PriceAlternative
- [ ] `deleteAlternative`: removes the alternative

### Integration Tests
- [ ] Full CRUD cycle: create -> read -> update -> read (verify changes) -> delete -> read (null)
- [ ] Price tracking: create sub at $10 -> update to $15 -> update to $20 -> getPriceHistory returns 2 records
- [ ] Renewal generation: create monthly sub -> generateRenewalEvents -> getUpcomingRenewals returns correct events
- [ ] Category lifecycle: create category -> assign to sub -> delete category -> sub still exists with null category_id
- [ ] Aggregation: create 3 subs (monthly $10, yearly $120, weekly $5) -> getTotalMonthlyCost = $10 + $10 + $21.65 = $41.65

### QA Verification Script

1. Open a debug console or test runner
2. Create a subscription: `{ name: 'Netflix', costCents: 2299, billingCycle: 'monthly', startDate: '2025-01-01' }` -- AC-1
3. Verify: Returned object has id, created_at, next_renewal_date -- AC-1
4. Create two more: Spotify (monthly $1099) and iCloud (yearly $1199)
5. Call `listSubscriptions()` -- AC-2
6. Verify: All 3 returned, sorted by next_renewal_date -- AC-2
7. Call `listSubscriptions({ status: 'active' })` -- AC-3
8. Verify: All 3 returned (all active) -- AC-3
9. Call `listSubscriptions({ search: 'net' })` -- AC-4
10. Verify: Only Netflix returned -- AC-4
11. Update Netflix cost to 2499 -- AC-5
12. Call `getPriceHistory(netflixId)` -- AC-5
13. Verify: 1 record with old=2299, new=2499 -- AC-5
14. Delete Netflix -- AC-6
15. Verify: getPriceHistory returns empty array (cascaded) -- AC-6
16. Call `getTotalMonthlyCost()` with remaining 2 subs -- AC-7
17. Verify: $10.99 + ($11.99/12 = $1.00) = ~$11.99 -- AC-7
18. Call `getUpcomingRenewals(30)` -- AC-8
19. Verify: Returns subs with next renewal within 30 days -- AC-8

## gstack Quality Gates

Based on Complexity score 3 (Moderate), these gates are required:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- subs has no standalone counterpart, N/A
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Database schema exists (V1 migration, 6 tables). No way to read or write data programmatically.

### After This Work
- Complete data access layer: 24 functions covering all 6 tables.
- Zod-validated inputs and outputs.
- Automatic price history tracking on cost changes.
- Renewal event generation and management.
- Cost normalization and aggregation queries.

### Files Changed
- `modules/subs/src/db/crud.ts` -- NEW: All CRUD operations (24 functions)
- `modules/subs/src/db/queries.ts` -- NEW: Complex query helpers (aggregations, joins)
- `modules/subs/src/db/__tests__/crud.test.ts` -- NEW: Comprehensive CRUD tests
- `modules/subs/src/types.ts` -- MODIFY: Add Create/Update input schemas, filter types, SubscriptionWithDetails type
- `modules/subs/src/index.ts` -- MODIFY: Export all CRUD functions

### Known Limitations
- **No batch operations.** There's no `createSubscriptions` (plural) for bulk import. A future import feature would need this.
- **No pagination.** `listSubscriptions` returns all matching results. For the Subs module, this is fine (users rarely have 100+ subscriptions). If scale becomes an issue, add `limit`/`offset` parameters.
- **No full-text search.** The `search` filter uses LIKE, not FTS5. Sufficient for subscription name matching.

### Context for Next Agent
- All functions take `db: DatabaseAdapter` as the first argument. Get the adapter from the module lifecycle system.
- Zod schemas for input validation live in `modules/subs/src/types.ts`. Use `CreateSubscriptionSchema.parse(data)` before inserting.
- Cost normalization constants: weekly to monthly = * (52/12), weekly to annual = * 52. Monthly to annual = * 12. Quarterly to annual = * 4. Yearly to annual = * 1. Lifetime = 0.
- The `generateRenewalEvents` function is designed to be called once when a subscription is created, then `markRenewalPaid` generates the next event as each renewal passes. Don't regenerate all events on every access.
- Price history auto-creation in `updateSubscription` requires reading the current `cost_cents` before updating. Use a transaction to avoid race conditions.
