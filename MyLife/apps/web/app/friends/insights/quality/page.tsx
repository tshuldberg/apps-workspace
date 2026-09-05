'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchQualityInsights,
  type QualityInsightsData,
} from './actions';
import type {
  PersonTimeShare,
  TimeQualityQuadrant,
} from '@mylife/friends';

const ACCENT = '#EC4899';
const INNER_CIRCLE_PINK = '#F472B6';
const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const BORDER = 'var(--border, rgba(255,255,255,0.06))';
const GLASS = 'var(--glass, rgba(255,255,255,0.03))';
const SURFACE = 'var(--surface-elevated, #2A292F)';

const ENERGY_COLORS: Record<string, string> = {
  energizing: '#10B981',
  neutral: '#9F8E81',
  draining: '#EF4444',
  complicated: '#F59E0B',
};

const QUADRANT_META: Record<TimeQualityQuadrant, { label: string; color: string }> = {
  'high-time-high-quality': { label: 'Core (high time, high quality)', color: '#10B981' },
  'high-time-low-quality': { label: 'Habitual (high time, lower quality)', color: '#F59E0B' },
  'low-time-high-quality': { label: 'Cherished (low time, high quality)', color: '#8BCFF0' },
  'low-time-low-quality': { label: 'Casual (low time, lower quality)', color: '#9F8E81' },
};

// ── Avatar helpers ──────────────────────────────────────────────────

const GRADIENT_PAIRS: string[] = [
  '#EC4899', '#8B5CF6', '#06B6D4', '#F59E0B',
  '#10B981', '#EF4444', '#6366F1', '#E879A1',
];

function nameHash(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getGradient(name: string): string {
  return GRADIENT_PAIRS[nameHash(name) % GRADIENT_PAIRS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ── Main component ──────────────────────────────────────────────────

export default function QualityInsightsPage() {
  const [data, setData] = useState<QualityInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealedSections, setRevealedSections] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    try {
      const result = await fetchQualityInsights();
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

  const toggleReveal = useCallback((section: string) => {
    setRevealedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: TEXT_SEC }}>Loading...</p>
      </div>
    );
  }

  if (!data || (data.timeDistribution.length === 0 && data.innerCircle.length === 0 && data.energyBreakdown.length === 0)) {
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
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        </div>
        <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700, color: TEXT, textAlign: 'center' }}>
          No data yet
        </h2>
        <p style={{ margin: 0, fontSize: 15, color: TEXT_SEC, textAlign: 'center', lineHeight: 1.6 }}>
          Log some hangouts with duration and quality ratings to see quality insights here.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Header */}
      <div>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: TEXT_SEC }}>
          Insights
        </p>
        <h1 style={{ margin: '6px 0 0', fontSize: 38, fontWeight: 800, color: TEXT }}>
          Quality of Time
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: TEXT_SEC }}>
          Just for your awareness. A reflection on how you spend time with the people in your life.
        </p>
      </div>

      {/* Where your time goes */}
      <OptInSectionWeb
        title="Where your time goes"
        subtitle="Top 10 people by total hangout time"
        revealed={revealedSections.has('time')}
        onToggle={() => toggleReveal('time')}
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {data.timeDistribution.map((person) => (
            <TimeBarWeb
              key={person.personId}
              person={person}
              maxMinutes={data.timeDistribution[0]?.totalMinutes ?? 1}
            />
          ))}
        </div>
      </OptInSectionWeb>

      {/* Inner circle */}
      <OptInSectionWeb
        title="Your inner circle"
        subtitle="Top 5 by combined time + quality"
        revealed={revealedSections.has('circle')}
        onToggle={() => toggleReveal('circle')}
      >
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
          {data.innerCircle.map((person) => (
            <div key={person.personId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 80 }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: getGradient(person.personName),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `2px solid ${INNER_CIRCLE_PINK}`,
              }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>
                  {getInitials(person.personName)}
                </span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT, marginTop: 6, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>
                {person.personName}
              </span>
              <span style={{ fontSize: 10, color: TEXT_SEC, marginTop: 2 }}>
                {Math.round(person.totalMinutes / 60)}h | {person.avgQuality.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      </OptInSectionWeb>

      {/* Quality patterns */}
      <OptInSectionWeb
        title="Quality patterns"
        subtitle="Time vs quality quadrant per person"
        revealed={revealedSections.has('quadrants')}
        onToggle={() => toggleReveal('quadrants')}
      >
        <div style={{ display: 'grid', gap: 16 }}>
          {(Object.entries(QUADRANT_META) as [TimeQualityQuadrant, { label: string; color: string }][]).map(([quad, meta]) => {
            const inQuad = data.quadrants.filter((q) => q.quadrant === quad);
            if (inQuad.length === 0) return null;
            return (
              <div key={quad}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: meta.color, display: 'inline-block' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: TEXT, flex: 1 }}>{meta.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: TEXT_SEC }}>{inQuad.length}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {inQuad.slice(0, 5).map((q) => (
                    <span key={q.personId} style={{
                      backgroundColor: SURFACE,
                      padding: '5px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      color: TEXT,
                    }}>
                      {q.personName}
                    </span>
                  ))}
                  {inQuad.length > 5 && (
                    <span style={{ fontSize: 12, color: TEXT_SEC, alignSelf: 'center' }}>+{inQuad.length - 5} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </OptInSectionWeb>

      {/* Energy awareness */}
      <OptInSectionWeb
        title="Energy awareness"
        subtitle="How time breaks down by energy type"
        revealed={revealedSections.has('energy')}
        onToggle={() => toggleReveal('energy')}
      >
        <div style={{ display: 'grid', gap: 0 }}>
          {data.energyBreakdown.map((item) => (
            <div key={item.energyTag} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 0',
              borderBottom: `1px solid ${BORDER}`,
            }}>
              <span style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: ENERGY_COLORS[item.energyTag] ?? '#9F8E81',
                display: 'inline-block',
                flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, textTransform: 'capitalize' }}>
                  {item.energyTag}
                </div>
                <div style={{ fontSize: 12, color: TEXT_SEC, marginTop: 2 }}>
                  {Math.round(item.totalMinutes / 60)}h total | {item.personCount} people | avg quality {item.avgQuality.toFixed(1)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </OptInSectionWeb>
    </div>
  );
}

// ── Opt-in section (collapsed by default) ───────────────────────────

function OptInSectionWeb({
  title,
  subtitle,
  revealed,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  revealed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      borderRadius: 16,
      backgroundColor: GLASS,
      border: `1px solid ${BORDER}`,
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: 16,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 12, color: TEXT_SEC }}>{subtitle}</div>
        </div>
        {!revealed ? (
          <span style={{
            backgroundColor: `${ACCENT}15`,
            padding: '6px 12px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            color: ACCENT,
          }}>
            Tap to reveal
          </span>
        ) : (
          <span style={{ fontSize: 10, color: TEXT_SEC }}>{'\u25B2'}</span>
        )}
      </button>
      {revealed && (
        <div style={{ padding: '0 16px 16px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Time bar ────────────────────────────────────────────────────────

function TimeBarWeb({ person, maxMinutes }: { person: PersonTimeShare; maxMinutes: number }) {
  const fill = maxMinutes > 0 ? person.totalMinutes / maxMinutes : 0;
  const initials = getInitials(person.personName);
  const bgColor = getGradient(person.personName);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: bgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF' }}>{initials}</span>
          </div>
          <span style={{
            fontSize: 14,
            fontWeight: 600,
            color: TEXT,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {person.personName}
          </span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT, flexShrink: 0 }}>
          {person.percentOfTotal}%
        </span>
      </div>
      <div style={{
        height: 6,
        borderRadius: 3,
        backgroundColor: SURFACE,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.max(fill * 100, 2)}%`,
          backgroundColor: ACCENT,
          borderRadius: 3,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: TEXT_SEC }}>
        {Math.round(person.totalMinutes / 60)}h {person.totalMinutes % 60}m | {person.hangoutCount} hangouts
      </p>
    </div>
  );
}
