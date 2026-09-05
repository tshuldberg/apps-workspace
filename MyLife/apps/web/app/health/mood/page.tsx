'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchMoodCalendar, fetchOverallStats, fetchWellnessTimeline } from '../actions';

interface CalendarEntry {
  date: string;
  dominantMood: string | null;
  pleasantness: 'pleasant' | 'unpleasant' | 'neutral' | null;
  color: string;
  hasData: boolean;
}

interface TimelineEntry {
  date: string;
  moodScore: number | null;
  adherenceRate: number | null;
  symptomCount: number;
}

interface Stats {
  overallAdherence30d: number;
  moodEntries30d: number;
  activeMedications: number;
  symptomEntries30d: number;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: 960, margin: '0 auto' },
  backLink: { color: '#10B981', textDecoration: 'none', fontSize: '0.85rem', display: 'inline-block', marginBottom: '0.75rem' },
  title: { fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' },
  subtitle: { color: 'rgba(240,240,245,0.65)', marginBottom: '2rem' },
  section: { marginBottom: '2rem' },
  sectionTitle: { fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'rgba(240,240,245,0.65)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' },
  card: { background: '#12121A', borderRadius: 8, padding: '1rem', border: '1px solid rgba(255,255,255,0.06)' },
  cardTitle: { fontSize: '0.75rem', color: 'rgba(240,240,245,0.65)', textTransform: 'uppercase' as const, marginBottom: '0.5rem' },
  cardValue: { fontSize: '1.5rem', fontWeight: 700, color: '#10B981' },
  monthNav: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' },
  monthBtn: {
    background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6,
    padding: '0.3rem 0.65rem', fontSize: '0.8rem', color: 'rgba(240,240,245,0.65)', cursor: 'pointer',
  },
  monthLabel: { fontWeight: 600, fontSize: '0.95rem', color: '#F0F0F5' },
  calGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' },
  calDayLabel: { fontSize: '0.65rem', color: 'rgba(240,240,245,0.35)', textAlign: 'center' as const, padding: '0.25rem 0' },
  calCell: {
    aspectRatio: '1', borderRadius: 4, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '0.65rem', color: 'rgba(240,240,245,0.65)',
  },
  timelineRow: {
    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.35rem 0',
    borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.8rem',
  },
  timelineDate: { width: 55, color: 'rgba(240,240,245,0.65)', flexShrink: 0 },
  timelineBar: { height: 16, borderRadius: 3, background: '#10B981', transition: 'width 0.2s' },
  timelineAdherence: { width: 50, textAlign: 'right' as const, color: 'rgba(240,240,245,0.65)', flexShrink: 0 },
  empty: { textAlign: 'center' as const, color: 'rgba(240,240,245,0.35)', padding: '2rem', fontSize: '0.9rem' },
};

export default function MoodPage() {
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [calendar, setCalendar] = useState<CalendarEntry[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [cal, tl, st] = await Promise.all([
        fetchMoodCalendar(calYear, calMonth),
        fetchWellnessTimeline(14),
        fetchOverallStats(),
      ]);
      setCalendar(cal as CalendarEntry[]);
      setTimeline(tl as TimelineEntry[]);
      setStats(st as Stats | null);
    } finally {
      setLoading(false);
    }
  }, [calYear, calMonth]);

  useEffect(() => { load(); }, [load]);

  const prevMonth = useCallback(() => {
    if (calMonth === 1) { setCalMonth(12); setCalYear((y) => y - 1); }
    else { setCalMonth((m) => m - 1); }
  }, [calMonth]);

  const nextMonth = useCallback(() => {
    if (calMonth === 12) { setCalMonth(1); setCalYear((y) => y + 1); }
    else { setCalMonth((m) => m + 1); }
  }, [calMonth]);

  if (loading) {
    return <div style={styles.page}><div style={styles.empty}>Loading mood data...</div></div>;
  }

  // Calendar grid
  const firstDayOfWeek = new Date(calYear, calMonth - 1, 1).getDay();
  const calendarCells: (CalendarEntry | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarCells.push(null);
  for (const entry of calendar) calendarCells.push(entry);

  return (
    <div style={styles.page}>
      <Link href="/health" style={styles.backLink}>Back to Health</Link>
      <h1 style={styles.title}>Mood & Insights</h1>
      <p style={styles.subtitle}>Mood journal, wellness timeline, and analytics</p>

      {/* 30-Day Stats */}
      {stats && (
        <div style={styles.grid}>
          <div style={styles.card}>
            <div style={styles.cardTitle}>Mood Entries</div>
            <div style={styles.cardValue}>{stats.moodEntries30d}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.cardTitle}>Adherence</div>
            <div style={styles.cardValue}>{stats.overallAdherence30d}%</div>
          </div>
          <div style={styles.card}>
            <div style={styles.cardTitle}>Active Meds</div>
            <div style={styles.cardValue}>{stats.activeMedications}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.cardTitle}>Symptoms</div>
            <div style={styles.cardValue}>{stats.symptomEntries30d}</div>
          </div>
        </div>
      )}

      {/* Mood Calendar */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Mood Calendar</div>
        <div style={styles.monthNav}>
          <button style={styles.monthBtn} onClick={prevMonth}>Prev</button>
          <span style={styles.monthLabel}>{MONTH_NAMES[calMonth - 1]} {calYear}</span>
          <button style={styles.monthBtn} onClick={nextMonth}>Next</button>
        </div>
        <div style={styles.calGrid}>
          {DAY_LABELS.map((d) => (
            <div key={d} style={styles.calDayLabel}>{d}</div>
          ))}
          {calendarCells.map((cell, i) => (
            <div
              key={i}
              style={{
                ...styles.calCell,
                background: cell?.hasData ? cell.color : '#12121A',
                border: cell ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}
              title={cell ? `${cell.date}: ${cell.dominantMood ?? 'no data'}` : ''}
            >
              {cell ? parseInt(cell.date.slice(8, 10), 10) : ''}
            </div>
          ))}
        </div>
      </div>

      {/* Wellness Timeline */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>14-Day Wellness Timeline</div>
        {timeline.length === 0 ? (
          <div style={styles.empty}>No wellness data yet. Log mood entries and take medications to see trends.</div>
        ) : (
          timeline.map((entry) => (
            <div key={entry.date} style={styles.timelineRow}>
              <div style={styles.timelineDate}>{entry.date.slice(5)}</div>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 3, height: 16, overflow: 'hidden' }}>
                {entry.moodScore != null && (
                  <div
                    style={{ ...styles.timelineBar, width: `${Math.min(entry.moodScore * 20, 100)}%` }}
                    title={`Mood: ${entry.moodScore.toFixed(1)}/5`}
                  />
                )}
              </div>
              <div style={styles.timelineAdherence}>
                {entry.adherenceRate != null ? `${entry.adherenceRate}%` : '--'}
              </div>
            </div>
          ))
        )}
        {timeline.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'rgba(240,240,245,0.35)', marginTop: '0.25rem' }}>
            <span>Green bar = mood score, Right = adherence %</span>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'rgba(240,240,245,0.35)', marginTop: '2rem' }}>
        Mood check-ins are available on mobile devices
      </div>
    </div>
  );
}
