import { describe, it, expect } from 'vitest';
import {
  classifyBP,
  validateBP,
  calculateBPAverages,
  getCategoryDistribution,
  parseLegacyBP,
} from '../engine';
import type { BPReading } from '../../models/bp-reading';

function makeReading(overrides: Partial<BPReading> = {}): BPReading {
  return {
    id: 'test-1',
    systolic: 120,
    diastolic: 80,
    pulse: 72,
    arm: null,
    position: null,
    context: null,
    category: 'normal',
    notes: null,
    measuredAt: '2026-03-20T10:00:00.000Z',
    createdAt: '2026-03-20T10:00:00.000Z',
    ...overrides,
  };
}

describe('classifyBP', () => {
  it('classifies normal BP', () => {
    expect(classifyBP(119, 79)).toBe('normal');
    expect(classifyBP(100, 60)).toBe('normal');
  });

  it('classifies elevated BP', () => {
    expect(classifyBP(120, 79)).toBe('elevated');
    expect(classifyBP(125, 79)).toBe('elevated');
    expect(classifyBP(129, 79)).toBe('elevated');
  });

  it('classifies hypertension stage 1', () => {
    expect(classifyBP(130, 79)).toBe('hypertension_1');
    expect(classifyBP(139, 79)).toBe('hypertension_1');
    expect(classifyBP(125, 85)).toBe('hypertension_1');
    expect(classifyBP(130, 80)).toBe('hypertension_1');
  });

  it('classifies hypertension stage 2', () => {
    expect(classifyBP(140, 90)).toBe('hypertension_2');
    expect(classifyBP(160, 95)).toBe('hypertension_2');
    expect(classifyBP(125, 90)).toBe('hypertension_2');
  });

  it('classifies crisis', () => {
    expect(classifyBP(181, 80)).toBe('crisis');
    expect(classifyBP(130, 121)).toBe('crisis');
    expect(classifyBP(200, 130)).toBe('crisis');
  });

  it('uses worst category when systolic and diastolic differ', () => {
    // Systolic normal but diastolic stage 1
    expect(classifyBP(115, 85)).toBe('hypertension_1');
  });
});

describe('validateBP', () => {
  it('rejects systolic <= diastolic', () => {
    expect(validateBP(80, 120).valid).toBe(false);
    expect(validateBP(100, 100).valid).toBe(false);
  });

  it('accepts valid readings', () => {
    expect(validateBP(120, 80).valid).toBe(true);
  });
});

describe('calculateBPAverages', () => {
  it('returns zeros for empty array', () => {
    const avg = calculateBPAverages([]);
    expect(avg).toEqual({ systolic: 0, diastolic: 0, pulse: null, count: 0 });
  });

  it('calculates averages correctly', () => {
    const readings = [
      makeReading({ systolic: 120, diastolic: 80, pulse: 70 }),
      makeReading({ systolic: 130, diastolic: 85, pulse: 75 }),
      makeReading({ systolic: 140, diastolic: 90, pulse: 80 }),
    ];
    const avg = calculateBPAverages(readings);
    expect(avg.systolic).toBe(130);
    expect(avg.diastolic).toBe(85);
    expect(avg.pulse).toBe(75);
    expect(avg.count).toBe(3);
  });

  it('handles null pulse values', () => {
    const readings = [
      makeReading({ systolic: 120, diastolic: 80, pulse: null }),
      makeReading({ systolic: 130, diastolic: 85, pulse: 72 }),
    ];
    const avg = calculateBPAverages(readings);
    expect(avg.pulse).toBe(72);
  });

  it('returns null pulse when all pulse values are null', () => {
    const readings = [
      makeReading({ pulse: null }),
      makeReading({ pulse: null }),
    ];
    expect(calculateBPAverages(readings).pulse).toBeNull();
  });
});

describe('getCategoryDistribution', () => {
  it('counts categories correctly', () => {
    const readings = [
      makeReading({ category: 'normal' }),
      makeReading({ category: 'normal' }),
      makeReading({ category: 'elevated' }),
      makeReading({ category: 'hypertension_1' }),
      makeReading({ category: 'hypertension_1' }),
    ];
    const dist = getCategoryDistribution(readings);
    expect(dist.normal).toBe(2);
    expect(dist.elevated).toBe(1);
    expect(dist.hypertension_1).toBe(2);
    expect(dist.hypertension_2).toBe(0);
    expect(dist.crisis).toBe(0);
  });
});

describe('parseLegacyBP', () => {
  it('parses valid "120/80" format', () => {
    expect(parseLegacyBP('120/80')).toEqual({ systolic: 120, diastolic: 80 });
  });

  it('parses with spaces around slash', () => {
    expect(parseLegacyBP('130 / 85')).toEqual({ systolic: 130, diastolic: 85 });
  });

  it('returns null for invalid format', () => {
    expect(parseLegacyBP('invalid')).toBeNull();
    expect(parseLegacyBP('120')).toBeNull();
    expect(parseLegacyBP('')).toBeNull();
    expect(parseLegacyBP('abc/def')).toBeNull();
  });
});
