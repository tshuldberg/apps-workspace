import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  openDatabaseSync,
  type SQLiteBindParams,
  type SQLiteDatabase,
} from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import type { DatabaseAdapter } from '@mylife/db';
import { WORKOUTS_MODULE } from '@mylife/workouts';
import { DW_ACCENT, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from '../theme/tokens';

const DOWORK_DB_FILENAME = 'dowork.db';

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

    void (async () => {
      try {
        const db = openDatabaseSync(DOWORK_DB_FILENAME);
        const dbAdapter = createExpoAdapter(db);
        db.runSync('PRAGMA journal_mode=WAL;');
        // Match the hub migration runner (packages/db/src/migration-runner.ts):
        // without this, every ON DELETE CASCADE in the workouts schema is
        // silently inert on device. The pragma is per-connection, so it must
        // be set on this handle, not assumed from anywhere else.
        db.runSync('PRAGMA foreign_keys = ON;');

        dbAdapter.execute(
          `CREATE TABLE IF NOT EXISTS hub_module_versions (
            module_id TEXT PRIMARY KEY,
            version INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
        );

        dbAdapter.execute(
          `CREATE TABLE IF NOT EXISTS hub_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
        );

        const rows = dbAdapter.query<{ version: number }>(
          'SELECT version FROM hub_module_versions WHERE module_id = ?',
          ['workouts'],
        );
        const currentVersion = rows[0]?.version ?? 0;

        const migrations = WORKOUTS_MODULE.migrations ?? [];
        for (const migration of migrations) {
          if (migration.version > currentVersion) {
            dbAdapter.transaction(() => {
              for (const sql of migration.up) {
                dbAdapter.execute(sql);
              }
              dbAdapter.execute(
                'INSERT OR REPLACE INTO hub_module_versions (module_id, version) VALUES (?, ?)',
                ['workouts', migration.version],
              );
            });
          }
        }

        if (mounted) setAdapter(dbAdapter);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [resetCount]);

  const handleResetDatabase = async (): Promise<void> => {
    setResetting(true);
    try {
      const dbPath = `${FileSystem.documentDirectory}SQLite/${DOWORK_DB_FILENAME}`;
      const mediaCachePath = `${FileSystem.documentDirectory}dowork-media-cache`;
      await FileSystem.deleteAsync(dbPath, { idempotent: true });
      await FileSystem.deleteAsync(mediaCachePath, { idempotent: true });
      setError(null);
      setAdapter(null);
      setResetCount((c) => c + 1);
    } catch (err) {
      console.warn('[DoWork DatabaseProvider] reset failed', err);
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
          onPress={() => {
            void handleResetDatabase();
          }}
          disabled={resetting}
        >
          <Text style={styles.resetButtonText}>
            {resetting ? 'Resetting…' : 'Reset database'}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!adapter) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={DW_ACCENT} />
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
    backgroundColor: DW_SURFACES.base,
    gap: 16,
  },
  errorText: {
    color: DW_TEXT.secondary,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  resetButton: {
    marginTop: 8,
    backgroundColor: DW_ACCENT,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  resetButtonText: {
    color: DW_ON_ACCENT,
    fontSize: 15,
    fontWeight: '700',
  },
});
