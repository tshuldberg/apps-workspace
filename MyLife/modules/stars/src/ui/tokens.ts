import type { ViewStyle } from 'react-native';
import type { Aspect, MoonPhase, ZodiacElement, ZodiacSign } from '../types';
import { ST_FONTS } from './typography';

export { ST_FONTS };

export const ST_TEXT = '#E4E1E9';
export const ST_TEXT_SECONDARY = '#D6C3B5';
export const ST_TEXT_TERTIARY = '#9F8E81';
export const ST_TEXT_MUTED = 'rgba(228, 225, 233, 0.42)';

export const ST_ACCENT = '#A78BFA';
export const ST_ACCENT_LIGHT = '#C4B5FD';
export const ST_ACCENT_DEEP = '#7C3AED';
export const ST_ACCENT_GLOW = 'rgba(167, 139, 250, 0.4)';
export const ST_ON_ACCENT = '#1A103D';

export const ST_ELEMENTS = {
  fire: '#FFB4AB',
  earth: '#84CC16',
  air: '#8BCFF0',
  water: '#A78BFA',
} as const satisfies Record<ZodiacElement, string>;

export const ST_MODALITIES = {
  cardinal: '#FFB877',
  fixed: '#A78BFA',
  mutable: '#8BCFF0',
} as const;

export const ST_SIGN_ELEMENTS = {
  aries: 'fire',
  taurus: 'earth',
  gemini: 'air',
  cancer: 'water',
  leo: 'fire',
  virgo: 'earth',
  libra: 'air',
  scorpio: 'water',
  sagittarius: 'fire',
  capricorn: 'earth',
  aquarius: 'air',
  pisces: 'water',
} as const satisfies Record<ZodiacSign, ZodiacElement>;

export const ST_MOON_PHASES = {
  new_moon: '#35343A',
  waxing_crescent: '#52443A',
  first_quarter: '#8BCFF0',
  waxing_gibbous: '#D6C3B5',
  full_moon: '#FFB877',
  waning_gibbous: '#D6C3B5',
  last_quarter: '#8BCFF0',
  waning_crescent: '#52443A',
} as const satisfies Record<MoonPhase, string>;

export const ST_MOON_PHASE_ALIASES = {
  new: 'new_moon',
  waxing_crescent: 'waxing_crescent',
  first_quarter: 'first_quarter',
  waxing_gibbous: 'waxing_gibbous',
  full: 'full_moon',
  waning_gibbous: 'waning_gibbous',
  last_quarter: 'last_quarter',
  waning_crescent: 'waning_crescent',
} as const;

export const ST_ZODIAC_SIGNS = Object.fromEntries(
  Object.entries(ST_SIGN_ELEMENTS).map(([sign, element]) => [sign, ST_ELEMENTS[element]]),
) as Record<ZodiacSign, string>;

export type StarsPlanetName =
  | 'sun'
  | 'moon'
  | 'mercury'
  | 'venus'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto';

export const ST_PLANETS = {
  sun: '#FFB877',
  moon: '#E4E1E9',
  mercury: '#D6C3B5',
  venus: '#A78BFA',
  mars: '#FFB4AB',
  jupiter: '#FFB877',
  saturn: '#9F8E81',
  uranus: '#8BCFF0',
  neptune: '#C4B5FD',
  pluto: '#52443A',
} as const satisfies Record<StarsPlanetName, string>;

export const ST_ASPECTS = {
  conjunction: '#FFB877',
  opposition: '#FFB4AB',
  trine: '#84CC16',
  square: '#FFB4AB',
  sextile: '#8BCFF0',
} as const satisfies Record<Aspect, string>;

export const ST_SURFACES = {
  lowest: '#0E0E13',
  base: '#131318',
  low: '#1B1B20',
  mid: '#1F1F25',
  high: '#2A292F',
  highest: '#35343A',
} as const;

export const ST_GLASS = {
  backgroundColor: 'rgba(255, 255, 255, 0.04)',
  blur: 24,
  backdropFilter: 'blur(24px)',
} as const;

export const ST_GLASS_NAV = {
  backgroundColor: 'rgba(19, 19, 24, 0.7)',
  blur: 32,
  backdropFilter: 'blur(32px)',
} as const;

export const ST_NO_BORDER = true;

export const ST_TYPOGRAPHY = {
  displayLg: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 52,
    lineHeight: 58,
    letterSpacing: -1.2,
  },
  headlineMd: {
    fontFamily: ST_FONTS.bold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  bodyMd: {
    fontFamily: ST_FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
  },
  labelUpper: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  cosmicDisplay: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.8,
    color: ST_ACCENT_LIGHT,
  },
} as const;

export type StarsTypographyKey = keyof typeof ST_TYPOGRAPHY;

export const ST_CTA_GRADIENT = {
  from: ST_ACCENT_LIGHT,
  to: ST_ACCENT,
} as const;

export const ST_COSMIC_GLOW_STYLE = {
  shadowColor: ST_ACCENT,
  shadowOpacity: 0.42,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 0 },
  elevation: 10,
} as const satisfies ViewStyle;

export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized
        .split('')
        .map((part) => `${part}${part}`)
        .join('')
    : normalized;
  const bigint = Number.parseInt(value, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getStarsSignElement(sign: ZodiacSign): ZodiacElement {
  return ST_SIGN_ELEMENTS[sign];
}

export function getStarsElementColor(element: ZodiacElement): string {
  return ST_ELEMENTS[element];
}

export function getStarsZodiacColor(sign: ZodiacSign): string {
  return ST_ZODIAC_SIGNS[sign];
}

export function getStarsMoonPhaseColor(
  phase: MoonPhase | keyof typeof ST_MOON_PHASE_ALIASES,
): string {
  const normalized = phase in ST_MOON_PHASES
    ? (phase as MoonPhase)
    : ST_MOON_PHASE_ALIASES[phase as keyof typeof ST_MOON_PHASE_ALIASES];
  return ST_MOON_PHASES[normalized];
}

export function getStarsPlanetColor(planet: string): string {
  const normalized = planet.toLowerCase() as StarsPlanetName;
  return ST_PLANETS[normalized] ?? ST_ACCENT_LIGHT;
}

export function getStarsAspectColor(aspect: Aspect): string {
  return ST_ASPECTS[aspect];
}
