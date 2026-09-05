import type { DatabaseAdapter } from '@mylife/db';
import { getHealthSetting, setHealthSetting } from '../settings';

/**
 * Describes which absorbed modules have existing data.
 * Used to decide whether to show a migration prompt.
 */
export interface AbsorbedModuleData {
  hasMedsData: boolean;
  hasFastData: boolean;
  medsCount: number;
  fastCount: number;
}

const MIGRATION_DONE_KEY = 'migration.absorbed.done';

/**
 * Check if the absorption migration has already been completed.
 */
export function isAbsorptionMigrated(db: DatabaseAdapter): boolean {
  return getHealthSetting(db, MIGRATION_DONE_KEY) === 'true';
}

/**
 * Detect existing data from absorbed modules (meds, fast).
 * Cycle tracking moved to `@mylife/cycle`; habits V8 dropped the
 * deprecated `hb_periods`/`hb_cycle_settings` tables.
 */
const ABSORBED_TABLES = new Set(['md_medications', 'ft_fasts']);

export function detectAbsorbedModuleData(db: DatabaseAdapter): AbsorbedModuleData {
  const count = (table: string): number => {
    if (!ABSORBED_TABLES.has(table)) return 0;
    try {
      const rows = db.query<{ c: number }>(`SELECT COUNT(*) as c FROM ${table}`);
      return rows[0]?.c ?? 0;
    } catch {
      return 0;
    }
  };

  const medsCount = count('md_medications');
  const fastCount = count('ft_fasts');

  return {
    hasMedsData: medsCount > 0,
    hasFastData: fastCount > 0,
    medsCount,
    fastCount,
  };
}

/**
 * Copy settings from absorbed module settings tables into hl_settings
 * with namespaced keys. This preserves user preferences.
 */
export function migrateAbsorbedSettings(db: DatabaseAdapter): void {
  // Copy md_settings entries
  try {
    const medsSettings = db.query<{ key: string; value: string }>(
      `SELECT key, value FROM md_settings`,
    );
    for (const s of medsSettings) {
      setHealthSetting(db, `meds.${s.key}`, s.value);
    }
  } catch {
    // md_settings may not exist
  }

  // Copy ft_settings entries
  try {
    const fastSettings = db.query<{ key: string; value: string }>(
      `SELECT key, value FROM ft_settings`,
    );
    for (const s of fastSettings) {
      setHealthSetting(db, `fast.${s.key}`, s.value);
    }
  } catch {
    // ft_settings may not exist
  }

  // Mark migration as done
  setHealthSetting(db, MIGRATION_DONE_KEY, 'true');
}

/**
 * Disable absorbed modules in the hub so users don't see duplicates.
 * Uses disableModule from @mylife/db to remove from hub_enabled_modules.
 */
export function disableAbsorbedModules(db: DatabaseAdapter): void {
  const modules = ['meds', 'fast'];
  for (const moduleId of modules) {
    try {
      db.execute(
        `DELETE FROM hub_enabled_modules WHERE module_id = ?`,
        [moduleId],
      );
    } catch {
      // Ignore if table or row doesn't exist
    }
  }
}
