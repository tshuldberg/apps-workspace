import { describe, it, expect } from 'vitest';
import { computeEnergy } from '../energy';
import type { SwellInput } from '../../types';

// Constants used in the formula
const RHO = 1025;
const G = 9.81;
const FT_TO_M = 0.3048;

describe('computeEnergy', () => {
  // ── Zero / empty cases ──

  it('returns 0 for an empty array', () => {
    expect(computeEnergy([])).toBe(0);
  });

  it('returns 0 for a single swell with 0 height', () => {
    expect(
      computeEnergy([{ heightFt: 0, periodSeconds: 12, directionDegrees: 270 }]),
    ).toBe(0);
  });

  it('returns 0 for negative height', () => {
    expect(
      computeEnergy([{ heightFt: -2, periodSeconds: 12, directionDegrees: 270 }]),
    ).toBe(0);
  });

  // ── Known physics values ──

  it('computes correct energy for a known swell input', () => {
    const heightFt = 4;
    const period = 12;
    const heightM = heightFt * FT_TO_M;
    const expectedJoules = (RHO * G * heightM * heightM * period) / 16;
    const expectedKJ = Math.round((expectedJoules / 1000) * 10) / 10;

    const result = computeEnergy([
      { heightFt, periodSeconds: period, directionDegrees: 270 },
    ]);
    expect(result).toBe(expectedKJ);
  });

  it('computes correct energy for a single 6ft @ 14s swell', () => {
    const heightM = 6 * FT_TO_M;
    const expectedJoules = (RHO * G * heightM * heightM * 14) / 16;
    const expectedKJ = Math.round((expectedJoules / 1000) * 10) / 10;

    const result = computeEnergy([
      { heightFt: 6, periodSeconds: 14, directionDegrees: 280 },
    ]);
    expect(result).toBe(expectedKJ);
  });

  // ── Multiple components ──

  it('sums energy from multiple swell components', () => {
    const swells: SwellInput[] = [
      { heightFt: 4, periodSeconds: 12, directionDegrees: 270 },
      { heightFt: 2, periodSeconds: 10, directionDegrees: 300 },
    ];

    const e1 = (RHO * G * (4 * FT_TO_M) ** 2 * 12) / 16;
    const e2 = (RHO * G * (2 * FT_TO_M) ** 2 * 10) / 16;
    const expectedKJ = Math.round(((e1 + e2) / 1000) * 10) / 10;

    expect(computeEnergy(swells)).toBe(expectedKJ);
  });

  it('ignores zero-height components in multi-swell arrays', () => {
    const swells: SwellInput[] = [
      { heightFt: 4, periodSeconds: 12, directionDegrees: 270 },
      { heightFt: 0, periodSeconds: 14, directionDegrees: 300 },
    ];

    const single = computeEnergy([swells[0]!]);
    expect(computeEnergy(swells)).toBe(single);
  });

  // ── Scaling behavior ──

  it('energy scales quadratically with height', () => {
    const small = computeEnergy([
      { heightFt: 2, periodSeconds: 12, directionDegrees: 270 },
    ]);
    const big = computeEnergy([
      { heightFt: 4, periodSeconds: 12, directionDegrees: 270 },
    ]);

    // Height ratio 2:1 -> energy ratio 4:1
    const ratio = big / small;
    expect(ratio).toBeCloseTo(4, 1);
  });

  it('energy scales linearly with period', () => {
    const short = computeEnergy([
      { heightFt: 4, periodSeconds: 8, directionDegrees: 270 },
    ]);
    const long = computeEnergy([
      { heightFt: 4, periodSeconds: 16, directionDegrees: 270 },
    ]);

    // Period ratio 2:1 -> energy ratio 2:1
    const ratio = long / short;
    expect(ratio).toBeCloseTo(2, 1);
  });

  it('direction does not affect energy', () => {
    const west = computeEnergy([
      { heightFt: 4, periodSeconds: 12, directionDegrees: 270 },
    ]);
    const south = computeEnergy([
      { heightFt: 4, periodSeconds: 12, directionDegrees: 180 },
    ]);
    expect(west).toBe(south);
  });
});
