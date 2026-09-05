// Plan 38 Phase 1b (Design decision 2 / amendment D.2): resolveActiveTheme, the
// ONE pure choke point that decides which theme renders INSIDE a community's
// screens. This is the MOBILE source of truth; apps/meerkat-web/src/lib/
// community-theme-core.ts is a byte-identical twin (only this header differs),
// parity-locked by scripts/check-meerkat-parity.mjs.
//
// Priority (highest wins):
//   1. high contrast     -- the user's accessibility choice ALWAYS beats a
//      community theme. The app already renders the high-contrast palette at the
//      app level, so the choke point returns the base theme untouched.
//   2. member mode 'mine' -- the member opted out of this community's theme.
//   3. a valid theme blob -- decoded through the @mylife/meerkat-theme codec
//      (fail-SAFE: a malformed/undecodable blob NEVER throws and falls through
//      to the accent/base path).
//   4. an accent-only identity -- the community accent applied to the accent
//      slot ONLY, over the base theme.
//   5. nothing community-specific -- the base theme, unchanged.
//
// App chrome and DM threads never call this; only community route subtrees do
// (the leakage audit lives in Phase 1c). The function is pure and total.

import {
  decodeThemeBlob,
  resolveProfile,
  type MkColors,
  type MkPaletteMode,
  type MkThemeStyleExtras,
} from '@mylife/meerkat-theme';

/** Which rule produced the resolved theme (drives the honest "using ..." label). */
export type ActiveThemeSource =
  | 'high_contrast'
  | 'mine'
  | 'community_theme'
  | 'community_accent'
  | 'base';

export interface ResolveActiveThemeInput {
  /** The community's owner-signed theme codec blob, or null. */
  communityThemeBlob: string | null;
  /** The community's owner-signed accent (#rrggbb), or null. */
  communityAccent: string | null;
  /** The member's per-community choice: apply the community theme, or use mine. */
  memberMode: 'community' | 'mine';
  /** The user's accessibility high-contrast selection (always wins). */
  highContrastEnabled: boolean;
  /** The active palette mode, so a community blob resolves to the right side. */
  mode: MkPaletteMode;
  /** The app's current resolved palette (already high-contrast if enabled). */
  baseTheme: MkColors;
}

export interface ResolveActiveThemeResult {
  theme: MkColors;
  source: ActiveThemeSource;
  /**
   * Plan 56 feature 1: the community theme's extended style axes, present ONLY
   * when a full community theme blob resolved (never under high contrast or
   * 'mine', which always win back to the member's own rendering).
   */
  styleExtras: MkThemeStyleExtras | null;
}

/** #rrggbb only (the sync layer normalizes to this; re-checked here, pure + safe). */
const ACCENT_RE = /^#[0-9a-f]{6}$/i;

function withCommunityAccent(base: MkColors, accent: string): MkColors {
  return { ...base, accent };
}

/**
 * The single theme choke point. Pure and TOTAL: it never throws, and a malformed
 * community theme blob fails SAFE to the base theme (with the accent when set).
 */
export function resolveActiveTheme(input: ResolveActiveThemeInput): ResolveActiveThemeResult {
  const { communityThemeBlob, communityAccent, memberMode, highContrastEnabled, mode, baseTheme } = input;

  // 1. High contrast is the accessibility floor and beats everything.
  if (highContrastEnabled) return { theme: baseTheme, source: 'high_contrast', styleExtras: null };

  // 2. The member opted out of this community's look.
  if (memberMode === 'mine') return { theme: baseTheme, source: 'mine', styleExtras: null };

  const accent = communityAccent && ACCENT_RE.test(communityAccent) ? communityAccent : null;

  // 3. A full community theme blob, decoded fail-safe through the Plan 18 codec.
  if (communityThemeBlob) {
    const decoded = decodeThemeBlob(communityThemeBlob);
    if (decoded.success) {
      try {
        return {
          theme: resolveProfile(decoded.theme, mode),
          source: 'community_theme',
          styleExtras: decoded.theme.styleExtras ?? null,
        };
      } catch {
        // resolveProfile is pure over a schema-valid profile; guard anyway so the
        // choke point stays total, then fall through to accent/base.
      }
    }
  }

  // 4. Accent-only identity: the accent slot, over the base theme.
  if (accent) return { theme: withCommunityAccent(baseTheme, accent), source: 'community_accent', styleExtras: null };

  // 5. Nothing community-specific.
  return { theme: baseTheme, source: 'base', styleExtras: null };
}
