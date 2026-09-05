'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchInsightsData, type InsightsData } from './actions';
import type { SocialPattern } from '@mylife/friends';

const ACCENT = '#EC4899';
const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const BORDER = 'var(--border, rgba(255,255,255,0.06))';
const GLASS = 'var(--glass, rgba(255,255,255,0.03))';
const SURFACE = 'var(--surface-elevated, #2A292F)';

// ── Bar colors ─────────────────────────────────────────────────────

const BAR_COLORS = {
  current_normal: '#10B981',
  current_above: '#8BCFF0',
  current_below: '#9F8E81',
  past: 'rgba(255,255,255,0.12)',
};

// ── Pattern badge config ───────────────────────────────────────────

const PATTERN_STYLES: Record<SocialPattern, { bg: string; color: string }> = {
  consistent: { bg: 'rgba(16,185,129,0.15)', color: '#10B981' },
  increasing: { bg: 'rgba(139,207,240,0.15)', color: '#8BCFF0' },
  decreasing: { bg: 'rgba(159,142,129,0.15)', color: '#9F8E81' },
  variable: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
  insufficient_data: { bg: 'rgba(255,255,255,0.05)', color: '#9F8E81' },
};

const PATTERN_LABELS: Record<SocialPattern, string> = {
  consistent: 'Consistent',
  increasing: 'Increasing',
  decreasing: 'Decreasing',
  variable: 'Variable',
  insufficient_data: 'Building data...',
};

// ── Main component ─────────────────────────────────────────────────

export default function FriendsInsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const result = await fetchInsightsData();
      setData(result);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: TEXT_SEC }}>Loading...</p>
      </div>
    );
  }

  if (!data || !data.summaries.some((s) => s.totalMinutes > 0)) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: 400,
        margin: '60px auto',
        padding: 48,
        borderRadius: 24,
        background: GLASS,
        border: `1px solid ${BORDER}`,
      }}>
        <div style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: 'rgba(236, 72, 153, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        </div>
        <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700, color: TEXT, textAlign: 'center' }}>
          No insights yet
        </h2>
        <p style={{ margin: 0, fontSize: 15, color: TEXT_SEC, textAlign: 'center', lineHeight: 1.6 }}>
          Log some hangouts and your social energy patterns will appear here.
        </p>
      </div>
    );
  }

  const { summaries, pattern, insight, isOver, isUnder } = data;
  const currentWeek = summaries[summaries.length - 1];
  const currentMinutes = currentWeek?.totalMinutes ?? 0;
  const avgMinutes = summaries.reduce((s, w) => s + w.totalMinutes, 0) / summaries.length;
  const maxMinutes = Math.max(...summaries.map((s) => s.totalMinutes), 1);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Header */}
      <div>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: TEXT_SEC }}>
          Insights
        </p>
        <h1 style={{ margin: '6px 0 0', fontSize: 38, fontWeight: 800, color: TEXT }}>
          Social Energy
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: TEXT_SEC }}>
          Your social time patterns at a glance.
        </p>
      </div>

      {/* Current Week Summary */}
      {currentWeek && (
        <div style={{
          padding: 24,
          borderRadius: 20,
          background: GLASS,
          border: `1px solid ${BORDER}`,
        }}>
          <p style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
            This Week
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 16 }}>
            <StatBlock value={`${Math.round(currentMinutes / 60 * 10) / 10}`} unit="hrs" label="Social time" />
            <StatBlock value={`${currentWeek.hangoutCount}`} unit="" label="Hangouts" />
            <StatBlock value={`${currentWeek.uniquePeople}`} unit="" label="People" />
          </div>
          {avgMinutes > 0 && (
            <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC, textAlign: 'center' }}>
              {currentMinutes > avgMinutes
                ? `${Math.round(((currentMinutes - avgMinutes) / avgMinutes) * 100)}% above your average`
                : currentMinutes < avgMinutes
                  ? `${Math.round(((avgMinutes - currentMinutes) / avgMinutes) * 100)}% below your average`
                  : 'Right at your average'}
            </p>
          )}
        </div>
      )}

      {/* Pattern + Alert row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Pattern Badge */}
        <div style={{
          padding: 20,
          borderRadius: 16,
          background: GLASS,
          border: `1px solid ${BORDER}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: TEXT_SEC }}>Your rhythm</p>
          <span style={{
            display: 'inline-block',
            padding: '6px 16px',
            borderRadius: 999,
            backgroundColor: PATTERN_STYLES[pattern].bg,
            color: PATTERN_STYLES[pattern].color,
            fontSize: 14,
            fontWeight: 700,
            marginBottom: 10,
          }}>
            {PATTERN_LABELS[pattern]}
          </span>
          <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC, lineHeight: 1.5 }}>{insight}</p>
        </div>

        {/* Alert or top person */}
        <div style={{
          padding: 20,
          borderRadius: 16,
          background: GLASS,
          border: `1px solid ${BORDER}`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          {(isOver || isUnder) ? (
            <div style={{ borderLeft: `4px solid ${isOver ? '#8BCFF0' : '#9F8E81'}`, paddingLeft: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC, lineHeight: 1.6 }}>
                {isOver
                  ? 'This was a full week with more social time than usual.'
                  : 'This was a lighter week with less social time than usual.'}
              </p>
            </div>
          ) : currentWeek?.topPerson ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, color: TEXT_SEC }}>Most time with</p>
              <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: TEXT }}>
                {currentWeek.topPerson.name}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC }}>
                {Math.round(currentWeek.topPerson.minutes / 60 * 10) / 10} hours
              </p>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC, textAlign: 'center' }}>
              No standout patterns this week.
            </p>
          )}
        </div>
      </div>

      {/* Weekly Bar Chart */}
      <div style={{
        padding: 20,
        borderRadius: 16,
        background: GLASS,
        border: `1px solid ${BORDER}`,
      }}>
        <p style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: TEXT }}>Last 8 Weeks</p>
        <div style={{ display: 'grid', gap: 8 }}>
          {summaries.map((week, i) => {
            const isCurrent = i === summaries.length - 1;
            const hours = Math.round(week.totalMinutes / 60 * 10) / 10;
            const barWidth = maxMinutes > 0
              ? Math.max((week.totalMinutes / maxMinutes) * 100, 2)
              : 2;

            let barColor: string;
            if (isCurrent) {
              if (week.totalMinutes > avgMinutes * 1.3) barColor = BAR_COLORS.current_above;
              else if (week.totalMinutes < avgMinutes * 0.7) barColor = BAR_COLORS.current_below;
              else barColor = BAR_COLORS.current_normal;
            } else {
              barColor = BAR_COLORS.past;
            }

            return (
              <div key={week.weekStart} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 36, fontSize: 11, color: TEXT_SEC, textAlign: 'right' }}>
                  {isCurrent ? 'Now' : formatWeekLabel(week.weekStart)}
                </span>
                <div style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: SURFACE,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${barWidth}%`,
                    backgroundColor: barColor,
                    borderRadius: 4,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <span style={{
                  width: 36,
                  fontSize: 11,
                  color: isCurrent ? TEXT : TEXT_SEC,
                  textAlign: 'right',
                  fontWeight: isCurrent ? 600 : 400,
                }}>
                  {hours}h
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Link to Quality Insights */}
      <Link href="/friends/insights/quality" style={{ textDecoration: 'none' }}>
        <div style={{
          padding: 20,
          borderRadius: 16,
          background: GLASS,
          border: `1px solid ${BORDER}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          transition: 'border-color 0.2s ease',
        }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: TEXT }}>
              Quality of Time
            </p>
            <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC }}>
              Time distribution, inner circle, and relationship quality patterns
            </p>
          </div>
          <span style={{ fontSize: 18, color: TEXT_SEC }}>{'\u2192'}</span>
        </div>
      </Link>
    </div>
  );
}

// ── Stat block ─────────────────────────────────────────────────────

function StatBlock({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 3 }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: TEXT }}>{value}</span>
        {unit && <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_SEC }}>{unit}</span>}
      </div>
      <p style={{ margin: '4px 0 0', fontSize: 12, color: TEXT_SEC }}>{label}</p>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
