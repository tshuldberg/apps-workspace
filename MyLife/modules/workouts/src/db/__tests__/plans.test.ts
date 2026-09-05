import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { WORKOUTS_MODULE } from '../../definition';
import type { WorkoutPlanWeek } from '../../types';
import {
  createWorkoutPlan,
  getWorkoutPlans,
  getWorkoutPlanById,
  updateWorkoutPlan,
  deleteWorkoutPlan,
  subscribeToPlan,
  unsubscribeFromPlan,
  getActivePlanSubscription,
} from '../crud';

const sampleWeeks: WorkoutPlanWeek[] = [
  {
    week_number: 1,
    days: [
      { day_number: 1, workout_id: 'w-1', rest_day: false, notes: 'Push day' },
      { day_number: 2, workout_id: 'w-2', rest_day: false, notes: null },
      { day_number: 3, workout_id: null, rest_day: true, notes: 'Active recovery' },
      { day_number: 4, workout_id: 'w-3', rest_day: false, notes: null },
      { day_number: 5, workout_id: 'w-4', rest_day: false, notes: null },
      { day_number: 6, workout_id: null, rest_day: true, notes: null },
      { day_number: 7, workout_id: null, rest_day: true, notes: null },
    ],
  },
];

describe('@mylife/workouts - workout plans', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('workouts', WORKOUTS_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  // -- Plan CRUD --

  it('creates a plan with weeks JSON and verifies retrieval', () => {
    createWorkoutPlan(adapter, 'plan-1', {
      title: '4-Week Strength',
      description: 'Progressive overload program',
      weeksJson: JSON.stringify(sampleWeeks),
    });

    const plan = getWorkoutPlanById(adapter, 'plan-1');
    expect(plan).not.toBeNull();
    expect(plan!.id).toBe('plan-1');
    expect(plan!.title).toBe('4-Week Strength');
    expect(plan!.description).toBe('Progressive overload program');
    expect(plan!.weeks).toHaveLength(1);
    expect(plan!.weeks[0].days).toHaveLength(7);
    expect(plan!.weeks[0].days[0].workout_id).toBe('w-1');
    expect(plan!.weeks[0].days[0].notes).toBe('Push day');
    expect(plan!.isPremium).toBe(false);
    expect(plan!.createdAt).toBeTruthy();
    expect(plan!.updatedAt).toBeTruthy();
  });

  it('creates a premium plan', () => {
    createWorkoutPlan(adapter, 'plan-prem', {
      title: 'Premium Plan',
      weeksJson: JSON.stringify(sampleWeeks),
      isPremium: true,
    });

    const plan = getWorkoutPlanById(adapter, 'plan-prem');
    expect(plan!.isPremium).toBe(true);
  });

  it('lists all created plans', () => {
    createWorkoutPlan(adapter, 'plan-a', {
      title: 'Alpha',
      weeksJson: JSON.stringify(sampleWeeks),
    });
    createWorkoutPlan(adapter, 'plan-b', {
      title: 'Beta',
      weeksJson: JSON.stringify(sampleWeeks),
    });

    const plans = getWorkoutPlans(adapter);
    expect(plans).toHaveLength(2);
    const ids = plans.map((p) => p.id).sort();
    expect(ids).toEqual(['plan-a', 'plan-b']);
  });

  it('respects limit option', () => {
    for (let i = 0; i < 5; i++) {
      createWorkoutPlan(adapter, `plan-${i}`, {
        title: `Plan ${i}`,
        weeksJson: JSON.stringify(sampleWeeks),
      });
    }

    const limited = getWorkoutPlans(adapter, { limit: 2 });
    expect(limited).toHaveLength(2);
  });

  it('updates plan title and weeks', () => {
    createWorkoutPlan(adapter, 'plan-upd', {
      title: 'Original',
      description: 'v1',
      weeksJson: JSON.stringify(sampleWeeks),
    });

    const updatedWeeks: WorkoutPlanWeek[] = [
      ...sampleWeeks,
      { week_number: 2, days: sampleWeeks[0].days },
    ];

    updateWorkoutPlan(adapter, 'plan-upd', {
      title: 'Updated',
      description: 'v2',
      weeksJson: JSON.stringify(updatedWeeks),
    });

    const plan = getWorkoutPlanById(adapter, 'plan-upd');
    expect(plan!.title).toBe('Updated');
    expect(plan!.description).toBe('v2');
    expect(plan!.weeks).toHaveLength(2);
  });

  it('update changes premium status', () => {
    createWorkoutPlan(adapter, 'plan-prem-upd', {
      title: 'Free Plan',
      weeksJson: JSON.stringify(sampleWeeks),
      isPremium: false,
    });

    updateWorkoutPlan(adapter, 'plan-prem-upd', {
      title: 'Now Premium',
      weeksJson: JSON.stringify(sampleWeeks),
      isPremium: true,
    });

    const plan = getWorkoutPlanById(adapter, 'plan-prem-upd');
    expect(plan!.isPremium).toBe(true);
    expect(plan!.title).toBe('Now Premium');
  });

  it('deletes a plan', () => {
    createWorkoutPlan(adapter, 'plan-del', {
      title: 'To Delete',
      weeksJson: JSON.stringify(sampleWeeks),
    });

    expect(getWorkoutPlans(adapter)).toHaveLength(1);
    deleteWorkoutPlan(adapter, 'plan-del');
    expect(getWorkoutPlanById(adapter, 'plan-del')).toBeNull();
    expect(getWorkoutPlans(adapter)).toHaveLength(0);
  });

  it('returns null for nonexistent plan', () => {
    expect(getWorkoutPlanById(adapter, 'nonexistent')).toBeNull();
  });

  // -- Subscriptions --

  it('subscribes to a plan and creates active subscription', () => {
    createWorkoutPlan(adapter, 'plan-sub', {
      title: 'Subscribe Test',
      weeksJson: JSON.stringify(sampleWeeks),
    });

    subscribeToPlan(adapter, 'sub-1', 'plan-sub');

    const active = getActivePlanSubscription(adapter);
    expect(active).not.toBeNull();
    expect(active!.id).toBe('sub-1');
    expect(active!.planId).toBe('plan-sub');
    expect(active!.isActive).toBe(true);
    expect(active!.startedAt).toBeTruthy();
    expect(active!.createdAt).toBeTruthy();
  });

  it('unsubscribes by setting is_active to false', () => {
    createWorkoutPlan(adapter, 'plan-unsub', {
      title: 'Unsub Test',
      weeksJson: JSON.stringify(sampleWeeks),
    });

    subscribeToPlan(adapter, 'sub-2', 'plan-unsub');
    expect(getActivePlanSubscription(adapter)).not.toBeNull();

    unsubscribeFromPlan(adapter, 'plan-unsub');
    expect(getActivePlanSubscription(adapter)).toBeNull();
  });

  it('returns null when no active subscriptions', () => {
    expect(getActivePlanSubscription(adapter)).toBeNull();
  });

  it('getActivePlanSubscription returns an active subscription when multiple exist', () => {
    createWorkoutPlan(adapter, 'plan-1', {
      title: 'Plan 1',
      weeksJson: JSON.stringify(sampleWeeks),
    });
    createWorkoutPlan(adapter, 'plan-2', {
      title: 'Plan 2',
      weeksJson: JSON.stringify(sampleWeeks),
    });

    subscribeToPlan(adapter, 'sub-a', 'plan-1');
    subscribeToPlan(adapter, 'sub-b', 'plan-2');

    const active = getActivePlanSubscription(adapter);
    expect(active).not.toBeNull();
    expect(active!.isActive).toBe(true);
    // Should be one of the two active subscriptions
    expect(['plan-1', 'plan-2']).toContain(active!.planId);
  });

  it('switching subscription: unsubscribe from one, subscribe to another', () => {
    createWorkoutPlan(adapter, 'plan-1', {
      title: 'Plan 1',
      weeksJson: JSON.stringify(sampleWeeks),
    });
    createWorkoutPlan(adapter, 'plan-2', {
      title: 'Plan 2',
      weeksJson: JSON.stringify(sampleWeeks),
    });

    subscribeToPlan(adapter, 'sub-a', 'plan-1');
    unsubscribeFromPlan(adapter, 'plan-1');
    subscribeToPlan(adapter, 'sub-b', 'plan-2');

    const active = getActivePlanSubscription(adapter);
    expect(active!.planId).toBe('plan-2');
    expect(active!.isActive).toBe(true);
  });

  it('unsubscribe only affects the specified plan', () => {
    createWorkoutPlan(adapter, 'plan-1', {
      title: 'Plan 1',
      weeksJson: JSON.stringify(sampleWeeks),
    });
    createWorkoutPlan(adapter, 'plan-2', {
      title: 'Plan 2',
      weeksJson: JSON.stringify(sampleWeeks),
    });

    subscribeToPlan(adapter, 'sub-a', 'plan-1');
    subscribeToPlan(adapter, 'sub-b', 'plan-2');

    unsubscribeFromPlan(adapter, 'plan-1');

    const active = getActivePlanSubscription(adapter);
    expect(active).not.toBeNull();
    expect(active!.planId).toBe('plan-2');
    expect(active!.isActive).toBe(true);
  });

  it('deleting a plan does not error on subscription queries', () => {
    createWorkoutPlan(adapter, 'plan-cascade', {
      title: 'Cascade Test',
      weeksJson: JSON.stringify(sampleWeeks),
    });

    subscribeToPlan(adapter, 'sub-cascade', 'plan-cascade');
    deleteWorkoutPlan(adapter, 'plan-cascade');

    // Subscription row may still exist; verify no error
    const sub = getActivePlanSubscription(adapter);
    expect(sub === null || sub.planId === 'plan-cascade').toBe(true);
  });
});
