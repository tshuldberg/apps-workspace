import type { WeightUnit } from '../types';

export type OverloadRuleType = 'weight_increment' | 'rep_increment' | 'set_increment' | 'percentage';
export type OverloadTrigger = 'all_sets_hit' | 'any_set_hit' | 'average_reps_hit';

export interface OverloadRule {
  id: string;
  exerciseId: string | null;
  ruleType: OverloadRuleType;
  triggerCondition: OverloadTrigger;
  targetReps: number | null;
  incrementValue: number;
  incrementUnit: 'lbs' | 'kg' | 'reps' | 'percent';
  minSessions: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OverloadSuggestion {
  exerciseId: string;
  suggestedWeight: number | null;
  suggestedReps: number | null;
  unit: WeightUnit;
  previousWeight: number;
  previousReps: number;
  ruleApplied: OverloadRuleType;
}

export interface ExercisePerformanceHistory {
  exerciseId: string;
  sessions: SessionSetData[];
}

export interface SessionSetData {
  sessionId: string;
  completedAt: string;
  sets: SetData[];
}

export interface SetData {
  setNumber: number;
  weight: number;
  reps: number;
  unit: WeightUnit;
}

/** Built-in default rule when no rules exist in the database. */
export const DEFAULT_OVERLOAD_RULE: Omit<OverloadRule, 'id' | 'createdAt' | 'updatedAt'> = {
  exerciseId: null,
  ruleType: 'weight_increment',
  triggerCondition: 'all_sets_hit',
  targetReps: 10,
  incrementValue: 5,
  incrementUnit: 'lbs',
  minSessions: 2,
  isActive: true,
};

/** Preset rule templates. */
export const OVERLOAD_PRESETS = {
  linear: {
    label: 'Linear progression (beginners)',
    ruleType: 'weight_increment' as const,
    triggerCondition: 'all_sets_hit' as const,
    targetReps: 10,
    incrementValue: 5,
    incrementUnit: 'lbs' as const,
    minSessions: 1,
  },
  double: {
    label: 'Double progression',
    ruleType: 'rep_increment' as const,
    triggerCondition: 'all_sets_hit' as const,
    targetReps: 12,
    incrementValue: 2,
    incrementUnit: 'reps' as const,
    minSessions: 2,
  },
  percentage: {
    label: 'Percentage-based',
    ruleType: 'percentage' as const,
    triggerCondition: 'all_sets_hit' as const,
    targetReps: 10,
    incrementValue: 2.5,
    incrementUnit: 'percent' as const,
    minSessions: 2,
  },
} as const;
