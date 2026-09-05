'use client';

/**
 * @mylife/auth -- Local auth React context.
 *
 * Provides session restoration from SQLite on mount and exposes
 * signIn / signUp / signOut actions. The provider queries for the
 * latest non-expired session in hub_auth_sessions on mount, so no
 * external storage dependency is needed.
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
import type { DatabaseAdapter } from '@mylife/db';
import type { LocalAuthUser, LocalAuthSession } from './types';
import {
  createAuthTables,
  loginUser,
  registerUser,
  logoutSession,
  deleteAccount as deleteAccountFn,
  updatePassword as updatePasswordFn,
} from './local-auth';

// ── Types ──────────────────────────────────────────────────────────

export interface LocalAuthState {
  user: LocalAuthUser | null;
  session: (LocalAuthSession & { id: string }) | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface UseLocalAuthReturn extends LocalAuthState {
  signIn: (email: string, password: string) => { ok: true } | { ok: false; error: string };
  signUp: (email: string, password: string, displayName?: string) => { ok: true } | { ok: false; error: string };
  signOut: () => void;
  changePassword: (currentPassword: string, newPassword: string) => { ok: true } | { ok: false; error: string };
  removeAccount: (password: string) => { ok: true } | { ok: false; error: string };
}

// ── Context ────────────────────────────────────────────────────────

const LocalAuthContext = createContext<UseLocalAuthReturn>({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  signIn: () => ({ ok: false, error: 'LocalAuthProvider not mounted.' }),
  signUp: () => ({ ok: false, error: 'LocalAuthProvider not mounted.' }),
  signOut: () => {},
  changePassword: () => ({ ok: false, error: 'LocalAuthProvider not mounted.' }),
  removeAccount: () => ({ ok: false, error: 'LocalAuthProvider not mounted.' }),
});

// ── Helpers ────────────────────────────────────────────────────────

interface SessionRow {
  session_id: string;
  user_id: string;
  session_created_at: string;
  expires_at: string | null;
  email: string;
  display_name: string;
  user_created_at: string;
}

function restoreLatestSession(
  db: DatabaseAdapter,
): { user: LocalAuthUser; session: LocalAuthSession & { id: string } } | null {
  try {
    createAuthTables(db);

    const rows = db.query<SessionRow>(
      `SELECT
        s.id AS session_id,
        s.user_id,
        s.created_at AS session_created_at,
        s.expires_at,
        u.email,
        u.display_name,
        u.created_at AS user_created_at
      FROM hub_auth_sessions s
      JOIN hub_auth_users u ON u.id = s.user_id
      WHERE s.expires_at IS NULL OR s.expires_at > datetime('now')
      ORDER BY s.created_at DESC
      LIMIT 1`,
    );

    const row = rows[0];
    if (!row) return null;

    return {
      user: {
        id: row.user_id,
        email: row.email,
        displayName: row.display_name,
        createdAt: row.user_created_at,
      },
      session: {
        id: row.session_id,
        userId: row.user_id,
        createdAt: row.session_created_at,
        expiresAt: row.expires_at,
      },
    };
  } catch {
    return null;
  }
}

// ── Provider ───────────────────────────────────────────────────────

export interface LocalAuthProviderProps {
  children: ReactNode;
  db: DatabaseAdapter | null;
}

export function LocalAuthProvider({ children, db }: LocalAuthProviderProps): React.JSX.Element {
  const [state, setState] = useState<LocalAuthState>({
    user: null,
    session: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Restore session on mount (or when db becomes available)
  useEffect(() => {
    if (!db) {
      setState({ user: null, session: null, isAuthenticated: false, isLoading: false });
      return;
    }

    const restored = restoreLatestSession(db);
    if (restored) {
      setState({
        user: restored.user,
        session: restored.session,
        isAuthenticated: true,
        isLoading: false,
      });
    } else {
      setState({ user: null, session: null, isAuthenticated: false, isLoading: false });
    }
  }, [db]);

  const signIn = useCallback(
    (email: string, password: string): { ok: true } | { ok: false; error: string } => {
      if (!db) return { ok: false, error: 'Database not available.' };

      createAuthTables(db);
      const result = loginUser(db, email, password);
      if (!result.ok) return { ok: false, error: result.error };

      setState({
        user: result.data.user,
        session: {
          id: crypto.randomUUID(), // loginUser doesn't expose session ID, re-query
          ...result.data.session,
        },
        isAuthenticated: true,
        isLoading: false,
      });

      // Re-query to get the actual session ID from DB
      const restored = restoreLatestSession(db);
      if (restored) {
        setState({
          user: restored.user,
          session: restored.session,
          isAuthenticated: true,
          isLoading: false,
        });
      }

      return { ok: true };
    },
    [db],
  );

  const signUp = useCallback(
    (email: string, password: string, displayName?: string): { ok: true } | { ok: false; error: string } => {
      if (!db) return { ok: false, error: 'Database not available.' };

      createAuthTables(db);
      const regResult = registerUser(db, email, password, displayName);
      if (!regResult.ok) return { ok: false, error: regResult.error };

      // Registration succeeded -- now sign in to create a session
      const loginResult = loginUser(db, email, password);
      if (!loginResult.ok) return { ok: false, error: loginResult.error };

      const restored = restoreLatestSession(db);
      if (restored) {
        setState({
          user: restored.user,
          session: restored.session,
          isAuthenticated: true,
          isLoading: false,
        });
      }

      return { ok: true };
    },
    [db],
  );

  const signOut = useCallback(() => {
    if (!db || !state.session) return;

    try {
      logoutSession(db, state.session.id);
    } catch {
      // Best-effort cleanup
    }

    setState({ user: null, session: null, isAuthenticated: false, isLoading: false });
  }, [db, state.session]);

  const changePassword = useCallback(
    (currentPassword: string, newPassword: string): { ok: true } | { ok: false; error: string } => {
      if (!db || !state.user) return { ok: false, error: 'Not authenticated.' };

      const result = updatePasswordFn(db, state.user.id, currentPassword, newPassword);
      if (!result.ok) return { ok: false, error: result.error };

      // Password change invalidates all sessions, clear local state
      setState({ user: null, session: null, isAuthenticated: false, isLoading: false });
      return { ok: true };
    },
    [db, state.user],
  );

  const removeAccount = useCallback(
    (password: string): { ok: true } | { ok: false; error: string } => {
      if (!db || !state.user) return { ok: false, error: 'Not authenticated.' };

      const result = deleteAccountFn(db, state.user.id, password);
      if (!result.ok) return { ok: false, error: result.error };

      setState({ user: null, session: null, isAuthenticated: false, isLoading: false });
      return { ok: true };
    },
    [db, state.user],
  );

  const value = useMemo<UseLocalAuthReturn>(
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

  return <LocalAuthContext.Provider value={value}>{children}</LocalAuthContext.Provider>;
}

// ── Hook ───────────────────────────────────────────────────────────

export function useLocalAuth(): UseLocalAuthReturn {
  return useContext(LocalAuthContext);
}
