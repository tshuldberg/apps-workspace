'use client';

import type { CSSProperties, ReactNode } from 'react';
import {
  NUTRITION_CHROME,
  NUTRITION_FONT,
  alpha,
  clamp,
  formatNutritionNumber,
  getSourceBadge,
} from '../_lib/design';

export function MaterialSymbol({
  name,
  filled = false,
  size = 20,
  color,
  weight = 500,
  style,
}: {
  name: string;
  filled?: boolean;
  size?: number;
  color?: string;
  weight?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      className="material-symbols-outlined"
      aria-hidden="true"
      style={{
        fontSize: size,
        lineHeight: 1,
        color,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${Math.max(size, 20)}`,
        ...style,
      }}
    >
      {name}
    </span>
  );
}

export function NutritionPanel({
  children,
  style,
  tone = 'lift',
}: {
  children?: ReactNode;
  style?: CSSProperties;
  tone?: 'base' | 'lift' | 'focus' | 'highest';
}) {
  const background = tone === 'focus'
    ? NUTRITION_CHROME.surfaceFocus
    : tone === 'highest'
      ? NUTRITION_CHROME.surfaceHighest
      : tone === 'base'
        ? NUTRITION_CHROME.surfaceBase
        : NUTRITION_CHROME.surfaceLift;

  return (
    <div
      style={{
        borderRadius: 28,
        background,
        boxShadow: `inset 0 0 0 1.5px ${alpha('#FFFFFF', 0.03)}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function NutritionButton({
  children,
  tone = 'accent',
  style,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: 'accent' | 'calorie' | 'ghost' | 'danger';
  style?: CSSProperties;
}) {
  const stylesByTone: Record<string, CSSProperties> = {
    accent: {
      background: `linear-gradient(135deg, ${NUTRITION_CHROME.accentLight}, ${NUTRITION_CHROME.accent})`,
      color: '#2E1600',
      boxShadow: `0 18px 34px ${alpha(NUTRITION_CHROME.accent, 0.24)}`,
      border: 'none',
    },
    calorie: {
      background: `linear-gradient(135deg, ${NUTRITION_CHROME.calorie}, ${NUTRITION_CHROME.warning})`,
      color: '#331100',
      boxShadow: `0 18px 34px ${alpha(NUTRITION_CHROME.calorie, 0.22)}`,
      border: 'none',
    },
    danger: {
      background: alpha(NUTRITION_CHROME.danger, 0.14),
      color: NUTRITION_CHROME.danger,
      border: `1.5px solid ${alpha(NUTRITION_CHROME.danger, 0.32)}`,
    },
    ghost: {
      background: alpha('#FFFFFF', 0.04),
      color: NUTRITION_CHROME.text,
      border: `1.5px solid ${alpha('#FFFFFF', 0.08)}`,
    },
  };

  return (
    <button
      type="button"
      {...rest}
      style={{
        minHeight: 46,
        padding: '0 18px',
        borderRadius: 999,
        cursor: 'pointer',
        fontFamily: NUTRITION_FONT,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        transition: 'transform 180ms ease, opacity 180ms ease, box-shadow 180ms ease',
        ...stylesByTone[tone],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function NutritionBadge({
  children,
  color = NUTRITION_CHROME.accent,
  background,
  style,
}: {
  children: ReactNode;
  color?: string;
  background?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 26,
        padding: '0 10px',
        borderRadius: 999,
        background: background ?? alpha(color, 0.14),
        color,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function NutritionKicker({
  children,
  color = NUTRITION_CHROME.accent,
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 1.8,
        textTransform: 'uppercase',
        color,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function NutritionPageHeader({
  kicker,
  title,
  description,
  action,
}: {
  kicker?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 18,
      }}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        {kicker ? kicker : null}
        <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1.4 }}>{title}</div>
        {description ? (
          <div style={{ maxWidth: 720, color: NUTRITION_CHROME.textMuted, lineHeight: 1.7 }}>
            {description}
          </div>
        ) : null}
      </div>
      {action ? <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{action}</div> : null}
    </div>
  );
}

export function NutritionMetricCard({
  label,
  value,
  detail,
  accent = NUTRITION_CHROME.accent,
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: string;
}) {
  return (
    <NutritionPanel style={{ padding: 20, display: 'grid', gap: 8 }}>
      <NutritionKicker color={accent}>{label}</NutritionKicker>
      <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>{value}</div>
      {detail ? <div style={{ color: NUTRITION_CHROME.textMuted, lineHeight: 1.6 }}>{detail}</div> : null}
    </NutritionPanel>
  );
}

export function NutritionSourceBadge({ source }: { source?: string | null }) {
  const badge = getSourceBadge(source);
  return (
    <NutritionBadge color={badge.color}>
      <MaterialSymbol name={badge.icon} size={13} color={badge.color} />
      {badge.label}
    </NutritionBadge>
  );
}

export function NutritionEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <NutritionPanel
      tone="base"
      style={{
        minHeight: 280,
        display: 'grid',
        placeItems: 'center',
        padding: 32,
        textAlign: 'center',
      }}
    >
      <div style={{ display: 'grid', gap: 14, maxWidth: 440 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 24,
            margin: '0 auto',
            display: 'grid',
            placeItems: 'center',
            background: alpha(NUTRITION_CHROME.accent, 0.16),
            color: NUTRITION_CHROME.accent,
          }}
        >
          <MaterialSymbol name="restaurant_menu" filled size={34} color={NUTRITION_CHROME.accent} />
        </div>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.9 }}>{title}</h2>
        <p style={{ margin: 0, color: NUTRITION_CHROME.textMuted, lineHeight: 1.7 }}>{description}</p>
        {action ? <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>{action}</div> : null}
      </div>
    </NutritionPanel>
  );
}

export function NutritionModal({
  open,
  title,
  children,
  footer,
  onClose,
  width = 520,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: number;
}) {
  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6, 6, 10, 0.74)',
        backdropFilter: 'blur(14px)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        zIndex: 40,
      }}
    >
      <NutritionPanel
        tone="highest"
        style={{ width: 'min(100%, 100%)', maxWidth: width, padding: 24 }}
      >
        <div
          role="presentation"
          onClick={(event) => event.stopPropagation()}
          style={{ display: 'grid', gap: 18 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.6 }}>{title}</div>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                display: 'grid',
                placeItems: 'center',
                border: 'none',
                cursor: 'pointer',
                background: alpha('#FFFFFF', 0.06),
                color: NUTRITION_CHROME.textMuted,
              }}
            >
              <MaterialSymbol name="close" size={20} color={NUTRITION_CHROME.textMuted} />
            </button>
          </div>
          {children}
          {footer ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              {footer}
            </div>
          ) : null}
        </div>
      </NutritionPanel>
    </div>
  );
}

export function CalorieRing({
  consumed,
  goal,
  size = 260,
}: {
  consumed: number;
  goal: number;
  size?: number;
}) {
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = goal > 0 ? clamp(consumed / goal, 0, 1) : 0;
  const color = consumed > goal ? NUTRITION_CHROME.danger : NUTRITION_CHROME.calorie;
  const dashOffset = circumference - circumference * progress;
  const remaining = Math.max(goal - consumed, 0);

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id="nutrition-ring-gradient" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={NUTRITION_CHROME.warning} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={alpha('#FFFFFF', 0.06)}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#nutrition-ring-gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%',
            transition: 'stroke-dashoffset 0.35s ease',
          }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          gap: 6,
        }}
      >
        <div style={{ display: 'grid', gap: 2 }}>
          <div style={{ fontSize: size * 0.18, lineHeight: 1, fontWeight: 800, letterSpacing: -2, color }}>
            {formatNutritionNumber(consumed)}
          </div>
          <div style={{ fontSize: 12, color: NUTRITION_CHROME.textMuted, textTransform: 'uppercase', letterSpacing: 1.8 }}>
            / {formatNutritionNumber(goal)} kcal
          </div>
        </div>
        <NutritionBadge color={color} background={alpha(color, 0.16)} style={{ margin: '0 auto' }}>
          {remaining > 0 ? `${formatNutritionNumber(remaining)} remaining` : 'Goal reached'}
        </NutritionBadge>
      </div>
    </div>
  );
}

export function MacroMeter({
  label,
  consumed,
  goal,
  color,
}: {
  label: string;
  consumed: number;
  goal: number;
  color: string;
}) {
  const pct = goal > 0 ? clamp((consumed / goal) * 100, 0, 100) : 0;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
        <span style={{ fontSize: 12, color: NUTRITION_CHROME.textMuted }}>
          {formatNutritionNumber(consumed)}g / {formatNutritionNumber(goal)}g
        </span>
      </div>
      <div
        style={{
          height: 10,
          borderRadius: 999,
          background: alpha('#FFFFFF', 0.06),
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${alpha(color, 0.64)}, ${color})`,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: NUTRITION_CHROME.textDim }}>{Math.round(pct)}% of target</div>
    </div>
  );
}
