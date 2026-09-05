// Plan 38 Phase 1c (web, Design decision 2 / amendment D.2): the view-scoping seam
// for per-community retheming. resolveActiveTheme (community-theme-core.ts) decides
// WHICH theme; this module decides WHERE it may apply. A community theme is scoped
// to that community's own screens only -- on the web SPA those are the community
// channel + files panes. App chrome (the rail), the Messages/DM surface, the Feed,
// and Discover are NEVER community-themed, so this seam returns apply:false for
// them. The leakage guarantee is structural: only a community pane can carry the
// community palette, and even then only through resolveActiveTheme's honest source.

import type { MainPane } from '../ui/navigation/view-state';
import {
  resolveActiveTheme,
  type ActiveThemeSource,
  type ResolveActiveThemeInput,
  type ResolveActiveThemeResult,
} from './community-theme-core';

/** The ONLY panes a community theme may reskin (a community's own screens). */
export const COMMUNITY_THEMED_PANES: ReadonlySet<MainPane> = new Set<MainPane>(['channel', 'files']);

/** Whether a pane is one of the current community's own screens. */
export function isCommunityThemedPane(pane: MainPane): boolean {
  return COMMUNITY_THEMED_PANES.has(pane);
}

export interface CommunityViewThemeInput extends ResolveActiveThemeInput {
  /** The pane currently rendered in the main region. */
  pane: MainPane;
  /** Whether a community is actually selected for this view. */
  hasCommunity: boolean;
}

export interface CommunityViewThemeResult extends ResolveActiveThemeResult {
  /** True only when the resolved theme may reskin the current subtree. */
  apply: boolean;
}

/**
 * Resolve the theme for the current community view AND whether it may be applied.
 * `apply` is true only for a community's own panes with a community selected; every
 * other surface (Messages, Feed, Discover, the rail) gets apply:false and must keep
 * the base theme. Pure + total.
 */
export function resolveCommunityViewTheme(input: CommunityViewThemeInput): CommunityViewThemeResult {
  const resolved = resolveActiveTheme(input);
  const apply = input.hasCommunity && isCommunityThemedPane(input.pane);
  return { ...resolved, apply };
}

// --- Honest, parity-locked source + toggle copy -----------------------------
// These EXACT strings are locked across surfaces by the lead. Do not paraphrase.

export const COMMUNITY_THEME_SOURCE_LABEL = 'Community theme';
export const MY_THEME_SOURCE_LABEL = 'Your theme';
export const HIGH_CONTRAST_SOURCE_LABEL = 'High contrast';
export const USE_MY_THEME_LABEL = 'Use my theme';
export const USE_COMMUNITY_THEME_LABEL = 'Use community theme';
export const APPEARANCE_AND_IDENTITY_LABEL = 'Appearance & identity';

/**
 * The honest "using ..." label for a resolved source, or null when there is no
 * community-specific look to name (base). Never invents state.
 */
export function communityThemeSourceLabel(source: ActiveThemeSource): string | null {
  switch (source) {
    case 'high_contrast':
      return HIGH_CONTRAST_SOURCE_LABEL;
    case 'mine':
      return MY_THEME_SOURCE_LABEL;
    case 'community_theme':
    case 'community_accent':
      return COMMUNITY_THEME_SOURCE_LABEL;
    case 'base':
      return null;
    default:
      return null;
  }
}

/** The label for the member's theme toggle button given the current device mode. */
export function communityThemeToggleLabel(mode: 'community' | 'mine'): string {
  return mode === 'community' ? USE_MY_THEME_LABEL : USE_COMMUNITY_THEME_LABEL;
}
