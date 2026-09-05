/**
 * Lock engine -- pure functions for PIN hashing, verification, and lockout logic.
 *
 * PIN hash + salt are stored in the `mo_module_lock` SQLite table (local-only,
 * never synced to cloud). Biometric auth is handled at the UI layer via
 * expo-local-authentication; this module handles only PIN material.
 *
 * Hash format: `v2.<iterations>.<hex-hash>` using PBKDF2-SHA256. Legacy v1
 * values (raw 64-char hex SHA-256 from pre-hardening installs) still verify
 * and are auto-upgraded by callers that use `verifyPinWithRehash`.
 */

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// ── PIN Hashing (PBKDF2-SHA256 via SubtleCrypto) ─────────────────────

/**
 * PBKDF2 iteration count. OWASP 2023 recommends >= 600,000 for SHA-256.
 * Raises GPU-cracking cost for a 4-6 digit PIN from microseconds to minutes
 * per candidate. Unlock latency: ~50-150ms on modern devices, once per unlock.
 */
const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_HASH_BYTES = 32;

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
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
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations, hash: 'SHA-256' },
    keyMaterial,
    PBKDF2_HASH_BYTES * 8,
  );
  return bytesToHex(new Uint8Array(bits));
}

async function legacySha256HashHex(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Runtime-detected PBKDF2 capability. Some React Native / Hermes builds ship
 * `crypto.subtle` with `digest` but not `importKey`/`deriveBits`. When that
 * is the case we fall back to legacy v1 SHA-256 rather than crash the unlock
 * flow, so beta testers on affected devices can still set and verify PINs.
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
      // eslint-disable-next-line no-console
      console.warn('[mood/lock] PBKDF2 unavailable -- falling back to legacy v1 PIN hash.', err);
      return false;
    }
  })();
  return pbkdf2SupportCache;
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  if (await isPbkdf2Supported()) {
    const hex = await pbkdf2HashHex(pin, salt, PBKDF2_ITERATIONS);
    return `v2.${PBKDF2_ITERATIONS}.${hex}`;
  }
  return legacySha256HashHex(pin, salt);
}

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
    const computed = await pbkdf2HashHex(pin, salt, iterations);
    const ok = timingSafeStringEqual(computed, parts[2]);
    return { ok, needsRehash: ok && iterations < PBKDF2_ITERATIONS };
  }
  const computed = await legacySha256HashHex(pin, salt);
  const ok = timingSafeStringEqual(computed, storedHash);
  return { ok, needsRehash: ok };
}

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

// ── Lockout Logic ─────────────────────────────────────────────────────

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

// ── Timeout Logic ─────────────────────────────────────────────────────

export function isTimeoutElapsed(
  lastAuthTimestamp: number | null,
  timeoutSeconds: number,
  now: number = Date.now(),
): boolean {
  // timeout = 0 means lock immediately
  if (timeoutSeconds === 0) return true;
  if (lastAuthTimestamp === null) return true;

  return (now - lastAuthTimestamp) >= timeoutSeconds * 1000;
}

// ── Constants ─────────────────────────────────────────────────────────

export const LOCKOUT_MAX_ATTEMPTS = LOCKOUT_THRESHOLD;
export const LOCKOUT_DURATION_SECONDS = LOCKOUT_DURATION_MS / 1000;
