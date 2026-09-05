// Local, deterministic palette generator. Builds a full, AA-targeting theme from
// a single seed accent using HSL + real contrast math. Fully offline and
// deterministic: no network, no randomness, no "AI". UI copy must say "Generate
// from a color", never "AI" or anything implying a server (NC-5).

import { contrastRatio, parseColor } from './contrast';
import { hslToRgb, rgbToHex, rgbToHsl, type Hsl } from './color-math';
import type {
  MkPaletteMode,
  MkPrimaryColors,
  MkThemeProfile,
} from './types';

// Margin above the 4.5 AA floor so a generated palette is comfortably accessible.
const AA_TARGET = 4.6;

function hsl(h: number, s: number, l: number): string {
  return rgbToHex(hslToRgb({ h, s, l }));
}

function clampS(s: number, max: number): number {
  return Math.min(s, max);
}

// Semantic hues stay recognizable regardless of the seed.
const SEMANTIC_HUES = { danger: 8, warning: 40, info: 212, success: 150 };

function semantics(mode: MkPaletteMode): {
  danger: string;
  warning: string;
  info: string;
  success: string;
} {
  const l = mode === 'dark' ? 70 : 38;
  const s = mode === 'dark' ? 60 : 62;
  return {
    danger: hsl(SEMANTIC_HUES.danger, s, l),
    warning: hsl(SEMANTIC_HUES.warning, s, l),
    info: hsl(SEMANTIC_HUES.info, s, l),
    success: hsl(SEMANTIC_HUES.success, s, l),
  };
}

/** Force `textHsl` to a lightness that clears AA against both bg and surface. */
function correctedText(
  textHsl: Hsl,
  background: string,
  surface: string,
  mode: MkPaletteMode,
): string {
  const step = mode === 'dark' ? 3 : -3; // dark text gets lighter, light text gets darker
  let l = textHsl.l;
  for (let i = 0; i < 40; i++) {
    const hex = hsl(textHsl.h, textHsl.s, l);
    const worst = Math.min(contrastRatio(hex, background), contrastRatio(hex, surface));
    if (worst >= AA_TARGET) return hex;
    l = Math.max(0, Math.min(100, l + step));
    if (l === 0 || l === 100) return hsl(textHsl.h, textHsl.s, l);
  }
  return hsl(textHsl.h, textHsl.s, l);
}

/** Pick an accent lightness visible against the opposite mode's background. */
function accentFitForMode(seed: string, mode: MkPaletteMode): string {
  const h = rgbToHsl(parseColor(seed));
  if (mode === 'dark' && h.l < 50) return hsl(h.h, Math.max(h.s, 45), 60);
  if (mode === 'light' && h.l > 55) return hsl(h.h, Math.max(h.s, 45), 40);
  return rgbToHex(parseColor(seed));
}

function buildPrimaries(
  seed: string,
  mode: MkPaletteMode,
  useSeedAsAccent: boolean,
): MkPrimaryColors {
  const seedHsl = rgbToHsl(parseColor(seed));
  const accent = useSeedAsAccent ? rgbToHex(parseColor(seed)) : accentFitForMode(seed, mode);

  const background =
    mode === 'dark'
      ? hsl(seedHsl.h, clampS(seedHsl.s, 22), 8)
      : hsl(seedHsl.h, clampS(seedHsl.s, 16), 96);
  const surface =
    mode === 'dark'
      ? hsl(seedHsl.h, clampS(seedHsl.s, 18), 13)
      : hsl(seedHsl.h, clampS(seedHsl.s, 8), 99);
  const textHsl: Hsl =
    mode === 'dark'
      ? { h: seedHsl.h, s: clampS(seedHsl.s, 16), l: 92 }
      : { h: seedHsl.h, s: clampS(seedHsl.s, 22), l: 18 };
  const text = correctedText(textHsl, background, surface, mode);

  const sem = semantics(mode);
  return { accent, background, surface, text, ...sem };
}

function shortHexId(seed: string): string {
  const c = parseColor(seed);
  return rgbToHex(c).slice(1); // 'rrggbb'
}

/**
 * Generate a complete, AA-targeting two-mode theme from one seed accent. The
 * requested `mode` uses the seed verbatim as its accent; the opposite mode is
 * generated with an accent lightness fit to that mode. Both modes clear AA for
 * body-on-background, body-on-surface, and onAccent-on-accent (the last is
 * guaranteed by the derive step).
 */
export function generatePalette(seed: string, mode: MkPaletteMode): MkThemeProfile {
  const opposite: MkPaletteMode = mode === 'dark' ? 'light' : 'dark';
  const requested = buildPrimaries(seed, mode, true);
  const other = buildPrimaries(seed, opposite, false);

  const lightPrimary = mode === 'light' ? requested : other;
  const darkPrimary = mode === 'dark' ? requested : other;

  return {
    version: 1,
    id: `gen-${shortHexId(seed)}`,
    name: 'Generated',
    register: 'Custom',
    shape: { radius: 'md' },
    density: 'cozy',
    headingWeight: '700',
    light: { primary: lightPrimary },
    dark: { primary: darkPrimary },
  };
}
