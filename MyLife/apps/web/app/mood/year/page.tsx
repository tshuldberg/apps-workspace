'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchDailyAverages } from '../actions';
import { scoreToPixelColor } from '@mylife/mood';

const ACCENT = 'var(--accent-mood)';
const ACCENT_DIM = 'var(--accent-mood-dim, rgba(251,146,60,0.15))';
const ACCENT_BORDER = 'var(--accent-mood-border, rgba(251,146,60,0.25))';
const SURFACE_ELEVATED = 'var(--surface-elevated, #2A292F)';
const BORDER = 'var(--border)';
const TEXT_SEC = 'var(--text-secondary)';
const GLASS = 'var(--glass)';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const LEGEND_ITEMS = [
  { label: 'Awful', range: '1-2', color: '#DC2626' },
  { label: 'Bad', range: '3-4', color: '#F97316' },
  { label: 'Neutral', range: '5-6', color: '#FBBF24' },
  { label: 'Good', range: '7-8', color: '#4ADE80' },
  { label: 'Great', range: '9-10', color: '#22D3EE' },
  { label: 'No Entry', range: '', color: 'rgba(255,255,255,0.06)' },
];

type ScoreFilter = 'all' | 'low' | 'mid' | 'high';

interface DailyAverage { date: string; average: number; count: number }

function isLeapYear(y: number) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function daysInMonth(month: number, year: number) { if (month === 1 && isLeapYear(year)) return 29; return DAYS_IN_MONTH[month]; }

export default function MoodYearPage() {
  const [days, setDays] = useState<DailyAverage[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<{ date: string; score: number; x: number; y: number } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchDailyAverages(`${year}-01-01`, `${year}-12-31`);
      setDays(result);
    } catch {
      setDays([]);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { void load(); }, [load]);

  const averageMap = useMemo(() => new Map(days.map((item) => [item.date, item])), [days]);

  // ── Stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const scores = days.map((d) => d.average);
    const totalEntries = scores.length;
    const avgMood = totalEntries > 0 ? scores.reduce((a, b) => a + b, 0) / totalEntries : 0;

    const monthSums: number[] = Array(12).fill(0);
    const monthCounts: number[] = Array(12).fill(0);
    for (const d of days) {
      const m = parseInt(d.date.slice(5, 7), 10) - 1;
      monthSums[m] += d.average;
      monthCounts[m]++;
    }
    let bestMonthIdx = 0;
    let bestMonthAvg = 0;
    for (let i = 0; i < 12; i++) {
      const avg = monthCounts[i] > 0 ? monthSums[i] / monthCounts[i] : 0;
      if (avg > bestMonthAvg) { bestMonthAvg = avg; bestMonthIdx = i; }
    }

    // Current streak
    const today = new Date().toISOString().slice(0, 10);
    let streak = 0;
    const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date));
    const check = new Date(today + 'T12:00:00');
    for (const entry of sorted) {
      const checkStr = check.toISOString().slice(0, 10);
      if (entry.date === checkStr) { streak++; check.setDate(check.getDate() - 1); }
      else if (entry.date < checkStr) break;
    }

    // Highest single day
    let highestDay = { date: '', score: 0 };
    for (const d of days) { if (d.average > highestDay.score) highestDay = { date: d.date, score: d.average }; }

    return {
      avgMood: avgMood.toFixed(1),
      totalEntries,
      bestMonth: MONTH_LABELS[bestMonthIdx],
      bestMonthAvg: bestMonthAvg.toFixed(1),
      streak,
      highestDay,
    };
  }, [days]);

  // ── Grid data (month x day) ───────────────────────────────────────
  const grid = useMemo(() => {
    const months: Array<Array<{ date: string; score: number | null; count: number }>> = [];
    for (let m = 0; m < 12; m++) {
      const numDays = daysInMonth(m, year);
      const row: Array<{ date: string; score: number | null; count: number }> = [];
      for (let d = 1; d <= numDays; d++) {
        const mm = String(m + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        const date = `${year}-${mm}-${dd}`;
        const entry = averageMap.get(date);
        row.push({ date, score: entry?.average ?? null, count: entry?.count ?? 0 });
      }
      while (row.length < 31) row.push({ date: '', score: null, count: 0 });
      months.push(row);
    }
    return months;
  }, [averageMap, year]);

  // ── Filter logic ──────────────────────────────────────────────────
  const passesFilter = (score: number | null): boolean => {
    if (scoreFilter === 'all') return true;
    if (score == null) return false;
    if (scoreFilter === 'low') return score <= 4;
    if (scoreFilter === 'mid') return score >= 5 && score <= 7;
    return score >= 8;
  };

  // ── Selected day detail ───────────────────────────────────────────
  const selectedEntry = selectedDate ? averageMap.get(selectedDate) : null;

  const pixelSize = 18;
  const pixelGap = 3;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: ACCENT }}>
          Emotional Landscape
        </p>
        <h1 style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 700 }}>Year in Pixels</h1>
        <p style={{ margin: '8px 0 0', color: TEXT_SEC, fontSize: 14, lineHeight: 1.5 }}>
          Every square represents a day in your mood spectrum for {year}.
        </p>
      </div>

      {/* ── Year Selector + Stats Bar ────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flexWrap: 'wrap' }}>
        {/* Year selector */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 20px',
          borderRadius: 16,
          background: SURFACE_ELEVATED,
          border: `1px solid ${BORDER}`,
        }}>
          <button type="button" onClick={() => setYear((y) => y - 1)} style={{
            all: 'unset', cursor: 'pointer', fontSize: 20, color: ACCENT, fontWeight: 300,
          }}>&lsaquo;</button>
          <span style={{ fontSize: 20, fontWeight: 700, minWidth: 60, textAlign: 'center' }}>{year}</span>
          <button type="button" onClick={() => setYear((y) => y + 1)} style={{
            all: 'unset', cursor: 'pointer', fontSize: 20, color: ACCENT, fontWeight: 300,
          }}>&rsaquo;</button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, flex: 1, flexWrap: 'wrap' }}>
          <StatBadge value={`${stats.avgMood}/10`} label="AVG MOOD" />
          <StatBadge value={`${stats.totalEntries}`} label="DAYS LOGGED" />
          <StatBadge value={stats.bestMonth} label="BEST MONTH" />
          <StatBadge value={`${stats.streak}`} label="STREAK" />
        </div>
      </div>

      {/* ── Filter Controls ──────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC, marginRight: 8 }}>
          Filter
        </span>
        {([
          { key: 'all' as ScoreFilter, label: 'All' },
          { key: 'low' as ScoreFilter, label: 'Low (1-4)' },
          { key: 'mid' as ScoreFilter, label: 'Mid (5-7)' },
          { key: 'high' as ScoreFilter, label: 'High (8-10)' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setScoreFilter(key)}
            style={{
              padding: '5px 12px',
              borderRadius: 8,
              border: `1px solid ${scoreFilter === key ? ACCENT : BORDER}`,
              background: scoreFilter === key ? ACCENT_DIM : 'transparent',
              color: scoreFilter === key ? ACCENT : TEXT_SEC,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Pixel Grid ───────────────────────────────────────── */}
      {loading ? (
        <div style={{
          height: 400,
          borderRadius: 20,
          background: 'rgba(255,255,255,0.06)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      ) : (
        <div style={{
          padding: 24,
          borderRadius: 20,
          background: SURFACE_ELEVATED,
          border: `1px solid ${BORDER}`,
          overflowX: 'auto',
          position: 'relative',
        }}>
          <div style={{ minWidth: 'fit-content' }}>
            {/* Month headers */}
            <div style={{ display: 'flex', marginBottom: 8 }}>
              <div style={{ width: 28, flexShrink: 0 }} />
              {MONTH_LABELS.map((label) => (
                <div key={label} style={{
                  width: pixelSize + pixelGap,
                  textAlign: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1,
                  color: TEXT_SEC,
                  textTransform: 'uppercase',
                }}>
                  {label.slice(0, 3)}
                </div>
              ))}
            </div>

            {/* Day rows (1-31) */}
            {Array.from({ length: 31 }, (_, dayIdx) => (
              <div key={dayIdx} style={{ display: 'flex', alignItems: 'center' }}>
                {/* Day number label */}
                <div style={{
                  width: 28,
                  flexShrink: 0,
                  fontSize: 10,
                  fontWeight: 600,
                  color: TEXT_SEC,
                  textAlign: 'right',
                  paddingRight: 6,
                  opacity: dayIdx % 5 === 0 ? 1 : 0,
                }}>
                  {dayIdx + 1}
                </div>
                {/* Month cells */}
                {grid.map((month, monthIdx) => {
                  const cell = month[dayIdx];
                  const isEmpty = cell.date === '';
                  const hasScore = cell.score != null;
                  const dimmed = hasScore && !passesFilter(cell.score);
                  const isSelected = selectedDate === cell.date;

                  return (
                    <div
                      key={`${monthIdx}-${dayIdx}`}
                      onMouseEnter={(e) => {
                        if (hasScore) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHover({
                            date: cell.date,
                            score: Math.round(cell.score!),
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          });
                        }
                      }}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => {
                        if (hasScore) setSelectedDate(selectedDate === cell.date ? null : cell.date);
                      }}
                      style={{
                        width: pixelSize,
                        height: pixelSize,
                        borderRadius: 4,
                        margin: pixelGap / 2,
                        cursor: hasScore ? 'pointer' : 'default',
                        opacity: isEmpty ? 0 : dimmed ? 0.15 : 1,
                        backgroundColor: isEmpty
                          ? 'transparent'
                          : hasScore
                            ? scoreToPixelColor(Math.round(cell.score!))
                            : 'rgba(255,255,255,0.06)',
                        outline: isSelected ? `2px solid ${ACCENT}` : 'none',
                        outlineOffset: 1,
                        transition: 'opacity 200ms ease',
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Tooltip (CSS positioned, follows mouse roughly) */}
          {hover && (
            <div style={{
              position: 'fixed',
              left: hover.x,
              top: hover.y - 44,
              transform: 'translateX(-50%)',
              padding: '6px 12px',
              borderRadius: 8,
              background: '#1F1F25',
              border: `1px solid ${BORDER}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              zIndex: 100,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>
                {formatDate(hover.date)} &middot; Score: {hover.score}/10
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Legend ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        padding: '16px 24px',
        borderRadius: 16,
        background: GLASS,
        border: `1px solid ${BORDER}`,
      }}>
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 14,
              height: 14,
              borderRadius: 4,
              background: item.color,
            }} />
            <div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</span>
              {item.range && (
                <span style={{ fontSize: 11, color: TEXT_SEC, marginLeft: 4 }}>({item.range})</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Selected Day Detail ───────────────────────────────── */}
      {selectedDate && selectedEntry && (
        <div style={{
          padding: 24,
          borderRadius: 20,
          background: SURFACE_ELEVATED,
          border: `1px solid ${ACCENT_BORDER}`,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 20,
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
              Date
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700 }}>
              {formatDateLong(selectedDate)}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
              Average Score
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800, color: ACCENT }}>
              {selectedEntry.average.toFixed(1)}/10
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
              Entries
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700 }}>
              {selectedEntry.count}
            </p>
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12 }}>
            <Link
              href={`/mood/history?date=${selectedDate}`}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                background: ACCENT_DIM,
                border: `1px solid ${ACCENT_BORDER}`,
                color: ACCENT,
                fontWeight: 700,
                fontSize: 13,
                textDecoration: 'none',
                letterSpacing: 0.5,
              }}
            >
              View Entries
            </Link>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: `1px solid ${BORDER}`,
                background: 'transparent',
                color: TEXT_SEC,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Monthly Summary ──────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 12,
      }}>
        {MONTH_LABELS.map((label, i) => {
          const monthDays = days.filter((d) => parseInt(d.date.slice(5, 7), 10) - 1 === i);
          const avg = monthDays.length > 0 ? monthDays.reduce((s, d) => s + d.average, 0) / monthDays.length : 0;
          return (
            <div key={label} style={{
              padding: 16,
              borderRadius: 14,
              background: GLASS,
              border: `1px solid ${BORDER}`,
              textAlign: 'center',
            }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
                {label}
              </p>
              <p style={{
                margin: '6px 0 0',
                fontSize: 22,
                fontWeight: 800,
                color: avg > 0 ? ACCENT : TEXT_SEC,
              }}>
                {avg > 0 ? avg.toFixed(1) : '--'}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: TEXT_SEC }}>
                {monthDays.length} {monthDays.length === 1 ? 'day' : 'days'}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Footer ────────────────────────────────────────────── */}
      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: 1, color: TEXT_SEC, textAlign: 'center', textTransform: 'uppercase' }}>
        All data stays on your device. Tap any pixel to see details.
      </p>
    </div>
  );
}

// ── Stat Badge ──────────────────────────────────────────────────────

function StatBadge({ value, label }: { value: string; label: string }) {
  return (
    <div style={{
      flex: '1 1 100px',
      padding: '12px 16px',
      borderRadius: 14,
      background: GLASS,
      border: `1px solid ${BORDER}`,
      textAlign: 'center',
      minWidth: 90,
    }}>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: ACCENT }}>{value}</p>
      <p style={{ margin: '2px 0 0', fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: TEXT_SEC }}>
        {label}
      </p>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}
