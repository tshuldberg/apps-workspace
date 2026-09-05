import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View, StyleSheet } from 'react-native';
import {
  openDatabaseSync,
  type SQLiteDatabase,
  type SQLiteBindParams,
} from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import type { DatabaseAdapter } from '@mylife/db';
import { RECIPES_MODULE } from '@mylife/bestchef';
import {
  configureSyncPrng,
  configureSyncSecretStore,
  ensureSyncBootstrap,
  hasConfiguredSyncPrng,
  hasConfiguredSyncSecretStore,
  SyncEngine,
} from '@mylife/sync';
import { Text } from '@mylife/ui';
import { shouldEnableBestChefMeshSync } from '../data/launch-environment';

type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

interface BestChefDatabaseAdapter extends DatabaseAdapter {
  recordSyncChange?: (
    table: string,
    operation: SyncOperation,
    rowId: string,
    data: Record<string, unknown> | null,
  ) => void;
  syncDeviceId?: string;
  syncDisplayName?: string;
}

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

const DatabaseContext = createContext<DatabaseAdapter | null>(null);

function ensureNativeSyncPrng(): void {
  if (hasConfiguredSyncPrng()) return;

  configureSyncPrng((byteCount) => Crypto.getRandomBytes(byteCount));
}

function ensureNativeSyncSecretStore(): void {
  if (hasConfiguredSyncSecretStore()) return;

  const options: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    keychainService: 'com.bestchef.bestchef.sync',
  };

  configureSyncSecretStore({
    getSecret(ref: string): string | null {
      return SecureStore.getItem(ref, options);
    },
    setSecret(ref: string, value: string): void {
      SecureStore.setItem(ref, value, options);
    },
    deleteSecret(ref: string): void {
      SecureStore.deleteItemAsync(ref, options).catch(() => {});
    },
  });
}

function attachBestChefSyncRecorder(
  dbAdapter: DatabaseAdapter,
  syncEngine: SyncEngine,
  syncDeviceId: string,
): BestChefDatabaseAdapter {
  const bestChefAdapter = dbAdapter as BestChefDatabaseAdapter;
  bestChefAdapter.syncDeviceId = syncDeviceId;
  bestChefAdapter.syncDisplayName = 'BestChef Device';
  bestChefAdapter.recordSyncChange = (table, operation, rowId, data) => {
    syncEngine.recordChange(table, operation, rowId, data);
  };
  return bestChefAdapter;
}

export function useDatabase(): DatabaseAdapter {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error('useDatabase must be used within DatabaseProvider');
  return db;
}

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [adapter, setAdapter] = useState<DatabaseAdapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetCount, setResetCount] = useState(0);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let mounted = true;
    let syncEngine: SyncEngine | null = null;

    void (async () => {
      try {
        const db = openDatabaseSync('bestchef.db');
        const dbAdapter = createExpoAdapter(db);
        db.runSync('PRAGMA journal_mode=WAL;');

        dbAdapter.execute(
          `CREATE TABLE IF NOT EXISTS hub_module_versions (
            module_id TEXT PRIMARY KEY,
            version INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
        );

        const rows = dbAdapter.query<{ version: number }>(
          `SELECT version FROM hub_module_versions WHERE module_id = ?`,
          ['recipes'],
        );
        const currentVersion = rows[0]?.version ?? 0;

        const migrations = RECIPES_MODULE.migrations ?? [];
        for (const migration of migrations) {
          if (migration.version > currentVersion) {
            dbAdapter.transaction(() => {
              for (const sql of migration.up) {
                dbAdapter.execute(sql);
              }
              dbAdapter.execute(
                `INSERT OR REPLACE INTO hub_module_versions (module_id, version) VALUES (?, ?)`,
                ['recipes', migration.version],
              );
            });
          }
        }

        if (!shouldEnableBestChefMeshSync()) {
          if (mounted) setAdapter(dbAdapter);
          return;
        }

        ensureNativeSyncPrng();
        ensureNativeSyncSecretStore();

        const bootstrap = ensureSyncBootstrap(dbAdapter, {
          deviceDisplayName: 'BestChef Device',
          personalWorkspaceName: 'BestChef Personal Workspace',
        });

        syncEngine = new SyncEngine({
          db: dbAdapter,
          identity: bootstrap.identity,
          modulePrefixes: new Map([['recipes', 'rc_']]),
          enabledModules: ['recipes'],
          modulePolicies: RECIPES_MODULE.syncPolicy
            ? new Map([['recipes', RECIPES_MODULE.syncPolicy]])
            : undefined,
          syncTier: 'free_cloud',
          schedulerOptions: {
            minIntervalMs: 15_000,
            activeIntervalMs: 5_000,
            maxIntervalMs: 120_000,
          },
        });
        await syncEngine.initialize();

        if (!mounted) {
          await syncEngine.destroy();
          return;
        }

        setAdapter(attachBestChefSyncRecorder(
          dbAdapter,
          syncEngine,
          bootstrap.identity.publicKey,
        ));
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      mounted = false;
      if (syncEngine) {
        void syncEngine.destroy();
      }
    };
  }, [resetCount]);

  const handleResetDatabase = async (): Promise<void> => {
    setResetting(true);
    try {
      const dbPath = `${FileSystem.documentDirectory}SQLite/bestchef.db`;
      const mediaCachePath = `${FileSystem.documentDirectory}bestchef-media-cache`;
      await FileSystem.deleteAsync(dbPath, { idempotent: true });
      await FileSystem.deleteAsync(mediaCachePath, { idempotent: true });
      setError(null);
      setAdapter(null);
      setResetCount((c) => c + 1);
    } catch (err) {
      console.warn('[DatabaseProvider] reset failed', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setResetting(false);
    }
  };

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Database error: {error}</Text>
        <Pressable
          style={styles.resetButton}
          onPress={() => { void handleResetDatabase(); }}
          disabled={resetting}
        >
          <Text style={styles.resetButtonText}>
            {resetting ? 'Resetting...' : 'Reset database'}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!adapter) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#131318',
    gap: 16,
  },
  errorText: {
    color: '#FFB4AB',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  resetButton: {
    marginTop: 8,
    backgroundColor: '#22C55E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  resetButtonText: {
    color: '#131318',
    fontSize: 15,
    fontWeight: '700',
  },
});
