/**
 * Property 13: Module data deletion clears all prefixed tables.
 *
 * For any module with a known table prefix, deleteModuleData results in
 * zero rows remaining, zero tables with that prefix, and schema version removed.
 *
 * Validates: Requirements 17.1, 17.3, 5.6
 *
 * R17.1: Delete all local data for the module (all prefixed tables dropped).
 * R17.3: Reset schema version so migrations re-run on next enable.
 * R5.6: Per-module deletion as part of data portability/privacy controls.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createHubTestDatabase } from '../test-utils';
import type { InMemoryTestDatabase } from '../test-utils';
import {
  deleteModuleData,
  getModuleTableStats,
  getModuleSchemaVersion,
  enableModule,
  isModuleEnabled,
  upsertDashboardCard,
  getDashboardLayout,
  recordHealthConsent,
  hasActiveHealthConsent,
  CLOUD_STORAGE_MODULES,
} from '../hub-queries';

// All modules with known table prefixes (source: module-registry constants.ts)
const ALL_MODULES = [
  { id: 'books', prefix: 'bk_' },
  { id: 'budget', prefix: 'bg_' },
  { id: 'car', prefix: 'cr_' },
  { id: 'closet', prefix: 'cl_' },
  { id: 'cycle', prefix: 'cy_' },
  { id: 'fast', prefix: 'ft_' },
  { id: 'flash', prefix: 'fl_' },
  { id: 'forums', prefix: 'fr_' },
  { id: 'garden', prefix: 'gd_' },
  { id: 'habits', prefix: 'hb_' },
  { id: 'health', prefix: 'hl_' },
  { id: 'homes', prefix: 'hm_' },
  { id: 'journal', prefix: 'jn_' },
  { id: 'mail', prefix: 'ml_' },
  { id: 'market', prefix: 'mk_' },
  { id: 'meds', prefix: 'md_' },
  { id: 'mood', prefix: 'mo_' },
  { id: 'notes', prefix: 'nt_' },
  { id: 'nutrition', prefix: 'nu_' },
  { id: 'pets', prefix: 'pt_' },
  { id: 'presence', prefix: 'pr_' },
  { id: 'recipes', prefix: 'rc_' },
  { id: 'rsvp', prefix: 'rv_' },
  { id: 'stars', prefix: 'st_' },
  { id: 'subs', prefix: 'sb_' },
  { id: 'surf', prefix: 'sf_' },
  { id: 'trails', prefix: 'tr_' },
  { id: 'voice', prefix: 'vc_' },
  { id: 'words', prefix: 'wd_' },
  { id: 'workouts', prefix: 'wk_' },
] as const;

// Arbitraries
const moduleArb = fc.constantFrom(...ALL_MODULES);
const moduleSubsetArb = fc.subarray([...ALL_MODULES], { minLength: 1, maxLength: 6 });
const tableCountArb = fc.integer({ min: 1, max: 5 });
const rowCountArb = fc.integer({ min: 1, max: 10 });

/**
 * Seed N tables with the given prefix and R rows each.
 * Also seeds schema version records.
 */
function seedModuleTables(
  db: InMemoryTestDatabase,
  prefix: string,
  moduleId: string,
  tableCount: number,
  rowsPerTable: number,
): string[] {
  const tableNames: string[] = [];
  const suffixes = ['items', 'settings', 'logs', 'entries', 'metadata'];

  for (let t = 0; t < tableCount; t++) {
    const name = `${prefix}${suffixes[t]}`;
    tableNames.push(name);
    db.adapter.execute(
      `CREATE TABLE IF NOT EXISTS "${name}" (id INTEGER PRIMARY KEY, data TEXT)`,
    );
    for (let r = 1; r <= rowsPerTable; r++) {
      db.adapter.execute(`INSERT INTO "${name}" (id, data) VALUES (?, ?)`, [
        t * 1000 + r,
        `${moduleId}-data-${r}`,
      ]);
    }
  }

  // Seed schema versions
  for (let v = 1; v <= tableCount; v++) {
    db.adapter.execute(
      `INSERT OR IGNORE INTO hub_schema_versions (module_id, version) VALUES (?, ?)`,
      [moduleId, v],
    );
  }

  return tableNames;
}

// ── Test setup ──────────────────────────────────────────────────────────

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createHubTestDatabase();
});

afterEach(() => {
  testDb.close();
});

// ── Property 13: Module data deletion clears all prefixed tables ────────

describe('Property 13: Module data deletion clears all prefixed tables', () => {
  it('for any module, deletion drops all prefixed tables to zero (R17.1)', () => {
    fc.assert(
      fc.property(moduleArb, tableCountArb, rowCountArb, ({ id, prefix }, tables, rows) => {
        const db = createHubTestDatabase();
        try {
          seedModuleTables(db, prefix, id, tables, rows);

          // Pre-condition: tables exist with data
          const before = getModuleTableStats(db.adapter, prefix);
          expect(before.length).toBe(tables);
          const totalRows = before.reduce((sum, s) => sum + s.rowCount, 0);
          expect(totalRows).toBe(tables * rows);

          // Act
          const result = deleteModuleData(db.adapter, id, prefix);

          // Post-condition: zero tables remain
          const after = getModuleTableStats(db.adapter, prefix);
          expect(after).toHaveLength(0);
          expect(result.tablesDropped).toBe(tables);
          expect(result.moduleId).toBe(id);
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('for any module, deletion removes all schema version records (R17.3)', () => {
    fc.assert(
      fc.property(moduleArb, tableCountArb, ({ id, prefix }, tables) => {
        const db = createHubTestDatabase();
        try {
          seedModuleTables(db, prefix, id, tables, 1);

          // Pre-condition: schema version exists
          expect(getModuleSchemaVersion(db.adapter, id)).toBe(tables);

          // Act
          const result = deleteModuleData(db.adapter, id, prefix);

          // Post-condition: schema version reset to 0
          expect(getModuleSchemaVersion(db.adapter, id)).toBe(0);
          expect(result.schemaVersionsCleared).toBe(tables);
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('for any module, deletion disables the module and cleans hub records (R5.6)', () => {
    fc.assert(
      fc.property(moduleArb, ({ id, prefix }) => {
        const db = createHubTestDatabase();
        try {
          // Setup: enable module, add dashboard card, seed tables
          enableModule(db.adapter, id);
          upsertDashboardCard(db.adapter, id, { position: 0 });
          seedModuleTables(db, prefix, id, 2, 3);

          expect(isModuleEnabled(db.adapter, id)).toBe(true);
          expect(getDashboardLayout(db.adapter).some((c) => c.module_id === id)).toBe(true);

          // Act
          deleteModuleData(db.adapter, id, prefix);

          // Post-condition: module disabled, dashboard card removed
          expect(isModuleEnabled(db.adapter, id)).toBe(false);
          expect(getDashboardLayout(db.adapter).some((c) => c.module_id === id)).toBe(false);
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('deleting one module does not affect another modules tables', () => {
    fc.assert(
      fc.property(
        moduleArb,
        moduleArb,
        tableCountArb,
        rowCountArb,
        ({ id: idA, prefix: prefA }, { id: idB, prefix: prefB }, tables, rows) => {
          fc.pre(idA !== idB);

          const db = createHubTestDatabase();
          try {
            enableModule(db.adapter, idA);
            enableModule(db.adapter, idB);
            seedModuleTables(db, prefA, idA, tables, rows);
            seedModuleTables(db, prefB, idB, tables, rows);

            // Delete module A only
            deleteModuleData(db.adapter, idA, prefA);

            // Module A: gone
            expect(getModuleTableStats(db.adapter, prefA)).toHaveLength(0);
            expect(getModuleSchemaVersion(db.adapter, idA)).toBe(0);
            expect(isModuleEnabled(db.adapter, idA)).toBe(false);

            // Module B: intact
            const statsB = getModuleTableStats(db.adapter, prefB);
            expect(statsB.length).toBe(tables);
            const totalB = statsB.reduce((sum, s) => sum + s.rowCount, 0);
            expect(totalB).toBe(tables * rows);
            expect(getModuleSchemaVersion(db.adapter, idB)).toBe(tables);
            expect(isModuleEnabled(db.adapter, idB)).toBe(true);
          } finally {
            db.close();
          }
        },
      ),
      { numRuns: 10 },
    );
  });

  it('deletion is idempotent: re-deleting a cleared module is a safe no-op', () => {
    fc.assert(
      fc.property(moduleArb, tableCountArb, ({ id, prefix }, tables) => {
        const db = createHubTestDatabase();
        try {
          enableModule(db.adapter, id);
          seedModuleTables(db, prefix, id, tables, 2);

          // Delete once
          deleteModuleData(db.adapter, id, prefix);
          expect(getModuleTableStats(db.adapter, prefix)).toHaveLength(0);

          // Delete again: no error, same result
          const result = deleteModuleData(db.adapter, id, prefix);
          expect(result.tablesDropped).toBe(0);
          expect(result.schemaVersionsCleared).toBe(0);
          expect(getModuleTableStats(db.adapter, prefix)).toHaveLength(0);
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('batch deletion across a random module subset leaves all clean (R5.6)', () => {
    fc.assert(
      fc.property(moduleSubsetArb, (modules) => {
        const db = createHubTestDatabase();
        try {
          // Seed all modules in subset
          for (const { id, prefix } of modules) {
            enableModule(db.adapter, id);
            seedModuleTables(db, prefix, id, 2, 3);
          }

          // Delete all
          for (const { id, prefix } of modules) {
            deleteModuleData(db.adapter, id, prefix);
          }

          // Verify all clean
          for (const { id, prefix } of modules) {
            expect(getModuleTableStats(db.adapter, prefix)).toHaveLength(0);
            expect(getModuleSchemaVersion(db.adapter, id)).toBe(0);
            expect(isModuleEnabled(db.adapter, id)).toBe(false);
          }
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('cloud modules are flagged with hasCloudData, local modules are not (R17.4)', () => {
    fc.assert(
      fc.property(moduleArb, ({ id, prefix }) => {
        const db = createHubTestDatabase();
        try {
          seedModuleTables(db, prefix, id, 1, 1);

          const result = deleteModuleData(db.adapter, id, prefix);

          expect(result.hasCloudData).toBe(CLOUD_STORAGE_MODULES.has(id));
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('health consent records are cleaned up during deletion', () => {
    // Only test health-eligible modules
    const healthModules = ALL_MODULES.filter((m) =>
      ['cycle', 'fast', 'habits', 'health', 'meds', 'mood', 'nutrition', 'presence', 'workouts'].includes(m.id),
    );
    const healthModuleArb = fc.constantFrom(...healthModules);

    fc.assert(
      fc.property(healthModuleArb, ({ id, prefix }) => {
        const db = createHubTestDatabase();
        try {
          recordHealthConsent(db.adapter, id, ['vitals']);
          enableModule(db.adapter, id);
          seedModuleTables(db, prefix, id, 2, 2);

          expect(hasActiveHealthConsent(db.adapter, id)).toBe(true);

          deleteModuleData(db.adapter, id, prefix);

          expect(hasActiveHealthConsent(db.adapter, id)).toBe(false);
          expect(getModuleTableStats(db.adapter, prefix)).toHaveLength(0);
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });
});
