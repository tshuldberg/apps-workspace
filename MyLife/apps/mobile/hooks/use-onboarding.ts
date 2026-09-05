import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../components/DatabaseProvider';
import {
  OnboardingMachine,
  SqliteOnboardingStore,
  type OnboardingState,
} from '@mylife/onboarding';

/**
 * Hook to access the onboarding state machine backed by SQLite.
 * Returns the machine instance and current state, with a refresh function.
 */
export function useOnboarding() {
  const db = useDatabase();
  const [machine] = useState(() => {
    const store = new SqliteOnboardingStore(db);
    return new OnboardingMachine(store);
  });
  const [state, setState] = useState<OnboardingState>(machine.getState());

  const refresh = useCallback(() => {
    setState(machine.getState());
  }, [machine]);

  const next = useCallback(() => {
    machine.next();
    refresh();
  }, [machine, refresh]);

  const skip = useCallback(() => {
    machine.skip();
    refresh();
  }, [machine, refresh]);

  const back = useCallback(() => {
    machine.back();
    refresh();
  }, [machine, refresh]);

  const setContentPrefs = useCallback(
    (prefs: Record<string, unknown>) => {
      machine.setContentPrefs(prefs);
      refresh();
    },
    [machine, refresh],
  );

  const setSelectedModules = useCallback(
    (moduleIds: string[]) => {
      machine.setSelectedModules(moduleIds);
      refresh();
    },
    [machine, refresh],
  );

  const reset = useCallback(() => {
    machine.reset();
    refresh();
  }, [machine, refresh]);

  return {
    state,
    isComplete: machine.isComplete(),
    next,
    skip,
    back,
    setContentPrefs,
    setSelectedModules,
    reset,
    refresh,
  };
}

/**
 * Lightweight check: has onboarding been completed?
 * Reads directly from SQLite without constructing the full machine.
 */
export function useOnboardingComplete(): boolean | null {
  const db = useDatabase();
  const [complete, setComplete] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const rows = db.query<{ completed_at: string | null }>(
        `SELECT completed_at FROM hub_onboarding WHERE id = 'default'`,
      );
      setComplete(rows.length > 0 && rows[0]!.completed_at !== null);
    } catch {
      // Table might not exist yet on very first run before migrations
      setComplete(false);
    }
  }, [db]);

  return complete;
}
