'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import type { AuthState, AuthResult } from './types';
import { AuthService } from './service';

// ---- Context ----

interface AuthContextValue {
  service: AuthService | null;
}

const AuthContext = createContext<AuthContextValue>({ service: null });

// ---- Provider ----

export interface AuthProviderProps {
  children: ReactNode;
  /**
   * An `AuthService` instance. The provider will call `initialize()` on
   * mount and `destroy()` on unmount.
   *
   * When `null` is passed (e.g. for local-only users), auth hooks return
   * the unauthenticated defaults and auth functions are no-ops.
   */
  service: AuthService | null;
}

/**
 * Provides auth state and actions to the component tree.
 *
 * IMPORTANT: This provider never blocks rendering. The app renders
 * immediately regardless of auth state. Auth is purely additive for
 * cloud sync tiers.
 */
export function AuthProvider({ children, service }: AuthProviderProps): React.JSX.Element {
  const serviceRef = useRef(service);
  serviceRef.current = service;

  useEffect(() => {
    service?.initialize();
    return () => {
      service?.destroy();
    };
  }, [service]);

  const value = useMemo<AuthContextValue>(() => ({ service }), [service]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---- Noop results ----

const NOOP_AUTH_RESULT: AuthResult = {
  success: false,
  user: null,
  session: null,
  error: 'Auth is not available. Auth is only required for cloud sync.',
};

const NOOP_STATE: AuthState = {
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: false,
};

// ---- Hook ----

export interface UseAuthReturn extends AuthState {
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<AuthResult>;
}

/**
 * React hook for auth state and actions.
 *
 * When no `AuthService` is provided (local-only / P2P modes), the hook
 * returns safe defaults:
 * - `isAuthenticated` is `false`
 * - `isLoading` is `false`
 * - `signUp` / `signIn` return a descriptive error without throwing
 * - `signOut` is a no-op
 */
export function useAuth(): UseAuthReturn {
  const { service } = useContext(AuthContext);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!service) return () => {};
      return service.subscribe(onStoreChange);
    },
    [service],
  );

  const getSnapshot = useCallback(
    () => (service ? service.getState() : NOOP_STATE),
    [service],
  );

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!service) return NOOP_AUTH_RESULT;
      return service.signUp(email, password);
    },
    [service],
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!service) return NOOP_AUTH_RESULT;
      return service.signIn(email, password);
    },
    [service],
  );

  const signOut = useCallback(async (): Promise<void> => {
    if (!service) return;
    return service.signOut();
  }, [service]);

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    if (!service) return NOOP_AUTH_RESULT;
    return service.deleteAccount();
  }, [service]);

  return useMemo(
    () => ({ ...state, signUp, signIn, signOut, deleteAccount }),
    [state, signUp, signIn, signOut, deleteAccount],
  );
}
