// IMP-9 runtime glue: turn a "repeat this session" tap into a navigation.
//
// The pure decision lives in `planRepeatSession` (repeat-session.ts). This
// module is the thin db + router adapter around it so the Progress tab and the
// Home dashboard invoke repeat with exactly the same behavior the History
// screen uses: start the source workout when it still exists, otherwise rebuild
// a one-off workout from the completed sets, otherwise report honestly that the
// session no longer has enough to rebuild.

import type { DatabaseAdapter } from '@mylife/db';
import {
  createWorkout,
  getWorkoutById,
  getWorkoutExerciseById,
  getWorkoutSessions,
} from '@mylife/workouts';
import type { WorkoutCategory } from '@mylife/workouts';
import { planRepeatSession } from './repeat-session';
import { uuid } from '../uuid';

export interface RunRepeatResult {
  ok: boolean;
  workoutId?: string;
  reason?: string;
}

// Resolves what the given completed session should start when repeated and
// returns the workout id to navigate to. Creates a rebuilt workout row when the
// original was deleted. Returns `ok: false` with a user-facing reason when the
// session is gone or has nothing to rebuild from.
export function resolveRepeatWorkout(
  db: DatabaseAdapter,
  sessionId: string,
  fallbackTitle: string,
): RunRepeatResult {
  const session = getWorkoutSessions(db, { limit: 500 }).find(
    (item) => item.id === sessionId,
  );
  if (!session) {
    return { ok: false, reason: 'That session could no longer be found.' };
  }

  const sourceWorkout = getWorkoutById(db, session.workoutId);
  const plan = planRepeatSession<WorkoutCategory>(
    {
      workoutId: session.workoutId,
      exercisesCompleted: session.exercisesCompleted.map((item) => ({
        exerciseId: item.exerciseId,
        setsCompleted: item.setsCompleted,
        repsCompleted: item.repsCompleted,
        skipped: item.skipped,
      })),
    },
    {
      workoutStillExists: sourceWorkout != null,
      fallbackTitle,
      lookupExercise: (exerciseId) => {
        const item = getWorkoutExerciseById(db, exerciseId);
        if (!item) return null;
        return {
          exerciseId: item.id,
          name: item.name,
          category: item.category,
          defaultDuration: item.defaultDuration,
        };
      },
    },
  );

  if (plan.kind === 'existing-workout') {
    return { ok: true, workoutId: plan.workoutId };
  }

  if (plan.kind === 'rebuild') {
    const newWorkoutId = uuid();
    createWorkout(db, newWorkoutId, {
      title: plan.title,
      difficulty: 'intermediate',
      exercises: plan.exercises,
    });
    return { ok: true, workoutId: newWorkoutId };
  }

  return {
    ok: false,
    reason: 'This session no longer has enough information to rebuild the workout.',
  };
}
