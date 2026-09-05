import { describe, expect, it } from 'vitest';
import {
  calculateDueReviews,
  scheduleReviewReminder,
} from '../engine/satisfaction-tracker';
import type { Purchase } from '../models/schemas';

function purchase(overrides: Partial<Purchase>): Purchase {
  return {
    id: 'p1',
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

describe('calculateDueReviews', () => {
  it('returns empty list when no windows have elapsed', () => {
    const p = purchase({ purchaseDate: '2026-04-20' });
    expect(calculateDueReviews([p], '2026-04-21')).toEqual([]);
  });

  it('flags 30day at exactly 30 days', () => {
    const p = purchase({ id: 'x', purchaseDate: '2026-01-01' });
    const due = calculateDueReviews([p], '2026-01-31');
    expect(due).toEqual([{ purchaseId: 'x', period: '30day' }]);
  });

  it('does not flag 30day at 29 days', () => {
    const p = purchase({ id: 'x', purchaseDate: '2026-01-01' });
    const due = calculateDueReviews([p], '2026-01-30');
    expect(due).toEqual([]);
  });

  it('flags both 30day and 90day once 90 days elapse and neither rated', () => {
    const p = purchase({ id: 'x', purchaseDate: '2026-01-01' });
    const due = calculateDueReviews([p], '2026-04-01');
    expect(due).toEqual([
      { purchaseId: 'x', period: '30day' },
      { purchaseId: 'x', period: '90day' },
    ]);
  });

  it('excludes already-rated 30day', () => {
    const p = purchase({
      id: 'x',
      purchaseDate: '2026-01-01',
      satisfaction30day: 4,
    });
    const due = calculateDueReviews([p], '2026-04-01');
    expect(due).toEqual([{ purchaseId: 'x', period: '90day' }]);
  });

  it('excludes returned purchases entirely', () => {
    const p = purchase({ purchaseDate: '2026-01-01', returned: true });
    expect(calculateDueReviews([p], '2026-04-01')).toEqual([]);
  });

  it('handles multiple purchases', () => {
    const purchases = [
      purchase({ id: 'a', purchaseDate: '2026-01-01' }),
      purchase({ id: 'b', purchaseDate: '2026-04-15' }),
      purchase({
        id: 'c',
        purchaseDate: '2026-01-01',
        satisfaction30day: 5,
        satisfaction90day: 5,
      }),
    ];
    const due = calculateDueReviews(purchases, '2026-04-21');
    const ids = due.map((d) => `${d.purchaseId}:${d.period}`);
    expect(ids.sort()).toEqual(['a:30day', 'a:90day']);
  });
});

describe('scheduleReviewReminder', () => {
  it('schedules 30day reminder at purchase_date + 30', () => {
    const r = scheduleReviewReminder(
      { id: 'p1', name: 'AirPods', purchaseDate: '2026-01-01' },
      '30day',
    );
    expect(r.dueDate).toBe('2026-01-31');
    expect(r.purchaseId).toBe('p1');
    expect(r.period).toBe('30day');
    expect(r.title).toContain('AirPods');
    expect(r.body).toContain('30 days');
  });

  it('schedules 90day reminder at purchase_date + 90', () => {
    const r = scheduleReviewReminder(
      { id: 'p1', name: 'Chair', purchaseDate: '2026-01-01' },
      '90day',
    );
    expect(r.dueDate).toBe('2026-04-01');
    expect(r.body).toContain('90 days');
  });
});
