import { describe, expect, it } from 'vitest';
import {
  calculateReturnDeadline,
  getExpiringReturns,
} from '../engine/return-deadline';
import type { Purchase } from '../models/schemas';

function purchase(overrides: Partial<Purchase>): Purchase {
  return {
    id: 'p',
    name: 'Widget',
    category: 'tech',
    priceCents: 1000,
    purchaseDate: '2026-01-01',
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
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('calculateReturnDeadline', () => {
  it('adds days within a month', () => {
    expect(calculateReturnDeadline('2026-04-01', 14)).toBe('2026-04-15');
  });

  it('crosses month boundary', () => {
    expect(calculateReturnDeadline('2026-01-20', 30)).toBe('2026-02-19');
  });

  it('crosses year boundary', () => {
    expect(calculateReturnDeadline('2026-12-20', 20)).toBe('2027-01-09');
  });

  it('handles leap day correctly (2028 is a leap year)', () => {
    expect(calculateReturnDeadline('2028-02-28', 1)).toBe('2028-02-29');
    expect(calculateReturnDeadline('2028-02-28', 2)).toBe('2028-03-01');
  });

  it('non-leap year skips Feb 29', () => {
    expect(calculateReturnDeadline('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('accepts ISO datetime input', () => {
    expect(calculateReturnDeadline('2026-01-20T14:00:00Z', 5)).toBe('2026-01-25');
  });

  it('rejects negative policyDays', () => {
    expect(() => calculateReturnDeadline('2026-01-01', -1)).toThrow();
  });

  it('zero policyDays yields the same date', () => {
    expect(calculateReturnDeadline('2026-01-15', 0)).toBe('2026-01-15');
  });

  it('rejects invalid date string', () => {
    expect(() => calculateReturnDeadline('not-a-date', 10)).toThrow();
  });
});

describe('getExpiringReturns', () => {
  it('returns purchases whose deadline is within the window and not returned', () => {
    const purchases = [
      purchase({ id: 'a', returnDeadline: '2026-04-25' }),
      purchase({ id: 'b', returnDeadline: '2026-04-30' }),
      purchase({ id: 'c', returnDeadline: '2026-05-30' }),
    ];
    const expiring = getExpiringReturns(purchases, 7, '2026-04-22');
    expect(expiring.map((p) => p.id).sort()).toEqual(['a']);
  });

  it('includes deadlines at exactly referenceDate + daysAhead', () => {
    const purchases = [purchase({ id: 'a', returnDeadline: '2026-04-29' })];
    const expiring = getExpiringReturns(purchases, 7, '2026-04-22');
    expect(expiring.map((p) => p.id)).toEqual(['a']);
  });

  it('excludes purchases with deadline before referenceDate', () => {
    const purchases = [purchase({ id: 'a', returnDeadline: '2026-04-01' })];
    const expiring = getExpiringReturns(purchases, 30, '2026-04-22');
    expect(expiring).toEqual([]);
  });

  it('excludes returned purchases', () => {
    const purchases = [
      purchase({ id: 'a', returnDeadline: '2026-04-25', returned: true }),
    ];
    expect(getExpiringReturns(purchases, 7, '2026-04-22')).toEqual([]);
  });

  it('excludes purchases without a deadline', () => {
    const purchases = [purchase({ id: 'a', returnDeadline: null })];
    expect(getExpiringReturns(purchases, 7, '2026-04-22')).toEqual([]);
  });

  it('returns empty when daysAhead is negative', () => {
    const purchases = [purchase({ id: 'a', returnDeadline: '2026-04-25' })];
    expect(getExpiringReturns(purchases, -1, '2026-04-22')).toEqual([]);
  });
});
