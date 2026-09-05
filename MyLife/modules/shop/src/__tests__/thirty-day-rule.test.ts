import { describe, expect, it } from 'vitest';
import {
  getDaysWaiting,
  getDaysRemaining,
  isReadyForDecision,
  getConversionRate,
  getTotalSavedBySkipping,
} from '../engine/thirty-day-rule';
import type { ThirtyDayRuleItem } from '../models/schemas';

const DAY = 24 * 60 * 60 * 1000;

function item(overrides: Partial<ThirtyDayRuleItem> = {}): ThirtyDayRuleItem {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    itemName: 'thing',
    priceCents: 5000,
    reasonMd: null,
    addedAt: 0,
    decision: 'waiting',
    decidedAt: null,
    purchaseId: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('getDaysWaiting', () => {
  it('returns 0 when added_at is in the future or now', () => {
    const now = 1_000_000_000_000;
    expect(getDaysWaiting({ addedAt: now }, now)).toBe(0);
    expect(getDaysWaiting({ addedAt: now + DAY }, now)).toBe(0);
  });

  it('returns whole days elapsed', () => {
    const now = 1_000_000_000_000;
    expect(getDaysWaiting({ addedAt: now - 5 * DAY }, now)).toBe(5);
    expect(getDaysWaiting({ addedAt: now - 5 * DAY - DAY / 2 }, now)).toBe(5);
  });

  it('accepts snake_case added_at field too', () => {
    const now = 1_000_000_000_000;
    expect(getDaysWaiting({ added_at: now - 3 * DAY }, now)).toBe(3);
  });
});

describe('getDaysRemaining', () => {
  it('counts down from default 30-day threshold', () => {
    const now = 1_000_000_000_000;
    expect(getDaysRemaining({ addedAt: now }, now)).toBe(30);
    expect(getDaysRemaining({ addedAt: now - 10 * DAY }, now)).toBe(20);
  });

  it('clamps to zero past the threshold', () => {
    const now = 1_000_000_000_000;
    expect(getDaysRemaining({ addedAt: now - 30 * DAY }, now)).toBe(0);
    expect(getDaysRemaining({ addedAt: now - 99 * DAY }, now)).toBe(0);
  });

  it('honors a custom threshold', () => {
    const now = 1_000_000_000_000;
    expect(getDaysRemaining({ addedAt: now - 5 * DAY }, now, 14)).toBe(9);
  });
});

describe('isReadyForDecision', () => {
  it('returns false for items already decided', () => {
    const now = 1_000_000_000_000;
    expect(
      isReadyForDecision(
        { addedAt: now - 60 * DAY, decision: 'bought' },
        now,
      ),
    ).toBe(false);
    expect(
      isReadyForDecision(
        { addedAt: now - 60 * DAY, decision: 'skipped' },
        now,
      ),
    ).toBe(false);
  });

  it('returns false when still waiting under threshold', () => {
    const now = 1_000_000_000_000;
    expect(
      isReadyForDecision(
        { addedAt: now - 5 * DAY, decision: 'waiting' },
        now,
      ),
    ).toBe(false);
  });

  it('returns true when waiting and threshold elapsed', () => {
    const now = 1_000_000_000_000;
    expect(
      isReadyForDecision(
        { addedAt: now - 30 * DAY, decision: 'waiting' },
        now,
      ),
    ).toBe(true);
    expect(
      isReadyForDecision(
        { addedAt: now - 45 * DAY, decision: 'waiting' },
        now,
      ),
    ).toBe(true);
  });

  it('honors a custom threshold for readiness', () => {
    const now = 1_000_000_000_000;
    expect(
      isReadyForDecision(
        { addedAt: now - 8 * DAY, decision: 'waiting' },
        now,
        7,
      ),
    ).toBe(true);
  });
});

describe('getConversionRate', () => {
  it('returns zero rates for empty input', () => {
    expect(getConversionRate([])).toEqual({
      decided: 0,
      bought: 0,
      skipped: 0,
      conversionRate: 0,
      skipRate: 0,
    });
  });

  it('ignores items still waiting', () => {
    const out = getConversionRate([
      item({ decision: 'waiting' }),
      item({ decision: 'waiting' }),
    ]);
    expect(out.decided).toBe(0);
    expect(out.conversionRate).toBe(0);
  });

  it('computes conversion and skip ratios', () => {
    const out = getConversionRate([
      item({ decision: 'bought' }),
      item({ decision: 'skipped' }),
      item({ decision: 'skipped' }),
      item({ decision: 'skipped' }),
      item({ decision: 'waiting' }),
    ]);
    expect(out.decided).toBe(4);
    expect(out.bought).toBe(1);
    expect(out.skipped).toBe(3);
    expect(out.conversionRate).toBe(0.25);
    expect(out.skipRate).toBe(0.75);
  });
});

describe('getTotalSavedBySkipping', () => {
  it('returns 0 for empty input', () => {
    expect(getTotalSavedBySkipping([])).toBe(0);
  });

  it('sums price_cents for skipped items only', () => {
    const out = getTotalSavedBySkipping([
      item({ decision: 'skipped', priceCents: 5000 }),
      item({ decision: 'skipped', priceCents: 12000 }),
      item({ decision: 'bought', priceCents: 99999 }),
      item({ decision: 'waiting', priceCents: 99999 }),
    ]);
    expect(out).toBe(17000);
  });
});
