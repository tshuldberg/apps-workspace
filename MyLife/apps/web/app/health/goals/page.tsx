'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchActiveGoals, doCreateGoal, doDeactivateGoal } from '../actions';
import type { GoalDomain, GoalPeriod, GoalDirection } from '@mylife/health';

interface Goal {
  id: string;
  domain: string;
  metric: string;
  target_value: number;
  unit: string | null;
  period: string;
  direction: string;
  label: string | null;
  is_active: number;
  created_at: string;
}

const T = {
  bg: '#131318',
  depth: '#0E0E13',
  low: '#1B1B20',
  mid: '#1F1F25',
  high: '#2A292F',
  highest: '#35343A',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  textDim: 'rgba(228,225,233,0.5)',
  textFaint: 'rgba(228,225,233,0.35)',
  border: 'rgba(255,255,255,0.06)',
  accent: '#EF4444',
  accentDim: 'rgba(239,68,68,0.15)',
  emerald: '#34D399',
} as const;

const font = "'Plus Jakarta Sans', -apple-system, system-ui, sans-serif";

const DOMAINS: { id: GoalDomain; label: string; icon: string }[] = [
  { id: 'steps', label: 'Steps', icon: '⇢' },
  { id: 'sleep', label: 'Sleep', icon: '☾' },
  { id: 'water', label: 'Water', icon: '◌' },
  { id: 'fasting', label: 'Fasting', icon: '◐' },
  { id: 'weight', label: 'Weight', icon: '◎' },
  { id: 'adherence', label: 'Adherence', icon: '℞' },
  { id: 'custom', label: 'Custom', icon: '◈' },
];

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: T.bg,
    color: T.text,
    fontFamily: font,
    padding: '40px 32px 120px',
  },
  container: { maxWidth: 1200, margin: '0 auto' },
  backLink: {
    color: T.textDim,
    textDecoration: 'none',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    display: 'inline-block',
    marginBottom: 24,
  },
  titleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 40,
  },
  title: {
    fontSize: 40,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: T.text,
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: T.textSecondary,
    marginTop: 8,
  },
  createBtn: {
    padding: '12px 24px',
    borderRadius: 9999,
    background: T.accent,
    color: '#fff',
    border: 'none',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    color: T.accent,
    marginBottom: 20,
  },

  /* Goal grid */
  goalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 16,
    marginBottom: 48,
  },
  goalCard: {
    background: T.low,
    borderRadius: 16,
    padding: 24,
    border: `1px solid ${T.border}`,
  },
  goalHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  goalIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: T.accentDim,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    color: T.accent,
    flexShrink: 0,
  },
  goalName: { fontSize: 16, fontWeight: 700, color: T.text, flex: 1 },
  goalMeta: {
    fontSize: 11,
    color: T.textDim,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  progressWrap: { marginTop: 16 },
  progressLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    color: T.textSecondary,
    marginBottom: 8,
  },
  progressBar: {
    width: '100%',
    height: 6,
    background: T.highest,
    borderRadius: 9999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: T.accent,
    borderRadius: 9999,
  },
  goalActions: {
    display: 'flex',
    gap: 8,
    marginTop: 20,
    paddingTop: 16,
    borderTop: `1px solid ${T.border}`,
  },
  btnGhost: {
    background: 'transparent',
    border: `1px solid ${T.border}`,
    color: T.textSecondary,
    borderRadius: 9999,
    padding: '6px 14px',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
  },

  /* Create form */
  formCard: {
    background: T.low,
    borderRadius: 16,
    padding: 32,
    border: `1px solid ${T.border}`,
    marginBottom: 48,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16,
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    color: T.textDim,
    marginBottom: 8,
    display: 'block',
  },
  input: {
    width: '100%',
    background: T.depth,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: T.text,
    fontFamily: font,
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    background: T.depth,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: T.text,
    fontFamily: font,
  },
  submitBtn: {
    padding: '12px 32px',
    borderRadius: 9999,
    background: T.accent,
    color: '#fff',
    border: 'none',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
  },
  empty: {
    padding: 48,
    textAlign: 'center',
    color: T.textFaint,
    fontSize: 13,
  },
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [domain, setDomain] = useState<GoalDomain>('steps');
  const [metric, setMetric] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [period, setPeriod] = useState<GoalPeriod>('daily');
  const [direction, setDirection] = useState<GoalDirection>('at_least');
  const [label, setLabel] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await fetchActiveGoals();
      setGoals(data as Goal[]);
    } catch (err) {
      console.error('Failed to load goals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    const val = parseFloat(targetValue);
    if (isNaN(val)) return;
    try {
      await doCreateGoal({
        domain,
        metric: metric.trim() || domain,
        target_value: val,
        unit: unit.trim() || undefined,
        period,
        direction,
        label: label.trim() || undefined,
      });
      setMetric('');
      setTargetValue('');
      setUnit('');
      setLabel('');
      setShowForm(false);
      await load();
    } catch (err) {
      console.error('Failed to create goal:', err);
    }
  };

  const handleDeactivate = async (goalId: string) => {
    try {
      await doDeactivateGoal(goalId);
      await load();
    } catch (err) {
      console.error('Failed to deactivate goal:', err);
    }
  };

  if (loading) {
    return (
      <div style={s.page}>
        <div style={s.container}>
          <div style={s.empty}>Loading goals...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <Link href="/health" style={s.backLink}>
          ← MyHealth / Goals
        </Link>

        <div style={s.titleRow}>
          <div>
            <h1 style={s.title}>Goals</h1>
            <p style={s.subtitle}>Set and track your health targets</p>
          </div>
          <button type="button" style={s.createBtn} onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : '+ New Goal'}
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div style={s.formCard}>
            <div style={s.sectionLabel}>New Goal</div>
            <div style={s.formGrid}>
              <div>
                <label style={s.fieldLabel}>Domain</label>
                <select
                  style={s.select}
                  value={domain}
                  onChange={(e) => setDomain(e.target.value as GoalDomain)}
                >
                  {DOMAINS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={s.fieldLabel}>Direction</label>
                <select
                  style={s.select}
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as GoalDirection)}
                >
                  <option value="at_least">At Least</option>
                  <option value="at_most">At Most</option>
                  <option value="exactly">Exactly</option>
                </select>
              </div>
              <div>
                <label style={s.fieldLabel}>Target</label>
                <input
                  style={s.input}
                  type="number"
                  placeholder="10000"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                />
              </div>
              <div>
                <label style={s.fieldLabel}>Period</label>
                <select
                  style={s.select}
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as GoalPeriod)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {domain === 'custom' && (
                <div>
                  <label style={s.fieldLabel}>Metric</label>
                  <input
                    style={s.input}
                    value={metric}
                    onChange={(e) => setMetric(e.target.value)}
                    placeholder="e.g., meditation"
                  />
                </div>
              )}
              <div>
                <label style={s.fieldLabel}>Unit</label>
                <input
                  style={s.input}
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="steps, hrs, %"
                />
              </div>
              <div>
                <label style={s.fieldLabel}>Label</label>
                <input
                  style={s.input}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Walk 10K steps daily"
                />
              </div>
            </div>
            <button type="button" style={s.submitBtn} onClick={handleCreate}>
              Create Goal
            </button>
          </div>
        )}

        {/* Active goals */}
        <div style={s.sectionLabel}>Active Goals ({goals.length})</div>
        {goals.length === 0 ? (
          <div style={s.empty}>No active goals. Click "New Goal" to get started.</div>
        ) : (
          <div style={s.goalGrid}>
            {goals.map((goal) => {
              const domainInfo = DOMAINS.find((d) => d.id === goal.domain) ?? DOMAINS[0];
              // Progress isn't queryable from web yet, so show zero state
              const progressPct = 0;
              return (
                <div key={goal.id} style={s.goalCard}>
                  <div style={s.goalHead}>
                    <div style={s.goalIcon}>{domainInfo.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={s.goalName}>{goal.label ?? domainInfo.label}</div>
                      <div style={s.goalMeta}>
                        {goal.direction.replace('_', ' ')} {goal.target_value} {goal.unit ?? ''} ·{' '}
                        {goal.period}
                      </div>
                    </div>
                  </div>
                  <div style={s.progressWrap}>
                    <div style={s.progressLabel}>
                      <span>Progress</span>
                      <span>{progressPct}%</span>
                    </div>
                    <div style={s.progressBar}>
                      <div style={{ ...s.progressFill, width: `${progressPct}%` }} />
                    </div>
                  </div>
                  <div style={s.goalActions}>
                    <button
                      type="button"
                      style={s.btnGhost}
                      onClick={() => handleDeactivate(goal.id)}
                    >
                      Deactivate
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
