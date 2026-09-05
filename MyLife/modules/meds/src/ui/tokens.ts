import type { TextStyle } from 'react-native';
import { MD_FONTS } from './typography';

export const MD_ACCENT = '#06B6D4';
export const MD_ACCENT_LIGHT = '#22D3EE';
export const MD_ACCENT_GLOW = 'rgba(6, 182, 212, 0.4)';
export const MD_CHROME_GOLD = '#C9894D';
export const MD_CHROME_GOLD_LIGHT = '#FFB877';
export const MD_TEXT = '#E4E1E9';
export const MD_TEXT_SECONDARY = '#D6C3B5';
export const MD_TEXT_TERTIARY = '#9F8E81';
export const MD_BORDER = 'rgba(255,255,255,0.06)';
export const MD_CARD_RADIUS = 16;
export const MD_PILL_RADIUS = 999;

export const MD_SURFACES = {
  lowest: '#0E0E13',
  base: '#131318',
  low: '#1B1B20',
  mid: '#1F1F25',
  high: '#2A292F',
  highest: '#35343A',
} as const;

export const MD_GLASS = {
  backgroundColor: 'rgba(255, 255, 255, 0.04)',
  blur: 20,
  backdropFilter: 'blur(20px)',
} as const;

export const MD_GLASS_NAV = {
  backgroundColor: 'rgba(19, 19, 24, 0.7)',
  blur: 20,
  backdropFilter: 'blur(20px)',
} as const;

export const MD_BP_STATUS = {
  normal: '#30D158',
  elevated: '#FFD60A',
  stage1: '#FFB877',
  stage2: '#FFB4AB',
  crisis: '#FF453A',
} as const;

export const MD_GLUCOSE_STATUS = {
  low: '#8BCFF0',
  normal: '#30D158',
  high: '#FFB4AB',
} as const;

export const MD_MOOD = {
  great: '#30D158',
  good: '#84CC16',
  neutral: '#FFB877',
  bad: '#FFB4AB',
  terrible: '#FF453A',
} as const;

export const MD_PAIN_LEVELS = {
  none: '#30D158',
  mild: '#FFD60A',
  moderate: '#FFB877',
  severe: '#FFB4AB',
  worst: '#FF453A',
} as const;

export const MD_DOSE_STATUS = {
  upcoming: '#8BCFF0',
  due: '#22D3EE',
  taken: '#30D158',
  missed: '#FFB4AB',
  skipped: '#9F8E81',
} as const;

export const MD_VITAL_CATEGORIES = {
  cardiovascular: '#FF453A',
  metabolic: '#22D3EE',
  respiratory: '#8BCFF0',
  neurological: '#A78BFA',
  digestive: '#FFB877',
  musculoskeletal: '#FFB4AB',
} as const;

export const MD_TYPOGRAPHY = {
  displayLg: {
    fontFamily: MD_FONTS.extraBold,
    fontSize: 54,
    letterSpacing: -1.08,
    lineHeight: 58,
  },
  headlineMd: {
    fontFamily: MD_FONTS.bold,
    fontSize: 22,
    letterSpacing: -0.22,
    lineHeight: 28,
  },
  titleMd: {
    fontFamily: MD_FONTS.semiBold,
    fontSize: 16,
    lineHeight: 22,
  },
  bodyMd: {
    fontFamily: MD_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  labelUpper: {
    fontFamily: MD_FONTS.medium,
    fontSize: 10,
    letterSpacing: 1.2,
    lineHeight: 12,
    textTransform: 'uppercase' as const,
  },
  vitalDisplay: {
    fontFamily: MD_FONTS.extraBold,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.72,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  },
} as const;

export const MD_CYAN_GLOW_STYLE = {
  shadowColor: MD_ACCENT_LIGHT,
  shadowOpacity: 0.24,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 0 },
  elevation: 10,
} as const;

export type MedsBPStatusTone = keyof typeof MD_BP_STATUS;
export type MedsGlucoseTone = keyof typeof MD_GLUCOSE_STATUS;
export type MedsMoodTone = keyof typeof MD_MOOD;
export type MedsPainTone = keyof typeof MD_PAIN_LEVELS;
export type MedsDoseTone = keyof typeof MD_DOSE_STATUS;
export type MedsVitalCategoryTone = keyof typeof MD_VITAL_CATEGORIES;
export type MedsTypographyKey = keyof typeof MD_TYPOGRAPHY;

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

export function resolveBPClassification(
  systolic: number,
  diastolic: number,
): { tone: MedsBPStatusTone; label: string; color: string } {
  if (systolic > 180 || diastolic > 120) {
    return {
      tone: 'crisis',
      label: 'Crisis',
      color: MD_BP_STATUS.crisis,
    };
  }
  if (systolic >= 140 || diastolic >= 90) {
    return {
      tone: 'stage2',
      label: 'Stage 2',
      color: MD_BP_STATUS.stage2,
    };
  }
  if (systolic >= 130 || diastolic >= 80) {
    return {
      tone: 'stage1',
      label: 'Stage 1',
      color: MD_BP_STATUS.stage1,
    };
  }
  if (systolic >= 120 && diastolic < 80) {
    return {
      tone: 'elevated',
      label: 'Elevated',
      color: MD_BP_STATUS.elevated,
    };
  }
  return {
    tone: 'normal',
    label: 'Normal',
    color: MD_BP_STATUS.normal,
  };
}

export function resolveGlucoseStatus(
  value: number,
): { tone: MedsGlucoseTone; label: string; color: string } {
  if (value < 70) {
    return { tone: 'low', label: 'Low', color: MD_GLUCOSE_STATUS.low };
  }
  if (value > 180) {
    return { tone: 'high', label: 'High', color: MD_GLUCOSE_STATUS.high };
  }
  return { tone: 'normal', label: 'Normal', color: MD_GLUCOSE_STATUS.normal };
}

export function resolvePainLevel(
  level: number,
): { tone: MedsPainTone; label: string; color: string; value: number } {
  const safeLevel = Math.max(0, Math.min(10, Math.round(level)));

  if (safeLevel === 0) {
    return { tone: 'none', label: 'None', color: MD_PAIN_LEVELS.none, value: safeLevel };
  }
  if (safeLevel <= 3) {
    return { tone: 'mild', label: 'Mild', color: MD_PAIN_LEVELS.mild, value: safeLevel };
  }
  if (safeLevel <= 6) {
    return {
      tone: 'moderate',
      label: 'Moderate',
      color: MD_PAIN_LEVELS.moderate,
      value: safeLevel,
    };
  }
  if (safeLevel <= 9) {
    return { tone: 'severe', label: 'Severe', color: MD_PAIN_LEVELS.severe, value: safeLevel };
  }
  return { tone: 'worst', label: 'Worst', color: MD_PAIN_LEVELS.worst, value: safeLevel };
}

export function resolveMoodColor(mood: string): string {
  const normalized = mood.trim().toLowerCase() as MedsMoodTone;
  return MD_MOOD[normalized] ?? MD_MOOD.neutral;
}

export function resolveDoseColor(status: string): string {
  const normalized = status.trim().toLowerCase() as MedsDoseTone;
  return MD_DOSE_STATUS[normalized] ?? MD_DOSE_STATUS.upcoming;
}

export function resolveVitalStatusColor(status?: string | null): string {
  if (!status) {
    return MD_TEXT;
  }

  const normalized = status.trim().toLowerCase();
  if (normalized in MD_BP_STATUS) {
    return MD_BP_STATUS[normalized as MedsBPStatusTone];
  }
  if (normalized in MD_GLUCOSE_STATUS) {
    return MD_GLUCOSE_STATUS[normalized as MedsGlucoseTone];
  }
  if (normalized in MD_VITAL_CATEGORIES) {
    return MD_VITAL_CATEGORIES[normalized as MedsVitalCategoryTone];
  }

  return status.startsWith('#') ? status : MD_TEXT;
}
