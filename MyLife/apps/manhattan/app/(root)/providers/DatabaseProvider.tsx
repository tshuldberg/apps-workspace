import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View, StyleSheet } from 'react-native';
import {
  openDatabaseSync,
  type SQLiteDatabase,
  type SQLiteBindParams,
} from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import type { DatabaseAdapter } from '@mylife/db';
import { MANHATTAN_MODULE, purgeSoftDeleted } from '@mylife/manhattan';
import { Text } from '@mylife/ui';
import { ensureStandaloneHubTables } from '../data/hub-tables';

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
const ResetContext = createContext<(() => Promise<void>) | null>(null);

export function useManhattanDatabase(): DatabaseAdapter {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error('useManhattanDatabase must be used within DatabaseProvider');
  return db;
}

export function useResetDatabase(): () => Promise<void> {
  const reset = useContext(ResetContext);
  if (!reset) throw new Error('useResetDatabase must be used within DatabaseProvider');
  return reset;
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
        const db = openDatabaseSync('manhattan.db');
        const dbAdapter = createExpoAdapter(db);
        db.runSync('PRAGMA journal_mode=WAL;');
        db.runSync('PRAGMA foreign_keys=ON;');

        ensureStandaloneHubTables(dbAdapter);

        const rows = dbAdapter.query<{ version: number }>(
          `SELECT version FROM hub_module_versions WHERE module_id = ?`,
          ['manhattan'],
        );
        const currentVersion = rows[0]?.version ?? 0;

        const migrations = MANHATTAN_MODULE.migrations ?? [];
        for (const migration of migrations) {
          if (migration.version > currentVersion) {
            dbAdapter.transaction(() => {
              for (const sql of migration.up) {
                dbAdapter.execute(sql);
              }
              dbAdapter.execute(
                `INSERT OR REPLACE INTO hub_module_versions (module_id, version) VALUES (?, ?)`,
                ['manhattan', migration.version],
              );
            });
          }
        }

        // Retention sweep; never allowed to block boot.
        try {
          purgeSoftDeleted(dbAdapter);
        } catch (purgeErr) {
          console.warn('[DatabaseProvider] soft-delete purge failed', purgeErr);
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
      const dbPath = `${FileSystem.documentDirectory}SQLite/manhattan.db`;
      // WAL mode keeps recent rows in -wal/-shm sidecars; deleting only the
      // main file leaves recoverable data behind the "permanently deletes"
      // promise. Production eval finding F6.
      for (const suffix of ['', '-wal', '-shm']) {
        await FileSystem.deleteAsync(`${dbPath}${suffix}`, { idempotent: true });
      }
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
        <ActivityIndicator size="large" color="#E4572E" />
      </View>
    );
  }

  return (
    <DatabaseContext.Provider value={adapter}>
      <ResetContext.Provider value={handleResetDatabase}>
        {children}
      </ResetContext.Provider>
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
    backgroundColor: '#E4572E',
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
