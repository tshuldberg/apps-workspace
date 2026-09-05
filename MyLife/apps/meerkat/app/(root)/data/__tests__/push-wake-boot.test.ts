// Push registration handle tests (Plan 42 NC-42.3).
//
// The registration handle is an opaque 256-bit random capability, persisted
// device-local, and NOT derived from any identity. Proves: it is created once,
// reused on subsequent loads, regenerated when malformed, and cleared on
// sign-out.

import { describe, it, expect } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  loadOrCreatePushRegistrationHandle,
  clearPushRegistrationHandle,
  PUSH_REGISTRATION_HANDLE_KEY,
} from '../push-wake-boot';

/** A tiny in-memory mk_settings-shaped db stub (only what the helper touches). */
function fakeDb(): DatabaseAdapter & { store: Map<string, string> } {
  const store = new Map<string, string>();
  const db = {
    store,
    query<T>(sql: string, params: unknown[] = []): T[] {
      if (sql.includes('FROM mk_settings') && sql.includes('WHERE key')) {
        const key = params[0] as string;
        const value = store.get(key);
        return (value === undefined ? [] : [{ value }]) as unknown as T[];
      }
      return [] as T[];
    },
    execute(sql: string, params: unknown[] = []): void {
      if (sql.startsWith('INSERT OR REPLACE INTO mk_settings') || sql.includes('INSERT INTO mk_settings')) {
        store.set(params[0] as string, params[1] as string);
      } else if (sql.includes('DELETE FROM mk_settings')) {
        store.delete(params[0] as string);
      }
    },
  } as unknown as DatabaseAdapter & { store: Map<string, string> };
  return db;
}

/** Deterministic byte source for the test (not a real PRNG). */
function seqBytes(start: number): (n: number) => Uint8Array {
  return (n: number) => Uint8Array.from({ length: n }, (_, i) => (start + i) % 256);
}

describe('push registration handle (NC-42.3)', () => {
  it('creates a 256-bit (64 hex char) handle on first use and persists it', () => {
    const db = fakeDb();
    const handle = loadOrCreatePushRegistrationHandle(db, seqBytes(1));
    expect(handle).toHaveLength(64);
    expect(db.store.get(PUSH_REGISTRATION_HANDLE_KEY)).toBe(handle);
  });

  it('reuses the stored handle on subsequent loads (stable capability)', () => {
    const db = fakeDb();
    const first = loadOrCreatePushRegistrationHandle(db, seqBytes(1));
    // A different byte source must NOT change the handle; it is already stored.
    const second = loadOrCreatePushRegistrationHandle(db, seqBytes(200));
    expect(second).toBe(first);
  });

  it('regenerates when the stored handle is malformed (wrong length)', () => {
    const db = fakeDb();
    db.store.set(PUSH_REGISTRATION_HANDLE_KEY, 'too-short');
    const handle = loadOrCreatePushRegistrationHandle(db, seqBytes(5));
    expect(handle).toHaveLength(64);
    expect(handle).not.toBe('too-short');
  });

  it('clears the handle on sign-out so a fresh install gets a new capability', () => {
    const db = fakeDb();
    loadOrCreatePushRegistrationHandle(db, seqBytes(1));
    clearPushRegistrationHandle(db);
    expect(db.store.has(PUSH_REGISTRATION_HANDLE_KEY)).toBe(false);
  });
});
