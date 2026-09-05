// Plan 38 Phase 1b (amendment D.2): resolveActiveTheme priority matrix (web twin).
// The ONE per-community theme choke point is pure and total. Priority: high-contrast
// beats a community theme beats accent-only; member mode 'mine' ignores the community
// theme; a malformed blob falls back SAFE to the base theme (never throws).

import { describe, expect, it } from 'vitest';
import {
  OPEN_BURROW,
  SOCIAL,
  encodeThemeBlob,
  resolveProfile,
  type MkColors,
} from '@mylife/meerkat-theme';
import { resolveActiveTheme } from '../community-theme-core';

const BASE: MkColors = resolveProfile(OPEN_BURROW, 'light');
const BASE_DARK: MkColors = resolveProfile(OPEN_BURROW, 'dark');
const COMMUNITY_BLOB = encodeThemeBlob(SOCIAL);
const COMMUNITY_ACCENT = '#0e7c66';

function input(overrides: Partial<Parameters<typeof resolveActiveTheme>[0]> = {}) {
  return {
    communityThemeBlob: null,
    communityAccent: null,
    memberMode: 'community' as const,
    highContrastEnabled: false,
    mode: 'light' as const,
    baseTheme: BASE,
    ...overrides,
  };
}

describe('resolveActiveTheme priority matrix (web)', () => {
  it('high contrast beats a community theme (returns base, source high_contrast)', () => {
    const result = resolveActiveTheme(input({
      communityThemeBlob: COMMUNITY_BLOB,
      communityAccent: COMMUNITY_ACCENT,
      highContrastEnabled: true,
    }));
    expect(result.source).toBe('high_contrast');
    expect(result.theme).toEqual(BASE);
  });

  it("member mode 'mine' ignores the community theme (returns base, source mine)", () => {
    const result = resolveActiveTheme(input({
      communityThemeBlob: COMMUNITY_BLOB,
      communityAccent: COMMUNITY_ACCENT,
      memberMode: 'mine',
    }));
    expect(result.source).toBe('mine');
    expect(result.theme).toEqual(BASE);
  });

  it('applies a valid community theme blob (source community_theme)', () => {
    const result = resolveActiveTheme(input({ communityThemeBlob: COMMUNITY_BLOB }));
    expect(result.source).toBe('community_theme');
    expect(result.theme).toEqual(resolveProfile(SOCIAL, 'light'));
    expect(result.theme).not.toEqual(BASE);
  });

  it('resolves the community blob for the active mode (dark)', () => {
    const result = resolveActiveTheme(input({ communityThemeBlob: COMMUNITY_BLOB, mode: 'dark', baseTheme: BASE_DARK }));
    expect(result.source).toBe('community_theme');
    expect(result.theme).toEqual(resolveProfile(SOCIAL, 'dark'));
  });

  it('applies an accent-only identity to the accent slot only (source community_accent)', () => {
    const result = resolveActiveTheme(input({ communityAccent: COMMUNITY_ACCENT }));
    expect(result.source).toBe('community_accent');
    expect(result.theme.accent).toBe(COMMUNITY_ACCENT);
    expect({ ...result.theme, accent: BASE.accent }).toEqual(BASE);
  });

  it('falls back SAFE to the base theme on a malformed blob and never throws', () => {
    const result = resolveActiveTheme(input({ communityThemeBlob: 'not-a-real-theme-blob' }));
    expect(result.source).toBe('base');
    expect(result.theme).toEqual(BASE);
  });

  it('falls through to the accent when a malformed blob ships with a valid accent', () => {
    const result = resolveActiveTheme(input({
      communityThemeBlob: 'meerkat-theme:v1:garbage:deadbeef',
      communityAccent: COMMUNITY_ACCENT,
    }));
    expect(result.source).toBe('community_accent');
    expect(result.theme.accent).toBe(COMMUNITY_ACCENT);
  });

  it('ignores a malformed accent value (returns base)', () => {
    const result = resolveActiveTheme(input({ communityAccent: 'red' }));
    expect(result.source).toBe('base');
    expect(result.theme).toEqual(BASE);
  });

  it('returns the base theme when there is no community identity at all', () => {
    const result = resolveActiveTheme(input());
    expect(result.source).toBe('base');
    expect(result.theme).toEqual(BASE);
  });
});
