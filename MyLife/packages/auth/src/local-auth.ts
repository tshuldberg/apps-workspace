/**
 * @mylife/auth -- Local auth service backed by SQLite.
 *
 * Stores users in hub_auth_users with bcrypt-hashed passwords.
 * Sessions stored in hub_auth_sessions.
 * All tables use the hub_ prefix per MyLife convention.
 */

import { hashSync, compareSync } from 'bcryptjs';

import type { DatabaseAdapter } from '@mylife/db';
import type { LocalAuthResult as AuthResult, LocalAuthSession as AuthSession, LocalAuthUser as AuthUser } from './types';
import { EmailSchema, DisplayNameSchema } from './types';
import { validatePassword } from './password-validation';

// ── Constants ───────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 10;

/** Session duration: 30 days in milliseconds */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// ── Schema DDL ──────────────────────────────────────────────────────

export const CREATE_HUB_AUTH_USERS = `
CREATE TABLE IF NOT EXISTS hub_auth_users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_AUTH_SESSIONS = `
CREATE TABLE IF NOT EXISTS hub_auth_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES hub_auth_users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);`;

export const AUTH_TABLES = [CREATE_HUB_AUTH_USERS, CREATE_HUB_AUTH_SESSIONS];

/**
 * Create auth tables in the given database adapter.
 * Safe to call multiple times (uses IF NOT EXISTS).
 */
export function createAuthTables(db: DatabaseAdapter): void {
  for (const ddl of AUTH_TABLES) {
    db.execute(ddl);
  }
}

// ── Registration ────────────────────────────────────────────────────

export function registerUser(
  db: DatabaseAdapter,
  email: string,
  password: string,
  displayName?: string,
): AuthResult<AuthUser> {
  // Validate email
  const emailResult = EmailSchema.safeParse(email);
  if (!emailResult.success) {
    return { ok: false, error: emailResult.error.issues[0]?.message ?? 'Invalid email.' };
  }
  const normalizedEmail = emailResult.data;

  // Validate password
  const passwordResult = validatePassword(password);
  if (!passwordResult.valid) {
    return { ok: false, error: passwordResult.errors[0] ?? 'Invalid password.' };
  }

  // Validate display name (default to email prefix)
  const rawName = displayName?.trim() || normalizedEmail.split('@')[0] || 'User';
  const nameResult = DisplayNameSchema.safeParse(rawName);
  if (!nameResult.success) {
    return { ok: false, error: nameResult.error.issues[0]?.message ?? 'Invalid display name.' };
  }

  // Check for existing user
  const existing = db.query<{ id: string }>(
    'SELECT id FROM hub_auth_users WHERE email = ?',
    [normalizedEmail],
  );
  if (existing.length > 0) {
    return { ok: false, error: 'An account with this email already exists.' };
  }

  // Hash password and insert
  const userId = crypto.randomUUID();
  const passwordHash = hashSync(password, BCRYPT_ROUNDS);
  const now = new Date().toISOString();

  db.execute(
    'INSERT INTO hub_auth_users (id, email, password_hash, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, normalizedEmail, passwordHash, nameResult.data, now, now],
  );

  return {
    ok: true,
    data: {
      id: userId,
      email: normalizedEmail,
      displayName: nameResult.data,
      createdAt: now,
    },
  };
}

// ── Login ───────────────────────────────────────────────────────────

export function loginUser(
  db: DatabaseAdapter,
  email: string,
  password: string,
): AuthResult<{ user: AuthUser; session: AuthSession }> {
  const emailResult = EmailSchema.safeParse(email);
  if (!emailResult.success) {
    return { ok: false, error: 'Invalid email or password.' };
  }
  const normalizedEmail = emailResult.data;

  const rows = db.query<{
    id: string;
    email: string;
    password_hash: string;
    display_name: string;
    created_at: string;
  }>(
    'SELECT id, email, password_hash, display_name, created_at FROM hub_auth_users WHERE email = ?',
    [normalizedEmail],
  );

  const user = rows[0];
  if (!user || !compareSync(password, user.password_hash)) {
    return { ok: false, error: 'Invalid email or password.' };
  }

  // Create session
  const sessionId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  db.execute(
    'INSERT INTO hub_auth_sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    [sessionId, user.id, now.toISOString(), expiresAt.toISOString()],
  );

  return {
    ok: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        createdAt: user.created_at,
      },
      session: {
        userId: user.id,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
    },
  };
}

// ── Logout ──────────────────────────────────────────────────────────

export function logoutSession(db: DatabaseAdapter, sessionId: string): void {
  db.execute('DELETE FROM hub_auth_sessions WHERE id = ?', [sessionId]);
}

export function logoutAllSessions(db: DatabaseAdapter, userId: string): void {
  db.execute('DELETE FROM hub_auth_sessions WHERE user_id = ?', [userId]);
}

// ── Session Retrieval ───────────────────────────────────────────────

/**
 * Get the authenticated user for a session ID.
 * Returns null if session is expired or not found.
 */
export function getSessionUser(
  db: DatabaseAdapter,
  sessionId: string,
): { user: AuthUser; session: AuthSession } | null {
  const rows = db.query<{
    session_id: string;
    user_id: string;
    session_created_at: string;
    expires_at: string | null;
    email: string;
    display_name: string;
    user_created_at: string;
  }>(
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
    WHERE s.id = ?`,
    [sessionId],
  );

  const row = rows[0];
  if (!row) return null;

  // Check expiry
  if (row.expires_at && Date.parse(row.expires_at) < Date.now()) {
    db.execute('DELETE FROM hub_auth_sessions WHERE id = ?', [sessionId]);
    return null;
  }

  return {
    user: {
      id: row.user_id,
      email: row.email,
      displayName: row.display_name,
      createdAt: row.user_created_at,
    },
    session: {
      userId: row.user_id,
      createdAt: row.session_created_at,
      expiresAt: row.expires_at,
    },
  };
}

// ── Password Update ─────────────────────────────────────────────────

export function updatePassword(
  db: DatabaseAdapter,
  userId: string,
  currentPassword: string,
  newPassword: string,
): AuthResult {
  const rows = db.query<{ password_hash: string }>(
    'SELECT password_hash FROM hub_auth_users WHERE id = ?',
    [userId],
  );

  const user = rows[0];
  if (!user) {
    return { ok: false, error: 'User not found.' };
  }

  if (!compareSync(currentPassword, user.password_hash)) {
    return { ok: false, error: 'Current password is incorrect.' };
  }

  const passwordResult = validatePassword(newPassword);
  if (!passwordResult.valid) {
    return { ok: false, error: passwordResult.errors[0] ?? 'Invalid password.' };
  }

  const newHash = hashSync(newPassword, BCRYPT_ROUNDS);
  db.execute(
    'UPDATE hub_auth_users SET password_hash = ?, updated_at = ? WHERE id = ?',
    [newHash, new Date().toISOString(), userId],
  );

  // Invalidate all sessions to force re-login
  logoutAllSessions(db, userId);

  return { ok: true, data: undefined };
}

// ── Delete Account ──────────────────────────────────────────────────

export function deleteAccount(
  db: DatabaseAdapter,
  userId: string,
  password: string,
): AuthResult {
  const rows = db.query<{ password_hash: string }>(
    'SELECT password_hash FROM hub_auth_users WHERE id = ?',
    [userId],
  );

  const user = rows[0];
  if (!user) {
    return { ok: false, error: 'User not found.' };
  }

  if (!compareSync(password, user.password_hash)) {
    return { ok: false, error: 'Password is incorrect.' };
  }

  db.transaction(() => {
    db.execute('DELETE FROM hub_auth_sessions WHERE user_id = ?', [userId]);
    db.execute('DELETE FROM hub_auth_users WHERE id = ?', [userId]);
  });

  return { ok: true, data: undefined };
}
