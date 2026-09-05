import { describe, expect, it } from 'vitest';
import {
  getImpulseStats,
  getImpulseRegretRate,
  getTopImpulseCategories,
} from '../engine/impulse-tracker';
import type { Purchase } from '../models/schemas';

function purchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    name: 'item',
    category: 'tech',
    priceCents: 1000,
    purchaseDate: '2026-04-01',
    store: null,
    paymentMethod: null,
    brand: null,
    url: null,
    receiptPhotoId: null,
    satisfactionInitial: null,
    satisfaction30day: null,
    satisfaction90day: null,
    isImpulse: false,
    researchNotesMd: null,
    returnDeadline: null,
    returned: false,
    returnReason: null,
    wishlistItemId: null,
    notesMd: null,
    photoId: null,
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

describe('getImpulseStats', () => {
  it('returns zeros for empty input', () => {
    expect(getImpulseStats([])).toEqual({
      impulseCount: 0,
      impulseCents: 0,
      plannedCount: 0,
      plannedCents: 0,
      impulsePercentage: 0,
    });
  });

  it('rolls up impulse vs planned', () => {
    const out = getImpulseStats([
      purchase({ isImpulse: true, priceCents: 5000 }),
      purchase({ isImpulse: true, priceCents: 2500 }),
      purchase({ isImpulse: false, priceCents: 10000 }),
    ]);
    expect(out.impulseCount).toBe(2);
    expect(out.impulseCents).toBe(7500);
    expect(out.plannedCount).toBe(1);
    expect(out.plannedCents).toBe(10000);
    expect(out.impulsePercentage).toBe(67);
  });

  it('respects fromMs / toMs range filters', () => {
    const out = getImpulseStats(
      [
        purchase({ purchaseDate: '2026-01-15', isImpulse: true, priceCents: 100 }),
        purchase({ purchaseDate: '2026-03-15', isImpulse: true, priceCents: 200 }),
        purchase({ purchaseDate: '2026-05-15', isImpulse: false, priceCents: 300 }),
      ],
      {
        fromMs: Date.parse('2026-02-01'),
        toMs: Date.parse('2026-04-30'),
      },
    );
    expect(out.impulseCount).toBe(1);
    expect(out.impulseCents).toBe(200);
    expect(out.plannedCount).toBe(0);
  });

  it('handles a single planned purchase', () => {
    const out = getImpulseStats([purchase({ isImpulse: false, priceCents: 1234 })]);
    expect(out.impulsePercentage).toBe(0);
    expect(out.plannedCents).toBe(1234);
  });
});

describe('getImpulseRegretRate', () => {
  it('returns zero for empty', () => {
    expect(getImpulseRegretRate([])).toEqual({
      totalImpulse: 0,
      regretted: 0,
      regretRate: 0,
    });
  });

  it('uses 90-day satisfaction when present', () => {
    const out = getImpulseRegretRate([
      purchase({ isImpulse: true, satisfaction90day: 2 }),
      purchase({ isImpulse: true, satisfaction90day: 5 }),
    ]);
    expect(out.totalImpulse).toBe(2);
    expect(out.regretted).toBe(1);
    expect(out.regretRate).toBe(0.5);
  });

  it('falls back to 30-day then initial when later periods missing', () => {
    const out = getImpulseRegretRate([
      purchase({ isImpulse: true, satisfaction30day: 1 }),
      purchase({ isImpulse: true, satisfactionInitial: 2 }),
      purchase({ isImpulse: true, satisfactionInitial: 4 }),
    ]);
    expect(out.regretted).toBe(2);
    expect(out.totalImpulse).toBe(3);
  });

  it('does not count impulse purchases without any satisfaction rating', () => {
    const out = getImpulseRegretRate([
      purchase({ isImpulse: true }),
      purchase({ isImpulse: true, satisfactionInitial: 1 }),
    ]);
    expect(out.totalImpulse).toBe(2);
    expect(out.regretted).toBe(1);
    expect(out.regretRate).toBe(0.5);
  });

  it('ignores planned purchases entirely', () => {
    const out = getImpulseRegretRate([
      purchase({ isImpulse: false, satisfactionInitial: 1 }),
    ]);
    expect(out.totalImpulse).toBe(0);
    expect(out.regretRate).toBe(0);
  });
});

describe('getTopImpulseCategories', () => {
  it('returns empty for no impulse purchases', () => {
    expect(getTopImpulseCategories([])).toEqual([]);
  });

  it('groups by category, sorted by count DESC', () => {
    const rows = getTopImpulseCategories([
      purchase({ isImpulse: true, category: 'tech', priceCents: 500 }),
      purchase({ isImpulse: true, category: 'tech', priceCents: 700 }),
      purchase({ isImpulse: true, category: 'clothing', priceCents: 300 }),
      purchase({ isImpulse: false, category: 'home' }),
    ]);
    expect(rows).toEqual([
      { category: 'tech', count: 2, totalCents: 1200 },
      { category: 'clothing', count: 1, totalCents: 300 },
    ]);
  });

  it('honors the limit parameter', () => {
    const rows = getTopImpulseCategories(
      [
        purchase({ isImpulse: true, category: 'tech' }),
        purchase({ isImpulse: true, category: 'clothing' }),
        purchase({ isImpulse: true, category: 'home' }),
      ],
      2,
    );
    expect(rows).toHaveLength(2);
  });

  it('breaks ties by totalCents DESC then category ASC', () => {
    const rows = getTopImpulseCategories([
      purchase({ isImpulse: true, category: 'home', priceCents: 100 }),
      purchase({ isImpulse: true, category: 'books', priceCents: 100 }),
      purchase({ isImpulse: true, category: 'tech', priceCents: 200 }),
    ]);
    expect(rows[0]!.category).toBe('tech');
    expect(rows[1]!.category).toBe('books');
    expect(rows[2]!.category).toBe('home');
  });
});
