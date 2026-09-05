import { describe, it, expect } from 'vitest';
import { computeFastQualityScore } from '../engines/quality-score';

describe('computeFastQualityScore', () => {
  it('returns 100 (grade A) when all criteria met', () => {
    const result = computeFastQualityScore({
      hitTarget: true,
      hydrationMet: true,
      noLateCaffeine: true,
      streakMaintained: true,
    });
    expect(result.total).toBe(100);
    expect(result.grade).toBe('A');
    expect(result.breakdown).toEqual({
      target: 40,
      hydration: 30,
      caffeine: 20,
      streak: 10,
    });
  });

  it('returns 0 (grade F) when no criteria met', () => {
    const result = computeFastQualityScore({
      hitTarget: false,
      hydrationMet: false,
      noLateCaffeine: false,
      streakMaintained: false,
    });
    expect(result.total).toBe(0);
    expect(result.grade).toBe('F');
  });

  it('returns 40 (grade D) when only target hit', () => {
    const result = computeFastQualityScore({
      hitTarget: true,
      hydrationMet: false,
      noLateCaffeine: false,
      streakMaintained: false,
    });
    expect(result.total).toBe(40);
    expect(result.grade).toBe('D');
  });

  it('returns 60 (grade C) when target + caffeine managed', () => {
    const result = computeFastQualityScore({
      hitTarget: true,
      hydrationMet: false,
      noLateCaffeine: true,
      streakMaintained: false,
    });
    expect(result.total).toBe(60);
    expect(result.grade).toBe('C');
  });

  it('returns 90 (grade A) when only streak missed', () => {
    const result = computeFastQualityScore({
      hitTarget: true,
      hydrationMet: true,
      noLateCaffeine: true,
      streakMaintained: false,
    });
    expect(result.total).toBe(90);
    expect(result.grade).toBe('A');
  });

  it('returns grade B for scores 75-89', () => {
    // Target (40) + hydration (30) + streak (10) = 80
    const result = computeFastQualityScore({
      hitTarget: true,
      hydrationMet: true,
      noLateCaffeine: false,
      streakMaintained: true,
    });
    expect(result.total).toBe(80);
    expect(result.grade).toBe('B');
  });
});
