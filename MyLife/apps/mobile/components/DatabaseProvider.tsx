import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, type AppStateStatus, View, ActivityIndicator, Text, Pressable, StyleSheet } from 'react-native';
import {
  openDatabaseSync,
  type SQLiteDatabase,
  type SQLiteBindParams,
} from 'expo-sqlite';
import {
  type DatabaseAdapter,
  initializeHubDatabase,
  runIsolatedModuleMigrations,
  getEnabledModules,
  enableModule,
  getHubMode,
  setHubMode,
} from '@mylife/db';
import { BOOKS_MODULE } from '@mylife/books';
import { FAST_MODULE } from '@mylife/fast';
import { FLASH_MODULE } from '@mylife/flash';
import { GARDEN_MODULE } from '@mylife/garden';
import { BUDGET_MODULE } from '@mylife/budget';
import { SURF_MODULE } from '@mylife/surf';
import { RECIPES_MODULE } from '@mylife/bestchef';
import { WORKOUTS_MODULE } from '@mylife/workouts';
import { HOMES_MODULE } from '@mylife/homes';
import { CAR_MODULE } from '@mylife/car';
import { CLASSES_MODULE } from '@mylife/classes';
import { CLOSET_MODULE } from '@mylife/closet';
import { CYCLE_MODULE } from '@mylife/cycle';
import { CREATE_MODULE } from '@mylife/create';
import { HABITS_MODULE } from '@mylife/habits';
import { MEDS_MODULE } from '@mylife/meds';
import { MOOD_MODULE } from '@mylife/mood';
import { NOTES_MODULE } from '@mylife/notes';
import { HEALTH_MODULE } from '@mylife/health';
import { NUTRITION_MODULE } from '@mylife/nutrition';
import { JOURNAL_MODULE } from '@mylife/journal';
import { PETS_MODULE } from '@mylife/pets';
import { RSVP_MODULE } from '@mylife/rsvp';
import { STARS_MODULE } from '@mylife/stars';
import { TRAILS_MODULE } from '@mylife/trails';
import { VOICE_MODULE } from '@mylife/voice';
import { MAIL_MODULE } from '@mylife/mail';
import { FORUMS_MODULE } from '@mylife/forums';
import { MARKET_MODULE } from '@mylife/market';
import { PRESENCE_MODULE } from '@mylife/presence';
import { WORDS_MODULE } from '@mylife/words';
import { FRIENDS_MODULE } from '@mylife/friends';
import { SLEEP_MODULE } from '@mylife/sleep';
import { SPORTS_MODULE } from '@mylife/sports';
import { ensureSyncBootstrap } from '@mylife/sync';
import type { ModuleRegistry, ModuleId } from '@mylife/module-registry';
import { USER_VISIBLE_MODULE_IDS, isUserVisibleModule } from '@mylife/module-registry';
import { colors } from '@mylife/ui';
import { useAutoBackup } from '../hooks/use-auto-backup';

/** Wraps expo-sqlite to implement the DatabaseAdapter interface from @mylife/db. */
function createExpoAdapter(db: SQLiteDatabase): DatabaseAdapter {
  return {
    execute(sql: string, params?: unknown[]): void {
      db.runSync(sql, (params ?? []) as SQLiteBindParams);
    },
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
      return db.getAllSync(sql, (params ?? []) as SQLiteBindParams) as T[];
    },
    transaction(fn: () => void): void {
      db.withTransactionSync(fn);
    },
  };
}

function waitForUiTick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Map of module IDs to their full definitions (with migrations).
 * Only modules with actual migrations need to be listed here.
 */
const MODULE_DEFINITIONS_WITH_MIGRATIONS = {
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
  cycle: CYCLE_MODULE,
  create: CREATE_MODULE,
  habits: HABITS_MODULE,
  meds: MEDS_MODULE,
  mood: MOOD_MODULE,
  notes: NOTES_MODULE,
  garden: GARDEN_MODULE,
  health: HEALTH_MODULE,
  nutrition: NUTRITION_MODULE,
  journal: JOURNAL_MODULE,
  pets: PETS_MODULE,
  rsvp: RSVP_MODULE,
  stars: STARS_MODULE,
  trails: TRAILS_MODULE,
  voice: VOICE_MODULE,
  mail: MAIL_MODULE,
  forums: FORUMS_MODULE,
  market: MARKET_MODULE,
  presence: PRESENCE_MODULE,
  sleep: SLEEP_MODULE,
  sports: SPORTS_MODULE,
  words: WORDS_MODULE,
  friends: FRIENDS_MODULE,
} as const;

const DatabaseContext = createContext<DatabaseAdapter | null>(null);

/** Access the hub database adapter from any component in the tree. */
export function useDatabase(): DatabaseAdapter {
  const db = useContext(DatabaseContext);
  if (!db) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return db;
}

interface DatabaseProviderProps {
  children: React.ReactNode;
  registry: ModuleRegistry;
}

interface MigrationProgressState {
  moduleId: ModuleId;
  moduleName: string;
  moduleIndex: number;
  totalModules: number;
  completedModules: number;
}

/**
 * Opens the hub SQLite database, syncs enabled module state from SQLite
 * into the ModuleRegistry, runs module migrations, and provides the
 * DatabaseAdapter to the component tree via context.
 */
export function DatabaseProvider({ children, registry }: DatabaseProviderProps) {
  const [adapter, setAdapter] = useState<DatabaseAdapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgressState | null>(null);
  const [showMigrationProgress, setShowMigrationProgress] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const slowMigrationTimer = setTimeout(() => {
      if (!cancelled) {
        setShowMigrationProgress(true);
      }
    }, 1000);

    const initializeDatabase = async () => {
      setAdapter(null);
      setError(null);
      setShowMigrationProgress(false);
      setMigrationProgress(null);

      try {
        const db = openDatabaseSync('mylife-hub.db');
        const dbAdapter = createExpoAdapter(db);

        // Enable WAL mode for better concurrent read/write performance
        db.runSync('PRAGMA journal_mode=WAL;');

        // 1. Initialize hub tables
        initializeHubDatabase(dbAdapter);

        // Ensure a default mode row exists for runtime mode selection.
        if (!getHubMode(dbAdapter)) {
          setHubMode(dbAdapter, 'local_only');
        }

        // 2. Sync enabled modules from SQLite into registry.
        //
        // For the current test build we default every user-visible module
        // to ON so testers land with a fully populated dashboard. Modules
        // marked "hidden" in release-states.ts (fast, flash, homes, journal,
        // notes, voice, words, plus the always-hidden garden / mail / subs)
        // are filtered out even if a previous install had them enabled --
        // their DB rows are preserved so a future release can flip the
        // release state and bring them back without data loss.
        const enabledRows = getEnabledModules(dbAdapter);
        if (enabledRows.length === 0) {
          // First boot (or cleared state): auto-enable every visible module.
          for (const visibleId of USER_VISIBLE_MODULE_IDS) {
            enableModule(dbAdapter, visibleId);
            registry.enable(visibleId);
          }
        } else {
          for (const row of enabledRows) {
            const id = row.module_id as ModuleId;
            if (isUserVisibleModule(id)) {
              registry.enable(id);
            }
          }
        }

        // 3. Run migrations for all known module schemas.
        // This prevents missing-table crashes when a module route loads before
        // enable-state sync. Failed modules are disabled and the rest continue.
        const moduleEntries = Object.values(MODULE_DEFINITIONS_WITH_MIGRATIONS).map(
          (moduleDef) => ({
            moduleId: moduleDef.id,
            moduleName: moduleDef.name,
            migrations: moduleDef.migrations,
          }),
        );
        const moduleNameById = new Map(
          moduleEntries.map((moduleEntry) => [
            moduleEntry.moduleId,
            moduleEntry.moduleName,
          ]),
        );

        await runIsolatedModuleMigrations(dbAdapter, moduleEntries, {
          onModuleStart: async ({
            moduleId,
            moduleIndex,
            totalModules,
            completedModules,
          }) => {
            if (cancelled) return;
            setMigrationProgress({
              moduleId: moduleId as ModuleId,
              moduleName: moduleNameById.get(moduleId as ModuleId) ?? moduleId,
              moduleIndex,
              totalModules,
              completedModules,
            });
            await waitForUiTick();
          },
          onModuleFailed: (moduleId) => {
            if (!cancelled) {
              registry.disable(moduleId as ModuleId);
            }
          },
        });

        ensureSyncBootstrap(dbAdapter, {
          deviceDisplayName: 'MyLife Device',
          personalWorkspaceName: 'Personal Workspace',
        });

        // 4. Run a quick integrity check to detect database corruption early
        try {
          const integrityResult = dbAdapter.query<{ integrity_check: string }>(
            'PRAGMA integrity_check(1)',
          );
          const result = integrityResult[0]?.integrity_check;
          if (result && result !== 'ok') {
            console.error('[MyLife] Database integrity check failed:', result);
          }
        } catch (integrityErr) {
          console.error('[MyLife] Could not run integrity check:', integrityErr);
        }

        if (!cancelled) {
          setError(null);
          setAdapter(dbAdapter);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[MyLife] Database initialization failed:', err);
        if (!cancelled) {
          setError(msg);
        }
      } finally {
        clearTimeout(slowMigrationTimer);
        if (!cancelled) {
          setShowMigrationProgress(false);
          setMigrationProgress(null);
        }
      }
    };

    void initializeDatabase();

    return () => {
      cancelled = true;
      clearTimeout(slowMigrationTimer);
    };
  }, [registry, retryCount]);

  // Test DB connection on foreground resume to detect stale connections
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active' && adapter) {
        try {
          adapter.query('SELECT 1');
        } catch (err) {
          console.error('[MyLife] DB connection stale after resume:', err);
          setRetryCount((c) => c + 1);
        }
      }
    });
    return () => subscription.remove();
  }, [adapter]);

  // Schedule daily auto-backups when the app is active
  // Must be called before any early returns to satisfy Rules of Hooks
  useAutoBackup(adapter);

  if (error) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorMessage}>
          MyLife couldn't open its database. This can happen if your device is low on storage.
        </Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={() => setRetryCount((c) => c + 1)}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  if (!adapter) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.textSecondary} />
        {showMigrationProgress && migrationProgress ? (
          <>
            <Text style={styles.loadingTitle}>Updating your modules</Text>
            <Text style={styles.loadingMessage}>
              {migrationProgress.moduleName} ({migrationProgress.moduleIndex} of{' '}
              {migrationProgress.totalModules})
            </Text>
          </>
        ) : null}
      </View>
    );
  }

  return (
    <DatabaseContext.Provider value={adapter}>
      {children}
    </DatabaseContext.Provider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 32,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 22,
  },
  errorDetail: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'Courier',
    opacity: 0.7,
  },
  retryButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 18,
    textAlign: 'center',
  },
  loadingMessage: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
});
