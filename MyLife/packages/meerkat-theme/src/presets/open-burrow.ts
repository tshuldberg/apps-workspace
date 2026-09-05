import type { MkThemeProfile } from '../types';

// Open Burrow: the calm warm-paper + sea-green default, ported byte-for-byte
// from apps/meerkat/app/(root)/theme/tokens.ts (MK_PALETTES). Every secondary
// token is pinned via `overrides` so resolution reproduces the exact shipped
// palette regardless of the derive heuristics (which are tuned for custom
// themes, not this brand-tuned baseline).
export const OPEN_BURROW: MkThemeProfile = {
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
    overrides: {
      surfaceElevated: '#FBFAF7',
      surfaceHigh: '#E9F1ED',
      accentDim: '#0A5D4D',
      onAccent: '#FFFFFF',
      textSecondary: '#51635C',
      textTertiary: '#6E7D77',
      dangerSoft: 'rgba(179, 65, 62, 0.08)',
      warningSoft: 'rgba(143, 102, 13, 0.08)',
      successSoft: 'rgba(25, 128, 95, 0.08)',
      infoSoft: 'rgba(53, 102, 176, 0.08)',
      border: 'rgba(32, 48, 43, 0.10)',
      borderStrong: 'rgba(32, 48, 43, 0.18)',
      glass: 'rgba(14, 124, 102, 0.05)',
      glassBorder: 'rgba(14, 124, 102, 0.14)',
    },
  },
  dark: {
    primary: {
      accent: '#58C5A5',
      background: '#111816',
      surface: '#19211E',
      text: '#E6EDE9',
      danger: '#E89A96',
      warning: '#DFB36A',
      info: '#93B8E8',
      success: '#6FCDA9',
    },
    overrides: {
      surfaceElevated: '#212B27',
      surfaceHigh: '#2A3531',
      accentDim: '#38967C',
      onAccent: '#0B2620',
      textSecondary: '#A4B3AC',
      textTertiary: '#75847C',
      dangerSoft: 'rgba(232, 154, 150, 0.12)',
      warningSoft: 'rgba(223, 179, 106, 0.12)',
      successSoft: 'rgba(111, 205, 169, 0.12)',
      infoSoft: 'rgba(147, 184, 232, 0.12)',
      border: 'rgba(230, 237, 233, 0.10)',
      borderStrong: 'rgba(230, 237, 233, 0.18)',
      glass: 'rgba(88, 197, 165, 0.06)',
      glassBorder: 'rgba(88, 197, 165, 0.14)',
    },
  },
};
