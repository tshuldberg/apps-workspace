/**
 * Mobile auto-backup scheduler.
 *
 * Checks whether a daily auto-backup is due and fires one if so.
 * Respects the `hub_backup_config.auto_enabled` flag and the
 * retention policy in the same table. Errors are logged and swallowed
 * so the caller can fire-and-forget at app launch / foreground resume.
 *
 * The daily cadence is derived from the most recent `type='auto'` row
 * in `hub_backups`. Retention pruning is handled inside `createBackup`
 * via the config loaded from `hub_backup_config`, so this module does
 * not re-implement it.
 */

import type { DatabaseAdapter } from '@mylife/db';
import {
  createBackup,
  getBackupConfig,
  listBackupsByType,
} from '@mylife/db';
import { createMobileBackupOps } from './backup';

/** Minimum interval between auto-backups (24 hours in ms). */
export const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Check the backup config and most recent auto-backup; if auto-backup is
 * enabled and 24h has passed (or none exists yet), create a new `type='auto'`
 * backup. Retention pruning runs automatically inside `createBackup`.
 *
 * Never throws. Failures are logged via console.warn so the caller can
 * fire-and-forget this at app launch.
 */
export async function checkAndCreateAutoBackup(
  db: DatabaseAdapter,
): Promise<void> {
  try {
    const config = getBackupConfig(db);
    if (!config.autoEnabled) return;

    const autoBackups = listBackupsByType(db, 'auto');
    if (autoBackups.length > 0) {
      const lastTime = new Date(autoBackups[0]!.createdAt).getTime();
      if (Date.now() - lastTime < AUTO_BACKUP_INTERVAL_MS) return;
    }

    const ops = createMobileBackupOps();
    await createBackup(db, ops, { type: 'auto' });
  } catch (err) {
    // Auto-backup failures are non-fatal; log and move on.
    console.warn('[MyLife] Auto-backup failed:', err);
  }
}
