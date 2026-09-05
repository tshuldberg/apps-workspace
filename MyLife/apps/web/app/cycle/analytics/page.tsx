'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { fetchCycleAnalyticsBundle } from '../actions';
import { TOKENS, eyebrowStyle, ghostButtonStyle, panelStyle, statValueStyle, subtitleStyle, titleStyle } from '../ui';
import { formatSymptomLabel } from '../utils';

type AnalyticsData = Awaited<ReturnType<typeof fetchCycleAnalyticsBundle>>;

export default function CycleAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchCycleAnalyticsBundle();
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <div style={{ ...panelStyle('mid'), minHeight: 540, opacity: 0.5, animation: 'pulse 2s infinite' }} />;
  }

  if (error || !data) {
    return (
      <div style={{ ...panelStyle('mid'), padding: 36, maxWidth: 520, margin: '48px auto', textAlign: 'center' }}>
        <p style={{ color: TOKENS.danger, fontWeight: 700, marginBottom: 18 }}>{error ?? 'Failed to load analytics'}</p>
        <button type="button" onClick={() => void load()} style={ghostButtonStyle}>
          Retry
        </button>
      </div>
    );
  }

  if (data.trackedCycles === 0) {
    return (
      <div style={{ ...panelStyle('mid'), padding: '64px 32px', textAlign: 'center' }}>
        <h1 style={{ ...titleStyle, marginBottom: 14 }}>No cycle history yet</h1>
        <p style={{ ...subtitleStyle, maxWidth: 520, margin: '0 auto' }}>
          Log a few cycles to unlock frequency charts, distribution views, and flow intensity trends.
        </p>
      </div>
    );
  }

  return (
    <div className="cy-section-stack">
      <section className="cy-home-grid">
        <div
          style={{
            ...panelStyle('mid'),
            padding: 28,
            background:
              'radial-gradient(circle at top left, rgba(255,184,119,0.18), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
          }}
        >
          <p style={eyebrowStyle}>Deep Insights</p>
          <h1 style={{ ...titleStyle, marginTop: 10 }}>Cycle Analytics</h1>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 22 }}>
            <span style={{ ...statValueStyle, fontSize: 72 }}>{data.averageLength != null ? data.averageLength.toFixed(1) : '--'}</span>
            <span style={{ color: TOKENS.textSecondary, fontSize: 18, fontWeight: 700 }}>days</span>
          </div>
          <p style={{ ...subtitleStyle, marginTop: 10 }}>
            {data.stdDev != null ? `± ${data.stdDev.toFixed(1)} day variation` : 'Need more complete cycles'} • {data.statusLabel}
          </p>
        </div>

        <div className="cy-card-stack">
          <div style={{ ...panelStyle('low'), padding: 22 }}>
            <p style={eyebrowStyle}>Coverage</p>
            <p style={{ ...statValueStyle, fontSize: 34, marginTop: 10 }}>{data.trackedCycles}</p>
            <p style={{ ...subtitleStyle, marginTop: 8 }}>Tracked cycles in this analytics view.</p>
          </div>
          <div style={{ ...panelStyle('low'), padding: 22 }}>
            <p style={eyebrowStyle}>Next Step</p>
            <p style={{ ...subtitleStyle, marginTop: 10 }}>
              Compare this distribution with your phase-based symptom view to see whether variability lines up with repeated symptom spikes.
            </p>
            <Link href="/cycle/symptoms" style={{ ...ghostButtonStyle, textDecoration: 'none', display: 'inline-flex', marginTop: 16 }}>
              Open symptom analysis
            </Link>
          </div>
        </div>
      </section>

      <section style={{ ...panelStyle('low'), padding: 26 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <p style={eyebrowStyle}>Symptom Frequency</p>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 10 }}>Most repeated symptoms</h2>
          </div>
          <button type="button" style={ghostButtonStyle}>
            <Download size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: 14, marginTop: 22 }}>
          {data.symptomRows.map((row) => (
            <div key={row.symptom} style={{ ...panelStyle('base'), padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{formatSymptomLabel(row.symptom)}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: TOKENS.textSecondary }}>{row.percentage}%</span>
              </div>
              <div style={{ height: 12, borderRadius: 999, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', marginTop: 12 }}>
                <div style={{ width: `${row.percentage}%`, height: '100%', borderRadius: 999, background: row.color }} />
              </div>
              <p style={{ ...subtitleStyle, fontSize: 12, marginTop: 8 }}>Logged {row.count} times</p>
            </div>
          ))}
        </div>
      </section>

      <div className="cy-grid-2">
        <section style={{ ...panelStyle('low'), padding: 26 }}>
          <p style={eyebrowStyle}>Cycle Length Distribution</p>
          <p style={{ ...subtitleStyle, marginTop: 10 }}>
            Histogram across 21–40 day cycles. The highlighted bar marks your current average.
          </p>
          <Histogram bars={data.histogram} averageLength={data.averageLength} />
        </section>

        <section style={{ ...panelStyle('low'), padding: 26 }}>
          <p style={eyebrowStyle}>Flow Intensity Distribution</p>
          <p style={{ ...subtitleStyle, marginTop: 10 }}>
            A proportional view of spotting, light, medium, and heavy flow days from the logged record.
          </p>

          <div style={{ display: 'flex', height: 22, borderRadius: 999, overflow: 'hidden', marginTop: 22 }}>
            {data.flowRows.map((row) => (
              <div
                key={row.key}
                style={{
                  width: `${Math.max(row.percentage, row.count > 0 ? 4 : 0)}%`,
                  background: row.color,
                }}
              />
            ))}
          </div>

          <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
            {data.flowRows.map((row) => (
              <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: row.color }} />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{row.label}</span>
                </div>
                <span style={{ color: TOKENS.textSecondary, fontSize: 13 }}>
                  {row.count} days • {row.percentage}%
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Histogram({
  bars,
  averageLength,
}: {
  bars: AnalyticsData['histogram'];
  averageLength: number | null;
}) {
  const max = Math.max(1, ...bars.map((bar) => bar.count));

  return (
    <div style={{ display: 'grid', gap: 16, marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'end', gap: 6, minHeight: 220 }}>
        {bars.map((bar) => {
          const active =
            averageLength != null && Math.round(averageLength) === Number(bar.label);
          return (
            <div key={bar.label} style={{ flex: 1, display: 'grid', justifyItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: '100%',
                  height: `${Math.max(6, (bar.count / max) * 180)}px`,
                  borderRadius: '10px 10px 0 0',
                  background: active ? TOKENS.accent : 'rgba(255,255,255,0.08)',
                }}
              />
              <span style={{ fontSize: 11, color: TOKENS.textTertiary }}>{bar.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
