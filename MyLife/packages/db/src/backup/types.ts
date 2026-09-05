/**
 * Backup system types for the MyLife hub database.
 *
 * Defines metadata, configuration, and result types used by the
 * backup/restore API. Platform-specific file operations are handled
 * by callers (expo-file-system on mobile, File System API on web).
 */

/** How the backup was triggered. */
export type BackupType = 'auto' | 'manual';

/** Metadata for a single backup record. */
export interface BackupMetadata {
  /** Unique backup identifier (UUID). */
  id: string;
  /** ISO 8601 timestamp when the backup was created. */
  createdAt: string;
  /** Size of the backup file in bytes. */
  sizeBytes: number;
  /** Number of enabled modules at backup time. */
  moduleCount: number;
  /** Optional user-provided or auto-generated label. */
  label: string | null;
  /** Whether this backup was automatic or user-triggered. */
  type: BackupType;
  /** Platform-specific file path where the backup is stored. */
  filePath: string;
}

/**
 * Retention and scheduling configuration for automatic backups.
 *
 * Daily backups are pruned to keep the most recent `maxDaily`.
 * Weekly backups (one per calendar week) are pruned to `maxWeekly`.
 * Total on-disk backup count never exceeds maxDaily + maxWeekly.
 */
export interface BackupConfig {
  /** Maximum number of daily backups to retain. */
  maxDaily: number;
  /** Maximum number of weekly backups to retain. */
  maxWeekly: number;
  /** Whether automatic daily backups are enabled. */
  autoEnabled: boolean;
}

/** Default backup configuration for new installations. */
export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  maxDaily: 7,
  maxWeekly: 4,
  autoEnabled: true,
};

/** Result returned after a successful backup creation. */
export interface BackupResult {
  /** Metadata of the newly created backup. */
  backup: BackupMetadata;
  /** Number of stale backups pruned during this operation. */
  pruned: number;
}

/** Result returned after a successful restore operation. */
export interface RestoreResult {
  /** ID of the backup that was restored. */
  backupId: string;
  /** ISO 8601 timestamp of the restored backup. */
  restoredFrom: string;
  /** Number of modules whose data was restored. */
  moduleCount: number;
}

/** Result of validating a backup file for compatibility. */
export interface BackupValidationResult {
  /** Whether the backup is compatible with the current database. */
  compatible: boolean;
  /** Human-readable issues found during validation. */
  issues: string[];
  /** Module IDs found in the backup's schema_versions table. */
  backupModules: string[];
  /** Number of enabled modules in the backup. */
  backupModuleCount: number;
}
