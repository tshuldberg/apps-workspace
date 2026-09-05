'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  fetchAreas,
  fetchDayOfWeekStats,
  fetchHabits,
  fetchHeatmapData,
  fetchOverallStats,
  fetchTimeOfDayStats,
  fetchYearlyStats,
} from '../actions';
import {
  EmptyState,
  GlassPanel,
  HeatmapCalendarGrid,
  MetricTile,
  PageIntro,
  PillButton,
  SectionHeading,
  resolveAreaTone,
} from '../ui';
import { HB_ACCENT_LIGHT, HB_AREAS, HB_TEXT_SECONDARY, withAlpha } from '@mylife/habits';

type Habit = {
  id: string;
  name: string;
  color: string | null;
  areaId: string | null;
};

type Area = {
  id: string;
  name: string;
  color: string | null;
};

type OverallStats = {
  totalHabits: number;
  totalCompletions: number;
  averageCompletionRate: number;
  bestHabit: { name: string; completionRate: number } | null;
};

type YearlyStats = {
  completionRate: number;
  monthlyRates: Record<string, number>;
};

type Period = '30d' | '90d' | '1y';

const PERIOD_OPTIONS: Period[] = ['30d', '90d', '1y'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS: Record<string, string> = { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' };

export default function HabitsStatsPage() {
  const [period, setPeriod] = useState<Period>('90d');
  const [overall, setOverall] = useState<OverallStats | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [monthlyRates, setMonthlyRates] = useState<number[]>(Array.from({ length: 12 }, () => 0));
  const [dayStats, setDayStats] = useState<Record<string, number>>({});
  const [timeStats, setTimeStats] = useState<Record<string, number>>({});
  const [heatmap, setHeatmap] = useState<Array<{ date: string; count: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const [overallStats, habitRows, areaRows] = await Promise.all([
          fetchOverallStats(),
          fetchHabits({ isArchived: false }),
          fetchAreas(),
        ]);
        const nextHabits = (habitRows as Habit[]) ?? [];
        setOverall((overallStats as OverallStats) ?? null);
        setHabits(nextHabits);
        setAreas((areaRows as Area[]) ?? []);

        const yearlyRows = await Promise.all(nextHabits.map((habit) => fetchYearlyStats(habit.id) as Promise<YearlyStats>));
        const nextMonthlyRates = Array.from({ length: 12 }, (_, index) => {
          const key = String(index + 1).padStart(2, '0');
          const values = yearlyRows.map((entry) => entry?.monthlyRates?.[key] ?? 0);
          return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
        });
        setMonthlyRates(nextMonthlyRates);

        const dayEntries = await Promise.all(nextHabits.map((habit) => fetchDayOfWeekStats(habit.id) as Promise<Record<string, number>>));
        const timeEntries = await Promise.all(nextHabits.map((habit) => fetchTimeOfDayStats(habit.id) as Promise<Record<string, number>>));

        const aggregatedDays: Record<string, number> = {};
        for (const entry of dayEntries) {
          for (const [key, value] of Object.entries(entry ?? {})) {
            aggregatedDays[key] = (aggregatedDays[key] ?? 0) + value;
          }
        }

        const aggregatedTimes: Record<string, number> = {};
        for (const entry of timeEntries) {
          for (const [key, value] of Object.entries(entry ?? {})) {
            aggregatedTimes[key] = (aggregatedTimes[key] ?? 0) + value;
          }
        }

        setDayStats(aggregatedDays);
        setTimeStats(aggregatedTimes);

        if (nextHabits[0]) {
          setHeatmap((await fetchHeatmapData(nextHabits[0].id)) as Array<{ date: string; count: number }>);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const areaBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const habit of habits) {
      const area = areas.find((entry) => entry.id === habit.areaId);
      const key = area?.name ?? 'General';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, value]) => ({
      label,
      value,
      color: resolveAreaTone(label, areas.find((area) => area.name === label)?.color ?? null),
    }));
  }, [areas, habits]);

  const monthlyChart = useMemo(() => {
    const length = period === '30d' ? 3 : period === '90d' ? 6 : 12;
    return MONTHS.slice(12 - length).map((label, index) => ({
      label,
      rate: Math.round((monthlyRates[12 - length + index] ?? 0) * 100),
    }));
  }, [monthlyRates, period]);

  const dayChart = Object.entries(dayStats).map(([key, value]) => ({ label: DAY_LABELS[key] ?? key, rate: Math.round((value / Math.max(habits.length, 1)) * 100) }));
  const timeChart = Object.entries(timeStats).map(([key, value]) => ({ label: key, rate: Math.round((value / Math.max(habits.length, 1)) * 100) }));

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageIntro
        eyebrow="Stats"
        title="Completion trends, streak shape, and area balance."
        description="Use the analytics board to see which days and times are strongest, inspect recent intensity in the heatmap, and keep life areas balanced instead of drifting into one-track routines."
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {PERIOD_OPTIONS.map((option) => (
          <PillButton active={period === option} key={option} onClick={() => setPeriod(option)}>
            {option}
          </PillButton>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
        <MetricTile detail="currently active in the system" label="Total habits" tone={HB_ACCENT_LIGHT} value={loading ? '...' : String(overall?.totalHabits ?? 0)} />
        <MetricTile detail="logged across every completion surface" label="Total completions" tone="#8BCFF0" value={loading ? '...' : String(overall?.totalCompletions ?? 0)} />
        <MetricTile detail="average across all active habits" label="Average rate" tone="#84CC16" value={loading ? '...' : `${Math.round((overall?.averageCompletionRate ?? 0) * 100)}%`} />
        <MetricTile detail="best performer this cycle" label="Best habit" tone={HB_AREAS.social} value={loading ? '...' : overall?.bestHabit?.name ?? 'None'} />
      </div>

      {error ? <EmptyState body={error} title="Analytics unavailable" /> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 20 }}>
        <GlassPanel level={2} style={{ padding: 24, display: 'grid', gap: 18 }}>
          <SectionHeading detail="Latest activity sample, rendered as a CSS grid." title="Heatmap pulse" />
          {loading ? <div style={{ height: 220, borderRadius: 24, background: withAlpha('#ffffff', 0.04) }} /> : <HeatmapCalendarGrid data={heatmap} weeks={period === '30d' ? 5 : period === '90d' ? 13 : 20} />}
        </GlassPanel>

        <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 18 }}>
          <SectionHeading detail="Current habit distribution by area." title="Area balance" />
          {areaBreakdown.length === 0 ? (
            <EmptyState body="Assign areas to active habits to populate this chart." title="No area data yet" />
          ) : (
            <>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={areaBreakdown} dataKey="value" innerRadius={60} outerRadius={90} paddingAngle={4}>
                      {areaBreakdown.map((entry) => (
                        <Cell fill={entry.color} key={entry.label} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 16, border: 'none', background: '#15151b', color: 'white' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {areaBreakdown.map((entry) => (
                  <div key={entry.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 999, background: entry.color }} />
                      <span>{entry.label}</span>
                    </div>
                    <span style={{ color: HB_TEXT_SECONDARY }}>{entry.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </GlassPanel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 18 }}>
          <SectionHeading detail="Average completion trend over the selected period." title="Monthly completion trend" />
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={monthlyChart}>
                <CartesianGrid stroke={withAlpha('#ffffff', 0.08)} vertical={false} />
                <XAxis dataKey="label" stroke={HB_TEXT_SECONDARY} />
                <YAxis stroke={HB_TEXT_SECONDARY} width={36} />
                <Tooltip contentStyle={{ borderRadius: 16, border: 'none', background: '#15151b', color: 'white' }} />
                <Line dataKey="rate" stroke={HB_ACCENT_LIGHT} strokeLinecap="round" strokeWidth={4} type="monotone" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>

        <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 18 }}>
          <SectionHeading detail="Which days are currently most reliable." title="Weekday strength" />
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={dayChart}>
                <CartesianGrid stroke={withAlpha('#ffffff', 0.08)} vertical={false} />
                <XAxis dataKey="label" stroke={HB_TEXT_SECONDARY} />
                <YAxis stroke={HB_TEXT_SECONDARY} width={36} />
                <Tooltip contentStyle={{ borderRadius: 16, border: 'none', background: '#15151b', color: 'white' }} />
                <Bar dataKey="rate" fill={HB_ACCENT_LIGHT} radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>
      </div>

      <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 18 }}>
        <SectionHeading detail="Average completion quality by time-of-day bucket." title="Time-of-day distribution" />
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={timeChart}>
              <CartesianGrid stroke={withAlpha('#ffffff', 0.08)} vertical={false} />
              <XAxis dataKey="label" stroke={HB_TEXT_SECONDARY} />
              <YAxis stroke={HB_TEXT_SECONDARY} width={36} />
              <Tooltip contentStyle={{ borderRadius: 16, border: 'none', background: '#15151b', color: 'white' }} />
              <Bar dataKey="rate" radius={[12, 12, 0, 0]}>
                {timeChart.map((entry, index) => (
                  <Cell fill={index % 2 === 0 ? HB_ACCENT_LIGHT : '#8BCFF0'} key={entry.label} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassPanel>
    </div>
  );
}
