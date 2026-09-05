/**
 * Property tests for local auth (Properties 1-5).
 *
 * Tests the SQLite-backed local auth system using fast-check to generate
 * random credentials and verify invariants hold across all inputs.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  createAuthTables,
  registerUser,
  loginUser,
  logoutSession,
  getSessionUser,
} from '../local-auth';
import { requiresAuth } from '../service';
import type { PlanMode } from '../types';

// ── Arbitraries ──────────────────────────────────────────────────────

/** Valid email: lowercase alpha prefix + @test.com */
const emailArb = fc
  .tuple(
    fc.stringMatching(/^[a-z]{3,12}$/),
    fc.integer({ min: 1, max: 9999 }),
  )
  .map(([name, n]) => `${name}${n}@test.com`);

/** Valid password: 8+ chars with upper, lower, digit, special (policy compliant) */
const passwordArb = fc
  .tuple(
    fc.stringMatching(/^[A-Z][a-z]{4,7}$/),
    fc.integer({ min: 10, max: 99 }),
    fc.constantFrom('!', '@', '#', '$', '%'),
  )
  .map(([base, n, special]) => `${base}${n}${special}`);

const displayNameArb = fc.stringMatching(/^[A-Za-z ]{2,20}$/).filter((s) => s.trim().length >= 1);

const planModeArb = fc.constantFrom<PlanMode>('hosted', 'self_host', 'local_only');

// ── Test setup ──────────────────────────────────────────────────────

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createInMemoryTestDatabase();
  createAuthTables(testDb.adapter);
});

afterEach(() => {
  testDb.close();
});

// ── Property 1: Auth round-trip (sign up then sign in) ──────────────
// Validates: Requirements 1.2, 1.3

describe('Property 1: Auth round-trip (sign up then sign in)', () => {
  it('for any valid email and password, sign-up then sign-in succeeds and returns the same user', () => {
    fc.assert(
      fc.property(emailArb, passwordArb, displayNameArb, (email, password, name) => {
        // Fresh DB per iteration to avoid duplicate email collisions
        const db = createInMemoryTestDatabase();
        createAuthTables(db.adapter);

        try {
          const reg = registerUser(db.adapter, email, password, name);
          expect(reg.ok).toBe(true);
          if (!reg.ok) return;

          const login = loginUser(db.adapter, email, password);
          expect(login.ok).toBe(true);
          if (!login.ok) return;

          // Same user ID returned
          expect(login.data.user.id).toBe(reg.data.id);
          // Email is normalized (lowercased, trimmed)
          expect(login.data.user.email).toBe(email.toLowerCase().trim());
          // Session was created
          expect(login.data.session.userId).toBe(reg.data.id);
          expect(login.data.session.expiresAt).toBeTruthy();
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  }, 30_000);

  it('duplicate registration with the same email fails', () => {
    fc.assert(
      fc.property(emailArb, passwordArb, (email, password) => {
        const db = createInMemoryTestDatabase();
        createAuthTables(db.adapter);

        try {
          const first = registerUser(db.adapter, email, password);
          expect(first.ok).toBe(true);

          const second = registerUser(db.adapter, email, password);
          expect(second.ok).toBe(false);
          if (!second.ok) {
            expect(second.error).toContain('already exists');
          }
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  }, 30_000);
});

// ── Property 2: Sign-out clears session ─────────────────────────────
// Validates: Requirements 1.4

describe('Property 2: Sign-out clears session', () => {
  it('after logout, the session ID no longer resolves to a user', () => {
    fc.assert(
      fc.property(emailArb, passwordArb, (email, password) => {
        const db = createInMemoryTestDatabase();
        createAuthTables(db.adapter);

        try {
          registerUser(db.adapter, email, password);
          const login = loginUser(db.adapter, email, password);
          expect(login.ok).toBe(true);
          if (!login.ok) return;

          // Session is valid before logout
          const sessionId = db.adapter.query<{ id: string }>(
            'SELECT id FROM hub_auth_sessions WHERE user_id = ?',
            [login.data.user.id],
          )[0]?.id;
          expect(sessionId).toBeTruthy();
          expect(getSessionUser(db.adapter, sessionId!)).not.toBeNull();

          // Logout
          logoutSession(db.adapter, sessionId!);

          // Session is gone
          expect(getSessionUser(db.adapter, sessionId!)).toBeNull();

          // No sessions remain for this user
          const remaining = db.adapter.query<{ count: number }>(
            'SELECT COUNT(*) as count FROM hub_auth_sessions WHERE user_id = ?',
            [login.data.user.id],
          );
          expect(remaining[0]?.count).toBe(0);
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  }, 30_000);
});

// ── Property 3: Local-only mode grants universal access ─────────────
// Validates: Requirements 1.5

describe('Property 3: Local-only mode grants universal access', () => {
  it('in local_only or self_host mode, requiresAuth returns false', () => {
    fc.assert(
      fc.property(planModeArb, (mode) => {
        if (mode === 'local_only' || mode === 'self_host') {
          expect(requiresAuth(mode)).toBe(false);
        }
      }),
    );
  });

  it('only hosted mode requires auth', () => {
    fc.assert(
      fc.property(planModeArb, (mode) => {
        expect(requiresAuth(mode)).toBe(mode === 'hosted');
      }),
    );
  });

  it('local-only users can register and login without any external auth', () => {
    fc.assert(
      fc.property(emailArb, passwordArb, (email, password) => {
        const db = createInMemoryTestDatabase();
        createAuthTables(db.adapter);

        try {
          // In local-only mode, auth is purely SQLite-backed -- no Supabase needed
          const reg = registerUser(db.adapter, email, password);
          expect(reg.ok).toBe(true);

          const login = loginUser(db.adapter, email, password);
          expect(login.ok).toBe(true);
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  }, 30_000);

  it('self_host and local_only modes never require external auth', () => {
    const nonHostedModes: PlanMode[] = ['self_host', 'local_only'];
    for (const mode of nonHostedModes) {
      expect(requiresAuth(mode)).toBe(false);
    }
  });
});

// ── Property 4: Session persistence round-trip ──────────────────────
// Validates: Requirements 1.6

describe('Property 4: Session persistence round-trip', () => {
  it('a created session can be retrieved by its ID and returns the correct user', () => {
    fc.assert(
      fc.property(emailArb, passwordArb, (email, password) => {
        const db = createInMemoryTestDatabase();
        createAuthTables(db.adapter);

        try {
          registerUser(db.adapter, email, password);
          const login = loginUser(db.adapter, email, password);
          expect(login.ok).toBe(true);
          if (!login.ok) return;

          // Get session ID from the database
          const sessions = db.adapter.query<{ id: string }>(
            'SELECT id FROM hub_auth_sessions WHERE user_id = ?',
            [login.data.user.id],
          );
          expect(sessions.length).toBeGreaterThan(0);

          const sessionId = sessions[0]!.id;

          // Retrieve user from session (simulates app restart with persisted session ID)
          const restored = getSessionUser(db.adapter, sessionId);
          expect(restored).not.toBeNull();
          expect(restored!.user.id).toBe(login.data.user.id);
          expect(restored!.user.email).toBe(login.data.user.email);
          expect(restored!.session.userId).toBe(login.data.user.id);
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  }, 30_000);

  it('an invalid session ID returns null (no crash, no data leak)', () => {
    fc.assert(
      fc.property(fc.uuid(), (fakeSessionId) => {
        const result = getSessionUser(testDb.adapter, fakeSessionId);
        expect(result).toBeNull();
      }),
      { numRuns: 10 },
    );
  });
});

// ── Property 5: Invalid credentials produce safe error messages ─────
// Validates: Requirements 1.9

describe('Property 5: Invalid credentials produce safe error messages', () => {
  it('wrong password and non-existent email produce the same generic error', () => {
    fc.assert(
      fc.property(emailArb, passwordArb, passwordArb, (email, correctPw, wrongPw) => {
        fc.pre(correctPw !== wrongPw);

        const db = createInMemoryTestDatabase();
        createAuthTables(db.adapter);

        try {
          registerUser(db.adapter, email, correctPw);

          // Wrong password for existing user
          const wrongPwResult = loginUser(db.adapter, email, wrongPw);
          expect(wrongPwResult.ok).toBe(false);

          // Non-existent email
          const noUserResult = loginUser(db.adapter, `nonexistent_${email}`, correctPw);
          expect(noUserResult.ok).toBe(false);

          if (!wrongPwResult.ok && !noUserResult.ok) {
            // Both cases must produce the exact same error message
            // so an attacker cannot distinguish wrong email from wrong password
            expect(wrongPwResult.error).toBe(noUserResult.error);
            // The message must be the safe generic form
            expect(wrongPwResult.error).toBe('Invalid email or password.');
          }
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  }, 30_000);

  it('error messages never contain the user-supplied email or password values', () => {
    fc.assert(
      fc.property(emailArb, passwordArb, (email, password) => {
        const db = createInMemoryTestDatabase();
        createAuthTables(db.adapter);

        try {
          // Try login with non-existent user
          const result = loginUser(db.adapter, email, password);
          if (!result.ok) {
            // The error must not echo back the credentials
            expect(result.error).not.toContain(email);
            expect(result.error).not.toContain(password);
          }
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });
});
