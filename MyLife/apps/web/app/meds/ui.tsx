'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_BP_STATUS,
  MD_BORDER,
  MD_CHROME_GOLD,
  MD_CHROME_GOLD_LIGHT,
  MD_DOSE_STATUS,
  MD_GLASS,
  MD_GLASS_NAV,
  MD_GLUCOSE_STATUS,
  MD_PAIN_LEVELS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  withAlpha,
} from '@mylife/meds';

export const MEDS_SIDEBAR_WIDTH = 264;
export const MEDS_MAX_WIDTH = 1440;
export const MEDS_FORM_WIDTH = 1024;

export interface MedsNavItem {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
}

export const MEDS_PRIMARY_NAV: readonly MedsNavItem[] = [
  { href: '/meds', label: 'Timeline', icon: 'timeline', exact: true },
  { href: '/meds/medications', label: 'Prescriptions', icon: 'medication' },
  { href: '/meds/measurements', label: 'Vitals', icon: 'monitor_heart' },
  { href: '/meds/glucose', label: 'Glucose', icon: 'bloodtype' },
  { href: '/meds/insulin', label: 'Insulin', icon: 'vaccines' },
  { href: '/meds/a1c', label: 'A1c', icon: 'analytics' },
  { href: '/meds/cgm', label: 'CGM', icon: 'favorite' },
  { href: '/meds/pain', label: 'Pain', icon: 'healing' },
  { href: '/meds/mood', label: 'Mood', icon: 'psychology' },
  { href: '/meds/fodmap', label: 'Digestive', icon: 'restaurant_menu' },
  { href: '/meds/weather', label: 'Weather', icon: 'cloud' },
  { href: '/meds/caregivers', label: 'Caregivers', icon: 'family_restroom' },
] as const;

export const MEDS_SECONDARY_NAV: readonly MedsNavItem[] = [
  { href: '/meds/history', label: 'History', icon: 'history' },
  { href: '/meds/export', label: 'Reports', icon: 'assignment' },
  { href: '/meds/settings', label: 'Settings', icon: 'settings' },
] as const;

const ROUTE_LABELS: Record<string, string> = {
  meds: 'Clinical Timeline',
  medications: 'Prescription List',
  measurements: 'Vitals Hub',
  bp: 'Blood Pressure Analytics',
  glucose: 'Glucose Monitoring',
  insulin: 'Insulin Therapy',
  a1c: 'A1c Analytics',
  cgm: 'Real-Time CGM',
  pain: 'Pain Analysis',
  mood: 'Mood Correlation',
  fodmap: 'Digestive Health',
  weather: 'Weather Triggers',
  caregivers: 'Caregiver Management',
  settings: 'Module Settings',
  history: 'Dose History',
  export: 'Clinical Reports',
};

export const MEDS_GLOBAL_CSS = `
  .meds-shell {
    margin: -32px;
    min-height: 100vh;
    display: grid;
    grid-template-columns: ${MEDS_SIDEBAR_WIDTH}px minmax(0, 1fr);
    background:
      radial-gradient(circle at 0% 0%, ${withAlpha(MD_CHROME_GOLD_LIGHT, 0.14)}, transparent 28%),
      radial-gradient(circle at 100% 0%, ${withAlpha(MD_ACCENT_LIGHT, 0.12)}, transparent 24%),
      radial-gradient(circle at 100% 100%, ${withAlpha(MD_CHROME_GOLD, 0.1)}, transparent 30%),
      ${MD_SURFACES.base};
    color: ${MD_TEXT};
  }

  .meds-sidebar {
    position: sticky;
    top: 0;
    align-self: start;
    min-height: 100vh;
    padding: 28px 18px 20px;
    display: grid;
    gap: 18px;
    background:
      linear-gradient(180deg, ${withAlpha(MD_SURFACES.lowest, 0.98)}, ${withAlpha(MD_SURFACES.base, 0.92)});
    backdrop-filter: blur(28px);
    box-shadow: inset -2px 0 0 ${withAlpha(MD_CHROME_GOLD, 0.28)};
  }

  .meds-stage {
    min-width: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .meds-topbar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 18px 28px;
    background:
      linear-gradient(180deg, ${withAlpha(MD_SURFACES.lowest, 0.88)}, ${withAlpha(MD_SURFACES.lowest, 0.52)});
    backdrop-filter: blur(${MD_GLASS_NAV.blur}px);
    box-shadow: inset 0 -1.5px 0 ${withAlpha(MD_CHROME_GOLD, 0.12)};
  }

  .meds-content {
    padding: 28px 28px 56px;
  }

  .meds-panel {
    background: linear-gradient(180deg, ${withAlpha(MD_SURFACES.low, 0.96)}, ${withAlpha(MD_SURFACES.base, 0.96)});
    border-radius: 28px;
    padding: 24px;
    box-shadow:
      0 22px 48px rgba(0, 0, 0, 0.26),
      inset 0 1px 0 ${withAlpha('#ffffff', 0.04)};
  }

  .meds-panel-muted {
    background: linear-gradient(180deg, ${withAlpha(MD_SURFACES.mid, 0.92)}, ${withAlpha(MD_SURFACES.low, 0.95)});
  }

  .meds-panel-accent {
    background:
      linear-gradient(180deg, ${withAlpha(MD_CHROME_GOLD, 0.2)}, ${withAlpha(MD_SURFACES.low, 0.96)} 44%),
      linear-gradient(180deg, ${withAlpha(MD_SURFACES.low, 0.96)}, ${withAlpha(MD_SURFACES.base, 0.96)});
  }

  .meds-panel-cyan {
    background:
      linear-gradient(180deg, ${withAlpha(MD_ACCENT_LIGHT, 0.18)}, ${withAlpha(MD_SURFACES.low, 0.96)} 44%),
      linear-gradient(180deg, ${withAlpha(MD_SURFACES.low, 0.96)}, ${withAlpha(MD_SURFACES.base, 0.96)});
  }

  .meds-panel-danger {
    background:
      linear-gradient(180deg, rgba(147, 0, 10, 0.56), ${withAlpha(MD_SURFACES.low, 0.96)} 52%),
      linear-gradient(180deg, ${withAlpha(MD_SURFACES.low, 0.96)}, ${withAlpha(MD_SURFACES.base, 0.96)});
  }

  .meds-label {
    color: ${MD_TEXT_TERTIARY};
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .meds-title {
    font-size: clamp(30px, 5vw, 44px);
    font-weight: 800;
    letter-spacing: -0.05em;
    line-height: 1;
  }

  .meds-subtitle {
    color: ${withAlpha(MD_TEXT_SECONDARY, 0.84)};
    font-size: 14px;
    line-height: 1.8;
  }

  .meds-nav-link {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 13px 14px;
    border-radius: 18px 999px 999px 18px;
    text-decoration: none;
    color: ${withAlpha(MD_TEXT, 0.78)};
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    transition: background 140ms ease, color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
  }

  .meds-nav-link:hover {
    background: ${withAlpha(MD_CHROME_GOLD, 0.08)};
    color: ${MD_TEXT};
    transform: translateX(1px);
  }

  .meds-nav-link[data-active="true"] {
    color: ${MD_CHROME_GOLD_LIGHT};
    background: linear-gradient(90deg, ${withAlpha(MD_CHROME_GOLD, 0.15)}, ${withAlpha(MD_SURFACES.high, 0.12)});
    box-shadow:
      inset -3px 0 0 ${MD_CHROME_GOLD},
      0 0 32px ${withAlpha(MD_CHROME_GOLD, 0.16)};
  }

  .meds-icon-button,
  .meds-action,
  .meds-action-secondary,
  .meds-action-danger,
  .meds-pill-button {
    border: 0;
    cursor: pointer;
    transition: transform 140ms ease, filter 140ms ease, background 140ms ease;
  }

  .meds-icon-button:hover,
  .meds-action:hover,
  .meds-action-secondary:hover,
  .meds-action-danger:hover,
  .meds-pill-button:hover {
    transform: translateY(-1px);
    filter: brightness(1.04);
  }

  .meds-action {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 13px 20px;
    border-radius: 999px;
    background: linear-gradient(135deg, ${MD_CHROME_GOLD_LIGHT}, ${MD_CHROME_GOLD});
    color: ${MD_SURFACES.lowest};
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .meds-action-secondary,
  .meds-pill-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 18px;
    border-radius: 999px;
    background: ${withAlpha(MD_SURFACES.high, 0.84)};
    color: ${MD_TEXT_SECONDARY};
    font-size: 13px;
    font-weight: 700;
  }

  .meds-action-danger {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 18px;
    border-radius: 999px;
    background: rgba(255, 180, 171, 0.12);
    color: #ffb4ab;
    font-size: 13px;
    font-weight: 700;
  }

  .meds-icon-button {
    width: 42px;
    height: 42px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: ${withAlpha(MD_SURFACES.high, 0.84)};
    color: ${MD_TEXT_SECONDARY};
  }

  .meds-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 999px;
    background: ${withAlpha(MD_SURFACES.high, 0.82)};
    color: ${MD_TEXT_SECONDARY};
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  .meds-chip[data-tone="gold"] {
    background: ${withAlpha(MD_CHROME_GOLD, 0.16)};
    color: ${MD_CHROME_GOLD_LIGHT};
  }

  .meds-chip[data-tone="cyan"] {
    background: ${withAlpha(MD_ACCENT, 0.16)};
    color: ${MD_ACCENT_LIGHT};
  }

  .meds-chip[data-tone="success"] {
    background: rgba(48, 209, 88, 0.14);
    color: #7ae39c;
  }

  .meds-chip[data-tone="warning"] {
    background: rgba(255, 184, 119, 0.16);
    color: ${MD_CHROME_GOLD_LIGHT};
  }

  .meds-chip[data-tone="danger"] {
    background: rgba(255, 180, 171, 0.14);
    color: #ffb4ab;
  }

  .meds-kpi-grid {
    display: grid;
    gap: 18px;
  }

  .meds-kpi {
    display: grid;
    gap: 10px;
    padding: 22px;
    border-radius: 26px;
    background: linear-gradient(180deg, ${withAlpha(MD_SURFACES.low, 0.94)}, ${withAlpha(MD_SURFACES.base, 0.95)});
    box-shadow:
      0 18px 32px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 ${withAlpha('#ffffff', 0.04)};
  }

  .meds-kpi-value {
    font-size: clamp(26px, 4vw, 40px);
    font-weight: 800;
    letter-spacing: -0.05em;
    line-height: 1;
  }

  .meds-grid-2,
  .meds-grid-3,
  .meds-grid-4 {
    display: grid;
    gap: 18px;
  }

  .meds-grid-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .meds-grid-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .meds-grid-4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .meds-list {
    display: grid;
    gap: 14px;
  }

  .meds-row {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .meds-stack {
    display: grid;
    gap: 6px;
  }

  .meds-divider {
    width: 100%;
    height: 1px;
    background: ${withAlpha(MD_TEXT_TERTIARY, 0.12)};
  }

  .meds-inline-field,
  .meds-select,
  .meds-textarea {
    width: 100%;
    border: 0;
    outline: 0;
    border-radius: 20px;
    padding: 14px 16px;
    background: ${withAlpha(MD_SURFACES.high, 0.92)};
    color: ${MD_TEXT};
    font: inherit;
  }

  .meds-textarea {
    resize: vertical;
    min-height: 96px;
  }

  .meds-table {
    width: 100%;
    border-collapse: collapse;
  }

  .meds-table th {
    color: ${MD_TEXT_TERTIARY};
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-align: left;
    padding-bottom: 14px;
  }

  .meds-table td {
    padding: 16px 0;
    vertical-align: top;
    color: ${MD_TEXT_SECONDARY};
    border-top: 1px solid ${withAlpha(MD_TEXT_TERTIARY, 0.08)};
  }

  .meds-progress {
    height: 6px;
    border-radius: 999px;
    overflow: hidden;
    background: ${withAlpha(MD_SURFACES.high, 0.92)};
  }

  .meds-progress > span {
    display: block;
    height: 100%;
    border-radius: 999px;
  }

  .meds-empty {
    display: grid;
    gap: 10px;
    place-items: center;
    text-align: center;
    padding: 36px 20px;
    color: ${MD_TEXT_TERTIARY};
  }

  .meds-calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 8px;
  }

  .meds-calendar-cell {
    min-height: 72px;
    border-radius: 18px;
    padding: 10px;
    background: ${withAlpha(MD_SURFACES.high, 0.85)};
    display: grid;
    gap: 8px;
  }

  .meds-tooltip {
    border-radius: 16px;
    background: ${withAlpha(MD_SURFACES.lowest, 0.94)};
    color: ${MD_TEXT};
    padding: 12px 14px;
    box-shadow: 0 16px 28px rgba(0, 0, 0, 0.26);
  }

  .meds-hover-actions {
    opacity: 0;
    transition: opacity 140ms ease;
  }

  .meds-hover-card:hover .meds-hover-actions {
    opacity: 1;
  }

  @media (max-width: 1200px) {
    .meds-grid-4,
    .meds-grid-3 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 960px) {
    .meds-shell {
      grid-template-columns: 1fr;
      margin: -16px;
    }

    .meds-sidebar {
      position: relative;
      min-height: auto;
      padding-bottom: 18px;
      box-shadow: inset 0 -1px 0 ${withAlpha(MD_CHROME_GOLD, 0.2)};
    }

    .meds-topbar {
      padding: 16px 18px;
      flex-wrap: wrap;
    }

    .meds-content {
      padding: 18px 18px 42px;
    }

    .meds-grid-2,
    .meds-grid-3,
    .meds-grid-4 {
      grid-template-columns: 1fr;
    }
  }
`;

export function useMedsLoader<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        setLoading(true);
        const next = await loader();
        if (!active) {
          return;
        }
        setData(next);
        setError(null);
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Unable to load MyMeds data.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void run();
    return () => {
      active = false;
    };
  }, deps);

  return { data, loading, error, setData };
}

export function isMedsNavActive(pathname: string, item: MedsNavItem): boolean {
  if (item.exact) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function buildMedsBreadcrumb(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return 'Clinical Timeline';
  }

  return segments
    .map((segment) => ROUTE_LABELS[segment] ?? segment.replace(/-/g, ' '))
    .join(' / ');
}

export function MedsRouteHeading() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const current = segments.at(-1) ?? 'meds';
  return <>{ROUTE_LABELS[current] ?? 'Clinical Timeline'}</>;
}

export function MedsSymbol({
  name,
  size = 20,
  color = MD_TEXT_SECONDARY,
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
      aria-hidden="true"
      style={{
        fontSize: size,
        color,
        fontVariationSettings: filled
          ? '"FILL" 1, "wght" 500, "GRAD" 0, "opsz" 24'
          : '"FILL" 0, "wght" 500, "GRAD" 0, "opsz" 24',
        lineHeight: 1,
      }}
    >
      {name}
    </span>
  );
}

export function MedsPageWrap({
  children,
  maxWidth = MEDS_MAX_WIDTH,
}: {
  children: ReactNode;
  maxWidth?: number;
}) {
  return <div style={{ margin: '0 auto', maxWidth }}>{children}</div>;
}

export function MedsPageLead({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 18,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'grid', gap: 10, maxWidth: 720 }}>
          {eyebrow ? <span className="meds-label">{eyebrow}</span> : null}
          <h1 className="meds-title">{title}</h1>
          <p className="meds-subtitle">{description}</p>
        </div>
        {actions ? <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{actions}</div> : null}
      </div>
    </div>
  );
}

export function MedsPanel({
  children,
  tone = 'base',
  style,
  className,
}: {
  children: ReactNode;
  tone?: 'base' | 'muted' | 'accent' | 'cyan' | 'danger';
  style?: CSSProperties;
  className?: string;
}) {
  const toneClass =
    tone === 'muted'
      ? 'meds-panel meds-panel-muted'
      : tone === 'accent'
        ? 'meds-panel meds-panel-accent'
        : tone === 'cyan'
          ? 'meds-panel meds-panel-cyan'
          : tone === 'danger'
            ? 'meds-panel meds-panel-danger'
            : 'meds-panel';

  return (
    <div className={className ? `${toneClass} ${className}` : toneClass} style={style}>
      {children}
    </div>
  );
}

export function MedsMetricCard({
  label,
  value,
  note,
  icon,
  tone = 'gold',
}: {
  label: string;
  value: string | number;
  note?: string;
  icon?: string;
  tone?: 'gold' | 'cyan' | 'success' | 'warning' | 'danger';
}) {
  const color =
    tone === 'cyan'
      ? MD_ACCENT_LIGHT
      : tone === 'success'
        ? '#7ae39c'
        : tone === 'warning'
          ? MD_CHROME_GOLD_LIGHT
          : tone === 'danger'
            ? '#ffb4ab'
            : MD_CHROME_GOLD_LIGHT;

  return (
    <div className="meds-kpi">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span className="meds-label">{label}</span>
        {icon ? <MedsSymbol name={icon} size={18} color={color} /> : null}
      </div>
      <div className="meds-kpi-value" style={{ color }}>
        {value}
      </div>
      {note ? <span style={{ color: MD_TEXT_TERTIARY, fontSize: 13 }}>{note}</span> : null}
    </div>
  );
}

export function MedsChip({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: 'gold' | 'cyan' | 'success' | 'warning' | 'danger';
}) {
  return (
    <span className="meds-chip" data-tone={tone}>
      {children}
    </span>
  );
}

export function MedsProgress({
  value,
  color = MD_CHROME_GOLD_LIGHT,
}: {
  value: number;
  color?: string;
}) {
  return (
    <div className="meds-progress">
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function MedsLoadingState({ label = 'Loading MyMeds data…' }: { label?: string }) {
  return (
    <div className="meds-empty">
      <MedsSymbol name="hourglass_top" size={28} color={MD_CHROME_GOLD_LIGHT} />
      <strong style={{ color: MD_TEXT }}>{label}</strong>
      <span>Clinical dashboards are syncing local module data.</span>
    </div>
  );
}

export function MedsErrorState({ message }: { message: string }) {
  return (
    <MedsPanel tone="danger">
      <div className="meds-empty">
        <MedsSymbol name="error" size={28} color="#ffb4ab" />
        <strong style={{ color: MD_TEXT }}>Unable to load this view</strong>
        <span>{message}</span>
      </div>
    </MedsPanel>
  );
}

export function MedsEmptyState({
  title,
  description,
  icon = 'inbox',
}: {
  title: string;
  description: string;
  icon?: string;
}) {
  return (
    <div className="meds-empty">
      <MedsSymbol name={icon} size={28} color={MD_ACCENT_LIGHT} />
      <strong style={{ color: MD_TEXT }}>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

export function MedsSectionTitle({
  label,
  title,
  action,
}: {
  label?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 18,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        {label ? <span className="meds-label">{label}</span> : null}
        <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em' }}>{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function formatClinicalDate(value?: string | null) {
  if (!value) {
    return 'No data';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatShortDate(value?: string | null) {
  if (!value) {
    return 'No data';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatPercent(value: number, digits: number = 0) {
  return `${value.toFixed(digits)}%`;
}

export function formatMaybeNumber(value: number | null | undefined, unit?: string) {
  if (value == null || Number.isNaN(value)) {
    return 'No data';
  }

  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return unit ? `${rounded} ${unit}` : String(rounded);
}

export function frequencyLabel(value?: string | null) {
  switch (value) {
    case 'daily':
      return 'Daily';
    case 'twice_daily':
      return 'Twice daily';
    case 'three_daily':
      return 'Three times daily';
    case 'weekly':
      return 'Weekly';
    case 'as_needed':
      return 'As needed';
    case 'custom':
      return 'Custom';
    default:
      return value ? value.replace(/_/g, ' ') : 'Custom';
  }
}

export function doseTone(status?: string | null): string {
  switch (status) {
    case 'taken':
      return MD_DOSE_STATUS.taken;
    case 'due':
    case 'late':
      return MD_DOSE_STATUS.due;
    case 'missed':
    case 'skipped':
      return MD_DOSE_STATUS.missed;
    default:
      return MD_DOSE_STATUS.upcoming;
  }
}

export function bpTone(status?: string | null): string {
  switch (status) {
    case 'normal':
      return MD_BP_STATUS.normal;
    case 'elevated':
      return MD_BP_STATUS.elevated;
    case 'hypertension_1':
      return MD_BP_STATUS.stage1;
    case 'hypertension_2':
      return MD_BP_STATUS.stage2;
    case 'crisis':
      return MD_BP_STATUS.crisis;
    default:
      return MD_ACCENT_LIGHT;
  }
}

export function glucoseTone(status?: string | null): string {
  switch (status) {
    case 'in_range':
      return MD_GLUCOSE_STATUS.normal;
    case 'low':
    case 'very_low':
      return MD_GLUCOSE_STATUS.low;
    case 'high':
    case 'very_high':
      return MD_GLUCOSE_STATUS.high;
    default:
      return MD_ACCENT_LIGHT;
  }
}

export function painTone(level: number): string {
  if (level <= 0) {
    return MD_PAIN_LEVELS.none;
  }
  if (level <= 3) {
    return MD_PAIN_LEVELS.mild;
  }
  if (level <= 6) {
    return MD_PAIN_LEVELS.moderate;
  }
  if (level <= 8) {
    return MD_PAIN_LEVELS.severe;
  }
  return MD_PAIN_LEVELS.worst;
}

export interface DiagramRegion {
  key: string;
  label: string;
  front: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
  intensity?: number;
}

export function AnatomyDiagram({
  regions,
  selectedKey,
  side,
  onSideChange,
  onSelect,
  legend,
}: {
  regions: DiagramRegion[];
  selectedKey?: string | null;
  side: 'front' | 'back';
  onSideChange: (side: 'front' | 'back') => void;
  onSelect?: (key: string) => void;
  legend?: ReactNode;
}) {
  const visibleRegions = regions.filter((region) => region.front === (side === 'front'));

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="meds-pill-button"
          style={{
            background: side === 'front' ? withAlpha(MD_CHROME_GOLD, 0.18) : withAlpha(MD_SURFACES.high, 0.84),
            color: side === 'front' ? MD_CHROME_GOLD_LIGHT : MD_TEXT_SECONDARY,
          }}
          onClick={() => onSideChange('front')}
        >
          Front
        </button>
        <button
          type="button"
          className="meds-pill-button"
          style={{
            background: side === 'back' ? withAlpha(MD_CHROME_GOLD, 0.18) : withAlpha(MD_SURFACES.high, 0.84),
            color: side === 'back' ? MD_CHROME_GOLD_LIGHT : MD_TEXT_SECONDARY,
          }}
          onClick={() => onSideChange('back')}
        >
          Back
        </button>
      </div>

      <div
        style={{
          position: 'relative',
          width: 260,
          height: 440,
          margin: '0 auto',
          borderRadius: 34,
          background: `linear-gradient(180deg, ${withAlpha(MD_SURFACES.high, 0.82)}, ${withAlpha(MD_SURFACES.low, 0.92)})`,
          boxShadow: `inset 0 1px 0 ${withAlpha('#ffffff', 0.05)}`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 18,
            borderRadius: 28,
            background: `linear-gradient(180deg, ${withAlpha(MD_SURFACES.lowest, 0.92)}, ${withAlpha(MD_SURFACES.base, 0.96)})`,
          }}
        />

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            color: withAlpha(MD_TEXT, 0.08),
            fontSize: 180,
            fontWeight: 800,
          }}
        >
          {side === 'front' ? 'F' : 'B'}
        </div>

        {visibleRegions.map((region) => {
          const intensity = Math.max(0.16, region.intensity ?? 0.16);
          const active = selectedKey === region.key;
          const color = active ? MD_ACCENT_LIGHT : withAlpha(MD_ACCENT_LIGHT, intensity);

          return (
            <button
              key={region.key}
              type="button"
              onClick={() => onSelect?.(region.key)}
              title={region.label}
              style={{
                position: 'absolute',
                left: region.x,
                top: region.y,
                width: region.width,
                height: region.height,
                borderRadius: region.radius ?? Math.min(region.width, region.height) / 2,
                border: 0,
                cursor: onSelect ? 'pointer' : 'default',
                background: `linear-gradient(180deg, ${withAlpha(color, active ? 0.56 : 0.28)}, ${withAlpha(color, active ? 0.22 : 0.12)})`,
                boxShadow: active ? `0 0 24px ${withAlpha(MD_ACCENT_LIGHT, 0.28)}` : undefined,
              }}
            />
          );
        })}
      </div>

      {legend}
    </div>
  );
}
