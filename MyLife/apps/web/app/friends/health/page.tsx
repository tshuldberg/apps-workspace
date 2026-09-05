'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchHealthData,
  dismissHealthNudge,
  snoozeHealthNudge,
  actOnHealthNudge,
  type NudgeWithPerson,
  type FrequencyBar,
} from './actions';
import type { DriftInfo, NudgeUrgency } from '@mylife/friends';

const ACCENT = '#EC4899';
const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const BORDER = 'var(--border, rgba(255,255,255,0.06))';
const GLASS = 'var(--glass, rgba(255,255,255,0.03))';
const SURFACE = 'var(--surface-elevated, #2A292F)';

const URGENCY_COLORS: Record<NudgeUrgency, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#10B981',
};

const URGENCY_LABELS: Record<NudgeUrgency, string> = {
  high: 'Overdue',
  medium: 'Due soon',
  low: 'Gentle reminder',
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

export default function FriendsHealthPage() {
  const [nudges, setNudges] = useState<NudgeWithPerson[]>([]);
  const [frequencyBars, setFrequencyBars] = useState<FrequencyBar[]>([]);
  const [drifts, setDrifts] = useState<DriftInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actedNudgeIds, setActedNudgeIds] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    try {
      const data = await fetchHealthData();
      setNudges(data.nudges);
      setFrequencyBars(data.frequencyBars);
      setDrifts(data.drifts);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleDismiss = useCallback(async (nudgeId: string) => {
    try {
      await dismissHealthNudge(nudgeId);
      setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
    } catch {
      // silently handle
    }
  }, []);

  const handleSnooze = useCallback(async (nudgeId: string) => {
    try {
      await snoozeHealthNudge(nudgeId);
      setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
    } catch {
      // silently handle
    }
  }, []);

  const handleActOn = useCallback(async (nudgeId: string) => {
    try {
      await actOnHealthNudge(nudgeId);
      setActedNudgeIds((prev) => new Set(prev).add(nudgeId));
      setTimeout(() => {
        setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
        setActedNudgeIds((prev) => {
          const next = new Set(prev);
          next.delete(nudgeId);
          return next;
        });
      }, 2000);
    } catch {
      // silently handle
    }
  }, []);

  const toggleSection = useCallback((section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  const isEmpty = nudges.length === 0 && frequencyBars.length === 0 && drifts.length === 0;

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: TEXT_SEC }}>Loading...</p>
      </div>
    );
  }

  if (isEmpty) {
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
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700, color: TEXT, textAlign: 'center' }}>
          All good!
        </h2>
        <p style={{ margin: 0, fontSize: 15, color: TEXT_SEC, textAlign: 'center', lineHeight: 1.6 }}>
          No nudges or alerts right now. Your relationships are looking healthy.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Header */}
      <div>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: TEXT_SEC }}>
          Health
        </p>
        <h1 style={{ margin: '6px 0 0', fontSize: 38, fontWeight: 800, color: TEXT }}>
          Relationship Health
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: TEXT_SEC }}>
          A gentle overview of how your connections are doing.
        </p>
      </div>

      {/* Active Nudges */}
      {nudges.length > 0 && (
        <SectionWeb
          title="Active Nudges"
          count={nudges.length}
          collapsed={collapsedSections.has('nudges')}
          onToggle={() => toggleSection('nudges')}
        >
          <div style={{ display: 'grid', gap: 10 }}>
            {nudges.map((nudge) => (
              <NudgeCardWeb
                key={nudge.id}
                nudge={nudge}
                acted={actedNudgeIds.has(nudge.id)}
                onDismiss={() => void handleDismiss(nudge.id)}
                onSnooze={() => void handleSnooze(nudge.id)}
                onAct={() => void handleActOn(nudge.id)}
              />
            ))}
          </div>
        </SectionWeb>
      )}

      {/* Frequency Overview */}
      {frequencyBars.length > 0 && (
        <SectionWeb
          title="Frequency Overview"
          count={frequencyBars.length}
          collapsed={collapsedSections.has('frequency')}
          onToggle={() => toggleSection('frequency')}
        >
          <div style={{ display: 'grid', gap: 8 }}>
            {frequencyBars.map((bar) => (
              <FrequencyBarWeb key={bar.personId} bar={bar} />
            ))}
          </div>
        </SectionWeb>
      )}

      {/* Drift Alerts */}
      {drifts.length > 0 && (
        <SectionWeb
          title="Drift Alerts"
          count={drifts.length}
          collapsed={collapsedSections.has('drift')}
          onToggle={() => toggleSection('drift')}
        >
          <div style={{ display: 'grid', gap: 8 }}>
            {drifts.map((drift) => (
              <DriftCardWeb key={drift.personId} drift={drift} />
            ))}
          </div>
        </SectionWeb>
      )}
    </div>
  );
}

// ── Section wrapper ─────────────────────────────────────────────────

function SectionWeb({
  title,
  count,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '12px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 700, color: TEXT }}>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            backgroundColor: `${ACCENT}20`,
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            color: ACCENT,
          }}>
            {count}
          </span>
          <span style={{ fontSize: 10, color: TEXT_SEC }}>
            {collapsed ? '\u25BC' : '\u25B2'}
          </span>
        </span>
      </button>
      {!collapsed && children}
    </div>
  );
}

// ── Nudge card ──────────────────────────────────────────────────────

function NudgeCardWeb({
  nudge,
  acted,
  onDismiss,
  onSnooze,
  onAct,
}: {
  nudge: NudgeWithPerson;
  acted: boolean;
  onDismiss: () => void;
  onSnooze: () => void;
  onAct: () => void;
}) {
  const urgencyColor = URGENCY_COLORS[nudge.urgency];
  const urgencyLabel = URGENCY_LABELS[nudge.urgency];
  const initials = getInitials(nudge.personName);
  const bgColor = getGradient(nudge.personName);

  return (
    <div style={{
      display: 'flex',
      borderRadius: 16,
      backgroundColor: GLASS,
      border: `1px solid ${BORDER}`,
      overflow: 'hidden',
      opacity: acted ? 0.5 : 1,
      transition: 'opacity 0.4s ease',
    }}>
      {/* Colored left accent */}
      <div style={{ width: 4, backgroundColor: urgencyColor, flexShrink: 0 }} />

      <div style={{ flex: 1, padding: 16 }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: bgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{initials}</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>{nudge.personName}</div>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 8px',
              borderRadius: 999,
              backgroundColor: `${urgencyColor}20`,
              fontSize: 11,
              fontWeight: 600,
              color: urgencyColor,
              marginTop: 4,
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: urgencyColor,
                display: 'inline-block',
              }} />
              {urgencyLabel}
            </span>
          </div>
        </div>

        {/* Message */}
        {acted ? (
          <p style={{ margin: '0 0 4px', fontSize: 14, color: '#10B981', fontWeight: 600 }}>
            Nice! Hope it went well.
          </p>
        ) : (
          <>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: TEXT_SEC, lineHeight: 1.5 }}>
              {nudge.message}
            </p>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={onDismiss}
                style={{
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: `1px solid ${BORDER}`,
                  backgroundColor: GLASS,
                  color: '#9F8E81',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={onSnooze}
                style={{
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: `1px solid ${BORDER}`,
                  backgroundColor: GLASS,
                  color: '#F59E0B',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Snooze 7d
              </button>
              <button
                type="button"
                onClick={onAct}
                style={{
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: `1px solid ${ACCENT}40`,
                  backgroundColor: `${ACCENT}15`,
                  color: ACCENT,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Reached out!
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Frequency bar ───────────────────────────────────────────────────

function FrequencyBarWeb({ bar }: { bar: FrequencyBar }) {
  const fill = bar.daysSince !== null
    ? Math.min(bar.daysSince / bar.goalDays, 1)
    : 1;
  const daysLabel =
    bar.daysSince !== null ? `${bar.daysSince}/${bar.goalDays}d` : `?/${bar.goalDays}d`;
  const initials = getInitials(bar.personName);
  const bgColor = getGradient(bar.personName);

  return (
    <div style={{
      padding: 14,
      borderRadius: 14,
      backgroundColor: GLASS,
      border: `1px solid ${BORDER}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
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
            {bar.personName}
          </span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: bar.color, flexShrink: 0 }}>
          {daysLabel}
        </span>
      </div>

      {/* Bar */}
      <div style={{
        height: 6,
        borderRadius: 3,
        backgroundColor: SURFACE,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.max(fill * 100, 2)}%`,
          backgroundColor: bar.color,
          borderRadius: 3,
          transition: 'width 0.3s ease',
        }} />
      </div>

      <p style={{ margin: '6px 0 0', fontSize: 12, color: TEXT_SEC }}>
        {bar.label}
      </p>
    </div>
  );
}

// ── Drift card ──────────────────────────────────────────────────────

function DriftCardWeb({ drift }: { drift: DriftInfo }) {
  return (
    <div style={{
      display: 'flex',
      borderRadius: 14,
      backgroundColor: GLASS,
      border: `1px solid ${BORDER}`,
      overflow: 'hidden',
    }}>
      <div style={{ width: 3, backgroundColor: '#F59E0B', flexShrink: 0 }} />
      <div style={{ flex: 1, padding: 14 }}>
        <p style={{ margin: '0 0 6px', fontSize: 14, color: TEXT_SEC, lineHeight: 1.5 }}>
          {drift.message}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: '#9F8E81' }}>
          Pattern: every ~{drift.historicalAvgDays}d | Current gap: {drift.currentGapDays}d | {drift.driftRatio}x usual
        </p>
      </div>
    </div>
  );
}
