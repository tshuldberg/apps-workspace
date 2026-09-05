/**
 * Web auto-backup scheduler.
 *
 * Server-only module that checks whether a daily auto-backup is due and
 * fires one if so. Invoked from the root layout on each request; the
 * scheduler short-circuits if it has already run within the 24h window,
 * using `hub_preferences` for request-level debouncing on top of the
 * `hub_backups` timestamp cadence.
 *
 * Errors are caught and logged so layout rendering is never blocked.
 */

import 'server-only';

import type { DatabaseAdapter } from '@mylife/db';
import {
  createBackup,
  getBackupConfig,
  getPreference,
  listBackupsByType,
  setPreference,
} from '@mylife/db';
import { getAdapter } from './db';
import { createWebBackupOps } from './backup';

/** Minimum interval between auto-backups (24 hours in ms). */
export const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Preference key holding the last scheduler check timestamp (ms epoch). */
const LAST_CHECK_PREF_KEY = 'hub.backup.scheduler.last_check_ms';

/**
 * Check the backup config and most recent auto-backup; if auto-backup is
 * enabled and 24h has passed (or none exists yet), create a new `type='auto'`
 * backup. Retention pruning runs automatically inside `createBackup`.
 *
 * Server-safe: never throws. Failures are logged via console.warn.
 * Idempotent within a 24h window via `hub_preferences` debounce, so it is
 * safe to invoke from the root layout on every request.
 */
export async function checkAndCreateAutoBackup(
  db: DatabaseAdapter,
): Promise<void> {
  try {
    // Request-level debounce: skip if scheduler already ran in the last 24h
    const lastCheckRaw = getPreference(db, LAST_CHECK_PREF_KEY);
    if (lastCheckRaw) {
      const lastCheck = Number.parseInt(lastCheckRaw, 10);
      if (
        Number.isFinite(lastCheck) &&
        Date.now() - lastCheck < AUTO_BACKUP_INTERVAL_MS
      ) {
        return;
      }
    }
    setPreference(db, LAST_CHECK_PREF_KEY, String(Date.now()));

    const config = getBackupConfig(db);
    if (!config.autoEnabled) return;

    const autoBackups = listBackupsByType(db, 'auto');
    if (autoBackups.length > 0) {
      const lastTime = new Date(autoBackups[0]!.createdAt).getTime();
      if (Date.now() - lastTime < AUTO_BACKUP_INTERVAL_MS) return;
    }

    const ops = createWebBackupOps();
    await createBackup(db, ops, { type: 'auto' });
  } catch (err) {
    // Auto-backup failures are non-fatal; log and move on.
    console.warn('[MyLife] Auto-backup failed:', err);
  }
}

/**
 * Convenience wrapper that loads the singleton adapter and runs the check.
 * Safe to call from a Next.js server component or server action.
 */
export async function runAutoBackupScheduler(): Promise<void> {
  try {
    const db = getAdapter();
    await checkAndCreateAutoBackup(db);
  } catch (err) {
    console.warn('[MyLife] Auto-backup scheduler bootstrap failed:', err);
  }
}
