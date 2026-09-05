import { describe, it, expect } from 'vitest';
import { calculatePlates, STANDARD_PLATES_LBS, STANDARD_PLATES_KG } from '../plates';

describe('STANDARD_PLATES_LBS', () => {
  it('contains standard lb plate sizes in descending order', () => {
    expect(STANDARD_PLATES_LBS).toEqual([45, 35, 25, 10, 5, 2.5]);
  });
});

describe('STANDARD_PLATES_KG', () => {
  it('contains standard kg plate sizes in descending order', () => {
    expect(STANDARD_PLATES_KG).toEqual([25, 20, 15, 10, 5, 2.5, 1.25]);
  });

  it('has different sizes than lbs plates', () => {
    expect(STANDARD_PLATES_KG).not.toEqual(STANDARD_PLATES_LBS);
  });
});

describe('calculatePlates', () => {
  it('returns empty perSide and totalWeight = bar when target <= bar', () => {
    const result = calculatePlates(45, 45, 'lbs');
    expect(result.perSide).toEqual([]);
    expect(result.totalWeight).toBe(45);
    expect(result.remainder).toBe(0);
  });

  it('returns empty perSide when target < bar', () => {
    const result = calculatePlates(30, 45, 'lbs');
    expect(result.perSide).toEqual([]);
    expect(result.totalWeight).toBe(45);
    expect(result.remainder).toBe(0);
  });

  it('calculates standard 225 lbs (45 bar + 2x45 per side)', () => {
    const result = calculatePlates(225, 45, 'lbs');
    expect(result.perSide).toEqual([{ weight: 45, count: 2 }]);
    expect(result.totalWeight).toBe(225);
    expect(result.remainder).toBe(0);
  });

  it('calculates mixed plates for 185 lbs', () => {
    // 185 - 45 = 140 per both sides, 70 per side
    // 70 = 1x45 + 1x25
    const result = calculatePlates(185, 45, 'lbs');
    expect(result.perSide).toEqual([
      { weight: 45, count: 1 },
      { weight: 25, count: 1 },
    ]);
    expect(result.totalWeight).toBe(185);
    expect(result.remainder).toBe(0);
  });

  it('calculates 135 lbs correctly', () => {
    // 135 - 45 = 90 / 2 = 45 per side -> 1x45
    const result = calculatePlates(135, 45, 'lbs');
    expect(result.perSide).toEqual([{ weight: 45, count: 1 }]);
    expect(result.totalWeight).toBe(135);
    expect(result.remainder).toBe(0);
  });

  it('calculates with kg plates', () => {
    // bar = 20kg, target = 60kg -> (60-20)/2 = 20 per side -> 1x20
    const result = calculatePlates(60, 20, 'kg');
    expect(result.perSide).toEqual([{ weight: 20, count: 1 }]);
    expect(result.totalWeight).toBe(60);
    expect(result.remainder).toBe(0);
  });

  it('calculates mixed kg plates', () => {
    // bar = 20kg, target = 100kg -> (100-20)/2 = 40 per side -> 1x25 + 1x15
    const result = calculatePlates(100, 20, 'kg');
    expect(result.perSide).toEqual([
      { weight: 25, count: 1 },
      { weight: 15, count: 1 },
    ]);
    expect(result.totalWeight).toBe(100);
    expect(result.remainder).toBe(0);
  });

  it('tracks remainder for unloadable weight', () => {
    // Target = 47 lbs, bar = 45 -> (47-45)/2 = 1 per side
    // Smallest plate is 2.5, cannot make 1 -> remainder = 1
    const result = calculatePlates(47, 45, 'lbs');
    expect(result.perSide).toEqual([]);
    expect(result.totalWeight).toBe(45);
    expect(result.remainder).toBe(1);
  });

  it('handles large plate combinations', () => {
    // 405 - 45 = 360 / 2 = 180 per side -> 4x45
    const result = calculatePlates(405, 45, 'lbs');
    expect(result.perSide).toEqual([{ weight: 45, count: 4 }]);
    expect(result.totalWeight).toBe(405);
    expect(result.remainder).toBe(0);
  });
});
