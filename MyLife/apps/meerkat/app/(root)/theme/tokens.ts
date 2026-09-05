// Meerkat brand tokens -- "Open Burrow".
//
// A calm, trustworthy identity for a broad global audience: warm paper and
// sea green, not neon-on-black. Keeps Meerkat's teal-green brand DNA but drops
// the voltage (13.5:1 neon-on-void -> ~5:1 sea-green on paper). Light is the
// default; a calm dark variant is defined for the mode switch.
//
// Built as plain constants so screens can pull them directly and pass explicit
// colors to @mylife/ui primitives (which take color props) without registering
// Meerkat in @mylife/ui tokens. Every screen reads MK_COLORS, so the active
// palette is a single value swap away.

import { Platform } from 'react-native';

// formatBytes/shortHex live in a react-native-free module so pure logic + Node
// tests can use them; re-exported here so screens keep importing from tokens.
export { formatBytes, shortHex } from './format';

export interface MkColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceHigh: string;
  accent: string;
  accentDim: string;
  onAccent: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  danger: string;
  warning: string;
  info: string;
  success: string;
  dangerSoft: string;
  warningSoft: string;
  successSoft: string;
  infoSoft: string;
  border: string;
  borderStrong: string;
  glass: string;
  glassBorder: string;
}

const LIGHT: MkColors = {
  // Surfaces (lowest to highest).
  background: '#F6F4EF', // warm paper
  surface: '#FFFFFF',
  surfaceElevated: '#FBFAF7',
  surfaceHigh: '#E9F1ED', // sea-green tint

  // Brand signal.
  accent: '#0E7C66', // sea green
  accentDim: '#0A5D4D',
  onAccent: '#FFFFFF', // text on an accent fill

  // Text (deep moss, never pure black).
  text: '#20302B',
  textSecondary: '#51635C',
  textTertiary: '#6E7D77',

  // Status / semantic (desaturated, calm).
  danger: '#B3413E', // brick, not alarm pink
  warning: '#8F660D', // ochre
  info: '#3566B0', // calm blue (replaces violet)
  success: '#19805F', // distinct from accent

  // Soft semantic fills (for notice/result boxes).
  dangerSoft: 'rgba(179, 65, 62, 0.08)',
  warningSoft: 'rgba(143, 102, 13, 0.08)',
  successSoft: 'rgba(25, 128, 95, 0.08)',
  infoSoft: 'rgba(53, 102, 176, 0.08)',

  // Lines.
  border: 'rgba(32, 48, 43, 0.10)',
  borderStrong: 'rgba(32, 48, 43, 0.18)',

  // Glass / accent wash.
  glass: 'rgba(14, 124, 102, 0.05)',
  glassBorder: 'rgba(14, 124, 102, 0.14)',
};

const DARK: MkColors = {
  background: '#111816', // warm green-charcoal
  surface: '#19211E',
  surfaceElevated: '#212B27',
  surfaceHigh: '#2A3531',

  accent: '#58C5A5', // soft mint
  accentDim: '#38967C',
  onAccent: '#0B2620',

  text: '#E6EDE9',
  textSecondary: '#A4B3AC',
  textTertiary: '#75847C',

  danger: '#E89A96', // soft coral
  warning: '#DFB36A', // sand
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

export const MK_PALETTES = { light: LIGHT, dark: DARK } as const;
export type MkPaletteMode = keyof typeof MK_PALETTES;

// The active palette. Every screen reads this, so the light-first reskin is a
// pure value swap; the mode switch serves MK_PALETTES[mode] through the theme
// provider instead.
export const MK_COLORS: MkColors = MK_PALETTES.light;

// A soft system monospace for the few true codes (friend code, fingerprint,
// content ids) -- never the harsh 'Courier'.
export const MK_MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
}) as string;

export const MK_SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

// Rounder than before: softer, friendlier, closer to the consumer register.
export const MK_RADIUS = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

// Scope badge color: one per share scope, resolved against the active palette.
export function scopeColor(scope: string, c: MkColors): string {
  switch (scope) {
    case 'personal_replica':
      return c.info;
    case 'shared_workspace':
      return c.warning;
    case 'published_blob':
      return c.accent;
    default:
      return c.textSecondary;
  }
}

export function scopeLabel(scope: string): string {
  switch (scope) {
    case 'personal_replica':
      return 'Personal';
    case 'shared_workspace':
      return 'Community';
    case 'published_blob':
      return 'Public link';
    default:
      return scope;
  }
}
