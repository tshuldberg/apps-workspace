import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '../adapter';
import { createHubTestDatabase } from '../test-utils';
import {
  deleteModuleData,
  resetModuleSchemaVersion,
  CLOUD_STORAGE_MODULES,
  enableModule,
  isModuleEnabled,
  getModuleSchemaVersion,
  recordHealthConsent,
  hasActiveHealthConsent,
  upsertDashboardCard,
  getDashboardLayout,
} from '../hub-queries';

/**
 * Create fake module tables with the given prefix and seed data.
 */
function createModuleTables(
  db: DatabaseAdapter,
  prefix: string,
  moduleId: string,
) {
  db.execute(`CREATE TABLE IF NOT EXISTS ${prefix}items (
    id TEXT PRIMARY KEY, name TEXT NOT NULL
  )`);
  db.execute(`CREATE TABLE IF NOT EXISTS ${prefix}settings (
    key TEXT PRIMARY KEY, value TEXT NOT NULL
  )`);
  db.execute(`INSERT INTO ${prefix}items (id, name) VALUES ('1', 'test item')`);
  db.execute(`INSERT INTO ${prefix}settings (key, value) VALUES ('theme', 'dark')`);

  // Seed schema version
  db.execute(
    `INSERT INTO hub_schema_versions (module_id, version) VALUES (?, 1)`,
    [moduleId],
  );
  db.execute(
    `INSERT INTO hub_schema_versions (module_id, version) VALUES (?, 2)`,
    [moduleId],
  );
}

describe('Module data deletion (R17)', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createHubTestDatabase();
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  describe('deleteModuleData', () => {
    it('drops all tables with the module prefix (R17.1)', () => {
      createModuleTables(adapter, 'bk_', 'books');

      const result = deleteModuleData(adapter, 'books', 'bk_');

      expect(result.tablesDropped).toBe(2);
      expect(result.moduleId).toBe('books');

      // Tables should be gone
      const remaining = adapter.query<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'bk_%'`,
      );
      expect(remaining).toHaveLength(0);
    });

    it('resets schema version so migrations re-run (R17.3)', () => {
      createModuleTables(adapter, 'bk_', 'books');

      expect(getModuleSchemaVersion(adapter, 'books')).toBe(2);

      const result = deleteModuleData(adapter, 'books', 'bk_');

      expect(result.schemaVersionsCleared).toBe(2);
      expect(getModuleSchemaVersion(adapter, 'books')).toBe(0);
    });

    it('disables the module in hub_enabled_modules', () => {
      enableModule(adapter, 'books');
      createModuleTables(adapter, 'bk_', 'books');
      expect(isModuleEnabled(adapter, 'books')).toBe(true);

      deleteModuleData(adapter, 'books', 'bk_');

      expect(isModuleEnabled(adapter, 'books')).toBe(false);
    });

    it('cleans up health consent records', () => {
      createModuleTables(adapter, 'hl_', 'health');
      recordHealthConsent(adapter, 'health', ['vitals', 'measurements']);
      expect(hasActiveHealthConsent(adapter, 'health')).toBe(true);

      deleteModuleData(adapter, 'health', 'hl_');

      expect(hasActiveHealthConsent(adapter, 'health')).toBe(false);
    });

    it('cleans up dashboard layout entry', () => {
      createModuleTables(adapter, 'bk_', 'books');
      upsertDashboardCard(adapter, 'books', { position: 0 });
      expect(getDashboardLayout(adapter).some((c) => c.module_id === 'books')).toBe(true);

      deleteModuleData(adapter, 'books', 'bk_');

      expect(getDashboardLayout(adapter).some((c) => c.module_id === 'books')).toBe(false);
    });

    it('flags cloud modules with hasCloudData (R17.4)', () => {
      createModuleTables(adapter, 'sf_', 'surf');

      const result = deleteModuleData(adapter, 'surf', 'sf_');

      expect(result.hasCloudData).toBe(true);
    });

    it('does not flag local-only modules with hasCloudData', () => {
      createModuleTables(adapter, 'bk_', 'books');

      const result = deleteModuleData(adapter, 'books', 'bk_');

      expect(result.hasCloudData).toBe(false);
    });

    it('handles module with no tables gracefully', () => {
      const result = deleteModuleData(adapter, 'books', 'bk_');

      expect(result.tablesDropped).toBe(0);
      expect(result.schemaVersionsCleared).toBe(0);
    });
  });

  describe('resetModuleSchemaVersion', () => {
    it('removes all version records for a module', () => {
      adapter.execute(
        `INSERT INTO hub_schema_versions (module_id, version) VALUES ('budget', 1)`,
      );
      adapter.execute(
        `INSERT INTO hub_schema_versions (module_id, version) VALUES ('budget', 2)`,
      );
      adapter.execute(
        `INSERT INTO hub_schema_versions (module_id, version) VALUES ('budget', 3)`,
      );

      const cleared = resetModuleSchemaVersion(adapter, 'budget');

      expect(cleared).toBe(3);
      expect(getModuleSchemaVersion(adapter, 'budget')).toBe(0);
    });

    it('does not affect other modules', () => {
      adapter.execute(
        `INSERT INTO hub_schema_versions (module_id, version) VALUES ('books', 1)`,
      );
      adapter.execute(
        `INSERT INTO hub_schema_versions (module_id, version) VALUES ('budget', 1)`,
      );

      resetModuleSchemaVersion(adapter, 'books');

      expect(getModuleSchemaVersion(adapter, 'books')).toBe(0);
      expect(getModuleSchemaVersion(adapter, 'budget')).toBe(1);
    });

    it('returns 0 when no versions exist', () => {
      const cleared = resetModuleSchemaVersion(adapter, 'nonexistent');
      expect(cleared).toBe(0);
    });
  });

  describe('CLOUD_STORAGE_MODULES', () => {
    it('includes all known cloud modules', () => {
      expect(CLOUD_STORAGE_MODULES.has('forums')).toBe(true);
      expect(CLOUD_STORAGE_MODULES.has('market')).toBe(true);
      expect(CLOUD_STORAGE_MODULES.has('surf')).toBe(true);
      expect(CLOUD_STORAGE_MODULES.has('workouts')).toBe(true);
      expect(CLOUD_STORAGE_MODULES.has('homes')).toBe(true);
    });

    it('does not include local-only modules', () => {
      expect(CLOUD_STORAGE_MODULES.has('books')).toBe(false);
      expect(CLOUD_STORAGE_MODULES.has('budget')).toBe(false);
    });
  });
});
