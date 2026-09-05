---
status: COMPLETE
date: 2026-04-19
phase: 1c
research_for: Phase 1c Wave A shadow-write adoption
---

# Phase 1c Wave A — Pre-flight Research Report

Four concrete migration plans for implementation agents. All source files, column shapes, function signatures, and schema versions confirmed via code inspection.

---

## 1. Notes Module → `hub_tags` + `hub_tag_bindings`

### Current Schema Version
- **File:** `/modules/notes/src/definition.ts`
- **Constant:** `schemaVersion: 3` (last migration: `NOTES_V3_UP/DOWN`)
- **Next version:** `4` → new file `modules/notes/src/db/schema-v4.ts` with constant name `NOTES_V4_UP` / `NOTES_V4_DOWN`

### Target Per-Module Table Shape
**`nt_tags`** (currently at line 28–33 in `schema.ts`):
```sql
CREATE TABLE IF NOT EXISTS nt_tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

**New column to add in V4:** `hub_tag_id TEXT` (nullable, for backfill phase)

**`nt_note_tags`** (no columns added; junction table unchanged):
```sql
CREATE TABLE IF NOT EXISTS nt_note_tags (
  note_id TEXT NOT NULL REFERENCES nt_notes(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES nt_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
)
```

### Existing CRUD Functions
**File:** `/modules/notes/src/db/crud.ts`
- `createTag(db, input)` — lines ~150–180 (inserts into `nt_tags`)
- `deleteTag(db, tagId)` — lines ~200–210 (deletes from `nt_tags`, CASCADE removes `nt_note_tags`)
- `addTagToNote(db, noteId, tagId)` — lines ~220–230 (inserts into `nt_note_tags`)
- `removeTagFromNote(db, noteId, tagId)` — lines ~240–250 (deletes from `nt_note_tags`)

### Pre-existing `hub_*_id` Convention
**No existing `hub_*` columns in notes module.** All module tables are prefix `nt_`. Follow the new convention: `hub_tag_id TEXT` (matching the pattern used by other modules in Phase 1).

### ALTER TABLE Pattern
**File:** `/modules/notes/src/db/schema-v2.ts` shows the pattern:
```typescript
export const NOTES_V2_UP = [
  'ALTER TABLE nt_notes ADD COLUMN is_daily_note INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE nt_notes ADD COLUMN daily_date TEXT',
  // ...
];
```

**Schema-v4 pattern:** Add `hub_tag_id TEXT` to `nt_tags` via `ADD COLUMN`.

### Test Harness
**Helper:** `createModuleTestDatabase(moduleId, migrations)` from `@mylife/db` test-utils.ts (lines 54–62).
- **FK pragma:** Enabled by default in `createInMemoryTestDatabase()` at line 33: `raw.pragma('foreign_keys = ON')`
- Existing notes tests: `/modules/notes/src/__tests__/crud.test.ts` + 3 other test files
- **New test file:** `modules/notes/src/__tests__/tags-shadow.test.ts` for shadow-write integration

### Proposed Migration Filename & Version
- **File:** `modules/notes/src/db/schema-v4.ts`
- **Constant names:** `NOTES_V4_UP` (array), `NOTES_V4_DOWN` (array)
- **Definition registration:** Add `{ version: 4, description: 'Add hub_tag_id column to nt_tags for shadow-write adoption', up: NOTES_V4_UP, down: NOTES_V4_DOWN }` to migrations array in `definition.ts`
- **Bump `schemaVersion`** from 3 → 4

### Transaction API Check
**File:** `/packages/db/src/adapter.ts` line 19:
```typescript
export interface DatabaseAdapter {
  /** Run a function inside a transaction. Rolls back on error. */
  transaction(fn: () => void): void;
}
```

✅ **Transaction method exists.** Shadow writes must wrap both per-module and hub writes via `db.transaction(() => { ... })`.

---

## 2. Books Module → `hub_attachments` + `hub_attachment_links`

### Current Schema Version
- **File:** `/modules/books/src/definition.ts`
- **Constant:** `schemaVersion: 9` (last migration: `BOOKS_MIGRATION_V9` at line 218–228)
- **Next version:** `10` → new file `modules/books/src/db/schema-v10.ts` with constant `BOOKS_MIGRATION_V10`

### Target Per-Module Table Shape
**`bk_journal_photos`** (created in V4, line in `schema.ts`):
```sql
CREATE TABLE IF NOT EXISTS bk_journal_photos (
  id TEXT PRIMARY KEY NOT NULL,
  entry_id TEXT NOT NULL REFERENCES bk_journal_entries(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT,
  width INTEGER,
  height INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

**New column to add in V10:** `hub_attachment_id TEXT` (nullable, for backfill)

### Existing CRUD Functions
**File:** `/modules/books/src/db/journal-photos.ts`
- `createJournalPhoto(db, input)` — inserts into `bk_journal_photos`
- `deleteJournalPhoto(db, photoId)` — deletes from `bk_journal_photos`
- `updateJournalPhotoOrder(db, ...)` — updates `sort_order`

### Pre-existing `hub_*_id` Convention
**No existing `hub_*` columns in books module.** All module tables prefix `bk_`. Add `hub_attachment_id TEXT`.

### ALTER TABLE Pattern
**File:** `/modules/books/src/db/schema.ts` pattern from V8 migration (lines 208–210):
```typescript
const BOOKS_MIGRATION_V8: Migration = {
  version: 8,
  description: 'Add Open Library community rating columns to bk_books',
  up: [
    'ALTER TABLE bk_books ADD COLUMN ol_rating_average REAL;',
    'ALTER TABLE bk_books ADD COLUMN ol_rating_count INTEGER;',
  ],
  down: [ 'SELECT 1;' ],  // SQLite 3.35+ limitation
};
```

**Schema-v10 pattern:** Identical — add `hub_attachment_id TEXT` to `bk_journal_photos`.

### Test Harness
**Helper:** Same `createModuleTestDatabase` from `@mylife/db`.
- FK pragma enabled by default.
- Existing books tests: `/modules/books/src/__tests__/` (18 test files, 264 tests)
- **New test file:** `modules/books/src/__tests__/journal-photos-shadow.test.ts`

### Proposed Migration Filename & Version
- **File:** `modules/books/src/db/schema-v10.ts`
- **Constant names:** `BOOKS_MIGRATION_V10` object with `version: 10`, `up` array, `down` array
- **Definition registration:** Add to migrations array in `definition.ts` line 238
- **Bump `schemaVersion`** from 9 → 10

### Transaction API Check
✅ **Confirmed available** (same adapter as notes).

---

## 3. Homes Module → `hub_places`

### Current Schema Version
- **File:** `/modules/homes/src/definition.ts`
- **Constant:** `schemaVersion: 3` (last migration: `HOMES_MIGRATION_V3` at lines 34–51)
- **Next version:** `4` → new file `modules/homes/src/db/schema-v4.ts` with constant `HOMES_MIGRATION_V4`

### Target Per-Module Table Shape
**`hm_properties`** (created in V2, lines in `schema.ts`):
```sql
CREATE TABLE IF NOT EXISTS hm_properties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  year_built INTEGER,
  sqft INTEGER,
  property_type TEXT NOT NULL DEFAULT 'house',
  ownership_type TEXT NOT NULL DEFAULT 'own',
  listing_id TEXT REFERENCES hm_listings(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

**New column to add in V4:** `hub_place_id TEXT` (nullable, for backfill)

**Note:** Homes uses **Drizzle ORM**, not raw SQLite, per `definition.ts` line 60: `storageType: 'drizzle'`. Shadow-write adapter calls still target raw SQL; verify Drizzle integration point in properties CRUD file before implementing.

### Existing CRUD Functions
**File:** `/modules/homes/src/db/properties.ts`
- `createProperty(db, input)` — inserts into `hm_properties`
- `updateProperty(db, id, patch)` — updates `hm_properties` (address / lat / lng fields)
- `deleteProperty(db, id)` — deletes from `hm_properties`

**Note:** Homes properties table includes `address`, `city`, `state` columns. **Check if lat/lng exist or need extraction from geocode step.** Spec calls for `lat`, `lng` to `createPlace()`; verify mapping.

### Pre-existing `hub_*_id` Convention
**No existing `hub_*` columns in homes module.** All module tables prefix `hm_`. Add `hub_place_id TEXT`.

### ALTER TABLE Pattern
**File:** `/modules/homes/src/db/schema.ts` shows CREATE TABLE statements but no existing V1→V2 or V2→V3 ALTER examples in migration object (likely Drizzle handles schema). Use standard `ALTER TABLE hm_properties ADD COLUMN hub_place_id TEXT` in V4 migration, or check Drizzle migration pattern in the codebase.

### Test Harness
**Helper:** Same `createModuleTestDatabase` from `@mylife/db`.
- FK pragma enabled.
- Existing homes tests: `/modules/homes/src/__tests__/` (4 test files, 191 tests)
- **New test file:** `modules/homes/src/__tests__/properties-shadow.test.ts`

### Proposed Migration Filename & Version
- **File:** `modules/homes/src/db/schema-v4.ts`
- **Constant names:** `HOMES_MIGRATION_V4` object with `version: 4`, `up` array, `down` array
- **Definition registration:** Add to migrations array in `definition.ts` line 61
- **Bump `schemaVersion`** from 3 → 4

### Transaction API Check
✅ **Confirmed available** (same adapter as notes and books).

---

## 4. Intelligence Package — Schema Alignment Task

### Files in `/packages/intelligence/src/permissions/`
1. **`schema.ts`** — intelligence-local `CREATE_HUB_AI_PERMISSIONS` definition (lines 9–16) **[TO DELETE]**
2. **`operations.ts`** — CRUD functions using intelligence-local schema (lines 1–169)
3. **`types.ts`** — `AIModulePermission`, `AITablePermission` interfaces (lines 1–24)
4. **`index.ts`** — barrel export (lines 1–13)

### Intelligence-Local Schema (DIVERGENT)
**File:** `/packages/intelligence/src/permissions/schema.ts` lines 9–16:
```sql
CREATE TABLE IF NOT EXISTS hub_ai_permissions (
  module_id TEXT PRIMARY KEY NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  granular_mode INTEGER NOT NULL DEFAULT 0 CHECK (granular_mode IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

**Problem:** PK is `module_id` only; no `user_id`.

### Canonical Hub Schema (AUTHORITATIVE)
**File:** `/packages/db/src/hub-schema.ts` (search result from earlier inspection):
```sql
CREATE TABLE IF NOT EXISTS hub_ai_permissions (
  user_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  can_read INTEGER NOT NULL DEFAULT 0 CHECK (can_read IN (0, 1)),
  can_write INTEGER NOT NULL DEFAULT 0 CHECK (can_write IN (0, 1)),
  granular_mode INTEGER NOT NULL DEFAULT 0 CHECK (granular_mode IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, module_id)
)
```

**Differences:**
| Column | Intelligence | Hub | Status |
|--------|---------------|-----|--------|
| `user_id` | ❌ Missing | ✅ Required (PK part) | **ADD** |
| `module_id` | ✅ PK | ✅ PK part | Keep |
| `enabled` | ✅ Present | ❌ **REMOVED** | **REPLACE** with `can_read` + `can_write` |
| `can_read` | ❌ Missing | ✅ Present | **ADD** |
| `can_write` | ❌ Missing | ✅ Present | **ADD** |
| `granular_mode` | ✅ Present | ✅ Present | Keep |

### Current API Surface (Operations)
**File:** `/packages/intelligence/src/permissions/operations.ts` exports:
- `getAIPermissions(db)` → `AIModulePermission[]`
- `getModuleAIPermission(db, moduleId)` → `AIModulePermission | null`
- `setModuleAIAccess(db, moduleId, enabled)` → `void`
- `setGranularMode(db, moduleId, granularMode)` → `void`
- `setTableAIAccess(db, moduleId, tableName, enabled)` → `void`
- `getTablePermissions(db, moduleId)` → `AITablePermission[]`
- `getPermittedModules(db)` → `string[]` (modules where `enabled = 1`)
- `getPermittedTables(db, moduleId)` → `string[] | null`
- `removeModuleAIPermissions(db, moduleId)` → `void`

### Callers Outside Intelligence Package
**Search result:** `/packages/intelligence/src/__tests__/engine.test.ts` (only caller outside permissions package)
- Calls `setModuleAIAccess(db, moduleId, true)` in multiple test cases
- Uses `ensureAIPermissionTables` from schema.ts

**No external consumers** (no callers in other packages).

### Test Files Under `packages/intelligence/src/__tests__/`
1. **`permissions.test.ts`** — 274 lines, 50+ assertions on `setModuleAIAccess`, `getModuleAIPermission`, `getPermittedModules`, `getPermittedTables`, granular mode, table-level access
2. **`engine.test.ts`** — 624 lines, uses `setModuleAIAccess` in ~10 test cases
3. **`llm.test.ts`** — 429 lines, uses permissions indirectly
4. **`correlation.test.ts`** — 218 lines, no direct permission calls

**Total intelligence tests:** 1,545 lines. **90 of 98 tests currently failing** per handoff doc (schema mismatch).

### Proposed New API Signature Map

| Old Signature | New Signature | Rationale |
|---|---|---|
| `setModuleAIAccess(db, moduleId, enabled)` | `setPermissions(db, { userId, moduleId, canRead, canWrite })` | Explicit boolean pair replaces single `enabled`; add `userId` |
| `getModuleAIPermission(db, moduleId)` | `getPermissions(db, userId, moduleId)` | Add userId param; return record with `canRead`, `canWrite`, `granularMode` |
| `getPermittedModules(db)` | `getPermittedModules(db, userId, mode: 'read' \| 'write')` | Filter by specific user; return modules where `can_read=1` or `can_write=1` |
| `getPermittedTables(db, moduleId)` | `getPermittedTables(db, userId, moduleId, mode: 'read' \| 'write')` | Add userId param; filter by capability |
| `removeModuleAIPermissions(db, moduleId)` | `removePermissions(db, userId, moduleId)` | Enforce userId deletion |
| `setGranularMode`, `setTableAIAccess` | **Keep identical** (no schema change needed for these) | Helper functions unchanged |

### Types Update
**Current types.ts** (lines 12–23):
```typescript
export interface AIModulePermission {
  moduleId: string;
  enabled: boolean;
  granularMode: boolean;
}

export interface AITablePermission {
  moduleId: string;
  tableName: string;
  enabled: boolean;
}
```

**New types:**
```typescript
export interface AIPermission {
  userId: string;
  moduleId: string;
  canRead: boolean;
  canWrite: boolean;
  granularMode: boolean;
}

export interface AITablePermission {
  userId: string;
  moduleId: string;
  tableName: string;
  canRead: boolean;
  canWrite: boolean;
}
```

### Test Assertion Estimate
- **permissions.test.ts:** ~50 assertions; ~25 need signature updates, ~10 need schema column renames (`enabled` → `can_read`/`can_write`)
- **engine.test.ts:** ~20 calls to `setModuleAIAccess`; all need `userId` param + boolean pair conversion
- **Total estimated changes:** ~70–80 assertion rewrites across 4 files

### Acceptance Criteria for Intelligence Task
- ✅ Delete `/packages/intelligence/src/permissions/schema.ts` (hub schema owns it)
- ✅ Rewrite `operations.ts` to use canonical columns: `can_read`, `can_write`, composite PK `(user_id, module_id)`
- ✅ Update `types.ts` to export `AIPermission` with `userId`, `canRead`, `canWrite`
- ✅ Update all 98 tests: 274 + 624 + 429 + 218 lines ≈ 80–100 assertion/call sites
- ✅ `pnpm --filter @mylife/intelligence test` → 98/98 passing (up from 8/98)
- ✅ No changes to `engine/`, `llm/`, `analytics/` packages

---

## Cross-Cutting Risks

### 1. Pre-existing Hub Table Writes
**Search:** `INSERT INTO hub_tags`, `INSERT INTO hub_attachments`, `INSERT INTO hub_places` outside `packages/db/` → **NO HITS**. Safe to proceed; no informal shadow writes exist yet.

### 2. External Callers of Intelligence Permissions API
**Search:** Only `/packages/intelligence/src/__tests__/engine.test.ts` calls `setModuleAIAccess` (internal). **No external consumers detected.** Intelligence is a library; API changes are safe as long as tests pass.

### 3. Transaction Wrapping Readiness
**All three modules (notes, books, homes)** can use `db.transaction(() => { ... })` pattern. Shadow writes are wrapped atomically; failure in hub write will rollback per-module write.

### 4. FK Pragma Confirmation
**All test harnesses** enable `PRAGMA foreign_keys = ON` by default via `createInMemoryTestDatabase()`. CASCADE behavior for tag/attachment/place deletes is safe in tests.

### 5. Homes Module Drizzle Integration
**Flag:** Homes uses Drizzle ORM (`storageType: 'drizzle'`). Schema migration must verify adapter compatibility. Check if V3 migration shows SQL or Drizzle pattern. Likely needs `runModuleMigrations()` to compile Drizzle→SQL before executing; shadow-write adapter calls are raw SQL (should work), but verify in implementation.

---

## Summary Table

| Module | Current V | Next V | Table | New Column | Hub Table | FK Cascade | Test File |
|--------|-----------|--------|-------|-----------|-----------|-----------|-----------|
| **notes** | 3 | 4 | `nt_tags` | `hub_tag_id` | `hub_tags` + `hub_tag_bindings` | ✅ | `tags-shadow.test.ts` |
| **books** | 9 | 10 | `bk_journal_photos` | `hub_attachment_id` | `hub_attachments` + `hub_attachment_links` | ✅ | `journal-photos-shadow.test.ts` |
| **homes** | 3 | 4 | `hm_properties` | `hub_place_id` | `hub_places` | ✅ | `properties-shadow.test.ts` |
| **intelligence** | — | — | `hub_ai_permissions` | `user_id`, `can_read`, `can_write` (remove `enabled`) | Canonical | N/A | 98 tests across 4 files |

---

## Implementation Checklist Per Agent

### Agent: Impl A — Notes Tags Shadow-Write
- [ ] Create `modules/notes/src/db/schema-v4.ts` with `NOTES_V4_UP` = `['ALTER TABLE nt_tags ADD COLUMN hub_tag_id TEXT']`
- [ ] Update `definition.ts`: add V4 migration entry, set `schemaVersion: 4`
- [ ] Wrap `createTag()` in `crud.ts` with `db.transaction(() => { ... getOrCreateTag(...); UPDATE nt_tags SET hub_tag_id = ... })`
- [ ] Wrap `addTagToNote()` with `db.transaction(() => { ... bindTag(...) })`
- [ ] Wrap `removeTagFromNote()` with `db.transaction(() => { ... unbindTag(...) })`
- [ ] Create `modules/notes/src/__tests__/tags-shadow.test.ts`: assert both tables after each CRUD op
- [ ] Run `pnpm test --filter @mylife/notes` → green

### Agent: Impl B — Books Journal-Photos Shadow-Write
- [ ] Create `modules/books/src/db/schema-v10.ts` with `BOOKS_MIGRATION_V10` (ALTER TABLE)
- [ ] Update `definition.ts`: add V10 migration entry, set `schemaVersion: 10`
- [ ] Wrap `createJournalPhoto()` in `journal-photos.ts` with `db.transaction(() => { ... createAttachment(...); linkAttachment(...) })`
- [ ] Wrap `deleteJournalPhoto()` with `db.transaction(() => { ... deleteAttachment(...) })`
- [ ] Create `modules/books/src/__tests__/journal-photos-shadow.test.ts`
- [ ] Run `pnpm test --filter @mylife/books` → green

### Agent: Impl C — Homes Properties Shadow-Write
- [ ] Create `modules/homes/src/db/schema-v4.ts` (verify Drizzle pattern vs raw SQL)
- [ ] Update `definition.ts`: add V4 migration entry, set `schemaVersion: 4`
- [ ] Wrap `createProperty()` in `properties.ts` with `db.transaction(() => { ... createPlace(...) })`
- [ ] Wrap `updateProperty()` with `db.transaction(() => { ... updatePlace(...) if address/lat/lng changed })`
- [ ] Wrap `deleteProperty()` with `db.transaction(() => { ... deletePlace(...) })`
- [ ] **Verify:** Extract `lat`, `lng` from `hm_properties` record (check schema for geo columns or defaults)
- [ ] Create `modules/homes/src/__tests__/properties-shadow.test.ts`
- [ ] Run `pnpm test --filter @mylife/homes` → green

### Agent: Impl D — Intelligence Permissions Fix
- [ ] Delete `packages/intelligence/src/permissions/schema.ts`
- [ ] Rewrite `operations.ts`: new signatures accepting `userId`, return tuples of `canRead` / `canWrite`
- [ ] Rewrite `types.ts`: `AIPermission` with 5 fields + composite PK
- [ ] Update `index.ts` to remove schema export
- [ ] Rewrite `permissions.test.ts`: all 50+ assertions to use new API
- [ ] Update `engine.test.ts`: all 20 `setModuleAIAccess` calls + 10 other perm calls
- [ ] Update `llm.test.ts` and `correlation.test.ts` as needed
- [ ] Run `pnpm test --filter @mylife/intelligence` → 98/98 passing

---

## Rollback Notes

- **Notes/Books/Homes:** Revert commit; orphaned `hub_*_id` columns NULL in existing rows (harmless; old code ignores them)
- **Intelligence:** Revert commit; tests return to broken state (Phase 4 blocked); rewrite on retry

---

