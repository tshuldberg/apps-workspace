/**
 * Core YNAB-style budget calculation engine.
 *
 * Computes the state of a single month's budget: what was allocated, what was
 * spent, and what carries forward. The central concept is "Available":
 *
 *   Available = carryForward + allocated + activity
 *
 * Where activity is negative for spending, positive for refunds. Overspending
 * in any category reduces the global "Ready to Assign" pool.
 *
 * In the hub, "categories" map to "envelopes" and "category groups" map to
 * the bg_category_groups table. The engine uses generic "category" terminology
 * internally since the math is the same regardless of naming.
 *
 * All amounts in integer cents.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryBudgetState {
  categoryId: string;
  name: string;
  allocated: number;    // cents assigned this month
  activity: number;     // cents spent (negative) or refunded (positive)
  carryForward: number; // cents carried from previous month
  available: number;    // allocated + activity + carryForward
}

export interface GroupBudgetState {
  groupId: string;
  name: string;
  categories: CategoryBudgetState[];
  allocated: number;
  activity: number;
  available: number;
}

export interface MonthBudgetState {
  month: string; // YYYY-MM
  totalIncome: number;
  totalAllocated: number;
  totalActivity: number;
  totalAvailable: number;
  readyToAssign: number;
  groups: GroupBudgetState[];
  overspent: number;
}

export interface MonthBudgetInput {
  month: string; // YYYY-MM
  totalIncome: number;
  groups: {
    groupId: string;
    name: string;
    categories: {
      categoryId: string;
      name: string;
      allocated: number;
      activity: number;
      carryForward: number;
    }[];
  }[];
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Calculate the full budget state for a single month.
 *
 * @param input - Income, groups, and per-category allocation/activity/carry
 * @returns Complete month budget state with ready-to-assign
 */
export function calculateMonthBudget(input: MonthBudgetInput): MonthBudgetState {
  let totalAllocated = 0;
  let totalActivity = 0;
  let totalAvailable = 0;
  let overspent = 0;

  const groups: GroupBudgetState[] = input.groups.map((g) => {
    let groupAllocated = 0;
    let groupActivity = 0;
    let groupAvailable = 0;

    const categories: CategoryBudgetState[] = g.categories.map((c) => {
      const available = c.carryForward + c.allocated + c.activity;

      groupAllocated += c.allocated;
      groupActivity += c.activity;
      groupAvailable += available;

      if (available < 0) {
        overspent += Math.abs(available);
      }

      return {
        categoryId: c.categoryId,
        name: c.name,
        allocated: c.allocated,
        activity: c.activity,
        carryForward: c.carryForward,
        available,
      };
    });

    totalAllocated += groupAllocated;
    totalActivity += groupActivity;
    totalAvailable += groupAvailable;

    return {
      groupId: g.groupId,
      name: g.name,
      categories,
      allocated: groupAllocated,
      activity: groupActivity,
      available: groupAvailable,
    };
  });

  const readyToAssign = input.totalIncome - totalAllocated;

  return {
    month: input.month,
    totalIncome: input.totalIncome,
    totalAllocated,
    totalActivity,
    totalAvailable,
    readyToAssign,
    groups,
    overspent,
  };
}

/**
 * Get the carry-forward amount for a category: positive available carries
 * forward, negative resets to zero (YNAB-style).
 */
export function getCarryForward(available: number): number {
  return available > 0 ? available : 0;
}

/**
 * Sum all overspent amounts across all categories.
 */
export function getTotalOverspent(state: MonthBudgetState): number {
  return state.overspent;
}

/**
 * Move money between two categories within the same month.
 * Returns a new state with updated allocations.
 */
export function moveMoneyBetweenCategories(
  state: MonthBudgetState,
  fromCategoryId: string,
  toCategoryId: string,
  amount: number,
): MonthBudgetState {
  if (amount <= 0) return state;

  const groups = state.groups.map((g) => {
    const categories = g.categories.map((c) => {
      if (c.categoryId === fromCategoryId) {
        const newAllocated = c.allocated - amount;
        return {
          ...c,
          allocated: newAllocated,
          available: c.carryForward + newAllocated + c.activity,
        };
      }
      if (c.categoryId === toCategoryId) {
        const newAllocated = c.allocated + amount;
        return {
          ...c,
          allocated: newAllocated,
          available: c.carryForward + newAllocated + c.activity,
        };
      }
      return c;
    });

    const groupAllocated = categories.reduce((s, cat) => s + cat.allocated, 0);
    const groupActivity = categories.reduce((s, cat) => s + cat.activity, 0);
    const groupAvailable = categories.reduce((s, cat) => s + cat.available, 0);

    return { ...g, categories, allocated: groupAllocated, activity: groupActivity, available: groupAvailable };
  });

  let overspent = 0;
  for (const g of groups) {
    for (const c of g.categories) {
      if (c.available < 0) overspent += Math.abs(c.available);
    }
  }

  return { ...state, groups, overspent };
}
