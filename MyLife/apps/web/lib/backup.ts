/**
 * Web backup implementation using Node.js file system.
 *
 * Implements BackupPlatformOps so the @mylife/db backup API can
 * copy, restore, and delete SQLite backup files on the server.
 *
 * Backups are stored in: {dbDir}/backups/
 * Each backup is a full copy of mylife-hub.db named {id}.db
 *
 * Server-only -- cannot be imported from client components.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { BackupPlatformOps } from '@mylife/db';

/** Name of the live hub database file. */
const DB_FILENAME = 'mylife-hub.db';

/** Subdirectory next to the database where backups are stored. */
const BACKUP_DIR_NAME = 'backups';

/**
 * Resolve the absolute path to the live database file.
 * Mirrors the resolution logic in lib/db.ts.
 */
export function getDatabasePath(): string {
  const configuredPath = process.env.MYLIFE_DB_PATH?.trim();
  if (configuredPath) {
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : path.join(process.cwd(), configuredPath);
  }
  return path.join(process.cwd(), DB_FILENAME);
}

/**
 * Get the absolute path to the backup directory.
 * Creates it next to the database file.
 */
export function getBackupDir(): string {
  const dbPath = getDatabasePath();
  return path.join(path.dirname(dbPath), BACKUP_DIR_NAME);
}

/**
 * Ensure the backup directory exists. Safe to call multiple times.
 */
export function ensureBackupDir(): void {
  const dir = getBackupDir();
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Create the web BackupPlatformOps implementation.
 *
 * Usage:
 * ```ts
 * import { createBackup } from '@mylife/db';
 * import { createWebBackupOps } from '../lib/backup';
 *
 * const ops = createWebBackupOps();
 * const result = await createBackup(db, ops, { type: 'manual' });
 * ```
 */
export function createWebBackupOps(): BackupPlatformOps {
  const backupDir = getBackupDir();
  const dbPath = getDatabasePath();

  return {
    async copyDatabase(destinationPath: string): Promise<number> {
      ensureBackupDir();
      fs.copyFileSync(dbPath, destinationPath);

      const stats = fs.statSync(destinationPath);
      return stats.size;
    },

    async restoreDatabase(sourcePath: string): Promise<void> {
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Backup file not found: ${sourcePath}`);
      }

      // Copy backup over the live database
      fs.copyFileSync(sourcePath, dbPath);
    },

    async deleteFile(filePath: string): Promise<void> {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    },

    getBackupPath(backupId: string): string {
      return path.join(backupDir, `${backupId}.db`);
    },
  };
}

/**
 * Read a backup file into a Buffer for download.
 * Returns null if the file does not exist.
 */
export function readBackupFile(filePath: string): Buffer | null {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

/**
 * Write an uploaded file to the backup directory and return its path.
 * Used by restore-from-upload flows: save the upload first,
 * then pass the path to restoreFromBackup.
 */
export function saveUploadedBackup(
  backupId: string,
  data: Buffer,
): string {
  ensureBackupDir();
  const filePath = path.join(getBackupDir(), `${backupId}.db`);
  fs.writeFileSync(filePath, data);
  return filePath;
}
