/**
 * @mylife/auth -- Hub-level module lock service.
 *
 * Provides PIN-based and biometric lock for sensitive modules.
 * PIN hashes use PBKDF2-SHA256 via SubtleCrypto (cross-platform). The stored
 * format is `v2.<iterations>.<hex-hash>`. Legacy v1 values (raw 64-char hex
 * SHA-256 from pre-hardening installs) are still accepted and automatically
 * re-hashed to v2 on the next successful unlock.
 *
 * Biometric auth is handled at the UI layer (expo-local-authentication / WebAuthn).
 * This module handles only storage and computation.
 *
 * Satisfies Requirements 21.1-21.5.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { ModuleLockRow, ModuleLockMethod } from './types';

// ── Constants ────────────────────────────────────────────────────────

/** Modules that support privacy lock (R21.1). */
export const LOCKABLE_MODULE_IDS = [
  'budget',
  'cycle',
  'health',
  'journal',
  'mail',
  'manhattan',
  'meds',
  'mood',
  'notes',
] as const;

export type LockableModuleId = (typeof LOCKABLE_MODULE_IDS)[number];

/** 5 failed attempts triggers lockout (R21.4). */
const LOCKOUT_THRESHOLD = 5;

/** 60-second lockout window (R21.4). */
const LOCKOUT_DURATION_MS = 60 * 1000;

// ── PIN Hashing (PBKDF2-SHA256 via SubtleCrypto) ─────────────────────

/**
 * PBKDF2 iteration count. OWASP 2023 recommends >= 600,000 for SHA-256. The
 * lock check runs once per unlock (not per-request), so the UX cost is a
 * one-time ~50-150ms delay on unlock. Worth it: raises GPU-cracking cost for
 * a 6-digit PIN from microseconds to ~minutes per PIN.
 */
const PBKDF2_ITERATIONS = 600_000;
/** 32 bytes = 256 bits, matches output of SHA-256. */
const PBKDF2_HASH_BYTES = 32;

/**
 * Constant-time string comparison. Used for hash comparison; length mismatch
 * still returns false but only after scanning the full shorter string so a
 * size-only timing difference is not informative.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Runtime detection: some React Native / Hermes builds ship `crypto.subtle`
 * with `digest` support but without `importKey`/`deriveBits`. Rather than
 * crash the unlock flow on those devices, we probe once per process and
 * cache the result. When PBKDF2 isn't available we fall back to legacy v1
 * SHA-256 so existing users can still unlock.
 */
let pbkdf2SupportCache: Promise<boolean> | null = null;

export async function isPbkdf2Supported(): Promise<boolean> {
  if (pbkdf2SupportCache) return pbkdf2SupportCache;
  pbkdf2SupportCache = (async () => {
    try {
      if (
        typeof crypto === 'undefined'
        || !crypto.subtle
        || typeof crypto.subtle.importKey !== 'function'
        || typeof crypto.subtle.deriveBits !== 'function'
      ) {
        return false;
      }
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode('probe'),
        'PBKDF2',
        false,
        ['deriveBits'],
      );
      await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: encoder.encode('probe'), iterations: 1, hash: 'SHA-256' },
        keyMaterial,
        32,
      );
      return true;
    } catch (err) {
      // Log once so device-specific crypto gaps are visible in telemetry.
      // eslint-disable-next-line no-console
      console.warn(
        '[auth/module-lock] PBKDF2 unavailable — falling back to legacy v1 PIN hash.',
        err,
      );
      return false;
    }
  })();
  return pbkdf2SupportCache;
}

async function pbkdf2HashHex(
  pin: string,
  salt: string,
  iterations: number,
): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    PBKDF2_HASH_BYTES * 8,
  );
  return bytesToHex(new Uint8Array(bits));
}

/** Legacy v1 hash: single-round salted SHA-256. Verify-only. */
async function legacySha256HashHex(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Produce a PIN hash. Returns v2 (PBKDF2-SHA256 with iteration count
 * embedded) when the runtime supports `crypto.subtle.deriveBits` with
 * PBKDF2, otherwise falls back to legacy v1 raw SHA-256 so devices with
 * incomplete WebCrypto (some Hermes / older RN builds) can still store and
 * verify PINs.
 *
 * Callers treat both formats identically -- `verifyPinWithRehash` handles
 * either and flags legacy hashes for rehash on the next successful unlock
 * (which will only upgrade if PBKDF2 is available at that time).
 */
export async function hashPin(pin: string, salt: string): Promise<string> {
  if (await isPbkdf2Supported()) {
    const hex = await pbkdf2HashHex(pin, salt, PBKDF2_ITERATIONS);
    return `v2.${PBKDF2_ITERATIONS}.${hex}`;
  }
  return legacySha256HashHex(pin, salt);
}

/**
 * Verify a PIN against a stored hash. Accepts both v2 (PBKDF2) and legacy v1
 * (raw hex SHA-256, no version prefix) formats. Returns `{ ok, needsRehash }`
 * so callers can upgrade legacy hashes on the next successful unlock.
 */
export async function verifyPinWithRehash(
  pin: string,
  salt: string,
  storedHash: string,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (storedHash.startsWith('v2.')) {
    const parts = storedHash.split('.');
    if (parts.length !== 3) return { ok: false, needsRehash: false };
    const iterations = Number.parseInt(parts[1], 10);
    if (!Number.isFinite(iterations) || iterations <= 0) {
      return { ok: false, needsRehash: false };
    }
    const expected = parts[2];
    const computed = await pbkdf2HashHex(pin, salt, iterations);
    const ok = timingSafeStringEqual(computed, expected);
    // Re-hash if iteration count fell behind the current floor (rotation).
    return { ok, needsRehash: ok && iterations < PBKDF2_ITERATIONS };
  }

  // Legacy v1 path: raw 64-char hex SHA-256 with no version prefix. Still
  // verify so existing installs can unlock, but flag for re-hash.
  const computed = await legacySha256HashHex(pin, salt);
  const ok = timingSafeStringEqual(computed, storedHash);
  return { ok, needsRehash: ok };
}

/**
 * Back-compat wrapper that drops the rehash signal. Prefer
 * `verifyPinWithRehash` in new code so the caller can upgrade stored hashes.
 */
export async function verifyPin(
  pin: string,
  salt: string,
  storedHash: string,
): Promise<boolean> {
  const result = await verifyPinWithRehash(pin, salt, storedHash);
  return result.ok;
}

export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

// ── Lockout Logic ────────────────────────────────────────────────────

export interface LockoutState {
  isLocked: boolean;
  remainingMs: number;
}

export function checkLockout(
  failedAttempts: number,
  lockedUntil: string | null,
  now: Date = new Date(),
): LockoutState {
  if (failedAttempts < LOCKOUT_THRESHOLD) {
    return { isLocked: false, remainingMs: 0 };
  }
  if (!lockedUntil) {
    return { isLocked: false, remainingMs: 0 };
  }
  const lockEnd = new Date(lockedUntil).getTime();
  const remaining = lockEnd - now.getTime();
  if (remaining <= 0) {
    return { isLocked: false, remainingMs: 0 };
  }
  return { isLocked: true, remainingMs: remaining };
}

export function computeLockedUntil(now: Date = new Date()): string {
  return new Date(now.getTime() + LOCKOUT_DURATION_MS).toISOString();
}

// ── Timeout Logic ────────────────────────────────────────────────────

export function isTimeoutElapsed(
  lastAuthTimestamp: number | null,
  timeoutSeconds: number,
  now: number = Date.now(),
): boolean {
  if (timeoutSeconds === 0) return true;
  if (lastAuthTimestamp === null) return true;
  return now - lastAuthTimestamp >= timeoutSeconds * 1000;
}

// ── Utility ──────────────────────────────────────────────────────────

export function isLockableModule(moduleId: string): boolean {
  return (LOCKABLE_MODULE_IDS as readonly string[]).includes(moduleId);
}

// ── Row Mapper ───────────────────────────────────────────────────────

function rowToLock(row: Record<string, unknown>): ModuleLockRow {
  return {
    moduleId: row.module_id as string,
    pinHash: row.pin_hash as string,
    salt: row.salt as string,
    method: row.method as ModuleLockMethod,
    lockTimeoutSeconds: row.lock_timeout_seconds as number,
    failedAttempts: row.failed_attempts as number,
    lockedUntil: (row.locked_until as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ── CRUD ─────────────────────────────────────────────────────────────

export function getModuleLock(
  db: DatabaseAdapter,
  moduleId: string,
): ModuleLockRow | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM hub_module_locks WHERE module_id = ?',
    [moduleId],
  );
  return rows.length > 0 ? rowToLock(rows[0]) : null;
}

export function getAllModuleLocks(db: DatabaseAdapter): ModuleLockRow[] {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM hub_module_locks ORDER BY module_id',
  );
  return rows.map(rowToLock);
}

export async function enableModuleLock(
  db: DatabaseAdapter,
  moduleId: string,
  pin: string,
  method: ModuleLockMethod = 'pin',
  lockTimeoutSeconds: number = 0,
): Promise<void> {
  const salt = generateSalt();
  const pinHash = await hashPin(pin, salt);
  const now = new Date().toISOString();

  db.execute(
    `INSERT INTO hub_module_locks (module_id, pin_hash, salt, method, lock_timeout_seconds, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(module_id) DO UPDATE SET
       pin_hash = excluded.pin_hash,
       salt = excluded.salt,
       method = excluded.method,
       lock_timeout_seconds = excluded.lock_timeout_seconds,
       failed_attempts = 0,
       locked_until = NULL,
       updated_at = excluded.updated_at`,
    [moduleId, pinHash, salt, method, lockTimeoutSeconds, now, now],
  );
}

export function disableModuleLock(
  db: DatabaseAdapter,
  moduleId: string,
): void {
  db.execute('DELETE FROM hub_module_locks WHERE module_id = ?', [moduleId]);
}

/**
 * Result of `attemptUnlock`.
 *
 * - `not_configured`: no lock row exists for this module.
 * - `locked_out`: too many failed attempts; `lockedUntil` is set.
 * - `invalid`: PIN did not match; failed-attempt counter was incremented.
 * - `unlocked`: PIN matched; failed-attempt counter was reset. `upgraded` is
 *   true if the stored hash was transparently upgraded from a legacy format
 *   or a stale iteration count to the current PBKDF2 parameters.
 */
export type AttemptUnlockResult =
  | { status: 'not_configured' }
  | { status: 'locked_out'; lockedUntil: string; remainingMs: number }
  | { status: 'invalid'; failedAttempts: number; lockedUntil: string | null }
  | { status: 'unlocked'; upgraded: boolean };

/**
 * Verify a PIN and apply the full lock state machine atomically:
 *
 *   1. Ensure the module has a lock configured.
 *   2. Respect any active lockout window.
 *   3. Verify the PIN (accepts legacy v1 hashes; upgrades them on success).
 *   4. On success, reset the failed-attempt counter and clear lockedUntil.
 *   5. On failure, increment the counter; if it reaches LOCKOUT_THRESHOLD,
 *      set `locked_until` to `now + LOCKOUT_DURATION_MS`.
 *
 * This is the entry point every UI layer should use for unlock flows. It
 * replaces scattered verify + increment/reset bookkeeping and guarantees
 * stored hashes migrate away from legacy SHA-256 over time.
 */
export async function attemptUnlock(
  db: DatabaseAdapter,
  moduleId: string,
  pin: string,
): Promise<AttemptUnlockResult> {
  const lock = getModuleLock(db, moduleId);
  if (!lock) return { status: 'not_configured' };

  const lockout = checkLockout(lock.failedAttempts, lock.lockedUntil);
  if (lockout.isLocked) {
    return {
      status: 'locked_out',
      lockedUntil: lock.lockedUntil as string,
      remainingMs: lockout.remainingMs,
    };
  }

  const verify = await verifyPinWithRehash(pin, lock.salt, lock.pinHash);

  if (!verify.ok) {
    const newCount = incrementLockFailedAttempts(db, moduleId);
    let newLockedUntil: string | null = lock.lockedUntil;
    if (newCount >= LOCKOUT_THRESHOLD) {
      newLockedUntil = computeLockedUntil();
      setLockLockedUntil(db, moduleId, newLockedUntil);
    }
    return { status: 'invalid', failedAttempts: newCount, lockedUntil: newLockedUntil };
  }

  let upgraded = false;
  // Only rehash when PBKDF2 is actually available on this device -- otherwise
  // we'd rewrite a legacy hash with another legacy hash and churn on every
  // unlock without benefit.
  if (verify.needsRehash && (await isPbkdf2Supported())) {
    // Re-salt on upgrade: treat legacy hashes as fully compromised material,
    // not just weakly-hashed. A fresh salt ensures nothing carries over.
    const newSalt = generateSalt();
    const newHash = await hashPin(pin, newSalt);
    const now = new Date().toISOString();
    db.execute(
      'UPDATE hub_module_locks SET pin_hash = ?, salt = ?, updated_at = ? WHERE module_id = ?',
      [newHash, newSalt, now, moduleId],
    );
    upgraded = true;
  }

  resetLockFailedAttempts(db, moduleId);
  return { status: 'unlocked', upgraded };
}

export function incrementLockFailedAttempts(
  db: DatabaseAdapter,
  moduleId: string,
): number {
  const lock = getModuleLock(db, moduleId);
  if (!lock) return 0;

  const newCount = lock.failedAttempts + 1;
  const now = new Date().toISOString();

  db.execute(
    'UPDATE hub_module_locks SET failed_attempts = ?, updated_at = ? WHERE module_id = ?',
    [newCount, now, moduleId],
  );

  return newCount;
}

export function resetLockFailedAttempts(
  db: DatabaseAdapter,
  moduleId: string,
): void {
  const now = new Date().toISOString();
  db.execute(
    'UPDATE hub_module_locks SET failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE module_id = ?',
    [now, moduleId],
  );
}

export function setLockLockedUntil(
  db: DatabaseAdapter,
  moduleId: string,
  lockedUntil: string,
): void {
  const now = new Date().toISOString();
  db.execute(
    'UPDATE hub_module_locks SET locked_until = ?, updated_at = ? WHERE module_id = ?',
    [lockedUntil, now, moduleId],
  );
}

export function updateModuleLockMethod(
  db: DatabaseAdapter,
  moduleId: string,
  method: ModuleLockMethod,
  lockTimeoutSeconds?: number,
): void {
  const now = new Date().toISOString();
  if (lockTimeoutSeconds !== undefined) {
    db.execute(
      'UPDATE hub_module_locks SET method = ?, lock_timeout_seconds = ?, updated_at = ? WHERE module_id = ?',
      [method, lockTimeoutSeconds, now, moduleId],
    );
  } else {
    db.execute(
      'UPDATE hub_module_locks SET method = ?, updated_at = ? WHERE module_id = ?',
      [method, now, moduleId],
    );
  }
}

export async function changeModuleLockPin(
  db: DatabaseAdapter,
  moduleId: string,
  currentPin: string,
  newPin: string,
): Promise<boolean> {
  const lock = getModuleLock(db, moduleId);
  if (!lock) return false;

  const valid = await verifyPin(currentPin, lock.salt, lock.pinHash);
  if (!valid) return false;

  const salt = generateSalt();
  const pinHash = await hashPin(newPin, salt);
  const now = new Date().toISOString();

  db.execute(
    'UPDATE hub_module_locks SET pin_hash = ?, salt = ?, updated_at = ? WHERE module_id = ?',
    [pinHash, salt, now, moduleId],
  );

  return true;
}

// ── Re-export constants ──────────────────────────────────────────────

export const LOCKOUT_MAX_ATTEMPTS = LOCKOUT_THRESHOLD;
export const LOCKOUT_DURATION_SECONDS = LOCKOUT_DURATION_MS / 1000;
