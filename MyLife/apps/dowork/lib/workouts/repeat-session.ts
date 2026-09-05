// Pure decision logic for IMP-9: "Repeat" / "Do it again" on a past session.
//
// The gym flow after finishing a workout is almost always "same thing again
// next time" and today that means rebuilding the workout by hand. This
// module decides how to answer "what should Repeat start?" without touching
// the database itself, so the branching (source workout still exists vs. was
// deleted) can be unit tested without a SQLite adapter or a router.

export interface RepeatSessionInput {
  workoutId: string;
  exercisesCompleted: Array<{
    exerciseId: string;
    setsCompleted: number;
    repsCompleted: number | null;
    skipped: boolean;
  }>;
}

// Generic over the exercise category type so this module stays free of a
// direct `@mylife/workouts` dependency (mirrors draft-flush.ts) while still
// letting callers get a `WorkoutCategory`-typed result back with no cast.
export interface RepeatExerciseLibraryLookup<TCategory> {
  exerciseId: string;
  name: string;
  category: TCategory;
  defaultDuration: number | null;
}

export type RepeatPlan<TCategory> =
  | { kind: 'existing-workout'; workoutId: string }
  | { kind: 'rebuild'; title: string; exercises: RepeatWorkoutExercise<TCategory>[] }
  | { kind: 'unavailable' };

export interface RepeatWorkoutExercise<TCategory> {
  exerciseId: string;
  name: string;
  category: TCategory;
  sets: number;
  reps: number | null;
  duration: number | null;
  restAfter: number;
  order: number;
}

const DEFAULT_REST_AFTER_SECONDS = 60;

// Decides the repeat plan for a past session. When the workout that produced
// the session still exists, repeating is just "start that workout again" -
// the caller re-navigates through the normal session-start route. When the
// workout was deleted (CG-5 now lets users delete saved workouts), the only
// record of what was actually done lives on the completed session, so this
// rebuilds a workout definition from the non-skipped completed exercises,
// looking up each exercise's name/category from the library because
// `CompletedExercise` only stores id + performance numbers.
export function planRepeatSession<TCategory>(
  session: RepeatSessionInput,
  options: {
    workoutStillExists: boolean;
    fallbackTitle: string;
    lookupExercise: (exerciseId: string) => RepeatExerciseLibraryLookup<TCategory> | null;
  },
): RepeatPlan<TCategory> {
  if (options.workoutStillExists) {
    return { kind: 'existing-workout', workoutId: session.workoutId };
  }

  const exercises: RepeatWorkoutExercise<TCategory>[] = [];
  session.exercisesCompleted.forEach((completed, index) => {
    if (completed.skipped) return;
    const library = options.lookupExercise(completed.exerciseId);
    if (!library) return;
    exercises.push({
      exerciseId: completed.exerciseId,
      name: library.name,
      category: library.category,
      sets: completed.setsCompleted > 0 ? completed.setsCompleted : 1,
      reps: completed.repsCompleted && completed.repsCompleted > 0 ? completed.repsCompleted : null,
      duration: library.defaultDuration,
      restAfter: DEFAULT_REST_AFTER_SECONDS,
      order: index,
    });
  });

  if (exercises.length === 0) {
    return { kind: 'unavailable' };
  }

  return { kind: 'rebuild', title: options.fallbackTitle, exercises };
}
