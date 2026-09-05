/**
 * Integration test: full budget cycle.
 *
 * Exercises the complete flow from income -> allocation -> spending -> carry-forward
 * using the budget engine's pure calculation functions. Validates that all pieces
 * compose correctly end-to-end.
 *
 * Adapted from standalone MyBudget to match the hub's flattened MonthBudgetInput
 * API where categories carry inline allocated, activity, and carryForward values.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateMonthBudget,
  getCarryForward,
  getTotalOverspent,
  moveMoneyBetweenCategories,
} from '../engine/budget';
import type { MonthBudgetInput } from '../engine/budget';

// --- helpers ---

function cat(
  id: string,
  name: string,
  allocated = 0,
  activity = 0,
  carryForward = 0,
) {
  return { categoryId: id, name, allocated, activity, carryForward };
}

const BILLS = 'g-bills';
const EVERYDAY = 'g-everyday';
const GOALS = 'g-goals';

function makeInput(overrides: Partial<MonthBudgetInput> = {}): MonthBudgetInput {
  return {
    month: '2026-02',
    totalIncome: 0,
    groups: [
      {
        groupId: BILLS,
        name: 'Bills',
        categories: [
          cat('c-rent', 'Rent'),
          cat('c-utilities', 'Utilities'),
        ],
      },
      {
        groupId: EVERYDAY,
        name: 'Everyday',
        categories: [
          cat('c-groceries', 'Groceries'),
          cat('c-dining', 'Dining Out'),
          cat('c-transport', 'Transportation'),
        ],
      },
      {
        groupId: GOALS,
        name: 'Goals',
        categories: [cat('c-savings', 'Emergency Fund')],
      },
    ],
    ...overrides,
  };
}

/** Helper to find a category by ID in state output. */
function findCat(
  state: ReturnType<typeof calculateMonthBudget>,
  id: string,
) {
  return state.groups
    .flatMap((g) => g.categories)
    .find((c) => c.categoryId === id)!;
}

/**
 * Build carry-forward values from a computed month state.
 * Mirrors the hub's per-category getCarryForward(available) pattern.
 */
function buildCarryForwards(
  state: ReturnType<typeof calculateMonthBudget>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const g of state.groups) {
    for (const c of g.categories) {
      const cf = getCarryForward(c.available);
      if (cf !== 0) {
        map.set(c.categoryId, cf);
      }
    }
  }
  return map;
}

describe('Full budget cycle integration', () => {
  it('Step 1: Income flows into Ready to Assign', () => {
    const state = calculateMonthBudget(makeInput({ totalIncome: 500000 }));

    expect(state.readyToAssign).toBe(500000);
    expect(state.totalAllocated).toBe(0);
    expect(state.totalActivity).toBe(0);
  });

  it('Step 2: Allocations reduce Ready to Assign', () => {
    const state = calculateMonthBudget(makeInput({
      totalIncome: 500000,
      groups: [
        {
          groupId: BILLS,
          name: 'Bills',
          categories: [
            cat('c-rent', 'Rent', 180000),
            cat('c-utilities', 'Utilities'),
          ],
        },
        {
          groupId: EVERYDAY,
          name: 'Everyday',
          categories: [
            cat('c-groceries', 'Groceries', 50000),
            cat('c-dining', 'Dining Out', 20000),
            cat('c-transport', 'Transportation'),
          ],
        },
        {
          groupId: GOALS,
          name: 'Goals',
          categories: [cat('c-savings', 'Emergency Fund', 50000)],
        },
      ],
    }));

    expect(state.totalAllocated).toBe(300000);
    expect(state.readyToAssign).toBe(200000);
  });

  it('Step 3: Spending reduces category available', () => {
    const state = calculateMonthBudget(makeInput({
      totalIncome: 500000,
      groups: [
        {
          groupId: BILLS,
          name: 'Bills',
          categories: [
            cat('c-rent', 'Rent', 180000),
            cat('c-utilities', 'Utilities'),
          ],
        },
        {
          groupId: EVERYDAY,
          name: 'Everyday',
          categories: [
            cat('c-groceries', 'Groceries', 50000, -31200),
            cat('c-dining', 'Dining Out', 20000, -7800),
            cat('c-transport', 'Transportation'),
          ],
        },
        {
          groupId: GOALS,
          name: 'Goals',
          categories: [cat('c-savings', 'Emergency Fund', 50000)],
        },
      ],
    }));

    expect(findCat(state, 'c-groceries').available).toBe(18800);
    expect(findCat(state, 'c-dining').available).toBe(12200);
    expect(findCat(state, 'c-rent').available).toBe(180000);
    expect(state.overspent).toBe(0);
  });

  it('Step 4: Carry-forward from month 1 to month 2', () => {
    // Month 1: allocate and spend
    const month1 = calculateMonthBudget(makeInput({
      totalIncome: 500000,
      groups: [
        {
          groupId: BILLS,
          name: 'Bills',
          categories: [
            cat('c-rent', 'Rent', 180000),
            cat('c-utilities', 'Utilities'),
          ],
        },
        {
          groupId: EVERYDAY,
          name: 'Everyday',
          categories: [
            cat('c-groceries', 'Groceries', 50000, -31200),
            cat('c-dining', 'Dining Out', 20000, -7800),
            cat('c-transport', 'Transportation'),
          ],
        },
        {
          groupId: GOALS,
          name: 'Goals',
          categories: [cat('c-savings', 'Emergency Fund', 50000)],
        },
      ],
    }));

    // Verify month 1 carry-forward values
    const cf = buildCarryForwards(month1);
    expect(cf.get('c-groceries')).toBe(18800);
    expect(cf.get('c-dining')).toBe(12200);
    expect(cf.get('c-rent')).toBe(180000);
    expect(cf.get('c-savings')).toBe(50000);
    expect(getTotalOverspent(month1)).toBe(0);

    // Month 2: same allocations, with carry-forward from month 1
    const month2 = calculateMonthBudget({
      month: '2026-03',
      totalIncome: 500000,
      groups: [
        {
          groupId: BILLS,
          name: 'Bills',
          categories: [
            cat('c-rent', 'Rent', 180000, 0, cf.get('c-rent') ?? 0),
            cat('c-utilities', 'Utilities'),
          ],
        },
        {
          groupId: EVERYDAY,
          name: 'Everyday',
          categories: [
            cat('c-groceries', 'Groceries', 50000, 0, cf.get('c-groceries') ?? 0),
            cat('c-dining', 'Dining Out', 20000, 0, cf.get('c-dining') ?? 0),
            cat('c-transport', 'Transportation'),
          ],
        },
        {
          groupId: GOALS,
          name: 'Goals',
          categories: [cat('c-savings', 'Emergency Fund', 50000, 0, cf.get('c-savings') ?? 0)],
        },
      ],
    });

    expect(findCat(month2, 'c-groceries').carryForward).toBe(18800);
    expect(findCat(month2, 'c-groceries').allocated).toBe(50000);
    expect(findCat(month2, 'c-groceries').available).toBe(68800); // 18800 + 50000

    expect(findCat(month2, 'c-dining').carryForward).toBe(12200);
    expect(findCat(month2, 'c-dining').available).toBe(32200); // 12200 + 20000

    expect(findCat(month2, 'c-savings').available).toBe(100000); // 50000 + 50000
  });

  it('Step 5: Multi-month chain with spending in month 2', () => {
    const month1 = calculateMonthBudget(makeInput({
      totalIncome: 500000,
      groups: [
        {
          groupId: BILLS,
          name: 'Bills',
          categories: [
            cat('c-rent', 'Rent', 180000, -180000),
            cat('c-utilities', 'Utilities'),
          ],
        },
        {
          groupId: EVERYDAY,
          name: 'Everyday',
          categories: [
            cat('c-groceries', 'Groceries', 50000, -31200),
            cat('c-dining', 'Dining Out', 20000, -7800),
            cat('c-transport', 'Transportation'),
          ],
        },
        {
          groupId: GOALS,
          name: 'Goals',
          categories: [cat('c-savings', 'Emergency Fund', 50000)],
        },
      ],
    }));

    const cf1 = buildCarryForwards(month1);

    const month2 = calculateMonthBudget({
      month: '2026-03',
      totalIncome: 500000,
      groups: [
        {
          groupId: BILLS,
          name: 'Bills',
          categories: [
            cat('c-rent', 'Rent', 180000, -180000, cf1.get('c-rent') ?? 0),
            cat('c-utilities', 'Utilities'),
          ],
        },
        {
          groupId: EVERYDAY,
          name: 'Everyday',
          categories: [
            cat('c-groceries', 'Groceries', 50000, -45000, cf1.get('c-groceries') ?? 0),
            cat('c-dining', 'Dining Out', 20000, -15000, cf1.get('c-dining') ?? 0),
            cat('c-transport', 'Transportation'),
          ],
        },
        {
          groupId: GOALS,
          name: 'Goals',
          categories: [cat('c-savings', 'Emergency Fund', 50000, 0, cf1.get('c-savings') ?? 0)],
        },
      ],
    });

    // Groceries: cf=18800 + alloc=50000 + activity=-45000 = 23800
    expect(findCat(month2, 'c-groceries').available).toBe(23800);
    // Rent: cf=0 (fully spent in month1) + 180000 - 180000 = 0
    expect(findCat(month2, 'c-rent').available).toBe(0);
    // Dining: cf=12200 + 20000 - 15000 = 17200
    expect(findCat(month2, 'c-dining').available).toBe(17200);
    // Savings: cf=50000 + 50000 = 100000
    expect(findCat(month2, 'c-savings').available).toBe(100000);
  });

  it('Overspending produces negative available', () => {
    const month1 = calculateMonthBudget(makeInput({
      totalIncome: 500000,
      groups: [
        {
          groupId: BILLS,
          name: 'Bills',
          categories: [cat('c-rent', 'Rent'), cat('c-utilities', 'Utilities')],
        },
        {
          groupId: EVERYDAY,
          name: 'Everyday',
          categories: [
            cat('c-groceries', 'Groceries'),
            cat('c-dining', 'Dining Out', 20000, -28000),
            cat('c-transport', 'Transportation'),
          ],
        },
        {
          groupId: GOALS,
          name: 'Goals',
          categories: [cat('c-savings', 'Emergency Fund')],
        },
      ],
    }));

    expect(findCat(month1, 'c-dining').available).toBe(-8000);
    expect(month1.overspent).toBe(8000);

    // YNAB-style: overspent categories reset to 0 carry-forward
    const diningCf = getCarryForward(findCat(month1, 'c-dining').available);
    expect(diningCf).toBe(0);
  });

  it('Move money between categories adjusts allocations', () => {
    const state = calculateMonthBudget(makeInput({
      totalIncome: 500000,
      groups: [
        {
          groupId: BILLS,
          name: 'Bills',
          categories: [cat('c-rent', 'Rent'), cat('c-utilities', 'Utilities')],
        },
        {
          groupId: EVERYDAY,
          name: 'Everyday',
          categories: [
            cat('c-groceries', 'Groceries', 50000),
            cat('c-dining', 'Dining Out', 20000),
            cat('c-transport', 'Transportation'),
          ],
        },
        {
          groupId: GOALS,
          name: 'Goals',
          categories: [cat('c-savings', 'Emergency Fund')],
        },
      ],
    }));

    const moved = moveMoneyBetweenCategories(state, 'c-dining', 'c-groceries', 5000);

    expect(findCat(moved, 'c-dining').available).toBe(15000);
    expect(findCat(moved, 'c-groceries').available).toBe(55000);
    // Total allocated unchanged
    expect(moved.totalAllocated).toBe(state.totalAllocated);
  });

  it('Over-allocation produces negative Ready to Assign', () => {
    const state = calculateMonthBudget(makeInput({
      totalIncome: 500000,
      groups: [
        {
          groupId: BILLS,
          name: 'Bills',
          categories: [
            cat('c-rent', 'Rent', 180000),
            cat('c-utilities', 'Utilities', 15000),
          ],
        },
        {
          groupId: EVERYDAY,
          name: 'Everyday',
          categories: [
            cat('c-groceries', 'Groceries', 50000),
            cat('c-dining', 'Dining Out', 20000),
            cat('c-transport', 'Transportation', 10000),
          ],
        },
        {
          groupId: GOALS,
          name: 'Goals',
          categories: [cat('c-savings', 'Emergency Fund', 300000)],
        },
      ],
    }));

    expect(state.totalAllocated).toBe(575000);
    expect(state.readyToAssign).toBe(-75000);
  });

  it('Zero income month with only carry-forward', () => {
    const state = calculateMonthBudget({
      month: '2026-03',
      totalIncome: 0,
      groups: [
        {
          groupId: BILLS,
          name: 'Bills',
          categories: [cat('c-rent', 'Rent'), cat('c-utilities', 'Utilities')],
        },
        {
          groupId: EVERYDAY,
          name: 'Everyday',
          categories: [
            cat('c-groceries', 'Groceries', 0, 0, 18800),
            cat('c-dining', 'Dining Out', 0, 0, 12200),
            cat('c-transport', 'Transportation'),
          ],
        },
        {
          groupId: GOALS,
          name: 'Goals',
          categories: [cat('c-savings', 'Emergency Fund')],
        },
      ],
    });

    expect(state.readyToAssign).toBe(0);
    expect(findCat(state, 'c-groceries').available).toBe(18800);
    expect(findCat(state, 'c-dining').available).toBe(12200);
  });

  it('Inflow (refund) increases category available', () => {
    const state = calculateMonthBudget(makeInput({
      totalIncome: 500000,
      groups: [
        {
          groupId: BILLS,
          name: 'Bills',
          categories: [cat('c-rent', 'Rent'), cat('c-utilities', 'Utilities')],
        },
        {
          groupId: EVERYDAY,
          name: 'Everyday',
          categories: [
            // -31200 + 5000 refund = -26200 net activity
            cat('c-groceries', 'Groceries', 50000, -26200),
            cat('c-dining', 'Dining Out'),
            cat('c-transport', 'Transportation'),
          ],
        },
        {
          groupId: GOALS,
          name: 'Goals',
          categories: [cat('c-savings', 'Emergency Fund')],
        },
      ],
    }));

    expect(findCat(state, 'c-groceries').activity).toBe(-26200);
    expect(findCat(state, 'c-groceries').available).toBe(23800);
  });

  it('Savings accumulate across months via carry-forward', () => {
    const month1 = calculateMonthBudget(makeInput({
      month: '2026-01',
      totalIncome: 500000,
      groups: [
        {
          groupId: BILLS,
          name: 'Bills',
          categories: [cat('c-rent', 'Rent'), cat('c-utilities', 'Utilities')],
        },
        {
          groupId: EVERYDAY,
          name: 'Everyday',
          categories: [
            cat('c-groceries', 'Groceries'),
            cat('c-dining', 'Dining Out'),
            cat('c-transport', 'Transportation'),
          ],
        },
        {
          groupId: GOALS,
          name: 'Goals',
          categories: [cat('c-savings', 'Emergency Fund', 50000)],
        },
      ],
    }));

    expect(findCat(month1, 'c-savings').available).toBe(50000);

    const cf1 = getCarryForward(findCat(month1, 'c-savings').available);
    const month2 = calculateMonthBudget({
      month: '2026-02',
      totalIncome: 500000,
      groups: [
        {
          groupId: BILLS,
          name: 'Bills',
          categories: [cat('c-rent', 'Rent'), cat('c-utilities', 'Utilities')],
        },
        {
          groupId: EVERYDAY,
          name: 'Everyday',
          categories: [
            cat('c-groceries', 'Groceries'),
            cat('c-dining', 'Dining Out'),
            cat('c-transport', 'Transportation'),
          ],
        },
        {
          groupId: GOALS,
          name: 'Goals',
          categories: [cat('c-savings', 'Emergency Fund', 50000, 0, cf1)],
        },
      ],
    });

    expect(findCat(month2, 'c-savings').available).toBe(100000);

    const cf2 = getCarryForward(findCat(month2, 'c-savings').available);
    const month3 = calculateMonthBudget({
      month: '2026-03',
      totalIncome: 500000,
      groups: [
        {
          groupId: BILLS,
          name: 'Bills',
          categories: [cat('c-rent', 'Rent'), cat('c-utilities', 'Utilities')],
        },
        {
          groupId: EVERYDAY,
          name: 'Everyday',
          categories: [
            cat('c-groceries', 'Groceries'),
            cat('c-dining', 'Dining Out'),
            cat('c-transport', 'Transportation'),
          ],
        },
        {
          groupId: GOALS,
          name: 'Goals',
          categories: [cat('c-savings', 'Emergency Fund', 50000, 0, cf2)],
        },
      ],
    });

    expect(findCat(month3, 'c-savings').available).toBe(150000);
  });
});
