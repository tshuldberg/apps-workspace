import type { CSSProperties, ReactNode } from 'react';

export const FONT_STACK =
  "var(--font-presence), 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";

export const TOKENS = {
  accent: '#0891B2',
  accentLight: '#22D3EE',
  accentGlow: 'rgba(8, 145, 178, 0.34)',
  accentWash: 'rgba(34, 211, 238, 0.12)',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  textTertiary: '#9F8E81',
  background: '#0E0E13',
  surface: '#131318',
  low: '#1B1B20',
  mid: '#1F1F25',
  high: '#2A292F',
  highest: '#35343A',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(34,211,238,0.2)',
  success: '#30D158',
  warning: '#FFB877',
  danger: '#FFB4AB',
  info: '#8BCFF0',
  group: '#A855F7',
  beast: '#EF4444',
} as const;

export const CATEGORY_COLORS: Record<string, string> = {
  social: '#C084FC',
  entertainment: '#F59E0B',
  productivity: '#34D399',
  communication: '#60A5FA',
  utilities: '#38BDF8',
  media: '#EF4444',
  audio: '#22C55E',
  work: '#6366F1',
  gaming: '#A855F7',
  news: '#94A3B8',
  shopping: '#FB923C',
  health: '#10B981',
  education: '#818CF8',
  other: '#6B7280',
};

export const SESSION_TYPE_COLORS: Record<string, string> = {
  solo: TOKENS.accentLight,
  group: TOKENS.group,
  beast: TOKENS.beast,
};

export const BADGE_CATEGORY_COLORS: Record<string, string> = {
  Streaks: '#F97316',
  Sessions: TOKENS.info,
  'Screen Time': '#22C55E',
  Milestones: '#FACC15',
  Special: TOKENS.group,
};

export const PRESENCE_ROOT_VARS: CSSProperties = {
  ['--presence-accent' as string]: TOKENS.accent,
  ['--presence-accent-light' as string]: TOKENS.accentLight,
  ['--presence-accent-glow' as string]: TOKENS.accentGlow,
  ['--presence-text' as string]: TOKENS.text,
  ['--presence-text-secondary' as string]: TOKENS.textSecondary,
  ['--presence-text-tertiary' as string]: TOKENS.textTertiary,
  ['--presence-border' as string]: TOKENS.border,
  ['--presence-border-strong' as string]: TOKENS.borderStrong,
  fontFamily: FONT_STACK,
  color: TOKENS.text,
};

export const PRESENCE_PRIMARY_NAV = [
  { href: '/presence/hub', label: 'Hub', icon: 'explore', exact: false },
  { href: '/presence', label: 'Home', icon: 'home', exact: true },
  { href: '/presence/stats', label: 'Stats', icon: 'monitoring', exact: false },
  { href: '/presence/sessions', label: 'Sessions', icon: 'timer', exact: false },
  { href: '/presence/settings', label: 'Settings', icon: 'settings', exact: false },
] as const;

export const PRESENCE_SECONDARY_NAV = [
  { href: '/presence/intentions', label: 'Intentions', icon: 'psychology' },
  { href: '/presence/insights', label: 'Insights', icon: 'show_chart' },
  { href: '/presence/badges', label: 'Badges', icon: 'diamond' },
  { href: '/presence/report', label: 'Report', icon: 'summarize' },
  { href: '/presence/scheduled', label: 'Scheduled', icon: 'schedule' },
  { href: '/presence/accountability', label: 'Accountability', icon: 'groups' },
  { href: '/presence/rewards', label: 'Rewards', icon: 'card_giftcard' },
  { href: '/presence/commitment', label: 'Commitment', icon: 'handshake' },
] as const;

export const PRESENCE_GLOBAL_CSS = `
  .pr-shell-grid { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 24px; align-items: start; }
  .pr-main-stack { display: grid; gap: 24px; }
  .pr-card-stack { display: grid; gap: 16px; }
  .pr-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .pr-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .pr-grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
  .pr-home-grid { display: grid; grid-template-columns: minmax(0, 1.72fr) minmax(320px, 0.96fr); gap: 24px; align-items: start; }
  .pr-report-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.95fr); gap: 16px; align-items: start; }
  .pr-form-grid { display: grid; gap: 18px; }
  .pr-chip-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .pr-scroll-x { overflow-x: auto; scrollbar-width: none; }
  .pr-scroll-x::-webkit-scrollbar { display: none; }
  .pr-nav-link { transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease; }
  .pr-nav-link:hover { transform: translateY(-1px); }
  .pr-table { width: 100%; border-collapse: collapse; }
  .pr-table th,
  .pr-table td { padding: 12px 0; border-bottom: 1.5px solid rgba(255,255,255,0.08); }
  .pr-table th { text-align: left; color: var(--presence-text-tertiary); font-size: 11px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; }
  .pr-table td { color: var(--presence-text-secondary); font-size: 14px; }
  .pr-mobile-nav { display: none; }
  .pr-stat-pill { padding: 10px 14px; border-radius: 999px; background: rgba(255,255,255,0.05); display: inline-flex; gap: 8px; align-items: center; }
  .pr-badge-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .pr-week-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  @media (max-width: 1100px) {
    .pr-shell-grid { grid-template-columns: 1fr; }
    .pr-sidebar { display: none; }
    .pr-mobile-nav { display: flex; }
    .pr-home-grid,
    .pr-report-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 860px) {
    .pr-grid-3,
    .pr-grid-4,
    .pr-badge-grid,
    .pr-week-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 620px) {
    .pr-grid-2,
    .pr-grid-3,
    .pr-grid-4,
    .pr-badge-grid,
    .pr-week-grid { grid-template-columns: 1fr; }
  }
`;

export function panelStyle(level: 'surface' | 'low' | 'mid' | 'high' = 'low'): CSSProperties {
  const background =
    level === 'surface'
      ? TOKENS.surface
      : level === 'mid'
        ? TOKENS.mid
        : level === 'high'
          ? TOKENS.high
          : TOKENS.low;

  return {
    background,
    borderRadius: 28,
    border: `1.5px solid ${TOKENS.border}`,
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255,255,255,0.03)',
  };
}

export const glassPanelStyle: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))',
  borderRadius: 28,
  border: `1.5px solid ${TOKENS.border}`,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255,255,255,0.04)',
};

export const gradientButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  padding: '12px 18px',
  background: `linear-gradient(135deg, ${TOKENS.accentLight}, ${TOKENS.accent})`,
  color: '#03161C',
  fontFamily: FONT_STACK,
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  boxShadow: '0 16px 34px rgba(8,145,178,0.24)',
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

export function chipStyle(active: boolean, color: string = TOKENS.accentLight): CSSProperties {
  return {
    border: 'none',
    borderRadius: 999,
    padding: '10px 14px',
    background: active ? color : 'rgba(255,255,255,0.05)',
    color: active ? '#071319' : TOKENS.textSecondary,
    fontFamily: FONT_STACK,
    fontSize: 13,
    fontWeight: active ? 800 : 700,
    cursor: 'pointer',
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
  minHeight: 140,
  resize: 'vertical',
};

export const modalBackdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 60,
  background: 'rgba(7,10,14,0.72)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  display: 'grid',
  placeItems: 'center',
  padding: 20,
};

export const modalCardStyle: CSSProperties = {
  ...glassPanelStyle,
  width: 'min(760px, 100%)',
  padding: 24,
  maxHeight: 'calc(100vh - 40px)',
  overflowY: 'auto',
};

export function formatMinutes(value: number): string {
  const rounded = Math.max(0, Math.round(value));
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function toDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateKey: string, delta: number): string {
  const next = new Date(`${dateKey}T12:00:00`);
  next.setDate(next.getDate() + delta);
  return next.toISOString().slice(0, 10);
}

export function formatShortDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatLongDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function clampPercent(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function buildConicGradient(segments: Array<{ percentage: number; color: string }>): string {
  let current = 0;
  const parts = segments
    .filter((segment) => segment.percentage > 0)
    .map((segment) => {
      const start = current;
      current += segment.percentage;
      return `${segment.color} ${start}% ${current}%`;
    });

  if (parts.length === 0) {
    return 'conic-gradient(rgba(255,255,255,0.08) 0% 100%)';
  }

  if (current < 100) {
    parts.push(`rgba(255,255,255,0.06) ${current}% 100%`);
  }

  return `conic-gradient(${parts.join(', ')})`;
}

export function computeSessionStreak(
  sessions: Array<{ completed: number; start_time: string }>,
): number {
  const dates = [...new Set(
    sessions
      .filter((session) => session.completed === 1)
      .map((session) => session.start_time.slice(0, 10)),
  )].sort((left, right) => right.localeCompare(left));

  if (dates.length === 0) {
    return 0;
  }

  let streak = 1;
  for (let index = 1; index < dates.length; index += 1) {
    const previous = new Date(`${dates[index - 1]}T00:00:00`);
    const current = new Date(`${dates[index]}T00:00:00`);
    const diff = Math.round((previous.getTime() - current.getTime()) / 86_400_000);
    if (diff !== 1) break;
    streak += 1;
  }

  return streak;
}

export function buildStreakRuns(
  dailyUsage: Array<{ date: string; goal_met: number }>,
): Array<{ id: string; startDate: string; endDate: string; days: number; current: boolean }> {
  const ascending = [...dailyUsage].sort((left, right) => left.date.localeCompare(right.date));
  const runs: Array<{ id: string; startDate: string; endDate: string; days: number; current: boolean }> = [];
  let currentStart: string | null = null;
  let currentDays = 0;

  ascending.forEach((record, index) => {
    if (record.goal_met === 1) {
      currentStart ??= record.date;
      currentDays += 1;
    }

    const nextRecord = ascending[index + 1];
    const runEnds = record.goal_met !== 1 || nextRecord == null || nextRecord.goal_met !== 1;
    if (record.goal_met === 1 && runEnds && currentStart != null) {
      runs.push({
        id: `${currentStart}-${record.date}`,
        startDate: currentStart,
        endDate: record.date,
        days: currentDays,
        current: nextRecord == null,
      });
      currentStart = null;
      currentDays = 0;
    }
  });

  return runs.sort((left, right) => right.endDate.localeCompare(left.endDate));
}

export function buildHeatmapCells(
  sessions: Array<{
    start_time: string;
    completed: number;
    actual_minutes: number | null;
    planned_minutes: number;
  }>,
  trackedDays: number,
): Array<{ id: string; dayIndex: number; hour: number; averageMinutes: number }> {
  const totals = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const completed = sessions.filter((session) => session.completed === 1);
  const trackedWeeks = Math.max(1, Math.ceil(Math.max(trackedDays, 7) / 7));

  completed.forEach((session) => {
    const date = new Date(session.start_time);
    totals[date.getDay()][date.getHours()] += session.actual_minutes ?? session.planned_minutes;
  });

  return totals.flatMap((row, dayIndex) =>
    row.map((minutes, hour) => ({
      id: `${dayIndex}-${hour}`,
      dayIndex,
      hour,
      averageMinutes: Math.round(minutes / trackedWeeks),
    })),
  );
}

export function groupDailyUsageByWeek(
  dailyUsage: Array<{ date: string; total_minutes: number; goal_met: number }>,
  sessions: Array<{ start_time: string; completed: number; actual_minutes: number | null; planned_minutes: number }>,
  xpLog: Array<{ date: string; amount: number }>,
): Array<{
  id: string;
  weekStart: string;
  weekEnd: string;
  totalMinutes: number;
  averageMinutes: number;
  sessions: number;
  xpEarned: number;
  daysMetGoal: number;
}> {
  const byWeek = new Map<string, Array<{ date: string; total_minutes: number; goal_met: number }>>();

  [...dailyUsage]
    .sort((left, right) => left.date.localeCompare(right.date))
    .forEach((record) => {
      const date = new Date(`${record.date}T00:00:00`);
      date.setDate(date.getDate() - date.getDay());
      const weekStart = date.toISOString().slice(0, 10);
      byWeek.set(weekStart, [...(byWeek.get(weekStart) ?? []), record]);
    });

  return [...byWeek.entries()]
    .map(([weekStart, records]) => {
      const weekEnd = addDays(weekStart, 6);
      const completedSessions = sessions.filter((session) => (
        session.completed === 1 &&
        session.start_time.slice(0, 10) >= weekStart &&
        session.start_time.slice(0, 10) <= weekEnd
      ));
      const xpEarned = xpLog
        .filter((entry) => entry.date >= weekStart && entry.date <= weekEnd)
        .reduce((sum, entry) => sum + entry.amount, 0);
      const totalMinutes = records.reduce((sum, record) => sum + record.total_minutes, 0);

      return {
        id: weekStart,
        weekStart,
        weekEnd,
        totalMinutes,
        averageMinutes: records.length === 0 ? 0 : Math.round(totalMinutes / records.length),
        sessions: completedSessions.length,
        xpEarned,
        daysMetGoal: records.filter((record) => record.goal_met === 1).length,
      };
    })
    .sort((left, right) => right.weekStart.localeCompare(left.weekStart));
}

export function MaterialSymbol({
  name,
  size = 20,
  color = TOKENS.text,
  filled = false,
}: {
  name: string;
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        fontFamily: '"Material Symbols Outlined"',
        fontSize: size,
        lineHeight: 1,
        fontWeight: 400,
        color,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 500, 'opsz' 24`,
      }}
    >
      {name}
    </span>
  );
}

export function PresenceCard({
  children,
  style,
  padding = 22,
  tone = 'low',
}: {
  children?: ReactNode;
  style?: CSSProperties;
  padding?: number;
  tone?: 'surface' | 'low' | 'mid' | 'high';
}) {
  return <div style={{ ...panelStyle(tone), padding, ...style }}>{children}</div>;
}

export function PresenceSectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <p
          style={{
            margin: 0,
            color: TOKENS.accentLight,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </p>
        {subtitle ? (
          <p style={{ margin: 0, color: TOKENS.textSecondary, fontSize: 14, lineHeight: 1.6 }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function PresenceMetricCard({
  label,
  value,
  tone = TOKENS.text,
  detail,
}: {
  label: string;
  value: string;
  tone?: string;
  detail?: string;
}) {
  return (
    <PresenceCard>
      <p
        style={{
          margin: 0,
          color: TOKENS.textTertiary,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </p>
      <p style={{ margin: '10px 0 0', color: tone, fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }}>
        {value}
      </p>
      {detail ? (
        <p style={{ margin: '8px 0 0', color: TOKENS.textSecondary, fontSize: 13, lineHeight: 1.5 }}>
          {detail}
        </p>
      ) : null}
    </PresenceCard>
  );
}

export function PresenceEmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <PresenceCard
      padding={28}
      style={{
        display: 'grid',
        gap: 12,
        textAlign: 'center',
        justifyItems: 'center',
        background: 'linear-gradient(180deg, rgba(34,211,238,0.1), rgba(255,255,255,0.03))',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: 'rgba(34,211,238,0.12)',
          boxShadow: '0 0 0 10px rgba(34,211,238,0.06)',
        }}
      >
        <MaterialSymbol name={icon} size={24} color={TOKENS.accentLight} filled />
      </div>
      <div style={{ display: 'grid', gap: 8, maxWidth: 460 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>{title}</h2>
        <p style={{ margin: 0, color: TOKENS.textSecondary, fontSize: 14, lineHeight: 1.7 }}>{body}</p>
      </div>
      {action}
    </PresenceCard>
  );
}
