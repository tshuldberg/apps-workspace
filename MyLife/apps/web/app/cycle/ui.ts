import type { CSSProperties } from 'react';
import {
  CYCLE_ACCENT,
  CYCLE_ACCENT_LIGHT,
  CYCLE_CTA_GRADIENT,
  CYCLE_ON_ACCENT,
  CYCLE_PHASE_COLORS,
  CYCLE_SURFACES,
} from '@mylife/cycle/ui';

export const FONT_STACK =
  "var(--font-cycle), 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";

export const TOKENS = {
  accent: 'var(--cycle-accent)',
  accentLight: 'var(--cycle-accent-light)',
  accentWash: 'var(--cycle-accent-wash)',
  accentGlow: 'var(--cycle-accent-glow)',
  text: 'var(--text)',
  textSecondary: 'var(--text-secondary)',
  textTertiary: 'var(--text-tertiary)',
  background: 'var(--cycle-surface-lowest)',
  base: 'var(--cycle-surface-base)',
  low: 'var(--cycle-surface-low)',
  mid: 'var(--cycle-surface-mid)',
  high: 'var(--cycle-surface-high)',
  highest: 'var(--cycle-surface-highest)',
  glass: 'var(--glass)',
  glassStrong: 'var(--glass-strong)',
  success: 'var(--success)',
  danger: 'var(--danger)',
  info: '#8BCFF0',
  fertile: '#34D399',
} as const;

export const PHASE_COLORS = CYCLE_PHASE_COLORS;

export const CYCLE_ROOT_VARS: CSSProperties = {
  ['--cycle-accent' as string]: CYCLE_ACCENT,
  ['--cycle-accent-light' as string]: CYCLE_ACCENT_LIGHT,
  ['--cycle-on-accent' as string]: CYCLE_ON_ACCENT,
  ['--cycle-accent-wash' as string]: 'rgba(201,137,77,0.12)',
  ['--cycle-accent-glow' as string]: 'rgba(255,184,119,0.22)',
  ['--cycle-surface-lowest' as string]: CYCLE_SURFACES.lowest,
  ['--cycle-surface-base' as string]: CYCLE_SURFACES.base,
  ['--cycle-surface-low' as string]: CYCLE_SURFACES.low,
  ['--cycle-surface-mid' as string]: CYCLE_SURFACES.mid,
  ['--cycle-surface-high' as string]: CYCLE_SURFACES.high,
  ['--cycle-surface-highest' as string]: CYCLE_SURFACES.highest,
  ['--cycle-phase-menstrual' as string]: CYCLE_PHASE_COLORS.menstrual,
  ['--cycle-phase-follicular' as string]: CYCLE_PHASE_COLORS.follicular,
  ['--cycle-phase-ovulation' as string]: CYCLE_PHASE_COLORS.ovulation,
  ['--cycle-phase-luteal' as string]: CYCLE_PHASE_COLORS.luteal,
  color: TOKENS.text,
  fontFamily: FONT_STACK,
};

export function panelStyle(level: 'base' | 'low' | 'mid' | 'high' = 'low'): CSSProperties {
  const background =
    level === 'base'
      ? TOKENS.base
      : level === 'mid'
        ? TOKENS.mid
        : level === 'high'
          ? TOKENS.high
          : TOKENS.low;

  return {
    background,
    borderRadius: 28,
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255,255,255,0.03)',
  };
}

export const glassPanelStyle: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))',
  backdropFilter: 'blur(22px)',
  WebkitBackdropFilter: 'blur(22px)',
  borderRadius: 28,
  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255,255,255,0.04)',
};

export const gradientButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  padding: '12px 18px',
  background: `linear-gradient(${CYCLE_CTA_GRADIENT.angle}deg, ${CYCLE_CTA_GRADIENT.from}, ${CYCLE_CTA_GRADIENT.to})`,
  color: CYCLE_ON_ACCENT,
  fontFamily: FONT_STACK,
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  boxShadow: '0 16px 32px rgba(201,137,77,0.28)',
};

export const ghostButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  padding: '11px 16px',
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.textSecondary,
  fontFamily: FONT_STACK,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

export const subtleButtonStyle: CSSProperties = {
  ...ghostButtonStyle,
  background: TOKENS.mid,
};

export function chipStyle(active: boolean, color: string = TOKENS.accent): CSSProperties {
  return {
    border: 'none',
    borderRadius: 999,
    padding: '10px 14px',
    background: active ? color : 'rgba(255,255,255,0.05)',
    color: active ? '#111' : TOKENS.textSecondary,
    fontFamily: FONT_STACK,
    fontSize: 13,
    fontWeight: active ? 800 : 700,
    cursor: 'pointer',
    transition: 'transform 0.15s ease, opacity 0.15s ease, background 0.15s ease',
  };
}

export const inputStyle: CSSProperties = {
  width: '100%',
  border: 'none',
  outline: 'none',
  borderRadius: 18,
  padding: '14px 16px',
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.text,
  fontFamily: FONT_STACK,
  fontSize: 14,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
};

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 132,
  resize: 'vertical',
};

export const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: TOKENS.accent,
};

export const titleStyle: CSSProperties = {
  fontSize: 38,
  lineHeight: 1,
  fontWeight: 800,
  letterSpacing: '-0.03em',
  color: TOKENS.text,
};

export const subtitleStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.7,
  color: TOKENS.textSecondary,
};

export const statValueStyle: CSSProperties = {
  fontSize: 32,
  lineHeight: 1,
  fontWeight: 800,
  letterSpacing: '-0.03em',
  color: TOKENS.text,
};

export const fabLinkStyle: CSSProperties = {
  ...gradientButtonStyle,
  position: 'fixed',
  right: 28,
  bottom: 28,
  zIndex: 30,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
};

export const ACCENT = TOKENS.accent;
export const TEXT = TOKENS.text;
export const TEXT_SEC = TOKENS.textSecondary;
export const SURFACE = TOKENS.base;
export const BORDER = 'rgba(255,255,255,0.08)';
export const GLASS = TOKENS.glass;
export const GLASS_STRONG = TOKENS.glassStrong;
export const SUCCESS = TOKENS.success;
export const DANGER = TOKENS.danger;
export const card: CSSProperties = {
  ...panelStyle('low'),
  padding: 22,
};
export const primaryBtn = gradientButtonStyle;
export const ghostBtn = ghostButtonStyle;
export const pillBtn: CSSProperties = {
  ...ghostButtonStyle,
  fontSize: 12,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};
