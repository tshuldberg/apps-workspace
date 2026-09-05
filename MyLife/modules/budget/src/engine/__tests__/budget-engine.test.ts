/**
 * Tests for budget engine pure calculation functions.
 *
 * Adapted from standalone MyBudget budget-engine tests to match the hub's
 * flattened MonthBudgetInput API where categories carry inline allocated,
 * activity, and carryForward values.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateMonthBudget,
  getCarryForward,
  getTotalOverspent,
  moveMoneyBetweenCategories,
  type MonthBudgetInput,
  type MonthBudgetState,
} from '../budget';

// --- helpers ---

function cat(id: string, name: string, allocated = 0, activity = 0, carryForward = 0) {
  return { categoryId: id, name, allocated, activity, carryForward };
}

function buildInput(overrides: Partial<MonthBudgetInput> = {}): MonthBudgetInput {
  return {
    month: '2026-02',
    totalIncome: 0,
    groups: [
      {
        groupId: 'g1',
        name: 'Fixed',
        categories: [
          cat('c-rent', 'Rent'),
          cat('c-util', 'Utilities'),
        ],
      },
      {
        groupId: 'g2',
        name: 'Variable',
        categories: [
          cat('c-groc', 'Groceries'),
          cat('c-fun', 'Fun'),
        ],
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateMonthBudget
// ---------------------------------------------------------------------------

describe('calculateMonthBudget', () => {
  it('returns zero state when no income', () => {
    const state = calculateMonthBudget(buildInput());
    expect(state.readyToAssign).toBe(0);
    expect(state.totalAllocated).toBe(0);
    expect(state.totalActivity).toBe(0);
    expect(state.overspent).toBe(0);
  });

  it('readyToAssign equals income when nothing allocated', () => {
    const state = calculateMonthBudget(buildInput({ totalIncome: 500000 }));
    expect(state.readyToAssign).toBe(500000);
  });

  it('allocations reduce readyToAssign', () => {
    const state = calculateMonthBudget(buildInput({
      totalIncome: 500000,
      groups: [
        {
          groupId: 'g1', name: 'Fixed',
          categories: [
            cat('c-rent', 'Rent', 180000),
            cat('c-util', 'Utilities'),
          ],
        },
        {
          groupId: 'g2', name: 'Variable',
          categories: [
            cat('c-groc', 'Groceries', 60000),
            cat('c-fun', 'Fun'),
          ],
        },
      ],
    }));
    expect(state.readyToAssign).toBe(260000);
    expect(state.totalAllocated).toBe(240000);
  });

  it('activity reflects spending', () => {
    const state = calculateMonthBudget(buildInput({
      totalIncome: 500000,
      groups: [
        {
          groupId: 'g1', name: 'Fixed',
          categories: [cat('c-rent', 'Rent'), cat('c-util', 'Utilities')],
        },
        {
          groupId: 'g2', name: 'Variable',
          categories: [
            cat('c-groc', 'Groceries', 60000, -35000),
            cat('c-fun', 'Fun'),
          ],
        },
      ],
    }));

    const groc = state.groups
      .flatMap((g) => g.categories)
      .find((c) => c.categoryId === 'c-groc')!;
    expect(groc.allocated).toBe(60000);
    expect(groc.activity).toBe(-35000);
    expect(groc.available).toBe(25000);
  });

  it('carryForward adds to available', () => {
    const state = calculateMonthBudget(buildInput({
      totalIncome: 500000,
      groups: [
        {
          groupId: 'g1', name: 'Fixed',
          categories: [cat('c-rent', 'Rent'), cat('c-util', 'Utilities')],
        },
        {
          groupId: 'g2', name: 'Variable',
          categories: [
            cat('c-groc', 'Groceries', 60000, 0, 10000),
            cat('c-fun', 'Fun'),
          ],
        },
      ],
    }));

    const groc = state.groups
      .flatMap((g) => g.categories)
      .find((c) => c.categoryId === 'c-groc')!;
    expect(groc.carryForward).toBe(10000);
    expect(groc.available).toBe(70000);
  });

  it('over-allocation produces negative readyToAssign', () => {
    const state = calculateMonthBudget(buildInput({
      totalIncome: 100000,
      groups: [
        {
          groupId: 'g1', name: 'Fixed',
          categories: [cat('c-rent', 'Rent', 180000), cat('c-util', 'Utilities')],
        },
        {
          groupId: 'g2', name: 'Variable',
          categories: [cat('c-groc', 'Groceries'), cat('c-fun', 'Fun')],
        },
      ],
    }));
    expect(state.readyToAssign).toBe(-80000);
  });

  it('negative available when overspent', () => {
    const state = calculateMonthBudget(buildInput({
      totalIncome: 500000,
      groups: [
        {
          groupId: 'g1', name: 'Fixed',
          categories: [cat('c-rent', 'Rent'), cat('c-util', 'Utilities')],
        },
        {
          groupId: 'g2', name: 'Variable',
          categories: [
            cat('c-groc', 'Groceries'),
            cat('c-fun', 'Fun', 20000, -30000),
          ],
        },
      ],
    }));

    const fun = state.groups
      .flatMap((g) => g.categories)
      .find((c) => c.categoryId === 'c-fun')!;
    expect(fun.available).toBe(-10000);
    expect(state.overspent).toBe(10000);
  });

  it('computes per-group totals', () => {
    const state = calculateMonthBudget(buildInput({
      totalIncome: 500000,
      groups: [
        {
          groupId: 'g1', name: 'Fixed',
          categories: [cat('c-rent', 'Rent', 180000), cat('c-util', 'Utilities', 15000)],
        },
        {
          groupId: 'g2', name: 'Variable',
          categories: [cat('c-groc', 'Groceries', 60000), cat('c-fun', 'Fun')],
        },
      ],
    }));

    const fixed = state.groups.find((g) => g.groupId === 'g1')!;
    expect(fixed.allocated).toBe(195000);

    const variable = state.groups.find((g) => g.groupId === 'g2')!;
    expect(variable.allocated).toBe(60000);
  });

  it('totalActivity sums all category activity', () => {
    const state = calculateMonthBudget(buildInput({
      totalIncome: 500000,
      groups: [
        {
          groupId: 'g1', name: 'Fixed',
          categories: [cat('c-rent', 'Rent'), cat('c-util', 'Utilities')],
        },
        {
          groupId: 'g2', name: 'Variable',
          categories: [
            cat('c-groc', 'Groceries', 60000, -35000),
            cat('c-fun', 'Fun', 20000, -15000),
          ],
        },
      ],
    }));
    expect(state.totalActivity).toBe(-50000);
  });

  it('inflow increases category available', () => {
    const state = calculateMonthBudget(buildInput({
      totalIncome: 500000,
      groups: [
        {
          groupId: 'g1', name: 'Fixed',
          categories: [cat('c-rent', 'Rent'), cat('c-util', 'Utilities')],
        },
        {
          groupId: 'g2', name: 'Variable',
          categories: [
            cat('c-groc', 'Groceries', 60000, 5000),
            cat('c-fun', 'Fun'),
          ],
        },
      ],
    }));

    const groc = state.groups
      .flatMap((g) => g.categories)
      .find((c) => c.categoryId === 'c-groc')!;
    expect(groc.available).toBe(65000);
  });
});

// ---------------------------------------------------------------------------
// getCarryForward
// ---------------------------------------------------------------------------

describe('getCarryForward', () => {
  it('returns positive available as carry-forward', () => {
    expect(getCarryForward(25000)).toBe(25000);
  });

  it('returns zero for negative available (YNAB-style reset)', () => {
    expect(getCarryForward(-10000)).toBe(0);
  });

  it('returns zero for exactly zero', () => {
    expect(getCarryForward(0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getTotalOverspent
// ---------------------------------------------------------------------------

describe('getTotalOverspent', () => {
  it('returns overspent amount from state', () => {
    const state = calculateMonthBudget(buildInput({
      totalIncome: 500000,
      groups: [
        {
          groupId: 'g1', name: 'Fixed',
          categories: [cat('c-rent', 'Rent'), cat('c-util', 'Utilities')],
        },
        {
          groupId: 'g2', name: 'Variable',
          categories: [
            cat('c-groc', 'Groceries', 60000, -70000),
            cat('c-fun', 'Fun', 20000, -25000),
          ],
        },
      ],
    }));

    expect(getTotalOverspent(state)).toBe(15000);
  });

  it('returns 0 when nothing overspent', () => {
    const state = calculateMonthBudget(buildInput({
      totalIncome: 500000,
      groups: [
        {
          groupId: 'g1', name: 'Fixed',
          categories: [cat('c-rent', 'Rent'), cat('c-util', 'Utilities')],
        },
        {
          groupId: 'g2', name: 'Variable',
          categories: [
            cat('c-groc', 'Groceries', 60000, -30000),
            cat('c-fun', 'Fun'),
          ],
        },
      ],
    }));

    expect(getTotalOverspent(state)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// moveMoneyBetweenCategories
// ---------------------------------------------------------------------------

describe('moveMoneyBetweenCategories', () => {
  function makeState(): MonthBudgetState {
    return calculateMonthBudget(buildInput({
      totalIncome: 500000,
      groups: [
        {
          groupId: 'g1', name: 'Fixed',
          categories: [cat('c-rent', 'Rent', 180000), cat('c-util', 'Utilities', 15000)],
        },
        {
          groupId: 'g2', name: 'Variable',
          categories: [
            cat('c-groc', 'Groceries', 60000),
            cat('c-fun', 'Fun', 20000),
          ],
        },
      ],
    }));
  }

  it('moves money from one category to another', () => {
    const state = makeState();
    const moved = moveMoneyBetweenCategories(state, 'c-fun', 'c-groc', 5000);

    const fun = moved.groups.flatMap((g) => g.categories).find((c) => c.categoryId === 'c-fun')!;
    const groc = moved.groups.flatMap((g) => g.categories).find((c) => c.categoryId === 'c-groc')!;
    expect(fun.available).toBe(15000);
    expect(groc.available).toBe(65000);
  });

  it('does not modify the original state', () => {
    const state = makeState();
    const moved = moveMoneyBetweenCategories(state, 'c-fun', 'c-groc', 5000);

    const origFun = state.groups.flatMap((g) => g.categories).find((c) => c.categoryId === 'c-fun')!;
    const movedFun = moved.groups.flatMap((g) => g.categories).find((c) => c.categoryId === 'c-fun')!;
    expect(origFun.available).toBe(20000);
    expect(movedFun.available).toBe(15000);
  });

  it('returns same state for zero amount', () => {
    const state = makeState();
    const moved = moveMoneyBetweenCategories(state, 'c-fun', 'c-groc', 0);
    expect(moved).toBe(state);
  });

  it('allows over-move resulting in negative available', () => {
    const state = makeState();
    const moved = moveMoneyBetweenCategories(state, 'c-fun', 'c-groc', 100000);

    const fun = moved.groups.flatMap((g) => g.categories).find((c) => c.categoryId === 'c-fun')!;
    expect(fun.available).toBe(-80000);
    expect(moved.overspent).toBe(80000);
  });

  it('preserves total allocated', () => {
    const state = makeState();
    const moved = moveMoneyBetweenCategories(state, 'c-fun', 'c-groc', 5000);
    expect(moved.totalAllocated).toBe(state.totalAllocated);
  });
});
