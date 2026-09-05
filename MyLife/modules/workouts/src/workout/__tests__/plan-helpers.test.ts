import { describe, it, expect, vi, afterEach } from 'vitest';
import type { WorkoutPlan, WorkoutPlanWeek } from '../../types';
import {
  DAY_NAMES,
  getWeekSchedule,
  getCurrentPlanPosition,
  getTodaysWorkout,
  getAllPlanWorkoutIds,
  getPlanProgress,
  getCurrentWeekDay,
  createEmptyWeek,
} from '../plan-helpers';

function makeWeek(weekNumber: number, workoutIds: (string | null)[] = []): WorkoutPlanWeek {
  return {
    week_number: weekNumber,
    days: Array.from({ length: 7 }, (_, i) => ({
      day_number: i + 1,
      workout_id: workoutIds[i] ?? null,
      rest_day: workoutIds[i] == null,
      notes: null,
    })),
  };
}

function makePlan(overrides: Partial<WorkoutPlan> = {}): WorkoutPlan {
  return {
    id: 'plan-1',
    title: 'Test Plan',
    description: 'A test workout plan',
    creatorId: null,
    weeks: [
      makeWeek(1, ['wk-a', 'wk-b', null, 'wk-c', 'wk-d', null, null]),
      makeWeek(2, ['wk-a', null, 'wk-e', null, 'wk-d', null, null]),
    ],
    isPremium: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('DAY_NAMES', () => {
  it('has 7 entries starting with Monday and ending with Sunday', () => {
    expect(DAY_NAMES).toHaveLength(7);
    expect(DAY_NAMES[0]).toBe('Monday');
    expect(DAY_NAMES[6]).toBe('Sunday');
  });
});

describe('getWeekSchedule', () => {
  it('returns days for a valid week number', () => {
    const plan = makePlan();
    const days = getWeekSchedule(plan, 1);
    expect(days).not.toBeNull();
    expect(days).toHaveLength(7);
    expect(days![0].workout_id).toBe('wk-a');
  });

  it('returns null for an invalid week number', () => {
    const plan = makePlan();
    expect(getWeekSchedule(plan, 99)).toBeNull();
    expect(getWeekSchedule(plan, 0)).toBeNull();
  });
});

describe('getCurrentPlanPosition', () => {
  it('returns week 1 day 0 for future start date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

    const plan = makePlan();
    const pos = getCurrentPlanPosition(plan, '2025-06-01');
    expect(pos.weekNumber).toBe(1);
    expect(pos.dayIndex).toBe(0);
    expect(pos.isComplete).toBe(false);

    vi.useRealTimers();
  });

  it('returns correct position on day 0 of plan', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

    const plan = makePlan();
    const pos = getCurrentPlanPosition(plan, '2025-01-01');
    expect(pos.weekNumber).toBe(1);
    expect(pos.dayIndex).toBe(0);
    expect(pos.isComplete).toBe(false);

    vi.useRealTimers();
  });

  it('returns week 2 after 7 days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-08T12:00:00.000Z'));

    const plan = makePlan();
    const pos = getCurrentPlanPosition(plan, '2025-01-01');
    expect(pos.weekNumber).toBe(2);
    expect(pos.dayIndex).toBe(0);
    expect(pos.isComplete).toBe(false);

    vi.useRealTimers();
  });

  it('marks complete when past all weeks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-01T12:00:00.000Z'));

    const plan = makePlan();
    const pos = getCurrentPlanPosition(plan, '2025-01-01');
    expect(pos.isComplete).toBe(true);
    expect(pos.weekNumber).toBe(plan.weeks.length);
    expect(pos.dayIndex).toBe(6);

    vi.useRealTimers();
  });
});

describe('getTodaysWorkout', () => {
  it('returns workout ID for a scheduled day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

    const plan = makePlan();
    const result = getTodaysWorkout(plan, '2025-01-01');
    expect(result.workoutId).toBe('wk-a');
    expect(result.restDay).toBe(false);

    vi.useRealTimers();
  });

  it('returns rest day when no workout scheduled', () => {
    vi.useFakeTimers();
    // Day index 2 (Wednesday) is rest
    vi.setSystemTime(new Date('2025-01-03T12:00:00.000Z'));

    const plan = makePlan();
    const result = getTodaysWorkout(plan, '2025-01-01');
    expect(result.workoutId).toBeNull();
    expect(result.restDay).toBe(true);

    vi.useRealTimers();
  });
});

describe('getAllPlanWorkoutIds', () => {
  it('returns unique workout IDs across all weeks', () => {
    const plan = makePlan();
    const ids = getAllPlanWorkoutIds(plan);
    // wk-a, wk-b, wk-c, wk-d, wk-e are used across both weeks
    expect(ids).toContain('wk-a');
    expect(ids).toContain('wk-b');
    expect(ids).toContain('wk-c');
    expect(ids).toContain('wk-d');
    expect(ids).toContain('wk-e');
    expect(ids).toHaveLength(5);
  });

  it('deduplicates workout IDs that appear in multiple weeks', () => {
    const plan = makePlan();
    const ids = getAllPlanWorkoutIds(plan);
    // wk-a and wk-d appear in both weeks but should only appear once
    const uniqueCheck = new Set(ids);
    expect(uniqueCheck.size).toBe(ids.length);
  });

  it('returns empty array for plan with no workouts', () => {
    const plan = makePlan({
      weeks: [makeWeek(1, [null, null, null, null, null, null, null])],
    });
    expect(getAllPlanWorkoutIds(plan)).toEqual([]);
  });
});

describe('getPlanProgress', () => {
  it('counts completed vs total non-rest days', () => {
    const plan = makePlan();
    const completed = new Set(['wk-a', 'wk-b']);
    const progress = getPlanProgress(plan, completed);
    // Week 1: wk-a, wk-b, wk-c, wk-d = 4 workout days
    // Week 2: wk-a, wk-e, wk-d = 3 workout days
    // Total non-rest = 7
    expect(progress.total).toBe(7);
    // wk-a appears in week 1 day 0 and week 2 day 0 (both counted)
    // wk-b appears in week 1 day 1 (counted)
    // So completed count = 3 (two wk-a occurrences + one wk-b)
    expect(progress.completed).toBe(3);
    expect(progress.percent).toBe(Math.round((3 / 7) * 100));
  });

  it('returns 0% for no completed workouts', () => {
    const plan = makePlan();
    const progress = getPlanProgress(plan, new Set());
    expect(progress.completed).toBe(0);
    expect(progress.percent).toBe(0);
  });

  it('returns 0 total for all-rest plan', () => {
    const plan = makePlan({
      weeks: [makeWeek(1, [null, null, null, null, null, null, null])],
    });
    const progress = getPlanProgress(plan, new Set());
    expect(progress.total).toBe(0);
    expect(progress.percent).toBe(0);
  });
});

describe('getCurrentWeekDay', () => {
  it('returns null for dates before the plan starts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-12-31T12:00:00.000Z'));

    const plan = makePlan();
    const result = getCurrentWeekDay(plan, new Date('2025-01-01'));
    expect(result).toBeNull();

    vi.useRealTimers();
  });

  it('returns null for dates after the plan ends', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00.000Z'));

    const plan = makePlan();
    const result = getCurrentWeekDay(plan, new Date('2025-01-01'));
    expect(result).toBeNull();

    vi.useRealTimers();
  });

  it('returns correct weekIndex and dayIndex on plan start', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

    const plan = makePlan();
    const result = getCurrentWeekDay(plan, new Date('2025-01-01'));
    expect(result).toEqual({ weekIndex: 0, dayIndex: 0 });

    vi.useRealTimers();
  });
});

describe('createEmptyWeek', () => {
  it('creates a week with 7 days', () => {
    const week = createEmptyWeek(1);
    expect(week.days).toHaveLength(7);
    expect(week.week_number).toBe(1);
  });

  it('sets Saturday (day 6) and Sunday (day 7) as rest days', () => {
    const week = createEmptyWeek(1);
    // Index 5 = Saturday (day_number 6), Index 6 = Sunday (day_number 7)
    expect(week.days[5].rest_day).toBe(true);
    expect(week.days[6].rest_day).toBe(true);
  });

  it('sets weekdays as non-rest by default', () => {
    const week = createEmptyWeek(1);
    for (let i = 0; i < 5; i++) {
      expect(week.days[i].rest_day).toBe(false);
    }
  });

  it('sets all workout_id to null', () => {
    const week = createEmptyWeek(1);
    for (const day of week.days) {
      expect(day.workout_id).toBeNull();
    }
  });

  it('sets all notes to null', () => {
    const week = createEmptyWeek(1);
    for (const day of week.days) {
      expect(day.notes).toBeNull();
    }
  });

  it('assigns day_number 1 through 7', () => {
    const week = createEmptyWeek(3);
    expect(week.days.map((d) => d.day_number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
