import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import {
  WORKOUTS_MODULE,
  createWorkout,
  createWorkoutSession,
  completeWorkoutSession,
  getWorkoutById,
  seedWorkoutExerciseLibrary,
  getWorkoutExercises,
} from '@mylife/workouts';
import { resolveRepeatWorkout } from '../run-repeat';

// expo-sqlite (the on-device adapter) leaves `PRAGMA foreign_keys` off, so a
// deleted workout does not cascade-delete its past sessions there - they're
// left with a dangling `workout_id`, which is exactly the case
// `resolveRepeatWorkout` has to rebuild from. The vitest test adapter turns
// foreign keys ON, so `deleteWorkout()` would cascade away the session here
// and defeat the point of the test; disable the pragma for the single delete
// to reproduce the real on-device shape.
function deleteWorkoutWithoutCascade(db: DatabaseAdapter, id: string): void {
  db.execute('PRAGMA foreign_keys = OFF;');
  db.execute('DELETE FROM wk_workouts WHERE id = ?', [id]);
  db.execute('PRAGMA foreign_keys = ON;');
}

let adapter: DatabaseAdapter;
let closeDb: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('workouts', WORKOUTS_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
  seedWorkoutExerciseLibrary(adapter);
});

afterEach(() => {
  closeDb();
});

describe('resolveRepeatWorkout', () => {
  it('returns the source workout id when it still exists', () => {
    const [exercise] = getWorkoutExercises(adapter, { limit: 1 });
    createWorkout(adapter, 'w-1', {
      title: 'Push Day',
      difficulty: 'intermediate',
      exercises: [
        {
          exerciseId: exercise.id,
          name: exercise.name,
          category: exercise.category,
          sets: 3,
          reps: 10,
          duration: null,
          restAfter: 60,
          order: 0,
        },
      ],
    });
    createWorkoutSession(adapter, 's-1', { workoutId: 'w-1' });
    completeWorkoutSession(adapter, 's-1', {
      exercisesCompleted: [
        { exerciseId: exercise.id, setsCompleted: 3, repsCompleted: 10, durationActual: 30, skipped: false },
      ],
    });

    const result = resolveRepeatWorkout(adapter, 's-1', 'Push Day');

    expect(result).toEqual({ ok: true, workoutId: 'w-1' });
  });

  it('rebuilds a workout when the source was deleted', () => {
    const [exercise] = getWorkoutExercises(adapter, { limit: 1 });
    createWorkout(adapter, 'w-deleted', {
      title: 'Push Day',
      difficulty: 'intermediate',
      exercises: [
        {
          exerciseId: exercise.id,
          name: exercise.name,
          category: exercise.category,
          sets: 3,
          reps: 10,
          duration: null,
          restAfter: 60,
          order: 0,
        },
      ],
    });
    createWorkoutSession(adapter, 's-1', { workoutId: 'w-deleted' });
    completeWorkoutSession(adapter, 's-1', {
      exercisesCompleted: [
        { exerciseId: exercise.id, setsCompleted: 4, repsCompleted: 8, durationActual: 30, skipped: false },
      ],
    });
    deleteWorkoutWithoutCascade(adapter, 'w-deleted');

    const result = resolveRepeatWorkout(adapter, 's-1', 'Push Day');

    expect(result.ok).toBe(true);
    expect(result.workoutId).toBeDefined();
    expect(result.workoutId).not.toBe('w-deleted');

    const rebuilt = getWorkoutById(adapter, result.workoutId!);
    expect(rebuilt?.title).toBe('Push Day');
    expect(rebuilt?.exercises).toHaveLength(1);
    expect(rebuilt?.exercises[0].exerciseId).toBe(exercise.id);
    expect(rebuilt?.exercises[0].sets).toBe(4);
    expect(rebuilt?.exercises[0].reps).toBe(8);
  });

  it('reports an honest failure when the session is missing', () => {
    const result = resolveRepeatWorkout(adapter, 'missing-session', 'Push Day');

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/could no longer be found/i);
  });

  it('reports an honest failure when nothing can be rebuilt', () => {
    createWorkout(adapter, 'w-deleted', {
      title: 'Push Day',
      difficulty: 'intermediate',
      exercises: [],
    });
    createWorkoutSession(adapter, 's-1', { workoutId: 'w-deleted' });
    completeWorkoutSession(adapter, 's-1', { exercisesCompleted: [] });
    deleteWorkoutWithoutCascade(adapter, 'w-deleted');

    const result = resolveRepeatWorkout(adapter, 's-1', 'Push Day');

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not enough|no longer has enough/i);
  });
});
