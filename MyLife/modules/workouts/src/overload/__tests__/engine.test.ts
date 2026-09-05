import { describe, it, expect } from 'vitest';
import {
  evaluateTrigger,
  calculateSuggestion,
  getEffectiveRule,
  generateOverloadSuggestion,
} from '../engine';
import type { OverloadRule } from '../../types';
import type { SessionSetData, ExercisePerformanceHistory } from '../types';

function makeRule(overrides: Partial<OverloadRule> = {}): OverloadRule {
  return {
    id: 'rule-1',
    exerciseId: null,
    ruleType: 'weight_increment',
    triggerCondition: 'all_sets_hit',
    targetReps: 10,
    incrementValue: 5,
    incrementUnit: 'lbs',
    minSessions: 2,
    isActive: true,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

function makeSession(reps: number[], weight = 135): SessionSetData {
  return {
    sessionId: `sess-${Math.random()}`,
    completedAt: new Date().toISOString(),
    sets: reps.map((r, i) => ({ setNumber: i + 1, weight, reps: r, unit: 'lbs' as const })),
  };
}

describe('evaluateTrigger', () => {
  it('all_sets_hit returns true when all sets >= target for min sessions', () => {
    const result = evaluateTrigger(
      { triggerCondition: 'all_sets_hit', targetReps: 10, minSessions: 2 },
      [makeSession([10, 10, 10]), makeSession([10, 11, 10])],
    );
    expect(result).toBe(true);
  });

  it('all_sets_hit returns false when one set misses target', () => {
    const result = evaluateTrigger(
      { triggerCondition: 'all_sets_hit', targetReps: 10, minSessions: 2 },
      [makeSession([10, 9, 10]), makeSession([10, 10, 10])],
    );
    expect(result).toBe(false);
  });

  it('all_sets_hit returns false with fewer sessions than required', () => {
    const result = evaluateTrigger(
      { triggerCondition: 'all_sets_hit', targetReps: 10, minSessions: 3 },
      [makeSession([10, 10, 10]), makeSession([10, 10, 10])],
    );
    expect(result).toBe(false);
  });

  it('any_set_hit returns true when at least one set hits target', () => {
    const result = evaluateTrigger(
      { triggerCondition: 'any_set_hit', targetReps: 10, minSessions: 1 },
      [makeSession([8, 10, 7])],
    );
    expect(result).toBe(true);
  });

  it('average_reps_hit calculates average correctly', () => {
    // Average: (10+8+12+10+8+12)/6 = 10
    const result = evaluateTrigger(
      { triggerCondition: 'average_reps_hit', targetReps: 10, minSessions: 2 },
      [makeSession([10, 8, 12]), makeSession([10, 8, 12])],
    );
    expect(result).toBe(true);
  });
});

describe('calculateSuggestion', () => {
  it('weight_increment adds correct value in lbs', () => {
    const result = calculateSuggestion(
      { ruleType: 'weight_increment', incrementValue: 5, incrementUnit: 'lbs' },
      135, 10, 'lbs',
    );
    expect(result.weight).toBe(140);
    expect(result.reps).toBe(10);
  });

  it('weight_increment converts kg to lbs', () => {
    const result = calculateSuggestion(
      { ruleType: 'weight_increment', incrementValue: 2.5, incrementUnit: 'kg' },
      135, 10, 'lbs',
    );
    // 2.5 kg = ~5.51 lbs
    expect(result.weight).toBeCloseTo(140.51, 1);
  });

  it('rep_increment adds reps', () => {
    const result = calculateSuggestion(
      { ruleType: 'rep_increment', incrementValue: 2, incrementUnit: 'reps' },
      135, 10, 'lbs',
    );
    expect(result.weight).toBe(135);
    expect(result.reps).toBe(12);
  });

  it('percentage adds correct percentage', () => {
    const result = calculateSuggestion(
      { ruleType: 'percentage', incrementValue: 2.5, incrementUnit: 'percent' },
      200, 10, 'lbs',
    );
    expect(result.weight).toBe(205);
    expect(result.reps).toBe(10);
  });
});

describe('getEffectiveRule', () => {
  it('returns exercise-specific rule when available', () => {
    const rules = [
      makeRule({ id: 'global', exerciseId: null }),
      makeRule({ id: 'specific', exerciseId: 'ex-1', incrementValue: 10 }),
    ];
    const result = getEffectiveRule('ex-1', rules);
    expect(result.id).toBe('specific');
    expect(result.incrementValue).toBe(10);
  });

  it('falls back to global when no exercise-specific rule', () => {
    const rules = [makeRule({ id: 'global', exerciseId: null, incrementValue: 7 })];
    const result = getEffectiveRule('ex-1', rules);
    expect(result.id).toBe('global');
  });

  it('returns built-in default when no rules exist', () => {
    const result = getEffectiveRule('ex-1', []);
    expect(result.id).toBe('__builtin_default__');
    expect(result.incrementValue).toBe(5);
  });
});

describe('generateOverloadSuggestion', () => {
  it('returns null for cardio exercises', () => {
    const result = generateOverloadSuggestion('ex-1', 'cardio', makeRule(), null);
    expect(result).toBeNull();
  });

  it('returns null when no history', () => {
    const result = generateOverloadSuggestion('ex-1', 'strength', makeRule(), null);
    expect(result).toBeNull();
  });

  it('returns null when fewer sessions than min_sessions', () => {
    const history: ExercisePerformanceHistory = {
      exerciseId: 'ex-1',
      sessions: [{ sessionId: 's1', completedAt: new Date().toISOString(), sets: [{ setNumber: 1, weight: 135, reps: 10, unit: 'lbs' }] }],
    };
    const result = generateOverloadSuggestion('ex-1', 'strength', makeRule({ minSessions: 2 }), history);
    expect(result).toBeNull();
  });

  it('returns suggestion when conditions are met', () => {
    const history: ExercisePerformanceHistory = {
      exerciseId: 'ex-1',
      sessions: [
        { sessionId: 's1', completedAt: '2026-03-22T12:00:00Z', sets: [{ setNumber: 1, weight: 135, reps: 10, unit: 'lbs' }, { setNumber: 2, weight: 135, reps: 10, unit: 'lbs' }] },
        { sessionId: 's2', completedAt: '2026-03-20T12:00:00Z', sets: [{ setNumber: 1, weight: 135, reps: 10, unit: 'lbs' }, { setNumber: 2, weight: 135, reps: 10, unit: 'lbs' }] },
      ],
    };
    const result = generateOverloadSuggestion(
      'ex-1',
      'strength',
      makeRule({ targetReps: 10, incrementValue: 5, minSessions: 2 }),
      history,
    );
    expect(result).not.toBeNull();
    expect(result!.suggestedWeight).toBe(140);
    expect(result!.previousWeight).toBe(135);
  });
});
