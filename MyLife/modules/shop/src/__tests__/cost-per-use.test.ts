import { describe, expect, it } from 'vitest';
import {
  calculateCostPerUse,
  getWorthItStatus,
  projectBreakEven,
  DEFAULT_WORTH_IT_THRESHOLD_CENTS,
} from '../engine/cost-per-use';

describe('calculateCostPerUse', () => {
  it('returns 0 when useCount is 0', () => {
    expect(calculateCostPerUse(10000, 0)).toBe(0);
  });

  it('returns 0 when price is 0 or negative', () => {
    expect(calculateCostPerUse(0, 5)).toBe(0);
    expect(calculateCostPerUse(-500, 5)).toBe(0);
  });

  it('returns 0 for non-finite inputs', () => {
    expect(calculateCostPerUse(Number.NaN, 5)).toBe(0);
    expect(calculateCostPerUse(10000, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('computes price/useCount for positive inputs', () => {
    expect(calculateCostPerUse(10000, 10)).toBe(1000);
    expect(calculateCostPerUse(24900, 83)).toBeCloseTo(300, 0);
  });

  it('cost-per-use drops monotonically as uses increase', () => {
    const price = 12_000;
    const cpu1 = calculateCostPerUse(price, 1);
    const cpu10 = calculateCostPerUse(price, 10);
    const cpu50 = calculateCostPerUse(price, 50);
    expect(cpu1).toBeGreaterThan(cpu10);
    expect(cpu10).toBeGreaterThan(cpu50);
  });
});

describe('getWorthItStatus', () => {
  it('returns not-yet when costPerUse is 0', () => {
    expect(getWorthItStatus(0)).toBe('not-yet');
  });

  it('returns worth-it at or below the default threshold', () => {
    expect(getWorthItStatus(DEFAULT_WORTH_IT_THRESHOLD_CENTS)).toBe('worth-it');
    expect(getWorthItStatus(DEFAULT_WORTH_IT_THRESHOLD_CENTS - 1)).toBe(
      'worth-it',
    );
    expect(getWorthItStatus(100)).toBe('worth-it');
  });

  it('returns approaching within 50 percent above threshold', () => {
    // threshold=500, approaching = (500, 750]
    expect(getWorthItStatus(600)).toBe('approaching');
    expect(getWorthItStatus(750)).toBe('approaching');
  });

  it('returns not-yet above 1.5x threshold', () => {
    expect(getWorthItStatus(800)).toBe('not-yet');
    expect(getWorthItStatus(5000)).toBe('not-yet');
  });

  it('honors custom threshold', () => {
    // threshold=100 cents ($1)
    expect(getWorthItStatus(90, 100)).toBe('worth-it');
    expect(getWorthItStatus(120, 100)).toBe('approaching');
    expect(getWorthItStatus(200, 100)).toBe('not-yet');
  });

  it('threshold triggers worth-it after enough uses', () => {
    // $249 item, threshold $5/use -> need 50 uses
    const price = 24_900;
    const cpuAt50 = calculateCostPerUse(price, 50);
    expect(getWorthItStatus(cpuAt50)).toBe('worth-it');
    const cpuAt40 = calculateCostPerUse(price, 40);
    // 24900/40 = 622.5 -> approaching
    expect(getWorthItStatus(cpuAt40)).toBe('approaching');
    const cpuAt30 = calculateCostPerUse(price, 30);
    // 24900/30 = 830 -> not-yet
    expect(getWorthItStatus(cpuAt30)).toBe('not-yet');
  });
});

describe('projectBreakEven', () => {
  it('returns uses needed to hit target cost-per-use', () => {
    // $100 at target $10/use => 10 uses total, current 0 => need 10 more
    expect(projectBreakEven(10_000, 0, 1000)).toBe(10);
  });

  it('returns delta between current and required uses', () => {
    // $100, used 3 times, target $10/use => need 10 total, 7 remaining
    expect(projectBreakEven(10_000, 3, 1000)).toBe(7);
  });

  it('returns 0 when target already met', () => {
    // $100, used 20 times => cpu=$5 already under target $10
    expect(projectBreakEven(10_000, 20, 1000)).toBe(0);
  });

  it('returns 0 for bad inputs', () => {
    expect(projectBreakEven(0, 5, 500)).toBe(0);
    expect(projectBreakEven(1000, 5, 0)).toBe(0);
    expect(projectBreakEven(Number.NaN, 5, 500)).toBe(0);
  });

  it('rounds up when price does not divide evenly', () => {
    // $100, target $3/use => ceil(10000/300)=34 uses
    expect(projectBreakEven(10_000, 0, 300)).toBe(34);
  });
});
