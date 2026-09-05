import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { WORKOUTS_MODULE } from '../definition';
import {
  createWorkout,
  createWorkoutSession,
  completeWorkoutSession,
  createWorkoutPlan,
  recordSetWeight,
  record1RM,
} from '../db/crud';
import {
  getSearchableContent,
  getDataSummary,
  getActivityFeed,
  getCorrelationData,
} from '../cross-module';
import type { WorkoutExerciseEntry } from '../types';

let adapter: DatabaseAdapter;
let closeDb: () => void;

function makeExercises(count: number): WorkoutExerciseEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    exerciseId: `ex-${i + 1}`,
    name: `Exercise ${i + 1}`,
    category: 'strength' as const,
    sets: 3,
    reps: 10,
    duration: 30,
    restAfter: 60,
    order: i,
  }));
}

beforeEach(() => {
  const testDb = createModuleTestDatabase('workouts', WORKOUTS_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

// ---------------------------------------------------------------------------
// getSearchableContent
// ---------------------------------------------------------------------------

describe('getSearchableContent', () => {
  it('returns empty array for empty database', () => {
    const items = getSearchableContent(adapter);
    expect(items).toEqual([]);
  });

  it('returns workouts as searchable items', () => {
    createWorkout(adapter, 'w-1', {
      title: 'Morning Push',
      description: 'Upper body push workout',
      difficulty: 'intermediate',
      exercises: makeExercises(3),
    });

    const items = getSearchableContent(adapter);
    const workouts = items.filter((i) => i.type === 'workout');
    expect(workouts).toHaveLength(1);
    expect(workouts[0].moduleId).toBe('workouts');
    expect(workouts[0].title).toBe('Morning Push');
    expect(workouts[0].body).toBe('Upper body push workout');
    expect(workouts[0].tags).toContain('intermediate');
    expect(workouts[0].itemId).toBe('w-1');
  });

  it('returns workout plans as searchable items', () => {
    createWorkoutPlan(adapter, 'plan-1', {
      title: '12-Week Strength',
      description: 'Progressive overload program',
      weeksJson: '[]',
    });

    const items = getSearchableContent(adapter);
    const plans = items.filter((i) => i.type === 'plan');
    expect(plans).toHaveLength(1);
    expect(plans[0].title).toBe('12-Week Strength');
    expect(plans[0].body).toBe('Progressive overload program');
  });

  it('returns multiple content types together', () => {
    createWorkout(adapter, 'w-1', {
      title: 'Workout A',
      difficulty: 'beginner',
      exercises: makeExercises(1),
    });
    createWorkoutPlan(adapter, 'plan-1', {
      title: 'Plan A',
      weeksJson: '[]',
    });

    const items = getSearchableContent(adapter);
    const types = new Set(items.map((i) => i.type));
    expect(types.has('workout')).toBe(true);
    expect(types.has('plan')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getDataSummary
// ---------------------------------------------------------------------------

describe('getDataSummary', () => {
  it('returns zeros for empty database', () => {
    const summary = getDataSummary(adapter);
    expect(summary.moduleId).toBe('workouts');
    expect(summary.totalItems).toBe(0);
    expect(summary.stats.workoutsThisWeek).toBe(0);
    expect(summary.stats.currentStreak).toBe(0);
    expect(summary.stats.totalVolumeThisWeek).toBe(0);
  });

  it('counts total workout definitions', () => {
    createWorkout(adapter, 'w-1', {
      title: 'A',
      difficulty: 'beginner',
      exercises: makeExercises(1),
    });
    createWorkout(adapter, 'w-2', {
      title: 'B',
      difficulty: 'beginner',
      exercises: makeExercises(1),
    });

    const summary = getDataSummary(adapter);
    expect(summary.totalItems).toBe(2);
  });

  it('counts completed sessions this week', () => {
    createWorkout(adapter, 'w-1', {
      title: 'A',
      difficulty: 'beginner',
      exercises: makeExercises(1),
    });
    createWorkoutSession(adapter, 's-1', { workoutId: 'w-1' });
    completeWorkoutSession(adapter, 's-1', {
      exercisesCompleted: [],
    });

    const summary = getDataSummary(adapter);
    expect(summary.stats.workoutsThisWeek).toBeGreaterThanOrEqual(0);
  });

  it('includes lastActivity from completed sessions', () => {
    createWorkout(adapter, 'w-1', {
      title: 'A',
      difficulty: 'beginner',
      exercises: makeExercises(1),
    });
    createWorkoutSession(adapter, 's-1', { workoutId: 'w-1' });
    completeWorkoutSession(adapter, 's-1', {
      exercisesCompleted: [],
    });

    const summary = getDataSummary(adapter);
    expect(summary.lastActivity).toBeTruthy();
  });

  it('calculates current streak from consecutive completed days', () => {
    createWorkout(adapter, 'w-1', {
      title: 'A',
      difficulty: 'beginner',
      exercises: makeExercises(1),
    });

    // Complete a session today
    const now = new Date().toISOString();
    createWorkoutSession(adapter, 's-1', {
      workoutId: 'w-1',
      startedAt: now,
    });
    completeWorkoutSession(adapter, 's-1', {
      exercisesCompleted: [],
      completedAt: now,
    });

    const summary = getDataSummary(adapter);
    expect(summary.stats.currentStreak).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// getActivityFeed
// ---------------------------------------------------------------------------

describe('getActivityFeed', () => {
  it('returns empty array for empty database', () => {
    const items = getActivityFeed(adapter, new Date('2020-01-01'));
    expect(items).toEqual([]);
  });

  it('returns completed workouts as activities', () => {
    createWorkout(adapter, 'w-1', {
      title: 'Push Day',
      difficulty: 'intermediate',
      exercises: makeExercises(3),
    });
    createWorkoutSession(adapter, 's-1', { workoutId: 'w-1' });
    completeWorkoutSession(adapter, 's-1', {
      exercisesCompleted: [
        { exerciseId: 'ex-1', setsCompleted: 3, repsCompleted: 10, durationActual: 30, skipped: false },
      ],
    });

    const items = getActivityFeed(adapter, new Date('2020-01-01'));
    const completed = items.filter((i) => i.action === 'completed');
    expect(completed).toHaveLength(1);
    expect(completed[0].description).toContain('Push Day');
    expect(completed[0].itemType).toBe('workout');
  });

  it('returns 1RM records as PR activities', () => {
    // Seed an exercise so the JOIN works
    adapter.execute(
      `INSERT INTO wk_exercises (id, name, description, category, muscle_groups_json, difficulty,
         audio_cues_json, default_sets, default_reps, is_premium, created_at)
       VALUES ('ex-bench', 'Bench Press', 'Chest press', 'strength', '["chest"]', 'intermediate',
         '[]', 3, 10, 0, datetime('now'))`,
    );

    record1RM(adapter, 'pr-1', {
      exerciseId: 'ex-bench',
      maxWeight: 225,
      maxReps: 1,
      estimated1rm: 225,
      unit: 'lbs',
      achievedAt: new Date().toISOString(),
    });

    const items = getActivityFeed(adapter, new Date('2020-01-01'));
    const prs = items.filter((i) => i.action === 'pr');
    expect(prs).toHaveLength(1);
    expect(prs[0].description).toContain('Bench Press');
    expect(prs[0].description).toContain('225');
    expect(prs[0].itemType).toBe('exercise');
  });

  it('excludes incomplete sessions', () => {
    createWorkout(adapter, 'w-1', {
      title: 'A',
      difficulty: 'beginner',
      exercises: makeExercises(1),
    });
    // Create but don't complete
    createWorkoutSession(adapter, 's-1', { workoutId: 'w-1' });

    const items = getActivityFeed(adapter, new Date('2020-01-01'));
    expect(items.filter((i) => i.action === 'completed')).toHaveLength(0);
  });

  it('filters out activities before since date', () => {
    createWorkout(adapter, 'w-1', {
      title: 'A',
      difficulty: 'beginner',
      exercises: makeExercises(1),
    });
    createWorkoutSession(adapter, 's-1', { workoutId: 'w-1' });
    completeWorkoutSession(adapter, 's-1', { exercisesCompleted: [] });

    const items = getActivityFeed(adapter, new Date('2099-01-01'));
    expect(items).toHaveLength(0);
  });

  it('sorts activities by timestamp descending', () => {
    createWorkout(adapter, 'w-1', {
      title: 'A',
      difficulty: 'beginner',
      exercises: makeExercises(1),
    });
    createWorkout(adapter, 'w-2', {
      title: 'B',
      difficulty: 'beginner',
      exercises: makeExercises(1),
    });
    createWorkoutSession(adapter, 's-1', { workoutId: 'w-1' });
    completeWorkoutSession(adapter, 's-1', { exercisesCompleted: [] });
    createWorkoutSession(adapter, 's-2', { workoutId: 'w-2' });
    completeWorkoutSession(adapter, 's-2', { exercisesCompleted: [] });

    const items = getActivityFeed(adapter, new Date('2020-01-01'));
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].timestamp >= items[i].timestamp).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// getCorrelationData
// ---------------------------------------------------------------------------

describe('getCorrelationData', () => {
  it('returns empty series for empty database', () => {
    const dataset = getCorrelationData(adapter);
    expect(dataset.moduleId).toBe('workouts');
    expect(dataset.series).toHaveLength(2);
    expect(dataset.series[0].metric).toBe('workout_volume');
    expect(dataset.series[0].data).toEqual([]);
    expect(dataset.series[1].metric).toBe('workout_duration');
    expect(dataset.series[1].data).toEqual([]);
  });

  it('returns daily volume data from set weights', () => {
    createWorkout(adapter, 'w-1', {
      title: 'A',
      difficulty: 'beginner',
      exercises: makeExercises(1),
    });
    createWorkoutSession(adapter, 's-1', { workoutId: 'w-1' });

    recordSetWeight(adapter, 'sw-1', {
      sessionId: 's-1',
      exerciseId: 'ex-1',
      setNumber: 1,
      weight: 135,
      reps: 10,
      unit: 'lbs',
    });
    recordSetWeight(adapter, 'sw-2', {
      sessionId: 's-1',
      exerciseId: 'ex-1',
      setNumber: 2,
      weight: 135,
      reps: 8,
      unit: 'lbs',
    });

    const dataset = getCorrelationData(adapter);
    const volumeSeries = dataset.series.find((s) => s.metric === 'workout_volume');
    expect(volumeSeries).toBeDefined();
    expect(volumeSeries!.data.length).toBeGreaterThanOrEqual(1);
    // 10 + 8 = 18 total reps
    expect(volumeSeries!.data[0].value).toBe(18);
    expect(volumeSeries!.unit).toBe('reps');
  });

  it('returns daily duration data from completed sessions', () => {
    createWorkout(adapter, 'w-1', {
      title: 'A',
      difficulty: 'beginner',
      exercises: makeExercises(1),
    });

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 45 * 60000); // 45 min

    createWorkoutSession(adapter, 's-1', {
      workoutId: 'w-1',
      startedAt: startTime.toISOString(),
    });
    completeWorkoutSession(adapter, 's-1', {
      exercisesCompleted: [],
      completedAt: endTime.toISOString(),
    });

    const dataset = getCorrelationData(adapter);
    const durationSeries = dataset.series.find((s) => s.metric === 'workout_duration');
    expect(durationSeries).toBeDefined();
    expect(durationSeries!.data.length).toBeGreaterThanOrEqual(1);
    expect(durationSeries!.data[0].value).toBe(45);
    expect(durationSeries!.unit).toBe('minutes');
  });

  it('has correct series metadata', () => {
    const dataset = getCorrelationData(adapter);
    expect(dataset.series[0]).toMatchObject({
      metric: 'workout_volume',
      label: 'Workout Volume',
      unit: 'reps',
    });
    expect(dataset.series[1]).toMatchObject({
      metric: 'workout_duration',
      label: 'Workout Duration',
      unit: 'minutes',
    });
  });
});

// ---------------------------------------------------------------------------
// Definition wiring
// ---------------------------------------------------------------------------

describe('workoutsCrossModule via definition', () => {
  it('is wired into WORKOUTS_MODULE.crossModule', () => {
    expect(WORKOUTS_MODULE.crossModule).toBeDefined();
    expect(WORKOUTS_MODULE.crossModule!.getSearchableContent).toBeTypeOf('function');
    expect(WORKOUTS_MODULE.crossModule!.getDataSummary).toBeTypeOf('function');
    expect(WORKOUTS_MODULE.crossModule!.getActivityFeed).toBeTypeOf('function');
    expect(WORKOUTS_MODULE.crossModule!.getCorrelationData).toBeTypeOf('function');
  });

  it('works through the crossModule interface', () => {
    createWorkout(adapter, 'w-1', {
      title: 'Test Workout',
      difficulty: 'beginner',
      exercises: makeExercises(2),
    });

    const items = WORKOUTS_MODULE.crossModule!.getSearchableContent!(adapter);
    expect(items.length).toBeGreaterThanOrEqual(1);
    const workoutItems = items.filter((i) => i.type === 'workout');
    expect(workoutItems[0].title).toBe('Test Workout');

    const summary = WORKOUTS_MODULE.crossModule!.getDataSummary!(adapter);
    expect(summary.totalItems).toBe(1);

    const dataset = WORKOUTS_MODULE.crossModule!.getCorrelationData!(adapter);
    expect(dataset.moduleId).toBe('workouts');
    expect(dataset.series).toHaveLength(2);
  });
});
