/**
 * Backup system for the MyLife hub database.
 *
 * Provides metadata tracking, retention configuration, and a
 * platform-agnostic API for creating and restoring SQLite backups.
 */

// Types
export type {
  BackupType,
  BackupMetadata,
  BackupConfig,
  BackupResult,
  RestoreResult,
  BackupValidationResult,
} from './types';
export { DEFAULT_BACKUP_CONFIG } from './types';

// Schema DDL
export {
  CREATE_HUB_BACKUPS,
  CREATE_HUB_BACKUP_CONFIG,
  CREATE_HUB_BACKUP_INDEXES,
  BACKUP_TABLES,
} from './schema';

// Platform operations interface
export type { BackupPlatformOps } from './operations';

// CRUD operations
export {
  createBackup,
  restoreFromBackup,
  listBackups,
  listBackupsByType,
  getBackup,
  deleteBackup,
  getBackupConfig,
  setBackupConfig,
  validateBackupCompatibility,
} from './operations';
