import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { WORKOUTS_MODULE } from '../../definition';
import type { WorkoutExerciseEntry } from '../../types';
import {
  createWorkout,
  createWorkoutSession,
  completeWorkoutSession,
  recordSetWeight,
  getPreviousPerformance,
} from '../crud';

let db: DatabaseAdapter;
let closeDb: () => void;

const exercises: WorkoutExerciseEntry[] = [
  {
    exerciseId: 'ex-bench',
    name: 'Bench Press',
    category: 'strength',
    sets: 3,
    reps: 10,
    duration: null,
    restAfter: 90,
    order: 0,
  },
  {
    exerciseId: 'ex-squat',
    name: 'Squat',
    category: 'strength',
    sets: 3,
    reps: 8,
    duration: null,
    restAfter: 120,
    order: 1,
  },
];

function setupWorkoutAndPreviousSession() {
  createWorkout(db, 'w-1', {
    title: 'Push Day',
    difficulty: 'intermediate',
    exercises,
  });

  // Create and complete a previous session
  createWorkoutSession(db, 's-prev', {
    workoutId: 'w-1',
    startedAt: '2026-03-15T08:00:00.000Z',
  });

  recordSetWeight(db, 'sw-1', {
    sessionId: 's-prev',
    exerciseId: 'ex-bench',
    setNumber: 1,
    weight: 135,
    reps: 10,
    unit: 'lbs',
    estimated1rm: 180,
  });
  recordSetWeight(db, 'sw-2', {
    sessionId: 's-prev',
    exerciseId: 'ex-bench',
    setNumber: 2,
    weight: 155,
    reps: 8,
    unit: 'lbs',
    estimated1rm: 196,
  });
  recordSetWeight(db, 'sw-3', {
    sessionId: 's-prev',
    exerciseId: 'ex-bench',
    setNumber: 3,
    weight: 175,
    reps: 5,
    unit: 'lbs',
    estimated1rm: 204,
  });
  recordSetWeight(db, 'sw-4', {
    sessionId: 's-prev',
    exerciseId: 'ex-squat',
    setNumber: 1,
    weight: 225,
    reps: 8,
    unit: 'lbs',
    estimated1rm: 281,
  });

  completeWorkoutSession(db, 's-prev', {
    completedAt: '2026-03-15T09:00:00.000Z',
    exercisesCompleted: [
      { exerciseId: 'ex-bench', setsCompleted: 3, repsCompleted: 23, durationActual: null, skipped: false },
      { exerciseId: 'ex-squat', setsCompleted: 1, repsCompleted: 8, durationActual: null, skipped: false },
    ],
  });

  // Create current session
  createWorkoutSession(db, 's-current', {
    workoutId: 'w-1',
    startedAt: '2026-03-17T08:00:00.000Z',
  });
}

beforeEach(() => {
  const testDb = createModuleTestDatabase('workouts', WORKOUTS_MODULE.migrations!);
  db = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

describe('getPreviousPerformance', () => {
  it('returns correct data for a workout with a previous session', () => {
    setupWorkoutAndPreviousSession();
    const perf = getPreviousPerformance(db, 'w-1', 's-current');

    expect(perf.size).toBe(2); // 2 exercises
    const bench = perf.get('ex-bench');
    expect(bench).toBeDefined();
    expect(bench!.size).toBe(3); // 3 sets
    expect(bench!.get(1)).toEqual({ weight: 135, reps: 10, unit: 'lbs', estimated1rm: 180 });
    expect(bench!.get(2)).toEqual({ weight: 155, reps: 8, unit: 'lbs', estimated1rm: 196 });
    expect(bench!.get(3)).toEqual({ weight: 175, reps: 5, unit: 'lbs', estimated1rm: 204 });

    const squat = perf.get('ex-squat');
    expect(squat).toBeDefined();
    expect(squat!.size).toBe(1);
    expect(squat!.get(1)).toEqual({ weight: 225, reps: 8, unit: 'lbs', estimated1rm: 281 });
  });

  it('returns most recent completed session only', () => {
    createWorkout(db, 'w-1', { title: 'Push', difficulty: 'beginner', exercises });

    // Older session
    createWorkoutSession(db, 's-old', { workoutId: 'w-1', startedAt: '2026-03-10T08:00:00.000Z' });
    recordSetWeight(db, 'sw-old', {
      sessionId: 's-old', exerciseId: 'ex-bench', setNumber: 1,
      weight: 100, reps: 12, unit: 'lbs',
    });
    completeWorkoutSession(db, 's-old', {
      completedAt: '2026-03-10T09:00:00.000Z',
      exercisesCompleted: [{ exerciseId: 'ex-bench', setsCompleted: 1, repsCompleted: 12, durationActual: null, skipped: false }],
    });

    // Newer session
    createWorkoutSession(db, 's-new', { workoutId: 'w-1', startedAt: '2026-03-15T08:00:00.000Z' });
    recordSetWeight(db, 'sw-new', {
      sessionId: 's-new', exerciseId: 'ex-bench', setNumber: 1,
      weight: 135, reps: 10, unit: 'lbs',
    });
    completeWorkoutSession(db, 's-new', {
      completedAt: '2026-03-15T09:00:00.000Z',
      exercisesCompleted: [{ exerciseId: 'ex-bench', setsCompleted: 1, repsCompleted: 10, durationActual: null, skipped: false }],
    });

    // Current
    createWorkoutSession(db, 's-curr', { workoutId: 'w-1', startedAt: '2026-03-17T08:00:00.000Z' });

    const perf = getPreviousPerformance(db, 'w-1', 's-curr');
    const bench = perf.get('ex-bench');
    // Should be from newer session (135), not older (100)
    expect(bench!.get(1)!.weight).toBe(135);
  });

  it('returns empty map when no previous sessions exist', () => {
    createWorkout(db, 'w-1', { title: 'Push', difficulty: 'beginner', exercises });
    createWorkoutSession(db, 's-1', { workoutId: 'w-1', startedAt: '2026-03-17T08:00:00.000Z' });

    const perf = getPreviousPerformance(db, 'w-1', 's-1');
    expect(perf.size).toBe(0);
  });

  it('excludes current session from results', () => {
    setupWorkoutAndPreviousSession();

    // Record weight in current session
    recordSetWeight(db, 'sw-curr-1', {
      sessionId: 's-current', exerciseId: 'ex-bench', setNumber: 1,
      weight: 140, reps: 10, unit: 'lbs',
    });

    const perf = getPreviousPerformance(db, 'w-1', 's-current');
    const bench = perf.get('ex-bench');
    // Should show previous (135), not current (140)
    expect(bench!.get(1)!.weight).toBe(135);
  });

  it('excludes incomplete sessions (completed_at is NULL)', () => {
    createWorkout(db, 'w-1', { title: 'Push', difficulty: 'beginner', exercises });

    // Incomplete session (not completed)
    createWorkoutSession(db, 's-incomplete', { workoutId: 'w-1', startedAt: '2026-03-15T08:00:00.000Z' });
    recordSetWeight(db, 'sw-inc', {
      sessionId: 's-incomplete', exerciseId: 'ex-bench', setNumber: 1,
      weight: 200, reps: 5, unit: 'lbs',
    });
    // Do NOT call completeWorkoutSession

    // Current session
    createWorkoutSession(db, 's-curr', { workoutId: 'w-1', startedAt: '2026-03-17T08:00:00.000Z' });

    const perf = getPreviousPerformance(db, 'w-1', 's-curr');
    expect(perf.size).toBe(0); // Incomplete session excluded
  });

  it('groups data correctly by exercise_id and set_number', () => {
    setupWorkoutAndPreviousSession();
    const perf = getPreviousPerformance(db, 'w-1', 's-current');

    // Verify structure: 2 exercises, bench has 3 sets, squat has 1
    expect(perf.has('ex-bench')).toBe(true);
    expect(perf.has('ex-squat')).toBe(true);
    expect(perf.has('ex-unknown')).toBe(false);

    const bench = perf.get('ex-bench')!;
    expect(bench.has(1)).toBe(true);
    expect(bench.has(2)).toBe(true);
    expect(bench.has(3)).toBe(true);
    expect(bench.has(4)).toBe(false);
  });

  it('does not return data from a different workout_id', () => {
    createWorkout(db, 'w-1', { title: 'Push', difficulty: 'beginner', exercises });
    createWorkout(db, 'w-2', { title: 'Pull', difficulty: 'beginner', exercises });

    // Session for w-1
    createWorkoutSession(db, 's-w1', { workoutId: 'w-1', startedAt: '2026-03-15T08:00:00.000Z' });
    recordSetWeight(db, 'sw-w1', {
      sessionId: 's-w1', exerciseId: 'ex-bench', setNumber: 1,
      weight: 135, reps: 10, unit: 'lbs',
    });
    completeWorkoutSession(db, 's-w1', {
      completedAt: '2026-03-15T09:00:00.000Z',
      exercisesCompleted: [{ exerciseId: 'ex-bench', setsCompleted: 1, repsCompleted: 10, durationActual: null, skipped: false }],
    });

    // Current session for w-2 (different workout)
    createWorkoutSession(db, 's-w2', { workoutId: 'w-2', startedAt: '2026-03-17T08:00:00.000Z' });

    const perf = getPreviousPerformance(db, 'w-2', 's-w2');
    expect(perf.size).toBe(0); // No data from w-1
  });
});
