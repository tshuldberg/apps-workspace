/**
 * Property tests for module lock enforcement (Property 23).
 *
 * Property 23: Module lock enforcement -- Validates: Requirements 21.2, 21.4
 *   - A module with a lock requires auth (PIN verification) before access.
 *   - 5 failed PIN attempts triggers a 60-second lockout.
 *   - Fewer than 5 failed attempts does not trigger lockout.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createHubTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  checkLockout,
  computeLockedUntil,
  enableModuleLock,
  getModuleLock,
  incrementLockFailedAttempts,
  resetLockFailedAttempts,
  setLockLockedUntil,
  verifyPin,
  isLockableModule,
  LOCKABLE_MODULE_IDS,
  LOCKOUT_MAX_ATTEMPTS,
  LOCKOUT_DURATION_SECONDS,
} from '../module-lock';

// ── Arbitraries ─────────────────────────────────────────────────────────

const lockableModuleIdArb = fc.constantFrom(...LOCKABLE_MODULE_IDS);
const digitArb = fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9');
const pinArb = fc.array(digitArb, { minLength: 4, maxLength: 8 }).map((ds) => ds.join(''));
const wrongPinArb = fc.tuple(pinArb, pinArb).filter(([a, b]) => a !== b);
const failCountBelowThresholdArb = fc.integer({ min: 0, max: LOCKOUT_MAX_ATTEMPTS - 1 });
const failCountAtOrAboveThresholdArb = fc.integer({ min: LOCKOUT_MAX_ATTEMPTS, max: 20 });
const lockoutNowArb = fc
  .integer({
    min: Date.UTC(2020, 0, 1),
    max: Date.UTC(2030, 0, 1),
  })
  .map((timestamp) => new Date(timestamp));

// ── Test setup ──────────────────────────────────────────────────────────

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createHubTestDatabase();
});

afterEach(() => {
  testDb.close();
});

// ── Property 23: Module lock enforcement ────────────────────────────────
// Validates: Requirements 21.2, 21.4

describe('Property 23: Module lock enforcement', () => {
  // ── R21.2: Lock requires auth ──────────────────────────────────────

  it('for any lockable module with a lock, correct PIN verifies successfully (R21.2)', async () => {
    await fc.assert(
      fc.asyncProperty(lockableModuleIdArb, pinArb, async (moduleId, pin) => {
        const db = createHubTestDatabase();
        try {
          await enableModuleLock(db.adapter, moduleId, pin);
          const lock = getModuleLock(db.adapter, moduleId);
          expect(lock).not.toBeNull();
          expect(await verifyPin(pin, lock!.salt, lock!.pinHash)).toBe(true);
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('for any lockable module with a lock, wrong PIN is rejected (R21.2)', async () => {
    await fc.assert(
      fc.asyncProperty(lockableModuleIdArb, wrongPinArb, async (moduleId, [correctPin, wrongPin]) => {
        const db = createHubTestDatabase();
        try {
          await enableModuleLock(db.adapter, moduleId, correctPin);
          const lock = getModuleLock(db.adapter, moduleId);
          expect(lock).not.toBeNull();
          expect(await verifyPin(wrongPin, lock!.salt, lock!.pinHash)).toBe(false);
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('a module without a lock does not require auth (R21.2)', () => {
    fc.assert(
      fc.property(lockableModuleIdArb, (moduleId) => {
        const db = createHubTestDatabase();
        try {
          const lock = getModuleLock(db.adapter, moduleId);
          expect(lock).toBeNull();
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('only lockable module IDs are eligible for locks (R21.2)', () => {
    const nonLockable = ['books', 'surf', 'workouts', 'recipes', 'words', 'flash', 'habits'];
    fc.assert(
      fc.property(fc.constantFrom(...nonLockable), (moduleId) => {
        expect(isLockableModule(moduleId)).toBe(false);
      }),
      { numRuns: 10 },
    );
  });

  it('all LOCKABLE_MODULE_IDS pass isLockableModule check (R21.2)', () => {
    fc.assert(
      fc.property(lockableModuleIdArb, (moduleId) => {
        expect(isLockableModule(moduleId)).toBe(true);
      }),
      { numRuns: 10 },
    );
  });

  // ── R21.4: 5 failed PINs triggers 60s lockout ─────────────────────

  it('exactly 5 failed attempts triggers lockout (R21.4)', async () => {
    await fc.assert(
      fc.asyncProperty(lockableModuleIdArb, pinArb, async (moduleId, pin) => {
        const db = createHubTestDatabase();
        try {
          await enableModuleLock(db.adapter, moduleId, pin);

          for (let i = 0; i < LOCKOUT_MAX_ATTEMPTS; i++) {
            incrementLockFailedAttempts(db.adapter, moduleId);
          }

          const lock = getModuleLock(db.adapter, moduleId)!;
          expect(lock.failedAttempts).toBe(LOCKOUT_MAX_ATTEMPTS);

          const lockedUntil = computeLockedUntil();
          setLockLockedUntil(db.adapter, moduleId, lockedUntil);

          const updated = getModuleLock(db.adapter, moduleId)!;
          const state = checkLockout(updated.failedAttempts, updated.lockedUntil);
          expect(state.isLocked).toBe(true);
          expect(state.remainingMs).toBeGreaterThan(0);
          expect(state.remainingMs).toBeLessThanOrEqual(LOCKOUT_DURATION_SECONDS * 1000);
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('fewer than 5 failed attempts does not trigger lockout (R21.4)', async () => {
    await fc.assert(
      fc.asyncProperty(lockableModuleIdArb, pinArb, failCountBelowThresholdArb, async (moduleId, pin, failCount) => {
        const db = createHubTestDatabase();
        try {
          await enableModuleLock(db.adapter, moduleId, pin);

          for (let i = 0; i < failCount; i++) {
            incrementLockFailedAttempts(db.adapter, moduleId);
          }

          const lock = getModuleLock(db.adapter, moduleId)!;
          expect(lock.failedAttempts).toBe(failCount);

          const state = checkLockout(lock.failedAttempts, lock.lockedUntil);
          expect(state.isLocked).toBe(false);
          expect(state.remainingMs).toBe(0);
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('lockout duration is exactly 60 seconds (R21.4)', () => {
    fc.assert(
      fc.property(
        lockoutNowArb,
        (now) => {
          const lockedUntil = computeLockedUntil(now);
          const diff = new Date(lockedUntil).getTime() - now.getTime();
          expect(diff).toBe(LOCKOUT_DURATION_SECONDS * 1000);
        },
      ),
      { numRuns: 10 },
    );
  });

  it('lockout expires after 60 seconds (R21.4)', () => {
    fc.assert(
      fc.property(failCountAtOrAboveThresholdArb, (failCount) => {
        const now = new Date();
        const pastLockout = new Date(now.getTime() - LOCKOUT_DURATION_SECONDS * 1000 - 1).toISOString();
        const state = checkLockout(failCount, pastLockout, now);
        expect(state.isLocked).toBe(false);
        expect(state.remainingMs).toBe(0);
      }),
      { numRuns: 10 },
    );
  });

  it('lockout is active during the 60-second window (R21.4)', () => {
    fc.assert(
      fc.property(
        failCountAtOrAboveThresholdArb,
        fc.integer({ min: 1, max: LOCKOUT_DURATION_SECONDS * 1000 - 1 }),
        (failCount, remainingMs) => {
          const now = new Date();
          const lockedUntil = new Date(now.getTime() + remainingMs).toISOString();
          const state = checkLockout(failCount, lockedUntil, now);
          expect(state.isLocked).toBe(true);
          expect(state.remainingMs).toBe(remainingMs);
        },
      ),
      { numRuns: 10 },
    );
  });

  it('resetting failed attempts clears lockout for any module (R21.4)', async () => {
    await fc.assert(
      fc.asyncProperty(lockableModuleIdArb, pinArb, async (moduleId, pin) => {
        const db = createHubTestDatabase();
        try {
          await enableModuleLock(db.adapter, moduleId, pin);

          // Trigger lockout
          for (let i = 0; i < LOCKOUT_MAX_ATTEMPTS; i++) {
            incrementLockFailedAttempts(db.adapter, moduleId);
          }
          setLockLockedUntil(db.adapter, moduleId, computeLockedUntil());

          const beforeReset = getModuleLock(db.adapter, moduleId)!;
          expect(checkLockout(beforeReset.failedAttempts, beforeReset.lockedUntil).isLocked).toBe(true);

          // Reset
          resetLockFailedAttempts(db.adapter, moduleId);

          const afterReset = getModuleLock(db.adapter, moduleId)!;
          expect(afterReset.failedAttempts).toBe(0);
          expect(afterReset.lockedUntil).toBeNull();
          expect(checkLockout(afterReset.failedAttempts, afterReset.lockedUntil).isLocked).toBe(false);
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('lockout is per-module: locking one does not lock another (R21.4)', async () => {
    await fc.assert(
      fc.asyncProperty(lockableModuleIdArb, lockableModuleIdArb, pinArb, async (modA, modB, pin) => {
        fc.pre(modA !== modB);

        const db = createHubTestDatabase();
        try {
          await enableModuleLock(db.adapter, modA, pin);
          await enableModuleLock(db.adapter, modB, pin);

          // Lock out module A
          for (let i = 0; i < LOCKOUT_MAX_ATTEMPTS; i++) {
            incrementLockFailedAttempts(db.adapter, modA);
          }
          setLockLockedUntil(db.adapter, modA, computeLockedUntil());

          const lockA = getModuleLock(db.adapter, modA)!;
          const lockB = getModuleLock(db.adapter, modB)!;

          expect(checkLockout(lockA.failedAttempts, lockA.lockedUntil).isLocked).toBe(true);
          expect(checkLockout(lockB.failedAttempts, lockB.lockedUntil).isLocked).toBe(false);
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });
});
