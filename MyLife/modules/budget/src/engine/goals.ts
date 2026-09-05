/**
 * Savings goal tracking engine.
 *
 * Calculates progress toward savings goals, suggests monthly contributions,
 * detects whether a goal is on track, and projects completion dates.
 *
 * All amounts in integer cents.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;  // cents
  currentAmount: number; // cents
  targetDate: string | null; // YYYY-MM-DD or null for open-ended
  createdAt: string;     // ISO date
}

export type GoalStatus = 'completed' | 'on_track' | 'behind' | 'overdue' | 'no_target_date';

export interface GoalProgress {
  goalId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  remaining: number;
  percentComplete: number;
  status: GoalStatus;
}

export interface GoalProjection {
  goalId: string;
  projectedDate: string | null; // YYYY-MM-DD or null if no contributions
  monthsRemaining: number | null;
  requiredMonthly: number; // cents per month to hit target by target date
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Calculate current progress for a goal.
 */
export function calculateGoalProgress(goal: Goal, today?: string): GoalProgress {
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const percentComplete =
    goal.targetAmount > 0
      ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
      : 0;

  let status: GoalStatus;
  if (goal.currentAmount >= goal.targetAmount) {
    status = 'completed';
  } else if (!goal.targetDate) {
    status = 'no_target_date';
  } else {
    const todayDate = today ? parseDate(today) : new Date();
    const targetDate = parseDate(goal.targetDate);

    if (todayDate > targetDate) {
      status = 'overdue';
    } else {
      // Check if on track: would we reach the target at current pace?
      const createdDate = parseDate(goal.createdAt);
      const totalMonths = monthsBetween(createdDate, targetDate);
      const elapsedMonths = monthsBetween(createdDate, todayDate);

      if (totalMonths <= 0 || elapsedMonths <= 0) {
        status = 'on_track';
      } else {
        const expectedProgress = (elapsedMonths / totalMonths) * goal.targetAmount;
        status = goal.currentAmount >= expectedProgress * 0.9 ? 'on_track' : 'behind';
      }
    }
  }

  return {
    goalId: goal.id,
    name: goal.name,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    remaining,
    percentComplete,
    status,
  };
}

/**
 * Suggest the monthly contribution needed to reach the goal by its target date.
 */
export function suggestMonthlyContribution(goal: Goal, today?: string): number {
  if (goal.currentAmount >= goal.targetAmount) return 0;
  if (!goal.targetDate) return 0;

  const todayDate = today ? parseDate(today) : new Date();
  const targetDate = parseDate(goal.targetDate);
  const months = monthsBetween(todayDate, targetDate);

  if (months <= 0) return goal.targetAmount - goal.currentAmount;

  const remaining = goal.targetAmount - goal.currentAmount;
  return Math.ceil(remaining / months);
}

/**
 * Check if a goal is on track (at or above 90% of expected progress).
 */
export function isGoalOnTrack(goal: Goal, today?: string): boolean {
  const progress = calculateGoalProgress(goal, today);
  return progress.status === 'completed' || progress.status === 'on_track';
}

/**
 * Get a human-readable status for a goal.
 */
export function getGoalStatus(goal: Goal, today?: string): GoalStatus {
  return calculateGoalProgress(goal, today).status;
}

/**
 * Project when a goal will be completed based on average monthly contributions.
 */
export function calculateGoalProjection(
  goal: Goal,
  averageMonthlyContribution: number,
  today?: string,
): GoalProjection {
  if (goal.currentAmount >= goal.targetAmount) {
    return {
      goalId: goal.id,
      projectedDate: null,
      monthsRemaining: 0,
      requiredMonthly: 0,
    };
  }

  const remaining = goal.targetAmount - goal.currentAmount;
  const requiredMonthly = suggestMonthlyContribution(goal, today);

  if (averageMonthlyContribution <= 0) {
    return {
      goalId: goal.id,
      projectedDate: null,
      monthsRemaining: null,
      requiredMonthly,
    };
  }

  const monthsRemaining = Math.ceil(remaining / averageMonthlyContribution);
  const todayDate = today ? parseDate(today) : new Date();
  const projected = new Date(todayDate);
  projected.setMonth(projected.getMonth() + monthsRemaining);

  return {
    goalId: goal.id,
    projectedDate: formatDate(projected),
    monthsRemaining,
    requiredMonthly,
  };
}
