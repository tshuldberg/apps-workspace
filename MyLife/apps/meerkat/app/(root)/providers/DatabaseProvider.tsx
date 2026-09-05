import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View, StyleSheet } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { DatabaseAdapter } from '@mylife/db';
import { Text } from '@mylife/ui';
import { type MkColors } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from './AppThemeProvider';
import { getMeerkatDatabase, resetMeerkatDatabaseCache } from '../data/meerkat-db';
import { getPrivateStorageRoot, privateStorageResetPaths } from '../data/private-storage';

const DatabaseContext = createContext<DatabaseAdapter | null>(null);
const ResetContext = createContext<(() => Promise<void>) | null>(null);

export function useMeerkatDatabase(): DatabaseAdapter {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error('useMeerkatDatabase must be used within DatabaseProvider');
  return db;
}

export function useResetDatabase(): () => Promise<void> {
  const reset = useContext(ResetContext);
  if (!reset) throw new Error('useResetDatabase must be used within DatabaseProvider');
  return reset;
}

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const [adapter, setAdapter] = useState<DatabaseAdapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetCount, setResetCount] = useState(0);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        // Shared boot: crypto plumbing is configured before any identity/seal
        // call (MK-001), then the db is opened + bootstrapped. The headless
        // background path calls this exact same function, so the boot order
        // can never drift between foreground and background.
        const dbAdapter = getMeerkatDatabase();

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
      // Close before deleting SQLite and its WAL so a live handle cannot recreate them.
      resetMeerkatDatabaseCache();
      const documents = FileSystem.documentDirectory;
      if (!documents) throw new Error('The storage directory is unavailable.');
      for (const path of privateStorageResetPaths(documents, getPrivateStorageRoot())) {
        await FileSystem.deleteAsync(path, { idempotent: true });
        if ((await FileSystem.getInfoAsync(path)).exists) {
          throw new Error('Private data remained after reset.');
        }
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
        <ActivityIndicator size="large" color={c.accent} />
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

const makeStyles = (c: MkColors) => StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.background,
    gap: 16,
  },
  errorText: {
    color: c.danger,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  resetButton: {
    marginTop: 8,
    backgroundColor: c.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  resetButtonText: {
    color: c.onAccent,
    fontSize: 15,
    fontWeight: '700',
  },
});
