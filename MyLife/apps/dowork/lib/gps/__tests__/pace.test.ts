import { describe, expect, it } from 'vitest';
import { METERS_PER_MILE, paceForUnit } from '../pace';

describe('paceForUnit', () => {
  it('returns the pace unchanged for km', () => {
    expect(paceForUnit(300, 'km')).toBe(300);
  });

  it('converts seconds-per-km to seconds-per-mile', () => {
    const secPerKm = 300;
    const expected = secPerKm * (METERS_PER_MILE / 1000);
    expect(paceForUnit(secPerKm, 'mi')).toBeCloseTo(expected, 5);
  });

  it('scales proportionally with the km/mile ratio', () => {
    const secPerKm = 240;
    const secPerMi = paceForUnit(secPerKm, 'mi');
    // A mile is longer than a km, so pace-per-mile should be slower (larger).
    expect(secPerMi).toBeGreaterThan(secPerKm);
    expect(secPerMi / secPerKm).toBeCloseTo(METERS_PER_MILE / 1000, 5);
  });
});
