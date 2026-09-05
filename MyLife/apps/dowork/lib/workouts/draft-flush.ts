// Pure decision logic for BH-1: flushing the in-progress draft set when a
// workout is finalized. Lives outside session.tsx so the "should we persist
// this last typed-but-unconfirmed set?" rule can be unit tested without a
// react-native renderer.
//
// The player screen keeps a per-set draft of the typed weight/reps that only
// gets written to the DB when the user taps Mark Complete. If they tap End
// Workout mid-set instead, that typed set would be silently lost. This helper
// decides whether that draft should be flushed and, if so, returns the exact
// set to record. It never writes anything itself; the caller owns the DB call.

export interface DraftFlushExercise {
  exercise_id: string;
  reps: number | null;
}

export interface DraftFlushStatus {
  state: string;
  currentExerciseIndex: number;
  currentSet: number;
  exercises: DraftFlushExercise[];
}

export interface DraftFlushDraft {
  weight: string;
  reps: string;
}

export interface DraftFlushRecordedSet {
  exerciseId: string;
  setNumber: number;
}

export interface DraftFlushArgs {
  status: DraftFlushStatus;
  completedSets: DraftFlushRecordedSet[];
  // Returns the current draft for a given exercise/set, or undefined when the
  // user never typed anything for it.
  getDraft: (exerciseId: string, setNumber: number) => DraftFlushDraft | undefined;
}

export interface DraftFlushDecision {
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
}

// Returns the set to flush, or null when nothing should be written. A set is
// only flushed when: the workout is not already in the 'completed' state, there
// is an exercise at the current index, that exact set has not already been
// recorded via Mark Complete, and both the resolved weight and reps are > 0.
// Reps fall back to the exercise's programmed reps when the draft omitted them;
// weight has no fallback (an untyped weight means the user did not log this set).
export function resolveDraftSetFlush(args: DraftFlushArgs): DraftFlushDecision | null {
  const { status, completedSets, getDraft } = args;

  if (status.state === 'completed') return null;

  const exercise = status.exercises[status.currentExerciseIndex];
  if (!exercise) return null;

  const setNumber = status.currentSet;
  const alreadyRecorded = completedSets.some(
    (item) => item.exerciseId === exercise.exercise_id && item.setNumber === setNumber,
  );
  if (alreadyRecorded) return null;

  const draft = getDraft(exercise.exercise_id, setNumber);
  // A blank draft reps field counts as omitted (not zero), so it falls back to
  // the exercise's programmed reps. `??` alone would keep an empty string and
  // parse it to 0, silently dropping a set whose weight the user did type.
  const draftReps = draft?.reps?.trim() ?? '';
  const reps = Number(draftReps.length > 0 ? draftReps : exercise.reps ?? 0);
  const weight = Number(draft?.weight ?? 0);
  if (!(reps > 0) || !(weight > 0)) return null;

  return { exerciseId: exercise.exercise_id, setNumber, weight, reps };
}
