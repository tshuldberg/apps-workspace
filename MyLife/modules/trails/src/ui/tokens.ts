import type { TextStyle, ViewStyle } from 'react-native';
import { TR_FONTS } from './typography';

export const TR_ACCENT = '#65A30D';
export const TR_ACCENT_LIGHT = '#84CC16';
export const TR_ACCENT_GLOW = 'rgba(132, 204, 22, 0.4)';
export const TR_LIVE_GPS = TR_ACCENT_LIGHT;
export const TR_ON_ACCENT = '#102108';

export const TR_TEXT = '#E4E1E9';
export const TR_TEXT_SECONDARY = '#D6C3B5';
export const TR_TEXT_TERTIARY = '#9F8E81';
export const TR_TEXT_MUTED = 'rgba(228, 225, 233, 0.4)';

export const TR_DIFFICULTY = {
  easy: '#30D158',
  moderate: '#FFB877',
  hard: '#FFB4AB',
  expert: '#A78BFA',
} as const;

export const TR_RECORDING_STATE = {
  idle: '#9F8E81',
  active: '#84CC16',
  paused: '#FFB877',
  finished: '#30D158',
} as const;

export const TR_WEATHER = {
  sunny: '#FFB877',
  cloudy: '#9F8E81',
  rain: '#8BCFF0',
  snow: '#E4E1E9',
  storm: '#A78BFA',
} as const;

export const TR_TRAIL_TYPES = {
  loop: '#84CC16',
  out_and_back: '#FFB877',
  point_to_point: '#8BCFF0',
} as const;

export const TR_SURFACES = {
  lowest: '#0E0E13',
  base: '#131318',
  low: '#1B1B20',
  mid: '#1F1F25',
  high: '#2A292F',
  highest: '#35343A',
} as const;

export const TR_GLASS = {
  backgroundColor: 'rgba(255, 255, 255, 0.04)',
  blur: 20,
  backdropFilter: 'blur(20px)',
} as const;

export const TR_GLASS_NAV = {
  backgroundColor: 'rgba(19, 19, 24, 0.7)',
  blur: 32,
  backdropFilter: 'blur(32px)',
} as const;

export const TR_CTA_GRADIENT = {
  from: TR_ACCENT_LIGHT,
  to: TR_ACCENT,
  angle: 135,
} as const;

export const TR_TYPOGRAPHY = {
  displayLg: {
    fontFamily: TR_FONTS.extraBold,
    fontSize: 36,
    letterSpacing: -0.02 * 36,
    lineHeight: 1.05 * 36,
  },
  headlineMd: {
    fontFamily: TR_FONTS.bold,
    fontSize: 22,
    letterSpacing: -0.01 * 22,
    lineHeight: 1.2 * 22,
  },
  bodyMd: {
    fontFamily: TR_FONTS.regular,
    fontSize: 14,
    lineHeight: 1.6 * 14,
  },
  labelUpper: {
    fontFamily: TR_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 0.15 * 10,
    lineHeight: 1.2 * 10,
    textTransform: 'uppercase' as const,
  },
  statDisplay: {
    fontFamily: TR_FONTS.extraBold,
    fontSize: 32,
    lineHeight: 1.0 * 32,
    fontVariant: ['tabular-nums'] as const,
  },
  titleMd: {
    fontFamily: TR_FONTS.semiBold,
    fontSize: 16,
    lineHeight: 1.3 * 16,
  },
  caption: {
    fontFamily: TR_FONTS.medium,
    fontSize: 12,
    lineHeight: 1.4 * 12,
  },
} as const satisfies Record<string, TextStyle>;

export const TR_LIME_GLOW_STYLE = {
  shadowColor: TR_ACCENT_LIGHT,
  shadowOpacity: 0.4,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 14,
} as const satisfies ViewStyle;

export const TR_CARD_RADIUS = 16;
export const TR_PILL_RADIUS = 999;
export const TR_NO_BORDER = true;

export type TrailDifficultyTone = keyof typeof TR_DIFFICULTY;
export type TrailRecordingStateTone = keyof typeof TR_RECORDING_STATE;
export type TrailWeatherTone = keyof typeof TR_WEATHER;
export type TrailRouteTypeTone = keyof typeof TR_TRAIL_TYPES;
export type TrailTypographyKey = keyof typeof TR_TYPOGRAPHY;

export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const safeAlpha = Math.max(0, Math.min(1, alpha));

  if (normalized.length !== 6) {
    return hex;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
}

export function getTrailDifficultyColor(level: string): string {
  return TR_DIFFICULTY[level as TrailDifficultyTone] ?? TR_TEXT_TERTIARY;
}

export function getTrailRecordingStateColor(state: string): string {
  return TR_RECORDING_STATE[state as TrailRecordingStateTone] ?? TR_RECORDING_STATE.idle;
}

export function getTrailWeatherTone(condition: string): TrailWeatherTone {
  const normalized = condition.toLowerCase();

  if (normalized.includes('storm') || normalized.includes('thunder')) {
    return 'storm';
  }
  if (normalized.includes('snow') || normalized.includes('sleet')) {
    return 'snow';
  }
  if (normalized.includes('rain') || normalized.includes('shower')) {
    return 'rain';
  }
  if (normalized.includes('cloud') || normalized.includes('overcast')) {
    return 'cloudy';
  }
  return 'sunny';
}
