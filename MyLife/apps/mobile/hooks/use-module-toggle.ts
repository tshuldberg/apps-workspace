import { useCallback, useState } from 'react';
import type { ModuleId } from '@mylife/module-registry';
import {
  isHealthDataModule,
  HEALTH_DATA_TYPES,
  MODULE_METADATA,
} from '@mylife/module-registry';
import { useModuleRegistry } from '@mylife/module-registry';
import {
  enableModule,
  disableModule,
  runModuleMigrations,
  hasActiveHealthConsent,
  recordHealthConsent,
} from '@mylife/db';
import { BOOKS_MODULE } from '@mylife/books';
import { FAST_MODULE } from '@mylife/fast';
import { FLASH_MODULE } from '@mylife/flash';
import { BUDGET_MODULE } from '@mylife/budget';
import { SURF_MODULE } from '@mylife/surf';
import { RECIPES_MODULE } from '@mylife/bestchef';
import { WORKOUTS_MODULE } from '@mylife/workouts';
import { HOMES_MODULE } from '@mylife/homes';
import { CAR_MODULE } from '@mylife/car';
import { CLASSES_MODULE } from '@mylife/classes';
import { CLOSET_MODULE } from '@mylife/closet';
import { CREATE_MODULE } from '@mylife/create';
import { HABITS_MODULE } from '@mylife/habits';
import { MEDS_MODULE } from '@mylife/meds';
import { JOURNAL_MODULE } from '@mylife/journal';
import { PETS_MODULE } from '@mylife/pets';
import { RSVP_MODULE } from '@mylife/rsvp';
import { SLEEP_MODULE } from '@mylife/sleep';
import { useDatabase } from '../components/DatabaseProvider';

/**
 * Map of module IDs to their full definitions (with migrations).
 * Only modules with actual migrations need to be listed here.
 */
const MODULE_DEFINITIONS_WITH_MIGRATIONS: Partial<Record<ModuleId, { migrations?: { version: number; description: string; up: string[]; down: string[] }[] }>> = {
  books: BOOKS_MODULE,
  fast: FAST_MODULE,
  flash: FLASH_MODULE,
  budget: BUDGET_MODULE,
  surf: SURF_MODULE,
  recipes: RECIPES_MODULE,
  workouts: WORKOUTS_MODULE,
  homes: HOMES_MODULE,
  car: CAR_MODULE,
  classes: CLASSES_MODULE,
  closet: CLOSET_MODULE,
  create: CREATE_MODULE,
  habits: HABITS_MODULE,
  meds: MEDS_MODULE,
  journal: JOURNAL_MODULE,
  pets: PETS_MODULE,
  rsvp: RSVP_MODULE,
  sleep: SLEEP_MODULE,
};

export interface PendingConsent {
  moduleId: ModuleId;
  moduleName: string;
  moduleIcon: string;
  dataTypes: readonly string[];
}

/**
 * Hook that toggles a module's enabled state in both the in-memory
 * registry and the SQLite hub_enabled_modules table. When enabling,
 * also runs the module's migrations if it has any.
 *
 * For health data modules, checks for active consent before enabling.
 * If consent is missing, sets pendingConsent state so the caller can
 * show the HealthDataConsentDialog.
 */
export function useModuleToggle() {
  const registry = useModuleRegistry();
  const db = useDatabase();
  const [pendingConsent, setPendingConsent] = useState<PendingConsent | null>(null);

  const enableWithMigrations = useCallback(
    (id: ModuleId) => {
      enableModule(db, id);
      const moduleDef = MODULE_DEFINITIONS_WITH_MIGRATIONS[id];
      if (moduleDef?.migrations) {
        runModuleMigrations(db, id, moduleDef.migrations);
      }
      registry.enable(id);
    },
    [registry, db],
  );

  const toggle = useCallback(
    (id: ModuleId) => {
      if (registry.isEnabled(id)) {
        disableModule(db, id);
        registry.disable(id);
        return;
      }

      // Health data modules require affirmative consent before enabling
      if (isHealthDataModule(id) && !hasActiveHealthConsent(db, id)) {
        const meta = MODULE_METADATA[id];
        setPendingConsent({
          moduleId: id,
          moduleName: meta.name,
          moduleIcon: meta.icon,
          dataTypes: HEALTH_DATA_TYPES[id] ?? [],
        });
        return;
      }

      enableWithMigrations(id);
    },
    [registry, db, enableWithMigrations],
  );

  /** Called when the user consents in the dialog. Records consent and enables the module. */
  const confirmConsent = useCallback(() => {
    if (!pendingConsent) return;
    const { moduleId, dataTypes } = pendingConsent;
    recordHealthConsent(db, moduleId, [...dataTypes]);
    enableWithMigrations(moduleId);
    setPendingConsent(null);
  }, [pendingConsent, db, enableWithMigrations]);

  /** Called when the user declines in the dialog. Clears pending state without enabling. */
  const declineConsent = useCallback(() => {
    setPendingConsent(null);
  }, []);

  return { toggle, pendingConsent, confirmConsent, declineConsent };
}
