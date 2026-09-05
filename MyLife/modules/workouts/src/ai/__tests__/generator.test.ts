import { describe, it, expect } from 'vitest';
import { generateLocalWorkout } from '../generator';
import type { GenerationRequest } from '../generator';
import type { WorkoutExerciseLibraryItem } from '../../types';

function makeExercise(overrides: Partial<WorkoutExerciseLibraryItem> = {}): WorkoutExerciseLibraryItem {
  return {
    id: `ex-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Bench Press',
    description: 'Standard bench press',
    category: 'strength',
    muscleGroups: ['chest'],
    difficulty: 'intermediate',
    defaultSets: 3,
    defaultReps: 10,
    defaultDuration: null,
    videoUrl: null,
    thumbnailUrl: null,
    audioCues: [],
    isPremium: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeLibrary(): WorkoutExerciseLibraryItem[] {
  return [
    makeExercise({ id: 'ex-bench', name: 'Bench Press', muscleGroups: ['chest'], category: 'strength' }),
    makeExercise({ id: 'ex-squat', name: 'Squat', muscleGroups: ['quads', 'glutes'], category: 'strength' }),
    makeExercise({ id: 'ex-row', name: 'Barbell Row', muscleGroups: ['back'], category: 'strength' }),
    makeExercise({ id: 'ex-press', name: 'Shoulder Press', muscleGroups: ['shoulders'], category: 'strength' }),
    makeExercise({ id: 'ex-curl', name: 'Bicep Curl', muscleGroups: ['biceps'], category: 'strength' }),
    makeExercise({ id: 'ex-dip', name: 'Tricep Dip', muscleGroups: ['triceps'], category: 'strength' }),
    makeExercise({ id: 'ex-deadlift', name: 'Deadlift', muscleGroups: ['back', 'hamstrings', 'glutes'], category: 'strength' }),
    makeExercise({ id: 'ex-lunge', name: 'Lunge', muscleGroups: ['quads', 'glutes'], category: 'strength' }),
    makeExercise({ id: 'ex-plank', name: 'Plank', muscleGroups: ['core'], category: 'strength', defaultDuration: 60, defaultReps: null }),
    makeExercise({ id: 'ex-run', name: 'Running', muscleGroups: ['full_body'], category: 'cardio', defaultDuration: 1200, defaultReps: null }),
  ];
}

describe('generateLocalWorkout', () => {
  it('generates correct number of exercises for 30 min', () => {
    const request: GenerationRequest = {
      goal: 'hypertrophy',
      muscleFocus: ['chest', 'back'],
      equipment: ['barbell', 'dumbbells'],
      durationMinutes: 30,
      difficulty: 'intermediate',
    };
    const result = generateLocalWorkout(request, makeLibrary());
    expect(result).not.toBeNull();
    expect(result!.exercises.length).toBe(5);
  });

  it('generates correct number of exercises for 60 min', () => {
    const request: GenerationRequest = {
      goal: 'general',
      muscleFocus: ['chest', 'back', 'quads'],
      equipment: ['bodyweight'],
      durationMinutes: 60,
      difficulty: 'beginner',
    };
    const result = generateLocalWorkout(request, makeLibrary());
    expect(result).not.toBeNull();
    expect(result!.exercises.length).toBe(9);
  });

  it('programs correct rep ranges for strength goal', () => {
    const request: GenerationRequest = {
      goal: 'strength',
      muscleFocus: ['chest'],
      equipment: ['barbell'],
      durationMinutes: 30,
      difficulty: 'intermediate',
    };
    const result = generateLocalWorkout(request, makeLibrary());
    expect(result).not.toBeNull();
    for (const ex of result!.exercises) {
      if (ex.reps !== null) {
        expect(ex.reps).toBeGreaterThanOrEqual(3);
        expect(ex.reps).toBeLessThanOrEqual(6);
      }
      expect(ex.sets).toBeGreaterThanOrEqual(4);
      expect(ex.sets).toBeLessThanOrEqual(5);
    }
  });

  it('programs correct rep ranges for endurance goal', () => {
    const request: GenerationRequest = {
      goal: 'endurance',
      muscleFocus: ['quads'],
      equipment: ['bodyweight'],
      durationMinutes: 30,
      difficulty: 'beginner',
    };
    const result = generateLocalWorkout(request, makeLibrary());
    expect(result).not.toBeNull();
    for (const ex of result!.exercises) {
      if (ex.reps !== null) {
        expect(ex.reps).toBeGreaterThanOrEqual(15);
        expect(ex.reps).toBeLessThanOrEqual(20);
      }
    }
  });

  it('returns null for empty exercise library', () => {
    const request: GenerationRequest = {
      goal: 'general',
      muscleFocus: ['chest'],
      equipment: ['barbell'],
      durationMinutes: 30,
      difficulty: 'intermediate',
    };
    const result = generateLocalWorkout(request, []);
    expect(result).toBeNull();
  });

  it('returns a valid WorkoutDefinition-like structure', () => {
    const request: GenerationRequest = {
      goal: 'hypertrophy',
      muscleFocus: ['chest', 'triceps'],
      equipment: ['barbell'],
      durationMinutes: 45,
      difficulty: 'intermediate',
    };
    const result = generateLocalWorkout(request, makeLibrary());
    expect(result).not.toBeNull();
    expect(result!.title).toBeTruthy();
    expect(result!.description).toBeTruthy();
    expect(result!.difficulty).toBe('intermediate');
    expect(result!.estimatedDuration).toBeGreaterThan(0);
    for (const ex of result!.exercises) {
      expect(ex.exerciseId).toBeTruthy();
      expect(ex.name).toBeTruthy();
      expect(typeof ex.order).toBe('number');
    }
  });

  it('de-prioritizes recently used exercises', () => {
    const library = makeLibrary();
    const recentIds = new Set(['ex-bench', 'ex-squat', 'ex-row', 'ex-press', 'ex-curl']);
    const request: GenerationRequest = {
      goal: 'general',
      muscleFocus: ['chest', 'back', 'quads'],
      equipment: ['barbell'],
      durationMinutes: 30,
      difficulty: 'intermediate',
    };
    const result = generateLocalWorkout(request, library, recentIds);
    expect(result).not.toBeNull();
    // Non-recent exercises should appear, though recent ones can still fill slots
    const exerciseIds = result!.exercises.map((e) => e.exerciseId);
    const nonRecentCount = exerciseIds.filter((id) => !recentIds.has(id)).length;
    expect(nonRecentCount).toBeGreaterThan(0);
  });
});
