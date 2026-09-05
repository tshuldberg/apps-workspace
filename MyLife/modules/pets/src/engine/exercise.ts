export interface ExerciseProgress {
  totalMinutes: number;
  goalMinutes: number | null;
  progressPct: number | null;
  goalMet: boolean | null;
}

export interface ExerciseStreak {
  streak: number;
  lastExerciseDate: string | null;
}

export interface ExerciseSummary {
  totalMinutes: number;
  totalDistanceKm: number;
  entryCount: number;
  exerciseDays: number;
  restDays: number;
  dailyAvg: number;
  longestActivity: number;
}

/**
 * Calculate daily exercise progress toward goal.
 * If no goal, progressPct and goalMet are null.
 */
export function calculateExerciseProgress(
  logs: Array<{ durationMinutes: number }>,
  goalMinutes: number | null,
): ExerciseProgress {
  const totalMinutes = logs.reduce((sum, l) => sum + l.durationMinutes, 0);
  if (goalMinutes === null) {
    return { totalMinutes, goalMinutes: null, progressPct: null, goalMet: null };
  }
  const progressPct = Math.min(Math.round((totalMinutes / goalMinutes) * 100), 100);
  return { totalMinutes, goalMinutes, progressPct, goalMet: totalMinutes >= goalMinutes };
}

/**
 * Calculate consecutive days with at least one exercise entry.
 * If today has no entry but it's still today (before midnight), check from yesterday.
 * dates should be sorted descending (most recent first), as YYYY-MM-DD strings.
 */
export function calculateExerciseStreak(
  exerciseDates: string[],
  today: string,
): ExerciseStreak {
  if (exerciseDates.length === 0) {
    return { streak: 0, lastExerciseDate: null };
  }

  const uniqueDates = [...new Set(exerciseDates)].sort().reverse();
  let streak = 0;
  let checkDate = today;

  // If no entry today, start checking from yesterday (today is still in progress)
  if (uniqueDates[0] !== today) {
    const yesterday = addDays(today, -1);
    if (uniqueDates[0] !== yesterday) {
      return { streak: 0, lastExerciseDate: uniqueDates[0] };
    }
    checkDate = yesterday;
  }

  const dateSet = new Set(uniqueDates);
  while (dateSet.has(checkDate)) {
    streak++;
    checkDate = addDays(checkDate, -1);
  }

  return { streak, lastExerciseDate: uniqueDates[0] };
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Compute aggregate exercise stats for a set of logs.
 * daysInPeriod must be >= 1.
 */
export function getExerciseSummary(
  logs: Array<{ durationMinutes: number; distanceKm: number | null; loggedAt: string }>,
  daysInPeriod: number,
): ExerciseSummary {
  if (logs.length === 0) {
    return { totalMinutes: 0, totalDistanceKm: 0, entryCount: 0, exerciseDays: 0, restDays: daysInPeriod, dailyAvg: 0, longestActivity: 0 };
  }
  const totalMinutes = logs.reduce((sum, l) => sum + l.durationMinutes, 0);
  const totalDistanceKm = logs.reduce((sum, l) => sum + (l.distanceKm ?? 0), 0);
  const exerciseDays = new Set(logs.map((l) => l.loggedAt.slice(0, 10))).size;
  const longestActivity = Math.max(...logs.map((l) => l.durationMinutes));
  const safeDays = Math.max(daysInPeriod, 1);

  return {
    totalMinutes,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    entryCount: logs.length,
    exerciseDays,
    restDays: Math.max(safeDays - exerciseDays, 0),
    dailyAvg: Math.round(totalMinutes / safeDays),
    longestActivity,
  };
}

/** Breed-based exercise recommendations (dogs only). */
const BREED_EXERCISE_MAP: Record<string, { min: number; max: number; level: string }> = {
  'bulldog': { min: 20, max: 40, level: 'low' },
  'basset hound': { min: 20, max: 40, level: 'low' },
  'shih tzu': { min: 20, max: 40, level: 'low' },
  'pug': { min: 20, max: 40, level: 'low' },
  'chihuahua': { min: 20, max: 30, level: 'low' },
  'golden retriever': { min: 60, max: 120, level: 'moderate' },
  'labrador retriever': { min: 60, max: 120, level: 'moderate' },
  'beagle': { min: 60, max: 120, level: 'moderate' },
  'cocker spaniel': { min: 45, max: 90, level: 'moderate' },
  'poodle': { min: 60, max: 120, level: 'moderate' },
  'border collie': { min: 90, max: 150, level: 'high' },
  'australian shepherd': { min: 90, max: 150, level: 'high' },
  'husky': { min: 90, max: 150, level: 'high' },
  'german shepherd': { min: 60, max: 120, level: 'high' },
  'dalmatian': { min: 90, max: 150, level: 'high' },
  'belgian malinois': { min: 120, max: 180, level: 'very_high' },
  'vizsla': { min: 120, max: 180, level: 'very_high' },
  'weimaraner': { min: 120, max: 180, level: 'very_high' },
};

export function getBreedExerciseRecommendation(
  species: string,
  breed: string | null,
): { minMinutes: number; maxMinutes: number; energyLevel: string } | null {
  if (species !== 'dog' || !breed) return null;
  const key = breed.toLowerCase();
  const match = BREED_EXERCISE_MAP[key];
  if (!match) return { minMinutes: 30, maxMinutes: 60, energyLevel: 'moderate' };
  return { minMinutes: match.min, maxMinutes: match.max, energyLevel: match.level };
}
