/**
 * SQLite schema for hub_backups table.
 *
 * Tracks backup metadata in the hub database. The actual backup files
 * live on the file system; this table stores the inventory and config.
 */

export const CREATE_HUB_BACKUPS = `
CREATE TABLE IF NOT EXISTS hub_backups (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  module_count INTEGER NOT NULL CHECK (module_count >= 0),
  label TEXT,
  backup_type TEXT NOT NULL CHECK (backup_type IN ('auto', 'manual')),
  file_path TEXT NOT NULL
);`;

export const CREATE_HUB_BACKUP_CONFIG = `
CREATE TABLE IF NOT EXISTS hub_backup_config (
  id TEXT PRIMARY KEY NOT NULL CHECK (id = 'current'),
  max_daily INTEGER NOT NULL DEFAULT 7 CHECK (max_daily >= 1),
  max_weekly INTEGER NOT NULL DEFAULT 4 CHECK (max_weekly >= 0),
  auto_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_BACKUP_INDEXES = [
  `CREATE INDEX IF NOT EXISTS hub_backups_type_created_idx
     ON hub_backups (backup_type, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS hub_backups_created_idx
     ON hub_backups (created_at DESC);`,
] as const;

/** All backup DDL statements in creation order. */
export const BACKUP_TABLES = [
  CREATE_HUB_BACKUPS,
  CREATE_HUB_BACKUP_CONFIG,
  ...CREATE_HUB_BACKUP_INDEXES,
] as const;
