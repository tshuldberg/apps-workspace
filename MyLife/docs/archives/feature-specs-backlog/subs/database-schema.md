# Feature Spec: Database Schema

## Metadata
- **Module:** subs
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 5 x3 + Complexity 3 x2 + CrossModule 0 x1 + PaidUser 0 x1
- **Sprint:** Sprint 8
- **Estimated CC Time:** 2-3 hours
- **Depends On:** none
- **Blocks:** All CRUD functions, UI, Cost analysis, Renewal calendar, Subscription detection, Cancellation assist, Price comparison

## Business Context

### Why This Feature Exists
MySubs currently has Zod type definitions and a ModuleDefinition but zero SQLite tables. Without a schema, no data can be persisted, no CRUD can function, and no UI can render meaningful content. This is the foundational P0 blocker for the entire module. Every other Subs feature depends on tables existing.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Rocket Money | Yes | Yes ($48-144/yr) | Cloud-based relational database with bank sync integration. Stores subscription data linked to transaction history. |
| Bobby | Yes | No ($1.99 one-time) | Local database with simple subscription records, categories, and renewal tracking. |

### Target User
Anyone who wants to track their subscriptions locally without sharing financial data with a cloud service. Users coming from Rocket Money ($48-144/yr) who want privacy-first subscription tracking. Users coming from Bobby ($1.99 one-time) who want a more comprehensive feature set within a larger personal management suite.

## Technical Context

### Where This Lives in MyLife

```
modules/subs/src/
  db/
    schema.ts              -- NEW: All sb_ table DDL statements
    migrations.ts          -- NEW: V1 migration definition
  types.ts                 -- MODIFY: Add new Zod schemas for all table shapes
  definition.ts            -- MODIFY: Add V1 migration reference, bump schemaVersion to 1
  index.ts                 -- MODIFY: Export new types and migration
```

### Wireframe Position

```
Hub Dashboard
  └── MySubs card
       └── (not visible to users -- infrastructure only)
```

This is a backend-only feature. No UI changes.

### Data Model

```sql
-- Core subscription tracking
CREATE TABLE IF NOT EXISTS sb_subscriptions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('weekly', 'monthly', 'quarterly', 'yearly', 'lifetime')),
  category_id TEXT REFERENCES sb_categories(id) ON DELETE SET NULL,
  next_renewal_date TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  trial_end_date TEXT,
  icon_uri TEXT,
  url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled', 'trial', 'expired')),
  notification_enabled INTEGER NOT NULL DEFAULT 1,
  notification_days_before INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS sb_subscriptions_status_idx
  ON sb_subscriptions(status);
CREATE INDEX IF NOT EXISTS sb_subscriptions_next_renewal_idx
  ON sb_subscriptions(next_renewal_date);
CREATE INDEX IF NOT EXISTS sb_subscriptions_category_idx
  ON sb_subscriptions(category_id);

-- Subscription categories (user-defined + defaults)
CREATE TABLE IF NOT EXISTS sb_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Price change history per subscription
CREATE TABLE IF NOT EXISTS sb_price_history (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES sb_subscriptions(id) ON DELETE CASCADE,
  old_cost_cents INTEGER NOT NULL,
  new_cost_cents INTEGER NOT NULL,
  changed_on TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS sb_price_history_sub_idx
  ON sb_price_history(subscription_id);
CREATE INDEX IF NOT EXISTS sb_price_history_date_idx
  ON sb_price_history(changed_on);

-- Renewal events / notification log
CREATE TABLE IF NOT EXISTS sb_renewal_events (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES sb_subscriptions(id) ON DELETE CASCADE,
  renewal_date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'paid', 'skipped', 'missed')),
  notified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS sb_renewal_events_sub_idx
  ON sb_renewal_events(subscription_id);
CREATE INDEX IF NOT EXISTS sb_renewal_events_date_idx
  ON sb_renewal_events(renewal_date);

-- Cancellation workflow actions
CREATE TABLE IF NOT EXISTS sb_cancellation_actions (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES sb_subscriptions(id) ON DELETE CASCADE,
  action TEXT NOT NULL
    CHECK (action IN ('dismissed', 'reminded', 'cancelled', 'downgraded', 'kept')),
  savings_cents INTEGER,
  notes TEXT,
  acted_on TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS sb_cancellation_actions_sub_idx
  ON sb_cancellation_actions(subscription_id);
CREATE INDEX IF NOT EXISTS sb_cancellation_actions_action_idx
  ON sb_cancellation_actions(action);

-- Price alternatives for comparison shopping
CREATE TABLE IF NOT EXISTS sb_price_alternatives (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES sb_subscriptions(id) ON DELETE CASCADE,
  alternative_name TEXT NOT NULL,
  alternative_cost_cents INTEGER NOT NULL,
  alternative_billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (alternative_billing_cycle IN ('weekly', 'monthly', 'quarterly', 'yearly', 'lifetime')),
  alternative_url TEXT,
  notes TEXT,
  is_free_tier INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS sb_price_alternatives_sub_idx
  ON sb_price_alternatives(subscription_id);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter, migration runner), `@mylife/module-registry` (ModuleDefinition with migrations array)
- **External:** None
- **Cross-Module:** None. This is self-contained infrastructure.

## Functional Requirements

### User Stories
1. As a developer, I want a complete SQLite schema for the Subs module so that all downstream features (CRUD, UI, engines) have tables to operate on.
2. As the migration system, I want a V1 migration that creates all tables idempotently so that enabling the module provisions the database correctly.

### Behavior Specification

1. When the user enables the Subs module from the hub dashboard, the module lifecycle triggers migration execution.
2. The V1 migration runs all `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` statements.
3. After migration, `sb_categories` is seeded with default categories:
   - Streaming (icon: `tv`, color: `#E50914`)
   - Music (icon: `music`, color: `#1DB954`)
   - Cloud Storage (icon: `cloud`, color: `#4285F4`)
   - Productivity (icon: `briefcase`, color: `#FF6900`)
   - Gaming (icon: `gamepad-2`, color: `#9146FF`)
   - News & Media (icon: `newspaper`, color: `#1A1A1A`)
   - Health & Fitness (icon: `heart`, color: `#FF2D55`)
   - Education (icon: `graduation-cap`, color: `#00B4D8`)
   - Shopping (icon: `shopping-cart`, color: `#FF9900`)
   - Other (icon: `tag`, color: `#6B7280`)
4. Tables use TEXT for dates (ISO 8601 format), INTEGER for monetary amounts (cents), and TEXT for UUIDs.
5. All tables have `created_at` timestamps. Mutable tables also have `updated_at`.

### Edge Cases

- **Module enabled multiple times:** `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` are idempotent. No errors.
- **Module disabled then re-enabled:** Data is preserved. Tables are not dropped. Migration is skipped if already at V1.
- **Category seeding on re-enable:** Check for existing categories before inserting defaults. Only seed if `sb_categories` is empty.
- **Foreign key cascade on subscription delete:** Price history, renewal events, cancellation actions, and price alternatives are all CASCADE deleted. This is intentional -- deleting a subscription removes all associated data.
- **Concurrent migration:** The migration runner handles locking. No special handling needed in the migration itself.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Enabling the Subs module from the hub dashboard succeeds without errors
- [ ] **AC-2:** Default categories appear immediately after first enable (10 categories)

### Technical Criteria
- [ ] **TC-1:** V1 migration creates all 6 tables: `sb_subscriptions`, `sb_categories`, `sb_price_history`, `sb_renewal_events`, `sb_cancellation_actions`, `sb_price_alternatives`
- [ ] **TC-2:** All indexes are created (8 total across all tables)
- [ ] **TC-3:** Foreign key constraints work correctly (inserting a subscription with invalid category_id fails)
- [ ] **TC-4:** CASCADE delete works: deleting a subscription removes all linked price history, events, actions, and alternatives
- [ ] **TC-5:** CHECK constraints enforce valid values for billing_cycle, status, and action columns
- [ ] **TC-6:** Default category seeding inserts exactly 10 rows with correct names, icons, and colors
- [ ] **TC-7:** Migration is idempotent: running V1 twice produces no errors and no duplicate data
- [ ] **TC-8:** `definition.ts` has `schemaVersion: 1` and migrations array contains the V1 migration
- [ ] **TC-9:** All new Zod schemas parse valid data correctly and reject invalid data
- [ ] **TC-10:** `pnpm typecheck` passes with no errors in the subs module

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Migration must NOT modify any tables outside the `sb_` prefix
- [ ] **NC-2:** Default categories must NOT be re-inserted if categories already exist
- [ ] **NC-3:** Disabling the module must NOT drop tables or delete data

## UI Specification

No UI changes. This is infrastructure only.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| N/A | No visible change | Migration runs silently during module enable |

## Test Requirements

### Unit Tests
- [ ] V1 migration DDL executes without errors on a fresh in-memory SQLite database
- [ ] All 6 tables exist after migration (query `sqlite_master`)
- [ ] All 8 indexes exist after migration
- [ ] Default categories seeded: 10 rows in `sb_categories`
- [ ] Foreign key constraint: inserting into `sb_price_history` with non-existent `subscription_id` fails
- [ ] CASCADE delete: inserting a subscription + price history, then deleting the subscription, removes the price history
- [ ] CHECK constraint: inserting a subscription with `billing_cycle = 'biweekly'` fails
- [ ] CHECK constraint: inserting a subscription with `status = 'unknown'` fails
- [ ] Idempotency: running migration twice produces no errors and same table count
- [ ] Zod schema: `SubscriptionSchema` parses valid subscription row
- [ ] Zod schema: `SubscriptionSchema` rejects missing `name` field
- [ ] Zod schema: `CategorySchema` parses valid category row
- [ ] Zod schema: `PriceHistorySchema` rejects negative `old_cost_cents`

### Integration Tests
- [ ] Full lifecycle: enable module -> migration runs -> insert subscription -> query it back -> disable module -> re-enable -> data still exists

### QA Verification Script

1. Start the app fresh (or reset Subs module data)
2. Navigate to Hub Dashboard > Discover
3. Find MySubs and tap "Enable"
4. Verify: No error messages appear -- AC-1
5. (Developer check) Query `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'sb_%'` -- TC-1
6. Verify: 6 tables returned -- TC-1
7. Query `SELECT COUNT(*) FROM sb_categories` -- TC-6
8. Verify: Returns 10 -- TC-6, AC-2
9. Insert a test subscription via code/debug console
10. Delete the test subscription
11. Verify: No orphaned price history or events remain -- TC-4
12. Disable Subs module
13. Re-enable Subs module
14. Verify: Previously inserted categories still exist, no duplicates -- TC-7, NC-2

## gstack Quality Gates

Based on Complexity score 3 (Moderate), these gates are required:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if Complexity <= 2 (Large/Complex):
- N/A (Complexity = 3)

### Required if this feature contains business logic / calculation engine:
- N/A (no engine, just DDL)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- subs has no standalone counterpart, N/A
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- `modules/subs/src/` has only 3 files: `definition.ts` (ModuleDefinition with empty migrations array), `types.ts` (Zod schemas for Subscription and BillingCycle), `index.ts` (re-exports).
- No SQLite tables exist. `schemaVersion: 0`. No routes, no CRUD, no UI.

### After This Work
- 6 SQLite tables with proper indexes, foreign keys, and check constraints.
- V1 migration in `definition.ts` with `schemaVersion: 1`.
- Updated Zod types covering all table shapes (Subscription, Category, PriceHistory, RenewalEvent, CancellationAction, PriceAlternative).
- Default category seeding (10 categories).
- All downstream features unblocked.

### Files Changed
- `modules/subs/src/db/schema.ts` -- NEW: DDL statements for all 6 tables + indexes
- `modules/subs/src/db/migrations.ts` -- NEW: V1 migration function (creates tables, seeds categories)
- `modules/subs/src/types.ts` -- MODIFY: Add Zod schemas for Category, PriceHistory, RenewalEvent, CancellationAction, PriceAlternative, SubscriptionStatus
- `modules/subs/src/definition.ts` -- MODIFY: Set schemaVersion to 1, add V1 migration to migrations array
- `modules/subs/src/index.ts` -- MODIFY: Export new types and migration
- `modules/subs/src/__tests__/schema.test.ts` -- NEW: Migration and schema tests

### Known Limitations
- **No data migration from Budget module.** The Budget module has its own `bg_subscriptions` table. If the user has subscriptions tracked in Budget, they won't automatically appear in Subs. A future cross-module import feature could address this.
- **No subscription catalog.** Unlike Budget's 215-entry catalog, Subs starts with empty subscription data. Users add their own. A catalog could be added in a future sprint.
- **Category system is simple.** No nested categories or tagging. Each subscription belongs to at most one category.

### Context for Next Agent
- All table names use the `sb_` prefix. This is set in `definition.ts` via `tablePrefix: 'sb_'`.
- Monetary values are stored as integers in cents (`cost_cents`, `old_cost_cents`, `new_cost_cents`, `amount_cents`, `savings_cents`). Never store dollars as floats.
- Dates are ISO 8601 TEXT strings. Use `datetime('now')` for SQLite defaults.
- IDs are TEXT (UUID v4). Generate with `crypto.randomUUID()` in the CRUD layer.
- The `sb_categories` table is seeded on first migration only. Check `SELECT COUNT(*) FROM sb_categories` before seeding to avoid duplicates on re-migration.
- Foreign keys require `PRAGMA foreign_keys = ON` at connection time. The `@mylife/db` DatabaseAdapter handles this.
- The `sb_subscriptions.status` column replaces the simpler `isActive` boolean from the original Zod type. Status values: `active`, `paused`, `cancelled`, `trial`, `expired`.
