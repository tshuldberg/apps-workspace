import { describe, expect, it } from 'vitest';
import {
  AGE_GATE_SETTING_KEY,
  MEERKAT_DEFAULT_MINIMUM_AGE,
  clampMinimumAge,
  decodeAgeGateRecord,
  encodeAgeGateRecord,
  evaluateAgeGateBirthDate,
  exactAgeAt,
  storeAgeSignalSatisfiesGate,
} from '../age-gate';

const NOW = Date.UTC(2026, 6, 20); // 2026-07-20

describe('clampMinimumAge', () => {
  it('defaults on unparseable input', () => {
    expect(clampMinimumAge(undefined)).toBe(MEERKAT_DEFAULT_MINIMUM_AGE);
    expect(clampMinimumAge('')).toBe(MEERKAT_DEFAULT_MINIMUM_AGE);
    expect(clampMinimumAge('not-a-number')).toBe(MEERKAT_DEFAULT_MINIMUM_AGE);
    expect(clampMinimumAge(Number.NaN)).toBe(MEERKAT_DEFAULT_MINIMUM_AGE);
  });

  it('never weakens below the COPPA floor and caps at the ceiling', () => {
    expect(clampMinimumAge(0)).toBe(13);
    expect(clampMinimumAge(12)).toBe(13);
    expect(clampMinimumAge('16')).toBe(16);
    expect(clampMinimumAge(18)).toBe(18);
    expect(clampMinimumAge(99)).toBe(21);
  });
});

describe('evaluateAgeGateBirthDate', () => {
  it('passes an exactly-13 birthday today', () => {
    const result = evaluateAgeGateBirthDate({ year: 2013, month: 7, day: 20 }, NOW, 13);
    expect(result).toEqual({ ok: true, age: 13 });
  });

  it('locks a 13th-birthday-tomorrow answer as underage', () => {
    const result = evaluateAgeGateBirthDate({ year: 2013, month: 7, day: 21 }, NOW, 13);
    expect(result).toEqual({ ok: false, reason: 'underage', age: 12 });
  });

  it('applies a configured higher minimum', () => {
    expect(evaluateAgeGateBirthDate({ year: 2011, month: 1, day: 1 }, NOW, 16).ok).toBe(false);
    expect(evaluateAgeGateBirthDate({ year: 2009, month: 1, day: 1 }, NOW, 16).ok).toBe(true);
  });

  it('rejects rollover dates like Feb 30 as entry errors, not underage', () => {
    const result = evaluateAgeGateBirthDate({ year: 2000, month: 2, day: 30 }, NOW, 13);
    expect(result).toEqual({ ok: false, reason: 'invalid_date' });
  });

  it('accepts a real leap-day birth date', () => {
    const result = evaluateAgeGateBirthDate({ year: 2004, month: 2, day: 29 }, NOW, 13);
    expect(result.ok).toBe(true);
  });

  it('rejects future and implausible dates', () => {
    expect(evaluateAgeGateBirthDate({ year: 2030, month: 1, day: 1 }, NOW, 13)).toEqual({
      ok: false,
      reason: 'in_future',
    });
    expect(
      evaluateAgeGateBirthDate({ year: 1890, month: 1, day: 1 }, NOW, 13),
    ).toMatchObject({ ok: false, reason: 'implausible' });
  });

  it('rejects out-of-range fields', () => {
    for (const birth of [
      { year: 2000, month: 0, day: 1 },
      { year: 2000, month: 13, day: 1 },
      { year: 2000, month: 6, day: 0 },
      { year: 2000, month: 6, day: 32 },
      { year: 2000.5, month: 6, day: 1 },
    ]) {
      expect(evaluateAgeGateBirthDate(birth, NOW, 13)).toEqual({ ok: false, reason: 'invalid_date' });
    }
  });
});

describe('exactAgeAt', () => {
  it('counts the birthday day itself as attained', () => {
    expect(exactAgeAt({ year: 2000, month: 7, day: 20 }, NOW)).toBe(26);
    expect(exactAgeAt({ year: 2000, month: 7, day: 21 }, NOW)).toBe(25);
  });
});

describe('record codec', () => {
  it('round-trips passed and locked outcomes without any birth date', () => {
    for (const status of ['passed', 'locked'] as const) {
      const raw = encodeAgeGateRecord(status, 13, NOW);
      expect(raw).not.toMatch(/birth|year|month|day/i);
      const decoded = decodeAgeGateRecord(raw);
      expect(decoded).toEqual({ version: 1, status, at: new Date(NOW).toISOString(), minimumAge: 13, source: 'device' });
    }
  });

  it('decodes legacy records without a source as device-sourced', () => {
    const legacy = JSON.stringify({ version: 1, status: 'passed', at: new Date(NOW).toISOString(), minimumAge: 13 });
    expect(decodeAgeGateRecord(legacy)?.source).toBe('device');
  });

  it('store-sourced records can only record a pass, never a lock (Plan 51)', () => {
    const raw = encodeAgeGateRecord('passed', 13, NOW, 'store');
    expect(decodeAgeGateRecord(raw)).toEqual({
      version: 1, status: 'passed', at: new Date(NOW).toISOString(), minimumAge: 13, source: 'store',
    });
    expect(() => encodeAgeGateRecord('locked', 13, NOW, 'store')).toThrow(/only record a passed/);
    const forgedLock = JSON.stringify({ version: 1, status: 'locked', at: new Date(NOW).toISOString(), minimumAge: 13, source: 'store' });
    expect(decodeAgeGateRecord(forgedLock)).toBeNull();
  });

  it('only an adult store signal satisfies the gate', () => {
    expect(storeAgeSignalSatisfiesGate('adult')).toBe(true);
    expect(storeAgeSignalSatisfiesGate('minor')).toBe(false);
    expect(storeAgeSignalSatisfiesGate('unknown')).toBe(false);
  });

  it('clamps a weakened persisted minimum on decode', () => {
    const tampered = JSON.stringify({ version: 1, status: 'passed', at: new Date(NOW).toISOString(), minimumAge: 5 });
    expect(decodeAgeGateRecord(tampered)?.minimumAge).toBe(13);
  });

  it('decodes malformed rows to null instead of fabricating a passed state', () => {
    for (const raw of [
      null,
      undefined,
      '',
      'not json',
      '{}',
      JSON.stringify({ version: 2, status: 'passed', at: new Date(NOW).toISOString(), minimumAge: 13 }),
      JSON.stringify({ version: 1, status: 'maybe', at: new Date(NOW).toISOString(), minimumAge: 13 }),
      JSON.stringify({ version: 1, status: 'passed', at: 'garbage', minimumAge: 13 }),
      JSON.stringify({ version: 1, status: 'passed', at: new Date(NOW).toISOString(), minimumAge: 'x' }),
      `${'x'.repeat(600)}`,
    ]) {
      expect(decodeAgeGateRecord(raw as string | null | undefined)).toBeNull();
    }
  });

  it('exposes the shared settings key', () => {
    expect(AGE_GATE_SETTING_KEY).toBe('meerkat_age_gate_v1');
  });
});
