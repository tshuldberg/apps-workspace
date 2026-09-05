import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { WORKOUTS_MODULE } from '../../definition';
import type { WorkoutExerciseEntry } from '../../types';
import {
  createWorkout,
  updateWorkout,
  deleteWorkout,
  getWorkouts,
  getWorkoutById,
  createWorkoutSession,
  getWorkoutSessions,
} from '../crud';

function makeExercises(count = 2): WorkoutExerciseEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    exerciseId: `ex-${i + 1}`,
    name: i === 0 ? 'Push-up' : `Exercise ${i + 1}`,
    category: 'strength' as const,
    sets: 3,
    reps: 10,
    duration: null,
    restAfter: 60,
    order: i,
  }));
}

describe('@mylife/workouts - workouts', () => {
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

  // ── createWorkout ──

  it('creates a workout with exercises', () => {
    const exercises = makeExercises(3);
    createWorkout(adapter, 'w-1', {
      title: 'Morning Strength',
      description: 'Full body routine',
      difficulty: 'beginner',
      exercises,
    });

    const workout = getWorkoutById(adapter, 'w-1');
    expect(workout).not.toBeNull();
    expect(workout!.title).toBe('Morning Strength');
    expect(workout!.description).toBe('Full body routine');
    expect(workout!.difficulty).toBe('beginner');
    expect(workout!.exercises).toHaveLength(3);
    expect(workout!.isPremium).toBe(false);
  });

  it('auto-computes estimatedDuration when not provided', () => {
    const exercises: WorkoutExerciseEntry[] = [
      {
        exerciseId: 'ex-1',
        name: 'Push-up',
        category: 'strength',
        sets: 3,
        reps: 10,
        duration: null,
        restAfter: 60,
        order: 0,
      },
    ];
    createWorkout(adapter, 'w-auto', {
      title: 'Auto Duration',
      difficulty: 'beginner',
      exercises,
    });

    const workout = getWorkoutById(adapter, 'w-auto');
    expect(workout).not.toBeNull();
    // reps=10, duration defaults to 10*3=30, sets=3 -> 30*3=90 + rest 60*2=120 = 210
    expect(workout!.estimatedDuration).toBe(210);
  });

  it('uses provided estimatedDuration when given', () => {
    createWorkout(adapter, 'w-manual', {
      title: 'Manual Duration',
      difficulty: 'intermediate',
      exercises: makeExercises(1),
      estimatedDuration: 999,
    });

    const workout = getWorkoutById(adapter, 'w-manual');
    expect(workout!.estimatedDuration).toBe(999);
  });

  it('creates a premium workout', () => {
    createWorkout(adapter, 'w-prem', {
      title: 'Premium Workout',
      difficulty: 'advanced',
      exercises: makeExercises(1),
      isPremium: true,
    });

    const workout = getWorkoutById(adapter, 'w-prem');
    expect(workout!.isPremium).toBe(true);
  });

  // ── updateWorkout ──

  it('updates title, description, and exercises', () => {
    createWorkout(adapter, 'w-upd', {
      title: 'Original',
      description: 'v1',
      difficulty: 'beginner',
      exercises: makeExercises(1),
    });

    const newExercises = makeExercises(4);
    updateWorkout(adapter, 'w-upd', {
      title: 'Updated Title',
      description: 'v2',
      difficulty: 'advanced',
      exercises: newExercises,
    });

    const updated = getWorkoutById(adapter, 'w-upd');
    expect(updated!.title).toBe('Updated Title');
    expect(updated!.description).toBe('v2');
    expect(updated!.difficulty).toBe('advanced');
    expect(updated!.exercises).toHaveLength(4);
  });

  // ── deleteWorkout ──

  it('deletes a workout', () => {
    createWorkout(adapter, 'w-del', {
      title: 'To Delete',
      difficulty: 'beginner',
      exercises: makeExercises(1),
    });

    deleteWorkout(adapter, 'w-del');
    expect(getWorkoutById(adapter, 'w-del')).toBeNull();
  });

  it('delete cascades to sessions', () => {
    createWorkout(adapter, 'w-cascade', {
      title: 'Cascade Test',
      difficulty: 'beginner',
      exercises: makeExercises(1),
    });
    createWorkoutSession(adapter, 's-cascade', {
      workoutId: 'w-cascade',
    });

    deleteWorkout(adapter, 'w-cascade');

    const sessions = getWorkoutSessions(adapter, { workoutId: 'w-cascade' });
    expect(sessions).toHaveLength(0);
  });

  // ── getWorkouts ──

  it('returns all workouts when no filters applied', () => {
    createWorkout(adapter, 'w-a', {
      title: 'Alpha',
      difficulty: 'beginner',
      exercises: makeExercises(1),
    });
    createWorkout(adapter, 'w-b', {
      title: 'Beta',
      difficulty: 'intermediate',
      exercises: makeExercises(1),
    });

    const all = getWorkouts(adapter);
    expect(all).toHaveLength(2);
    const ids = all.map((w) => w.id).sort();
    expect(ids).toEqual(['w-a', 'w-b']);
  });

  it('filters workouts by search text', () => {
    createWorkout(adapter, 'w-s1', {
      title: 'Morning Strength',
      difficulty: 'beginner',
      exercises: makeExercises(1),
    });
    createWorkout(adapter, 'w-s2', {
      title: 'Evening Cardio',
      difficulty: 'beginner',
      exercises: makeExercises(1),
    });

    const results = getWorkouts(adapter, { search: 'morning' });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Morning Strength');
  });

  it('filters workouts by difficulty', () => {
    createWorkout(adapter, 'w-d1', {
      title: 'Easy',
      difficulty: 'beginner',
      exercises: makeExercises(1),
    });
    createWorkout(adapter, 'w-d2', {
      title: 'Hard',
      difficulty: 'advanced',
      exercises: makeExercises(1),
    });

    const results = getWorkouts(adapter, { difficulty: 'advanced' });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Hard');
  });

  it('respects limit option', () => {
    for (let i = 0; i < 5; i++) {
      createWorkout(adapter, `w-lim-${i}`, {
        title: `Workout ${i}`,
        difficulty: 'beginner',
        exercises: makeExercises(1),
      });
    }

    const limited = getWorkouts(adapter, { limit: 2 });
    expect(limited).toHaveLength(2);
  });

  // ── getWorkoutById ──

  it('returns null for missing workout id', () => {
    expect(getWorkoutById(adapter, 'nonexistent')).toBeNull();
  });

  it('returns workout with JSON-parsed exercises', () => {
    const exercises = makeExercises(2);
    createWorkout(adapter, 'w-json', {
      title: 'JSON Check',
      difficulty: 'beginner',
      exercises,
    });

    const workout = getWorkoutById(adapter, 'w-json');
    expect(workout!.exercises).toHaveLength(2);
    expect(workout!.exercises[0].exerciseId).toBe('ex-1');
    expect(workout!.exercises[0].name).toBe('Push-up');
    expect(workout!.exercises[0].category).toBe('strength');
    expect(workout!.exercises[0].sets).toBe(3);
    expect(workout!.exercises[0].reps).toBe(10);
  });
});
