'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchDashboard,
  fetchLatestVitals,
  fetchOverallStats,
  fetchSleepJournalContext,
} from './actions';
import type { SleepJournalContext } from '@mylife/health';

type DashboardData = Awaited<ReturnType<typeof fetchDashboard>>;
type StatsData = Awaited<ReturnType<typeof fetchOverallStats>>;
type LatestVitalsData = Awaited<ReturnType<typeof fetchLatestVitals>>;

/* ---------- Tokens (Obsidian Noir + red accent) ---------- */
const T = {
  bg: '#131318',
  depth: '#0E0E13',
  low: '#1B1B20',
  mid: '#1F1F25',
  high: '#2A292F',
  highest: '#35343A',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  textDim: 'rgba(228,225,233,0.5)',
  textFaint: 'rgba(228,225,233,0.35)',
  border: 'rgba(255,255,255,0.06)',
  glass: 'rgba(255,255,255,0.04)',
  glassStrong: 'rgba(255,255,255,0.08)',
  accent: '#EF4444',
  accentLight: '#F87171',
  accentDim: 'rgba(239,68,68,0.1)',
  emerald: '#34D399',
  blue: '#60A5FA',
  success: '#30D158',
} as const;

const font = "'Plus Jakarta Sans', -apple-system, system-ui, sans-serif";

/* ---------- Styles ---------- */
const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: T.bg,
    color: T.text,
    fontFamily: font,
    display: 'flex',
  },

  /* Sidebar */
  sidebar: {
    width: 256,
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${T.bg} 0%, ${T.depth} 100%)`,
    display: 'flex',
    flexDirection: 'column',
    padding: '32px 16px',
    borderRight: `1px solid ${T.border}`,
    position: 'sticky',
    top: 0,
    alignSelf: 'flex-start',
  },
  brand: { padding: '0 16px', marginBottom: 48 },
  brandTitle: {
    fontSize: 24,
    fontWeight: 800,
    color: T.text,
    letterSpacing: '-0.02em',
  },
  brandTagline: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    color: T.textDim,
    marginTop: 4,
  },
  nav: { display: 'flex', flexDirection: 'column', gap: 8, flex: 1 },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    borderRadius: 12,
    color: 'rgba(228,225,233,0.6)',
    textDecoration: 'none',
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    transition: 'all 0.2s',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  navLinkActive: {
    color: T.accent,
    fontWeight: 700,
    background: 'rgba(255,255,255,0.05)',
    borderRight: `2px solid ${T.accent}`,
  },
  navIcon: { fontSize: 18, width: 18, textAlign: 'center' },
  newEntryBtn: {
    marginTop: 'auto',
    padding: '14px 20px',
    borderRadius: 9999,
    background: T.accent,
    color: '#fff',
    border: 'none',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    cursor: 'pointer',
  },

  /* Main */
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    height: 72,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 32px',
    background: 'rgba(19,19,24,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderBottom: `1px solid ${T.border}`,
  },
  dateNav: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    color: T.textSecondary,
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: T.textSecondary,
    cursor: 'pointer',
    padding: 6,
    borderRadius: 8,
    fontSize: 18,
  },
  dateLabel: { fontSize: 14, fontWeight: 600, color: T.text },
  headerActions: { display: 'flex', alignItems: 'center', gap: 16 },
  pillBtn: {
    padding: '7px 16px',
    borderRadius: 9999,
    background: 'transparent',
    border: `1px solid ${T.border}`,
    color: T.text,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${T.accent}, ${T.accentLight})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
  },

  content: { padding: 32, flex: 1 },
  grid: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr 300px',
    gap: 24,
  },

  /* Shared card */
  panel: {
    background: T.low,
    borderRadius: 16,
    padding: 24,
    border: `1px solid ${T.border}`,
  },
  panelLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    color: T.accent,
    marginBottom: 16,
  },
  sublabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    color: T.textDim,
    marginBottom: 12,
  },

  /* Left column - Today's summary */
  fastCard: {
    background: T.glass,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: 16,
    padding: 20,
    borderLeft: `4px solid ${T.accent}`,
    marginBottom: 24,
  },
  fastLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    color: T.textSecondary,
    marginBottom: 4,
  },
  fastTime: { fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' },
  fastProgress: {
    marginTop: 12,
    width: '100%',
    height: 4,
    borderRadius: 9999,
    background: T.highest,
    overflow: 'hidden',
  },
  fastProgressFill: {
    height: '100%',
    background: T.accent,
    transition: 'width 0.3s',
  },

  medRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  medIcon: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: T.high,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: T.accent,
    fontSize: 16,
    flexShrink: 0,
  },
  medName: { fontSize: 12, fontWeight: 700, color: T.text },
  medMeta: { fontSize: 10, color: T.textDim, marginTop: 2 },

  moodCard: {
    background: T.high,
    borderRadius: 16,
    padding: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moodRow: { display: 'flex', alignItems: 'center', gap: 12 },
  moodEmoji: { fontSize: 26 },
  moodLabel: { fontWeight: 700, fontSize: 13, color: T.text },
  bridgeCopy: {
    color: T.textSecondary,
    fontSize: 11,
    lineHeight: 1.5,
    marginTop: 4,
    maxWidth: 210,
  },
  bridgeLink: {
    color: T.accent,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textDecoration: 'none',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },

  goalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    marginBottom: 6,
  },
  goalName: { fontWeight: 500, color: T.text },
  goalVal: { color: T.textSecondary },
  goalBar: {
    width: '100%',
    height: 4,
    borderRadius: 9999,
    background: T.highest,
    marginBottom: 14,
    overflow: 'hidden',
  },
  goalBarFill: { height: '100%', background: T.accent },

  /* Center - rings + vitals */
  ringsPanel: {
    background: T.low,
    borderRadius: 16,
    padding: 32,
    display: 'flex',
    alignItems: 'center',
    gap: 40,
    marginBottom: 32,
    border: `1px solid ${T.border}`,
  },
  ringsSvgWrap: { width: 160, height: 160, position: 'relative' },
  ringsCenter: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    color: T.accent,
  },
  ringStats: { display: 'flex', flexDirection: 'column', gap: 16 },
  ringStat: { display: 'flex', alignItems: 'center', gap: 12 },
  ringDot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    flexShrink: 0,
  },
  ringStatLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    color: T.textDim,
  },
  ringStatValue: { fontSize: 18, fontWeight: 700, color: T.text },
  ringStatUnit: { fontSize: 12, fontWeight: 400, color: T.textDim },

  vitalsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 16,
  },
  vitalCard: {
    background: T.low,
    borderRadius: 16,
    padding: 20,
    border: `1px solid ${T.border}`,
    transition: 'transform 0.2s',
    cursor: 'pointer',
  },
  vitalHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  vitalLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    color: T.textDim,
  },
  vitalIcon: { fontSize: 18 },
  vitalValue: {
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: T.text,
  },
  vitalUnit: {
    fontSize: 12,
    color: T.textDim,
    marginLeft: 6,
    fontWeight: 400,
  },
  sparkline: {
    marginTop: 16,
    height: 24,
    display: 'flex',
    alignItems: 'flex-end',
    gap: 4,
  },
  sparkBar: {
    flex: 1,
    background: `${T.accent}66`,
    borderRadius: 9999,
  },

  /* Right column - feed */
  feedItem: {
    position: 'relative',
    paddingLeft: 24,
    borderLeft: `1px solid ${T.highest}`,
    marginBottom: 28,
  },
  feedDot: {
    position: 'absolute',
    left: -6,
    top: 0,
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: T.accent,
    boxShadow: '0 0 8px rgba(239,68,68,0.4)',
  },
  feedDotDim: {
    position: 'absolute',
    left: -6,
    top: 0,
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: T.highest,
    border: `1px solid ${T.border}`,
  },
  feedTime: { fontSize: 10, color: T.textDim, fontWeight: 500 },
  feedTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 4,
    color: T.text,
  },
  feedBody: {
    fontSize: 10,
    color: T.textSecondary,
    marginTop: 6,
    fontStyle: 'italic',
    lineHeight: 1.6,
  },
  feedBadge: {
    marginTop: 8,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 10px',
    borderRadius: 9999,
    background: T.highest,
    fontSize: 10,
    fontWeight: 700,
  },
  feedViewAll: {
    marginTop: 20,
    paddingTop: 20,
    borderTop: `1px solid ${T.border}`,
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: T.textDim,
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    cursor: 'pointer',
  },

  loading: {
    padding: 48,
    textAlign: 'center',
    color: T.textFaint,
    fontSize: 13,
  },
};

/* ---------- Helpers ---------- */
function fastProgress(activeFast: DashboardData['activeFast']): { text: string; pct: number } {
  if (!activeFast) return { text: '-- h -- m', pct: 0 };
  const startedMs = new Date(activeFast.startedAt).getTime();
  const elapsedMs = Math.max(0, Date.now() - startedMs);
  const elapsedHours = elapsedMs / 3_600_000;
  const hours = Math.floor(elapsedHours);
  const minutes = Math.floor((elapsedHours - hours) * 60);
  const pct = Math.min(100, (elapsedHours / activeFast.targetHours) * 100);
  return { text: `${hours}h ${minutes}m`, pct };
}

function formatHour(minutes: number | null | undefined): string {
  if (!minutes) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function moodEmoji(mood: string | null | undefined): string {
  if (!mood) return '◦';
  const m = mood.toLowerCase();
  if (m.includes('happy') || m.includes('calm') || m.includes('good')) return '☺';
  if (m.includes('sad') || m.includes('bad') || m.includes('down')) return '☹';
  if (m.includes('angry') || m.includes('frustrat')) return '◉';
  if (m.includes('tired') || m.includes('exhaust')) return '◑';
  return '◎';
}

/* ---------- Component ---------- */
const NAV_LINKS: { label: string; href: string; active?: boolean }[] = [
  { label: 'Dashboard', href: '/health', active: true },
  { label: 'Vitals', href: '/health/vitals' },
  { label: 'Sleep', href: '/health/sleep' },
  { label: 'Mind', href: '/health/mind' },
  { label: 'Goals', href: '/health/goals' },
  { label: 'Vault', href: '/health/vault' },
  { label: 'Emergency', href: '/health/emergency' },
];

export default function HealthDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [vitals, setVitals] = useState<LatestVitalsData | null>(null);
  const [sleepJournalContext, setSleepJournalContext] =
    useState<SleepJournalContext | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [d, s, v, journalContext] = await Promise.all([
        fetchDashboard(),
        fetchOverallStats(),
        fetchLatestVitals(),
        fetchSleepJournalContext(),
      ]);
      setData(d);
      setStats(s);
      setVitals(v);
      setSleepJournalContext(journalContext as SleepJournalContext | null);
    } catch (err) {
      console.error('Failed to load health dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fastInfo = fastProgress(data?.activeFast ?? null);
  const todayLabel = new Date().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  // Compute ring values from available data
  const moveKcal = vitals?.active_energy?.value ? Math.round(vitals.active_energy.value) : 0;
  const steps = data?.latestSteps ?? 0;
  const standHours = 9; // Derived on mobile; placeholder until web has hours-standing

  const moveGoal = 750;
  const exerciseGoal = 30;
  const standGoal = 12;
  const exerciseMin = Math.min(exerciseGoal, Math.round(steps / 250)); // rough heuristic

  const movePct = Math.min(1, moveKcal / moveGoal);
  const exercisePct = Math.min(1, exerciseMin / exerciseGoal);
  const standPct = Math.min(1, standHours / standGoal);

  const ring = (radius: number, pct: number) => {
    const circ = 2 * Math.PI * radius;
    return { circ, offset: circ * (1 - pct) };
  };
  const outer = ring(70, movePct);
  const middle = ring(54, exercisePct);
  const inner = ring(38, standPct);

  const vitalCards: { key: string; label: string; value: string; unit: string; icon: string }[] = [
    {
      key: 'hr',
      label: 'Heart Rate',
      value: vitals?.heart_rate?.value ? Math.round(vitals.heart_rate.value).toString() : '--',
      unit: 'bpm',
      icon: '♥',
    },
    {
      key: 'bp',
      label: 'Blood Pressure',
      value: vitals?.blood_pressure?.value
        ? `${Math.round(vitals.blood_pressure.value)}/${Math.round(vitals.blood_pressure.value_secondary ?? 0)}`
        : '--',
      unit: 'mmHg',
      icon: '◉',
    },
    {
      key: 'hrv',
      label: 'HRV',
      value: vitals?.hrv?.value ? Math.round(vitals.hrv.value).toString() : '--',
      unit: 'ms',
      icon: '≈',
    },
    {
      key: 'spo2',
      label: 'SpO2',
      value: vitals?.blood_oxygen?.value ? Math.round(vitals.blood_oxygen.value).toString() : '--',
      unit: '%',
      icon: '◌',
    },
    {
      key: 'temp',
      label: 'Body Temp',
      value: vitals?.body_temperature?.value ? vitals.body_temperature.value.toFixed(1) : '--',
      unit: '°F',
      icon: '◐',
    },
    {
      key: 'resp',
      label: 'Respiratory',
      value: '14',
      unit: 'br/min',
      icon: '≋',
    },
    {
      key: 'sleep',
      label: 'Sleep Score',
      value: data?.lastSleep?.qualityScore?.toString() ?? '--',
      unit: '/100',
      icon: '☾',
    },
    {
      key: 'steps',
      label: 'Steps',
      value: data?.latestSteps ? data.latestSteps.toLocaleString() : '--',
      unit: 'steps',
      icon: '⇢',
    },
    {
      key: 'rhr',
      label: 'Resting HR',
      value: vitals?.resting_heart_rate?.value
        ? Math.round(vitals.resting_heart_rate.value).toString()
        : '--',
      unit: 'bpm',
      icon: '♡',
    },
    {
      key: 'energy',
      label: 'Active Energy',
      value: vitals?.active_energy?.value ? Math.round(vitals.active_energy.value).toString() : '--',
      unit: 'kcal',
      icon: '⚡',
    },
  ];

  return (
    <div style={s.page}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.brand}>
          <div style={s.brandTitle}>MyHealth</div>
          <div style={s.brandTagline}>The Digital Curator</div>
        </div>
        <nav style={s.nav}>
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              style={{ ...s.navLink, ...(link.active ? s.navLinkActive : {}) }}
            >
              <span style={s.navIcon}>●</span>
              <span>{link.label}</span>
            </a>
          ))}
        </nav>
        <button type="button" style={s.newEntryBtn}>
          New Entry
        </button>
      </aside>

      {/* Main */}
      <div style={s.main}>
        <header style={s.header}>
          <div style={s.dateNav}>
            <button type="button" style={s.iconBtn} aria-label="Previous day">
              ‹
            </button>
            <span style={s.dateLabel}>Today, {todayLabel}</span>
            <button type="button" style={s.iconBtn} aria-label="Next day">
              ›
            </button>
          </div>
          <div style={s.headerActions}>
            <button type="button" style={s.pillBtn}>
              Log Vital
            </button>
            <button type="button" style={s.pillBtn}>
              Log Mood
            </button>
            <div style={{ width: 1, height: 20, background: T.border }} />
            <div style={s.avatar}>MY</div>
          </div>
        </header>

        <div style={s.content}>
          {loading && <div style={s.loading}>Loading health dashboard...</div>}

          {!loading && (
            <div style={s.grid}>
              {/* Left Column - Today's Summary */}
              <section style={s.panel}>
                <div style={s.panelLabel}>Today's Summary</div>

                {/* Active Fast */}
                <div style={s.fastCard}>
                  <div style={s.fastLabel}>
                    {data?.activeFast ? 'Active Fast' : 'No Active Fast'}
                  </div>
                  <div style={s.fastTime}>{fastInfo.text}</div>
                  <div style={s.fastProgress}>
                    <div style={{ ...s.fastProgressFill, width: `${fastInfo.pct}%` }} />
                  </div>
                </div>

                {/* Due Medications */}
                <div style={{ marginBottom: 24 }}>
                  <div style={s.sublabel}>Due Medications</div>
                  {data?.medications && data.medications.length > 0 ? (
                    data.medications.slice(0, 3).map((m) => (
                      <div key={m.id} style={s.medRow}>
                        <div style={s.medIcon}>℞</div>
                        <div>
                          <div style={s.medName}>
                            {m.name} {m.dosage}
                            {m.unit}
                          </div>
                          <div style={s.medMeta}>Morning Routine</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ ...s.medMeta, paddingLeft: 4 }}>No medications logged</div>
                  )}
                </div>

                {/* Current Mood */}
                <div style={{ marginBottom: 24 }}>
                  <div style={s.sublabel}>Current Mood</div>
                  <div style={s.moodCard}>
                    <div style={s.moodRow}>
                      <span style={s.moodEmoji}>{moodEmoji(data?.todayMood?.mood)}</span>
                      <span style={s.moodLabel}>{data?.todayMood?.mood ?? 'Not logged'}</span>
                    </div>
                    <span style={{ color: T.textDim, fontSize: 14 }}>✎</span>
                  </div>
                </div>

                {sleepJournalContext ? (
                  <div style={{ marginBottom: 24 }}>
                    <div style={s.sublabel}>MySleep Journal</div>
                    <div style={s.moodCard}>
                      <div>
                        <div style={s.moodLabel}>{sleepJournalContext.title}</div>
                        <div style={s.bridgeCopy}>{sleepJournalContext.body}</div>
                      </div>
                      <a href={sleepJournalContext.ctaRoute} style={s.bridgeLink}>
                        {sleepJournalContext.ctaLabel}
                      </a>
                    </div>
                  </div>
                ) : null}

                {/* Active Goals */}
                <div>
                  <div style={s.sublabel}>Active Goals</div>
                  {data?.goals && data.goals.length > 0 ? (
                    data.goals.slice(0, 3).map((g) => (
                      <div key={g.id}>
                        <div style={s.goalRow}>
                          <span style={s.goalName}>{g.label ?? g.metric}</span>
                          <span style={s.goalVal}>
                            {g.targetValue} {g.unit ?? ''}
                          </span>
                        </div>
                        <div style={s.goalBar}>
                          <div style={{ ...s.goalBarFill, width: '60%' }} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={s.medMeta}>No active goals</div>
                  )}
                </div>
              </section>

              {/* Center Column - Vitals + Rings */}
              <section>
                {/* Activity Rings */}
                <div style={s.ringsPanel}>
                  <div style={s.ringsSvgWrap}>
                    <svg
                      width="160"
                      height="160"
                      viewBox="0 0 160 160"
                      style={{ transform: 'rotate(-90deg)' }}
                    >
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        fill="transparent"
                        stroke="rgba(239,68,68,0.1)"
                        strokeWidth="12"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        fill="transparent"
                        stroke="#EF4444"
                        strokeWidth="12"
                        strokeDasharray={outer.circ}
                        strokeDashoffset={outer.offset}
                        strokeLinecap="round"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="54"
                        fill="transparent"
                        stroke="rgba(52,211,153,0.1)"
                        strokeWidth="12"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="54"
                        fill="transparent"
                        stroke="#34D399"
                        strokeWidth="12"
                        strokeDasharray={middle.circ}
                        strokeDashoffset={middle.offset}
                        strokeLinecap="round"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="38"
                        fill="transparent"
                        stroke="rgba(96,165,250,0.1)"
                        strokeWidth="12"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="38"
                        fill="transparent"
                        stroke="#60A5FA"
                        strokeWidth="12"
                        strokeDasharray={inner.circ}
                        strokeDashoffset={inner.offset}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div style={s.ringsCenter}>⚡</div>
                  </div>
                  <div style={s.ringStats}>
                    <div style={s.ringStat}>
                      <div style={{ ...s.ringDot, background: T.accent }} />
                      <div>
                        <div style={s.ringStatLabel}>Move</div>
                        <div style={s.ringStatValue}>
                          {moveKcal}
                          <span style={s.ringStatUnit}> / {moveGoal} kcal</span>
                        </div>
                      </div>
                    </div>
                    <div style={s.ringStat}>
                      <div style={{ ...s.ringDot, background: T.emerald }} />
                      <div>
                        <div style={s.ringStatLabel}>Exercise</div>
                        <div style={s.ringStatValue}>
                          {exerciseMin}
                          <span style={s.ringStatUnit}> / {exerciseGoal} min</span>
                        </div>
                      </div>
                    </div>
                    <div style={s.ringStat}>
                      <div style={{ ...s.ringDot, background: T.blue }} />
                      <div>
                        <div style={s.ringStatLabel}>Stand</div>
                        <div style={s.ringStatValue}>
                          {standHours}
                          <span style={s.ringStatUnit}> / {standGoal} hrs</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vitals Grid */}
                <div style={s.vitalsGrid}>
                  {vitalCards.map((v) => (
                    <div key={v.key} style={s.vitalCard}>
                      <div style={s.vitalHead}>
                        <div style={s.vitalLabel}>{v.label}</div>
                        <div style={{ ...s.vitalIcon, color: T.accent }}>{v.icon}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline' }}>
                        <span style={s.vitalValue}>{v.value}</span>
                        <span style={s.vitalUnit}>{v.unit}</span>
                      </div>
                      <div style={s.sparkline}>
                        {[4, 8, 5, 12, 16, 10, 6].map((h, i) => (
                          <div key={i} style={{ ...s.sparkBar, height: h * 1.5 }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Right Column - Activity Feed */}
              <section style={{ ...s.panel, height: 'fit-content' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 24,
                  }}
                >
                  <div style={{ ...s.panelLabel, color: T.textDim, marginBottom: 0 }}>
                    Activity Feed
                  </div>
                </div>

                <div style={s.feedItem}>
                  <div style={s.feedDot} />
                  <div style={s.feedTime}>10:45 AM</div>
                  <div style={s.feedTitle}>
                    Logged Mood: <span style={{ color: T.accent }}>{data?.todayMood?.mood ?? '--'}</span>
                  </div>
                  <div style={s.feedBody}>Today's check-in recorded.</div>
                </div>

                {data?.latestHR && (
                  <div style={s.feedItem}>
                    <div style={s.feedDotDim} />
                    <div style={s.feedTime}>09:12 AM</div>
                    <div style={s.feedTitle}>Vital Logged: Heart Rate</div>
                    <div style={s.feedBadge}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.emerald }} />
                      <span>{data.latestHR} bpm</span>
                    </div>
                  </div>
                )}

                {data?.goals && data.goals.length > 0 && (
                  <div style={s.feedItem}>
                    <div style={s.feedDotDim} />
                    <div style={s.feedTime}>08:30 AM</div>
                    <div style={s.feedTitle}>Goal Milestone</div>
                    <div style={{ ...s.feedBody, fontStyle: 'normal' }}>
                      {data.goals[0]?.label ?? 'Active goal'} in progress.
                    </div>
                  </div>
                )}

                {data?.todayDoseCount && data.todayDoseCount > 0 && (
                  <div style={s.feedItem}>
                    <div style={s.feedDotDim} />
                    <div style={s.feedTime}>07:45 AM</div>
                    <div style={s.feedTitle}>Medication Taken</div>
                    <div style={{ ...s.feedBody, fontStyle: 'normal' }}>
                      {data.todayDoseCount} dose{data.todayDoseCount !== 1 ? 's' : ''} logged today
                    </div>
                  </div>
                )}

                {data?.lastSleep && (
                  <div style={s.feedItem}>
                    <div style={s.feedDotDim} />
                    <div style={s.feedTime}>07:00 AM</div>
                    <div style={s.feedTitle}>Sleep Synced</div>
                    <div style={{ ...s.feedBody, fontStyle: 'normal' }}>
                      {formatHour(data.lastSleep.durationMinutes)} recorded
                    </div>
                  </div>
                )}

                {stats && (
                  <div style={s.feedItem}>
                    <div style={s.feedDotDim} />
                    <div style={s.feedTime}>30 days</div>
                    <div style={s.feedTitle}>Adherence</div>
                    <div style={s.feedBadge}>
                      <span style={{ color: T.accent }}>{stats.overallAdherence30d}%</span>
                    </div>
                  </div>
                )}

                <button type="button" style={s.feedViewAll}>
                  View Full History →
                </button>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
