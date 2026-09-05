import type {
  MuscleGroup,
  MuscleGroupDefinition,
  MuscleGroupRegion,
  BodyHighlightDatum,
  ExerciseMuscleMapping,
} from './types';

export const BODY_MAP_MUSCLE_GROUPS: MuscleGroupDefinition[] = [
  { id: 'chest', label: 'Chest', region: 'upper', side: 'front' },
  { id: 'back', label: 'Back', region: 'upper', side: 'back' },
  { id: 'shoulders', label: 'Shoulders', region: 'upper', side: 'both' },
  { id: 'biceps', label: 'Biceps', region: 'upper', side: 'front' },
  { id: 'triceps', label: 'Triceps', region: 'upper', side: 'back' },
  { id: 'forearms', label: 'Forearms', region: 'upper', side: 'both' },
  { id: 'core', label: 'Core', region: 'core', side: 'front' },
  { id: 'quads', label: 'Quadriceps', region: 'lower', side: 'front' },
  { id: 'hamstrings', label: 'Hamstrings', region: 'lower', side: 'back' },
  { id: 'glutes', label: 'Glutes', region: 'lower', side: 'back' },
  { id: 'calves', label: 'Calves', region: 'lower', side: 'back' },
  { id: 'hip_flexors', label: 'Hip Flexors', region: 'lower', side: 'front' },
  { id: 'neck', label: 'Neck', region: 'upper', side: 'both' },
  { id: 'full_body', label: 'Full Body', region: 'core', side: 'both' },
];

export const SLUG_TO_MUSCLE_GROUP: Record<string, MuscleGroup> = {
  'chest': 'chest',
  'upper-back': 'back',
  'lower-back': 'back',
  'deltoids': 'shoulders',
  'biceps': 'biceps',
  'triceps': 'triceps',
  'forearm': 'forearms',
  'abs': 'core',
  'obliques': 'core',
  'quadriceps': 'quads',
  'hamstring': 'hamstrings',
  'gluteal': 'glutes',
  'calves': 'calves',
  'adductors': 'hip_flexors',
  'neck': 'neck',
};

export const MUSCLE_GROUP_TO_SLUGS: Record<MuscleGroup, string[]> = {
  chest: ['chest'],
  back: ['upper-back', 'lower-back'],
  shoulders: ['deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearm'],
  core: ['abs', 'obliques'],
  quads: ['quadriceps'],
  hamstrings: ['hamstring'],
  glutes: ['gluteal'],
  calves: ['calves'],
  hip_flexors: ['adductors'],
  neck: ['neck'],
  full_body: [
    'chest', 'upper-back', 'lower-back', 'deltoids', 'biceps', 'triceps',
    'forearm', 'abs', 'obliques', 'quadriceps', 'hamstring', 'gluteal',
    'calves', 'adductors', 'neck',
  ],
};

export function slugToMuscleGroup(slug: string): MuscleGroup | undefined {
  return SLUG_TO_MUSCLE_GROUP[slug];
}

export function muscleGroupToSlugs(group: MuscleGroup): string[] {
  return MUSCLE_GROUP_TO_SLUGS[group] ?? [];
}

export function muscleGroupLabel(group: MuscleGroup): string {
  return BODY_MAP_MUSCLE_GROUPS.find((g) => g.id === group)?.label ?? group;
}

export function buildHighlightData(
  selectedGroups: MuscleGroup[],
  color = '#6366F1',
): BodyHighlightDatum[] {
  const data: BodyHighlightDatum[] = [];
  for (const group of selectedGroups) {
    for (const slug of muscleGroupToSlugs(group)) {
      data.push({ slug, intensity: 2, color });
    }
  }
  return data;
}

export const EXERCISE_MUSCLE_MAPPINGS: ExerciseMuscleMapping[] = [
  { exerciseName: 'Push-up', primary: ['chest'], secondary: ['triceps', 'shoulders', 'core'] },
  { exerciseName: 'Pull-up', primary: ['back'], secondary: ['biceps', 'forearms'] },
  { exerciseName: 'Squat', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'core'] },
  { exerciseName: 'Deadlift', primary: ['back', 'hamstrings', 'glutes'], secondary: ['core', 'forearms'] },
  { exerciseName: 'Plank', primary: ['core'], secondary: ['shoulders'] },
  { exerciseName: 'Lunge', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'core'] },
  { exerciseName: 'Shoulder Press', primary: ['shoulders'], secondary: ['triceps', 'core'] },
  { exerciseName: 'Bicep Curl', primary: ['biceps'], secondary: ['forearms'] },
  { exerciseName: 'Tricep Dip', primary: ['triceps'], secondary: ['chest', 'shoulders'] },
  { exerciseName: 'Calf Raise', primary: ['calves'], secondary: [] },
  { exerciseName: 'Hip Thrust', primary: ['glutes'], secondary: ['hamstrings', 'core'] },
  { exerciseName: 'Burpee', primary: ['full_body'], secondary: ['chest', 'quads', 'core'] },
];

export function getExercisesForMuscleGroup(muscleGroup: MuscleGroup): ExerciseMuscleMapping[] {
  return EXERCISE_MUSCLE_MAPPINGS.filter(
    (m) => m.primary.includes(muscleGroup) || m.secondary.includes(muscleGroup)
  );
}

export function getMuscleGroupsByRegion(region: MuscleGroupRegion): MuscleGroupDefinition[] {
  return BODY_MAP_MUSCLE_GROUPS.filter((g) => g.region === region);
}
