'use client';

/**
 * Web-specific local auth provider.
 *
 * Uses Next.js server actions for DB operations and localStorage
 * for session ID persistence across page loads.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { LocalAuthUser, LocalAuthSession } from '@mylife/auth/types';
import {
  signInAction,
  signUpAction,
  signOutAction,
  restoreSessionAction,
  changePasswordAction,
  deleteAccountAction,
} from '@/app/auth/actions';

// ── Types ──────────────────────────────────────────────────────────

interface WebLocalAuthState {
  user: LocalAuthUser | null;
  session: (LocalAuthSession & { id: string }) | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface UseWebLocalAuthReturn extends WebLocalAuthState {
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  removeAccount: (password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}

// ── Storage key ────────────────────────────────────────────────────

const SESSION_KEY = 'mylife.auth.session_id';

function getStoredSessionId(): string | null {
  try {
    return globalThis.localStorage?.getItem(SESSION_KEY) ?? null;
  } catch {
    return null;
  }
}

function setStoredSessionId(id: string): void {
  try {
    globalThis.localStorage?.setItem(SESSION_KEY, id);
  } catch {
    // localStorage may be unavailable in SSR or private browsing
  }
}

function clearStoredSessionId(): void {
  try {
    globalThis.localStorage?.removeItem(SESSION_KEY);
  } catch {
    // Best-effort
  }
}

// ── Context ────────────────────────────────────────────────────────

const WebLocalAuthContext = createContext<UseWebLocalAuthReturn>({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  signIn: async () => ({ ok: false, error: 'Provider not mounted.' }),
  signUp: async () => ({ ok: false, error: 'Provider not mounted.' }),
  signOut: async () => {},
  changePassword: async () => ({ ok: false, error: 'Provider not mounted.' }),
  removeAccount: async () => ({ ok: false, error: 'Provider not mounted.' }),
});

// ── Provider ───────────────────────────────────────────────────────

export function WebLocalAuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, setState] = useState<WebLocalAuthState>({
    user: null,
    session: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Restore session from localStorage on mount
  useEffect(() => {
    const sessionId = getStoredSessionId();
    if (!sessionId) {
      setState({ user: null, session: null, isAuthenticated: false, isLoading: false });
      return;
    }

    void restoreSessionAction(sessionId).then((result) => {
      if (result.ok) {
        setState({
          user: result.user,
          session: result.session,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        clearStoredSessionId();
        setState({ user: null, session: null, isAuthenticated: false, isLoading: false });
      }
    });
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      const result = await signInAction(email, password);
      if (!result.ok) return { ok: false, error: result.error };

      setStoredSessionId(result.session.id);
      setState({
        user: result.user,
        session: result.session,
        isAuthenticated: true,
        isLoading: false,
      });
      return { ok: true };
    },
    [],
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      const result = await signUpAction(email, password, displayName);
      if (!result.ok) return { ok: false, error: result.error };

      setStoredSessionId(result.session.id);
      setState({
        user: result.user,
        session: result.session,
        isAuthenticated: true,
        isLoading: false,
      });
      return { ok: true };
    },
    [],
  );

  const signOut = useCallback(async (): Promise<void> => {
    if (state.session) {
      await signOutAction(state.session.id);
    }
    clearStoredSessionId();
    setState({ user: null, session: null, isAuthenticated: false, isLoading: false });
  }, [state.session]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!state.user) return { ok: false, error: 'Not authenticated.' };
      const result = await changePasswordAction(state.user.id, currentPassword, newPassword);
      if (!result.ok) return result;

      clearStoredSessionId();
      setState({ user: null, session: null, isAuthenticated: false, isLoading: false });
      return { ok: true };
    },
    [state.user],
  );

  const removeAccount = useCallback(
    async (password: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!state.user) return { ok: false, error: 'Not authenticated.' };
      const result = await deleteAccountAction(state.user.id, password);
      if (!result.ok) return result;

      clearStoredSessionId();
      setState({ user: null, session: null, isAuthenticated: false, isLoading: false });
      return { ok: true };
    },
    [state.user],
  );

  const value = useMemo<UseWebLocalAuthReturn>(
    () => ({
      ...state,
      signIn,
      signUp,
      signOut,
      changePassword,
      removeAccount,
    }),
    [state, signIn, signUp, signOut, changePassword, removeAccount],
  );

  return <WebLocalAuthContext.Provider value={value}>{children}</WebLocalAuthContext.Provider>;
}

// ── Hook ───────────────────────────────────────────────────────────

export function useWebLocalAuth(): UseWebLocalAuthReturn {
  return useContext(WebLocalAuthContext);
}
