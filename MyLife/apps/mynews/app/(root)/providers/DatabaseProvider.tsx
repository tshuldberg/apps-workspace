import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  openDatabaseSync,
  type SQLiteBindParams,
  type SQLiteDatabase,
} from 'expo-sqlite';
import type { DatabaseAdapter } from '@mylife/db';
import { MYNEWS_MODULE } from '@mylife/mynews';
import { tokens } from '../theme/tokens';

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

export function useMyNewsDb(): DatabaseAdapter {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error('useMyNewsDb must be used within DatabaseProvider');
  return db;
}

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [adapter, setAdapter] = useState<DatabaseAdapter | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    try {
      const db = openDatabaseSync('mynews.db');
      db.runSync('PRAGMA journal_mode=WAL;');
      db.runSync('PRAGMA foreign_keys=ON;');
      const dbAdapter = createExpoAdapter(db);

      // Version-gated migrations. V1 is idempotent (IF NOT EXISTS DDL), so a
      // fresh install and an upgrade both land on the same schema.
      const current =
        dbAdapter.query<{ user_version: number }>('PRAGMA user_version')[0]?.user_version ?? 0;
      const migrations = MYNEWS_MODULE.migrations ?? [];
      for (const migration of migrations) {
        if (migration.version > current) {
          dbAdapter.transaction(() => {
            for (const sql of migration.up) dbAdapter.execute(sql);
          });
        }
      }
      const target = migrations.reduce((max, m) => Math.max(max, m.version), current);
      db.runSync(`PRAGMA user_version = ${target}`);

      if (mounted) setAdapter(dbAdapter);
    } catch (err) {
      if (mounted) setError(err instanceof Error ? err.message : String(err));
    }
    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Could not open the local database.</Text>
        <Text style={styles.errorDetail}>{error}</Text>
      </View>
    );
  }

  if (!adapter) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={tokens.accent} />
      </View>
    );
  }

  return <DatabaseContext.Provider value={adapter}>{children}</DatabaseContext.Provider>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.bg,
    gap: 8,
    padding: 32,
  },
  errorText: {
    color: tokens.danger,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorDetail: {
    color: tokens.textTertiary,
    fontSize: 13,
    textAlign: 'center',
  },
});
