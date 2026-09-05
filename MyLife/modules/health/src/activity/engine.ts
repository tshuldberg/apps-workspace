/**
 * Activity tracking engine.
 * Ring progress, streak calculation, and daily aggregation.
 */

import type { ActivitySummary, RingProgress } from '../types';

export function calculateRingProgress(current: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(current / goal, 1.0);
}

export function calculateAllRingProgress(summary: ActivitySummary): RingProgress {
  return {
    steps: calculateRingProgress(summary.steps, summary.steps_goal),
    activeEnergy: calculateRingProgress(summary.active_energy_cal, summary.active_energy_goal),
    moveMinutes: calculateRingProgress(summary.move_minutes, summary.move_minutes_goal),
  };
}

export function isGoalMet(summary: ActivitySummary): boolean {
  return (
    summary.steps >= summary.steps_goal &&
    summary.active_energy_cal >= summary.active_energy_goal &&
    summary.move_minutes >= summary.move_minutes_goal
  );
}

/**
 * Calculate streak of consecutive days meeting all 3 goals.
 * Summaries must be sorted by date descending (most recent first).
 */
export function calculateStreak(summaries: ActivitySummary[]): number {
  let streak = 0;
  for (const s of summaries) {
    if (isGoalMet(s)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Aggregate step vitals for a given date into a total.
 */
export function aggregateDailySteps(
  vitals: { value: number }[],
): number {
  return vitals.reduce((sum, v) => sum + v.value, 0);
}
