import { describe, it, expect } from 'vitest';
import { calculateEpley1RM, calculateBrzycki1RM, calculate1RM } from '../oneRM';

describe('calculateEpley1RM', () => {
  it('calculates standard 1RM (135lb x 10 reps -> 180)', () => {
    expect(calculateEpley1RM(135, 10)).toBe(180);
  });

  it('returns 0 when weight is 0', () => {
    expect(calculateEpley1RM(0, 10)).toBe(0);
  });

  it('returns 0 when reps is 0', () => {
    expect(calculateEpley1RM(135, 0)).toBe(0);
  });

  it('returns 0 when both weight and reps are 0', () => {
    expect(calculateEpley1RM(0, 0)).toBe(0);
  });

  it('returns weight unchanged for 1 rep', () => {
    expect(calculateEpley1RM(225, 1)).toBe(225);
  });

  it('rounds to nearest integer', () => {
    // 100 * (1 + 3/30) = 110
    expect(calculateEpley1RM(100, 3)).toBe(110);
  });

  it('returns 0 for negative weight', () => {
    expect(calculateEpley1RM(-50, 5)).toBe(0);
  });

  it('returns 0 for negative reps', () => {
    expect(calculateEpley1RM(135, -3)).toBe(0);
  });
});

describe('calculateBrzycki1RM', () => {
  it('calculates standard 1RM', () => {
    // 135 * 36 / (37 - 10) = 135 * 36 / 27 = 180
    expect(calculateBrzycki1RM(135, 10)).toBe(180);
  });

  it('returns 0 when reps >= 37', () => {
    expect(calculateBrzycki1RM(135, 37)).toBe(0);
    expect(calculateBrzycki1RM(135, 50)).toBe(0);
  });

  it('returns weight unchanged for 1 rep', () => {
    expect(calculateBrzycki1RM(225, 1)).toBe(225);
  });

  it('returns 0 when weight is 0', () => {
    expect(calculateBrzycki1RM(0, 10)).toBe(0);
  });

  it('returns 0 when reps is 0', () => {
    expect(calculateBrzycki1RM(135, 0)).toBe(0);
  });

  it('returns 0 for negative weight', () => {
    expect(calculateBrzycki1RM(-100, 5)).toBe(0);
  });

  it('returns 0 for negative reps', () => {
    expect(calculateBrzycki1RM(135, -1)).toBe(0);
  });
});

describe('calculate1RM', () => {
  it('dispatches to epley by default', () => {
    expect(calculate1RM(135, 10)).toBe(calculateEpley1RM(135, 10));
  });

  it('dispatches to epley when formula is "epley"', () => {
    expect(calculate1RM(200, 5, 'epley')).toBe(calculateEpley1RM(200, 5));
  });

  it('dispatches to brzycki when formula is "brzycki"', () => {
    expect(calculate1RM(200, 5, 'brzycki')).toBe(calculateBrzycki1RM(200, 5));
  });

  it('defaults to epley (no third arg)', () => {
    const epleyResult = calculateEpley1RM(315, 3);
    expect(calculate1RM(315, 3)).toBe(epleyResult);
  });
});
