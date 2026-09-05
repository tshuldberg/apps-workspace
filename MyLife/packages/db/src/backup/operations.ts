/**
 * Backup system public API.
 *
 * CRUD operations for backup metadata and configuration.
 * Platform-specific file copy/restore is delegated to the caller
 * via the `platformOps` parameter on create/restore. This keeps
 * the DB layer pure and testable while mobile (expo-file-system)
 * and web (File System API) each supply their own I/O.
 */

import type { DatabaseAdapter } from '../adapter';
import type {
  BackupConfig,
  BackupMetadata,
  BackupResult,
  BackupType,
  BackupValidationResult,
  RestoreResult,
} from './types';
import { DEFAULT_BACKUP_CONFIG } from './types';

// ---------------------------------------------------------------------------
// Internal row type (matches hub_backups table columns)
// ---------------------------------------------------------------------------

interface BackupRow {
  id: string;
  created_at: string;
  size_bytes: number;
  module_count: number;
  label: string | null;
  backup_type: BackupType;
  file_path: string;
}

function rowToMetadata(row: BackupRow): BackupMetadata {
  return {
    id: row.id,
    createdAt: row.created_at,
    sizeBytes: row.size_bytes,
    moduleCount: row.module_count,
    label: row.label,
    type: row.backup_type as BackupType,
    filePath: row.file_path,
  };
}

// ---------------------------------------------------------------------------
// Config row type
// ---------------------------------------------------------------------------

interface BackupConfigRow {
  max_daily: number;
  max_weekly: number;
  auto_enabled: number;
}

function rowToConfig(row: BackupConfigRow): BackupConfig {
  return {
    maxDaily: row.max_daily,
    maxWeekly: row.max_weekly,
    autoEnabled: row.auto_enabled === 1,
  };
}

// ---------------------------------------------------------------------------
// Platform operations interface
// ---------------------------------------------------------------------------

/**
 * Platform-specific file operations that callers must implement.
 *
 * Mobile: use expo-file-system copyAsync / deleteAsync
 * Web: use File System API or download-based approach
 */
export interface BackupPlatformOps {
  /** Copy the live database file to the backup destination. Returns size in bytes. */
  copyDatabase(destinationPath: string): Promise<number>;
  /** Replace the live database with the backup file. */
  restoreDatabase(sourcePath: string): Promise<void>;
  /** Delete a backup file from disk. */
  deleteFile(filePath: string): Promise<void>;
  /** Generate a platform-appropriate backup file path for a given backup ID. */
  getBackupPath(backupId: string): string;
}

// ---------------------------------------------------------------------------
// Create backup
// ---------------------------------------------------------------------------

/**
 * Create a new backup of the hub database.
 *
 * 1. Generates a backup ID and destination path
 * 2. Delegates file copy to platform ops
 * 3. Records metadata in hub_backups
 * 4. Prunes stale backups per retention config
 *
 * @param db - Database adapter (used for metadata queries, not the file copy)
 * @param platformOps - Platform-specific file operations
 * @param options - Backup type and optional label
 * @returns Backup metadata and prune count
 */
export async function createBackup(
  db: DatabaseAdapter,
  platformOps: BackupPlatformOps,
  options: {
    type: BackupType;
    label?: string;
    id?: string;
  },
): Promise<BackupResult> {
  const id = options.id ?? generateId();
  const filePath = platformOps.getBackupPath(id);

  // Copy the live database file
  const sizeBytes = await platformOps.copyDatabase(filePath);

  // Count currently enabled modules
  const moduleCountRows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM hub_enabled_modules`,
  );
  const moduleCount = moduleCountRows[0]?.count ?? 0;

  // Record metadata
  db.execute(
    `INSERT INTO hub_backups (id, size_bytes, module_count, label, backup_type, file_path)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, sizeBytes, moduleCount, options.label ?? null, options.type, filePath],
  );

  // Prune old backups (protect the backup we just created)
  const config = getBackupConfig(db);
  const pruned = await pruneBackups(db, platformOps, config, id);

  const rows = db.query<BackupRow>(
    `SELECT * FROM hub_backups WHERE id = ?`,
    [id],
  );

  return {
    backup: rowToMetadata(rows[0]!),
    pruned,
  };
}

// ---------------------------------------------------------------------------
// Restore from backup
// ---------------------------------------------------------------------------

/**
 * Restore the hub database from a backup.
 *
 * The caller is responsible for:
 * 1. Closing any active database connections before calling
 * 2. Re-initializing the database after restore completes
 *
 * This function validates the backup exists in metadata, delegates
 * the file restore to platform ops, and returns the result.
 *
 * @param db - Database adapter (for metadata lookup before restore)
 * @param platformOps - Platform-specific file operations
 * @param backupId - ID of the backup to restore
 * @returns Restore result with metadata from the restored backup
 */
export async function restoreFromBackup(
  db: DatabaseAdapter,
  platformOps: BackupPlatformOps,
  backupId: string,
): Promise<RestoreResult> {
  const rows = db.query<BackupRow>(
    `SELECT * FROM hub_backups WHERE id = ?`,
    [backupId],
  );

  if (rows.length === 0) {
    throw new Error(`Backup not found: ${backupId}`);
  }

  const backup = rows[0]!;

  // Delegate actual file restore to platform
  await platformOps.restoreDatabase(backup.file_path);

  return {
    backupId: backup.id,
    restoredFrom: backup.created_at,
    moduleCount: backup.module_count,
  };
}

// ---------------------------------------------------------------------------
// List backups
// ---------------------------------------------------------------------------

/** List all backups, most recent first. */
export function listBackups(db: DatabaseAdapter): BackupMetadata[] {
  const rows = db.query<BackupRow>(
    `SELECT * FROM hub_backups ORDER BY created_at DESC`,
  );
  return rows.map(rowToMetadata);
}

/** List backups filtered by type, most recent first. */
export function listBackupsByType(
  db: DatabaseAdapter,
  type: BackupType,
): BackupMetadata[] {
  const rows = db.query<BackupRow>(
    `SELECT * FROM hub_backups WHERE backup_type = ? ORDER BY created_at DESC`,
    [type],
  );
  return rows.map(rowToMetadata);
}

/** Get a single backup by ID. Returns null if not found. */
export function getBackup(
  db: DatabaseAdapter,
  backupId: string,
): BackupMetadata | null {
  const rows = db.query<BackupRow>(
    `SELECT * FROM hub_backups WHERE id = ?`,
    [backupId],
  );
  return rows.length > 0 ? rowToMetadata(rows[0]!) : null;
}

// ---------------------------------------------------------------------------
// Delete backup
// ---------------------------------------------------------------------------

/**
 * Delete a backup record and its backing file.
 *
 * @returns true if the backup existed and was deleted, false if not found
 */
export async function deleteBackup(
  db: DatabaseAdapter,
  platformOps: BackupPlatformOps,
  backupId: string,
): Promise<boolean> {
  const rows = db.query<BackupRow>(
    `SELECT * FROM hub_backups WHERE id = ?`,
    [backupId],
  );

  if (rows.length === 0) return false;

  const backup = rows[0]!;
  await platformOps.deleteFile(backup.file_path);
  db.execute(`DELETE FROM hub_backups WHERE id = ?`, [backupId]);

  return true;
}

// ---------------------------------------------------------------------------
// Backup config
// ---------------------------------------------------------------------------

/** Get the current backup configuration. Returns defaults if not configured. */
export function getBackupConfig(db: DatabaseAdapter): BackupConfig {
  const rows = db.query<BackupConfigRow>(
    `SELECT max_daily, max_weekly, auto_enabled FROM hub_backup_config WHERE id = 'current'`,
  );

  if (rows.length === 0) return { ...DEFAULT_BACKUP_CONFIG };
  return rowToConfig(rows[0]!);
}

/** Update backup configuration. Creates the config row if it doesn't exist. */
export function setBackupConfig(
  db: DatabaseAdapter,
  config: Partial<BackupConfig>,
): BackupConfig {
  const current = getBackupConfig(db);
  const merged: BackupConfig = { ...current, ...config };

  db.execute(
    `INSERT INTO hub_backup_config (id, max_daily, max_weekly, auto_enabled, updated_at)
     VALUES ('current', ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       max_daily = excluded.max_daily,
       max_weekly = excluded.max_weekly,
       auto_enabled = excluded.auto_enabled,
       updated_at = excluded.updated_at`,
    [merged.maxDaily, merged.maxWeekly, merged.autoEnabled ? 1 : 0],
  );

  return merged;
}

// ---------------------------------------------------------------------------
// Pruning
// ---------------------------------------------------------------------------

/**
 * Prune backups beyond retention limits.
 *
 * Keeps the most recent `maxDaily` daily backups and `maxWeekly` weekly backups.
 * Weekly backups are identified as the newest backup per ISO week.
 * Auto-backups older than the retention window are deleted.
 * Manual backups are never auto-pruned.
 */
async function pruneBackups(
  db: DatabaseAdapter,
  platformOps: BackupPlatformOps,
  config: BackupConfig,
  protectId?: string,
): Promise<number> {
  // Only prune auto backups; manual backups are kept until explicitly deleted
  const autoBackups = db.query<BackupRow>(
    `SELECT * FROM hub_backups WHERE backup_type = 'auto' ORDER BY created_at DESC, ROWID DESC`,
  );

  if (autoBackups.length <= config.maxDaily) return 0;

  // Keep the newest maxDaily auto backups, prune the rest
  const toKeep = autoBackups.slice(0, config.maxDaily);
  const toPrune = autoBackups.slice(config.maxDaily);

  // From the prune candidates, rescue one per calendar week up to maxWeekly
  const weeklyRescued = new Map<string, BackupRow>();
  for (const backup of toPrune) {
    const weekKey = getIsoWeekKey(backup.created_at);
    if (!weeklyRescued.has(weekKey) && weeklyRescued.size < config.maxWeekly) {
      weeklyRescued.set(weekKey, backup);
    }
  }

  const keepIds = new Set([
    ...toKeep.map((b) => b.id),
    ...[...weeklyRescued.values()].map((b) => b.id),
  ]);

  // Always protect the just-created backup from being pruned
  if (protectId) keepIds.add(protectId);

  let pruned = 0;
  for (const backup of autoBackups) {
    if (!keepIds.has(backup.id)) {
      await platformOps.deleteFile(backup.file_path);
      db.execute(`DELETE FROM hub_backups WHERE id = ?`, [backup.id]);
      pruned++;
    }
  }

  return pruned;
}

// ---------------------------------------------------------------------------
// Backup validation
// ---------------------------------------------------------------------------

/**
 * Validate that a backup database is compatible with the current schema.
 *
 * Opens the backup via a caller-provided DatabaseAdapter and compares
 * hub_schema_versions against the current database. A backup is compatible
 * if every module version in the backup is <= the current version (i.e.,
 * the current app can read all data in the backup).
 *
 * @param currentDb - The live database adapter
 * @param backupDb - A read-only adapter opened on the backup file
 * @returns Validation result with compatibility status and any issues
 */
export function validateBackupCompatibility(
  currentDb: DatabaseAdapter,
  backupDb: DatabaseAdapter,
): BackupValidationResult {
  const issues: string[] = [];
  let backupModules: string[] = [];
  let backupModuleCount = 0;

  // Check that backup has hub_schema_versions table
  try {
    const tables = backupDb.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='hub_schema_versions'`,
    );
    if (tables.length === 0) {
      return {
        compatible: false,
        issues: ['Not a valid MyLife backup: missing hub_schema_versions table'],
        backupModules: [],
        backupModuleCount: 0,
      };
    }
  } catch {
    return {
      compatible: false,
      issues: ['Unable to read backup file: not a valid SQLite database'],
      backupModules: [],
      backupModuleCount: 0,
    };
  }

  // Check that backup has hub_enabled_modules table
  try {
    const tables = backupDb.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='hub_enabled_modules'`,
    );
    if (tables.length === 0) {
      issues.push('Backup is missing hub_enabled_modules table');
    } else {
      const countRows = backupDb.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM hub_enabled_modules`,
      );
      backupModuleCount = countRows[0]?.count ?? 0;
    }
  } catch {
    issues.push('Unable to read module count from backup');
  }

  // Get schema versions from both databases
  interface SchemaRow { module_id: string; version: number }

  let currentVersions: Map<string, number>;
  try {
    const currentRows = currentDb.query<SchemaRow>(
      `SELECT module_id, MAX(version) as version FROM hub_schema_versions GROUP BY module_id`,
    );
    currentVersions = new Map(currentRows.map((r) => [r.module_id, r.version]));
  } catch {
    return {
      compatible: false,
      issues: ['Unable to read current database schema versions'],
      backupModules: [],
      backupModuleCount: 0,
    };
  }

  let backupVersions: Map<string, number>;
  try {
    const backupRows = backupDb.query<SchemaRow>(
      `SELECT module_id, MAX(version) as version FROM hub_schema_versions GROUP BY module_id`,
    );
    backupVersions = new Map(backupRows.map((r) => [r.module_id, r.version]));
    backupModules = backupRows.map((r) => r.module_id);
  } catch {
    return {
      compatible: false,
      issues: ['Unable to read backup schema versions'],
      backupModules: [],
      backupModuleCount: 0,
    };
  }

  // Compare versions: backup module versions must be <= current versions
  for (const [moduleId, backupVersion] of backupVersions) {
    const currentVersion = currentVersions.get(moduleId);
    if (currentVersion === undefined) {
      // Module exists in backup but not in current app -- we can still restore,
      // the migration runner will skip unknown modules. Just note it.
      issues.push(`Backup contains unknown module "${moduleId}" (v${backupVersion})`);
    } else if (backupVersion > currentVersion) {
      issues.push(
        `Module "${moduleId}" in backup is v${backupVersion} but current app is v${currentVersion}. Update the app first.`,
      );
      // This is a hard incompatibility -- newer schema can't be read by older app
      return {
        compatible: false,
        issues,
        backupModules,
        backupModuleCount,
      };
    }
  }

  return {
    compatible: true,
    issues,
    backupModules,
    backupModuleCount,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a simple UUID v4. */
function generateId(): string {
  const hex = '0123456789abcdef';
  const segments = [8, 4, 4, 4, 12];
  return segments
    .map((len) =>
      Array.from({ length: len }, () =>
        hex[Math.floor(Math.random() * 16)],
      ).join(''),
    )
    .join('-');
}

/** Get ISO week key (YYYY-Www) from an ISO date string. */
function getIsoWeekKey(isoDate: string): string {
  const d = new Date(isoDate);
  const dayOfWeek = d.getUTCDay() || 7; // Monday = 1, Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek); // Thursday of same week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
