import { describe, it, expect } from 'vitest';
import {
  COUNTRIES,
  US_STATES,
  EU_COUNTRY_CODES,
  REGION_DEFINITIONS,
  getCountryByCode,
  getContinentCountries,
  getRegionCountries,
} from '../engine/geo-data';

describe('COUNTRIES', () => {
  it('includes major countries with correct continents', () => {
    const us = COUNTRIES.find((c) => c.code === 'US');
    expect(us).toBeDefined();
    expect(us!.name).toBe('United States');
    expect(us!.continent).toBe('NA');

    const jp = COUNTRIES.find((c) => c.code === 'JP');
    expect(jp!.name).toBe('Japan');
    expect(jp!.continent).toBe('AS');

    const fr = COUNTRIES.find((c) => c.code === 'FR');
    expect(fr!.name).toBe('France');
    expect(fr!.continent).toBe('EU');
  });

  it('has unique alpha-2 codes', () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('every code is exactly 2 uppercase letters', () => {
    for (const c of COUNTRIES) {
      expect(c.code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('has a substantial number of entries (>= 200)', () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(200);
  });
});

describe('getCountryByCode', () => {
  it('returns the right entry for US, JP, FR', () => {
    expect(getCountryByCode('US')?.name).toBe('United States');
    expect(getCountryByCode('JP')?.name).toBe('Japan');
    expect(getCountryByCode('FR')?.name).toBe('France');
  });

  it('is case-insensitive', () => {
    expect(getCountryByCode('us')?.code).toBe('US');
    expect(getCountryByCode('jP')?.code).toBe('JP');
  });

  it('returns undefined for unknown or empty codes', () => {
    expect(getCountryByCode('ZZ')).toBeUndefined();
    expect(getCountryByCode('')).toBeUndefined();
  });
});

describe('US_STATES', () => {
  it('contains 51 entries (50 states + DC)', () => {
    expect(US_STATES.length).toBe(51);
  });

  it('has unique 2-letter codes', () => {
    const codes = US_STATES.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('includes California, Texas, New York, and DC', () => {
    const codes = US_STATES.map((s) => s.code);
    expect(codes).toContain('CA');
    expect(codes).toContain('TX');
    expect(codes).toContain('NY');
    expect(codes).toContain('DC');
  });
});

describe('EU_COUNTRY_CODES', () => {
  it('contains exactly 27 member states', () => {
    expect(EU_COUNTRY_CODES.length).toBe(27);
    expect(new Set(EU_COUNTRY_CODES).size).toBe(27);
  });

  it('includes France, Germany, Italy, Spain', () => {
    expect(EU_COUNTRY_CODES).toContain('FR');
    expect(EU_COUNTRY_CODES).toContain('DE');
    expect(EU_COUNTRY_CODES).toContain('IT');
    expect(EU_COUNTRY_CODES).toContain('ES');
  });

  it('excludes the UK (post-Brexit)', () => {
    expect(EU_COUNTRY_CODES).not.toContain('GB');
  });
});

describe('REGION_DEFINITIONS', () => {
  it('exposes the required keys', () => {
    expect(REGION_DEFINITIONS).toHaveProperty('us_states');
    expect(REGION_DEFINITIONS).toHaveProperty('eu_countries');
    expect(REGION_DEFINITIONS).toHaveProperty('schengen');
    expect(REGION_DEFINITIONS).toHaveProperty('g7');
  });

  it('g7 has 7 members', () => {
    expect(REGION_DEFINITIONS.g7.countryCodes.length).toBe(7);
  });

  it('us_states matches US_STATES length', () => {
    expect(REGION_DEFINITIONS.us_states.countryCodes.length).toBe(
      US_STATES.length,
    );
  });
});

describe('getContinentCountries', () => {
  it('returns only countries for the requested continent', () => {
    const eu = getContinentCountries('EU');
    expect(eu.length).toBeGreaterThan(0);
    expect(eu.every((c) => c.continent === 'EU')).toBe(true);
  });
});

describe('getRegionCountries', () => {
  it('returns codes for a known region', () => {
    const codes = getRegionCountries('eu_countries');
    expect(codes.length).toBe(27);
  });

  it('returns an empty array for an unknown region', () => {
    expect(getRegionCountries('does-not-exist')).toEqual([]);
  });
});
