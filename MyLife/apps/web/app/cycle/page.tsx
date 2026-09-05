'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Heart, Sparkles, Zap } from 'lucide-react';
import { fetchCycleHomeDashboard } from './actions';
import {
  PHASE_COLORS,
  TOKENS,
  eyebrowStyle,
  fabLinkStyle,
  ghostButtonStyle,
  gradientButtonStyle,
  panelStyle,
  statValueStyle,
  subtitleStyle,
  titleStyle,
} from './ui';
import { formatMonthDay, formatPhaseLabel } from './utils';

type DashboardData = Awaited<ReturnType<typeof fetchCycleHomeDashboard>>;

type TipIcon = 'zap' | 'heart' | 'sparkles';

interface PhaseTip {
  icon: TipIcon;
  title: string;
  body: string;
  accent: string;
}

const PHASE_TIPS: Record<NonNullable<DashboardData['currentPhase']>, PhaseTip[]> = {
  menstrual: [
    {
      icon: 'sparkles',
      title: 'Rest and restore',
      body: 'Lower-impact movement and extra hydration support recovery now.',
      accent: PHASE_COLORS.menstrual,
    },
    {
      icon: 'heart',
      title: 'Gentle routines',
      body: 'Warm meals, journaling, and softer evenings tend to land well.',
      accent: PHASE_COLORS.follicular,
    },
  ],
  follicular: [
    {
      icon: 'zap',
      title: 'Rising energy',
      body: 'A strong window for training blocks, planning, and fresh starts.',
      accent: TOKENS.accentLight,
    },
    {
      icon: 'heart',
      title: 'Open and curious',
      body: 'Social plans and new ideas usually feel lighter during this stretch.',
      accent: PHASE_COLORS.follicular,
    },
  ],
  ovulation: [
    {
      icon: 'zap',
      title: 'Peak output',
      body: 'Lean into launches, tough workouts, and high-confidence conversations.',
      accent: TOKENS.accentLight,
    },
    {
      icon: 'heart',
      title: 'Social peak',
      body: 'Communication and magnetism often feel strongest around ovulation.',
      accent: PHASE_COLORS.ovulation,
    },
  ],
  luteal: [
    {
      icon: 'sparkles',
      title: 'Focus and finish',
      body: 'Great window for detail work, planning, and closing open loops.',
      accent: PHASE_COLORS.luteal,
    },
    {
      icon: 'heart',
      title: 'Grounded rhythms',
      body: 'Steadier meals, sleep, and gentler cardio usually feel best here.',
      accent: PHASE_COLORS.follicular,
    },
  ],
};

export default function CycleTodayPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchCycleHomeDashboard();
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cycle dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="cy-home-grid">
        <div style={{ ...panelStyle('mid'), minHeight: 520, opacity: 0.55, animation: 'pulse 2s infinite' }} />
        <div style={{ display: 'grid', gap: 16 }}>
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              style={{ ...panelStyle('low'), minHeight: 144, opacity: 0.45, animation: 'pulse 2s infinite' }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ ...panelStyle('mid'), padding: 36, maxWidth: 520, margin: '48px auto', textAlign: 'center' }}>
        <p style={{ color: TOKENS.danger, fontWeight: 700, marginBottom: 18 }}>{error ?? 'Failed to load cycle dashboard'}</p>
        <button type="button" onClick={() => void load()} style={ghostButtonStyle}>
          Retry
        </button>
      </div>
    );
  }

  if (data.stats.totalCycles === 0) {
    return (
      <div style={{ ...panelStyle('mid'), padding: '64px 32px', textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
        <div style={{ fontSize: 56, marginBottom: 18 }}>🌙</div>
        <h1 style={{ ...titleStyle, marginBottom: 14 }}>Your cycle journey starts here</h1>
        <p style={{ ...subtitleStyle, maxWidth: 520, margin: '0 auto 28px' }}>
          Log your first period to begin tracking predictions, cycle patterns, symptom insights, and basal-body-temperature trends.
        </p>
        <Link href="/cycle/log" style={{ ...gradientButtonStyle, display: 'inline-flex', textDecoration: 'none' }}>
          Start Tracking
        </Link>
      </div>
    );
  }

  const phase = data.currentPhase ?? 'follicular';
  const phaseLabel = data.currentPhase ? `${formatPhaseLabel(data.currentPhase)} phase` : 'Cycle overview';
  const daysUntilNextPeriod = data.prediction?.daysUntilNextPeriod;
  const nextPeriodLabel =
    daysUntilNextPeriod == null
      ? 'Prediction building'
      : daysUntilNextPeriod <= 0
        ? 'Your period is expected'
        : `Next period in ${daysUntilNextPeriod} day${daysUntilNextPeriod === 1 ? '' : 's'}`;
  const fertileLabel =
    data.prediction?.fertileWindowStart && data.prediction?.fertileWindowEnd
      ? `Fertile window: ${formatMonthDay(data.prediction.fertileWindowStart)} – ${formatMonthDay(data.prediction.fertileWindowEnd)}`
      : 'Fertile window pending';
  const averageLength = data.stats.averageCycleLength?.toFixed(1) ?? '--';
  const averagePeriod = data.stats.averagePeriodLength?.toFixed(1) ?? '--';
  const variability = data.stats.cycleLengthStdDev?.toFixed(1) ?? '--';
  const tips = PHASE_TIPS[phase];

  return (
    <>
      <div className="cy-home-grid">
        <div className="cy-section-stack">
          <section
            style={{
              ...panelStyle('mid'),
              padding: 28,
              background:
                'radial-gradient(circle at top left, rgba(255,184,119,0.20), transparent 38%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ maxWidth: 360 }}>
                <p style={eyebrowStyle}>Mission Control</p>
                <h1 style={{ ...titleStyle, marginTop: 10, marginBottom: 12 }}>Today</h1>
                <p style={subtitleStyle}>
                  One glance at your current phase, next forecast, and the signals shaping this cycle.
                </p>
              </div>
              <div style={{ display: 'grid', gap: 10, justifyItems: 'end' }}>
                <div style={{ padding: '10px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', color: TOKENS.textSecondary, fontSize: 12, fontWeight: 700 }}>
                  {data.today}
                </div>
                {data.prediction ? (
                  <div style={{ padding: '10px 14px', borderRadius: 999, background: 'rgba(244,114,182,0.14)', color: PHASE_COLORS.ovulation, fontSize: 12, fontWeight: 700 }}>
                    Confidence {Math.round(data.prediction.confidence * 100)}%
                  </div>
                ) : null}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)', gap: 28, alignItems: 'center', marginTop: 28 }}>
              <PhaseRing phase={phase} dayOfCycle={data.dayOfCycle} totalDays={data.cycleLength} />
              <div className="cy-card-stack">
                <div style={{ ...panelStyle('base'), padding: 22 }}>
                  <p style={eyebrowStyle}>Forecast</p>
                  <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 10 }}>{nextPeriodLabel}</h2>
                  <p style={{ ...subtitleStyle, marginTop: 10 }}>
                    {data.prediction
                      ? `Estimated ${formatMonthDay(data.prediction.predictedStartDate)} – ${formatMonthDay(data.prediction.predictedEndDate)}`
                      : 'Keep logging to improve your forecast.'}
                  </p>
                </div>

                <div className="cy-masonry-2">
                  <BentoCard
                    eyebrow="Fertility"
                    title={fertileLabel}
                    body={
                      phase === 'ovulation'
                        ? 'You are in your peak fertile window.'
                        : phase === 'follicular'
                          ? 'Fertility is rising toward ovulation.'
                          : phase === 'menstrual'
                            ? 'Fertility is typically low during menstruation.'
                            : 'The fertile window usually fades during the luteal phase.'
                    }
                    accent={PHASE_COLORS.ovulation}
                  />
                  <BentoCard
                    eyebrow="Current Phase"
                    title={phaseLabel}
                    body={
                      data.dayOfCycle != null
                        ? `Day ${data.dayOfCycle} of an estimated ${data.cycleLength}-day cycle.`
                        : 'Log more cycle data to calculate a live day count.'
                    }
                    accent={PHASE_COLORS[phase]}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="cy-masonry-2">
            {tips.map((tip) => (
              <div key={tip.title} style={{ ...panelStyle('low'), padding: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 16,
                      display: 'grid',
                      placeItems: 'center',
                      background: `${tip.accent}22`,
                      color: tip.accent,
                    }}
                  >
                    <TipGlyph icon={tip.icon} color={tip.accent} />
                  </div>
                  <div>
                    <p style={eyebrowStyle}>Phase Signal</p>
                    <h3 style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{tip.title}</h3>
                  </div>
                </div>
                <p style={subtitleStyle}>{tip.body}</p>
              </div>
            ))}
          </section>
        </div>

        <aside className="cy-card-stack">
          <div style={{ ...panelStyle('low'), padding: 24 }}>
            <p style={eyebrowStyle}>Quick Stats</p>
            <div className="cy-grid-2" style={{ gap: 14, marginTop: 16 }}>
              <StatTile label="Cycles" value={String(data.stats.totalCycles)} />
              <StatTile label="Avg Cycle" value={`${averageLength}d`} />
              <StatTile label="Avg Period" value={`${averagePeriod}d`} />
              <StatTile label="Variance" value={`${variability}d`} />
            </div>
          </div>

          <div style={{ ...panelStyle('mid'), padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <p style={eyebrowStyle}>Recent Cycles</p>
                <h3 style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>Latest timeline</h3>
              </div>
              <Link href="/cycle/history" style={{ ...ghostButtonStyle, textDecoration: 'none' }}>
                View history
              </Link>
            </div>
            <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
              {data.recentCycles.map((cycle, index) => (
                <div key={cycle.id} style={{ ...panelStyle('base'), padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <p style={{ ...eyebrowStyle, color: index === 0 ? PHASE_COLORS.ovulation : TOKENS.textTertiary }}>
                        Cycle {data.recentCycles.length - index}
                      </p>
                      <h4 style={{ fontSize: 17, fontWeight: 800, marginTop: 6 }}>{formatMonthDay(cycle.startDate)}</h4>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 18, fontWeight: 800 }}>
                        {cycle.lengthDays ? `${cycle.lengthDays}d` : 'Active'}
                      </p>
                      <p style={{ ...subtitleStyle, fontSize: 12 }}>
                        {cycle.periodLength ? `${cycle.periodLength} day period` : 'Still logging'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...panelStyle('high'), padding: 24 }}>
            <p style={eyebrowStyle}>Next Move</p>
            <h3 style={{ fontSize: 22, fontWeight: 800, marginTop: 10 }}>Capture today’s signals</h3>
            <p style={{ ...subtitleStyle, marginTop: 10 }}>
              Logging flow, mood, and symptoms keeps predictions stable and sharpens the insights view.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
              <Link href="/cycle/log" style={{ ...gradientButtonStyle, textDecoration: 'none' }}>
                Open log
              </Link>
              <Link href="/cycle/calendar" style={{ ...ghostButtonStyle, textDecoration: 'none' }}>
                Review calendar
              </Link>
            </div>
          </div>
        </aside>
      </div>

      <Link href="/cycle/log" style={{ ...fabLinkStyle, textDecoration: 'none' }}>
        <CalendarDays size={18} />
        <span>Log Today</span>
      </Link>
    </>
  );
}

function PhaseRing({
  phase,
  dayOfCycle,
  totalDays,
}: {
  phase: NonNullable<DashboardData['currentPhase']>;
  dayOfCycle: number | null;
  totalDays: number;
}) {
  const ratio = dayOfCycle != null ? Math.max(0, Math.min(1, dayOfCycle / Math.max(totalDays, 1))) : 0.08;
  const orbitDegrees = Math.round(ratio * 360);
  const phaseName = formatPhaseLabel(phase);

  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 16 }}>
      <div
        style={{
          width: 280,
          height: 280,
          borderRadius: '50%',
          padding: 22,
          background:
            `conic-gradient(
              ${PHASE_COLORS.menstrual} 0deg 72deg,
              ${PHASE_COLORS.follicular} 72deg 184deg,
              ${PHASE_COLORS.ovulation} 184deg 226deg,
              ${PHASE_COLORS.luteal} 226deg 360deg
            )`,
          boxShadow: `0 24px 60px rgba(0,0,0,0.24), 0 0 0 10px rgba(255,255,255,0.02), 0 0 48px ${PHASE_COLORS[phase]}22`,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 14,
            borderRadius: '50%',
            transform: `rotate(${orbitDegrees - 90}deg)`,
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: PHASE_COLORS[phase],
              boxShadow: `0 0 0 6px ${PHASE_COLORS[phase]}22`,
              position: 'absolute',
              left: '50%',
              top: 0,
              marginLeft: -10,
            }}
          />
        </div>

        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: 'radial-gradient(circle at top, rgba(255,255,255,0.07), rgba(14,14,19,0.98) 72%)',
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
            padding: 24,
          }}
        >
          <div>
            <p style={eyebrowStyle}>Current Phase</p>
            <p style={{ fontSize: 64, fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1, marginTop: 14 }}>
              {dayOfCycle != null ? `Day ${dayOfCycle}` : '--'}
            </p>
            <p style={{ ...subtitleStyle, marginTop: 10 }}>{phaseName} phase</p>
            <p style={{ ...subtitleStyle, fontSize: 12, marginTop: 8 }}>Estimated {totalDays}-day rhythm</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BentoCard({
  eyebrow,
  title,
  body,
  accent,
}: {
  eyebrow: string;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <div
      style={{
        ...panelStyle('low'),
        padding: 20,
        background: `linear-gradient(180deg, ${accent}14, rgba(255,255,255,0.03))`,
      }}
    >
      <p style={eyebrowStyle}>{eyebrow}</p>
      <h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 10 }}>{title}</h3>
      <p style={{ ...subtitleStyle, marginTop: 10 }}>{body}</p>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...panelStyle('base'), padding: 16 }}>
      <p style={{ ...eyebrowStyle, color: TOKENS.textTertiary }}>{label}</p>
      <p style={{ ...statValueStyle, fontSize: 26, marginTop: 10 }}>{value}</p>
    </div>
  );
}

function TipGlyph({ icon, color }: { icon: TipIcon; color: string }) {
  if (icon === 'zap') return <Zap size={20} color={color} strokeWidth={2.2} />;
  if (icon === 'heart') return <Heart size={20} color={color} strokeWidth={2.2} />;
  return <Sparkles size={20} color={color} strokeWidth={2.2} />;
}
