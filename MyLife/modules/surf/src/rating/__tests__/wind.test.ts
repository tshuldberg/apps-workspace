import { describe, it, expect } from 'vitest';
import { classifyWind, windScore } from '../wind';

// Spot faces west (270 degrees). Wind FROM the east (90 deg) is offshore.
const WEST_FACING = 270;

describe('classifyWind', () => {
  // ── Light wind override ──

  it('returns "light" for wind under 5 kts regardless of direction', () => {
    expect(classifyWind(90, WEST_FACING, 4)).toBe('light');
    expect(classifyWind(270, WEST_FACING, 3)).toBe('light');
    expect(classifyWind(0, WEST_FACING, 0)).toBe('light');
  });

  // ── Offshore classification ──

  it('classifies wind from land as offshore (angle >= 150)', () => {
    // Wind from east on west-facing beach: angle diff = 180 degrees
    expect(classifyWind(90, WEST_FACING, 10)).toBe('offshore');
  });

  // ── Cross-offshore ──

  it('classifies cross-offshore (angle 120-149)', () => {
    // Diff of about 135 from west-facing
    expect(classifyWind(45, WEST_FACING, 10)).toBe('cross-offshore');
  });

  // ── Cross-shore ──

  it('classifies cross-shore (angle 80-119)', () => {
    // Wind from north (0) on west-facing beach: diff = 90
    expect(classifyWind(0, WEST_FACING, 10)).toBe('cross-shore');
    // Wind from south (180) on west-facing beach: diff = 90
    expect(classifyWind(180, WEST_FACING, 10)).toBe('cross-shore');
  });

  // ── Cross-onshore ──

  it('classifies cross-onshore (angle 45-79)', () => {
    // Wind from ~225 on west-facing beach: diff = 45
    expect(classifyWind(225, WEST_FACING, 10)).toBe('cross-onshore');
  });

  // ── Onshore ──

  it('classifies onshore (angle < 45)', () => {
    // Wind from west (270) on west-facing beach: diff = 0
    expect(classifyWind(270, WEST_FACING, 10)).toBe('onshore');
    expect(classifyWind(280, WEST_FACING, 10)).toBe('onshore');
  });

  // ── Different orientations ──

  it('works for a south-facing beach (180 deg)', () => {
    const SOUTH_FACING = 180;
    // Wind from north (0 deg) is offshore for south-facing
    expect(classifyWind(0, SOUTH_FACING, 10)).toBe('offshore');
    // Wind from south (180 deg) is onshore
    expect(classifyWind(180, SOUTH_FACING, 10)).toBe('onshore');
  });

  it('handles wrap-around at 0/360', () => {
    const NORTH_FACING = 0;
    // Wind from south (180) is offshore for north-facing
    expect(classifyWind(180, NORTH_FACING, 10)).toBe('offshore');
    // Wind from 350 is onshore for north-facing (diff = 10)
    expect(classifyWind(350, NORTH_FACING, 10)).toBe('onshore');
  });
});

describe('windScore', () => {
  // ── Calm conditions ──

  it('returns 1.0 for very calm wind (< 3 kts)', () => {
    expect(windScore(2, 270, WEST_FACING)).toBe(1.0);
    expect(windScore(0, 270, WEST_FACING)).toBe(1.0);
  });

  it('returns 0.95 for light wind (3-5 kts)', () => {
    expect(windScore(4, 270, WEST_FACING)).toBe(0.95);
    expect(windScore(3, 90, WEST_FACING)).toBe(0.95);
  });

  // ── Direction-based scoring ──

  it('offshore wind scores 1.0 at moderate speeds', () => {
    expect(windScore(10, 90, WEST_FACING)).toBe(1.0);
  });

  it('onshore wind scores 0.1 base at moderate speeds', () => {
    const score = windScore(10, 270, WEST_FACING);
    // base 0.1 * speed mod 0.85 = 0.085
    expect(score).toBeLessThanOrEqual(0.1);
  });

  it('cross-shore scores higher than onshore but lower than offshore', () => {
    const offshore = windScore(10, 90, WEST_FACING);
    const crossshore = windScore(10, 0, WEST_FACING);
    const onshore = windScore(10, 270, WEST_FACING);

    expect(offshore).toBeGreaterThan(crossshore);
    expect(crossshore).toBeGreaterThan(onshore);
  });

  // ── Speed modifiers ──

  it('strong offshore (> 20 kts) is penalized slightly', () => {
    const moderate = windScore(12, 90, WEST_FACING);
    const strong = windScore(25, 90, WEST_FACING);
    expect(strong).toBeLessThan(moderate);
  });

  it('strong onshore (> 20 kts) is heavily penalized', () => {
    const moderate = windScore(8, 270, WEST_FACING);
    const strong = windScore(25, 270, WEST_FACING);
    expect(strong).toBeLessThan(moderate);
  });

  it('score is between 0 and 1 for all reasonable inputs', () => {
    const tests = [
      { speed: 0, dir: 0 },
      { speed: 5, dir: 90 },
      { speed: 15, dir: 180 },
      { speed: 25, dir: 270 },
      { speed: 40, dir: 45 },
    ];

    for (const t of tests) {
      const score = windScore(t.speed, t.dir, WEST_FACING);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});
