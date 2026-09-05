/**
 * Auto-backup hook for mobile.
 *
 * Triggers a daily automatic backup when the app comes to the foreground,
 * if auto-backup is enabled and 24 hours have passed since the last one.
 * Uses AppState listener (no background task manager needed since backups
 * are fast, file-copy operations).
 *
 * The scheduling decision lives in lib/backup-scheduler.ts so it can be
 * reused and unit tested without React. This hook just wires the scheduler
 * into the component lifecycle.
 */

import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { DatabaseAdapter } from '@mylife/db';
import { checkAndCreateAutoBackup } from '../lib/backup-scheduler';

/**
 * Hook that manages automatic daily backups.
 * Call once at the app root level (e.g. in DatabaseProvider or _layout).
 */
export function useAutoBackup(db: DatabaseAdapter | null): void {
  const lastCheckRef = useRef<number>(0);

  useEffect(() => {
    if (!db) return;

    const maybeBackup = async () => {
      // Throttle: don't check more than once per app resume
      const now = Date.now();
      if (now - lastCheckRef.current < 60_000) return;
      lastCheckRef.current = now;

      await checkAndCreateAutoBackup(db);
    };

    // Run on mount (app launch)
    void maybeBackup();

    // Run when app returns to foreground
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          void maybeBackup();
        }
      },
    );

    return () => subscription.remove();
  }, [db]);
}
