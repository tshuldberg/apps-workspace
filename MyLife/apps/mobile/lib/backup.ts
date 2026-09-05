/**
 * Mobile backup implementation using expo-file-system.
 *
 * Implements BackupPlatformOps so the @mylife/db backup API can
 * copy, restore, and delete SQLite backup files on device.
 *
 * Also provides share sheet export, document picker import, and
 * backup validation helpers for the full backup/restore flow.
 *
 * Backups are stored in: {documentDirectory}backups/
 * Each backup is a full copy of mylife-hub.db named {id}.db
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as SQLite from 'expo-sqlite';
import type { BackupPlatformOps, DatabaseAdapter } from '@mylife/db';

/** Subdirectory under documentDirectory where backups are stored. */
const BACKUP_DIR_NAME = 'backups';

/** Name of the live hub database file. */
const DB_FILENAME = 'mylife-hub.db';

/**
 * Get the absolute path to the backup directory.
 * Throws if documentDirectory is unavailable (e.g. in tests without mocking).
 */
export function getBackupDir(): string {
  const docDir = FileSystem.documentDirectory;
  if (!docDir) {
    throw new Error('expo-file-system documentDirectory is not available');
  }
  return `${docDir}${BACKUP_DIR_NAME}/`;
}

/**
 * Get the absolute path to the live database file.
 * expo-sqlite stores databases in the SQLite subdirectory of documentDirectory.
 */
export function getDatabasePath(): string {
  const docDir = FileSystem.documentDirectory;
  if (!docDir) {
    throw new Error('expo-file-system documentDirectory is not available');
  }
  // expo-sqlite stores databases under {documentDirectory}SQLite/
  return `${docDir}SQLite/${DB_FILENAME}`;
}

/**
 * Ensure the backup directory exists. Safe to call multiple times.
 */
export async function ensureBackupDir(): Promise<void> {
  const dir = getBackupDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

// ---------------------------------------------------------------------------
// Export via share sheet
// ---------------------------------------------------------------------------

/**
 * Share a backup file via the system share sheet.
 * The file is shared with a .mylife extension for brand recognition.
 */
export async function exportBackupViaShareSheet(backupFilePath: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device');
  }

  // Copy to a temp file with .mylife extension for user-friendly naming
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const exportName = `MyLife-Backup-${timestamp}.mylife`;
  const tempPath = `${FileSystem.cacheDirectory}${exportName}`;

  await FileSystem.copyAsync({ from: backupFilePath, to: tempPath });

  await Sharing.shareAsync(tempPath, {
    mimeType: 'application/octet-stream',
    dialogTitle: 'Export MyLife Backup',
    UTI: 'public.database',
  });

  // Clean up temp file
  await FileSystem.deleteAsync(tempPath, { idempotent: true });
}

// ---------------------------------------------------------------------------
// Import from file picker
// ---------------------------------------------------------------------------

/**
 * Open the document picker to select a backup file.
 * Returns the file URI or null if the user cancelled.
 */
export async function pickBackupFile(): Promise<{ uri: string; name: string; size: number } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/octet-stream', 'application/x-sqlite3', '*/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0]!;
  return {
    uri: asset.uri,
    name: asset.name,
    size: asset.size ?? 0,
  };
}

/**
 * Copy a picked file into the backup directory so it can be validated and restored.
 * Returns the backup directory path for the imported file.
 */
export async function stageImportedBackup(sourceUri: string): Promise<string> {
  await ensureBackupDir();
  const importId = `import-${Date.now()}`;
  const stagedPath = `${getBackupDir()}${importId}.db`;
  await FileSystem.copyAsync({ from: sourceUri, to: stagedPath });
  return stagedPath;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Open a backup SQLite file as a read-only DatabaseAdapter for validation.
 * The caller must call close() when done.
 */
export async function openBackupForValidation(filePath: string): Promise<{
  adapter: DatabaseAdapter;
  close: () => void;
}> {
  // Copy to SQLite directory with a unique name to avoid collision with live DB
  const docDir = FileSystem.documentDirectory;
  if (!docDir) throw new Error('documentDirectory not available');

  const validationPath = `${docDir}SQLite/validation-${Date.now()}.db`;
  await FileSystem.copyAsync({ from: filePath, to: validationPath });

  const validationDbName = validationPath.split('/').pop()!;
  const sqliteDb = SQLite.openDatabaseSync(validationDbName);

  const adapter: DatabaseAdapter = {
    execute(sql: string, params?: unknown[]): void {
      sqliteDb.runSync(sql, (params ?? []) as SQLite.SQLiteBindParams);
    },
    query<T>(sql: string, params?: unknown[]): T[] {
      return sqliteDb.getAllSync(sql, (params ?? []) as SQLite.SQLiteBindParams) as T[];
    },
    transaction(fn: () => void): void {
      sqliteDb.withTransactionSync(fn);
    },
  };

  return {
    adapter,
    close: () => {
      sqliteDb.closeSync();
      // Clean up the validation copy
      FileSystem.deleteAsync(validationPath, { idempotent: true }).catch(() => {});
    },
  };
}

// ---------------------------------------------------------------------------
// Platform ops factory
// ---------------------------------------------------------------------------

/**
 * Create the mobile BackupPlatformOps implementation.
 *
 * Usage:
 * ```ts
 * import { createBackup } from '@mylife/db';
 * import { createMobileBackupOps } from '../lib/backup';
 *
 * const ops = createMobileBackupOps();
 * const result = await createBackup(db, ops, { type: 'manual' });
 * ```
 */
export function createMobileBackupOps(): BackupPlatformOps {
  const backupDir = getBackupDir();
  const dbPath = getDatabasePath();

  return {
    async copyDatabase(destinationPath: string): Promise<number> {
      await ensureBackupDir();
      await FileSystem.copyAsync({
        from: dbPath,
        to: destinationPath,
      });

      const info = await FileSystem.getInfoAsync(destinationPath);
      if (!info.exists) {
        throw new Error(`Backup file not found after copy: ${destinationPath}`);
      }
      return info.size ?? 0;
    },

    async restoreDatabase(sourcePath: string): Promise<void> {
      const info = await FileSystem.getInfoAsync(sourcePath);
      if (!info.exists) {
        throw new Error(`Backup file not found: ${sourcePath}`);
      }

      // Copy backup over the live database
      await FileSystem.copyAsync({
        from: sourcePath,
        to: dbPath,
      });
    },

    async deleteFile(filePath: string): Promise<void> {
      const info = await FileSystem.getInfoAsync(filePath);
      if (info.exists) {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
      }
    },

    getBackupPath(backupId: string): string {
      return `${backupDir}${backupId}.db`;
    },
  };
}
