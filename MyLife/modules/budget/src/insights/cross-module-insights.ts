/**
 * Cross-module insight engine for MyBudget.
 *
 * Generates insight strings by analyzing budget data alongside
 * data from other enabled modules. This is THE differentiator:
 * no competitor can match budget insights connected to 28 other
 * life modules.
 *
 * Each insight generator is a pure function that takes typed inputs
 * and returns an InsightResult. The caller (UI layer) is responsible
 * for querying the appropriate modules and passing data in.
 *
 * All amounts in integer cents.
 */

export interface Insight {
  /** Unique identifier for deduplication. */
  id: string;
  /** Which modules are involved (e.g., ['budget', 'recipes']). */
  modules: string[];
  /** The insight text shown to the user. */
  message: string;
  /** How actionable this insight is: info, suggestion, warning. */
  severity: 'info' | 'suggestion' | 'warning';
  /** Category for grouping in the UI. */
  category: InsightCategory;
}

export type InsightCategory =
  | 'spending_pattern'
  | 'subscription_health'
  | 'cross_module'
  | 'savings'
  | 'trend';

// ---------------------------------------------------------------------------
// Subscription x Activity insights
// ---------------------------------------------------------------------------

export interface SubscriptionActivityInput {
  subscriptionName: string;
  monthlyCostCents: number;
  daysSinceLastRelatedTransaction: number | null;
  /** Name of the related module (e.g., 'workouts' for gym membership). */
  relatedModule: string;
}

/**
 * Generate insight when a subscription appears unused based on
 * related module activity.
 *
 * Example: "Your gym membership ($49.99/mo) hasn't been used in 45 days."
 */
export function checkSubscriptionUsage(
  input: SubscriptionActivityInput,
): Insight | null {
  const { subscriptionName, monthlyCostCents, daysSinceLastRelatedTransaction, relatedModule } = input;

  if (daysSinceLastRelatedTransaction === null || daysSinceLastRelatedTransaction < 30) {
    return null;
  }

  const dollars = (monthlyCostCents / 100).toFixed(2);
  const severity = daysSinceLastRelatedTransaction >= 60 ? 'warning' : 'suggestion';

  return {
    id: `sub-unused-${subscriptionName.toLowerCase().replace(/\s+/g, '-')}`,
    modules: ['budget', relatedModule],
    message: `${subscriptionName} ($${dollars}/mo) hasn't been used in ${daysSinceLastRelatedTransaction} days. Cancel?`,
    severity,
    category: 'subscription_health',
  };
}

// ---------------------------------------------------------------------------
// Spending x Habit correlation insights
// ---------------------------------------------------------------------------

export interface SpendingHabitInput {
  /** Category name (e.g., "Dining Out", "Groceries"). */
  categoryName: string;
  /** Monthly spending in this category. Cents. */
  currentMonthCents: number;
  /** Prior month spending. Cents. null if no data. */
  priorMonthCents: number | null;
  /** Related habit streak (e.g., meal prep streak). null if habit not tracked. */
  relatedHabitStreak: number | null;
  /** Name of the related habit. */
  habitName: string | null;
}

/**
 * Generate insight correlating spending changes with habit streaks.
 *
 * Example: "Takeout spending up 40% -- your meal prep streak is at 0."
 */
export function checkSpendingHabitCorrelation(
  input: SpendingHabitInput,
): Insight | null {
  const { categoryName, currentMonthCents, priorMonthCents, relatedHabitStreak, habitName } = input;

  if (priorMonthCents === null || priorMonthCents === 0 || habitName === null) {
    return null;
  }

  const changePercent = Math.round(((currentMonthCents - priorMonthCents) / priorMonthCents) * 100);

  // Only generate insight if spending increased significantly AND habit streak is low
  if (changePercent < 20 || relatedHabitStreak === null || relatedHabitStreak > 3) {
    return null;
  }

  const dollars = Math.round(currentMonthCents / 100);

  return {
    id: `spending-habit-${categoryName.toLowerCase().replace(/\s+/g, '-')}`,
    modules: ['budget', 'habits'],
    message: `${categoryName} spending up ${changePercent}% to $${dollars} this month. Your ${habitName} streak is at ${relatedHabitStreak}.`,
    severity: 'suggestion',
    category: 'cross_module',
  };
}

// ---------------------------------------------------------------------------
// Spending x Health insights
// ---------------------------------------------------------------------------

export interface SpendingHealthInput {
  /** Grocery spending this month. Cents. */
  grocerySpendingCents: number;
  /** Dining out spending this month. Cents. */
  diningOutSpendingCents: number;
  /** Average nutrition score this month (0-100). null if not tracked. */
  nutritionScore: number | null;
}

/**
 * Generate insight about dining vs grocery spending and nutrition.
 *
 * Example: "You're spending 3x more on dining out than groceries.
 *           Your nutrition score dropped to 62 this month."
 */
export function checkDiningVsGroceryRatio(
  input: SpendingHealthInput,
): Insight | null {
  const { grocerySpendingCents, diningOutSpendingCents, nutritionScore } = input;

  if (grocerySpendingCents === 0 && diningOutSpendingCents === 0) return null;

  const ratio = grocerySpendingCents > 0
    ? diningOutSpendingCents / grocerySpendingCents
    : Infinity;

  if (ratio < 1.5) return null;

  const ratioStr = ratio === Infinity ? 'all' : `${ratio.toFixed(1)}x`;
  let message = `You're spending ${ratioStr} more on dining out than groceries this month.`;

  if (nutritionScore !== null && nutritionScore < 70) {
    message += ` Your nutrition score is ${nutritionScore}/100.`;
  }

  return {
    id: 'dining-vs-grocery-ratio',
    modules: nutritionScore !== null ? ['budget', 'nutrition'] : ['budget'],
    message,
    severity: ratio >= 3 ? 'warning' : 'suggestion',
    category: 'cross_module',
  };
}

// ---------------------------------------------------------------------------
// Savings projection insight
// ---------------------------------------------------------------------------

export interface SavingsProjectionInput {
  /** Current savings rate (0-1). */
  savingsRate: number;
  /** Monthly surplus in cents. */
  monthlySurplusCents: number;
  /** Active savings goal name. null if no goals. */
  goalName: string | null;
  /** Remaining cents to reach goal. */
  goalRemainingCents: number;
}

/**
 * Project when a savings goal will be reached at current pace.
 *
 * Example: "At this rate, your Emergency Fund goal hits May 15."
 */
export function projectGoalCompletion(
  input: SavingsProjectionInput,
): Insight | null {
  const { monthlySurplusCents, goalName, goalRemainingCents } = input;

  if (!goalName || monthlySurplusCents <= 0 || goalRemainingCents <= 0) {
    return null;
  }

  const monthsRemaining = Math.ceil(goalRemainingCents / monthlySurplusCents);
  const completionDate = new Date();
  completionDate.setMonth(completionDate.getMonth() + monthsRemaining);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateStr = `${monthNames[completionDate.getMonth()]} ${completionDate.getDate()}`;

  const dollars = Math.round(goalRemainingCents / 100);

  return {
    id: `goal-projection-${goalName.toLowerCase().replace(/\s+/g, '-')}`,
    modules: ['budget'],
    message: `$${dollars} to go on "${goalName}." At this rate, you'll reach it by ${dateStr}.`,
    severity: 'info',
    category: 'savings',
  };
}

// ---------------------------------------------------------------------------
// Batch insight generator
// ---------------------------------------------------------------------------

/**
 * Run all available insight generators and return all non-null results.
 * The caller passes in whatever cross-module data is available.
 */
export function generateInsights(params: {
  subscriptionActivity?: SubscriptionActivityInput[];
  spendingHabits?: SpendingHabitInput[];
  spendingHealth?: SpendingHealthInput;
  savingsProjection?: SavingsProjectionInput;
}): Insight[] {
  const insights: Insight[] = [];

  if (params.subscriptionActivity) {
    for (const input of params.subscriptionActivity) {
      const insight = checkSubscriptionUsage(input);
      if (insight) insights.push(insight);
    }
  }

  if (params.spendingHabits) {
    for (const input of params.spendingHabits) {
      const insight = checkSpendingHabitCorrelation(input);
      if (insight) insights.push(insight);
    }
  }

  if (params.spendingHealth) {
    const insight = checkDiningVsGroceryRatio(params.spendingHealth);
    if (insight) insights.push(insight);
  }

  if (params.savingsProjection) {
    const insight = projectGoalCompletion(params.savingsProjection);
    if (insight) insights.push(insight);
  }

  return insights;
}
