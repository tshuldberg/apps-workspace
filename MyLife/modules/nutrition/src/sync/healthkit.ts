import type { DatabaseAdapter } from '@mylife/db';
import { getSetting } from '../db/settings';
import { getUserProfile, calculateBMR, upsertEnergyLog, readActiveCaloriesFromHealth } from './energy-balance';

/**
 * Check if wearable sync is enabled in settings.
 */
export function isSyncEnabled(db: DatabaseAdapter): boolean {
  return getSetting(db, 'syncEnabled') === 'true';
}

/**
 * Get sync direction preference.
 */
export function getSyncDirection(db: DatabaseAdapter): 'read' | 'write' | 'both' {
  const val = getSetting(db, 'syncDirection');
  if (val === 'write' || val === 'both') return val;
  return 'read';
}

/**
 * Sync energy data from HealthKit (via health module) for a given date.
 * Falls back to calculated BMR if HealthKit data is unavailable.
 *
 * Returns true if data was synced/calculated, false if sync is disabled.
 */
export function syncEnergyForDate(
  db: DatabaseAdapter,
  id: string,
  date: string,
): boolean {
  const profile = getUserProfile(db);
  const bmr = Math.round(calculateBMR(profile));

  // Try reading active calories from health module
  const healthActive = readActiveCaloriesFromHealth(db, date);
  const activeCalories = healthActive ?? 0;
  const source = healthActive !== null ? 'healthkit' as const : 'calculated' as const;

  upsertEnergyLog(db, id, {
    date,
    basalCalories: bmr,
    activeCalories,
    source,
  });

  return true;
}

/**
 * Get the calories to write back to HealthKit (total dietary energy for date).
 * Returns null if write-back is not enabled.
 */
export function getDietaryCaloriesForWriteBack(
  db: DatabaseAdapter,
  date: string,
): number | null {
  const direction = getSyncDirection(db);
  if (direction !== 'write' && direction !== 'both') return null;

  const rows = db.query<{ total: number }>(
    `SELECT COALESCE(SUM(i.calories), 0) as total
     FROM nu_food_log_items i
     JOIN nu_food_log l ON l.id = i.log_id
     WHERE l.date = ?`,
    [date],
  );

  return rows[0]?.total ?? 0;
}
