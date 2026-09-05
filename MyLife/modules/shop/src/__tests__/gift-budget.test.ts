import { describe, expect, it } from 'vitest';
import {
  getMyShare,
  getOverBudgetWarning,
  getRemainingBudget,
  summarizePersonSpending,
  type Gift,
  type GiftBudget,
} from '../index';

function makeGift(overrides: Partial<Gift> = {}): Gift {
  return {
    id: 'g1',
    personId: 'p1',
    personName: 'Mom',
    itemDescription: 'Scarf',
    occasion: 'birthday',
    occasionLabel: null,
    purchaseId: null,
    amountCents: 5000,
    giftDate: 0,
    reactionNotes: null,
    photoId: null,
    isGroupGift: false,
    groupTotalCents: null,
    myShareCents: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function makeBudget(overrides: Partial<GiftBudget> = {}): GiftBudget {
  return {
    id: 'b1',
    personId: 'p1',
    occasion: null,
    amountCents: 10000,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('getMyShare', () => {
  it('returns amount_cents for individual gifts', () => {
    expect(getMyShare(makeGift({ amountCents: 4500 }))).toBe(4500);
  });
  it('returns my_share_cents for group gifts', () => {
    expect(
      getMyShare(
        makeGift({ isGroupGift: true, amountCents: 30000, myShareCents: 5000 }),
      ),
    ).toBe(5000);
  });
  it('falls back to amount_cents when group gift lacks my_share', () => {
    expect(
      getMyShare(makeGift({ isGroupGift: true, amountCents: 8000, myShareCents: null })),
    ).toBe(8000);
  });
});

describe('getRemainingBudget', () => {
  it('returns 0 when no budget set', () => {
    expect(getRemainingBudget(null, [makeGift()])).toBe(0);
  });
  it('subtracts individual gift totals from budget', () => {
    const b = makeBudget({ amountCents: 10000 });
    const gifts = [makeGift({ amountCents: 3000 }), makeGift({ amountCents: 2500 })];
    expect(getRemainingBudget(b, gifts)).toBe(4500);
  });
  it('uses my_share for group gifts', () => {
    const b = makeBudget({ amountCents: 10000 });
    const gifts = [
      makeGift({
        isGroupGift: true,
        amountCents: 25000,
        myShareCents: 5000,
      }),
    ];
    expect(getRemainingBudget(b, gifts)).toBe(5000);
  });
  it('returns negative when overspent', () => {
    const b = makeBudget({ amountCents: 5000 });
    expect(getRemainingBudget(b, [makeGift({ amountCents: 8000 })])).toBe(-3000);
  });
});

describe('getOverBudgetWarning', () => {
  it('returns false defaults when no budget', () => {
    expect(getOverBudgetWarning(null, [])).toEqual({
      overBudget: false,
      overAmount: 0,
      percentage: 0,
    });
  });
  it('reports under-budget at correct percentage', () => {
    const b = makeBudget({ amountCents: 10000 });
    const w = getOverBudgetWarning(b, [makeGift({ amountCents: 4000 })]);
    expect(w.overBudget).toBe(false);
    expect(w.overAmount).toBe(0);
    expect(w.percentage).toBe(40);
  });
  it('reports over-budget with overAmount and percentage', () => {
    const b = makeBudget({ amountCents: 10000 });
    const w = getOverBudgetWarning(b, [
      makeGift({ amountCents: 8000 }),
      makeGift({ amountCents: 5000 }),
    ]);
    expect(w.overBudget).toBe(true);
    expect(w.overAmount).toBe(3000);
    expect(w.percentage).toBe(130);
  });
  it('handles zero-budget defensively', () => {
    expect(
      getOverBudgetWarning(makeBudget({ amountCents: 0 }), [
        makeGift({ amountCents: 100 }),
      ]),
    ).toEqual({ overBudget: false, overAmount: 0, percentage: 0 });
  });
});

describe('summarizePersonSpending', () => {
  it('aggregates totals, count, and per-occasion breakdown', () => {
    const summary = summarizePersonSpending([
      makeGift({ occasion: 'birthday', amountCents: 5000 }),
      makeGift({ occasion: 'holiday', amountCents: 3000 }),
      makeGift({
        occasion: 'birthday',
        isGroupGift: true,
        amountCents: 20000,
        myShareCents: 4000,
      }),
    ]);
    expect(summary.count).toBe(3);
    expect(summary.totalMyShare).toBe(5000 + 3000 + 4000);
    expect(summary.totalFaceValue).toBe(5000 + 3000 + 20000);
    expect(summary.byOccasion).toEqual({ birthday: 9000, holiday: 3000 });
  });
  it('returns zeros for empty list', () => {
    const s = summarizePersonSpending([]);
    expect(s).toEqual({
      totalMyShare: 0,
      totalFaceValue: 0,
      count: 0,
      byOccasion: {},
    });
  });
});
