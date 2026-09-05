import { describe, expect, it } from 'vitest';
import {
  getDayOfYear,
  isLeapYear,
  getQuoteDayNumber,
  formatReflectionEntry,
  formatQuoteForClipboard,
} from '../quote-engine';

describe('getDayOfYear', () => {
  it('returns 1 for January 1', () => {
    expect(getDayOfYear('2026-01-01')).toBe(1);
  });

  it('returns 66 for March 7 (non-leap year)', () => {
    expect(getDayOfYear('2026-03-07')).toBe(66);
  });

  it('returns 365 for December 31 (non-leap year)', () => {
    expect(getDayOfYear('2026-12-31')).toBe(365);
  });

  it('returns 366 for December 31 (leap year)', () => {
    expect(getDayOfYear('2028-12-31')).toBe(366);
  });

  it('returns 60 for February 29 in leap year', () => {
    expect(getDayOfYear('2028-02-29')).toBe(60);
  });
});

describe('isLeapYear', () => {
  it('returns true for 2024', () => {
    expect(isLeapYear(2024)).toBe(true);
  });

  it('returns true for 2028', () => {
    expect(isLeapYear(2028)).toBe(true);
  });

  it('returns false for 2026', () => {
    expect(isLeapYear(2026)).toBe(false);
  });

  it('returns false for 1900 (divisible by 100 but not 400)', () => {
    expect(isLeapYear(1900)).toBe(false);
  });

  it('returns true for 2000 (divisible by 400)', () => {
    expect(isLeapYear(2000)).toBe(true);
  });
});

describe('getQuoteDayNumber', () => {
  it('returns day of year for regular dates', () => {
    expect(getQuoteDayNumber('2026-03-07')).toBe(66);
  });

  it('returns 1 for January 1', () => {
    expect(getQuoteDayNumber('2026-01-01')).toBe(1);
  });

  it('returns 366 for February 29 (leap day)', () => {
    expect(getQuoteDayNumber('2028-02-29')).toBe(366);
  });

  it('returns 365 for December 31 (non-leap)', () => {
    expect(getQuoteDayNumber('2026-12-31')).toBe(365);
  });
});

describe('formatReflectionEntry', () => {
  it('formats quote as blockquote with reflection prompt', () => {
    const result = formatReflectionEntry(
      'The happiness of your life depends upon the quality of your thoughts.',
      'Marcus Aurelius',
      'What is one thought pattern you could improve today?',
    );
    expect(result).toContain('> The happiness of your life');
    expect(result).toContain('> -- Marcus Aurelius');
    expect(result).toContain('### What is one thought pattern');
  });
});

describe('formatQuoteForClipboard', () => {
  it('formats quote with attribution', () => {
    const result = formatQuoteForClipboard(
      'Know thyself',
      'Socrates',
    );
    expect(result).toBe('"Know thyself" -- Socrates');
  });
});
