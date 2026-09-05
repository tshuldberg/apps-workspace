import { describe, expect, it } from 'vitest';
import {
  getDaysUntilExpiry,
  getUpcomingExpiries,
  getWarrantyStatus,
  shouldRemindForWarranty,
  getExpiringReturnsMs,
  type Warranty,
} from '../index';
import type { Purchase } from '../index';

const DAY = 86_400_000;
const NOW = new Date('2026-04-21T00:00:00Z').getTime();

function mkWarranty(overrides: Partial<Warranty> = {}): Warranty {
  return {
    id: 'w1',
    purchaseId: null,
    itemName: 'Item',
    coverageType: 'manufacturer',
    startDate: NOW - 30 * DAY,
    expiryDate: NOW + 60 * DAY,
    coverageDetailsMd: null,
    serialNumber: null,
    registrationNumber: null,
    claimFiled: false,
    claimNotes: null,
    reminderDaysBefore: 30,
    createdAt: NOW - 30 * DAY,
    updatedAt: NOW - 30 * DAY,
    ...overrides,
  };
}

function mkPurchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: 'p1',
    name: 'Purchase',
    category: 'tech',
    priceCents: 10000,
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
    createdAt: '2026-04-01',
    updatedAt: '2026-04-01',
    ...overrides,
  };
}

describe('getDaysUntilExpiry', () => {
  it('returns positive days until expiry', () => {
    expect(getDaysUntilExpiry(NOW + 10 * DAY, NOW)).toBe(10);
  });

  it('returns negative when expired', () => {
    expect(getDaysUntilExpiry(NOW - 5 * DAY, NOW)).toBe(-5);
  });

  it('returns 0 on same day', () => {
    expect(getDaysUntilExpiry(NOW, NOW)).toBe(0);
  });
});

describe('getUpcomingExpiries', () => {
  const a = mkWarranty({ id: 'a', expiryDate: NOW + 3 * DAY });
  const b = mkWarranty({ id: 'b', expiryDate: NOW + 14 * DAY });
  const c = mkWarranty({ id: 'c', expiryDate: NOW + 50 * DAY });
  const expired = mkWarranty({ id: 'x', expiryDate: NOW - DAY });
  const far = mkWarranty({ id: 'f', expiryDate: NOW + 120 * DAY });

  it('7-day window returns only within 7 days', () => {
    const out = getUpcomingExpiries([a, b, c, expired, far], 7, NOW);
    expect(out.map((w) => w.id)).toEqual(['a']);
  });

  it('30-day window', () => {
    const out = getUpcomingExpiries([a, b, c, expired, far], 30, NOW);
    expect(out.map((w) => w.id)).toEqual(['a', 'b']);
  });

  it('60-day window', () => {
    const out = getUpcomingExpiries([a, b, c, expired, far], 60, NOW);
    expect(out.map((w) => w.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by soonest expiry first', () => {
    const out = getUpcomingExpiries([c, a, b], 60, NOW);
    expect(out.map((w) => w.id)).toEqual(['a', 'b', 'c']);
  });

  it('excludes already-expired warranties', () => {
    const out = getUpcomingExpiries([expired], 30, NOW);
    expect(out).toEqual([]);
  });

  it('returns empty for negative window', () => {
    expect(getUpcomingExpiries([a, b, c], -1, NOW)).toEqual([]);
  });

  it('includes expiry exactly equal to now', () => {
    const sameDay = mkWarranty({ id: 'same', expiryDate: NOW });
    const out = getUpcomingExpiries([sameDay], 1, NOW);
    expect(out.map((w) => w.id)).toEqual(['same']);
  });
});

describe('shouldRemindForWarranty', () => {
  it('reminds when within lead-time window', () => {
    const w = mkWarranty({
      expiryDate: NOW + 10 * DAY,
      reminderDaysBefore: 30,
    });
    expect(shouldRemindForWarranty(w, NOW)).toBe(true);
  });

  it('does not remind when beyond lead window', () => {
    const w = mkWarranty({
      expiryDate: NOW + 60 * DAY,
      reminderDaysBefore: 30,
    });
    expect(shouldRemindForWarranty(w, NOW)).toBe(false);
  });

  it('does not remind when expired', () => {
    const w = mkWarranty({
      expiryDate: NOW - DAY,
      reminderDaysBefore: 30,
    });
    expect(shouldRemindForWarranty(w, NOW)).toBe(false);
  });

  it('does not remind after claim filed', () => {
    const w = mkWarranty({
      expiryDate: NOW + 10 * DAY,
      claimFiled: true,
    });
    expect(shouldRemindForWarranty(w, NOW)).toBe(false);
  });

  it('reminds on same-day expiry', () => {
    const w = mkWarranty({
      expiryDate: NOW,
      reminderDaysBefore: 30,
    });
    expect(shouldRemindForWarranty(w, NOW)).toBe(true);
  });

  it('respects custom reminder_days_before', () => {
    const w = mkWarranty({
      expiryDate: NOW + 5 * DAY,
      reminderDaysBefore: 3,
    });
    expect(shouldRemindForWarranty(w, NOW)).toBe(false);
    expect(shouldRemindForWarranty(w, NOW + 2 * DAY)).toBe(true);
  });
});

describe('getExpiringReturns (3-day default)', () => {
  const pToday = mkPurchase({
    id: 'today',
    returnDeadline: '2026-04-21',
  });
  const p3d = mkPurchase({ id: '3d', returnDeadline: '2026-04-24' });
  const p10d = mkPurchase({ id: '10d', returnDeadline: '2026-05-01' });
  const pPast = mkPurchase({ id: 'past', returnDeadline: '2026-04-10' });
  const pReturned = mkPurchase({
    id: 'done',
    returnDeadline: '2026-04-22',
    returned: true,
  });
  const pNoDeadline = mkPurchase({ id: 'none', returnDeadline: null });

  it('defaults to 3-day window', () => {
    const out = getExpiringReturnsMs(
      [pToday, p3d, p10d, pPast, pReturned, pNoDeadline],
      undefined,
      NOW,
    );
    expect(out.map((p) => p.id)).toEqual(['today', '3d']);
  });

  it('explicit wider window', () => {
    const out = getExpiringReturnsMs([pToday, p3d, p10d], 14, NOW);
    expect(out.map((p) => p.id)).toEqual(['today', '3d', '10d']);
  });

  it('excludes returned + no-deadline + past', () => {
    const out = getExpiringReturnsMs(
      [pPast, pReturned, pNoDeadline],
      30,
      NOW,
    );
    expect(out).toEqual([]);
  });

  it('returns empty for negative window', () => {
    expect(getExpiringReturnsMs([pToday, p3d], -1, NOW)).toEqual([]);
  });
});

describe('getWarrantyStatus', () => {
  it('returns active for far-future expiry', () => {
    const w = mkWarranty({ expiryDate: NOW + 365 * DAY });
    expect(getWarrantyStatus(w, NOW)).toBe('active');
  });

  it('returns expiring-soon within 30 days', () => {
    const w = mkWarranty({ expiryDate: NOW + 15 * DAY });
    expect(getWarrantyStatus(w, NOW)).toBe('expiring-soon');
  });

  it('returns expiring-soon at exactly 30 days', () => {
    const w = mkWarranty({ expiryDate: NOW + 30 * DAY });
    expect(getWarrantyStatus(w, NOW)).toBe('expiring-soon');
  });

  it('returns expired for past expiry', () => {
    const w = mkWarranty({ expiryDate: NOW - DAY });
    expect(getWarrantyStatus(w, NOW)).toBe('expired');
  });

  it('returns claimed when claim_filed overrides other states', () => {
    const w = mkWarranty({ claimFiled: true, expiryDate: NOW + 10 * DAY });
    expect(getWarrantyStatus(w, NOW)).toBe('claimed');
  });
});
