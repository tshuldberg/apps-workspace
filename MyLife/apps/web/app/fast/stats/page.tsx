'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { formatDuration, type StreakCache, type DurationPoint } from '@mylife/fast';
import {
  fetchAverageDuration,
  fetchAdherenceRate,
  fetchStreaks,
  fetchDurationTrend,
  fetchFastCount,
} from '../actions';

const ACCENT = 'var(--accent-fast)';

const GLASS_CARD: CSSProperties = {
  background: 'var(--glass)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  padding: 20,
};

const STAT_CARD: CSSProperties = {
  ...GLASS_CARD,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const LABEL: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  letterSpacing: 0.5,
  textTransform: 'uppercase',
};

const VALUE: CSSProperties = { fontSize: 28, fontWeight: 800, color: 'var(--text)' };

export default function FastStatsPage() {
  const [loading, setLoading] = useState(true);
  const [avgDuration, setAvgDuration] = useState(0);
  const [adherence, setAdherence] = useState(0);
  const [streaks, setStreaks] = useState<StreakCache>({
    currentStreak: 0,
    longestStreak: 0,
    totalFasts: 0,
  });
  const [trend, setTrend] = useState<DurationPoint[]>([]);
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [avg, rate, streakData, trendData, total] = await Promise.all([
        fetchAverageDuration(),
        fetchAdherenceRate(),
        fetchStreaks(),
        fetchDurationTrend(30),
        fetchFastCount(),
      ]);
      setAvgDuration(avg as number);
      setAdherence(rate as number);
      setStreaks(streakData as StreakCache);
      setTrend(trendData as DurationPoint[]);
      setCount(total as number);
    } catch (err) {
      console.error('Failed to load fast stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const maxHours = trend.reduce((m, p) => Math.max(m, p.durationHours), 0) || 1;

  return (
    <div style={{ padding: 'var(--space-xl)', maxWidth: 900 }}>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: ACCENT }}>Stats</h1>
      <p style={{ margin: '4px 0 24px', color: 'var(--text-secondary)', fontSize: 14 }}>
        Your fasting trends and consistency
      </p>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 'var(--space-lg)',
              marginBottom: 'var(--space-xl)',
            }}
          >
            <div style={STAT_CARD}>
              <span style={LABEL}>Avg Duration</span>
              <span style={VALUE}>{avgDuration > 0 ? formatDuration(avgDuration) : '--'}</span>
            </div>
            <div style={STAT_CARD}>
              <span style={LABEL}>Adherence</span>
              <span style={VALUE}>{Math.round(adherence * 100)}%</span>
            </div>
            <div style={STAT_CARD}>
              <span style={LABEL}>Current Streak</span>
              <span style={VALUE}>{streaks.currentStreak}</span>
            </div>
            <div style={STAT_CARD}>
              <span style={LABEL}>Longest Streak</span>
              <span style={VALUE}>{streaks.longestStreak}</span>
            </div>
            <div style={STAT_CARD}>
              <span style={LABEL}>Total Fasts</span>
              <span style={VALUE}>{count}</span>
            </div>
          </div>

          <div style={GLASS_CARD}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              Last 30 Days
            </h2>
            {trend.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
                No completed fasts yet. Your duration trend will appear here.
              </p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 3,
                  height: 140,
                }}
              >
                {trend.map((p) => (
                  <div
                    key={p.date}
                    title={`${p.date}: ${p.durationHours.toFixed(1)}h`}
                    style={{
                      flex: 1,
                      height: `${Math.max(2, (p.durationHours / maxHours) * 100)}%`,
                      background: ACCENT,
                      borderRadius: 2,
                      minWidth: 4,
                      opacity: p.durationHours > 0 ? 1 : 0.25,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
