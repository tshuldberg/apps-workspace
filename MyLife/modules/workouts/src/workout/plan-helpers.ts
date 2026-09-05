import type { WorkoutPlan, WorkoutPlanWeek, WorkoutPlanDay } from '../types';

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export function getWeekSchedule(
  plan: WorkoutPlan,
  weekNumber: number,
): WorkoutPlanDay[] | null {
  const week = plan.weeks.find((w) => w.week_number === weekNumber);
  return week ? week.days : null;
}

export function getCurrentPlanPosition(
  plan: WorkoutPlan,
  startDate: string,
): { weekNumber: number; dayIndex: number; isComplete: boolean } {
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { weekNumber: 1, dayIndex: 0, isComplete: false };
  }

  const weekIndex = Math.floor(diffDays / 7);
  const dayIndex = diffDays % 7;

  if (weekIndex >= plan.weeks.length) {
    return {
      weekNumber: plan.weeks.length,
      dayIndex: 6,
      isComplete: true,
    };
  }

  return {
    weekNumber: weekIndex + 1,
    dayIndex,
    isComplete: false,
  };
}

export function getTodaysWorkout(
  plan: WorkoutPlan,
  startDate: string,
): { workoutId: string | null; restDay: boolean; notes: string | null } {
  const pos = getCurrentPlanPosition(plan, startDate);
  const week = plan.weeks.find((w) => w.week_number === pos.weekNumber);
  if (!week) return { workoutId: null, restDay: true, notes: null };
  const day = week.days[pos.dayIndex];
  if (!day) return { workoutId: null, restDay: true, notes: null };
  return {
    workoutId: day.workout_id,
    restDay: day.rest_day,
    notes: day.notes,
  };
}

export function getAllPlanWorkoutIds(plan: WorkoutPlan): string[] {
  const ids = new Set<string>();
  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (day.workout_id) ids.add(day.workout_id);
    }
  }
  return Array.from(ids);
}

export function getPlanProgress(
  plan: WorkoutPlan,
  completedWorkoutIds: Set<string>,
): { completed: number; total: number; percent: number } {
  let total = 0;
  let completed = 0;
  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (!day.rest_day && day.workout_id) {
        total++;
        if (completedWorkoutIds.has(day.workout_id)) {
          completed++;
        }
      }
    }
  }
  return {
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export function getCurrentWeekDay(
  plan: WorkoutPlan,
  startDate: Date,
): { weekIndex: number; dayIndex: number } | null {
  const now = new Date();
  const diffMs = now.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return null;
  const weekIndex = Math.floor(diffDays / 7);
  const dayIndex = diffDays % 7;
  if (weekIndex >= plan.weeks.length) return null;
  return { weekIndex, dayIndex };
}

export function createEmptyWeek(weekNumber: number): WorkoutPlanWeek {
  return {
    week_number: weekNumber,
    days: Array.from({ length: 7 }, (_, i) => ({
      day_number: i + 1,
      workout_id: null,
      rest_day: i >= 5,
      notes: null,
    })),
  };
}
