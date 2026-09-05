import { describe, expect, it } from 'vitest';
import { MkThemeProfileSchema } from '../schema';
import type { MkThemeProfile } from '../types';

const VALID: MkThemeProfile = {
  version: 1,
  id: 'open-burrow',
  name: 'Open Burrow',
  register: 'Calm',
  shape: { radius: 'md' },
  density: 'cozy',
  headingWeight: '700',
  light: {
    primary: {
      accent: '#0E7C66',
      background: '#F6F4EF',
      surface: '#FFFFFF',
      text: '#20302B',
      danger: '#B3413E',
      warning: '#8F660D',
      info: '#3566B0',
      success: '#19805F',
    },
    overrides: { onAccent: '#FFFFFF', surfaceHigh: 'rgba(14, 124, 102, 0.10)' },
  },
};

describe('MkThemeProfileSchema', () => {
  it('parses a valid profile', () => {
    const r = MkThemeProfileSchema.safeParse(VALID);
    expect(r.success).toBe(true);
  });

  it('accepts the four allowed color forms', () => {
    for (const c of ['#fff', '#0E7C66', '#0e7c66ff', 'rgb(14,124,102)', 'rgba(14, 124, 102, 0.1)']) {
      const r = MkThemeProfileSchema.safeParse({
        ...VALID,
        light: { primary: { ...VALID.light.primary, accent: c } },
      });
      expect(r.success).toBe(true);
    }
  });

  it('rejects a non-color value in a primary (named colors, arbitrary strings)', () => {
    for (const bad of ['red', 'javascript:alert(1)', 'url(http://x)', '']) {
      const r = MkThemeProfileSchema.safeParse({
        ...VALID,
        light: { primary: { ...VALID.light.primary, accent: bad } },
      });
      expect(r.success).toBe(false);
    }
  });

  it('rejects an unknown top-level key (strict)', () => {
    const r = MkThemeProfileSchema.safeParse({ ...VALID, evil: 'x' });
    expect(r.success).toBe(false);
  });

  it('rejects a fonts field (no remote/url() fonts allowed in v1)', () => {
    const r = MkThemeProfileSchema.safeParse({ ...VALID, fonts: { body: 'url(http://x)' } });
    expect(r.success).toBe(false);
  });

  it('rejects an unknown schema version', () => {
    const r = MkThemeProfileSchema.safeParse({ ...VALID, version: 2 });
    expect(r.success).toBe(false);
  });

  it('rejects out-of-range rgb channels (only 0-255 integers)', () => {
    for (const bad of ['rgb(999,0,0)', 'rgb(0,256,0)', 'rgb(300, 0, 0)', 'rgba(0,0,0,2)']) {
      const r = MkThemeProfileSchema.safeParse({
        ...VALID,
        light: { primary: { ...VALID.light.primary, accent: bad } },
      });
      expect(r.success).toBe(false);
    }
  });

  it('rejects colors with embedded newlines/tabs inside rgb()', () => {
    for (const bad of ['rgb(\n255,\n0,\n0)', 'rgb(255,\t0,0)', 'rgba(0,0,0,\n0.5)']) {
      const r = MkThemeProfileSchema.safeParse({
        ...VALID,
        light: { primary: { ...VALID.light.primary, accent: bad } },
      });
      expect(r.success).toBe(false);
    }
  });

  it('trims surrounding whitespace/newlines so stored color values are clean', () => {
    const r = MkThemeProfileSchema.safeParse({
      ...VALID,
      light: { primary: { ...VALID.light.primary, accent: '  #0E7C66\n' } },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.light.primary.accent).toBe('#0E7C66');
  });
});
