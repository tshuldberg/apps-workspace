import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRESET_ID,
  PRESETS,
  PRESET_IDS,
  getPreset,
} from '../presets';
import { ratesAA, ratesAAA } from '../contrast';
import { resolveProfile } from '../resolve';
import { validateThemeProfile } from '../schema';
import type { MkColors, MkPaletteMode } from '../types';

const MODES: MkPaletteMode[] = ['light', 'dark'];

// The exact shipped Open Burrow palette from apps/meerkat/.../theme/tokens.ts.
// Phase 1 must reproduce it byte-for-byte so the default look never shifts.
const OPEN_BURROW_LIGHT: MkColors = {
  background: '#F6F4EF',
  surface: '#FFFFFF',
  surfaceElevated: '#FBFAF7',
  surfaceHigh: '#E9F1ED',
  accent: '#0E7C66',
  accentDim: '#0A5D4D',
  onAccent: '#FFFFFF',
  text: '#20302B',
  textSecondary: '#51635C',
  textTertiary: '#6E7D77',
  danger: '#B3413E',
  warning: '#8F660D',
  info: '#3566B0',
  success: '#19805F',
  dangerSoft: 'rgba(179, 65, 62, 0.08)',
  warningSoft: 'rgba(143, 102, 13, 0.08)',
  successSoft: 'rgba(25, 128, 95, 0.08)',
  infoSoft: 'rgba(53, 102, 176, 0.08)',
  border: 'rgba(32, 48, 43, 0.10)',
  borderStrong: 'rgba(32, 48, 43, 0.18)',
  glass: 'rgba(14, 124, 102, 0.05)',
  glassBorder: 'rgba(14, 124, 102, 0.14)',
};

const OPEN_BURROW_DARK: MkColors = {
  background: '#111816',
  surface: '#19211E',
  surfaceElevated: '#212B27',
  surfaceHigh: '#2A3531',
  accent: '#58C5A5',
  accentDim: '#38967C',
  onAccent: '#0B2620',
  text: '#E6EDE9',
  textSecondary: '#A4B3AC',
  textTertiary: '#75847C',
  danger: '#E89A96',
  warning: '#DFB36A',
  info: '#93B8E8',
  success: '#6FCDA9',
  dangerSoft: 'rgba(232, 154, 150, 0.12)',
  warningSoft: 'rgba(223, 179, 106, 0.12)',
  successSoft: 'rgba(111, 205, 169, 0.12)',
  infoSoft: 'rgba(147, 184, 232, 0.12)',
  border: 'rgba(230, 237, 233, 0.10)',
  borderStrong: 'rgba(230, 237, 233, 0.18)',
  glass: 'rgba(88, 197, 165, 0.06)',
  glassBorder: 'rgba(88, 197, 165, 0.14)',
};

describe('preset registry', () => {
  it('ships at least six presets with Open Burrow as the default', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(6);
    expect(DEFAULT_PRESET_ID).toBe('open-burrow');
    expect(PRESET_IDS).toContain('open-burrow');
    expect(getPreset('open-burrow')?.id).toBe('open-burrow');
    expect(getPreset('does-not-exist')).toBeUndefined();
  });

  it('has unique ids and a defined light + dark for every preset', () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PRESETS) {
      expect(p.light).toBeDefined();
      expect(p.dark).toBeDefined();
    }
  });

  it('every preset is schema-valid (strict colors, no stray keys)', () => {
    for (const p of PRESETS) {
      const result = validateThemeProfile(p);
      expect(result.success, `${p.id}: ${JSON.stringify((result as { errors?: string[] }).errors)}`).toBe(true);
    }
  });
});

describe('preset accessibility (TC-4)', () => {
  it('passes AA for body-on-background, body-on-surface, and onAccent-on-accent in BOTH modes', () => {
    for (const preset of PRESETS) {
      for (const mode of MODES) {
        const c = resolveProfile(preset, mode);
        expect(ratesAA(c.text, c.background), `${preset.id}/${mode} text-on-background`).toBe(true);
        expect(ratesAA(c.text, c.surface), `${preset.id}/${mode} text-on-surface`).toBe(true);
        expect(ratesAA(c.onAccent, c.accent), `${preset.id}/${mode} onAccent-on-accent`).toBe(true);
      }
    }
  });

  it('the High-Contrast preset reaches AAA on body text in both modes', () => {
    const hc = getPreset('high-contrast');
    expect(hc).toBeDefined();
    for (const mode of MODES) {
      const c = resolveProfile(hc!, mode);
      expect(ratesAAA(c.text, c.background), `high-contrast/${mode}`).toBe(true);
    }
  });
});

describe('Open Burrow port fidelity', () => {
  it('resolves to the exact shipped tokens.ts palette in light mode', () => {
    expect(resolveProfile(getPreset('open-burrow')!, 'light')).toEqual(OPEN_BURROW_LIGHT);
  });

  it('resolves to the exact shipped tokens.ts palette in dark mode', () => {
    expect(resolveProfile(getPreset('open-burrow')!, 'dark')).toEqual(OPEN_BURROW_DARK);
  });
});
