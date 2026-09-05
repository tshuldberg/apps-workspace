import type { WeightUnit, WorkoutCategory } from '../types';
import type {
  OverloadRule,
  OverloadSuggestion,
  ExercisePerformanceHistory,
  SessionSetData,
  SetData,
} from './types';
import { DEFAULT_OVERLOAD_RULE } from './types';

/** Categories that should NOT receive overload suggestions. */
const EXCLUDED_CATEGORIES: WorkoutCategory[] = ['cardio', 'mobility', 'flexibility', 'recovery'];

/**
 * Evaluate whether the trigger condition is met for an exercise.
 * Pure function: no DB dependency.
 */
export function evaluateTrigger(
  rule: Pick<OverloadRule, 'triggerCondition' | 'targetReps' | 'minSessions'>,
  history: SessionSetData[],
): boolean {
  const targetReps = rule.targetReps ?? 10;
  const recentSessions = history.slice(0, rule.minSessions);

  if (recentSessions.length < rule.minSessions) return false;

  switch (rule.triggerCondition) {
    case 'all_sets_hit':
      return recentSessions.every((session) =>
        session.sets.every((set) => set.reps >= targetReps),
      );

    case 'any_set_hit':
      // Only check the most recent session
      return recentSessions[0]?.sets.some((set) => set.reps >= targetReps) ?? false;

    case 'average_reps_hit': {
      const allReps = recentSessions.flatMap((s) => s.sets.map((set) => set.reps));
      if (allReps.length === 0) return false;
      const avg = allReps.reduce((sum, r) => sum + r, 0) / allReps.length;
      return avg >= targetReps;
    }

    default:
      return false;
  }
}

/**
 * Calculate the suggested weight/reps based on the rule type.
 * Pure function.
 */
export function calculateSuggestion(
  rule: Pick<OverloadRule, 'ruleType' | 'incrementValue' | 'incrementUnit'>,
  currentWeight: number,
  currentReps: number,
  currentUnit: WeightUnit,
): { weight: number | null; reps: number | null; unit: WeightUnit } {
  switch (rule.ruleType) {
    case 'weight_increment': {
      const increment = rule.incrementUnit === 'kg' && currentUnit === 'lbs'
        ? rule.incrementValue * 2.20462
        : rule.incrementUnit === 'lbs' && currentUnit === 'kg'
          ? rule.incrementValue / 2.20462
          : rule.incrementValue;
      return {
        weight: Math.round((currentWeight + increment) * 100) / 100,
        reps: currentReps,
        unit: currentUnit,
      };
    }

    case 'rep_increment':
      return {
        weight: currentWeight,
        reps: currentReps + Math.round(rule.incrementValue),
        unit: currentUnit,
      };

    case 'set_increment':
      // Set increment doesn't change weight or reps per set
      return { weight: currentWeight, reps: currentReps, unit: currentUnit };

    case 'percentage': {
      const increase = currentWeight * (rule.incrementValue / 100);
      return {
        weight: Math.round((currentWeight + increase) * 100) / 100,
        reps: currentReps,
        unit: currentUnit,
      };
    }

    default:
      return { weight: null, reps: null, unit: currentUnit };
  }
}

/**
 * Get the effective overload rule for an exercise.
 * Checks exercise-specific first, then global default, then built-in default.
 */
export function getEffectiveRule(
  exerciseId: string,
  rules: OverloadRule[],
): OverloadRule {
  // Exercise-specific rule
  const specific = rules.find((r) => r.exerciseId === exerciseId && r.isActive);
  if (specific) return specific;

  // Global default rule (exerciseId is null)
  const global = rules.find((r) => r.exerciseId === null && r.isActive);
  if (global) return global;

  // Built-in fallback
  return {
    ...DEFAULT_OVERLOAD_RULE,
    id: '__builtin_default__',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Generate overload suggestion for an exercise.
 * Pure function: takes rule, history, and exercise category. Returns suggestion or null.
 */
export function generateOverloadSuggestion(
  exerciseId: string,
  exerciseCategory: WorkoutCategory,
  rule: OverloadRule,
  history: ExercisePerformanceHistory | null,
): OverloadSuggestion | null {
  // Skip non-strength exercises
  if (EXCLUDED_CATEGORIES.includes(exerciseCategory)) return null;

  // Need history to make suggestions
  if (!history || history.sessions.length === 0) return null;

  // Sort sessions newest first
  const sortedSessions = [...history.sessions].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );

  // Get the current working weight/reps from the most recent session, set 1
  const lastSession = sortedSessions[0];
  if (!lastSession || lastSession.sets.length === 0) return null;

  const firstSet = lastSession.sets.reduce(
    (best: SetData | null, s) => (!best || s.setNumber < best.setNumber ? s : best),
    null,
  );
  if (!firstSet) return null;

  const currentWeight = firstSet.weight;
  const currentReps = firstSet.reps;
  const currentUnit = firstSet.unit;

  // Evaluate trigger
  if (!evaluateTrigger(rule, sortedSessions)) return null;

  // Calculate suggestion
  const { weight, reps, unit } = calculateSuggestion(
    rule,
    currentWeight,
    currentReps,
    currentUnit,
  );

  if (weight === null && reps === null) return null;

  return {
    exerciseId,
    suggestedWeight: weight,
    suggestedReps: reps,
    unit,
    previousWeight: currentWeight,
    previousReps: currentReps,
    ruleApplied: rule.ruleType,
  };
}
