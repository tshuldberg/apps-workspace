import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import {
  ACCENT,
  ACCENT_GLOW,
  ACCENT_LIGHT,
  BG,
  GLASS,
  GLASS_BORDER,
  GLASS_STRONG,
  ON_ACCENT,
  SURFACE,
  SURFACE_HIGH,
  SURFACE_LOW,
  TEXT,
  TEXT_SEC,
  TEXT_TER,
  withAlpha,
} from './ui';

export const TRAILS_PRIMARY_NAV = [
  { href: '/trails', label: 'Home', icon: 'home' },
  { href: '/trails/list', label: 'Trails', icon: 'terrain' },
  { href: '/trails/recordings', label: 'Recordings', icon: 'pace' },
  { href: '/trails/discover', label: 'Discover', icon: 'explore' },
  { href: '/trails/trips', label: 'Trips', icon: 'camping' },
  { href: '/trails/segments', label: 'Segments', icon: 'social_leaderboard' },
  { href: '/trails/packing', label: 'Packing', icon: 'checklist' },
  { href: '/trails/gear', label: 'Gear', icon: 'backpack' },
  { href: '/trails/settings', label: 'Settings', icon: 'settings' },
] as const;

export const TRAILS_SECONDARY_NAV = [
  { href: '/trails/offline', label: 'Offline Maps', icon: 'download_for_offline' },
  { href: '/trails/weather', label: 'Weather', icon: 'partly_cloudy_day' },
  { href: '/trails/photos', label: 'Photos', icon: 'photo_library' },
  { href: '/trails/routes', label: 'Route Builder', icon: 'route' },
  { href: '/trails/alerts', label: 'Alerts', icon: 'warning' },
  { href: '/trails/export', label: 'Export', icon: 'ios_share' },
] as const;

export function TrailsSymbol({
  name,
  size = 20,
  color = TEXT,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        lineHeight: 1,
        color,
        fontVariationSettings: '"FILL" 0, "wght" 500, "GRAD" 0, "opsz" 24',
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

export function TrailsHero({
  eyebrow,
  title,
  description,
  actions,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section style={heroStyle}>
      <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <span style={eyebrowStyle}>{eyebrow}</span>
          <h1 style={heroTitleStyle}>{title}</h1>
          <p style={heroDescriptionStyle}>{description}</p>
        </div>
        {actions ? <div style={heroActionsStyle}>{actions}</div> : null}
      </div>
      {aside ? <div style={{ minWidth: 280 }}>{aside}</div> : null}
    </section>
  );
}

export function TrailsPanel({
  eyebrow,
  title,
  children,
  action,
  style,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section style={{ ...panelStyle, ...style }}>
      <div style={panelHeaderStyle}>
        <div style={{ display: 'grid', gap: 6 }}>
          {eyebrow ? <span style={eyebrowStyle}>{eyebrow}</span> : null}
          <h2 style={{ margin: 0, fontSize: 20, lineHeight: 1.1, color: TEXT }}>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function TrailsMetricCard({
  label,
  value,
  hint,
  tone = ACCENT,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div style={metricCardStyle}>
      <span style={{ color: TEXT_TER, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase' }}>
        {label}
      </span>
      <strong style={{ color: tone, fontSize: 32, lineHeight: 1, letterSpacing: -0.8 }}>{value}</strong>
      {hint ? <span style={{ color: TEXT_SEC, fontSize: 13 }}>{hint}</span> : null}
    </div>
  );
}

export function TrailsActionLink({
  href,
  children,
  secondary,
  symbol,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
  symbol?: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        borderRadius: 999,
        padding: secondary ? '11px 16px' : '11px 18px',
        fontWeight: 700,
        fontSize: 13,
        textDecoration: 'none',
        color: secondary ? TEXT_SEC : ON_ACCENT,
        background: secondary
          ? 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))'
          : `linear-gradient(135deg, ${ACCENT_LIGHT}, ${ACCENT})`,
        boxShadow: secondary
          ? `inset 0 0 0 1.5px ${GLASS_BORDER}`
          : `0 18px 36px ${withAlpha(ACCENT_GLOW, 0.35)}`,
      }}
    >
      {symbol ? <TrailsSymbol name={symbol} size={18} color={secondary ? TEXT_SEC : ON_ACCENT} /> : null}
      <span>{children}</span>
    </Link>
  );
}

export function TrailsChip({
  label,
  active,
  subtle,
}: {
  label: string;
  active?: boolean;
  subtle?: boolean;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 12px',
        borderRadius: 999,
        color: active ? ON_ACCENT : subtle ? TEXT_TER : TEXT_SEC,
        background: active ? `linear-gradient(135deg, ${ACCENT_LIGHT}, ${ACCENT})` : subtle ? GLASS : GLASS_STRONG,
        boxShadow: active ? `0 12px 28px ${withAlpha(ACCENT_GLOW, 0.28)}` : undefined,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}

export function TrailsEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div style={emptyStateStyle}>
      <div style={emptyIconWrapStyle}>
        <TrailsSymbol name={icon} size={28} color={ACCENT_LIGHT} />
      </div>
      <div style={{ display: 'grid', gap: 8, textAlign: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 22, color: TEXT }}>{title}</h3>
        <p style={{ margin: 0, maxWidth: 520, color: TEXT_SEC, lineHeight: 1.6 }}>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function TrailsSurface({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return <div style={{ ...surfaceCardStyle, ...style }}>{children}</div>;
}

export function TrailsSectionLabel({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <span style={{ color: TEXT_TER, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase' }}>
      {children}
    </span>
  );
}

export const heroStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.35fr) minmax(280px, 0.75fr)',
  gap: 20,
  padding: 28,
  borderRadius: 32,
  background: [
    `radial-gradient(circle at 100% 0%, ${withAlpha(ACCENT_LIGHT, 0.22)}, transparent 42%)`,
    `radial-gradient(circle at 0% 100%, ${withAlpha(ACCENT, 0.18)}, transparent 38%)`,
    `linear-gradient(180deg, ${withAlpha(SURFACE_HIGH, 0.96)}, ${withAlpha(SURFACE_LOW, 0.98)})`,
  ].join(', '),
  boxShadow: `inset 0 0 0 1.5px ${withAlpha(ACCENT_LIGHT, 0.18)}, 0 24px 72px rgba(0,0,0,0.28)`,
};

export const panelStyle: CSSProperties = {
  display: 'grid',
  gap: 18,
  padding: 22,
  borderRadius: 28,
  background: `linear-gradient(180deg, ${withAlpha(SURFACE_LOW, 0.96)}, ${withAlpha(SURFACE, 0.98)})`,
  boxShadow: `inset 0 0 0 1.5px ${GLASS_BORDER}, 0 18px 48px rgba(0,0,0,0.2)`,
  backdropFilter: 'blur(22px)',
};

export const surfaceCardStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 18,
  borderRadius: 24,
  background: `linear-gradient(180deg, ${withAlpha(SURFACE_LOW, 0.92)}, ${withAlpha(SURFACE, 0.98)})`,
  boxShadow: `inset 0 0 0 1.5px ${withAlpha(ACCENT_LIGHT, 0.08)}, 0 16px 36px rgba(0,0,0,0.18)`,
};

export const panelHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  flexWrap: 'wrap',
};

export const eyebrowStyle: CSSProperties = {
  color: TEXT_TER,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
};

export const heroTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 44,
  lineHeight: 0.98,
  letterSpacing: -1.2,
  color: TEXT,
};

export const heroDescriptionStyle: CSSProperties = {
  margin: 0,
  maxWidth: 760,
  color: TEXT_SEC,
  fontSize: 15,
  lineHeight: 1.7,
};

export const heroActionsStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
};

export const metricCardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minHeight: 124,
  padding: 18,
  borderRadius: 24,
  background: [
    `radial-gradient(circle at 100% 0%, ${withAlpha(ACCENT_LIGHT, 0.1)}, transparent 45%)`,
    `linear-gradient(180deg, ${withAlpha(SURFACE_HIGH, 0.82)}, ${withAlpha(SURFACE_LOW, 0.98)})`,
  ].join(', '),
  boxShadow: `inset 0 0 0 1.5px ${withAlpha(ACCENT_LIGHT, 0.08)}, 0 16px 36px rgba(0,0,0,0.18)`,
};

const emptyStateStyle: CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  gap: 16,
  padding: 28,
  borderRadius: 28,
  background: `linear-gradient(180deg, ${withAlpha(SURFACE_HIGH, 0.74)}, ${withAlpha(SURFACE, 0.98)})`,
  boxShadow: `inset 0 0 0 1.5px ${withAlpha(ACCENT_LIGHT, 0.12)}, 0 16px 32px rgba(0,0,0,0.18)`,
};

const emptyIconWrapStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 64,
  height: 64,
  borderRadius: 999,
  background: `radial-gradient(circle at 50% 50%, ${withAlpha(ACCENT, 0.28)}, ${withAlpha(BG, 0.4)})`,
  boxShadow: `0 18px 36px ${withAlpha(ACCENT_GLOW, 0.24)}`,
};
