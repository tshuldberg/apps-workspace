import {
  MUSCLE_GROUP_LABELS,
  getWorkoutCategoryColor,
  type MuscleGroup,
  type WorkoutCategory,
  type WorkoutDefinition,
  type WorkoutDifficulty,
  type WorkoutExerciseLibraryItem,
  type WorkoutPlan,
} from '@mylife/workouts';
import type { WorkoutEquipmentOption } from './settings';

export const PHASE3_EQUIPMENT_OPTIONS: Array<{
  key: WorkoutEquipmentOption;
  label: string;
}> = [
  { key: 'barbell', label: 'Barbell' },
  { key: 'dumbbells', label: 'Dumbbells' },
  { key: 'kettlebells', label: 'Kettlebells' },
  { key: 'machines', label: 'Machines' },
  { key: 'bands', label: 'Bands' },
  { key: 'bodyweight', label: 'Bodyweight' },
];

const EQUIPMENT_MATCHERS: Record<WorkoutEquipmentOption, RegExp[]> = {
  barbell: [/barbell/i, /\bbench press\b/i, /\bdeadlift\b/i, /\bsquat\b/i],
  dumbbells: [/dumbbell/i, /\bdb\b/i],
  kettlebells: [/kettlebell/i],
  machines: [/machine/i, /cable/i, /\brower\b/i, /\bbattle rope/i],
  bands: [/band/i],
  bodyweight: [
    /push[- ]?up/i,
    /pull[- ]?up/i,
    /dip/i,
    /plank/i,
    /run/i,
    /jump/i,
    /burpee/i,
    /mountain climber/i,
    /mobility/i,
    /stretch/i,
    /breath/i,
    /bodyweight/i,
  ],
};

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (token) => token.toUpperCase());
}

export function formatCategoryLabel(category: WorkoutCategory | null | undefined): string {
  return category ? titleCase(category) : 'Mixed';
}

export function formatDifficultyLabel(difficulty: WorkoutDifficulty | string): string {
  return titleCase(difficulty);
}

export function getDifficultyStars(difficulty: WorkoutDifficulty | string): number {
  switch (difficulty) {
    case 'advanced':
      return 3;
    case 'intermediate':
      return 2;
    default:
      return 1;
  }
}

export function inferExerciseEquipment(
  exercise: Pick<WorkoutExerciseLibraryItem, 'name' | 'description' | 'category'>,
): WorkoutEquipmentOption[] {
  const haystack = `${exercise.name} ${exercise.description}`.toLowerCase();
  const matches = PHASE3_EQUIPMENT_OPTIONS
    .filter(({ key }) => EQUIPMENT_MATCHERS[key].some((pattern) => pattern.test(haystack)))
    .map(({ key }) => key);

  if (matches.length > 0) {
    return matches;
  }

  if (exercise.category === 'cardio' || exercise.category === 'mobility' || exercise.category === 'recovery') {
    return ['bodyweight'];
  }

  return ['dumbbells'];
}

export function getPrimaryEquipmentLabel(
  exercise: Pick<WorkoutExerciseLibraryItem, 'name' | 'description' | 'category'>,
): string {
  const [equipment] = inferExerciseEquipment(exercise);
  return PHASE3_EQUIPMENT_OPTIONS.find((item) => item.key === equipment)?.label ?? 'Mixed';
}

export function getPrimaryMuscle(exercise: Pick<WorkoutExerciseLibraryItem, 'muscleGroups'>): MuscleGroup | null {
  return exercise.muscleGroups[0] ?? null;
}

export function getSecondaryMuscleLabels(
  exercise: Pick<WorkoutExerciseLibraryItem, 'muscleGroups'>,
): string[] {
  return exercise.muscleGroups.slice(1, 4).map((muscle) => MUSCLE_GROUP_LABELS[muscle]);
}

export function getExerciseAccent(exercise: Pick<WorkoutExerciseLibraryItem, 'category'>): string {
  return getWorkoutCategoryColor(exercise.category);
}

export function withAlpha(color: string, alphaHex: string): string {
  return color.startsWith('#') && color.length === 7 ? `${color}${alphaHex}` : color;
}

export function getExerciseGradient(exercise: Pick<WorkoutExerciseLibraryItem, 'category'>): [string, string] {
  const accent = getExerciseAccent(exercise);
  return [withAlpha(accent, '99'), withAlpha(accent, '22')];
}

export function getExerciseArtworkLabel(exercise: Pick<WorkoutExerciseLibraryItem, 'name'>): string {
  const words = exercise.name.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
}

export function getPlanWorkoutCount(plan: WorkoutPlan): number {
  return plan.weeks.reduce((total, week) => {
    return total + week.days.filter((day) => !day.rest_day && day.workout_id).length;
  }, 0);
}

export function getPlanFrequency(plan: WorkoutPlan): number {
  return Math.max(
    ...plan.weeks.map((week) => {
      return week.days.filter((day) => !day.rest_day && day.workout_id).length;
    }),
    0,
  );
}

export function getPlanDifficulty(
  plan: WorkoutPlan,
  workoutsById?: Record<string, WorkoutDefinition>,
): WorkoutDifficulty {
  const title = plan.title.toLowerCase();
  if (title.includes('advanced') || title.includes('elite')) {
    return 'advanced';
  }
  if (title.includes('beginner') || title.includes('starter')) {
    return 'beginner';
  }

  if (!workoutsById) {
    return 'intermediate';
  }

  const scores = new Map<WorkoutDifficulty, number>([
    ['beginner', 0],
    ['intermediate', 0],
    ['advanced', 0],
  ]);

  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (!day.workout_id) continue;
      const difficulty = workoutsById[day.workout_id]?.difficulty;
      if (!difficulty) continue;
      scores.set(difficulty, (scores.get(difficulty) ?? 0) + 1);
    }
  }

  return Array.from(scores.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'intermediate';
}

export function getPlanEquipmentSummary(
  plan: WorkoutPlan,
  workoutsById: Record<string, WorkoutDefinition>,
  exercisesById: Record<string, WorkoutExerciseLibraryItem>,
): string[] {
  const equipment = new Map<string, number>();

  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (!day.workout_id) continue;
      const workout = workoutsById[day.workout_id];
      if (!workout) continue;

      for (const entry of workout.exercises) {
        const exercise = exercisesById[entry.exerciseId];
        if (!exercise) continue;

        for (const item of inferExerciseEquipment(exercise)) {
          const label =
            PHASE3_EQUIPMENT_OPTIONS.find((option) => option.key === item)?.label ?? titleCase(item);
          equipment.set(label, (equipment.get(label) ?? 0) + 1);
        }
      }
    }
  }

  return Array.from(equipment.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([label]) => label);
}
