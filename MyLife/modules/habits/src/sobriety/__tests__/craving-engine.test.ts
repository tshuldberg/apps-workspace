import { describe, it, expect } from 'vitest';
import {
  analyzeTriggerFrequency,
  analyzeIntensityTrend,
  analyzePeakTimes,
  analyzeCopingEffectiveness,
  normalizeTriggerName,
} from '../craving-engine';
import type { Craving, CravingTrigger } from '../../types';

function makeTrigger(name: string, category: 'emotional' | 'physical' | 'routine' = 'emotional'): CravingTrigger {
  return {
    id: `t-${Math.random()}`,
    cravingId: 'c1',
    triggerName: name,
    triggerCategory: category,
    createdAt: '2026-03-22T00:00:00.000Z',
  };
}

function makeCraving(overrides: Partial<Craving> = {}): Craving {
  return {
    id: `c-${Math.random()}`,
    habitId: 'h1',
    intensity: 5,
    durationMinutes: null,
    copingStrategy: null,
    outcome: null,
    notes: null,
    loggedAt: '2026-03-22T12:00:00.000Z',
    createdAt: '2026-03-22T12:00:00.000Z',
    ...overrides,
  };
}

describe('Craving Analysis Engine', () => {
  describe('analyzeTriggerFrequency', () => {
    it('returns triggers sorted by frequency', () => {
      const triggers = [
        makeTrigger('stress'),
        makeTrigger('stress'),
        makeTrigger('stress'),
        makeTrigger('boredom'),
        makeTrigger('fatigue', 'physical'),
      ];
      const result = analyzeTriggerFrequency(triggers);
      expect(result[0].triggerName).toBe('stress');
      expect(result[0].count).toBe(3);
      expect(result[1].count).toBe(1);
    });

    it('returns empty array for no triggers', () => {
      expect(analyzeTriggerFrequency([])).toEqual([]);
    });
  });

  describe('analyzeIntensityTrend', () => {
    it('groups by week and averages', () => {
      const cravings = [
        makeCraving({ intensity: 8, loggedAt: '2026-03-16T10:00:00.000Z' }), // week of Mar 16 (Mon)
        makeCraving({ intensity: 6, loggedAt: '2026-03-17T10:00:00.000Z' }), // same week
        makeCraving({ intensity: 4, loggedAt: '2026-03-23T10:00:00.000Z' }), // week of Mar 23 (Mon)
      ];
      const result = analyzeIntensityTrend(cravings);
      expect(result.length).toBe(2);
      expect(result[0].averageIntensity).toBe(7);
      expect(result[1].averageIntensity).toBe(4);
    });

    it('returns empty for no cravings', () => {
      expect(analyzeIntensityTrend([])).toEqual([]);
    });
  });

  describe('analyzePeakTimes', () => {
    it('returns correct hour distribution', () => {
      const cravings = [
        makeCraving({ loggedAt: '2026-03-22T09:00:00.000Z' }),
        makeCraving({ loggedAt: '2026-03-22T09:30:00.000Z' }),
        makeCraving({ loggedAt: '2026-03-22T15:00:00.000Z' }),
      ];
      const result = analyzePeakTimes(cravings);
      expect(result[9].count).toBe(2);
      expect(result[15].count).toBe(1);
      expect(result[0].count).toBe(0);
    });
  });

  describe('analyzeCopingEffectiveness', () => {
    it('calculates resist rate correctly', () => {
      const cravings = [
        makeCraving({ outcome: 'resisted' }),
        makeCraving({ outcome: 'resisted' }),
        makeCraving({ outcome: 'resisted' }),
        makeCraving({ outcome: 'gave_in' }),
      ];
      const result = analyzeCopingEffectiveness(cravings);
      expect(result.resisted).toBe(3);
      expect(result.gaveIn).toBe(1);
      expect(result.total).toBe(4);
      expect(result.resistRate).toBe(75);
    });

    it('handles zero cravings without division error', () => {
      const result = analyzeCopingEffectiveness([]);
      expect(result.resistRate).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe('normalizeTriggerName', () => {
    it('normalizes whitespace and case', () => {
      expect(normalizeTriggerName('  Stress  ')).toBe('stress');
      expect(normalizeTriggerName('BOREDOM')).toBe('boredom');
    });
  });
});
