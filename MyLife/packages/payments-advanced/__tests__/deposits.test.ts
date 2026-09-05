import { describe, it, expect } from 'vitest';
import { calculateDepositAmount, calculateApplicationFee, isAuthExpiringSoon } from '../src/deposits';

describe('calculateDepositAmount', () => {
  it('returns flat rate regardless of party size', () => {
    expect(calculateDepositAmount({ depositCents: 2500, perPerson: false, partySize: 4 })).toBe(2500);
  });

  it('returns flat rate for party of 1', () => {
    expect(calculateDepositAmount({ depositCents: 2500, perPerson: false, partySize: 1 })).toBe(2500);
  });

  it('multiplies by party size when perPerson is true', () => {
    expect(calculateDepositAmount({ depositCents: 2500, perPerson: true, partySize: 4 })).toBe(10000);
  });

  it('returns single deposit for party of 1 when perPerson', () => {
    expect(calculateDepositAmount({ depositCents: 2500, perPerson: true, partySize: 1 })).toBe(2500);
  });
});

describe('calculateApplicationFee', () => {
  it('always returns 100 cents ($1 booking fee)', () => {
    expect(calculateApplicationFee(2500)).toBe(100);
  });

  it('returns 100 regardless of deposit amount', () => {
    expect(calculateApplicationFee(10000)).toBe(100);
    expect(calculateApplicationFee(500)).toBe(100);
  });
});

describe('isAuthExpiringSoon', () => {
  it('returns true when authorization is about to expire (6 days ago, 7-day window)', () => {
    const sixDaysAgo = new Date(Date.now() - 6 * 86400000);
    expect(isAuthExpiringSoon(sixDaysAgo, 7)).toBe(true);
  });

  it('returns false when authorization was recent (1 day ago, 7-day window)', () => {
    const oneDayAgo = new Date(Date.now() - 1 * 86400000);
    expect(isAuthExpiringSoon(oneDayAgo, 7)).toBe(false);
  });

  it('returns true when already expired', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 86400000);
    expect(isAuthExpiringSoon(eightDaysAgo, 7)).toBe(true);
  });

  it('returns false when authorized just now', () => {
    const now = new Date();
    expect(isAuthExpiringSoon(now, 7)).toBe(false);
  });
});
