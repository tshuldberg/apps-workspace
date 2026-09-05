import { describe, expect, it } from 'vitest';
import { planRepeatSession, type RepeatExerciseLibraryLookup, type RepeatSessionInput } from '../repeat-session';

type TestCategory = 'strength' | 'core';

const LIBRARY: Record<string, RepeatExerciseLibraryLookup<TestCategory>> = {
  'ex-1': { exerciseId: 'ex-1', name: 'Bench Press', category: 'strength', defaultDuration: null },
  'ex-2': { exerciseId: 'ex-2', name: 'Plank', category: 'core', defaultDuration: 45 },
};

function lookupExercise(id: string): RepeatExerciseLibraryLookup<TestCategory> | null {
  return LIBRARY[id] ?? null;
}

describe('planRepeatSession', () => {
  it('reuses the source workout when it still exists', () => {
    const session: RepeatSessionInput = {
      workoutId: 'w-1',
      exercisesCompleted: [],
    };

    const plan = planRepeatSession(session, {
      workoutStillExists: true,
      fallbackTitle: 'Push Day',
      lookupExercise,
    });

    expect(plan).toEqual({ kind: 'existing-workout', workoutId: 'w-1' });
  });

  it('rebuilds a workout from completed exercises when the source was deleted', () => {
    const session: RepeatSessionInput = {
      workoutId: 'w-deleted',
      exercisesCompleted: [
        { exerciseId: 'ex-1', setsCompleted: 4, repsCompleted: 8, skipped: false },
        { exerciseId: 'ex-2', setsCompleted: 3, repsCompleted: null, skipped: false },
      ],
    };

    const plan = planRepeatSession(session, {
      workoutStillExists: false,
      fallbackTitle: 'Push Day',
      lookupExercise,
    });

    expect(plan.kind).toBe('rebuild');
    if (plan.kind !== 'rebuild') throw new Error('expected rebuild plan');
    expect(plan.title).toBe('Push Day');
    expect(plan.exercises).toEqual([
      {
        exerciseId: 'ex-1',
        name: 'Bench Press',
        category: 'strength',
        sets: 4,
        reps: 8,
        duration: null,
        restAfter: 60,
        order: 0,
      },
      {
        exerciseId: 'ex-2',
        name: 'Plank',
        category: 'core',
        sets: 3,
        reps: null,
        duration: 45,
        restAfter: 60,
        order: 1,
      },
    ]);
  });

  it('skips exercises the user skipped and exercises no longer in the library', () => {
    const session: RepeatSessionInput = {
      workoutId: 'w-deleted',
      exercisesCompleted: [
        { exerciseId: 'ex-1', setsCompleted: 3, repsCompleted: 10, skipped: true },
        { exerciseId: 'ex-missing', setsCompleted: 3, repsCompleted: 10, skipped: false },
        { exerciseId: 'ex-2', setsCompleted: 2, repsCompleted: 12, skipped: false },
      ],
    };

    const plan = planRepeatSession(session, {
      workoutStillExists: false,
      fallbackTitle: 'Core Day',
      lookupExercise,
    });

    expect(plan.kind).toBe('rebuild');
    if (plan.kind !== 'rebuild') throw new Error('expected rebuild plan');
    expect(plan.exercises).toHaveLength(1);
    expect(plan.exercises[0].exerciseId).toBe('ex-2');
  });

  it('falls back to setsCompleted=1 when the session recorded zero sets', () => {
    const session: RepeatSessionInput = {
      workoutId: 'w-deleted',
      exercisesCompleted: [
        { exerciseId: 'ex-1', setsCompleted: 0, repsCompleted: 0, skipped: false },
      ],
    };

    const plan = planRepeatSession(session, {
      workoutStillExists: false,
      fallbackTitle: 'Bench Day',
      lookupExercise,
    });

    expect(plan.kind).toBe('rebuild');
    if (plan.kind !== 'rebuild') throw new Error('expected rebuild plan');
    expect(plan.exercises[0].sets).toBe(1);
    expect(plan.exercises[0].reps).toBeNull();
  });

  it('returns unavailable when nothing can be rebuilt', () => {
    const session: RepeatSessionInput = {
      workoutId: 'w-deleted',
      exercisesCompleted: [
        { exerciseId: 'ex-1', setsCompleted: 3, repsCompleted: 10, skipped: true },
        { exerciseId: 'ex-missing', setsCompleted: 3, repsCompleted: 10, skipped: false },
      ],
    };

    const plan = planRepeatSession(session, {
      workoutStillExists: false,
      fallbackTitle: 'Push Day',
      lookupExercise,
    });

    expect(plan).toEqual({ kind: 'unavailable' });
  });
});
