// Open Burrow palette for the web client.
//
// Ported verbatim from apps/meerkat/app/(root)/theme/tokens.ts (MK_PALETTES). Kept
// as plain TS constants so component logic can read color values where a CSS
// variable will not do (e.g. inline SVG). The structural theming is driven by the
// CSS custom properties in tokens.css; this object is the same source of truth in
// TS form. App Isolation: the mobile tokens module imports react-native, so it
// cannot be imported here; the values are replicated with this citation.

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

export const LIGHT: MkColors = {
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

export const DARK: MkColors = {
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

export const MK_PALETTES = { light: LIGHT, dark: DARK } as const;
export type MkPaletteMode = keyof typeof MK_PALETTES;

// Soft system monospace for true codes (fingerprint, keys, ids); never harsh Courier.
export const MK_MONO =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
