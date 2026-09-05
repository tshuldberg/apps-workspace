// Resolve a MkThemeProfile to a concrete MkColors set for a mode, plus helpers
// for single-mode fallback and the editor's "Mirror to dark/light" action. Pure.

import { parseColor } from './contrast';
import {
  adjustLightness,
  hslToRgb,
  rgbToHex,
  rgbToHsl,
} from './color-math';
import { deriveColors } from './derive';
import type {
  MkColors,
  MkModeSpec,
  MkPaletteMode,
  MkPrimaryColors,
  MkThemeProfile,
} from './types';

/**
 * The mode that will actually render for a requested mode. `light` is always
 * defined; a profile without a `dark` spec falls back to `light` so a
 * single-mode theme never renders broken opposite-mode colors.
 */
export function effectiveMode(
  profile: MkThemeProfile,
  requested: MkPaletteMode,
): MkPaletteMode {
  if (requested === 'dark') return profile.dark ? 'dark' : 'light';
  return 'light';
}

function specFor(profile: MkThemeProfile, mode: MkPaletteMode): MkModeSpec {
  return mode === 'dark' && profile.dark ? profile.dark : profile.light;
}

/** Resolve the full 22-token MkColors for a mode: derive from primaries, then apply overrides. */
export function resolveProfile(
  profile: MkThemeProfile,
  requested: MkPaletteMode,
): MkColors {
  const mode = effectiveMode(profile, requested);
  const spec = specFor(profile, mode);
  const derived = deriveColors(spec.primary, mode);
  return { ...derived, ...spec.overrides };
}

function flipLightness(color: string): string {
  const hsl = rgbToHsl(parseColor(color));
  hsl.l = 100 - hsl.l;
  return rgbToHex(hslToRgb(hsl));
}

function mirrorPrimary(
  primary: MkPrimaryColors,
  targetIsDark: boolean,
): MkPrimaryColors {
  // Surfaces + text flip across the lightness midpoint (light bg -> dark bg,
  // dark text -> light text). Accent + semantics keep hue/sat and nudge into the
  // target mode's band so they read at the right brightness.
  const nudge = (c: string): string => adjustLightness(c, targetIsDark ? 18 : -18);
  return {
    background: flipLightness(primary.background),
    surface: flipLightness(primary.surface),
    text: flipLightness(primary.text),
    accent: nudge(primary.accent),
    danger: nudge(primary.danger),
    warning: nudge(primary.warning),
    info: nudge(primary.info),
    success: nudge(primary.success),
  };
}

/**
 * Derive the opposite-mode spec from a defined mode (the editor's "Mirror to
 * dark/light"). Overrides are intentionally dropped: the mirror re-derives all
 * secondary tokens (including an AA-correct onAccent) for the new mode.
 */
export function mirrorMode(
  profile: MkThemeProfile,
  from: MkPaletteMode,
): MkModeSpec {
  const source = from === 'dark' ? profile.dark ?? profile.light : profile.light;
  const targetIsDark = from === 'light';
  return { primary: mirrorPrimary(source.primary, targetIsDark) };
}
