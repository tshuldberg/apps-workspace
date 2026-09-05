import { describe, expect, it } from 'vitest';
import { effectiveMode, mirrorMode, resolveProfile } from '../resolve';
import { ratesAA, relativeLuminance } from '../contrast';
import type { MkPrimaryColors, MkThemeProfile } from '../types';

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

function makeProfile(over?: Partial<MkThemeProfile>): MkThemeProfile {
  return {
    version: 1,
    id: 'test',
    name: 'Test',
    shape: { radius: 'md' },
    density: 'cozy',
    headingWeight: '700',
    light: { primary: LIGHT_PRIMARY },
    dark: { primary: DARK_PRIMARY },
    ...over,
  };
}

describe('effectiveMode', () => {
  it('returns the requested mode when that mode is defined', () => {
    const p = makeProfile();
    expect(effectiveMode(p, 'light')).toBe('light');
    expect(effectiveMode(p, 'dark')).toBe('dark');
  });

  it('falls back to light when only light is defined', () => {
    const p = makeProfile({ dark: undefined });
    expect(effectiveMode(p, 'dark')).toBe('light');
  });
});

describe('resolveProfile', () => {
  it('resolves a full 22-token MkColors set with a derived AA onAccent', () => {
    const c = resolveProfile(makeProfile(), 'light');
    expect(c.background).toBe(LIGHT_PRIMARY.background);
    expect(ratesAA(c.onAccent, c.accent)).toBe(true);
  });

  it('applies advanced overrides on top of the derived tokens', () => {
    const p = makeProfile({
      light: { primary: LIGHT_PRIMARY, overrides: { accentDim: '#123456', surfaceHigh: '#abcdef' } },
    });
    const c = resolveProfile(p, 'light');
    expect(c.accentDim).toBe('#123456');
    expect(c.surfaceHigh).toBe('#abcdef');
    // A token NOT overridden is still derived.
    expect(c.onAccent).not.toBe('#123456');
  });

  it('resolves to the defined mode for a single-mode theme (no broken opposite)', () => {
    const p = makeProfile({ dark: undefined });
    expect(resolveProfile(p, 'dark')).toEqual(resolveProfile(p, 'light'));
  });
});

describe('mirrorMode', () => {
  it('darkens the surfaces when mirroring a light theme to dark', () => {
    const p = makeProfile();
    const mirrored = mirrorMode(p, 'light');
    expect(relativeLuminance(mirrored.primary.background)).toBeLessThan(
      relativeLuminance(LIGHT_PRIMARY.background),
    );
    expect(relativeLuminance(mirrored.primary.surface)).toBeLessThan(
      relativeLuminance(LIGHT_PRIMARY.surface),
    );
  });

  it('is deterministic', () => {
    const p = makeProfile();
    expect(mirrorMode(p, 'light')).toEqual(mirrorMode(p, 'light'));
  });

  it('produces a mirror whose resolved onAccent still meets AA', () => {
    const p = makeProfile();
    const mirrored = mirrorMode(p, 'light');
    const resolved = resolveProfile(makeProfile({ dark: mirrored }), 'dark');
    expect(ratesAA(resolved.onAccent, resolved.accent)).toBe(true);
  });
});
