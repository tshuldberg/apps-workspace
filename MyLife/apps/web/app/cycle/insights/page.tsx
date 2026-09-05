'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, BarChart3, Flame, LineChart, Thermometer } from 'lucide-react';
import { fetchCycleInsightsBundle } from '../actions';
import { PHASE_COLORS, TOKENS, eyebrowStyle, ghostButtonStyle, panelStyle, subtitleStyle, titleStyle } from '../ui';

type InsightsData = Awaited<ReturnType<typeof fetchCycleInsightsBundle>>;

export default function CycleInsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchCycleInsightsBundle();
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="cy-section-stack">
        <div style={{ ...panelStyle('mid'), minHeight: 360, opacity: 0.5, animation: 'pulse 2s infinite' }} />
        <div className="cy-grid-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} style={{ ...panelStyle('low'), minHeight: 140, opacity: 0.4, animation: 'pulse 2s infinite' }} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ ...panelStyle('mid'), padding: 36, maxWidth: 520, margin: '48px auto', textAlign: 'center' }}>
        <p style={{ color: TOKENS.danger, fontWeight: 700, marginBottom: 18 }}>{error ?? 'Failed to load insights'}</p>
        <button type="button" onClick={() => void load()} style={ghostButtonStyle}>
          Retry
        </button>
      </div>
    );
  }

  const score = Math.round(data.trend.regularity * 100);
  const trendMeta = getTrendMeta(data.trend.direction);
  const navTiles = [
    {
      href: '/cycle/predictions',
      title: 'Predictions',
      subtitle:
        data.stats.averageCycleLength != null
          ? `Next in ~${Math.round(data.stats.averageCycleLength)}d`
          : 'Awaiting data',
      icon: <LineChart size={20} color={TOKENS.accent} strokeWidth={2.2} />,
    },
    {
      href: '/cycle/symptoms',
      title: 'Symptom Analysis',
      subtitle: 'Phase-based patterns',
      icon: <Activity size={20} color={PHASE_COLORS.ovulation} strokeWidth={2.2} />,
    },
    {
      href: '/cycle/analytics',
      title: 'Cycle Analytics',
      subtitle: data.stats.totalCycles > 0 ? `${data.stats.totalCycles} cycles` : 'No cycles yet',
      icon: <BarChart3 size={20} color={PHASE_COLORS.follicular} strokeWidth={2.2} />,
    },
    {
      href: '/cycle/bbt',
      title: 'BBT Tracking',
      subtitle: 'Coverline + shifts',
      icon: <Thermometer size={20} color={PHASE_COLORS.menstrual} strokeWidth={2.2} />,
    },
  ];

  return (
    <div className="cy-section-stack">
      {!data.hasData ? (
        <div style={{ ...panelStyle('mid'), padding: '64px 32px', textAlign: 'center' }}>
          <Flame size={40} color={TOKENS.accent} strokeWidth={1.6} style={{ margin: '0 auto 18px' }} />
          <h1 style={{ ...titleStyle, marginBottom: 14 }}>Your insights unlock as you log</h1>
          <p style={{ ...subtitleStyle, maxWidth: 520, margin: '0 auto' }}>
            Log at least two cycles to reveal regularity, trend signals, and a more tailored symptom story.
          </p>
        </div>
      ) : (
        <>
          <div className="cy-home-grid">
            <section style={{ ...panelStyle('mid'), padding: 28 }}>
              <p style={eyebrowStyle}>Regularity Score</p>
              <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: 28, alignItems: 'center', marginTop: 18 }}>
                <RegularityRing score={score} />
                <div>
                  <h1 style={{ ...titleStyle, marginBottom: 12 }}>{regularityLabel(data.trend.regularity)}</h1>
                  <p style={subtitleStyle}>
                    Based on your last {data.stats.totalCycles} cycle{data.stats.totalCycles === 1 ? '' : 's'}, your current regularity score is {score}%.
                  </p>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
                    <SignalPill label={trendMeta.label} color={trendMeta.color} />
                    <SignalPill
                      label={
                        data.trend.regularityTrend === 'improving'
                          ? 'Regularity improving'
                          : data.trend.regularityTrend === 'worsening'
                            ? 'Regularity worsening'
                            : data.trend.regularityTrend === 'stable'
                              ? 'Regularity stable'
                              : 'Trend still forming'
                      }
                      color={TOKENS.accentLight}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section style={{ ...panelStyle('low'), padding: 24 }}>
              <p style={eyebrowStyle}>Length Trend</p>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 10 }}>{trendMeta.label}</h2>
              <p style={{ ...subtitleStyle, marginTop: 10 }}>
                {data.recentLengths.length > 0
                  ? `Last ${data.recentLengths.length} complete cycles: ${data.recentLengths.join(', ')} days.`
                  : 'Complete more cycles to reveal a trend line.'}
              </p>
              <div style={{ marginTop: 22 }}>
                <TrendChart lengths={data.recentLengths} />
              </div>
            </section>
          </div>

          <div className="cy-grid-4">
            {navTiles.map((tile) => (
              <Link
                key={tile.href}
                href={tile.href}
                style={{
                  ...panelStyle('low'),
                  padding: 22,
                  textDecoration: 'none',
                  display: 'grid',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 16,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'rgba(255,255,255,0.05)',
                  }}
                >
                  {tile.icon}
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800 }}>{tile.title}</h3>
                  <p style={{ ...subtitleStyle, marginTop: 8 }}>{tile.subtitle}</p>
                </div>
              </Link>
            ))}
          </div>

          {data.insights.length > 0 ? (
            <section style={{ ...panelStyle('low'), padding: 26 }}>
              <p style={eyebrowStyle}>Recent Insights</p>
              <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
                {data.insights.slice(0, 5).map((insight) => (
                  <div key={insight.key} style={{ ...panelStyle('base'), padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        marginTop: 8,
                        background:
                          insight.priority === 'high'
                            ? PHASE_COLORS.menstrual
                            : insight.priority === 'medium'
                              ? TOKENS.accent
                              : PHASE_COLORS.follicular,
                        flexShrink: 0,
                      }}
                    />
                    <p style={{ ...subtitleStyle, color: TOKENS.text, margin: 0 }}>{insight.text}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function RegularityRing({ score }: { score: number }) {
  const circumference = 565.48;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;

  return (
    <div style={{ width: 220, height: 220, position: 'relative', margin: '0 auto' }}>
      <svg viewBox="0 0 220 220" style={{ width: '100%', height: '100%' }}>
        <circle cx="110" cy="110" r="90" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
        <circle
          cx="110"
          cy="110"
          r="90"
          fill="none"
          stroke={TOKENS.accent}
          strokeWidth="14"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 110 110)"
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <p style={{ ...eyebrowStyle, color: TOKENS.textTertiary }}>Score</p>
          <p style={{ fontSize: 54, fontWeight: 800, letterSpacing: '-0.04em', marginTop: 10 }}>{score}</p>
          <p style={{ ...subtitleStyle, fontSize: 12, marginTop: 6 }}>out of 100</p>
        </div>
      </div>
    </div>
  );
}

function TrendChart({ lengths }: { lengths: number[] }) {
  if (lengths.length === 0) {
    return (
      <div style={{ ...panelStyle('base'), padding: 24 }}>
        <p style={subtitleStyle}>Trend data appears after more complete cycles.</p>
      </div>
    );
  }

  const width = 520;
  const height = 180;
  const padding = 22;
  const min = Math.min(...lengths) - 1;
  const max = Math.max(...lengths) + 1;
  const range = Math.max(1, max - min);
  const points = lengths.map((length, index) => {
    const x = padding + (index / Math.max(lengths.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - ((length - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {[0, 1, 2, 3].map((tick) => {
        const y = padding + (tick / 3) * (height - padding * 2);
        return <line key={tick} x1={padding} x2={width - padding} y1={y} y2={y} stroke="rgba(255,255,255,0.05)" />;
      })}
      <polyline points={points.join(' ')} fill="none" stroke={TOKENS.accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {lengths.map((length, index) => {
        const [x, y] = points[index].split(',').map(Number);
        return (
          <g key={`${length}-${index}`}>
            <circle cx={x} cy={y} r="6" fill={index === lengths.length - 1 ? PHASE_COLORS.ovulation : TOKENS.accentLight} />
            <text x={x} y={height - 8} textAnchor="middle" fill={TOKENS.textTertiary} fontSize="11">
              {length}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function SignalPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        background: `${color}20`,
        color,
        padding: '9px 12px',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

function regularityLabel(score: number): string {
  if (score >= 0.9) return 'Very Regular';
  if (score >= 0.75) return 'Mostly Regular';
  if (score >= 0.55) return 'Somewhat Irregular';
  if (score > 0) return 'Irregular';
  return 'Insufficient Data';
}

function getTrendMeta(direction: InsightsData['trend']['direction']) {
  if (direction === 'lengthening') {
    return { label: 'Lengthening', color: PHASE_COLORS.follicular };
  }
  if (direction === 'shortening') {
    return { label: 'Shortening', color: PHASE_COLORS.ovulation };
  }
  if (direction === 'stable') {
    return { label: 'Stable', color: TOKENS.accent };
  }
  return { label: 'Not enough data', color: TOKENS.textSecondary };
}
