'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  PresenceCard,
  PresenceEmptyState,
  PresenceMetricCard,
  PresenceSectionHeading,
  TOKENS,
  buildHeatmapCells,
  buildStreakRuns,
  formatMinutes,
  groupDailyUsageByWeek,
} from '../ui';
import { fetchPresenceInsightsSnapshot } from '../actions';

interface InsightsSnapshot {
  dailyUsage: Array<{
    date: string;
    total_minutes: number;
    goal_met: number;
    pickups: number;
    first_pickup: string | null;
  }>;
  sessions: Array<{
    id: string;
    start_time: string;
    planned_minutes: number;
    actual_minutes: number | null;
    completed: number;
  }>;
  xpLog: Array<{ date: string; amount: number }>;
  trackedDays: number;
  generatedInsights: Array<{
    type: string;
    title: string;
    body: string;
    severity?: 'positive' | 'neutral' | 'warning';
  }>;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function InsightsPage() {
  const [data, setData] = useState<InsightsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      setError(null);
      setData((await fetchPresenceInsightsSnapshot()) as InsightsSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const chart = useMemo(() => {
    if (!data) return null;
    const trend = data.dailyUsage.slice(-30);
    const maxValue = Math.max(...trend.map((item) => item.total_minutes), 1);
    const width = 720;
    const height = 220;
    const points = trend.map((item, index) => {
      const x = trend.length <= 1 ? width / 2 : (index / (trend.length - 1)) * width;
      const y = height - (item.total_minutes / maxValue) * height;
      return `${x},${Math.max(12, y)}`;
    }).join(' ');
    return { trend, points, width, height, maxValue };
  }, [data]);

  const heatmap = useMemo(() => {
    if (!data) return [];
    return buildHeatmapCells(data.sessions, data.trackedDays);
  }, [data]);

  const streakRuns = useMemo(() => {
    if (!data) return [];
    return buildStreakRuns(data.dailyUsage).slice(0, 6);
  }, [data]);

  const weeklyCards = useMemo(() => {
    if (!data) return [];
    return groupDailyUsageByWeek(data.dailyUsage, data.sessions, data.xpLog).slice(0, 6);
  }, [data]);

  const pickups = useMemo(() => (data?.dailyUsage.slice(-14) ?? []), [data]);

  if (loading) {
    return (
      <div className="pr-card-stack">
        <PresenceCard style={{ minHeight: 220 }} />
        <PresenceCard style={{ minHeight: 220 }} />
      </div>
    );
  }

  if (error || data == null) {
    return (
      <PresenceEmptyState
        icon="warning"
        title="Insights unavailable"
        body={error ?? 'We could not load your insights dashboard.'}
      />
    );
  }

  if (data.dailyUsage.length === 0) {
    return (
      <PresenceEmptyState
        icon="show_chart"
        title="Insights unlock with usage history"
        body="Track a few days of screen time and complete some focus sessions to reveal trends, heatmaps, and recommendations."
      />
    );
  }

  const bestPickup = pickups.reduce((best, item) => Math.max(best, item.pickups), 1);

  return (
    <div className="pr-main-stack">
      <PresenceCard>
        <PresenceSectionHeading
          title="Behavioral Insights"
          subtitle="Patterns across the last month: usage trend, pickup intensity, session timing, and the recommendations generated from your own data."
        />
        <div className="pr-grid-4" style={{ marginTop: 20 }}>
          <PresenceMetricCard label="Tracked Days" value={`${data.trackedDays}`} tone={TOKENS.accentLight} detail="days in local history" />
          <PresenceMetricCard label="Completed Sessions" value={`${data.sessions.filter((session) => session.completed === 1).length}`} tone={TOKENS.info} detail="all-time finished blocks" />
          <PresenceMetricCard label="Goal Days" value={`${data.dailyUsage.filter((day) => day.goal_met === 1).length}`} tone={TOKENS.success} detail="under-goal days" />
          <PresenceMetricCard label="Recommendations" value={`${data.generatedInsights.length}`} tone={TOKENS.warning} detail="active insights detected" />
        </div>
      </PresenceCard>

      <div className="pr-grid-2">
        <PresenceCard>
          <PresenceSectionHeading
            title="30-Day Trend"
            subtitle="A month-long line view of total daily screen time."
          />
          {chart ? (
            <div style={{ marginTop: 18 }}>
              <svg viewBox={`0 0 ${chart.width} ${chart.height + 24}`} width="100%" height="260" role="img" aria-label="30 day usage trend">
                {[0.25, 0.5, 0.75, 1].map((line) => (
                  <line
                    key={line}
                    x1="0"
                    x2={chart.width}
                    y1={chart.height - chart.height * line}
                    y2={chart.height - chart.height * line}
                    stroke="rgba(255,255,255,0.08)"
                    strokeDasharray="6 8"
                  />
                ))}
                <polyline
                  fill="none"
                  stroke={TOKENS.accentLight}
                  strokeWidth="4"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={chart.points}
                />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={microCopyStyle}>{chart.trend[0]?.date}</span>
                <span style={microCopyStyle}>{chart.trend.at(-1)?.date}</span>
              </div>
            </div>
          ) : null}
        </PresenceCard>

        <PresenceCard>
          <PresenceSectionHeading
            title="Peak Hours Heatmap"
            subtitle="Approximate focus-session intensity by weekday and hour."
          />
          <div style={{ display: 'grid', gap: 8, marginTop: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(24, minmax(0, 1fr))', gap: 6 }}>
              <div />
              {Array.from({ length: 24 }, (_, hour) => (
                <div key={hour} style={{ ...microCopyStyle, textAlign: 'center', fontSize: 10 }}>
                  {hour}
                </div>
              ))}
            </div>
            {DAYS.map((dayLabel, dayIndex) => (
              <div key={dayLabel} style={{ display: 'grid', gridTemplateColumns: '48px repeat(24, minmax(0, 1fr))', gap: 6, alignItems: 'center' }}>
                <div style={{ ...microCopyStyle, textAlign: 'right' }}>{dayLabel}</div>
                {heatmap.filter((cell) => cell.dayIndex === dayIndex).map((cell) => (
                  <div
                    key={cell.id}
                    title={`${dayLabel} ${cell.hour}:00 · ${cell.averageMinutes} mins`}
                    style={{
                      height: 16,
                      borderRadius: 6,
                      background:
                        cell.averageMinutes === 0
                          ? 'rgba(255,255,255,0.05)'
                          : `rgba(34,211,238,${Math.min(0.9, 0.2 + cell.averageMinutes / 90)})`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </PresenceCard>
      </div>

      <div className="pr-grid-2">
        <PresenceCard>
          <PresenceSectionHeading
            title="Pickup Frequency"
            subtitle="The last two weeks of reach-for-your-phone behavior."
          />
          <div style={{ display: 'flex', alignItems: 'end', gap: 10, minHeight: 170, marginTop: 18 }}>
            {pickups.map((day) => (
              <div key={day.date} style={{ flex: 1, display: 'grid', gap: 8 }}>
                <div
                  style={{
                    height: `${Math.max(10, (day.pickups / bestPickup) * 140)}px`,
                    borderRadius: 16,
                    background: 'linear-gradient(180deg, rgba(168,85,247,0.95), rgba(8,145,178,0.75))',
                  }}
                />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{day.pickups}</div>
                  <div style={{ ...microCopyStyle, fontSize: 10 }}>{day.date.slice(5)}</div>
                </div>
              </div>
            ))}
          </div>
        </PresenceCard>

        <PresenceCard>
          <PresenceSectionHeading
            title="Streak Timeline"
            subtitle="Your recent runs of under-goal days."
          />
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            {streakRuns.length === 0 ? (
              <p style={emptyCopyStyle}>No under-goal streaks yet.</p>
            ) : (
              streakRuns.map((run) => (
                <div key={run.id} style={{ padding: 16, borderRadius: 22, background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${TOKENS.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{run.days} day streak</div>
                      <div style={microCopyStyle}>{run.startDate} to {run.endDate}</div>
                    </div>
                    <div style={{ color: run.current ? TOKENS.success : TOKENS.textSecondary, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                      {run.current ? 'Current' : 'Past'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </PresenceCard>
      </div>

      <PresenceCard>
        <PresenceSectionHeading
          title="Weekly Summaries"
          subtitle="Weekly scorecards for total minutes, focus sessions, XP, and goal-hit days."
        />
        <div className="pr-week-grid" style={{ marginTop: 18 }}>
          {weeklyCards.map((week) => (
            <div key={week.id} style={{ padding: 18, borderRadius: 24, border: `1.5px solid ${TOKENS.border}`, background: 'rgba(255,255,255,0.04)', display: 'grid', gap: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{week.weekStart} to {week.weekEnd}</div>
                <div style={microCopyStyle}>{week.daysMetGoal} goal days · {week.sessions} completed sessions</div>
              </div>
              <div className="pr-grid-2">
                <PresenceMetricCard label="Usage" value={formatMinutes(week.totalMinutes)} tone={TOKENS.accentLight} detail={`avg ${formatMinutes(week.averageMinutes)}`} />
                <PresenceMetricCard label="XP" value={`${week.xpEarned}`} tone={TOKENS.warning} detail="earned this week" />
              </div>
            </div>
          ))}
        </div>
      </PresenceCard>

      <PresenceCard>
        <PresenceSectionHeading
          title="Recommendations"
          subtitle="Generated from real daily usage and focus-session timing, not canned copy."
        />
        <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
          {data.generatedInsights.map((insight) => (
            <div
              key={insight.type}
              style={{
                padding: 18,
                borderRadius: 24,
                border: `1.5px solid ${
                  insight.severity === 'warning'
                    ? 'rgba(255,184,119,0.28)'
                    : insight.severity === 'positive'
                      ? 'rgba(48,209,88,0.24)'
                      : TOKENS.border
                }`,
                background:
                  insight.severity === 'warning'
                    ? 'rgba(255,184,119,0.08)'
                    : insight.severity === 'positive'
                      ? 'rgba(48,209,88,0.08)'
                      : 'rgba(255,255,255,0.04)',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700 }}>{insight.title}</div>
              <div style={{ color: TOKENS.textSecondary, fontSize: 14, lineHeight: 1.7, marginTop: 8 }}>{insight.body}</div>
            </div>
          ))}
        </div>
      </PresenceCard>
    </div>
  );
}

const microCopyStyle: CSSProperties = {
  color: TOKENS.textTertiary,
  fontSize: 12,
  lineHeight: 1.5,
};

const emptyCopyStyle: CSSProperties = {
  margin: 0,
  color: TOKENS.textSecondary,
  fontSize: 14,
  lineHeight: 1.7,
};
