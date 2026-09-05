import type { CSSProperties, ReactNode } from 'react';

export const SURF_ACCENT = 'var(--accent-surf)';
export const SURF_ACCENT_SOFT = 'color-mix(in srgb, var(--accent-surf) 18%, transparent)';
export const SURF_BG = 'var(--background)';
export const SURF_SURFACE = 'var(--surface)';
export const SURF_SURFACE_ELEVATED = 'var(--surface-elevated)';
export const SURF_BORDER = 'var(--border)';
export const SURF_GLASS = 'var(--glass)';
export const SURF_GLASS_BORDER = 'var(--glass-border)';
export const SURF_TEXT = 'var(--text)';
export const SURF_TEXT_SECONDARY = 'var(--text-secondary)';
export const SURF_TEXT_TERTIARY = 'var(--text-tertiary)';

export const SURF_NAV_ITEMS = [
  { href: '/surf', label: 'Spots' },
  { href: '/surf/forecast', label: 'Forecast' },
  { href: '/surf/swell', label: 'Swell' },
  { href: '/surf/tides', label: 'Tides' },
  { href: '/surf/alerts', label: 'Alerts' },
  { href: '/surf/sessions', label: 'Sessions' },
  { href: '/surf/crew', label: 'Crew' },
  { href: '/surf/ratings', label: 'Ratings' },
  { href: '/surf/account', label: 'Settings' },
] as const;

export const SURF_CONDITION_COLORS: Record<string, string> = {
  green: 'var(--success)',
  yellow: 'var(--warning)',
  orange: 'color-mix(in srgb, var(--warning) 70%, var(--danger) 30%)',
  red: 'var(--danger)',
};

export function surfSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function surfConditionLabel(color: string): string {
  if (color === 'green') return 'Epic';
  if (color === 'yellow') return 'Fair';
  if (color === 'orange') return 'Mixed';
  return 'Weak';
}

export function SurfHero({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section style={heroStyle}>
      <div style={{ display: 'grid', gap: 10 }}>
        <span style={eyebrowStyle}>{eyebrow}</span>
        <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.02, color: SURF_TEXT }}>{title}</h1>
        <p style={{ margin: 0, maxWidth: 680, color: SURF_TEXT_SECONDARY, fontSize: 15, lineHeight: 1.6 }}>
          {description}
        </p>
      </div>
      {actions ? <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div> : null}
    </section>
  );
}

export function SurfPanel({
  eyebrow,
  title,
  action,
  children,
  style,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section style={{ ...panelStyle, ...style }}>
      <div style={panelHeaderStyle}>
        <div style={{ display: 'grid', gap: 4 }}>
          {eyebrow ? <span style={eyebrowStyle}>{eyebrow}</span> : null}
          <h2 style={{ margin: 0, fontSize: 20, color: SURF_TEXT }}>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SurfMetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div style={metricCardStyle}>
      <span style={{ color: SURF_TEXT_SECONDARY, fontSize: 12 }}>{label}</span>
      <strong style={{ fontSize: 28, lineHeight: 1, color: SURF_ACCENT }}>{value}</strong>
      {hint ? <span style={{ color: SURF_TEXT_TERTIARY, fontSize: 12 }}>{hint}</span> : null}
    </div>
  );
}

export function SurfPill({
  children,
  active,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <span
      style={{
        borderRadius: 999,
        border: `1px solid ${active ? SURF_ACCENT : SURF_BORDER}`,
        background: active ? SURF_ACCENT_SOFT : SURF_GLASS,
        color: active ? SURF_TEXT : SURF_TEXT_SECONDARY,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

export function SurfActionLink({
  href,
  children,
  secondary,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <a
      href={href}
      style={{
        borderRadius: 999,
        padding: secondary ? '10px 14px' : '10px 16px',
        fontWeight: 700,
        fontSize: 13,
        textDecoration: 'none',
        color: secondary ? SURF_TEXT_SECONDARY : SURF_BG,
        border: secondary ? `1px solid ${SURF_BORDER}` : '1px solid transparent',
        background: secondary ? SURF_GLASS : SURF_ACCENT,
      }}
    >
      {children}
    </a>
  );
}

export function SurfEmptyState({
  icon,
  title,
  copy,
}: {
  icon: string;
  title: string;
  copy: string;
}) {
  return (
    <div
      style={{
        ...panelStyle,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 220,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 40 }}>{icon}</div>
      <h2 style={{ margin: 0, color: SURF_TEXT }}>{title}</h2>
      <p style={{ margin: 0, maxWidth: 420, color: SURF_TEXT_SECONDARY, lineHeight: 1.6 }}>{copy}</p>
    </div>
  );
}

export const heroStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 20,
  flexWrap: 'wrap',
  padding: 28,
  borderRadius: 28,
  background:
    'radial-gradient(circle at top right, rgba(59,130,246,0.22), rgba(59,130,246,0) 45%), rgba(18,18,26,0.92)',
  border: `1px solid color-mix(in srgb, ${SURF_ACCENT} 28%, transparent)`,
  boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
};

export const panelStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 22,
  borderRadius: 24,
  background: SURF_GLASS,
  border: `1px solid ${SURF_GLASS_BORDER}`,
  backdropFilter: 'blur(20px)',
};

export const panelHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  flexWrap: 'wrap',
};

export const eyebrowStyle: CSSProperties = {
  color: SURF_TEXT_TERTIARY,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.1,
  textTransform: 'uppercase',
};

export const metricCardStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minHeight: 112,
  padding: 18,
  borderRadius: 20,
  background: SURF_SURFACE,
  border: `1px solid ${SURF_BORDER}`,
};
