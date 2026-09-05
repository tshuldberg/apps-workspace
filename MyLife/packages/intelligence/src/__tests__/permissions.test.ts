import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createHubTestDatabase } from '@mylife/db';
import { ensureAIPermissionTables } from '../permissions/schema';
import {
  setPermissions,
  getPermissions,
  getAllPermissions,
  setGranularMode,
  setTablePermission,
  getTablePermissions,
  getPermittedModules,
  getPermittedTables,
  removePermissions,
  isAllowed,
} from '../permissions/operations';
import { DEFAULT_USER_ID } from '../permissions/types';

const USER = DEFAULT_USER_ID;

describe('AI permission system', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createHubTestDatabase();
    db = testDb.adapter;
    closeDb = testDb.close;
    ensureAIPermissionTables(db);
  });

  afterEach(() => {
    closeDb();
  });

  describe('schema', () => {
    it('creates tables idempotently', () => {
      // Call again -- should not throw
      ensureAIPermissionTables(db);

      const tables = db.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'hub_ai_%' ORDER BY name",
      );
      expect(tables.map((t) => t.name)).toEqual([
        'hub_ai_audit_log',
        'hub_ai_config',
        'hub_ai_permissions',
        'hub_ai_table_permissions',
      ]);
    });

    it('hub_ai_permissions uses the canonical composite PK schema', () => {
      const columns = db.query<{ name: string }>(
        "PRAGMA table_info('hub_ai_permissions')",
      );
      const names = columns.map((c) => c.name).sort();
      expect(names).toEqual([
        'can_read',
        'can_write',
        'granular_mode',
        'module_id',
        'updated_at',
        'user_id',
      ]);
    });
  });

  describe('default state', () => {
    it('returns empty permissions when no modules have been configured', () => {
      expect(getAllPermissions(db, USER)).toEqual([]);
    });

    it('returns null for unconfigured module', () => {
      expect(getPermissions(db, USER, 'books')).toBeNull();
    });

    it('returns empty permitted modules list by default', () => {
      expect(getPermittedModules(db, USER, 'read')).toEqual([]);
      expect(getPermittedModules(db, USER, 'write')).toEqual([]);
    });

    it('returns empty array for unconfigured module tables', () => {
      expect(getPermittedTables(db, USER, 'books', 'read')).toEqual([]);
      expect(getPermittedTables(db, USER, 'books', 'write')).toEqual([]);
    });
  });

  describe('setPermissions', () => {
    it('creates a new permission record when granting read+write', () => {
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: true, canWrite: true });

      const perm = getPermissions(db, USER, 'books');
      expect(perm).toMatchObject({
        userId: USER,
        moduleId: 'books',
        canRead: true,
        canWrite: true,
        granularMode: false,
      });
    });

    it('creates a disabled record when explicitly revoking both modes', () => {
      setPermissions(db, { userId: USER, moduleId: 'budget', canRead: false, canWrite: false });

      const perm = getPermissions(db, USER, 'budget');
      expect(perm).toMatchObject({
        userId: USER,
        moduleId: 'budget',
        canRead: false,
        canWrite: false,
        granularMode: false,
      });
    });

    it('supports read-only and write-only grants independently', () => {
      setPermissions(db, { userId: USER, moduleId: 'journal', canRead: true, canWrite: false });
      setPermissions(db, { userId: USER, moduleId: 'mood', canRead: false, canWrite: true });

      expect(getPermissions(db, USER, 'journal')).toMatchObject({
        canRead: true,
        canWrite: false,
      });
      expect(getPermissions(db, USER, 'mood')).toMatchObject({
        canRead: false,
        canWrite: true,
      });
    });

    it('toggles an existing record from enabled to disabled', () => {
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: true, canWrite: true });
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: false, canWrite: false });

      const perm = getPermissions(db, USER, 'books');
      expect(perm!.canRead).toBe(false);
      expect(perm!.canWrite).toBe(false);
    });

    it('toggles an existing record from disabled to enabled', () => {
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: false, canWrite: false });
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: true, canWrite: true });

      const perm = getPermissions(db, USER, 'books');
      expect(perm!.canRead).toBe(true);
      expect(perm!.canWrite).toBe(true);
    });

    it('preserves granular_mode when toggling read/write', () => {
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: true, canWrite: true });
      setGranularMode(db, USER, 'books', true);
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: false, canWrite: false });
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: true, canWrite: true });

      const perm = getPermissions(db, USER, 'books');
      // granular_mode must persist across upserts; ON CONFLICT only updates can_read/can_write
      expect(perm!.granularMode).toBe(true);
    });

    it('defaults userId to DEFAULT_USER_ID when omitted', () => {
      setPermissions(db, { moduleId: 'books', canRead: true, canWrite: true });
      expect(getPermissions(db, DEFAULT_USER_ID, 'books')).not.toBeNull();
    });

    it('isolates permissions between users', () => {
      setPermissions(db, { userId: 'alice', moduleId: 'books', canRead: true, canWrite: true });
      setPermissions(db, { userId: 'bob', moduleId: 'books', canRead: false, canWrite: false });

      expect(getPermissions(db, 'alice', 'books')!.canRead).toBe(true);
      expect(getPermissions(db, 'bob', 'books')!.canRead).toBe(false);
    });
  });

  describe('setGranularMode', () => {
    it('enables granular mode for a module', () => {
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: true, canWrite: true });
      setGranularMode(db, USER, 'books', true);

      const perm = getPermissions(db, USER, 'books');
      expect(perm!.granularMode).toBe(true);
    });

    it('disables granular mode for a module', () => {
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: true, canWrite: true });
      setGranularMode(db, USER, 'books', true);
      setGranularMode(db, USER, 'books', false);

      const perm = getPermissions(db, USER, 'books');
      expect(perm!.granularMode).toBe(false);
    });

    it('is a no-op if the module has no permission record', () => {
      // Should not throw
      setGranularMode(db, USER, 'nonexistent', true);
      expect(getPermissions(db, USER, 'nonexistent')).toBeNull();
    });
  });

  describe('setTablePermission', () => {
    it('creates a table permission record', () => {
      setTablePermission(db, {
        userId: USER,
        moduleId: 'books',
        tableName: 'bk_books',
        canRead: true,
        canWrite: true,
      });

      const perms = getTablePermissions(db, USER, 'books');
      expect(perms).toHaveLength(1);
      expect(perms[0]).toMatchObject({
        userId: USER,
        moduleId: 'books',
        tableName: 'bk_books',
        canRead: true,
        canWrite: true,
      });
    });

    it('toggles an existing table permission', () => {
      setTablePermission(db, {
        userId: USER,
        moduleId: 'books',
        tableName: 'bk_books',
        canRead: true,
        canWrite: true,
      });
      setTablePermission(db, {
        userId: USER,
        moduleId: 'books',
        tableName: 'bk_books',
        canRead: false,
        canWrite: false,
      });

      const perms = getTablePermissions(db, USER, 'books');
      expect(perms[0].canRead).toBe(false);
      expect(perms[0].canWrite).toBe(false);
    });

    it('supports multiple tables per module', () => {
      setTablePermission(db, {
        userId: USER,
        moduleId: 'books',
        tableName: 'bk_books',
        canRead: true,
        canWrite: true,
      });
      setTablePermission(db, {
        userId: USER,
        moduleId: 'books',
        tableName: 'bk_reading_list',
        canRead: true,
        canWrite: false,
      });
      setTablePermission(db, {
        userId: USER,
        moduleId: 'books',
        tableName: 'bk_reviews',
        canRead: false,
        canWrite: false,
      });

      const perms = getTablePermissions(db, USER, 'books');
      expect(perms).toHaveLength(3);
      expect(perms.map((p) => p.tableName)).toEqual([
        'bk_books',
        'bk_reading_list',
        'bk_reviews',
      ]);
    });

    it('returns empty array for module with no table permissions', () => {
      expect(getTablePermissions(db, USER, 'budget')).toEqual([]);
    });

    it('defaults userId to DEFAULT_USER_ID when omitted', () => {
      setTablePermission(db, {
        moduleId: 'books',
        tableName: 'bk_books',
        canRead: true,
        canWrite: true,
      });
      expect(getTablePermissions(db, DEFAULT_USER_ID, 'books')).toHaveLength(1);
    });
  });

  describe('getAllPermissions', () => {
    it('returns all module permissions sorted by module_id', () => {
      setPermissions(db, { userId: USER, moduleId: 'workouts', canRead: true, canWrite: true });
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: true, canWrite: true });
      setPermissions(db, { userId: USER, moduleId: 'budget', canRead: false, canWrite: false });

      const perms = getAllPermissions(db, USER);
      expect(perms).toHaveLength(3);
      expect(perms.map((p: { moduleId: string }) => p.moduleId)).toEqual([
        'books',
        'budget',
        'workouts',
      ]);
    });

    it('scopes results to the requested user', () => {
      setPermissions(db, { userId: 'alice', moduleId: 'books', canRead: true, canWrite: true });
      setPermissions(db, { userId: 'bob', moduleId: 'budget', canRead: true, canWrite: true });

      expect(getAllPermissions(db, 'alice').map((p) => p.moduleId)).toEqual(['books']);
      expect(getAllPermissions(db, 'bob').map((p) => p.moduleId)).toEqual(['budget']);
    });
  });

  describe('getPermittedModules', () => {
    it('returns only modules with can_read = 1 when mode = read', () => {
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: true, canWrite: false });
      setPermissions(db, { userId: USER, moduleId: 'budget', canRead: false, canWrite: true });
      setPermissions(db, { userId: USER, moduleId: 'workouts', canRead: true, canWrite: true });

      expect(getPermittedModules(db, USER, 'read')).toEqual(['books', 'workouts']);
    });

    it('returns only modules with can_write = 1 when mode = write', () => {
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: true, canWrite: false });
      setPermissions(db, { userId: USER, moduleId: 'budget', canRead: false, canWrite: true });
      setPermissions(db, { userId: USER, moduleId: 'workouts', canRead: true, canWrite: true });

      expect(getPermittedModules(db, USER, 'write')).toEqual(['budget', 'workouts']);
    });

    it('returns empty array when all modules are disabled', () => {
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: false, canWrite: false });
      setPermissions(db, { userId: USER, moduleId: 'budget', canRead: false, canWrite: false });

      expect(getPermittedModules(db, USER, 'read')).toEqual([]);
      expect(getPermittedModules(db, USER, 'write')).toEqual([]);
    });

    it('defaults userId and mode to DEFAULT_USER_ID + read', () => {
      setPermissions(db, { moduleId: 'books', canRead: true, canWrite: false });
      setPermissions(db, { moduleId: 'budget', canRead: false, canWrite: true });

      expect(getPermittedModules(db)).toEqual(['books']);
    });
  });

  describe('getPermittedTables', () => {
    it('returns empty array when module lacks the requested capability', () => {
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: false, canWrite: false });
      expect(getPermittedTables(db, USER, 'books', 'read')).toEqual([]);
      expect(getPermittedTables(db, USER, 'books', 'write')).toEqual([]);
    });

    it('returns null (all tables) when module has capability but granular_mode is OFF', () => {
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: true, canWrite: true });
      expect(getPermittedTables(db, USER, 'books', 'read')).toBeNull();
      expect(getPermittedTables(db, USER, 'books', 'write')).toBeNull();
    });

    it('returns only enabled tables when granular mode is on (read)', () => {
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: true, canWrite: false });
      setGranularMode(db, USER, 'books', true);
      setTablePermission(db, { userId: USER, moduleId: 'books', tableName: 'bk_books', canRead: true, canWrite: false });
      setTablePermission(db, { userId: USER, moduleId: 'books', tableName: 'bk_reviews', canRead: false, canWrite: false });
      setTablePermission(db, { userId: USER, moduleId: 'books', tableName: 'bk_reading_list', canRead: true, canWrite: false });

      const tables = getPermittedTables(db, USER, 'books', 'read');
      expect(tables).toEqual(['bk_books', 'bk_reading_list']);
    });

    it('returns only enabled tables when granular mode is on (write)', () => {
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: true, canWrite: true });
      setGranularMode(db, USER, 'books', true);
      setTablePermission(db, { userId: USER, moduleId: 'books', tableName: 'bk_books', canRead: true, canWrite: false });
      setTablePermission(db, { userId: USER, moduleId: 'books', tableName: 'bk_reviews', canRead: true, canWrite: true });

      expect(getPermittedTables(db, USER, 'books', 'write')).toEqual(['bk_reviews']);
    });

    it('returns empty array when granular mode is on but no tables are enabled', () => {
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: true, canWrite: true });
      setGranularMode(db, USER, 'books', true);
      setTablePermission(db, { userId: USER, moduleId: 'books', tableName: 'bk_books', canRead: false, canWrite: false });

      expect(getPermittedTables(db, USER, 'books', 'read')).toEqual([]);
    });

    it('returns empty array for unknown module', () => {
      expect(getPermittedTables(db, USER, 'nonexistent', 'read')).toEqual([]);
    });
  });

  describe('isAllowed', () => {
    it('returns false for unknown module', () => {
      expect(isAllowed(db, USER, 'nonexistent', 'read')).toBe(false);
    });

    it('returns false when module exists but capability is off', () => {
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: false, canWrite: true });
      expect(isAllowed(db, USER, 'books', 'read')).toBe(false);
      expect(isAllowed(db, USER, 'books', 'write')).toBe(true);
    });

    it('returns true when module has capability and granular_mode is off', () => {
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: true, canWrite: true });
      expect(isAllowed(db, USER, 'books', 'read')).toBe(true);
    });

    it('respects granular_mode when computing allowance', () => {
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: true, canWrite: true });
      setGranularMode(db, USER, 'books', true);
      expect(isAllowed(db, USER, 'books', 'read')).toBe(false); // no tables yet

      setTablePermission(db, {
        userId: USER,
        moduleId: 'books',
        tableName: 'bk_books',
        canRead: true,
        canWrite: false,
      });
      expect(isAllowed(db, USER, 'books', 'read')).toBe(true);
      expect(isAllowed(db, USER, 'books', 'write')).toBe(false);
    });
  });

  describe('removePermissions', () => {
    it('removes module and all its table permissions', () => {
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: true, canWrite: true });
      setTablePermission(db, { userId: USER, moduleId: 'books', tableName: 'bk_books', canRead: true, canWrite: true });
      setTablePermission(db, { userId: USER, moduleId: 'books', tableName: 'bk_reviews', canRead: true, canWrite: true });

      removePermissions(db, USER, 'books');

      expect(getPermissions(db, USER, 'books')).toBeNull();
      expect(getTablePermissions(db, USER, 'books')).toEqual([]);
    });

    it('does not affect other modules', () => {
      setPermissions(db, { userId: USER, moduleId: 'books', canRead: true, canWrite: true });
      setPermissions(db, { userId: USER, moduleId: 'budget', canRead: true, canWrite: true });
      setTablePermission(db, { userId: USER, moduleId: 'books', tableName: 'bk_books', canRead: true, canWrite: true });
      setTablePermission(db, { userId: USER, moduleId: 'budget', tableName: 'bg_envelopes', canRead: true, canWrite: true });

      removePermissions(db, USER, 'books');

      expect(getPermissions(db, USER, 'budget')).not.toBeNull();
      expect(getTablePermissions(db, USER, 'budget')).toHaveLength(1);
    });

    it('does not affect other users', () => {
      setPermissions(db, { userId: 'alice', moduleId: 'books', canRead: true, canWrite: true });
      setPermissions(db, { userId: 'bob', moduleId: 'books', canRead: true, canWrite: true });

      removePermissions(db, 'alice', 'books');

      expect(getPermissions(db, 'alice', 'books')).toBeNull();
      expect(getPermissions(db, 'bob', 'books')).not.toBeNull();
    });

    it('is a no-op for nonexistent module', () => {
      // Should not throw
      removePermissions(db, USER, 'nonexistent');
    });
  });
});
