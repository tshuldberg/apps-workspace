/**
 * AI permission CRUD operations.
 *
 * Canonical schema lives in `@mylife/db` (`hub_ai_permissions`,
 * `hub_ai_table_permissions`). Composite PK is (user_id, module_id) for
 * module-level and (user_id, module_id, table_name) for table-level.
 *
 * Two-tier model:
 * - Module-level: setPermissions({ userId, moduleId, canRead, canWrite })
 * - Granular: flip granular_mode on, then setTablePermission per table
 *
 * Default: ALL modules OFF. Callers must explicitly opt in.
 *
 * `userId` is optional on most reads and defaults to `DEFAULT_USER_ID`
 * ('local') so single-user installs and internal callers (e.g. the query
 * engine) stay backwards-compatible.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { AIPermission, AITablePermission, PermissionMode } from './types';
import { DEFAULT_USER_ID } from './types';

// ---------------------------------------------------------------------------
// Module-level permissions
// ---------------------------------------------------------------------------

export interface SetPermissionsInput {
  userId?: string;
  moduleId: string;
  canRead: boolean;
  canWrite: boolean;
}

/**
 * Upsert module-level permissions. Creates the record with granular_mode = 0
 * on first write; preserves granular_mode on conflict updates.
 */
export function setPermissions(
  db: DatabaseAdapter,
  input: SetPermissionsInput,
): void {
  const userId = input.userId ?? DEFAULT_USER_ID;
  db.execute(
    `INSERT INTO hub_ai_permissions (user_id, module_id, can_read, can_write, granular_mode)
     VALUES (?, ?, ?, ?, 0)
     ON CONFLICT (user_id, module_id) DO UPDATE SET
       can_read = excluded.can_read,
       can_write = excluded.can_write,
       updated_at = datetime('now')`,
    [userId, input.moduleId, input.canRead ? 1 : 0, input.canWrite ? 1 : 0],
  );
}

/** Get a single module permission record. Returns null when missing. */
export function getPermissions(
  db: DatabaseAdapter,
  userId: string,
  moduleId: string,
): AIPermission | null {
  const rows = db.query<{
    user_id: string;
    module_id: string;
    can_read: number;
    can_write: number;
    granular_mode: number;
    updated_at: string;
  }>(
    `SELECT user_id, module_id, can_read, can_write, granular_mode, updated_at
       FROM hub_ai_permissions
      WHERE user_id = ? AND module_id = ?`,
    [userId, moduleId],
  );

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    userId: row.user_id,
    moduleId: row.module_id,
    canRead: row.can_read === 1,
    canWrite: row.can_write === 1,
    granularMode: row.granular_mode === 1,
    updatedAt: row.updated_at,
  };
}

/** Get all module-level permissions for a user, sorted by module_id. */
export function getAllPermissions(
  db: DatabaseAdapter,
  userId: string = DEFAULT_USER_ID,
): AIPermission[] {
  const rows = db.query<{
    user_id: string;
    module_id: string;
    can_read: number;
    can_write: number;
    granular_mode: number;
    updated_at: string;
  }>(
    `SELECT user_id, module_id, can_read, can_write, granular_mode, updated_at
       FROM hub_ai_permissions
      WHERE user_id = ?
      ORDER BY module_id`,
    [userId],
  );

  return rows.map((row) => ({
    userId: row.user_id,
    moduleId: row.module_id,
    canRead: row.can_read === 1,
    canWrite: row.can_write === 1,
    granularMode: row.granular_mode === 1,
    updatedAt: row.updated_at,
  }));
}

/** Toggle granular_mode for an existing module permission. No-op if missing. */
export function setGranularMode(
  db: DatabaseAdapter,
  userId: string,
  moduleId: string,
  granularMode: boolean,
): void {
  db.execute(
    `UPDATE hub_ai_permissions
        SET granular_mode = ?, updated_at = datetime('now')
      WHERE user_id = ? AND module_id = ?`,
    [granularMode ? 1 : 0, userId, moduleId],
  );
}

/** Remove all permissions (module- and table-level) for (userId, moduleId). */
export function removePermissions(
  db: DatabaseAdapter,
  userId: string,
  moduleId: string,
): void {
  db.transaction(() => {
    db.execute(
      'DELETE FROM hub_ai_table_permissions WHERE user_id = ? AND module_id = ?',
      [userId, moduleId],
    );
    db.execute(
      'DELETE FROM hub_ai_permissions WHERE user_id = ? AND module_id = ?',
      [userId, moduleId],
    );
  });
}

// ---------------------------------------------------------------------------
// Table-level permissions
// ---------------------------------------------------------------------------

export interface SetTablePermissionInput {
  userId?: string;
  moduleId: string;
  tableName: string;
  canRead: boolean;
  canWrite: boolean;
}

/** Upsert a single table permission. */
export function setTablePermission(
  db: DatabaseAdapter,
  input: SetTablePermissionInput,
): void {
  const userId = input.userId ?? DEFAULT_USER_ID;
  db.execute(
    `INSERT INTO hub_ai_table_permissions (user_id, module_id, table_name, can_read, can_write)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (user_id, module_id, table_name) DO UPDATE SET
       can_read = excluded.can_read,
       can_write = excluded.can_write,
       updated_at = datetime('now')`,
    [
      userId,
      input.moduleId,
      input.tableName,
      input.canRead ? 1 : 0,
      input.canWrite ? 1 : 0,
    ],
  );
}

/** Get all table permissions for (userId, moduleId), sorted by tableName. */
export function getTablePermissions(
  db: DatabaseAdapter,
  userId: string,
  moduleId: string,
): AITablePermission[] {
  const rows = db.query<{
    user_id: string;
    module_id: string;
    table_name: string;
    can_read: number;
    can_write: number;
    updated_at: string;
  }>(
    `SELECT user_id, module_id, table_name, can_read, can_write, updated_at
       FROM hub_ai_table_permissions
      WHERE user_id = ? AND module_id = ?
      ORDER BY table_name`,
    [userId, moduleId],
  );

  return rows.map((row) => ({
    userId: row.user_id,
    moduleId: row.module_id,
    tableName: row.table_name,
    canRead: row.can_read === 1,
    canWrite: row.can_write === 1,
    updatedAt: row.updated_at,
  }));
}

// ---------------------------------------------------------------------------
// Query helpers (engine-facing)
// ---------------------------------------------------------------------------

/**
 * Modules this user is permitted to query in the given `mode`.
 *
 * - `mode: 'read'` (default) returns modules with `can_read = 1`.
 * - `mode: 'write'` returns modules with `can_write = 1`.
 *
 * `userId` defaults to `DEFAULT_USER_ID` to preserve the single-arg call
 * shape used by the intelligence query engine.
 */
export function getPermittedModules(
  db: DatabaseAdapter,
  userId: string = DEFAULT_USER_ID,
  mode: PermissionMode = 'read',
): string[] {
  const column = mode === 'write' ? 'can_write' : 'can_read';
  const rows = db.query<{ module_id: string }>(
    `SELECT module_id FROM hub_ai_permissions
      WHERE user_id = ? AND ${column} = 1
      ORDER BY module_id`,
    [userId],
  );
  return rows.map((row) => row.module_id);
}

/**
 * Tables the AI is permitted to query for (userId, moduleId) in the given mode.
 *
 * Logic:
 * - Module not present or lacking the requested capability: returns `[]`.
 * - Module has the capability but granular_mode is OFF: returns `null`
 *   (meaning "all tables are implicitly permitted").
 * - granular_mode is ON: returns only the tables explicitly enabled for
 *   that mode.
 */
export function getPermittedTables(
  db: DatabaseAdapter,
  userId: string,
  moduleId: string,
  mode: PermissionMode = 'read',
): string[] | null {
  const permission = getPermissions(db, userId, moduleId);
  if (!permission) return [];

  const capable = mode === 'write' ? permission.canWrite : permission.canRead;
  if (!capable) return [];
  if (!permission.granularMode) return null;

  const column = mode === 'write' ? 'can_write' : 'can_read';
  const rows = db.query<{ table_name: string }>(
    `SELECT table_name FROM hub_ai_table_permissions
      WHERE user_id = ? AND module_id = ? AND ${column} = 1
      ORDER BY table_name`,
    [userId, moduleId],
  );
  return rows.map((row) => row.table_name);
}

/**
 * Convenience: is the AI allowed to perform `op` against `moduleId` for
 * `userId`? Respects granular_mode by requiring at least one capable table
 * when granular_mode is ON.
 */
export function isAllowed(
  db: DatabaseAdapter,
  userId: string,
  moduleId: string,
  op: PermissionMode,
): boolean {
  const tables = getPermittedTables(db, userId, moduleId, op);
  if (tables === null) return true; // granular_mode off + module capable
  return tables.length > 0;
}
