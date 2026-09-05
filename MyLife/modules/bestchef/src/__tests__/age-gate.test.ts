import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MINIMUM_AGE,
  REGION_MINIMUM_AGES,
  minimumAgeForRegion,
} from '../social/age-gate';

describe('per-country age gate (plan 33 Phase 1.7)', () => {
  it('enforces the launch-market digital-consent ages from the plan', () => {
    expect(minimumAgeForRegion('DE')).toBe(16);
    expect(minimumAgeForRegion('IE')).toBe(16);
    expect(minimumAgeForRegion('FR')).toBe(15);
    expect(minimumAgeForRegion('IT')).toBe(14);
    expect(minimumAgeForRegion('ES')).toBe(14);
  });

  it('defaults to the 13+ floor everywhere else', () => {
    expect(minimumAgeForRegion('US')).toBe(13);
    expect(minimumAgeForRegion('GB')).toBe(13);
    expect(minimumAgeForRegion('BR')).toBe(13);
    expect(minimumAgeForRegion('JP')).toBe(13);
    expect(minimumAgeForRegion('CA')).toBe(13);
    expect(minimumAgeForRegion('AU')).toBe(13);
  });

  it('handles missing, empty, and lowercase region codes', () => {
    expect(minimumAgeForRegion(null)).toBe(DEFAULT_MINIMUM_AGE);
    expect(minimumAgeForRegion(undefined)).toBe(DEFAULT_MINIMUM_AGE);
    expect(minimumAgeForRegion('')).toBe(DEFAULT_MINIMUM_AGE);
    expect(minimumAgeForRegion('  ')).toBe(DEFAULT_MINIMUM_AGE);
    expect(minimumAgeForRegion('de')).toBe(16);
    expect(minimumAgeForRegion(' fr ')).toBe(15);
  });

  it('never allows a gate below the 13+ floor', () => {
    for (const age of Object.values(REGION_MINIMUM_AGES)) {
      expect(age).toBeGreaterThanOrEqual(13);
    }
  });
});
