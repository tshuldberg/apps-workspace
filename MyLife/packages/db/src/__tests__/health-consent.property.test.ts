/**
 * Property tests for health data consent (Properties 8-9).
 *
 * Property 8: Health data consent gating -- Validates: Requirements 3.4, 3.5, 6.6
 *   For any module in the health data module list, enabling the module without
 *   prior consent should trigger the consent dialog, and the module should not
 *   collect data until consent is recorded.
 *
 * Property 9: Health data deletion completeness -- Validates: Requirements 3.8
 *   For any subset of health-related modules with stored data, requesting
 *   health data deletion should result in zero rows remaining in all health
 *   data tables for those modules.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createHubTestDatabase } from '../test-utils';
import type { InMemoryTestDatabase } from '../test-utils';
import {
  getHealthConsent,
  hasActiveHealthConsent,
  listAllHealthConsents,
  recordHealthConsent,
  withdrawHealthConsent,
  deleteModuleData,
  getModuleTableStats,
  enableModule,
  isModuleEnabled,
} from '../hub-queries';

// ── Health module constants (mirrored from @mylife/module-registry) ──────

/**
 * The 10 modules that collect Consumer Health Data per MHMDA/NV SB 370/CT CTDPA.
 * Mirrors HEALTH_DATA_MODULE_IDS from @mylife/module-registry.
 */
const HEALTH_MODULES = [
  { id: 'cycle', prefix: 'cy_' },
  { id: 'fast', prefix: 'ft_' },
  { id: 'habits', prefix: 'hb_' },
  { id: 'health', prefix: 'hl_' },
  { id: 'meds', prefix: 'md_' },
  { id: 'mood', prefix: 'mo_' },
  { id: 'nutrition', prefix: 'nu_' },
  { id: 'presence', prefix: 'pr_' },
  { id: 'sleep', prefix: 'sl_' },
  { id: 'workouts', prefix: 'wk_' },
] as const;

const HEALTH_MODULE_IDS = HEALTH_MODULES.map((m) => m.id);

/** Sample data types presented in consent dialogs. */
const SAMPLE_DATA_TYPES = [
  'vital signs',
  'sleep data',
  'medication names',
  'mood ratings',
  'exercise sessions',
  'fasting periods',
];

// ── Arbitraries ─────────────────────────────────────────────────────────

const healthModuleArb = fc.constantFrom(...HEALTH_MODULES);
const healthModuleIdArb = fc.constantFrom(...HEALTH_MODULE_IDS);
const dataTypesArb = fc.subarray(SAMPLE_DATA_TYPES, { minLength: 1, maxLength: 4 });
const healthModuleSubsetArb = fc.subarray([...HEALTH_MODULES], { minLength: 1 });

// ── Test setup ──────────────────────────────────────────────────────────

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createHubTestDatabase();
});

afterEach(() => {
  testDb.close();
});

// ── Property 8: Health data consent gating ──────────────────────────────
// Validates: Requirements 3.4, 3.5, 6.6

describe('Property 8: Health data consent gating', () => {
  it('for any health module, no active consent exists before recording (R3.4)', () => {
    fc.assert(
      fc.property(healthModuleIdArb, (moduleId) => {
        const db = createHubTestDatabase();
        try {
          expect(hasActiveHealthConsent(db.adapter, moduleId)).toBe(false);
          expect(getHealthConsent(db.adapter, moduleId)).toBeUndefined();
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('for any health module, consent is active after recording (R3.4)', () => {
    fc.assert(
      fc.property(healthModuleIdArb, dataTypesArb, (moduleId, dataTypes) => {
        const db = createHubTestDatabase();
        try {
          recordHealthConsent(db.adapter, moduleId, dataTypes);

          expect(hasActiveHealthConsent(db.adapter, moduleId)).toBe(true);

          const consent = getHealthConsent(db.adapter, moduleId);
          expect(consent).toBeDefined();
          expect(consent!.moduleId).toBe(moduleId);
          expect(consent!.dataTypes).toEqual(dataTypes);
          expect(consent!.consentedAt).toBeTruthy();
          expect(consent!.withdrawnAt).toBeNull();
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('for any health module, consent is inactive after withdrawal (R3.5)', () => {
    fc.assert(
      fc.property(healthModuleIdArb, dataTypesArb, (moduleId, dataTypes) => {
        const db = createHubTestDatabase();
        try {
          recordHealthConsent(db.adapter, moduleId, dataTypes);
          expect(hasActiveHealthConsent(db.adapter, moduleId)).toBe(true);

          withdrawHealthConsent(db.adapter, moduleId);
          expect(hasActiveHealthConsent(db.adapter, moduleId)).toBe(false);

          const consent = getHealthConsent(db.adapter, moduleId);
          expect(consent).toBeDefined();
          expect(consent!.withdrawnAt).not.toBeNull();
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('for any health module, re-consenting after withdrawal reactivates (R6.6)', () => {
    fc.assert(
      fc.property(healthModuleIdArb, dataTypesArb, dataTypesArb, (moduleId, types1, types2) => {
        const db = createHubTestDatabase();
        try {
          // Record -> withdraw -> re-record
          recordHealthConsent(db.adapter, moduleId, types1);
          withdrawHealthConsent(db.adapter, moduleId);
          expect(hasActiveHealthConsent(db.adapter, moduleId)).toBe(false);

          recordHealthConsent(db.adapter, moduleId, types2);
          expect(hasActiveHealthConsent(db.adapter, moduleId)).toBe(true);

          const consent = getHealthConsent(db.adapter, moduleId);
          expect(consent!.dataTypes).toEqual(types2);
          expect(consent!.withdrawnAt).toBeNull();
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('withdrawing consent on a module without consent is a safe no-op', () => {
    fc.assert(
      fc.property(healthModuleIdArb, (moduleId) => {
        const db = createHubTestDatabase();
        try {
          withdrawHealthConsent(db.adapter, moduleId);
          expect(hasActiveHealthConsent(db.adapter, moduleId)).toBe(false);
          expect(getHealthConsent(db.adapter, moduleId)).toBeUndefined();
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('consent for one module does not affect other modules (R3.4 isolation)', () => {
    fc.assert(
      fc.property(
        healthModuleIdArb,
        healthModuleIdArb,
        dataTypesArb,
        (moduleA, moduleB, dataTypes) => {
          fc.pre(moduleA !== moduleB);

          const db = createHubTestDatabase();
          try {
            recordHealthConsent(db.adapter, moduleA, dataTypes);

            expect(hasActiveHealthConsent(db.adapter, moduleA)).toBe(true);
            expect(hasActiveHealthConsent(db.adapter, moduleB)).toBe(false);
          } finally {
            db.close();
          }
        },
      ),
      { numRuns: 10 },
    );
  });

  it('listAllHealthConsents returns exactly the recorded subset', () => {
    fc.assert(
      fc.property(healthModuleSubsetArb, dataTypesArb, (modules, dataTypes) => {
        const db = createHubTestDatabase();
        try {
          for (const { id } of modules) {
            recordHealthConsent(db.adapter, id, dataTypes);
          }

          const all = listAllHealthConsents(db.adapter);
          const recordedIds = new Set(all.map((c) => c.moduleId));

          expect(all.length).toBe(modules.length);
          for (const { id } of modules) {
            expect(recordedIds.has(id)).toBe(true);
          }

          for (const consent of all) {
            expect(consent.dataTypes).toEqual(dataTypes);
            expect(consent.consentedAt).toBeTruthy();
          }
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('data types round-trip through JSON serialization without loss', () => {
    fc.assert(
      fc.property(healthModuleIdArb, dataTypesArb, (moduleId, dataTypes) => {
        const db = createHubTestDatabase();
        try {
          recordHealthConsent(db.adapter, moduleId, dataTypes);

          const consent = getHealthConsent(db.adapter, moduleId);
          expect(consent).toBeDefined();
          // Exact array equality: order and values preserved
          expect(consent!.dataTypes).toEqual(dataTypes);
          expect(Array.isArray(consent!.dataTypes)).toBe(true);
          for (const dt of consent!.dataTypes) {
            expect(typeof dt).toBe('string');
          }
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });
});

// ── Property 9: Health data deletion completeness ───────────────────────
// Validates: Requirements 3.8

describe('Property 9: Health data deletion completeness', () => {
  /**
   * Create sample module tables and seed them with data.
   * Returns the table names created.
   */
  function seedModuleData(
    db: InMemoryTestDatabase,
    prefix: string,
    moduleId: string,
  ): string[] {
    const tables = [`${prefix}entries`, `${prefix}settings`, `${prefix}logs`];
    for (const table of tables) {
      db.adapter.execute(
        `CREATE TABLE IF NOT EXISTS "${table}" (id TEXT PRIMARY KEY, data TEXT)`,
      );
      db.adapter.execute(`INSERT INTO "${table}" (id, data) VALUES (?, ?)`, [
        `${moduleId}-1`,
        'sample-data',
      ]);
      db.adapter.execute(`INSERT INTO "${table}" (id, data) VALUES (?, ?)`, [
        `${moduleId}-2`,
        'sample-data',
      ]);
    }
    return tables;
  }

  it('for any health module with data, deleteModuleData results in zero remaining tables (R3.8)', () => {
    fc.assert(
      fc.property(healthModuleArb, dataTypesArb, ({ id, prefix }, dataTypes) => {
        const db = createHubTestDatabase();
        try {
          // Seed: consent + module tables with data
          recordHealthConsent(db.adapter, id, dataTypes);
          enableModule(db.adapter, id);
          seedModuleData(db, prefix, id);

          // Verify data exists before deletion
          const statsBefore = getModuleTableStats(db.adapter, prefix);
          expect(statsBefore.length).toBeGreaterThan(0);
          const totalRowsBefore = statsBefore.reduce((sum, s) => sum + s.rowCount, 0);
          expect(totalRowsBefore).toBeGreaterThan(0);

          // Delete all module data
          const result = deleteModuleData(db.adapter, id, prefix);
          expect(result.moduleId).toBe(id);
          expect(result.tablesDropped).toBeGreaterThan(0);

          // Verify: zero tables remain with this prefix (tables are dropped, not just cleared)
          const statsAfter = getModuleTableStats(db.adapter, prefix);
          expect(statsAfter.length).toBe(0);

          // Verify: consent record also removed
          expect(getHealthConsent(db.adapter, id)).toBeUndefined();

          // Verify: module no longer enabled
          expect(isModuleEnabled(db.adapter, id)).toBe(false);
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('for any subset of health modules, batch deletion results in zero rows across all (R3.8)', () => {
    fc.assert(
      fc.property(healthModuleSubsetArb, dataTypesArb, (modules, dataTypes) => {
        const db = createHubTestDatabase();
        try {
          // Seed data for all modules in the subset
          for (const { id, prefix } of modules) {
            recordHealthConsent(db.adapter, id, dataTypes);
            enableModule(db.adapter, id);
            seedModuleData(db, prefix, id);
          }

          // Verify data exists for each module
          for (const { prefix } of modules) {
            const stats = getModuleTableStats(db.adapter, prefix);
            expect(stats.length).toBeGreaterThan(0);
          }

          // Delete all health data across all modules in the subset
          for (const { id, prefix } of modules) {
            deleteModuleData(db.adapter, id, prefix);
          }

          // Verify: zero tables and zero consent for each
          for (const { id, prefix } of modules) {
            const stats = getModuleTableStats(db.adapter, prefix);
            expect(stats.length).toBe(0);
            expect(getHealthConsent(db.adapter, id)).toBeUndefined();
            expect(isModuleEnabled(db.adapter, id)).toBe(false);
          }
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('deleting one health module does not affect other modules data', () => {
    fc.assert(
      fc.property(
        healthModuleArb,
        healthModuleArb,
        dataTypesArb,
        ({ id: idA, prefix: prefA }, { id: idB, prefix: prefB }, dataTypes) => {
          fc.pre(idA !== idB);

          const db = createHubTestDatabase();
          try {
            // Seed data for both modules
            recordHealthConsent(db.adapter, idA, dataTypes);
            recordHealthConsent(db.adapter, idB, dataTypes);
            enableModule(db.adapter, idA);
            enableModule(db.adapter, idB);
            seedModuleData(db, prefA, idA);
            seedModuleData(db, prefB, idB);

            // Delete module A only
            deleteModuleData(db.adapter, idA, prefA);

            // Module A: fully deleted
            expect(getModuleTableStats(db.adapter, prefA).length).toBe(0);
            expect(getHealthConsent(db.adapter, idA)).toBeUndefined();
            expect(isModuleEnabled(db.adapter, idA)).toBe(false);

            // Module B: completely intact
            const statsB = getModuleTableStats(db.adapter, prefB);
            expect(statsB.length).toBeGreaterThan(0);
            const totalB = statsB.reduce((sum, s) => sum + s.rowCount, 0);
            expect(totalB).toBeGreaterThan(0);
            expect(hasActiveHealthConsent(db.adapter, idB)).toBe(true);
            expect(isModuleEnabled(db.adapter, idB)).toBe(true);
          } finally {
            db.close();
          }
        },
      ),
      { numRuns: 10 },
    );
  });

  it('deletion is idempotent: deleting an already-deleted module is a safe no-op', () => {
    fc.assert(
      fc.property(healthModuleArb, dataTypesArb, ({ id, prefix }, dataTypes) => {
        const db = createHubTestDatabase();
        try {
          recordHealthConsent(db.adapter, id, dataTypes);
          enableModule(db.adapter, id);
          seedModuleData(db, prefix, id);

          // Delete once
          deleteModuleData(db.adapter, id, prefix);

          // Delete again: should not throw
          const result = deleteModuleData(db.adapter, id, prefix);
          expect(result.tablesDropped).toBe(0);

          // Still clean
          expect(getModuleTableStats(db.adapter, prefix).length).toBe(0);
          expect(getHealthConsent(db.adapter, id)).toBeUndefined();
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });
});
