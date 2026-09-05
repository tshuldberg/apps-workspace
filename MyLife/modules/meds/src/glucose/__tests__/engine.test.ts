import { describe, it, expect } from 'vitest';
import {
  classifyGlucose,
  convertGlucose,
  calculateTimeInRange,
  estimateA1c,
  calculateAverageGlucose,
  analyzeGlucosePatterns,
  parseLegacyGlucose,
  isInRange,
} from '../engine';
import type { GlucoseReading } from '../../models/glucose';

function makeReading(overrides: Partial<GlucoseReading> = {}): GlucoseReading {
  return {
    id: 'test-1',
    value: 120,
    unit: 'mg/dL',
    mealContext: null,
    mealType: null,
    inRange: true,
    rangeStatus: 'in_range',
    notes: null,
    measuredAt: '2026-03-20T10:00:00.000Z',
    createdAt: '2026-03-20T10:00:00.000Z',
    ...overrides,
  };
}

describe('classifyGlucose', () => {
  it('classifies very low (< 54)', () => {
    expect(classifyGlucose(53, 'mg/dL')).toBe('very_low');
    expect(classifyGlucose(30, 'mg/dL')).toBe('very_low');
  });

  it('classifies low (54-69)', () => {
    expect(classifyGlucose(54, 'mg/dL')).toBe('low');
    expect(classifyGlucose(69, 'mg/dL')).toBe('low');
  });

  it('classifies in range (70-180)', () => {
    expect(classifyGlucose(70, 'mg/dL')).toBe('in_range');
    expect(classifyGlucose(120, 'mg/dL')).toBe('in_range');
    expect(classifyGlucose(180, 'mg/dL')).toBe('in_range');
  });

  it('classifies high (181-250)', () => {
    expect(classifyGlucose(181, 'mg/dL')).toBe('high');
    expect(classifyGlucose(250, 'mg/dL')).toBe('high');
  });

  it('classifies very high (> 250)', () => {
    expect(classifyGlucose(251, 'mg/dL')).toBe('very_high');
    expect(classifyGlucose(400, 'mg/dL')).toBe('very_high');
  });

  it('handles mmol/L conversion internally', () => {
    // 10.0 mmol/L = 180.18 mg/dL -> just above 180 boundary = high
    expect(classifyGlucose(10.0, 'mmol/L')).toBe('high');
    // 9.9 mmol/L = 178.38 mg/dL -> in_range
    expect(classifyGlucose(9.9, 'mmol/L')).toBe('in_range');
    // 3.0 mmol/L = 54.05 mg/dL -> low
    expect(classifyGlucose(3.0, 'mmol/L')).toBe('low');
  });
});

describe('convertGlucose', () => {
  it('converts mg/dL to mmol/L', () => {
    const result = convertGlucose(180, 'mg/dL', 'mmol/L');
    expect(result).toBeCloseTo(9.99, 1);
  });

  it('converts mmol/L to mg/dL', () => {
    const result = convertGlucose(10, 'mmol/L', 'mg/dL');
    expect(result).toBeCloseTo(180.18, 0);
  });

  it('returns same value when units match', () => {
    expect(convertGlucose(120, 'mg/dL', 'mg/dL')).toBe(120);
    expect(convertGlucose(6.7, 'mmol/L', 'mmol/L')).toBe(6.7);
  });
});

describe('calculateTimeInRange', () => {
  it('returns 0 for empty readings', () => {
    expect(calculateTimeInRange([])).toBe(0);
  });

  it('calculates correct percentage', () => {
    const readings = [
      makeReading({ value: 100 }),
      makeReading({ value: 120 }),
      makeReading({ value: 150 }),
      makeReading({ value: 170 }),
      makeReading({ value: 180 }),
      makeReading({ value: 190 }),
      makeReading({ value: 200 }),
      makeReading({ value: 250 }),
      makeReading({ value: 300 }),
      makeReading({ value: 60 }),
    ];
    // In range (70-180): 100, 120, 150, 170, 180 = 5 of 10 = 50%
    expect(calculateTimeInRange(readings)).toBe(50);
  });

  it('returns 100 when all in range', () => {
    const readings = [
      makeReading({ value: 100 }),
      makeReading({ value: 120 }),
      makeReading({ value: 150 }),
    ];
    expect(calculateTimeInRange(readings)).toBe(100);
  });
});

describe('estimateA1c', () => {
  it('calculates A1c from ADAG formula', () => {
    // (154 + 46.7) / 28.7 = 6.99 -> rounds to 7.0
    expect(estimateA1c(154)).toBe(7.0);
  });

  it('calculates low A1c', () => {
    // (100 + 46.7) / 28.7 = 5.11 -> rounds to 5.1
    expect(estimateA1c(100)).toBe(5.1);
  });
});

describe('calculateAverageGlucose', () => {
  it('returns 0 for empty array', () => {
    expect(calculateAverageGlucose([])).toBe(0);
  });

  it('calculates average in mg/dL', () => {
    const readings = [
      makeReading({ value: 100 }),
      makeReading({ value: 150 }),
      makeReading({ value: 200 }),
    ];
    expect(calculateAverageGlucose(readings)).toBe(150);
  });
});

describe('analyzeGlucosePatterns', () => {
  it('returns empty analysis for no readings', () => {
    const result = analyzeGlucosePatterns([]);
    expect(result.readingCount).toBe(0);
    expect(result.averageFasting).toBeNull();
    expect(result.averagePostMeal).toBeNull();
    expect(result.averageOverall).toBe(0);
  });

  it('separates fasting and post-meal averages', () => {
    const readings = [
      makeReading({ value: 90, mealContext: 'fasting' }),
      makeReading({ value: 95, mealContext: 'fasting' }),
      makeReading({ value: 100, mealContext: 'fasting' }),
      makeReading({ value: 160, mealContext: 'after_meal' }),
      makeReading({ value: 165, mealContext: 'after_meal' }),
      makeReading({ value: 170, mealContext: 'after_meal' }),
    ];
    const result = analyzeGlucosePatterns(readings);
    expect(result.averageFasting).toBe(95);
    expect(result.averagePostMeal).toBe(165);
    expect(result.fastingCount).toBe(3);
    expect(result.postMealCount).toBe(3);
    expect(result.readingCount).toBe(6);
  });
});

describe('isInRange', () => {
  it('returns true for in-range values', () => {
    expect(isInRange(100, 'mg/dL')).toBe(true);
    expect(isInRange(70, 'mg/dL')).toBe(true);
    expect(isInRange(180, 'mg/dL')).toBe(true);
  });

  it('returns false for out-of-range values', () => {
    expect(isInRange(50, 'mg/dL')).toBe(false);
    expect(isInRange(200, 'mg/dL')).toBe(false);
  });
});

describe('parseLegacyGlucose', () => {
  it('parses valid number string', () => {
    expect(parseLegacyGlucose('120')).toBe(120);
    expect(parseLegacyGlucose('85.5')).toBe(85.5);
  });

  it('returns null for invalid strings', () => {
    expect(parseLegacyGlucose('invalid')).toBeNull();
    expect(parseLegacyGlucose('')).toBeNull();
    expect(parseLegacyGlucose('-5')).toBeNull();
    expect(parseLegacyGlucose('0')).toBeNull();
  });
});
