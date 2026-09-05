import { describe, expect, it } from 'vitest';
import { deriveColors } from '../derive';
import { contrastRatio, parseColor, ratesAA } from '../contrast';
import type { MkColors, MkPrimaryColors } from '../types';

const LIGHT_PRIMARY: MkPrimaryColors = {
  accent: '#0E7C66',
  background: '#F6F4EF',
  surface: '#FFFFFF',
  text: '#20302B',
  danger: '#B3413E',
  warning: '#8F660D',
  info: '#3566B0',
  success: '#19805F',
};

const DARK_PRIMARY: MkPrimaryColors = {
  accent: '#58C5A5',
  background: '#111816',
  surface: '#19211E',
  text: '#E6EDE9',
  danger: '#E89A96',
  warning: '#DFB36A',
  info: '#93B8E8',
  success: '#6FCDA9',
};

const ALL_KEYS: Array<keyof MkColors> = [
  'background', 'surface', 'surfaceElevated', 'surfaceHigh',
  'accent', 'accentDim', 'onAccent',
  'text', 'textSecondary', 'textTertiary',
  'danger', 'warning', 'info', 'success',
  'dangerSoft', 'warningSoft', 'successSoft', 'infoSoft',
  'border', 'borderStrong', 'glass', 'glassBorder',
];

function lum(color: string): number {
  return contrastRatio(color, '#000000') * 0.05 - 0.05; // invert: ratio = (L+0.05)/0.05
}

describe('deriveColors', () => {
  it('is pure (deterministic across calls)', () => {
    expect(deriveColors(LIGHT_PRIMARY, 'light')).toEqual(
      deriveColors(LIGHT_PRIMARY, 'light'),
    );
  });

  it('passes the eight primaries through unchanged', () => {
    const c = deriveColors(LIGHT_PRIMARY, 'light');
    expect(c.accent).toBe(LIGHT_PRIMARY.accent);
    expect(c.background).toBe(LIGHT_PRIMARY.background);
    expect(c.surface).toBe(LIGHT_PRIMARY.surface);
    expect(c.text).toBe(LIGHT_PRIMARY.text);
    expect(c.danger).toBe(LIGHT_PRIMARY.danger);
    expect(c.warning).toBe(LIGHT_PRIMARY.warning);
    expect(c.info).toBe(LIGHT_PRIMARY.info);
    expect(c.success).toBe(LIGHT_PRIMARY.success);
  });

  it('produces all 22 tokens', () => {
    const c = deriveColors(LIGHT_PRIMARY, 'light');
    expect(Object.keys(c).sort()).toEqual([...ALL_KEYS].sort());
    for (const k of ALL_KEYS) {
      expect(typeof c[k]).toBe('string');
      expect(c[k].length).toBeGreaterThan(0);
    }
  });

  it('derives onAccent that meets AA against the accent (dark and light accents)', () => {
    const light = deriveColors(LIGHT_PRIMARY, 'light'); // dark accent -> light onAccent
    const dark = deriveColors(DARK_PRIMARY, 'dark'); // light accent -> dark onAccent
    expect(ratesAA(light.onAccent, light.accent)).toBe(true);
    expect(ratesAA(dark.onAccent, dark.accent)).toBe(true);
  });

  it('elevates surfaces upward in dark mode (surface < elevated < high in luminance)', () => {
    const c = deriveColors(DARK_PRIMARY, 'dark');
    expect(lum(c.surfaceElevated)).toBeGreaterThan(lum(c.surface));
    expect(lum(c.surfaceHigh)).toBeGreaterThan(lum(c.surfaceElevated));
  });

  it('keeps elevated surfaces at or below a near-white surface in light mode', () => {
    const c = deriveColors(LIGHT_PRIMARY, 'light');
    expect(lum(c.surfaceElevated)).toBeLessThanOrEqual(lum(c.surface) + 1e-6);
  });

  it('derives secondary/tertiary text with progressively lower contrast than body text', () => {
    const c = deriveColors(LIGHT_PRIMARY, 'light');
    const body = contrastRatio(c.text, c.background);
    const secondary = contrastRatio(c.textSecondary, c.background);
    const tertiary = contrastRatio(c.textTertiary, c.background);
    expect(c.textSecondary).not.toBe(c.text);
    expect(secondary).toBeLessThan(body);
    expect(tertiary).toBeLessThan(secondary);
    expect(tertiary).toBeGreaterThan(1);
  });

  it('derives translucent soft fills, borders, and glass (alpha < 1)', () => {
    const c = deriveColors(LIGHT_PRIMARY, 'light');
    for (const k of ['dangerSoft', 'warningSoft', 'successSoft', 'infoSoft', 'border', 'borderStrong', 'glass', 'glassBorder'] as const) {
      expect(parseColor(c[k]).a).toBeLessThan(1);
    }
  });
});
