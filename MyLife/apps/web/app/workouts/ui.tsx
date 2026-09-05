import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { MUSCLE_GROUP_LABELS } from '@mylife/workouts';
import {
  WK_ACCENT,
  WK_ACCENT_LIGHT,
  WK_CATEGORY_COLORS,
  WK_CTA_GRADIENT,
  WK_SURFACES,
  getWorkoutCategoryColor,
} from '@mylife/workouts/ui';

export const WORKOUTS_TOKENS = {
  bg: WK_SURFACES.lowest,
  surface: WK_SURFACES.base,
  surfaceLow: WK_SURFACES.low,
  surfaceMid: WK_SURFACES.mid,
  surfaceHigh: WK_SURFACES.high,
  surfaceHighest: WK_SURFACES.highest,
  accent: WK_ACCENT,
  accentLight: WK_ACCENT_LIGHT,
  accentDark: '#4B2700',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  textTertiary: '#9F8E81',
  border: 'rgba(255,255,255,0.06)',
  glass: 'rgba(255,255,255,0.04)',
  glassStrong: 'rgba(255,255,255,0.08)',
  glassBorder: 'rgba(255,255,255,0.10)',
  danger: '#FF453A',
  success: '#30D158',
  cardio: WK_CATEGORY_COLORS.cardio,
  hypertrophy: WK_CATEGORY_COLORS.hypertrophy,
  recovery: WK_CATEGORY_COLORS.recovery,
} as const;

export const WORKOUTS_ROOT_VARS = {
  '--wk-bg': WORKOUTS_TOKENS.bg,
  '--wk-surface': WORKOUTS_TOKENS.surface,
  '--wk-surface-low': WORKOUTS_TOKENS.surfaceLow,
  '--wk-surface-mid': WORKOUTS_TOKENS.surfaceMid,
  '--wk-surface-high': WORKOUTS_TOKENS.surfaceHigh,
  '--wk-surface-highest': WORKOUTS_TOKENS.surfaceHighest,
  '--wk-accent': WORKOUTS_TOKENS.accent,
  '--wk-accent-light': WORKOUTS_TOKENS.accentLight,
  '--wk-text': WORKOUTS_TOKENS.text,
  '--wk-text-secondary': WORKOUTS_TOKENS.textSecondary,
  '--wk-text-tertiary': WORKOUTS_TOKENS.textTertiary,
  '--wk-border': WORKOUTS_TOKENS.border,
  '--wk-glass': WORKOUTS_TOKENS.glass,
  '--wk-glass-strong': WORKOUTS_TOKENS.glassStrong,
  '--wk-glass-border': WORKOUTS_TOKENS.glassBorder,
  '--wk-sidebar-width': '256px',
  '--wk-shell-max': '1440px',
} as CSSProperties;

export const WORKOUTS_GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0');

.material-symbols-outlined {
  font-family: 'Material Symbols Outlined';
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  letter-spacing: normal;
  text-transform: none;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-smoothing: antialiased;
  font-variation-settings: 'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24;
}

.workouts-root {
  background:
    radial-gradient(circle at top left, rgba(201,137,77,0.14), transparent 26%),
    radial-gradient(circle at 86% 10%, rgba(239,68,68,0.10), transparent 18%),
    radial-gradient(circle at 20% 80%, rgba(139,207,240,0.08), transparent 18%),
    linear-gradient(180deg, rgba(19,19,24,0.96), #0E0E13 32%);
}

.workouts-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  width: var(--wk-sidebar-width);
  padding: 28px 16px 24px;
  display: grid;
  align-content: start;
  gap: 18px;
  background: #0E0E13;
  box-shadow: 12px 0 40px rgba(0,0,0,0.45);
  z-index: 40;
}

.workouts-sidebar-links {
  display: grid;
  gap: 6px;
}

.workouts-nav-link {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 46px;
  padding: 12px 20px;
  color: rgba(228,225,233,0.5);
  text-decoration: none;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
  font-weight: 800;
  border-radius: 999px 0 0 999px;
  transition: background-color 160ms ease, color 160ms ease, transform 160ms ease;
}

.workouts-nav-link:hover {
  color: rgba(228,225,233,0.82);
  background: rgba(255,255,255,0.03);
}

.workouts-nav-link[data-active='true'] {
  color: var(--wk-accent);
  background: rgba(255,255,255,0.05);
  border-right: 2px solid var(--wk-accent);
}

.workouts-stage {
  margin-left: var(--wk-sidebar-width);
  min-height: 100vh;
}

.workouts-topbar {
  position: fixed;
  top: 0;
  left: var(--wk-sidebar-width);
  right: 0;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 0 28px;
  background: rgba(19,19,24,0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: 35;
}

.workouts-content {
  max-width: var(--wk-shell-max);
  padding: 96px 28px 40px;
}

.workouts-search {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 280px;
  padding: 10px 16px;
  border-radius: 999px;
  background: var(--wk-surface-highest);
  color: var(--wk-text-secondary);
}

.workouts-masonry {
  column-count: 2;
  column-gap: 18px;
}

.workouts-masonry > * {
  break-inside: avoid;
  margin-bottom: 18px;
}

@media (max-width: 1080px) {
  .workouts-sidebar {
    position: sticky;
    width: auto;
    height: auto;
    padding: 20px 20px 12px;
    box-shadow: none;
    background: transparent;
  }

  .workouts-sidebar-links {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 6px;
  }

  .workouts-nav-link {
    border-radius: 999px;
    min-width: max-content;
    padding: 10px 16px;
    border-right: none;
    background: rgba(255,255,255,0.03);
  }

  .workouts-nav-link[data-active='true'] {
    border-right: none;
    box-shadow: inset 0 0 0 1px rgba(255,184,119,0.28);
  }

  .workouts-stage {
    margin-left: 0;
  }

  .workouts-topbar {
    left: 0;
    top: 120px;
    padding: 0 20px;
  }

  .workouts-content {
    padding: 200px 20px 32px;
  }
}

@media (max-width: 720px) {
  .workouts-topbar {
    top: 138px;
    height: auto;
    min-height: 64px;
    align-items: flex-start;
    padding-top: 14px;
    padding-bottom: 14px;
  }

  .workouts-search {
    display: none;
  }

  .workouts-content {
    padding-top: 226px;
  }

  .workouts-masonry {
    column-count: 1;
  }
}
`;

export function iconButtonStyle(): CSSProperties {
  return {
    width: 40,
    height: 40,
    border: 'none',
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.04)',
    color: WORKOUTS_TOKENS.textSecondary,
    cursor: 'pointer',
  };
}

export function panelStyle(
  tone: 'low' | 'mid' | 'high' | 'glass' = 'low',
): CSSProperties {
  const background =
    tone === 'glass'
      ? 'rgba(255,255,255,0.04)'
      : tone === 'high'
        ? WORKOUTS_TOKENS.surfaceHigh
        : tone === 'mid'
          ? WORKOUTS_TOKENS.surfaceMid
          : WORKOUTS_TOKENS.surfaceLow;

  return {
    background,
    borderRadius: 28,
    padding: 24,
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.035)',
  };
}

export function primaryButtonStyle(): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    border: 'none',
    borderRadius: 999,
    padding: '13px 20px',
    background: `linear-gradient(${WK_CTA_GRADIENT.angle}deg, ${WK_CTA_GRADIENT.from}, ${WK_CTA_GRADIENT.to})`,
    color: '#2E1600',
    fontWeight: 800,
    textDecoration: 'none',
    cursor: 'pointer',
    letterSpacing: '-0.01em',
  };
}

export function secondaryButtonStyle(active = false): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    border: 'none',
    borderRadius: 999,
    padding: '12px 16px',
    background: active ? 'rgba(255,184,119,0.14)' : WORKOUTS_TOKENS.surfaceHigh,
    color: active ? WORKOUTS_TOKENS.accentLight : WORKOUTS_TOKENS.textSecondary,
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'none',
  };
}

export function chipStyle(active = false, accent?: string): CSSProperties {
  const color = accent ?? WORKOUTS_TOKENS.accentLight;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 14px',
    borderRadius: 999,
    border: 'none',
    background: active ? `${color}1A` : WORKOUTS_TOKENS.surfaceHigh,
    color: active ? color : WORKOUTS_TOKENS.textSecondary,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    textDecoration: 'none',
  };
}

export function formatDateLabel(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatLongDateLabel(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatMinutes(minutes: number): string {
  if (!minutes) return '0 min';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins} min`;
  return `${hours}h ${mins}m`;
}

export function difficultyAccent(difficulty: string): string {
  switch (difficulty) {
    case 'advanced':
      return WORKOUTS_TOKENS.hypertrophy;
    case 'intermediate':
      return WORKOUTS_TOKENS.accentLight;
    default:
      return WORKOUTS_TOKENS.cardio;
  }
}

export function muscleGroupLabel(muscle: string): string {
  return MUSCLE_GROUP_LABELS[muscle as keyof typeof MUSCLE_GROUP_LABELS] ?? muscle;
}

export function SymbolIcon({
  name,
  size = 20,
  color = WORKOUTS_TOKENS.text,
  filled = false,
}: {
  name: string;
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        color,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 500, 'GRAD' 0, 'opsz' ${size}`,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

export function WorkoutsSurface({
  children,
  tone = 'low',
  style,
}: {
  children: ReactNode;
  tone?: 'low' | 'mid' | 'high' | 'glass';
  style?: CSSProperties;
}) {
  return <section style={{ ...panelStyle(tone), ...style }}>{children}</section>;
}

export function WorkoutsPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 20,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        <span
          style={{
            color: WORKOUTS_TOKENS.accentLight,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
          }}
        >
          {eyebrow}
        </span>
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(2.2rem, 4vw, 4rem)',
            lineHeight: 1.02,
            letterSpacing: '-0.05em',
          }}
        >
          {title}
        </h1>
        {description ? (
          <p
            style={{
              margin: 0,
              maxWidth: 760,
              color: WORKOUTS_TOKENS.textSecondary,
              fontSize: 15,
              lineHeight: 1.7,
            }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{actions}</div> : null}
    </header>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  accent = WORKOUTS_TOKENS.accentLight,
  icon,
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  accent?: string;
  icon?: string;
}) {
  return (
    <WorkoutsSurface tone="mid" style={{ minHeight: 170, display: 'grid', alignContent: 'space-between', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span
          style={{
            color: WORKOUTS_TOKENS.textTertiary,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        {icon ? <SymbolIcon name={icon} color={accent} /> : null}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <strong style={{ fontSize: 34, lineHeight: 1, letterSpacing: '-0.05em' }}>{value}</strong>
        {detail ? <div style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>{detail}</div> : null}
      </div>
    </WorkoutsSurface>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'grid', gap: 6 }}>
        {eyebrow ? (
          <span
            style={{
              color: WORKOUTS_TOKENS.textTertiary,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}
          >
            {eyebrow}
          </span>
        ) : null}
        <h2 style={{ margin: 0, fontSize: 24, letterSpacing: '-0.03em' }}>{title}</h2>
        {description ? (
          <p style={{ margin: 0, color: WORKOUTS_TOKENS.textSecondary, fontSize: 14 }}>
            {description}
          </p>
        ) : null}
      </div>
      {aside}
    </div>
  );
}

export function ProgressTrack({
  value,
  max,
  accent = WORKOUTS_TOKENS.accent,
  height = 8,
}: {
  value: number;
  max: number;
  accent?: string;
  height?: number;
}) {
  const width = max <= 0 ? 0 : Math.max(4, (value / max) * 100);
  return (
    <div
      style={{
        width: '100%',
        height,
        borderRadius: 999,
        overflow: 'hidden',
        background: WORKOUTS_TOKENS.surfaceHighest,
      }}
    >
      <div
        style={{
          width: `${Math.min(100, width)}%`,
          height: '100%',
          borderRadius: 999,
          background: accent,
        }}
      />
    </div>
  );
}

export function BarStripChart({
  items,
  max,
  height = 240,
}: {
  items: Array<{ label: string; value: number; accent?: string }>;
  max?: number;
  height?: number;
}) {
  const chartMax = max ?? Math.max(1, ...items.map((item) => item.value));

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{ flex: 1, display: 'grid', justifyItems: 'center', gap: 10 }}
        >
          <div
            style={{
              width: '100%',
              height: `${Math.max(8, (item.value / chartMax) * (height - 48))}px`,
              borderRadius: '18px 18px 6px 6px',
              background: item.accent ?? WORKOUTS_TOKENS.hypertrophy,
              boxShadow: `0 18px 32px ${(item.accent ?? WORKOUTS_TOKENS.hypertrophy)}26`,
              alignSelf: 'end',
            }}
          />
          <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 11, fontWeight: 700 }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function LineChart({
  points,
  accent = WORKOUTS_TOKENS.accentLight,
  height = 220,
}: {
  points: Array<{ label: string; value: number }>;
  accent?: string;
  height?: number;
}) {
  if (points.length === 0) {
    return <EmptyState title="No trend data" body="Complete more sessions to render the line chart." />;
  }

  const width = 760;
  const padding = 20;
  const max = Math.max(1, ...points.map((point) => point.value));
  const min = Math.min(...points.map((point) => point.value));
  const usableHeight = height - padding * 2;
  const usableWidth = width - padding * 2;

  const coordinates = points.map((point, index) => {
    const x = padding + (points.length === 1 ? usableWidth / 2 : (usableWidth / (points.length - 1)) * index);
    const normalized = max === min ? 0.5 : (point.value - min) / (max - min);
    const y = padding + usableHeight - normalized * usableHeight;
    return { ...point, x, y };
  });

  const polyline = coordinates.map((point) => `${point.x},${point.y}`).join(' ');
  const area = [
    `${coordinates[0]?.x ?? padding},${height - padding}`,
    ...coordinates.map((point) => `${point.x},${point.y}`),
    `${coordinates[coordinates.length - 1]?.x ?? width - padding},${height - padding}`,
  ].join(' ');

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Workout trend chart" style={{ width: '100%', height }}>
        <polyline points={area} fill={`${accent}1A`} stroke="none" />
        <polyline points={polyline} fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {coordinates.map((point) => (
          <circle key={point.label} cx={point.x} cy={point.y} r="4.5" fill={accent} />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        {points.map((point) => (
          <div key={point.label} style={{ display: 'grid', gap: 4 }}>
            <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 11, fontWeight: 700 }}>{point.label}</span>
            <strong style={{ fontSize: 14 }}>{point.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeatmapGrid({
  values,
  columns = 7,
}: {
  values: Array<{ key: string; label: string; value: number; accent?: string }>;
  columns?: number;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 6,
      }}
    >
      {values.map((item) => {
        const opacity = Math.max(0.12, Math.min(1, item.value / 100));
        return (
          <div
            key={item.key}
            title={item.label}
            style={{
              aspectRatio: '1 / 1',
              borderRadius: 8,
              background: item.value <= 0
                ? 'rgba(255,255,255,0.04)'
                : `color-mix(in srgb, ${item.accent ?? WORKOUTS_TOKENS.accent} ${Math.round(opacity * 100)}%, transparent)`,
            }}
          />
        );
      })}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <WorkoutsSurface tone="mid" style={{ textAlign: 'center', display: 'grid', gap: 10, justifyItems: 'center' }}>
      <strong style={{ fontSize: 20 }}>{title}</strong>
      <p style={{ margin: 0, maxWidth: 520, color: WORKOUTS_TOKENS.textSecondary, lineHeight: 1.7 }}>{body}</p>
      {action}
    </WorkoutsSurface>
  );
}

export function ActionLink({
  href,
  label,
  icon,
  secondary = false,
}: {
  href: string;
  label: string;
  icon?: string;
  secondary?: boolean;
}) {
  return (
    <Link href={href} style={secondary ? secondaryButtonStyle() : primaryButtonStyle()}>
      {icon ? <SymbolIcon name={icon} size={18} color={secondary ? WORKOUTS_TOKENS.textSecondary : WORKOUTS_TOKENS.accentDark} /> : null}
      {label}
    </Link>
  );
}

export function RouteTile({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      style={{
        ...panelStyle('mid'),
        display: 'grid',
        gap: 14,
        textDecoration: 'none',
        color: WORKOUTS_TOKENS.text,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 18,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,184,119,0.12)',
        }}
      >
        <SymbolIcon name={icon} color={WORKOUTS_TOKENS.accentLight} />
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <strong style={{ fontSize: 16 }}>{title}</strong>
        <p style={{ margin: 0, color: WORKOUTS_TOKENS.textSecondary, lineHeight: 1.6 }}>{description}</p>
      </div>
    </Link>
  );
}

export function MetaList({
  rows,
}: {
  rows: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {rows.map((row) => (
        <div
          key={row.label}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            alignItems: 'center',
            color: WORKOUTS_TOKENS.textSecondary,
          }}
        >
          <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 800 }}>
            {row.label}
          </span>
          <span style={{ color: WORKOUTS_TOKENS.text, textAlign: 'right' }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function valueAccent(value: number): string {
  if (value >= 80) return WORKOUTS_TOKENS.success;
  if (value >= 45) return WORKOUTS_TOKENS.accentLight;
  return WORKOUTS_TOKENS.hypertrophy;
}

export function categoryAccent(category: string): string {
  return getWorkoutCategoryColor(category);
}
