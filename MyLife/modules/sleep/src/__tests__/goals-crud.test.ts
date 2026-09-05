import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SLEEP_MODULE } from '../definition';
import {
  checkGoalProgress,
  createEntry,
  createGoal,
  deactivateGoal,
  getActiveGoals,
  getGoal,
  updateGoal,
} from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('sleep', SLEEP_MODULE.migrations ?? []);
});

afterEach(() => {
  testDb.close();
});

function createNight(day: number, durationHours: number) {
  const date = String(day).padStart(2, '0');
  const wakeDay = String(day + 1).padStart(2, '0');
  const wakeHour = String(23 + durationHours - 24).padStart(2, '0');

  return createEntry(testDb.adapter, {
    bedtime: `2026-03-${date}T23:00:00Z`,
    wake_time: `2026-03-${wakeDay}T${wakeHour}:00:00Z`,
    quality_rating: durationHours >= 8 ? 4 : 2,
    wake_feeling: durationHours >= 8 ? 'refreshed' : 'groggy',
  });
}

describe('sleep goals CRUD', () => {
  it('creates, retrieves, and filters active goals', () => {
    const duration = createGoal(testDb.adapter, {
      type: 'duration',
      target_value: 8,
      start_date: '2026-03-01',
      notes: '  Target sleep window  ',
    });
    const bedtime = createGoal(testDb.adapter, {
      type: 'bedtime',
      target_value: '22:30',
      start_date: '2026-03-01',
      end_date: '2026-03-10',
    });
    createGoal(testDb.adapter, {
      type: 'wake_time',
      target_value: '07:00',
      is_active: false,
    });

    expect(duration.target_value).toBe('8');
    expect(duration.notes).toBe('Target sleep window');
    expect(getGoal(testDb.adapter, duration.id)).toEqual(duration);
    expect(
      getActiveGoals(testDb.adapter, '2026-03-05')
        .map((goal) => goal.id)
        .sort(),
    ).toEqual([duration.id, bedtime.id].sort());
    expect(getActiveGoals(testDb.adapter, '2026-03-20').map((goal) => goal.id))
      .toEqual([duration.id]);
  });

  it('updates and deactivates goals without deleting history', () => {
    const goal = createGoal(testDb.adapter, {
      type: 'duration',
      target_value: 7.5,
    });

    const updated = updateGoal(testDb.adapter, goal.id, {
      type: 'consistency',
      target_value: 30,
      notes: 'Within half an hour',
    });

    expect(updated).toMatchObject({
      id: goal.id,
      type: 'consistency',
      target_value: '30',
      notes: 'Within half an hour',
      is_active: true,
    });

    const deactivated = deactivateGoal(testDb.adapter, goal.id);
    expect(deactivated).toMatchObject({
      id: goal.id,
      is_active: false,
    });
    expect(getGoal(testDb.adapter, goal.id)).not.toBeNull();
  });

  it('checks goal progress across a date range', () => {
    const goal = createGoal(testDb.adapter, {
      type: 'duration',
      target_value: 8,
    });

    createNight(1, 8);
    createNight(2, 7);
    createNight(3, 8);
    createNight(4, 9);

    expect(
      checkGoalProgress(testDb.adapter, goal.id, {
        startDate: '2026-03-02',
        endDate: '2026-03-05',
      }),
    ).toMatchObject({
      goalId: goal.id,
      type: 'duration',
      met: 3,
      missed: 1,
      streak: 2,
      percentage: 75,
      totalEvaluated: 4,
    });
  });

  it('validates target values by goal type', () => {
    expect(() =>
      createGoal(testDb.adapter, {
        type: 'duration',
        target_value: 0,
      }),
    ).toThrow(/duration target/i);

    expect(() =>
      createGoal(testDb.adapter, {
        type: 'bedtime',
        target_value: '25:00',
      }),
    ).toThrow(/HH:MM/i);

    expect(() =>
      createGoal(testDb.adapter, {
        type: 'consistency',
        target_value: 240,
      }),
    ).toThrow(/consistency target/i);
  });
});
