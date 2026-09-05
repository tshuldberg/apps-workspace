# Phase 0 Research — Four Critical Fixes

**Date:** 2026-04-18  
**Role:** Research Lead (read-only investigation)  
**Scope:** Root cause analysis for 4 Phase 0 blockers; all fixes must land before Phase 1 expansion

---

## Fix 1: Habits V2 Migration — `period_id` FK Reference Bug

### Root Cause

The habits V2 migration creates `hb_period_symptoms` table with a NOT NULL foreign key `period_id TEXT REFERENCES hb_periods(id) ON DELETE CASCADE`. This table duplicates cycle tracking functionality that was moved to the dedicated `@mylife/cycle` module in a later release. The migration order is correct (`hb_periods` created before `hb_period_symptoms`), but the actual issue is:

- **Fresh installs:** If a user creates the database with V2 migrations enabled, `hb_periods`, `hb_period_symptoms`, `hb_predictions`, and `hb_cycle_settings` are created as unused duplicates annotated as "Deprecated" in CLAUDE.md but remaining in schema.
- **For existing users:** Existing data in these tables is preserved, but the cycle module now owns `cy_*` tables, creating dual tracking burden.
- **Failure mode:** If V2 migration runs and application code tries to insert into `hb_period_symptoms` without ensuring `hb_periods` has the matching record, a FK constraint violation occurs.

### Files to Edit

1. **`modules/habits/src/db/schema.ts`** (lines 79–116)
   - Remove `CREATE_HB_PERIODS`, `CREATE_HB_PERIOD_SYMPTOMS`, `CREATE_HB_PREDICTIONS`, `CREATE_HB_CYCLE_SETTINGS`
   - Remove these from `ALL_V2_TABLES` array
   - Remove related indexes from `V2_INDEXES`

2. **`modules/habits/src/definition.ts`** (lines 6, 13–21, 44)
   - Remove cycle-related imports
   - Update V2 migration description: "V2 -- habit types, timed sessions, measurements (cycle tracking removed; use @mylife/cycle instead)"
   - Do NOT increment schemaVersion

3. **`modules/habits/src/cycle/symptoms.ts`** — **DELETE entire file**
   - This references `hb_period_symptoms` which will not exist

### Regression Tests

1. Fresh install V1 → V2 migrations: verify `hb_timed_sessions`, `hb_measurements` exist but `hb_periods` does NOT
2. Existing user migration: verify old data preserved but new instances don't write to cycle tables
3. Cross-module isolation: verify `@mylife/cycle` initialization doesn't conflict

### Risk Notes

**Impact:** Moderate. Fresh installs unaffected. Existing users with V2-era `hb_period_symptoms` data retain it but app won't use it. No data loss.

---

## Fix 2: Garden V2 Migration — `status` Column Defensive Querying

### Root Cause

Garden V1 schema defines `gd_plants` with `status TEXT NOT NULL DEFAULT 'healthy'`. The column exists but `modules/garden/src/db/crud-v2.ts` line 59 (`getZoneStats` function) queries it without defensive null-handling:

```sql
SUM(CASE WHEN status = 'healthy' THEN 1 ELSE 0 END) as healthy,
```

If the column is null or missing in a corrupted/partial migration, this fails with a missing-column error. While the column is created in V1 (correct order), defensive querying makes the function resilient.

### Files to Edit

1. **`modules/garden/src/db/crud-v2.ts`** (lines 59–60)
   - Change both CASE statements to use `COALESCE(status, 'healthy')`
   - Example: `SUM(CASE WHEN COALESCE(status, 'healthy') = 'healthy' THEN 1 ELSE 0 END) as healthy,`

### Regression Tests

1. V1-only: verify `status` column exists with default 'healthy'
2. V1 + V2: verify `status` persists and `getZoneStats` works
3. Partial DB: manually delete `status` column; verify `getZoneStats` fails gracefully with clear error
4. Status filtering: verify queries like `WHERE status = 'dead'` continue working

### Risk Notes

**Impact:** Low-to-Moderate. The column is created in V1 and should always exist. This is a defensive safeguard. Adding COALESCE is backwards-compatible and has minimal performance cost.

---

## Fix 3: SQLite Backup End-to-End Wiring

### Root Cause

Backup system is schema-complete and UI-complete but **initialization and automation are missing:**

- Backend CRUD: fully implemented ✓
- Mobile screen: fully implemented ✓
- Web screen: fully implemented ✓
- **Missing:** Hub schema initialization (tables not created) + auto-backup scheduler

### Files to Edit

1. **`packages/db/src/index.ts`** (or hub initialization)
   - Add BACKUP_TABLES to hub schema migration
   - Ensures `hub_backups` and `hub_backup_config` created on first launch

2. **`apps/mobile/lib/backup-scheduler.ts`** — **NEW FILE**
   - Implement `checkAndCreateAutoBackup()` that calls `createBackup(..., { type: 'auto' })`
   - Hook into app lifecycle (check if 24h since last auto-backup)

3. **`apps/web/lib/backup-scheduler.ts`** — **NEW FILE**
   - Implement server action `checkAndCreateAutoBackupAction()`
   - Call on page load (debounce to once per 24h)

4. **`apps/mobile/app/_layout.tsx`** (lifecycle hook)
   - Call auto-backup scheduler on app init/foreground

5. **`apps/web/app/layout.tsx`** (root layout)
   - Call auto-backup check on page load

### Minimum Functional Shape

User can:
1. Tap "Backup Now" → `.sqlite` file created → appears in list
2. Enable "Daily Auto-Backup" → system checks daily automatically
3. Tap "Export" → share sheet opens → send to email/cloud
4. Tap "Import Backup" → pick file → validation check → confirm overwrite → restore
5. Tap "Restore" → confirmation → database restored (app restart needed)
6. Tap "Delete" → confirmation → backup removed

### Regression Tests

1. Schema initialization: Fresh install → verify tables exist
2. Manual backup workflow: create → verify file → restore → verify data intact
3. Auto-backup trigger: enable → wait 24h (or mock) → verify backup created
4. Export/import: export → delete original → import → restore → verify data
5. Retention policy: create 10 auto-backups → verify only `maxDaily` retained
6. Restore validation: create backup → corrupt → attempt restore → validation rejects with clear error

### Risk Notes

**Impact:** High-visibility but low-risk. Users can already create manual backups; auto-backup adds convenience. I/O-bound but fast (<1s typical). No data corruption risk.

---

## Fix 4: 7 `react-hooks/rules-of-hooks` Violations in apps/mobile

### Root Cause

`react-hooks/rules-of-hooks` is set to `warn` (not `error`) in `packages/eslint-config/index.js` line 31 to avoid blocking commits. When flipped to `error`, 7 pre-existing violations surface:

- Conditional hook calls (e.g., `if (condition) useEffect(...)`)
- Hooks inside loops
- Hooks after early returns
- Hooks in try/catch blocks with early throw

These are real render-order bugs causing silent state/effect misalignment.

### Pattern: Estimated Violations

**Bad pattern:**
```typescript
function Screen() {
  if (condition) {
    useEffect(() => { /* setup */ }, []); // VIOLATION
  }
}
```

**Good pattern (extract component):**
```typescript
function Effect() {
  useEffect(() => { /* setup */ }, []);
  return null;
}

function Screen() {
  return condition ? <Effect /> : null;
}
```

**Or hoist hook, move condition inside:**
```typescript
function Screen() {
  useEffect(() => {
    if (!condition) return;
    // ... setup
  }, [condition]);
}
```

### Files to Edit

1. **Identify violations:**
   ```bash
   npm run lint:check 2>&1 | grep "rules-of-hooks" | grep "apps/mobile"
   ```

2. **For each violation, refactor:**
   - Conditional effect: hoist hook, move condition into body
   - Conditional callback: extract component or memoize with condition inside
   - Loop/forEach: extract item into separate component
   - Early return in try/catch: restructure error handling outside hook

3. **`packages/eslint-config/index.js`** (line 31)
   - Change `'react-hooks/rules-of-hooks': 'warn'` to `'error'`

### Regression Tests

For each fixed violation:
1. Component renders without warnings
2. Hook indices don't shift across re-renders
3. Feature that was broken now works (e.g., timer starts/stops correctly)

### Risk Notes

**Impact:** Medium. Real bugs but currently silent. Flipping to error blocks commits until fixed. Total work: ~30–60 min for all 7.

---

## Cross-Cutting Risks

### 1. Collision with In-Flight Work

From memory.md: budget, habits, stars in dirty worktree; MyBooks P4-E partial. Phase 0 fixes touch only:
- `modules/habits/src/db/` + `definition.ts` ✓
- `modules/garden/src/db/` ✓
- `packages/db/src/backup/` ✓
- `apps/{mobile,web}/app/*/backup.tsx` ✓
- 7 specific mobile files + eslint-config ✓

No collision.

### 2. Migration Reachability

**Habits:** Remove buggy tables only affects fresh installs after fix. Recommend adding cleanup migration V8 to drop old tables from existing users.

**Garden:** Defensive COALESCE in CRUD makes code resilient to status issues.

### 3. Backup Schema & Phase 1

Phase 1 adds 11 `hub_*` tables. Backup system reads `hub_schema_versions` and `hub_enabled_modules` (stable). No action now, but during Phase 1 ensure backup validation updated if schema tracking changes.

---

## Summary: Files to Edit

| Fix | File | Lines | Change |
|-----|------|-------|--------|
| 1a | `modules/habits/src/db/schema.ts` | 79–116 | Remove 4 hb_period* tables + update arrays |
| 1b | `modules/habits/src/definition.ts` | 6, 13–21, 44 | Remove cycle imports + update V2 description |
| 1c | `modules/habits/src/cycle/symptoms.ts` | entire | DELETE |
| 2a | `modules/garden/src/db/crud-v2.ts` | 59–60 | Add COALESCE(status, 'healthy') |
| 3a | `packages/db/src/index.ts` | (init) | Add BACKUP_TABLES to hub schema |
| 3b–3c | `apps/{mobile,web}/lib/backup-scheduler.ts` | NEW | Create auto-backup scheduler |
| 3d–3e | `apps/{mobile,web}/app/*/layout.tsx` | (lifecycle) | Call auto-backup check |
| 4a–4g | 7 mobile files (per violations) | ~60–140 each | Refactor conditional hooks |
| 4h | `packages/eslint-config/index.js` | 31 | Flip rules-of-hooks to 'error' |

---

**End of Phase 0 Research**  
Next step: Implementation agents begin Fixes 1–4 in parallel, targeting completion before Phase 1 expansion.
