'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchSleepSessions } from '../actions';

interface SleepSession {
  id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  quality_score: number | null;
  deep_minutes: number | null;
  rem_minutes: number | null;
  light_minutes: number | null;
  awake_minutes: number | null;
  source: string;
}

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
  accent: '#EF4444',
  deep: '#6366F1', // indigo
  rem: '#A78BFA', // violet
  light: '#60A5FA', // blue
  awake: '#FBBF24', // amber
} as const;

const font = "'Plus Jakarta Sans', -apple-system, system-ui, sans-serif";

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: T.bg,
    color: T.text,
    fontFamily: font,
    padding: '40px 32px 120px',
  },
  container: { maxWidth: 1200, margin: '0 auto' },
  backLink: {
    color: T.textDim,
    textDecoration: 'none',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    display: 'inline-block',
    marginBottom: 24,
  },
  title: {
    fontSize: 40,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: T.text,
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: T.textSecondary,
    marginTop: 8,
    marginBottom: 40,
  },

  twoPanel: {
    display: 'grid',
    gridTemplateColumns: '340px 1fr',
    gap: 24,
    marginBottom: 40,
  },

  /* Left panel - stats */
  statsPanel: {
    background: T.low,
    borderRadius: 16,
    padding: 32,
    border: `1px solid ${T.border}`,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    color: T.accent,
    marginBottom: 16,
  },
  bigNumber: {
    fontSize: 56,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    color: T.text,
    lineHeight: 1,
  },
  bigUnit: {
    fontSize: 18,
    color: T.textDim,
    marginLeft: 8,
    fontWeight: 400,
  },
  qualityRow: {
    marginTop: 24,
    padding: '20px 0',
    borderTop: `1px solid ${T.border}`,
    borderBottom: `1px solid ${T.border}`,
  },
  qualityScore: {
    fontSize: 36,
    fontWeight: 800,
    color: T.accent,
    lineHeight: 1,
  },
  qualityLabel: {
    fontSize: 11,
    color: T.textDim,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    marginTop: 4,
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
    marginTop: 24,
  },
  statCell: {},
  statLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    color: T.textDim,
    marginBottom: 4,
  },
  statValue: { fontSize: 22, fontWeight: 700, color: T.text },

  /* Right panel - timeline */
  timelinePanel: {
    background: T.low,
    borderRadius: 16,
    padding: 32,
    border: `1px solid ${T.border}`,
  },
  stageTimeline: {
    marginTop: 24,
    marginBottom: 32,
  },
  stageBar: {
    display: 'flex',
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  stageLegend: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
    fontSize: 11,
    color: T.textSecondary,
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },

  /* Weekly trend */
  trendSection: {
    marginTop: 32,
    paddingTop: 32,
    borderTop: `1px solid ${T.border}`,
  },
  trendChart: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 6,
    height: 120,
    marginTop: 16,
  },
  trendDay: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  trendBar: {
    width: '100%',
    background: `linear-gradient(180deg, ${T.accent} 0%, rgba(239,68,68,0.3) 100%)`,
    borderRadius: '4px 4px 0 0',
    minHeight: 4,
  },
  trendLabel: { fontSize: 10, color: T.textDim, fontWeight: 500 },

  /* Quick links */
  linkGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 12,
    marginTop: 24,
  },
  linkCard: {
    background: T.low,
    borderRadius: 12,
    padding: 16,
    border: `1px solid ${T.border}`,
    textDecoration: 'none',
    color: T.text,
    fontSize: 13,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
  },
  linkIcon: { color: T.accent, fontSize: 16 },

  /* Sessions list */
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: T.text,
    marginTop: 48,
    marginBottom: 16,
  },
  sessionCard: {
    background: T.low,
    borderRadius: 12,
    padding: 20,
    border: `1px solid ${T.border}`,
    marginBottom: 12,
  },
  sessionHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionDate: { fontWeight: 600, color: T.text, fontSize: 13 },
  sessionDur: { fontSize: 22, fontWeight: 800, color: T.accent },
  chipRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  chip: {
    fontSize: 10,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 9999,
    background: T.high,
    color: T.textSecondary,
  },

  empty: {
    padding: 48,
    textAlign: 'center',
    color: T.textFaint,
    fontSize: 13,
  },
};

function formatDuration(minutes: number): { h: string; m: string } {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return { h: `${h}`, m: `${m}` };
}

function formatHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function qualityLabel(score: number | null): string {
  if (score == null) return 'N/A';
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

export default function SleepPage() {
  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchSleepSessions(30);
      setSessions(data as SleepSession[]);
    } catch (err) {
      console.error('Failed to load sleep sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div style={s.page}>
        <div style={s.container}>
          <div style={s.empty}>Loading sleep data...</div>
        </div>
      </div>
    );
  }

  const lastSession = sessions[0] ?? null;
  const recent7 = sessions.slice(0, 7);
  const avgDuration =
    recent7.length > 0
      ? Math.round(recent7.reduce((sum, r) => sum + r.duration_minutes, 0) / recent7.length)
      : 0;
  const qualitySessions = recent7.filter((r) => r.quality_score != null);
  const avgQuality =
    qualitySessions.length > 0
      ? Math.round(
          qualitySessions.reduce((sum, r) => sum + (r.quality_score ?? 0), 0) /
            qualitySessions.length,
        )
      : null;

  const lastDur = lastSession ? formatDuration(lastSession.duration_minutes) : { h: '--', m: '--' };

  // Stage breakdown for last night
  const lastStages = lastSession
    ? {
        deep: lastSession.deep_minutes ?? 0,
        rem: lastSession.rem_minutes ?? 0,
        light: lastSession.light_minutes ?? 0,
        awake: lastSession.awake_minutes ?? 0,
      }
    : null;
  const stageTotal = lastStages
    ? lastStages.deep + lastStages.rem + lastStages.light + lastStages.awake
    : 0;

  const stagePct = (minutes: number) => (stageTotal > 0 ? (minutes / stageTotal) * 100 : 0);

  // Weekly trend (last 7, oldest first)
  const weekTrend = recent7.slice().reverse();
  const maxDur = Math.max(...weekTrend.map((r) => r.duration_minutes), 1);

  return (
    <div style={s.page}>
      <div style={s.container}>
        <Link href="/health" style={s.backLink}>
          ← MyHealth / Sleep
        </Link>
        <h1 style={s.title}>Sleep</h1>
        <p style={s.subtitle}>Stage analysis, quality scoring, and nightly trends</p>

        {lastSession ? (
          <div style={s.twoPanel}>
            {/* Left Panel - Stats */}
            <div style={s.statsPanel}>
              <div style={s.sectionLabel}>Last Night</div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={s.bigNumber}>{lastDur.h}</span>
                <span style={s.bigUnit}>h</span>
                <span style={{ ...s.bigNumber, marginLeft: 8 }}>{lastDur.m}</span>
                <span style={s.bigUnit}>m</span>
              </div>

              {lastSession.quality_score != null && (
                <div style={s.qualityRow}>
                  <div style={s.qualityScore}>{lastSession.quality_score}</div>
                  <div style={s.qualityLabel}>
                    {qualityLabel(lastSession.quality_score)} Quality
                  </div>
                </div>
              )}

              <div style={s.statGrid}>
                <div style={s.statCell}>
                  <div style={s.statLabel}>7-Day Avg</div>
                  <div style={s.statValue}>
                    {avgDuration > 0 ? formatHM(avgDuration) : '--'}
                  </div>
                </div>
                <div style={s.statCell}>
                  <div style={s.statLabel}>Avg Quality</div>
                  <div style={s.statValue}>{avgQuality != null ? `${avgQuality}%` : '--'}</div>
                </div>
                <div style={s.statCell}>
                  <div style={s.statLabel}>Sessions</div>
                  <div style={s.statValue}>{sessions.length}</div>
                </div>
                <div style={s.statCell}>
                  <div style={s.statLabel}>Source</div>
                  <div style={s.statValue}>{lastSession.source}</div>
                </div>
              </div>
            </div>

            {/* Right Panel - Timeline + Weekly Trend */}
            <div style={s.timelinePanel}>
              <div style={s.sectionLabel}>Stage Timeline</div>

              {lastStages && stageTotal > 0 ? (
                <div style={s.stageTimeline}>
                  <div style={s.stageBar}>
                    {lastStages.deep > 0 && (
                      <div
                        style={{
                          width: `${stagePct(lastStages.deep)}%`,
                          background: T.deep,
                        }}
                        title={`Deep ${lastStages.deep}m`}
                      />
                    )}
                    {lastStages.rem > 0 && (
                      <div
                        style={{
                          width: `${stagePct(lastStages.rem)}%`,
                          background: T.rem,
                        }}
                        title={`REM ${lastStages.rem}m`}
                      />
                    )}
                    {lastStages.light > 0 && (
                      <div
                        style={{
                          width: `${stagePct(lastStages.light)}%`,
                          background: T.light,
                        }}
                        title={`Light ${lastStages.light}m`}
                      />
                    )}
                    {lastStages.awake > 0 && (
                      <div
                        style={{
                          width: `${stagePct(lastStages.awake)}%`,
                          background: T.awake,
                        }}
                        title={`Awake ${lastStages.awake}m`}
                      />
                    )}
                  </div>
                  <div style={s.stageLegend}>
                    <div style={s.legendItem}>
                      <span style={{ ...s.legendDot, background: T.deep }} /> Deep{' '}
                      {formatHM(lastStages.deep)}
                    </div>
                    <div style={s.legendItem}>
                      <span style={{ ...s.legendDot, background: T.rem }} /> REM{' '}
                      {formatHM(lastStages.rem)}
                    </div>
                    <div style={s.legendItem}>
                      <span style={{ ...s.legendDot, background: T.light }} /> Light{' '}
                      {formatHM(lastStages.light)}
                    </div>
                    <div style={s.legendItem}>
                      <span style={{ ...s.legendDot, background: T.awake }} /> Awake{' '}
                      {formatHM(lastStages.awake)}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={s.empty}>No stage data for last session</div>
              )}

              <div style={s.trendSection}>
                <div style={s.sectionLabel}>7-Day Trend</div>
                <div style={s.trendChart}>
                  {weekTrend.map((session, i) => {
                    const pct = (session.duration_minutes / maxDur) * 100;
                    return (
                      <div key={i} style={s.trendDay}>
                        <div style={{ ...s.trendBar, height: `${Math.max(8, pct)}%` }} />
                        <div style={s.trendLabel}>
                          {new Date(session.start_time).toLocaleDateString(undefined, {
                            weekday: 'short',
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={s.linkGrid}>
                <a href="#smart-alarm" style={s.linkCard}>
                  <span style={s.linkIcon}>◉</span>
                  <span>Smart Alarm</span>
                </a>
                <a href="#snore" style={s.linkCard}>
                  <span style={s.linkIcon}>≋</span>
                  <span>Snore Detection</span>
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div style={s.empty}>
            No sleep sessions recorded yet. Sleep data syncs from your wearable on mobile.
          </div>
        )}

        {/* Session List */}
        {sessions.length > 0 && (
          <>
            <div style={s.sectionTitle}>Recent Sessions</div>
            {sessions.slice(0, 10).map((session) => (
              <div key={session.id} style={s.sessionCard}>
                <div style={s.sessionHead}>
                  <div style={s.sessionDate}>
                    {new Date(session.start_time).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <div style={s.sessionDur}>{formatHM(session.duration_minutes)}</div>
                </div>

                <div style={s.chipRow}>
                  {session.deep_minutes != null && (
                    <span style={s.chip}>Deep {session.deep_minutes}m</span>
                  )}
                  {session.rem_minutes != null && (
                    <span style={s.chip}>REM {session.rem_minutes}m</span>
                  )}
                  {session.light_minutes != null && (
                    <span style={s.chip}>Light {session.light_minutes}m</span>
                  )}
                  {session.quality_score != null && (
                    <span style={{ ...s.chip, color: T.accent }}>
                      {session.quality_score}% {qualityLabel(session.quality_score)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
