import type {
  WorkoutCategory,
  WorkoutDifficulty,
  WorkoutExerciseEntry,
  WorkoutExerciseLibraryItem,
} from '../types';

export type GenerationGoal = 'strength' | 'hypertrophy' | 'endurance' | 'general';
export type EquipmentType = 'barbell' | 'dumbbells' | 'cables' | 'machines' | 'bodyweight' | 'bands' | 'kettlebell';

export interface GenerationRequest {
  goal: GenerationGoal;
  muscleFocus: string[];
  equipment: EquipmentType[];
  durationMinutes: number;
  difficulty: WorkoutDifficulty;
}

export interface GeneratedWorkout {
  title: string;
  description: string;
  difficulty: WorkoutDifficulty;
  exercises: WorkoutExerciseEntry[];
  estimatedDuration: number;
}

// ── Goal-based programming constants ──

const GOAL_PROGRAMMING: Record<GenerationGoal, { setsRange: [number, number]; repsRange: [number, number]; restSeconds: number }> = {
  strength: { setsRange: [4, 5], repsRange: [3, 6], restSeconds: 180 },
  hypertrophy: { setsRange: [3, 4], repsRange: [8, 12], restSeconds: 90 },
  endurance: { setsRange: [2, 3], repsRange: [15, 20], restSeconds: 45 },
  general: { setsRange: [3, 3], repsRange: [10, 12], restSeconds: 60 },
};

const GOAL_CATEGORY_PRIORITY: Record<GenerationGoal, WorkoutCategory[]> = {
  strength: ['strength', 'balance'],
  hypertrophy: ['strength', 'balance'],
  endurance: ['cardio', 'strength'],
  general: ['strength', 'cardio', 'balance', 'mobility'],
};

function getExerciseCount(durationMinutes: number): number {
  if (durationMinutes <= 30) return 5;
  if (durationMinutes <= 45) return 7;
  if (durationMinutes <= 60) return 9;
  return 11;
}

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Score an exercise for selection based on how well it matches the request.
 */
function scoreExercise(
  exercise: WorkoutExerciseLibraryItem,
  request: GenerationRequest,
  recentExerciseIds: Set<string>,
): number {
  let score = 0;

  // Muscle group match
  const focusLower = request.muscleFocus.map((f) => f.toLowerCase());
  const muscleMatch = exercise.muscleGroups.some((mg) =>
    focusLower.includes(mg.toLowerCase()),
  );
  if (muscleMatch) score += 30;

  // Difficulty match
  if (exercise.difficulty === request.difficulty) score += 15;

  // Category match for goal
  const priorityCategories = GOAL_CATEGORY_PRIORITY[request.goal];
  const catIndex = priorityCategories.indexOf(exercise.category);
  if (catIndex >= 0) score += (priorityCategories.length - catIndex) * 5;

  // Compound exercises get a bonus for strength/hypertrophy
  if (exercise.muscleGroups.length >= 3) {
    if (request.goal === 'strength' || request.goal === 'hypertrophy') {
      score += 10;
    }
  }

  // Freshness: de-prioritize recently used exercises
  if (recentExerciseIds.has(exercise.id)) score -= 20;

  // Small random factor for variety
  score += Math.random() * 5;

  return score;
}

/**
 * Generate a workout locally using rule-based exercise selection.
 * Pure function: no DB or network dependency.
 */
export function generateLocalWorkout(
  request: GenerationRequest,
  availableExercises: WorkoutExerciseLibraryItem[],
  recentExerciseIds: Set<string> = new Set(),
): GeneratedWorkout | null {
  if (availableExercises.length === 0) return null;

  const targetCount = getExerciseCount(request.durationMinutes);
  const programming = GOAL_PROGRAMMING[request.goal];

  // Score and sort exercises
  const scored = availableExercises
    .map((ex) => ({ exercise: ex, score: scoreExercise(ex, request, recentExerciseIds) }))
    .sort((a, b) => b.score - a.score);

  // Select top exercises, avoiding duplicate muscle groups unless focused
  const selected: WorkoutExerciseLibraryItem[] = [];
  const usedMuscleGroups = new Set<string>();

  for (const { exercise } of scored) {
    if (selected.length >= targetCount) break;

    // Check for muscle group diversity (skip if 2+ exercises already hit this group)
    const primaryMuscle = exercise.muscleGroups[0];
    if (primaryMuscle && request.muscleFocus.length > 1) {
      const countForGroup = selected.filter((s) =>
        s.muscleGroups[0] === primaryMuscle,
      ).length;
      if (countForGroup >= 2) continue;
    }

    selected.push(exercise);
    for (const mg of exercise.muscleGroups) {
      usedMuscleGroups.add(mg);
    }
  }

  // If we didn't get enough, fill from remaining
  if (selected.length < targetCount) {
    for (const { exercise } of scored) {
      if (selected.length >= targetCount) break;
      if (!selected.includes(exercise)) {
        selected.push(exercise);
      }
    }
  }

  if (selected.length === 0) return null;

  // Build exercise entries with goal-specific programming
  const exercises: WorkoutExerciseEntry[] = selected.map((ex, index) => ({
    exerciseId: ex.id,
    name: ex.name,
    category: ex.category,
    sets: randomInRange(programming.setsRange[0], programming.setsRange[1]),
    reps: ex.defaultDuration ? null : randomInRange(programming.repsRange[0], programming.repsRange[1]),
    duration: ex.defaultDuration ?? null,
    restAfter: programming.restSeconds,
    order: index,
  }));

  // Estimate duration
  let estimatedSeconds = 0;
  for (const ex of exercises) {
    const reps = ex.reps ?? 10;
    const duration = ex.duration ?? reps * 3;
    estimatedSeconds += duration * ex.sets;
    estimatedSeconds += programming.restSeconds * (ex.sets - 1);
  }
  const estimatedMinutes = Math.round(estimatedSeconds / 60);

  // Generate title
  const focusLabel = request.muscleFocus.length > 0
    ? request.muscleFocus.slice(0, 2).join(' & ')
    : request.goal;
  const title = `${focusLabel.charAt(0).toUpperCase() + focusLabel.slice(1)} ${request.goal} workout`;

  return {
    title,
    description: `${request.difficulty} ${request.goal} workout targeting ${request.muscleFocus.join(', ')}. ${estimatedMinutes} min estimated.`,
    difficulty: request.difficulty,
    exercises,
    estimatedDuration: estimatedSeconds,
  };
}
