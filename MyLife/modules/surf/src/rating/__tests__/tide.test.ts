import { describe, it, expect } from 'vitest';
import { scoreTide } from '../tide';

describe('scoreTide', () => {
  const IDEAL_LOW = 1.0;
  const IDEAL_HIGH = 4.0;

  // ── In ideal range ──

  it('returns 1.0 when tide is within ideal range', () => {
    expect(scoreTide(2.5, IDEAL_LOW, IDEAL_HIGH, 'beach')).toBe(1.0);
    expect(scoreTide(1.0, IDEAL_LOW, IDEAL_HIGH, 'reef')).toBe(1.0);
    expect(scoreTide(4.0, IDEAL_LOW, IDEAL_HIGH, 'point')).toBe(1.0);
  });

  it('returns 1.0 at the exact boundaries', () => {
    expect(scoreTide(IDEAL_LOW, IDEAL_LOW, IDEAL_HIGH, 'beach')).toBe(1.0);
    expect(scoreTide(IDEAL_HIGH, IDEAL_LOW, IDEAL_HIGH, 'beach')).toBe(1.0);
  });

  it('mid-tide scores well for beach breaks', () => {
    expect(scoreTide(2.5, IDEAL_LOW, IDEAL_HIGH, 'beach')).toBe(1.0);
  });

  // ── Outside ideal range ──

  it('penalizes tide outside ideal range', () => {
    const score = scoreTide(0.0, IDEAL_LOW, IDEAL_HIGH, 'beach');
    expect(score).toBeLessThan(1.0);
    expect(score).toBeGreaterThanOrEqual(0.2);
  });

  it('penalizes high tide above ideal range', () => {
    const score = scoreTide(6.0, IDEAL_LOW, IDEAL_HIGH, 'beach');
    expect(score).toBeLessThan(1.0);
    expect(score).toBeGreaterThanOrEqual(0.2);
  });

  // ── Spot type sensitivity ──

  it('reef breaks are more penalized by extreme tides than beach breaks', () => {
    const tideFt = -1.0; // extreme low tide
    const reefScore = scoreTide(tideFt, IDEAL_LOW, IDEAL_HIGH, 'reef');
    const beachScore = scoreTide(tideFt, IDEAL_LOW, IDEAL_HIGH, 'beach');
    expect(reefScore).toBeLessThan(beachScore);
  });

  it('point breaks have moderate sensitivity', () => {
    const tideFt = -0.5;
    const reefScore = scoreTide(tideFt, IDEAL_LOW, IDEAL_HIGH, 'reef');
    const pointScore = scoreTide(tideFt, IDEAL_LOW, IDEAL_HIGH, 'point');
    const beachScore = scoreTide(tideFt, IDEAL_LOW, IDEAL_HIGH, 'beach');

    expect(reefScore).toBeLessThan(pointScore);
    expect(pointScore).toBeLessThan(beachScore);
  });

  // ── Minimum score floor ──

  it('never returns below 0.2 (floor)', () => {
    // Need extreme distance to exceed the penalty cap of 0.6 (which is min-capped)
    // For reef (sensitivity=2.0): distance * 0.15 * 2.0 >= 0.8 => distance >= 2.67ft
    // But penalty is capped at 0.6, so 1.0 - 0.6 = 0.4 is the minimum for reef
    // The floor of 0.2 applies to theoretical combinations with max penalty
    // With distance 6ft: penalty = min(0.6, 6 * 0.15 * 2.0) = min(0.6, 1.8) = 0.6
    // Score = max(0.2, 1.0 - 0.6) = 0.4
    expect(scoreTide(-5.0, IDEAL_LOW, IDEAL_HIGH, 'reef')).toBe(0.4);
    expect(scoreTide(10.0, IDEAL_LOW, IDEAL_HIGH, 'reef')).toBe(0.4);

    // The max penalty is capped at 0.6, so the true floor is max(0.2, 0.4) = 0.4 for reef
    // Verify the floor function holds: score >= 0.2 always
    expect(scoreTide(-100, IDEAL_LOW, IDEAL_HIGH, 'reef')).toBeGreaterThanOrEqual(0.2);
    expect(scoreTide(100, IDEAL_LOW, IDEAL_HIGH, 'beach')).toBeGreaterThanOrEqual(0.2);
  });

  it('beach breaks with moderate distance still score above floor', () => {
    // 1ft outside ideal range for beach (sensitivity 0.5): penalty = 0.15 * 0.5 = 0.075
    const score = scoreTide(0.0, IDEAL_LOW, IDEAL_HIGH, 'beach');
    expect(score).toBeGreaterThan(0.2);
    expect(score).toBeLessThan(1.0);
  });

  // ── Symmetric penalties ──

  it('penalizes equally for same distance above or below ideal', () => {
    const below = scoreTide(0.0, IDEAL_LOW, IDEAL_HIGH, 'point'); // 1ft below
    const above = scoreTide(5.0, IDEAL_LOW, IDEAL_HIGH, 'point'); // 1ft above
    expect(below).toBe(above);
  });

  // ── Non-standard break types ──

  it('treats unknown break types as beach (low sensitivity)', () => {
    const score = scoreTide(-1.0, IDEAL_LOW, IDEAL_HIGH, 'other' as 'beach');
    const beachScore = scoreTide(-1.0, IDEAL_LOW, IDEAL_HIGH, 'beach');
    expect(score).toBe(beachScore);
  });
});
