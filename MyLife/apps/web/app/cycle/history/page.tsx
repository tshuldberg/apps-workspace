'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { fetchCycleHistoryBundle } from '../actions';
import { TOKENS, eyebrowStyle, ghostButtonStyle, panelStyle, statValueStyle, subtitleStyle, titleStyle } from '../ui';
import { formatMonthDay } from '../utils';

type HistoryData = Awaited<ReturnType<typeof fetchCycleHistoryBundle>>;

export default function CycleHistoryPage() {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchCycleHistoryBundle();
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cycle history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="cy-calendar-grid">
        <div style={{ ...panelStyle('mid'), minHeight: 520, opacity: 0.5, animation: 'pulse 2s infinite' }} />
        <div style={{ ...panelStyle('low'), minHeight: 320, opacity: 0.4, animation: 'pulse 2s infinite' }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ ...panelStyle('mid'), padding: 36, maxWidth: 520, margin: '48px auto', textAlign: 'center' }}>
        <p style={{ color: TOKENS.danger, fontWeight: 700, marginBottom: 18 }}>{error ?? 'Failed to load cycle history'}</p>
        <button type="button" onClick={() => void load()} style={ghostButtonStyle}>
          Retry
        </button>
      </div>
    );
  }

  if (data.totalCycles === 0) {
    return (
      <div style={{ ...panelStyle('mid'), padding: '64px 32px', textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
        <div style={{ fontSize: 52, marginBottom: 18 }}>📜</div>
        <h1 style={{ ...titleStyle, marginBottom: 14 }}>No cycles tracked yet</h1>
        <p style={{ ...subtitleStyle, maxWidth: 520, margin: '0 auto 28px' }}>
          Log your first period on the daily log to start building a living timeline of cycle length, symptoms, and consistency.
        </p>
        <Link href="/cycle/log" style={{ ...ghostButtonStyle, textDecoration: 'none' }}>
          Open log
        </Link>
      </div>
    );
  }

  const avgLength = data.stats.averageCycleLength != null ? `${Math.round(data.stats.averageCycleLength)} days` : '--';
  const regularity = data.regularity > 0 ? `${Math.round(data.regularity * 100)}%` : '--';
  const lastPeriod = data.rows[0] ? formatMonthDay(data.rows[0].startDate) : '--';
  const consistencyCopy =
    data.regularity >= 0.85
      ? 'Your recent cycle rhythm is highly consistent.'
      : data.regularity >= 0.65
        ? 'Your cycle stays mostly consistent with some normal variation.'
        : 'Your cycle length varies noticeably right now. Logging helps sharpen the baseline.';

  return (
    <div className="cy-calendar-grid">
      <section className="cy-section-stack">
        <div style={{ ...panelStyle('mid'), padding: 28 }}>
          <p style={eyebrowStyle}>Archive</p>
          <h1 style={{ ...titleStyle, marginTop: 10 }}>Cycle History</h1>
          <p style={{ ...subtitleStyle, marginTop: 10, maxWidth: 620 }}>
            A timeline of your recent cycles with length, period duration, and logged symptom density.
          </p>

          <div className="cy-grid-3" style={{ marginTop: 24 }}>
            <StatCard label="Avg Length" value={avgLength} />
            <StatCard label="Regularity" value={regularity} />
            <StatCard label="Last Period" value={lastPeriod} />
          </div>
        </div>

        <div style={{ ...panelStyle('low'), padding: 26 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <p style={eyebrowStyle}>Past Cycles</p>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 10 }}>{data.totalCycles} tracked cycles</h2>
            </div>
            <Link href="/cycle/analytics" style={{ ...ghostButtonStyle, textDecoration: 'none' }}>
              Open analytics
            </Link>
          </div>

          <div style={{ display: 'grid', gap: 14, marginTop: 24 }}>
            {data.rows.map((row) => (
              <div
                key={row.id}
                style={{
                  ...panelStyle('base'),
                  padding: 20,
                  display: 'grid',
                  gridTemplateColumns: '72px minmax(0, 1fr) auto',
                  gap: 18,
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    borderRadius: 20,
                    padding: '14px 10px',
                    background: row.endDate ? 'rgba(255,255,255,0.05)' : 'rgba(255,184,119,0.14)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: TOKENS.textTertiary }}>{row.monthLabel}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{row.dayLabel}</div>
                </div>

                <div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Cycle {row.index}</h3>
                    <StatusPill
                      label={row.regularityLabel}
                      color={
                        row.regularityLabel === 'Regular'
                          ? TOKENS.accent
                          : row.regularityLabel === 'Long'
                            ? PHASE_TONE.long
                            : row.regularityLabel === 'Short'
                              ? PHASE_TONE.short
                              : TOKENS.textSecondary
                      }
                    />
                  </div>
                  <p style={{ ...subtitleStyle, marginTop: 8 }}>{row.dateRange}</p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                    <StatusPill label={row.lengthLabel} color={TOKENS.accentLight} />
                    <StatusPill label={row.flowLabel} color={PHASE_TONE.flow} />
                    <StatusPill label={`${row.symptomCount} symptoms`} color={PHASE_TONE.symptom} />
                  </div>
                </div>

                <Link
                  href={`/cycle/log?date=${row.startDate}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    color: TOKENS.textSecondary,
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  Review
                  <ArrowUpRight size={16} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="cy-card-stack">
        <div style={{ ...panelStyle('mid'), padding: 24 }}>
          <p style={eyebrowStyle}>Cycle Consistency</p>
          <p style={{ ...statValueStyle, marginTop: 12 }}>{regularity}</p>
          <p style={{ ...subtitleStyle, marginTop: 12 }}>{consistencyCopy}</p>
        </div>

        <div style={{ ...panelStyle('low'), padding: 24 }}>
          <p style={eyebrowStyle}>Trend Signal</p>
          <h3 style={{ fontSize: 22, fontWeight: 800, marginTop: 10 }}>
            {data.trend.direction === 'lengthening'
              ? 'Cycles trending longer'
              : data.trend.direction === 'shortening'
                ? 'Cycles trending shorter'
                : data.trend.direction === 'stable'
                  ? 'Cycles largely stable'
                  : 'Need more complete cycles'}
          </h3>
          <p style={{ ...subtitleStyle, marginTop: 10 }}>
            {data.trend.direction === 'insufficient_data'
              ? 'Four completed cycles unlock a more reliable trend read.'
              : `Current slope: ${data.trend.slopePerCycle > 0 ? '+' : ''}${data.trend.slopePerCycle.toFixed(2)} days per cycle.`}
          </p>
        </div>
      </aside>
    </div>
  );
}

const PHASE_TONE = {
  long: '#F472B6',
  short: '#FBCFE8',
  flow: '#FDA4AF',
  symptom: '#FFB877',
} as const;

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...panelStyle('base'), padding: 18 }}>
      <p style={{ ...eyebrowStyle, color: TOKENS.textTertiary }}>{label}</p>
      <p style={{ ...statValueStyle, fontSize: 28, marginTop: 10 }}>{value}</p>
    </div>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        background: `${color}20`,
        color,
        padding: '8px 12px',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}
