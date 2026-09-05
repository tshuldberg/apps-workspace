// Derive the 14 secondary tokens from the 8 primaries a user edits. Custom and
// generated themes lean on this; presets may override any result with exact
// brand values. Deterministic and pure. `onAccent` is chosen by real contrast so
// a button label always reads on its accent (never a hardcoded guess).

import { contrastRatio } from './contrast';
import { adjustLightness, mix, withAlpha } from './color-math';
import type { MkColors, MkPaletteMode, MkPrimaryColors } from './types';

/** Pick the foreground (light vs deep-tinted dark) that reads best on `accent`, guaranteeing AA. */
function deriveOnAccent(accent: string): string {
  const lightOption = '#FFFFFF';
  // A deep tint of the accent hue reads as an intentional "on-brand" dark.
  const darkOption = adjustLightness(accent, -70);
  const best =
    contrastRatio(lightOption, accent) >= contrastRatio(darkOption, accent)
      ? lightOption
      : darkOption;
  if (contrastRatio(best, accent) >= 4.5) return best;
  // Borderline accent near the white/black crossover: fall back to pure
  // extremes, whose best-of is always >= ~4.58 (provably AA).
  return contrastRatio('#FFFFFF', accent) >= contrastRatio('#000000', accent)
    ? '#FFFFFF'
    : '#000000';
}

/**
 * Derive the full 22-token `MkColors` set from the eight primaries for one mode.
 * The eight primaries pass through unchanged; everything else is computed.
 */
export function deriveColors(
  primary: MkPrimaryColors,
  mode: MkPaletteMode,
): MkColors {
  const isDark = mode === 'dark';
  const { accent, background, surface, text, danger, warning, info, success } =
    primary;

  return {
    // Primaries pass through.
    background,
    surface,
    accent,
    text,
    danger,
    warning,
    info,
    success,

    // Surfaces: elevate upward in dark, settle toward paper in light.
    surfaceElevated: isDark
      ? mix(surface, '#FFFFFF', 0.045)
      : mix(surface, background, 0.4),
    surfaceHigh: isDark ? mix(surface, '#FFFFFF', 0.085) : mix(surface, accent, 0.1),

    // Accent shades.
    accentDim: adjustLightness(accent, isDark ? -15 : -8),
    onAccent: deriveOnAccent(accent),

    // Text steps toward the background (lower contrast for secondary/tertiary).
    textSecondary: mix(text, background, 0.27),
    textTertiary: mix(text, background, 0.42),

    // Soft semantic fills.
    dangerSoft: withAlpha(danger, isDark ? 0.12 : 0.08),
    warningSoft: withAlpha(warning, isDark ? 0.12 : 0.08),
    successSoft: withAlpha(success, isDark ? 0.12 : 0.08),
    infoSoft: withAlpha(info, isDark ? 0.12 : 0.08),

    // Lines + glass derived off text and accent.
    border: withAlpha(text, 0.1),
    borderStrong: withAlpha(text, 0.18),
    glass: withAlpha(accent, isDark ? 0.06 : 0.05),
    glassBorder: withAlpha(accent, 0.14),
  };
}
