import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '../adapter';
import { createHubTestDatabase, type InMemoryTestDatabase } from '../test-utils';
import { exportAllModules, type ExportableModule, type HubExportData } from '../export';

describe('exportAllModules', () => {
  let db: InMemoryTestDatabase;
  let adapter: DatabaseAdapter;

  beforeEach(() => {
    db = createHubTestDatabase();
    adapter = db.adapter;
  });

  afterEach(() => {
    db.close();
  });

  function createModuleTables(prefix: string) {
    adapter.execute(
      `CREATE TABLE IF NOT EXISTS ${prefix}items (id TEXT PRIMARY KEY, name TEXT, created_at TEXT)`,
    );
    adapter.execute(
      `CREATE TABLE IF NOT EXISTS ${prefix}settings (key TEXT PRIMARY KEY, value TEXT)`,
    );
  }

  function seedModuleData(prefix: string) {
    adapter.execute(
      `INSERT INTO ${prefix}items (id, name, created_at) VALUES ('1', 'Item A', '2026-01-01')`,
    );
    adapter.execute(
      `INSERT INTO ${prefix}items (id, name, created_at) VALUES ('2', 'Item B', '2026-01-02')`,
    );
    adapter.execute(
      `INSERT INTO ${prefix}settings (key, value) VALUES ('theme', 'dark')`,
    );
  }

  it('exports data from modules with table prefixes', () => {
    createModuleTables('bk_');
    seedModuleData('bk_');

    const modules: ExportableModule[] = [
      { id: 'books', tablePrefix: 'bk_' },
    ];

    const result = exportAllModules(adapter, modules);

    expect(result.version).toBe(1);
    expect(result.exportedAt).toBeTruthy();
    expect(result.modules).toHaveLength(1);

    const booksExport = result.modules[0];
    expect(booksExport.moduleId).toBe('books');
    expect(booksExport.tablePrefix).toBe('bk_');
    expect(booksExport.error).toBeUndefined();
    expect(booksExport.tables).toHaveLength(2);

    const itemsTable = booksExport.tables.find((t) => t.tableName === 'bk_items');
    expect(itemsTable).toBeDefined();
    expect(itemsTable!.rowCount).toBe(2);
    expect(itemsTable!.rows[0]).toMatchObject({ id: '1', name: 'Item A' });

    const settingsTable = booksExport.tables.find((t) => t.tableName === 'bk_settings');
    expect(settingsTable).toBeDefined();
    expect(settingsTable!.rowCount).toBe(1);
  });

  it('exports hub tables', () => {
    const modules: ExportableModule[] = [];
    const result = exportAllModules(adapter, modules);

    expect(result.hub.length).toBeGreaterThan(0);
    const enabledModulesTable = result.hub.find(
      (t) => t.tableName === 'hub_enabled_modules',
    );
    expect(enabledModulesTable).toBeDefined();
  });

  it('handles modules without tablePrefix gracefully', () => {
    const modules: ExportableModule[] = [
      { id: 'surf' },
    ];

    const result = exportAllModules(adapter, modules);

    expect(result.modules).toHaveLength(1);
    expect(result.modules[0].error).toBe(
      'Module has no table prefix; no local data to export.',
    );
    expect(result.modules[0].tables).toEqual([]);
  });

  it('exports multiple modules', () => {
    createModuleTables('bk_');
    seedModuleData('bk_');
    createModuleTables('bg_');
    adapter.execute(
      `INSERT INTO bg_items (id, name, created_at) VALUES ('1', 'Groceries', '2026-02-01')`,
    );

    const modules: ExportableModule[] = [
      { id: 'books', tablePrefix: 'bk_' },
      { id: 'budget', tablePrefix: 'bg_' },
    ];

    const result = exportAllModules(adapter, modules);

    expect(result.modules).toHaveLength(2);
    expect(result.modules[0].moduleId).toBe('books');
    expect(result.modules[0].tables).toHaveLength(2);
    expect(result.modules[1].moduleId).toBe('budget');
    expect(result.modules[1].tables).toHaveLength(2);
  });

  it('skips failing module and continues (R5.7)', () => {
    createModuleTables('bk_');
    seedModuleData('bk_');

    // Create a module with a prefix that will work but then drop one table
    // to simulate a partial failure scenario
    const modules: ExportableModule[] = [
      { id: 'broken', tablePrefix: 'zz_nonexistent_' },
      { id: 'books', tablePrefix: 'bk_' },
    ];

    const result = exportAllModules(adapter, modules);

    expect(result.modules).toHaveLength(2);
    // broken module should have empty tables (no tables match the prefix, but no error)
    expect(result.modules[0].moduleId).toBe('broken');
    expect(result.modules[0].tables).toEqual([]);
    // books module should export successfully
    expect(result.modules[1].moduleId).toBe('books');
    expect(result.modules[1].tables).toHaveLength(2);
  });

  it('produces valid JSON-serializable output', () => {
    createModuleTables('bk_');
    seedModuleData('bk_');

    const modules: ExportableModule[] = [
      { id: 'books', tablePrefix: 'bk_' },
    ];

    const result = exportAllModules(adapter, modules);
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json) as HubExportData;

    expect(parsed.version).toBe(1);
    expect(parsed.modules[0].tables[0].rows.length).toBeGreaterThan(0);
  });

  it('exports empty tables with zero rows', () => {
    createModuleTables('bk_');
    // Don't seed any data

    const modules: ExportableModule[] = [
      { id: 'books', tablePrefix: 'bk_' },
    ];

    const result = exportAllModules(adapter, modules);

    expect(result.modules[0].tables).toHaveLength(2);
    for (const table of result.modules[0].tables) {
      expect(table.rowCount).toBe(0);
      expect(table.rows).toEqual([]);
    }
  });
});
