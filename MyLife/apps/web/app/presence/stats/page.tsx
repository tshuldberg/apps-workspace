'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import {
  CATEGORY_COLORS,
  PresenceCard,
  PresenceEmptyState,
  PresenceMetricCard,
  PresenceSectionHeading,
  TOKENS,
  buildConicGradient,
  chipStyle,
  formatMinutes,
} from '../ui';
import { fetchPresenceStatsSnapshot } from '../actions';

type PresencePeriod = 'today' | '7d' | '30d' | '90d';

interface StatsData {
  range: { start: string; end: string; days: number };
  goalMinutes: number;
  totalMinutes: number;
  averageMinutes: number;
  goalMetDays: number;
  bestDay: { date: string; total_minutes: number } | null;
  worstDay: { date: string; total_minutes: number } | null;
  categoryBreakdown: Array<{ category: string; minutes: number; percentage: number }>;
  topApps: Array<{ app_name: string; category: string; total_minutes: number; total_opens: number; deltaPercent: number | null }>;
  visibleDaily: Array<{ date: string; total_minutes: number }>;
  dailyCategoryStacks: Array<{ date: string; totalMinutes: number; categories: Array<{ category: string; minutes: number }> }>;
  improvementPercent: number;
  currentTotal: number;
  previousTotal: number;
}

const PERIODS: Array<{ key: PresencePeriod; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
];

export default function StatsPage() {
  const [period, setPeriod] = useState<PresencePeriod>('7d');
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadSnapshot(nextPeriod: PresencePeriod) {
    try {
      setError(null);
      setLoading(true);
      setData((await fetchPresenceStatsSnapshot(nextPeriod)) as StatsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSnapshot(period);
  }, [period]);

  if (loading) {
    return (
      <div className="pr-card-stack">
        <PresenceCard style={{ minHeight: 180 }} />
        <div className="pr-grid-3">
          <PresenceCard style={{ minHeight: 140 }} />
          <PresenceCard style={{ minHeight: 140 }} />
          <PresenceCard style={{ minHeight: 140 }} />
        </div>
      </div>
    );
  }

  if (error || data == null) {
    return (
      <PresenceEmptyState
        icon="warning"
        title="Stats unavailable"
        body={error ?? 'We could not load your presence analytics.'}
      />
    );
  }

  if (data.totalMinutes === 0 && data.topApps.length === 0) {
    return (
      <PresenceEmptyState
        icon="monitoring"
        title="Not enough data for charts yet"
        body="Presence analytics unlock after some app usage and focus sessions have been recorded."
      />
    );
  }

  const donutGradient = buildConicGradient(
    data.categoryBreakdown.map((segment) => ({
      percentage: segment.percentage,
      color: CATEGORY_COLORS[segment.category] ?? CATEGORY_COLORS.other,
    })),
  );
  const maxDaily = Math.max(...data.dailyCategoryStacks.map((day) => day.totalMinutes), data.goalMinutes, 1);

  return (
    <div className="pr-main-stack">
      <PresenceCard>
        <PresenceSectionHeading
          title="Usage Analytics"
          subtitle="A period-based view of where your screen time went, how the trend is moving, and which apps are responsible."
          action={(
            <div className="pr-chip-row">
              {PERIODS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPeriod(item.key)}
                  style={chipStyle(period === item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        />

        <div className="pr-grid-4" style={{ marginTop: 20 }}>
          <PresenceMetricCard label="Tracked" value={formatMinutes(data.totalMinutes)} tone={TOKENS.accentLight} detail={`Across ${data.range.days} day${data.range.days === 1 ? '' : 's'}`} />
          <PresenceMetricCard label="Daily Average" value={formatMinutes(data.averageMinutes)} tone={TOKENS.info} detail={`Goal ${formatMinutes(data.goalMinutes)}`} />
          <PresenceMetricCard label="Goal Days" value={`${data.goalMetDays}`} tone={TOKENS.success} detail={`${data.range.days === 1 ? 'Today' : `${data.range.days}-day window`}`} />
          <PresenceMetricCard
            label="Trend"
            value={`${data.improvementPercent > 0 ? '+' : ''}${data.improvementPercent}%`}
            tone={data.improvementPercent <= 0 ? TOKENS.success : TOKENS.warning}
            detail={`${formatMinutes(data.previousTotal)} before`}
          />
        </div>
      </PresenceCard>

      <div className="pr-grid-2">
        <PresenceCard>
          <PresenceSectionHeading
            title="Category Breakdown"
            subtitle="A desktop donut view of the app categories dominating this period."
          />
          <div className="pr-grid-2" style={{ marginTop: 18, alignItems: 'center' }}>
            <div
              style={{
                width: 220,
                height: 220,
                borderRadius: '50%',
                background: donutGradient,
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto',
                boxShadow: '0 18px 44px rgba(8,145,178,0.12)',
              }}
            >
              <div
                style={{
                  width: 124,
                  height: 124,
                  borderRadius: '50%',
                  background: TOKENS.surface,
                  display: 'grid',
                  placeItems: 'center',
                  textAlign: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }}>{formatMinutes(data.totalMinutes)}</div>
                  <div style={{ color: TOKENS.textTertiary, fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                    total
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {data.categoryBreakdown.map((segment) => (
                <div key={segment.category} style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: CATEGORY_COLORS[segment.category] ?? CATEGORY_COLORS.other,
                        }}
                      />
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{segment.category}</span>
                    </div>
                    <span style={{ color: TOKENS.textSecondary, fontSize: 13 }}>
                      {formatMinutes(segment.minutes)} · {Math.round(segment.percentage)}%
                    </span>
                  </div>
                  <div style={trackStyle}>
                    <div
                      style={{
                        ...fillStyle,
                        width: `${Math.max(8, segment.percentage)}%`,
                        background: CATEGORY_COLORS[segment.category] ?? CATEGORY_COLORS.other,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PresenceCard>

        <PresenceCard>
          <PresenceSectionHeading
            title="Daily Category Stacks"
            subtitle="A stacked bar view of the most recent days in the selected period."
          />
          <div style={{ display: 'flex', alignItems: 'end', gap: 12, marginTop: 22, minHeight: 250 }}>
            {data.dailyCategoryStacks.map((day) => (
              <div key={day.date} style={{ flex: 1, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 4, height: 210 }}>
                  {day.categories.length === 0 ? (
                    <div style={{ ...stackSegmentStyle, height: 14, background: 'rgba(255,255,255,0.08)' }} />
                  ) : (
                    day.categories.map((segment) => (
                      <div
                        key={`${day.date}-${segment.category}`}
                        style={{
                          ...stackSegmentStyle,
                          height: `${Math.max(12, (segment.minutes / maxDaily) * 210)}px`,
                          background: CATEGORY_COLORS[segment.category] ?? CATEGORY_COLORS.other,
                        }}
                        title={`${segment.category}: ${formatMinutes(segment.minutes)}`}
                      />
                    ))
                  )}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: TOKENS.text, fontSize: 12, fontWeight: 700 }}>
                    {formatMinutes(day.totalMinutes)}
                  </div>
                  <div style={{ color: TOKENS.textTertiary, fontSize: 11 }}>
                    {day.date.slice(5)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </PresenceCard>
      </div>

      <div className="pr-grid-2">
        <PresenceCard>
          <PresenceSectionHeading title="Top Apps" subtitle="The apps with the most total minutes in this window." />
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            {data.topApps.map((app) => (
              <div key={app.app_name} style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{app.app_name}</div>
                    <div style={{ color: TOKENS.textTertiary, fontSize: 12 }}>{app.category}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: TOKENS.accentLight, fontSize: 14, fontWeight: 700 }}>
                      {formatMinutes(app.total_minutes)}
                    </div>
                    <div style={{ color: app.deltaPercent != null && app.deltaPercent <= 0 ? TOKENS.success : TOKENS.warning, fontSize: 12, fontWeight: 700 }}>
                      {app.deltaPercent == null ? 'new' : `${app.deltaPercent > 0 ? '+' : ''}${app.deltaPercent}%`}
                    </div>
                  </div>
                </div>
                <div style={trackStyle}>
                  <div
                    style={{
                      ...fillStyle,
                      width: `${Math.max(8, (app.total_minutes / Math.max(data.topApps[0]?.total_minutes ?? 1, 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </PresenceCard>

        <PresenceCard>
          <PresenceSectionHeading title="Period Summary" subtitle="Best day, worst day, and how the selected window compares to your goal." />
          <div className="pr-grid-2" style={{ marginTop: 16 }}>
            <PresenceMetricCard
              label="Best Day"
              value={data.bestDay ? formatMinutes(data.bestDay.total_minutes) : '0m'}
              tone={TOKENS.success}
              detail={data.bestDay?.date ?? 'No data'}
            />
            <PresenceMetricCard
              label="Worst Day"
              value={data.worstDay ? formatMinutes(data.worstDay.total_minutes) : '0m'}
              tone={TOKENS.warning}
              detail={data.worstDay?.date ?? 'No data'}
            />
          </div>
          <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={labelStyle}>Goal-hit rate</span>
              <span style={valueStyle}>{Math.round((data.goalMetDays / Math.max(data.range.days, 1)) * 100)}%</span>
            </div>
            <div style={trackStyle}>
              <div style={{ ...fillStyle, width: `${Math.max(8, (data.goalMetDays / Math.max(data.range.days, 1)) * 100)}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={labelStyle}>Average vs goal</span>
              <span style={valueStyle}>
                {data.averageMinutes <= data.goalMinutes ? 'under goal' : 'over goal'}
              </span>
            </div>
          </div>
        </PresenceCard>
      </div>
    </div>
  );
}

const trackStyle: CSSProperties = {
  width: '100%',
  height: 10,
  borderRadius: 999,
  overflow: 'hidden',
  background: 'rgba(255,255,255,0.08)',
};

const fillStyle: CSSProperties = {
  height: '100%',
  borderRadius: 999,
  background: 'linear-gradient(90deg, #22D3EE, #0891B2)',
};

const stackSegmentStyle: CSSProperties = {
  width: '100%',
  borderRadius: 999,
};

const labelStyle: CSSProperties = {
  color: TOKENS.textSecondary,
  fontSize: 14,
};

const valueStyle: CSSProperties = {
  color: TOKENS.text,
  fontSize: 14,
  fontWeight: 700,
};
