import { describe, expect, it } from 'vitest';
import { navigation } from '../navigation';
import type { NavigationTokens } from '../navigation';

/**
 * Unit tests for navigation design tokens.
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */

const REQUIRED_NUMERIC_KEYS: (keyof NavigationTokens)[] = [
  'headerHeight',
  'tabBarHeight',
  'tabBarBottomPadding',
  'tabBarTopPadding',
  'tabBarBlurIntensity',
  'tabBarBorderRadius',
  'tabLabelFontSize',
  'tabIconSize',
  'contentPaddingHorizontal',
  'tabBarHorizontalInset',
  'headerPaddingHorizontal',
  'webHeaderHeight',
  'webContentMaxWidth',
  'webContentPaddingHorizontal',
];

describe('navigation tokens', () => {
  it('exports all required token keys', () => {
    const allKeys = [...REQUIRED_NUMERIC_KEYS, 'inactiveTint'] as const;
    for (const key of allKeys) {
      expect(navigation).toHaveProperty(key);
    }
  });

  it.each(REQUIRED_NUMERIC_KEYS)(
    '%s is a non-negative number',
    (key) => {
      const value = navigation[key];
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThanOrEqual(0);
    },
  );

  it('inactiveTint is a valid rgba color string', () => {
    expect(typeof navigation.inactiveTint).toBe('string');
    expect(navigation.inactiveTint).toMatch(
      /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+\s*\)$/,
    );
  });

  it('NavigationTokens type matches the navigation object shape', () => {
    // Type-level check: assigning navigation to NavigationTokens should compile
    const tokens: NavigationTokens = navigation;
    expect(tokens).toBe(navigation);
  });
});
