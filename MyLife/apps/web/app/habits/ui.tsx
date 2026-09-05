'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HB_ACCENT,
  HB_ACCENT_GLOW,
  HB_ACCENT_LIGHT,
  HB_AREAS,
  HB_STREAK,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  HB_XP,
  withAlpha,
} from '@mylife/habits';

export const HABITS_FONT_STACK =
  "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
export const HABITS_PANEL_BORDER = `1.5px solid ${withAlpha('#ffffff', 0.08)}`;
export const HABITS_PANEL_SHADOW = `0 28px 80px ${withAlpha('#000000', 0.28)}`;
export const HABITS_MAX_WIDTH = 1440;
export const HABITS_SIDEBAR_WIDTH = 280;

type NavItem = {
  href: string;
  label: string;
  icon: string;
  description?: string;
  group: 'primary' | 'secondary';
};

const NAV_ITEMS: NavItem[] = [
  { href: '/habits', label: 'Today', icon: 'calendar_today', description: 'Daily mission board', group: 'primary' },
  { href: '/habits/habits', label: 'Habits', icon: 'check_circle', description: 'Library and filters', group: 'primary' },
  { href: '/habits/stats', label: 'Stats', icon: 'query_stats', description: 'Trends and heatmaps', group: 'primary' },
  { href: '/habits/badges', label: 'Badges', icon: 'military_tech', description: 'Achievements and milestones', group: 'primary' },
  { href: '/habits/rpg', label: 'RPG', icon: 'auto_awesome', description: 'XP and quests', group: 'primary' },
  { href: '/habits/pet', label: 'Pet', icon: 'pets', description: 'Sanctuary companion', group: 'primary' },
  { href: '/habits/sobriety', label: 'Sobriety', icon: 'timelapse', description: 'Clock and recovery', group: 'primary' },
  { href: '/habits/focus', label: 'Focus', icon: 'timer', description: 'Pomodoro and analytics', group: 'primary' },
  { href: '/habits/time-reports', label: 'Time', icon: 'schedule', description: 'Projects and reports', group: 'primary' },
  { href: '/habits/programs', label: 'Programs', icon: 'flag', description: 'Challenges and plans', group: 'primary' },
  { href: '/habits/stacking', label: 'Stacking', icon: 'alt_route', description: 'Chains and suggestions', group: 'primary' },
  { href: '/habits/settings', label: 'Settings', icon: 'settings', description: 'Preferences and export', group: 'primary' },
  { href: '/habits/settings#healthkit', label: 'HealthKit', icon: 'monitor_heart', description: 'Health mappings', group: 'secondary' },
  { href: '/habits/settings#locations', label: 'Locations', icon: 'location_on', description: 'Reminder triggers', group: 'secondary' },
  { href: '/habits/settings#siri', label: 'Siri', icon: 'mic', description: 'Shortcut automation', group: 'secondary' },
  { href: '/habits/cycle', label: 'Cycle', icon: 'cycle', description: 'Related tracker', group: 'secondary' },
  { href: '/habits/cravings', label: 'Cravings', icon: 'analytics', description: 'Triggers and coping', group: 'secondary' },
  { href: '/habits/templates', label: 'Templates', icon: 'dashboard_customize', description: 'Starter routines', group: 'secondary' },
  { href: '/habits/areas', label: 'Areas', icon: 'category', description: 'Life buckets', group: 'secondary' },
  { href: '/habits/export', label: 'Export', icon: 'download', description: 'Backups and CSV', group: 'secondary' },
];

function isActivePath(pathname: string, href: string) {
  const [route] = href.split('#');
  if (route === '/habits') {
    return pathname === '/habits';
  }
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function SymbolIcon({
  name,
  size = 20,
  color = HB_TEXT_SECONDARY,
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
        color,
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 500, 'GRAD' 0, 'opsz' 24`,
        lineHeight: 1,
      }}
    >
      {name}
    </span>
  );
}

export function panelStyle(level: 1 | 2 | 3 | 4 = 1): CSSProperties {
  const backgrounds = {
    1: `linear-gradient(180deg, ${withAlpha('#ffffff', 0.05)} 0%, ${withAlpha(HB_SURFACES.low, 0.96)} 100%)`,
    2: `linear-gradient(180deg, ${withAlpha(HB_ACCENT_LIGHT, 0.1)} 0%, ${withAlpha(HB_SURFACES.mid, 0.96)} 100%)`,
    3: `linear-gradient(180deg, ${withAlpha(HB_ACCENT, 0.18)} 0%, ${withAlpha(HB_SURFACES.high, 0.96)} 100%)`,
    4: `linear-gradient(180deg, ${withAlpha(HB_ACCENT_LIGHT, 0.24)} 0%, ${withAlpha(HB_SURFACES.highest, 0.98)} 100%)`,
  } as const;

  return {
    background: backgrounds[level],
    border: HABITS_PANEL_BORDER,
    borderRadius: 28,
    boxShadow: HABITS_PANEL_SHADOW,
    backdropFilter: 'blur(28px)',
  };
}

export function GlassPanel({
  children,
  level = 1,
  id,
  style,
}: {
  children: ReactNode;
  level?: 1 | 2 | 3 | 4;
  id?: string;
  style?: CSSProperties;
}) {
  return <section id={id} style={{ ...panelStyle(level), ...style }}>{children}</section>;
}

export function PageIntro({
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
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ maxWidth: 760 }}>
        <div style={{ color: HB_ACCENT_LIGHT, fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 10 }}>
          {eyebrow}
        </div>
        <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.02, letterSpacing: '-0.04em', color: HB_TEXT, fontFamily: HABITS_FONT_STACK }}>
          {title}
        </h1>
        <p style={{ margin: '14px 0 0', color: HB_TEXT_SECONDARY, fontSize: 15, lineHeight: 1.75, maxWidth: 680 }}>
          {description}
        </p>
      </div>
      {actions ? <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{actions}</div> : null}
    </div>
  );
}

export function MetricTile({
  label,
  value,
  tone = HB_ACCENT_LIGHT,
  detail,
}: {
  label: string;
  value: string;
  tone?: string;
  detail?: string;
}) {
  return (
    <GlassPanel level={1} style={{ padding: 18, minHeight: 120 }}>
      <div style={{ color: HB_TEXT_TERTIARY, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14 }}>
        {label}
      </div>
      <div style={{ fontSize: 32, lineHeight: 1, fontWeight: 800, color: tone, fontVariantNumeric: 'tabular-nums', marginBottom: 10 }}>
        {value}
      </div>
      {detail ? <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.55 }}>{detail}</div> : null}
    </GlassPanel>
  );
}

export function SectionHeading({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ margin: 0, color: HB_TEXT, fontSize: 22, letterSpacing: '-0.02em', fontFamily: HABITS_FONT_STACK }}>
          {title}
        </h2>
        {detail ? <p style={{ margin: '8px 0 0', color: HB_TEXT_SECONDARY, fontSize: 14 }}>{detail}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PillButton({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 16px',
        borderRadius: 999,
        border: active ? `1.5px solid ${withAlpha(HB_ACCENT_LIGHT, 0.5)}` : `1.5px solid ${withAlpha('#ffffff', 0.08)}`,
        background: active ? `linear-gradient(135deg, ${withAlpha(HB_ACCENT_LIGHT, 0.28)} 0%, ${withAlpha(HB_ACCENT, 0.36)} 100%)` : withAlpha('#ffffff', 0.04),
        color: active ? HB_TEXT : HB_TEXT_SECONDARY,
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  children,
  href,
  onClick,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 18px',
    borderRadius: 999,
    border: `1.5px solid ${withAlpha(HB_ACCENT_LIGHT, 0.58)}`,
    background: `linear-gradient(135deg, ${HB_ACCENT_LIGHT} 0%, ${HB_ACCENT} 100%)`,
    color: HB_SURFACES.lowest,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: `0 18px 42px ${HB_ACCENT_GLOW}`,
  };

  if (href) {
    return (
      <Link href={href} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <button onClick={onClick} style={style}>
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  href,
  onClick,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 18px',
    borderRadius: 999,
    border: HABITS_PANEL_BORDER,
    background: withAlpha('#ffffff', 0.04),
    color: HB_TEXT,
    fontWeight: 700,
    cursor: 'pointer',
  };

  if (href) {
    return (
      <Link href={href} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <button onClick={onClick} style={style}>
      {children}
    </button>
  );
}

export function ProgressBar({
  value,
  tone = HB_ACCENT_LIGHT,
  height = 10,
}: {
  value: number;
  tone?: string;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div style={{ height, background: withAlpha('#ffffff', 0.08), borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${clamped}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${withAlpha(tone, 0.8)} 0%, ${tone} 100%)` }} />
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
    <GlassPanel level={1} style={{ padding: 28, textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: HB_TEXT, marginBottom: 8 }}>{title}</div>
      <div style={{ color: HB_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.7, maxWidth: 420, margin: '0 auto' }}>{body}</div>
      {action ? <div style={{ marginTop: 18, display: 'flex', justifyContent: 'center' }}>{action}</div> : null}
    </GlassPanel>
  );
}

export function formatLongDate(value: string | number | Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatShortDate(value: string | number | Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export function formatDurationMinutes(totalMinutes: number) {
  if (totalMinutes < 60) {
    return `${Math.round(totalMinutes)}m`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export function resolveAreaTone(areaName?: string | null, fallback?: string | null) {
  if (fallback) {
    return fallback;
  }
  const normalized = areaName?.trim().toLowerCase() ?? 'other';
  return HB_AREAS[normalized as keyof typeof HB_AREAS] ?? HB_AREAS.other;
}

export function habitTypeLabel(habitType?: string | null) {
  if (!habitType) return 'Binary';
  if (habitType === 'standard') return 'Binary';
  if (habitType === 'negative') return 'Sobriety';
  return habitType.charAt(0).toUpperCase() + habitType.slice(1);
}

export function groupLabel(key?: string | null) {
  if (!key) return 'Anytime';
  return key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ');
}

export function HeatmapCalendarGrid({
  data,
  weeks = 14,
}: {
  data: Array<{ date: string; count?: number; value?: number }>;
  weeks?: number;
}) {
  const countByDate = new Map(
    data.map((entry) => [entry.date.slice(0, 10), entry.count ?? entry.value ?? 0]),
  );
  const cells: Array<{ date: string; value: number }> = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - (weeks * 7 - 1));

  for (let index = 0; index < weeks * 7; index += 1) {
    const date = cursor.toISOString().slice(0, 10);
    cells.push({ date, value: countByDate.get(date) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  const max = Math.max(1, ...cells.map((cell) => cell.value));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`, gap: 6 }}>
      {Array.from({ length: weeks }).map((_, weekIndex) => (
        <div key={weekIndex} style={{ display: 'grid', gridTemplateRows: 'repeat(7, 16px)', gap: 6 }}>
          {cells.slice(weekIndex * 7, weekIndex * 7 + 7).map((cell) => {
            const opacity = cell.value <= 0 ? 0.08 : 0.18 + (cell.value / max) * 0.82;
            return (
              <div
                key={cell.date}
                title={`${cell.date}: ${cell.value}`}
                style={{
                  borderRadius: 6,
                  background: withAlpha(HB_ACCENT_LIGHT, opacity),
                  boxShadow: cell.value > 0 ? `0 0 0 1.5px ${withAlpha(HB_ACCENT_LIGHT, Math.min(0.36, opacity))} inset` : `0 0 0 1.5px ${withAlpha('#ffffff', 0.04)} inset`,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function HabitsDesktopShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const primary = NAV_ITEMS.filter((item) => item.group === 'primary');
  const secondary = NAV_ITEMS.filter((item) => item.group === 'secondary');

  return (
    <section
      style={{
        margin: '-32px',
        minHeight: '100vh',
        background: `radial-gradient(circle at top left, ${withAlpha(HB_ACCENT, 0.22)} 0%, rgba(0,0,0,0) 32%), linear-gradient(180deg, ${HB_SURFACES.lowest} 0%, #08080d 100%)`,
        color: HB_TEXT,
        fontFamily: HABITS_FONT_STACK,
      }}
    >
      <div style={{ maxWidth: 1760, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `${HABITS_SIDEBAR_WIDTH}px minmax(0, 1fr)`, gap: 24 }}>
          <aside
            style={{
              ...panelStyle(2),
              position: 'sticky',
              top: 24,
              alignSelf: 'start',
              minHeight: 'calc(100vh - 48px)',
              padding: 22,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${HB_ACCENT_LIGHT} 0%, ${HB_ACCENT} 100%)`, boxShadow: `0 18px 34px ${HB_ACCENT_GLOW}` }}>
                <SymbolIcon color={HB_SURFACES.lowest} filled name="local_fire_department" size={22} />
              </div>
              <div>
                <div style={{ fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: HB_TEXT_TERTIARY }}>Mission Control</div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: HB_ACCENT_LIGHT }}>MyHabits</div>
              </div>
            </div>

            <NavGroup pathname={pathname} title="Core" items={primary} />
            <NavGroup pathname={pathname} title="Automation" items={secondary} />

            <GlassPanel level={1} style={{ padding: 18, marginTop: 22 }}>
              <div style={{ color: HB_TEXT_TERTIARY, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12 }}>
                Account Progress
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 16, display: 'grid', placeItems: 'center', background: withAlpha(HB_XP, 0.18) }}>
                  <SymbolIcon color={HB_XP} filled name="bolt" size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: HB_TEXT }}>Level 12 Operator</div>
                  <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>Consistency streak in motion</div>
                </div>
              </div>
              <ProgressBar tone={HB_XP} value={82} />
              <div style={{ marginTop: 10, color: HB_TEXT_SECONDARY, fontSize: 13 }}>820 / 1000 XP toward level 13</div>
            </GlassPanel>
          </aside>

          <main style={{ minWidth: 0 }}>
            <div style={{ maxWidth: HABITS_MAX_WIDTH, margin: '0 auto', display: 'grid', gap: 24, paddingBottom: 32 }}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </section>
  );
}

function NavGroup({
  pathname,
  title,
  items,
}: {
  pathname: string;
  title: string;
  items: NavItem[];
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ color: HB_TEXT_TERTIARY, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 8 }}>
        {title}
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 18,
                background: active ? `linear-gradient(90deg, ${withAlpha(HB_ACCENT_LIGHT, 0.28)} 0%, ${withAlpha(HB_ACCENT, 0.14)} 100%)` : 'transparent',
                boxShadow: active ? `inset 0 0 0 1.5px ${withAlpha(HB_ACCENT_LIGHT, 0.38)}, 0 16px 34px ${HB_ACCENT_GLOW}` : 'none',
                color: active ? HB_TEXT : HB_TEXT_SECONDARY,
                transform: active ? 'translateX(4px)' : 'none',
                transition: 'all 140ms ease',
              }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 12, display: 'grid', placeItems: 'center', background: active ? withAlpha(HB_ACCENT, 0.22) : withAlpha('#ffffff', 0.03) }}>
                <SymbolIcon color={active ? HB_ACCENT_LIGHT : HB_TEXT_TERTIARY} filled={active} name={item.icon} size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{item.label}</div>
                {item.description ? <div style={{ fontSize: 12, color: active ? HB_TEXT_SECONDARY : HB_TEXT_TERTIARY, marginTop: 2 }}>{item.description}</div> : null}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
