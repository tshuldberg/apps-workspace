import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { AGE_GATE_SETTING_KEY } from '@mylife/sync';
import {
  isAgeGateLocked,
  isAgeGatePassed,
  readAgeGateRecord,
  resolveMinimumAge,
  submitAgeGateBirthDate,
  subscribeAgeGateChanged,
} from '../age-gate';

const NOW = Date.UTC(2026, 6, 20); // 2026-07-20

// Minimal mk_settings fake matching the meerkat-data getSetting/setSetting SQL.
function makeDb(): DatabaseAdapter {
  const values = new Map<string, string>();
  return {
    execute(sql, params = []) {
      if (sql.includes('INSERT OR REPLACE INTO mk_settings')) values.set(String(params[0]), String(params[1]));
    },
    query<T>(sql: string, params = []): T[] {
      const value = values.get(String(params[0]));
      return sql.includes('SELECT value FROM mk_settings') && value !== undefined
        ? ([{ value }] as T[])
        : [];
    },
    transaction(fn) { fn(); },
  };
}

describe('meerkat web age gate adapter (twin of mobile)', () => {
  it('starts unanswered', () => {
    const db = makeDb();
    expect(readAgeGateRecord(db)).toBeNull();
    expect(isAgeGatePassed(db)).toBe(false);
    expect(isAgeGateLocked(db)).toBe(false);
  });

  it('clamps the configured minimum age', () => {
    expect(resolveMinimumAge(undefined)).toBe(13);
    expect(resolveMinimumAge('16')).toBe(16);
    expect(resolveMinimumAge('7')).toBe(13);
    expect(resolveMinimumAge('garbage')).toBe(13);
  });

  it('persists a passing answer without the birth date and notifies subscribers', () => {
    const db = makeDb();
    const events: string[] = [];
    const unsubscribe = subscribeAgeGateChanged(() => events.push('changed'));
    const result = submitAgeGateBirthDate(db, { year: 2000, month: 1, day: 1 }, NOW, 13);
    unsubscribe();

    expect(result.ok).toBe(true);
    expect(isAgeGatePassed(db)).toBe(true);
    expect(events).toEqual(['changed']);
    const raw = db.query<{ value: string }>('SELECT value FROM mk_settings WHERE key = ?', [AGE_GATE_SETTING_KEY])[0]?.value ?? '';
    expect(raw).not.toMatch(/2000|birth/i);
  });

  it('locks durably on an underage answer and persists nothing on entry errors', () => {
    const db = makeDb();
    expect(submitAgeGateBirthDate(db, { year: 2000, month: 2, day: 30 }, NOW, 13).ok).toBe(false);
    expect(readAgeGateRecord(db)).toBeNull();
    const result = submitAgeGateBirthDate(db, { year: 2020, month: 1, day: 1 }, NOW, 13);
    expect(result).toMatchObject({ ok: false, reason: 'underage' });
    expect(isAgeGateLocked(db)).toBe(true);
  });
});
