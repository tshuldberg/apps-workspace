import { describe, expect, it } from 'vitest';
import { generatePalette } from '../generate';
import { resolveProfile } from '../resolve';
import { parseColor, ratesAA } from '../contrast';
import { hslToRgb, rgbToHex } from '../color-math';
import { validateThemeProfile } from '../schema';

// A deterministic seed fuzz set (no Math.random): hand-picked edge colors plus a
// full hue sweep. Covers near-black/near-white/gray and every hue family.
const FIXED = [
  '#0E7C66', '#E8590C', '#6C3FC7', '#000000', '#FFFFFF', '#808080',
  '#123456', '#7A7A7A', '#B3413E', '#2563EB', '#58C5A5', '#1F4E5F',
];
const SWEEP = Array.from({ length: 12 }, (_unused, i) =>
  rgbToHex(hslToRgb({ h: i * 30, s: 70, l: 50 })),
);
const SEEDS = [...FIXED, ...SWEEP];

describe('generatePalette (TC-5)', () => {
  it('produces an AA palette in BOTH modes for a wide seed fuzz set', () => {
    for (const seed of SEEDS) {
      for (const mode of ['light', 'dark'] as const) {
        const profile = generatePalette(seed, mode);
        const c = resolveProfile(profile, mode);
        expect(ratesAA(c.text, c.background), `${seed}/${mode} text-on-background`).toBe(true);
        expect(ratesAA(c.text, c.surface), `${seed}/${mode} text-on-surface`).toBe(true);
        expect(ratesAA(c.onAccent, c.accent), `${seed}/${mode} onAccent-on-accent`).toBe(true);
      }
    }
  });

  it('uses the seed as the accent for the requested mode', () => {
    const seed = '#6C3FC7';
    const norm = rgbToHex(parseColor(seed));
    expect(generatePalette(seed, 'light').light.primary.accent).toBe(norm);
    expect(generatePalette(seed, 'dark').dark?.primary.accent).toBe(norm);
  });

  it('generates a complete, schema-valid, both-mode profile', () => {
    const p = generatePalette('#0E7C66', 'light');
    expect(p.light).toBeDefined();
    expect(p.dark).toBeDefined();
    expect(validateThemeProfile(p).success).toBe(true);
  });

  it('is deterministic (no randomness, no network)', () => {
    expect(generatePalette('#0E7C66', 'dark')).toEqual(generatePalette('#0E7C66', 'dark'));
    expect(generatePalette('#FFAA00', 'light')).toEqual(generatePalette('#FFAA00', 'light'));
  });
});
