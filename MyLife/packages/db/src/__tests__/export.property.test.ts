/**
 * Property tests for data export (Properties 11-12).
 *
 * Property 11: Data export round-trip completeness -- Validates: Requirements 5.1, 5.2
 *   For any set of modules with known prefixes and seeded data,
 *   exportAllModules returns every row from every prefixed table,
 *   and JSON round-trip preserves all values.
 *
 * Property 12: Export error resilience -- Validates: Requirements 5.7
 *   For any mix of working and broken modules, working modules export
 *   successfully while broken modules get error notes without blocking.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createHubTestDatabase } from '../test-utils';
import type { InMemoryTestDatabase } from '../test-utils';
import type { DatabaseAdapter } from '../adapter';
import {
  exportAllModules,
  type ExportableModule,
  type HubExportData,
} from '../export';

// ── Test modules with distinct prefixes ─────────────────────────────────

const TEST_MODULES = [
  { id: 'books', prefix: 'bk_' },
  { id: 'budget', prefix: 'bg_' },
  { id: 'health', prefix: 'hl_' },
  { id: 'meds', prefix: 'md_' },
  { id: 'mood', prefix: 'mo_' },
  { id: 'journal', prefix: 'jn_' },
  { id: 'notes', prefix: 'nt_' },
  { id: 'cycle', prefix: 'cy_' },
] as const;

// ── Arbitraries ─────────────────────────────────────────────────────────

/** Pick a non-empty subset of test modules. */
const moduleSubsetArb = fc.subarray([...TEST_MODULES], { minLength: 1 });

/** Generate 1-4 table suffixes for a module (e.g. "items", "settings"). */
const tableSuffixesArb = fc.subarray(
  ['items', 'settings', 'logs', 'entries', 'tags', 'prefs'],
  { minLength: 1, maxLength: 4 },
);

/** Generate 1-5 rows of simple data. */
const rowCountArb = fc.integer({ min: 1, max: 5 });

// ── Helpers ─────────────────────────────────────────────────────────────

function createModuleTables(
  adapter: DatabaseAdapter,
  prefix: string,
  suffixes: string[],
): string[] {
  const tables = suffixes.map((s) => `${prefix}${s}`);
  for (const table of tables) {
    adapter.execute(
      `CREATE TABLE IF NOT EXISTS "${table}" (id TEXT PRIMARY KEY, name TEXT, value TEXT)`,
    );
  }
  return tables;
}

function seedRows(
  adapter: DatabaseAdapter,
  table: string,
  count: number,
): Array<{ id: string; name: string; value: string }> {
  const rows: Array<{ id: string; name: string; value: string }> = [];
  for (let i = 0; i < count; i++) {
    const row = {
      id: `${table}-${i}`,
      name: `name-${i}`,
      value: `val-${i}`,
    };
    adapter.execute(
      `INSERT INTO "${table}" (id, name, value) VALUES (?, ?, ?)`,
      [row.id, row.name, row.value],
    );
    rows.push(row);
  }
  return rows;
}

// ── Test setup ──────────────────────────────────────────────────────────

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createHubTestDatabase();
});

afterEach(() => {
  testDb.close();
});

// ── Property 11: Data export round-trip completeness ────────────────────
// Validates: Requirements 5.1, 5.2

describe('Property 11: Data export round-trip completeness', () => {
  it('for any module subset with data, export contains every row from every table (R5.1)', () => {
    fc.assert(
      fc.property(
        moduleSubsetArb,
        tableSuffixesArb,
        rowCountArb,
        (modules, suffixes, rowCount) => {
          const db = createHubTestDatabase();
          try {
            // Track what we seed so we can verify the export
            const seeded = new Map<
              string,
              { tables: string[]; rowsPerTable: number }
            >();

            for (const { id, prefix } of modules) {
              const tables = createModuleTables(db.adapter, prefix, suffixes);
              for (const table of tables) {
                seedRows(db.adapter, table, rowCount);
              }
              seeded.set(id, { tables, rowsPerTable: rowCount });
            }

            const exportable: ExportableModule[] = modules.map((m) => ({
              id: m.id,
              tablePrefix: m.prefix,
            }));

            const result = exportAllModules(db.adapter, exportable);

            // Every module appears in the export
            expect(result.modules.length).toBe(modules.length);

            for (const { id, prefix } of modules) {
              const modExport = result.modules.find(
                (m) => m.moduleId === id,
              );
              expect(modExport).toBeDefined();
              expect(modExport!.error).toBeUndefined();
              expect(modExport!.tablePrefix).toBe(prefix);

              const expected = seeded.get(id)!;

              // Every table is present
              expect(modExport!.tables.length).toBe(expected.tables.length);

              for (const tableName of expected.tables) {
                const tableExport = modExport!.tables.find(
                  (t) => t.tableName === tableName,
                );
                expect(tableExport).toBeDefined();
                expect(tableExport!.rowCount).toBe(expected.rowsPerTable);
                expect(tableExport!.rows.length).toBe(expected.rowsPerTable);
              }
            }
          } finally {
            db.close();
          }
        },
      ),
      { numRuns: 10 },
    );
  });

  it('exported row data matches seeded values exactly (R5.2)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TEST_MODULES),
        rowCountArb,
        ({ id, prefix }, rowCount) => {
          const db = createHubTestDatabase();
          try {
            const tables = createModuleTables(db.adapter, prefix, ['items']);
            const seededRows = seedRows(
              db.adapter,
              tables[0],
              rowCount,
            );

            const result = exportAllModules(db.adapter, [
              { id, tablePrefix: prefix },
            ]);

            const tableExport = result.modules[0].tables[0];
            expect(tableExport.rowCount).toBe(seededRows.length);

            // Verify each seeded row appears in the export with correct values
            for (const seeded of seededRows) {
              const exported = tableExport.rows.find(
                (r) => r.id === seeded.id,
              );
              expect(exported).toBeDefined();
              expect(exported!.name).toBe(seeded.name);
              expect(exported!.value).toBe(seeded.value);
            }
          } finally {
            db.close();
          }
        },
      ),
      { numRuns: 10 },
    );
  });

  it('JSON serialization round-trip preserves all data (R5.1)', () => {
    fc.assert(
      fc.property(
        moduleSubsetArb,
        rowCountArb,
        (modules, rowCount) => {
          const db = createHubTestDatabase();
          try {
            for (const { prefix } of modules) {
              const tables = createModuleTables(db.adapter, prefix, [
                'items',
                'meta',
              ]);
              for (const t of tables) {
                seedRows(db.adapter, t, rowCount);
              }
            }

            const exportable: ExportableModule[] = modules.map((m) => ({
              id: m.id,
              tablePrefix: m.prefix,
            }));

            const original = exportAllModules(db.adapter, exportable);
            const json = JSON.stringify(original);
            const parsed = JSON.parse(json) as HubExportData;

            // Envelope preserved
            expect(parsed.version).toBe(1);
            expect(parsed.exportedAt).toBe(original.exportedAt);
            expect(parsed.modules.length).toBe(original.modules.length);

            // Module-level data preserved
            for (let i = 0; i < original.modules.length; i++) {
              const orig = original.modules[i];
              const copy = parsed.modules[i];
              expect(copy.moduleId).toBe(orig.moduleId);
              expect(copy.tablePrefix).toBe(orig.tablePrefix);
              expect(copy.tables.length).toBe(orig.tables.length);

              for (let j = 0; j < orig.tables.length; j++) {
                expect(copy.tables[j].tableName).toBe(
                  orig.tables[j].tableName,
                );
                expect(copy.tables[j].rowCount).toBe(
                  orig.tables[j].rowCount,
                );
                expect(copy.tables[j].rows).toEqual(orig.tables[j].rows);
              }
            }

            // Hub tables preserved
            expect(parsed.hub.length).toBe(original.hub.length);
          } finally {
            db.close();
          }
        },
      ),
      { numRuns: 10 },
    );
  });

  it('rowCount always matches rows.length for every exported table', () => {
    fc.assert(
      fc.property(
        moduleSubsetArb,
        tableSuffixesArb,
        rowCountArb,
        (modules, suffixes, rowCount) => {
          const db = createHubTestDatabase();
          try {
            for (const { prefix } of modules) {
              const tables = createModuleTables(
                db.adapter,
                prefix,
                suffixes,
              );
              for (const t of tables) {
                seedRows(db.adapter, t, rowCount);
              }
            }

            const exportable: ExportableModule[] = modules.map((m) => ({
              id: m.id,
              tablePrefix: m.prefix,
            }));

            const result = exportAllModules(db.adapter, exportable);

            // Check every module table
            for (const mod of result.modules) {
              for (const table of mod.tables) {
                expect(table.rowCount).toBe(table.rows.length);
              }
            }

            // Check hub tables too
            for (const table of result.hub) {
              expect(table.rowCount).toBe(table.rows.length);
            }
          } finally {
            db.close();
          }
        },
      ),
      { numRuns: 10 },
    );
  });

  it('modules without data export with zero rows but no error', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TEST_MODULES),
        tableSuffixesArb,
        ({ id, prefix }, suffixes) => {
          const db = createHubTestDatabase();
          try {
            // Create tables but don't seed any data
            createModuleTables(db.adapter, prefix, suffixes);

            const result = exportAllModules(db.adapter, [
              { id, tablePrefix: prefix },
            ]);

            const modExport = result.modules[0];
            expect(modExport.error).toBeUndefined();
            expect(modExport.tables.length).toBe(suffixes.length);

            for (const table of modExport.tables) {
              expect(table.rowCount).toBe(0);
              expect(table.rows).toEqual([]);
            }
          } finally {
            db.close();
          }
        },
      ),
      { numRuns: 10 },
    );
  });

  it('hub tables are always included in export regardless of module list', () => {
    fc.assert(
      fc.property(moduleSubsetArb, (modules) => {
        const db = createHubTestDatabase();
        try {
          const exportable: ExportableModule[] = modules.map((m) => ({
            id: m.id,
            tablePrefix: m.prefix,
          }));

          const result = exportAllModules(db.adapter, exportable);

          // Hub tables always present (hub_enabled_modules, hub_schema_versions, etc.)
          expect(result.hub.length).toBeGreaterThan(0);
          const hubTableNames = result.hub.map((t) => t.tableName);
          expect(hubTableNames).toContain('hub_enabled_modules');
          expect(hubTableNames).toContain('hub_schema_versions');
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });
});

// ── Property 12: Export error resilience ─────────────────────────────────
// Validates: Requirements 5.7

describe('Property 12: Export error resilience', () => {
  it('a failing module does not block other modules from exporting (R5.7)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TEST_MODULES),
        fc.constantFrom(...TEST_MODULES),
        rowCountArb,
        (goodMod, badMod, rowCount) => {
          fc.pre(goodMod.id !== badMod.id);

          const db = createHubTestDatabase();
          try {
            // Seed good module with real data
            const tables = createModuleTables(db.adapter, goodMod.prefix, [
              'items',
            ]);
            seedRows(db.adapter, tables[0], rowCount);

            // Create a proxy adapter that throws for the bad module's prefix
            const errorAdapter: DatabaseAdapter = {
              execute: db.adapter.execute.bind(db.adapter),
              transaction: db.adapter.transaction.bind(db.adapter),
              query<T>(sql: string, params?: unknown[]): T[] {
                // Throw when discovering tables for the bad module
                if (
                  sql.includes('sqlite_master') &&
                  params &&
                  String(params[0]).startsWith(badMod.prefix)
                ) {
                  throw new Error(`Simulated failure for ${badMod.id}`);
                }
                return db.adapter.query<T>(sql, params);
              },
            };

            const exportable: ExportableModule[] = [
              { id: badMod.id, tablePrefix: badMod.prefix },
              { id: goodMod.id, tablePrefix: goodMod.prefix },
            ];

            const result = exportAllModules(errorAdapter, exportable);

            // Both modules present in output
            expect(result.modules.length).toBe(2);

            // Bad module has error note
            const badExport = result.modules.find(
              (m) => m.moduleId === badMod.id,
            );
            expect(badExport).toBeDefined();
            expect(badExport!.error).toBeDefined();
            expect(badExport!.error).toContain('Simulated failure');
            expect(badExport!.tables).toEqual([]);

            // Good module exported successfully
            const goodExport = result.modules.find(
              (m) => m.moduleId === goodMod.id,
            );
            expect(goodExport).toBeDefined();
            expect(goodExport!.error).toBeUndefined();
            expect(goodExport!.tables.length).toBe(1);
            expect(goodExport!.tables[0].rowCount).toBe(rowCount);
          } finally {
            db.close();
          }
        },
      ),
      { numRuns: 10 },
    );
  });

  it('modules without tablePrefix get descriptive error note (R5.7)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TEST_MODULES),
        fc.constantFrom(...TEST_MODULES),
        rowCountArb,
        (withPrefix, withoutPrefix, rowCount) => {
          fc.pre(withPrefix.id !== withoutPrefix.id);

          const db = createHubTestDatabase();
          try {
            const tables = createModuleTables(db.adapter, withPrefix.prefix, [
              'items',
            ]);
            seedRows(db.adapter, tables[0], rowCount);

            const exportable: ExportableModule[] = [
              { id: withoutPrefix.id }, // No tablePrefix
              { id: withPrefix.id, tablePrefix: withPrefix.prefix },
            ];

            const result = exportAllModules(db.adapter, exportable);

            expect(result.modules.length).toBe(2);

            // No-prefix module gets error note
            const noPrefixExport = result.modules.find(
              (m) => m.moduleId === withoutPrefix.id,
            );
            expect(noPrefixExport).toBeDefined();
            expect(noPrefixExport!.error).toContain('no table prefix');
            expect(noPrefixExport!.tables).toEqual([]);

            // Prefixed module exports normally
            const prefixExport = result.modules.find(
              (m) => m.moduleId === withPrefix.id,
            );
            expect(prefixExport).toBeDefined();
            expect(prefixExport!.error).toBeUndefined();
            expect(prefixExport!.tables.length).toBe(1);
            expect(prefixExport!.tables[0].rowCount).toBe(rowCount);
          } finally {
            db.close();
          }
        },
      ),
      { numRuns: 10 },
    );
  });

  it('export envelope is always valid regardless of module errors (R5.7)', () => {
    fc.assert(
      fc.property(moduleSubsetArb, (modules) => {
        const db = createHubTestDatabase();
        try {
          // Export with modules that have no tables created (empty but valid)
          const exportable: ExportableModule[] = modules.map((m) => ({
            id: m.id,
            tablePrefix: m.prefix,
          }));

          const result = exportAllModules(db.adapter, exportable);

          // Envelope structure is always valid
          expect(result.version).toBe(1);
          expect(typeof result.exportedAt).toBe('string');
          expect(new Date(result.exportedAt).getTime()).not.toBeNaN();
          expect(Array.isArray(result.modules)).toBe(true);
          expect(Array.isArray(result.hub)).toBe(true);
          expect(result.modules.length).toBe(modules.length);

          // Every module entry has required fields
          for (const mod of result.modules) {
            expect(typeof mod.moduleId).toBe('string');
            expect(mod.moduleId.length).toBeGreaterThan(0);
            expect(Array.isArray(mod.tables)).toBe(true);
          }
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('multiple failing modules do not corrupt the export (R5.7)', () => {
    fc.assert(
      fc.property(moduleSubsetArb, rowCountArb, (modules, rowCount) => {
        fc.pre(modules.length >= 2);

        const db = createHubTestDatabase();
        try {
          // Only the first module gets real data; rest will be "failing"
          const goodMod = modules[0];
          const failMods = modules.slice(1);

          const tables = createModuleTables(db.adapter, goodMod.prefix, [
            'items',
          ]);
          seedRows(db.adapter, tables[0], rowCount);

          // Proxy that fails for all failMods' prefixes
          const failPrefixes: Set<string> = new Set(failMods.map((m) => m.prefix));
          const errorAdapter: DatabaseAdapter = {
            execute: db.adapter.execute.bind(db.adapter),
            transaction: db.adapter.transaction.bind(db.adapter),
            query<T>(sql: string, params?: unknown[]): T[] {
              if (sql.includes('sqlite_master') && params) {
                const prefix = String(params[0]).replace('%', '');
                if (failPrefixes.has(prefix)) {
                  throw new Error(`DB error for prefix ${prefix}`);
                }
              }
              return db.adapter.query<T>(sql, params);
            },
          };

          const exportable: ExportableModule[] = modules.map((m) => ({
            id: m.id,
            tablePrefix: m.prefix,
          }));

          const result = exportAllModules(errorAdapter, exportable);

          // All modules present
          expect(result.modules.length).toBe(modules.length);

          // Good module succeeded
          const goodExport = result.modules.find(
            (m) => m.moduleId === goodMod.id,
          );
          expect(goodExport!.error).toBeUndefined();
          expect(goodExport!.tables.length).toBe(1);
          expect(goodExport!.tables[0].rowCount).toBe(rowCount);

          // All fail modules have errors
          for (const failMod of failMods) {
            const failExport = result.modules.find(
              (m) => m.moduleId === failMod.id,
            );
            expect(failExport!.error).toBeDefined();
            expect(failExport!.tables).toEqual([]);
          }

          // Envelope still valid
          expect(result.version).toBe(1);
          expect(result.hub.length).toBeGreaterThan(0);
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });
});
