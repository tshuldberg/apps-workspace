import { describe, it, expect } from 'vitest';
import {
  BODY_MAP_MUSCLE_GROUPS,
  slugToMuscleGroup,
  muscleGroupToSlugs,
  muscleGroupLabel,
  buildHighlightData,
  EXERCISE_MUSCLE_MAPPINGS,
  getExercisesForMuscleGroup,
  getMuscleGroupsByRegion,
} from '../../body-map';

describe('BODY_MAP_MUSCLE_GROUPS', () => {
  it('has 14 entries', () => {
    expect(BODY_MAP_MUSCLE_GROUPS).toHaveLength(14);
  });

  it('contains chest, back, shoulders, and full_body among others', () => {
    const ids = BODY_MAP_MUSCLE_GROUPS.map((g) => g.id);
    expect(ids).toContain('chest');
    expect(ids).toContain('back');
    expect(ids).toContain('shoulders');
    expect(ids).toContain('full_body');
  });

  it('every entry has id, label, region, and side', () => {
    for (const group of BODY_MAP_MUSCLE_GROUPS) {
      expect(group).toHaveProperty('id');
      expect(group).toHaveProperty('label');
      expect(group).toHaveProperty('region');
      expect(group).toHaveProperty('side');
    }
  });
});

describe('slugToMuscleGroup', () => {
  it('maps "chest" slug to "chest" muscle group', () => {
    expect(slugToMuscleGroup('chest')).toBe('chest');
  });

  it('maps "upper-back" slug to "back" muscle group', () => {
    expect(slugToMuscleGroup('upper-back')).toBe('back');
  });

  it('maps "lower-back" slug to "back" muscle group', () => {
    expect(slugToMuscleGroup('lower-back')).toBe('back');
  });

  it('maps "deltoids" to "shoulders"', () => {
    expect(slugToMuscleGroup('deltoids')).toBe('shoulders');
  });

  it('maps "abs" to "core"', () => {
    expect(slugToMuscleGroup('abs')).toBe('core');
  });

  it('returns undefined for unknown slugs', () => {
    expect(slugToMuscleGroup('unknown-slug')).toBeUndefined();
    expect(slugToMuscleGroup('')).toBeUndefined();
  });
});

describe('muscleGroupToSlugs', () => {
  it('maps "back" to ["upper-back", "lower-back"]', () => {
    expect(muscleGroupToSlugs('back')).toEqual(['upper-back', 'lower-back']);
  });

  it('maps "full_body" to all slugs', () => {
    const slugs = muscleGroupToSlugs('full_body');
    expect(slugs).toContain('chest');
    expect(slugs).toContain('upper-back');
    expect(slugs).toContain('lower-back');
    expect(slugs).toContain('deltoids');
    expect(slugs).toContain('biceps');
    expect(slugs).toContain('triceps');
    expect(slugs).toContain('forearm');
    expect(slugs).toContain('abs');
    expect(slugs).toContain('obliques');
    expect(slugs).toContain('quadriceps');
    expect(slugs).toContain('hamstring');
    expect(slugs).toContain('gluteal');
    expect(slugs).toContain('calves');
    expect(slugs).toContain('adductors');
    expect(slugs).toContain('neck');
    expect(slugs).toHaveLength(15);
  });

  it('maps "chest" to ["chest"]', () => {
    expect(muscleGroupToSlugs('chest')).toEqual(['chest']);
  });

  it('maps "core" to ["abs", "obliques"]', () => {
    expect(muscleGroupToSlugs('core')).toEqual(['abs', 'obliques']);
  });
});

describe('muscleGroupLabel', () => {
  it('returns label for known muscle group', () => {
    expect(muscleGroupLabel('chest')).toBe('Chest');
    expect(muscleGroupLabel('quads')).toBe('Quadriceps');
    expect(muscleGroupLabel('hip_flexors')).toBe('Hip Flexors');
  });

  it('returns the group id as fallback for unknown group', () => {
    // Cast to bypass type check for testing fallback behavior
    expect(muscleGroupLabel('nonexistent' as never)).toBe('nonexistent');
  });
});

describe('buildHighlightData', () => {
  it('creates BodyHighlightDatum[] from selected groups with intensity 2', () => {
    const data = buildHighlightData(['chest']);
    expect(data).toEqual([
      { slug: 'chest', intensity: 2, color: '#6366F1' },
    ]);
  });

  it('expands muscle groups to their slugs', () => {
    const data = buildHighlightData(['back']);
    expect(data).toHaveLength(2);
    expect(data).toContainEqual({ slug: 'upper-back', intensity: 2, color: '#6366F1' });
    expect(data).toContainEqual({ slug: 'lower-back', intensity: 2, color: '#6366F1' });
  });

  it('uses custom color when provided', () => {
    const data = buildHighlightData(['chest'], '#FF0000');
    expect(data[0].color).toBe('#FF0000');
  });

  it('returns empty array for empty selection', () => {
    expect(buildHighlightData([])).toEqual([]);
  });

  it('handles multiple groups', () => {
    const data = buildHighlightData(['chest', 'biceps']);
    expect(data).toHaveLength(2);
    expect(data[0].slug).toBe('chest');
    expect(data[1].slug).toBe('biceps');
  });
});

describe('EXERCISE_MUSCLE_MAPPINGS', () => {
  it('has 12 entries', () => {
    expect(EXERCISE_MUSCLE_MAPPINGS).toHaveLength(12);
  });

  it('each entry has exerciseName, primary, and secondary arrays', () => {
    for (const mapping of EXERCISE_MUSCLE_MAPPINGS) {
      expect(mapping).toHaveProperty('exerciseName');
      expect(Array.isArray(mapping.primary)).toBe(true);
      expect(Array.isArray(mapping.secondary)).toBe(true);
    }
  });

  it('contains Push-up and Squat', () => {
    const names = EXERCISE_MUSCLE_MAPPINGS.map((m) => m.exerciseName);
    expect(names).toContain('Push-up');
    expect(names).toContain('Squat');
  });
});

describe('getExercisesForMuscleGroup', () => {
  it('finds exercises with primary match', () => {
    const exercises = getExercisesForMuscleGroup('chest');
    const names = exercises.map((e) => e.exerciseName);
    expect(names).toContain('Push-up');
  });

  it('finds exercises with secondary match', () => {
    const exercises = getExercisesForMuscleGroup('core');
    const names = exercises.map((e) => e.exerciseName);
    // Core is secondary for Squat, Deadlift, Lunge, Shoulder Press, Hip Thrust, Burpee
    expect(names).toContain('Squat');
    expect(names).toContain('Deadlift');
    // Also primary for Plank
    expect(names).toContain('Plank');
  });

  it('returns empty for a group with no exercises', () => {
    // neck has no exercises mapped
    const exercises = getExercisesForMuscleGroup('neck');
    expect(exercises).toHaveLength(0);
  });

  it('returns exercises for full_body', () => {
    const exercises = getExercisesForMuscleGroup('full_body');
    const names = exercises.map((e) => e.exerciseName);
    expect(names).toContain('Burpee');
  });
});

describe('getMuscleGroupsByRegion', () => {
  it('filters upper region groups', () => {
    const upper = getMuscleGroupsByRegion('upper');
    const ids = upper.map((g) => g.id);
    expect(ids).toContain('chest');
    expect(ids).toContain('back');
    expect(ids).toContain('shoulders');
    expect(ids).toContain('biceps');
    expect(ids).toContain('triceps');
    expect(ids).toContain('forearms');
    expect(ids).toContain('neck');
    expect(ids).not.toContain('quads');
  });

  it('filters core region groups', () => {
    const core = getMuscleGroupsByRegion('core');
    const ids = core.map((g) => g.id);
    expect(ids).toContain('core');
    expect(ids).toContain('full_body');
    expect(ids).not.toContain('chest');
  });

  it('filters lower region groups', () => {
    const lower = getMuscleGroupsByRegion('lower');
    const ids = lower.map((g) => g.id);
    expect(ids).toContain('quads');
    expect(ids).toContain('hamstrings');
    expect(ids).toContain('glutes');
    expect(ids).toContain('calves');
    expect(ids).toContain('hip_flexors');
    expect(ids).not.toContain('chest');
  });
});
