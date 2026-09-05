'use server';

import { getAdapter } from '@/lib/db';
import {
  createAuthTables,
  loginUser,
  registerUser,
  logoutSession,
  getSessionUser,
  updatePassword,
  deleteAccount,
} from '../../../../packages/auth/src/local-auth';
import type {
  LocalAuthUser,
  LocalAuthSession,
} from '../../../../packages/auth/src/types';

// ── Types ──────────────────────────────────────────────────────────

interface AuthSuccess {
  ok: true;
  user: LocalAuthUser;
  session: LocalAuthSession & { id: string };
}

interface AuthError {
  ok: false;
  error: string;
}

type AuthActionResult = AuthSuccess | AuthError;

// ── Helpers ────────────────────────────────────────────────────────

function ensureTables(): void {
  createAuthTables(getAdapter());
}

// ── Actions ────────────────────────────────────────────────────────

export async function signInAction(
  email: string,
  password: string,
): Promise<AuthActionResult> {
  try {
    ensureTables();
    const db = getAdapter();
    const result = loginUser(db, email, password);
    if (!result.ok) return { ok: false, error: result.error };

    // loginUser creates a session but doesn't return the session ID.
    // Query the latest valid session to get it.
    const restored = restoreLatestSession(db);
    if (!restored) return { ok: false, error: 'Session creation failed.' };

    return {
      ok: true,
      user: restored.user,
      session: restored.session,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Sign-in failed.' };
  }
}

export async function signUpAction(
  email: string,
  password: string,
  displayName?: string,
): Promise<AuthActionResult> {
  try {
    ensureTables();
    const db = getAdapter();
    const regResult = registerUser(db, email, password, displayName);
    if (!regResult.ok) return { ok: false, error: regResult.error };

    // Register succeeded, now sign in to create a session
    const loginResult = loginUser(db, email, password);
    if (!loginResult.ok) return { ok: false, error: loginResult.error };

    const restored = restoreLatestSession(db);
    if (!restored) return { ok: false, error: 'Session creation failed.' };

    return {
      ok: true,
      user: restored.user,
      session: restored.session,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Sign-up failed.' };
  }
}

export async function signOutAction(
  sessionId: string,
): Promise<{ ok: boolean }> {
  try {
    ensureTables();
    logoutSession(getAdapter(), sessionId);
    return { ok: true };
  } catch {
    return { ok: true }; // Best-effort: treat sign-out as successful
  }
}

export async function restoreSessionAction(
  sessionId: string,
): Promise<AuthActionResult> {
  try {
    ensureTables();
    const db = getAdapter();
    const result = getSessionUser(db, sessionId);
    if (!result) return { ok: false, error: 'Session expired.' };

    return {
      ok: true,
      user: result.user,
      session: { id: sessionId, ...result.session },
    };
  } catch {
    return { ok: false, error: 'Session restoration failed.' };
  }
}

export async function changePasswordAction(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    ensureTables();
    const result = updatePassword(getAdapter(), userId, currentPassword, newPassword);
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Password change failed.' };
  }
}

export async function deleteAccountAction(
  userId: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    ensureTables();
    const result = deleteAccount(getAdapter(), userId, password);
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Account deletion failed.' };
  }
}

// ── Internal helper ────────────────────────────────────────────────

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
  db: ReturnType<typeof getAdapter>,
): { user: LocalAuthUser; session: LocalAuthSession & { id: string } } | null {
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
}
