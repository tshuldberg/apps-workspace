// Plan 38 Phase 1c (web): the per-community theme VIEW-SCOPING seam. Proves the
// leakage boundary structurally -- a community theme may reskin ONLY a community's
// own panes (channel, files); the Messages/DM surface, the Feed, and Discover
// (and, by omission, the app-chrome rail which never mounts a boundary) never get
// it. Also proves the honest source/toggle copy is exactly the locked strings.

import { describe, it, expect } from 'vitest';
import { OPEN_BURROW, PLAYFUL, encodeThemeBlob, resolveProfile } from '@mylife/meerkat-theme';
import {
  COMMUNITY_THEME_SOURCE_LABEL,
  HIGH_CONTRAST_SOURCE_LABEL,
  MY_THEME_SOURCE_LABEL,
  USE_COMMUNITY_THEME_LABEL,
  USE_MY_THEME_LABEL,
  communityThemeSourceLabel,
  communityThemeToggleLabel,
  isCommunityThemedPane,
  resolveCommunityViewTheme,
} from '../community-theme-view';
import type { MainPane } from '../../ui/navigation/view-state';

const baseTheme = resolveProfile(OPEN_BURROW, 'light');
const communityBlob = encodeThemeBlob(PLAYFUL);

function input(pane: MainPane, overrides: Partial<Parameters<typeof resolveCommunityViewTheme>[0]> = {}) {
  return {
    pane,
    hasCommunity: true,
    communityThemeBlob: communityBlob,
    communityAccent: '#123456',
    memberMode: 'community' as const,
    highContrastEnabled: false,
    mode: 'light' as const,
    baseTheme,
    ...overrides,
  };
}

describe('leakage boundary: only a community own-screen pane may carry the community theme', () => {
  it('applies to community panes (channel, files)', () => {
    expect(isCommunityThemedPane('channel')).toBe(true);
    expect(isCommunityThemedPane('files')).toBe(true);
    expect(resolveCommunityViewTheme(input('channel')).apply).toBe(true);
    expect(resolveCommunityViewTheme(input('files')).apply).toBe(true);
  });

  it('NEVER applies to the Messages/DM surface, Feed, or Discover', () => {
    for (const pane of ['messages', 'feed', 'discover', 'friends'] as MainPane[]) {
      expect(isCommunityThemedPane(pane)).toBe(false);
      expect(resolveCommunityViewTheme(input(pane)).apply).toBe(false);
    }
  });

  it('does not apply when no community is selected even on a community pane', () => {
    expect(resolveCommunityViewTheme(input('channel', { hasCommunity: false })).apply).toBe(false);
  });

  it('a community pane resolves the community theme (source community_theme)', () => {
    const result = resolveCommunityViewTheme(input('channel'));
    expect(result.source).toBe('community_theme');
    expect(result.theme).not.toEqual(baseTheme);
  });
});

describe('overrides win at the choke point regardless of pane', () => {
  it('high contrast always wins (base theme, source high_contrast)', () => {
    const result = resolveCommunityViewTheme(input('channel', { highContrastEnabled: true }));
    expect(result.source).toBe('high_contrast');
    expect(result.theme).toEqual(baseTheme);
  });

  it("member 'mine' opts out (base theme, source mine)", () => {
    const result = resolveCommunityViewTheme(input('channel', { memberMode: 'mine' }));
    expect(result.source).toBe('mine');
    expect(result.theme).toEqual(baseTheme);
  });
});

describe('honest, parity-locked source + toggle copy', () => {
  it('maps each source to its exact label', () => {
    expect(communityThemeSourceLabel('community_theme')).toBe(COMMUNITY_THEME_SOURCE_LABEL);
    expect(communityThemeSourceLabel('community_accent')).toBe(COMMUNITY_THEME_SOURCE_LABEL);
    expect(communityThemeSourceLabel('mine')).toBe(MY_THEME_SOURCE_LABEL);
    expect(communityThemeSourceLabel('high_contrast')).toBe(HIGH_CONTRAST_SOURCE_LABEL);
    expect(communityThemeSourceLabel('base')).toBeNull();
  });

  it('uses the exact locked strings', () => {
    expect(COMMUNITY_THEME_SOURCE_LABEL).toBe('Community theme');
    expect(MY_THEME_SOURCE_LABEL).toBe('Your theme');
    expect(HIGH_CONTRAST_SOURCE_LABEL).toBe('High contrast');
    expect(USE_MY_THEME_LABEL).toBe('Use my theme');
    expect(USE_COMMUNITY_THEME_LABEL).toBe('Use community theme');
  });

  it('toggle label flips with the device mode', () => {
    expect(communityThemeToggleLabel('community')).toBe(USE_MY_THEME_LABEL);
    expect(communityThemeToggleLabel('mine')).toBe(USE_COMMUNITY_THEME_LABEL);
  });
});
