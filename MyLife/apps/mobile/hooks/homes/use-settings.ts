import { useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import { getSetting, setSetting } from '@mylife/homes';

export function useHomeSettings() {
  const db = useDatabase();

  const get = useCallback(
    (key: string, fallback?: string): string | null => {
      return getSetting(db, key) ?? fallback ?? null;
    },
    [db],
  );

  const set = useCallback(
    (key: string, value: string) => {
      setSetting(db, key, value);
    },
    [db],
  );

  return { get, set };
}
