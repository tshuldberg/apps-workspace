'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  fetchEntries,
  fetchEntryCount,
  fetchActivityCorrelations,
  fetchDailyAverages,
  fetchLastNightSleepContext,
  fetchSleepMoodCorrelation,
  fetchTopEmotions,
  fetchEmotionTagsForEntry,
  fetchActivitiesForEntry,
} from '../actions';
import {
  generateInsights,
  type MoodInsight,
  type InsightType,
  type MoodEntry,
  type EntryData,
  type LastNightSleepSummary,
} from '@mylife/mood';
import type { SleepMoodCorrelation } from '@mylife/sleep';

const ACCENT = 'var(--accent-mood)';
const ACCENT_DIM = 'var(--accent-mood-dim, rgba(251,146,60,0.15))';
const ACCENT_BORDER = 'var(--accent-mood-border, rgba(251,146,60,0.25))';
const SURFACE_ELEVATED = 'var(--surface-elevated, #2A292F)';
const BORDER = 'var(--border)';
const TEXT_SEC = 'var(--text-secondary)';
const GLASS = 'var(--glass)';
const MIN_ENTRIES = 14;

// ── Insight card metadata ────────────────────────────────────────────

const INSIGHT_META: Record<InsightType, { icon: string; category: string; color: string }> = {
  day_of_week_pattern: { icon: '📊', category: 'WEEKLY PEAK', color: '#A78BFA' },
  time_of_day_pattern: { icon: '🌅', category: 'CIRCADIAN RHYTHM', color: '#F59E0B' },
  activity_impact: { icon: '🏃', category: 'BODY-MIND CONNECTION', color: '#34D399' },
  emotion_cluster: { icon: '🎯', category: 'EMOTION MAPPING', color: '#F472B6' },
  streak_impact: { icon: '🔥', category: 'CONSISTENCY', color: '#FB923C' },
  trend_direction: { icon: '📈', category: 'GROWTH', color: '#60A5FA' },
  volatility_alert: { icon: '⚖️', category: 'EQUILIBRIUM', color: '#FBBF24' },
  best_worst_day: { icon: '⭐', category: 'MILESTONE', color: '#C084FC' },
};

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  info: { bg: 'rgba(255,255,255,0.06)', text: 'var(--text-secondary)' },
  notable: { bg: 'rgba(255,214,10,0.15)', text: '#FFD60A' },
  actionable: { bg: 'rgba(48,209,88,0.15)', text: 'var(--success)' },
};

// ── Date range presets ───────────────────────────────────────────────

type DateRange = '7d' | '14d' | '30d' | '90d';

function getDateRange(range: DateRange): { start: string; end: string } {
  const end = new Date().toISOString().slice(0, 10);
  const d = new Date();
  const days = range === '7d' ? 7 : range === '14d' ? 14 : range === '30d' ? 30 : 90;
  d.setDate(d.getDate() - days);
  return { start: d.toISOString().slice(0, 10), end };
}

export default function InsightsPage() {
  const [entryCount, setEntryCount] = useState(0);
  const [insights, setInsights] = useState<MoodInsight[]>([]);
  const [dailyAvgs, setDailyAvgs] = useState<{ date: string; average: number; count: number }[]>([]);
  const [topEmotions, setTopEmotions] = useState<{ emotion: string; count: number }[]>([]);
  const [sleepMoodCorrelation, setSleepMoodCorrelation] = useState<SleepMoodCorrelation | null>(null);
  const [lastNightSleep, setLastNightSleep] = useState<LastNightSleepSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { start, end } = getDateRange(dateRange);
      const [count, sleepCorrelation, sleepContext] = await Promise.all([
        fetchEntryCount(),
        fetchSleepMoodCorrelation(start, end),
        fetchLastNightSleepContext(end),
      ]);
      setEntryCount(count);
      setSleepMoodCorrelation(sleepCorrelation);
      setLastNightSleep(sleepContext);

      if (count >= MIN_ENTRIES) {
        const [entries, correlations, avgs, emotions] = await Promise.all([
          fetchEntries({ startDate: start, endDate: end, limit: 500, offset: 0 }),
          fetchActivityCorrelations(dateRange === '7d' ? 7 : dateRange === '14d' ? 14 : dateRange === '30d' ? 30 : 90),
          fetchDailyAverages(start, end),
          fetchTopEmotions(start, end, 10),
        ]);

        setDailyAvgs(avgs);
        setTopEmotions(emotions);

        // Build EntryData for generateInsights
        // We need emotion tags and activity names per entry
        const entryData: EntryData[] = [];
        for (const e of entries) {
          let emotionNames: string[] = [];
          let activityNames: string[] = [];
          try {
            const tags = await fetchEmotionTagsForEntry(e.id);
            emotionNames = tags.map((t) => t.emotion);
          } catch { /* skip */ }
          try {
            const acts = await fetchActivitiesForEntry(e.id);
            activityNames = acts.map((a: { activityId: string; activityName?: string }) => a.activityName ?? a.activityId);
          } catch { /* skip */ }
          entryData.push({
            score: e.score,
            date: e.date,
            loggedAt: e.loggedAt,
            activityNames,
            emotions: emotionNames,
          });
        }

        const scores = entries.map((e: MoodEntry) => e.score);
        const overallAvg = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;

        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const twentyEightDaysAgo = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);
        const thisWeek = entries.filter((e: MoodEntry) => e.date >= sevenDaysAgo);
        const fourWeek = entries.filter((e: MoodEntry) => e.date >= twentyEightDaysAgo);
        const thisWeekAvg = thisWeek.length > 0 ? thisWeek.reduce((s: number, e: MoodEntry) => s + e.score, 0) / thisWeek.length : 0;
        const fourWeekAvg = fourWeek.length > 0 ? fourWeek.reduce((s: number, e: MoodEntry) => s + e.score, 0) / fourWeek.length : 0;

        const generated = generateInsights({
          entries: entryData,
          activityCorrelations: correlations.map((c) => ({
            activityName: c.activityName,
            averageScore: c.averageScore,
            entryCount: c.entryCount,
            pearsonR: c.pearsonR,
          })),
          overallAvg,
          thisWeekAvg,
          fourWeekAvg,
          thisWeekCount: thisWeek.length,
          dailyAverages: avgs.map((d) => d.average),
          streakDayScores: [],
          nonStreakDayScores: [],
        });

        setInsights(generated);
      } else {
        setInsights([]);
        setDailyAvgs([]);
        setTopEmotions([]);
      }
    } catch {
      setError('Failed to analyze patterns');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { void load(); }, [load]);

  // ── Day-of-week bar chart data ─────────────────────────────────────
  const dayOfWeekData = useMemo(() => {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const sums = [0, 0, 0, 0, 0, 0, 0];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const d of dailyAvgs) {
      const dow = new Date(d.date + 'T12:00:00').getDay();
      const idx = dow === 0 ? 6 : dow - 1;
      sums[idx] += d.average;
      counts[idx]++;
    }
    const avgs = sums.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0));
    const max = Math.max(...avgs, 1);
    return labels.map((label, i) => ({
      label,
      value: avgs[i],
      height: (avgs[i] / max) * 100,
      isHighest: avgs[i] === Math.max(...avgs) && avgs[i] > 0,
    }));
  }, [dailyAvgs]);

  // ── Export handler ─────────────────────────────────────────────────
  const handleExport = () => {
    const text = insights.map((i) => `## ${i.title}\n${i.body}\nMetric: ${i.metric}\nSeverity: ${i.severity}\n`).join('\n');
    const blob = new Blob([`# Mood Insights Report\nGenerated: ${new Date().toLocaleDateString()}\nRange: ${dateRange}\n\n${text}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mood-insights-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <InsightsSkeleton />;

  if (error) {
    return (
      <div style={{ padding: '48px 32px', textAlign: 'center' }}>
        <p style={{ margin: '0 0 12px', fontSize: 15 }}>{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: ACCENT, color: '#0A0A0F', fontWeight: 700, cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (entryCount < MIN_ENTRIES) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 32px', gap: 16 }}>
        <span style={{ fontSize: 64 }}>🔮</span>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Building Your Intelligence</h2>
        <p style={{ margin: 0, color: TEXT_SEC, fontSize: 14, textAlign: 'center', maxWidth: 440, lineHeight: 1.6 }}>
          Log at least {MIN_ENTRIES} mood entries to start seeing AI-powered insights about your emotional patterns. All analysis happens on your device.
        </p>
        <div style={{ width: '60%', maxWidth: 300, height: 6, borderRadius: 3, background: 'var(--glass-strong)', overflow: 'hidden', marginTop: 8 }}>
          <div style={{ height: '100%', borderRadius: 3, background: ACCENT, width: `${Math.min(100, (entryCount / MIN_ENTRIES) * 100)}%`, transition: 'width 300ms ease' }} />
        </div>
        <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC }}>{entryCount} of {MIN_ENTRIES} entries</p>
        <SleepBridgeCards correlation={sleepMoodCorrelation} lastNightSleep={lastNightSleep} />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* ── Header + Controls ─────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: ACCENT }}>
            Personal Analytics
          </p>
          <h1 style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 700 }}>Mood Intelligence</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Date range filter */}
          {(['7d', '14d', '30d', '90d'] as DateRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDateRange(r)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: `1px solid ${dateRange === r ? ACCENT : BORDER}`,
                background: dateRange === r ? ACCENT_DIM : 'transparent',
                color: dateRange === r ? ACCENT : TEXT_SEC,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: 0.5,
              }}
            >
              {r.replace('d', 'D')}
            </button>
          ))}
          {/* Export */}
          <button
            type="button"
            onClick={handleExport}
            disabled={insights.length === 0}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              background: GLASS,
              color: insights.length > 0 ? 'var(--text)' : TEXT_SEC,
              fontSize: 12,
              fontWeight: 700,
              cursor: insights.length > 0 ? 'pointer' : 'not-allowed',
              letterSpacing: 0.5,
            }}
          >
            Export
          </button>
        </div>
      </div>

      <SleepBridgeCards correlation={sleepMoodCorrelation} lastNightSleep={lastNightSleep} />

      {/* ── Insight Cards Grid ────────────────────────────────────── */}
      {insights.length === 0 ? (
        <div style={{ padding: '48px 32px', textAlign: 'center' }}>
          <span style={{ fontSize: 48 }}>🔍</span>
          <h2 style={{ margin: '12px 0 8px', fontSize: 20, fontWeight: 700 }}>No patterns detected</h2>
          <p style={{ margin: 0, color: TEXT_SEC, fontSize: 14 }}>Try a wider date range or log more entries.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}>
          {insights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              expanded={expandedId === insight.id}
              onToggle={() => setExpandedId(expandedId === insight.id ? null : insight.id)}
              dayOfWeekData={dayOfWeekData}
              topEmotions={topEmotions}
              dailyAvgs={dailyAvgs}
            />
          ))}
        </div>
      )}

      {/* ── Expanded Detail Modal ─────────────────────────────────── */}
      {expandedId && (
        <InsightDetail
          insight={insights.find((i) => i.id === expandedId)!}
          onClose={() => setExpandedId(null)}
          dayOfWeekData={dayOfWeekData}
          topEmotions={topEmotions}
          dailyAvgs={dailyAvgs}
        />
      )}

      {/* ── Footer ────────────────────────────────────────────────── */}
      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: 1, color: TEXT_SEC, textAlign: 'center', textTransform: 'uppercase' }}>
        Insights generated from your data. More entries = better insights.
      </p>
    </div>
  );
}

function SleepBridgeCards({
  correlation,
  lastNightSleep,
}: {
  correlation: SleepMoodCorrelation | null;
  lastNightSleep: LastNightSleepSummary | null;
}) {
  const reportableCorrelation =
    correlation?.status === 'reportable' ? correlation : null;
  if (!reportableCorrelation && !lastNightSleep) {
    return null;
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: 16,
      width: '100%',
    }}>
      {reportableCorrelation ? (
        <div style={{
          padding: 22,
          borderRadius: 20,
          border: `1px solid ${ACCENT_BORDER}`,
          background: SURFACE_ELEVATED,
          display: 'grid',
          gap: 10,
        }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: ACCENT }}>
            Sleep and Mood
          </p>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Sleep quality is part of your mood pattern</h3>
          <p style={{ margin: 0, fontSize: 14, color: TEXT_SEC, lineHeight: 1.6 }}>
            {reportableCorrelation.insight}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: TEXT_SEC }}>
            r={reportableCorrelation.correlation.toFixed(2)} · {reportableCorrelation.sampleSize} paired days
          </p>
        </div>
      ) : null}
      {lastNightSleep ? (
        <div style={{
          padding: 22,
          borderRadius: 20,
          border: `1px solid ${BORDER}`,
          background: GLASS,
          display: 'grid',
          gap: 10,
        }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
            Last Night
          </p>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{lastNightSleep.context}</h3>
          <p style={{ margin: 0, fontSize: 14, color: TEXT_SEC, lineHeight: 1.6 }}>
            Use this as context when reading today&apos;s mood entries.
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ── Insight Card ────────────────────────────────────────────────────

interface InsightCardProps {
  insight: MoodInsight;
  expanded: boolean;
  onToggle: () => void;
  dayOfWeekData: { label: string; value: number; height: number; isHighest: boolean }[];
  topEmotions: { emotion: string; count: number }[];
  dailyAvgs: { date: string; average: number; count: number }[];
}

function InsightCard({ insight, expanded, onToggle, dayOfWeekData, topEmotions, dailyAvgs }: InsightCardProps) {
  const meta = INSIGHT_META[insight.type];
  const sev = SEVERITY_COLORS[insight.severity] ?? SEVERITY_COLORS.info;

  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        all: 'unset',
        boxSizing: 'border-box',
        cursor: 'pointer',
        padding: 24,
        borderRadius: 20,
        border: `1px solid ${expanded ? meta.color + '40' : BORDER}`,
        background: SURFACE_ELEVATED,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'border-color 200ms ease, transform 100ms ease',
      }}
    >
      {/* Category + severity */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{meta.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: meta.color }}>
            {meta.category}
          </span>
        </div>
        <span style={{
          padding: '2px 8px',
          borderRadius: 4,
          background: sev.bg,
          color: sev.text,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}>
          {insight.severity}
        </span>
      </div>

      {/* Title */}
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>
        {insight.title}
      </h3>

      {/* Mini chart based on type */}
      <MiniVisualization type={insight.type} dayOfWeekData={dayOfWeekData} topEmotions={topEmotions} dailyAvgs={dailyAvgs} />

      {/* Metric */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 24, fontWeight: 800, color: meta.color }}>{insight.metric}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: ACCENT, letterSpacing: 0.5 }}>
          Explore &rarr;
        </span>
      </div>
    </button>
  );
}

// ── Mini Visualization ──────────────────────────────────────────────

function MiniVisualization({
  type,
  dayOfWeekData,
  topEmotions,
  dailyAvgs,
}: {
  type: InsightType;
  dayOfWeekData: { label: string; value: number; height: number; isHighest: boolean }[];
  topEmotions: { emotion: string; count: number }[];
  dailyAvgs: { date: string; average: number; count: number }[];
}) {
  if (type === 'day_of_week_pattern') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48 }}>
        {dayOfWeekData.map((bar, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{
              width: '100%',
              height: `${Math.max(bar.height * 0.48, 3)}px`,
              borderRadius: 3,
              background: bar.isHighest ? '#A78BFA' : 'rgba(255,255,255,0.08)',
              transition: 'height 300ms ease',
            }} />
            <span style={{ fontSize: 9, fontWeight: 600, color: bar.isHighest ? '#A78BFA' : TEXT_SEC }}>{bar.label.charAt(0)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'emotion_cluster') {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {topEmotions.slice(0, 4).map((e) => (
          <span key={e.emotion} style={{
            padding: '4px 10px',
            borderRadius: 999,
            background: 'rgba(244,114,182,0.15)',
            border: '1px solid rgba(244,114,182,0.25)',
            fontSize: 11,
            fontWeight: 600,
            color: '#F472B6',
          }}>
            {e.emotion.charAt(0).toUpperCase() + e.emotion.slice(1)}
          </span>
        ))}
      </div>
    );
  }

  if (type === 'trend_direction') {
    // Mini sparkline from daily averages
    const recent = dailyAvgs.slice(-14);
    if (recent.length < 2) return null;
    const max = Math.max(...recent.map((d) => d.average), 1);
    const min = Math.min(...recent.map((d) => d.average), 0);
    const range = max - min || 1;
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40 }}>
        {recent.map((d, i) => (
          <div key={i} style={{
            flex: 1,
            height: `${((d.average - min) / range) * 100}%`,
            minHeight: 3,
            borderRadius: 2,
            background: i >= recent.length - 7 ? '#60A5FA' : 'rgba(96,165,250,0.3)',
          }} />
        ))}
      </div>
    );
  }

  if (type === 'volatility_alert') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            borderRadius: 2,
            background: 'linear-gradient(90deg, #FBBF24, #34D399)',
            width: '60%',
          }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: TEXT_SEC }}>Stability</span>
      </div>
    );
  }

  if (type === 'time_of_day_pattern') {
    const periods = ['Morning', 'Afternoon', 'Evening', 'Night'];
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        {periods.map((p, i) => (
          <div key={p} style={{
            flex: 1,
            padding: '4px 0',
            borderRadius: 6,
            background: i === 0 ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.04)',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: i === 0 ? '#F59E0B' : TEXT_SEC }}>{p}</span>
          </div>
        ))}
      </div>
    );
  }

  // Default: metric display
  return null;
}

// ── Expanded Detail Panel ───────────────────────────────────────────

function InsightDetail({
  insight,
  onClose,
  dayOfWeekData,
  topEmotions,
  dailyAvgs,
}: {
  insight: MoodInsight;
  onClose: () => void;
  dayOfWeekData: { label: string; value: number; height: number; isHighest: boolean }[];
  topEmotions: { emotion: string; count: number }[];
  dailyAvgs: { date: string; average: number; count: number }[];
}) {
  const meta = INSIGHT_META[insight.type];

  return (
    <div style={{
      padding: 32,
      borderRadius: 24,
      border: `1px solid ${meta.color}40`,
      background: SURFACE_ELEVATED,
      display: 'grid',
      gap: 24,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>{meta.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: meta.color }}>
              {meta.category}
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{insight.title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            all: 'unset',
            cursor: 'pointer',
            width: 36,
            height: 36,
            borderRadius: 10,
            background: GLASS,
            border: `1px solid ${BORDER}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            color: TEXT_SEC,
          }}
        >
          &times;
        </button>
      </div>

      {/* Body */}
      <p style={{ margin: 0, fontSize: 15, color: TEXT_SEC, lineHeight: 1.6 }}>
        {insight.body}
      </p>

      {/* Large chart */}
      <div style={{ padding: 24, borderRadius: 16, background: GLASS, border: `1px solid ${BORDER}` }}>
        <LargeVisualization
          type={insight.type}
          dayOfWeekData={dayOfWeekData}
          topEmotions={topEmotions}
          dailyAvgs={dailyAvgs}
          metric={insight.metric}
        />
      </div>

      {/* Metric + generated timestamp */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
            Key Metric
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 36, fontWeight: 800, color: meta.color }}>
            {insight.metric}
          </p>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: TEXT_SEC }}>
          Generated {new Date(insight.generatedAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

// ── Large Visualization ─────────────────────────────────────────────

function LargeVisualization({
  type,
  dayOfWeekData,
  topEmotions,
  dailyAvgs,
  metric,
}: {
  type: InsightType;
  dayOfWeekData: { label: string; value: number; height: number; isHighest: boolean }[];
  topEmotions: { emotion: string; count: number }[];
  dailyAvgs: { date: string; average: number; count: number }[];
  metric: string;
}) {
  if (type === 'day_of_week_pattern') {
    return (
      <div>
        <p style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
          Average Mood by Day of Week
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160 }}>
          {dayOfWeekData.map((bar, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: bar.isHighest ? '#A78BFA' : TEXT_SEC }}>
                {bar.value > 0 ? bar.value.toFixed(1) : ''}
              </span>
              <div style={{
                width: '100%',
                maxWidth: 48,
                height: `${Math.max(bar.height, 4)}%`,
                borderRadius: 8,
                background: bar.isHighest
                  ? 'linear-gradient(180deg, #A78BFA 0%, rgba(167,139,250,0.3) 100%)'
                  : 'rgba(255,255,255,0.08)',
                transition: 'height 300ms ease',
              }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: bar.isHighest ? '#A78BFA' : TEXT_SEC }}>
                {bar.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'emotion_cluster') {
    const maxCount = Math.max(...topEmotions.map((e) => e.count), 1);
    return (
      <div>
        <p style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
          Top Emotions Distribution
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          {topEmotions.slice(0, 8).map((e) => (
            <div key={e.emotion} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 80, fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{e.emotion}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  borderRadius: 4,
                  background: '#F472B6',
                  width: `${(e.count / maxCount) * 100}%`,
                  transition: 'width 300ms ease',
                }} />
              </div>
              <span style={{ width: 32, fontSize: 12, fontWeight: 600, color: TEXT_SEC, textAlign: 'right' }}>{e.count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'trend_direction') {
    const recent = dailyAvgs.slice(-30);
    if (recent.length < 2) return <p style={{ color: TEXT_SEC }}>Not enough data</p>;
    const max = Math.max(...recent.map((d) => d.average), 1);
    const min = Math.min(...recent.map((d) => d.average), 0);
    const range = max - min || 1;
    return (
      <div>
        <p style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
          Daily Mood Trend
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
          {recent.map((d, i) => {
            const isRecent = i >= recent.length - 7;
            return (
              <div
                key={d.date}
                title={`${d.date}: ${d.average.toFixed(1)}`}
                style={{
                  flex: 1,
                  height: `${((d.average - min) / range) * 100}%`,
                  minHeight: 4,
                  borderRadius: 3,
                  background: isRecent ? '#60A5FA' : 'rgba(96,165,250,0.3)',
                  transition: 'height 300ms ease',
                }}
              />
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={{ fontSize: 11, color: TEXT_SEC }}>{recent[0]?.date}</span>
          <span style={{ fontSize: 11, color: TEXT_SEC }}>{recent[recent.length - 1]?.date}</span>
        </div>
      </div>
    );
  }

  if (type === 'activity_impact') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 48, fontWeight: 800, color: '#34D399' }}>{metric}</p>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: TEXT_SEC }}>points above your average</p>
        </div>
      </div>
    );
  }

  if (type === 'volatility_alert') {
    const scores = dailyAvgs.map((d) => d.average);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const variance = scores.length > 0 ? scores.reduce((s, v) => s + (v - avg) ** 2, 0) / scores.length : 0;
    const stdDev = Math.sqrt(variance);
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0', gap: 40 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 36, fontWeight: 800, color: '#FBBF24' }}>{avg.toFixed(1)}</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 600, color: TEXT_SEC, letterSpacing: 1, textTransform: 'uppercase' }}>Average</p>
        </div>
        <div style={{ width: 1, height: 48, background: BORDER }} />
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 36, fontWeight: 800, color: TEXT_SEC }}>{stdDev.toFixed(1)}</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 600, color: TEXT_SEC, letterSpacing: 1, textTransform: 'uppercase' }}>Std Dev</p>
        </div>
      </div>
    );
  }

  // Default: large metric display
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
      <p style={{ margin: 0, fontSize: 56, fontWeight: 800, color: ACCENT }}>{metric}</p>
    </div>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────

function InsightsSkeleton() {
  const pulse = { background: 'rgba(255,255,255,0.06)', borderRadius: 20, animation: 'pulse 1.5s ease-in-out infinite' };
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ ...pulse, width: 200, height: 48 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3, 4].map((i) => <div key={i} style={{ ...pulse, width: 48, height: 32 }} />)}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} style={{ ...pulse, height: 200 }} />)}
      </div>
    </div>
  );
}
