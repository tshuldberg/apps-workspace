import { describe, it, expect, vi } from 'vitest';

vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));

import {
  isLocalePartiallyEnglish,
  untranslatedValueCount,
  VALUE_PARTIAL_THRESHOLD,
} from '../value-completeness';
import { localizedBadgeName, localizedBadgeDescription } from '../badge-labels';
import { LANGUAGE_OPTIONS } from '../languages';
import manifest from '../i18n-value-completeness.json';

describe('value-completeness manifest', () => {
  it('has an entry for every supported locale', () => {
    for (const option of LANGUAGE_OPTIONS) {
      expect(manifest.locales).toHaveProperty(option.code);
    }
  });

  it('marks EN as fully complete', () => {
    expect(isLocalePartiallyEnglish('en')).toBe(false);
    expect(untranslatedValueCount('en')).toBe(0);
  });

  it('derives partial strictly from the threshold, not from a hardcoded flag', () => {
    // Every locale's `partial` must equal (identical > threshold). This proves
    // the label is driven by the real untranslated count, not a static value.
    for (const [code, data] of Object.entries(manifest.locales)) {
      const entry = data as { identical: number; partial: boolean };
      expect(entry.partial).toBe(entry.identical > VALUE_PARTIAL_THRESHOLD);
      expect(isLocalePartiallyEnglish(code as never)).toBe(entry.partial);
    }
  });

  it('reports every locale as translated after the batch pass (no partial locales)', () => {
    // After the 2026-07-11 translation batch + allowlist, no locale should be
    // above threshold. If this fails, a locale regressed to untranslated values.
    const partial = Object.entries(manifest.locales)
      .filter(([, d]) => (d as { partial: boolean }).partial)
      .map(([code]) => code);
    expect(partial).toEqual([]);
  });

  it('threshold is a small positive integer', () => {
    expect(VALUE_PARTIAL_THRESHOLD).toBeGreaterThan(0);
    expect(Number.isInteger(VALUE_PARTIAL_THRESHOLD)).toBe(true);
  });
});

describe('badge label localization', () => {
  const fakeT = (key: string) => `T:${key}`;

  it('resolves known badge ids through i18n', () => {
    expect(localizedBadgeName(fakeT, 'first_submission', 'DB First Dish')).toBe(
      'T:badge.first_submission.name',
    );
    expect(
      localizedBadgeDescription(fakeT, 'first_submission', 'DB desc'),
    ).toBe('T:badge.first_submission.description');
  });

  it('falls back to the DB value for unknown badge ids', () => {
    expect(localizedBadgeName(fakeT, 'nonexistent_badge', 'DB Name')).toBe('DB Name');
    expect(
      localizedBadgeDescription(fakeT, 'nonexistent_badge', 'DB Description'),
    ).toBe('DB Description');
  });
});
