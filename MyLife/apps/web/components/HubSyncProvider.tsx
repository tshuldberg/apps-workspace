'use client';

// HubSyncProvider: boots the browser sync engine (SYNC-REAL Milestone 1) once,
// client-side, and exposes its readiness + handle to the settings sync pages.
//
// Booting here (rather than per-page) means the engine, device identity, and
// the setSyncProvider / setTierChangeHandler registration happen exactly once
// for the whole hub, so the data-sync tier-change path stops throwing and the
// pair / workspaces / transport pages all read one real engine-backed DB.
//
// Everything runs in the browser only. sql.js + WebCrypto + IndexedDB do not
// exist during SSR, so boot is gated behind a mount effect.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  initHubSyncEngine,
  getHubSyncEngine,
  type HubSyncEngineHandle,
} from '@/lib/sync/hub-sync-engine';

interface HubSyncState {
  /** True once the engine + identity are booted and the provider is registered. */
  ready: boolean;
  /** Honest error string if boot failed (e.g. sql.js wasm missing). */
  error: string | null;
  /** The booted handle (null until ready). */
  handle: HubSyncEngineHandle | null;
}

const HubSyncContext = createContext<HubSyncState>({
  ready: false,
  error: null,
  handle: null,
});

export function HubSyncProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HubSyncState>(() => {
    const existing = getHubSyncEngine();
    return existing
      ? { ready: true, error: null, handle: existing }
      : { ready: false, error: null, handle: null };
  });

  useEffect(() => {
    if (state.ready) return;
    let cancelled = false;
    void initHubSyncEngine()
      .then((handle) => {
        if (cancelled) return;
        setState({ ready: true, error: null, handle });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          ready: false,
          error: err instanceof Error ? err.message : 'Sync engine failed to start.',
          handle: null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [state.ready]);

  return <HubSyncContext.Provider value={state}>{children}</HubSyncContext.Provider>;
}

/** Read the hub sync engine readiness + handle inside a client component. */
export function useHubSync(): HubSyncState {
  return useContext(HubSyncContext);
}
