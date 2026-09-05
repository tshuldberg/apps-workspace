import { describe, expect, it } from 'vitest';
import {
  YEARN_AGE_GATE_STORAGE_KEY,
  calculateYearnAge,
  evaluateYearnAgeGate,
  getYearnAdultBirthdateCutoff,
  loadPersistedYearnAgeGateBirthdate,
  parseYearnBirthdate,
  persistYearnAgeGateBirthdate,
  type YearnAgeGateStorage,
} from '../ageGate';

const now = new Date('2026-05-31T12:00:00.000Z');

function createMemoryStorage(): YearnAgeGateStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
  };
}

describe('ageGate', () => {
  it('parses only valid YYYY-MM-DD birthdates', () => {
    expect(parseYearnBirthdate('2000-02-29')).toEqual({
      year: 2000,
      month: 2,
      day: 29,
    });
    expect(parseYearnBirthdate('2001-02-29')).toBeNull();
    expect(parseYearnBirthdate('02/29/2000')).toBeNull();
  });

  it('calculates age by birthday, not calendar year only', () => {
    expect(calculateYearnAge({ year: 2008, month: 5, day: 31 }, now)).toBe(18);
    expect(calculateYearnAge({ year: 2008, month: 6, day: 1 }, now)).toBe(17);
  });

  it('returns the adult birthdate cutoff for date pickers', () => {
    expect(getYearnAdultBirthdateCutoff(now)).toBe('2008-05-31');
  });

  it('blocks under-18 birthdates and accepts adult birthdates', () => {
    expect(evaluateYearnAgeGate('2008-06-01', now)).toEqual({
      status: 'under_18',
      birthdate: '2008-06-01',
      age: 17,
      message: 'Yearn is only available to adults 18 and older.',
    });

    expect(evaluateYearnAgeGate('2008-05-31', now)).toEqual({
      status: 'accepted',
      birthdate: '2008-05-31',
      age: 18,
      message: null,
    });
  });

  it('rejects malformed and unrealistic birthdates', () => {
    expect(evaluateYearnAgeGate('not-a-date', now).status).toBe('invalid_date');
    expect(evaluateYearnAgeGate('1899-01-01', now).status).toBe('unrealistic_age');
  });

  it('persists only accepted birthdates and restores them across launches', async () => {
    const storage = createMemoryStorage();

    await expect(persistYearnAgeGateBirthdate(storage, '1994-06-15', now)).resolves.toBe(true);
    expect(storage.values.get(YEARN_AGE_GATE_STORAGE_KEY)).toBe('1994-06-15');
    await expect(loadPersistedYearnAgeGateBirthdate(storage, now)).resolves.toBe('1994-06-15');

    await expect(persistYearnAgeGateBirthdate(storage, '2010-01-01', now)).resolves.toBe(false);
    expect(storage.values.get(YEARN_AGE_GATE_STORAGE_KEY)).toBe('1994-06-15');
  });

  it('ignores persisted values that no longer pass the gate', async () => {
    const storage = createMemoryStorage();
    storage.values.set(YEARN_AGE_GATE_STORAGE_KEY, '2010-01-01');
    await expect(loadPersistedYearnAgeGateBirthdate(storage, now)).resolves.toBeNull();

    storage.values.set(YEARN_AGE_GATE_STORAGE_KEY, 'tampered');
    await expect(loadPersistedYearnAgeGateBirthdate(storage, now)).resolves.toBeNull();
  });
});
