import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { AGE_GATE_SETTING_KEY } from '@mylife/sync';
import { getSetting, setSetting } from '../db';
import {
  isAgeGateLocked,
  isAgeGatePassed,
  readAgeGateRecord,
  resolveMinimumAgeFromExtra,
  submitAgeGateBirthDate,
  subscribeAgeGateChanged,
} from '../age-gate';

const NOW = Date.UTC(2026, 6, 20); // 2026-07-20

// Same minimal mk_settings fake the sibling public-safety test uses.
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

describe('meerkat mobile age gate adapter', () => {
  it('starts unanswered: neither passed nor locked', () => {
    const db = makeDb();
    expect(readAgeGateRecord(db)).toBeNull();
    expect(isAgeGatePassed(db)).toBe(false);
    expect(isAgeGateLocked(db)).toBe(false);
  });

  it('resolves the configured minimum age from an extra bag with clamping', () => {
    expect(resolveMinimumAgeFromExtra({})).toBe(13);
    expect(resolveMinimumAgeFromExtra({ minimumAge: '16' })).toBe(16);
    expect(resolveMinimumAgeFromExtra({ minimumAge: '7' })).toBe(13);
    expect(resolveMinimumAgeFromExtra({ minimumAge: 'garbage' })).toBe(13);
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
    const raw = getSetting(db, AGE_GATE_SETTING_KEY) ?? '';
    expect(raw).not.toMatch(/2000|birth/i);
    expect(readAgeGateRecord(db)).toMatchObject({ status: 'passed', minimumAge: 13 });
  });

  it('locks durably on an underage answer', () => {
    const db = makeDb();
    const result = submitAgeGateBirthDate(db, { year: 2020, month: 1, day: 1 }, NOW, 13);
    expect(result).toMatchObject({ ok: false, reason: 'underage' });
    expect(isAgeGateLocked(db)).toBe(true);
    expect(isAgeGatePassed(db)).toBe(false);
    // A later passing answer does not overwrite the lock via the normal submit
    // path guard in the UI (the locked screen renders no input); the adapter
    // itself records what it is told, so assert the lock row survived reads.
    expect(readAgeGateRecord(db)?.status).toBe('locked');
  });

  it('persists nothing on correctable entry errors', () => {
    const db = makeDb();
    for (const birth of [
      { year: 2000, month: 2, day: 30 },
      { year: 2030, month: 1, day: 1 },
      { year: 1890, month: 1, day: 1 },
    ]) {
      const result = submitAgeGateBirthDate(db, birth, NOW, 13);
      expect(result.ok).toBe(false);
      expect(readAgeGateRecord(db)).toBeNull();
    }
  });

  it('re-prompts (does not fabricate passed) when the stored row is corrupt', () => {
    const db = makeDb();
    setSetting(db, AGE_GATE_SETTING_KEY, 'corrupt-not-json');
    expect(readAgeGateRecord(db)).toBeNull();
    expect(isAgeGatePassed(db)).toBe(false);
  });
});
