import { describe, it, expect } from 'vitest';
import {
  calculateIOB,
  getSuggestedSite,
  getSiteRecency,
  getDailyInsulinTotals,
  calculateDailyAverage,
} from '../engine';
import type { InsulinEntry, InjectionSite } from '../../models/insulin';

function makeEntry(overrides: Partial<InsulinEntry> = {}): InsulinEntry {
  return {
    id: 'test-1',
    medicationId: null,
    insulinType: 'rapid',
    units: 10,
    doseCategory: 'bolus',
    injectionSite: null,
    carbsCovered: null,
    bloodGlucoseBefore: null,
    notes: null,
    administeredAt: '2026-03-20T10:00:00.000Z',
    createdAt: '2026-03-20T10:00:00.000Z',
    ...overrides,
  };
}

function makeSite(overrides: Partial<InjectionSite> = {}): InjectionSite {
  return {
    id: 'site-1',
    siteName: 'abdomen_left',
    lastUsedAt: '2026-03-20T10:00:00.000Z',
    useCount: 1,
    createdAt: '2026-03-20T10:00:00.000Z',
    ...overrides,
  };
}

describe('calculateIOB', () => {
  it('returns full IOB for very recent dose', () => {
    const now = new Date('2026-03-20T10:00:00.000Z');
    const entries = [makeEntry({ administeredAt: '2026-03-20T10:00:00.000Z', units: 10 })];
    expect(calculateIOB(entries, now)).toBe(10);
  });

  it('returns ~half IOB for rapid at 2h (4h duration)', () => {
    const now = new Date('2026-03-20T12:00:00.000Z');
    const entries = [makeEntry({ administeredAt: '2026-03-20T10:00:00.000Z', units: 10, insulinType: 'rapid' })];
    expect(calculateIOB(entries, now)).toBe(5);
  });

  it('returns 0 IOB when fully elapsed', () => {
    const now = new Date('2026-03-20T14:00:00.000Z');
    const entries = [makeEntry({ administeredAt: '2026-03-20T10:00:00.000Z', units: 10, insulinType: 'rapid' })];
    expect(calculateIOB(entries, now)).toBe(0);
  });

  it('calculates long-acting IOB correctly', () => {
    const now = new Date('2026-03-20T22:00:00.000Z');
    const entries = [makeEntry({
      administeredAt: '2026-03-20T10:00:00.000Z',
      units: 20,
      insulinType: 'long',
    })];
    // 12h elapsed out of 24h = 50% remaining = 10 IU
    expect(calculateIOB(entries, now)).toBe(10);
  });

  it('sums IOB from multiple doses', () => {
    const now = new Date('2026-03-20T12:00:00.000Z');
    const entries = [
      makeEntry({ administeredAt: '2026-03-20T10:00:00.000Z', units: 10, insulinType: 'rapid' }),
      makeEntry({ administeredAt: '2026-03-20T11:00:00.000Z', units: 6, insulinType: 'rapid' }),
    ];
    // First: 2h elapsed / 4h = 50% remaining = 5.0
    // Second: 1h elapsed / 4h = 75% remaining = 4.5
    expect(calculateIOB(entries, now)).toBe(9.5);
  });

  it('returns full IOB for future dose', () => {
    const now = new Date('2026-03-20T09:00:00.000Z');
    const entries = [makeEntry({ administeredAt: '2026-03-20T10:00:00.000Z', units: 8 })];
    expect(calculateIOB(entries, now)).toBe(8);
  });

  it('returns 0 for empty array', () => {
    expect(calculateIOB([])).toBe(0);
  });

  it('supports half-unit precision', () => {
    const now = new Date('2026-03-20T10:00:00.000Z');
    const entries = [makeEntry({ administeredAt: '2026-03-20T10:00:00.000Z', units: 2.5 })];
    expect(calculateIOB(entries, now)).toBe(2.5);
  });
});

describe('getSuggestedSite', () => {
  it('returns null for empty array', () => {
    expect(getSuggestedSite([])).toBeNull();
  });

  it('returns the least recently used site', () => {
    const sites = [
      makeSite({ siteName: 'abdomen_left', lastUsedAt: '2026-03-20T10:00:00.000Z' }),
      makeSite({ siteName: 'thigh_right', lastUsedAt: '2026-03-16T10:00:00.000Z' }),
      makeSite({ siteName: 'arm_left', lastUsedAt: '2026-03-19T10:00:00.000Z' }),
    ];
    expect(getSuggestedSite(sites)).toBe('thigh_right');
  });
});

describe('getSiteRecency', () => {
  const now = new Date('2026-03-22T12:00:00.000Z');

  it('returns available for null', () => {
    expect(getSiteRecency(null, now)).toBe('available');
  });

  it('returns recent for today', () => {
    expect(getSiteRecency('2026-03-22T08:00:00.000Z', now)).toBe('recent');
  });

  it('returns moderate for 3 days ago', () => {
    expect(getSiteRecency('2026-03-19T12:00:00.000Z', now)).toBe('moderate');
  });

  it('returns available for 5+ days ago', () => {
    expect(getSiteRecency('2026-03-17T12:00:00.000Z', now)).toBe('available');
  });
});

describe('getDailyInsulinTotals', () => {
  it('returns empty array for no entries', () => {
    expect(getDailyInsulinTotals([])).toEqual([]);
  });

  it('groups entries by day with category breakdown', () => {
    const entries = [
      makeEntry({ administeredAt: '2026-03-20T08:00:00.000Z', units: 20, doseCategory: 'basal' }),
      makeEntry({ administeredAt: '2026-03-20T12:00:00.000Z', units: 5, doseCategory: 'bolus' }),
      makeEntry({ administeredAt: '2026-03-20T18:00:00.000Z', units: 8, doseCategory: 'bolus' }),
      makeEntry({ administeredAt: '2026-03-21T08:00:00.000Z', units: 20, doseCategory: 'basal' }),
    ];
    const totals = getDailyInsulinTotals(entries);
    expect(totals).toHaveLength(2);
    expect(totals[0].date).toBe('2026-03-20');
    expect(totals[0].basal).toBe(20);
    expect(totals[0].bolus).toBe(13);
    expect(totals[0].total).toBe(33);
    expect(totals[1].date).toBe('2026-03-21');
    expect(totals[1].basal).toBe(20);
    expect(totals[1].total).toBe(20);
  });
});

describe('calculateDailyAverage', () => {
  it('returns 0 for empty array', () => {
    expect(calculateDailyAverage([])).toBe(0);
  });

  it('calculates average correctly', () => {
    const totals = [
      { date: '2026-03-20', basal: 20, bolus: 10, correction: 0, mixed: 0, total: 30 },
      { date: '2026-03-21', basal: 20, bolus: 15, correction: 0, mixed: 0, total: 35 },
      { date: '2026-03-22', basal: 20, bolus: 5, correction: 0, mixed: 0, total: 25 },
    ];
    expect(calculateDailyAverage(totals)).toBe(30);
  });
});
